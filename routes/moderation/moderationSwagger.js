/**
 * @swagger
 * tags:
 *   - name: Moderation
 *     description: Chat safety tools. Reports, chat breaks, the blocked-message log and the word list are for moderators and admins. Anyone logged in can report a message and check their own chat break.
 *   - name: Report
 *     description: Reports about messages or people
 *   - name: Mute
 *     description: Chat breaks (a user can't send chat messages until the break ends)
 *   - name: Term
 *     description: Extra blocked words and allowed words, on top of the built-in filter
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         source:
 *           type: string
 *           enum: [user, auto]
 *           description: auto = the filter reported a serious message itself
 *         reporterId:
 *           type: string
 *           nullable: true
 *         reportedUserId:
 *           type: string
 *         reportedUsername:
 *           type: string
 *         messageId:
 *           type: string
 *         chatId:
 *           type: string
 *         textSnapshot:
 *           type: string
 *           description: The message as it was reported, kept even if it is later removed
 *         reason:
 *           type: string
 *           enum: [profanity, hate, harassment, threat, privacy, sexual, spam, other]
 *         details:
 *           type: string
 *         status:
 *           type: string
 *           enum: [open, actioned, dismissed]
 *         action:
 *           type: string
 *           enum: [none, warn, mute, remove_message, suspend, ban]
 *         resolution:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *     Mute:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         until:
 *           type: string
 *           format: date-time
 *         reason:
 *           type: string
 *         source:
 *           type: string
 *           enum: [auto, moderator]
 *         createdBy:
 *           type: string
 *         liftedAt:
 *           type: string
 *           format: date-time
 *     Term:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         term:
 *           type: string
 *           description: A word or short phrase, lowercase
 *         type:
 *           type: string
 *           enum: [block, allow]
 *           description: block = never allowed in chat. allow = never counted as a problem.
 *         createdAt:
 *           type: string
 *           format: date-time
 */
