const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

function creerDeck() {
  const deck = [];
  for (let i = 1; i <= 20; i++) deck.push(i);
  // mélange
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function newGame() {
  return {
    inGame: false,
    players: [],
    disconnectedPlayers: [],
    settings: {
      handsPerPlayer: 1,
      nbrJokers: 0
    }
  }
}

let game = newGame();

const roles = new Map();

function viewFor(role) {
  if (game.inGame) {
    return {
      inGame: true,
      players: game.players,
      hand: role == -1 ? games.hands : game.hands[role],
      river: game.river,
      oldTokens: game.oldTokens,
      tokens: game.tokens
    }
  } else { // in lobby
    return {
      inGame: false,
      players: game.players,
      settings: game.settings
    }
  }
}

// Envoie à CHAQUE client sa propre vue filtrée (pas un broadcast unique)
function spreadState() {
  for (const [socketId, role] of roles.entries()) {
    io.to(socketId).emit('gameState', viewFor(role));
  }
}

io.on('connection', (socket) => {
  // --- Attribution du rôle à la connexion ---
  let role;
  if (game.disconnectedPlayers.length == 0) {
    if (game.inGame) {
      role = -1 // specatateur
    } else {
      role = game.players.length;
      players.push({
        name: "Joueur·euse " + role
      })
    }
  } else {
    role = game.disconnectedPlayers.pop()
  }
  
  roles.set(socket.id, role);
  socket.emit('role', role);
  console.log(`Connexion ${socket.id} -> ${role}`);

  // Envoie l'état initial (filtré) juste à ce client
  socket.emit('gameState', viewFor(role));

  // --- Action : piocher une carte ---
  socket.on('piocherCarte', () => {
    // TOUJOURS revalider côté serveur, ne jamais faire confiance au client
    if (role !== game.tour) return; // ce n'est pas son tour
    if (game.deck.length === 0) return;

    const carte = game.deck.pop();
    game.mains[role].push(carte);
    game.log.push(`${role} pioche une carte.`);
    spreadState();
  });

  // --- Action : jouer une carte de sa main ---
  socket.on('jouerCarte', (carte) => {
    if (role !== game.tour) return;

    const main = game.mains[role];
    const index = main.indexOf(carte);
    if (index === -1) return; // le joueur n'a pas cette carte, on ignore

    main.splice(index, 1);
    game.defausse.push(carte);
    game.log.push(`${role} joue la carte ${carte}.`);

    // On passe le tour à l'autre joueur
    game.tour = game.tour === 'joueur1' ? 'joueur2' : 'joueur1';

    spreadState();
  });

  // --- Redémarrer la game (pratique pour tester) ---
  socket.on('newGame', () => {
    game = newGame();
    spreadState();
  });

  socket.on('disconnect', () => {
    const r = roles.get(socket.id);
    if (r >= 0) { // not a spectator
      game.disconnectedPlayers.push(r)
    }
    roles.delete(socket.id);
    console.log(`Déconnexion ${socket.id} (${r})`);
  });
});

/* DEBUG afac */
app.get('/debug', (req, res) => {
  res.json(game);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
