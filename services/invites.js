const { publicProfiles } = require('./social');

const INVITE_TYPES = ['tank', 'game', 'focus'];
const INVITE_LIFETIME_MS = 30 * 60 * 1000;
const MAX_NOTE_LENGTH = 60;

// what the app sees for an invite (both people as public profiles)
async function describeInvites(invites) {
    const profiles = await publicProfiles(invites.flatMap((invite) => [invite.fromUserId, invite.toUserId]));
    return invites.map((invite) => ({
        id: String(invite._id),
        type: invite.type,
        ...(invite.game && { game: invite.game }),
        ...(invite.message && { message: invite.message }),
        status: invite.status,
        from: profiles.get(String(invite.fromUserId)) ?? null,
        to: profiles.get(String(invite.toUserId)) ?? null,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
    }));
}

module.exports = { INVITE_TYPES, INVITE_LIFETIME_MS, MAX_NOTE_LENGTH, describeInvites };
