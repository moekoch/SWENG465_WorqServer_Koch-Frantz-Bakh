const { getDB } = require('../../../services/database');
const { reloadCustomTerms } = require('../../../services/moderationStore');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/terms:
 *   post:
 *     summary: Add a blocked or allowed word (admins)
 *     description: block words are refused in chat and names (also when spelled with symbols or spaces). allow words are never counted as a problem, for example a place name the built-in filter trips on. Takes effect immediately.
 *     tags: [Term]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [term, type]
 *             properties:
 *               term:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [block, allow]
 *     responses:
 *       201:
 *         description: Word added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Term'
 *       400:
 *         description: Invalid term or type
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       409:
 *         description: That word is already on the list
 */
const createTerm = route('Failed to add word.', async (req, res) => {
    const { term, type } = req.body ?? {};
    if (typeof term !== 'string' || term.trim().length < 2 || term.trim().length > 40) {
        return res.status(400).json({ error: 'term must be 2 to 40 characters.' });
    }
    if (!['block', 'allow'].includes(type)) return res.status(400).json({ error: 'type must be block or allow.' });

    const terms = getDB().collection('moderation_terms');
    const clean = term.trim().toLowerCase();
    if (await terms.findOne({ term: clean, type })) return res.status(409).json({ error: 'That word is already on the list.' });

    const entry = { term: clean, type, createdBy: req.user._id, createdAt: new Date() };
    entry._id = (await terms.insertOne(entry)).insertedId;
    await reloadCustomTerms();
    res.status(201).json(entry);
});

module.exports = createTerm;
