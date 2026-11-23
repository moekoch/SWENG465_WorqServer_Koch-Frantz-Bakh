const { getDB } = require('../../services/database');
const { describeFriendships } = require('../../services/friends');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/users/me/friends:
 *   get:
 *     summary: List my accepted friends (with online status)
 *     description: Shortcut for GET /api/friends?status=accepted. This is what the Friends panel shows.
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Accepted friends, online first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Friend'
 *       401:
 *         description: Not logged in
 */
const getMyFriends = route('Failed to retrieve friends.', async (req, res) => {
    const me = req.user._id;
    const friendships = await getDB()
        .collection('friendships')
        .find({ status: 'accepted', $or: [{ requesterId: me }, { recipientId: me }] })
        .toArray();
    const items = await describeFriendships(friendships, me);
    items.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
    res.status(200).json(items);
});

module.exports = getMyFriends;
