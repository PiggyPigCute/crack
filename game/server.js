const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const cardValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const cardSuits = ['♠', '♥', '♦', '♣'];
const joker = '★'

const defaultSettings = {
  cardsPerHand: 2,
  handsPerPlayer: 1,
  nbrJokers: 0
};

const riverRevealSchedule = [0, 3, 4, 5]; // river cards revealed at turn 0, 1, 2, 3

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
      river: game.river.slice(0, riverRevealSchedule[game.turn]),
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
    game.tokens = {
      max: tokenMax,
      center: Array.from({length: tokenMax}, (_, i) => i + 1),                                     // tokens sitting in the middle of the table
      slots: Array.from({length: game.players.length}, () => Array(game.settings.handsPerPlayer).fill(null)), // token id in front of each hand, or null
      history: Array.from({length: game.players.length}, () => Array.from({length: game.settings.handsPerPlayer}, () => [])), // tokens recorded in front of each hand, turn after turn
    }

    // construction du deck
    const deck = [];
    cardValues.forEach(value => {
      cardSuits.forEach(suit => {
        deck.push({value: value, suit: suit})
      })
    })
    for (let i=0; i<game.settings.nbrJokers; i++) {
      deck.push({value: joker, suit: ''})
    }

    // mélange
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // distribution
    game.hands = []
    for (let p=0; p<game.players.length; p++) {
      let playerHands = []
      for (let h=0; h<game.settings.handsPerPlayer; h++) {
        playerHands.push(deck.splice(0, game.settings.cardsPerHand))
      }
      game.hands.push(playerHands)
    }

    // river
    game.river = deck.splice(0, 5)

    // initialize game
    game.inGame = true
    game.turn = 0

    spreadState();
  })

  socket.on('moveToken', ({ token, to } = {}) => {
    if (!game.inGame) return;                                          // tokens only move during a game
    if (role < 0) return;                                              // spectators can't move tokens
    const tokens = game.tokens;
    if (!tokens) return;
    if (!Number.isInteger(token) || token < 1 || token > tokens.max) return;

    // locate the token's current position
    const centerIndex = tokens.center.indexOf(token);
    let from = null; // { player, hand }, null when the token is in the center
    if (centerIndex == -1) {
      for (let p = 0; p < tokens.slots.length && !from; p++) {
        const h = tokens.slots[p].indexOf(token);
        if (h != -1) from = { player: p, hand: h };
      }
      if (!from) return; // unknown token position
    }

    if (to === 'center') {
      if (centerIndex != -1) return; // already in the center
      tokens.slots[from.player][from.hand] = null;
      tokens.center.push(token);
    } else {
      const { player, hand } = to || {};
      if (!tokens.slots[player] || tokens.slots[player][hand] === undefined) return;
      if (from && from.player == player && from.hand == hand) return; // dropped on itself

      const occupant = tokens.slots[player][hand];
      tokens.slots[player][hand] = token;
      if (centerIndex != -1) {
        tokens.center.splice(centerIndex, 1);
      } else {
        tokens.slots[from.player][from.hand] = null;
      }

      // swap: send the slot's previous occupant to where the dragged token came from
      if (occupant != null) {
        if (from) {
          tokens.slots[from.player][from.hand] = occupant;
        } else {
          tokens.center.push(occupant);
        }
      }
    }

    spreadState();
  });

  socket.on('nextTurn', () => {
    if (!game.inGame) return;                                      // only during a game
    if (role != 0) return;                                         // must be admin (role 0)
    if (game.tokens.center.length > 0) return;                     // every token must have been placed
    if (game.turn >= riverRevealSchedule.length - 1) return;        // already on the last turn

    // record the tokens currently placed in front of hands, and clear the slots
    for (let p = 0; p < game.tokens.slots.length; p++) {
      for (let h = 0; h < game.tokens.slots[p].length; h++) {
        const token = game.tokens.slots[p][h];
        if (token != null) {
          game.tokens.history[p][h].push(token);
          game.tokens.slots[p][h] = null;
        }
      }
    }

    // a fresh batch of tokens goes back to the center for the new turn
    game.tokens.center = Array.from({length: game.tokens.max}, (_, i) => i + 1);

    game.turn++;

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