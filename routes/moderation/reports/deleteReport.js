const { getDB } = require('../../../services/database');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/reports/{id}:
 *   delete:
 *     summary: Delete a report (admins)
 *     tags: [Report]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Report not found
 */
const deleteReport = route('Failed to delete report.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid report ID.' });
    const result = await getDB().collection('reports').deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Report not found.' });
    res.status(200).json({ message: 'Report deleted successfully.' });
});

module.exports = deleteReport;
