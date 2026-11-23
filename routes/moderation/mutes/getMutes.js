const { getDB } = require('../../../services/database');
const { route, toObjectId, paging } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/mutes:
 *   get:
 *     summary: List chat breaks (moderators)
 *     tags: [Mute]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: active
 *         description: true = only breaks still running
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: userId
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
 *         description: A list of chat breaks, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Mute'
 *       400:
 *         description: Invalid user id
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 */
const getMutes = route('Failed to retrieve chat breaks.', async (req, res) => {
    const filter = {};
    if (req.query.active === 'true') Object.assign(filter, { until: { $gt: new Date() }, liftedAt: { $exists: false } });
    if (req.query.userId !== undefined) {
        const userId = toObjectId(req.query.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid userId.' });
        filter.userId = userId;
    }
    const { limit, skip } = paging(req.query);
    res.status(200).json(await getDB().collection('mutes').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray());
});

module.exports = getMutes;
