const { checkName } = require('../../services/moderationStore');
const { ROOM_MESSAGE_LENGTH } = require('../../services/chat');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/moderation/check:
 *   post:
 *     summary: Check text against the chat filter
 *     description: Tells an app whether some text would be allowed, without sending or recording anything (so nobody gets a strike for asking). Useful for checking a name before saving it.
 *     tags: [Moderation]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *               kind:
 *                 type: string
 *                 enum: [chat, name, username]
 *                 default: chat
 *     responses:
 *       200:
 *         description: The result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 allowed:
 *                   type: boolean
 *                 text:
 *                   type: string
 *                   description: The tidied text that would be shown
 *                 reason:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Missing text or invalid kind
 *       401:
 *         description: Not logged in
 */
const checkText = route('Failed to check text.', async (req, res) => {
    const { text, kind = 'chat' } = req.body ?? {};
    if (typeof text !== 'string') return res.status(400).json({ error: 'text is required.' });
    if (!['chat', 'name', 'username'].includes(kind)) return res.status(400).json({ error: 'kind must be chat, name, or username.' });

    const result = await checkName(text, { kind, maxLength: kind === 'chat' ? ROOM_MESSAGE_LENGTH : kind === 'username' ? 20 : 40 });
    res.status(200).json({ allowed: result.allowed, text: result.text, reason: result.reason });
});

module.exports = checkText;
