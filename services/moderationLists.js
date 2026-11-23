// Settings for the chat filter: how serious each kind of problem is and the phrase rules
// that go beyond a plain word list. The big profanity word list comes from the "obscenity"
// package (it already understands things like f*ck, sh1t and fuuuck); the lists below only
// decide HOW SERIOUS a match is and add rules for harassment, threats, hate speech and
// personal information. Moderators can add or allow extra words at runtime (see
// /api/moderation/terms), so nothing here needs a redeploy to tweak.

// strikes each category adds. 3 or more means an automatic chat break on the first offence.
const WEIGHTS = {
    profanity: 1,
    sexual: 1,
    privacy: 1,
    harassment: 1,
    threat: 3,
    hate: 3,
    spam: 0, // blocked, but not a strike
};

// words from the obscenity list that are slurs aimed at people, so they count as hate speech
const HATE_WORDS = new Set([
    'abeed', 'abo', 'africoon', 'arabush', 'boonga', 'chingchong', 'chink', 'dyke',
    'fag', 'kike', 'negro', 'nigger', 'retard', 'spastic', 'tranny',
]);

// words from the obscenity list about sex or bodies
const SEXUAL_WORDS = new Set([
    'anal', 'anus', 'bestiality', 'blowjob', 'boob', 'buttplug', 'cum', 'deepthroat', 'dildo',
    'doggystyle', 'double penetration', 'ejaculate', 'felch', 'fellatio', 'finger bang', 'fisting',
    'gangbang', 'handjob', 'hentai', 'incest', 'jerk off', 'jizz', 'lubejob', 'masturbate',
    'orgasm', 'orgy', 'penis', 'porn', 'pussy', 'rape', 'scat', 'semen', 'sex', 'tit', 'vagina',
]);

const GROUPS =
    'jews?|jewish people|muslims?|christians?|hindus?|sikhs?|buddhists?|blacks?|black people|whites?|' +
    'white people|asians?|arabs?|mexicans?|latinos?|immigrants?|refugees?|gays?|lesbians?|queers?|' +
    'trans people|transgender people|trans kids|disabled people|autistic people|women|girls|men|boys';

const VIOLENT_VERBS = 'kill|murder|exterminate|eradicate|eliminate|gas|lynch|burn|hang|shoot|execute';

const DEMEANING_WORDS =
    'subhuman|vermin|animals|filth|disgusting|trash|scum|parasites|inferior|evil|stupid|dumb';

const GENDER_GROUPS = 'women|girls|men|boys|females?|males?';

