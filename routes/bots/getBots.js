const { getDB } = require('../../services/database');
const { GAMES } = require('../../services/gameResults');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/bots:
 *   get:
 *     summary: Get all bots
 *     tags: [Bot]
 *     parameters:
 *       - in: query
 *         name: gameType
 *         schema:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *     responses:
 *       200:
 *         description: A list of bots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bot'
 *       400:
 *         description: Invalid gameType
 */
const getBots = route('Failed to retrieve bots.', async (req, res) => {
    const { gameType } = req.query;
    if (gameType !== undefined && !GAMES.includes(gameType)) return res.status(400).json({ error: `gameType must be one of: ${GAMES.join(', ')}.` });
    res.status(200).json(await getDB().collection('bots').find(gameType ? { gameType } : {}).sort({ name: 1 }).toArray());
});

module.exports = getBots;
