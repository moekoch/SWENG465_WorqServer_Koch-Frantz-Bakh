const { getAccessibleChat, publicMessage } = require('../../../services/chatAccess');
const { submitMessage } = require('../../../services/chat');
const { isBlockedEitherWay } = require('../../../services/social');
const { emitToUser } = require('../../../services/socket');
const { route } = require('../../../services/http');

// how each refusal is sent back
const STATUS_FOR_CODE = { MODERATED: 400, INVALID: 400, MUTED: 403, RATE_LIMITED: 429 };

/**
 * @swagger
 * /api/chats/{chatID}/messages:
 *   post:
 *     summary: Send a message to a direct or group chat
 *     description: The message is checked first. Swearing, hate speech, threats, bullying, links and personal info are refused, and repeated problems start a short chat break. The sender is always the logged-in user. Public rooms use the live connection (the chat:send socket event) instead.
 *     tags: [Message]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: chatID
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
 *                 maxLength: 300
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid chat ID, empty or too long, or refused by the filter (code MODERATED)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationError'
 *       401:
 *         description: Not logged in
 *       403:
 *         description: On a chat break (code MUTED), or the other person blocked you
 *       404:
 *         description: Chat not found
 *       429:
 *         description: Sending too fast
 */
const createMessage = route('Failed to create message.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.chatID);
    if (error) return res.status(status).json({ error });
    if (chat.type === 'room') {
        return res.status(400).json({ error: 'Public rooms use the live chat connection.' });
    }

    const { body } = req.body ?? {};
    if (typeof body !== 'string' || !body.trim()) {
        return res.status(400).json({ error: 'Message body is required.', code: 'INVALID' });
    }

    // nobody can message someone they blocked or who blocked them
    if (chat.type === 'direct') {
        const other = chat.participants.find((id) => String(id) !== String(req.user._id));
        if (other && await isBlockedEitherWay(req.user._id, other)) {
            return res.status(403).json({ error: "You can't message this person." });
        }
    }

    const result = await submitMessage({ user: req.user, chat, text: body });
    if (!result.ok) {
        return res.status(STATUS_FOR_CODE[result.code] ?? 400).json({
            error: result.error,
            code: result.code,
            ...(result.until && { until: result.until }),
        });
    }

    // live delivery to the other people in the chat
    const message = publicMessage(result.message);
    for (const participant of chat.participants) {
        if (String(participant) !== String(req.user._id)) emitToUser(participant, 'chat:private', { chatId: String(chat._id), message });
    }
    res.status(201).json(message);
});

module.exports = createMessage;
