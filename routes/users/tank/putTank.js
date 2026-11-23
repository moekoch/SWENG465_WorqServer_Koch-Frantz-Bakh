const { getDB } = require('../../../services/database');
const { DEFAULT_TANK, tankOf, validateTank } = require('../../../services/tank');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/tank:
 *   put:
 *     summary: Replace my tank
 *     description: Saves a whole tank. Anything left out goes back to its default. Decor must be owned.
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
 *         description: The saved tank
 *       400:
 *         description: Invalid fields, too much decor, or decor the user does not own
 *       401:
 *         description: Not logged in
 */
const putTank = route('Failed to save tank.', async (req, res) => {
    const { tank, error } = await validateTank(req.body, req.user);
    if (error) return res.status(400).json({ error });

    const complete = { ...DEFAULT_TANK, ...tank };
    await getDB().collection('users').updateOne({ _id: req.user._id }, { $set: { tank: complete } });
    res.status(200).json(tankOf({ tank: complete }));
});

module.exports = putTank;
