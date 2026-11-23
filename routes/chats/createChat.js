const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { areFriends, isBlockedEitherWay } = require('../../services/social');
const { settingsOf } = require('../../services/settings');
const { route, toObjectId } = require('../../services/http');

// most people in a group chat, including the person who made it
const MAX_GROUP_SIZE = 8;

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Start a private chat
 *     description: Starts a direct chat with one person (type direct, found again if it already exists) or a group chat with friends (type group). Direct chats follow the other person's "Direct messages" setting. Group names are filtered.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [direct, group]
 *               userId:
 *                 type: string
 *                 description: For direct chats, who to talk to
 *               name:
 *                 type: string
 *                 description: For group chats
 *               participants:
 *                 type: array
 *                 description: For group chats, the friends to add (you are added for you)
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Chat created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       200:
 *         description: A direct chat with that person already existed
 *       400:
 *         description: Invalid or missing fields, or a name the filter refused
 *       401:
 *         description: Not logged in
 *       403:
 *         description: They are not accepting direct messages from you, or someone is not your friend
 *       404:
 *         description: User not found
 */
const createChat = route('Failed to create chat.', async (req, res) => {
    const { type } = req.body ?? {};
    const db = getDB();
    const chats = db.collection('chats');
    const me = req.user._id;

    if (type === 'direct') {
        const otherId = toObjectId(req.body.userId);
        if (!otherId) return res.status(400).json({ error: 'Invalid userId.' });
        if (String(otherId) === String(me)) return res.status(400).json({ error: "You can't chat with yourself." });

        const other = await db.collection('users').findOne({ _id: otherId });
        if (!other || other.status === 'banned' || await isBlockedEitherWay(me, otherId)) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // their "Direct messages" setting decides who can start a chat
        const allowed = settingsOf(other).directMessages;
        if (allowed === 'nobody' || (allowed === 'friends' && !await areFriends(me, otherId))) {
            return res.status(403).json({ error: "They aren't accepting direct messages from you." });
        }

        // one direct chat per pair
        const existing = await chats.findOne({ type: 'direct', participants: { $all: [me, otherId] } });
        if (existing) return res.status(200).json(existing);

        const chat = {
            type: 'direct',
            name: `${req.user.username} and ${other.username}`,
            participants: [me, otherId],
            createdBy: me,
            createdAt: new Date(),
        };
        chat._id = (await chats.insertOne(chat)).insertedId;
        return res.status(201).json(chat);
    }

    if (type === 'group') {
        const { name, participants } = req.body;
        if (typeof name !== 'string' || !name.trim() || !Array.isArray(participants)) {
            return res.status(400).json({ error: 'A group chat needs a name and a participants list.' });
        }
        const check = await checkName(name, { kind: 'name', maxLength: 40 });
        if (!check.allowed) return res.status(400).json({ error: check.reason, code: 'MODERATED' });

        // everyone added must be a valid, different friend
        const ids = [];
        for (const value of participants) {
            const id = toObjectId(value);
            if (!id) return res.status(400).json({ error: 'Invalid participant ID.' });
            if (String(id) !== String(me) && !ids.some((existing) => String(existing) === String(id))) ids.push(id);
        }
        if (ids.length === 0) return res.status(400).json({ error: 'Add at least one friend.' });
        if (ids.length + 1 > MAX_GROUP_SIZE) return res.status(400).json({ error: `A group chat holds at most ${MAX_GROUP_SIZE} people.` });
        for (const id of ids) {
            if (!await areFriends(me, id)) return res.status(403).json({ error: 'You can only add friends to a group chat.' });
        }

        const chat = {
            type: 'group',
            name: check.text,
            participants: [me, ...ids],
            createdBy: me,
            createdAt: new Date(),
        };
        chat._id = (await chats.insertOne(chat)).insertedId;
        return res.status(201).json(chat);
    }

    res.status(400).json({ error: 'type must be direct or group.' });
});

module.exports = createChat;
module.exports.MAX_GROUP_SIZE = MAX_GROUP_SIZE;
