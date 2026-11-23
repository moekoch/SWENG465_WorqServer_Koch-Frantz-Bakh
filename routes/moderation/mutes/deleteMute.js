const { getDB } = require('../../../services/database');
const { emitToUser } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/mutes/{id}:
 *   delete:
 *     summary: End a chat break early (moderators)
 *     description: The break stays in the record, marked as lifted.
 *     tags: [Mute]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat break lifted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Not found
 */
const deleteMute = route('Failed to lift chat break.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });

    const mutes = getDB().collection('mutes');
    const mute = await mutes.findOne({ _id: id });
    if (!mute) return res.status(404).json({ error: 'Chat break not found.' });

    await mutes.updateOne({ _id: id }, { $set: { liftedAt: new Date(), liftedBy: req.user._id } });
    emitToUser(mute.userId, 'moderation:unmuted', {});
    res.status(200).json({ message: 'Chat break lifted successfully.' });
});

module.exports = deleteMute;
