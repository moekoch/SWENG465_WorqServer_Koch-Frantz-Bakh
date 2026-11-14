const { Server } = require('socket.io');
const { getDB } = require('./database');
const { verifyToken } = require('./auth');
const {
    applyAsk,
    createMatch,
    getPlayerState,
} = require('./goFishGame');

// fish shown if user hasn't picked one
const DEFAULT_AVATAR_KEY = 'blueTang';

// ignore move events that arrive faster than this
const MIN_MOVE_INTERVAL_MS = 50;

// socket.io server created in initSocket
let io = null;

// room names for user and session
const userRoom = (userId) => `user:${userId}`;
const sessionRoom = (sessionId) => `session:${sessionId}`;
const goFishRoom = (matchId) => `gofish:${matchId}`;

const goFishQueue = new Map();
const goFishMatches = new Map();
const goFishMatchByPlayer = new Map();
const GO_FISH_RECONNECT_GRACE_MS = 60_000;

function emitGoFishState(match) {
    if (match.status === 'finished') clearGoFishTimer(match);

    for (const player of match.players) {
        const socketId = match.sockets.get(player.id);
        if (socketId) {
            io.to(socketId).emit('gofish:state', getPlayerState(match, player.id));
        }
    }
}

function clearGoFishTimer(match, userId) {
    if (userId) {
        const timer = match.disconnectTimers.get(userId);
        if (timer) clearTimeout(timer);
        match.disconnectTimers.delete(userId);
        return;
    }

    for (const timer of match.disconnectTimers.values()) clearTimeout(timer);
    match.disconnectTimers.clear();
}

function removeFromGoFishQueue(userId, socketId) {
    if (socketId && goFishQueue.get(userId) !== socketId) return;
    goFishQueue.delete(userId);
}

function attachToGoFishMatch(socket, match) {
    const userId = String(socket.data.user._id);
    const wasDisconnected = match.connectedUsers.get(userId) === false;

    clearGoFishTimer(match, userId);
    removeFromGoFishQueue(userId);
    match.connectedUsers.set(userId, true);
    match.sockets.set(userId, socket.id);
    goFishMatchByPlayer.set(userId, match.id);
    socket.data.goFishMatchId = match.id;
    socket.join(goFishRoom(match.id));

    if (wasDisconnected) {
        match.message = `${socket.data.user.username} reconnected.`;
    }
    emitGoFishState(match);
}

function joinGoFishQueue(socket) {
    const userId = String(socket.data.user._id);
    const activeMatchId = goFishMatchByPlayer.get(userId);
    const activeMatch = activeMatchId && goFishMatches.get(activeMatchId);

    if (activeMatch?.status === 'playing') {
        attachToGoFishMatch(socket, activeMatch);
        return;
    }

    if (activeMatch) {
        goFishMatchByPlayer.delete(userId);
        if (activeMatch.players.every((player) => !goFishMatchByPlayer.has(player.id))) {
            clearGoFishTimer(activeMatch);
            goFishMatches.delete(activeMatch.id);
        }
    }

    const existingQueueSocketId = goFishQueue.get(userId);
    if (existingQueueSocketId === socket.id) {
        socket.emit('gofish:waiting');
        return;
    }
    removeFromGoFishQueue(userId);

    let opponentSocket = null;
    let opponentId = null;
    for (const [queuedUserId, queuedSocketId] of goFishQueue) {
        if (queuedUserId === userId) continue;

        const candidate = io.sockets.sockets.get(queuedSocketId);
        if (!candidate?.connected) {
            removeFromGoFishQueue(queuedUserId, queuedSocketId);
            continue;
        }

        opponentId = queuedUserId;
        opponentSocket = candidate;
        break;
    }

    if (!opponentSocket) {
        goFishQueue.set(userId, socket.id);
        socket.emit('gofish:waiting');
        return;
    }

    removeFromGoFishQueue(opponentId, opponentSocket.id);
    const match = createMatch(
        { id: userId, username: socket.data.user.username },
        { id: opponentId, username: opponentSocket.data.user.username },
    );
    match.sockets = new Map();
    match.disconnectTimers = new Map();
    goFishMatches.set(match.id, match);

    attachToGoFishMatch(socket, match);
    attachToGoFishMatch(opponentSocket, match);
}

function leaveGoFish(socket) {
    const userId = String(socket.data.user._id);
    removeFromGoFishQueue(userId, socket.id);

    const matchId = socket.data.goFishMatchId || goFishMatchByPlayer.get(userId);
    const match = matchId && goFishMatches.get(matchId);
    if (!match) {
        socket.data.goFishMatchId = null;
        return;
    }

    if (match.sockets.get(userId) === socket.id) {
        const opponent = match.players.find((player) => player.id !== userId);
        match.sockets.delete(userId);
        match.connectedUsers.set(userId, false);
        goFishMatchByPlayer.delete(userId);
        socket.leave(goFishRoom(match.id));

        if (match.status === 'playing' && opponent) {
            clearGoFishTimer(match);
            match.status = 'finished';
            match.winnerId = opponent.id;
            match.message = `${socket.data.user.username} left the game.`;
            emitGoFishState(match);
        }
    }

    socket.data.goFishMatchId = null;
    if (match.players.every((player) => !goFishMatchByPlayer.has(player.id))) {
        clearGoFishTimer(match);
        goFishMatches.delete(match.id);
    }
}

