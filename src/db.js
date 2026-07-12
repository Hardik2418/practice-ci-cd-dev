const { MongoClient } = require('mongodb');
const { randomUUID } = require('node:crypto');

async function createMongoStore(options = {}) {
  const uri = options.uri || 'mongodb://127.0.0.1:27017';
  const dbName = options.dbName || 'bytelogic';
  const client = new MongoClient(uri);

  await client.connect();

  const db = client.db(dbName);
  const players = db.collection('players');
  const tournaments = db.collection('tournaments');
  const tournamentPlayers = db.collection('tournamentPlayers');
  const matches = db.collection('matches');

  await Promise.all([
    players.createIndex({ id: 1 }, { unique: true }),
    players.createIndex({ name: 1 }, { unique: true }),
    tournaments.createIndex({ id: 1 }, { unique: true }),
    tournaments.createIndex({ name: 1 }, { unique: true }),
    tournamentPlayers.createIndex({ id: 1 }, { unique: true }),
    tournamentPlayers.createIndex({ tournamentId: 1, playerId: 1 }, { unique: true }),
    matches.createIndex({ tournamentId: 1, roundNumber: 1 })
  ]);

  return {
    close: () => client.close(),
    listPlayers: () => players.find({}).sort({ createdAt: -1 }).toArray(),
    getPlayer: id => players.findOne({ id }),
    createPlayer: async data => {
      const now = new Date();
      const player = {
        id: randomUUID(),
        name: data.name,
        rating: Number(data.rating),
        createdAt: now,
        updatedAt: now
      };

      await players.insertOne(player);
      return player;
    },
    updatePlayer: async (id, data) => {
      const update = {
        updatedAt: new Date()
      };

      if (data.name !== undefined) {
        update.name = data.name;
      }

      if (data.rating !== undefined) {
        update.rating = Number(data.rating);
      }

      await players.updateOne({ id }, { $set: update });
      return players.findOne({ id });
    },
    deletePlayer: async id => {
      await players.deleteOne({ id });
      await tournamentPlayers.deleteMany({ playerId: id });
      await matches.deleteMany({ $or: [{ player1Id: id }, { player2Id: id }, { winnerId: id }] });
    },
    listTournaments: () => tournaments.find({}).sort({ createdAt: -1 }).toArray(),
    getTournament: id => tournaments.findOne({ id }),
    createTournament: async data => {
      const now = new Date();
      const tournament = {
        id: randomUUID(),
        name: data.name,
        status: data.status || 'draft',
        createdAt: now,
        updatedAt: now
      };

      await tournaments.insertOne(tournament);
      return tournament;
    },
    updateTournament: async (id, data) => {
      const update = {
        updatedAt: new Date()
      };

      if (data.name !== undefined) {
        update.name = data.name;
      }

      if (data.status !== undefined) {
        update.status = data.status;
      }

      await tournaments.updateOne({ id }, { $set: update });
      return tournaments.findOne({ id });
    },
    deleteTournament: async id => {
      await tournaments.deleteOne({ id });
      await tournamentPlayers.deleteMany({ tournamentId: id });
      await matches.deleteMany({ tournamentId: id });
    },
    listTournamentPlayers: async tournamentId => {
      const entries = await tournamentPlayers.find({ tournamentId }).sort({ joinedAt: 1 }).toArray();
      const playerIds = entries.map(entry => entry.playerId);
      const playerDocs = await players.find({ id: { $in: playerIds } }).toArray();
      const playersById = new Map(playerDocs.map(player => [player.id, player]));

      return entries
        .map(entry => {
          const player = playersById.get(entry.playerId);

          if (!player) {
            return null;
          }

          return {
            id: entry.id,
            tournamentId: entry.tournamentId,
            playerId: entry.playerId,
            joinedAt: entry.joinedAt,
            eliminatedRound: entry.eliminatedRound,
            name: player.name,
            rating: player.rating
          };
        })
        .filter(Boolean);
    },
    addTournamentPlayer: async (tournamentId, playerId) => {
      const entry = {
        id: randomUUID(),
        tournamentId,
        playerId,
        joinedAt: new Date(),
        eliminatedRound: null
      };

      await tournamentPlayers.insertOne(entry);
      return entry;
    },
    setTournamentPlayerEliminatedRound: async (tournamentId, playerId, eliminatedRound) => {
      await tournamentPlayers.updateOne(
        { tournamentId, playerId },
        { $set: { eliminatedRound } }
      );
    },
    resetTournamentResults: async tournamentId => {
      await tournamentPlayers.updateMany({ tournamentId }, { $set: { eliminatedRound: null } });
      await matches.deleteMany({ tournamentId });
    },
    addMatch: async match => {
      const document = {
        id: randomUUID(),
        tournamentId: match.tournamentId,
        roundNumber: match.roundNumber,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        winnerId: match.winnerId,
        reason: match.reason,
        playedAt: new Date()
      };

      await matches.insertOne(document);
      return document;
    },
    listMatches: tournamentId => matches.find({ tournamentId }).sort({ roundNumber: 1, playedAt: 1 }).toArray()
  };
}

module.exports = {
  createMongoStore
};