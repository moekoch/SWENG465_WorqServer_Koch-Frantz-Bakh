// points every user starts with
const STARTING_POINTS = 1000;

// user's points and owned fish
function readWallet(user) {
    return {
        points: user.points ?? STARTING_POINTS,
        ownedAvatarIds: (user.ownedAvatarIds ?? []).map(String),
    };
}

// check user owns avatar
function ownsAvatar(user, avatar) {
    return avatar.price === 0 || readWallet(user).ownedAvatarIds.includes(String(avatar._id));
}

module.exports = { STARTING_POINTS, readWallet, ownsAvatar };