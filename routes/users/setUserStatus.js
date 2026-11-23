const { getDB } = require('../../services/database');
const { hasRole } = require('../../services/auth');
const { disconnectUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Suspend, ban, or restore an account (moderators)
 *     description: Suspended and banned accounts can't log in and are disconnected right away. Moderators can suspend regular users; only admins can ban, or act on staff.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended, banned]
 *     responses:
 *       200:
 *         description: The updated user
 *       400:
 *         description: Invalid ID or status, or acting on yourself
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not allowed
 *       404:
 *         description: User not found
 */
const setUserStatus = route('Failed to change account status.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
    const { status } = req.body ?? {};
    if (!['active', 'suspended', 'banned'].includes(status)) return res.status(400).json({ error: 'status must be active, suspended, or banned.' });
    if (String(id) === String(req.user._id)) return res.status(400).json({ error: "You can't change your own account status." });
    if (status === 'banned' && !hasRole(req.user, 'admin')) return res.status(403).json({ error: 'Only admins can ban accounts.' });

    const users = getDB().collection('users');
    const user = await users.findOne({ _id: id });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (['moderator', 'admin'].includes(user.role) && !hasRole(req.user, 'admin')) {
        return res.status(403).json({ error: 'Only admins can change the status of staff.' });
    }

    await users.updateOne({ _id: id }, { $set: { status } });
    if (status !== 'active') disconnectUser(id);
    res.status(200).json(await users.findOne({ _id: id }, { projection: { passwordHash: 0 } }));
});

module.exports = setUserStatus;
