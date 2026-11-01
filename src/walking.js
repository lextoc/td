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

export function drawWalking(c, fr, walk, { reduced = false, weight = 1, shadow = true, alpha = 1, flashFrame = null, flash = 0 } = {}) {
  if (!fr) return;
  const phase = walk.phase * TAU, strength = reduced ? 0 : walk.strength;
  const beat = Math.cos(phase * 2), sway = Math.sin(phase);
  const bob = (1 - beat) * .65 * strength * weight;
  c.save();
  c.fillStyle = '#172016'; c.globalAlpha = shadow ? .13 * alpha : 0;
  c.beginPath(); c.ellipse(0, 0, fr.sw * .22, fr.sh * .035, 0, 0, TAU); c.fill(); c.globalAlpha = alpha;
  c.translate(0, -bob);
  c.rotate((sway * .006 * weight + walk.turn) * strength);
  c.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, -fr.ax, -fr.ay, fr.sw, fr.sh);
  if (flashFrame && flash > 0) {
    c.globalAlpha = alpha * Math.min(.18, flash);
    c.drawImage(flashFrame, -fr.ax, -fr.ay, fr.sw, fr.sh);
  }
  c.restore();
}
