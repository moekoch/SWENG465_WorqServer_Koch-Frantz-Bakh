const { getDB } = require('../../../services/database');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get a report
 *     description: Moderators and admins can open any report. The person who sent a report can open their own.
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
 *         description: The report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Report not found
 */
const getReport = route('Failed to retrieve report.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid report ID.' });

    const report = await getDB().collection('reports').findOne({ _id: id });
    const mine = report && report.reporterId && String(report.reporterId) === String(req.user._id);
    if (!report || (!mine && !isStaff(req.user))) return res.status(404).json({ error: 'Report not found.' });
    res.status(200).json(report);
});

module.exports = getReport;
