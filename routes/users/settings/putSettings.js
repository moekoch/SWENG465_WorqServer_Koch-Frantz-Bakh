const { getDB } = require('../../../services/database');
const { DEFAULT_SETTINGS, validateSettings, settingsOf } = require('../../../services/settings');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/settings:
 *   put:
 *     summary: Replace my settings
 *     description: Saves a full set of settings. Any setting left out goes back to its default.
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
 *         description: The saved settings
 *       400:
 *         description: Unknown setting or invalid value
 *       401:
 *         description: Not logged in
 */
const putSettings = route('Failed to save settings.', async (req, res) => {
    const { settings, error } = validateSettings(req.body);
    if (error) return res.status(400).json({ error });

    const complete = { ...DEFAULT_SETTINGS, ...settings };
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $set: { settings: complete } });
    res.status(200).json(settingsOf({ settings: complete }));
});

module.exports = putSettings;
