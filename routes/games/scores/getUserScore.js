const { getDB } = require('../../../services/database');
const { GAMES, summarizeByGame } = require('../../../services/gameResults');
const { isBlockedEitherWay, publicProfiles } = require('../../../services/social');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/games/scores/me:
 *   get:
 *     summary: My win and loss record
 *     description: Overall and for each game, against bots and people together.
 *     tags: [Score]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: game
 *         schema:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *     responses:
 *       200:
 *         description: The record
 *       400:
 *         description: Invalid game
 *       401:
 *         description: Not logged in
 * /api/games/scores/users/{id}:
 *   get:
 *     summary: Another user's win and loss record
 *     tags: [Score]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: game
 *         schema:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *     responses:
 *       200:
 *         description: The record
 *       400:
 *         description: Invalid user ID or game
 *       401:
 *         description: Not logged in
 *       404:
 *         description: User not found
 */
const getUserScore = route('Failed to retrieve score.', async (req, res) => {
    const { game } = req.query;
    if (game !== undefined && !GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });

    // /me has no :id
    const userId = req.params.id === undefined ? req.user._id : toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    const profile = (await publicProfiles([userId])).get(String(userId));
    if (!profile || (String(userId) !== String(req.user._id) && await isBlockedEitherWay(req.user._id, userId))) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const results = await getDB().collection('game_results').find({ userId, ...(game && { game }) }).limit(5000).toArray();
    res.status(200).json({ user: profile, ...summarizeByGame(results) });
});

module.exports = getUserScore;
