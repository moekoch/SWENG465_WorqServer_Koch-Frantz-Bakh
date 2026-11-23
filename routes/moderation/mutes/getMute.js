const { getDB } = require('../../../services/database');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/mutes/{id}:
 *   get:
 *     summary: Get a chat break (moderators)
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
 *         description: The chat break
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mute'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Not found
 */
const getMute = route('Failed to retrieve chat break.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const mute = await getDB().collection('mutes').findOne({ _id: id });
    if (!mute) return res.status(404).json({ error: 'Chat break not found.' });
    res.status(200).json(mute);
});

module.exports = getMute;
