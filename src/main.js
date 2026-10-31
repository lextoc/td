import M from './manifest.json';
import './style.css';

// ---------- setup / theme ----------
const TS = 128; // world units: one tile = 128 px of art
const T = M.theme;
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const FF = DEBUG ? Math.max(1, +Q.get('ff') || 1) : 1;
const stage = document.getElementById('stage') || document.body, cv = document.getElementById('cv'), ctx = cv.getContext('2d'), ui = document.getElementById('ui');
const url = k => `url("${M.images[k]}")`;
const rs = document.documentElement.style;
for (const [k, v] of Object.entries(T)) rs.setProperty('--' + k, v);
for (const k of ['button_normal', 'button_hover', 'button_pressed', 'button_disabled', 'slot_normal', 'slot_selected', 'slot_locked']) rs.setProperty('--' + k, url(k));
document.body.style.background = T.letterbox;
stage.style.fontFamily = M.font.body.family;
const DISPLAY = M.font.display;
rs.setProperty('--display', `"${DISPLAY.family}", ${M.font.body.family}`);
const fontReady = DISPLAY.url ? new FontFace(DISPLAY.family, `url(${DISPLAY.url})`).load().then(f => document.fonts.add(f)).catch(() => {}) : Promise.resolve();
// ---------- DOM helpers ----------
function h(tag, parent, cls, text) {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e;
}
const DPR = window.devicePixelRatio || 1, KX = DPR >= 2.5 ? 3 : DPR >= 1.5 ? 2 : 1; // pick 1x/@2x/@3x art by DPR
const imgSrc = key => (DPR >= 3 && M.hiDpi96?.[key]) || M.images[key]; // 96 px HUD icons on DPR >= 3
const uiSrc = (d, st = '') => { const u = d.src.replace('{state}', st); return KX > 1 && d.scales?.includes(KX) ? u.replace(/\.png$/, `@${KX}x.png`) : u; };
// 9-slice via border-image: slice in source px (1x margin * KX), border widths in CSS px (1x margin) -> corners never stretch
const nine = (d, st, z = 1) => { const [t, r, b, l] = d.slice; return `border-style:solid;border-width:${t * z}px ${r * z}px ${b * z}px ${l * z}px;border-image:url("${uiSrc(d, st)}") ${t * KX} ${r * KX} ${b * KX} ${l * KX} fill / ${t * z}px ${r * z}px ${b * z}px ${l * z}px stretch;`; };
function mobileCSS() { // td-pack-2/ui/mobile skin for sheet + rail modes, generated from manifest.ui
  const U = M.ui, R = [], st = (sel, d, s, z) => R.push(`${sel}{${nine(d, s, z)}background:none;}`);
  st('#ui:not(.m-desktop) .selp.sel-sheet', U.sheetTop); R.push('#ui:not(.m-desktop) .selp.sel-sheet>[class^="p9-"]:not(.p9-in){display:none}');
  st('#ui.m-rail .bbar', U.railFrame); st('#ui.m-rail .selp.sel-rail', U.railFrame); R.push('#ui.m-rail .sel-rail>[class^="p9-"]:not(.p9-in){display:none}');
  for (const [sel, d] of [['#ui:not(.m-desktop) .acts button,#ui:not(.m-desktop) .toast .undo,#ui:not(.m-desktop) .bbar .start', U.button48], ['#ui:not(.m-desktop) .acts button.confirm', U.button64]]) {
    st(sel, d, 'normal'); st(sel.split(',').map(x => x + ':active').join(','), d, 'pressed'); st(sel.split(',').map(x => x + ':disabled').join(','), d, 'disabled');
  }
  for (const [sel, d] of [['#ui.m-sheet .slot', U.slot64], ['#ui.m-rail .slot', U.slot48]]) {
    st(sel, d, 'normal'); st(sel + ':active', d, 'pressed'); st(sel + '.locked', d, 'locked'); st(sel + '.sel', d, 'selected');
  }
  R.push(`#ui:not(.m-desktop) .tipb{${nine(U.tooltip, '')}background:none;color:#2a1a12}`);
  const e = document.createElement('style'); e.id = 'mobile-skin'; e.textContent = R.join('\n'); document.head.appendChild(e);
}
function img(parent, key, cls = 'nopt') { const e = h('img', parent, cls); e.src = imgSrc(key); e.alt = ''; e.draggable = false; return e; }
function btn(parent, label, fn, aria, cls = '') {
  const b = h('button', parent, 'b display ' + cls, label); b.onclick = () => { play('ui_click'); fn(); }; b.onmouseenter = () => play('ui_hover');
  if (aria) b.setAttribute('aria-label', aria); return b;
}
function panel(parent, cls = '', dark = true) { // 9-slice from separate painted pieces; sizes to content
  const p = h('div', parent, 'p9 ' + cls), k = dark ? 'panel_dark_' : 'panel_';
  for (const n of ['c', 't', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br']) h('div', p, 'p9-' + n).style.backgroundImage = url(k + n);
  return h('div', p, 'p9-in');
}
function ribbon(parent, text, cls = '') {
  const p = h('div', parent, 'rib nopt ' + cls);
  img(p, 'ribbon_left', 'rib-l'); const b = h('div', p, 'rib-b'); b.style.backgroundImage = url('ribbon_body'); img(p, 'ribbon_right', 'rib-r');
  h('div', p, 'rib-t out display', text); return p;
}
const setT = (e, s) => { s = String(s); if (e._t !== s) { e._t = s; e.textContent = s; } };
const setC = (e, c) => { if (e._c !== c) { e._c = c; e.className = c; } };

// ---------- settings ----------
let muted = localStorage.getItem('td.muted') === '1';
let reduced = localStorage.getItem('td.motion') ? localStorage.getItem('td.motion') === 'reduced' : matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- assets ----------
const IMG = {}, SND = {};
let actx = null, master = null;
const failed = new Set();
function loadImage(k) {
  return new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; failed.delete(k); res(); }; i.onerror = () => { failed.add(k); res(); }; i.src = M.images[k]; });
}
async function loadSound(k) {
  try {
    const r = await fetch(M.sounds[k]); if (!r.ok) throw 0;
    SND[k] = await actx.decodeAudioData(await r.arrayBuffer()); failed.delete('s:' + k);
  } catch { failed.add('s:' + k); }
}
async function loadAll(onProgress, only) {
  if (!actx) { actx = new AudioContext(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(actx.destination); }
  for (const d of Object.values(M.ui || {})) if (d?.src) for (const st of d.states || ['']) new Image().src = uiSrc(d, st);
  const jobs = only ? [...only] : [...Object.keys(M.images), ...Object.keys(M.sounds).filter(k => M.sounds[k]).map(k => 's:' + k)];
  let done = 0;
  await Promise.all(jobs.map(j => (j.startsWith('s:') ? loadSound(j.slice(2)) : loadImage(j)).then(() => onProgress(++done / jobs.length))));
}
const resumeAudio = () => { if (actx && actx.state === 'suspended') actx.resume().then(() => { const k = musicKey; musicKey = null; setMusic(k); }).catch(() => {}); };
addEventListener('pointerdown', resumeAudio); addEventListener('keydown', resumeAudio);
const lastPlay = {};
const played = {};
function play(k) {
  played[k] = (played[k] || 0) + 1;
  const b = SND[k]; if (!b || muted || !actx || actx.state !== 'running') return;
  const now = performance.now(); if (now - (lastPlay[k] || 0) < 70) return; lastPlay[k] = now;
  const s = actx.createBufferSource(); s.buffer = b; s.connect(master); s.start();
}
let music = null, musicKey = null;
function setMusic(k) { // k: 'menu' | 'battle' | null ; loops the .ogg buffer
  if (musicKey === k && music) return; musicKey = k;
  if (music) { try { music.stop(); } catch {} music = null; }
  const key = k && M.music?.[k], b = key && SND[key]; if (!b || !actx) return;
  const gn = actx.createGain(); gn.gain.value = M.music.volume ?? .5; gn.connect(master);
  music = actx.createBufferSource(); music.buffer = b; music.loop = true; music.connect(gn); music.start();
}
function setMuted(v) { muted = v; localStorage.setItem('td.muted', v ? '1' : '0'); if (master) master.gain.value = v ? 0 : 0.7; onSettings(); }
let onSettings = () => {};

// ---------- data ----------
const ORDER = ['archer', 'cannon', 'mage', 'frost', 'tesla'];
const TW = { // per level: [cost, dmg, rate, range]
  archer: { name: 'Archer', lv: [[70, 12, 1.25, 2.5], [60, 18, 1.4, 2.75], [90, 26, 1.6, 3]], proj: 'projectile_arrow', fx: null, hit: 'hit_arrow' },
  cannon: { name: 'Cannon', lv: [[120, 30, .5, 2.25], [90, 45, .55, 2.5], [130, 65, .6, 2.75]], proj: 'projectile_cannonball', fx: 'fx_explosion', hit: 'hit_cannon', splash: [.75, .85, 1] },
  mage: { name: 'Mage', lv: [[100, 28, .8, 2.5], [80, 42, .8, 2.75], [120, 60, .9, 3]], proj: 'projectile_magic_bolt', fx: 'fx_magic_burst', hit: 'hit_magic' },
  frost: { name: 'Frost', lv: [[90, 6, 1, 2], [70, 9, 1, 2.25], [100, 12, 1.2, 2.5]], proj: 'projectile_frost_shard', fx: 'fx_frost_hit', hit: 'hit_frost', slow: [[.35, 1.5], [.45, 1.5], [.55, 2]] },
  tesla: { name: 'Tesla', lv: [[150, 16, .9, 2], [110, 24, 1, 2.25], [150, 34, 1.1, 2.5]], proj: 'projectile_lightning_arc', fx: 'fx_lightning_hit', hit: 'hit_lightning', chain: [3, 4, 5] },
};
const EN = {
  goblin: { name: 'Goblin', hp: 40, sp: 1.6, gold: 4, lives: 1, h: 72 },
  orc: { name: 'Orc', hp: 110, sp: 1.0, gold: 8, lives: 1, h: 100 },
  knight: { name: 'Knight', hp: 300, sp: .7, gold: 15, lives: 2, h: 100 },
  troll: { name: 'Troll', hp: 1500, sp: .5, gold: 50, lives: 5, h: 192, boss: true, sprite: 'enemy_troll_boss' },
};
const HP_SCALE = 0.06; // spec: 0.08. Lowered (QA TD-5) so an average plan just wins
const WAVES = [
  [[['goblin', 8]], 1.2], [[['goblin', 12]], 1.0], [[['orc', 6], ['goblin', 6]], 1.2], [[['orc', 10]], 1.0],
  [[['goblin', 15], ['knight', 4]], .8], [[['orc', 12], ['goblin', 6]], .9], [[['knight', 6], ['orc', 10]], 1.1],
  [[['goblin', 25]], .5], [[['knight', 7], ['orc', 10]], 1.3] /* spec: 10 knights @1.0s; eased in TD-5 */, [[['knight', 12], ['orc', 15], ['goblin', 20], ['troll', 1]], 1.1] // spec interval 0.7; widened so the troll finale is beatable,
];

// ---------- maps: src/maps/*.json (SPEC-mobile.md §1), picked by viewport aspect with hysteresis (§2) ----------
const MAPS = Object.fromEntries(Object.values(import.meta.glob('./maps/*.json', { eager: true })).map(m => [m.default.id, m.default]));
const VARIANT = a => a < .8 ? 'portrait' : a <= 1.25 ? 'square' : 'landscape';
let variant = null;
function pickVariant() { // switch only when the aspect is >0.03 past a threshold
  const a = innerWidth / innerHeight, hy = .03;
  if (!variant || (VARIANT(a - hy) !== variant && VARIANT(a + hy) !== variant)) variant = VARIANT(a);
  return variant;
}
const pickMap = () => MAPS[Q.get('map')] || MAPS[pickVariant()];
let MAP, COLS, ROWS, PATH_TILES, PATH_SET, SPOTS, SPOT_SET, PTS, SEG, PLEN, SPOT_ORDER;
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function pathArt(i) { // corner/straight tile derived from the neighbours (SPEC.md §2), so maps only list path cells
  const P = [MAP.entry, ...PATH_TILES, MAP.exit], [c, r] = P[i + 1], side = ([x, y]) => Object.keys(DIRS).find(k => DIRS[k][0] === x - c && DIRS[k][1] === y - r);
  const s = new Set([side(P[i]), side(P[i + 2])]);
  if (s.has('e') && s.has('w')) return 'dirt_path_straight_h'; if (s.has('n') && s.has('s')) return 'dirt_path_straight_v';
  return 'dirt_path_corner_' + (s.has('n') ? 'n' : 's') + (s.has('e') ? 'e' : 'w');
}
function setMap(m) { // safe mid-run: towers are keyed by spot index (index-matched across variants), enemies keep path fraction
  const frac = g && PLEN ? g.enemies.map(e => e.dist / PLEN) : null;
  MAP = m; COLS = m.cols; ROWS = m.rows; PATH_TILES = m.path; SPOTS = m.spots;
  SPOT_SET = new Set(SPOTS.map(s => s + ''));
  PATH_SET = new Map(PATH_TILES.map((p, i) => [p + '', pathArt(i)]));
  const ctr = ([c, r]) => [c * TS + 64, r * TS + 64];
  PTS = [ctr(m.entry), ...PATH_TILES.map(ctr), ctr(m.exit)];
  SEG = []; PLEN = 0;
  for (let i = 1; i < PTS.length; i++) { const l = Math.hypot(PTS[i][0] - PTS[i - 1][0], PTS[i][1] - PTS[i - 1][1]); SEG.push([PLEN, l]); PLEN += l; }
  SPOT_ORDER = SPOTS.map((s, i) => [i, Math.min(...PATH_TILES.map((p, j) => Math.max(Math.abs(p[0] - s[0]), Math.abs(p[1] - s[1])) === 1 ? j : 99))]).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(a => a[0]);
  if (frac) g.enemies.forEach((e, i) => { e.dist = frac[i] * PLEN; [e.x, e.y] = pathPos(e.dist); });
  if (g) { g.dying = []; g.projs = []; g.arcs = []; g.fx = []; g.parts = []; }
}
function pathPos(d) {
  for (let i = 0; i < SEG.length; i++) if (d <= SEG[i][0] + SEG[i][1] || i === SEG.length - 1) {
    const t = Math.min(1, (d - SEG[i][0]) / SEG[i][1]), a = PTS[i], b = PTS[i + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
}
const spotC = i => [SPOTS[i][0] * TS + 64, SPOTS[i][1] * TS + 64];

// ---------- terrain (td-terrain kit, rules data-driven from manifest.terrain + the map's "terrain" block) ----------
// Layers (README-td-terrain.md): grass -> grass overlays -> path autotile -> [water, animated per frame] -> decals/props (Y-sorted).
// Static parts are pre-rendered on layout into groundLayer / propLayer; only the water cells are redrawn each frame.
let groundLayer = null, propLayer = null, MAP_EXTRA = 0, WATER = new Set(), waterDraw = [], TB = null;
const hash3 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0); };
const rng = s => () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 | 0), (((s ^ (s >>> 7)) >>> 0) % 1e6) / 1e6);
function roadCell(c, r) { // path, plus the road running off-map past spawn/exit (off-map neighbours of spawn/exit count as path)
  if (PATH_SET.has(c + ',' + r)) return true;
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) return false;
  for (const [e, p] of [[MAP.entry, PATH_TILES[0]], [MAP.exit, PATH_TILES.at(-1)]]) {
    const dx = Math.sign(e[0] - p[0]), dy = Math.sign(e[1] - p[1]);
    if (dy === 0 && r === p[1] && (c - p[0]) * dx > 0) return true;
    if (dx === 0 && c === p[0] && (r - p[1]) * dy > 0) return true;
  }
  return false;
}
function buildMapLayer() {
  const MT = M.terrain; if (!IMG.t_grass_0 || !MAP) return;
  const T = MAP.terrain, seed = T.seed | 0, d = L.dpr, k = L.k;
  WATER = new Set((T.water || []).map(p => p + '')); const BR = new Set((T.bridges || []).flatMap(([c, r]) => [[c - 1, r], [c, r], [c + 1, r]].map(p => p + '')));
  for (const b of BR) WATER.add(b);
  MAP_EXTRA = L.mode === 'sheet' ? Math.ceil(L.vh * .5) : 0; // room for the portrait pan
  const mk = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height + Math.round(MAP_EXTRA * d); return c; };
  groundLayer = mk(); propLayer = mk();
  const [wx0, wy0] = s2w(0, 0), [wx1, wy1] = s2w(L.vw, L.vh + MAP_EXTRA);
  const x0 = Math.floor(wx0 / TS) - 1, x1 = Math.ceil(wx1 / TS), y0 = Math.floor(wy0 / TS) - 1, y1 = Math.ceil(wy1 / TS) + 1; TB = { x0, x1, y0, y1 };
  const inside = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS, offL = (c, r) => c < x0 || c > x1 || r < y0 || r > y1;
  const g = groundLayer.getContext('2d'); g.imageSmoothingQuality = 'high'; g.setTransform(d * k, 0, 0, d * k, d * L.ox, d * L.oy);
  // 1 grass: hash(x,y,seed) % 8
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) g.drawImage(IMG[MT.grass[hash3(c, r, seed) % MT.grass.length]], c * TS - .5, r * TS - .5, TS + 1, TS + 1);
  // 2 overlay patches: ~1 per 6 cells, seeded RNG, free position
  const R = rng(seed * 7919 + 1), area = (x1 - x0 + 1) * (y1 - y0 + 1);
  for (let i = 0; i < area / MT.overlayPerCells; i++) { const px = (x0 + R() * (x1 - x0 + 1)) * TS - 64, py = (y0 + R() * (y1 - y0 + 1)) * TS - 64, im = IMG[MT.overlays[Math.floor(R() * MT.overlays.length)]]; g.drawImage(im, px, py, 256, 256); }
  // 3 path: 4-bit autotile N1 E2 S4 W8
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) if (roadCell(c, r)) {
    const m = (roadCell(c, r - 1) ? 1 : 0) | (roadCell(c + 1, r) ? 2 : 0) | (roadCell(c, r + 1) ? 4 : 0) | (roadCell(c - 1, r) ? 8 : 0);
    g.drawImage(IMG[MT.path[m]], c * TS - .5, r * TS - .5, TS + 1, TS + 1);
  }
  // 4 water: 8-bit blob mask (diagonals kept only with both cardinals) -> 47 tiles via maskToTile; drawn per frame
  const isW = (c, r) => WATER.has(c + ',' + r) || (offL(c, r) && WATER.size > 0 && [[c, Math.max(y0, Math.min(y1, r))], [Math.max(x0, Math.min(x1, c)), r]].some(p => WATER.has(p + ''))), B = MT.water.bits;
  waterDraw = [];
  for (const key of WATER) { const [c, r] = key.split(',').map(Number); if (offL(c, r)) continue;
    const n = isW(c, r - 1), e = isW(c + 1, r), s = isW(c, r + 1), w = isW(c - 1, r);
    let m = (n ? B.N : 0) | (e ? B.E : 0) | (s ? B.S : 0) | (w ? B.W : 0);
    if (n && e && isW(c + 1, r - 1)) m |= B.NE; if (s && e && isW(c + 1, r + 1)) m |= B.SE; if (s && w && isW(c - 1, r + 1)) m |= B.SW; if (n && w && isW(c - 1, r - 1)) m |= B.NW;
    waterDraw.push([c, r, MT.water.maskToTile[m], m]);
  }
  // 5/6 decals + props, Y-sorted by bottom-centre anchor
  const P = [], PR = rng(seed * 104729 + 3), pick = a => a[Math.floor(PR() * a.length)], S = MT.scatter;
  const busy = (c, r) => roadCell(c, r) || SPOT_SET.has(c + ',' + r);
  const near = (c, r, f) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (f(c + dx, r + dy)) return true; return false; };
  for (const [key, name] of Object.entries(T.fixed || {})) { const [c, r] = key.split(',').map(Number); if (MT.props[name]) P.push([name, c * TS + 64, r * TS + 112]); }
  const fixed = new Set(Object.keys(T.fixed || {}));
  for (const [c, r] of waterDraw) {
    if (!near(c, r, (a, b) => !WATER.has(a + ',' + b) && !offL(a, b)) && PR() < .5) P.push([pick(S.water), c * TS + 30 + PR() * 68, r * TS + 40 + PR() * 70, 1]);
  }
  for (let r = y0; r <= y1 + 1; r++) for (let c = x0; c <= x1; c++) {
    const key = c + ',' + r; if (busy(c, r) || WATER.has(key) || fixed.has(key)) continue;
    const ins = inside(c, r), nearBusy = near(c, r, busy), nearW = near(c, r, (a, b) => WATER.has(a + ',' + b));
    if (nearW && PR() < .55) P.push([pick(S.shoreRocks), c * TS + 20 + PR() * 88, r * TS + 30 + PR() * 80]); // break up the lake outline
    if (ins && nearBusy) { if (PR() < .3) P.push([pick(S.decals), c * TS + (PR() < .5 ? 14 : 114), r * TS + (PR() < .5 ? 24 : 124), 1]); continue; }
    const q = PR(), edge = !ins || c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1;
    if (!ins && !nearBusy && q < .7) P.push([pick(S.edgeTrees), c * TS + 64 + (PR() - .5) * 50, r * TS + 112 + (PR() - .5) * 24]);
    else if (edge && !nearBusy && q < .5) P.push([pick(S.edgeTrees.slice(0, 4)), c * TS + 64 + (PR() - .5) * 40, r * TS + 110 + (PR() - .5) * 20]);
    else if (q < .25) P.push([pick(S.mid), c * TS + 64 + (PR() - .5) * 60, r * TS + 90 + (PR() - .5) * 40]);
    for (let i = PR() < .5 ? 1 : 0; i > 0; i--) P.push([pick(S.decals), c * TS + 10 + PR() * 108, r * TS + 20 + PR() * 106, 1]);
  }
  for (const [c, r] of T.bridges || []) P.push(['bridge_h', c * TS + 64, r * TS + 127]);
  P.sort((a, b) => (b[3] || 0) - (a[3] || 0) || a[2] - b[2]); // flat decals first, then upright props back-to-front
  const p = propLayer.getContext('2d'); p.imageSmoothingQuality = 'high'; p.setTransform(d * k, 0, 0, d * k, d * L.ox, d * L.oy);
  const dim = T.edgeDim ?? 0;
  for (const [name, x, y] of P) { const pr = MT.props[name]; const im = IMG[pr.image]; p.drawImage(im, x - pr.anchor[0], y - pr.anchor[1]); }
  if (dim) { // outside the playable grid reads as scenery: soft vignette instead of per-cell boxes
    for (const L2 of [g, p]) { L2.save(); L2.globalCompositeOperation = 'source-atop'; L2.fillStyle = `rgba(20,30,10,${dim})`;
      L2.beginPath(); L2.rect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 2) * TS); L2.rect(0, 0, COLS * TS, ROWS * TS); L2.fill('evenodd'); L2.restore(); }
  }
  for (let i = 0; i < SPOTS.length; i++) { const [x, y] = spotC(i); g.drawImage(IMG.build_spot, x - 64, y - 64, TS, TS); }
}
function drawTerrain(t) {
  if (!groundLayer) return; const oy = Math.round(-L.pan * L.dpr);
  ctx.drawImage(groundLayer, 0, oy);
  const W = M.terrain.water, f = Math.floor(t * W.fps) % W.frames;
  ctx.save(); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.imageSmoothingQuality = 'high';
  for (const [c, r, tile] of waterDraw) { const im = IMG[W.image.replace('{tile}', tile).replace('{frame}', f)]; const [sx, sy] = w2s(c * TS, r * TS); if (im) ctx.drawImage(im, sx - .5, sy - .5, L.k * TS + 1, L.k * TS + 1); }
  if (MAP.terrain.edgeDim) { ctx.fillStyle = `rgba(20,30,10,${MAP.terrain.edgeDim})`; for (const [c, r] of waterDraw) if (!(c >= 0 && c < COLS && r >= 0 && r < ROWS)) { const [sx, sy] = w2s(c * TS, r * TS); ctx.fillRect(sx - .5, sy - .5, L.k * TS + 1, L.k * TS + 1); } }
  ctx.restore();
  ctx.drawImage(propLayer, 0, oy);
}

