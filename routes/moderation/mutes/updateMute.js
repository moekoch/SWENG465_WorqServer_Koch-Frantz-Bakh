const { getDB } = require('../../../services/database');
const { emitToUser } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/mutes/{id}:
 *   patch:
 *     summary: Change how long a chat break lasts (moderators)
 *     description: Sets the break to end this many minutes from now.
 *     tags: [Mute]
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
 *             required: [minutes]
 *             properties:
 *               minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 43200
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated chat break
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mute'
 *       400:
 *         description: Invalid fields, or the break was already lifted
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Not found
 */
const updateMute = route('Failed to update chat break.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const { minutes, reason } = req.body ?? {};
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200) return res.status(400).json({ error: 'minutes must be 1 to 43200.' });

    const mutes = getDB().collection('mutes');
    const mute = await mutes.findOne({ _id: id });
    if (!mute) return res.status(404).json({ error: 'Chat break not found.' });
    if (mute.liftedAt) return res.status(400).json({ error: 'This chat break was already lifted.' });

    const updates = { until: new Date(Date.now() + minutes * 60 * 1000) };
    if (typeof reason === 'string') updates.reason = reason.slice(0, 200);
    await mutes.updateOne({ _id: id }, { $set: updates });
    emitToUser(mute.userId, 'moderation:muted', { until: updates.until, error: 'Your chat break was changed by a moderator.' });
    res.status(200).json({ ...mute, ...updates });
});

module.exports = updateMute;
