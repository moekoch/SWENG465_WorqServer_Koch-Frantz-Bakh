/**
 * @swagger
 * tags:
 *   - name: Bot
 *     description: Computer opponents for the card games
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Bot:
 *       type: object
 *       required:
 *         - name
 *         - gameType
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *         name:
 *           type: string
 *           example: Shark
 *         gameType:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *           default: medium
 *         avatarKey:
 *           type: string
 *           description: Short ID apps use to find the bot's picture
 *           example: shark
 */
