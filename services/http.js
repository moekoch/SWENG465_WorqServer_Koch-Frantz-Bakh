const { ObjectId } = require('mongodb');

// 24 hex characters only (ObjectId.isValid also accepts any 12 character string)
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

// ObjectId from a string / ObjectId, or null if it isn't one
function toObjectId(value) {
    if (value instanceof ObjectId) return value;
    if (typeof value === 'string' && OBJECT_ID_PATTERN.test(value)) return new ObjectId(value);
    return null;
}

// wrap a route so any crash becomes a clean JSON 500 instead of an HTML error page
function route(failureMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            console.error(`${failureMessage}:`, error);
            if (!res.headersSent) res.status(500).json({ error: failureMessage });
        }
    };
}

// ?limit=20&skip=40 with safe bounds
function paging(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const skip = Math.max(0, parseInt(query.skip, 10) || 0);
    return { limit, skip };
}

// escape user text before using it inside a regular expression
function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { toObjectId, route, paging, escapeRegex };
