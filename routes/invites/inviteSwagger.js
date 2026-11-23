/**
 * @swagger
 * tags:
 *   - name: Invite
 *     description: Invitations between friends, to visit a tank, play a game, or focus together
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Invite:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [tank, game, focus]
 *         game:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *           description: Only for game invites
 *         message:
 *           type: string
 *           description: Optional note, up to 60 characters, filtered like chat
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined, cancelled]
 *         from:
 *           $ref: '#/components/schemas/PublicUser'
 *         to:
 *           $ref: '#/components/schemas/PublicUser'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 */
