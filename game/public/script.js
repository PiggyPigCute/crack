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
  inputName: document.getElementById('input-name')
}

socket.on('role', (role) => {
  myRole = role;
  els.role.textContent = role;
});

socket.on('gameState', (view) => {

  // Indicateur de tour
  els.tour.textContent = view.inGame;
  els.tour.classList.toggle('mon-tour', view.inGame);

  // Ma main (uniquement si je suis joueur)
  if (myRole >= 0) {
    playersList.innerHTML = '';
    view.players.forEach((player, role) => {
      const div = document.createElement('div');
      div.className = 'carte';
      div.textContent = player.name + ' ' + role;
      playersList.appendChild(div);
    });
  }
});

btnChangeName.onclick = () => {
  socket.emit('changeName', inputName);
};

btnNewGame.onclick = () => {
  socket.emit('newGame');
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
