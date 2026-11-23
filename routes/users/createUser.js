const bcrypt = require('bcrypt');
const { getDB } = require('../../services/database');
const { checkName } = require('../../services/moderationStore');
const { route } = require('../../services/http');

// 3 to 20 letters, numbers, - or _
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user (register)
 *     description: Registers an account. The password is hashed before it is stored. Offensive or reserved usernames are refused.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User created successfully (the password is never returned)
 *       400:
 *         description: Missing fields, invalid username, short password, bad email, or a name the filter refused
 *       409:
 *         description: Username or email is already registered
 *       500:
 *         description: Internal server error, failed to create user
 */
const createUser = route('Failed to create user.', async (req, res) => {
    // get data from request body
    const { username, password, email, id } = req.body ?? {};
    // POST endpoint check to ensure the data sent from the client is valid
    if (!username || !password || !email) {
        return res.status(400).json({
            error: 'Missing required fields: username, password, and email are required.'
        });
    }
    // id is optional, but if it is sent it must be a number
    if (id !== undefined && typeof id !== 'number') {
        return res.status(400).json({ error: 'Invalid data type: id must be a number.' });
    }
    if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
        return res.status(400).json({
            error: 'Username must be 3 to 20 characters: letters, numbers, - or _.'
        });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    // very basic format check: something@something.something
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }

    // no offensive names and nobody pretending to be staff
    const nameCheck = await checkName(username, { kind: 'username', maxLength: 20 });
    if (!nameCheck.allowed) {
        return res.status(400).json({ error: nameCheck.reason, code: 'USERNAME_NOT_ALLOWED' });
    }

    // store emails in one form so "A@x.com" and "a@x.com" count as the same
    const normalizedEmail = email.trim().toLowerCase();
    const users = getDB().collection('users');

    // usernames and emails must be unique
    const existing = await users.findOne({ $or: [{ username }, { email: normalizedEmail }] });
    if (existing) {
        const error = existing.username === username
            ? 'Username is already taken.'
            : 'Email is already registered.';
        return res.status(409).json({ error });
    }

    // hash the password (bcrypt adds a unique salt automatically)
    const passwordHash = await bcrypt.hash(password, 12);

    // store the hash, never the password itself. Everyone starts as a regular, active user.
    const newUser = {
        username,
        passwordHash,
        email: normalizedEmail,
        role: 'user',
        status: 'active',
        createdAt: new Date(),
    };
    if (id !== undefined) newUser.id = id;
    const result = await users.insertOne(newUser);

    // respond without the hash
    res.status(201).json({
        _id: result.insertedId,
        username,
        email: normalizedEmail,
        role: 'user',
        status: 'active',
        ...(id !== undefined && { id })
    });
});

module.exports = createUser;
module.exports.USERNAME_PATTERN = USERNAME_PATTERN;
