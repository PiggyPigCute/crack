const socket = io();
let myRole = null;

socket.on('role', (role) => {
  myRole = role;
  document.getElementById('role').textContent = role;
});

socket.on('gameState', (view) => {

  // Indicateur de tour
  const tourEl = document.getElementById('tour');
  tourEl.textContent = view.inGame;
  tourEl.classList.toggle('mon-tour', view.inGame);

  // Ma main (uniquement si je suis joueur)
  if (myRole >= 0) {
    const mainEl = document.getElementById('main-joueur');
    mainEl.innerHTML = '';
    view.players.forEach((player, role) => {
      const div = document.createElement('div');
      div.className = 'carte';
      div.textContent = role, player.name;
      mainEl.appendChild(div);
    });
  }
});

document.getElementById('btn-new-game').onclick = () => {
  socket.emit('newGame');
};

/* DEBUG afac */
window.debugGame = () => fetch('/debug').then(r => r.json()).then(g => { window.game = g; console.log(g); return g; });
