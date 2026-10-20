// make sure dotenv config runs before this file is required
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDB } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
}

// create signed token that holds user's id and expires in 7 days
function signToken(userId) {
    return jwt.sign({ sub: String(userId) }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '7d',
    });
}

// check token and return user
async function verifyToken(token) {
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        // missing, expired, or tampered token
        return null;
    }

    if (!ObjectId.isValid(payload.sub)) return null;

    return getDB()
        .collection('users')
        .findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
}

// express middleware: let request through only if token valid
async function requireAuth(req, res, next) {
    try {
        // token comes in as "Authorization: Bearer <token>"
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;

        const user = token ? await verifyToken(token) : null;
        if (!user) {
            // code lets clients tell "not logged in" apart
            return res.status(401).json({ error: 'Not logged in.', code: 'UNAUTHENTICATED' });
        }

        // routes read logged-in user from here not URL or body
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = { signToken, verifyToken, requireAuth };