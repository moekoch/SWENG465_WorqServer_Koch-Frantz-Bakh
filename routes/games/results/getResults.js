const { getDB } = require('../../../services/database');
const { GAMES, OUTCOMES } = require('../../../services/gameResults');
const { route, paging } = require('../../../services/http');

/**
 * @swagger
 * /api/games/results:
 *   get:
 *     summary: List my game results
 *     description: The logged-in user's finished games, newest first.
 *     tags: [Game]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: game
 *         schema:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *       - in: query
 *         name: outcome
 *         schema:
 *           type: string
 *           enum: [win, loss, draw]
 *       - in: query
 *         name: opponentType
 *         schema:
 *           type: string
 *           enum: [bot, user]
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
 *         description: A list of results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GameResult'
 *       400:
 *         description: Invalid filter
 *       401:
 *         description: Not logged in
 */
const getResults = route('Failed to retrieve results.', async (req, res) => {
    const { game, outcome, opponentType } = req.query;
    if (game !== undefined && !GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });
    if (outcome !== undefined && !OUTCOMES.includes(outcome)) return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(', ')}.` });
    if (opponentType !== undefined && !['bot', 'user'].includes(opponentType)) return res.status(400).json({ error: 'opponentType must be bot or user.' });

    const filter = { userId: req.user._id, ...(game && { game }), ...(outcome && { outcome }), ...(opponentType && { opponentType }) };
    const { limit, skip } = paging(req.query);
    res.status(200).json(await getDB().collection('game_results').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray());
});

module.exports = getResults;
