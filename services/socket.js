const { Server } = require('socket.io');
const { getDB } = require('./database');
const { verifyToken } = require('./auth');

// fish shown if user hasn't picked one
const DEFAULT_AVATAR_KEY = 'blueTang';

// ignore move events that arrive faster than this
const MIN_MOVE_INTERVAL_MS = 50;

// socket.io server created in initSocket
let io = null;

// room names for user and session
const userRoom = (userId) => `user:${userId}`;
const sessionRoom = (sessionId) => `session:${sessionId}`;

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

        // connection dropped
        socket.on('disconnect', () => leaveSession(socket));
    });

    return io;
}

// kick every connection a user has
function disconnectUser(userId) {
    if (io) io.in(userRoom(String(userId))).disconnectSockets(true);
}

module.exports = { initSocket, disconnectUser };