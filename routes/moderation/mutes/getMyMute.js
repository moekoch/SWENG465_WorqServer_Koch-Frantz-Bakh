const { getActiveMute } = require('../../../services/moderationStore');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/users/me/mute:
 *   get:
 *     summary: Am I on a chat break?
 *     description: Lets the chat bar show a message instead of sending when the user is on a break.
 *     tags: [Mute]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ muted: false } or { muted: true, until, reason }"
 *       401:
 *         description: Not logged in
 */
const getMyMute = route('Failed to check chat break.', async (req, res) => {
    const mute = await getActiveMute(req.user._id);
    res.status(200).json(mute ? { muted: true, until: mute.until, reason: mute.reason } : { muted: false });
});

module.exports = getMyMute;
