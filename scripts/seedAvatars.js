// seed fish images, it updates a fish if its imageKey already exists
require('dotenv').config();
const { connectDB, getDB } = require('../services/database');

// one entry per fish image in the apps (imageKey = image filename without .png)
const AVATARS = [
    { name: 'Blue Tang', imageKey: 'blueTang', color: 'blue', price: 0 }, // free starter fish
    { name: 'Lined Butterflyfish', imageKey: 'linedButterflyfish', color: 'yellow', price: 500 },
    { name: 'Moorish Idol', imageKey: 'moorishIdol', color: 'yellow', price: 500 },
    { name: 'Orange Clownfish', imageKey: 'orangeClownfish', color: 'orange', price: 500 },
    { name: 'Schooling Bannerfish', imageKey: 'schoolingBannerfish', color: 'white', price: 500 },
];

async function seed() {
    await connectDB();
    const avatars = getDB().collection('avatars');

    for (const avatar of AVATARS) {
        // update the fish if it exists, otherwise create it
        await avatars.updateOne({ imageKey: avatar.imageKey }, { $set: avatar }, { upsert: true });
        console.log(`Saved ${avatar.name}`);
    }

    process.exit(0);
}

seed().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});