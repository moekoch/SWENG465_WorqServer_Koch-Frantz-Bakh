const bcrypt = require('bcrypt');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/users/me:
 *   delete:
 *     summary: Delete the logged-in user's account
 *     description: Deletes the user the token belongs to. The password must be sent to confirm.
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Missing password
 *       401:
 *         description: Not logged in, or incorrect password
 *       500:
 *         description: Internal server error, failed to delete user
 */
const deleteUser = async (req, res) => {
    try {
        const { password } = req.body || {};
 
        // password is required to confirm the delete
        if (!password) {
            return res.status(400).json({ error: 'Password is required.' });
        }
 
        // account to delete comes from token
        const users = getDB().collection('users');
        const user = await users.findOne({ _id: req.user._id });
 
        // check password against stored hash
        const ok = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }
 
        // delete user
        await users.deleteOne({ _id: user._id });
 
        // send ok status and message of success
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
};

module.exports = deleteUser;