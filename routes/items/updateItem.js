const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     summary: Update an item
 *     description: Updates one or more fields of an existing item.
 *     tags: [Item]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the item
 *         schema:
 *           type: string
 *           example: 6af72e8ef8242af8fcb834f9
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the item
 *                 example: Desk
 *               price:
 *                 type: number
 *                 description: The price of the item
 *                 example: 100
 *               imageKey:
 *                 type: string
 *                 description: Short ID apps use to find the item's image
 *                 example: headphones
 *     responses:
 *       200:
 *         description: Item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       400:
 *         description: No fields were provided or price has an invalid data type
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error, failed to update item
 */
const updateItem = async (req, res) => {
    try {
        // extract fields from request body
        const { name, price, imageKey } = req.body ?? {};

        // check that at least one field was provided
        if (name === undefined && price === undefined && imageKey === undefined) {
            return res.status(400).json({error: 'At least one field must be provided.'});
        }

        if (imageKey !== undefined && (typeof imageKey !== 'string' || !/^[A-Za-z0-9_-]+$/.test(imageKey))) {
            return res.status(400).json({error: 'Invalid imageKey: use only letters, numbers, - and _.'});
        }
        // validate price if provided
        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            return res.status(400).json({
                error: 'Invalid data type: price must be a number.'
            });
        }

        // get database
        const db = getDB();

        // get items collection
        const items = db.collection('items');

        // add fields to updates if they are provided
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({error: 'Invalid item ID.'});
        }
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (price !== undefined) updates.price = price;
        if (imageKey !== undefined) updates.imageKey = imageKey;

        // update the item in the database
        const result = await items.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updates }
        );

        // check if any document was matched and updated
        if (result.matchedCount === 0) {
            return res.status(404).json({
                error: 'Item not found.'
            });
        }

        // retrieve the updated item
        const updatedItem = await items.findOne({
            _id: new ObjectId(req.params.id)
        });

        // return the updated item
        res.status(200).json(updatedItem);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({error: 'Failed to update item.'});
    }
};

module.exports = updateItem;