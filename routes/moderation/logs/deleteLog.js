const { getDB } = require('../../../services/database');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/logs/{id}:
 *   delete:
 *     summary: Delete a blocked-message entry (admins)
 *     description: Removes the entry, so it no longer counts toward the user's strikes.
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
 *         description: Entry deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Not found
 */
const deleteLog = route('Failed to delete moderation log entry.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const result = await getDB().collection('moderation_logs').deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Log entry not found.' });
    res.status(200).json({ message: 'Log entry deleted successfully.' });
});

module.exports = deleteLog;
