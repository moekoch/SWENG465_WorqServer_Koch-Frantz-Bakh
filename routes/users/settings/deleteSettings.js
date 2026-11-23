const { getDB } = require('../../../services/database');
const { DEFAULT_SETTINGS } = require('../../../services/settings');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/settings:
 *   delete:
 *     summary: Reset my settings
 *     description: Puts every setting back to its default.
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The default settings
 *       401:
 *         description: Not logged in
 */
const deleteSettings = route('Failed to reset settings.', async (req, res) => {
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $unset: { settings: '' } });
    res.status(200).json({ ...DEFAULT_SETTINGS });
});

module.exports = deleteSettings;
