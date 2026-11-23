const { tankOf } = require('../../../services/tank');

/**
 * @swagger
 * /api/users/me/tank:
 *   get:
 *     summary: Get my tank
 *     description: Returns the logged-in user's fish colour and where their decor is placed.
 *     tags: [Tank]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The tank
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tank'
 *       401:
 *         description: Not logged in
 */
function getTank(req, res) {
    res.status(200).json(tankOf(req.user));
}

module.exports = getTank;
