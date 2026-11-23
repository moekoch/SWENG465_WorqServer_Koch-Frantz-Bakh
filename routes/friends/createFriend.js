const { getDB } = require('../../services/database');
const { describeFriendships, countFriends, MAX_FRIENDS } = require('../../services/friends');
const { findFriendship, isBlockedEitherWay } = require('../../services/social');
const { emitToUser } = require('../../services/socket');
const { route, toObjectId, escapeRegex } = require('../../services/http');

/**
 * @swagger
 * /api/friends:
 *   post:
 *     summary: Send a friend request
 *     description: Asks another user to be friends, by username or user id. If they already asked you, the two requests join up and you become friends straight away.
 *     tags: [Friend]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Friend'
 *       200:
 *         description: They had already asked you, so you are now friends
 *       400:
 *         description: Missing or invalid user, asking yourself, or friend limit reached
 *       401:
 *         description: Not logged in
 *       404:
 *         description: User not found
 *       409:
 *         description: Already friends or request already sent
 */
const createFriend = route('Failed to send friend request.', async (req, res) => {
    const { username, userId } = req.body ?? {};
    const users = getDB().collection('users');

    // find who the request is for
    let target = null;
    if (userId !== undefined) {
        const id = toObjectId(userId);
        if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
        target = await users.findOne({ _id: id });
    } else if (typeof username === 'string' && username.trim()) {
        target = await users.findOne({ username: { $regex: `^${escapeRegex(username.trim())}$`, $options: 'i' } });
    } else {
        return res.status(400).json({ error: 'Send a username or userId.' });
    }

    // missing, banned, or blocked accounts all look the same
    if (!target || target.status === 'banned' || await isBlockedEitherWay(req.user._id, target._id)) {
        return res.status(404).json({ error: 'User not found.' });
    }
    if (String(target._id) === String(req.user._id)) {
        return res.status(400).json({ error: "You can't add yourself." });
    }

    const friendships = getDB().collection('friendships');
    const existing = await findFriendship(req.user._id, target._id);
    if (existing?.status === 'accepted') return res.status(409).json({ error: 'You are already friends.' });
    if (existing && String(existing.requesterId) === String(req.user._id)) {
        return res.status(409).json({ error: 'Friend request already sent.' });
    }

    // they asked first: accept theirs
    if (existing) {
        await friendships.updateOne({ _id: existing._id }, { $set: { status: 'accepted', respondedAt: new Date() } });
        const [mine] = await describeFriendships([{ ...existing, status: 'accepted', respondedAt: new Date() }], req.user._id);
        const [theirs] = await describeFriendships([{ ...existing, status: 'accepted', respondedAt: new Date() }], target._id);
        emitToUser(target._id, 'friend:accepted', theirs);
        return res.status(200).json(mine);
    }

    if (await countFriends(req.user._id) >= MAX_FRIENDS) {
        return res.status(400).json({ error: `You can have up to ${MAX_FRIENDS} friends.` });
    }

    const friendship = {
        requesterId: req.user._id,
        recipientId: target._id,
        status: 'pending',
        createdAt: new Date(),
    };
    const result = await friendships.insertOne(friendship);
    friendship._id = result.insertedId;

    const [mine] = await describeFriendships([friendship], req.user._id);
    const [theirs] = await describeFriendships([friendship], target._id);
    emitToUser(target._id, 'friend:request', theirs);
    res.status(201).json(mine);
});

module.exports = createFriend;
