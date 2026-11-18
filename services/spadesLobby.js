function getAvailablePlayers(queue, sockets, userId) {
    const players = [];

    for (const [availableUserId, socketId] of queue) {
        if (availableUserId === userId) continue;

        const socket = sockets.get(socketId);
        if (socket?.connected) {
            players.push({
                id: availableUserId,
                username: socket.data.user.username,
                avatarKey: socket.data.user.avatarKey,
            });
        }
    }

    return players;
}

function getSelectedPlayers(queue, sockets, socket, playerIds) {
    const userId = String(socket.data.user._id);
    if (
        queue.get(userId) !== socket.id ||
        !Array.isArray(playerIds) ||
        playerIds.length > 3 ||
        new Set(playerIds).size !== playerIds.length
    ) {
        return null;
    }

    const selected = [];
    for (const playerId of playerIds) {
        if (
            typeof playerId !== 'string' ||
            playerId === userId ||
            !queue.has(playerId)
        ) {
            return null;
        }

        const playerSocketId = queue.get(playerId);
        const playerSocket = playerSocketId && sockets.get(playerSocketId);
        if (!playerSocket?.connected) return null;

        selected.push(playerSocket);
    }

    return selected;
}

function fillBotSeats(matchId, players) {
    const roster = [...players];
    while (roster.length < 4) {
        const seat = roster.length;
        roster.push({
            id: `bot:${matchId}:${seat}`,
            username: `Bot ${seat}`,
            avatarKey: ['orangeClownfish', 'blueTang', 'moorishIdol', 'linedButterflyfish'][seat],
            isBot: true,
        });
    }
    return roster;
}

module.exports = {
    fillBotSeats,
    getAvailablePlayers,
    getSelectedPlayers,
};
