const { getDB } = require('../../../services/database');
const { REPORT_REASONS } = require('../../../services/reports');
const { route, toObjectId } = require('../../../services/http');

const MAX_REPORTS_PER_HOUR = 10;

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Report a message or a person
 *     description: Send a report to the moderators. Report a message by its id (from a chat), or a person by their user id. The message text is saved with the report so moderators can see it even if it is deleted. You can't report yourself, and the same message can only be reported once by you.
 *     tags: [Report]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               messageId:
 *                 type: string
 *               userId:
 *                 type: string
 *               reason:
 *                 type: string
 *                 enum: [profanity, hate, harassment, threat, privacy, sexual, spam, other]
 *               details:
 *                 type: string
 *                 maxLength: 300
 *     responses:
 *       201:
 *         description: Report sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid fields
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Message or user not found
 *       409:
 *         description: You already reported this
 *       429:
 *         description: Too many reports in the last hour
 */
const createReport = route('Failed to send report.', async (req, res) => {
    const { reason, details } = req.body ?? {};
    if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: `reason must be one of: ${REPORT_REASONS.join(', ')}.` });
    if (details !== undefined && (typeof details !== 'string' || details.length > 300)) {
        return res.status(400).json({ error: 'details must be text of 300 characters or less.' });
    }

    const db = getDB();
    const reports = db.collection('reports');
    const me = req.user._id;

    const recent = await reports.countDocuments({ reporterId: me, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
    if (recent >= MAX_REPORTS_PER_HOUR) return res.status(429).json({ error: 'You have sent a lot of reports. Please try again later.' });

    const report = { source: 'user', reporterId: me, reason, status: 'open', createdAt: new Date() };
    if (details?.trim()) report.details = details.trim();

    if (req.body.messageId !== undefined) {
        const messageId = toObjectId(req.body.messageId);
        if (!messageId) return res.status(400).json({ error: 'Invalid messageId.' });
        const message = await db.collection('messages').findOne({ _id: messageId });
        if (!message) return res.status(404).json({ error: 'Message not found.' });

        // people can only report what they could see: public rooms, or private chats they are in
        const chat = await db.collection('chats').findOne({ _id: message.chatID });
        const canSee = chat && (chat.type === 'room' || (chat.participants ?? []).some((id) => String(id) === String(me)));
        if (!canSee) return res.status(404).json({ error: 'Message not found.' });
        if (String(message.userID) === String(me)) return res.status(400).json({ error: "You can't report yourself." });

        if (await reports.findOne({ reporterId: me, messageId })) return res.status(409).json({ error: 'You already reported this message.' });
        Object.assign(report, {
            messageId,
            chatId: message.chatID,
            reportedUserId: message.userID,
            reportedUsername: message.username,
            textSnapshot: message.body,
        });
    } else if (req.body.userId !== undefined) {
        const userId = toObjectId(req.body.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid userId.' });
        if (String(userId) === String(me)) return res.status(400).json({ error: "You can't report yourself." });
        const user = await db.collection('users').findOne({ _id: userId });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (await reports.findOne({ reporterId: me, reportedUserId: userId, messageId: { $exists: false }, status: 'open' })) {
            return res.status(409).json({ error: 'You already reported this person.' });
        }
        Object.assign(report, { reportedUserId: userId, reportedUsername: user.username });
    } else {
        return res.status(400).json({ error: 'Send a messageId or a userId.' });
    }

    report._id = (await reports.insertOne(report)).insertedId;
    res.status(201).json(report);
});

module.exports = createReport;
