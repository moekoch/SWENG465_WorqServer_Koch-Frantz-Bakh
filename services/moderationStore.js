// The database side of moderation: custom words, strikes, chat breaks (mutes), the blocked-message
// log and the moderator report queue. The text rules themselves live in moderation.js.
const { getDB } = require('./database');
const { moderateText, setCustomTerms } = require('./moderation');
const { isStaff } = require('./auth');

// strikes older than this no longer count
const STRIKE_WINDOW_MS = 30 * 60 * 1000;

// strikes inside the window -> length of the automatic chat break (checked from the top)
const MUTE_STEPS = [
    { minStrikes: 10, minutes: 24 * 60 },
    { minStrikes: 6, minutes: 30 },
    { minStrikes: 3, minutes: 5 },
];

// custom word lists are cached for a minute so every message doesn't hit the database
const TERMS_CACHE_MS = 60 * 1000;
let termsLoadedAt = 0;

async function loadCustomTerms(force = false) {
    if (!force && Date.now() - termsLoadedAt < TERMS_CACHE_MS) return;
    const terms = await getDB().collection('moderation_terms').find({}).toArray();
    setCustomTerms({
        block: terms.filter((entry) => entry.type === 'block').map((entry) => entry.term),
        allow: terms.filter((entry) => entry.type === 'allow').map((entry) => entry.term),
    });
    termsLoadedAt = Date.now();
}

// moderators changed the word list: use it right away
const reloadCustomTerms = () => loadCustomTerms(true);

// the chat break a user is on right now, or null
async function getActiveMute(userId) {
    return getDB().collection('mutes').findOne({
        userId,
        liftedAt: { $exists: false },
        until: { $gt: new Date() },
    });
}

// "4 more minutes" / "about 2 hours"
function describeWait(until) {
    const minutes = Math.max(1, Math.ceil((new Date(until) - Date.now()) / 60000));
    if (minutes < 60) return `${minutes} more minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.ceil(minutes / 60);
    return `about ${hours} more hour${hours === 1 ? '' : 's'}`;
}

async function createMute({ userId, minutes, reason, source, createdBy }) {
    const now = new Date();
    const mute = {
        userId,
        until: new Date(now.getTime() + minutes * 60 * 1000),
        reason,
        source, // 'auto' | 'moderator'
        createdAt: now,
    };
    if (createdBy) mute.createdBy = createdBy;
    const result = await getDB().collection('mutes').insertOne(mute);
    mute._id = result.insertedId;
    return mute;
}

// write the blocked message down, count strikes, and start a chat break if there are too many.
// returns the new mute if one was started
async function recordViolation({ user, text, categories, weight, context }) {
    const db = getDB();
    await db.collection('moderation_logs').insertOne({
        userId: user._id,
        username: user.username,
        text,
        categories,
        weight,
        context,
        createdAt: new Date(),
    });

    // spam is blocked but is not a strike
    if (weight === 0) return null;

    // severe problems go straight to the moderators' queue
    if (weight >= 3) {
        await db.collection('reports').insertOne({
            source: 'auto',
            reporterId: null,
            reportedUserId: user._id,
            reportedUsername: user.username,
            reason: categories[0],
            details: 'Blocked automatically by the chat filter.',
            textSnapshot: text,
            status: 'open',
            createdAt: new Date(),
        });
    }

    // moderators are filtered like everyone else but never put on a break
    if (isStaff(user)) return null;

    const logs = await db
        .collection('moderation_logs')
        .find({ userId: user._id, createdAt: { $gte: new Date(Date.now() - STRIKE_WINDOW_MS) } })
        .toArray();
    const strikes = logs.reduce((total, log) => total + (log.weight ?? 0), 0);

    const step = MUTE_STEPS.find((entry) => strikes >= entry.minStrikes);
    if (!step) return null;
    return createMute({
        userId: user._id,
        minutes: step.minutes,
        reason: 'Too many blocked messages in a short time.',
        source: 'auto',
    });
}

// Everything that happens before text is shown to others. Resolves to
//   { ok: true, text }  or  { ok: false, code, error, until?, categories? }
// code: MUTED (on a break), MODERATED (blocked by the filter), INVALID (empty or too long)
async function screenText(user, input, { kind = 'chat', maxLength = 120, context = 'chat' } = {}) {
    // 1. already on a chat break?
    if (kind === 'chat') {
        const mute = await getActiveMute(user._id);
        if (mute) {
            return {
                ok: false,
                code: 'MUTED',
                until: mute.until,
                error: `You're on a chat break for ${describeWait(mute.until)}.`,
            };
        }
    }

    // 2. run the filter
    await loadCustomTerms();
    const result = moderateText(input, { kind, maxLength, allowReserved: isStaff(user) });
    if (result.allowed) return { ok: true, text: result.text };

    // empty or too long are simple mistakes, not violations
    if (result.categories.length === 0) {
        return { ok: false, code: 'INVALID', error: result.reason };
    }

    // 3. blocked: log it and maybe start a break
    const mute = await recordViolation({
        user,
        text: result.text,
        categories: result.categories,
        weight: result.weight,
        context,
    });
    const answer = { ok: false, code: 'MODERATED', error: result.reason, categories: result.categories };
    if (mute) {
        answer.code = 'MUTED';
        answer.until = mute.until;
        answer.error = `${result.reason} You're on a chat break for ${describeWait(mute.until)}.`;
    }
    return answer;
}

// check a name (username, chat name, invite note) that isn't a chat message: no strikes, no chat break
async function checkName(input, { kind = 'name', maxLength = 40, allowReserved = false } = {}) {
    await loadCustomTerms();
    return moderateText(input, { kind, maxLength, allowReserved });
}

module.exports = {
    checkName,
    STRIKE_WINDOW_MS,
    MUTE_STEPS,
    loadCustomTerms,
    reloadCustomTerms,
    getActiveMute,
    describeWait,
    createMute,
    recordViolation,
    screenText,
};
