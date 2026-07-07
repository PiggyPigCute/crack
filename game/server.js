const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ============================================================
// ETAT DU JEU (en mémoire, une seule partie possible)
// C'est le serveur qui fait autorité : c'est la SEULE source
// de vérité. Le client ne fait jamais confiance à lui-même.
// ============================================================
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

function nouvellePartie() {
  const deck = creerDeck();
  return {
    deck,
    mains: {
      joueur1: deck.splice(0, 5),
      joueur2: deck.splice(0, 5),
    },
    defausse: [],
    tour: 'joueur1', // à qui de jouer
    log: ['La partie commence.'],
  };
}

let partie = nouvellePartie();

// Association socket.id -> rôle ('joueur1' | 'joueur2' | 'spectateur')
const roles = new Map();
let joueur1Pris = false;
let joueur2Pris = false;

// ============================================================
// Construit une vue de l'état FILTRÉE selon le rôle du
// destinataire : un joueur ne voit jamais la main de l'autre.
// ============================================================
function vuePour(role) {
  return {
    maMain: role === 'joueur1' ? partie.mains.joueur1
          : role === 'joueur2' ? partie.mains.joueur2
          : null, // un spectateur ne voit aucune main
    nbCartesAdverse: role === 'joueur1' ? partie.mains.joueur2.length
                    : role === 'joueur2' ? partie.mains.joueur1.length
                    : null,
    nbCartesJoueur1: partie.mains.joueur1.length,
    nbCartesJoueur2: partie.mains.joueur2.length,
    defausse: partie.defausse,
    tour: partie.tour,
    cartesRestantesDansLeDeck: partie.deck.length,
    log: partie.log,
    monRole: role,
  };
}

// Envoie à CHAQUE client sa propre vue filtrée (pas un broadcast unique)
function diffuserEtat() {
  for (const [socketId, role] of roles.entries()) {
    io.to(socketId).emit('etatJeu', vuePour(role));
  }
}

io.on('connection', (socket) => {
  // --- Attribution du rôle à la connexion ---
  let role;
  if (!joueur1Pris) {
    role = 'joueur1';
    joueur1Pris = true;
  } else if (!joueur2Pris) {
    role = 'joueur2';
    joueur2Pris = true;
  } else {
    role = 'spectateur';
  }
  roles.set(socket.id, role);
  socket.emit('role', role);
  console.log(`Connexion ${socket.id} -> ${role}`);

  // Envoie l'état initial (filtré) juste à ce client
  socket.emit('etatJeu', vuePour(role));

  // --- Action : piocher une carte ---
  socket.on('piocherCarte', () => {
    // TOUJOURS revalider côté serveur, ne jamais faire confiance au client
    if (role !== partie.tour) return; // ce n'est pas son tour
    if (partie.deck.length === 0) return;

    const carte = partie.deck.pop();
    partie.mains[role].push(carte);
    partie.log.push(`${role} pioche une carte.`);
    diffuserEtat();
  });

  // --- Action : jouer une carte de sa main ---
  socket.on('jouerCarte', (carte) => {
    if (role !== partie.tour) return;

    const main = partie.mains[role];
    const index = main.indexOf(carte);
    if (index === -1) return; // le joueur n'a pas cette carte, on ignore

    main.splice(index, 1);
    partie.defausse.push(carte);
    partie.log.push(`${role} joue la carte ${carte}.`);

    // On passe le tour à l'autre joueur
    partie.tour = partie.tour === 'joueur1' ? 'joueur2' : 'joueur1';

    diffuserEtat();
  });

  // --- Redémarrer la partie (pratique pour tester) ---
  socket.on('nouvellePartie', () => {
    partie = nouvellePartie();
    diffuserEtat();
  });

  socket.on('disconnect', () => {
    const r = roles.get(socket.id);
    if (r === 'joueur1') joueur1Pris = false;
    if (r === 'joueur2') joueur2Pris = false;
    roles.delete(socket.id);
    console.log(`Déconnexion ${socket.id} (${r})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
