const { getDB } = require('../../services/database');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/bots/{id}:
 *   delete:
 *     summary: Delete a bot (admins)
 *     tags: [Bot]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bot deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Bot not found
 */
const deleteBot = route('Failed to delete bot.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid bot ID.' });
    const result = await getDB().collection('bots').deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Bot not found.' });
    res.status(200).json({ message: 'Bot deleted successfully.' });
});

module.exports = deleteBot;
