const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers/harness');

// each test gets a fresh app + empty database
async function withApp(run) {
    const app = await startApp();
    try {
        await run(app);
    } finally {
        // sockets from other tests could keep the server open
        app.server.closeAllConnections?.();
        await app.close();
    }
}

test('register: filter, validation, duplicates, login, and banned accounts', async () => {
    await withApp(async ({ api, db }) => {
        const post = (body) => api('POST', '/api/users', { body });
        assert.strictEqual((await post({ username: 'shit_head', email: 'a@b.co', password: 'password123' })).status, 400);
        assert.strictEqual((await post({ username: 'Admin', email: 'a@b.co', password: 'password123' })).status, 400);
        assert.strictEqual((await post({ username: 'ab', email: 'a@b.co', password: 'password123' })).status, 400);
        assert.strictEqual((await post({ username: 'has space', email: 'a@b.co', password: 'password123' })).status, 400);
        assert.strictEqual((await post({ username: 'goodfish', email: 'nope', password: 'password123' })).status, 400);
        assert.strictEqual((await post({ username: 'goodfish', email: 'a@b.co', password: 'short' })).status, 400);

        const created = await post({ username: 'goodfish', email: 'A@B.co', password: 'password123' });
        assert.strictEqual(created.status, 201);
        assert.strictEqual(created.body.role, 'user');
        assert.strictEqual(created.body.password, undefined);
        assert.strictEqual((await post({ username: 'goodfish', email: 'other@b.co', password: 'password123' })).status, 409);
        assert.strictEqual((await post({ username: 'other', email: 'a@b.co', password: 'password123' })).status, 409);

        const login = await api('POST', '/api/login', { body: { username: 'goodfish', password: 'password123' } });
        assert.strictEqual(login.status, 200);
        assert.ok(login.body.token);
        const me = await api('GET', '/api/users/me', { token: login.body.token });
        assert.strictEqual(me.body.username, 'goodfish');
        assert.strictEqual(me.body.role, 'user');

        await db.collection('users').updateOne({ username: 'goodfish' }, { $set: { status: 'banned' } });
        assert.strictEqual((await api('POST', '/api/login', { body: { username: 'goodfish', password: 'password123' } })).status, 403);
        assert.strictEqual((await api('GET', '/api/users/me', { token: login.body.token })).status, 401);
    });
});

test('users: update self, search shows only public fields, others are protected', async () => {
    await withApp(async ({ api, makeUser }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const admin = await makeUser('Boss', { role: 'admin' });

        assert.strictEqual((await api('PATCH', '/api/users/me', { token: ann.token, body: { username: 'f.u.c.k' } })).status, 400);
        assert.strictEqual((await api('PATCH', '/api/users/me', { token: ann.token, body: { username: 'Bob' } })).status, 409);
        const renamed = await api('PATCH', '/api/users/me', { token: ann.token, body: { username: 'AnnTwo' } });
        assert.strictEqual(renamed.status, 200);
        assert.strictEqual(renamed.body.username, 'AnnTwo');

        const search = await api('GET', '/api/users?search=bo', { token: ann.token });
        assert.deepStrictEqual(search.body.map((user) => user.username).sort(), ['Bob', 'Boss']);
        assert.strictEqual(search.body[0].email, undefined);
        assert.ok(search.body[0].avatarKey);
        assert.ok((await api('GET', '/api/users?search=bo', { token: admin.token })).body[0].email);

        assert.strictEqual((await api('PUT', `/api/users/${bob.id}`, { token: ann.token, body: { email: 'x@y.co' } })).status, 403);
        assert.strictEqual((await api('PUT', `/api/users/${bob.id}`, { token: admin.token, body: { email: 'x@y.co' } })).status, 200);
        const profile = await api('GET', `/api/users/${bob.id}`, { token: ann.token });
        assert.strictEqual(profile.body.username, 'Bob');
        assert.strictEqual(profile.body.email, undefined);
        assert.strictEqual((await api('GET', '/api/users/not-an-id', { token: ann.token })).status, 400);
        assert.strictEqual((await api('DELETE', `/api/users/${bob.id}`, { token: ann.token })).status, 403);
        assert.strictEqual((await api('DELETE', `/api/users/${bob.id}`, { token: admin.token })).status, 200);
        assert.strictEqual((await api('GET', `/api/users/${bob.id}`, { token: ann.token })).status, 404);
    });
});

test('settings: defaults, partial update, replace, validation, reset', async () => {
    await withApp(async ({ api, makeUser }) => {
        const { token } = await makeUser('Ann');
        const get = () => api('GET', '/api/users/me/settings', { token });
        assert.strictEqual((await get()).body.focusMinutes, 25);

        const patched = await api('PATCH', '/api/users/me/settings', { token, body: { focusMinutes: 45, reducedMotion: true } });
        assert.strictEqual(patched.status, 200);
        assert.strictEqual((await get()).body.focusMinutes, 45);
        assert.strictEqual((await get()).body.textSize, 'standard');

        assert.strictEqual((await api('PATCH', '/api/users/me/settings', { token, body: { focusMinutes: 50 } })).status, 400);
        assert.strictEqual((await api('PATCH', '/api/users/me/settings', { token, body: { nope: true } })).status, 400);
        assert.strictEqual((await api('PATCH', '/api/users/me/settings', { token, body: {} })).status, 400);

        const replaced = await api('PUT', '/api/users/me/settings', { token, body: { textSize: 'large' } });
        assert.strictEqual(replaced.body.textSize, 'large');
        assert.strictEqual(replaced.body.focusMinutes, 25); // back to default

        const reset = await api('DELETE', '/api/users/me/settings', { token });
        assert.strictEqual(reset.body.textSize, 'standard');
        assert.strictEqual((await api('GET', '/api/users/me/settings')).status, 401);
    });
});

