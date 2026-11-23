const { getDB } = require('../../../services/database');
const { refreshBlocks } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/blocks/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Block]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unblocked
 *       400:
 *         description: Invalid user id
 *       401:
 *         description: Not logged in
 *       404:
 *         description: That user is not blocked
 */
const deleteBlock = route('Failed to unblock user.', async (req, res) => {
    const blockedId = toObjectId(req.params.userId);
    if (!blockedId) return res.status(400).json({ error: 'Invalid user ID.' });

    const result = await getDB().collection('blocks').deleteOne({ blockerId: req.user._id, blockedId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'That user is not blocked.' });

    await refreshBlocks(req.user._id);
    res.status(200).json({ message: 'User unblocked successfully.' });
});

module.exports = deleteBlock;
