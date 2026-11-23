const { getDB } = require('../../services/database');
const { getAccessibleChat } = require('../../services/chatAccess');
const { checkName } = require('../../services/moderationStore');
const { areFriends } = require('../../services/social');
const { route, toObjectId } = require('../../services/http');
const { MAX_GROUP_SIZE } = require('./createChat');

/**
 * @swagger
 * /api/chats/{id}:
 *   put:
 *     summary: Rename a group chat or change who is in it
 *     description: Only the person who made a group chat can change it. Names are filtered. New people must be the owner's friends. Direct chats and public rooms can't be edited this way.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: The updated chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Nothing to change, invalid values, or a name the filter refused
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Only the owner of a group chat can change it, and only friends can be added
 *       404:
 *         description: Chat not found
 */
const updateChat = route('Failed to update chat.', async (req, res) => {
    const { chat, status, error } = await getAccessibleChat(req.user, req.params.id);
    if (error) return res.status(status).json({ error });
    if (chat.type !== 'group' || String(chat.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Only the owner of a group chat can change it.' });
    }

    const { name, participants } = req.body ?? {};
    if (name === undefined && participants === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided.' });
    }
    const updates = { updatedAt: new Date() };

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name must be text.' });
        const check = await checkName(name, { kind: 'name', maxLength: 40 });
        if (!check.allowed) return res.status(400).json({ error: check.reason, code: 'MODERATED' });
        updates.name = check.text;
    }

    if (participants !== undefined) {
        if (!Array.isArray(participants)) return res.status(400).json({ error: 'participants must be a list.' });
        const ids = [];
        for (const value of participants) {
            const id = toObjectId(value);
            if (!id) return res.status(400).json({ error: 'Invalid participant ID.' });
            if (String(id) !== String(req.user._id) && !ids.some((existing) => String(existing) === String(id))) ids.push(id);
        }
        if (ids.length === 0) return res.status(400).json({ error: 'A group chat needs at least one other person.' });
        if (ids.length + 1 > MAX_GROUP_SIZE) return res.status(400).json({ error: `A group chat holds at most ${MAX_GROUP_SIZE} people.` });

        // people who are not already in need to be friends
        const alreadyIn = new Set(chat.participants.map(String));
        for (const id of ids) {
            if (!alreadyIn.has(String(id)) && !await areFriends(req.user._id, id)) {
                return res.status(403).json({ error: 'You can only add friends to a group chat.' });
            }
        }
        updates.participants = [req.user._id, ...ids];
    }

    const chats = getDB().collection('chats');
    await chats.updateOne({ _id: chat._id }, { $set: updates });
    res.status(200).json(await chats.findOne({ _id: chat._id }));
});

module.exports = updateChat;
