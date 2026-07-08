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
const deskSize = 52

const names = ['Adam', 'Adolphe', 'Adrien', 'Alexandre', 'Antoine', 'Arthur', 'Augustin', 'Aurélien', 'Baptiste', 'Benoît', 'Cédric', 'Claude', 'Charles', 'Denis', 'Émile', 'Émilien', 'François', 'Gabriel', 'Gauthier', 'Georges', 'Guillaume', 'Gustave', 'Henri', 'Hugo', 'Jean', 'Jérémie', 'Julien', 'Jules', 'Laurent', 'Léon', 'Louis', 'Lucas', 'Matthieu', 'Maxime', 'Nicolas', 'Olivier', 'Patrick', 'Paul', 'Pierre', 'Quentin', 'Raphaël', 'Sébastien', 'Simon', 'Stéphane', 'Théo', 'Thibault', 'Thimothée', 'Thomas', 'Valentin', 'Vivien', 'Adèle', 'Agathe', 'Alexia', 'Alice', 'Aliénor', 'Amélie', 'Anne', 'Arianne', 'Aude', 'Aurélie', 'Bérangère', 'Camille', 'Candice', 'Capucine', 'Caroline', 'Charlotte', 'Chloé', 'Doriane', 'Dorothée', 'Élisabeth', 'Émilie', 'Emma', 'Estelle', 'Faustine', 'Hélène', 'Jade', 'Jeanne', 'Julie', 'Juliette', 'Laure', 'Laura', 'Léa', 'Louise', 'Lucie', 'Margaux', 'Margueritte', 'Marianne', 'Marine', 'Mathilde', 'Marie', 'Maud', 'Morgane', 'Murielle', 'Myriam', 'Pauline', 'Romane', 'Roxane', 'Salomé', 'Valérie', 'Victoire']

const defaultSettings = {
  cardsPerHand: 3,
  handsPerPlayer: 2,
  nbrJokers: 2
};
const minSettings = {
  cardsPerHand: 1,
  handsPerPlayer: 1,
  nbrJokers: 0
};

const riverRevealSchedule = [0, 3, 4, 5];

// initialize game
let game = {
  inGame: false,
  players: [],
  disconnectedPlayers: [],
  settings: { ...defaultSettings }
};
const roles = new Map();

