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
      game.players.push({
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

  socket.on('changeName', (newName) => {
    game.players[role].name = newName;
    spreadState()
  })

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
