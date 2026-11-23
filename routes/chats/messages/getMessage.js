const { getDB } = require('../../../services/database');
const { getAccessibleChat, publicMessage } = require('../../../services/chatAccess');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/chats/{chatID}/messages/{messageID}:
 *   get:
 *     summary: Get a message
 *     tags: [Message]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: chatID
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: messageID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Message not found
 */
const getMessage = route('Failed to retrieve message.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.chatID);
    if (error) return res.status(status).json({ error });
    const messageId = toObjectId(req.params.messageID);
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID.' });

    const message = await getDB().collection('messages').findOne({ _id: messageId, chatID: chat._id });
    // moderator-removed messages look deleted to everyone else
    if (!message || (message.removedAt && !isStaff(req.user))) {
        return res.status(404).json({ error: 'Message not found.' });
    }
    res.status(200).json(publicMessage(message, { staff: isStaff(req.user) }));
});

module.exports = getMessage;
