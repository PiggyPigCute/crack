const socket = io();
let myRole = null;

els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  playersList: document.getElementById('players-list'),
  btnChangeName: document.getElementById('btn-change-name'),
  nameFormBottom: document.getElementById('name-form-bottom'),
  inputName: document.getElementById('input-name'),
  settingsPanel: document.getElementById('settings-panel'),
  myHands: document.getElementById('my-hands'),
  opponentsRow: document.getElementById('opponents-row'),
  centerTokens: document.getElementById('center-tokens'),
  nextTurnContainer: document.getElementById('next-turn-container'),
  river: document.getElementById('river'),
  reveal: document.getElementById('reveal'),
  revealLobbyContainer: document.getElementById('reveal-lobby-container'),
  revealBlocks: document.getElementById('reveal-blocks'),
  revealRiver: document.getElementById('reveal-river')
}

const cardValues = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
const cardSuits = ['♠', '♥', '♦', '♣'];
const joker = '★'
const pokerTypes = ['jokers','sf','four','full','flush','straight', 'three', 'twopair', 'pair','high']

const suitClasses = {
  '♥': 'suit-heart',
  '♦': 'suit-diamond',
  '♠': 'suit-spade',
  '♣': 'suit-club',
};

// for all the following comaparaison fonctions
// return 0 when equal hands
//        1 when poker1 better than poker2
//        2 when poker2 better than poker 1

function compareValues(v1, v2) {
  for (const v of cardValues) {
    if (v1==v && v2==v) {
      return 0
    } else if (v1 == v) {
      return 1
    } else if (v2 == v) {
      return 2
    }
  }
}

function compareKickers(k1, k2) {
  let i1 = 0;
  let i2 = 0;
  for (const v of cardValues) {
    if (k1[i1]==v && k2[i2]==v) {
      i1 ++;
      i2 ++;
      if (i1 == k1.length || i2 == k2.length) {
        return 0
      }
    } else if (k1[i1] == v) {
      return 1
    } else if (k2[i2] == v) {
      return 2
    }
  }
}

function comparePokers(poker1, poker2) {
  let cmp;
  for (const type of pokerTypes) {
    if (poker1.type == type && poker2.type == type) {
      switch (type) {
        case 'jokers': return 0
        case 'sf': return compareValues(poker1.top,poker2.top);
        case 'four':
          cmp = compareValues(poker1.four,poker2.four);
          return cmp ? cmp : compareKickers(poker1.kicker,poker2.kicker);
        case 'full':
          cmp = compareValues(poker1.three,poker2.three);
          return cmp ? cmp : compareValues(poker1.pair,poker2.pair);
        case 'flush':
          return compareKickers(poker1.hand,poker2.hand);
        case 'straight':
          return compareValues(poker1.top,poker2.top);
        case 'three':
          cmp = compareValues(poker1.three,poker2.three);
          return cmp ? cmp : compareKickers(poker1.kicker,poker2.kicker);
        case 'twopair':
          cmp = compareValues(poker1.first,poker2.first);
          if (cmp) {
            return cmp
          } else {
            let cmp = compareValues(poker1.second,poker2.second);
            return cmp ? cmp : compareKickers(poker1.kicker,poker2.kicker);
          };
        case 'pair':
          cmp = compareValues(poker1.pair,poker2.pair);
          return cmp ? cmp : compareKickers(poker1.kicker,poker2.kicker);
        default:
          return compareKickers(poker1.kicker,poker2.kicker)
      }
    } else if (poker1.type == type) {
      return 1
    } else if (poker2.type == type) {
      return 2
    }
  }
}

function computeKicker(values, size, without=[]) {
  let result = [];
  for (const v of cardValues) {
    if (!without.includes(v)) {
      if (values[v]>0) result.push(v);
      if (result.length == size) return result;
    }
  }
  return result
}

function searchStraight(values, nbrJokers) {
  // if straight ? value : null
  let count = ('A' in values) + ('K' in values) + ('Q' in values) + ('J' in values);
  for (let i=0; i <= cardValues.length - 5; i++) {
    count += (cardValues[i+4] in values);
    if (count + nbrJokers >= 5) {
      return cardValues[i]
    }
    count -= (cardValues[i] in values);
  }
  if (count + nbrJokers >= 4 && ('A' in values)) { // straige A2345
    return '5'
  }
  return null // no straight
}

