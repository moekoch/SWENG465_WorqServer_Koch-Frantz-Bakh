const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');
const { STARTING_POINTS, readWallet } = require('../../services/shop');

/**
 * @swagger
 * /api/avatars/{id}/purchase:
 *   post:
 *     summary: Buy an avatar
 *     description: Spends the logged-in user's points on the avatar. The server checks the price and balance.
 *     tags: [Avatar]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the avatar
 *         schema:
 *           type: string
 *           example: 68e2f123456789abcdef1234
 *     responses:
 *       200:
 *         description: Avatar bought, returns the user's new points and owned avatars
 *       400:
 *         description: Invalid avatar ID or not enough points
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Avatar not found
 *       409:
 *         description: The user already has this avatar
 *       500:
 *         description: Internal server error, failed to buy avatar
 */
async function purchaseAvatar(req, res) {
    try {
        // ensure user is authenticated
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                error: 'Authentication required.'
            });
        }

        // reject IDs that aren't valid MongoDB ObjectIds
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid avatar ID.' });
        }

        const db = getDB();
        const users = db.collection('users');

        // check avatar exists
        const avatar = await db.collection('avatars').findOne({ _id: new ObjectId(req.params.id) });
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found.' });
        }

        // free avatars belong to everyone
        if (avatar.price === 0) {
            return res.status(409).json({ error: 'This fish is free, so you already have it.' });
        }

        // users registered before shop existed get starting points now
        await users.updateOne(
            { _id: req.user._id, points: { $exists: false } },
            { $set: { points: STARTING_POINTS } }
        );

        // only succeeds if user has enough points and doesn't own yet
        const result = await users.updateOne(
            {
                _id: req.user._id,
                points: { $gte: avatar.price },
                ownedAvatarIds: { $ne: avatar._id },
            },
            {
                $inc: { points: -avatar.price },
                $addToSet: { ownedAvatarIds: avatar._id },
            }
        );

        const user = await users.findOne({ _id: req.user._id });

        // check why nothing changed
        if (result.modifiedCount === 0) {
            const alreadyOwned = readWallet(user).ownedAvatarIds.includes(String(avatar._id));
            return alreadyOwned
                ? res.status(409).json({ error: 'You already own this fish.' })
                : res.status(400).json({ error: 'Not enough points.' });
        }

        // send back new balance and owned fish
        res.json(readWallet(user));
    } catch (error) {
        console.error('Error buying avatar:', error);
        res.status(500).json({ error: 'Failed to buy avatar.' });
    }
}

module.exports = purchaseAvatar;