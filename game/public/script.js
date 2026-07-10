const socket = io();
let myRole = null;

els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  playersList: document.getElementById('players-list'),
  spectatorsSection: document.getElementById('spectators-section'),
  spectatorsList: document.getElementById('spectators-list'),
  btnJoinGame: document.getElementById('btn-join-game'),
  btnBecomeSpectator: document.getElementById('btn-become-spectator'),
  btnChangeName: document.getElementById('btn-change-name'),
  nameFormBottom: document.getElementById('name-form-bottom'),
  avatarPickerImg: document.getElementById('avatar-picker-img'),
  btnAvatarPrev: document.getElementById('btn-avatar-prev'),
  btnAvatarNext: document.getElementById('btn-avatar-next'),
  inputName: document.getElementById('input-name'),
  settingsPanel: document.getElementById('settings-panel'),
  myHands: document.getElementById('my-hands'),
  opponentsRow: document.getElementById('opponents-row'),
  centerTokens: document.getElementById('center-tokens'),
  nextTurnContainer: document.getElementById('next-turn-container'),
  riverDeck: document.getElementById('river-deck'),
  riverSlots: document.getElementById('river-slots'),
  reveal: document.getElementById('reveal'),
  revealLobbyContainer: document.getElementById('reveal-lobby-container'),
  revealBlocks: document.getElementById('reveal-blocks'),
  revealRiver: document.getElementById('reveal-river'),
  chat: document.getElementById('chat'),
  chatToggle: document.getElementById('chat-toggle'),
  chatBadge: document.getElementById('chat-badge'),
  chatPreview: document.getElementById('chat-preview'),
  chatPanel: document.getElementById('chat-panel'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input')
}

const cardValues = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
const cardSuits = ['♠', '♥', '♦', '♣'];
const joker = '★'
const pokerTypes = ['jokers','five','sf','four','full','flush','straight', 'three', 'twopair', 'pair','high']

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
        case 'five': return compareValues(poker1.five,poker2.five);
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
  console.log("Computing poker hand...")

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

  // five
  for (const v of cardValues) {
    if (values[v] + nbrJokers >= 5) {
      return {type:'five', five:v}
    }
  }

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
    case 'jokers': return "<strong>Abus Absolu</strong>";
    case 'five': return "<strong>Pentagone de " + poker.five + '</strong>';
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

