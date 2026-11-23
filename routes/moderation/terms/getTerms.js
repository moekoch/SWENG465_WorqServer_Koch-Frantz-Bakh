const { getDB } = require('../../../services/database');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/terms:
 *   get:
 *     summary: List the custom blocked and allowed words (moderators)
 *     tags: [Term]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [block, allow]
 *     responses:
 *       200:
 *         description: A list of words
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Term'
 *       400:
 *         description: Invalid type
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 */
const getTerms = route('Failed to retrieve words.', async (req, res) => {
    const { type } = req.query;
    if (type !== undefined && !['block', 'allow'].includes(type)) return res.status(400).json({ error: 'type must be block or allow.' });
    res.status(200).json(await getDB().collection('moderation_terms').find(type ? { type } : {}).sort({ term: 1 }).toArray());
});

module.exports = getTerms;
