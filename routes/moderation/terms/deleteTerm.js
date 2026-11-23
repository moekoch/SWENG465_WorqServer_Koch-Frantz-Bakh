const { getDB } = require('../../../services/database');
const { reloadCustomTerms } = require('../../../services/moderationStore');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/terms/{id}:
 *   delete:
 *     summary: Remove a custom word (admins)
 *     tags: [Term]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Word removed
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Not found
 */
const deleteTerm = route('Failed to remove word.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID.' });
    const result = await getDB().collection('moderation_terms').deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Word not found.' });
    await reloadCustomTerms();
    res.status(200).json({ message: 'Word removed successfully.' });
});

module.exports = deleteTerm;
