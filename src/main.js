import manifest from './manifest.json';
import './style.css';
import { genMaps } from './mapgen.js';
import { mapBounds } from './scenery.js';
import { RESEARCH, DOCTRINES, DOCTRINE_COST, REPAIR_COST, newKingdom, rankOf, totalRanks, modifiers, towerStats, researchOffer, buyResearch, doctrineOffer, chooseDoctrine, killReward, waveReward, sellValue, absorbLeak, buyRepair } from './kingdom.js';

const M = JSON.parse(JSON.stringify(manifest), (_key, value) =>
  typeof value === 'string' && value.startsWith('assets/') ? import.meta.env.BASE_URL + value : value);

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
    st(sel, d, 'normal'); st(sel + ':active', d, 'pressed'); st(sel + '.off', d, 'disabled'); st(sel + '.sel', d, 'selected');
  }
  // TD-9a hud2 skin: bottom panel / rail, build-bar slots, Start wave, wave progress
  st('#ui:not(.m-desktop) .bbar', U.hudPanel, '', .22); R.push(`#ui:not(.m-desktop) .bbar{border-image-source:url("${uiSrc(U.hudPanel)}")!important}`);
  st('#ui:not(.m-desktop) .bbar .start', U.startWave, 'normal'); st('#ui:not(.m-desktop) .bbar .start:active', U.startWave, 'pressed'); st('#ui:not(.m-desktop) .bbar .start:disabled', U.startWave, 'disabled');
  // TD-10: icon tile uses the plain slot64 frame (towerSlot art has a built-in cost plate the icon would cover); cost sits below
  R.push(`#ui .bbar .barslot{border:0;background:none}#ui .bbar .barslot .tbox{background:url("${uiSrc(U.slot64, 'normal')}") center/100% 100% no-repeat}`);
  // TD-10b: ONE frame per slot = the hud2 icon tile (.tbox); the per-state slot64 border-image on the button itself made a double frame on off/sel slots and shifted Archer
  R.push('#ui .bbar button.slot.barslot,#ui .bbar button.slot.barslot.off,#ui .bbar button.slot.barslot.sel{border:0!important;border-image:none!important;background:none!important;box-sizing:border-box}');
  R.push(`#ui .bbar .barslot:active .tbox{background-image:url("${uiSrc(U.slot64, 'pressed')}")}#ui .bbar .barslot.off .tbox{background-image:url("${uiSrc(U.slot64, 'disabled')}")}`);
  // TD-10: no towerSlotSel overlay (its cost plate would sit on the icon); selection = slot64 'selected' frame round the whole slot
  R.push(`#ui .hud .wbar{${nine(U.waveFrame, '', .5)}background:none;box-sizing:border-box;padding:0}`, `#ui .hud .wfill{${nine(U.waveFill, '', .5)}border-top-width:0;border-bottom-width:0;background:none;box-sizing:border-box}`);
  st('#ui:not(.m-desktop) .hud', U.hudPanelTop, '', 0.5); R.push(`#ui:not(.m-desktop) .hud{background-image:none!important;border-radius:0}`);
  R.push(`#ui:not(.m-desktop) .tipb{${nine(U.tooltip, '')}background:none;color:#2a1a12}`);
  // TD-11c: boss banner = hud2 ribbon_boss 9-slice (72px caps, body stretches); text stays live. z = banner height / 80px art height
  if (U.ribbonBoss) R.push(`.banner.b-boss>img.rib-l,.banner.b-boss>img.rib-r,.banner.b-boss>.rib-b{display:none}.banner.b-boss{${nine(U.ribbonBoss, '', .8)}border-top-width:0;border-bottom-width:0;height:64px;box-sizing:border-box;background:none}`);
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
const syncMotion = () => document.documentElement.classList.toggle('reduce-motion', reduced); syncMotion(); // TD-11c: in-game setting drives the same CSS as prefers-reduced-motion

// ---------- assets ----------
const IMG = {}, SND = {};
let actx = null, master = null;
const failed = new Set();
function loadImage(k) {
  return new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; failed.delete(k); res(); }; i.onerror = () => { failed.add(k); res(); }; i.src = KX > 1 && M.imageScales?.[k]?.includes(KX) ? M.images[k].replace(/\.png$/, `@${KX}x.png`) : M.images[k]; });
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
  archer: { name: 'Archer', lv: [[70, 12, 1.25, 2.5], [60, 18, 1.4, 2.75], [90, 26, 1.6, 3]], proj: 'projectile_arrow', fx: 'impact_archer', hit: 'hit_arrow' },
  cannon: { name: 'Cannon', lv: [[120, 30, .5, 2.25], [90, 45, .55, 2.5], [130, 65, .6, 2.75]], proj: 'projectile_cannonball', fx: 'impact_cannon', hit: 'hit_cannon', splash: [.75, .85, 1] },
  mage: { name: 'Mage', lv: [[100, 28, .8, 2.5], [80, 42, .8, 2.75], [120, 60, .9, 3]], proj: 'projectile_magic_bolt', fx: 'impact_mage', hit: 'hit_magic' },
  frost: { name: 'Frost', lv: [[90, 6, 1, 2], [70, 9, 1, 2.25], [100, 12, 1.2, 2.5]], proj: 'projectile_frost_shard', fx: 'impact_frost', hit: 'hit_frost', slow: [[.35, 1.5], [.45, 1.5], [.55, 2]] },
  tesla: { name: 'Tesla', lv: [[150, 16, .9, 2], [110, 24, 1, 2.25], [150, 34, 1.1, 2.5]], proj: 'projectile_lightning_arc', fx: 'impact_tesla', hit: 'hit_lightning', chain: [3, 4, 5] },
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
// TD-9b: the JSON files are now templates (size, HUD rows, terrain rules); path + spots + water come from mapgen.js per seed.
const TPL = Object.fromEntries(Object.values(import.meta.glob('./maps/*.json', { eager: true })).map(m => [m.default.id, m.default]));
let MAPS, SEED;
function newSeed() { // ?seed=<n> reproduces; otherwise a fresh seed on every start
  SEED = Q.has('seed') ? (+Q.get('seed') >>> 0) : (Math.random() * 2 ** 31) >>> 0;
  MAPS = genMaps(SEED, TPL); console.log('map seed', SEED);
}
newSeed();
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
  m.bounds = mapBounds(m);
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
let groundLayer = null, propLayer = null, MAP_EXTRA = 0, WATER = new Set(), waterDraw = [], TB = null, castleSite = null;
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
  const castleProp = MT.props.castle;
  const castle = MAP.castle;
  castleSite = castle;
  if (castle) {
    P.push(['castle', castle.c * TS + castleProp.anchor[0], castle.r * TS + castleProp.anchor[1]]);
    for (let r = castle.r - 1; r <= castle.r + castle.height; r++) for (let c = castle.c - 1; c <= castle.c + castle.width; c++) fixed.add(c + ',' + r);
  }
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
  for (const [name, x, y] of P) { const pr = MT.props[name]; const im = IMG[pr.image]; p.drawImage(im, x - pr.anchor[0], y - pr.anchor[1], ...pr.size); }
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
  Object.assign(L, { vw, vh, dpr: Math.min(devicePixelRatio || 1, 3) }); // SPEC-mobile: up to DPR 3
  L.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  const a = vw / vh;
  L.u = L.mode === 'desktop' ? Math.max(1, Math.min(2, vw / 1600, vh / 900)) : 1;
  L.crest = L.mode !== 'sheet';
  for (const md of ['sheet', 'rail', 'desktop']) ui.classList.toggle('m-' + md, L.mode === md);
  ui.classList.toggle('crest', L.crest); ui.classList.toggle('portrait', L.mode === 'sheet'); void a;
  const rect = e => { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const inGame = screen === 'game';
  L.hudR = inGame ? rect(H$.hud) : null; L.barR = inGame ? rect(H$.bar) : null;
  // unobscured play rect: safe area minus top HUD, bottom bar/sheet (sheet + desktop) or right rail (rail)
  const P = { x: L.safe.l, y: L.safe.t, w: vw - L.safe.l - L.safe.r, h: vh - L.safe.t - L.safe.b };
  if (inGame && L.hudR) { const t = L.hudR.y + L.hudR.h + 2; P.h -= t - P.y; P.y = t; }
  if (inGame && L.barR) { if (L.mode === 'rail') P.w = Math.min(P.w, L.barR.x - 2 - P.x); else P.h = Math.min(P.h, L.barR.y - 2 - P.y); }
  L.play = P;
  // fit the playable bounds (every spot, every path cell incl. spawn/exit) plus a 28 px tap-circle margin into P.
  // Decor-only rows/cols outside those bounds may sit under the bars (SPEC-mobile §2).
  const B = MAP.bounds, bc = B.c1 - B.c0 + 1, br = B.r1 - B.r0 + 1, TAP = 28;
  const fit = (len, n) => { const a = len / n; return a >= 2 * TAP ? a : (len - 2 * TAP) / Math.max(1, n - 1); };
  const s = Math.min(128, fit(P.w, bc), fit(P.h, br));
  L.s = Math.floor(s * L.dpr) / L.dpr; L.k = L.s / TS; // whole device px per tile: no seams
  L.ox = P.x + (P.w - bc * L.s) / 2 - B.c0 * L.s; L.oy = P.y + (P.h - br * L.s) / 2 - B.r0 * L.s;
  rs.setProperty('--u', L.u); rs.setProperty('--s', L.s + 'px');
  cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  cv.width = Math.round(vw * L.dpr); cv.height = Math.round(vh * L.dpr);
  buildMapLayer();
  if (g && screen === 'game' && g.selSpot != null) openSel(g.selSpot, true);
}
addEventListener('resize', queueLayout); addEventListener('orientationchange', () => { queueLayout(); if (screen === 'game' && g && !g.over && !g.paused) setPaused(true); });
visualViewport?.addEventListener('resize', queueLayout);
// no accidental zoom / pull-to-refresh on the game surface
// TD-9c: iOS Safari double-tap zoom. CSS touch-action does most of it (manipulation on page/UI, none on the canvas);
// this guard cancels the zoom gesture on a 2nd touchend within 350 ms and replays it as a click, so fast double taps = 2 game taps.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
let lastTouchEnd = -1e9;
document.addEventListener('touchend', e => {
  const t = e.changedTouches[0], fast = e.timeStamp - lastTouchEnd < 350; lastTouchEnd = e.timeStamp;
  if (!fast || !e.cancelable || e.touches.length || !t) return;
  e.preventDefault(); // kills the zoom, but also the native click: replay it on the element under the finger
  const el = document.elementFromPoint(t.clientX, t.clientY) || e.target;
  if (!el.disabled) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, view: window }));
}, { passive: false });

