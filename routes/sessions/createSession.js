const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { SLUG_PATTERN, describeSessions } = require('../../services/sessions');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a session (moderators)
 *     description: Adds a room fish can swim in. Names and descriptions are filtered.
 *     tags: [Session]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Session'
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: Missing or invalid fields, or a name the filter refused
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       409:
 *         description: A session with that slug already exists
 */
const createSession = route('Failed to create session.', async (req, res) => {
    const { slug, name, description, capacity = 50 } = req.body ?? {};
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
        return res.status(400).json({ error: 'slug must be 2 to 32 lowercase letters, numbers or -.' });
    }
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Missing required field: name.' });
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 200) return res.status(400).json({ error: 'capacity must be a whole number from 2 to 200.' });

    const nameCheck = await checkName(name, { kind: 'name', maxLength: 40 });
    if (!nameCheck.allowed) return res.status(400).json({ error: nameCheck.reason, code: 'MODERATED' });
    const session = { slug, name: nameCheck.text, capacity, createdBy: req.user._id, createdAt: new Date() };
    if (description !== undefined) {
        if (typeof description !== 'string') return res.status(400).json({ error: 'description must be text.' });
        const descriptionCheck = await checkName(description, { kind: 'name', maxLength: 120 });
        if (!descriptionCheck.allowed) return res.status(400).json({ error: descriptionCheck.reason, code: 'MODERATED' });
        session.description = descriptionCheck.text;
    }

    const sessions = getDB().collection('sessions');
    if (await sessions.findOne({ slug })) return res.status(409).json({ error: 'A session with that slug already exists.' });
    session._id = (await sessions.insertOne(session)).insertedId;
    res.status(201).json((await describeSessions([session]))[0]);
});

module.exports = createSession;
