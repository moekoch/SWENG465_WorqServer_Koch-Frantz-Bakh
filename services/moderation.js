// Checks text before it is shown to anyone. Pure functions: no database, so it is easy to test.
// Order of work: clean the text -> build look-alike versions (so f.u.c.k and f*ck are caught) ->
// run the word list and phrase rules on every version -> if clean, tidy it (shouting, stretched letters).
const fs = require('fs');
const path = require('path');
const {
    WEIGHTS,
    HATE_WORDS,
    SEXUAL_WORDS,
    PHRASE_RULES,
    PHONE_PATTERN,
    RESERVED_NAMES_EXACT,
    RESERVED_NAME_PREFIXES,
    IP_PATTERN,
} = require('./moderationLists');

const JSON_MODERATION_FILES = [
    path.join(__dirname, '..', 'profanity', 'en.json'),
    path.join(__dirname, '..', 'profanity', 'emoji.json'),
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const JSON_TERMS = JSON_MODERATION_FILES.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')));

const SEVERITY_WEIGHTS = { 1: 1, 2: 1, 3: 2, 4: 3 };
const MILD_GENERAL_ALLOWLIST = new Set(['hell', 'damn']);

function compileJsonMatch(match) {
    return match.split('|').map((alternative) => {
        const normalized = alternative.trim().replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, '');
        const parts = normalized.replace(/\*/g, '\u0000').split('').map((character) =>
            character === '\u0000' ? '[\\p{L}\\p{N}]?' : escapeRegex(character),
        );
        const expression = parts.join('').replace(/\s+/g, '\\s+');
        return /^[\p{L}\p{N}]/u.test(normalized) && /[\p{L}\p{N}]$/u.test(normalized)
            ? `(?<![\\p{L}\\p{N}])${expression}(?![\\p{L}\\p{N}])`
            : expression;
    });
}

const JSON_MATCHERS = JSON_TERMS.map((entry) => ({
    entry,
    patterns: compileJsonMatch(entry.match).map((expression) => new RegExp(expression, 'iu')),
}));

// what the person sees when something is blocked. It never says which word was the problem.
const REASONS = {
    hate: "Hateful language isn't allowed in Worqarium.",
    threat: "Messages that threaten or hurt others aren't allowed.",
    harassment: "Let's be kind. Messages that put others down aren't allowed.",
    privacy: "For your safety, please don't share personal info or links.",
    sexual: "That isn't something we can share here. Let's keep it friendly.",
    profanity: "Let's keep chat friendly. That message wasn't sent.",
    spam: 'That looks like spam, so it was not sent.',
    reserved: 'That name is reserved. Please pick another one.',
    empty: 'Say something first.',
    tooLong: 'That message is too long.',
};

// order matters: the most serious problem is the one explained to the person
const SEVERITY_ORDER = ['hate', 'threat', 'harassment', 'sexual', 'privacy', 'profanity', 'spam'];

// characters that are invisible or are used to sneak words past filters
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// lookalike numbers and symbols people use instead of letters
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '+': 't' };

// words a moderator added at runtime: { block: [...], allow: [...] } (set by moderationStore)
let customTerms = { block: [], allow: [] };
function setCustomTerms(terms) {
    customTerms = {
        block: (terms?.block ?? []).map(normalizeTerm).filter(Boolean),
        allow: (terms?.allow ?? []).map(normalizeTerm).filter(Boolean),
    };
}
const normalizeTerm = (term) => String(term).toLowerCase().trim();

