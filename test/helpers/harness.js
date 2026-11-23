// Starts the real routes (and optionally the real socket server) on a random port with an in-memory database.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const http = require('http');
const express = require('express');
const { ObjectId } = require('mongodb');
const { FakeDb } = require('./fakeDb');
const database = require('../../services/database');
const { ensureDefaults } = require('../../services/indexes');
const { signToken } = require('../../services/auth');
const { registerRoutes } = require('../../routes');
const { initSocket } = require('../../services/socket');
const { resetRateLimits } = require('../../services/chat');
const { setCustomTerms } = require('../../services/moderation');

async function startApp() {
    const db = new FakeDb();
    database.setDB(db);
    await ensureDefaults(db);
    resetRateLimits();
    setCustomTerms({ block: [], allow: [] });

    const app = express();
    app.use(express.json());
    registerRoutes(app);
    app.use((error, req, res, next) => res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ error: 'Server error' }));

    const server = http.createServer(app);
    initSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;

    // call the API: api('POST', '/api/friends', { token, body }) -> { status, body }
    async function api(method, path, { token, body } = {}) {
        const response = await fetch(url + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        return { status: response.status, body: parsed };
    }

    // make a user straight in the database (faster than registering) and log them in
    async function makeUser(username, extra = {}) {
        const doc = { username, email: `${username.toLowerCase()}@example.com`, passwordHash: 'x', role: 'user', status: 'active', createdAt: new Date(), ...extra };
        const { insertedId } = await db.collection('users').insertOne(doc);
        return { id: String(insertedId), _id: insertedId, token: signToken(insertedId), username };
    }

    // make two users friends
    async function befriend(a, b) {
        await db.collection('friendships').insertOne({ requesterId: a._id, recipientId: b._id, status: 'accepted', createdAt: new Date(), respondedAt: new Date() });
    }

    async function close() {
        await new Promise((resolve) => server.close(resolve));
    }

    return { db, url, server, api, makeUser, befriend, close, ObjectId };
}

module.exports = { startApp };
