const { getDB } = require('../../../services/database');
const { hasRole } = require('../../../services/auth');
const { REPORT_ACTIONS } = require('../../../services/reports');
const { createMute } = require('../../../services/moderationStore');
const { disconnectUser, emitToUser } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/reports/{id}:
 *   patch:
 *     summary: Review a report (moderators)
 *     description: Close a report as dismissed or actioned, and optionally take an action against the person reported. warn sends them a notice. mute starts a chat break (muteMinutes, default 30). remove_message removes the reported message. suspend and ban (admins only) lock the account and disconnect it.
 *     tags: [Report]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [actioned, dismissed]
 *               action:
 *                 type: string
 *                 enum: [none, warn, mute, remove_message, suspend, ban]
 *               muteMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 43200
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid fields, or the report is already closed
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only (suspend and ban need an admin)
 *       404:
 *         description: Report not found
 */
const updateReport = route('Failed to update report.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid report ID.' });

    const { status, action = 'none', muteMinutes = 30, note } = req.body ?? {};
    if (!['actioned', 'dismissed'].includes(status)) return res.status(400).json({ error: 'status must be actioned or dismissed.' });
    if (!REPORT_ACTIONS.includes(action)) return res.status(400).json({ error: `action must be one of: ${REPORT_ACTIONS.join(', ')}.` });
    if (status === 'dismissed' && action !== 'none') return res.status(400).json({ error: 'A dismissed report has no action.' });
    if (!Number.isInteger(muteMinutes) || muteMinutes < 1 || muteMinutes > 43200) return res.status(400).json({ error: 'muteMinutes must be 1 to 43200.' });
    if ((action === 'suspend' || action === 'ban') && !hasRole(req.user, 'admin')) {
        return res.status(403).json({ error: 'Only admins can suspend or ban accounts.' });
    }

    const db = getDB();
    const reports = db.collection('reports');
    const report = await reports.findOne({ _id: id });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    if (report.status !== 'open') return res.status(400).json({ error: 'This report is already closed.' });

    const target = report.reportedUserId;
    if (action !== 'none' && !target) return res.status(400).json({ error: 'This report has nobody to take action against.' });

    // never act against another moderator through a report: that is an admin matter
    if (target && action !== 'none') {
        const targetUser = await db.collection('users').findOne({ _id: target });
        if (targetUser && ['moderator', 'admin'].includes(targetUser.role) && !hasRole(req.user, 'admin')) {
            return res.status(403).json({ error: 'Only admins can act against staff.' });
        }
    }

    if (action === 'warn') {
        emitToUser(target, 'moderation:warning', { message: 'A moderator reviewed a report about you. Please keep chat friendly.' });
    } else if (action === 'mute') {
        const mute = await createMute({ userId: target, minutes: muteMinutes, reason: note || 'Moderator action', source: 'moderator', createdBy: req.user._id });
        emitToUser(target, 'moderation:muted', { until: mute.until, error: 'A moderator started a chat break for you.' });
    } else if (action === 'remove_message') {
        if (!report.messageId) return res.status(400).json({ error: 'This report is not about a message.' });
        await db.collection('messages').updateOne({ _id: report.messageId }, { $set: { removedAt: new Date(), removedBy: req.user._id } });
    } else if (action === 'suspend' || action === 'ban') {
        await db.collection('users').updateOne({ _id: target }, { $set: { status: action === 'ban' ? 'banned' : 'suspended' } });
        disconnectUser(target);
    }

    const resolved = { status, action, resolvedBy: req.user._id, resolvedAt: new Date() };
    if (typeof note === 'string' && note.trim()) resolved.resolution = note.trim().slice(0, 300);
    await reports.updateOne({ _id: id }, { $set: resolved });
    res.status(200).json(await reports.findOne({ _id: id }));
});

module.exports = updateReport;
