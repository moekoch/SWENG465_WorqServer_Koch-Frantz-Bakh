/**
 * @swagger
 * tags:
 *   - name: Item
 *     description: API endpoints for managing items
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Item:
 *       type: object
 *       required:
 *         - name
 *         - imageKey
 *         - price
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB generated ID
 *           example: 6af72e8ef8242af8fcb834f9
 *         name:
 *           type: string
 *           description: Name of the item
 *           example: Desk
 *         imageKey:
 *           type: string
 *           description: Short unique ID apps use to find item's image
 *           example: headphones
 *         price:
 *           type: number
 *           description: Price of the item
 *           example: 100
 */