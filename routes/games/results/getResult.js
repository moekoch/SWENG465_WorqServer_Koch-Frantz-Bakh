const { getDB } = require('../../../services/database');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/games/results/{id}:
 *   get:
 *     summary: Get one game result
 *     tags: [Game]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResult'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Result not found
 */
const getResult = route('Failed to retrieve result.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid result ID.' });
    const result = await getDB().collection('game_results').findOne({ _id: id });
    if (!result || (String(result.userId) !== String(req.user._id) && !isStaff(req.user))) {
        return res.status(404).json({ error: 'Result not found.' });
    }
    res.status(200).json(result);
});

module.exports = getResult;
