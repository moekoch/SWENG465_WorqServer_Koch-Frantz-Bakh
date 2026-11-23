const { getDB } = require('../../services/database');
const { validateBot } = require('../../services/bots');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/bots:
 *   post:
 *     summary: Create a bot (admins)
 *     tags: [Bot]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Bot'
 *     responses:
 *       201:
 *         description: Bot created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bot'
 *       400:
 *         description: Missing or invalid fields
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       409:
 *         description: A bot with that name already exists
 */
const createBot = route('Failed to create bot.', async (req, res) => {
    const { bot, error } = validateBot(req.body, { requireAll: true });
    if (error) return res.status(400).json({ error });

    const bots = getDB().collection('bots');
    if (await bots.findOne({ name: bot.name })) return res.status(409).json({ error: 'A bot with that name already exists.' });

    const newBot = { difficulty: 'medium', ...bot, createdAt: new Date() };
    newBot._id = (await bots.insertOne(newBot)).insertedId;
    res.status(201).json(newBot);
});

module.exports = createBot;