// strip invisible characters and odd spacing
function cleanText(text) {
    return String(text ?? '')
        .normalize('NFKC')
        .replace(INVISIBLE, '')
        .replace(CONTROL, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// remove accents: "fücк" -> "fuck"
const foldAccents = (text) => text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[АаВСЕеНКМОРТХХхү]/gu, (character) => ({
        А: 'A', а: 'a', В: 'B', С: 'C', Е: 'E', е: 'e', Н: 'H', К: 'K',
        М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', х: 'x', ү: 'y',
    })[character] ?? character)
    .replace(/[асеорхуіӏкмт]/gu, (character) => ({
        а: 'a', с: 'c', е: 'e', о: 'o', р: 'p', х: 'x', у: 'y', і: 'i', ӏ: 'l', к: 'k', м: 'm', т: 't',
    })[character] ?? character);

// every spelling of the text a filter evasion could hide in
function buildVariants(text) {
    const base = foldAccents(text);
    const variants = new Set([base]);

    // Possessive/text shorthand used in the same way across every moderation rule:
    // "ur" can mean "your" ("ur name") or "you're" ("ur stupid").
    for (const shorthand of ['ur', 'u r']) {
        if (!new RegExp(`(?<!\\p{L})${shorthand.replace(/ /g, '\\s+')}(?!\\p{L})`, 'iu').test(base)) continue;
        const pattern = new RegExp(`(?<!\\p{L})${shorthand.replace(/ /g, '\\s+')}(?!\\p{L})`, 'giu');
        variants.add(base.replace(pattern, 'your'));
        variants.add(base.replace(pattern, 'you are'));
    }

    // "f u c k" and "f.u.c.k" -> "fuck" (runs of single characters)
    variants.add(
        base.replace(/(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][\s._\-*,'"]+){2,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu, (run) =>
            run.replace(/[^\p{L}\p{N}]+/gu, ''),
        ),
    );

    // "fu.ck" and "f-uck" -> "fuck" (separators inside a word)
    variants.add(base.replace(/(?<=\p{L})[._\-*]+(?=\p{L})/gu, ''));

    // "f*ck" -> try each vowel in the gap (only for a few masked words so it stays fast)
    const maskedWords = base.split(' ').filter((word) => /\p{L}\*+\p{L}|\p{L}\*+$/u.test(word) && (word.match(/\*/g) ?? []).length <= 2);
    for (const word of maskedWords.slice(0, 5)) {
        for (const vowel of 'aeiou') {
            variants.add(base.replace(word, word.replaceAll('*', vowel)));
        }
    }
    return [...variants];
}

// lowercase, lookalike symbols turned into letters, stretched letters squeezed: "sh1tttt" -> "shit"
function toPlainLowercase(text) {
    return foldAccents(text)
        .toLowerCase()
        .replace(/[0134578@$!+]/g, (character) => LEET[character])
        .replace(/(.)\1{2,}/g, '$1$1');
}

// remove words moderators said are fine (for example a place name that trips the filter)
function withoutAllowedTerms(text) {
    let result = text;
    for (const term of customTerms.allow) {
        result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'giu'), ' ');
    }
    return result;
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// work out which problems the text has: a Set of category names
function findProblems(text, { checkPrivacy }) {
    const categories = new Set();
    const categorySeverities = new Map();
    const record = (category, severity = WEIGHTS[category] ?? 1) => {
        categories.add(category);
        categorySeverities.set(category, Math.max(categorySeverities.get(category) ?? 0, severity));
    };
    const variants = buildVariants(text);

    for (const variant of variants) {
        // 1. the structured profanity JSON datasets
        const jsonTextVariants = new Set([
            variant,
            foldAccents(variant).toLowerCase(),
            toPlainLowercase(variant),
        ]);
        for (const { entry, patterns } of JSON_MATCHERS) {
            if (!patterns.some((pattern) => [...jsonTextVariants].some((candidate) => pattern.test(candidate)))) continue;

            const tags = entry.tags ?? [];
            if (
                entry.severity === 1 &&
                entry.match.split('|').some((term) => MILD_GENERAL_ALLOWLIST.has(term.trim()))
            ) continue;
            let category = 'profanity';
            if (tags.includes('racial') || tags.includes('religious') || tags.includes('lgbtq')) category = 'hate';
            else if (tags.includes('sexual') || tags.includes('shock')) category = 'sexual';

            const words = entry.match.toLowerCase().split('|').filter(Boolean);
            if (words.some((word) => HATE_WORDS.has(word.replace(/\*/g, '')))) category = 'hate';
            let jsonWeight = SEVERITY_WEIGHTS[entry.severity] ?? 1;
            if (category === 'profanity') jsonWeight = 1;
            if (category === 'sexual' && tags.includes('sexual') && entry.severity < 3) jsonWeight = 1;
            if (category === 'hate') jsonWeight = WEIGHTS.hate;
            record(category, jsonWeight);
        }

        // 2. phrase rules (threats, hate, bullying, personal info)
        const lowercase = toPlainLowercase(variant);
        const plain = foldAccents(variant).toLowerCase();
        for (const [category, pattern, phraseWeight] of PHRASE_RULES) {
            if (!checkPrivacy && (category === 'privacy' || category === 'sexual' && pattern.source.includes('nudes'))) continue;
            if (pattern.test(plain) || pattern.test(lowercase)) record(category, phraseWeight ?? WEIGHTS[category] ?? 1);
        }

        // 3. words the moderators added
        for (const term of customTerms.block) {
            const squeezed = term.replace(/(.)\1{2,}/g, '$1$1');
            const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escape(term)}|${escape(squeezed)})(?![\\p{L}\\p{N}])`, 'iu');
            if (pattern.test(plain) || pattern.test(lowercase)) record('profanity');
        }
    }

    // phone numbers
    if (checkPrivacy && PHONE_PATTERN.test(text)) record('privacy');
    // IP addresses expose a person's network location
    if (checkPrivacy && IP_PATTERN.test(text)) record('privacy');

    // the same word again and again
    if (/\b(\p{L}+)(?:\s+\1){5,}\b/iu.test(text)) record('spam');

    return { categories, categorySeverities };
}

// make allowed text tidier: no SHOUTING, no "heyyyyyyyy"
function tidy(text) {
    let result = text.replace(/(.)\1{3,}/gu, '$1$1$1');

    const letters = result.replace(/[^\p{L}]/gu, '');
    const upperCount = letters.replace(/[^\p{Lu}]/gu, '').length;
    if (letters.length >= 8 && upperCount / letters.length > 0.7) {
        result = result.toLowerCase();
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
}

// the one function the rest of the server uses.
//   kind: 'chat' (messages), 'name' (chat and room names, invite notes), 'username'
//   returns { allowed, text, categories, weight, reason }
function moderateText(input, { kind = 'chat', maxLength = 120, allowReserved = false } = {}) {
    const text = cleanText(input);

    const fail = (categories, reason, categorySeverities = new Map()) => ({
        allowed: false,
        text,
        categories,
        weight: categories.reduce((highest, category) => Math.max(
            highest,
            categorySeverities.get(category) ?? WEIGHTS[category] ?? 0,
        ), 0),
        reason,
    });

    if (!text) return fail([], REASONS.empty);
    if (text.length > maxLength) return fail([], REASONS.tooLong);

    const found = findProblems(withoutAllowedTerms(text), { checkPrivacy: kind !== 'username' });

    // names nobody but staff may use
    if (kind === 'username' && !allowReserved) {
        const compact = toPlainLowercase(text).replace(/[^a-z0-9]/g, '');
        if (
            RESERVED_NAMES_EXACT.includes(compact) ||
            RESERVED_NAME_PREFIXES.some((prefix) => compact.startsWith(prefix))
        ) {
            return fail([], REASONS.reserved);
        }
    }

    if (found.categories.size > 0) {
        const categories = SEVERITY_ORDER.filter((category) => found.categories.has(category));
        return fail(categories, REASONS[categories[0]], found.categorySeverities);
    }

    return {
        allowed: true,
        text: kind === 'chat' ? tidy(text) : text,
        categories: [],
        weight: 0,
        reason: null,
    };
}

module.exports = { moderateText, setCustomTerms, cleanText, REASONS };
