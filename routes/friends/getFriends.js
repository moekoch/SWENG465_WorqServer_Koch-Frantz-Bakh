const { getDB } = require('../../services/database');
const { describeFriendships } = require('../../services/friends');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/friends:
 *   get:
 *     summary: List my friends and friend requests
 *     description: Returns the logged-in user's friendships, online friends first. Use status to get only accepted friends or only pending requests.
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, accepted, pending]
 *           default: all
 *       - in: query
 *         name: direction
 *         description: For pending requests, only ones I received or only ones I sent
 *         schema:
 *           type: string
 *           enum: [incoming, outgoing]
 *     responses:
 *       200:
 *         description: A list of friendships
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Friend'
 *       400:
 *         description: Invalid status or direction
 *       401:
 *         description: Not logged in
 */
const getFriends = route('Failed to retrieve friends.', async (req, res) => {
    const { status = 'all', direction } = req.query;
    if (!['all', 'accepted', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'status must be all, accepted, or pending.' });
    }
    if (direction !== undefined && !['incoming', 'outgoing'].includes(direction)) {
        return res.status(400).json({ error: 'direction must be incoming or outgoing.' });
    }

    const me = req.user._id;
    const mine = direction === 'incoming'
        ? { recipientId: me }
        : direction === 'outgoing'
            ? { requesterId: me }
            : { $or: [{ requesterId: me }, { recipientId: me }] };
    const filter = { ...mine, ...(status !== 'all' && { status }) };

    const friendships = await getDB().collection('friendships').find(filter).sort({ createdAt: -1 }).toArray();
    const items = await describeFriendships(friendships, me);

    // online friends first, then A to Z
    items.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
    res.status(200).json(items);
});

module.exports = getFriends;
