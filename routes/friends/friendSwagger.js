/**
 * @swagger
 * tags:
 *   - name: Friend
 *     description: Friend requests and friends lists
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Friend:
 *       type: object
 *       description: One friendship from the logged-in user's point of view (about the other person)
 *       properties:
 *         id:
 *           type: string
 *           description: The friendship id (use it to accept or remove)
 *         userId:
 *           type: string
 *         username:
 *           type: string
 *         avatarKey:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, accepted]
 *         direction:
 *           type: string
 *           enum: [incoming, outgoing]
 *         online:
 *           type: boolean
 *           description: Only ever true for accepted friends who are connected and share their status
 *         since:
 *           type: string
 *           format: date-time
 */
