const { getDB } = require('../../services/database');
const { removeUserData } = require('../../services/accountCleanup');
const { disconnectUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete any user (admin)
 *     description: Removes the account and everything that belonged to it. Users delete their own account with DELETE /api/users/me.
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       400:
 *         description: Invalid user ID, or trying to delete yourself here
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: User not found
 */
const deleteUserById = route('Failed to delete user.', async (req, res) => {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });
    if (String(userId) === String(req.user._id)) {
        return res.status(400).json({ error: 'Use DELETE /api/users/me to delete your own account.' });
    }

    const result = await getDB().collection('users').deleteOne({ _id: userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found.' });

    await removeUserData(userId);
    disconnectUser(userId);
    res.status(200).json({ message: 'User deleted successfully.' });
});

module.exports = deleteUserById;
