const { getDB } = require('../../services/database');
const { findSession } = require('../../services/sessions');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/sessions/{id}:
 *   delete:
 *     summary: Delete a session (admins)
 *     description: Removes the room and its public chat history. The main session can't be deleted.
 *     tags: [Session]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted
 *       400:
 *         description: The main session can't be deleted
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Admins only
 *       404:
 *         description: Session not found
 */
const deleteSession = route('Failed to delete session.', async (req, res) => {
    const session = await findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.slug === 'main') return res.status(400).json({ error: 'The main session can\'t be deleted.' });

    const db = getDB();
    const chat = await db.collection('chats').findOne({ type: 'room', slug: session.slug });
    if (chat) {
        await db.collection('messages').deleteMany({ chatID: chat._id });
        await db.collection('chats').deleteOne({ _id: chat._id });
    }
    await db.collection('sessions').deleteOne({ _id: session._id });
    res.status(200).json({ message: 'Session deleted successfully.' });
});

module.exports = deleteSession;