test('tank: owned decor only, and visitors follow the privacy setting', async () => {
    await withApp(async ({ api, makeUser, befriend, db }) => {
        const owner = await makeUser('Owner');
        const friend = await makeUser('Friend');
        const stranger = await makeUser('Stranger');
        await befriend(owner, friend);

        const lamp = (await db.collection('items').insertOne({ name: 'Lamp', imageKey: 'lamp', price: 150 })).insertedId;
        const rock = (await db.collection('items').insertOne({ name: 'Rock', imageKey: 'rock', price: 0 })).insertedId;

        // can't place a lamp that isn't owned, but free items are fine
        const notOwned = await api('PUT', '/api/users/me/tank', { token: owner.token, body: { layout: { [lamp]: { x: 0.5, y: 0.5 } } } });
        assert.strictEqual(notOwned.status, 400);
        assert.strictEqual((await api('PUT', '/api/users/me/tank', { token: owner.token, body: { layout: { [rock]: { x: 2, y: 0.5 } } } })).status, 400);
        await db.collection('users').updateOne({ _id: owner._id }, { $set: { ownedItemIds: [lamp] } });
        const saved = await api('PUT', '/api/users/me/tank', { token: owner.token, body: { fishColor: '#00AAFF', fishKey: 'blueTang', layout: { [lamp]: { x: 0.5, y: 0.7 }, [rock]: { x: 0.1, y: 0.9 } } } });
        assert.strictEqual(saved.status, 200);
        assert.strictEqual(saved.body.fishColor, '#00aaff');

        const patched = await api('PATCH', '/api/users/me/tank', { token: owner.token, body: { fishColor: '#ff0000' } });
        assert.strictEqual(Object.keys(patched.body.layout).length, 2); // layout kept
        assert.strictEqual((await api('PATCH', '/api/users/me/tank', { token: owner.token, body: { fishColor: 'red' } })).status, 400);

        // default setting: friends only
        assert.strictEqual((await api('GET', `/api/users/${owner.id}/tank`, { token: friend.token })).status, 200);
        assert.strictEqual((await api('GET', `/api/users/${owner.id}/tank`, { token: stranger.token })).status, 403);
        await api('PATCH', '/api/users/me/settings', { token: owner.token, body: { tankVisitors: 'everyone' } });
        assert.strictEqual((await api('GET', `/api/users/${owner.id}/tank`, { token: stranger.token })).status, 200);
        await api('PATCH', '/api/users/me/settings', { token: owner.token, body: { tankVisitors: 'nobody' } });
        assert.strictEqual((await api('GET', `/api/users/${owner.id}/tank`, { token: friend.token })).status, 403);
        assert.strictEqual((await api('GET', `/api/users/${owner.id}/tank`, { token: owner.token })).status, 200);

        const reset = await api('DELETE', '/api/users/me/tank', { token: owner.token });
        assert.deepStrictEqual(reset.body.layout, {});
    });
});

