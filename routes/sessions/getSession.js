const { describeSessions, findSession } = require('../../services/sessions');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/sessions/{id}:
 *   get:
 *     summary: Get a session
 *     description: By id or by slug (for example main).
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: main
 *     responses:
 *       200:
 *         description: The session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error, failed to retrieve session
 */
const getSession = route('Failed to retrieve session.', async (req, res) => {
    const session = await findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.status(200).json((await describeSessions([session]))[0]);
});

module.exports = getSession;
