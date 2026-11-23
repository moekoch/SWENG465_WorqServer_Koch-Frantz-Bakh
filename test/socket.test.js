const test = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { startApp } = require('./helpers/harness');
const { resetRateLimits } = require('../services/chat');
const { recordMatchResults } = require('../services/gameResults');

// connect as a user and wait until the server has sent them their fish
function connect(app, user) {
    return new Promise((resolve, reject) => {
        const socket = io(app.url, { auth: { token: user.token }, transports: ['websocket'], forceNew: true });
        socket.once('connect_error', reject);
        socket.once('connect', () => resolve(socket));
    });
}

async function joinRoom(app, user) {
    const socket = await connect(app, user);
    await new Promise((resolve) => {
        socket.once('session:self', resolve);
        socket.emit('session:join', { sessionId: 'main' });
    });
    return socket;
}

const say = (socket, text) => new Promise((resolve) => socket.emit('chat:send', { text }, resolve));

// collect messages for a moment
function listen(socket, event) {
    const heard = [];
    socket.on(event, (payload) => heard.push(payload));
    return heard;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('person reports are stored and alert connected moderators only', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const mod = await app.makeUser('Mod', { role: 'moderator' });
        const moderatorSocket = track(await connect(app, mod));
        const userSocket = track(await connect(app, bob));
        const notifications = [];
        moderatorSocket.on('moderation:report:new', (notification) => notifications.push(notification));
        const userNotifications = [];
        userSocket.on('moderation:report:new', (notification) => userNotifications.push(notification));

        const sent = await app.api('POST', '/api/reports', {
            token: ann.token,
            body: { userId: bob.id, reason: 'harassment', details: 'Targeted harassment in chat.' },
        });
        assert.strictEqual(sent.status, 201);
        await wait(50);
        assert.strictEqual(notifications.length, 1);
        assert.strictEqual(notifications[0].reportId, sent.body._id);
        assert.strictEqual(notifications[0].reportedUserId, bob.id);
        assert.strictEqual(notifications[0].reason, 'harassment');
        assert.strictEqual(userNotifications.length, 0);

        const persisted = await app.db.collection('reports').findOne({ reportedUserId: bob._id });
        assert.strictEqual(persisted.status, 'open');
        assert.strictEqual(persisted.details, 'Targeted harassment in chat.');
    });
});

async function withSockets(run) {
    const app = await startApp();
    const sockets = [];
    const track = (socket) => { sockets.push(socket); return socket; };
    try {
        await run(app, track);
    } finally {
        sockets.forEach((socket) => socket.disconnect());
        app.server.closeAllConnections?.();
        await app.close();
    }
}

test('chat: a clean message reaches everyone in the room, saved with an id people can report', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const a = track(await joinRoom(app, ann));
        const b = track(await joinRoom(app, bob));
        const heardByBob = listen(b, 'chat:message');
        const heardByAnn = listen(a, 'chat:message');

        const ack = await say(a, 'HELLO EVERYONE   HOW ARE YOU');
        assert.strictEqual(ack.ok, true);
        assert.ok(ack.messageId);
        await wait(100);

        assert.strictEqual(heardByBob.length, 1);
        assert.strictEqual(heardByBob[0].username, 'Ann');
        assert.strictEqual(heardByBob[0].text, 'Hello everyone how are you'); // tidied
        assert.strictEqual(heardByBob[0].messageId, ack.messageId);
        assert.strictEqual(heardByBob[0].id, ann.id);
        assert.strictEqual(heardByAnn.length, 1); // the sender sees it too

        // it was saved, so it shows up in the room's history
        const room = (await app.api('GET', '/api/sessions/main')).body;
        const history = await app.api('GET', `/api/chats/${room.chatId}/messages`, { token: bob.token });
        assert.deepStrictEqual(history.body.map((message) => message.body), ['Hello everyone how are you']);

        // and the other person can report it
        const report = await app.api('POST', '/api/reports', { token: bob.token, body: { messageId: ack.messageId, reason: 'other' } });
        assert.strictEqual(report.status, 201);
    });
});