function computePoker(cards) {
  let nbrJokers = 0;
  let suits = {};
  let values = {};
  cards.forEach(c => {
    if (c.suit) {
      suits[c.suit] = 1 + suits[c.suit] || 1;
      values[c.value] = 1 + values[c.value] || 1;
    } else {
      nbrJokers ++;
    }
  });

  // 5 jokers
  if (nbrJokers >= 5 || nbrJokers == cards.length) {
    return {type:'jokers'}
  }

  // high card
  let poker = {type:'high', kicker:computeKicker(values, 5)};
  let newPoker;

  // straight flushs (and flush)
  cardSuits.forEach(s => {
    if (suits[s] + nbrJokers >= 5) {
      let flushValues = {};
      cards.forEach(c => {
        if (c.suit == s) {
          flushValues[c.value] = 1 + flushValues[c.value] || 1;
        }
      });

      let straightFlush = searchStraight(flushValues, nbrJokers);
      if (straightFlush) {
        newPoker = {type:'sf',top:straightFlush,suit:s};
      } else {
        let i = nbrJokers;
        cardValues.forEach(v => {
          if (i>0 && !flushValues[v]) {
            i --;
            flushValues[v] = 1;
          }
        });
        newPoker = {type:'flush',suit:s,hand:computeKicker(flushValues,5)}
      }
      
      if (comparePokers(poker,newPoker) == 2) {
        poker = newPoker;
      }
    }
  })
  if (poker.type == 'sf') return poker;

  // four
  for (const v of cardValues) {
    if (values[v] + nbrJokers >= 4) {
      return {type:'four', four:v, kicker:computeKicker(values,1,[v])}
    }
  }

  // full (and three)
  for (const v of cardValues) {
    if (values[v] + nbrJokers == 3) {
      for (const w of cardValues) {
        if (v != w && values[w] == 2) {
          return {type:'full', three:v, pair:w}
        }
      }
      newPoker = {type:'three', three:v, kicker:computeKicker(values,2,[v])}
      if (comparePokers(poker,newPoker) == 2) {
        poker = newPoker;
      }
    }
  }

  // flush
  if (poker.type == 'flush') return poker;

  // straight
  let straight = searchStraight(values, nbrJokers);
  if (straight) {
    return {type:'straight', top:straight}
  }

  // three
  if (poker.type == 'three') return poker;

  // twopairs (and pairs)
  let pair = null
  for (const v of cardValues) {
    if (values[v] + nbrJokers == 2) {
      if (pair) {
        if (nbrJokers == 0) {
          return {type:'twopair', first:pair, second:v, kicker:computeKicker(values, 1, [pair,v])}
        }
      } else {
        pair = v
      }
    }
  }

  // pairs
  if (pair) return {type:'pair', pair:pair, kicker:computeKicker(values, 3, [pair])}

  // high card
  return poker
}

function displayPoker(poker) {
  switch (poker.type) {
    case 'jokers': return "<strong>Abus Absolu"
    case 'sf': return "<strong>Quinte Flush à " + poker.top + poker.suit + "</strong>";
    case 'four': return "<strong>Carré de " + poker.four + "</strong>, puis " + poker.kicker[0];
    case 'full': return "<strong>Full aux " + poker.three + " par les " + poker.pair + "</strong>";
    case 'flush': return "<strong>Couleur à " + poker.suit + "</strong> avec " + poker.hand.join(', ');
    case 'straight': return "<strong>Suite au " + poker.top + "</strong>"
    case 'three': return "<strong>Brelan de " + poker.three + "</strong>, puis " + poker.kicker.join(', ')
    case 'twopair': return "<strong>Double paire " + poker.first + " et " + poker.second + "</strong>, puis " + poker.kicker[0];
    case 'pair': return "<strong>Paire de " + poker.pair + "</strong>, puis " + poker.kicker.join(', ')
    default: return "<strong>Carte haute " + poker.kicker[0] + "</strong>, " + poker.kicker.slice(1).join(', ')
  }
}


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