// ---------- responsive layout: ONE screen<->world transform (SPEC-mobile.md §2) ----------
// mode: 'sheet' (portrait + square: top bar + bottom sheet), 'rail' (landscape < 1280 px: top bar + 88 px right rail),
// 'desktop' (landscape >= 1280: SPEC.md layout). Tile s = clamp(min(P.w/cols, P.h/rows), 40, 128); outside the grid = edge fill.
const L = { vw: 1, vh: 1, dpr: 1, mode: 'desktop', k: 1, s: 128, ox: 0, oy: 0, pan: 0, panTo: 0, u: 1, crest: true, safe: { t: 0, r: 0, b: 0, l: 0 }, hudR: null, barR: null, sheetTop: 1e9 };
const probe = document.createElement('div'); probe.id = 'safe'; document.body.appendChild(probe);
const w2s = (x, y) => [L.ox + x * L.k, L.oy - L.pan + y * L.k];
const s2w = (sx, sy) => [(sx - L.ox) / L.k, (sy - L.oy + L.pan) / L.k];
let layoutQueued = false;
function queueLayout() { if (!layoutQueued) { layoutQueued = true; requestAnimationFrame(() => { layoutQueued = false; layout(); }); } }
function layout() { // all DOM reads happen here (resize / orientation / screen change), never per frame
  const vw = innerWidth, vh = innerHeight, cs = getComputedStyle(probe);
  const m = pickMap();
  if (m !== MAP) { setMap(m); if (screen === 'game' && g && !g.over && !g.paused) setPaused(true); } // mid-run variant switch: towers stay by spot index
  L.mode = MAP.cols > MAP.rows ? (vw >= 1280 ? 'desktop' : 'rail') : 'sheet';
  Object.assign(L, { vw, vh, dpr: Math.min(devicePixelRatio || 1, 2) });
  L.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  const a = vw / vh;
  L.u = L.mode === 'desktop' ? Math.max(1, Math.min(2, vw / 1600, vh / 900)) : 1;
  L.crest = L.mode !== 'sheet';
  for (const md of ['sheet', 'rail', 'desktop']) ui.classList.toggle('m-' + md, L.mode === md);
  ui.classList.toggle('crest', L.crest); ui.classList.toggle('portrait', L.mode === 'sheet'); void a;
  const P = { x: L.safe.l, y: L.safe.t, w: vw - L.safe.l - L.safe.r - (L.mode === 'rail' && screen === 'game' ? 88 : 0), h: vh - L.safe.t - L.safe.b };
  const s0 = Math.min(P.w / COLS, P.h / ROWS), s = Math.max(40, Math.min(128, s0));
  L.s = Math.floor(s * L.dpr) / L.dpr; L.k = L.s / TS; // whole device px per tile: no seams
  L.ox = P.x + (P.w - COLS * L.s) / 2; L.oy = P.y + (P.h - ROWS * L.s) / 2;
  rs.setProperty('--u', L.u); rs.setProperty('--s', L.s + 'px');
  cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  cv.width = Math.round(vw * L.dpr); cv.height = Math.round(vh * L.dpr);
  const rect = e => { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  L.hudR = screen === 'game' ? rect(H$.hud) : null; L.barR = screen === 'game' ? rect(H$.bar) : null;
  buildMapLayer();
  if (g && screen === 'game' && g.selSpot != null) openSel(g.selSpot, true);
}
addEventListener('resize', queueLayout); addEventListener('orientationchange', () => { queueLayout(); if (screen === 'game' && g && !g.over && !g.paused) setPaused(true); });
visualViewport?.addEventListener('resize', queueLayout);
// no accidental zoom / pull-to-refresh on the game surface
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
cv.addEventListener('dblclick', e => e.preventDefault());
let lastTouchEnd = 0;
cv.addEventListener('touchend', e => { const n = performance.now(); if (n - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = n; }, { passive: false });

// ---------- game state ----------
let screen = 'title', g = null;
function newGame() {
  g = {
    gold: DEBUG && Q.get('gold') ? +Q.get('gold') : 250, lives: 20, wave: 0, phase: 'build', countdown: 15,
    queue: [], spawnT: 0, interval: 1, enemies: [], towers: {}, projs: [], fx: [], arcs: [], dying: [], parts: [],
    speed: 1, paused: false, over: false, stats: { kills: 0, gold: 0, time: 0 }, slot: null, radial: null, sel: null,
    focus: -1, hover: -1, undo: null, total: 0, remaining: 0, shownGold: 250, heartFlash: 0,
  };
  g.shownGold = g.gold;
}
function addGold(n) { g.gold += n; g.stats.gold += n; }
function startWave() {
  if (!g || g.phase !== 'build' || g.over || g.wave >= WAVES.length) return;
  const bonus = Math.floor(g.countdown);
  if (bonus > 0) { addGold(bonus); play('coin'); toast(`+${bonus} early bonus`); }
  g.wave++; g.phase = 'wave';
  const [groups, iv] = WAVES[g.wave - 1];
  g.queue = groups.flatMap(([t, n]) => Array(n).fill(t)); g.interval = iv; g.spawnT = 0;
  g.total = g.remaining = g.queue.length;
  play('wave_start'); banner(`Wave ${g.wave} — ${waveLabel(g.wave)}`);
}
function spawn(type) {
  const d = EN[type], hp = d.boss ? d.hp : Math.floor(d.hp * (1 + HP_SCALE * (g.wave - 1)));
  if (d.boss) toast(`The ${d.name} is coming!`, 3000, 'avatar_troll');
  g.enemies.push({ type, d, hp, max: hp, dist: 0, slow: 0, slowT: 0, x: PTS[0][0], y: PTS[0][1], walkT: Math.random(), face: 'right', flash: 0 });
}
function damage(e, n) {
  if (e.dead) return;
  e.hp -= n; e.flash = .12;
  if (e.hp <= 0) {
    play('enemy_death_' + (1 + Math.floor(Math.random() * 3)));
    e.dead = true; g.remaining--; g.stats.kills++; addGold(e.d.gold); g.dying.push({ type: e.type, x: e.x, y: e.y, face: e.face, t: 0 });
    addFx(M.sprites?.['enemy.' + e.type]?.deathFx || 'fx_death_puff', e.x, e.y); if (!reduced) addFx('fx_coin_pop', e.x, e.y - 40);
  }
}
function addFx(k, x, y) { g.fx.push({ k, x, y, t: 0 }); }
function sparks(x, y, col, n = 7) { if (reduced) n = 3; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 220; g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: .25 + Math.random() * .2, col }); } }
const SPARK = { archer: '#f2deb0', cannon: '#ffb347', mage: '#c58bff', frost: '#bfefff', tesla: '#fff27a' };
function inRange(t, e) { const [cx, cy] = spotC(t.spot); return Math.hypot(e.x - cx, e.y - cy) <= t.st[3] * TS; }
function fire(t) {
  const inR = g.enemies.filter(e => !e.dead && inRange(t, e));
  if (!inR.length) return false;
  const doomed = inR.filter(e => (e.pend || 0) < e.hp), live = TW[t.type].splash || !doomed.length ? inR : doomed; // avoid overkill
  const tgt = live.reduce((a, b) => b.dist > a.dist ? b : a), D = TW[t.type], [cx, cy] = spotC(t.spot);
  play('fire_' + t.type); t.atk = .16;
  if (t.type === 'tesla') {
    let dmg = t.st[1], cur = tgt, from = [cx, cy - 70]; const hit = new Set();
    for (let i = 0; i < D.chain[t.lv - 1] && cur; i++) {
      hit.add(cur); g.arcs.push({ a: from, b: [cur.x, cur.y], t: .12 }); damage(cur, dmg); addFx(D.fx, cur.x, cur.y); sparks(cur.x, cur.y, SPARK.tesla, 4); if (i === 0) play(D.hit);
      from = [cur.x, cur.y]; dmg *= 0.8;
      const c = cur; cur = g.enemies.filter(e => !e.dead && !hit.has(e) && Math.hypot(e.x - c.x, e.y - c.y) <= 1.5 * TS).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    }
  } else { if (!D.splash) tgt.pend = (tgt.pend || 0) + t.st[1]; g.projs.push({ x: cx, y: cy - 70, tgt, tx: tgt.x, ty: tgt.y, t, dmg: D.splash ? 0 : t.st[1] }); }
  return true;
}
function hitProj(p) {
  const t = p.t, D = TW[t.type];
  if (D.splash) { const r = D.splash[t.lv - 1] * TS; for (const e of g.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) <= r) damage(e, t.st[1]); }
  else if (!p.tgt.dead) {
    p.tgt.pend -= p.dmg; damage(p.tgt, t.st[1]);
    if (D.slow) { const [pct, dur] = D.slow[t.lv - 1], e = p.tgt; if (e.slowT <= 0 || pct >= e.slow) { e.slow = pct; e.slowT = dur; } }
  }
  if (D.fx) addFx(D.fx, p.x, p.y); sparks(p.x, p.y, SPARK[t.type], D.fx ? 4 : 8);
  play(D.hit);
}
function step(dt) {
  g.stats.time += dt;
  if (g.phase === 'build') { g.countdown -= dt; if (g.countdown <= 0) { g.countdown = 0; startWave(); } }
  else {
    if (g.queue.length && (g.spawnT -= dt) <= 0) { spawn(g.queue.shift()); g.spawnT = g.interval; }
  }
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (e.slowT > 0) e.slowT -= dt; else e.slow = 0;
    e.dist += e.d.sp * TS * (1 - e.slow) * dt;
    const ox = e.x, oy = e.y; [e.x, e.y] = pathPos(e.dist);
    const fx = e.x - ox, fy = e.y - oy; if (Math.abs(fx) + Math.abs(fy) > .01) e.face = Math.abs(fx) >= Math.abs(fy) ? (fx < 0 ? 'left' : 'right') : (fy < 0 ? 'up' : 'down');
    e.walkT += dt * e.d.sp * (1 - e.slow); if (e.flash > 0) e.flash -= dt;
    if (e.dist >= PLEN) { e.dead = e.leaked = true; g.remaining--; (g.leaks ??= {})[e.type] = (g.leaks[e.type] || 0) + 1; g.lives = Math.max(0, g.lives - e.d.lives); g.heartFlash = .2; play('life_lost'); }
  }
  for (const t of Object.values(g.towers)) { if (t.atk > 0) t.atk -= dt; t.cd -= dt; if (t.cd <= 0 && fire(t)) t.cd = 1 / t.st[2]; }
  const sp = 8 * TS * dt;
  for (const p of g.projs) {
    if (!p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy); p.a = Math.atan2(dy, dx);
    if (l <= sp) { p.x = p.tx; p.y = p.ty; p.done = true; hitProj(p); } else { p.x += dx / l * sp; p.y += dy / l * sp; }
  }
  g.projs = g.projs.filter(p => !p.done);
  g.enemies = g.enemies.filter(e => !e.dead);
  for (const f of g.fx) f.t += dt; g.fx = g.fx.filter(f => f.t < animDur(f.k));
  for (const d of g.dying) d.t += dt; g.dying = g.dying.filter(d => d.t < deathDur(d.type));
  for (const q of g.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; } g.parts = g.parts.filter(q => q.t < q.life);
  for (const a of g.arcs) a.t -= dt; g.arcs = g.arcs.filter(a => a.t > 0);
  if (g.lives <= 0) return endGame(false);
  if (g.phase === 'wave' && !g.queue.length && !g.enemies.length) {
    const b = 20 + 5 * g.wave; addGold(b); play('coin'); toast(`Wave cleared! +${b} gold`);
    if (g.wave >= WAVES.length) return endGame(true);
    g.phase = 'build'; g.countdown = 12;
  }
}

