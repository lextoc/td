export const clamp01 = n => Math.max(0, Math.min(1, n));
export const smoothstep = n => { const t = clamp01(n); return t * t * (3 - 2 * t); };
export function animationFrame(animation, time) {
  const count = Math.max(1, animation.frames || 1), frame = Math.floor(Math.max(0, time) * (animation.fps || 12));
  return animation.loop === false ? Math.min(count - 1, frame) : frame % count;
}
export function attackPose(progress, type, reduced = false) {
  if (reduced) return { x: 1, y: 1, offset: 0 };
  const p = clamp01(progress), weight = type === 'cannon' ? 1.5 : type === 'archer' ? 1 : .6;
  const recoil = p < .18 ? smoothstep(p / .18) * .3 : Math.exp(-(p - .18) * 7) * Math.cos((p - .18) * 10);
  const amount = recoil * .025 * weight;
  return { x: 1 + amount, y: 1 - amount, offset: recoil * 2.5 * weight };
}
export const deathOpacity = progress => 1 - smoothstep((progress - .72) / .28);
export function effectPose(progress, reduced = false) {
  const p = clamp01(progress);
  return { scale: reduced ? 1 : .9 + smoothstep(p / .25) * .1, alpha: 1 - smoothstep((p - .8) / .2) };
}
export function projectileLift(type, progress, reduced = false) {
  if (reduced || type !== 'cannon') return 0;
  const p = clamp01(progress); return 4 * p * (1 - p) * 38;
}
