const assert = require('node:assert');
const test = require('node:test');
const request = require('supertest');
const { buildApp } = require('../src/app');

function createTempStore() {
  const data = {
    players: [],
    tournaments: [],
    tournamentPlayers: [],
    matches: []
  };

  let nextId = 1;

  function generateId() {
    return String(nextId++);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    async close() {},
    async listPlayers() {
      return clone(data.players);
    },
    async getPlayer(id) {
      return clone(data.players.find(player => player.id === id));
    },
    async createPlayer(player) {
      const created = { id: generateId(), ...player };
      data.players.push(created);
      return clone(created);
    },
    async updatePlayer(id, player) {
      const index = data.players.findIndex(item => item.id === id);
      data.players[index] = { ...data.players[index], ...player };
      return clone(data.players[index]);
    },
    async deletePlayer(id) {
      data.players = data.players.filter(player => player.id !== id);
      data.tournamentPlayers = data.tournamentPlayers.filter(entry => entry.playerId !== id);
      data.matches = data.matches.filter(match => match.player1Id !== id && match.player2Id !== id && match.winnerId !== id);
    },
    async listTournaments() {
      return clone(data.tournaments);
    },
    async getTournament(id) {
      return clone(data.tournaments.find(tournament => tournament.id === id));
    },
    async createTournament(tournament) {
      const created = { id: generateId(), status: 'draft', ...tournament };
      data.tournaments.push(created);
      return clone(created);
    },
    async updateTournament(id, tournament) {
      const index = data.tournaments.findIndex(item => item.id === id);
      data.tournaments[index] = { ...data.tournaments[index], ...tournament };
      return clone(data.tournaments[index]);
    },
    async deleteTournament(id) {
      data.tournaments = data.tournaments.filter(tournament => tournament.id !== id);
      data.tournamentPlayers = data.tournamentPlayers.filter(entry => entry.tournamentId !== id);
      data.matches = data.matches.filter(match => match.tournamentId !== id);
    },
    async listTournamentPlayers(tournamentId) {
      return clone(
        data.tournamentPlayers
          .filter(entry => entry.tournamentId === tournamentId)
          .map(entry => {
            const player = data.players.find(item => item.id === entry.playerId);
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
      );
    },
    async addTournamentPlayer(tournamentId, playerId) {
      const entry = { id: generateId(), tournamentId, playerId, joinedAt: new Date(), eliminatedRound: null };
      data.tournamentPlayers.push(entry);
      return clone(entry);
    },
    async setTournamentPlayerEliminatedRound(tournamentId, playerId, eliminatedRound) {
      const entry = data.tournamentPlayers.find(item => item.tournamentId === tournamentId && item.playerId === playerId);
      entry.eliminatedRound = eliminatedRound;
    },
    async resetTournamentResults(tournamentId) {
      data.tournamentPlayers
        .filter(entry => entry.tournamentId === tournamentId)
        .forEach(entry => {
          entry.eliminatedRound = null;
        });
      data.matches = data.matches.filter(match => match.tournamentId !== tournamentId);
    },
    async addMatch(match) {
      const created = { id: generateId(), playedAt: new Date(), ...match };
      data.matches.push(created);
      return clone(created);
    },
    async listMatches(tournamentId) {
      return clone(data.matches.filter(match => match.tournamentId === tournamentId));
    }
  };
}

test('health endpoint responds', async () => {
  const store = createTempStore();
  const app = buildApp(store);

  try {
    const response = await request(app).get('/health');

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.body, { status: 'ok' });
  } finally {
    await store.close();
  }
});

test('player CRUD works', async () => {
  const store = createTempStore();
  const app = buildApp(store);

  try {
    const created = await request(app)
      .post('/api/players')
      .send({ name: 'Ada Lovelace', rating: 1800 });

    assert.strictEqual(created.statusCode, 201);
    assert.strictEqual(created.body.name, 'Ada Lovelace');

    const list = await request(app).get('/api/players');
    assert.strictEqual(list.body.length, 1);

    const updated = await request(app)
      .put(`/api/players/${created.body.id}`)
      .send({ rating: 1850 });

    assert.strictEqual(updated.statusCode, 200);
    assert.strictEqual(updated.body.rating, 1850);

    const removed = await request(app).delete(`/api/players/${created.body.id}`);
    assert.strictEqual(removed.statusCode, 204);
  } finally {
    await store.close();
  }
});

test('tournament simulation works with odd player counts', async () => {
  const store = createTempStore();
  const app = buildApp(store);

  try {
    const players = [];

    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      const created = await request(app)
        .post('/api/players')
        .send({ name, rating: 1500 });
      players.push(created.body);
    }

    const tournament = await request(app)
      .post('/api/tournaments')
      .send({ name: 'Odd Bracket Cup' });

    assert.strictEqual(tournament.statusCode, 201);

    for (const player of players) {
      const joined = await request(app)
        .post(`/api/tournaments/${tournament.body.id}/players`)
        .send({ playerId: player.id });

      assert.strictEqual(joined.statusCode, 201);
    }

    const simulation = await request(app)
      .post(`/api/tournaments/${tournament.body.id}/simulate`)
      .send({});

    assert.strictEqual(simulation.statusCode, 200);
    assert.strictEqual(simulation.body.tournamentId, tournament.body.id);
    assert.strictEqual(simulation.body.matchResults.length > 0, true);
    assert.strictEqual(simulation.body.rankings.length, 3);
    assert.ok(simulation.body.champion);

    const rankings = await request(app).get(`/api/tournaments/${tournament.body.id}/rankings`);
    assert.strictEqual(rankings.statusCode, 200);
    assert.strictEqual(rankings.body.length, 3);
  } finally {
    await store.close();
  }
});