// ---------- game state ----------
let screen = 'title', g = null;
function newGame() {
  g = {
    gold: DEBUG && Q.get('gold') ? +Q.get('gold') : 250, lives: 20, wave: 0, phase: 'build', countdown: 15,
    queue: [], spawnT: 0, interval: 1, enemies: [], towers: {}, projs: [], fx: [], arcs: [], dying: [], parts: [],
    speed: 1, paused: false, over: false, stats: { kills: 0, gold: 0, time: 0 }, slot: null, radial: null, sel: null,
    focus: -1, hover: -1, undo: null, total: 0, remaining: 0, shownGold: 250, heartFlash: 0,
    kingdom: newKingdom(),
  };
  g.shownGold = g.gold;
}
function addGold(n) { g.gold += n; g.stats.gold += n; }
const BREATHER = 12, BOSS_BREATHER = 18; // seconds between waves; the finale gets a longer build-up
const isBoss = w => WAVES[w - 1]?.[0].some(([t]) => EN[t].boss);
function startWave() {
  if (!g || g.paused || g.phase !== 'build' || g.over || g.wave >= WAVES.length) return;
  const bonus = Math.floor(g.countdown);
  if (bonus > 0) { addGold(bonus); play('coin'); toast(`Early start! +${bonus} gold`); }
  g.wave++; g.phase = 'wave';
  g.kingdom.wards = modifiers(g.kingdom).wards;
  const [groups, iv] = WAVES[g.wave - 1];
  g.queue = groups.flatMap(([t, n]) => Array(n).fill(t)); g.interval = iv; g.spawnT = 0;
  g.total = g.remaining = g.queue.length;
  play('wave_start'); shake(isBoss(g.wave) ? 6 : 3);
  if (isBoss(g.wave)) banner('Final wave!', 'The Troll leads the horde', 'boss', 'avatar_troll'); else banner(`Wave ${g.wave}`, waveLabel(g.wave));
}
function spawn(type) {
  const d = EN[type], hp = d.boss ? d.hp : Math.floor(d.hp * (1 + HP_SCALE * (g.wave - 1)));
  if (d.boss) { play('boss_intro'); shake(12); banner(`The ${d.name}!`, `${d.hp} HP · costs ${d.lives} lives if it gets through`, 'boss', 'avatar_troll', 2800); }
  g.enemies.push({ type, d, hp, max: hp, dist: 0, slow: 0, slowT: 0, x: PTS[0][0], y: PTS[0][1], walkT: Math.random(), face: 'right', flash: 0 });
}
function damage(e, n) {
  if (e.dead) return;
  e.hp -= n; e.flash = .12;
  if (e.hp <= 0) {
    play('enemy_death_' + (1 + Math.floor(Math.random() * 3)));
    e.dead = true; g.remaining--; g.stats.kills++; addGold(killReward(e.d.gold, g.kingdom)); g.dying.push({ type: e.type, x: e.x, y: e.y, face: e.face, t: 0 });
    burst(e.x, e.y - 30, { n: e.d.boss ? 40 : 10, col: '#e8d9b8', sz: e.d.boss ? 14 : 9, v: e.d.boss ? 320 : 180, life: .5, gr: 200, kind: 'dust' }); coinFx(e.x, e.y - 40, e.d.boss); if (e.d.boss) shake(14);
    if (!sprite('enemy.' + e.type, 'death')) addFx(M.sprites?.['enemy.' + e.type]?.deathFx || 'fx_death_puff', e.x, e.y); 
  }
}
const floatText = (x, y, s, col) => g.parts.push({ x, y, vx: 0, vy: -90, t: 0, life: .9, col, sz: 0, gr: 0, kind: 'text', s });
function addFx(k, x, y, s = 1, top = false) { g.fx.push({ k, x, y, t: 0, s, top }); }
function sparks(x, y, col, n = 7) { if (reduced) n = 3; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 220; g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: .25 + Math.random() * .2, col }); } }
// small particle system (world units): kind 'sq' spark, 'dust' soft puff, 'coin' gold disc, 'ring' expanding ring
function burst(x, y, o = {}) { const n = reduced ? Math.ceil((o.n || 8) / 3) : (o.n || 8);
  for (let i = 0; i < n; i++) { const a = o.up ? -Math.PI * (.15 + .7 * Math.random()) : Math.random() * 6.283, v = (o.v || 150) * (.4 + .6 * Math.random());
    g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: (o.life || .4) * (.7 + .5 * Math.random()), col: o.col || '#fff', sz: o.sz || 8, gr: o.gr ?? 600, kind: o.kind || 'sq' }); } }
