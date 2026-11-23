// Turns friendship records into what the app shows: { id, userId, username, avatarKey, online, ... }
const { getDB } = require('./database');
const { publicProfiles } = require('./social');
const { settingsOf } = require('./settings');
const { isUserOnline } = require('./socket');

const MAX_FRIENDS = 100;

// viewerId = the user looking at the list. Each item is about the OTHER person in the friendship.
async function describeFriendships(friendships, viewerId) {
    const otherIds = friendships.map((friendship) =>
        String(friendship.requesterId) === String(viewerId) ? friendship.recipientId : friendship.requesterId,
    );
    const profiles = await publicProfiles(otherIds);
    const users = otherIds.length
        ? await getDB().collection('users').find({ _id: { $in: otherIds } }).toArray()
        : [];
    const settingsById = new Map(users.map((user) => [String(user._id), settingsOf(user)]));

    return friendships
        .map((friendship) => {
            const iSent = String(friendship.requesterId) === String(viewerId);
            const otherId = iSent ? friendship.recipientId : friendship.requesterId;
            const profile = profiles.get(String(otherId));
            if (!profile) return null; // the other account is gone

            // friends can see you're online unless you chose "nobody"
            const sharesPresence = settingsById.get(String(otherId))?.onlineStatus !== 'nobody';
            return {
                id: String(friendship._id),
                userId: profile.id,
                username: profile.username,
                avatarKey: profile.avatarKey,
                status: friendship.status,
                direction: iSent ? 'outgoing' : 'incoming',
                online: friendship.status === 'accepted' && sharesPresence && isUserOnline(otherId),
                since: friendship.respondedAt ?? friendship.createdAt,
            };
        })
        .filter(Boolean);
}

// number of accepted friends
async function countFriends(userId) {
    return getDB().collection('friendships').countDocuments({
        status: 'accepted',
        $or: [{ requesterId: userId }, { recipientId: userId }],
    });
}

module.exports = { MAX_FRIENDS, describeFriendships, countFriends };