function handleGoFishDisconnect(socket) {
    const userId = String(socket.data.user._id);
    removeFromGoFishQueue(userId, socket.id);

    const match = socket.data.goFishMatchId && goFishMatches.get(socket.data.goFishMatchId);
    if (!match || match.sockets.get(userId) !== socket.id) return;

    match.sockets.delete(userId);
    match.connectedUsers.set(userId, false);
    if (match.status !== 'playing') {
        emitGoFishState(match);
        return;
    }

    const disconnectedPlayer = match.players.find((player) => player.id === userId);
    match.message = `${disconnectedPlayer.username} disconnected. Waiting for them to reconnect.`;
    emitGoFishState(match);
    clearGoFishTimer(match, userId);
    const timer = setTimeout(() => {
        match.disconnectTimers.delete(userId);
        if (match.status !== 'playing' || match.connectedUsers.get(userId) !== false) return;

        const opponent = match.players.find((player) => player.id !== userId);
        match.status = 'finished';
        match.winnerId = opponent.id;
        match.message = `${disconnectedPlayer.username} did not reconnect in time.`;
        goFishMatchByPlayer.delete(userId);
        clearGoFishTimer(match);
        emitGoFishState(match);
    }, GO_FISH_RECONNECT_GRACE_MS);
    match.disconnectTimers.set(userId, timer);
}

// take socket out of session and tell everyone in it
function leaveSession(socket) {
    const { sessionId, player } = socket.data;
    if (!sessionId || !player) return;

    const room = sessionRoom(sessionId);
    socket.leave(room);
    io.to(room).emit('player:leave', { id: player.id });

    socket.data.sessionId = null;
    socket.data.player = null;
}

// start socket server on top of http server
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ },
    });

    // before connection reject anyone without valid token
    io.use(async (socket, next) => {
        try {
            const user = await verifyToken(socket.handshake.auth?.token);
            if (!user) return next(new Error('unauthorized'));
            socket.data.user = user;
            next();
        } catch {
            next(new Error('server error'));
        }
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;
        const id = String(user._id);

        // one connection per user
        io.in(userRoom(id)).disconnectSockets(true);
        socket.join(userRoom(id));

        // client wants to be in session
        socket.on('session:join', async (payload) => {
            try {
                // session id validation
                const sessionId = payload?.sessionId;
                if (typeof sessionId !== 'string' || !/^[\w-]{1,64}$/.test(sessionId)) {
                    return socket.emit('session:error', { error: 'Invalid session id.' });
                }

                // leave the old session first
                leaveSession(socket);

                // look up user's fish on server
                const avatar = user.avatarId
                    ? await getDB().collection('avatars').findOne({ _id: user.avatarId })
                    : null;

                // positions are 0 to 1 so web and mobile line up
                const player = {
                    id,
                    username: user.username,
                    avatarKey: avatar?.imageKey ?? DEFAULT_AVATAR_KEY,
                    x: 0.2 + Math.random() * 0.6,
                    y: 0.2 + Math.random() * 0.6,
                };
                socket.data.player = player;
                socket.data.sessionId = sessionId;

                // everyone already in session
                const room = sessionRoom(sessionId);
                const others = (await io.in(room).fetchSockets())
                    .map((s) => s.data.player)
                    .filter(Boolean);

                socket.join(room);

                // tell joiner who is here and tell others about joiner
                socket.emit('session:players', others);
                socket.emit('session:self', player);
                socket.to(room).emit('player:join', player);
            } catch (error) {
                console.error('Error joining session:', error);
                socket.emit('session:error', { error: 'Could not join the session.' });
            }
        });

        // client moved their fish
        socket.on('move', (pos) => {
            const player = socket.data.player;
            if (!player) return;

            // drop updates that come too fast
            const now = Date.now();
            if (now - (socket.data.lastMove || 0) < MIN_MOVE_INTERVAL_MS) return;
            socket.data.lastMove = now;

            // only real numbers and keep inside screen
            const { x, y } = pos || {};
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            player.x = Math.min(1, Math.max(0, x));
            player.y = Math.min(1, Math.max(0, y));

            socket.to(sessionRoom(socket.data.sessionId)).emit('player:move', {
                id: player.id,
                x: player.x,
                y: player.y,
            });
        });

        // client left session screen
        socket.on('session:leave', () => leaveSession(socket));

        // client wants to play Go Fish
        socket.on('gofish:queue:join', (acknowledge) => {
            joinGoFishQueue(socket);
            if (typeof acknowledge === 'function') acknowledge({ ok: true });
        });
        socket.on('gofish:ask', (payload) => {
            const match = socket.data.goFishMatchId &&
                goFishMatches.get(socket.data.goFishMatchId);
            const result = match
                ? applyAsk(match, id, payload?.rank)
                : { ok: false, error: 'You are not in a Go Fish game.' };

            if (!result.ok) {
                socket.emit('gofish:error', { message: result.error });
                return;
            }

            emitGoFishState(match);
        });
        socket.on('gofish:leave', () => leaveGoFish(socket));

        // connection dropped
        socket.on('disconnect', () => {
            leaveSession(socket)
            handleGoFishDisconnect(socket);
        });
    });

    return io;
}

// kick every connection a user has
function disconnectUser(userId) {
    if (io) io.in(userRoom(String(userId))).disconnectSockets(true);
}

module.exports = { initSocket, disconnectUser };