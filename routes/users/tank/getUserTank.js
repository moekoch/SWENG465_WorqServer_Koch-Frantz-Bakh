const { getDB } = require('../../../services/database');
const { tankOf } = require('../../../services/tank');
const { settingsOf } = require('../../../services/settings');
const { areFriends, isBlockedEitherWay, publicProfiles } = require('../../../services/social');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/users/{id}/tank:
 *   get:
 *     summary: Visit someone's tank
 *     description: Shows another user's tank if their "Tank visitors" setting lets you in (friends only by default). You can always see your own.
 *     tags: [Tank]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The owner's public profile and tank
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: The owner is not accepting visitors like you
 *       404:
 *         description: User not found
 */
const getUserTank = route('Failed to retrieve tank.', async (req, res) => {
    const ownerId = toObjectId(req.params.id);
    if (!ownerId) return res.status(400).json({ error: 'Invalid user ID.' });

    const owner = await getDB().collection('users').findOne({ _id: ownerId }, { projection: { passwordHash: 0 } });
    const isOwner = String(ownerId) === String(req.user._id);
    if (!owner || (!isOwner && await isBlockedEitherWay(req.user._id, ownerId))) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!isOwner && !isStaff(req.user)) {
        const visitors = settingsOf(owner).tankVisitors;
        const allowed = visitors === 'everyone' || (visitors === 'friends' && await areFriends(req.user._id, ownerId));
        if (!allowed) return res.status(403).json({ error: "This tank isn't open to visitors right now." });
    }

    const profile = (await publicProfiles([ownerId])).get(String(ownerId));
    res.status(200).json({ owner: profile, tank: tankOf(owner) });
});

module.exports = getUserTank;
