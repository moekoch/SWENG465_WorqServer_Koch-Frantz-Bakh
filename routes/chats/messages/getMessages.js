const { getDB } = require('../../../services/database');
const { getAccessibleChat, publicMessage } = require('../../../services/chatAccess');
const { blockedIdsOf } = require('../../../services/social');
const { isStaff } = require('../../../services/auth');
const { route, toObjectId, paging } = require('../../../services/http');

/**
 * @swagger
 * /api/chats/{chatID}/messages:
 *   get:
 *     summary: Get the messages in a chat
 *     description: Returns recent messages oldest first, so a chat can be loaded when it opens. Messages from people you blocked are left out, and so are messages a moderator removed.
 *     tags: [Message]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: chatID
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 50
 *       - in: query
 *         name: before
 *         description: A message id. Only messages older than it are returned (for loading earlier ones).
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid chat or message ID
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Chat not found
 */
const getMessages = route('Failed to retrieve messages.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.chatID);
    if (error) return res.status(status).json({ error });

    const { limit } = paging(req.query, { defaultLimit: 30, maxLimit: 50 });
    const messages = getDB().collection('messages');
    const filter = { chatID: chat._id };

    if (req.query.before !== undefined) {
        const beforeId = toObjectId(req.query.before);
        if (!beforeId) return res.status(400).json({ error: 'Invalid before message ID.' });
        const anchor = await messages.findOne({ _id: beforeId, chatID: chat._id });
        if (anchor) filter.sentAt = { $lt: anchor.sentAt };
    }

    // hide people the user blocked, and messages moderators removed (moderators still see those, marked)
    const staff = isStaff(req.user);
    const blocked = [...await blockedIdsOf(req.user._id)].map(toObjectId).filter(Boolean);
    if (blocked.length) filter.userID = { $nin: blocked };
    if (!staff) filter.removedAt = { $exists: false };

    const newestFirst = await messages.find(filter).sort({ sentAt: -1 }).limit(limit).toArray();
    res.status(200).json(newestFirst.reverse().map((message) => publicMessage(message, { staff })));
});

module.exports = getMessages;
