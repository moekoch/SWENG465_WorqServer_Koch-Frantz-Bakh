const { getDB } = require('./database');

// remove everything that belongs to a deleted account (used when a user deletes their own
// account and when an admin deletes one). Reports and the moderation log are kept on purpose
// so moderators can still look back at what happened.
async function removeUserData(userId) {
    const db = getDB();
    await Promise.all([
        db.collection('friendships').deleteMany({ $or: [{ requesterId: userId }, { recipientId: userId }] }),
        db.collection('blocks').deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
        db.collection('invites').deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] }),
        db.collection('messages').deleteMany({ userID: userId }),
        db.collection('game_results').deleteMany({ userId }),
        db.collection('mutes').deleteMany({ userId }),
    ]);

    // direct chats with a deleted user have nobody left to talk to
    const directChats = await db.collection('chats').find({ type: 'direct', participants: userId }).toArray();
    for (const chat of directChats) {
        await db.collection('messages').deleteMany({ chatID: chat._id });
        await db.collection('chats').deleteOne({ _id: chat._id });
    }
    // leave group chats
    await db.collection('chats').updateMany({ type: 'group', participants: userId }, { $pull: { participants: userId } });
}

module.exports = { removeUserData };
