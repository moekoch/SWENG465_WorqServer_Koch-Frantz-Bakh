// A small in-memory stand-in for MongoDB, just big enough for the operators this server uses.
// It lets the tests run the real route code without a database.
const { ObjectId } = require('mongodb');

const isId = (value) => value instanceof ObjectId;

function clone(value) {
    if (isId(value) || value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
    return value;
}

function same(a, b) {
    if (isId(a) || isId(b)) return String(a) === String(b);
    if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
    return a === b;
}

const getPath = (doc, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), doc);

function setPath(doc, path, value) {
    const keys = path.split('.');
    let target = doc;
    for (const key of keys.slice(0, -1)) target = target[key] ??= {};
    target[keys.at(-1)] = value;
}

function unsetPath(doc, path) {
    const keys = path.split('.');
    let target = doc;
    for (const key of keys.slice(0, -1)) {
        target = target?.[key];
        if (!target) return;
    }
    delete target[keys.at(-1)];
}

const isOperatorObject = (value) =>
    value && typeof value === 'object' && !isId(value) && !(value instanceof Date) && !Array.isArray(value) &&
    Object.keys(value).some((key) => key.startsWith('$'));

// does one field value satisfy a condition?
function matchField(fieldValue, condition) {
    if (isOperatorObject(condition)) {
        return Object.entries(condition).every(([operator, expected]) => {
            switch (operator) {
                case '$ne': return !matchField(fieldValue, expected);
                case '$in': return expected.some((value) => matchField(fieldValue, value));
                case '$nin': return !expected.some((value) => matchField(fieldValue, value));
                case '$gt': return fieldValue !== undefined && fieldValue > expected;
                case '$gte': return fieldValue !== undefined && fieldValue >= expected;
                case '$lt': return fieldValue !== undefined && fieldValue < expected;
                case '$lte': return fieldValue !== undefined && fieldValue <= expected;
                case '$exists': return (fieldValue !== undefined) === expected;
                case '$all': return expected.every((value) => Array.isArray(fieldValue) && fieldValue.some((item) => same(item, value)));
                case '$regex': return typeof fieldValue === 'string' && new RegExp(expected, condition.$options ?? '').test(fieldValue);
                case '$options': return true;
                default: throw new Error(`fakeDb: unsupported operator ${operator}`);
            }
        });
    }
    if (Array.isArray(fieldValue) && !Array.isArray(condition)) return fieldValue.some((item) => same(item, condition));
    if (condition === undefined) return fieldValue === undefined;
    return same(fieldValue, condition);
}

function matches(doc, filter = {}) {
    return Object.entries(filter).every(([key, condition]) => {
        if (key === '$or') return condition.some((sub) => matches(doc, sub));
        if (key === '$and') return condition.every((sub) => matches(doc, sub));
        return matchField(getPath(doc, key), condition);
    });
}

function applyUpdate(doc, update, { inserting = false } = {}) {
    for (const [path, value] of Object.entries(update.$set ?? {})) setPath(doc, path, clone(value));
    for (const path of Object.keys(update.$unset ?? {})) unsetPath(doc, path);
    for (const [path, amount] of Object.entries(update.$inc ?? {})) setPath(doc, path, (getPath(doc, path) ?? 0) + amount);
    for (const [path, value] of Object.entries(update.$addToSet ?? {})) {
        const list = getPath(doc, path) ?? [];
        if (!list.some((item) => same(item, value))) list.push(value);
        setPath(doc, path, list);
    }
    for (const [path, value] of Object.entries(update.$pull ?? {})) {
        const list = getPath(doc, path);
        if (Array.isArray(list)) setPath(doc, path, list.filter((item) => !same(item, value)));
    }
    if (inserting) for (const [path, value] of Object.entries(update.$setOnInsert ?? {})) setPath(doc, path, clone(value));
}

function project(doc, projection) {
    if (!projection) return clone(doc);
    const copy = clone(doc);
    for (const [key, include] of Object.entries(projection)) if (include === 0) delete copy[key];
    return copy;
}

function compare(a, b) {
    const x = a instanceof Date ? a.getTime() : isId(a) ? String(a) : a;
    const y = b instanceof Date ? b.getTime() : isId(b) ? String(b) : b;
    if (x === y) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    return x < y ? -1 : 1;
}

class Cursor {
    constructor(docs, projection) {
        this.docs = docs;
        this.projection = projection;
    }
    sort(spec) {
        const entries = Object.entries(spec);
        this.docs = [...this.docs].sort((a, b) => {
            for (const [key, direction] of entries) {
                const result = compare(getPath(a, key), getPath(b, key)) * direction;
                if (result) return result;
            }
            return 0;
        });
        return this;
    }
    skip(count) { this.docs = this.docs.slice(count); return this; }
    limit(count) { this.docs = this.docs.slice(0, count); return this; }
    async toArray() { return this.docs.map((doc) => project(doc, this.projection)); }
}

class Collection {
    constructor() { this.docs = []; }

    async insertOne(doc) {
        const stored = clone(doc);
        stored._id ??= new ObjectId();
        if (this.uniqueKeys) this.checkUnique(stored);
        this.docs.push(stored);
        return { insertedId: stored._id };
    }
    async insertMany(docs) {
        for (const doc of docs) await this.insertOne(doc);
        return { insertedCount: docs.length };
    }
    async findOne(filter, options = {}) {
        const found = this.docs.find((doc) => matches(doc, filter));
        return found ? project(found, options.projection) : null;
    }
    find(filter, options = {}) {
        return new Cursor(this.docs.filter((doc) => matches(doc, filter)), options.projection);
    }
    async countDocuments(filter) { return this.docs.filter((doc) => matches(doc, filter)).length; }

    async updateOne(filter, update, { upsert = false } = {}) {
        const found = this.docs.find((doc) => matches(doc, filter));
        if (found) {
            const before = JSON.stringify(found);
            applyUpdate(found, update);
            return { matchedCount: 1, modifiedCount: JSON.stringify(found) === before ? 0 : 1, upsertedCount: 0 };
        }
        if (!upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        const doc = {};
        for (const [key, value] of Object.entries(filter)) if (!key.startsWith('$') && !isOperatorObject(value)) setPath(doc, key, clone(value));
        applyUpdate(doc, update, { inserting: true });
        doc._id ??= new ObjectId();
        this.docs.push(doc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: doc._id };
    }
    async updateMany(filter, update) {
        const found = this.docs.filter((doc) => matches(doc, filter));
        found.forEach((doc) => applyUpdate(doc, update));
        return { matchedCount: found.length, modifiedCount: found.length };
    }
    async deleteOne(filter) {
        const index = this.docs.findIndex((doc) => matches(doc, filter));
        if (index === -1) return { deletedCount: 0 };
        this.docs.splice(index, 1);
        return { deletedCount: 1 };
    }
    async deleteMany(filter) {
        const before = this.docs.length;
        this.docs = this.docs.filter((doc) => !matches(doc, filter));
        return { deletedCount: before - this.docs.length };
    }
    async createIndex() { return 'ok'; }
}

class FakeDb {
    constructor() { this.collections = new Map(); }
    collection(name) {
        if (!this.collections.has(name)) this.collections.set(name, new Collection());
        return this.collections.get(name);
    }
}

module.exports = { FakeDb };
