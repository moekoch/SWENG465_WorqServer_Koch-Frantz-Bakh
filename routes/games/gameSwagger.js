/**
 * @swagger
 * tags:
 *   - name: Game
 *     description: Game results and scores. Games against a bot are reported by the app; matches between two people are recorded by the server itself so nobody can claim a win they didn't earn.
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     GameResult:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *         userId:
 *           type: string
 *           readOnly: true
 *         game:
 *           type: string
 *           enum: [go-fish, blackjack, spades]
 *         outcome:
 *           type: string
 *           enum: [win, loss, draw]
 *         opponentType:
 *           type: string
 *           enum: [bot, user]
 *         botId:
 *           type: string
 *           description: Which bot was played (optional)
 *         opponentId:
 *           type: string
 *           readOnly: true
 *           description: For matches against a person
 *         score:
 *           type: number
 *           description: Optional points or books for the game
 *         source:
 *           type: string
 *           enum: [client, server]
 *           readOnly: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *     Score:
 *       type: object
 *       properties:
 *         played:
 *           type: integer
 *         wins:
 *           type: integer
 *         losses:
 *           type: integer
 *         draws:
 *           type: integer
 *         winRate:
 *           type: integer
 *           description: Percent of games won
 */
