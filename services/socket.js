const { Server } = require('socket.io');
const { getDB } = require('./database');
const { verifyToken } = require('./auth');
const {
    applyAsk,
    createMatch,
    getPlayerState,
} = require('./goFishGame');
const {
    getAvailablePlayers,
    getSelectedOpponent,
} = require('./goFishLobby');
const spadesGame = require('./spadesGame');
const {
    getAvailablePlayers: getAvailableSpadesPlayers,
    fillBotSeats,
    getSelectedPlayers,
} = require('./spadesLobby');

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

const spadesQueue = new Map();
const spadesMatches = new Map();
const spadesMatchByPlayer = new Map();
const SPADES_RECONNECT_GRACE_MS = 60_000;

function emitSpadesState(match) {
    for (const player of match.players) {
        if (player.isBot) continue;
        const socketId = match.sockets.get(player.id);
        if (socketId) {
            io.to(socketId).emit(
                'spades:state',
                spadesGame.getPlayerState(match.game, player.id, match.status),
            );
        }
    }
}

function emitSpadesLobby() {
    for (const [userId, socketId] of spadesQueue) {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket?.connected) {
            spadesQueue.delete(userId);
            continue;
        }
        socket.emit(
            'spades:lobby',
            getAvailableSpadesPlayers(spadesQueue, io.sockets.sockets, userId),
        );
    }
}

function removeFromSpadesQueue(userId, socketId) {
    if (socketId && spadesQueue.get(userId) !== socketId) return false;
    return spadesQueue.delete(userId);
}

function clearSpadesTimers(match) {
    if (match.actionTimer) clearTimeout(match.actionTimer);
    for (const timer of match.disconnectTimers.values()) clearTimeout(timer);
    match.disconnectTimers.clear();
    match.actionTimer = null;
}

function cleanupSpadesMatchIfEmpty(match) {
    const hasConnectedHuman = match.players.some(
        (player) => !player.isBot && spadesMatchByPlayer.has(player.id),
    );
    if (!hasConnectedHuman) {
        clearSpadesTimers(match);
        spadesMatches.delete(match.id);
    }
}

function attachSpadesPlayer(socket, match) {
    const userId = String(socket.data.user._id);
    const wasDisconnected = match.connectedUsers.get(userId) === false;
    const timer = match.disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    match.disconnectTimers.delete(userId);
    removeFromSpadesQueue(userId);
    match.connectedUsers.set(userId, true);
    match.sockets.set(userId, socket.id);
    spadesMatchByPlayer.set(userId, match.id);
    socket.data.spadesMatchId = match.id;
    socket.join(`spades:${match.id}`);
    if (wasDisconnected) {
        match.game.message = `${socket.data.user.username} reconnected.`;
    }
    emitSpadesState(match);
    emitSpadesLobby();
}

function advanceSpadesGame(match) {
    if (match.status !== 'playing' || match.actionTimer) return;
    const game = match.game;
    if (game.phase === 'roundOver') return;

    if (game.phase === 'dealing') {
        if (!match.players[game.dealer].isBot) return;
        match.actionTimer = setTimeout(() => {
            match.actionTimer = null;
            if (match.status !== 'playing' || match.game.phase !== 'dealing') return;
            match.game = spadesGame.dealHand(match.game);
            emitSpadesState(match);
            advanceSpadesGame(match);
        }, 800);
        return;
    }

    if (game.phase === 'bidding') {
        if (!match.players[game.turn].isBot) return;
        match.actionTimer = setTimeout(() => {
            match.actionTimer = null;
            if (match.status !== 'playing' || match.game.phase !== 'bidding') return;
            const bid = spadesGame.chooseBotBid(match.game, match.game.turn);
            match.game = spadesGame.applyBid(match.game, match.game.turn, bid);
            emitSpadesState(match);
            advanceSpadesGame(match);
        }, 650);
        return;
    }

    if (game.phase !== 'playing') return;
    if (game.trick.length === 4) {
        match.actionTimer = setTimeout(() => {
            match.actionTimer = null;
            if (match.status !== 'playing' || match.game.trick.length !== 4) return;
            match.game = spadesGame.finishTrick(match.game);
            emitSpadesState(match);
            advanceSpadesGame(match);
        }, 900);
        return;
    }

    if (!match.players[game.turn].isBot) return;
    match.actionTimer = setTimeout(() => {
        match.actionTimer = null;
        if (match.status !== 'playing' || match.game.phase !== 'playing') return;
        const playerIndex = match.game.turn;
        const card = spadesGame.chooseBotCard(match.game, playerIndex);
        const nextGame = spadesGame.playCard(match.game, playerIndex, card.id);
        if (!nextGame) return;
        match.game = nextGame;
        emitSpadesState(match);
        advanceSpadesGame(match);
    }, 550);
}

