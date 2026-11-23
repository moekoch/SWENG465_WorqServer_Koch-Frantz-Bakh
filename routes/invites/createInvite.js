const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { INVITE_TYPES, INVITE_LIFETIME_MS, MAX_NOTE_LENGTH, describeInvites } = require('../../services/invites');
const { GAMES } = require('../../services/gameResults');
const { areFriends, isBlockedEitherWay } = require('../../services/social');
const { settingsOf } = require('../../services/settings');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId } = require('../../services/http');

/**
 * @swagger
 * /api/invites:
 *   post:
 *     summary: Send an invite to a friend
 *     description: Invite a friend to visit your tank, play a game, or focus together. You can only invite friends, and a friend whose "Tank visitors" setting is "nobody" can't be invited to a tank. The note is filtered like chat.
 *     tags: [Invite]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toUserId, type]
 *             properties:
 *               toUserId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [tank, game, focus]
 *               game:
 *                 type: string
 *                 enum: [go-fish, blackjack, spades]
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invite sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Invalid fields or a note the filter refused
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not friends, or they are not accepting this kind of invite
 *       404:
 *         description: User not found
 *       409:
 *         description: You already have a pending invite of this kind for them
 */
const createInvite = route('Failed to send invite.', async (req, res) => {
    const { type, game, message } = req.body ?? {};
    const toUserId = toObjectId(req.body?.toUserId);
    if (!toUserId) return res.status(400).json({ error: 'Invalid toUserId.' });
    if (!INVITE_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${INVITE_TYPES.join(', ')}.` });
    if (type === 'game' && !GAMES.includes(game)) return res.status(400).json({ error: `game must be one of: ${GAMES.join(', ')}.` });
    if (String(toUserId) === String(req.user._id)) return res.status(400).json({ error: "You can't invite yourself." });

    const db = getDB();
    const target = await db.collection('users').findOne({ _id: toUserId });
    if (!target || target.status === 'banned' || await isBlockedEitherWay(req.user._id, toUserId)) {
        return res.status(404).json({ error: 'User not found.' });
    }
    if (!await areFriends(req.user._id, toUserId)) {
        return res.status(403).json({ error: 'You can only invite friends.' });
    }
    if (type === 'tank' && settingsOf(target).tankVisitors === 'nobody') {
        return res.status(403).json({ error: "They aren't accepting tank visitors right now." });
    }

    // the optional note
    let note;
    if (message !== undefined) {
        if (typeof message !== 'string') return res.status(400).json({ error: 'message must be text.' });
        if (message.trim()) {
            const check = await checkName(message, { kind: 'name', maxLength: MAX_NOTE_LENGTH });
            if (!check.allowed) return res.status(400).json({ error: check.reason, code: 'MODERATED' });
            note = check.text;
        }
    }

    // one pending invite of each kind per friend
    const duplicate = await db.collection('invites').findOne({
        fromUserId: req.user._id,
        toUserId,
        type,
        ...(type === 'game' && { game }),
        status: 'pending',
        expiresAt: { $gt: new Date() },
    });
    if (duplicate) return res.status(409).json({ error: 'You already sent them this invite.' });

    const now = new Date();
    const invite = {
        fromUserId: req.user._id,
        toUserId,
        type,
        status: 'pending',
        createdAt: now,
        expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
    };
    if (type === 'game') invite.game = game;
    if (note) invite.message = note;
    const result = await db.collection('invites').insertOne(invite);
    invite._id = result.insertedId;

    const [described] = await describeInvites([invite]);
    emitToUser(toUserId, 'invite:received', described);
    res.status(201).json(described);
});

module.exports = createInvite;