// ---------- tower actions ----------
function build(spot, type) {
  if (g.towers[spot] || g.over) return false;
  const c = TW[type].lv[0][0]; if (g.gold < c) { play('ui_error'); return false; }
  play('build'); g.gold -= c; g.towers[spot] = { spot, type, lv: 1, st: TW[type].lv[0], cd: 0, invested: c };
  closePanels(); return true;
}
function upgrade(spot) {
  const t = g.towers[spot]; if (!t || t.lv >= 3) return false;
  const c = TW[t.type].lv[t.lv][0]; if (g.gold < c) { play('ui_error'); return false; }
  play('upgrade'); g.gold -= c; t.invested += c; t.lv++; t.st = TW[t.type].lv[t.lv - 1]; if (g.sel === spot) openSel(spot, true); buzz(); return true;
}
function sell(spot) {
  const t = g.towers[spot]; if (!t) return false;
  const r = Math.floor(t.invested * .7); g.gold += r; play('sell'); delete g.towers[spot];
  g.undo = { t, r, until: performance.now() + 3000 }; closePanels(); toast(`Sold for ${r}`, 3000, null, ['Undo', undoSell]); buzz(); return true;
}
function undoSell() {
  const u = g.undo; if (!u || performance.now() > u.until || g.towers[u.t.spot]) return;
  g.gold -= u.r; g.towers[u.t.spot] = u.t; g.undo = null; toast('Sale undone');
}

