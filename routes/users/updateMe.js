const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { isStaff } = require('../../services/auth');
const { route } = require('../../services/http');
const { USERNAME_PATTERN } = require('./createUser');

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update my username or email
 *     description: Changes the logged-in user's own username and/or email. Passwords have their own endpoint.
 *     tags: [User]
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
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated profile
 *       400:
 *         description: Nothing to change, or an invalid or refused username / email
 *       401:
 *         description: Not logged in
 *       409:
 *         description: Username or email is already registered
 */
const updateMe = route('Failed to update profile.', async (req, res) => {
    const { username, email } = req.body ?? {};
    if (username === undefined && email === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided.' });
    }
    const updates = {};

    if (username !== undefined) {
        if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
            return res.status(400).json({ error: 'Username must be 3 to 20 characters: letters, numbers, - or _.' });
        }
        const nameCheck = await checkName(username, { kind: 'username', maxLength: 20, allowReserved: isStaff(req.user) });
        if (!nameCheck.allowed) {
            return res.status(400).json({ error: nameCheck.reason, code: 'USERNAME_NOT_ALLOWED' });
        }
        updates.username = username;
    }
    if (email !== undefined) {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }
        updates.email = email.trim().toLowerCase();
    }

    // username and email must stay unique (ignore this same user)
    const users = getDB().collection('users');
    const conflicts = Object.entries(updates).map(([key, value]) => ({ [key]: value }));
    const existing = await users.findOne({ _id: { $ne: req.user._id }, $or: conflicts });
    if (existing) {
        const error = updates.username && existing.username === updates.username
            ? 'Username is already taken.'
            : 'Email is already registered.';
        return res.status(409).json({ error });
    }

    await users.updateOne({ _id: req.user._id }, { $set: updates });
    const updated = await users.findOne({ _id: req.user._id }, { projection: { passwordHash: 0 } });
    res.status(200).json(updated);
});

module.exports = updateMe;
