const { getDB } = require('../../../services/database');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/games/results/{id}:
 *   delete:
 *     summary: Delete a game result
 *     description: Players can delete their own results. Moderators can delete anyone's.
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
 *         description: Result deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Result not found
 */
const deleteResult = route('Failed to delete result.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid result ID.' });

    const filter = isStaff(req.user) ? { _id: id } : { _id: id, userId: req.user._id };
    const result = await getDB().collection('game_results').deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Result not found.' });
    res.status(200).json({ message: 'Result deleted successfully.' });
});

module.exports = deleteResult;
