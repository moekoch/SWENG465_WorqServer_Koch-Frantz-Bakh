const { getDB } = require('./database');
const { sessionCounts } = require('./socket');
const { toObjectId } = require('./http');

const SLUG_PATTERN = /^[a-z0-9-]{2,32}$/;

// a session with how many fish are in it and where its chat lives
async function describeSessions(sessions) {
    const counts = sessionCounts();
    const chats = sessions.length
        ? await getDB().collection('chats').find({ type: 'room', slug: { $in: sessions.map((session) => session.slug) } }).toArray()
        : [];
    const chatIdBySlug = new Map(chats.map((chat) => [chat.slug, String(chat._id)]));
    return sessions.map((session) => ({
        ...session,
        online: counts[session.slug] ?? 0,
        chatId: chatIdBySlug.get(session.slug) ?? null,
    }));
}

// a session by its id or by its slug
function findSession(idOrSlug) {
    const id = toObjectId(idOrSlug);
    return getDB().collection('sessions').findOne(id ? { _id: id } : { slug: String(idOrSlug) });
}

module.exports = { SLUG_PATTERN, describeSessions, findSession };
