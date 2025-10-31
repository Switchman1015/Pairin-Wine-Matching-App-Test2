import { clamp, circleHit, nearest, len } from './ecs.js';
import { mulberry32, pick } from './rng.js';
import { MODULES, START_WEAPON } from './modules.js';
import { computeSynergies, applySynergyEffects } from './synergy.js';

export function createGame(canvas, ui) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const state = {
    rng: mulberry32(Date.now() >>> 0),
    time: 0,
    wave: 1,
    waveTime: 35,
    waveElapsed: 0,
    paused: false,
    draftOpen: false,
    rerollLeft: 1,
    inputs: { up: false, down: false, left: false, right: false },
    player: { x: W/2, y: H/2, r: 10, hp: 100, hpMax: 100, speed: 140 },
    stats: { firerateMult: 1, pickup: 60, regen: 0, pierce: 0 },
    flags: { ignite: false },
    build: { tags: new Set(), modules: [] },
    weapon: { ...START_WEAPON, cd: 0 },
    synergies: { overheater: false },
    combat: { damageMult: 1, overheat: 0, firingThisTick: false },
    enemies: [], bullets: [], xp: [], enemyBullets: [],
    xpNow: 0, xpToNext: 30, level: 1, coins: 0,
  };
  // initial tags include weapon tags
  START_WEAPON.tags.forEach(t => state.build.tags.add(t));

  function openDraft() {
    state.paused = true;
    state.draftOpen = true;
    ui.showDraft(offerCards());
  }

  function offerCards() {
    // Sample 3 distinct modules
    const pool = MODULES.filter(m => !state.build.modules.includes(m.id));
    const cards = [];
    while (cards.length < 3 && pool.length) {
      const i = (state.rng() * pool.length) | 0;
      cards.push(pool.splice(i, 1)[0]);
    }
    return cards;
  }

  function pickCard(mod) {
    state.build.modules.push(mod.id);
    mod.tags?.forEach?.(t => state.build.tags.add(t));
    mod.apply(state);
    state.synergies = computeSynergies(state.build.tags);
    state.paused = false;
    state.draftOpen = false;
  }

  function reroll() {
    if (state.rerollLeft <= 0) return;
    state.rerollLeft--;
    ui.showDraft(offerCards());
  }

  function spawnEnemy() {
    const k = state.wave; // scale
    const edge = pick(state.rng, ['top','bottom','left','right']);
    let x = 0, y = 0;
    if (edge === 'top') { x = state.rng()*W; y = -12; }
    if (edge === 'bottom') { x = state.rng()*W; y = H+12; }
    if (edge === 'left') { x = -12; y = state.rng()*H; }
    if (edge === 'right') { x = W+12; y = state.rng()*H; }
    const typePick = state.rng();
    let hp = 25, speed = 90, r = 8;
    if (typePick < 0.15) { hp = 120; speed = 45; r = 12; } // tank
    else if (typePick < 0.35) { hp = 30; speed = 60; r = 9; } // shooter (not shooting yet)
    else if (typePick < 0.55) { hp = 8; speed = 100; r = 6; } // swarm
    const e = { x, y, r, hp: hp * (1 + 0.15*(k-1)), speed: speed * (1 + 0.06*(k-1)), dead: false };
    state.enemies.push(e);
  }

  let spawnAcc = 0;
  function update(dt) {
    // Regen
    if (state.stats.regen > 0) {
      state.player.hp = clamp(state.player.hp + state.stats.regen * dt, 0, state.player.hpMax);
    }

    if (!state.paused) state.time += dt;
    if (!state.paused) state.waveElapsed += dt;

    // Wave logic
    if (!state.paused) {
      spawnAcc += dt;
      const density = 0.8 + state.wave * 0.1; // spawn per second
      while (spawnAcc > 1 / density) { spawnAcc -= 1 / density; spawnEnemy(); }

      if (state.waveElapsed >= state.waveTime) {
        state.wave += 1; state.waveElapsed = 0;
        openDraft();
      }
    }

    // Inputs → movement
    const p = state.player;
    const ix = (state.inputs.right?1:0) - (state.inputs.left?1:0);
    const iy = (state.inputs.down?1:0) - (state.inputs.up?1:0);
    const L = len(ix, iy);
    if (!state.paused && L > 0) {
      p.x = clamp(p.x + (ix / L) * p.speed * dt, 10, W-10);
      p.y = clamp(p.y + (iy / L) * p.speed * dt, 10, H-10);
    }

    // Weapon firing
    state.combat.firingThisTick = false;
    const target = nearest(p, state.enemies);
    if (target) {
      const firerate = state.weapon.base.firerate * state.stats.firerateMult;
      state.weapon.cd -= dt;
      while (state.weapon.cd <= 0) {
        state.weapon.cd += 1 / firerate;
        fireAt(target);
        state.combat.firingThisTick = true;
      }
    }

    applySynergyEffects(state, dt);

    // Bullets
    for (const b of state.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -20||b.x>W+20||b.y<-20||b.y>H+20) b.dead = true;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (circleHit(b.x, b.y, 3, e.x, e.y, e.r)) {
          const dmg = b.dmg * state.combat.damageMult;
          e.hp -= dmg;
          if (state.flags.ignite) {
            e.dot = { t: 2, dps: Math.max(e.dot?.dps||0, dmg * 0.2) };
          }
          if (!b.pierced) b.pierced = 0;
          if (b.pierced < state.stats.pierce) { b.pierced++; }
          else { b.dead = true; break; }
        }
      }
    }

    // Enemy DoT + death + move
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (e.dot) { const d = Math.min(e.dot.t, dt); e.dot.t -= d; e.hp -= e.dot.dps * d; if (e.dot.t <= 0) e.dot = null; }
      // move toward player
      const dx = p.x - e.x, dy = p.y - e.y, L = len(dx, dy);
      e.x += (dx / L) * e.speed * dt;
      e.y += (dy / L) * e.speed * dt;
      // collide with player
      if (!state.paused && circleHit(e.x, e.y, e.r, p.x, p.y, p.r)) {
        p.hp -= 12 * dt; // contact dps
      }
      if (e.hp <= 0) { e.dead = true; dropXP(e.x, e.y); }
    }

    // XP orbs
    for (const x of state.xp) {
      if (x.dead) continue;
      const dx = p.x - x.x, dy = p.y - x.y; const L = len(dx, dy);
      // attraction
      const range = state.stats.pickup;
      if (L < range) {
        const pull = (1 - L / range) * 220;
        x.vx += (dx / L) * pull * dt;
        x.vy += (dy / L) * pull * dt;
      }
      x.x += x.vx * dt; x.y += x.vy * dt;
      if (circleHit(x.x, x.y, 4, p.x, p.y, p.r)) {
        x.dead = true; gainXP(5);
      }
    }

    // Cleanup
    state.bullets = state.bullets.filter(b => !b.dead);
    state.enemies = state.enemies.filter(e => !e.dead);
    state.xp = state.xp.filter(x => !x.dead);

    // Death check
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.paused = true;
    }
  }

  function fireAt(target) {
    const p = state.player;
    const dx = target.x - p.x, dy = target.y - p.y; const L = len(dx, dy);
    const spd = 320; // bullet speed
    const dmgPerShot = state.weapon.base.dps / state.weapon.base.firerate;
    state.bullets.push({ x: p.x, y: p.y, vx: (dx/L)*spd, vy: (dy/L)*spd, dmg: dmgPerShot, dead: false });
  }

  function dropXP(x, y) {
    const a = (state.rng() * Math.PI * 2);
    const v = 40 + state.rng() * 30;
    state.xp.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, dead: false });
  }

  function gainXP(v) {
    state.xpNow += v;
    if (state.xpNow >= state.xpToNext) {
      state.xpNow -= state.xpToNext;
      state.level++;
      state.xpToNext = Math.round(state.xpToNext * 1.2 + 5);
      openDraft();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // arena grid
    ctx.strokeStyle = '#151922'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x=0; x<W; x+=30) { ctx.moveTo(x,0); ctx.lineTo(x,H); }
    for (let y=0; y<H; y+=30) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
    ctx.stroke();

    // xp orbs
    for (const x of state.xp) {
      ctx.fillStyle = '#79c0ff';
      ctx.beginPath(); ctx.arc(x.x, x.y, 3, 0, Math.PI*2); ctx.fill();
    }

    // enemies
    for (const e of state.enemies) {
      // body
      ctx.fillStyle = '#ff7b72';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
      // hp ring
      const hpRatio = Math.max(0, e.hp) / 120;
      ctx.strokeStyle = '#5a1e1b'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r+2, 0, Math.PI*2*hpRatio); ctx.stroke();
    }

    // bullets
    ctx.fillStyle = '#79c0ff';
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
    }

    // player
    const p = state.player;
    ctx.fillStyle = '#7ee787';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();

    // overheater aura
    if (state.synergies.overheater && state.combat.overheat > 0.1) {
      ctx.strokeStyle = 'rgba(255,120,80,0.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r+6+state.combat.overheat*2, 0, Math.PI*2); ctx.stroke();
    }
  }

  // UI bridge
  const api = {
    state,
    update, draw,
    pickCard, reroll,
  };
  return api;
}

