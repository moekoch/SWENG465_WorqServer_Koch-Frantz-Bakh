const { getDB } = require('../../../services/database');
const { GAMES, summarize, summarizeByGame } = require('../../../services/gameResults');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/games/scores/bots:
 *   get:
 *     summary: My record against bots
 *     description: Overall, for each game, and for each bot played.
 *     tags: [Score]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: game
 *         schema:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *       - in: query
 *         name: botId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The record
 *       400:
 *         description: Invalid game or bot id
 *       401:
 *         description: Not logged in
 */
const getBotScore = route('Failed to retrieve bot score.', async (req, res) => {
    const { game, botId } = req.query;
    if (game !== undefined && !GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });

    const filter = { userId: req.user._id, opponentType: 'bot', ...(game && { game }) };
    if (botId !== undefined) {
        const id = toObjectId(botId);
        if (!id) return res.status(400).json({ error: 'Invalid botId.' });
        filter.botId = id;
    }

    const db = getDB();
    const results = await db.collection('game_results').find(filter).limit(5000).toArray();
    const bots = await db.collection('bots').find({}).toArray();
    const byBot = bots
        .map((bot) => ({ botId: String(bot._id), name: bot.name, ...summarize(results.filter((result) => String(result.botId) === String(bot._id))) }))
        .filter((entry) => entry.played > 0);
    res.status(200).json({ ...summarizeByGame(results), byBot });
});

module.exports = getBotScore;
