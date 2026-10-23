const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/avatars/{id}:
 *   delete:
 *     summary: Delete an avatar
 *     description: Deletes an avatar by its ID
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
 *         description: Avatar deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Avatar deleted successfully
 *       400:
 *         description: Invalid avatar ID
 *       404:
 *         description: Avatar not found
 *       500:
 *         description: Internal server error, failed to delete avatar
 */
const deleteAvatar = async (req, res) => {
    try {
        // reject IDs that aren't valid MongoDB ObjectIds
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid avatar ID.' });
        }
        
        // get database
        const db = getDB();

        // get avatars collection
        const avatars = db.collection('avatars');

        // delete the avatar by ID
        const result = await avatars.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        // check if any document was deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: 'Avatar not found.'
            });
        }

        // send ok status and message of success
        res.status(200).json({message: 'Avatar deleted successfully.'});
    } catch (error) {
        console.error('Error deleting avatar:', error);
        res.status(500).json({error: 'Failed to delete avatar.'});
    }
};

module.exports = deleteAvatar;