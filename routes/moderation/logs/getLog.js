const { getDB } = require('../../../services/database');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/logs/{id}:
 *   get:
 *     summary: Get one blocked-message entry (moderators)
 *     tags: [Moderation]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The entry
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Not found
 */
const getLog = route('Failed to retrieve moderation log entry.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const entry = await getDB().collection('moderation_logs').findOne({ _id: id });
    if (!entry) return res.status(404).json({ error: 'Log entry not found.' });
    res.status(200).json(entry);
});

module.exports = getLog;
