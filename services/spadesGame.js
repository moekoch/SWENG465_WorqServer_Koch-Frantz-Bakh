const SUITS = ['C', 'D', 'H', 'S'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));
const HAND_SIZE = 13;
const WINNING_SCORE = 500;

function shuffle(deck) {
    const cards = [...deck];
    for (let index = cards.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[other]] = [cards[other], cards[index]];
    }
    return cards;
}

function createDeck() {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({
        id: `${rank}${suit}`,
        rank,
        suit,
    })));
}

function sortedHand(hand) {
    return [...hand].sort((a, b) => {
        const suitOrder = SUITS.indexOf(b.suit) - SUITS.indexOf(a.suit);
        return suitOrder || RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
    });
}

function estimateBid(hand) {
    const suitCounts = Object.fromEntries(
        SUITS.map((suit) => [suit, hand.filter((card) => card.suit === suit).length]),
    );
    let points = Math.max(0, suitCounts.S - 3);

    for (const card of hand) {
        if (card.rank === 'A') points += 1;
        else if (card.rank === 'K') points += suitCounts[card.suit] > 1 ? 0.75 : 0.5;
        else if (card.rank === 'Q') points += suitCounts[card.suit] > 2 ? 0.4 : 0.15;
    }
    return Math.max(0, Math.min(13, Math.round(points)));
}

function createRound(players, {
    scores = [0, 0],
    bags = [0, 0],
    roundNumber = 1,
    dealer = Math.floor(Math.random() * 4),
    overtime = false,
    difficulty = 'medium',
} = {}) {
    return {
        players: players.map((player) => ({
            ...player,
            hand: [],
            bid: null,
            tricks: 0,
        })),
        scores,
        bags,
        roundNumber,
        dealer,
        overtime,
        difficulty,
        history: [],
        phase: 'dealing',
        bidSelection: 3,
        trick: [],
        trickNumber: 0,
        leadSuit: null,
        turn: dealer,
        spadesBroken: false,
        message: `${players[dealer].username} deals.`,
        handResult: [],
        yourTeamMadeBid: false,
        teamMadeBid: [false, false],
        popups: [],
    };
}

function createGame(players, difficulty) {
    return createRound(players, { difficulty });
}

function dealHand(game) {
    const deck = shuffle(createDeck());
    const players = game.players.map((player, index) => ({
        ...player,
        hand: sortedHand(deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)),
        bid: null,
        tricks: 0,
    }));
    const first = (game.dealer + 1) % 4;

    return {
        ...game,
        players,
        phase: 'bidding',
        bidSelection: estimateBid(players[0].hand),
        trick: [],
        trickNumber: 0,
        leadSuit: null,
        spadesBroken: false,
        history: [],
        turn: first,
        message: `Bidding starts with ${players[first].username}.`,
    };
}

function applyBid(game, playerIndex, bid) {
    const players = game.players.map((player, index) =>
        index === playerIndex ? { ...player, bid } : player,
    );
    if (players.every((player) => player.bid !== null)) {
        return {
            ...game,
            players,
            phase: 'playing',
            turn: game.dealer,
            message: `Bids are in. ${players[game.dealer].username} leads.`,
        };
    }

    const turn = (playerIndex + 1) % 4;
    return { ...game, players, turn, message: `${players[turn].username} to bid.` };
}

function legalCards(hand, trick, spadesBroken) {
    if (trick.length > 0) {
        const ledSuit = trick[0].card.suit;
        const followingSuit = hand.filter((card) => card.suit === ledSuit);
        return followingSuit.length ? followingSuit : hand;
    }

    if (!spadesBroken) {
        const nonSpades = hand.filter((card) => card.suit !== 'S');
        return nonSpades.length ? nonSpades : hand;
    }
    return hand;
}

function comparePlays(a, b, leadSuit) {
    const strength = (play) =>
        play.card.suit === 'S' ? 2 : play.card.suit === leadSuit ? 1 : 0;
    const firstStrength = strength(a);
    const secondStrength = strength(b);
    if (firstStrength !== secondStrength) return firstStrength - secondStrength;
    return RANK_VALUES[a.card.rank] - RANK_VALUES[b.card.rank];
}

function getTrickWinner(trick, leadSuit) {
    return trick.reduce((winner, play) =>
        comparePlays(play, winner, leadSuit) > 0 ? play : winner,
    ).playerIndex;
}

