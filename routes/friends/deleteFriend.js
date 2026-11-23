const { getDB } = require('../../services/database');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/friends/{id}:
 *   delete:
 *     summary: Remove a friend, decline a request, or cancel a request I sent
 *     description: Either person in the friendship can delete it.
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Not found
 */
const deleteFriend = route('Failed to remove friend.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid friendship ID.' });

    const me = req.user._id;
    const friendships = getDB().collection('friendships');
    const friendship = await friendships.findOne({ _id: id, $or: [{ requesterId: me }, { recipientId: me }] });
    if (!friendship) return res.status(404).json({ error: 'Friend not found.' });

    await friendships.deleteOne({ _id: id });
    const otherId = String(friendship.requesterId) === String(me) ? friendship.recipientId : friendship.requesterId;
    emitToUser(otherId, 'friend:removed', { id: String(id) });
    res.status(200).json({ message: 'Friend removed successfully.' });
});

module.exports = deleteFriend;
