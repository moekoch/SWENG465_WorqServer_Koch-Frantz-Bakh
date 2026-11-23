const { getDB } = require('../../../services/database');
const { GAMES, summarize } = require('../../../services/gameResults');
const { friendIdsOf, publicProfiles } = require('../../../services/social');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/games/scores/friends:
 *   get:
 *     summary: Leaderboard of me and my friends
 *     description: Everyone ranked by wins (then by win rate), counting all of their games or just one game.
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
 *         description: A ranked list
 *       400:
 *         description: Invalid game
 *       401:
 *         description: Not logged in
 */
const getFriendScore = route('Failed to retrieve friend scores.', async (req, res) => {
    const { game } = req.query;
    if (game !== undefined && !GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });

    const ids = [req.user._id, ...await friendIdsOf(req.user._id)];
    const results = await getDB().collection('game_results').find({ userId: { $in: ids }, ...(game && { game }) }).limit(20000).toArray();
    const profiles = await publicProfiles(ids);

    const board = ids
        .map((id) => ({
            ...profiles.get(String(id)),
            ...summarize(results.filter((result) => String(result.userId) === String(id))),
        }))
        .filter((entry) => entry.id)
        .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.username.localeCompare(b.username))
        .map((entry, index) => ({ rank: index + 1, ...entry }));
    res.status(200).json(board);
});

module.exports = getFriendScore;
