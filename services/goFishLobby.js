function getAvailablePlayers(queue, sockets, userId) {
    const players = [];

    for (const [availableUserId, socketId] of queue) {
        if (availableUserId === userId) continue;

        const socket = sockets.get(socketId);
        if (socket?.connected) {
            players.push({
                id: availableUserId,
                username: socket.data.user.username,
                avatarKey: socket.data.user.goFishAvatarKey,
            });
        }
    }

    return players;
}

function getSelectedOpponent(queue, sockets, socket, playerId) {
    const userId = String(socket.data.user._id);
    if (
        typeof playerId !== 'string' ||
        playerId === userId ||
        queue.get(userId) !== socket.id
    ) {
        return null;
    }

    const opponentSocketId = queue.get(playerId);
    const opponentSocket = opponentSocketId && sockets.get(opponentSocketId);
    return opponentSocket?.connected ? opponentSocket : null;
}

module.exports = {
    getAvailablePlayers,
    getSelectedOpponent,
};
