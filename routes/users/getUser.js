const { getDB } = require('../../services/database');
const { isStaff } = require('../../services/auth');
const { publicProfiles, areFriends, isBlockedEitherWay } = require('../../services/social');
const { isUserOnline } = require('../../services/socket');
const { settingsOf } = require('../../services/settings');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     description: Your own id or a moderator or admin gets the full record. Anyone else gets a public profile (id, username, fish, and whether they are online if they allow it).
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 6ac8dc29395d18c513fe544b
 *     responses:
 *       200:
 *         description: The user
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error, failed to retrieve user
 */
const getUser = route('Failed to retrieve user.', async (req, res) => {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    // retrieve user by ID, leaving out the password hash
    const user = await getDB().collection('users').findOne({ _id: userId }, { projection: { passwordHash: 0 } });
    // check if user exists (people who blocked you look like they don't exist)
    if (!user || (String(userId) !== String(req.user._id) && await isBlockedEitherWay(req.user._id, userId))) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // yourself or staff: everything except the hash
    if (String(userId) === String(req.user._id) || isStaff(req.user)) {
        return res.status(200).json(user);
    }

    // everyone else: public profile
    const profile = (await publicProfiles([userId])).get(String(userId));
    const visibility = settingsOf(user).onlineStatus;
    const canSeeOnline =
        visibility === 'everyone' || (visibility === 'friends' && await areFriends(req.user._id, userId));
    res.status(200).json({ ...profile, online: canSeeOnline && isUserOnline(userId) });
});

module.exports = getUser;
