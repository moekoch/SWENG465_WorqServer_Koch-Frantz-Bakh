const { getDB } = require('../../services/database');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/invites/{id}:
 *   delete:
 *     summary: Delete an invite
 *     description: Either person can remove an invite from their list. Removing a pending invite you sent withdraws it.
 *     tags: [Invite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invite deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Not found
 */
const deleteInvite = route('Failed to delete invite.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid invite ID.' });

    const me = req.user._id;
    const invites = getDB().collection('invites');
    const invite = await invites.findOne({ _id: id, $or: [{ fromUserId: me }, { toUserId: me }] });
    if (!invite) return res.status(404).json({ error: 'Invite not found.' });

    await invites.deleteOne({ _id: id });
    if (invite.status === 'pending' && String(invite.fromUserId) === String(me)) {
        emitToUser(invite.toUserId, 'invite:withdrawn', { id: String(id) });
    }
    res.status(200).json({ message: 'Invite deleted successfully.' });
});

module.exports = deleteInvite;
