const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');
const { ownsAvatar } = require('../../services/shop');

/**
 * @swagger
 * /api/users/me/avatar:
 *   patch:
 *     summary: Choose the logged-in user's avatar
 *     description: The user must own the avatar (free avatars are owned by everyone)
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [avatarId]
 *             properties:
 *               avatarId: { type: string, example: 68e2f123456789abcdef1234 }
 *     responses:
 *       200:
 *         description: Avatar saved
 *       400:
 *         description: Invalid avatar id
 *       401:
 *         description: Not logged in
 *       403:
 *         description: The user doesn't own this avatar
 *       404:
 *         description: Avatar not found
 */
async function setMyAvatar(req, res) {
    try {
        const { avatarId } = req.body || {};

        // reject ids that aren't valid MongoDB ObjectIds
        if (typeof avatarId !== 'string' || !ObjectId.isValid(avatarId)) {
            return res.status(400).json({ error: 'Invalid avatar id.' });
        }

        // check avatar exists
        const db = getDB();
        const avatar = await db.collection('avatars').findOne({ _id: new ObjectId(avatarId) });
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found.' });
        }

        // users can only wear fish they own
        if (!ownsAvatar(req.user, avatar)) {
            return res.status(403).json({ error: 'You do not own this fish.' });
        }

        // save on the logged-in user
        await db.collection('users').updateOne(
            { _id: req.user._id },
            { $set: { avatarId: avatar._id } }
        );

        res.json({ avatarId: avatar._id, imageKey: avatar.imageKey });
    } catch (error) {
        console.error('Error setting avatar:', error);
        res.status(500).json({ error: 'Failed to set avatar.' });
    }
}

module.exports = setMyAvatar;