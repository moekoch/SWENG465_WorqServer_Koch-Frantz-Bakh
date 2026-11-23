const { GAMES } = require('./gameResults');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

// check bot fields. { bot } with the fields that were sent, or { error }. requireAll for create.
function validateBot(input, { requireAll }) {
    const { name, gameType, difficulty, avatarKey } = input ?? {};
    if (requireAll && (!name || !gameType)) return { error: 'Missing required fields: name and gameType are required.' };
    if (!requireAll && [name, gameType, difficulty, avatarKey].every((value) => value === undefined)) {
        return { error: 'At least one field must be provided.' };
    }
    const bot = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim() || name.length > 30) return { error: 'name must be 1 to 30 characters.' };
        bot.name = name.trim();
    }
    if (gameType !== undefined) {
        if (!GAMES.includes(gameType)) return { error: `gameType must be one of: ${GAMES.join(', ')}.` };
        bot.gameType = gameType;
    }
    if (difficulty !== undefined) {
        if (!DIFFICULTIES.includes(difficulty)) return { error: `difficulty must be one of: ${DIFFICULTIES.join(', ')}.` };
        bot.difficulty = difficulty;
    }
    if (avatarKey !== undefined) {
        if (typeof avatarKey !== 'string' || !KEY_PATTERN.test(avatarKey)) return { error: 'avatarKey may only use letters, numbers, - and _.' };
        bot.avatarKey = avatarKey;
    }
    return { bot };
}

module.exports = { DIFFICULTIES, validateBot };
