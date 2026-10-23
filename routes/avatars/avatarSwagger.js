/**
 * @swagger
 * tags:
 *   - name: Avatar
 *     description: API endpoints for managing avatars
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Avatar:
 *       type: object
 *       required:
 *         - name
 *         - imageKey
 *         - price
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *           description: MongoDB generated ID
 *           example: 68e2f123456789abcdef123
 *         name:
 *           type: string
 *           description: Name of the avatar
 *           example: Blue Tang
 *         imageKey:
 *           type: string
 *           description: Short unique ID apps use to find avatar's image
 *           example: blueTang
 *         color:
 *           type: string
 *           description: Color of the avatar
 *           example: blue
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Price of the avatar
 *           example: 100
 */