function createAvatarEl(avatar) {
  const img = document.createElement('img');
  img.className = 'avatar';
  img.src = `imgs/animals/${avatar}.svg`;
  img.alt = '';
  return img;
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

function createCardBackEl() {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card card-back';
  return cardDiv;
}

// a card shown face-down that can later be flipped face-up with a 3D turn animation;
// both faces are built upfront (the front is simply hidden behind the back until flipped)
function createFlipCardEl(card, startRevealed) {
  const flipEl = document.createElement('div');
  flipEl.className = 'card card-flip' + (startRevealed ? ' is-flipped' : '');

  const innerEl = document.createElement('div');
  innerEl.className = 'card-flip-inner';

  const backEl = createCardBackEl();
  backEl.classList.add('card-face');
  innerEl.appendChild(backEl);

  const frontEl = createCardEl(card);
  frontEl.classList.add('card-face', 'card-face-front');
  innerEl.appendChild(frontEl);

  flipEl.appendChild(innerEl);
  return flipEl;
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

const riverSize = 5;
const riverRevealCounts = new WeakMap(); // container -> number of cards shown last render, to spot newly-revealed ones

// slides (and lightly flips) a freshly-dealt/revealed card in from the deck's position to its slot
function animateCardFromDeck(cardEl, deckRect) {
  const targetRect = cardEl.getBoundingClientRect();
  const dx = deckRect.left - targetRect.left;
  const dy = deckRect.top - targetRect.top;

  cardEl.style.transition = 'none';
  cardEl.style.transform = `translate(${dx}px, ${dy}px) rotateY(90deg)`;
  cardEl.style.opacity = '0';
  cardEl.getBoundingClientRect(); // force reflow before re-enabling the transition
  cardEl.style.transition = 'transform 0.45s ease, opacity 0.25s ease';
  cardEl.style.transform = '';
  cardEl.style.opacity = '';
}

// `deckEl`, when given, is the source the newly-revealed cards animate in from
function renderRiver(container, river, deckEl = null) {
  const previousCount = riverRevealCounts.get(container) || 0;
  const hasNewCards = river.length > previousCount;
  const deckRect = deckEl && hasNewCards ? deckEl.getBoundingClientRect() : null;

  container.innerHTML = '';

  for (let i = 0; i < riverSize; i++) {
    if (river[i]) {
      const cardEl = createCardEl(river[i]);
      container.appendChild(cardEl);
      if (i >= previousCount && deckRect) animateCardFromDeck(cardEl, deckRect);
    } else {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'card card-empty';
      container.appendChild(emptySlot);
    }
  }

  riverRevealCounts.set(container, river.length);

  // deckEl is only passed for the live game's river (not the reveal screen), and a new
  // turn is exactly when more river cards get revealed
  if (deckEl && hasNewCards) playSound('newTurn');
}

// cards, recorded-token history and the poker readout only change when the turn advances
// (more river cards get revealed, a new history entry gets recorded) — everything else
// (the token currently sitting in the slot) can change on any gameState update, so that
// part alone is refreshed outside of the turn-gated rebuild below.
let lastHandsTurn = null;
let handSlotEls = []; // handIndex -> persistent slot DOM element, valid while lastHandsTurn matches

function renderHands(hands, tokens, turn, river) {
  if (turn !== lastHandsTurn || handSlotEls.length !== hands.length) {
    // a fresh deal only ever happens landing back on turn 0 (a genuine new game, not just
    // the very first turn-advance rebuild), so that's when the cards animate in from the deck
    const isNewDeal = turn === 0 && lastHandsTurn !== 0;
    const deckRect = isNewDeal ? els.riverDeck.getBoundingClientRect() : null;

    els.myHands.innerHTML = '';
    handSlotEls = [];

    hands.forEach((hand, handIndex) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'hand-group';

      const slotEl = document.createElement('div');
      slotEl.className = 'token-slot hand-token-slot'; // wide landing zone, shape doesn't apply to it
      makeDropTarget(slotEl, { player: myRole, hand: handIndex });
      groupDiv.appendChild(slotEl);
      handSlotEls.push(slotEl);

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
      const cardEls = hand.map(card => {
        const cardEl = createCardEl(card);
        cardsRow.appendChild(cardEl);
        return cardEl;
      });
      handDiv.appendChild(cardsRow);

      const pokerText = document.createElement('div');
      pokerText.className = 'poker';
      pokerText.innerHTML = displayPoker(computePoker([...hand, ...river]))
      handDiv.appendChild(pokerText)

      groupDiv.appendChild(handDiv);
      els.myHands.appendChild(groupDiv);

      // deal from the deck once the cards are actually laid out in the document
      if (deckRect) cardEls.forEach(cardEl => animateCardFromDeck(cardEl, deckRect));
    });

    lastHandsTurn = turn;
  }

  handSlotEls.forEach((slotEl, handIndex) => {
    slotEl.innerHTML = '';
    const token = tokens.slots[myRole][handIndex];
    if (token != null) {
      slotEl.appendChild(getTokenEl(token, turn));
    }
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
    nameRow.appendChild(createAvatarEl(player.avatar));

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

const soundVolume = 0.35; // the raw recordings/SFX are all much louder than is comfortable

function playSound(name) {
  const audio = new Audio(`sounds/${name}.mp3`);
  audio.volume = soundVolume;
  // .play() rejects if called without a prior user gesture (autoplay policy); by the time
  // this fires (a click on "Révéler") that's already satisfied, but ignore it regardless
  audio.play().catch(() => {});
}

function playAnimalSound(avatar) {
  const audio = new Audio(`sounds/animals/${avatar}.mp3`);
  audio.volume = soundVolume;
  audio.play().catch(() => {});
}

// persisted across renderReveal calls so that a newly-revealed hand can flip in place
// instead of the whole screen being torn down and rebuilt on every reveal step
let revealState = null; // { revealedCount, metas: [{ blockDiv, pokerEl, flipEls }] }

// a hand can only be flagged "misranked" against a neighbour that is itself revealed —
// comparing against a still-hidden hand would leak its relative strength as a spoiler.
// the "previous" comparison is always safe once this block is revealed (hands reveal in
// order, so the previous one is necessarily already shown); the "next" comparison needs
// that specific neighbour to also be revealed yet.
function computeIsMisranked(blocks, index, revealedCount) {
  if (index >= revealedCount) return false;

  const block = blocks[index];
  const previousBlock = blocks[index - 1];
  const nextBlock = blocks[index + 1];

  const worseThanPrevious = previousBlock && comparePokers(block.poker, previousBlock.poker) == 2;
  const betterThanNext = nextBlock && index + 1 < revealedCount && comparePokers(block.poker, nextBlock.poker) == 1;

  return !!(worseThanPrevious || betterThanNext);
}

// third screen, after 'lobby' and 'game': every hand revealed, sorted by its turn-4 (circle) token
function renderReveal(view) {
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

  const isFreshReveal = !revealState
    || view.revealedCount === 0
    || view.revealedCount < revealState.revealedCount
    || revealState.metas.length !== blocks.length;

  if (!isFreshReveal) {
    if (view.revealedCount > revealState.revealedCount) {
      let causedNewMismatch = false;

      // flip just the hands that newly became revealed since the last render
      for (let index = revealState.revealedCount; index < view.revealedCount; index++) {
        const meta = revealState.metas[index];
        meta.blockDiv.classList.remove('reveal-block-hidden');
        meta.flipEls.forEach(flipEl => flipEl.classList.add('is-flipped'));
        meta.pokerEl.innerHTML = displayPoker(blocks[index].poker);

        const isMisranked = computeIsMisranked(blocks, index, view.revealedCount);
        meta.finalTokenWrap.classList.toggle('reveal-final-token-error', isMisranked);
        if (isMisranked) causedNewMismatch = true; // this hand was never shown before, so its status is inherently new

        // the previous hand's "misranked vs. next" comparison only becomes decidable
        // now that this one is revealed too, so re-check it as well
        const previousMeta = revealState.metas[index - 1];
        if (previousMeta) {
          const wasMisranked = previousMeta.finalTokenWrap.classList.contains('reveal-final-token-error');
          const nowMisranked = computeIsMisranked(blocks, index - 1, view.revealedCount);
          previousMeta.finalTokenWrap.classList.toggle('reveal-final-token-error', nowMisranked);
          if (nowMisranked && !wasMisranked) causedNewMismatch = true;
        }
      }

      revealState.revealedCount = view.revealedCount;
      revealState.hadMismatch = revealState.hadMismatch || causedNewMismatch;

      if (causedNewMismatch) {
        playSound('fail');
      } else if (view.revealedCount >= blocks.length && !revealState.hadMismatch) {
        playSound('good-end');
      } else {
        playSound('good');
      }
    }
    renderRiver(els.revealRiver, view.river);
    return;
  }

  els.revealBlocks.innerHTML = '';
  const metas = [];

  let hadMismatch = false;

  blocks.forEach((block, index) => {
    const isRevealed = index < view.revealedCount;
    const isMisranked = computeIsMisranked(blocks, index, view.revealedCount);
    if (isMisranked) hadMismatch = true;

    const blockDiv = document.createElement('div');
    blockDiv.className = 'reveal-block' + (isRevealed ? '' : ' reveal-block-hidden');

    const mainRow = document.createElement('div');
    mainRow.className = 'reveal-block-main';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'reveal-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'reveal-name';
    nameEl.appendChild(createAvatarEl(block.player.avatar));
    nameEl.appendChild(document.createTextNode(block.player.name));
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
    const flipEls = block.hand.map(card => createFlipCardEl(card, isRevealed));
    flipEls.forEach(flipEl => cardsRow.appendChild(flipEl));
    mainRow.appendChild(cardsRow);

    blockDiv.appendChild(mainRow);

    const pokerEl = document.createElement('div');
    pokerEl.className = 'poker';
    // kept as an (invisible) non-breaking space rather than omitted when hidden, so the
    // block keeps the same height/shape whether or not this hand has been revealed yet
    pokerEl.innerHTML = isRevealed ? displayPoker(block.poker) : ' ';
    blockDiv.appendChild(pokerEl);

    els.revealBlocks.appendChild(blockDiv);

    metas.push({ blockDiv, pokerEl, flipEls, finalTokenWrap });
  });

  revealState = { revealedCount: view.revealedCount, metas, hadMismatch };

  renderRiver(els.revealRiver, view.river);
}

const settingsMeta = [
  { key: 'cardsPerHand', label: 'Cartes par main', min: 1 },
  { key: 'handsPerPlayer', label: 'Mains par joueur·euse', min: 1 },
  { key: 'nbrJokers', label: 'Nombre de jokers', min: 0 },
];
const settingsKeyboardShortcuts = {
  C: 'cardsPerHand',
  M: 'handsPerPlayer',
  H: 'handsPerPlayer',
  J: 'nbrJokers',
}

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
      btnDec.onclick = () => socket.emit('updateSetting', { key: meta.key, offset: - 1 });
      row.appendChild(btnDec);
    }

    const val = document.createElement('span');
    val.textContent = value;
    row.appendChild(val);

    if (isAdmin) {
      const btnInc = document.createElement('button');
      btnInc.textContent = '+';
      btnInc.onclick = () => socket.emit('updateSetting', { key: meta.key, offset: + 1 });
      row.appendChild(btnInc);
    }

    els.settingsPanel.appendChild(row);
  });

  if (isAdmin) {
    const btnStart = document.createElement('div');
    btnStart.className = 'btn-primary';
    btnStart.textContent = 'Lancer la partie !';
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

function renderRevealButton(isAdmin, revealedCount, totalHands) {
  els.revealLobbyContainer.innerHTML = '';
  if (!isAdmin) return;

  const btn = document.createElement('button');
  btn.className = 'btn-primary';

  if (revealedCount < totalHands) {
    btn.textContent = 'Révéler';
    btn.onclick = () => socket.emit('revealNext');
  } else {
    btn.textContent = 'Lobby';
    btn.onclick = () => socket.emit('backToLobby');
  }

  els.revealLobbyContainer.appendChild(btn);
}

socket.on('role', (role) => {
  myRole = role;
});

socket.on('tokenMoved', ({ avatar }) => {
  playAnimalSound(avatar);
});

let currentTokens = null; // latest view.tokens, kept around for the keyboard shortcuts

socket.on('gameState', (view) => {

  if (view.revealed) {
    currentTokens = null;
    els.reveal.classList.remove("hidden");
    els.lobby.classList.add("hidden");
    els.game.classList.add("hidden");

    renderReveal(view);
    const totalHands = view.hand.reduce((sum, playerHands) => sum + playerHands.length, 0);
    renderRevealButton(myRole == 0, view.revealedCount, totalHands);
    return;
  }
  els.reveal.classList.add("hidden");

  if (view.inGame) {
    els.game.classList.remove("hidden");
    els.lobby.classList.add("hidden");

    if (view.tokens) {
      currentTokens = view.tokens;
      animateTokens(() => {
        if (myRole >= 0) renderHands(view.hand, view.tokens, view.turn, view.river);
        renderOpponents(view.players, view.tokens, view.disconnectedPlayers, view.ready, view.turn);
        renderCenterTokens(view.tokens, view.turn);
      });
      renderOkButton(view.tokens, view.ready);
    }

    renderRiver(els.riverSlots, view.river, els.riverDeck);
  } else {
    currentTokens = null;
    els.lobby.classList.remove("hidden");
    els.game.classList.add("hidden");

    const isAdmin = myRole == 0;
    const isSpectator = myRole < 0;

    // Settings panel (+ start button for admin)
    renderSettingsPanel(view.settings, isAdmin);

    // "Rejoindre la partie" / "Quitter la partie": mutually exclusive
    els.btnJoinGame.classList.toggle('hidden', !isSpectator);
    els.btnBecomeSpectator.classList.toggle('hidden', isSpectator);

    // player list
    els.playersList.innerHTML = '';

    const renderNameRow = (container, avatar, name, isSelf) => {
      const div = document.createElement('div');
      div.className = 'player-tag';
      div.appendChild(createAvatarEl(avatar));

      const nameSpan = document.createElement('span');
      nameSpan.innerHTML = name + (isSelf ? ' <strong>(Vous)</strong>' : '');
      div.appendChild(nameSpan);

      container.appendChild(div);
    };

    if (!isSpectator) {
      renderNameRow(els.playersList, view.players[myRole].avatar, view.players[myRole].name, true);
    }
    view.players.forEach((player, playerRole) => {
      if (playerRole != myRole) {
        renderNameRow(els.playersList, player.avatar, player.name, false);
      }
    });

    // spectator list
    els.spectatorsSection.classList.toggle('hidden', view.spectators.length == 0);
    els.spectatorsList.innerHTML = '';
    view.spectators.forEach(spectator => {
      renderNameRow(els.spectatorsList, spectator.avatar, spectator.name, spectator.isSelf);
    });

    // "Votre nom actuel est " + avatar picker preview
    const myIdentity = isSpectator
      ? (view.spectators.find(s => s.isSelf) || {})
      : view.players[myRole];
    els.nameFormBottom.innerHTML = 'Votre nom actuel est ' + myIdentity.name;
    els.avatarPickerImg.src = `imgs/animals/${myIdentity.avatar}.svg`;
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

els.btnJoinGame.onclick = () => socket.emit('joinGame');
els.btnBecomeSpectator.onclick = () => socket.emit('makeSpectator');

els.btnAvatarPrev.onclick = () => socket.emit('changeAvatar', -1);
els.btnAvatarNext.onclick = () => socket.emit('changeAvatar', 1);

// ---------- Chat ----------

let chatOpen = false;
let chatUnread = 0;

// shared by the chat panel and the fading preview feed; textContent throughout,
// never innerHTML, since message.name/message.text come from other users
function fillChatMessageEl(container, message) {
  container.appendChild(createAvatarEl(message.avatar));

  // name + text live in their own wrapper (rather than directly in `container`) so that
  // the chat-preview's line-clamp can apply to the text alone, without also clamping the
  // avatar into the same box-orient flow
  const bodyEl = document.createElement('span');
  bodyEl.className = 'chat-message-body';

  const nameEl = document.createElement('span');
  nameEl.className = 'chat-message-name';
  nameEl.textContent = message.name + ' :';
  bodyEl.appendChild(nameEl);

  const textEl = document.createElement('span');
  textEl.className = 'chat-message-text';
  textEl.textContent = ' ' + message.text;
  bodyEl.appendChild(textEl);

  container.appendChild(bodyEl);
}

function appendChatMessage(message) {
  const el = document.createElement('div');
  el.className = 'chat-message';
  fillChatMessageEl(el, message);

  els.chatMessages.appendChild(el);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function setChatUnread(count) {
  chatUnread = count;
  els.chatBadge.classList.toggle('hidden', chatUnread === 0);
}

const chatPreviewMax = 5;
const chatPreviewVisibleMs = 1500;
const chatPreviewFadeMs = 500;

function clearChatPreview() {
  els.chatPreview.innerHTML = '';
}

// desktop-only nicety (hidden outright on mobile via CSS): stacks the latest messages
// above the chat button when the panel is closed, each fading out on its own after a while
function showChatPreview(message) {
  while (els.chatPreview.children.length >= chatPreviewMax) {
    els.chatPreview.firstChild.remove();
  }

  const el = document.createElement('div');
  el.className = 'chat-preview-message';
  fillChatMessageEl(el, message);
  els.chatPreview.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-fading');
    setTimeout(() => el.remove(), chatPreviewFadeMs);
  }, chatPreviewVisibleMs);
}

function openChat() {
  chatOpen = true;
  els.chatPanel.classList.remove('hidden');
  setChatUnread(0);
  clearChatPreview();
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  els.chatInput.focus();
}

function closeChat() {
  chatOpen = false;
  els.chatPanel.classList.add('hidden');
}

els.chatToggle.onclick = () => {
  if (chatOpen) closeChat();
  else openChat();
};

// clicking anywhere outside the chat widget closes it while it's open
document.addEventListener('click', (e) => {
  if (chatOpen && !els.chat.contains(e.target)) closeChat();
});

els.chatForm.onsubmit = (e) => {
  e.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text) return;
  socket.emit('sendChatMessage', text);
  els.chatInput.value = '';
};

socket.on('chatHistory', (messages) => {
  els.chatMessages.innerHTML = '';
  messages.forEach(appendChatMessage);
});

socket.on('chatMessage', (message) => {
  appendChatMessage(message);
  if (!chatOpen) {
    setChatUnread(chatUnread + 1);
    showChatPreview(message);
  }
});

// ---------- Keyboard shortcuts ----------

function isTypingTarget(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.code === 'Escape') {
    if (chatOpen) closeChat();
    return;
  }

  const typing = isTypingTarget(document.activeElement);

  if (typing) return; // don't hijack normal typing (name field, chat input...)
  
  if (e.code === 'KeyT') {
    // e.preventDefault();
    openChat();
    return;
  }

  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault();
    if (!els.lobby.classList.contains('hidden')) {
      if (myRole < 0) socket.emit('joinGame');
      else socket.emit(e.shiftKey ? 'startGame' : 'makeSpectator');
    } else {
      const btn = ((!els.game.classList.contains('hidden')) ? els.nextTurnContainer : els.revealLobbyContainer).querySelector('button');
      if (btn && !btn.disabled) btn.click();
    }
    return;
  }

  if (myRole >= 0 && currentTokens && /^(Digit|Numpad)[0-9]$/.test(e.code) && !els.game.classList.contains('hidden')) {
    e.preventDefault();
    const handIndex = e.shiftKey ? 1 : 0;
    const num = Number(e.code[e.code.length-1]);
    const token = currentTokens.slots[myRole][handIndex] || null;
    if (num === 0 || num === token) {
      if (token != null) socket.emit('moveToken', { token, to: 'center' });
    } else {
      socket.emit('moveToken', { token: num, to: { player: myRole, hand: handIndex } });
    }
    return;
  }

  if (/Key[CMHJ]/.test(e.code) && myRole == 0 && !els.lobby.classList.contains('hidden')) {
    e.preventDefault();
    socket.emit('updateSetting', {
      key: settingsKeyboardShortcuts[e.code[3]],
      offset: e.shiftKey ? -1 : 1
    })
  }
});
