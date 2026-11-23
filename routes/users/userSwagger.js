/**
 * @swagger
 * tags:
 *   - name: User
 *     description: API endpoints for managing users
 *   - name: Settings
 *     description: A user's comfort and privacy preferences
 *   - name: Tank
 *     description: A user's own tank (fish colour and where decor is placed)
 */
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Token from POST /api/login, sent as "Authorization Bearer token"
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *           description: MongoDB generated ID
 *           example: 6ac8dc29395d18c513fe544b
 *         username:
 *           type: string
 *           description: Unique name, 3 to 20 letters, numbers, - or _. Offensive or reserved names are refused.
 *           example: testuser
 *         email:
 *           type: string
 *           description: Email of the user, stored lowercase and must be unique
 *           example: jane.doe@example.com
 *         password:
 *           type: string
 *           writeOnly: true
 *           minLength: 8
 *           description: Plain-text password of at least 8 characters, it is hashed before storage and never returned
 *           example: password123
 *         id:
 *           type: integer
 *           description: Optional legacy number
 *           example: 1
 *         role:
 *           type: string
 *           enum: [user, moderator, admin]
 *           readOnly: true
 *         status:
 *           type: string
 *           enum: [active, suspended, banned]
 *           readOnly: true
 *     PublicUser:
 *       type: object
 *       description: What other people can see about a user
 *       properties:
 *         id:
 *           type: string
 *         username:
 *           type: string
 *         avatarKey:
 *           type: string
 *           example: blueTang
 *     Settings:
 *       type: object
 *       properties:
 *         reducedMotion:
 *           type: boolean
 *         ambientAudio:
 *           type: boolean
 *         textSize:
 *           type: string
 *           enum: [standard, large, larger]
 *         focusMinutes:
 *           type: integer
 *           enum: [15, 25, 45]
 *         tankVisitors:
 *           type: string
 *           enum: [friends, everyone, nobody]
 *         directMessages:
 *           type: string
 *           enum: [friends, everyone, nobody]
 *         onlineStatus:
 *           type: string
 *           enum: [friends, everyone, nobody]
 *         showFocusStatus:
 *           type: boolean
 *         chatNotifications:
 *           type: string
 *           enum: [mentions, all, none]
 *     Tank:
 *       type: object
 *       properties:
 *         fishKey:
 *           type: string
 *           example: blueTang
 *         fishColor:
 *           type: string
 *           example: '#00aaff'
 *         layout:
 *           type: object
 *           description: Item id -> position, x and y from 0 to 1. Only items the user owns.
 *           additionalProperties:
 *             type: object
 *             properties:
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 */
