const { getDB } = require('../../../services/database');
const { GAMES, OUTCOMES } = require('../../../services/gameResults');
const { route, toObjectId } = require('../../../services/http');

// at least this long between two results for the same game (stops a script from stacking wins)
const MIN_SECONDS_BETWEEN_RESULTS = 5;

/**
 * @swagger
 * /api/games/results:
 *   post:
 *     summary: Record the result of a game against a bot
 *     description: Saves a finished game for the logged-in user. Only games against a bot can be reported by the app; matches between two people are recorded by the server.
 *     tags: [Game]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [game, outcome]
 *             properties:
 *               game:
 *                 type: string
 *                 enum: [go-fish, blackjack, spades]
 *               outcome:
 *                 type: string
 *                 enum: [win, loss, draw]
 *               botId:
 *                 type: string
 *               score:
 *                 type: number
 *     responses:
 *       201:
 *         description: Result saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResult'
 *       400:
 *         description: Invalid fields
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Bot not found
 *       429:
 *         description: Results are coming in too fast
 */
const createResult = route('Failed to save result.', async (req, res) => {
    const { game, outcome, botId, score } = req.body ?? {};
    if (!GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });
    if (!OUTCOMES.includes(outcome)) return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(', ')}.` });
    if (score !== undefined && !Number.isFinite(score)) return res.status(400).json({ error: 'score must be a number.' });
    if (req.body.opponentType !== undefined && req.body.opponentType !== 'bot') {
        return res.status(400).json({ error: 'Only games against a bot can be reported. Matches between people are recorded by the server.' });
    }

    const db = getDB();
    const results = db.collection('game_results');
    const result = { userId: req.user._id, game, outcome, opponentType: 'bot', source: 'client', createdAt: new Date() };
    if (score !== undefined) result.score = score;

    if (botId !== undefined) {
        const id = toObjectId(botId);
        if (!id) return res.status(400).json({ error: 'Invalid botId.' });
        const bot = await db.collection('bots').findOne({ _id: id });
        if (!bot) return res.status(404).json({ error: 'Bot not found.' });
        result.botId = id;
    }

    const last = await results.find({ userId: req.user._id, game }).sort({ createdAt: -1 }).limit(1).toArray();
    if (last[0] && Date.now() - new Date(last[0].createdAt).getTime() < MIN_SECONDS_BETWEEN_RESULTS * 1000) {
        return res.status(429).json({ error: 'Please wait a moment before saving another result.' });
    }

    result._id = (await results.insertOne(result)).insertedId;
    res.status(201).json(result);
});

module.exports = createResult;
