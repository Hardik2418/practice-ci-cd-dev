const express = require('express');
const path = require('node:path');

function buildApp(store) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/players', async (request, response, next) => {
    try {
      response.json(await store.listPlayers());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/players', async (request, response, next) => {
    try {
      const name = String(request.body.name || '').trim();
      const rating = Number(request.body.rating ?? 1200);

      if (!name) {
        response.status(400).json({ message: 'Player name is required.' });
        return;
      }

      const player = await store.createPlayer({ name, rating });
      response.status(201).json(player);
    } catch (error) {
      if (isDuplicateKey(error)) {
        response.status(409).json({ message: 'Player already exists.' });
        return;
      }

      next(error);
    }
  });

  app.get('/api/players/:id', async (request, response, next) => {
    try {
      const player = await store.getPlayer(request.params.id);

      if (!player) {
        response.status(404).json({ message: 'Player not found.' });
        return;
      }

      response.json(player);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/players/:id', async (request, response, next) => {
    try {
      const existing = await store.getPlayer(request.params.id);

      if (!existing) {
        response.status(404).json({ message: 'Player not found.' });
        return;
      }

      const name = request.body.name !== undefined ? String(request.body.name).trim() : existing.name;
      const rating = request.body.rating !== undefined ? Number(request.body.rating) : existing.rating;

      if (!name) {
        response.status(400).json({ message: 'Player name is required.' });
        return;
      }

      const player = await store.updatePlayer(request.params.id, { name, rating });
      response.json(player);
    } catch (error) {
      if (isDuplicateKey(error)) {
        response.status(409).json({ message: 'Player already exists.' });
        return;
      }

      next(error);
    }
  });

  app.delete('/api/players/:id', async (request, response, next) => {
    try {
      const existing = await store.getPlayer(request.params.id);

      if (!existing) {
        response.status(404).json({ message: 'Player not found.' });
        return;
      }

      await store.deletePlayer(request.params.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tournaments', async (request, response, next) => {
    try {
      response.json(await store.listTournaments());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tournaments', async (request, response, next) => {
    try {
      const name = String(request.body.name || '').trim();

      if (!name) {
        response.status(400).json({ message: 'Tournament name is required.' });
        return;
      }

      const tournament = await store.createTournament({ name, status: request.body.status });
      response.status(201).json(tournament);
    } catch (error) {
      if (isDuplicateKey(error)) {
        response.status(409).json({ message: 'Tournament already exists.' });
        return;
      }

      next(error);
    }
  });

  app.get('/api/tournaments/:id', async (request, response, next) => {
    try {
      const tournament = await store.getTournament(request.params.id);

      if (!tournament) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      response.json(tournament);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/tournaments/:id', async (request, response, next) => {
    try {
      const existing = await store.getTournament(request.params.id);

      if (!existing) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      const name = request.body.name !== undefined ? String(request.body.name).trim() : existing.name;
      const status = request.body.status !== undefined ? String(request.body.status).trim() : existing.status;

      if (!name) {
        response.status(400).json({ message: 'Tournament name is required.' });
        return;
      }

      const tournament = await store.updateTournament(request.params.id, { name, status });
      response.json(tournament);
    } catch (error) {
      if (isDuplicateKey(error)) {
        response.status(409).json({ message: 'Tournament already exists.' });
        return;
      }

      next(error);
    }
  });

  app.delete('/api/tournaments/:id', async (request, response, next) => {
    try {
      const existing = await store.getTournament(request.params.id);

      if (!existing) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      await store.deleteTournament(request.params.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tournaments/:id/players', async (request, response, next) => {
    try {
      const tournament = await store.getTournament(request.params.id);

      if (!tournament) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      response.json(await store.listTournamentPlayers(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tournaments/:id/players', async (request, response, next) => {
    try {
      const tournament = await store.getTournament(request.params.id);

      if (!tournament) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      const playerId = String(request.body.playerId || '').trim();
      const player = await store.getPlayer(playerId);

      if (!player) {
        response.status(404).json({ message: 'Player not found.' });
        return;
      }

      const entry = await store.addTournamentPlayer(request.params.id, playerId);
      response.status(201).json({
        id: entry.id,
        tournamentId: entry.tournamentId,
        playerId: entry.playerId,
        name: player.name,
        rating: player.rating,
        joinedAt: entry.joinedAt,
        eliminatedRound: entry.eliminatedRound
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        response.status(409).json({ message: 'Player already joined this tournament.' });
        return;
      }

      next(error);
    }
  });

  app.post('/api/tournaments/:id/simulate', async (request, response, next) => {
    try {
      const tournament = await store.getTournament(request.params.id);

      if (!tournament) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      const participants = await store.listTournamentPlayers(request.params.id);

      if (participants.length < 2) {
        response.status(400).json({ message: 'At least two players are required to simulate a tournament.' });
        return;
      }

      await store.resetTournamentResults(request.params.id);

      let roundNumber = 1;
      let currentRound = shuffle(participants);
      const matchResults = [];
      const eliminatedRound = new Map();

      while (currentRound.length > 1) {
        const nextRound = [];

        for (let index = 0; index < currentRound.length; index += 2) {
          const player1 = currentRound[index];
          const player2 = currentRound[index + 1];

          if (!player2) {
            nextRound.push(player1);
            matchResults.push({
              roundNumber,
              player1Id: player1.playerId,
              player2Id: null,
              winnerId: player1.playerId,
              reason: 'bye'
            });
            continue;
          }

          const winner = Math.random() < 0.5 ? player1 : player2;
          const loser = winner.playerId === player1.playerId ? player2 : player1;

          nextRound.push(winner);
          eliminatedRound.set(loser.playerId, roundNumber);
          matchResults.push({
            roundNumber,
            player1Id: player1.playerId,
            player2Id: player2.playerId,
            winnerId: winner.playerId,
            reason: 'match'
          });
        }

        currentRound = nextRound;
        roundNumber += 1;
      }

      const champion = currentRound[0];
      eliminatedRound.set(champion.playerId, roundNumber);

      for (const result of matchResults) {
        await store.addMatch({ tournamentId: request.params.id, ...result });
      }

      for (const [playerId, eliminated] of eliminatedRound.entries()) {
        await store.setTournamentPlayerEliminatedRound(request.params.id, playerId, eliminated);
      }

      await store.updateTournament(request.params.id, { status: 'completed' });

      const rankings = await buildRankings(store, request.params.id);
      response.json({
        tournamentId: request.params.id,
        champion: {
          id: champion.playerId,
          name: champion.name,
          rating: champion.rating
        },
        rankings,
        matchResults
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tournaments/:id/rankings', async (request, response, next) => {
    try {
      const tournament = await store.getTournament(request.params.id);

      if (!tournament) {
        response.status(404).json({ message: 'Tournament not found.' });
        return;
      }

      response.json((await buildRankings(store, request.params.id)).slice(0, 3));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, request, response, next) => {
    response.status(500).json({ message: 'Internal server error.', error: error.message });
  });

  return app;
}

async function buildRankings(store, tournamentId) {
  const participants = await store.listTournamentPlayers(tournamentId);
  const matches = await store.listMatches(tournamentId);
  const wins = new Map();
  const matchesPlayed = new Map();

  for (const match of matches) {
    wins.set(match.winnerId, (wins.get(match.winnerId) || 0) + 1);
    matchesPlayed.set(match.player1Id, (matchesPlayed.get(match.player1Id) || 0) + 1);

    if (match.player2Id) {
      matchesPlayed.set(match.player2Id, (matchesPlayed.get(match.player2Id) || 0) + 1);
    }
  }

  return participants
    .map(player => ({
      id: player.playerId,
      name: player.name,
      rating: player.rating,
      wins: wins.get(player.playerId) || 0,
      matchesPlayed: matchesPlayed.get(player.playerId) || 0,
      eliminatedRound: player.eliminatedRound || 0
    }))
    .sort((left, right) => {
      if (right.eliminatedRound !== left.eliminatedRound) {
        return right.eliminatedRound - left.eliminatedRound;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.rating !== left.rating) {
        return right.rating - left.rating;
      }

      return left.name.localeCompare(right.name);
    })
    .map((player, index) => ({
      rank: index + 1,
      ...player
    }));
}

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function isDuplicateKey(error) {
  return error && (error.code === 11000 || error.code === 11001);
}

module.exports = {
  buildApp,
  buildRankings
};