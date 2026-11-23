const { getDB } = require('../../../services/database');
const { validateSettings, settingsOf } = require('../../../services/settings');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/settings:
 *   patch:
 *     summary: Change some of my settings
 *     description: Saves only the settings that are sent and leaves the rest as they were.
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Settings'
 *     responses:
 *       200:
 *         description: All of the user's settings after the change
 *       400:
 *         description: Nothing to change, unknown setting, or invalid value
 *       401:
 *         description: Not logged in
 */
const patchSettings = route('Failed to save settings.', async (req, res) => {
    const { settings, error } = validateSettings(req.body);
    if (error) return res.status(400).json({ error });

    const merged = { ...settingsOf(req.user), ...settings };
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $set: { settings: merged } });
    res.status(200).json(merged);
});

module.exports = patchSettings;
