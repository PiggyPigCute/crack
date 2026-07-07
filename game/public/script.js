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
  myHands: document.getElementById('my-hands'),
  opponentsRow: document.getElementById('opponents-row'),
  centerTokens: document.getElementById('center-tokens')
}

const suitClasses = {
  '♥': 'suit-heart',
  '♦': 'suit-diamond',
  '♠': 'suit-spade',
  '♣': 'suit-club',
};

function renderHands(hands, tokens) {
  els.myHands.innerHTML = '';

  hands.forEach((hand, handIndex) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'hand-group';

    const slotEl = document.createElement('div');
    slotEl.className = 'token-slot';
    makeDropTarget(slotEl, { player: myRole, hand: handIndex });

    const token = tokens.slots[myRole][handIndex];
    if (token != null) {
      slotEl.appendChild(createTokenEl(token));
    }
    groupDiv.appendChild(slotEl);

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

    groupDiv.appendChild(handDiv);
    els.myHands.appendChild(groupDiv);
  });
}

function createTokenEl(token) {
  const tokenEl = document.createElement('div');
  tokenEl.className = 'token';
  tokenEl.textContent = token;
  tokenEl.draggable = true;
  tokenEl.ondragstart = (e) => {
    e.dataTransfer.setData('text/plain', token);
  };
  return tokenEl;
}

function makeDropTarget(el, to) {
  el.ondragover = (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  };
  el.ondragleave = () => el.classList.remove('drag-over');
  el.ondrop = (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const token = Number(e.dataTransfer.getData('text/plain'));
    socket.emit('moveToken', { token, to });
  };
}

makeDropTarget(els.centerTokens, 'center');

function renderCenterTokens(tokens) {
  els.centerTokens.innerHTML = '';
  tokens.center.forEach(token => {
    els.centerTokens.appendChild(createTokenEl(token));
  });
}

function renderOpponents(players, tokens) {
  els.opponentsRow.innerHTML = '';

  players.forEach((player, playerIndex) => {
    if (playerIndex == myRole) return;

    const opponentDiv = document.createElement('div');
    opponentDiv.className = 'opponent';

    const nameEl = document.createElement('div');
    nameEl.className = 'opponent-name';
    nameEl.textContent = player.name;
    opponentDiv.appendChild(nameEl);

    const slotsDiv = document.createElement('div');
    slotsDiv.className = 'opponent-slots';

    tokens.slots[playerIndex].forEach((token, hand) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'token-slot';
      makeDropTarget(slotEl, { player: playerIndex, hand });

      if (token != null) {
        slotEl.appendChild(createTokenEl(token));
      }

      slotsDiv.appendChild(slotEl);
    });

    opponentDiv.appendChild(slotsDiv);
    els.opponentsRow.appendChild(opponentDiv);
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

    if (view.tokens) {
      if (myRole >= 0) renderHands(view.hand, view.tokens);
      renderOpponents(view.players, view.tokens);
      renderCenterTokens(view.tokens);
    }
  } else {
    els.lobby.classList.remove("hidden");
    els.game.classList.add("hidden");

    // Settings panel (+ start button for admin)
    renderSettingsPanel(view.settings, myRole == 0);

    // player list
    els.playersList.innerHTML = '';
    view.players.forEach((player) => {
      const div = document.createElement('div');
      div.className = 'player-tag';
      div.textContent = player.name;
      els.playersList.appendChild(div);
    });
  }
});

els.btnChangeName.onclick = () => {
  socket.emit('changeName', els.inputName.value);
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