test('chat: blocked messages go nowhere, and repeated problems start a chat break', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const a = track(await joinRoom(app, ann));
        const b = track(await joinRoom(app, bob));
        const heard = listen(b, 'chat:message');
        const muted = listen(a, 'moderation:muted');

        const refused = await say(a, 'what the f*ck is this sh1t');
        assert.strictEqual(refused.ok, false);
        assert.strictEqual(refused.code, 'MODERATED');
        assert.ok(!/fuck|shit/i.test(refused.error));
        resetRateLimits();
        assert.strictEqual((await say(a, 'my email is bob@example.com')).code, 'MODERATED');
        resetRateLimits();
        await wait(100);
        assert.strictEqual(heard.length, 0);

        // two strikes so far; a hate-speech message is worth three more
        const hate = await say(a, 'kill all jews');
        assert.strictEqual(hate.code, 'MUTED');
        assert.ok(hate.until);
        await wait(100);
        assert.strictEqual(muted.length, 1);

        resetRateLimits();
        const after = await say(a, 'sorry!');
        assert.strictEqual(after.ok, false);
        assert.strictEqual(after.code, 'MUTED');
        assert.strictEqual(heard.length, 0);

        // Bob is unaffected, and Ann is in the moderators' queue
        resetRateLimits();
        assert.strictEqual((await say(b, 'hi')).ok, true);
        const mod = await app.makeUser('Mod', { role: 'moderator' });
        const queue = await app.api('GET', '/api/reports', { token: mod.token });
        assert.ok(queue.body.some((report) => report.source === 'auto' && report.reportedUsername === 'Ann'));

        // a moderator can end the break early
        const breaks = await app.api('GET', '/api/moderation/mutes?active=true', { token: mod.token });
        assert.strictEqual((await app.api('DELETE', `/api/moderation/mutes/${breaks.body[0]._id}`, { token: mod.token })).status, 200);
        resetRateLimits();
        assert.strictEqual((await say(a, 'thanks')).ok, true);
    });
});

test('chat: slow mode, repeats, and chatting without being in the room', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const lurker = track(await connect(app, ann));
        assert.strictEqual((await say(lurker, 'hello')).code, 'NOT_IN_ROOM');
        lurker.disconnect();

        const bob = await app.makeUser('Bob');
        const b = track(await joinRoom(app, bob));
        assert.strictEqual((await say(b, 'first')).ok, true);
        assert.strictEqual((await say(b, 'second')).code, 'RATE_LIMITED');
        await wait(750);
        assert.strictEqual((await say(b, 'FIRST')).error, 'You just said that.');
        await wait(750);
        assert.strictEqual((await say(b, 'x'.repeat(121))).code, 'INVALID');
        const bad = await new Promise((resolve) => b.emit('chat:send', {}, resolve));
        assert.strictEqual(bad.ok, false);
    });
});

test('chat: people you blocked never hear from you, and you never hear from them', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const cy = await app.makeUser('Cy');
        const a = track(await joinRoom(app, ann));
        const b = track(await joinRoom(app, bob));
        const c = track(await joinRoom(app, cy));
        const heardByBob = listen(b, 'chat:message');
        const heardByCy = listen(c, 'chat:message');
        const heardByAnn = listen(a, 'chat:message');

        // Bob blocks Ann while connected: it takes effect straight away
        await app.api('POST', '/api/blocks', { token: bob.token, body: { userId: ann.id } });
        await say(a, 'hi all');
        resetRateLimits();
        await say(b, 'hello from bob');
        await wait(150);

        assert.deepStrictEqual(heardByCy.map((message) => message.username), ['Ann', 'Bob']);
        assert.deepStrictEqual(heardByBob.map((message) => message.username), ['Bob']); // not Ann
        assert.deepStrictEqual(heardByAnn.map((message) => message.username), ['Ann']); // not Bob either

        // unblocking works the same way
        await app.api('DELETE', `/api/blocks/${ann.id}`, { token: bob.token });
        resetRateLimits();
        await say(a, 'back again');
        await wait(100);
        assert.strictEqual(heardByBob.at(-1).text, 'back again');
    });
});

