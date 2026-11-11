const dns = require('dns');

dns.setServers(['8.8.8.8']);

const { MongoClient } = require('mongodb');

// create a MongoDB client using connection string
const client = new MongoClient(process.env.MONGODB_URI);

let db;

const connectDB = async () => {
    // connect to Atlas
    await client.connect();

    // select database
    db = client.db('WorqDB');

    console.log('Connected to MongoDB');
};

const getDB = () => {
    return db;
}

module.exports = {
    connectDB,
    getDB
};