const { getDB } = require('./database');

const GAMES = ['go-fish', 'blackjack', 'spades'];
const OUTCOMES = ['win', 'loss', 'draw'];

// the server records finished multiplayer matches itself (players can't make up a win over a friend)
async function recordMatchResults({ game, players }) {
    const now = new Date();
    const { ObjectId } = require('mongodb');
    const toId = (id) => (id instanceof ObjectId ? id : new ObjectId(String(id)));
    const docs = players.map((player) => {
        const opponent = players.find((other) => other.id !== player.id);
        return {
            userId: toId(player.id),
            game,
            opponentType: 'user',
            opponentId: opponent ? toId(opponent.id) : null,
            outcome: player.outcome,
            source: 'server',
            createdAt: now,
        };
    });
    if (docs.length) await getDB().collection('game_results').insertMany(docs);
}

// { played, wins, losses, draws, winRate } from a list of results
function summarize(results) {
    const wins = results.filter((result) => result.outcome === 'win').length;
    const losses = results.filter((result) => result.outcome === 'loss').length;
    const draws = results.filter((result) => result.outcome === 'draw').length;
    const played = results.length;
    return { played, wins, losses, draws, winRate: played ? Math.round((wins / played) * 100) : 0 };
}

// stats for one list of results, overall and per game
function summarizeByGame(results) {
    const byGame = {};
    for (const game of GAMES) {
        byGame[game] = summarize(results.filter((result) => result.game === game));
    }
    return { overall: summarize(results), byGame };
}

module.exports = { GAMES, OUTCOMES, recordMatchResults, summarize, summarizeByGame };
