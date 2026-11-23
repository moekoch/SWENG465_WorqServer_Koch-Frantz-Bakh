const { getDB } = require('../../../services/database');
const { getAccessibleChat } = require('../../../services/chatAccess');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/chats/{chatID}/messages/{messageID}:
 *   delete:
 *     summary: Delete a message
 *     description: Authors delete their own messages. Moderators and admins can remove anyone's message; it disappears for everyone but is kept for the moderation record.
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
 *         description: Message deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not your message
 *       404:
 *         description: Message not found
 */
const deleteMessage = route('Failed to delete message.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.chatID);
    if (error) return res.status(status).json({ error });
    const messageId = toObjectId(req.params.messageID);
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID.' });

    const messages = getDB().collection('messages');
    const message = await messages.findOne({ _id: messageId, chatID: chat._id });
    if (!message || message.removedAt) return res.status(404).json({ error: 'Message not found.' });

    const isAuthor = String(message.userID) === String(req.user._id);
    if (isAuthor) {
        await messages.deleteOne({ _id: messageId });
    } else if (isStaff(req.user)) {
        await messages.updateOne({ _id: messageId }, { $set: { removedAt: new Date(), removedBy: req.user._id } });
    } else {
        return res.status(403).json({ error: 'You can only delete your own messages.' });
    }
    res.status(200).json({ message: 'Message deleted successfully.' });
});

module.exports = deleteMessage;