function playCard(game, playerIndex, cardId) {
    const player = game.players[playerIndex];
    const card = player?.hand.find((handCard) => handCard.id === cardId);
    if (!card || !legalCards(player.hand, game.trick, game.spadesBroken).some(
        (legalCard) => legalCard.id === cardId,
    )) {
        return null;
    }

    const players = game.players.map((entry, index) =>
        index === playerIndex
            ? { ...entry, hand: entry.hand.filter((handCard) => handCard.id !== cardId) }
            : entry,
    );
    const trick = [...game.trick, { playerIndex, card }];
    const turn = (playerIndex + 1) % 4;
    return {
        ...game,
        players,
        trick,
        turn,
        leadSuit: game.leadSuit || card.suit,
        spadesBroken: game.spadesBroken || card.suit === 'S',
        message: trick.length === 4
            ? 'Trick complete — determining the winner...'
            : `${players[turn].username} to play.`,
    };
}

function scoreHand(game, players) {
    const scores = [...game.scores];
    const bags = [...game.bags];
    const popups = [];
    const lines = [];
    const teamPlayers = (team) => (team === 0 ? [0, 2] : [1, 3]);
    const teamTricks = [0, 1].map((team) =>
        teamPlayers(team).reduce((sum, index) => sum + players[index].tricks, 0),
    );
    const teamMadeBid = [false, false];
    const boston = teamTricks.findIndex((tricks) => tricks === 13);

    if (boston !== -1) {
        scores[boston] += 100;
        teamMadeBid[boston] = true;
        popups.push({
            title: 'BOSTON!',
            body: `${boston === 0 ? 'Your team' : 'Them'} took all 13 tricks and scores +100. The other team scores 0 this hand.`,
        });
        lines.push(`BOSTON! ${boston === 0 ? 'Your team' : 'Them'} +100`);
        lines.push(`${boston === 0 ? 'Them' : 'Your team'} +0`);
        return { scores, bags, lines, popups, teamMadeBid };
    }

    [0, 1].forEach((team) => {
        const seats = teamPlayers(team);
        const bid = seats.reduce((sum, index) => sum + (players[index].bid || 0), 0);
        const nilSeats = seats.filter((index) => players[index].bid === 0);
        const nilTricks = nilSeats.reduce((sum, index) => sum + players[index].tricks, 0);
        const ordinaryTricks = Math.max(0, teamTricks[team] - nilTricks);
        const madeBid = ordinaryTricks >= bid;
        teamMadeBid[team] = madeBid;
        const details = [];
        const overtricks = Math.max(0, ordinaryTricks - bid);

        if (madeBid) {
            scores[team] += bid * 10 + overtricks;
            bags[team] += overtricks;
            if (bid > 0 || overtricks > 0) {
                details.push(`Bid ${bid}, took ${ordinaryTricks}${overtricks ? ` (${overtricks} ${overtricks === 1 ? 'bag' : 'bags'})` : ''}`);
            }
        } else {
            scores[team] -= bid * 10;
            details.push(`Bid ${bid}, took ${ordinaryTricks} — missed`);
        }

        nilSeats.forEach((index) => {
            const success = players[index].tricks === 0;
            scores[team] += success ? 100 : -100;
            details.push(`${players[index].username}: ${success ? 'NIL SUCCESS +100' : 'NIL FAILURE −100'}`);
        });

        if (bags[team] >= 10) {
            const penalties = Math.floor(bags[team] / 10);
            scores[team] -= penalties * 100;
            bags[team] -= penalties * 10;
            details.push(`BAG PENALTY −${penalties * 100}`);
            popups.push({
                title: 'BAG PENALTY',
                body: `${team === 0 ? 'Your team' : 'Them'} collected 10 bags and lose ${penalties * 100} points.`,
            });
        }

        lines.push(`${team === 0 ? 'Your team' : 'Them'} ${scores[team] >= game.scores[team] ? '+' : '−'}${Math.abs(scores[team] - game.scores[team])}`);
        details.forEach((detail) => lines.push(`   ${detail}`));
    });

    return { scores, bags, lines, popups, teamMadeBid };
}

function getGameStatus(scores) {
    if (Math.max(...scores) < WINNING_SCORE) return { over: false, overtime: false, winner: null };
    if (scores[0] === scores[1]) return { over: false, overtime: true, winner: null };
    return { over: true, overtime: false, winner: scores[0] > scores[1] ? 0 : 1 };
}

