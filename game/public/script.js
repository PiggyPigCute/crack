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
  centerTokens: document.getElementById('center-tokens'),
  nextTurnContainer: document.getElementById('next-turn-container'),
  river: document.getElementById('river')
}

const suitClasses = {
  '♥': 'suit-heart',
  '♦': 'suit-diamond',
  '♠': 'suit-spade',
  '♣': 'suit-club',
};

function createCardEl(card) {
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

  return cardDiv;
}

function createRecordedTokenEl(token) {
  const el = document.createElement('div');
  el.className = 'token-recorded';
  el.textContent = token;
  return el;
}

function renderRiver(river) {
  els.river.innerHTML = '';
  river.forEach(card => els.river.appendChild(createCardEl(card)));
}

function renderHands(hands, tokens) {
  els.myHands.innerHTML = '';

  hands.forEach((hand, handIndex) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'hand-group';

    const slotEl = document.createElement('div');
    slotEl.className = 'token-slot hand-token-slot';
    makeDropTarget(slotEl, { player: myRole, hand: handIndex });

    const token = tokens.slots[myRole][handIndex];
    if (token != null) {
      slotEl.appendChild(getTokenEl(token));
    }
    groupDiv.appendChild(slotEl);

    const handDiv = document.createElement('div');
    handDiv.className = 'hand';

    const recorded = tokens.history[myRole][handIndex];
    if (recorded.length > 0) {
      const tokensRow = document.createElement('div');
      tokensRow.className = 'hand-tokens';
      recorded.forEach(recordedToken => tokensRow.appendChild(createRecordedTokenEl(recordedToken)));
      handDiv.appendChild(tokensRow);
    }

    const cardsRow = document.createElement('div');
    cardsRow.className = 'hand-cards';
    hand.forEach(card => cardsRow.appendChild(createCardEl(card)));
    handDiv.appendChild(cardsRow);

    groupDiv.appendChild(handDiv);
    els.myHands.appendChild(groupDiv);
  });
}

const tokenEls = new Map(); // token id -> persistent DOM element, so moves can be animated instead of recreated
const dropTargets = new WeakMap(); // element -> `to` value passed to the 'moveToken' socket event

function getTokenEl(token) {
  let tokenEl = tokenEls.get(token);
  if (!tokenEl) {
    tokenEl = document.createElement('div');
    tokenEl.className = 'token';
    tokenEl.textContent = token;
    tokenEl.draggable = true;
    tokenEl.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', token);
    };
    // native HTML5 drag & drop isn't available on touch devices, so drive it manually
    tokenEl.addEventListener('touchstart', (e) => startTokenTouchDrag(e, tokenEl, token), { passive: false });
    tokenEls.set(token, tokenEl);
  }
  return tokenEl;
}

// FLIP animation: snapshot token positions, run the render, then animate from old to new position
function animateTokens(renderTokens) {
  const oldRects = new Map();
  tokenEls.forEach((tokenEl, token) => {
    if (tokenEl.isConnected) oldRects.set(token, tokenEl.getBoundingClientRect());
  });

  renderTokens();

  tokenEls.forEach((tokenEl, token) => {
    const oldRect = oldRects.get(token);
    if (!oldRect || !tokenEl.isConnected) return;

    const newRect = tokenEl.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (!dx && !dy) return;

    tokenEl.style.transition = 'none';
    tokenEl.style.transform = `translate(${dx}px, ${dy}px)`;
    tokenEl.getBoundingClientRect(); // force reflow before re-enabling the transition
    tokenEl.style.transition = 'transform 0.25s ease';
    tokenEl.style.transform = '';
  });
}

function makeDropTarget(el, to) {
  dropTargets.set(el, to);

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

// walks up from the touch point until it finds a registered drop target (slot or center zone)
function findDropTarget(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el) {
    if (dropTargets.has(el)) return el;
    el = el.parentElement;
  }
  return null;
}

