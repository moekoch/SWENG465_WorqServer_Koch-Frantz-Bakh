const { getDB } = require('../../../services/database');
const { getAccessibleChat, publicMessage } = require('../../../services/chatAccess');
const { maxLengthFor } = require('../../../services/chat');
const { screenText } = require('../../../services/moderationStore');
const { route, toObjectId } = require('../../../services/http');

// how long after sending a message can be edited
const EDIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * @swagger
 * /api/chats/{chatID}/messages/{messageID}:
 *   put:
 *     summary: Edit my message
 *     description: Authors can edit their own message for 5 minutes after sending it. The new text goes through the same filter as a new message.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid ID, empty text, or refused by the filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationError'
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not your message, the edit window has passed, or you are on a chat break
 *       404:
 *         description: Message not found
 */
const updateMessage = route('Failed to update message.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.chatID);
    if (error) return res.status(status).json({ error });
    const messageId = toObjectId(req.params.messageID);
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID.' });

    const { body } = req.body ?? {};
    if (typeof body !== 'string' || !body.trim()) {
        return res.status(400).json({ error: 'Message body is required.', code: 'INVALID' });
    }

    const messages = getDB().collection('messages');
    const message = await messages.findOne({ _id: messageId, chatID: chat._id });
    if (!message || message.removedAt) return res.status(404).json({ error: 'Message not found.' });
    if (String(message.userID) !== String(req.user._id)) {
        return res.status(403).json({ error: 'You can only edit your own messages.' });
    }
    if (Date.now() - new Date(message.sentAt).getTime() > EDIT_WINDOW_MS) {
        return res.status(403).json({ error: 'Messages can only be edited for 5 minutes.' });
    }

    // edits are filtered like new messages (so a clean message can't be edited into a bad one)
    const screened = await screenText(req.user, body, {
        kind: 'chat',
        maxLength: maxLengthFor(chat),
        context: `edit:${chat.slug ?? chat._id}`,
    });
    if (!screened.ok) {
        return res.status(screened.code === 'MUTED' ? 403 : 400).json({
            error: screened.error,
            code: screened.code,
            ...(screened.until && { until: screened.until }),
        });
    }

    const editedAt = new Date();
    await messages.updateOne({ _id: messageId }, { $set: { body: screened.text, editedAt } });
    res.status(200).json(publicMessage({ ...message, body: screened.text, editedAt }));
});

module.exports = updateMessage;
