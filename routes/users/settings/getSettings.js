const { settingsOf } = require('../../../services/settings');

/**
 * @swagger
 * /api/users/me/settings:
 *   get:
 *     summary: Get my settings
 *     description: Returns the logged-in user's comfort and privacy settings, with defaults filled in for anything not set yet.
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Settings'
 *       401:
 *         description: Not logged in
 */
function getSettings(req, res) {
    res.status(200).json(settingsOf(req.user));
}

module.exports = getSettings;
