const { getDB } = require('../../../services/database');
const { tankOf, validateTank } = require('../../../services/tank');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/tank:
 *   patch:
 *     summary: Change part of my tank
 *     description: Saves only the fields that are sent. If layout is sent it replaces the whole layout.
 *     tags: [Tank]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Tank'
 *     responses:
 *       200:
 *         description: The tank after the change
 *       400:
 *         description: Nothing to change, invalid fields, or decor the user does not own
 *       401:
 *         description: Not logged in
 */
const patchTank = route('Failed to save tank.', async (req, res) => {
    const { tank, error } = await validateTank(req.body, req.user);
    if (error) return res.status(400).json({ error });

    const merged = { ...tankOf(req.user), ...tank };
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $set: { tank: merged } });
    res.status(200).json(merged);
});

module.exports = patchTank;
