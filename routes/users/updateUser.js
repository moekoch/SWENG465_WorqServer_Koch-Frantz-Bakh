const bcrypt = require('bcrypt');
const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { hasRole } = require('../../services/auth');
const { route, toObjectId } = require('../../services/http');
const { USERNAME_PATTERN } = require('./createUser');

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     description: Updates one or more fields of a user. A user can update themselves; admins can update anyone.
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 6ac8dc29395d18c513fe544b
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated user (without the password hash)
 *       400:
 *         description: No fields, invalid ID, or invalid or refused values
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not allowed to change this user
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email is already registered
 */
const updateUser = route('Failed to update user.', async (req, res) => {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    // people change themselves, admins change anyone
    if (String(userId) !== String(req.user._id) && !hasRole(req.user, 'admin')) {
        return res.status(403).json({ error: 'You can only update your own account.' });
    }

    // extract fields from request body
    const { username, email, password } = req.body ?? {};
    // check that at least one field was provided
    if (username === undefined && email === undefined && password === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided.' });
    }
    // validate the fields that were provided
    if (email !== undefined &&
        (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password !== undefined &&
        (typeof password !== 'string' || password.length < 8)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (username !== undefined) {
        if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
            return res.status(400).json({ error: 'Username must be 3 to 20 characters: letters, numbers, - or _.' });
        }
        const nameCheck = await checkName(username, { kind: 'username', maxLength: 20, allowReserved: hasRole(req.user, 'admin') });
        if (!nameCheck.allowed) {
            return res.status(400).json({ error: nameCheck.reason, code: 'USERNAME_NOT_ALLOWED' });
        }
    }

    const users = getDB().collection('users');

    // add fields to updates if they are provided
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 12);

    // username and email must stay unique (ignore this same user)
    const conflicts = [];
    if (updates.username) conflicts.push({ username: updates.username });
    if (updates.email) conflicts.push({ email: updates.email });
    if (conflicts.length > 0) {
        const existing = await users.findOne({ _id: { $ne: userId }, $or: conflicts });
        if (existing) {
            const error = existing.username === updates.username
                ? 'Username is already taken.'
                : 'Email is already registered.';
            return res.status(409).json({ error });
        }
    }

    // update the user in the database
    const result = await users.updateOne({ _id: userId }, { $set: updates });
    // check if any document was matched and updated
    if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // retrieve the updated user, leaving out the password hash
    const updatedUser = await users.findOne({ _id: userId }, { projection: { passwordHash: 0 } });
    res.status(200).json(updatedUser);
});

module.exports = updateUser;
