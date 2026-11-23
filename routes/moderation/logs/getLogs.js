const { getDB } = require('../../../services/database');
const { route, toObjectId, paging } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/logs:
 *   get:
 *     summary: See blocked messages (moderators)
 *     description: Every message the filter refused, with who sent it, what kind of problem it was, and where. Entries are removed automatically after 90 days.
 *     tags: [Moderation]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [hate, threat, harassment, sexual, privacy, profanity, spam]
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
 *         description: A list of blocked messages, newest first
 *       400:
 *         description: Invalid user id
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 */
const getLogs = route('Failed to retrieve moderation log.', async (req, res) => {
    const filter = {};
    if (req.query.userId !== undefined) {
        const userId = toObjectId(req.query.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid userId.' });
        filter.userId = userId;
    }
    if (typeof req.query.category === 'string') filter.categories = req.query.category;
    const { limit, skip } = paging(req.query);
    res.status(200).json(await getDB().collection('moderation_logs').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray());
});

module.exports = getLogs;
