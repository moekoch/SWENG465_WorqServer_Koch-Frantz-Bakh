// Indexes keep lookups fast and enforce rules the routes rely on (unique names, one friendship per pair...).
// Each one is created on its own so a problem with old data (for example duplicate usernames)
// is logged but never stops the server from starting.

const DAY_SECONDS = 24 * 60 * 60;

const INDEXES = [
    ['users', { username: 1 }, { unique: true }],
    ['users', { email: 1 }, { unique: true }],
    ['friendships', { requesterId: 1, recipientId: 1 }, { unique: true }],
    ['friendships', { recipientId: 1, status: 1 }, {}],
    ['blocks', { blockerId: 1, blockedId: 1 }, { unique: true }],
    ['invites', { toUserId: 1, status: 1 }, {}],
    // invites disappear a week after they expire
    ['invites', { expiresAt: 1 }, { expireAfterSeconds: 7 * DAY_SECONDS }],
    ['chats', { slug: 1 }, { unique: true, sparse: true }],
    ['chats', { participants: 1 }, {}],
    ['messages', { chatID: 1, sentAt: -1 }, {}],
    ['sessions', { slug: 1 }, { unique: true }],
    ['bots', { name: 1 }, { unique: true }],
    ['reports', { status: 1, createdAt: -1 }, {}],
    ['reports', { reporterId: 1, messageId: 1 }, {}],
    ['mutes', { userId: 1, until: -1 }, {}],
    // blocked-message logs are kept for 90 days, then removed automatically
    ['moderation_logs', { createdAt: 1 }, { expireAfterSeconds: 90 * DAY_SECONDS }],
    ['moderation_logs', { userId: 1, createdAt: -1 }, {}],
    ['moderation_terms', { term: 1, type: 1 }, { unique: true }],
    ['game_results', { userId: 1, game: 1, createdAt: -1 }, {}],
];

async function ensureIndexes(db) {
    for (const [collection, keys, options] of INDEXES) {
        try {
            await db.collection(collection).createIndex(keys, options);
        } catch (error) {
            console.warn(`Could not create index on ${collection}:`, error.message);
        }
    }
}

// the Glasshouse Commons session and its public chat room, plus the starter bots
async function ensureDefaults(db) {
    const now = new Date();
    await db.collection('sessions').updateOne(
        { slug: 'main' },
        { $setOnInsert: { slug: 'main', name: 'Glasshouse Commons', description: 'A little space to play and focus.', capacity: 50, createdAt: now } },
        { upsert: true }
    );
    await db.collection('chats').updateOne(
        { slug: 'main' },
        { $setOnInsert: { slug: 'main', type: 'room', name: 'Glasshouse Commons', participants: [], createdAt: now } },
        { upsert: true }
    );
    for (const bot of [
        { name: 'Shark', gameType: 'go-fish', difficulty: 'medium', avatarKey: 'shark' },
        { name: 'Dealer', gameType: 'blackjack', difficulty: 'medium', avatarKey: 'shark' },
    ]) {
        await db.collection('bots').updateOne({ name: bot.name }, { $setOnInsert: { ...bot, createdAt: now } }, { upsert: true });
    }
}

module.exports = { ensureIndexes, ensureDefaults, INDEXES };
