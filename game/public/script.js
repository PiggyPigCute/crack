const socket = io();
let myRole = null;

els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  role: document.getElementById('role'),
  tour: document.getElementById('tour'),
  playersList: document.getElementById('players-list'),
  btnNewGame: document.getElementById('btn-new-game'),
  btnChangeName: document.getElementById('btn-change-name'),
  inputName: document.getElementById('input-name'),
  btnStartGameContainer: document.getElementById('btn-start-game-container')
}

socket.on('role', (role) => {
  myRole = role;
  els.role.textContent = role;
});

socket.on('gameState', (view) => {

  console.log(view);
  
  if (view.inGame) {
    console.log('dbg 1')
    if (els.game.classList.contains('hidden')) {
      console.log('debg 2')
      els.game.classList.remove("hiddent"),
      els.lobby.classList.add("hidden")
    }
  } else {
    if (els.lobby.classList.contains('hidden')) {
      els.lobby.classList.remove("hiddent"),
      els.game.classList.add("hidden")
    }
    
    // Start Game Button
    if (myRole == 0) { //admin
      if (els.btnStartGameContainer.innerHTML == '') {
        const div = document.createElement('div');
        div.className = 'btn-start-game';
        div.textContent = 'Jouer !';
        div.onclick = () => socket.emit('startGame');
        els.btnStartGameContainer.appendChild(div)
      }
    } else {
      els.btnStartGameContainer.innerHTML = '';
    }


    // player list
    els.playersList.innerHTML = '';
    view.players.forEach((player, role) => {
      const div = document.createElement('div');
      div.className = 'carte';
      div.textContent = player.name + ' ' + role;
      els.playersList.appendChild(div);
    });
  }

  // Indicateur de inGame
  els.tour.textContent = view.inGame;
  els.tour.classList.toggle('mon-tour', view.inGame);
});

els.btnChangeName.onclick = () => {
  socket.emit('changeName', els.inputName.value);
};

els.btnNewGame.onclick = () => {
  socket.emit('newGame');
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
