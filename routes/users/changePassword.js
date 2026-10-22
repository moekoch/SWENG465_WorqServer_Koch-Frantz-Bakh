const bcrypt = require('bcrypt');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/users/me/password:
 *   patch:
 *     summary: Change the logged-in user's password
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Missing fields or new password too short
 *       401:
 *         description: Not logged in, or current password is wrong
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });
        }

        // load has as req.user is stripped
        const users = getDB().collection('users');
        const user = await users.findOne({ _id: req.user._id });

        const ok = user?.passwordHash && (await bcrypt.compare(currentPassword, user.passwordHash));
        if (!ok) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        // store new hash
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await users.updateOne({ _id: user._id }, { $set: { passwordHash } });

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password.' });
    }
}

module.exports = changePassword;