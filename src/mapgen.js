// TD-9b: seeded random maps. One seed -> all three aspect variants (portrait 8x15, landscape 15x8, square 11x11).
// Each variant: one non-self-touching path from the west edge to the east edge (mirrored by the seed), 25±2 tiles,
// 14 build spots 8-adjacent to the path with comparable coverage, sorted by path position so spot i sits at the same
// stretch of road in every variant (towers survive rotation). Pure module: used by the game and scripts/validate-maps.mjs.
export const SIZES = { portrait: [8, 15], landscape: [15, 8], square: [11, 11] };
export const LEN = [23, 27], NSPOTS = 14, RANGE = 2.5, COVER = [7, 12]; // path tiles within archer range (2.5) of a spot
export const mulberry32 = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const cover = (s, path) => path.filter(p => Math.hypot(p[0] - s[0], p[1] - s[1]) <= RANGE).length;

function walk(R, C, Rw) { // randomized DFS, node budget; returns path or null
  const r0 = 1 + Math.floor(R() * (Rw - 2)), p = [[0, r0]], on = new Set(['0,' + r0]); let budget = 3000;
  const ok = ([c, r]) => c >= 0 && c < C && r >= 1 && r < Rw - 1 && !on.has(c + ',' + r);
  function dfs() {
    if (--budget < 0) return false;
    const [c, r] = p.at(-1);
    if (c === C - 1) return p.length >= LEN[0] && p.length <= LEN[1];
    if (p.length >= LEN[1]) return false;
    const dirs = N4.map(d => [d, R()]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
    for (const [dx, dy] of dirs) {
      const n = [c + dx, r + dy];
      if (!ok(n) || (n[0] === C - 1 && p.length + 1 < LEN[0])) continue;
      if (N4.some(([ex, ey]) => { const k = (n[0] + ex) + ',' + (n[1] + ey); return on.has(k) && k !== c + ',' + r; })) continue; // no touching
      if (C - 1 - n[0] > LEN[1] - p.length - 1) continue; // must still reach the east edge
      p.push(n); on.add(n + '');
      if (dfs()) return true;
      p.pop(); on.delete(n + '');
    }
    return false;
  }
  return dfs() ? p : null;
}

export function genVariant(seed, id, tpl) {
  const [C, Rw] = SIZES[id], R = mulberry32((seed ^ ({ portrait: 0x9e37, landscape: 0x85eb, square: 0xc2b2 }[id] * 65537)) >>> 0);
  for (let tries = 0; ; tries++) {
    let path = walk(R, C, Rw); if (!path) continue;
    if (R() < .5) path = path.map(([c, r]) => [C - 1 - c, r]); // east -> west
    const on = new Set(path.map(p => p + ''));
    const cand = [];
    for (let r = 1; r < Rw - 1; r++) for (let c = 0; c < C; c++) {
      if (on.has(c + ',' + r)) continue;
      const near = path.findIndex(p => Math.max(Math.abs(p[0] - c), Math.abs(p[1] - r)) === 1);
      if (near < 0) continue;
      const cv = cover([c, r], path); if (cv >= COVER[0] && cv <= COVER[1]) cand.push([c, r, near, R()]);
    }
    if (cand.length < NSPOTS) continue;
    // spread along the road: split candidates (by path order) into 14 buckets, one random pick from each
    cand.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
    const spots = []; for (let i = 0; i < NSPOTS; i++) { const a = Math.floor(i * cand.length / NSPOTS), b = Math.floor((i + 1) * cand.length / NSPOTS); spots.push(cand[a + Math.floor(R() * (b - a))]); }
    const [f, l] = [path[0], path.at(-1)], side = c => [c[0] === 0 ? -1 : C, c[1]];
    const busy = new Set([...on, ...spots.map(s => s[0] + ',' + s[1])]), roadRows = new Set([f[1], l[1]]);
    const near = ([c, r]) => [...busy].some(k => { const [x, y] = k.split(',').map(Number); return Math.abs(x - c) <= 1 && Math.abs(y - r) <= 1; });
    const water = (tpl.terrain.water || []).filter(w => !near(w) && !roadRows.has(w[1]) && !(w[0] >= 0 && w[0] < C && w[1] >= 1 && w[1] < Rw - 1));
    return { ...tpl, name: `Random #${seed} (${id})`, seed, tries, entry: side(f), exit: side(l), path, spots: spots.map(s => [s[0], s[1]]),
      terrain: { ...tpl.terrain, seed: seed % 100000, water, fixed: {}, bridges: [] } };
  }
}
export const genMaps = (seed, tpls) => Object.fromEntries(Object.keys(SIZES).map(id => [id, genVariant(seed, id, tpls[id])]));