function createSpadesMatch(hostSocket, selectedSockets, difficulty) {
    const id = randomUUID();
    const humanPlayers = [hostSocket, ...selectedSockets].map((socket) => ({
        id: String(socket.data.user._id),
        username: socket.data.user.username,
        avatarKey: socket.data.user.avatarKey ?? DEFAULT_AVATAR_KEY,
        isBot: false,
    }));
    const players = fillBotSeats(id, humanPlayers);

    const match = {
        id,
        players,
        game: spadesGame.createGame(players, difficulty),
        status: 'playing',
        sockets: new Map(),
        connectedUsers: new Map(),
        disconnectTimers: new Map(),
        actionTimer: null,
    };
    spadesMatches.set(id, match);

    for (const socket of [hostSocket, ...selectedSockets]) {
        const userId = String(socket.data.user._id);
        match.sockets.set(userId, socket.id);
        match.connectedUsers.set(userId, true);
        socket.data.spadesMatchId = id;
        socket.join(`spades:${id}`);
        spadesMatchByPlayer.set(userId, id);
    }

    emitSpadesState(match);
    emitSpadesLobby();
    advanceSpadesGame(match);
    return match;
}

function startSpadesMatch(socket, payload) {
    const difficulty = ['easy', 'medium', 'hard'].includes(payload?.difficulty)
        ? payload.difficulty
        : null;
    if (!difficulty) return { ok: false, error: 'Choose a bot difficulty.' };

    const selectedSockets = getSelectedPlayers(
        spadesQueue,
        io.sockets.sockets,
        socket,
        payload?.playerIds,
    );
    if (!selectedSockets) {
        return { ok: false, error: 'One or more selected players are no longer available.' };
    }

    for (const playerSocket of [socket, ...selectedSockets]) {
        spadesQueue.delete(String(playerSocket.data.user._id));
    }
    const match = createSpadesMatch(socket, selectedSockets, difficulty);
    return { ok: true, match };
}

function joinSpadesQueue(socket) {
    const userId = String(socket.data.user._id);
    const activeMatchId = spadesMatchByPlayer.get(userId);
    const activeMatch = activeMatchId && spadesMatches.get(activeMatchId);
    if (activeMatch?.status === 'playing') {
        attachSpadesPlayer(socket, activeMatch);
        return;
    }

    const oldSocketId = spadesQueue.get(userId);
    if (oldSocketId === socket.id) {
        emitSpadesLobby();
        return;
    }
    removeFromSpadesQueue(userId);
    spadesQueue.set(userId, socket.id);
    emitSpadesLobby();
}

function leaveSpades(socket) {
    const userId = String(socket.data.user._id);
    if (removeFromSpadesQueue(userId, socket.id)) emitSpadesLobby();

    const matchId = socket.data.spadesMatchId || spadesMatchByPlayer.get(userId);
    const match = matchId && spadesMatches.get(matchId);
    if (!match || match.sockets.get(userId) !== socket.id) {
        socket.data.spadesMatchId = null;
        return;
    }

    match.sockets.delete(userId);
    match.connectedUsers.set(userId, false);
    spadesMatchByPlayer.delete(userId);
    socket.leave(`spades:${match.id}`);
    if (match.status === 'playing') {
        match.status = 'finished';
        match.game.message = `${socket.data.user.username} left the game.`;
        clearSpadesTimers(match);
        emitSpadesState(match);
    }
    socket.data.spadesMatchId = null;
    cleanupSpadesMatchIfEmpty(match);
}

function handleSpadesDisconnect(socket) {
    const userId = String(socket.data.user._id);
    if (removeFromSpadesQueue(userId, socket.id)) emitSpadesLobby();

    const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
    if (!match || match.sockets.get(userId) !== socket.id) return;

    match.sockets.delete(userId);
    match.connectedUsers.set(userId, false);
    const disconnectedPlayer = match.players.find((player) => player.id === userId);
    match.game.message = `${disconnectedPlayer.username} disconnected. Waiting for them to reconnect.`;
    emitSpadesState(match);
    const timer = setTimeout(() => {
        match.disconnectTimers.delete(userId);
        if (match.status !== 'playing' || match.connectedUsers.get(userId) !== false) return;
        match.status = 'finished';
        match.game.message = `${disconnectedPlayer.username} did not reconnect in time.`;
        spadesMatchByPlayer.delete(userId);
        clearSpadesTimers(match);
        emitSpadesState(match);
        cleanupSpadesMatchIfEmpty(match);
    }, SPADES_RECONNECT_GRACE_MS);
    match.disconnectTimers.set(userId, timer);
}

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
    if (socketId && goFishQueue.get(userId) !== socketId) return false;
    return goFishQueue.delete(userId);
}

