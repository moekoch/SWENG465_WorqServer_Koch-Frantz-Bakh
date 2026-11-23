const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { describeSessions, findSession } = require('../../services/sessions');
const { route } = require('../../services/http');

/**
 * @swagger
 * /api/sessions/{id}:
 *   put:
 *     summary: Update a session (moderators)
 *     description: Change the name, description, or capacity. The slug can't change because people join by it.
 *     tags: [Session]
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
 *               description:
 *                 type: string
 *               capacity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: The updated session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: No fields, invalid values, or a name the filter refused
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Moderators only
 *       404:
 *         description: Session not found
 */
const updateSession = route('Failed to update session.', async (req, res) => {
    const { name, description, capacity } = req.body ?? {};
    if (name === undefined && description === undefined && capacity === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided.' });
    }
    const existing = await findSession(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Session not found.' });

    const updates = { updatedAt: new Date() };
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name must be text.' });
        const check = await checkName(name, { kind: 'name', maxLength: 40 });
        if (!check.allowed) return res.status(400).json({ error: check.reason, code: 'MODERATED' });
        updates.name = check.text;
    }
    if (description !== undefined) {
        if (typeof description !== 'string') return res.status(400).json({ error: 'description must be text.' });
        const check = await checkName(description, { kind: 'name', maxLength: 120 });
        if (!check.allowed) return res.status(400).json({ error: check.reason, code: 'MODERATED' });
        updates.description = check.text;
    }
    if (capacity !== undefined) {
        if (!Number.isInteger(capacity) || capacity < 2 || capacity > 200) return res.status(400).json({ error: 'capacity must be a whole number from 2 to 200.' });
        updates.capacity = capacity;
    }

    const sessions = getDB().collection('sessions');
    await sessions.updateOne({ _id: existing._id }, { $set: updates });
    res.status(200).json((await describeSessions([{ ...existing, ...updates }]))[0]);
});

module.exports = updateSession;
