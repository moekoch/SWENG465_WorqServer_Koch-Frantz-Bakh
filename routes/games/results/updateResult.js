const { getDB } = require('../../../services/database');
const { OUTCOMES } = require('../../../services/gameResults');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/games/results/{id}:
 *   put:
 *     summary: Correct a game result (moderators)
 *     description: Results can't be edited by the player. Moderators can fix the outcome or score, for example after a bug.
 *     tags: [Game]
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
 *               outcome:
 *                 type: string
 *                 enum: [win, loss, draw]
 *               score:
 *                 type: number
 *     responses:
 *       200:
 *         description: The updated result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResult'
 *       400:
 *         description: No fields or invalid values
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Result not found
 */
const updateResult = route('Failed to update result.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid result ID.' });
    const { outcome, score } = req.body ?? {};
    if (outcome === undefined && score === undefined) return res.status(400).json({ error: 'At least one field must be provided.' });
    if (outcome !== undefined && !OUTCOMES.includes(outcome)) return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(', ')}.` });
    if (score !== undefined && !Number.isFinite(score)) return res.status(400).json({ error: 'score must be a number.' });

    const updates = { correctedBy: req.user._id, correctedAt: new Date() };
    if (outcome !== undefined) updates.outcome = outcome;
    if (score !== undefined) updates.score = score;

    const results = getDB().collection('game_results');
    const found = await results.updateOne({ _id: id }, { $set: updates });
    if (found.matchedCount === 0) return res.status(404).json({ error: 'Result not found.' });
    res.status(200).json(await results.findOne({ _id: id }));
});

module.exports = updateResult;
