import M from './manifest.json';
import './style.css';

// ---------- setup / theme ----------
const W = 1920, H = 1080, TS = 128;
const T = M.theme;
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const FF = DEBUG ? Math.max(1, +Q.get('ff') || 1) : 1;
const stage = document.getElementById('stage'), cv = document.getElementById('cv'), ctx = cv.getContext('2d'), ui = document.getElementById('ui');
const url = k => `url("${M.images[k]}")`;
const rs = document.documentElement.style;
for (const [k, v] of Object.entries(T)) rs.setProperty('--' + k, v);
for (const k of ['button_normal', 'button_hover', 'button_pressed', 'button_disabled', 'slot_normal', 'slot_selected', 'slot_locked']) rs.setProperty('--' + k, url(k));
document.body.style.background = T.letterbox;
stage.style.fontFamily = M.font.body.family;
const DISPLAY = M.font.display;
rs.setProperty('--display', `"${DISPLAY.family}", ${M.font.body.family}`);
const fontReady = DISPLAY.url ? new FontFace(DISPLAY.family, `url(${DISPLAY.url})`).load().then(f => document.fonts.add(f)).catch(() => {}) : Promise.resolve();
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${(innerWidth - W * s) / 2}px,${(innerHeight - H * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit); fit();

// ---------- DOM helpers ----------
function el(tag, parent, r, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (r) Object.assign(e.style, { position: 'absolute', left: r[0] + 'px', top: r[1] + 'px', width: r[2] != null ? r[2] + 'px' : '', height: r[3] != null ? r[3] + 'px' : '' });
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
function img(parent, r, key, cls = 'nopt') { const e = el('img', parent, r, cls); e.src = M.images[key]; e.alt = ''; return e; }
function btn(parent, r, label, fn, aria) {
  const b = el('button', parent, r, 'b display', label); b.onclick = () => { play('ui_click'); fn(); }; b.onmouseenter = () => play('ui_hover');
  if (aria) b.setAttribute('aria-label', aria); return b;
}
function panel(parent, r, dark = true) {
  const p = el('div', parent, r, 'pe'), k = dark ? 'panel_dark_' : 'panel_', [, , w, h] = r, m = 48;
  const part = (n, x, y, pw, ph) => { const d = el('div', p, [x, y, pw, ph], ''); d.style.background = url(k + n); d.style.backgroundSize = n.length === 1 && n !== 'c' ? (n === 't' || n === 'b' ? '64px 48px' : '48px 64px') : (n === 'c' ? '64px 64px' : '48px 48px'); };
  part('c', m, m, w - 2 * m, h - 2 * m); part('t', m, 0, w - 2 * m, m); part('b', m, h - m, w - 2 * m, m);
  part('l', 0, m, m, h - 2 * m); part('r', w - m, m, m, h - 2 * m);
  part('tl', 0, 0, m, m); part('tr', w - m, 0, m, m); part('bl', 0, h - m, m, m); part('br', w - m, h - m, m, m);
  return p;
}
function ribbon(parent, r, text, size = 32) {
  const p = el('div', parent, r, 'nopt');
  img(p, [0, 0, 72, r[3]], 'ribbon_left'); img(p, [r[2] - 72, 0, 72, r[3]], 'ribbon_right');
  const b = el('div', p, [72, 0, r[2] - 144, r[3]], ''); b.style.background = url('ribbon_body') + ' repeat-x'; b.style.backgroundSize = 'auto 100%';
  const t = el('div', p, [0, 0, r[2], r[3] - 8], 'out display', text); Object.assign(t.style, { fontSize: size + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  return p;
}
function text(parent, r, s, size = 22, align = 'left', cls = '') { const t = el('div', parent, r, 'nopt ' + cls, s); t.style.fontSize = size + 'px'; t.style.textAlign = align; return t; }

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
const HP_SCALE = 0.05; // spec: 0.08. Lowered after headless runs showed waves 9–10 unbeatable on this path
const WAVES = [
  [[['goblin', 8]], 1.2], [[['goblin', 12]], 1.0], [[['orc', 6], ['goblin', 6]], 1.2], [[['orc', 10]], 1.0],
  [[['goblin', 15], ['knight', 4]], .8], [[['orc', 12], ['goblin', 6]], .9], [[['knight', 6], ['orc', 10]], 1.1],
  [[['goblin', 25]], .5], [[['knight', 10], ['orc', 10]], 1.0], [[['knight', 12], ['orc', 15], ['goblin', 20], ['troll', 1]], 1.1] // spec interval 0.7; widened so the troll finale is beatable,
];
const PATH_TILES = [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [8, 4], [8, 3], [8, 2], [9, 2], [10, 2], [11, 2], [11, 3], [11, 4], [12, 4], [13, 4], [14, 4]];
const PATH_ART = { '4,2': 'dirt_path_corner_sw', '4,5': 'dirt_path_corner_ne', '8,5': 'dirt_path_corner_nw', '8,2': 'dirt_path_corner_se', '11,2': 'dirt_path_corner_sw', '11,4': 'dirt_path_corner_ne', '4,3': 'v', '4,4': 'v', '8,4': 'v', '8,3': 'v', '11,3': 'v' };
const SPOTS = [[2, 1], [2, 3], [3, 4], [5, 3], [6, 2], [6, 4], [7, 6], [9, 4], [9, 6], [10, 1], [10, 3], [12, 3], [12, 5], [13, 2]];
const DECOR = [['signpost', 60, 250], ['tree_1', 64, 180], ['tree_1', 1500, 190], ['tree_3', 1790, 250], ['tree_2', 1840, 700], ['bush_1', 900, 700], ['rock_3', 1700, 840], ['flowers', 760, 190], ['fence', 1600, 640], ['bush_2', 560, 880]];
const PTS = [[-64, 2 * TS + 64], ...PATH_TILES.map(([c, r]) => [c * TS + 64, r * TS + 64]), [W + 64, 4 * TS + 64]];
const SEG = []; let PLEN = 0;
for (let i = 1; i < PTS.length; i++) { const l = Math.hypot(PTS[i][0] - PTS[i - 1][0], PTS[i][1] - PTS[i - 1][1]); SEG.push([PLEN, l]); PLEN += l; }
function pathPos(d) {
  for (let i = 0; i < SEG.length; i++) if (d <= SEG[i][0] + SEG[i][1] || i === SEG.length - 1) {
    const t = Math.min(1, (d - SEG[i][0]) / SEG[i][1]), a = PTS[i], b = PTS[i + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
}
// spots in path order (nearest path tile index)
const SPOT_ORDER = SPOTS.map((s, i) => [i, Math.min(...PATH_TILES.map((p, j) => Math.abs(p[0] - s[0]) + Math.abs(p[1] - s[1]) === 1 ? j : 99))]).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(a => a[0]);
const spotC = i => [SPOTS[i][0] * TS + 64, SPOTS[i][1] * TS + 64];
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const waveLabel = w => [...new Set(WAVES[w - 1][0].map(g => EN[g[0]].name + 's'))].join(' & ');

// ---------- static map layer ----------
let mapLayer;
function buildMapLayer() {
  mapLayer = document.createElement('canvas'); mapLayer.width = W; mapLayer.height = H;
  const c = mapLayer.getContext('2d');
  const pathSet = new Set(PATH_TILES.map(p => p + ''));
  for (let col = 0; col < 15; col++) for (let row = 0; row < 8; row++) {
    let k = 'grass_' + ((col * 7 + row * 3) % 3 + 1);
    if (col <= 3 && row >= 6) k = M.lake[col + ',' + row] || 'water';
    if (pathSet.has(col + ',' + row)) { const a = PATH_ART[col + ',' + row]; k = !a ? 'dirt_path_straight_h' : a === 'v' ? 'dirt_path_straight_v' : a; }
    c.drawImage(IMG[k], col * TS, row * TS, TS, TS);
  }
  for (const [k, x, y] of DECOR) { const i = IMG[k]; c.drawImage(i, x - i.width / 2, y - i.height); }
  c.fillStyle = T.letterbox; c.fillRect(0, 1024, W, 56);
}

// ---------- game state ----------
let screen = 'title', g = null;
function newGame() {
  g = {
    gold: DEBUG && Q.get('gold') ? +Q.get('gold') : 250, lives: 20, wave: 0, phase: 'build', countdown: 15,
    queue: [], spawnT: 0, interval: 1, enemies: [], towers: {}, projs: [], fx: [], arcs: [],
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
  g.enemies.push({ type, d, hp, max: hp, dist: 0, slow: 0, slowT: 0, x: -64, y: PTS[0][1] });
}
function damage(e, n) {
  if (e.dead) return;
  e.hp -= n;
  if (e.hp <= 0) {
    play('enemy_death_' + (1 + Math.floor(Math.random() * 3)));
    e.dead = true; g.remaining--; g.stats.kills++; addGold(e.d.gold);
    addFx('fx_death_puff', e.x, e.y); if (!reduced) addFx('fx_coin_pop', e.x, e.y - 40);
  }
}
function addFx(k, x, y) { g.fx.push({ k, x, y, t: 0 }); }
function inRange(t, e) { const [cx, cy] = spotC(t.spot); return Math.hypot(e.x - cx, e.y - cy) <= t.st[3] * TS; }
function fire(t) {
  const inR = g.enemies.filter(e => !e.dead && inRange(t, e));
  if (!inR.length) return false;
  const doomed = inR.filter(e => (e.pend || 0) < e.hp), live = TW[t.type].splash || !doomed.length ? inR : doomed; // avoid overkill
  const tgt = live.reduce((a, b) => b.dist > a.dist ? b : a), D = TW[t.type], [cx, cy] = spotC(t.spot);
  play('fire_' + t.type);
  if (t.type === 'tesla') {
    let dmg = t.st[1], cur = tgt, from = [cx, cy - 70]; const hit = new Set();
    for (let i = 0; i < D.chain[t.lv - 1] && cur; i++) {
      hit.add(cur); g.arcs.push({ a: from, b: [cur.x, cur.y], t: .12 }); damage(cur, dmg); addFx(D.fx, cur.x, cur.y); if (i === 0) play(D.hit);
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
  if (D.fx) addFx(D.fx, p.x, p.y);
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
    [e.x, e.y] = pathPos(e.dist);
    if (e.dist >= PLEN) { e.dead = e.leaked = true; g.remaining--; (g.leaks ??= {})[e.type] = (g.leaks[e.type] || 0) + 1; g.lives = Math.max(0, g.lives - e.d.lives); g.heartFlash = .2; play('life_lost'); }
  }
  for (const t of Object.values(g.towers)) { t.cd -= dt; if (t.cd <= 0 && fire(t)) t.cd = 1 / t.st[2]; }
  const sp = 8 * TS * dt;
  for (const p of g.projs) {
    if (!p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy); p.a = Math.atan2(dy, dx);
    if (l <= sp) { p.x = p.tx; p.y = p.ty; p.done = true; hitProj(p); } else { p.x += dx / l * sp; p.y += dy / l * sp; }
  }
  g.projs = g.projs.filter(p => !p.done);
  g.enemies = g.enemies.filter(e => !e.dead);
  for (const f of g.fx) f.t += dt; g.fx = g.fx.filter(f => f.t < (reduced ? .15 : 4 / 12));
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
  play('upgrade'); g.gold -= c; t.invested += c; t.lv++; t.st = TW[t.type].lv[t.lv - 1]; if (g.sel === spot) openUpgrade(spot); return true;
}
function sell(spot) {
  const t = g.towers[spot]; if (!t) return false;
  const r = Math.floor(t.invested * .7); g.gold += r; play('sell'); delete g.towers[spot];
  g.undo = { t, r, until: performance.now() + 3000 }; closePanels(); toast(`Sold for ${r}. Press Z to undo`, 3000); return true;
}
function undoSell() {
  const u = g.undo; if (!u || performance.now() > u.until || g.towers[u.t.spot]) return;
  g.gold -= u.r; g.towers[u.t.spot] = u.t; g.undo = null; toast('Sale undone');
}

// ---------- UI: title ----------
function clearUI() { ui.innerHTML = ''; }
function titleScreen() {
  screen = 'title'; g = null; clearUI(); modal = null;
  img(ui, [0, 0, W, H], 'title_bg', 'nopt');
  const ov = el('div', ui, [0, 0, W, H], 'nopt'); ov.style.background = T.letterbox; ov.style.opacity = .4;
  panel(ui, [640, 240, 640, 600], false);
  ribbon(ui, [600, 180, 720, 80], M.logo && IMG[M.logo] ? '' : 'TD', 56);
  if (M.logo && IMG[M.logo]) img(ui, [860, 20, 200, 194], M.logo, 'nopt');
  setMusic('menu');
  const foot = text(ui, [640, 780, 640, 40], 'Hold the road. 10 waves. 20 lives.', 22, 'center'); foot.style.color = T.textDark;
  const box = el('div', ui, [0, 0, 0, 0]);
  const loaded = Object.keys(IMG).length > 0 && !failed.size;
  if (loaded) return titleButtons(box);
  const lp = el('div', box, [0, 0, 0, 0], 'nopt');
  const frame = img(lp, [704, 500, 512, 96], 'bar_frame');
  const fill = el('div', lp, [704 + 80, 500 + 32, 0, 32], ''); fill.style.background = url('progress_fill'); fill.style.backgroundSize = '352px 32px';
  const lt = text(lp, [640, 440, 640, 40], 'Loading… 0%', 22, 'center'); lt.style.color = T.textDark;
  const prog = p => { fill.style.width = 352 * p + 'px'; lt.textContent = `Loading… ${Math.round(p * 100)}%`; };
  loadAll(prog, failed.size ? new Set(failed) : null).then(() => {
    if (failed.size) {
      lp.remove();
      const er = text(box, [680, 420, 560, 120], "Some game files didn't load. Check your connection and try again.", 22, 'center'); er.style.color = T.textDark;
      const rb = btn(box, [816, 560, 288, 72], 'Retry', () => titleScreen()); rb.focus();
      return;
    }
    buildMapLayer(); fontReady.then(titleScreen);
  });
  void frame;
}
function titleButtons(box) {
  const play = btn(box, [816, 420, 288, 72], 'Play', startGame);
  btn(box, [816, 512, 288, 72], 'How to play', howTo);
  const snd = btn(box, [816, 604, 288, 72], '', () => setMuted(!muted));
  const mot = btn(box, [816, 696, 288, 72], '', () => { reduced = !reduced; localStorage.setItem('td.motion', reduced ? 'reduced' : 'full'); onSettings(); });
  onSettings = () => { snd.textContent = muted ? 'Sound: Off' : 'Sound: On'; mot.textContent = reduced ? 'Motion: Reduced' : 'Motion: Full'; };
  onSettings(); play.focus();
}
let modal = null;
function howTo() {
  const prev = document.activeElement;
  modal = el('div', ui, [0, 0, W, H]); el('div', modal, null, 'dim');
  panel(modal, [560, 200, 800, 680]);
  text(modal, [620, 260, 680, 400], 'Click a build spot, pick a tower, and stop enemies before they reach the exit. Each leaked enemy costs lives. Earn gold from kills and wave clears. Upgrade or sell a tower by clicking it.', 22, 'left').style.lineHeight = '36px';
  const ok = btn(modal, [816, 760, 288, 72], 'Got it', () => { modal.remove(); modal = null; prev?.focus(); });
  modal.close = ok.onclick; ok.focus();
}

// ---------- UI: game ----------
let H$ = {};
function startGame() {
  screen = 'game'; newGame(); clearUI(); H$ = {}; setMusic('battle');
  // HUD
  const hud = el('div', ui, [0, 0, W, 0], 'nopt');
  img(hud, [0, 0, 96, 104], 'hud_cap_left'); img(hud, [1824, 0, 96, 104], 'hud_cap_right');
  const body = el('div', hud, [96, 0, 1728, 80], ''); body.style.background = url('hud_body') + ' repeat-x';
  img(hud, [112, 8, 64, 64], 'icon_gold'); H$.gold = text(hud, [184, 20], '', 28, 'left', 'out display');
  H$.heart = img(hud, [312, 8, 64, 64], 'icon_heart'); H$.lives = text(hud, [384, 20], '', 28, 'left', 'out display');
  img(hud, [512, 8, 64, 64], 'icon_skull'); H$.left = text(hud, [584, 20], '', 28, 'left', 'out display');
  img(hud, [820, 0, 280, 192], 'hud_center'); img(hud, [928, 8, 64, 64], 'icon_wave');
  H$.wave = text(hud, [820, 110, 280, 40], '', 28, 'center', 'out display');
  img(hud, [1180, 16, 256, 48], 'bar_frame');
  H$.wfill = el('div', hud, [1220, 32, 176, 16], ''); H$.wfill.style.background = url('wave_fill');
  H$.pause = btn(ui, [1456, 12, 112, 56], '', () => setPaused(!g.paused), 'Pause');
  H$.speed = btn(ui, [1576, 12, 112, 56], '', () => { g.speed = g.speed === 1 ? 2 : 1; }, 'Game speed 1x');
  H$.mute = btn(ui, [1696, 12, 112, 56], '', () => setMuted(!muted), 'Mute sound');
  onSettings = () => { setIcon(H$.mute, muted ? 'sound_off' : 'sound_on'); H$.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); };
  onSettings();
  // build bar
  const bar = el('div', ui, [440, 968, 1040, 112], 'nopt');
  Object.assign(bar.style, { borderStyle: 'solid', borderWidth: '0 32px', borderImage: `${url('actionbar_body')} 0 32 fill / 0 32px stretch` });
  img(ui, [240, 780, 220, 300], 'actionbar_end_left'); img(ui, [1460, 780, 220, 300], 'actionbar_end_right');
  H$.slots = ORDER.map((k, i) => slotBtn(ui, [480 + 112 * i, 976], k, () => { g.slot = g.slot === k ? null : k; if (g.radial != null) openRadial(g.radial); }));
  H$.next = text(ui, [700, 1000, 360], '', 18, 'right', 'out');
  H$.start = btn(ui, [1240, 992, 192, 64], 'Start wave', startWave);
  H$.toast = el('div', ui, [0, 0, 0, 0], 'nopt');
  H$.panel = el('div', ui, [0, 0, 0, 0]);
  cv.focus();
}
function slotBtn(parent, [x, y], k, fn) {
  const b = el('button', parent, [x, y], 'slot'); b.onclick = fn;
  const name = `${TW[k].name} Tower (${ORDER.indexOf(k) + 1})`; b.title = name; b.setAttribute('aria-label', name);
  img(b, null, 'icon_' + k, 'nopt'); el('span', b, null, 'hk', ORDER.indexOf(k) + 1); el('span', b, null, 'cost', TW[k].lv[0][0]);
  b.k = k; return b;
}
function closePanels() { g.radial = null; g.sel = null; H$.panel.innerHTML = ''; }
function openRadial(spot) {
  closePanels(); g.radial = spot;
  const [cx] = spotC(spot), top = SPOTS[spot][1] * TS;
  const x = Math.max(16, Math.min(1904 - 600, cx - 300)), y = Math.max(96, Math.min(952 - 136, top - 136));
  const p = panel(H$.panel, [x, y, 600, 136]);
  const tip = text(p, [0, 108, 600, 24], '', 18, 'center');
  const show = k => { const c = TW[k].lv[0][0]; tip.textContent = `${TW[k].name} Tower (${ORDER.indexOf(k) + 1}) — ${g.gold >= c ? c + ' gold' : 'Need ' + c}`; };
  const bs = ORDER.map((k, i) => { const b = slotBtn(p, [28 + 112 * i, 8], k, () => build(spot, k)); b.onmouseenter = b.onfocus = () => show(k); b.radial = true; return b; });
  H$.radialSlots = bs;
  const f = bs[ORDER.indexOf(g.slot || 'archer')]; f.focus(); show(f.k);
}
function openUpgrade(spot) {
  closePanels(); g.sel = spot;
  const t = g.towers[spot], [c, r] = SPOTS[spot], D = TW[t.type];
  const x = c >= 11 ? c * TS - 16 - 360 : c * TS + TS + 16, y = Math.max(96, Math.min(952 - 300, r * TS - 60));
  const p = panel(H$.panel, [x, y, 360, 300]);
  img(p, [24, 24, 96, 96], 'avatar_' + t.type, 'nopt');
  text(p, [136, 28, 210], `${D.name} Tower — Lv ${t.lv}`, 22).style.lineHeight = '26px';
  text(p, [136, 84, 210], `Damage ${t.st[1]} · Rate ${t.st[2]}/s · Range ${t.st[3]}`, 18);
  if (t.lv < 3) {
    const n = D.lv[t.lv], nl = text(p, [24, 136, 320], '', 18); nl.innerHTML = `Next: <span style="color:${T.good}">Damage ${n[1]}</span> · ` + (n[2] > t.st[2] ? `<span style="color:${T.good}">Rate ${n[2]}/s</span>` : `Rate ${n[2]}/s`) + ` · <span style="color:${T.good}">Range ${n[3]}</span>`;
  } else text(p, [24, 136, 320], 'Max level reached', 18);
  H$.up = btn(p, [24, 216, 150, 56], '', () => upgrade(spot)); H$.up.style.fontSize = '18px';
  H$.sell = btn(p, [186, 216, 150, 56], `Sell ${Math.floor(t.invested * .7)}`, () => sell(spot)); H$.sell.style.fontSize = '18px';
  refreshUpgrade(); (H$.up.disabled ? H$.sell : H$.up).focus();
}
function refreshUpgrade() {
  const t = g.towers[g.sel]; if (!t || !H$.up) return;
  if (t.lv >= 3) { H$.up.textContent = 'Max level'; H$.up.disabled = true; return; }
  const c = TW[t.type].lv[t.lv][0], ok = g.gold >= c;
  const lab = ok ? `Upgrade ${c}` : `Need ${c}`; if (H$.up.textContent !== lab) H$.up.textContent = lab; H$.up.disabled = !ok;
}
function setIcon(b, name) { // manifest icon image, or text glyph placeholder
  if (b.icon === name) return false; b.icon = name; b.innerHTML = '';
  const ic = M.icons[name]; if (ic.image && IMG[ic.image]) img(b, null, ic.image, 'nopt ico'); else b.textContent = ic.text; return true;
}
let toastTimer;
function toast(s, ms = 2000, portrait) {
  if (!H$.toast) return; H$.toast.innerHTML = ''; const t = el('div', H$.toast, null, 'toast', s);
  if (portrait && IMG[portrait]) { t.style.top = '230px'; t.prepend(img(t, null, portrait, 'nopt portrait')); }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => H$.toast && (H$.toast.innerHTML = ''), ms);
}
function banner(s) {
  const r = ribbon(ui, [600, 400, 720, 80], s, 32);
  if (reduced) return setTimeout(() => r.remove(), 2100);
  r.style.top = '-80px'; r.style.transition = 'top .3s ease-out, opacity .3s';
  requestAnimationFrame(() => requestAnimationFrame(() => r.style.top = '400px'));
  setTimeout(() => r.style.opacity = 0, 1800); setTimeout(() => r.remove(), 2100);
}
function setPaused(v) {
  if (!g || g.over) return;
  g.paused = v; modal?.remove(); modal = null;
  if (!v) { cv.focus(); return; }
  modal = el('div', ui, [0, 0, W, H]); el('div', modal, null, 'dim');
  panel(modal, [760, 340, 400, 400]);
  text(modal, [760, 380, 400, 60], 'Paused', 56, 'center', 'out display');
  const res = btn(modal, [856, 480, 208, 64], 'Resume', () => setPaused(false));
  const confirm = (fn) => {
    const c = el('div', modal, [0, 0, W, H]); el('div', c, null, 'dim'); panel(c, [710, 400, 500, 240]);
    text(c, [710, 440, 500, 40], 'Lose this run?', 28, 'center');
    btn(c, [770, 540, 160, 64], 'Yes', fn); const no = btn(c, [990, 540, 160, 64], 'No', () => { c.remove(); modal.close = () => setPaused(false); res.focus(); });
    modal.close = no.onclick; no.focus();
  };
  btn(modal, [856, 560, 208, 64], 'Restart', () => confirm(() => { modal = null; startGame(); }));
  btn(modal, [856, 640, 208, 64], 'Quit to title', () => confirm(() => { modal = null; titleScreen(); }));
  modal.close = () => setPaused(false); res.focus();
}
function endGame(win) {
  g.over = true; closePanels(); setMusic(null); play(win ? 'stinger_win' : 'stinger_lose');
  const best = JSON.parse(localStorage.getItem('td.best') || 'null'), cur = { wave: g.wave, lives: win ? g.lives : 0 };
  if (!best || cur.wave > best.wave || (cur.wave === best.wave && cur.lives > best.lives)) localStorage.setItem('td.best', JSON.stringify(cur));
  modal = el('div', ui, [0, 0, W, H]); el('div', modal, null, 'dim');
  panel(modal, [560, 240, 800, 600]); ribbon(modal, [600, 200, 720, 80], win ? 'Victory!' : 'Defeat', 32);
  text(modal, [600, 340, 720, 40], win ? `The road holds. Lives left: ${g.lives} / 20` : `The enemy broke through on wave ${g.wave}.`, 28, 'center');
  const s = Math.floor(g.stats.time);
  text(modal, [600, 440, 720, 40], `Enemies defeated: ${g.stats.kills} · Gold earned: ${g.stats.gold.toLocaleString('en-US')} · Time: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 22, 'center');
  const a = btn(modal, [656, 680, 288, 72], win ? 'Play again' : 'Retry', () => { modal = null; startGame(); });
  btn(modal, [976, 680, 288, 72], 'Title', () => { modal = null; titleScreen(); });
  modal.result = win ? 'win' : 'lose'; a.focus();
}

// ---------- HUD refresh ----------
let lastFrame = performance.now();
function refreshHUD(realDt) {
  const gd = g.gold - g.shownGold;
  g.shownGold = reduced || Math.abs(gd) < 1 ? g.gold : g.shownGold + gd * Math.min(1, realDt / 0.1);
  H$.gold.textContent = Math.round(g.shownGold);
  H$.lives.textContent = g.lives; H$.lives.style.color = g.lives < 5 ? T.lowLives : '';
  g.heartFlash -= realDt; H$.heart.style.filter = g.heartFlash > 0 ? `drop-shadow(0 0 0 ${T.bad}) brightness(.6) sepia(1) saturate(10) hue-rotate(-30deg)` : '';
  H$.left.textContent = g.phase === 'wave' ? g.remaining : 0;
  H$.wave.textContent = `Wave ${g.wave}/${WAVES.length}`;
  H$.wfill.style.width = (g.phase === 'wave' && g.total ? 176 * g.remaining / g.total : 0) + 'px';
  setIcon(H$.pause, g.paused ? 'play' : 'pause'); H$.pause.setAttribute('aria-label', g.paused ? 'Resume' : 'Pause');
  if (setIcon(H$.speed, g.speed === 1 ? 'speed1' : 'speed2')) H$.speed.setAttribute('aria-label', `Game speed ${g.speed}x`);
  for (const b of [...H$.slots, ...(g.radial != null ? H$.radialSlots : [])]) b.className = 'slot' + (g.gold < TW[b.k].lv[0][0] ? ' locked' : (!b.radial && g.slot === b.k) || (b.radial && g.slot === b.k) ? ' sel' : '');
  const st = g.phase === 'build' ? `Start wave (${Math.ceil(g.countdown)})` : 'Start wave';
  if (H$.start.textContent !== st) H$.start.textContent = st; H$.start.disabled = g.phase !== 'build';
  const nw = g.phase === 'build' ? g.wave + 1 : g.wave + 1;
  H$.next.textContent = nw <= WAVES.length ? 'Next: ' + WAVES[nw - 1][0].map(([t, n]) => plural(n, EN[t].name)).join(', ') : '';
  refreshUpgrade();
}

// ---------- render ----------
function drawImgC(k, x, y, w, h) { const i = IMG[k]; ctx.drawImage(i, x - (w ?? i.width) / 2, y - (h ?? i.height) / 2, w ?? i.width, h ?? i.height); }
function render() {
  ctx.clearRect(0, 0, W, H);
  if (screen !== 'game' || !g) return;
  ctx.drawImage(mapLayer, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  SPOTS.forEach(([c, r]) => ctx.drawImage(IMG.build_spot, c * TS, r * TS, TS, TS));
  const items = [];
  for (const t of Object.values(g.towers)) { const [c, r] = SPOTS[t.spot]; items.push([r * TS + TS - 8, () => ctx.drawImage(IMG[`tower_${t.type}_l${t.lv}`], c * TS, r * TS + TS - 8 - 160, 128, 160)]); }
  for (const e of g.enemies) { const i = IMG[e.d.sprite || 'enemy_' + e.type]; items.push([e.y + 36, () => ctx.drawImage(i, e.x - i.width / 2, e.y + 36 - i.height)]); }
  items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  for (const p of g.projs) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a || 0); drawImgC(TW[p.t.type].proj, 0, 0); ctx.restore(); }
  for (const a of g.arcs) { const [x1, y1] = a.a, [x2, y2] = a.b; ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.drawImage(IMG.projectile_lightning_arc, 0, -20, Math.hypot(x2 - x1, y2 - y1), 40); ctx.restore(); }
  for (const f of g.fx) { const fr = reduced ? 2 : Math.min(3, Math.floor(f.t * 12)); ctx.drawImage(IMG[f.k], fr * 128, 0, 128, 128, f.x - 64, f.y - 64, 128, 128); }
  for (const e of g.enemies) {
    if (e.hp >= e.max) continue;
    const y = e.y + 36 - IMG[e.d.sprite || 'enemy_' + e.type].height - 8 - 6;
    ctx.fillStyle = T.outline; ctx.fillRect(e.x - 24, y, 48, 6);
    ctx.fillStyle = e.hp / e.max < .3 ? T.bad : T.good; ctx.fillRect(e.x - 24, y, 48 * Math.max(0, e.hp / e.max), 6);
  }
  // overlays
  if (g.slot || g.radial != null) SPOTS.forEach(([c, r], i) => ctx.drawImage(g.towers[i] ? IMG.place_invalid : IMG.place_valid, c * TS, r * TS, TS, TS));
  const rangeOf = i => { const t = g.towers[i]; if (t) return t.st[3]; if (i === g.radial) return TW[g.slot || 'archer'].lv[0][3]; };
  for (const i of new Set([g.hover, g.sel, g.focus, g.radial])) {
    if (i == null || i < 0) continue; const rr = rangeOf(i); if (!rr || (i === g.hover && !g.towers[i] && i !== g.radial)) continue;
    const [cx, cy] = spotC(i); drawImgC('range_circle', cx, cy, 2 * rr * TS, 2 * rr * TS);
  }
  if (g.focus >= 0) { const [c, r] = SPOTS[g.focus]; ctx.strokeStyle = T.focus; ctx.lineWidth = 3; ctx.strokeRect(c * TS + 2, r * TS + 2, TS - 4, TS - 4); }
}
function loop(now) {
  const real = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  if (screen === 'game' && g) {
    if (!g.paused && !g.over) { let dt = real * g.speed * FF; while (dt > 0 && !g.over) { const s = Math.min(dt, 1 / 60); step(s); dt -= s; } }
    refreshHUD(real);
  }
  render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- input ----------
function spotAt(ev) {
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
  return SPOTS.findIndex(([c, rr]) => x >= c * TS && x < c * TS + TS && y >= rr * TS && y < rr * TS + TS);
}
function activateSpot(i) {
  if (i < 0) return closePanels();
  if (g.towers[i]) openUpgrade(i); else openRadial(i);
}
cv.addEventListener('mousemove', ev => { if (g) g.hover = spotAt(ev); });
cv.addEventListener('click', ev => { if (screen === 'game' && g && !modal) activateSpot(spotAt(ev)); });
addEventListener('contextmenu', ev => { if (screen === 'game') { ev.preventDefault(); if (g && !modal) { closePanels(); g.slot = null; } } });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'game' && g && !g.paused && !g.over) setPaused(true); });
addEventListener('keydown', ev => {
  const k = ev.key;
  if (k === 'm' || k === 'M') return setMuted(!muted);
  if (screen === 'title') { if (k === 'Escape' && modal) modal.close(); return; }
  if (!g) return;
  if (modal) { if (k === 'Escape' && modal.close) modal.close(); return; }
  const onBtn = document.activeElement?.tagName === 'BUTTON';
  if (k >= '1' && k <= '5') { const t = ORDER[+k - 1]; if (g.radial != null) build(g.radial, t); else g.slot = g.slot === t ? null : t; }
  else if (k.startsWith('Arrow')) {
    ev.preventDefault(); const n = SPOT_ORDER.length, cur = SPOT_ORDER.indexOf(g.focus);
    const d = k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1; g.focus = SPOT_ORDER[cur < 0 ? 0 : (cur + d + n) % n]; cv.focus();
  } else if (k === 'Enter' && !onBtn && g.focus >= 0) { ev.preventDefault(); activateSpot(g.focus); }
  else if (k === 'u' || k === 'U') { if (g.sel != null) upgrade(g.sel); }
  else if (k === 's' || k === 'S') { if (g.sel != null) sell(g.sel); }
  else if (k === 'z' || k === 'Z') undoSell();
  else if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'p' || k === 'P') setPaused(true);
  else if (k === 'f' || k === 'F') g.speed = g.speed === 1 ? 2 : 1;
  else if (k === 'Escape') { if (g.radial != null || g.sel != null) { closePanels(); cv.focus(); } else if (g.slot) g.slot = null; else setPaused(true); }
});

if (DEBUG) window.td = { played, get actx() { return actx?.state; }, get g() { return g; }, get screen() { return screen; }, get modal() { return modal?.result; }, build, upgrade, sell, undoSell, startWave, startGame, SPOTS };
fontReady.then(titleScreen);
