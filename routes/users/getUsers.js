const { getDB } = require('../../services/database');
const { isStaff } = require('../../services/auth');
const { publicProfiles } = require('../../services/social');
const { route, paging, escapeRegex } = require('../../services/http');

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Search or list users
 *     description: Logged-in users get a short public profile (id, username, fish) for each match, which is what the add-friend search uses. Moderators and admins get full records without the password hash.
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Username starts with this text (not case sensitive)
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 100
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Not logged in
 *       500:
 *         description: Internal server error, failed to retrieve users
 */
const getUsers = route('Failed to retrieve users.', async (req, res) => {
    const { limit, skip } = paging(req.query);
    const filter = {};
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
        filter.username = { $regex: `^${escapeRegex(req.query.search.trim())}`, $options: 'i' };
    }
    // suspended and banned accounts don't show up for regular users
    if (!isStaff(req.user)) filter.status = { $nin: ['banned', 'suspended'] };

    const found = await getDB()
        .collection('users')
        .find(filter, { projection: { passwordHash: 0 } })
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();

    if (isStaff(req.user)) return res.status(200).json(found);

    const profiles = await publicProfiles(found.map((user) => user._id));
    res.status(200).json(found.map((user) => profiles.get(String(user._id))));
});

module.exports = getUsers;
