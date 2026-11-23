// make sure dotenv config runs before this file is required
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDB } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
}

// how powerful each role is: moderators can do everything users can, admins everything moderators can
const ROLE_RANK = { user: 0, moderator: 1, admin: 2 };

// create signed token that holds user's id and expires in 7 days
function signToken(userId) {
    return jwt.sign({ sub: String(userId) }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '7d',
    });
}

// check token and return user (null if the token is bad or the account is banned)
async function verifyToken(token) {
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        // missing, expired, or tampered token
        return null;
    }

    if (!ObjectId.isValid(payload.sub)) return null;

    const user = await getDB()
        .collection('users')
        .findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });

    // banned accounts can't use an old token to get back in
    if (user?.status === 'banned') return null;
    return user;
}

// "user" | "moderator" | "admin" (accounts made before roles existed are users)
function roleOf(user) {
    return ROLE_RANK[user?.role] !== undefined ? user.role : 'user';
}

// true if the user's role is at least the given one
function hasRole(user, role) {
    return ROLE_RANK[roleOf(user)] >= ROLE_RANK[role];
}

// moderators and admins
function isStaff(user) {
    return hasRole(user, 'moderator');
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

        // suspended accounts can read but not act: they are stopped at login and here
        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'This account is suspended.', code: 'ACCOUNT_SUSPENDED' });
        }

        // routes read logged-in user from here not URL or body
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

// express middleware (use after requireAuth): only users with at least this role get through
function requireRole(role) {
    return (req, res, next) => {
        if (!hasRole(req.user, role)) {
            return res.status(403).json({ error: 'You do not have permission to do that.', code: 'FORBIDDEN' });
        }
        next();
    };
}

module.exports = { signToken, verifyToken, requireAuth, requireRole, hasRole, isStaff, roleOf };