test('presence and notices: friends see who is online, and get live requests and invites', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const cy = await app.makeUser('Cy');
        await app.befriend(ann, bob);
        await app.befriend(ann, cy);
        const onlineNames = async () => (await app.api('GET', '/api/users/me/friends', { token: ann.token })).body.filter((friend) => friend.online).map((friend) => friend.username);

        assert.deepStrictEqual(await onlineNames(), []);
        const b = track(await joinRoom(app, bob));
        assert.deepStrictEqual(await onlineNames(), ['Bob']);

        // "online status: nobody" hides you
        await app.api('PATCH', '/api/users/me/settings', { token: bob.token, body: { onlineStatus: 'nobody' } });
        assert.deepStrictEqual(await onlineNames(), []);
        await app.api('PATCH', '/api/users/me/settings', { token: bob.token, body: { onlineStatus: 'friends' } });

        const invites = listen(b, 'invite:received');
        const requests = listen(b, 'friend:request');
        const dan = await app.makeUser('Dan');
        await app.api('POST', '/api/friends', { token: dan.token, body: { username: 'Bob' } });
        await app.api('POST', '/api/invites', { token: ann.token, body: { toUserId: bob.id, type: 'game', game: 'spades' } });
        await wait(100);
        assert.strictEqual(requests[0].username, 'Dan');
        assert.strictEqual(invites[0].from.username, 'Ann');
        assert.strictEqual(invites[0].game, 'spades');

        // a moderator's actions reach the person live
        const mod = await app.makeUser('Mod', { role: 'moderator' });
        const breaks = listen(b, 'moderation:muted');
        await app.api('POST', '/api/moderation/mutes', { token: mod.token, body: { userId: bob.id, minutes: 5 } });
        await wait(100);
        assert.strictEqual(breaks.length, 1);

        b.disconnect();
        await wait(100);
        assert.deepStrictEqual(await onlineNames(), []);
    });
});

test('presence: friends hear when someone comes online or goes offline', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        const stranger = await app.makeUser('Stranger');
        await app.befriend(ann, bob);
        const a = track(await connect(app, ann));
        const heard = listen(a, 'friend:presence');
        const strangerSocket = track(await connect(app, stranger));
        const strangerHeard = listen(strangerSocket, 'friend:presence');

        const b = track(await connect(app, bob));
        await wait(150);
        assert.deepStrictEqual(heard, [{ userId: bob.id, online: true }]);
        b.disconnect();
        await wait(150);
        assert.deepStrictEqual(heard.at(-1), { userId: bob.id, online: false });
        assert.strictEqual(strangerHeard.length, 0);
    });
});

test('banned users are disconnected and can\'t reconnect; full rooms turn people away', async () => {
    await withSockets(async (app, track) => {
        const ann = await app.makeUser('Ann');
        const boss = await app.makeUser('Boss', { role: 'admin' });
        const a = track(await joinRoom(app, ann));
        const closed = new Promise((resolve) => a.once('disconnect', resolve));
        await app.api('PATCH', `/api/users/${ann.id}/status`, { token: boss.token, body: { status: 'banned' } });
        await closed;
        await assert.rejects(connect(app, ann));

        // a room that holds one fish
        await app.api('POST', '/api/sessions', { token: boss.token, body: { slug: 'tiny', name: 'Tiny', capacity: 2 } });
        await app.db.collection('sessions').updateOne({ slug: 'tiny' }, { $set: { capacity: 1 } });
        const bob = await app.makeUser('Bob');
        const cy = await app.makeUser('Cy');
        const b = track(await connect(app, bob));
        await new Promise((resolve) => { b.once('session:self', resolve); b.emit('session:join', { sessionId: 'tiny' }); });
        const c = track(await connect(app, cy));
        const error = await new Promise((resolve) => { c.once('session:error', resolve); c.emit('session:join', { sessionId: 'tiny' }); });
        assert.match(error.error, /full/);
        const listed = await app.api('GET', '/api/sessions/tiny');
        assert.strictEqual(listed.body.online, 1);
    });
});

test('finished matches between people are recorded for both players', async () => {
    const app = await startApp();
    try {
        const ann = await app.makeUser('Ann');
        const bob = await app.makeUser('Bob');
        await recordMatchResults({ game: 'go-fish', players: [{ id: ann.id, outcome: 'win' }, { id: bob.id, outcome: 'loss' }] });
        const mine = await app.api('GET', '/api/games/results?opponentType=user', { token: ann.token });
        assert.strictEqual(mine.body[0].outcome, 'win');
        assert.strictEqual(mine.body[0].opponentId, bob.id);
        assert.strictEqual(mine.body[0].source, 'server');
        assert.strictEqual((await app.api('GET', '/api/games/scores/users/' + bob.id, { token: ann.token })).body.overall.losses, 1);
    } finally {
        await app.close();
    }
});
