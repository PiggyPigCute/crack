const socket = io();
let myRole = null;

els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  role: document.getElementById('role'),
  playersList: document.getElementById('players-list'),
  btnChangeName: document.getElementById('btn-change-name'),
  inputName: document.getElementById('input-name'),
  settingsPanel: document.getElementById('settings-panel'),
  myHands: document.getElementById('my-hands')
}

const suitClasses = {
  '♥': 'suit-heart',
  '♦': 'suit-diamond',
  '♠': 'suit-spade',
  '♣': 'suit-club',
};

function renderHands(hands) {
  els.myHands.innerHTML = '';

  hands.forEach(hand => {
    const handDiv = document.createElement('div');
    handDiv.className = 'hand';

    hand.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';

      if (card.suit) {
        cardDiv.classList.add(suitClasses[card.suit]);

        const valueEl = document.createElement('span');
        valueEl.className = 'card-value';
        valueEl.textContent = card.value;
        cardDiv.appendChild(valueEl);

        const suitEl = document.createElement('span');
        suitEl.className = 'card-suit';
        suitEl.textContent = card.suit;
        cardDiv.appendChild(suitEl);
      } else {
        cardDiv.classList.add('joker');
        cardDiv.title = 'Joker';

        const starEl = document.createElement('div');
        starEl.className = 'joker-star';
        cardDiv.appendChild(starEl);
      }

      handDiv.appendChild(cardDiv);
    });

    els.myHands.appendChild(handDiv);
  });
}

const settingsMeta = [
  { key: 'cardsPerHand', label: 'Cartes par main', min: 2 },
  { key: 'handsPerPlayer', label: 'Mains par joueur·euse', min: 1 },
  { key: 'nbrJokers', label: 'Nombre de jokers', min: 0 },
];

function renderSettingsPanel(settings, isAdmin) {
  els.settingsPanel.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = 'Paramètres de la partie';
  els.settingsPanel.appendChild(title);

  settingsMeta.forEach(meta => {
    const value = settings[meta.key];

    const row = document.createElement('div');
    row.className = 'setting-row';

    const label = document.createElement('span');
    label.textContent = meta.label + ' : ';
    row.appendChild(label);

    if (isAdmin) {
      const btnDec = document.createElement('button');
      btnDec.textContent = '-';
      btnDec.disabled = value <= meta.min;
      btnDec.onclick = () => socket.emit('updateSetting', { key: meta.key, value: value - 1 });
      row.appendChild(btnDec);
    }

    const val = document.createElement('span');
    val.textContent = value;
    row.appendChild(val);

    if (isAdmin) {
      const btnInc = document.createElement('button');
      btnInc.textContent = '+';
      btnInc.onclick = () => socket.emit('updateSetting', { key: meta.key, value: value + 1 });
      row.appendChild(btnInc);
    }

    els.settingsPanel.appendChild(row);
  });

  if (isAdmin) {
    const btnStart = document.createElement('div');
    btnStart.className = 'btn-start-game';
    btnStart.textContent = 'Jouer !';
    btnStart.onclick = () => socket.emit('startGame');
    els.settingsPanel.appendChild(btnStart);
  }
}

socket.on('role', (role) => {
  myRole = role;
  els.role.textContent = role;
});

socket.on('gameState', (view) => {

  console.log(view);
  
  if (view.inGame) {
    els.game.classList.remove("hidden");
    els.lobby.classList.add("hidden");

    if (myRole >= 0) renderHands(view.hand);
  } else {
    els.lobby.classList.remove("hidden");
    els.game.classList.add("hidden");

    // Settings panel (+ start button for admin)
    renderSettingsPanel(view.settings, myRole == 0);

    // player list
    els.playersList.innerHTML = '';
    view.players.forEach((player, role) => {
      const div = document.createElement('div');
      div.className = 'player-tag';
      div.textContent = player.name + ' ' + role;
      els.playersList.appendChild(div);
    });
  }
});

els.btnChangeName.onclick = () => {
  socket.emit('changeName', els.inputName.value);
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
