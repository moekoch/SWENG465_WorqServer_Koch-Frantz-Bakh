const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Get an item
 *     description: Retrieves an item by its ID.
 *     tags: [Item]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The database ID of the item
 *         schema:
 *           type: string
 *           example: 6af72e8ef8242af8fcb834f9
 *     responses:
 *       200:
 *         description: Item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error, failed to retrieve Item
 */
const getItem = async (req, res) => {
    try {
        // get database
        const db = getDB();

        // get items collection
        const items = db.collection('items');

        // retrieve item by ID
        const item = await items.findOne({
            _id: new ObjectId(req.params.id)
        });

        // check if item exists
        if (!item) {
            return res.status(404).json({
                error: 'Item not found.'
            });
        }

        // return ok status and item data
        res.status(200).json(item);

    } catch (error) {
        console.error('Error retrieving item:', error);

        res.status(500).json({
            error: 'Failed to retrieve item.'
        });
    }
};

module.exports = getItem;