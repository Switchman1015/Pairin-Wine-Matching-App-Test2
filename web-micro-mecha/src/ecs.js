// Simple helpers and math utilities
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};
export const len = (dx, dy) => Math.hypot(dx, dy) || 1;

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export function moveTowards(ent, tx, ty, speed, dt) {
  const dx = tx - ent.x, dy = ty - ent.y;
  const l = len(dx, dy);
  ent.x += (dx / l) * speed * dt;
  ent.y += (dy / l) * speed * dt;
}

export function nearest(target, arr) {
  let best = null, bestD = 1e9;
  for (const e of arr) {
    if (e.dead) continue;
    const d = dist2(target, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

