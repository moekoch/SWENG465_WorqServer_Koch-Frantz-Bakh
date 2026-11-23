const { getDB } = require('../../services/database');
const { describeFriendships } = require('../../services/friends');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/friends/{id}:
 *   get:
 *     summary: Get one friendship
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The friendship id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The friendship
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Friend'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Not found (also returned for other people's friendships)
 */
const getFriend = route('Failed to retrieve friend.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid friendship ID.' });

    const me = req.user._id;
    const friendship = await getDB().collection('friendships').findOne({
        _id: id,
        $or: [{ requesterId: me }, { recipientId: me }],
    });
    if (!friendship) return res.status(404).json({ error: 'Friend not found.' });

    const [item] = await describeFriendships([friendship], me);
    if (!item) return res.status(404).json({ error: 'Friend not found.' });
    res.status(200).json(item);
});

module.exports = getFriend;
