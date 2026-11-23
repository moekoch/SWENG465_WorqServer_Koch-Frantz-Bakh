// A user's tank: the fish they picked, its colour, and where each piece of decor sits.
const { getDB } = require('./database');
const { readWallet } = require('./shop');
const { toObjectId } = require('./http');

const MAX_DECOR = 30;
const FISH_KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_TANK = { fishKey: null, fishColor: '#ffffff', layout: {} };

// the saved tank with defaults filled in
function tankOf(user) {
    return { ...DEFAULT_TANK, ...(user?.tank ?? {}), layout: { ...(user?.tank?.layout ?? {}) } };
}

// Check tank fields. Returns { tank } with only the fields that were sent, or { error }.
// Decor must be something the user owns (or that is free).
async function validateTank(input, user) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'Send the tank as an object.' };
    }
    const tank = {};

    if (input.fishKey !== undefined) {
        if (input.fishKey !== null && !(typeof input.fishKey === 'string' && FISH_KEY_PATTERN.test(input.fishKey))) {
            return { error: 'Invalid fishKey: use only letters, numbers, - and _.' };
        }
        tank.fishKey = input.fishKey;
    }

    if (input.fishColor !== undefined) {
        if (typeof input.fishColor !== 'string' || !COLOR_PATTERN.test(input.fishColor)) {
            return { error: 'Invalid fishColor: use a colour like #00aaff.' };
        }
        tank.fishColor = input.fishColor.toLowerCase();
    }

    if (input.layout !== undefined) {
        if (!input.layout || typeof input.layout !== 'object' || Array.isArray(input.layout)) {
            return { error: 'layout must be an object of item id -> { x, y }.' };
        }
        const entries = Object.entries(input.layout);
        if (entries.length > MAX_DECOR) return { error: `A tank holds at most ${MAX_DECOR} pieces of decor.` };

        const itemIds = [];
        for (const [itemId, position] of entries) {
            const id = toObjectId(itemId);
            const validPosition =
                position && Number.isFinite(position.x) && Number.isFinite(position.y) &&
                position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1;
            if (!id || !validPosition) {
                return { error: 'Each layout entry needs a valid item id and x and y between 0 and 1.' };
            }
            itemIds.push(id);
        }

        // only decor the user owns
        if (itemIds.length) {
            const owned = new Set(readWallet(user).ownedItemIds);
            const items = await getDB().collection('items').find({ _id: { $in: itemIds } }).toArray();
            const known = new Map(items.map((item) => [String(item._id), item]));
            for (const id of itemIds) {
                const item = known.get(String(id));
                if (!item) return { error: 'One of the items in the layout does not exist.' };
                if (item.price !== 0 && !owned.has(String(id))) {
                    return { error: 'You can only place decor you own.' };
                }
            }
        }
        tank.layout = Object.fromEntries(entries.map(([itemId, { x, y }]) => [itemId, { x, y }]));
    }

    if (Object.keys(tank).length === 0) return { error: 'At least one field must be provided.' };
    return { tank };
}

module.exports = { DEFAULT_TANK, MAX_DECOR, tankOf, validateTank };
