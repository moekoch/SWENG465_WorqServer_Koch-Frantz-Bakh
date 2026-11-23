const { getDB } = require('../../services/database');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: List my chats
 *     description: Returns the public rooms plus the direct and group chats the logged-in user is in, most recently active first.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [room, direct, group]
 *     responses:
 *       200:
 *         description: A list of chats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Invalid type
 *       401:
 *         description: Not logged in
 */
const getChats = route('Failed to retrieve chats.', async (req, res) => {
    const { type } = req.query;
    if (type !== undefined && !['room', 'direct', 'group'].includes(type)) {
        return res.status(400).json({ error: 'type must be room, direct, or group.' });
    }

    const filter = { $or: [{ type: 'room' }, { participants: req.user._id }], ...(type && { type }) };
    const results = await getDB().collection('chats').find(filter).sort({ updatedAt: -1, createdAt: -1 }).toArray();
    res.status(200).json(results);
});

module.exports = getChats;
