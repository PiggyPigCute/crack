const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const vs = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const cs = ['♠', '♥', '♦', '♣'];
const joker = '★'

const defaultSettings = {
  cardsPerHand: 2,
  handsPerPlayer: 1,
  nbrJokers: 0
};

function newGame() {
  return {
    inGame: false,
    players: [],
    disconnectedPlayers: [],
    settings: { ...defaultSettings }
  }
}

let game = newGame();
const roles = new Map();

function viewFor(role) {
  if (game.inGame) {
    return {
      inGame: true,
      players: game.players,
      hand: role == -1 ? game.hands : game.hands[role],
      river: game.river,
      tokens: game.tokens,
      settings: game.settings,
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
  spreadState();

  socket.on('changeName', (newName) => {
    game.players[role].name = newName;
    spreadState()
  })

  socket.on('updateSetting', ({ key, value } = {}) => {
    if (role != 0) return;                                        // must be admin (role 0)
    if (game.inGame) return;                                       // can't change settings during a game
    if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) return;
    if (!Number.isInteger(value) || value < defaultSettings[key]) return;

    game.settings[key] = value;
    spreadState();
  });

  socket.on('newGame', () => {
    game = newGame();
    spreadState();
  });

  socket.on('startGame', () => {
    console.log("Stating new game")

    if (game.inGame) return;  // can't start a game during a game
    if (role != 0) return;    // must be admin (role 0) to start game
    
    // tokens
    const tokenMax = game.players.length * game.settings.handsPerPlayer
    game.token = {
      max: tokenMax,
      mid: new Set([...Array(tokenMax).keys()]),
      act: Array.from({length: game.players.length}, () => Array(game.settings.handsPerPlayer).fill(-1)),
      old: Array.from({length: game.players.length}, () => Array(game.settings.handsPerPlayer).fill([])),
    }

    // construction du deck
    const deck = [];
    vs.forEach(v => {
      cs.forEach(c => {
        deck.push({v:v, c:c})
      })
    })
    for (let i=0; i<game.settings.nbrJokers; i++) {
      deck.push({v:joker, c:''})
    }

    // mélange
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // distribution
    game.hands = []
    for (let p=0; p<game.players.length; p++) {
      let persoHands = []
      for (let h=0; h<game.settings.handsPerPlayer; h++) {
        persoHands.push(deck.splice(0, game.settings.cardsPerHand))
      }
      game.hands.push(persoHands)
    }

    // river
    game.river = deck.splice(0, 5)

    // initialize game
    game.inGame = true
    game.turn = 0

    spreadState();
  })

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