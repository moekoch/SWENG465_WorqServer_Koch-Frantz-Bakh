const { getDB } = require('../../services/database');
const { validateBot } = require('../../services/bots');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/bots/{id}:
 *   put:
 *     summary: Update a bot (admins)
 *     tags: [Bot]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Bot'
 *     responses:
 *       200:
 *         description: The updated bot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bot'
 *       400:
 *         description: No fields or invalid values
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Bot not found
 *       409:
 *         description: A bot with that name already exists
 */
const updateBot = route('Failed to update bot.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid bot ID.' });
    const { bot, error } = validateBot(req.body, { requireAll: false });
    if (error) return res.status(400).json({ error });

    const bots = getDB().collection('bots');
    if (bot.name && await bots.findOne({ _id: { $ne: id }, name: bot.name })) return res.status(409).json({ error: 'A bot with that name already exists.' });

    const result = await bots.updateOne({ _id: id }, { $set: bot });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Bot not found.' });
    res.status(200).json(await bots.findOne({ _id: id }));
});

module.exports = updateBot;
