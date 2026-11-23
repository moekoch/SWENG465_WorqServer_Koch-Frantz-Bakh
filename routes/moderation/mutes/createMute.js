const { getDB } = require('../../../services/database');
const { createMute: startMute, getActiveMute } = require('../../../services/moderationStore');
const { hasRole } = require('../../../services/auth');
const { emitToUser } = require('../../../services/socket');
const { route, toObjectId } = require('../../../services/http');

/**
 * @swagger
 * /api/moderation/mutes:
 *   post:
 *     summary: Start a chat break for a user (moderators)
 *     description: The user can't send chat messages until it ends. They are told right away if they are connected.
 *     tags: [Mute]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, minutes]
 *             properties:
 *               userId:
 *                 type: string
 *               minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 43200
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat break started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mute'
 *       400:
 *         description: Invalid fields
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only, or the user is staff and you are not an admin
 *       404:
 *         description: User not found
 *       409:
 *         description: The user is already on a chat break
 */
const createMute = route('Failed to start chat break.', async (req, res) => {
    const userId = toObjectId(req.body?.userId);
    const { minutes, reason } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: 'Invalid userId.' });
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200) return res.status(400).json({ error: 'minutes must be 1 to 43200.' });
    if (reason !== undefined && typeof reason !== 'string') return res.status(400).json({ error: 'reason must be text.' });

    const user = await getDB().collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (['moderator', 'admin'].includes(user.role) && !hasRole(req.user, 'admin')) {
        return res.status(403).json({ error: 'Only admins can mute staff.' });
    }
    if (await getActiveMute(userId)) return res.status(409).json({ error: 'This user is already on a chat break.' });

    const mute = await startMute({ userId, minutes, reason: (reason ?? 'Moderator action').slice(0, 200), source: 'moderator', createdBy: req.user._id });
    emitToUser(userId, 'moderation:muted', { until: mute.until, error: 'A moderator started a chat break for you.' });
    res.status(201).json(mute);
});

module.exports = createMute;
