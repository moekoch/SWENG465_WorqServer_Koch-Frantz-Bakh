const { getDB } = require('../../services/database');
const { disconnectUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Make someone a moderator or admin (admins)
 *     tags: [Moderation]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, moderator, admin]
 *     responses:
 *       200:
 *         description: The updated user
 *       400:
 *         description: Invalid ID or role, or changing your own role
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: User not found
 */
const setUserRole = route('Failed to change role.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
    const { role } = req.body ?? {};
    if (!['user', 'moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user, moderator, or admin.' });
    if (String(id) === String(req.user._id)) return res.status(400).json({ error: "You can't change your own role." });

    const users = getDB().collection('users');
    const result = await users.updateOne({ _id: id }, { $set: { role } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'User not found.' });

    // reconnect so the new role applies to the live connection
    disconnectUser(id);
    res.status(200).json(await users.findOne({ _id: id }, { projection: { passwordHash: 0 } }));
});

module.exports = setUserRole;
