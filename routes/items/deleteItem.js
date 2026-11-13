const { ObjectId } = require('mongodb');
const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     summary: Delete an item
 *     description: Deletes an item by its ID
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
 *         description: Item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Item deleted successfully
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error, failed to delete item
 */
const deleteItem = async (req, res) => {
    try {
        // get database
        const db = getDB();

        // get items collection
        const items = db.collection('items');

        // delete the item by ID
        const result = await items.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        // check if any document was deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: 'Item not found.'
            });
        }

        // send ok status and message of success
        res.status(200).json({message: 'Item deleted successfully.'});
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({error: 'Failed to delete item.'});
    }
};

module.exports = deleteItem;