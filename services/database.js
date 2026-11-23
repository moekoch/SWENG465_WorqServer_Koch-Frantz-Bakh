const dns = require('dns');

dns.setServers(['8.8.8.8']);

const { MongoClient } = require('mongodb');

let client;
let db;

const connectDB = async () => {
    // create a MongoDB client using connection string (made here so tests can load this file without one)
    client = new MongoClient(process.env.MONGODB_URI);

    // connect to Atlas
    await client.connect();

    // select database
    db = client.db('WorqDB');

    console.log('Connected to MongoDB');

    // indexes and the default room/chat every install needs
    const { ensureIndexes, ensureDefaults } = require('./indexes');
    await ensureIndexes(db);
    await ensureDefaults(db);
};

const getDB = () => {
    return db;
}

// tests plug in an in-memory database instead of Atlas
const setDB = (testDb) => {
    db = testDb;
};

module.exports = {
    connectDB,
    getDB,
    setDB
};