// ---------- UI: title ----------
function clearUI() { ui.innerHTML = ''; H$ = {}; }
function titleScreen() {
  screen = 'title'; g = null; clearUI(); modal = null; layout();
  img(ui, 'title_bg', 'nopt bgcover'); h('div', ui, 'dim nopt').style.opacity = .4;
  const wrap = h('div', ui, 'modal title'), card = h('div', wrap, 'tcard');
  if (M.logo) img(card, M.logo, 'nopt logo');
  ribbon(card, M.logo ? '' : 'TD', 'trib');
  const inn = panel(card, 'tpanel', false), box = h('div', inn, 'col');
  setMusic('menu');
  const foot = h('div', inn, 'foot', 'Hold the road. 10 waves. 20 lives.');
  const loaded = Object.keys(IMG).length > 0 && !failed.size;
  if (loaded) return titleButtons(box);
  const lt = h('div', box, 'loadtxt', 'Loading… 0%'), fr = h('div', box, 'loadbar'); fr.style.backgroundImage = url('bar_frame');
  const fill = h('div', fr, 'loadfill'); fill.style.backgroundImage = url('progress_fill');
  void foot;
  loadAll(p => { fill.style.width = 100 * p + '%'; lt.textContent = `Loading… ${Math.round(p * 100)}%`; }, failed.size ? new Set(failed) : null).then(() => {
    if (failed.size) { box.innerHTML = ''; h('div', box, 'loadtxt', "Some game files didn't load. Check your connection and try again."); btn(box, 'Retry', () => titleScreen()).focus(); return; }
    fontReady.then(titleScreen);
  });
}
function titleButtons(box) {
  const pl = btn(box, 'Play', startGame);
  btn(box, 'How to play', howTo);
  const snd = btn(box, '', () => setMuted(!muted));
  const mot = btn(box, '', () => { reduced = !reduced; localStorage.setItem('td.motion', reduced ? 'reduced' : 'full'); onSettings(); });
  onSettings = () => { snd.textContent = muted ? 'Sound: Off' : 'Sound: On'; mot.textContent = reduced ? 'Motion: Reduced' : 'Motion: Full'; };
  onSettings(); pl.focus();
}
let modal = null;
function mkModal(parent = ui) { const m = h('div', parent, 'modal'); h('div', m, 'dim'); return m; }
function howTo() {
  const prev = document.activeElement;
  modal = mkModal(); const inn = panel(modal, 'mpanel');
  h('div', inn, 'mtext', 'Tap or click a build spot, pick a tower, and stop enemies before they reach the exit. Each leaked enemy costs lives. Earn gold from kills and wave clears. Tap a tower to see its range, upgrade or sell it.');
  const ok = btn(h('div', inn, 'row'), 'Got it', () => { modal.remove(); modal = null; prev?.focus(); });
  modal.close = ok.onclick; ok.focus();
}

