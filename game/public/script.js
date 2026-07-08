const socket = io();
let myRole = null;

els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  playersList: document.getElementById('players-list'),
  btnChangeName: document.getElementById('btn-change-name'),
  inputName: document.getElementById('input-name'),
  settingsPanel: document.getElementById('settings-panel'),
  myHands: document.getElementById('my-hands'),
  opponentsRow: document.getElementById('opponents-row'),
  centerTokens: document.getElementById('center-tokens'),
  nextTurnContainer: document.getElementById('next-turn-container'),
  river: document.getElementById('river'),
  reveal: document.getElementById('reveal'),
  revealBlocks: document.getElementById('reveal-blocks'),
  revealRiver: document.getElementById('reveal-river')
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

const shapeClasses = ['shape-square', 'shape-pentagon', 'shape-heptagon', 'shape-circle'];

function shapeClassForTurn(turn) {
  return shapeClasses[Math.min(turn, shapeClasses.length - 1)];
}

function setShape(el, turn) {
  el.classList.remove(...shapeClasses);
  el.classList.add(shapeClassForTurn(turn));
}

function createRecordedTokenEl(entry) {
  const el = document.createElement('div');
  el.className = 'token-recorded';
  el.textContent = entry.token;
  setShape(el, entry.turn);
  return el;
}

function renderRiver(container, river) {
  container.innerHTML = '';
  river.forEach(card => container.appendChild(createCardEl(card)));
}

function renderHands(hands, tokens, turn) {
  els.myHands.innerHTML = '';

  hands.forEach((hand, handIndex) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'hand-group';

    const slotEl = document.createElement('div');
    slotEl.className = 'token-slot hand-token-slot'; // wide landing zone, shape doesn't apply to it
    makeDropTarget(slotEl, { player: myRole, hand: handIndex });

    const token = tokens.slots[myRole][handIndex];
    if (token != null) {
      slotEl.appendChild(getTokenEl(token, turn));
    }
    groupDiv.appendChild(slotEl);

    const handDiv = document.createElement('div');
    handDiv.className = 'hand';

    const recorded = tokens.history[myRole][handIndex];
    if (recorded.length > 0) {
      const tokensRow = document.createElement('div');
      tokensRow.className = 'hand-tokens';
      recorded.forEach(entry => tokensRow.appendChild(createRecordedTokenEl(entry)));
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

function getTokenEl(token, turn) {
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
  setShape(tokenEl, turn);
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

function renderCenterTokens(tokens, turn) {
  els.centerTokens.innerHTML = '';

  for (let token = 1; token <= tokens.max; token++) {
    const slotEl = document.createElement('div');
    slotEl.className = 'token-slot';
    setShape(slotEl, turn);

    if (tokens.center.includes(token)) {
      slotEl.appendChild(getTokenEl(token, turn));
    }

    els.centerTokens.appendChild(slotEl);
  }
}

function renderOpponents(players, tokens, disconnectedPlayers, turn) {
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
        recorded.forEach(entry => tokensEl.appendChild(createRecordedTokenEl(entry)));
        handDiv.appendChild(tokensEl);
      }

      const slotEl = document.createElement('div');
      slotEl.className = 'token-slot';
      setShape(slotEl, turn);
      makeDropTarget(slotEl, { player: playerIndex, hand });

      if (token != null) {
        slotEl.appendChild(getTokenEl(token, turn));
      }
      handDiv.appendChild(slotEl);

      handsDiv.appendChild(handDiv);
    });

    opponentDiv.appendChild(handsDiv);
    els.opponentsRow.appendChild(opponentDiv);
  });
}

// third screen, after 'lobby' and 'game': every hand revealed, sorted by its turn-4 (circle) token
function renderReveal(view) {
  els.revealBlocks.innerHTML = '';

  const lastTurn = shapeClasses.length - 1; // circle

  const blocks = [];
  view.hand.forEach((playerHands, playerIndex) => {
    playerHands.forEach((hand, handIndex) => {
      blocks.push({
        player: view.players[playerIndex],
        hand,
        history: view.tokens.history[playerIndex][handIndex],
        finalToken: view.tokens.slots[playerIndex][handIndex], // turn-4 token, still sitting in its slot since it's never recorded to history
      });
    });
  });
  blocks.sort((a, b) => a.finalToken - b.finalToken);

  blocks.forEach(block => {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'reveal-block';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'reveal-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'reveal-name';
    nameEl.textContent = block.player.name;
    infoDiv.appendChild(nameEl);

    const historyEl = document.createElement('div');
    historyEl.className = 'reveal-history';
    block.history.forEach(entry => historyEl.appendChild(createRecordedTokenEl(entry)));
    infoDiv.appendChild(historyEl);

    blockDiv.appendChild(infoDiv);

    const finalTokenWrap = document.createElement('div');
    finalTokenWrap.className = 'reveal-final-token';
    finalTokenWrap.appendChild(getTokenEl(block.finalToken, lastTurn));
    blockDiv.appendChild(finalTokenWrap);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'hand-cards reveal-cards';
    block.hand.forEach(card => cardsRow.appendChild(createCardEl(card)));
    blockDiv.appendChild(cardsRow);

    els.revealBlocks.appendChild(blockDiv);
  });

  renderRiver(els.revealRiver, view.river);
}

const settingsMeta = [
  { key: 'cardsPerHand', label: 'Cartes par main', min: 1 },
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

function renderNextTurnButton(isAdmin, tokens, turn) {
  els.nextTurnContainer.innerHTML = '';
  if (!isAdmin) return;

  const isLastTurn = turn >= shapeClasses.length - 1; // circle turn: no more turns after this one, only the reveal

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = isLastTurn ? 'Révéler les jeux' : 'Tour suivant';
  btn.disabled = tokens.center.length > 0;
  btn.onclick = () => socket.emit(isLastTurn ? 'revealHands' : 'nextTurn');
  els.nextTurnContainer.appendChild(btn);
}

socket.on('role', (role) => {
  myRole = role;
});

socket.on('gameState', (view) => {

  console.log(view);

  if (view.revealed) {
    els.reveal.classList.remove("hidden");
    els.lobby.classList.add("hidden");
    els.game.classList.add("hidden");

    renderReveal(view);
    return;
  }
  els.reveal.classList.add("hidden");

  if (view.inGame) {
    els.game.classList.remove("hidden");
    els.lobby.classList.add("hidden");

    if (view.tokens) {
      animateTokens(() => {
        if (myRole >= 0) renderHands(view.hand, view.tokens, view.turn);
        renderOpponents(view.players, view.tokens, view.disconnectedPlayers, view.turn);
        renderCenterTokens(view.tokens, view.turn);
      });
      renderNextTurnButton(myRole == 0, view.tokens, view.turn);
    }

    renderRiver(els.river, view.river);
  } else {
    els.lobby.classList.remove("hidden");
    els.game.classList.add("hidden");

    // Settings panel (+ start button for admin)
    renderSettingsPanel(view.settings, myRole == 0);

    // player list
    els.playersList.innerHTML = '';
    const youDiv = document.createElement('div');
    youDiv.className = 'player-tag';
    youDiv.textContent = view.players[myRole].name + ' (Vous)';
    els.playersList.appendChild(youDiv);

    view.players.forEach((player, playerRole) => {
      if (playerRole != myRole) {
        const div = document.createElement('div');
        div.className = 'player-tag';
        div.textContent = player.name;
        els.playersList.appendChild(div);
      }
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
