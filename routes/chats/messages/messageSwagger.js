/**
 * @swagger
 * tags:
 *   - name: Message
 *     description: Chat messages. Every message is filtered before it is saved; blocked messages are never stored or shown.
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         chatID:
 *           type: string
 *         userID:
 *           type: string
 *         username:
 *           type: string
 *         body:
 *           type: string
 *         sentAt:
 *           type: string
 *           format: date-time
 *         editedAt:
 *           type: string
 *           format: date-time
 *     ModerationError:
 *       type: object
 *       description: Returned when a message is refused
 *       properties:
 *         error:
 *           type: string
 *           description: A friendly reason. It never repeats the blocked word.
 *         code:
 *           type: string
 *           enum: [MODERATED, MUTED, INVALID, RATE_LIMITED]
 *         until:
 *           type: string
 *           format: date-time
 *           description: When the chat break ends (MUTED only)
 */
