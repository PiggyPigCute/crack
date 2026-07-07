const socket = io();
let monRole = null;

socket.on('role', (role) => {
  monRole = role;
  document.getElementById('role').textContent = role;

  if (role === 'spectateur') {
    document.getElementById('zone-jeu').style.display = 'none';
    document.getElementById('zone-spectateur').style.display = 'block';
  } else {
    document.getElementById('zone-jeu').style.display = 'block';
    document.getElementById('zone-spectateur').style.display = 'none';
  }
});

socket.on('etatJeu', (etat) => {
  // Indicateur de tour
  const tourEl = document.getElementById('tour');
  tourEl.textContent = etat.tour;
  tourEl.classList.toggle('mon-tour', etat.tour === monRole);

  document.getElementById('deck-restant').textContent = etat.cartesRestantesDansLeDeck;

  // Ma main (uniquement si je suis joueur)
  if (etat.maMain) {
    const mainEl = document.getElementById('main-joueur');
    mainEl.innerHTML = '';
    etat.maMain.forEach((carte) => {
      const div = document.createElement('div');
      div.className = 'carte';
      div.textContent = carte;
      div.onclick = () => socket.emit('jouerCarte', carte);
      mainEl.appendChild(div);
    });
  }

  // Défausse (visible par tous)
  const defausseEl = document.getElementById('defausse');
  defausseEl.innerHTML = '';
  etat.defausse.forEach((carte) => {
    const div = document.createElement('div');
    div.className = 'carte';
    div.textContent = carte;
    div.style.cursor = 'default';
    defausseEl.appendChild(div);
  });

  // Vue spectateur
  if (monRole === 'spectateur') {
    document.getElementById('spec-j1').textContent = etat.nbCartesJoueur1;
    document.getElementById('spec-j2').textContent = etat.nbCartesJoueur2;
  }

  // Historique
  const logEl = document.getElementById('log');
  logEl.innerHTML = etat.log.map(l => `<div>${l}</div>`).join('');
  logEl.scrollTop = logEl.scrollHeight;
});

document.getElementById('btn-piocher').onclick = () => {
  socket.emit('piocherCarte');
};

document.getElementById('btn-nouvelle-partie').onclick = () => {
  socket.emit('nouvellePartie');
};