function emitGoFishLobby() {
    for (const [userId, socketId] of goFishQueue) {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket?.connected) {
            goFishQueue.delete(userId);
            continue;
        }

        socket.emit(
            'gofish:lobby',
            getAvailablePlayers(goFishQueue, io.sockets.sockets, userId),
        );
    }
}

function startGoFishMatch(socket, playerId) {
    const userId = String(socket.data.user._id);
    const opponentSocket = getSelectedOpponent(
        goFishQueue,
        io.sockets.sockets,
        socket,
        playerId,
    );
    if (!opponentSocket) return false;

    const opponentId = String(opponentSocket.data.user._id);
    goFishQueue.delete(userId);
    goFishQueue.delete(opponentId);

    const match = createMatch(
        {
            id: userId,
            username: socket.data.user.username,
            avatarKey: socket.data.user.goFishAvatarKey ?? DEFAULT_AVATAR_KEY,
        },
        {
            id: opponentId,
            username: opponentSocket.data.user.username,
            avatarKey: opponentSocket.data.user.goFishAvatarKey ?? DEFAULT_AVATAR_KEY,
        },
    );
    match.sockets = new Map();
    match.disconnectTimers = new Map();
    goFishMatches.set(match.id, match);

    attachToGoFishMatch(socket, match);
    attachToGoFishMatch(opponentSocket, match);
    emitGoFishLobby();
    return true;
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
        emitGoFishLobby();
        return;
    }
    removeFromGoFishQueue(userId);

    goFishQueue.set(userId, socket.id);
    emitGoFishLobby();
}