const ring = (x, y, col = '#ffe08a', r = 70, life = .35) => g.parts.push({ x, y, vx: 0, vy: 0, t: 0, life, col, sz: r, gr: 0, kind: 'ring' });
const coinFx = (x, y, big) => { addFx('fx_coin_burst', x, y, big ? 1.8 : 1, true); if (big && !reduced) { addFx('fx_coin_burst', x - 70, y + 20, 1, true); addFx('fx_coin_burst', x + 70, y + 20, 1, true); } }; // TD-11d: top layer = drawn after particles + death puffs // TD-11c sprite coin burst
let shakeT = 0, shakeA = 0; const shake = a => { if (!reduced) { shakeA = Math.max(shakeA, a); shakeT = .35; } };
const SPARK = { archer: '#f2deb0', cannon: '#ffb347', mage: '#c58bff', frost: '#bfefff', tesla: '#fff27a' };
function inRange(t, e) { const [cx, cy] = spotC(t.spot); return Math.hypot(e.x - cx, e.y - cy) <= t.st[3] * TS; }
function fire(t) {
  const inR = g.enemies.filter(e => !e.dead && inRange(t, e));
  if (!inR.length) return false;
  const doomed = inR.filter(e => (e.pend || 0) < e.hp), live = TW[t.type].splash || !doomed.length ? inR : doomed; // avoid overkill
  const tgt = live.reduce((a, b) => b.dist > a.dist ? b : a), D = TW[t.type], [cx, cy] = spotC(t.spot);
  play('fire_' + t.type); const AA = sprite(`tower.${t.type}.${t.lv}`, 'attack'); t.atkD = AA ? AA.frames / AA.fps : .16; t.atk = t.atkD;
  const wait = AA ? 1 / AA.fps : 0; // projectile leaves on attack frame 1
  if (t.type === 'tesla') {
    let dmg = t.st[1], cur = tgt, from = [cx, cy - 70]; const hit = new Set();
    for (let i = 0; i < D.chain[t.lv - 1] + modifiers(g.kingdom).chain && cur; i++) {
      hit.add(cur); g.arcs.push({ a: from, b: [cur.x, cur.y], t: .12 }); damage(cur, dmg); addFx(D.fx, cur.x, cur.y); sparks(cur.x, cur.y, SPARK.tesla, 4); if (i === 0) play(D.hit);
      from = [cur.x, cur.y]; dmg *= 0.8;
      const c = cur; cur = g.enemies.filter(e => !e.dead && !hit.has(e) && Math.hypot(e.x - c.x, e.y - c.y) <= 1.5 * TS).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    }
  } else { if (!D.splash) tgt.pend = (tgt.pend || 0) + t.st[1]; g.projs.push({ x: cx, y: cy - 70, tgt, tx: tgt.x, ty: tgt.y, t, dmg: D.splash ? 0 : t.st[1], wait }); }
  return true;
}
function hitProj(p) {
  const t = p.t, D = TW[t.type];
  if (D.splash) { const r = D.splash[t.lv - 1] * TS * modifiers(g.kingdom).splash; for (const e of g.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) <= r) damage(e, t.st[1]); }
  else if (!p.tgt.dead) {
    p.tgt.pend -= p.dmg; damage(p.tgt, t.st[1]);
    if (D.slow) { const [pct, dur] = D.slow[t.lv - 1], e = p.tgt; if (e.slowT <= 0 || pct >= e.slow) { e.slow = pct; e.slowT = dur * modifiers(g.kingdom).slowDuration; } }
  }
  if (D.fx) addFx(D.fx, p.x, p.y); sparks(p.x, p.y, SPARK[t.type], D.fx ? 4 : 8);
  play(D.hit);
}
function step(dt) {
  g.stats.time += dt;
  if (g.phase === 'build') { g.countdown -= dt; if (g.countdown <= 3 && Math.ceil(g.countdown) !== Math.ceil(g.countdown + dt)) play('ui_hover'); if (g.countdown <= 0) { g.countdown = 0; startWave(); } }
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
    if (e.dist >= PLEN) {
      e.dead = e.leaked = true; g.remaining--; (g.leaks ??= {})[e.type] = (g.leaks[e.type] || 0) + 1;
      const leak = absorbLeak(g.kingdom, e.d.lives); g.kingdom = leak.state;
      g.lives = Math.max(0, g.lives - leak.lost);
      if (leak.absorbed) floatText(e.x, e.y - 70, `Ward saved ${leak.absorbed}`, '#9ce8ff');
      if (leak.lost) { g.heartFlash = .2; play('life_lost'); }
    }
  }
  for (const t of Object.values(g.towers)) { if (t.pop > 0) t.pop -= dt; if (t.atk > 0) t.atk -= dt; t.cd -= dt; if (t.cd <= 0 && fire(t)) t.cd = 1 / t.st[2]; }
  const sp = 8 * TS * dt;
  for (const p of g.projs) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    if (!p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy); p.a = Math.atan2(dy, dx);
    if (l <= sp) { p.x = p.tx; p.y = p.ty; p.done = true; hitProj(p); } else { p.x += dx / l * sp; p.y += dy / l * sp; }
  }
  g.projs = g.projs.filter(p => !p.done);
  g.enemies = g.enemies.filter(e => !e.dead);
  for (const f of g.fx) f.t += dt; g.fx = g.fx.filter(f => f.t < animDur(f.k));
  for (const d of g.dying) d.t += dt; g.dying = g.dying.filter(d => d.t < deathDur(d.type));
  for (const q of g.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.gr ?? 600) * dt; if (q.kind === 'dust') { q.vx *= .9; q.vy *= .9; } } g.parts = g.parts.filter(q => q.t < q.life);
  for (const a of g.arcs) a.t -= dt; g.arcs = g.arcs.filter(a => a.t > 0);
  if (g.lives <= 0) return endGame(false);
  if (g.phase === 'wave' && !g.queue.length && !g.enemies.length) {
    const b = waveReward(g.wave, g.kingdom); addGold(b); play('coin');
    if (g.wave >= WAVES.length) return endGame(true);
    banner(`Wave ${g.wave} cleared`, `+${b} gold · ${isBoss(g.wave + 1) ? 'the Troll comes next!' : 'build up'}`, 'clear');
    g.phase = 'build'; g.countdown = isBoss(g.wave + 1) ? BOSS_BREATHER : BREATHER;
  }
}

