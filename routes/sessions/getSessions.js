const { getDB } = require('../../services/database');
const { describeSessions } = require('../../services/sessions');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all sessions
 *     description: Lists the rooms with how many fish are in each right now.
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: A list of sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Session'
 *       500:
 *         description: Internal server error, failed to retrieve sessions
 */
const getSessions = route('Failed to retrieve sessions.', async (req, res) => {
    const sessions = await getDB().collection('sessions').find({}).sort({ slug: 1 }).toArray();
    res.status(200).json(await describeSessions(sessions));
});

module.exports = getSessions;
