const { getDB } = require('../../services/database');
const { describeInvites } = require('../../services/invites');
const { route, paging } = require('../../services/http');

/**
 * @swagger
 * /api/invites:
 *   get:
 *     summary: List my invites
 *     description: Invites I received (default), sent, or both. Pending invites that ran out of time are left out.
 *     tags: [Invite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: box
 *         schema:
 *           type: string
 *           enum: [received, sent, all]
 *           default: received
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, cancelled]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A list of invites, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Invalid box or status
 *       401:
 *         description: Not logged in
 */
const getInvites = route('Failed to retrieve invites.', async (req, res) => {
    const { box = 'received', status } = req.query;
    if (!['received', 'sent', 'all'].includes(box)) return res.status(400).json({ error: 'box must be received, sent, or all.' });
    if (status !== undefined && !['pending', 'accepted', 'declined', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    const me = req.user._id;
    const who = box === 'received' ? { toUserId: me } : box === 'sent' ? { fromUserId: me } : { $or: [{ toUserId: me }, { fromUserId: me }] };
    const filter = { ...who, ...(status && { status }) };

    const { limit, skip } = paging(req.query);
    const invites = await getDB().collection('invites').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();

    // an invite nobody answered in time is no longer open
    const now = Date.now();
    const open = invites.filter((invite) => invite.status !== 'pending' || new Date(invite.expiresAt).getTime() > now);
    res.status(200).json(await describeInvites(open));
});

module.exports = getInvites;
