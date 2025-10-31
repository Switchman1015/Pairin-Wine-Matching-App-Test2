import { createGame } from './game.js';

const canvas = document.getElementById('game');
const hud = {
  wave: document.getElementById('wave'),
  timer: document.getElementById('timer'),
  xp: document.querySelector('#xp .fill'),
  hp: document.querySelector('#hp .fill'),
};
const draftEl = document.getElementById('draft');
const cardsEl = document.getElementById('cards');
const rrBtn = document.getElementById('reroll');
const rrLeft = document.getElementById('rrleft');

const ui = {
  showDraft(cards) {
    draftEl.style.display = 'flex';
    cardsEl.innerHTML = '';
    rrLeft.textContent = game.state.rerollLeft+'';
    for (let i=0; i<cards.length; i++) {
      const c = cards[i];
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <h3>${i+1}. ${c.name}</h3>
        <div>${c.text || ''}</div>
        <div class="tags">${(c.tags||[]).join(' / ')}</div>
      `;
      el.addEventListener('click', () => { game.pickCard(c); draftEl.style.display='none'; });
      cardsEl.appendChild(el);
    }
  }
};

const game = createGame(canvas, ui);

// Inputs
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  mapKeys();
  if (game.state.draftOpen && ['1','2','3'].includes(e.key)) {
    const idx = parseInt(e.key,10)-1;
    const card = cardsEl.children[idx];
    if (card) card.click();
  }
  if (game.state.draftOpen && (e.key === 'r' || e.key === 'R')) {
    rrBtn.click();
  }
});
window.addEventListener('keyup', (e) => { keys.delete(e.key); mapKeys(); });

function mapKeys() {
  const s = game.state.inputs;
  s.up = keys.has('ArrowUp') || keys.has('w');
  s.down = keys.has('ArrowDown') || keys.has('s');
  s.left = keys.has('ArrowLeft') || keys.has('a');
  s.right = keys.has('ArrowRight') || keys.has('d');
}

rrBtn.addEventListener('click', () => {
  game.reroll();
  rrLeft.textContent = game.state.rerollLeft+'';
});

// Main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(1/30, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  // HUD
  hud.wave.textContent = `Wave ${game.state.wave}`;
  hud.timer.textContent = `${(game.state.waveTime - game.state.waveElapsed).toFixed(1)}s`;
  hud.hp.style.width = `${(100*game.state.player.hp/game.state.player.hpMax).toFixed(1)}%`;
  hud.xp.style.width = `${(100*game.state.xpNow/game.state.xpToNext).toFixed(1)}%`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

