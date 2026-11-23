const { getDB } = require('../../services/database');
const { describeInvites } = require('../../services/invites');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/invites/{id}:
 *   get:
 *     summary: Get one invite
 *     description: Only the person who sent it and the person who received it can see it.
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
 *         description: The invite
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Not found
 */
const getInvite = route('Failed to retrieve invite.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid invite ID.' });

    const me = req.user._id;
    const invite = await getDB().collection('invites').findOne({ _id: id, $or: [{ fromUserId: me }, { toUserId: me }] });
    if (!invite) return res.status(404).json({ error: 'Invite not found.' });
    res.status(200).json((await describeInvites([invite]))[0]);
});

module.exports = getInvite;
