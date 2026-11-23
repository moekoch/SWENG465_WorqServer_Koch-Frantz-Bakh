const { getDB } = require('../../../services/database');
const { isStaff } = require('../../../services/auth');
const { REPORT_REASONS } = require('../../../services/reports');
const { route, toObjectId, paging } = require('../../../services/http');

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: List reports
 *     description: Moderators and admins see all reports (open ones by default, newest first). Everyone else sees only the reports they sent themselves.
 *     tags: [Report]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, actioned, dismissed, all]
 *           default: open
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *       - in: query
 *         name: reportedUserId
 *         description: Moderators only
 *         schema:
 *           type: string
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
 *         description: A list of reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid status, reason, or user id
 *       401:
 *         description: Not logged in
 */
const getReports = route('Failed to retrieve reports.', async (req, res) => {
    const { status = 'open', reason, reportedUserId } = req.query;
    if (!['open', 'actioned', 'dismissed', 'all'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (reason !== undefined && !REPORT_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason.' });

    const filter = {};
    if (status !== 'all') filter.status = status;
    if (reason) filter.reason = reason;

    if (isStaff(req.user)) {
        if (reportedUserId !== undefined) {
            const id = toObjectId(reportedUserId);
            if (!id) return res.status(400).json({ error: 'Invalid reportedUserId.' });
            filter.reportedUserId = id;
        }
    } else {
        filter.reporterId = req.user._id; // regular users only see their own
    }

    const { limit, skip } = paging(req.query);
    const reports = await getDB().collection('reports').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
    res.status(200).json(reports);
});

module.exports = getReports;
