const { getDB } = require('../../../services/database');
const { reloadCustomTerms } = require('../../../services/moderationStore');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/terms/{id}:
 *   put:
 *     summary: Change a custom word (admins)
 *     tags: [Term]
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
 *             properties:
 *               term:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [block, allow]
 *     responses:
 *       200:
 *         description: The updated word
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Term'
 *       400:
 *         description: Nothing to change, or invalid values
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Not found
 *       409:
 *         description: That word is already on the list
 */
const updateTerm = route('Failed to update word.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const { term, type } = req.body ?? {};
    if (term === undefined && type === undefined) return res.status(400).json({ error: 'At least one field must be provided.' });
    if (term !== undefined && (typeof term !== 'string' || term.trim().length < 2 || term.trim().length > 40)) {
        return res.status(400).json({ error: 'term must be 2 to 40 characters.' });
    }
    if (type !== undefined && !['block', 'allow'].includes(type)) return res.status(400).json({ error: 'type must be block or allow.' });

    const terms = getDB().collection('moderation_terms');
    const existing = await terms.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Word not found.' });

    const updates = {};
    if (term !== undefined) updates.term = term.trim().toLowerCase();
    if (type !== undefined) updates.type = type;
    const clash = await terms.findOne({ _id: { $ne: id }, term: updates.term ?? existing.term, type: updates.type ?? existing.type });
    if (clash) return res.status(409).json({ error: 'That word is already on the list.' });

    await terms.updateOne({ _id: id }, { $set: updates });
    await reloadCustomTerms();
    res.status(200).json({ ...existing, ...updates });
});

module.exports = updateTerm;
