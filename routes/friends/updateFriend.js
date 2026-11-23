const { getDB } = require('../../services/database');
const { describeFriendships, countFriends, MAX_FRIENDS } = require('../../services/friends');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/friends/{id}:
 *   patch:
 *     summary: Accept a friend request
 *     description: Only the person who received the request can accept it. To say no, delete the request instead.
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted]
 *     responses:
 *       200:
 *         description: You are now friends
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Friend'
 *       400:
 *         description: Invalid ID or status, the request is not pending, or the friend limit is reached
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Only the person who received the request can accept it
 *       404:
 *         description: Not found
 */
const updateFriend = route('Failed to update friend request.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid friendship ID.' });
    if (req.body?.status !== 'accepted') {
        return res.status(400).json({ error: 'status must be "accepted". To decline, delete the request.' });
    }

    const me = req.user._id;
    const friendships = getDB().collection('friendships');
    const friendship = await friendships.findOne({ _id: id, $or: [{ requesterId: me }, { recipientId: me }] });
    if (!friendship) return res.status(404).json({ error: 'Friend request not found.' });
    if (String(friendship.recipientId) !== String(me)) {
        return res.status(403).json({ error: 'Only the person who received the request can accept it.' });
    }
    if (friendship.status !== 'pending') return res.status(400).json({ error: 'This request is not pending.' });
    if (await countFriends(me) >= MAX_FRIENDS) {
        return res.status(400).json({ error: `You can have up to ${MAX_FRIENDS} friends.` });
    }

    const accepted = { ...friendship, status: 'accepted', respondedAt: new Date() };
    await friendships.updateOne({ _id: id }, { $set: { status: 'accepted', respondedAt: accepted.respondedAt } });

    const [mine] = await describeFriendships([accepted], me);
    const [theirs] = await describeFriendships([accepted], friendship.requesterId);
    emitToUser(friendship.requesterId, 'friend:accepted', theirs);
    res.status(200).json(mine);
});

module.exports = updateFriend;
