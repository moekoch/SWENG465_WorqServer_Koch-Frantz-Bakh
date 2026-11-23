const { getDB } = require('../../../services/database');
const { publicProfiles } = require('../../../services/social');
const { refreshBlocks } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/blocks:
 *   post:
 *     summary: Block (ignore) a user
 *     description: Hides their chat from you and stops them from friending or inviting you. Any friendship or invites between you end.
 *     tags: [Block]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Blocked
 *       200:
 *         description: Already blocked
 *       400:
 *         description: Invalid user id or blocking yourself
 *       401:
 *         description: Not logged in
 *       404:
 *         description: User not found
 */
const createBlock = route('Failed to block user.', async (req, res) => {
    const blockedId = toObjectId(req.body?.userId);
    if (!blockedId) return res.status(400).json({ error: 'Invalid user ID.' });
    if (String(blockedId) === String(req.user._id)) return res.status(400).json({ error: "You can't block yourself." });

    const db = getDB();
    const profile = (await publicProfiles([blockedId])).get(String(blockedId));
    if (!profile) return res.status(404).json({ error: 'User not found.' });

    const me = req.user._id;
    const result = await db.collection('blocks').updateOne(
        { blockerId: me, blockedId },
        { $setOnInsert: { blockerId: me, blockedId, createdAt: new Date() } },
        { upsert: true },
    );

    // end any friendship and pending invites between the two
    const pair = [{ requesterId: me, recipientId: blockedId }, { requesterId: blockedId, recipientId: me }];
    await db.collection('friendships').deleteMany({ $or: pair });
    await db.collection('invites').deleteMany({
        status: 'pending',
        $or: [{ fromUserId: me, toUserId: blockedId }, { fromUserId: blockedId, toUserId: me }],
    });

    await refreshBlocks(me);
    res.status(result.upsertedCount ? 201 : 200).json({ ...profile, blocked: true });
});

module.exports = createBlock;