// phrase rules, run on the cleaned lowercase text. Each: [category, regular expression, optional weight]
const PHRASE_RULES = [
    // hate speech aimed at groups of people
    ['hate', new RegExp(`\\b(?:${VIOLENT_VERBS})\\s+(?:all\\s+|every\\s+|the\\s+|those\\s+)*(?:${GROUPS})\\b`)],
    ['hate', new RegExp(`\\b(?:hate|despise)\\s+(?:all\\s+|every\\s+)(?:${GROUPS})\\b`)],
    ['hate', new RegExp(`\\b(?:${GROUPS})\\s+(?:are|r)\\s+(?:all\\s+)?(?:${DEMEANING_WORDS})\\b`), 2],
    ['hate', new RegExp(`\\b(?:${GENDER_GROUPS})\\s+(?:belong|should stay|need to stay|are only useful)\\s+(?:in|at|for)\\s+(?:the\\s+)?(?:kitchen|home|bedroom)\\b`)],
    ['hate', /\b(?:you|u)\s+(?:belong|should stay)\s+(?:in|at)\s+(?:the\s+)?(?:kitchen|home|bedroom)\b/],
    ['hate', /\b(?:go\s+)?(?:make|fetch)\s+(?:(?:me|us|him|her|them)\s+)?(?:a\s+)?(?:sandwich|sammich)\b/],
    ['hate', new RegExp(`\\b(?:${GENDER_GROUPS})\\s+(?:should|need to|have to)\\s+(?:stay home|cook|clean|serve men|serve women|be in the kitchen)\\b`)],
    ['hate', /\b(?:white power|white genocide|great replacement|race war|heil hitler|sieg heil|hitler was right|blood and soil|14 words|1488)\b/],

    // threats and telling people to hurt themselves
    // (the target has to be a person, so "I'll kill it at blackjack" is fine)
    ['threat', /\b(?:i|we)(?:'ll| will|'m going to| am going to|'m gonna| am gonna| gonna)\s+(?:kill|murder|shoot|stab|hurt|beat up|rape)\s+(?:you|u|ur|him|her|them|everyone|everybody|all of)\b/],
    ['threat', /\b(?:kill|murder|stab)\s+(?:you|u|ur|yourself|urself)\b/],
    ['threat', /\b(?:bomb|shoot up|blow up)\s+(?:the\s+|a\s+|my\s+)?(?:school|class|classroom|building)\b/],
    ['harassment', /\b(?:kys|kill yourself|kill urself|go die|neck yourself|end yourself|hope you die|hope u die|nobody likes you|nobody likes u)\b/, 3],

    // name calling and bullying
    ['harassment', /\b(?:you|u|ur|you're|youre)\s+(?:are\s+|r\s+)?(?:so\s+|such\s+|really\s+|very\s+)?(?:a\s+|an\s+)?(?:loser|ugly|stupid|dumb|idiot|moron|worthless|trash|freak|fat|pathetic|creep)\b/],
    ['harassment', /\bshut\s+(?:up|ur|your)\b/],

    // personal information and links (a safety rule for a space that younger people use)
    ['privacy', /\b(?:https?:\/\/|www\.)\S+/],
    ['privacy', /\b[a-z0-9-]{2,}\.(?:com|net|org|io|gg|tv|ly|me|co|xyz|app|dev|info|us|uk|ru|cn|to|cc|ws|link|site|online)\b/],
    ['privacy', /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/],
    ['privacy', /\bdot\s*(?:com|net|org)\b/],
    ['privacy', /\b(?:add|follow|dm|message|text|find|hmu|hit)\s+(?:me\s+)?(?:on\s+|at\s+)?(?:snap(?:chat)?|insta(?:gram)?|discord|tiktok|kik|telegram|whatsapp|facebook|twitter)\b/],
    ['privacy', /\b(?:what'?s|what is|whats)\s+(?:(?:ur|your)\s+)?(?:age|address|ip(?:\s+address)?|home address|street address|phone(?:\s+number)?|number|location|city|state|country|snap(?:chat)?|insta(?:gram)?|discord|school|grade|class|birthday|birthdate|real name|full name|last name)\b/],
    ['privacy', /\b(?:tell|send|share|give)\s+(?:me\s+)?(?:ur|your\s+)?(?:age|address|ip(?:\s+address)?|location|phone(?:\s+number)?|number|city|state|country|school|grade|birthday|birthdate|real name|full name|last name)\b/],
    ['privacy', /\b(?:where\s+do\s+(?:you|u)\s+(?:live|go to school)|how\s+old\s+are\s+(?:you|u)|what\s+(?:school|grade|city|town|country)\s+(?:do\s+)?(?:you|u)\s+(?:go to|live in|attend)|asl)\b/],
    ['privacy', /\b(?:are\s+(?:your\s+)?parents?\s+(?:home|away)|when\s+(?:are|is)\s+(?:you|u|your parents?)\s+(?:alone|away|out|home)|where\s+(?:are\s+)?(?:you|u)\s+(?:home|alone))\b/],
    ['sexual', /\b(?:send\s+(?:me\s+)?)?nudes?\b/, 2],
];

// a phone number is 9 or more digits, however they are spaced out
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){9,}/;

// IPv4 and colon-separated IPv6 addresses are sensitive network information
const IP_PATTERN = /\b(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4})\b/i;

// names nobody but staff may use, so nobody can pretend to be a moderator
const RESERVED_NAMES_EXACT = ['mod', 'staff', 'support', 'system', 'official', 'owner', 'bot'];
const RESERVED_NAME_PREFIXES = ['admin', 'moderator', 'worqarium', 'worquarium'];

module.exports = {
    WEIGHTS,
    HATE_WORDS,
    SEXUAL_WORDS,
    PHRASE_RULES,
    PHONE_PATTERN,
    RESERVED_NAMES_EXACT,
    RESERVED_NAME_PREFIXES,
    IP_PATTERN,
};
