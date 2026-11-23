// Sending chat messages: the same steps whether the message comes from the live room (socket)
// or from the REST API. Order: rate limit -> chat break check -> filter -> save.
const { getDB } = require('./database');
const { screenText } = require('./moderationStore');

// room messages are short (like Club Penguin), private chats can be longer
const ROOM_MESSAGE_LENGTH = 120;
const PRIVATE_MESSAGE_LENGTH = 300;

// slow mode: at least this long between one user's messages, and no more than a burst of 6 in 10 seconds
const MIN_GAP_MS = 700;
const BURST_LIMIT = 6;
const BURST_WINDOW_MS = 10 * 1000;
const REPEAT_WINDOW_MS = 10 * 1000;

// userId -> { times: [...], lastText, lastTextAt }
const recent = new Map();

// returns an error message if the user is sending too fast or repeating themselves, otherwise null
function checkRateLimit(userId, text) {
    const key = String(userId);
    const now = Date.now();
    const entry = recent.get(key) ?? { times: [], lastText: '', lastTextAt: 0 };

    entry.times = entry.times.filter((time) => now - time < BURST_WINDOW_MS);
    if (entry.times.length && now - entry.times[entry.times.length - 1] < MIN_GAP_MS) {
        return 'Slow down a little.';
    }
    if (entry.times.length >= BURST_LIMIT) return 'Slow down a little.';
    if (text && entry.lastText === text.toLowerCase() && now - entry.lastTextAt < REPEAT_WINDOW_MS) {
        return 'You just said that.';
    }

    entry.times.push(now);
    entry.lastText = (text ?? '').toLowerCase();
    entry.lastTextAt = now;
    recent.set(key, entry);
    return null;
}

// clear the counters (used by tests)
const resetRateLimits = () => recent.clear();

// the public chat for a room (created the first time someone talks there)
async function getRoomChat(slug) {
    const chats = getDB().collection('chats');
    await chats.updateOne(
        { slug },
        { $setOnInsert: { slug, type: 'room', name: slug, participants: [], createdAt: new Date() } },
        { upsert: true },
    );
    return chats.findOne({ slug });
}

const maxLengthFor = (chat) => (chat.type === 'room' ? ROOM_MESSAGE_LENGTH : PRIVATE_MESSAGE_LENGTH);

// Check and save one message. Resolves to
//   { ok: true, message }  or  { ok: false, code, error, until? }
async function submitMessage({ user, chat, text }) {
    const limited = checkRateLimit(user._id, typeof text === 'string' ? text.trim() : '');
    if (limited) return { ok: false, code: 'RATE_LIMITED', error: limited };

    const screened = await screenText(user, text, {
        kind: 'chat',
        maxLength: maxLengthFor(chat),
        context: `chat:${chat.slug ?? chat._id}`,
    });
    if (!screened.ok) return screened;

    const message = {
        chatID: chat._id,
        userID: user._id,
        username: user.username,
        body: screened.text,
        sentAt: new Date(),
    };
    if (screened.text !== String(text).trim()) message.filtered = true; // tidied (e.g. shouting)
    const result = await getDB().collection('messages').insertOne(message);
    message._id = result.insertedId;

    await getDB().collection('chats').updateOne({ _id: chat._id }, { $set: { updatedAt: message.sentAt } });
    return { ok: true, message };
}

module.exports = {
    ROOM_MESSAGE_LENGTH,
    PRIVATE_MESSAGE_LENGTH,
    checkRateLimit,
    resetRateLimits,
    getRoomChat,
    maxLengthFor,
    submitMessage,
};