// ---------- UI: game (SPEC-mobile.md §3) ----------
let H$ = {};
const live = (s) => { if (H$.live) H$.live.textContent = s; };
function stat(p, icon, cls = '') { const s = h('div', p, 'stat ' + cls), i = img(s, icon, 'nopt hudico'); return [i, h('span', s, 'out display num')]; }
function startGame() {
  screen = 'game'; newGame(); clearUI(); setMusic('battle');
  const hud = H$.hud = h('div', ui, 'hud'); hud.style.backgroundImage = url('hud_body');
  const a = h('div', hud, 'hgrp');
  H$.gold = stat(a, 'icon_gold')[1]; [H$.heart, H$.lives] = stat(a, 'icon_heart'); H$.leftS = stat(a, 'icon_skull', 'skull'); H$.left = H$.leftS[1];
  const wc = h('div', hud, 'hgrp wavechip'); img(wc, 'icon_wave', 'nopt hudico'); H$.wave2 = h('span', wc, 'out display num');
  const c = h('div', hud, 'hgrp right');
  const pf = H$.wbar = h('div', c, 'wbar nopt'); pf.style.backgroundImage = url('bar_frame'); H$.wfill = h('div', pf, 'wfill'); H$.wfill.style.backgroundImage = url('wave_fill');
  H$.speed = btn(c, '', () => { g.speed = g.speed === 1 ? 2 : 1; }, 'Game speed 1x', 'hb');
  H$.pause = btn(c, '', () => setPaused(!g.paused), 'Pause', 'hb');
  H$.mute = btn(c, '', () => setMuted(!muted), 'Mute sound', 'hb mutebtn');
  const crest = h('div', ui, 'crestbox nopt'); img(crest, 'hud_center', 'nopt crestimg full'); const cc = h('img', crest, 'nopt crestimg compact'); cc.src = uiSrc(M.ui.compactCrest); cc.alt = ''; rs.setProperty('--crestY', M.ui.compactCrest.textY + 'px'); H$.wave = h('div', crest, 'out display crestt');
  onSettings = () => { setIcon(H$.mute, muted ? 'sound_off' : 'sound_on'); H$.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); };
  onSettings();
  // bottom bar (sheet + desktop modes) / right rail (rail mode): next wave + start
  const bar = H$.bar = h('div', ui, 'bbar'); bar.style.borderImageSource = url('actionbar_body');
  H$.slots = ORDER.map(k => slotBtn(bar, k, () => { g.slot = g.slot === k ? null : k; if (g.selSpot != null && !g.towers[g.selSpot]) pickCard(k); }, 'barslot'));
  H$.next = h('div', bar, 'next out');
  H$.start = btn(bar, 'Start wave', startWave, 'Start wave', 'start');
  H$.toast = h('div', ui, 'toasts');
  H$.sel = h('div', ui, 'selwrap');
  H$.tip = h('div', ui, 'tipb nopt'); H$.tip.hidden = true;
  H$.live = h('div', ui, 'sr'); H$.live.setAttribute('aria-live', 'polite');
  layout(); cv.focus({ preventScroll: true });
}
function slotBtn(parent, k, fn, cls = '') {
  const b = h('button', parent, 'slot ' + cls); b.onclick = fn;
  const name = `${TW[k].name} Tower (${ORDER.indexOf(k) + 1})`; b.title = name; b.setAttribute('aria-label', name);
  img(b, 'icon_' + k, 'nopt'); h('span', b, 'hk', ORDER.indexOf(k) + 1); h('span', b, 'cost', TW[k].lv[0][0]);
  longPress(b, () => TW[k].name + ' Tower — ' + TW[k].lv.map((l, i) => `Lv${i + 1}: ${l[0]}g, Dmg ${l[1]}, ${l[2]}/s, Rng ${l[3]}`).join(' · '));
  b.k = k; return b;
}
function closePanels() { if (!g) return; g.selSpot = null; g.ghost = null; g.radial = g.sel = null; if (H$.sel) H$.sel.innerHTML = ''; H$.up = null; H$.buildBtn = null; L.panTo = 0; }
const spotS = i => w2s(...spotC(i));
const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const spotRect = i => { const [sx, sy] = spotS(i), hs = L.s / 2; return { x: sx - hs, y: sy - hs, w: 2 * hs, h: 2 * hs }; };
function placeNear(p, spot) { // floating panel next to the spot: never over it, inside the safe area, avoiding HUD/bar
  const [sx, sy] = spotS(spot), hs = L.s / 2, m = 6, w = p.offsetWidth, hh = p.offsetHeight, s = L.safe;
  const sp = spotRect(spot);
  const cl = (x, y) => ({ x: Math.max(s.l + m, Math.min(L.vw - s.r - m - w, x)), y: Math.max(s.t + m, Math.min(L.vh - s.b - m - hh, y)), w, h: hh });
  const c = [cl(sx - w / 2, sy - hs - m - hh), cl(sx - w / 2, sy + hs + m), cl(sx + hs + m, sy - hh / 2), cl(sx - hs - m - w, sy - hh / 2)];
  const cost = r => ov(r, sp) * 1e4 + (L.hudR ? ov(r, L.hudR) : 0) + (L.barR ? ov(r, L.barR) : 0);
  const best = c.reduce((a, b) => cost(b) < cost(a) ? b : a);
  p.style.left = best.x + 'px'; p.style.top = best.y + 'px';
}
// Selection UI. sheet: bottom sheet; rail: slots/actions in the rail + detail card; desktop: floating panel by the spot.
function openSel(spot, keep) {
  const prevType = g.ghost?.spot === spot ? g.ghost.type : null;
  closePanels(); g.selSpot = spot; g.focus = spot;
  const t = g.towers[spot]; if (t) g.sel = spot; else g.radial = spot;
  const wrap = H$.sel, mode = L.mode;
  const box = panel(wrap, 'selp sel-' + mode + (t ? ' upg' : ' radial')), p = box.parentElement;
  if (mode === 'sheet') { const hd = h('img', box, 'handle nopt'); hd.src = uiSrc(M.ui.sheetHandle); hd.alt = ''; }
  let main = box, info = box;
  if (mode === 'rail') { info = panel(wrap, 'card'); }
  const title = h('div', info, 'stitle out display', t ? `${TW[t.type].name} Tower — Lv ${t.lv}` : 'Build here');
  H$.detail = null;
  if (!t) {
    const row = h('div', main, 'cards');
    H$.cards = H$.radialSlots = ORDER.map(k => slotBtn(row, k, () => { if (g.ghost?.type === k) return build(spot, k) && buzz(); pickCard(k); }, 'card'));
    H$.detail = h('div', info, 'detail', 'Pick a tower to preview it.');
    const acts = h('div', mode === 'rail' ? info : main, 'acts');
    btn(acts, 'Cancel', () => { closePanels(); cv.focus(); }, 'Cancel', 'cancel');
    H$.buildBtn = btn(acts, 'Build', () => { if (g.ghost && build(spot, g.ghost.type)) buzz(); }, 'Build', 'confirm');
    H$.buildBtn.disabled = true;
    const pre = prevType || g.slot; if (pre) pickCard(pre);
    if (!keep) (pre ? H$.buildBtn : H$.cards[0]).focus({ preventScroll: true });
  } else {
    const D = TW[t.type], top = h('div', main, 'urow');
    img(top, 'avatar_' + t.type, 'nopt av');
    const tx = h('div', mode === 'rail' ? info : top, 'utext'); h('div', tx, 'small', `Damage ${t.st[1]} · Rate ${t.st[2]}/s · Range ${t.st[3]}`);
    if (t.lv < 3) { const n = D.lv[t.lv], nl = h('div', tx, 'small'); nl.innerHTML = `Next: <span style="color:${T.good}">Damage ${n[1]}</span> · Rate ${n[2]}/s · <span style="color:${T.good}">Range ${n[3]}</span>`; }
    else h('div', tx, 'small', 'Max level reached');
    const acts = h('div', mode === 'rail' ? info : main, 'acts');
    H$.sell = btn(acts, `Sell ${Math.floor(t.invested * .7)}`, () => sell(spot), null, 'sellb');
    H$.up = btn(acts, '', () => upgrade(spot), null, 'confirm');
    H$.close = btn(acts, 'Close', () => { closePanels(); cv.focus(); }, 'Close', 'cancel');
    refreshUpgrade();
    if (!keep) (H$.up.disabled ? H$.sell : H$.up).focus({ preventScroll: true });
  }
  void title;
  if (mode === 'desktop') placeNear(p, spot);
  else if (mode === 'rail') { const cardP = info.parentElement; cardP.classList.toggle('flip', SPOTS[spot][0] >= Math.ceil(COLS * 2 / 3)); }
  else { // portrait: pan the map so the spot sits one tile above the sheet
    const top = L.vh - p.offsetHeight, [, sy] = w2s(...spotC(spot)), cur = L.pan;
    const need = sy + cur - L.pan + L.s / 2 + L.s - top; L.panTo = Math.max(0, Math.min(MAP_EXTRA, cur + need)); if (need < 0) L.panTo = Math.max(0, cur + need);
    if (reduced) L.pan = L.panTo;
  }
  live(t ? `${TW[t.type].name} tower selected` : `Spot ${spot + 1} selected`);
}
function pickCard(k) {
  if (g.selSpot == null || g.towers[g.selSpot]) return;
  g.ghost = { spot: g.selSpot, type: k }; g.slot = k;
  const c = TW[k].lv[0][0], [, d, r, rg] = TW[k].lv[0], okG = g.gold >= c;
  if (H$.detail) setT(H$.detail, `${TW[k].name} — Damage ${d} · Rate ${r}/s · Range ${rg}`);
  if (H$.buildBtn) { setT(H$.buildBtn, okG ? `Build ${c}` : `Need ${c}`); H$.buildBtn.disabled = !okG; H$.buildBtn.setAttribute('aria-label', `Build ${TW[k].name} Tower, ${c} gold`); }
}
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const waveLabel = w => [...new Set(WAVES[w - 1][0].map(g => EN[g[0]].name + 's'))].join(' & ');
const buzz = () => { try { navigator.vibrate?.(10); } catch {} return true; };
// back-compat names used by tests/keyboard
const openRadial = (s, keep) => openSel(s, keep), openUpgrade = (s, keep) => openSel(s, keep);
function refreshUpgrade() {
  const t = g.towers[g.sel]; if (!t || !H$.up) return;
  if (t.lv >= 3) { setT(H$.up, 'Max level'); H$.up.disabled = true; return; }
  const c = TW[t.type].lv[t.lv][0], ok = g.gold >= c;
  setT(H$.up, ok ? `Upgrade ${c}` : `Need ${c}`); if (H$.up.disabled !== !ok) H$.up.disabled = !ok;
}
function setIcon(b, name) { // manifest icon image, or text glyph placeholder
  if (b.icon === name) return false; b.icon = name; b.innerHTML = '';
  const ic = M.icons[name]; if (ic.image && IMG[ic.image]) img(b, ic.image, 'nopt ico'); else b.textContent = ic.text; return true;
}
// long-press (500 ms) replaces hover: shows a tooltip bubble
let lpT = null;
function showTip(text, x, y) {
  const t = H$.tip; if (!t) return; t.textContent = text; t.hidden = false; const tl = h('img', t, 'tail nopt'); tl.src = uiSrc(M.ui.tooltipTail); tl.alt = '';
  const w = t.offsetWidth, hh = t.offsetHeight;
  t.style.left = Math.max(L.safe.l + 6, Math.min(L.vw - L.safe.r - 6 - w, x - w / 2)) + 'px';
  t.style.top = Math.max(L.safe.t + 6, y - hh - 40) + 'px';
  clearTimeout(showTip.t); showTip.t = setTimeout(() => { t.hidden = true; }, 2500);
}
function longPress(el, textFn) {
  el.addEventListener('pointerdown', e => { clearTimeout(lpT); const x = e.clientX, y = e.clientY; lpT = setTimeout(() => { const s = textFn(x, y); if (s) { showTip(s, x, y); el._lp = true; } }, 500); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(lpT));
  el.addEventListener('click', e => { if (el._lp) { el._lp = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
let toastTimer;
function toast(s, ms = 2000, portrait, action) {
  if (!H$.toast) return; H$.toast.innerHTML = ''; const t = h('div', H$.toast, 'toast', s);
  if (portrait && IMG[portrait]) t.prepend(img(t, portrait, 'nopt portrait'));
  if (action) { const b = btn(t, M.icons.undo?.text || action[0], () => { action[1](); H$.toast.innerHTML = ''; }, action[0], 'undo'); if (M.icons.undo?.image && IMG[M.icons.undo.image]) setIcon(b, 'undo'); }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => H$.toast && (H$.toast.innerHTML = ''), ms);
}
function banner(s) {
  const r = ribbon(ui, s, 'banner');
  if (reduced) return setTimeout(() => r.remove(), 2100);
  r.classList.add('in'); setTimeout(() => r.style.opacity = 0, 1800); setTimeout(() => r.remove(), 2100);
}
function setPaused(v) {
  if (!g || g.over) return;
  g.paused = v; modal?.remove(); modal = null;
  if (!v) { cv.focus(); return; }
  modal = mkModal(); const inn = panel(modal, 'mpanel narrow');
  h('div', inn, 'out display big', 'Paused');
  const col = h('div', inn, 'col');
  const res = btn(col, 'Resume', () => setPaused(false));
  const snd = btn(col, '', () => setMuted(!muted)), mot = btn(col, '', () => { reduced = !reduced; localStorage.setItem('td.motion', reduced ? 'reduced' : 'full'); setLbl(); });
  const setLbl = () => { snd.textContent = muted ? 'Sound: Off' : 'Sound: On'; mot.textContent = reduced ? 'Motion: Reduced' : 'Motion: Full'; }; setLbl();
  const prevS = onSettings; onSettings = () => { prevS(); setLbl(); };
  const confirm = (fn) => {
    const c = mkModal(modal), ci = panel(c, 'mpanel narrow'); h('div', ci, 'mtext center', 'Lose this run?');
    const r = h('div', ci, 'row'); btn(r, 'Yes', fn); const no = btn(r, 'No', () => { c.remove(); modal.close = () => setPaused(false); res.focus(); });
    modal.close = no.onclick; no.focus();
  };
  btn(col, 'Restart', () => confirm(() => { modal = null; startGame(); }));
  btn(col, 'Quit to title', () => confirm(() => { modal = null; titleScreen(); }));
  modal.close = () => setPaused(false); modal.pause = true; modal.addEventListener('remove', () => {}); res.focus();
}
function endGame(win) {
  g.over = true; closePanels(); setMusic(null); play(win ? 'stinger_win' : 'stinger_lose');
  const best = JSON.parse(localStorage.getItem('td.best') || 'null'), cur = { wave: g.wave, lives: win ? g.lives : 0 };
  if (!best || cur.wave > best.wave || (cur.wave === best.wave && cur.lives > best.lives)) localStorage.setItem('td.best', JSON.stringify(cur));
  modal = mkModal(); const wrap = h('div', modal, 'tcard'); ribbon(wrap, win ? 'Victory!' : 'Defeat', 'trib'); const inn = panel(wrap, 'mpanel');
  h('div', inn, 'mtext center big2', win ? `The road holds. Lives left: ${g.lives} / 20` : `The enemy broke through on wave ${g.wave}.`);
  const s = Math.floor(g.stats.time);
  h('div', inn, 'mtext center', `Enemies defeated: ${g.stats.kills} · Gold earned: ${g.stats.gold.toLocaleString('en-US')} · Time: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  const r = h('div', inn, 'row');
  const a = btn(r, win ? 'Play again' : 'Retry', () => { modal = null; startGame(); });
  btn(r, 'Title', () => { modal = null; titleScreen(); });
  modal.result = win ? 'win' : 'lose'; a.focus();
}

// ---------- HUD refresh (writes only on change) ----------
let lastFrame = performance.now();
function refreshHUD(realDt) {
  const gd = g.gold - g.shownGold;
  g.shownGold = reduced || Math.abs(gd) < 1 ? g.gold : g.shownGold + gd * Math.min(1, realDt / 0.1);
  setT(H$.gold, Math.round(g.shownGold));
  setT(H$.lives, g.lives); setC(H$.lives, 'out display num' + (g.lives < 5 ? ' low' : ''));
  g.heartFlash -= realDt; setC(H$.heart, 'nopt hudico' + (g.heartFlash > 0 ? ' flash' : ''));
  setT(H$.left, g.phase === 'wave' ? g.remaining : 0);
  setT(H$.wave, `Wave ${g.wave}/${WAVES.length}`); setT(H$.wave2, `${g.wave}/${WAVES.length}`);
  const fw = (g.phase === 'wave' && g.total ? Math.round(100 * g.remaining / g.total) : 0) + '%'; if (H$.wfill._w !== fw) { H$.wfill._w = fw; H$.wfill.style.width = fw; }
  if (setIcon(H$.pause, g.paused ? 'play' : 'pause')) H$.pause.setAttribute('aria-label', g.paused ? 'Resume' : 'Pause');
  if (setIcon(H$.speed, g.speed === 1 ? 'speed1' : 'speed2')) H$.speed.setAttribute('aria-label', `Game speed ${g.speed}x`);
  for (const b of H$.slots) setC(b, 'slot barslot' + (g.gold < TW[b.k].lv[0][0] ? ' locked' : g.slot === b.k ? ' sel' : ''));
  if (g.radial != null && H$.cards) for (const b of H$.cards) setC(b, 'slot card' + (g.ghost?.type === b.k ? ' sel' : g.gold < TW[b.k].lv[0][0] ? ' locked' : ''));
  setC(H$.bar, 'bbar' + (g.phase === 'wave' ? ' inwave' : ''));
  if (L.pan !== L.panTo) { const d = L.panTo - L.pan; L.pan = Math.abs(d) < 1 ? L.panTo : L.pan + d * Math.min(1, realDt / .08); }
  setT(H$.start, g.phase === 'build' ? (L.mode === 'rail' ? `Start ${Math.ceil(g.countdown)}` : `Start wave (${Math.ceil(g.countdown)})`) : 'Start wave'); if (H$.start.disabled !== (g.phase !== 'build')) H$.start.disabled = g.phase !== 'build';
  const nw = g.wave + 1;
  if (g.phase === 'build') setT(H$.next, nw <= WAVES.length ? 'Next: ' + WAVES[nw - 1][0].map(([t, n]) => plural(n, EN[t].name)).join(', ') : ''); else setT(H$.next, `${g.remaining} left`);
  refreshUpgrade();
}

// ---------- animation system (data-driven: manifest.anims + manifest.sprites) ----------
// anim def: { sheet | sheets{dir:imgKey}, frameWidth, frameHeight, frames, rows{dir:row}, fps, anchor[ax,ay] | anchorPx[x,y], loop }
const ANIM = M.anims || {}, SPR = M.sprites || {};
const sprite = (id, state) => { const a = SPR[id]?.[state]; return a ? ANIM[a] : null; };
const animDur = k => { const a = ANIM[k]; return a ? (reduced ? .15 : (a.frames || 1) / (a.fps || 12)) : .3; };
const DEATH = .45;
const deathDur = type => { const a = sprite('enemy.' + type, 'death'); return a ? (a.frames || 1) / (a.fps || 12) : DEATH; };
function frameOf(a, t, dir) { // -> {i:image, sx, sy, sw, sh, ax, ay}
  const n = a.frames || 1, f = a.loop === false ? Math.min(n - 1, Math.floor(t * (a.fps || 12))) : Math.floor(t * (a.fps || 12)) % n;
  const dirs = a.sheets ? a.sheets : null, key = dirs ? (dirs[dir] || dirs[dir === 'up' || dir === 'down' ? 'right' : dir] || Object.values(dirs)[0]) : a.sheet;
  const i = IMG[key]; if (!i) return null;
  const fw = a.frameWidth || i.width / n, fh = a.frameHeight || (a.rows ? i.height / Object.keys(a.rows).length : i.height);
  const row = a.rows ? (a.rows[dir] ?? a.rows[dir === 'up' || dir === 'down' ? 'right' : dir] ?? 0) : 0;
  const [ax, ay] = a.anchorPx ? a.anchorPx : [(a.anchor?.[0] ?? .5) * fw, (a.anchor?.[1] ?? 1) * fh];
  return { i, sx: f * fw, sy: row * fh, sw: fw, sh: fh, ax, ay, frames: n };
}
const flashCache = new Map();
function whiteOf(fr) { // white silhouette of one frame, cached (procedural hit flash)
  const key = fr.i.src + fr.sx + ',' + fr.sy; let c = flashCache.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = fr.sw; c.height = fr.sh; const x = c.getContext('2d'); x.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, fr.sw, fr.sh); flashCache.set(key, c); }
  return c;
}
function at(x, y, s = 1) { const [sx, sy] = w2s(x, y), d = L.dpr * L.k * s; ctx.setTransform(d, 0, 0, d, L.dpr * sx, L.dpr * sy); }
function drawFrame(fr, sx = 1, sy = 1, alpha = 1, flash = 0) {
  if (!fr) return;
  ctx.globalAlpha = alpha; ctx.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, -fr.ax * sx, -fr.ay * sy, fr.sw * sx, fr.sh * sy);
  if (flash > 0) { ctx.globalAlpha = alpha * flash; ctx.drawImage(whiteOf(fr), -fr.ax * sx, -fr.ay * sy, fr.sw * sx, fr.sh * sy); }
  ctx.globalAlpha = 1;
}
const stillDef = key => ({ sheet: key, frames: 1, anchor: [.5, 1] });
function enemyFrame(type, state, t, dir) {
  const a = sprite('enemy.' + type, state) || (state === 'walk' ? stillDef(EN[type].sprite || 'enemy_' + type) : null);
  return a && frameOf(a, t, dir);
}

// ---------- render ----------
let cvFocused = false;
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  if (screen !== 'game' || !g) return;
  drawTerrain(performance.now() / 1000);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const items = [];
  for (const t of Object.values(g.towers)) {
    const [x, y] = spotC(t.spot), id = `tower.${t.type}.${t.lv}`, atk = t.atk > 0 ? t.atk / .16 : 0;
    const aa = atk > 0 && sprite(id, 'attack'), fr = aa ? frameOf(aa, .16 - t.atk, 'right') : frameOf(sprite(id, 'idle') || stillDef(`tower_${t.type}_l${t.lv}`), g.stats.time, 'right');
    items.push([w2s(x, y + 56)[1], () => { // recoil fallback when there is no attack sheet: dip + squash
      at(x, y + 56 + (aa ? 0 : 5 * atk)); drawFrame(fr, aa ? 1 : 1 + .04 * atk, aa ? 1 : 1 - .07 * atk);
      if (!aa && atk > .5 && !reduced) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = SPARK[t.type]; ctx.globalAlpha = (atk - .5) * 1.2; ctx.beginPath(); ctx.arc(0, -fr.ay + 34, 18, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }]);
  }
  for (const e of g.enemies) {
    const fr = enemyFrame(e.type, 'walk', e.walkT * 2, e.face), proc = !fr || fr.frames <= 1, ph = Math.sin(e.walkT * 2 * Math.PI * 1.6);
    const hit = e.flash > 0 && sprite('enemy.' + e.type, 'hit'), hf = hit ? frameOf(hit, .12 - e.flash, e.face) : null;
    items.push([w2s(e.x, e.y + 36)[1], () => { // walk fallback: bob + squash
      at(e.x, e.y + 36 - (proc && !reduced ? Math.abs(ph) * 7 : 0));
      if (hf) drawFrame(hf); else drawFrame(fr, proc ? 1 + .035 * ph : 1, proc ? 1 - .035 * ph : 1, 1, e.flash > 0 ? e.flash / .12 * .85 : 0);
    }]);
  }
  for (const d of g.dying) {
    const a = sprite('enemy.' + d.type, 'death'), q = d.t / deathDur(d.type);
    items.push([w2s(d.x, d.y + 36)[1], () => {
      if (a) { at(d.x, d.y + 36); drawFrame(frameOf(a, d.t, d.face)); return; }
      const fr = enemyFrame(d.type, 'walk', 0, d.face); at(d.x, d.y + 36); drawFrame(fr, 1 - .5 * q, 1 - .6 * q, 1 - q, q < .3 ? 1 - q / .3 : 0); // fade + shrink
    }]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  for (const p of g.projs) {
    const a = sprite('projectile.' + TW[p.t.type].proj.replace('projectile_', ''), 'fly'), fr = frameOf(a || { sheet: TW[p.t.type].proj, frames: 1, anchor: [.5, .5] }, g.stats.time, 'right');
    at(p.x, p.y); ctx.rotate(p.a || 0); drawFrame(fr);
  }
  for (const r of g.arcs) { // lightning: anchored at its left end, stretched to the target
    const [x1, y1] = r.a, [x2, y2] = r.b, a = sprite('projectile.lightning_arc', 'fly'), fr = frameOf(a || { sheet: 'projectile_lightning_arc', frames: 1, anchorPx: [0, 20] }, .12 - r.t, 'right');
    if (!fr) continue; at(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    const len = Math.hypot(x2 - x1, y2 - y1); ctx.globalAlpha = Math.min(1, r.t / .06); ctx.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, 0, -fr.ay, len, fr.sh); ctx.globalAlpha = 1;
  }
  for (const f of g.fx) { const a = ANIM[f.k] || { sheet: f.k, frameWidth: 128, frameHeight: 128, frames: 4, fps: 12, anchor: [.5, .5], loop: false }; at(f.x, f.y); drawFrame(frameOf(a, reduced ? .17 : f.t, 'right')); }
  if (g.parts.length) { ctx.globalCompositeOperation = 'lighter'; for (const q of g.parts) { at(q.x, q.y); ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.col; ctx.fillRect(-4, -4, 8, 8); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  for (const e of g.enemies) {
    if (e.hp >= e.max) continue;
    const fr = enemyFrame(e.type, 'walk', 0, e.face), hh = fr ? fr.ay : EN[e.type].h;
    at(e.x, e.y + 36); ctx.fillStyle = T.outline; ctx.fillRect(-24, -hh - 14, 48, 6);
    ctx.fillStyle = e.hp / e.max < .3 ? T.bad : T.good; ctx.fillRect(-24, -hh - 14, 48 * Math.max(0, e.hp / e.max), 6);
  }
  // overlays
  if (g.radial != null) { at(...spotC(g.radial)); ctx.drawImage(IMG.place_valid, -64, -64, TS, TS); }
  if (g.slot && g.radial == null && L.mode === 'desktop') SPOTS.forEach((_, i) => { at(...spotC(i)); ctx.drawImage(g.towers[i] ? IMG.place_invalid : IMG.place_valid, -64, -64, TS, TS); });
  if (g.ghost && !g.towers[g.ghost.spot]) { const [x, y] = spotC(g.ghost.spot), fr = frameOf(sprite(`tower.${g.ghost.type}.1`, 'idle') || stillDef(`tower_${g.ghost.type}_l1`), 0, 'right'); at(x, y + 56); ctx.globalCompositeOperation = 'source-over'; drawFrame(fr, 1, 1, .5); }
  const rangeOf = i => { const t = g.towers[i]; if (t) return t.st[3]; if (i === g.radial && g.ghost) return TW[g.ghost.type].lv[0][3]; };
  for (const i of new Set([g.hover, g.sel, cvFocused ? g.focus : -1, g.radial])) {
    if (i == null || i < 0) continue; const rr = rangeOf(i); if (!rr || (i === g.hover && !g.towers[i] && i !== g.radial)) continue;
    at(...spotC(i)); ctx.drawImage(IMG.range_circle, -rr * TS, -rr * TS, 2 * rr * TS, 2 * rr * TS);
  }
  if (cvFocused && g.focus >= 0) { at(...spotC(g.focus)); ctx.strokeStyle = T.focus; ctx.lineWidth = 6; ctx.strokeRect(-60, -60, 120, 120); }
}
function loop(now) {
  const real = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  if (screen === 'game' && g) {
    if (!g.paused && !g.over) { let dt = real * g.speed * FF; while (dt > 0 && !g.over) { const s = Math.min(dt, 1 / 60); step(s); dt -= s; } }
    if (H$.gold) refreshHUD(real);
  }
  render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- input: pointer events (mouse, touch, pen) through the same screen->world transform ----------
let lastPtr = 'mouse';
addEventListener('pointerdown', e => { lastPtr = e.pointerType || 'mouse'; }, true);
function spotAtXY(x, y) { // nearest spot centre within max(28 CSS px, half a tile): >= 56 px targets even at s = 44
  let best = -1, bd = Math.max(28, L.s / 2);
  SPOTS.forEach((_, i) => { const [sx, sy] = spotS(i), d = Math.hypot(sx - x, sy - y); if (d <= bd) { bd = d; best = i; } });
  return best;
}
function activateSpot(i) {
  if (i < 0) return closePanels();
  g.focus = i; openSel(i);
}
cv.addEventListener('pointermove', ev => { if (g && ev.pointerType === 'mouse') g.hover = spotAtXY(ev.clientX, ev.clientY); });
cv.addEventListener('pointerleave', () => { if (g) g.hover = -1; });
longPress(cv, (x, y) => { if (!g) return; const i = spotAtXY(x, y); if (i < 0) return; const t = g.towers[i]; return t ? `${TW[t.type].name} Lv ${t.lv} — Damage ${t.st[1]} · Rate ${t.st[2]}/s · Range ${t.st[3]} · Sell ${Math.floor(t.invested * .7)}` : 'Empty build spot — tap to build'; });
cv.addEventListener('click', ev => { if (screen === 'game' && g && !modal) activateSpot(spotAtXY(ev.clientX, ev.clientY)); });
cv.addEventListener('focus', () => { cvFocused = true; if (g && g.focus < 0) g.focus = SPOT_ORDER[0]; });
cv.addEventListener('blur', () => { cvFocused = false; });
addEventListener('contextmenu', ev => { if (screen === 'game') { ev.preventDefault(); if (g && !modal) { closePanels(); g.slot = null; } } });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'game' && g && !g.paused && !g.over) setPaused(true); });
function moveFocus(k) { // nearest build spot in the arrow's direction (screen space)
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
  if (g.focus < 0) { g.focus = SPOT_ORDER[0]; return; }
  const [c0, r0] = SPOTS[g.focus]; let best = -1, bs = 1e9;
  SPOTS.forEach(([c, r], i) => { const dx = c - c0, dy = r - r0, along = dx * d[0] + dy * d[1], across = Math.abs(dx * d[1] - dy * d[0]); if (i === g.focus || along <= 0) return; const sc = along + across * 2; if (sc < bs) { bs = sc; best = i; } });
  if (best >= 0) g.focus = best;
}
addEventListener('keydown', ev => {
  const k = ev.key;
  if (k === 'm' || k === 'M') return setMuted(!muted);
  if (screen === 'title') { if (k === 'Escape' && modal) modal.close(); return; }
  if (!g) return;
  if ((k === 'p' || k === 'P') && !g.over && (!modal || modal.pause)) return setPaused(!g.paused); // true toggle, also from the pause modal
  if (modal) { if (k === 'Escape' && modal.close) modal.close(); return; }
  const onBtn = document.activeElement?.tagName === 'BUTTON';
  if (k >= '1' && k <= '5') { const t = ORDER[+k - 1]; if (g.radial != null) pickCard(t); else g.slot = g.slot === t ? null : t; }
  else if (k.startsWith('Arrow') && !onBtn) { ev.preventDefault(); cv.focus(); moveFocus(k); }
  else if (k === 'Enter' && !onBtn && g.focus >= 0) { ev.preventDefault(); activateSpot(g.focus); }
  else if (k === 'u' || k === 'U') { if (g.sel != null) upgrade(g.sel); }
  else if (k === 's' || k === 'S') { if (g.sel != null) sell(g.sel); }
  else if (k === 'z' || k === 'Z') undoSell();
  else if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'f' || k === 'F') g.speed = g.speed === 1 ? 2 : 1;
  else if (k === 'Escape') { if (g.radial != null || g.sel != null) { closePanels(); cv.focus(); } else if (g.slot) g.slot = null; else setPaused(true); }
});

if (DEBUG) window.td = { IMG, played, get actx() { return actx?.state; }, get g() { return g; }, get screen() { return screen; }, get modal() { return modal?.result; }, build, upgrade, sell, undoSell, startWave, startGame, get SPOTS() { return SPOTS; }, get map() { return MAP.id; }, get PATHLEN() { return PLEN; }, MAPS, setMap, layout, pathArt, L, spotS, s2w, w2s, spotAtXY };
layout(); fontReady.then(titleScreen);

mobileCSS();
