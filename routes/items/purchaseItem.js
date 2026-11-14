const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');
const { STARTING_POINTS, readWallet } = require('../../services/shop');

/**
 * @swagger
 * /api/items/{id}/purchase:
 *   post:
 *     summary: Buy an item
 *     description: Spends the logged-in user's points on the item. The server checks the price and balance.
 *     tags: [Item]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the item
 *         schema:
 *           type: string
 *           example: 68e2f123456789abcdef1234
 *     responses:
 *       200:
 *         description: Item bought, returns the user's new points and owned avatars and items
 *       400:
 *         description: Invalid item ID or not enough points
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Item not found
 *       409:
 *         description: The user already has this item
 *       500:
 *         description: Internal server error, failed to buy item
 */
async function purchaseItem(req, res) {
    try {
        // reject IDs that aren't valid MongoDB ObjectIds
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID.' });
        }

        const db = getDB();
        const users = db.collection('users');

        // item must exist
        const item = await db.collection('items').findOne({ _id: new ObjectId(req.params.id) });
        if (!item) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        // free items already belong to everyone
        if (item.price === 0) {
            return res.status(409).json({ error: 'This item is free, so you already have it.' });
        }

        // users who registered before shop existed get starting points now
        await users.updateOne(
            { _id: req.user._id, points: { $exists: false } },
            { $set: { points: STARTING_POINTS } }
        );

        // only succeeds if the user has enough points and doesn't own it yet
        const result = await users.updateOne(
            {
                _id: req.user._id,
                points: { $gte: item.price },
                ownedItemIds: { $ne: item._id },
            },
            {
                $inc: { points: -item.price },
                $addToSet: { ownedItemIds: item._id },
            }
        );

        const user = await users.findOne({ _id: req.user._id });

        // nothing changed so work out why
        if (result.modifiedCount === 0) {
            const alreadyOwned = readWallet(user).ownedItemIds.includes(String(item._id));
            return alreadyOwned
                ? res.status(409).json({ error: 'You already own this item.' })
                : res.status(400).json({ error: 'Not enough points.' });
        }

        // send back new balance and owned avatars and items
        res.json(readWallet(user));
    } catch (error) {
        console.error('Error buying item:', error);
        res.status(500).json({ error: 'Failed to buy item.' });
    }
}

module.exports = purchaseItem;