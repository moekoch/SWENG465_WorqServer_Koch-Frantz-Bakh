const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/avatars/{id}:
 *   put:
 *     summary: Update an avatar
 *     description: Updates one or more fields of an existing avatar.
 *     tags: [Avatar]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the avatar
 *         schema:
 *           type: string
 *           example: 68e2f123456789abcdef123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the avatar
 *                 example: Blue Tang
 *               imageKey:
 *                 type: string
 *                 description: Short unique ID the apps use to find the avatar's image
 *                 example: blueTang
 *               color:
 *                 type: string
 *                 description: The color of the avatar
 *                 example: purple
 *               price:
 *                 type: number
 *                 description: The price of the avatar
 *                 example: 100
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Avatar'
 *       400:
 *         description: No fields were provided or price has an invalid data type
 *       404:
 *         description: Avatar not found
 *       409:
 *         description: Another avatar already uses that imageKey
 *       500:
 *         description: Internal server error, failed to update avatar
 */
const updateAvatar = async (req, res) => {
    try {
        // reject IDs that aren't valid MongoDB ObjectIds
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid avatar ID.' });
        }

        // extract fields from request body
        const { name, color, price, imageKey } = req.body;

        // check that at least one field was provided
        if (name === undefined && color === undefined && price === undefined && imageKey === undefined) {
            return res.status(400).json({error: 'At least one field must be provided.'});
        }

        // validate price if provided
        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            return res.status(400).json({
                error: 'Invalid data type: price must be a number.'
            });
        }

        // validate imageKey if provided
        if (imageKey !== undefined && (typeof imageKey !== 'string' || !/^[A-Za-z0-9_-]+$/.test(imageKey))) {
            return res.status(400).json({
                error: 'Invalid imageKey: use only letters, numbers, - and _.'
            });
        }

        // validate color if provided
        if (color !== undefined && typeof color !== 'string') {
            return res.status(400).json({
                error: 'Invalid data type: color must be a string.'
            });
        }

        // get database
        const db = getDB();

        // get avatars collection
        const avatars = db.collection('avatars');

        // convert avatar's id for MongoDB
        const id = new ObjectId(req.params.id);
 
        // imageKey must stay unique across all other avatars
        if (imageKey !== undefined) {
            const taken = await avatars.findOne({ imageKey, _id: { $ne: id } });
            if (taken) {
                return res.status(409).json({
                    error: 'Another avatar already uses that imageKey.'
                });
            }
        }

        // add fields to updates if they are provided
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (imageKey !== undefined) updates.imageKey = imageKey;
        if (color !== undefined) updates.color = color;
        if (price !== undefined) updates.price = price;

        // update the avatar in the database
        const result = await avatars.updateOne(
            { _id: id },
            { $set: updates }
        );

        // check if any document was matched and updated
        if (result.matchedCount === 0) {
            return res.status(404).json({
                error: 'Avatar not found.'
            });
        }

        // retrieve the updated avatar
        const updatedAvatar = await avatars.findOne({ _id: id });

        // return the updated avatar
        res.status(200).json(updatedAvatar);
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.status(500).json({error: 'Failed to update avatar.'});
    }
};

module.exports = updateAvatar;