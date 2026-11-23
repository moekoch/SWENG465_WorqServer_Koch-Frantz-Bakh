const { getDB } = require('../../services/database');
const { describeInvites } = require('../../services/invites');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/invites/{id}:
 *   patch:
 *     summary: Accept, decline, or cancel an invite
 *     description: The person invited can accept or decline a pending invite. The person who sent it can cancel it.
 *     tags: [Invite]
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
 *                 enum: [accepted, declined, cancelled]
 *     responses:
 *       200:
 *         description: The updated invite
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Invalid ID or status, or the invite is no longer pending
 *       401:
 *         description: Not logged in
 *       403:
 *         description: That change is not yours to make
 *       404:
 *         description: Not found
 */
const updateInvite = route('Failed to update invite.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid invite ID.' });
    const { status } = req.body ?? {};
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'status must be accepted, declined, or cancelled.' });
    }

    const me = req.user._id;
    const invites = getDB().collection('invites');
    const invite = await invites.findOne({ _id: id, $or: [{ fromUserId: me }, { toUserId: me }] });
    if (!invite) return res.status(404).json({ error: 'Invite not found.' });

    const isSender = String(invite.fromUserId) === String(me);
    if (status === 'cancelled' && !isSender) return res.status(403).json({ error: 'Only the sender can cancel an invite.' });
    if (status !== 'cancelled' && isSender) return res.status(403).json({ error: 'Only the person invited can accept or decline.' });

    if (invite.status !== 'pending') return res.status(400).json({ error: 'This invite is no longer pending.' });
    if (new Date(invite.expiresAt).getTime() <= Date.now()) return res.status(400).json({ error: 'This invite has expired.' });

    const respondedAt = new Date();
    await invites.updateOne({ _id: id }, { $set: { status, respondedAt } });
    const [described] = await describeInvites([{ ...invite, status, respondedAt }]);

    // let the other person know
    emitToUser(isSender ? invite.toUserId : invite.fromUserId, 'invite:updated', described);
    res.status(200).json(described);
});

module.exports = updateInvite;