function leaveGoFish(socket) {
    const userId = String(socket.data.user._id);
    if (removeFromGoFishQueue(userId, socket.id)) emitGoFishLobby();

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
    if (removeFromGoFishQueue(userId, socket.id)) emitGoFishLobby();

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
        socket.on('gofish:queue:join', async (acknowledge) => {
            try {
                if (!socket.data.user.goFishAvatarKey) {
                    const avatar = socket.data.user.avatarId
                        ? await getDB().collection('avatars').findOne({
                            _id: socket.data.user.avatarId,
                        })
                        : null;
                    socket.data.user.goFishAvatarKey =
                        avatar?.imageKey ?? DEFAULT_AVATAR_KEY;
                }

                if (!socket.connected) return;
                if (typeof acknowledge === 'function') {
                    acknowledge({ ok: true, protocol: 'select-opponent-v1' });
                }
                joinGoFishQueue(socket);
            } catch (error) {
                console.error('Error joining Go Fish matchmaking:', error);
                if (typeof acknowledge === 'function') {
                    acknowledge({
                        ok: false,
                        protocol: 'select-opponent-v1',
                        message: 'Could not load your player profile.',
                    });
                }
            }
        });
        socket.on('gofish:player:select', (payload, acknowledge) => {
            const started = startGoFishMatch(socket, payload?.playerId);
            if (!started) {
                socket.emit('gofish:error', {
                    message: 'That player is no longer available. Choose someone else.',
                });
            }
            if (typeof acknowledge === 'function') {
                acknowledge({ ok: started });
            }
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

        socket.on('spades:queue:join', async (acknowledge) => {
            try {
                if (!socket.data.user.avatarKey) {
                    const avatar = socket.data.user.avatarId
                        ? await getDB().collection('avatars').findOne({
                            _id: socket.data.user.avatarId,
                        })
                        : null;
                    socket.data.user.avatarKey = avatar?.imageKey ?? DEFAULT_AVATAR_KEY;
                }

                if (!socket.connected) return;
                if (typeof acknowledge === 'function') acknowledge({ ok: true });
                joinSpadesQueue(socket);
            } catch (error) {
                console.error('Error joining Spades matchmaking:', error);
                if (typeof acknowledge === 'function') {
                    acknowledge({ ok: false, message: 'Could not load your player profile.' });
                }
            }
        });

        socket.on('spades:match:start', (payload, acknowledge) => {
            const result = startSpadesMatch(socket, payload);
            if (!result.ok) {
                socket.emit('spades:error', { message: result.error });
            }
            if (typeof acknowledge === 'function') {
                acknowledge({ ok: result.ok, message: result.error });
            }
        });

        socket.on('spades:deal', () => {
            const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
            const playerIndex = match?.players.findIndex(
                (player) => player.id === String(socket.data.user._id),
            );
            if (
                !match ||
                match.status !== 'playing' ||
                match.game.phase !== 'dealing' ||
                match.game.dealer !== playerIndex
            ) {
                return socket.emit('spades:error', { message: 'You cannot deal right now.' });
            }
            match.game = spadesGame.dealHand(match.game);
            emitSpadesState(match);
            advanceSpadesGame(match);
        });

        socket.on('spades:bid', (payload) => {
            const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
            const playerIndex = match?.players.findIndex(
                (player) => player.id === String(socket.data.user._id),
            );
            if (
                !match ||
                match.status !== 'playing' ||
                match.game.phase !== 'bidding' ||
                match.game.turn !== playerIndex ||
                !Number.isInteger(payload?.bid) ||
                payload.bid < 0 ||
                payload.bid > 13
            ) {
                return socket.emit('spades:error', { message: 'That bid is not valid right now.' });
            }
            match.game = spadesGame.applyBid(match.game, playerIndex, payload.bid);
            emitSpadesState(match);
            advanceSpadesGame(match);
        });

        socket.on('spades:play', (payload) => {
            const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
            const playerIndex = match?.players.findIndex(
                (player) => player.id === String(socket.data.user._id),
            );
            if (
                !match ||
                match.status !== 'playing' ||
                match.game.phase !== 'playing' ||
                match.game.turn !== playerIndex ||
                typeof payload?.cardId !== 'string'
            ) {
                return socket.emit('spades:error', { message: 'That play is not valid right now.' });
            }
            const nextGame = spadesGame.playCard(match.game, playerIndex, payload.cardId);
            if (!nextGame) {
                return socket.emit('spades:error', { message: 'That card cannot be played.' });
            }
            match.game = nextGame;
            emitSpadesState(match);
            advanceSpadesGame(match);
        });

        socket.on('spades:next-hand', () => {
            const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
            const userId = String(socket.data.user._id);
            if (
                !match ||
                match.status !== 'playing' ||
                match.game.phase !== 'roundOver' ||
                !match.players.some((player) => player.id === userId) ||
                spadesGame.getPlayerState(match.game, userId).gameOver
            ) {
                return socket.emit('spades:error', { message: 'The next hand is not available.' });
            }
            match.game = spadesGame.createRound(match.players, {
                scores: match.game.scores,
                bags: match.game.bags,
                roundNumber: match.game.roundNumber + 1,
                dealer: (match.game.dealer + 1) % 4,
                overtime: match.game.overtime,
                difficulty: match.game.difficulty,
            });
            emitSpadesState(match);
            advanceSpadesGame(match);
        });

        socket.on('spades:rematch', () => {
            const match = socket.data.spadesMatchId && spadesMatches.get(socket.data.spadesMatchId);
            const userId = String(socket.data.user._id);
            if (!match || match.players.findIndex((player) => player.id === userId) < 0) {
                return socket.emit('spades:error', { message: 'You are not in a Spades game.' });
            }
            if (match.status === 'playing' && !spadesGame.getPlayerState(match.game, userId).gameOver) {
                return socket.emit('spades:error', { message: 'Finish this game before starting a new one.' });
            }
            if (
                match.players.some(
                    (player) => !player.isBot && match.connectedUsers.get(player.id) !== true,
                )
            ) {
                return socket.emit('spades:error', { message: 'All human players must be connected to start a rematch.' });
            }
            clearSpadesTimers(match);
            match.status = 'playing';
            match.game = spadesGame.createGame(match.players, match.game.difficulty);
            emitSpadesState(match);
            advanceSpadesGame(match);
        });

        socket.on('spades:leave', () => leaveSpades(socket));

        // connection dropped
        socket.on('disconnect', () => {
            leaveSession(socket)
            handleGoFishDisconnect(socket);
            handleSpadesDisconnect(socket);
        });
    });

    return io;
}

// kick every connection a user has
function disconnectUser(userId) {
    if (io) io.in(userRoom(String(userId))).disconnectSockets(true);
}

module.exports = { initSocket, disconnectUser };