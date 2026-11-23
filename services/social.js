// Friends, blocks and public profiles: small lookups many routes share.
const { getDB } = require('./database');

// fish shown if a user hasn't picked one
const DEFAULT_AVATAR_KEY = 'blueTang';

// the friendship between two users (accepted or not), or null
function findFriendship(userA, userB) {
    return getDB().collection('friendships').findOne({
        $or: [
            { requesterId: userA, recipientId: userB },
            { requesterId: userB, recipientId: userA },
        ],
    });
}

async function areFriends(userA, userB) {
    const friendship = await findFriendship(userA, userB);
    return friendship?.status === 'accepted';
}

// ids of everyone the user is friends with
async function friendIdsOf(userId) {
    const friendships = await getDB()
        .collection('friendships')
        .find({ status: 'accepted', $or: [{ requesterId: userId }, { recipientId: userId }] })
        .toArray();
    return friendships.map((friendship) =>
        String(friendship.requesterId) === String(userId) ? friendship.recipientId : friendship.requesterId,
    );
}

// true if either of the two has blocked the other
async function isBlockedEitherWay(userA, userB) {
    const block = await getDB().collection('blocks').findOne({
        $or: [
            { blockerId: userA, blockedId: userB },
            { blockerId: userB, blockedId: userA },
        ],
    });
    return Boolean(block);
}

// Set of user id strings this user has blocked
async function blockedIdsOf(userId) {
    const blocks = await getDB().collection('blocks').find({ blockerId: userId }).toArray();
    return new Set(blocks.map((block) => String(block.blockedId)));
}

// { id, username, avatarKey } for each user id: Map keyed by the id as a string.
// Never includes email or anything private.
async function publicProfiles(userIds) {
    const db = getDB();
    const unique = [...new Map(userIds.map((id) => [String(id), id])).values()];
    if (unique.length === 0) return new Map();

    const users = await db.collection('users').find({ _id: { $in: unique } }).toArray();
    const avatarIds = users.map((user) => user.avatarId).filter(Boolean);
    const avatars = avatarIds.length
        ? await db.collection('avatars').find({ _id: { $in: avatarIds } }).toArray()
        : [];
    const keyByAvatarId = new Map(avatars.map((avatar) => [String(avatar._id), avatar.imageKey]));

    return new Map(
        users.map((user) => [
            String(user._id),
            {
                id: String(user._id),
                username: user.username,
                avatarKey: keyByAvatarId.get(String(user.avatarId)) ?? DEFAULT_AVATAR_KEY,
            },
        ]),
    );
}

module.exports = {
    DEFAULT_AVATAR_KEY,
    findFriendship,
    areFriends,
    friendIdsOf,
    isBlockedEitherWay,
    blockedIdsOf,
    publicProfiles,
};
