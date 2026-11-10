const { readWallet } = require('../../services/shop');

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the logged-in user's profile
 *     description: Returns the user's info, points, owned avatars, and equipped avatar
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Profile
 *       401:
 *         description: Not logged in
 */
async function getMe(req, res) {
    // requireAuth already loaded user from token
    const user = req.user;

    res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        avatarId: user.avatarId ? String(user.avatarId) : null,
        ...readWallet(user),
    });
}

module.exports = getMe;