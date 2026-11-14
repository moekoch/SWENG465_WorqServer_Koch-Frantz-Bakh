const { randomInt, randomUUID } = require('crypto');

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['C', 'D', 'H', 'S'];
const HAND_SIZE = 7;

function createDeck() {
    const deck = RANKS.flatMap((rank) => SUITS.map((suit) => {
        const code = `${rank}${suit}`;
        return { id: code, code, rank };
    }));

    for (let index = deck.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }

    return deck;
}

function collectBooks(player) {
    const counts = player.hand.reduce((result, card) => {
        result[card.rank] = (result[card.rank] || 0) + 1;
        return result;
    }, {});
    const completedRanks = Object.keys(counts).filter((rank) => counts[rank] === 4);

    if (completedRanks.length === 0) return;

    player.hand = player.hand.filter((card) => !completedRanks.includes(card.rank));
    player.books.push(...completedRanks);
}

function findPlayer(match, playerId) {
    return match.players.find((player) => player.id === playerId);
}

function getOpponent(match, playerId) {
    return match.players.find((player) => player.id !== playerId);
}

function finishIfNeeded(match) {
    const [first, second] = match.players;
    const allBooksCollected = first.books.length + second.books.length === RANKS.length;
    const noMoreMoves =
        match.deck.length === 0 &&
        (first.hand.length === 0 ||
            second.hand.length === 0 ||
            !first.hand.some((card) => second.hand.some((other) => other.rank === card.rank)));

    if (!allBooksCollected && !noMoreMoves) return;

    match.status = 'finished';
    match.winnerId =
        first.books.length === second.books.length
            ? null
            : first.books.length > second.books.length
                ? first.id
                : second.id;
    match.message = 'The game is over.';
}

function drawCard(match, player) {
    const card = match.deck.shift();
    if (!card) return null;

    player.hand.push(card);
    collectBooks(player);
    return card;
}

function prepareTurn(match) {
    const currentPlayer = findPlayer(match, match.turnUserId);
    if (currentPlayer && currentPlayer.hand.length === 0 && match.deck.length > 0) {
        drawCard(match, currentPlayer);
    }
}

function createMatch(firstPlayer, secondPlayer) {
    const deck = createDeck();
    const players = [firstPlayer, secondPlayer].map((player) => ({
        id: player.id,
        username: player.username,
        hand: deck.splice(0, HAND_SIZE),
        books: [],
    }));

    players.forEach(collectBooks);

    return {
        id: randomUUID(),
        players,
        deck,
        turnUserId: firstPlayer.id,
        status: 'playing',
        winnerId: null,
        message: 'A new game has started.',
        connectedUsers: new Map(),
    };
}

function applyAsk(match, playerId, rank) {
    if (match.status !== 'playing') {
        return { ok: false, error: 'This game is already over.' };
    }

    if (playerId !== match.turnUserId) {
        return { ok: false, error: 'It is not your turn.' };
    }

    if (!RANKS.includes(rank)) {
        return { ok: false, error: 'Choose a valid card rank.' };
    }

    const player = findPlayer(match, playerId);
    const opponent = getOpponent(match, playerId);
    if (!player || !opponent || !player.hand.some((card) => card.rank === rank)) {
        return { ok: false, error: 'You can only ask for a rank in your hand.' };
    }

    const matchingCards = opponent.hand.filter((card) => card.rank === rank);

    if (matchingCards.length > 0) {
        player.hand.push(...matchingCards);
        opponent.hand = opponent.hand.filter((card) => card.rank !== rank);
        collectBooks(player);
        match.message = `${player.username} got ${matchingCards.length} ${rank}${matchingCards.length === 1 ? '' : 's'} and asks again.`;
        prepareTurn(match);
    } else if (match.deck.length > 0) {
        const drawnCard = drawCard(match, player);
        if (drawnCard.rank === rank) {
            match.message = `${player.username} went fish and drew the rank they asked for. They ask again.`;
            prepareTurn(match);
        } else {
            match.turnUserId = opponent.id;
            match.message = `${player.username} went fish. ${opponent.username}'s turn.`;
            prepareTurn(match);
        }
    } else {
        match.turnUserId = opponent.id;
        match.message = `The deck is empty. ${opponent.username}'s turn.`;
        prepareTurn(match);
    }

    finishIfNeeded(match);
    return { ok: true };
}

function getPlayerState(match, playerId) {
    const player = findPlayer(match, playerId);
    const opponent = getOpponent(match, playerId);
    if (!player || !opponent) return null;

    const winnerMessage = match.winnerId === null
        ? "It's a tie!"
        : match.winnerId === playerId
            ? 'You win! You collected the most books.'
            : `${opponent.username} wins this round.`;

    return {
        matchId: match.id,
        status: match.status,
        selfId: player.id,
        hand: player.hand,
        books: player.books,
        opponent: {
            id: opponent.id,
            username: opponent.username,
            cardCount: opponent.hand.length,
            books: opponent.books.length,
            connected: match.connectedUsers.get(opponent.id) === true,
        },
        deckCount: match.deck.length,
        turnUserId: match.turnUserId,
        isYourTurn: match.status === 'playing' && match.turnUserId === playerId,
        winnerId: match.winnerId,
        message: match.status === 'finished' ? winnerMessage : match.message,
    };
}

module.exports = {
    applyAsk,
    createMatch,
    finishIfNeeded,
    getPlayerState,
};
