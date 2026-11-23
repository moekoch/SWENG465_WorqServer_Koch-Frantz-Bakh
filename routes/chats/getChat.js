const { getAccessibleChat } = require('../../services/chatAccess');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/chats/{id}:
 *   get:
 *     summary: Get a chat
 *     description: Public rooms are open to everyone. Direct and group chats only to the people in them.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Chat not found
 */
const getChat = route('Failed to retrieve chat.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.id);
    if (error) return res.status(status).json({ error });
    res.status(200).json(chat);
});

module.exports = getChat;
