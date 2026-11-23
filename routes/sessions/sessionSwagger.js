/**
 * @swagger
 * tags:
 *   - name: Session
 *     description: Rooms where fish swim together (the Glasshouse Commons is the session called main)
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Session:
 *       type: object
 *       required:
 *         - slug
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *         slug:
 *           type: string
 *           description: Short name used to join over the socket (session:join), 2 to 32 lowercase letters, numbers or -
 *           example: main
 *         name:
 *           type: string
 *           example: Glasshouse Commons
 *         description:
 *           type: string
 *         capacity:
 *           type: integer
 *           description: Most fish allowed in at once
 *           example: 50
 *         online:
 *           type: integer
 *           readOnly: true
 *           description: Fish in the room right now
 *         chatId:
 *           type: string
 *           readOnly: true
 *           description: The room's public chat (messages can be loaded with GET /api/chats/{chatID}/messages)
 */