// ---------- tower actions ----------
function build(spot, type) {
  if (g.towers[spot] || g.over) return false;
  const c = TW[type].lv[0][0]; if (g.gold < c) { play('ui_error'); return false; }
  play('build'); g.gold -= c; g.towers[spot] = { spot, type, lv: 1, st: towerStats(TW[type].lv[0], g.kingdom), cd: 0, invested: c, pop: .35 };
  { const [x, y] = spotC(spot); addFx('fx_build_dust', x, y + 40); ring(x, y + 30, '#ffe08a', 80); floatText(x, y - 80, `-${c}`, '#ffb3a0'); }
  closePanels(); return true;
}
function upgrade(spot) {
  const t = g.towers[spot]; if (!t || t.lv >= 3) return false;
  const c = TW[t.type].lv[t.lv][0]; if (g.gold < c) { play('ui_error'); return false; }
  play('upgrade'); g.gold -= c; t.invested += c; t.lv++; t.pop = .35; { const [x, y] = spotC(spot); burst(x, y - 40, { n: 16, col: '#ffe08a', sz: 7, v: 220, life: .6, gr: 200, up: true }); ring(x, y, '#9fe870', 90); floatText(x, y - 100, `Lv ${t.lv}!`, '#9fe870'); } t.st = towerStats(TW[t.type].lv[t.lv - 1], g.kingdom); if (g.sel === spot) openSel(spot, true); buzz(); return true;
}
function sell(spot) {
  const t = g.towers[spot]; if (!t) return false;
  const r = sellValue(t.invested, g.kingdom); g.gold += r; play('sell'); play('coin'); delete g.towers[spot];
  { const [x, y] = spotC(spot); coinFx(x, y - 30); addFx('fx_build_dust', x, y + 40, .8); floatText(x, y - 80, `+${r}`, '#ffd34d'); }
  g.undo = { t, r, until: performance.now() + 3000 }; closePanels(); toast(`Sold for ${r}`, 3000, null, ['Undo', undoSell]); buzz(); return true;
}
function undoSell() {
  const u = g.undo; if (!u || performance.now() > u.until || g.towers[u.t.spot]) return;
  if (g.gold < u.r) { play('ui_error'); toast('Not enough gold to undo this sale'); return; }
  u.t.st = towerStats(TW[u.t.type].lv[u.t.lv - 1], g.kingdom);
  g.gold -= u.r; g.towers[u.t.spot] = u.t; g.undo = null; toast('Sale undone');
}

// ---------- UI: title ----------
function clearUI() { ui.innerHTML = ''; ui.classList.remove('ended'); H$ = {}; }
function titleScreen() {
  screen = 'title'; g = null; clearUI(); modal = null; layout();
  img(ui, 'title_bg', 'nopt bgcover'); h('div', ui, 'dim nopt').style.opacity = .4;
  const wrap = h('div', ui, 'modal title'), card = h('div', wrap, 'tcard');
  if (M.logo) img(card, M.logo, 'nopt logo');
  ribbon(card, M.logo ? 'Hold the line' : 'TD', 'trib' + (M.logo ? ' tag' : '')); // TD-11d: live tagline on the menu ribbon
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
  const mot = btn(box, '', () => { reduced = !reduced; localStorage.setItem('td.motion', reduced ? 'reduced' : 'full'); syncMotion(); onSettings(); });
  onSettings = () => { snd.textContent = muted ? 'Sound: Off' : 'Sound: On'; mot.textContent = reduced ? 'Motion: Reduced' : 'Motion: Full'; };
  onSettings(); pl.focus();
}
let modal = null;
function mkModal(parent = ui) { const m = h('div', parent, 'modal'); h('div', m, 'dim'); return m; }
function howTo() {
  const prev = document.activeElement;
  modal = mkModal(); modal.classList.add('howto'); const inn = panel(modal, 'mpanel');
  h('h2', inn, 'htitle display', 'How to play');
  const ol = h('ol', inn, 'hsteps');
  [['ui/slot/slot_normal.png', 'Tap a spot', 'Tap an empty build spot on the map.'],
   ['ui/hud2/icons/icon_tower_archer.png', 'Pick a tower', 'Tap a tower in the bottom bar. Tap it again (or its price) to build.'],
   ['ui/hud2/button_start_wave_normal.png', 'Start the wave', 'Tap Start wave when you are ready.'],
   ['ui/icon/icon_heart_96.png', 'Protect your lives', 'Each enemy that gets through costs a life. Keep them all out!'],
   ['terrain/props/castle.png', 'Visit the castle', 'Every map has a castle. Tap its Research label or press K. Spend gold on kingdom-wide research. The council pauses the game.']]
    .forEach(([src, t, d], i) => { const li = h('li', ol, 'hstep'), im = h('img', li, 'nopt'); im.src = 'assets/' + src; im.alt = ''; const tx = h('div', li); h('b', tx, '', `${i + 1}. ${t}`); h('p', tx, '', d); });
  const ok = btn(h('div', inn, 'row'), 'Got it', () => { modal.remove(); modal = null; prev?.focus(); });
  modal.close = ok.onclick; ok.focus();
}