function renderHands(hands, tokens, turn, river) {
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

    const pokerText = document.createElement('div');
    pokerText.className = 'poker';
    pokerText.innerHTML = displayPoker(computePoker([...hand, ...river]))

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

function renderOpponents(players, tokens, disconnectedPlayers, ready, turn) {
  els.opponentsRow.innerHTML = '';

  players.forEach((player, playerIndex) => {
    if (playerIndex == myRole) return;

    const opponentDiv = document.createElement('div');
    opponentDiv.className = 'opponent';

    const nameRow = document.createElement('div');
    nameRow.className = 'opponent-name-row';

    const nameEl = document.createElement('span');
    if (disconnectedPlayers.includes(playerIndex)) {
      nameEl.className = 'disconnected-opponent-name'
    } else {
      nameEl.className = 'opponent-name';
    }
    nameEl.textContent = player.name;
    nameRow.appendChild(nameEl);

    if (ready[playerIndex]) {
      const readyEl = document.createElement('span');
      readyEl.className = 'ready-check';
      readyEl.textContent = '✓';
      nameRow.appendChild(readyEl);
    }

    opponentDiv.appendChild(nameRow);

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
        poker: computePoker([...hand, ...view.river]),
        history: view.tokens.history[playerIndex][handIndex],
        finalToken: view.tokens.slots[playerIndex][handIndex],
      });
    });
  });
  blocks.sort((a, b) => a.finalToken - b.finalToken);

  blocks.forEach((block, index) => {
    const previousBlock = blocks[index - 1];
    const nextBlock = blocks[index + 1];
    const isMisranked = (previousBlock && comparePokers(block.poker, previousBlock.poker) == 2)
      || (nextBlock && comparePokers(block.poker, nextBlock.poker) == 1);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'reveal-block';

    const mainRow = document.createElement('div');
    mainRow.className = 'reveal-block-main';

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

    mainRow.appendChild(infoDiv);

    const finalTokenWrap = document.createElement('div');
    finalTokenWrap.className = 'reveal-final-token';
    if (isMisranked) finalTokenWrap.classList.add('reveal-final-token-error');
    finalTokenWrap.appendChild(getTokenEl(block.finalToken, lastTurn));
    mainRow.appendChild(finalTokenWrap);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'hand-cards reveal-cards';
    block.hand.forEach(card => cardsRow.appendChild(createCardEl(card)));
    mainRow.appendChild(cardsRow);

    blockDiv.appendChild(mainRow);

    const pokerEl = document.createElement('div');
    pokerEl.className = 'poker';
    pokerEl.innerHTML = displayPoker(block.poker);
    blockDiv.appendChild(pokerEl);

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

function renderOkButton(tokens, ready) {
  els.nextTurnContainer.innerHTML = '';
  if (myRole < 0) return; // spectators don't play

  const slotsFull = tokens.slots[myRole].every(token => token != null);
  const isReady = !!ready[myRole];

  const btn = document.createElement('button');
  btn.className = 'btn-primary' + (isReady ? ' is-ready' : '');
  btn.textContent = isReady ? 'Ok ✓' : 'Ok';
  btn.disabled = !slotsFull;
  btn.onclick = () => socket.emit('toggleReady');
  els.nextTurnContainer.appendChild(btn);
}

function renderBackToLobbyButton(isAdmin) {
  els.revealLobbyContainer.innerHTML = '';
  if (!isAdmin) return;

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Lobby';
  btn.onclick = () => socket.emit('backToLobby');
  els.revealLobbyContainer.appendChild(btn);
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
    renderBackToLobbyButton(myRole == 0);
    return;
  }
  els.reveal.classList.add("hidden");

  if (view.inGame) {
    els.game.classList.remove("hidden");
    els.lobby.classList.add("hidden");

    if (view.tokens) {
      animateTokens(() => {
        if (myRole >= 0) renderHands(view.hand, view.tokens, view.turn, view.river);
        renderOpponents(view.players, view.tokens, view.disconnectedPlayers, view.ready, view.turn);
        renderCenterTokens(view.tokens, view.turn);
      });
      renderOkButton(view.tokens, view.ready);
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
    youDiv.innerHTML = view.players[myRole].name + ' <strong>(Vous)</strong>';
    els.playersList.appendChild(youDiv);

    view.players.forEach((player, playerRole) => {
      if (playerRole != myRole) {
        const div = document.createElement('div');
        div.className = 'player-tag';
        div.textContent = player.name;
        els.playersList.appendChild(div);
      }
    });

    // "Votre nom actul est "
    els.nameFormBottom.innerHTML = 'Votre nom actuel est ' + view.players[myRole].name
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