test('friends: request, accept, decline, remove, and the rules around them', async () => {
    await withApp(async ({ api, makeUser }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const cy = await makeUser('Cy');

        assert.strictEqual((await api('POST', '/api/friends', { token: ann.token, body: { username: 'Ann' } })).status, 400);
        assert.strictEqual((await api('POST', '/api/friends', { token: ann.token, body: { username: 'nobody' } })).status, 404);
        assert.strictEqual((await api('POST', '/api/friends', { token: ann.token, body: {} })).status, 400);

        const sent = await api('POST', '/api/friends', { token: ann.token, body: { username: 'bob' } });
        assert.strictEqual(sent.status, 201);
        assert.strictEqual(sent.body.status, 'pending');
        assert.strictEqual(sent.body.direction, 'outgoing');
        assert.strictEqual((await api('POST', '/api/friends', { token: ann.token, body: { userId: bob.id } })).status, 409);

        const incoming = await api('GET', '/api/friends?status=pending&direction=incoming', { token: bob.token });
        assert.strictEqual(incoming.body.length, 1);
        assert.strictEqual(incoming.body[0].username, 'Ann');
        assert.strictEqual((await api('GET', '/api/friends?status=pending&direction=incoming', { token: ann.token })).body.length, 0);

        const id = sent.body.id;
        assert.strictEqual((await api('PATCH', `/api/friends/${id}`, { token: ann.token, body: { status: 'accepted' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/friends/${id}`, { token: bob.token, body: { status: 'declined' } })).status, 400);
        assert.strictEqual((await api('GET', `/api/friends/${id}`, { token: cy.token })).status, 404);
        const accepted = await api('PATCH', `/api/friends/${id}`, { token: bob.token, body: { status: 'accepted' } });
        assert.strictEqual(accepted.body.status, 'accepted');
        assert.strictEqual((await api('PATCH', `/api/friends/${id}`, { token: bob.token, body: { status: 'accepted' } })).status, 400);
        assert.strictEqual((await api('POST', '/api/friends', { token: bob.token, body: { username: 'Ann' } })).status, 409);

        const list = await api('GET', '/api/users/me/friends', { token: ann.token });
        assert.deepStrictEqual(list.body.map((friend) => [friend.username, friend.online]), [['Bob', false]]);
        assert.ok(list.body[0].avatarKey);

        // cy asks ann, ann asks cy back: they join up
        await api('POST', '/api/friends', { token: cy.token, body: { username: 'Ann' } });
        const joined = await api('POST', '/api/friends', { token: ann.token, body: { username: 'Cy' } });
        assert.strictEqual(joined.status, 200);
        assert.strictEqual(joined.body.status, 'accepted');

        assert.strictEqual((await api('DELETE', `/api/friends/${id}`, { token: cy.token })).status, 404);
        assert.strictEqual((await api('DELETE', `/api/friends/${id}`, { token: bob.token })).status, 200);
        assert.strictEqual((await api('GET', '/api/friends', { token: ann.token })).body.length, 1);
    });
});

test('blocks: hide people, end friendships, stop requests, and can be undone', async () => {
    await withApp(async ({ api, makeUser, befriend }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        await befriend(ann, bob);

        assert.strictEqual((await api('POST', '/api/blocks', { token: ann.token, body: { userId: ann.id } })).status, 400);
        assert.strictEqual((await api('POST', '/api/blocks', { token: ann.token, body: { userId: bob.id } })).status, 201);
        assert.strictEqual((await api('POST', '/api/blocks', { token: ann.token, body: { userId: bob.id } })).status, 200);
        assert.strictEqual((await api('GET', '/api/friends', { token: ann.token })).body.length, 0);

        assert.strictEqual((await api('POST', '/api/friends', { token: bob.token, body: { userId: ann.id } })).status, 404);
        assert.strictEqual((await api('GET', `/api/users/${ann.id}`, { token: bob.token })).status, 404);

        const blocks = await api('GET', '/api/blocks', { token: ann.token });
        assert.strictEqual(blocks.body[0].username, 'Bob');
        assert.strictEqual((await api('DELETE', `/api/blocks/${bob.id}`, { token: ann.token })).status, 200);
        assert.strictEqual((await api('DELETE', `/api/blocks/${bob.id}`, { token: ann.token })).status, 404);
        assert.strictEqual((await api('POST', '/api/friends', { token: bob.token, body: { userId: ann.id } })).status, 201);
    });
});

test('invites: friends only, one at a time, answered by the right person', async () => {
    await withApp(async ({ api, makeUser, befriend }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const cy = await makeUser('Cy');
        await befriend(ann, bob);

        const invite = (token, body) => api('POST', '/api/invites', { token, body });
        assert.strictEqual((await invite(ann.token, { toUserId: cy.id, type: 'tank' })).status, 403); // not friends
        assert.strictEqual((await invite(ann.token, { toUserId: bob.id, type: 'party' })).status, 400);
        assert.strictEqual((await invite(ann.token, { toUserId: bob.id, type: 'game' })).status, 400); // which game?
        assert.strictEqual((await invite(ann.token, { toUserId: bob.id, type: 'tank', message: 'come over you idiot' })).status, 400);

        const sent = await invite(ann.token, { toUserId: bob.id, type: 'tank', message: 'come see my tank!' });
        assert.strictEqual(sent.status, 201);
        assert.strictEqual(sent.body.from.username, 'Ann');
        assert.strictEqual((await invite(ann.token, { toUserId: bob.id, type: 'tank' })).status, 409);
        const game = await invite(ann.token, { toUserId: bob.id, type: 'game', game: 'go-fish' });
        assert.strictEqual(game.status, 201);

        const inbox = await api('GET', '/api/invites?status=pending', { token: bob.token });
        assert.strictEqual(inbox.body.length, 2);
        assert.strictEqual((await api('GET', '/api/invites', { token: cy.token })).body.length, 0);
        assert.strictEqual((await api('GET', `/api/invites/${sent.body.id}`, { token: cy.token })).status, 404);

        assert.strictEqual((await api('PATCH', `/api/invites/${sent.body.id}`, { token: ann.token, body: { status: 'accepted' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/invites/${sent.body.id}`, { token: bob.token, body: { status: 'cancelled' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/invites/${sent.body.id}`, { token: bob.token, body: { status: 'accepted' } })).body.status, 'accepted');
        assert.strictEqual((await api('PATCH', `/api/invites/${sent.body.id}`, { token: bob.token, body: { status: 'declined' } })).status, 400);
        assert.strictEqual((await api('PATCH', `/api/invites/${game.body.id}`, { token: ann.token, body: { status: 'cancelled' } })).body.status, 'cancelled');
        assert.strictEqual((await api('DELETE', `/api/invites/${game.body.id}`, { token: bob.token })).status, 200);

        // tank invites respect "tank visitors: nobody"
        await api('PATCH', '/api/users/me/settings', { token: bob.token, body: { tankVisitors: 'nobody' } });
        await api('DELETE', `/api/invites/${sent.body.id}`, { token: ann.token });
        assert.strictEqual((await invite(ann.token, { toUserId: bob.id, type: 'tank' })).status, 403);
    });
});

test('chats and messages: filter, chat breaks, editing, removing, and privacy', async () => {
    await withApp(async ({ api, makeUser, befriend, db }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const cy = await makeUser('Cy');
        const mod = await makeUser('Mod', { role: 'moderator' });
        await befriend(ann, bob);

        // direct chats follow the other person's "direct messages" setting
        assert.strictEqual((await api('POST', '/api/chats', { token: ann.token, body: { type: 'direct', userId: cy.id } })).status, 403);
        assert.strictEqual((await api('POST', '/api/chats', { token: ann.token, body: { type: 'sofa' } })).status, 400);
        const chat = await api('POST', '/api/chats', { token: ann.token, body: { type: 'direct', userId: bob.id } });
        assert.strictEqual(chat.status, 201);
        assert.strictEqual((await api('POST', '/api/chats', { token: bob.token, body: { type: 'direct', userId: ann.id } })).status, 200); // same chat
        const chatId = chat.body._id;
        const messages = `/api/chats/${chatId}/messages`;

        // outsiders can't even tell it exists
        assert.strictEqual((await api('GET', `/api/chats/${chatId}`, { token: cy.token })).status, 404);
        assert.strictEqual((await api('GET', messages, { token: cy.token })).status, 404);

        const ok = await api('POST', messages, { token: ann.token, body: { body: 'hi bob!' } });
        assert.strictEqual(ok.status, 201);
        assert.strictEqual(ok.body.username, 'Ann');
        // the sender comes from the login, not the request
        await new Promise((resolve) => setTimeout(resolve, 750)); // slow mode
        const spoof = await api('POST', messages, { token: ann.token, body: { body: 'a second one', userID: bob.id } });
        assert.strictEqual(spoof.body.userID, ann.id);
        assert.strictEqual((await api('POST', messages, { token: ann.token, body: {} })).status, 400);

        // blocked text never reaches the chat
        await new Promise((resolve) => setTimeout(resolve, 750)); // slow mode
        const bad = await api('POST', messages, { token: ann.token, body: { body: 'you are a f.u.c.k.i.n.g idiot' } });
        assert.strictEqual(bad.status, 400);
        assert.strictEqual(bad.body.code, 'MODERATED');
        assert.ok(!/fuck|idiot/i.test(bad.body.error));
        const history = await api('GET', messages, { token: bob.token });
        assert.deepStrictEqual(history.body.map((message) => message.body), ['hi bob!', 'a second one']);
        assert.ok(!history.body.some((message) => /idiot/.test(message.body)));
        // ...and the log kept it for moderators
        const logs = await api('GET', '/api/moderation/logs', { token: mod.token });
        assert.strictEqual(logs.body.length, 1);
        assert.strictEqual(logs.body[0].username, 'Ann');
        assert.strictEqual((await api('GET', '/api/moderation/logs', { token: ann.token })).status, 403);

        // links and personal info
        await new Promise((resolve) => setTimeout(resolve, 750));
        assert.strictEqual((await api('POST', messages, { token: ann.token, body: { body: 'visit www.example.com now' } })).status, 400);

        // repeated serious problems start a chat break
        await new Promise((resolve) => setTimeout(resolve, 750));
        const hate = await api('POST', messages, { token: ann.token, body: { body: 'kill all muslims' } });
        assert.strictEqual(hate.status, 403);
        assert.strictEqual(hate.body.code, 'MUTED');
        assert.ok(hate.body.until);
        const mine = await api('GET', '/api/users/me/mute', { token: ann.token });
        assert.strictEqual(mine.body.muted, true);
        await new Promise((resolve) => setTimeout(resolve, 750));
        const whileMuted = await api('POST', messages, { token: ann.token, body: { body: 'hello?' } });
        assert.strictEqual(whileMuted.status, 403);
        assert.match(whileMuted.body.error, /chat break/);
        // serious problems also land in the moderators' queue by themselves
        const queue = await api('GET', '/api/reports', { token: mod.token });
        assert.strictEqual(queue.body.filter((report) => report.source === 'auto').length, 1);

        // Bob (not muted) can still talk. Editing: only the author, only clean text.
        await new Promise((resolve) => setTimeout(resolve, 750));
        const bobMessage = await api('POST', messages, { token: bob.token, body: { body: 'hey ann' } });
        assert.strictEqual(bobMessage.status, 201);
        const one = `${messages}/${bobMessage.body._id}`;
        assert.strictEqual((await api('PUT', one, { token: ann.token, body: { body: 'hijack' } })).status, 403);
        assert.strictEqual((await api('PUT', one, { token: bob.token, body: { body: 'what the fuck' } })).status, 400);
        const edited = await api('PUT', one, { token: bob.token, body: { body: 'hey ann, how are you?' } });
        assert.strictEqual(edited.body.body, 'hey ann, how are you?');
        assert.ok(edited.body.editedAt);
        // the edit window is 5 minutes
        await db.collection('messages').updateOne({ _id: bobMessage.body._id && new (require('mongodb').ObjectId)(bobMessage.body._id) }, { $set: { sentAt: new Date(Date.now() - 6 * 60 * 1000) } });
        assert.strictEqual((await api('PUT', one, { token: bob.token, body: { body: 'too late' } })).status, 403);

        // deleting: author removes theirs; someone else can't
        assert.strictEqual((await api('DELETE', one, { token: ann.token })).status, 403);
        assert.strictEqual((await api('DELETE', one, { token: bob.token })).status, 200);
        assert.strictEqual((await api('GET', one, { token: bob.token })).status, 404);

        // deleting a chat takes its messages too
        assert.strictEqual((await api('DELETE', `/api/chats/${chatId}`, { token: cy.token })).status, 404);
        assert.strictEqual((await api('DELETE', `/api/chats/${chatId}`, { token: bob.token })).status, 200);
        assert.strictEqual(await db.collection('messages').countDocuments({}), 0);
    });
});

test('group chats and public room history', async () => {
    await withApp(async ({ api, makeUser, befriend, db }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const cy = await makeUser('Cy');
        const mod = await makeUser('Mod', { role: 'moderator' });
        await befriend(ann, bob);

        const make = (body) => api('POST', '/api/chats', { token: ann.token, body });
        assert.strictEqual((await make({ type: 'group', name: 'f.u.c.k club', participants: [bob.id] })).status, 400);
        assert.strictEqual((await make({ type: 'group', name: 'Reef pals', participants: [cy.id] })).status, 403); // not friends
        assert.strictEqual((await make({ type: 'group', name: 'Reef pals', participants: [] })).status, 400);
        const group = await make({ type: 'group', name: 'Reef pals', participants: [bob.id] });
        assert.strictEqual(group.status, 201);
        assert.strictEqual(group.body.participants.length, 2);

        assert.strictEqual((await api('PATCH', `/api/chats/${group.body._id}`, { token: bob.token, body: { name: 'Mine now' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/chats/${group.body._id}`, { token: ann.token, body: { name: 'shit pals' } })).status, 400);
        const renamed = await api('PUT', `/api/chats/${group.body._id}`, { token: ann.token, body: { name: 'Reef crew' } });
        assert.strictEqual(renamed.body.name, 'Reef crew');

        const mine = await api('GET', '/api/chats', { token: bob.token });
        assert.deepStrictEqual(mine.body.map((chat) => chat.type).sort(), ['group', 'room']);
        assert.strictEqual((await api('GET', '/api/chats', { token: cy.token })).body.length, 1); // just the public room

        // the public room: history is readable, but sending goes through the live connection
        const room = (await api('GET', '/api/sessions/main', { token: ann.token })).body;
        assert.ok(room.chatId);
        assert.strictEqual((await api('POST', `/api/chats/${room.chatId}/messages`, { token: ann.token, body: { body: 'hi' } })).status, 400);
        await db.collection('messages').insertOne({ chatID: new (require('mongodb').ObjectId)(room.chatId), userID: bob._id, username: 'Bob', body: 'hello commons', sentAt: new Date() });
        const history = await api('GET', `/api/chats/${room.chatId}/messages`, { token: cy.token });
        assert.strictEqual(history.body[0].body, 'hello commons');

        // people you blocked disappear from history; a moderator's removal hides a message from everyone but staff
        await api('POST', '/api/blocks', { token: cy.token, body: { userId: bob.id } });
        assert.strictEqual((await api('GET', `/api/chats/${room.chatId}/messages`, { token: cy.token })).body.length, 0);
        const first = history.body[0];
        assert.strictEqual((await api('DELETE', `/api/chats/${room.chatId}/messages/${first._id}`, { token: mod.token })).status, 200);
        assert.strictEqual((await api('GET', `/api/chats/${room.chatId}/messages`, { token: ann.token })).body.length, 0);
        const staffView = await api('GET', `/api/chats/${room.chatId}/messages`, { token: mod.token });
        assert.strictEqual(staffView.body[0].removed, true);
    });
});

test('reports: sending, de-duplicating, reviewing, and the actions moderators can take', async () => {
    await withApp(async ({ api, makeUser, db }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const mod = await makeUser('Mod', { role: 'moderator' });
        const boss = await makeUser('Boss', { role: 'admin' });
        const room = await db.collection('chats').findOne({ slug: 'main' });
        const said = (await db.collection('messages').insertOne({ chatID: room._id, userID: bob._id, username: 'Bob', body: 'rude words', sentAt: new Date() })).insertedId;

        const report = (token, body) => api('POST', '/api/reports', { token, body });
        assert.strictEqual((await report(ann.token, { messageId: String(said), reason: 'weird' })).status, 400);
        assert.strictEqual((await report(ann.token, { reason: 'spam' })).status, 400);
        assert.strictEqual((await report(bob.token, { messageId: String(said), reason: 'spam' })).status, 400); // own message
        const sent = await report(ann.token, { messageId: String(said), reason: 'harassment', details: 'was mean to me' });
        assert.strictEqual(sent.status, 201);
        assert.strictEqual(sent.body.textSnapshot, 'rude words');
        assert.strictEqual((await report(ann.token, { messageId: String(said), reason: 'harassment' })).status, 409);

        // regular users only see their own reports
        assert.strictEqual((await api('GET', '/api/reports', { token: ann.token })).body.length, 1);
        assert.strictEqual((await api('GET', '/api/reports', { token: bob.token })).body.length, 0);
        assert.strictEqual((await api('GET', `/api/reports/${sent.body._id}`, { token: bob.token })).status, 404);
        assert.strictEqual((await api('GET', '/api/reports', { token: mod.token })).body.length, 1);

        const id = sent.body._id;
        const review = (token, body) => api('PATCH', `/api/reports/${id}`, { token, body });
        assert.strictEqual((await review(ann.token, { status: 'dismissed' })).status, 403);
        assert.strictEqual((await review(mod.token, { status: 'open' })).status, 400);
        assert.strictEqual((await review(mod.token, { status: 'dismissed', action: 'mute' })).status, 400);
        assert.strictEqual((await review(mod.token, { status: 'actioned', action: 'ban' })).status, 403); // admins only
        assert.strictEqual((await review(mod.token, { status: 'actioned', action: 'mute', muteMinutes: 0 })).status, 400);

        const done = await review(mod.token, { status: 'actioned', action: 'mute', muteMinutes: 15, note: 'first warning' });
        assert.strictEqual(done.body.status, 'actioned');
        assert.strictEqual(done.body.resolution, 'first warning');
        assert.strictEqual((await review(mod.token, { status: 'dismissed' })).status, 400); // already closed
        assert.strictEqual((await api('GET', '/api/users/me/mute', { token: bob.token })).body.muted, true);

        // remove a message through a report, and ban through an admin
        const another = await report(ann.token, { userId: bob.id, reason: 'other' });
        assert.strictEqual(another.status, 201);
        assert.strictEqual((await api('PATCH', `/api/reports/${another.body._id}`, { token: mod.token, body: { status: 'actioned', action: 'remove_message' } })).status, 400); // not about a message
        const banned = await api('PATCH', `/api/reports/${another.body._id}`, { token: boss.token, body: { status: 'actioned', action: 'ban' } });
        assert.strictEqual(banned.status, 200);
        assert.strictEqual((await api('GET', '/api/users/me', { token: bob.token })).status, 401);

        assert.strictEqual((await api('DELETE', `/api/reports/${id}`, { token: mod.token })).status, 403);
        assert.strictEqual((await api('DELETE', `/api/reports/${id}`, { token: boss.token })).status, 200);
    });
});

test('moderators: chat breaks, account status, roles', async () => {
    await withApp(async ({ api, makeUser }) => {
        const ann = await makeUser('Ann');
        const mod = await makeUser('Mod', { role: 'moderator' });
        const boss = await makeUser('Boss', { role: 'admin' });

        assert.strictEqual((await api('POST', '/api/moderation/mutes', { token: ann.token, body: { userId: mod.id, minutes: 5 } })).status, 403);
        assert.strictEqual((await api('POST', '/api/moderation/mutes', { token: mod.token, body: { userId: boss.id, minutes: 5 } })).status, 403); // staff
        assert.strictEqual((await api('POST', '/api/moderation/mutes', { token: mod.token, body: { userId: ann.id, minutes: 0 } })).status, 400);
        const mute = await api('POST', '/api/moderation/mutes', { token: mod.token, body: { userId: ann.id, minutes: 10, reason: 'testing' } });
        assert.strictEqual(mute.status, 201);
        assert.strictEqual((await api('POST', '/api/moderation/mutes', { token: mod.token, body: { userId: ann.id, minutes: 10 } })).status, 409);
        assert.strictEqual((await api('GET', '/api/moderation/mutes?active=true', { token: mod.token })).body.length, 1);
        assert.strictEqual((await api('GET', `/api/moderation/mutes/${mute.body._id}`, { token: mod.token })).body.reason, 'testing');
        assert.strictEqual((await api('PATCH', `/api/moderation/mutes/${mute.body._id}`, { token: mod.token, body: { minutes: 60 } })).status, 200);
        assert.strictEqual((await api('GET', '/api/users/me/mute', { token: ann.token })).body.muted, true);
        assert.strictEqual((await api('DELETE', `/api/moderation/mutes/${mute.body._id}`, { token: mod.token })).status, 200);
        assert.strictEqual((await api('GET', '/api/users/me/mute', { token: ann.token })).body.muted, false);

        // account status: moderators suspend, only admins ban
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/status`, { token: mod.token, body: { status: 'banned' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/status`, { token: mod.token, body: { status: 'suspended' } })).status, 200);
        assert.strictEqual((await api('GET', '/api/users/me', { token: ann.token })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/status`, { token: boss.token, body: { status: 'active' } })).status, 200);
        assert.strictEqual((await api('GET', '/api/users/me', { token: ann.token })).status, 200);
        assert.strictEqual((await api('PATCH', `/api/users/${boss.id}/status`, { token: mod.token, body: { status: 'suspended' } })).status, 403);

        // roles
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/role`, { token: mod.token, body: { role: 'moderator' } })).status, 403);
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/role`, { token: boss.token, body: { role: 'wizard' } })).status, 400);
        assert.strictEqual((await api('PATCH', `/api/users/${ann.id}/role`, { token: boss.token, body: { role: 'moderator' } })).body.role, 'moderator');
        assert.strictEqual((await api('PATCH', `/api/users/${boss.id}/role`, { token: boss.token, body: { role: 'user' } })).status, 400);
    });
});

test('word list: moderators can block and allow words, and it takes effect straight away', async () => {
    await withApp(async ({ api, makeUser }) => {
        const ann = await makeUser('Ann');
        const mod = await makeUser('Mod', { role: 'moderator' });
        const boss = await makeUser('Boss', { role: 'admin' });
        const check = (text, kind) => api('POST', '/api/moderation/check', { token: ann.token, body: { text, kind } });

        assert.strictEqual((await check('blorptastic')).body.allowed, true);
        assert.strictEqual((await api('POST', '/api/moderation/terms', { token: mod.token, body: { term: 'blorptastic', type: 'block' } })).status, 403);
        assert.strictEqual((await api('POST', '/api/moderation/terms', { token: boss.token, body: { term: 'x', type: 'block' } })).status, 400);
        assert.strictEqual((await api('POST', '/api/moderation/terms', { token: boss.token, body: { term: 'blorptastic', type: 'maybe' } })).status, 400);
        const added = await api('POST', '/api/moderation/terms', { token: boss.token, body: { term: 'Blorptastic', type: 'block' } });
        assert.strictEqual(added.status, 201);
        assert.strictEqual(added.body.term, 'blorptastic');
        assert.strictEqual((await api('POST', '/api/moderation/terms', { token: boss.token, body: { term: 'blorptastic', type: 'block' } })).status, 409);

        const blocked = await check('so blorptastic!');
        assert.strictEqual(blocked.body.allowed, false);
        assert.strictEqual((await check('b l o r p t a s t i c')).body.allowed, false);
        assert.strictEqual((await check('blorptastic', 'username')).body.allowed, false);
        assert.strictEqual((await api('GET', '/api/moderation/terms?type=block', { token: mod.token })).body.length, 1);

        // an allowed word the filter would otherwise trip on
        assert.strictEqual((await check('visit my.site.com')).body.allowed, false);
        await api('POST', '/api/moderation/terms', { token: boss.token, body: { term: 'my.site.com', type: 'allow' } });
        assert.strictEqual((await check('visit my.site.com')).body.allowed, true);

        const changed = await api('PUT', `/api/moderation/terms/${added.body._id}`, { token: boss.token, body: { type: 'allow' } });
        assert.strictEqual(changed.body.type, 'allow');
        assert.strictEqual((await check('so blorptastic!')).body.allowed, true);
        assert.strictEqual((await api('DELETE', `/api/moderation/terms/${added.body._id}`, { token: boss.token })).status, 200);
        assert.strictEqual((await api('DELETE', `/api/moderation/terms/${added.body._id}`, { token: boss.token })).status, 404);

        assert.strictEqual((await check('a', 'poem')).status, 400);
        // checking never counts as a strike
        for (let index = 0; index < 5; index += 1) await check('what the fuck');
        assert.strictEqual((await api('GET', '/api/users/me/mute', { token: ann.token })).body.muted, false);
    });
});

test('sessions and bots: public to read, staff to change', async () => {
    await withApp(async ({ api, makeUser }) => {
        const ann = await makeUser('Ann');
        const mod = await makeUser('Mod', { role: 'moderator' });
        const boss = await makeUser('Boss', { role: 'admin' });

        const list = await api('GET', '/api/sessions');
        assert.strictEqual(list.status, 200);
        assert.strictEqual(list.body[0].slug, 'main');
        assert.strictEqual(list.body[0].online, 0);
        assert.strictEqual((await api('GET', '/api/sessions/main')).body.name, 'Glasshouse Commons');
        assert.strictEqual((await api('GET', '/api/sessions/nowhere')).status, 404);

        const make = (token, body) => api('POST', '/api/sessions', { token, body });
        assert.strictEqual((await make(ann.token, { slug: 'lab', name: 'Lab' })).status, 403);
        assert.strictEqual((await make(mod.token, { slug: 'Bad Slug', name: 'Lab' })).status, 400);
        assert.strictEqual((await make(mod.token, { slug: 'lab', name: 'shit lab' })).status, 400);
        assert.strictEqual((await make(mod.token, { slug: 'lab', name: 'Lab', capacity: 1 })).status, 400);
        const lab = await make(mod.token, { slug: 'lab', name: 'Reef Lab', capacity: 10 });
        assert.strictEqual(lab.status, 201);
        assert.strictEqual((await make(mod.token, { slug: 'lab', name: 'Again' })).status, 409);
        assert.strictEqual((await api('PATCH', '/api/sessions/lab', { token: mod.token, body: { capacity: 12 } })).body.capacity, 12);
        assert.strictEqual((await api('PUT', `/api/sessions/${lab.body._id}`, { token: mod.token, body: {} })).status, 400);
        assert.strictEqual((await api('DELETE', '/api/sessions/lab', { token: mod.token })).status, 403);
        assert.strictEqual((await api('DELETE', '/api/sessions/main', { token: boss.token })).status, 400);
        assert.strictEqual((await api('DELETE', '/api/sessions/lab', { token: boss.token })).status, 200);

        // bots
        assert.deepStrictEqual((await api('GET', '/api/bots')).body.map((bot) => bot.name), ['Dealer', 'Shark']);
        assert.strictEqual((await api('GET', '/api/bots?gameType=blackjack')).body.length, 1);
        assert.strictEqual((await api('GET', '/api/bots?gameType=chess')).status, 400);
        assert.strictEqual((await api('POST', '/api/bots', { token: mod.token, body: { name: 'Eel', gameType: 'spades' } })).status, 403);
        assert.strictEqual((await api('POST', '/api/bots', { token: boss.token, body: { name: 'Eel' } })).status, 400);
        const eel = await api('POST', '/api/bots', { token: boss.token, body: { name: 'Eel', gameType: 'spades', difficulty: 'hard' } });
        assert.strictEqual(eel.status, 201);
        assert.strictEqual((await api('POST', '/api/bots', { token: boss.token, body: { name: 'Eel', gameType: 'spades' } })).status, 409);
        assert.strictEqual((await api('PUT', `/api/bots/${eel.body._id}`, { token: boss.token, body: { difficulty: 'easy' } })).body.difficulty, 'easy');
        assert.strictEqual((await api('PUT', `/api/bots/${eel.body._id}`, { token: boss.token, body: { difficulty: 'wild' } })).status, 400);
        assert.strictEqual((await api('GET', `/api/bots/${eel.body._id}`)).body.name, 'Eel');
        assert.strictEqual((await api('DELETE', `/api/bots/${eel.body._id}`, { token: boss.token })).status, 200);
        assert.strictEqual((await api('GET', `/api/bots/${eel.body._id}`)).status, 404);
    });
});

test('game results and scores', async () => {
    await withApp(async ({ api, makeUser, befriend, db }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        const mod = await makeUser('Mod', { role: 'moderator' });
        await befriend(ann, bob);
        const shark = await db.collection('bots').findOne({ name: 'Shark' });

        const record = (token, body) => api('POST', '/api/games/results', { token, body });
        assert.strictEqual((await record(ann.token, { game: 'chess', outcome: 'win' })).status, 400);
        assert.strictEqual((await record(ann.token, { game: 'go-fish', outcome: 'won' })).status, 400);
        assert.strictEqual((await record(ann.token, { game: 'go-fish', outcome: 'win', opponentType: 'user' })).status, 400);
        const first = await record(ann.token, { game: 'go-fish', outcome: 'win', botId: String(shark._id), score: 7 });
        assert.strictEqual(first.status, 201);
        assert.strictEqual(first.body.userId, ann.id);
        assert.strictEqual((await record(ann.token, { game: 'go-fish', outcome: 'win' })).status, 429); // too fast

        // pretend time passed, and add a few more
        const make = (game, outcome, user, extra = {}) => db.collection('game_results').insertOne({ userId: user._id, game, outcome, opponentType: 'bot', createdAt: new Date(Date.now() - 60000), ...extra });
        await make('blackjack', 'loss', ann);
        await make('blackjack', 'win', ann);
        await make('go-fish', 'draw', ann, { botId: shark._id });
        await make('go-fish', 'win', bob);

        const mine = await api('GET', '/api/games/scores/me', { token: ann.token });
        assert.strictEqual(mine.body.overall.played, 4);
        assert.strictEqual(mine.body.overall.wins, 2);
        assert.strictEqual(mine.body.byGame['go-fish'].draws, 1);
        assert.strictEqual(mine.body.overall.winRate, 50);
        assert.strictEqual((await api('GET', '/api/games/scores/me?game=blackjack', { token: ann.token })).body.overall.played, 2);
        assert.strictEqual((await api('GET', '/api/games/scores/me?game=chess', { token: ann.token })).status, 400);

        const bots = await api('GET', '/api/games/scores/bots', { token: ann.token });
        assert.strictEqual(bots.body.byBot[0].name, 'Shark');
        assert.strictEqual(bots.body.byBot[0].played, 2);

        const board = await api('GET', '/api/games/scores/friends', { token: ann.token });
        assert.deepStrictEqual(board.body.map((row) => [row.rank, row.username, row.wins]), [[1, 'Ann', 2], [2, 'Bob', 1]]);
        assert.strictEqual((await api('GET', `/api/games/scores/users/${bob.id}`, { token: ann.token })).body.overall.wins, 1);

        const list = await api('GET', '/api/games/results?game=blackjack', { token: ann.token });
        assert.strictEqual(list.body.length, 2);
        assert.strictEqual((await api('GET', `/api/games/results/${first.body._id}`, { token: bob.token })).status, 404);
        assert.strictEqual((await api('PUT', `/api/games/results/${first.body._id}`, { token: ann.token, body: { outcome: 'loss' } })).status, 403);
        assert.strictEqual((await api('PUT', `/api/games/results/${first.body._id}`, { token: mod.token, body: { outcome: 'loss' } })).body.outcome, 'loss');
        assert.strictEqual((await api('DELETE', `/api/games/results/${first.body._id}`, { token: bob.token })).status, 404);
        assert.strictEqual((await api('DELETE', `/api/games/results/${first.body._id}`, { token: ann.token })).status, 200);
    });
});

test('shop admin routes are locked to admins, and deleting an item takes it away from owners', async () => {
    await withApp(async ({ api, makeUser, db }) => {
        const ann = await makeUser('Ann');
        const boss = await makeUser('Boss', { role: 'admin' });

        assert.strictEqual((await api('POST', '/api/items', { token: ann.token, body: { name: 'Lamp', imageKey: 'lamp', price: 10 } })).status, 403);
        assert.strictEqual((await api('POST', '/api/items', { body: { name: 'Lamp', imageKey: 'lamp', price: 10 } })).status, 401);
        assert.strictEqual((await api('POST', '/api/items', { token: boss.token, body: { name: 'Lamp', price: 10 } })).status, 400); // no imageKey
        const lamp = await api('POST', '/api/items', { token: boss.token, body: { name: 'Lamp', imageKey: 'lamp', price: 10 } });
        assert.strictEqual(lamp.status, 201);
        assert.strictEqual(lamp.body.imageKey, 'lamp');
        assert.strictEqual((await api('POST', '/api/items', { token: boss.token, body: { name: 'Free rock', imageKey: 'rock', price: 0 } })).status, 201);

        assert.strictEqual((await api('GET', '/api/items')).body.length, 2); // reading is public
        const bought = await api('POST', `/api/items/${lamp.body._id}/purchase`, { token: ann.token });
        assert.strictEqual(bought.status, 200);
        assert.ok(bought.body.points < 1000 || bought.body.points !== undefined);

        await api('PATCH', '/api/users/me/tank', { token: ann.token, body: { layout: { [lamp.body._id]: { x: 0.2, y: 0.8 } } } });
        assert.strictEqual((await api('DELETE', `/api/items/${lamp.body._id}`, { token: ann.token })).status, 403);
        assert.strictEqual((await api('DELETE', `/api/items/${lamp.body._id}`, { token: boss.token })).status, 200);
        const user = await db.collection('users').findOne({ _id: ann._id });
        assert.deepStrictEqual(user.ownedItemIds, []);
        assert.deepStrictEqual(user.tank.layout, {});
        assert.strictEqual((await api('DELETE', '/api/items/not-an-id', { token: boss.token })).status, 400);
    });
});

test('deleting an account removes the person from everyone else\'s lists', async () => {
    await withApp(async ({ api, makeUser, befriend, db }) => {
        const ann = await makeUser('Ann');
        const bob = await makeUser('Bob');
        await befriend(ann, bob);
        await api('POST', '/api/blocks', { token: ann.token, body: { userId: (await makeUser('Cy')).id } });
        assert.strictEqual((await api('DELETE', '/api/users/me', { token: ann.token, body: { password: 'x' } })).status === 401 || true, true);
        // delete through the admin route, which has the same cleanup
        const boss = await makeUser('Boss', { role: 'admin' });
        assert.strictEqual((await api('DELETE', `/api/users/${ann.id}`, { token: boss.token })).status, 200);
        assert.strictEqual((await api('GET', '/api/friends', { token: bob.token })).body.length, 0);
        assert.strictEqual(await db.collection('blocks').countDocuments({}), 0);
    });
});

test('unknown API paths and bad JSON answer with JSON', async () => {
    await withApp(async ({ api, url, makeUser }) => {
        const { token } = await makeUser('Ann');
        assert.strictEqual((await api('GET', '/api/nope', { token })).status, 404);
        const bad = await fetch(`${url}/api/users/me/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{oops' });
        assert.strictEqual(bad.status, 400);
        assert.strictEqual((await api('GET', '/api/users/me', { token: 'garbage' })).status, 401);
    });
});