// ---------- UI: game (SPEC-mobile.md §3) ----------
let H$ = {};
const live = (s) => { if (H$.live) H$.live.textContent = s; };
function stat(p, icon, label, cls = '') {
  const s = h('div', p, 'stat ' + cls), i = img(s, icon, 'nopt hudico');
  const value = h('span', s, 'out display num', '—');
  h('span', s, 'stat-label', label); return [i, value];
}
function startGame() {
  newSeed(); g = null; setMap(pickMap());
  screen = 'game'; newGame(); clearUI(); setMusic('battle');
  const hud = H$.hud = h('div', ui, 'hud'); hud.style.cssText = nine(M.ui.hudPanelTop, '', .22); hud.setAttribute('aria-label', 'Battle status');
  const a = h('div', hud, 'hgrp hud-values');
  H$.gold = stat(a, 'icon_gold', 'Gold')[1]; [H$.heart, H$.lives] = stat(a, 'icon_heart', 'Lives'); H$.leftS = stat(a, 'icon_skull', 'Enemies', 'skull'); H$.left = H$.leftS[1];
  H$.wave2 = stat(a, 'icon_wave', 'Wave')[1];
  const c = h('div', hud, 'hgrp right hud-controls');
  const progress = h('div', c, 'hud-progress');
  H$.wave = h('span', progress, 'progress-label', 'Prepare your defenses');
  const pf = H$.wbar = h('div', progress, 'wbar nopt'); pf.style.backgroundImage = url('bar_frame');
  pf.setAttribute('role', 'progressbar'); pf.setAttribute('aria-label', 'Enemies remaining'); pf.setAttribute('aria-valuemin', '0'); pf.setAttribute('aria-valuemax', '100');
  H$.wfill = h('div', pf, 'wfill'); H$.wfill.style.backgroundImage = url('wave_fill');
  H$.speed = btn(c, '', () => { g.speed = g.speed === 1 ? 2 : 1; }, 'Game speed 1x', 'hb');
  H$.pause = btn(c, '', () => setPaused(!g.paused), 'Pause', 'hb');
  H$.mute = btn(c, '', () => setMuted(!muted), 'Mute sound', 'hb mutebtn');
  onSettings = () => { setIcon(H$.mute, muted ? 'sound_off' : 'sound_on'); H$.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); };
  onSettings();
  // bottom bar (sheet + desktop modes) / right rail (rail mode): next wave + start
  const bar = H$.bar = h('div', ui, 'bbar'); bar.style.cssText = nine(M.ui.hudPanel, '', .22);
  H$.slots = ORDER.map(k => slotBtn(bar, k, () => onSlot(k), 'barslot'));
  H$.next = h('div', bar, 'next out');
  H$.start = btn(bar, 'Start wave', startWave, 'Start wave', 'start');
  H$.toast = h('div', ui, 'toasts');
  H$.sel = h('div', ui, 'selwrap');
  H$.tip = h('div', ui, 'tipb nopt'); H$.tip.hidden = true;
  H$.live = h('div', ui, 'sr'); H$.live.setAttribute('aria-live', 'polite');
  H$.castleMap = h('button', ui, 'castle-hit'); H$.castleMap.setAttribute('aria-label', 'Castle: open kingdom research');
  H$.castleMap.onclick = () => { play('ui_click'); openCastle(); };
  h('span', H$.castleMap, 'castle-label', 'Research');
  layout(); cv.focus({ preventScroll: true });
}
function slotBtn(parent, k, fn, cls = '') {
  const b = h('button', parent, 'slot ' + cls); b.onclick = fn;
  const name = `${TW[k].name} Tower (${ORDER.indexOf(k) + 1})`; b.title = name; b.setAttribute('aria-label', name);
  // TD-10: icon first (own tile, nothing on top of it), then coin + cost, then the name; laid out in a column, never overlapping
  const tb = h('span', b, 'tbox nopt'); { const ic = h('img', tb, 'nopt ticon'); ic.src = uiSrc(M.ui.towerIcon, k); ic.alt = ''; ic.draggable = false; } h('span', tb, 'hk', ORDER.indexOf(k) + 1);
  const pr = h('span', b, 'price nopt'); b.coinEl = img(pr, 'icon_gold', 'nopt coin'); b.costEl = h('span', pr, 'cost', TW[k].lv[0][0]); h('span', b, 'tname nopt', TW[k].name);
  longPress(b, () => TW[k].name + ' Tower — ' + TW[k].lv.map((l, i) => `Lv${i + 1}: ${l[0]}g, Dmg ${l[1]}, ${l[2]}/s, Rng ${l[3]}`).join(' · '));
  b.k = k; return b;
}
function closePanels() { if (!g) return; g.selSpot = null; g.ghost = null; g.radial = g.sel = null; if (H$.sel) H$.sel.innerHTML = ''; H$.up = null; H$.chip = null; L.panTo = 0; }
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
// Selection UI (TD-10). Empty spot: no sheet; the spot is highlighted and the bar/rail slots become "build here" targets.
// Picking a slot previews the tower + range on the spot and floats a small price chip next to it; chip or same slot again builds.
// Built tower: a compact floating panel next to the spot (all modes), never over the spot, HUD or bar.
function onSlot(k) {
  if (g.radial != null && !g.towers[g.radial]) { if (g.ghost?.type === k) return confirmBuild(); return pickCard(k); }
  g.slot = g.slot === k ? null : k; // no spot selected: pre-pick (desktop / keyboard)
}
function confirmBuild() {
  const gh = g.ghost; if (!gh || g.towers[gh.spot]) return false;
  if (g.gold < TW[gh.type].lv[0][0]) { play('ui_error'); return false; }
  return build(gh.spot, gh.type) && buzz();
}
function openSel(spot, keep) {
  const prevType = g.ghost?.spot === spot ? g.ghost.type : null;
  closePanels(); g.selSpot = spot; g.focus = spot;
  const t = g.towers[spot];
  if (!t) {
    g.radial = spot;
    const pre = prevType || g.slot; if (pre) pickCard(pre, keep);
    live(`Spot ${spot + 1} selected. Pick a tower.`); return;
  }
  g.sel = spot;
  const box = panel(H$.sel, 'selp sel-float upg'), p = box.parentElement, D = TW[t.type];
  h('div', box, 'stitle out display', `${D.name} Lv ${t.lv}`);
  const tx = h('div', box, 'utext'); h('div', tx, 'small', `Dmg ${t.st[1]} · ${t.st[2]}/s · Rng ${t.st[3]}`);
  if (t.lv < 3) { const n = towerStats(D.lv[t.lv], g.kingdom), nl = h('div', tx, 'small'); nl.innerHTML = `Next: <span style="color:${T.good}">Dmg ${n[1]}</span> · ${n[2]}/s · <span style="color:${T.good}">Rng ${n[3]}</span>`; }
  const acts = h('div', box, 'acts');
  H$.sell = btn(acts, `Sell ${sellValue(t.invested, g.kingdom)}`, () => sell(spot), null, 'sellb');
  H$.up = btn(acts, '', () => upgrade(spot), null, 'confirm');
  H$.close = btn(acts, 'Close', () => { closePanels(); cv.focus(); }, 'Close', 'cancel');
  refreshUpgrade();
  if (!keep) (H$.up.disabled ? H$.sell : H$.up).focus({ preventScroll: true });
  placeNear(p, spot);
  live(`${D.name} tower selected`);
}
function pickCard(k, keep) {
  const spot = g.radial; if (spot == null || g.towers[spot]) return;
  g.ghost = { spot, type: k };
  if (!H$.chip) {
    const c = H$.chip = h('button', H$.sel, 'chip display'); c.onclick = () => { play('ui_click'); confirmBuild(); };
    img(c, 'icon_gold', 'nopt coin'); c.txt = h('span', c, 'out');
  }
  refreshChip(true);
  if (!keep) H$.chip.focus({ preventScroll: true });
  live(`${TW[k].name} Tower preview, ${TW[k].lv[0][0]} gold`);
}
function refreshChip(force) {
  const c = H$.chip, gh = g.ghost; if (!c || !gh) return;
  const cost = TW[gh.type].lv[0][0], ok = g.gold >= cost, key = gh.type + ok + (ok ? '' : g.gold);
  if (c._k === key && !force) return; c._k = key;
  setT(c.txt, ok ? cost : `Need ${cost - g.gold}`); c.disabled = !ok; c.classList.toggle('off', !ok);
  c.setAttribute('aria-label', ok ? `Build ${TW[gh.type].name} Tower, ${cost} gold` : `${TW[gh.type].name} Tower, need ${cost - g.gold} more gold`);
  placeNear(c, gh.spot);
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
function banner(s, sub, kind = 'wave', portrait, ms = 1800) { // painted ribbon + subtitle; one at a time
  ui.querySelectorAll('.banner').forEach(e => e.remove());
  const r = ribbon(ui, s, 'banner b-' + kind);
  if (portrait && IMG[portrait]) r.prepend(img(r, portrait, 'nopt bport'));
  if (sub) h('div', r, 'bsub out', sub);
  if (!reduced) r.classList.add('in');
  setTimeout(() => r.style.opacity = 0, ms); setTimeout(() => r.remove(), ms + 300);
}
const clearedWaves = () => g.phase === 'wave' ? Math.max(0, g.wave - 1) : g.wave;
function applyKingdomPurchase(result) {
  if (!result || g.over || !modal?.kingdom) return false;
  g.kingdom = result.state; g.gold = result.gold;
  g.lives = result.lives ?? Math.min(modifiers(g.kingdom).maxLives, g.lives + (result.heal || 0));
  for (const tower of Object.values(g.towers)) tower.st = towerStats(TW[tower.type].lv[tower.lv - 1], g.kingdom);
  play('upgrade'); buzz(); return true;
}
function updateCastleAccess() {
  if (!H$.castleMap) return;
  const blocked = g.over || !!modal;
  const b = H$.castleMap; b.hidden = !castleSite || g.over; b.disabled = blocked;
  const m = modifiers(g.kingdom);
  setT(b.firstElementChild, m.wards ? `Research · ${g.kingdom.wards}/${m.wards} wards` : 'Research');
  b.title = `Royal Council: ${totalRanks(g.kingdom)} research ranks, ${g.gold} gold. Press K to open.`;
  if (castleSite) {
    const [x, y] = w2s(castleSite.c * TS, castleSite.r * TS);
    Object.assign(b.style, { left: `${x}px`, top: `${y}px`, width: `${384 * L.k}px`, height: `${302 * L.k}px` });
  }
}
function openCastle() {
  if (!g || g.over || modal) return;
  closePanels();
  const previous = document.activeElement, wasPaused = g.paused;
  g.paused = true;
  const dialog = modal = mkModal(); dialog.classList.add('kingdom-modal'); dialog.kingdom = true;
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'kingdom-title');
  const card = h('section', dialog, 'kingdom-card');
  const header = h('header', card, 'kingdom-header');
  const heading = h('div', header); h('div', heading, 'kingdom-eyebrow', 'KINGDOM RESEARCH');
  h('h2', heading, 'display', 'The Royal Council').id = 'kingdom-title';
  const close = btn(header, 'Close', () => dialog.close(), 'Close castle research', 'kingdom-close');
  const summary = h('div', card, 'kingdom-summary');
  const body = h('div', card, 'kingdom-body');
  const notice = h('p', card, 'kingdom-notice'); notice.setAttribute('role', 'status');
  let tab = 'Warfare', pendingDoctrine = null;
  const tabs = h('div', card, 'kingdom-tabs'); tabs.setAttribute('aria-label', 'Research categories'); card.insertBefore(tabs, body);
  const tabButtons = ['Warfare', 'Treasury', 'Defense', 'Doctrine'].map(name => {
    const b = btn(tabs, name, () => { tab = name; pendingDoctrine = null; draw(); }, name);
    return [name, b];
  });
  const announce = text => { setT(notice, text); live(text); };
  const purchase = (result, text, id) => {
    if (!applyKingdomPurchase(result)) { play('ui_error'); announce('Purchase unavailable. Check your gold and unlock requirements.'); return; }
    announce(text); draw(id);
  };
  const draw = focusId => {
    const scroll = body.scrollTop; body.replaceChildren();
    const state = g.kingdom, m = modifiers(state), cleared = clearedWaves();
    setT(summary, `${g.gold} gold · ${g.lives}/${m.maxLives} lives · ${state.wards}/${m.wards} wards · ${totalRanks(state)}/27 ranks`);
    for (const [name, button] of tabButtons) button.setAttribute('aria-pressed', name === tab ? 'true' : 'false');
    h('p', body, 'kingdom-intro', 'Game paused. Research lasts for this run and affects existing and future towers. Rank II unlocks after wave 3; rank III after wave 6.');
    if (tab === 'Doctrine') {
      h('p', body, 'kingdom-intro', `Choose ONE permanent doctrine for ${DOCTRINE_COST} gold after clearing wave 5 and installing 6 research ranks. Cannot be changed or refunded this run.`);
      const offer = doctrineOffer(state, cleared, g.gold);
      for (const doctrine of DOCTRINES) {
        const tile = h('article', body, 'research-card');
        h('h3', tile, 'display', doctrine.name + (state.doctrine === doctrine.id ? ' · Adopted' : ''));
        h('p', tile, 'research-effect', doctrine.benefit); h('p', tile, 'research-drawback', doctrine.drawback);
        h('p', tile, 'research-description', doctrine.description);
        if (pendingDoctrine === doctrine.id && !state.doctrine) {
          h('p', tile, 'research-description', 'This choice is permanent for this run.');
          const confirm = btn(tile, `Adopt · ${DOCTRINE_COST} gold`, () => purchase(chooseDoctrine(g.kingdom, doctrine.id, clearedWaves(), g.gold), `${doctrine.name} doctrine adopted`, 'doctrine-' + doctrine.id));
          confirm.disabled = !offer.ok; confirm.dataset.research = 'doctrine-' + doctrine.id;
          btn(tile, 'Cancel', () => { pendingDoctrine = null; draw('doctrine-' + doctrine.id); });
        } else {
          const b = btn(tile, state.doctrine === doctrine.id ? 'Adopted' : `Choose · ${DOCTRINE_COST} gold`, () => { pendingDoctrine = doctrine.id; draw('doctrine-' + doctrine.id); });
          b.disabled = !offer.ok; b.dataset.research = 'doctrine-' + doctrine.id;
        }
        if (!offer.ok && state.doctrine !== doctrine.id) h('p', tile, 'research-lock', offer.reason);
      }
    } else {
      for (const item of RESEARCH.filter(item => item.branch === tab)) {
        const offer = researchOffer(state, item.id, cleared, g.gold), rank = rankOf(state, item.id);
        const tile = h('article', body, 'research-card');
        h('h3', tile, 'display', item.name); h('span', tile, 'research-rank', `Rank ${rank} / 3`);
        h('p', tile, 'research-description', item.description);
        if (rank) h('p', tile, 'research-current', `Active: ${item.effect(rank)}`);
        if (rank < 3) h('p', tile, 'research-effect', `Next: ${item.effect(rank + 1)}`);
        const b = btn(tile, rank === 3 ? 'Fully researched' : `Install ${['I', 'II', 'III'][rank]} · ${offer.cost} gold`, () => purchase(buyResearch(g.kingdom, item.id, clearedWaves(), g.gold), `${item.name} rank ${rank + 1} installed`, item.id));
        b.disabled = !offer.ok; b.dataset.research = item.id;
        if (offer.reason) h('p', tile, 'research-lock', offer.reason);
      }
      if (tab === 'Defense') {
        const tile = h('article', body, 'research-card'); h('h3', tile, 'display', 'Emergency repairs');
        h('p', tile, 'research-description', 'Restore 3 lives, up to your current maximum. Repeatable; does not add research ranks.');
        const b = btn(tile, `Repair · ${REPAIR_COST} gold`, () => purchase(buyRepair(g.kingdom, g.lives, g.gold), 'Walls repaired', 'repair'));
        b.dataset.research = 'repair'; b.disabled = g.gold < REPAIR_COST || g.lives >= m.maxLives;
        if (b.disabled) h('p', tile, 'research-lock', g.lives >= m.maxLives ? 'Walls are fully repaired' : `Need ${REPAIR_COST - g.gold} more gold`);
      }
    }
    body.scrollTop = scroll;
    if (focusId) { const target = [...body.querySelectorAll('[data-research]')].find(b => b.dataset.research === focusId && !b.disabled); (target || close).focus({ preventScroll: true }); }
  };
  dialog.close = () => {
    dialog.remove(); if (modal === dialog) modal = null; g.paused = wasPaused;
    updateCastleAccess(); if (previous?.isConnected && !previous.hidden && !previous.disabled) previous.focus({ preventScroll: true }); else cv.focus({ preventScroll: true });
  };
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...card.querySelectorAll('button:not(:disabled)')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  draw(); announce('Choose research. The game will resume when you close the council.'); close.focus(); updateCastleAccess();
}
function setPaused(v) {
  if (!g || g.over) return;
  g.paused = v; modal?.remove(); modal = null;
  if (!v) { cv.focus(); return; }
  modal = mkModal(); const inn = panel(modal, 'mpanel narrow');
  h('div', inn, 'out display big', 'Paused');
  const col = h('div', inn, 'col');
  const res = btn(col, 'Resume', () => setPaused(false));
  const snd = btn(col, '', () => setMuted(!muted)), mot = btn(col, '', () => { reduced = !reduced; localStorage.setItem('td.motion', reduced ? 'reduced' : 'full'); syncMotion(); setLbl(); });
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
  // TD-13: result card owns the screen - hide build bar/rail, make HUD + crest inert (restored by clearUI on Play again/Title)
  ui.classList.add('ended'); ui.querySelectorAll('.bbar,.hud,.crestbox,.toasts,.selp,.sel-float,.banner').forEach(e => { e.inert = true; e.setAttribute('aria-hidden', 'true'); if (e.classList.contains('bbar')) e.hidden = true; });
  modal = mkModal(); modal.classList.add('endscr', win ? 'win' : 'lose'); const wrap = h('div', modal, 'tcard'); ribbon(wrap, win ? 'Victory!' : 'Defeat', 'trib'); const inn = panel(wrap, 'mpanel');
  h('div', inn, 'mtext center big2', win ? 'The road holds!' : `The enemy broke through on wave ${g.wave}.`);
  const s = Math.floor(g.stats.time), st = h('div', inn, 'estats');
  [['icon_wave_96', 'Waves', `${Math.min(g.wave, WAVES.length)} / ${WAVES.length}`], ['icon_heart_96', 'Lives left', `${win ? g.lives : 0} / ${modifiers(g.kingdom).maxLives}`], ['icon_gold_96', 'Gold earned', g.stats.gold.toLocaleString('en-US')], ['icon_skull_96', 'Kills', `${g.stats.kills}`]]
    .forEach(([ic, l, v]) => { const d = h('div', st, 'estat'), im = h('img', d, 'nopt'); im.src = `assets/ui/icon/${ic}.png`; im.alt = ''; h('b', d, '', v); h('span', d, '', l); });
  h('div', inn, 'mtext center etime', `Towers standing: ${Object.keys(g.towers).length} · Time: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  h('div', inn, 'mtext center', `Research: ${totalRanks(g.kingdom)}/27 ranks · Council spending: ${g.kingdom.spent} gold${g.kingdom.doctrine ? ' · Doctrine: ' + DOCTRINES.find(d => d.id === g.kingdom.doctrine).name : ''}`);
  const r = h('div', inn, 'row');
  const a = btn(r, 'Play again', () => { modal = null; startGame(); }, 'Play again', 'eplay');
  btn(r, 'Title', () => { modal = null; titleScreen(); });
  modal.result = win ? 'win' : 'lose'; a.focus();
}

// ---------- HUD refresh (writes only on change) ----------
let lastFrame = performance.now();
function refreshHUD(realDt) {
  const gd = g.gold - g.shownGold;
  g.shownGold = reduced || Math.abs(gd) < 1 ? g.gold : g.shownGold + gd * Math.min(1, realDt / 0.1);
  setT(H$.gold, Math.round(g.shownGold));
  H$.lives.setAttribute('aria-label', `${g.lives} of ${modifiers(g.kingdom).maxLives} lives`);
  setT(H$.lives, g.lives); setC(H$.lives, 'out display num' + (g.lives < 5 ? ' low' : ''));
  g.heartFlash -= realDt; setC(H$.heart, 'nopt hudico' + (g.heartFlash > 0 ? ' flash' : ''));
  setT(H$.left, g.phase === 'wave' ? g.remaining : 0);
  setT(H$.wave, g.phase === 'wave' ? `${g.remaining} enemies remaining` : 'Prepare your defenses'); setT(H$.wave2, `${g.wave}/${WAVES.length}`);
  H$.wbar.setAttribute('aria-valuenow', g.phase === 'wave' && g.total ? Math.round(100 * g.remaining / g.total) : 0);
  const fw = (g.phase === 'wave' && g.total ? Math.round(100 * g.remaining / g.total) : 0) + '%'; if (H$.wfill._w !== fw) { H$.wfill._w = fw; H$.wfill.style.width = fw; H$.wfill.hidden = fw === '0%'; }
  if (setIcon(H$.pause, g.paused ? 'play' : 'pause')) H$.pause.setAttribute('aria-label', g.paused ? 'Resume' : 'Pause');
  if (setIcon(H$.speed, g.speed === 1 ? 'speed1' : 'speed2')) H$.speed.setAttribute('aria-label', `Game speed ${g.speed}x`);
  for (const b of H$.slots) { // states never by colour alone: disabled = slashed "Need N" plate + desaturated icon; selected = 76px glow frame + lift + chevron
    const c = TW[b.k].lv[0][0], off = g.gold < c, sel = g.radial != null ? g.ghost?.type === b.k : g.slot === b.k;
    setC(b, 'slot barslot' + (sel ? ' sel' : '') + (off ? ' off' : '')); setT(b.costEl, off ? `Need ${c - g.gold}` : c);
    if (b._off !== off) { b._off = off; b.setAttribute('aria-disabled', off); b.setAttribute('aria-label', `${TW[b.k].name} Tower, ${off ? `need ${c - g.gold} more gold` : c + ' gold'}`); }
    if (b._sel !== sel) { b._sel = sel; b.setAttribute('aria-pressed', sel); }
  }
  refreshChip();
  setC(H$.bar, 'bbar' + (g.phase === 'wave' ? ' inwave' : '') + (g.radial != null ? ' picking' : ''));
  if (L.pan !== L.panTo) { const d = L.panTo - L.pan; L.pan = Math.abs(d) < 1 ? L.panTo : L.pan + d * Math.min(1, realDt / .08); }
  { const cd = Math.ceil(g.countdown), bn = Math.floor(g.countdown); setT(H$.start, g.phase === 'build' ? `Start\n${cd}s +${bn}g` : (isBoss(g.wave) ? 'Boss\nwave!' : 'Wave\non')); setC(H$.start, 'b display start' + (g.phase === 'build' && cd <= 3 ? ' soon' : '')); } if (H$.start.disabled !== (g.phase !== 'build')) H$.start.disabled = g.phase !== 'build';
  const nw = g.wave + 1;
  if (g.phase === 'build') setT(H$.next, nw <= WAVES.length ? 'Next: ' + WAVES[nw - 1][0].map(([t, n]) => plural(n, EN[t].name)).join(', ') : ''); else setT(H$.next, `${g.remaining} left`);
  refreshUpgrade();
  updateCastleAccess();
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
  const row = a.row ?? (a.rows ? (a.rows[dir] ?? a.rows[dir === 'up' || dir === 'down' ? 'right' : dir] ?? 0) : 0);
  const [ax, ay] = a.anchorPx ? a.anchorPx : [(a.anchor?.[0] ?? .5) * fw, (a.anchor?.[1] ?? 1) * fh];
  return { i, sx: f * fw, sy: row * fh, sw: fw, sh: fh, ax, ay, frames: n };
}
const flashCache = new Map();
function whiteOf(fr) { // white silhouette of one frame, cached (procedural hit flash)
  const key = fr.i.src + fr.sx + ',' + fr.sy; let c = flashCache.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = fr.sw; c.height = fr.sh; const x = c.getContext('2d'); x.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, fr.sw, fr.sh); flashCache.set(key, c); }
  return c;
}
let shk = [0, 0];
function at(x, y, s = 1) { const [sx, sy] = w2s(x, y), d = L.dpr * L.k * s; ctx.setTransform(d, 0, 0, d, L.dpr * (sx + shk[0]), L.dpr * (sy + shk[1])); }
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
  shk = shakeT > 0 ? [(Math.random() - .5) * shakeA * shakeT / .35, (Math.random() - .5) * shakeA * shakeT / .35] : [0, 0]; if (shakeT <= 0) shakeA = 0;
  drawTerrain(performance.now() / 1000);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const items = [];
  for (const t of Object.values(g.towers)) {
    const [x, y] = spotC(t.spot), id = `tower.${t.type}.${t.lv}`, atk = t.atk > 0 ? t.atk / (t.atkD || .16) : 0;
    const aa = atk > 0 && sprite(id, 'attack'), fr = aa ? frameOf(aa, (t.atkD || .16) - t.atk, 'right') : frameOf(sprite(id, 'idle') || stillDef(`tower_${t.type}_l${t.lv}`), g.stats.time, 'right');
    items.push([w2s(x, y + 56)[1], () => { // recoil fallback when there is no attack sheet: dip + squash
      const pp = t.pop > 0 && !reduced ? Math.sin((1 - t.pop / .35) * Math.PI) * .18 : 0;
      at(x, y + 56 + (aa ? 0 : 5 * atk)); drawFrame(fr, (aa ? 1 : 1 + .04 * atk) * (1 + pp), (aa ? 1 : 1 - .07 * atk) * (1 + pp));
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
    if (p.wait > 0) continue;
    const a = sprite('projectile.' + TW[p.t.type].proj.replace('projectile_', ''), 'fly'), fr = frameOf(a || { sheet: TW[p.t.type].proj, frames: 1, anchor: [.5, .5] }, g.stats.time, 'right');
    at(p.x, p.y); ctx.rotate(p.a || 0); drawFrame(fr);
  }
  for (const r of g.arcs) { // lightning: anchored at its left end, stretched to the target
    const [x1, y1] = r.a, [x2, y2] = r.b, a = sprite('projectile.lightning_arc', 'fly'), fr = frameOf(a || { sheet: 'projectile_lightning_arc', frames: 1, anchorPx: [0, 20] }, .12 - r.t, 'right');
    if (!fr) continue; at(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    const len = Math.hypot(x2 - x1, y2 - y1); ctx.globalAlpha = Math.min(1, r.t / .06); ctx.drawImage(fr.i, fr.sx, fr.sy, fr.sw, fr.sh, 0, -fr.ay, len, fr.sh); ctx.globalAlpha = 1;
  }
  const drawFx = top => { for (const f of g.fx) { if (!!f.top !== top) continue; const a = ANIM[f.k] || { sheet: f.k, frameWidth: 128, frameHeight: 128, frames: 4, fps: 12, anchor: [.5, .5], loop: false }; at(f.x, f.y); const fr = frameOf(a, reduced ? Math.min(.34, (a.frames || 4) / (a.fps || 12) / 2) : f.t, 'right'), z = fr && a.drawSize ? a.drawSize / fr.sw * (f.s || 1) : 1; drawFrame(fr, z, z); } };
  drawFx(false);
  for (const q of g.parts) { const k = q.kind || 'sq', a = 1 - q.t / q.life; at(q.x, q.y); ctx.globalAlpha = a;
    if (k === 'sq') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = q.col; const z = q.sz || 8; ctx.fillRect(-z / 2, -z / 2, z, z); ctx.globalCompositeOperation = 'source-over'; }
    else if (k === 'dust') { ctx.globalAlpha = a * .7; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(0, 0, q.sz * (1 + q.t / q.life), 0, 6.283); ctx.fill(); }
    else if (k === 'coin') { ctx.fillStyle = '#7a4a10'; ctx.beginPath(); ctx.ellipse(0, 0, q.sz, q.sz * Math.abs(Math.cos(q.t * 14)) + 2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0, -1, q.sz - 2, (q.sz - 2) * Math.abs(Math.cos(q.t * 14)) + 1, 0, 0, 6.283); ctx.fill(); }
    else if (k === 'ring') { ctx.strokeStyle = q.col; ctx.lineWidth = 8 * a; ctx.beginPath(); ctx.arc(0, 0, q.sz * (.3 + .7 * (1 - a * a)), 0, 6.283); ctx.stroke(); }
    else if (k === 'text') { ctx.font = `${Math.round(20 / L.k)}px "${DISPLAY.family}", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 7 / L.k; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1e120a'; ctx.globalAlpha = Math.min(1, a * 2); ctx.strokeText(q.s, 0, 0); ctx.fillStyle = q.col; ctx.fillText(q.s, 0, 0); }
  } ctx.globalAlpha = 1;
  drawFx(true); // TD-11d: coin bursts above the kill dust / death puff so the coins actually read
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
  const rangeOf = i => { const t = g.towers[i]; if (t) return t.st[3]; if (i === g.radial && g.ghost) return towerStats(TW[g.ghost.type].lv[0], g.kingdom)[3]; };
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
    if (H$.gold) refreshHUD(real); if (shakeT > 0) shakeT -= real;
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
longPress(cv, (x, y) => { if (!g) return; const i = spotAtXY(x, y); if (i < 0) return; const t = g.towers[i]; return t ? `${TW[t.type].name} Lv ${t.lv} — Damage ${t.st[1]} · Rate ${t.st[2]}/s · Range ${t.st[3]} · Sell ${sellValue(t.invested, g.kingdom)}` : 'Empty build spot — tap to build'; });
cv.addEventListener('click', ev => { if (screen === 'game' && g && !modal) { const i = spotAtXY(ev.clientX, ev.clientY); if (i >= 0) { play('ui_click'); ring(...spotC(i), '#ffe08a', 64, .25); } else ring(...s2w(ev.clientX, ev.clientY), 'rgba(255,255,255,.7)', 30, .2); activateSpot(i); } });
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
  if ((k === 'k' || k === 'K') && !g.over) { ev.preventDefault(); return openCastle(); }
  const onBtn = document.activeElement?.tagName === 'BUTTON';
  if (k >= '1' && k <= '5') { const t = ORDER[+k - 1]; if (g.radial != null) pickCard(t); else g.slot = g.slot === t ? null : t; }
  else if (k.startsWith('Arrow') && !onBtn) { ev.preventDefault(); cv.focus(); moveFocus(k); }
  else if (k === 'Enter' && !onBtn && g.focus >= 0) { ev.preventDefault(); if (g.ghost && g.radial === g.focus) confirmBuild(); else activateSpot(g.focus); }
  else if (k === 'u' || k === 'U') { if (g.sel != null) upgrade(g.sel); }
  else if (k === 's' || k === 'S') { if (g.sel != null) sell(g.sel); }
  else if (k === 'z' || k === 'Z') undoSell();
  else if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'f' || k === 'F') g.speed = g.speed === 1 ? 2 : 1;
  else if (k === 'Escape') { if (g.radial != null || g.sel != null) { closePanels(); cv.focus(); } else if (g.slot) g.slot = null; else setPaused(true); }
});

if (DEBUG) window.td = { IMG, played, get actx() { return actx?.state; }, get g() { return g; }, get screen() { return screen; }, get modal() { return modal?.result; }, build, upgrade, sell, undoSell, startWave, startGame, endGame, get SPOTS() { return SPOTS; }, onSlot, confirmBuild, get map() { return MAP.id; }, get seed() { return SEED; }, get PATHLEN() { return PLEN; }, get MAPS() { return MAPS; }, setMap, layout, get MAPOBJ() { return MAP; }, pathArt, L, spotS, s2w, w2s, spotAtXY };
layout(); fontReady.then(titleScreen);

mobileCSS();

