const { getDB } = require('../../../services/database');
const { DEFAULT_TANK } = require('../../../services/tank');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/tank:
 *   delete:
 *     summary: Reset my tank
 *     description: Takes all decor out and puts the fish back to its default look.
 *     tags: [Tank]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The default tank
 *       401:
 *         description: Not logged in
 */
const deleteTank = route('Failed to reset tank.', async (req, res) => {
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $unset: { tank: '' } });
    res.status(200).json({ ...DEFAULT_TANK, layout: {} });
});

module.exports = deleteTank;
