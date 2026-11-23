// Make someone a moderator or admin (the first admin has to be made here, the API can't do it yet).
//   node scripts/setRole.js <username> <user|moderator|admin>
require('dotenv').config();
const { connectDB, getDB } = require('../services/database');

async function main() {
    const [username, role] = process.argv.slice(2);
    if (!username || !['user', 'moderator', 'admin'].includes(role)) {
        console.log('Usage: node scripts/setRole.js <username> <user|moderator|admin>');
        process.exit(1);
    }
    await connectDB();
    const result = await getDB().collection('users').updateOne({ username }, { $set: { role } });
    console.log(result.matchedCount ? `${username} is now a ${role}.` : `No user named ${username}.`);
    process.exit(result.matchedCount ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