function viewFor(role) {
  if (game.inGame) {
    return {
      inGame: true,
      players: game.players,
      disconnectedPlayers: game.disconnectedPlayers,
      hand: (role == -1 || game.revealed) ? game.hands : game.hands[role],
      river: game.river.slice(0, riverRevealSchedule[game.turn]),
      tokens: game.tokens,
      turn: game.turn,
      ready: game.ready,
      revealed: game.revealed,
      settings: game.settings,
    }
  } else { // in lobby
    return {
      inGame: false,
      players: game.players,
      disconnectedPlayers: game.disconnectedPlayers,
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

function slotsFullFor(player) {
  return game.tokens.slots[player].every(token => token != null);
}

// record the tokens currently placed in front of hands, clear the slots, and start the next turn
function advanceToNextTurn() {
  for (let p = 0; p < game.tokens.slots.length; p++) {
    for (let h = 0; h < game.tokens.slots[p].length; h++) {
      const token = game.tokens.slots[p][h];
      if (token != null) {
        game.tokens.history[p][h].push({ token, turn: game.turn }); // shape of a recorded token depends on the turn it was placed
        game.tokens.slots[p][h] = null;
      }
    }
  }

  // a fresh batch of tokens goes back to the center for the new turn
  game.tokens.center = Array.from({length: game.tokens.max}, (_, i) => i + 1);

  game.turn++;
  game.ready = Array(game.players.length).fill(false);
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
        name: names[[Math.floor(Math.random() * names.length)]]
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
    const role = roles.get(socket.id); // roles.get, not the stale closure value: this socket's role may have shifted since it connected
    if (!game.players[role]) return;
    game.players[role].name = newName;
    spreadState()
  })

  socket.on('updateSetting', ({ key, value } = {}) => {
    const role = roles.get(socket.id);
    if (role != 0) return;                                        // must be admin (role 0)
    if (game.inGame) return;                                       // can't change settings during a game
    if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) return;
    if (!Number.isInteger(value) || value < minSettings[key]) return;

    game.settings[key] = value;
    spreadState();
  });

  socket.on('startGame', () => {
    console.log("Stating new game")
    const role = roles.get(socket.id);

    // verifications
    if (game.inGame) return;  // can't start a game during a game
    if (role != 0) return;    // must be admin (role 0) to start game
    if (game.settings.cardsPerHand * game.settings.handsPerPlayer * game.players.length > deskSize + game.settings.nbrJokers) return;

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
    game.revealed = false
    game.ready = Array(game.players.length).fill(false)

    spreadState();
  })

  socket.on('moveToken', ({ token, to } = {}) => {
    const role = roles.get(socket.id);
    if (!game.inGame) return;                                          // tokens only move during a game
    if (game.revealed) return;                                         // hands are already revealed, tokens are frozen
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

    // any player whose slot is touched here (emptied, filled, or swapped for a different
    // token) is no longer "ready", even if that slot ends up full again with a new token
    const touchedPlayers = new Set();
    if (from) touchedPlayers.add(from.player);

    if (to === 'center') {
      if (centerIndex != -1) return; // already in the center
      tokens.slots[from.player][from.hand] = null;
      tokens.center.push(token);
    } else {
      const { player, hand } = to || {};
      if (!tokens.slots[player] || tokens.slots[player][hand] === undefined) return;
      if (from && from.player == player && from.hand == hand) return; // dropped on itself
      touchedPlayers.add(player);

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

    for (const p of touchedPlayers) game.ready[p] = false;
    spreadState();
  });

  socket.on('toggleReady', () => {
    const role = roles.get(socket.id);
    if (!game.inGame) return;                                      // only during a game
    if (game.revealed) return;                                     // hands are already revealed
    if (role < 0) return;                                          // spectators don't play
    if (!slotsFullFor(role)) return;                                // can only toggle once every one of your slots is filled

    game.ready[role] = !game.ready[role];

    if (game.ready.length > 0 && game.ready.every(r => r)) {
      if (game.turn >= riverRevealSchedule.length - 1) {
        game.revealed = true;
      } else {
        advanceToNextTurn();
      }
    }

    spreadState();
  });

  socket.on('backToLobby', () => {
    const role = roles.get(socket.id);
    if (!game.inGame) return;                                      // only from an active game
    if (role != 0) return;                                         // must be admin (role 0)
    if (!game.revealed) return;                                    // only from the reveal screen

    // drop players who disconnected mid-game and never reconnected, compacting the roles that remain
    const oldToNew = new Map();
    const newPlayers = [];
    game.players.forEach((player, oldRole) => {
      if (game.disconnectedPlayers.includes(oldRole)) return;
      oldToNew.set(oldRole, newPlayers.length);
      newPlayers.push(player);
    });
    game.players = newPlayers;
    game.disconnectedPlayers = [];

    for (const [socketId, r] of roles.entries()) {
      if (r < 0) continue; // spectators are promoted below
      const newRole = oldToNew.get(r);
      if (newRole != r) {
        roles.set(socketId, newRole);
        io.to(socketId).emit('role', newRole);
      }
    }

    // spectators become active players too
    for (const [socketId, r] of roles.entries()) {
      if (r == -1) {
        const newRole = game.players.length;
        game.players.push({ name: "Joueur·euse " + newRole });
        roles.set(socketId, newRole);
        io.to(socketId).emit('role', newRole);
      }
    }

    game.inGame = false;

    spreadState();
  });

  socket.on('disconnect', () => {
    const r = roles.get(socket.id);
    roles.delete(socket.id);

    if (r >= 0) { // not a spectator
      if (game.inGame) {
        game.disconnectedPlayers.push(r)
      } else {
        // lobby: drop the player immediately and shift every later role down to fill the gap
        game.players.splice(r, 1);
        for (const [socketId, otherRole] of roles.entries()) {
          if (otherRole > r) {
            const newRole = otherRole - 1;
            roles.set(socketId, newRole);
            io.to(socketId).emit('role', newRole);
          }
        }
      }
    }

    console.log(`Déconnexion ${socket.id} (${r})`);
    spreadState();
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