// touch equivalent of the native HTML5 drag & drop used above: drags a ghost copy of the
// token and, on release, emits the same 'moveToken' event as a desktop drop would.
function startTokenTouchDrag(e, tokenEl, token) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = tokenEl.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;

  const ghost = tokenEl.cloneNode(true);
  ghost.classList.add('token-ghost');
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);
  tokenEl.style.visibility = 'hidden';

  let currentTarget = null;

  function onTouchMove(ev) {
    ev.preventDefault();
    const t = ev.touches[0];
    ghost.style.left = `${t.clientX - offsetX}px`;
    ghost.style.top = `${t.clientY - offsetY}px`;

    const target = findDropTarget(t.clientX, t.clientY);
    if (target !== currentTarget) {
      if (currentTarget) currentTarget.classList.remove('drag-over');
      if (target) target.classList.add('drag-over');
      currentTarget = target;
    }
  }

  function endDrag() {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', endDrag);
    document.removeEventListener('touchcancel', endDrag);

    ghost.remove();
    tokenEl.style.visibility = '';

    if (currentTarget) {
      currentTarget.classList.remove('drag-over');
      socket.emit('moveToken', { token, to: dropTargets.get(currentTarget) });
    }
  }

  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', endDrag);
  document.addEventListener('touchcancel', endDrag);
}

makeDropTarget(els.centerTokens, 'center');

function renderCenterTokens(tokens) {
  els.centerTokens.innerHTML = '';

  for (let token = 1; token <= tokens.max; token++) {
    const slotEl = document.createElement('div');
    slotEl.className = 'token-slot';

    if (tokens.center.includes(token)) {
      slotEl.appendChild(getTokenEl(token));
    }

    els.centerTokens.appendChild(slotEl);
  }
}

function renderOpponents(players, tokens, disconnectedPlayers) {
  els.opponentsRow.innerHTML = '';

  players.forEach((player, playerIndex) => {
    if (playerIndex == myRole) return;

    const opponentDiv = document.createElement('div');
    opponentDiv.className = 'opponent';

    const nameEl = document.createElement('div');
    if (disconnectedPlayers.includes(playerIndex)) {
      nameEl.className = 'disconnected-opponent-name'
    } else {
      nameEl.className = 'opponent-name';
    }
    nameEl.textContent = player.name;
    opponentDiv.appendChild(nameEl);

    const recordedByHand = tokens.history[playerIndex];
    const handsDiv = document.createElement('div');
    handsDiv.className = 'opponent-hands';

    tokens.slots[playerIndex].forEach((token, hand) => {
      const handDiv = document.createElement('div');
      handDiv.className = 'opponent-hand';

      const recorded = recordedByHand[hand];
      if (recorded.length > 0) {
        const tokensEl = document.createElement('div');
        tokensEl.className = 'opponent-hand-tokens';
        recorded.forEach(recordedToken => tokensEl.appendChild(createRecordedTokenEl(recordedToken)));
        handDiv.appendChild(tokensEl);
      }

      const slotEl = document.createElement('div');
      slotEl.className = 'token-slot';
      makeDropTarget(slotEl, { player: playerIndex, hand });

      if (token != null) {
        slotEl.appendChild(getTokenEl(token));
      }
      handDiv.appendChild(slotEl);

      handsDiv.appendChild(handDiv);
    });

    opponentDiv.appendChild(handsDiv);
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
    btnStart.className = 'btn-primary';
    btnStart.textContent = 'Jouer !';
    btnStart.onclick = () => socket.emit('startGame');
    els.settingsPanel.appendChild(btnStart);
  }
}

function renderNextTurnButton(isAdmin, tokens, river) {
  els.nextTurnContainer.innerHTML = '';
  if (!isAdmin) return;

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Tour suivant';
  btn.disabled = tokens.center.length > 0 || river.length >= 5;
  btn.onclick = () => socket.emit('nextTurn');
  els.nextTurnContainer.appendChild(btn);
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
      animateTokens(() => {
        if (myRole >= 0) renderHands(view.hand, view.tokens);
        renderOpponents(view.players, view.tokens, view.disconnectedPlayers);
        renderCenterTokens(view.tokens);
      });
      renderNextTurnButton(myRole == 0, view.tokens, view.river);
    }

    renderRiver(view.river);
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

function submitNameChange() {
  socket.emit('changeName', els.inputName.value);
  els.inputName.value = '';
}

els.btnChangeName.onclick = submitNameChange;
els.inputName.onkeydown = (e) => {
  if (e.key === 'Enter') submitNameChange();
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
