/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Chat rooms and private chats. The public room chat is also available live over the socket (chat:send).
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Chat:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [room, direct, group]
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *           description: Only for public rooms, matches the session name (for example main)
 *         participants:
 *           type: array
 *           description: Empty for public rooms
 *           items:
 *             type: string
 *         createdBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