function finishTrick(game) {
    const winner = getTrickWinner(game.trick, game.leadSuit);
    const players = game.players.map((player, index) =>
        index === winner ? { ...player, tricks: player.tricks + 1 } : player,
    );
    const trickNumber = game.trickNumber + 1;
    const history = [...game.history, { trick: game.trick, leadSuit: game.leadSuit }];

    if (trickNumber === 13) {
        const scored = scoreHand(game, players);
        const status = getGameStatus(scored.scores);
        const popups = [...scored.popups];
        if (status.overtime && !game.overtime) {
            popups.push({
                title: 'OVERTIME',
                body: `Both teams are tied at ${scored.scores[0]}. Play continues until one team is ahead after a hand.`,
            });
        }
        return {
            ...game,
            players,
            history,
            scores: scored.scores,
            bags: scored.bags,
            handResult: scored.lines,
            teamMadeBid: scored.teamMadeBid,
            popups,
            overtime: status.overtime || (game.overtime && !status.over),
            phase: 'roundOver',
            trick: [],
            trickNumber,
            leadSuit: null,
            turn: winner,
            message: `Hand complete. ${players[winner].username} won the last trick.`,
        };
    }

    return {
        ...game,
        players,
        history,
        phase: 'playing',
        trick: [],
        trickNumber,
        leadSuit: null,
        turn: winner,
        message: `${players[winner].username} won the trick and leads.`,
    };
}

function chooseBotBid(game, playerIndex) {
    const hand = game.players[playerIndex].hand;
    const base = estimateBid(hand);
    if (game.difficulty === 'easy') {
        return Math.max(0, Math.min(13, base + Math.floor(Math.random() * 3) - 1));
    }
    if (game.difficulty === 'hard') {
        return Math.min(13, Math.round(base + (hand.filter((card) => card.suit === 'S').length > 4 ? 1 : 0)));
    }
    return base;
}

function chooseBotCard(game, playerIndex) {
    const hand = game.players[playerIndex].hand;
    const choices = legalCards(hand, game.trick, game.spadesBroken);
    if (game.difficulty === 'easy') return choices[Math.floor(Math.random() * choices.length)];
    const leadSuit = game.trick[0]?.card.suit;
    const strength = (card) => card.suit === 'S' ? 2 : card.suit === leadSuit ? 1 : 0;
    const currentWinner = game.trick.length
        ? game.trick.reduce((winner, play) =>
            comparePlays(play, winner, leadSuit) > 0 ? play : winner,
        )
        : null;
    const partnerWinning = currentWinner &&
        currentWinner.playerIndex % 2 === playerIndex % 2;
    if (partnerWinning) {
        return [...choices].sort((a, b) => RANK_VALUES[a.rank] - RANK_VALUES[b.rank])[0];
    }
    if (currentWinner && game.difficulty === 'hard') {
        const winners = choices.filter((card) =>
            comparePlays({ card }, currentWinner, leadSuit) > 0,
        );
        if (winners.length) {
            return [...winners].sort((a, b) =>
                (strength(a) - strength(b)) || (RANK_VALUES[a.rank] - RANK_VALUES[b.rank]),
            )[0];
        }
    }
    return [...choices].sort((a, b) =>
        (strength(a) - strength(b)) || (RANK_VALUES[a.rank] - RANK_VALUES[b.rank]),
    )[0];
}

function getPlayerState(game, playerId, matchStatus = 'playing') {
    const selfSeat = game.players.findIndex((player) => player.id === playerId);
    if (selfSeat < 0) return null;

    const ownTeam = selfSeat % 2;
    const status = getGameStatus(game.scores);
    let handResult = game.handResult;
    if (ownTeam === 1) {
        handResult = handResult.map((line) =>
            line.replaceAll('Your team', '__OPPONENT__').replaceAll('Them', 'Your team').replaceAll('__OPPONENT__', 'Them'),
        );
    }

    return {
        ...game,
        matchStatus,
        selfSeat,
        yourTeamMadeBid: game.teamMadeBid?.[ownTeam] ?? game.yourTeamMadeBid,
        players: game.players.map((player, index) => ({
            ...player,
            hand: index === selfSeat ? player.hand : [],
            handCount: player.hand.length,
        })),
        ownTeam,
        gameOver: status.over,
        winnerTeam: status.winner,
        handResult,
        bidSelection: game.phase === 'bidding' && game.turn === selfSeat
            ? estimateBid(game.players[selfSeat].hand)
            : game.bidSelection,
    };
}

module.exports = {
    applyBid,
    chooseBotBid,
    chooseBotCard,
    createGame,
    createRound,
    dealHand,
    finishTrick,
    getPlayerState,
    legalCards,
    playCard,
};
