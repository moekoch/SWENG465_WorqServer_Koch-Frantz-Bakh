const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/avatars/{id}:
 *   get:
 *     summary: Get an avatar
 *     description: Retrieves an avatar by its ID.
 *     tags: [Avatar]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the avatar
 *         schema:
 *           type: string
 *           example: 68e2f123456789abcdef123
 *     responses:
 *       200:
 *         description: Avatar retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Avatar'
 *       400:
 *         description: Invalid avatar ID
 *       404:
 *         description: Avatar not found
 *       500:
 *         description: Internal server error, failed to retrieve avatar
 */
const getAvatar = async (req, res) => {
    try {
        // reject IDs that aren't valid MongoDB ObjectIds
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid avatar ID.' });
        }
        
        // get database
        const db = getDB();

        // get avatars collection
        const avatars = db.collection('avatars');

        // retrieve avatar by ID
        const avatar = await avatars.findOne({
            _id: new ObjectId(req.params.id)
        });

        // check if avatar exists
        if (!avatar) {
            return res.status(404).json({
                error: 'Avatar not found.'
            });
        }

        // return ok status and avatar data
        res.status(200).json(avatar);

    } catch (error) {
        console.error('Error retrieving avatar:', error);

        res.status(500).json({
            error: 'Failed to retrieve avatar.'
        });
    }
};

module.exports = getAvatar;