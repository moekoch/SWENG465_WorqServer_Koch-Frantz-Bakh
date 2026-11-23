const { getDB } = require('../../../services/database');
const { publicProfiles } = require('../../../services/social');
const { route } = require('../../../services/http');

/**
 * @swagger
 * /api/blocks:
 *   get:
 *     summary: List the people I have blocked
 *     tags: [Block]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: A list of public profiles with the time they were blocked
 *       401:
 *         description: Not logged in
 */
const getBlocks = route('Failed to retrieve blocked users.', async (req, res) => {
    const blocks = await getDB().collection('blocks').find({ blockerId: req.user._id }).sort({ createdAt: -1 }).toArray();
    const profiles = await publicProfiles(blocks.map((block) => block.blockedId));
    res.status(200).json(
        blocks
            .map((block) => ({ ...profiles.get(String(block.blockedId)), blockedAt: block.createdAt }))
            .filter((entry) => entry.id),
    );
});

module.exports = getBlocks;
