const { getDB } = require('../../services/database');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/bots/{id}:
 *   get:
 *     summary: Get a bot
 *     tags: [Bot]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The bot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bot'
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Bot not found
 */
const getBot = route('Failed to retrieve bot.', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid bot ID.' });
    const bot = await getDB().collection('bots').findOne({ _id: id });
    if (!bot) return res.status(404).json({ error: 'Bot not found.' });
    res.status(200).json(bot);
});

module.exports = getBot;
