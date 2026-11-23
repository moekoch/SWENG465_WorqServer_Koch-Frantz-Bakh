const { getDB } = require('../../services/database');
const { getAccessibleChat } = require('../../services/chatAccess');
const { hasRole } = require('../../services/auth');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/chats/{id}:
 *   delete:
 *     summary: Delete a chat and its messages
 *     description: Either person in a direct chat can delete it. A group chat can be deleted by the person who made it. Public rooms can only be deleted by admins.
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
 *         description: Chat deleted
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not allowed to delete this chat
 *       404:
 *         description: Chat not found
 */
const deleteChat = route('Failed to delete chat.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.id);
    if (error) return res.status(status).json({ error });

    const isOwner = String(chat.createdBy) === String(req.user._id);
    const allowed =
        chat.type === 'direct' ||
        (chat.type === 'group' && isOwner) ||
        (chat.type === 'room' && hasRole(req.user, 'admin'));
    if (!allowed) return res.status(403).json({ error: 'You are not allowed to delete this chat.' });

    const db = getDB();
    await db.collection('messages').deleteMany({ chatID: chat._id });
    await db.collection('chats').deleteOne({ _id: chat._id });
    res.status(200).json({ message: 'Chat deleted successfully.' });
});

module.exports = deleteChat;
