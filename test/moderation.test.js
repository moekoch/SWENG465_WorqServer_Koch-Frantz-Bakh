const test = require('node:test');
const assert = require('node:assert');
const { moderateText, setCustomTerms } = require('../services/moderation');

const blocked = (text, kind) => moderateText(text, { kind }).allowed === false;

test('friendly messages go through', () => {
    for (const text of [
        'hello friend', 'Anyone up for a reef puzzle?', 'I love this tank!', 'good game :)',
        'Scunthorpe is a town', 'my class assignment is due', 'the bass was loud', 'I passed my test',
        'hell yeah', 'assistant', 'cocktail party', 'Dickens wrote books', 'you are not stupid',
        'see you at 5', 'room 12 is open', 'I have 2 cats and 3 fish',
        "I'll kill it at blackjack", 'kill the dealer lol', 'shoot you a message later', 'the shark ate a smaller fish',
    ]) {
        assert.strictEqual(blocked(text), false, `should allow: ${text}`);
    }
});

test('profanity is blocked, including common ways of hiding it', () => {
    for (const text of [
        'what the fuck', 'this is shit', 'sh1t', 'fuuuuuck', 'f.u.c.k', 'f u c k', 'f*ck this', 'sh*t', 'FUCK',
        'a s s h o l e', 'fu.ck', 'f-uck you', 'b!tch', 'fücк', 'f\u200Bu\u200Bck', 'what a bi7ch',
    ]) {
        assert.strictEqual(blocked(text), true, `should block: ${text}`);
    }
});

test('hate speech, threats and bullying are blocked with the right category', () => {
    assert.ok(moderateText('kill all jews').categories.includes('hate'));
    assert.ok(moderateText('heil hitler').categories.includes('hate'));
    assert.ok(moderateText('white power').categories.includes('hate'));
    assert.ok(moderateText('women are inferior').categories.includes('hate'));
    assert.ok(moderateText('women belong in the kitchen').categories.includes('hate'));
    assert.ok(moderateText('make me a sandwich').categories.includes('hate'));
    assert.ok(moderateText('girls should stay in the kitchen').categories.includes('hate'));
    assert.ok(moderateText('you belong in the kitchen').categories.includes('hate'));
    assert.ok(moderateText('go make me a sandwich').categories.includes('hate'));
    for (const text of [
        'faggot', 'dyke', 'coon', 'wetback', 'kike', 'towel head', 'mongoloid', 'retard',
        'redskin', 'shemale', 'whore', 'cracker',
    ]) {
        assert.ok(moderateText(text).categories.includes('hate'), `should block hate term: ${text}`);
    }
    assert.ok(moderateText('i will kill you').categories.includes('threat'));
    assert.ok(moderateText('kys').categories.includes('harassment'));
    assert.ok(moderateText('you are a loser').categories.includes('harassment'));
    assert.ok(moderateText('go kill yourself').categories.includes('harassment'));
});

test('creative appearance, weight and personal insults are blocked', () => {
    for (const text of [
        'you weigh 300lbs', 'you weigh 300 pounds', 'you look like a whale',
        'you are a blimp', 'you are obese', 'you are painfully ugly',
        'you have no friends', 'no one likes you', 'nobody wants you',
        'you look like a rat', 'you smell disgusting', 'you are adopted',
        'you are a burden', 'you are a waste', 'you are worthless',
        'you are a moron', 'you are completely clueless', 'you are a troll',
        'you have no talent', 'go drop dead', 'fuck off loser',
        'you are broke', 'you are poor', 'you are dirt poor',
        'stay in your tax bracket', 'you cannot afford a nice phone',
        'people in low income households are worthless',
    ]) {
        assert.ok(moderateText(text).categories.includes('harassment'), `should block insult: ${text}`);
    }

    assert.strictEqual(moderateText('you are not stupid').allowed, true);
    assert.strictEqual(moderateText('fat is an adjective in this sentence').allowed, true);
    assert.strictEqual(moderateText('I grew up in a low income household').allowed, true);
});

test('severe categories carry more weight than mild ones', () => {
    assert.strictEqual(moderateText('kill all muslims').weight, 3);
    assert.strictEqual(moderateText('this is shit').weight, 1);
    assert.strictEqual(moderateText('spam spam spam spam spam spam spam').weight, 0);
});

test('personal info and links are blocked in chat', () => {
    for (const text of [
        'visit www.example.com', 'go to https://evil.example/x', 'email me bob@example.com', 'call 555 123 4567',
        'my number is 5551234567', 'add me on snapchat', 'what is your address', 'asl?', 'check cool.gg', 'foo dot com',
        'what is your ip address', 'my ip is 192.168.1.25', 'send me your location',
        'what school do you go to', 'what city do you live in', 'tell me your real name',
        'what is your full name', 'what is your birthday', 'are your parents home',
        'send me your phone number', 'where are you alone',
    ]) {
        assert.strictEqual(blocked(text), true, `should block: ${text}`);
    }
});

test('shouting and stretched letters are tidied, not blocked', () => {
    assert.strictEqual(moderateText('HELLO EVERYONE HOW ARE YOU').text, 'Hello everyone how are you');
    assert.strictEqual(moderateText('heyyyyyyyyy').text, 'heyyy');
    assert.strictEqual(moderateText('  too    many   spaces ').text, 'too many spaces');
});

test('empty and too-long messages are refused', () => {
    assert.strictEqual(moderateText('   ').allowed, false);
    assert.strictEqual(moderateText('a'.repeat(121)).allowed, false);
    assert.strictEqual(moderateText('a'.repeat(120), { maxLength: 120 }).allowed, true);
});

test('usernames: offensive and reserved names are blocked, normal ones are fine', () => {
    assert.strictEqual(blocked('CoolFish_42', 'username'), false);
    assert.strictEqual(blocked('shit_head', 'username'), true);
    assert.strictEqual(blocked('f.u.c.k', 'username'), true);
    assert.strictEqual(blocked('Admin', 'username'), true);
    assert.strictEqual(blocked('xx_admin', 'username'), false);
    assert.strictEqual(blocked('Moderator_Jane', 'username'), true);
    assert.strictEqual(moderateText('Admin', { kind: 'username', allowReserved: true }).allowed, true);
    // links in a username are not a privacy problem for the filter itself (the route checks the character set)
    assert.strictEqual(blocked('modernfish', 'username'), false);
});

test('moderator-added terms block, and allowed terms are let through', () => {
    setCustomTerms({ block: ['blorptastic'], allow: ['scunthorpe'] });
    assert.strictEqual(blocked('that was blorptastic'), true);
    assert.strictEqual(blocked('b l o r p t a s t i c'), true);
    assert.strictEqual(blocked('blorptastic', 'username'), true);
    assert.strictEqual(blocked('I live in Scunthorpe'), false);
    setCustomTerms({ block: [], allow: [] });
    assert.strictEqual(blocked('that was blorptastic'), false);
});

test('the reason never repeats the blocked word', () => {
    const result = moderateText('you are a fucking idiot');
    assert.strictEqual(result.allowed, false);
    assert.ok(!/fuck|idiot/i.test(result.reason));
});
