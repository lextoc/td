const TAU = Math.PI * 2;
export const STRIDES = { goblin: 116, orc: 152, knight: 156, troll: 204, hero: 180 };

export function newWalk(phase = 0) {
  return { phase, strength: 0, speed: 0, facing: 'down', turn: 0 };
}

export function advanceWalk(walk, dx, dy, dt, stride, preferredFacing) {
  if (dt <= 0) return;
  const distance = Math.hypot(dx, dy), speed = distance / dt;
  walk.phase = (walk.phase + distance / stride) % 1;
  const blend = 1 - Math.exp(-dt * 14);
  walk.strength += ((distance > .01 ? 1 : 0) - walk.strength) * blend;
  walk.speed += (speed - walk.speed) * blend;
  const facing = preferredFacing || (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  if (distance > .01) {
    if (walk.facing !== facing) walk.turn = facing === 'left' ? -.055 : facing === 'right' ? .055 : 0;
    walk.facing = facing;
  }
  walk.turn *= Math.exp(-dt * 12);
}

export function walkFrameTime(walk, animation) {
  return walk.phase * (animation.frames || 1) / (animation.fps || 10);
}

export function drawWalking(c, fr, walk, { reduced = false, weight = 1 } = {}) {
  if (!fr) return;
  const phase = walk.phase * TAU, strength = reduced ? 0 : walk.strength;
  const beat = Math.cos(phase * 2), sway = Math.sin(phase);
  const bob = (1 - beat) * 1.2 * strength * weight;
  c.save();
  c.fillStyle = '#172016'; c.globalAlpha = .13;
  c.beginPath(); c.ellipse(0, 0, fr.sw * .22, fr.sh * .035, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  c.translate(0, -bob);
  c.rotate((sway * .012 * weight + walk.turn) * strength);
  if (strength < .01 || fr.frames <= 1) {
    c.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, -fr.ax, -fr.ay, fr.sw, fr.sh);
    c.restore(); return;
  }
  const hip = Math.floor(fr.ay * .7), start = Math.floor(fr.sw * .27), split = Math.floor(fr.sw * .5), end = Math.ceil(fr.sw * .73);
  const region = (x, y, w, h) => {
    if (w > 0 && h > 0) c.drawImage(fr.i, fr.sx + x, fr.sy + y, w, h, x - fr.ax, y - fr.ay, w, h);
  };
  region(0, hip, start, fr.sh - hip);
  region(end, hip, fr.sw - end, fr.sh - hip);
  for (let leg = 0; leg < 2; leg++) {
    const x = leg ? split : start, width = leg ? end - split : split - start;
    const swing = Math.sin(phase + leg * Math.PI), lift = Math.max(0, swing) * strength;
    const pivotX = x + width * .5 - fr.ax, pivotY = hip - fr.ay;
    c.save(); c.translate(pivotX, pivotY);
    c.rotate(swing * .12 * strength / weight);
    c.scale(1, 1 - lift * .12);
    c.translate(-pivotX, -pivotY);
    region(x, hip, width, fr.sh - hip);
    c.restore();
  }
  region(0, 0, fr.sw, hip + 2);
  c.restore();
}
