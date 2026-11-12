// seed item images, it updates an item if its imageKey already exists
require('dotenv').config();
const { connectDB, getDB } = require('../services/database');

// one entry per item image in the apps (imageKey = image filename without .png)
const ITEMS = [
    { name: 'Headphones', imageKey: 'headphones', x: 100, y: 100, price: 500 },
];

async function seed() {
    await connectDB();
    const items = getDB().collection('items');

    for (const item of ITEMS) {
        // update the item if it exists, otherwise create it
        await items.updateOne({ imageKey: item.imageKey }, { $set: item }, { upsert: true });
        console.log(`Saved ${item.name}`);
    }

    process.exit(0);
}

seed().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});