// npm test: end-to-end checks in Chromium. Output (screenshots) goes to test-output/ (git-ignored).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.TD_URL || 'http://127.0.0.1:5173/';
const OUT = new URL('../test-output/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(q, vp = { width: 1920, height: 1080 }, touch = false, dpr = 1) {
  const c = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: dpr });
  const page = await c.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(q + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(q + ': ' + e.message));
  await page.goto(BASE + q);
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 });
  page.done = () => c.close();
  return page;
}
const td = (page, f, a) => page.evaluate(f, a);
const log = (...a) => console.log(...a);
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const rectOv = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

// 1. desktop: mouse + keyboard flows
let p = await open('?debug');
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
ok(await td(p, () => td.screen) === 'game', 'Enter on autofocused Play starts the game');
let s = await td(p, () => ({ gold: td.g.gold, lives: td.g.lives, cd: td.g.countdown, map: td.map, mode: td.L.mode, s: td.L.s }));
ok(s.gold === 250 && s.lives === 20 && s.map === 'landscape' && s.mode === 'desktop' && s.s === 128, `1920x1080: ${JSON.stringify(s)}`);
let sp = await td(p, () => td.spotS(1));
await p.mouse.click(sp[0], sp[1]); await p.waitForTimeout(150);
const pr = await p.locator('.selp').boundingBox(), spr = { x: sp[0] - 64, y: sp[1] - 64, w: 128, h: 128 };
ok(pr && rectOv({ x: pr.x, y: pr.y, w: pr.width, h: pr.height }, spr) === 0, 'build panel does not cover the selected spot');
await p.locator('.cards button[aria-label="Archer Tower (1)"]').click();
ok(await td(p, () => td.g.ghost?.type) === 'archer' && !(await td(p, () => td.g.towers[1])), 'tap card shows ghost preview, nothing built yet');
await p.locator('.cards button[aria-label="Archer Tower (1)"]').click();
ok(await td(p, () => td.g.towers[1]?.type) === 'archer' && await td(p, () => td.g.gold) === 180, 'same card again confirms: archer built, gold 250→180');
// keyboard: Tab focuses map, arrows move, number preselects, Enter opens, Enter builds
await p.locator('#cv').focus();
await p.keyboard.press('4'); await p.keyboard.press('ArrowRight');
const f = await td(p, () => td.g.focus);
await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.keyboard.press('Enter');
ok(await td(p, (f) => td.g.towers[f]?.type, f) === 'frost', `keyboard build frost on focused spot ${f}`);
await p.mouse.click(sp[0], sp[1]); await p.waitForTimeout(100);
await td(p, () => { td.g.gold += 500; });
await p.getByRole('button', { name: /^Upgrade 60/ }).click();
ok(await td(p, () => td.g.towers[1].lv) === 2, 'mouse Upgrade → Lv2');
ok(await p.getByRole('button', { name: 'Close' }).isVisible(), 'upgrade panel has a Close button');
await p.keyboard.press('u');
ok(await td(p, () => td.g.towers[1].lv) === 3, 'U key → Lv3');
let g0 = await td(p, () => td.g.gold);
await p.getByRole('button', { name: /^Sell/ }).click();
ok(!(await td(p, () => !!td.g.towers[1])) && (await td(p, () => td.g.gold)) - g0 === Math.floor(220 * .7), 'Sell refunds 70%');
await p.locator('.toast .undo').click();
ok(await td(p, () => td.g.towers[1]?.lv) === 3 && await td(p, () => td.g.gold) === g0, 'toast Undo restores the tower');
await p.keyboard.press('p'); await p.waitForTimeout(100);
ok(await td(p, () => td.g.paused), 'P pauses');
await p.keyboard.press('p'); await p.waitForTimeout(100);
ok(!(await td(p, () => td.g.paused)), 'P in the pause modal resumes');
await td(p, () => { td.g.gold += 2000; td.build(4, 'cannon'); td.build(3, 'mage'); td.build(5, 'tesla'); td.build(0, 'archer'); });
await p.keyboard.press('Escape'); await p.keyboard.press('Space');
ok(await td(p, () => td.g.wave) === 1, 'Space starts wave 1');
await p.keyboard.press('f'); ok(await td(p, () => td.g.speed) === 2, 'F toggles 2x');
await p.waitForFunction(() => td.g.enemies.length >= 2 && td.g.projs.length + td.g.arcs.length > 0, null, { timeout: 30000 });
await p.waitForFunction(() => td.g.phase === 'build' && td.g.wave === 1, null, { timeout: 60000 });
const played = await td(p, () => td.played);
ok(played.fire_archer > 0, 'fire sounds triggered: ' + JSON.stringify(played));
// rotation mid-run: switch to portrait map; towers keep their spot index, enemies keep path fraction, game pauses
await p.keyboard.press('Space'); await p.waitForFunction(() => td.g.enemies.length > 0);
const before = await td(p, () => ({ t: Object.keys(td.g.towers).map(Number).sort((a, b) => a - b), f: td.g.enemies.map(e => e.dist / td.PATHLEN) }));
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
const after = await td(p, () => ({ map: td.map, mode: td.L.mode, paused: td.g.paused, t: Object.keys(td.g.towers).map(Number).sort((a, b) => a - b), f: td.g.enemies.map(e => e.dist / td.PATHLEN) }));
ok(after.map === 'portrait' && after.mode === 'sheet' && after.paused && JSON.stringify(after.t) === JSON.stringify(before.t), `rotation → ${after.map}, paused, towers kept at spots ${after.t}`);
ok(after.f.length === before.f.length && after.f.every((x, i) => Math.abs(x - before.f[i]) < .02), 'enemies keep their path fraction across the switch');
await p.done();

// 2. viewports: variant, tile clamp, no letterbox, 56 px tap targets, panel never over spot, touch flow
if (process.env.ONLY !== "fast") for (const [w, h, dpr, map, mode] of [[390, 844, 3, 'portrait', 'sheet'], [360, 780, 2, 'portrait', 'sheet'], [844, 390, 3, 'landscape', 'rail'], [1024, 1024, 1, 'square', 'sheet'], [3440, 1440, 1, 'landscape', 'desktop'], [1280, 720, 1, 'landscape', 'desktop']]) {
  p = await open('?debug', { width: w, height: h }, dpr > 1, dpr);
  await td(p, () => td.startGame()); await p.waitForTimeout(300);
  const L = await td(p, () => ({ map: td.map, mode: td.L.mode, s: td.L.s, spots: td.SPOTS.map((_, i) => td.spotS(i)), cols: td.MAPS[td.map].cols, rows: td.MAPS[td.map].rows }));
  ok(L.map === map && L.mode === mode && L.s >= 40 && L.s <= 128, `${w}x${h}: ${L.map}/${L.mode}, tile ${L.s}px`);
  // nearest-spot hit test: a tap 20 px off centre still hits; every spot has a >= 56 px target
  const hits = await td(p, (sp) => sp.map(([x, y], i) => td.spotAtXY(x + 20, y) === i && td.spotAtXY(x, y + 20) === i), L.spots);
  ok(hits.every(Boolean), `${w}x${h}: every spot hit by taps 20px off-centre (56px circles, nearest wins)`);
  const i = 3, [x, y] = L.spots[i];
  if (dpr > 1) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
  await p.waitForTimeout(250);
  const now = await td(p, (i) => td.spotS(i), i);
  const box = await p.locator('.selp').boundingBox();
  const cov = rectOv({ x: box.x, y: box.y, w: box.width, h: box.height }, { x: now[0] - L.s / 2, y: now[1] - L.s / 2, w: L.s, h: L.s });
  ok(cov === 0, `${w}x${h}: selection UI does not cover the selected spot (pan ${await td(p, () => td.L.pan.toFixed(0))})`);
  const small = await p.$$eval('#ui button', bs => bs.filter(b => b.offsetParent && (b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44)).map(b => b.ariaLabel || b.textContent));
  ok(small.length === 0, `${w}x${h}: all visible buttons >= 44px ${small.join(',')}`);
  await p.locator('.cards button[aria-label="Archer Tower (1)"]').click();
  await p.getByRole('button', { name: /^Build Archer/ }).click();
  ok(await td(p, (i) => td.g.towers[i]?.type, i) === 'archer', `${w}x${h}: tap spot → card → Build builds`);
  await p.screenshot({ path: `${OUT}vp-${w}x${h}.png` });
  await p.done();
}

// 2b. TD-5 QA (A): every spot's 28px tap circle and the path exit cell lie inside the unobscured play rect
// (viewport ∩ safe area, below the top HUD, above the bottom bar/sheet, left of the rail). (C): rapid taps register.
if (process.env.ONLY !== "fast") for (const [w, h] of [[360, 640], [360, 780], [375, 667], [390, 844], [430, 932], [1024, 1024], [844, 390], [1280, 720]]) {
  p = await open('?debug', { width: w, height: h }, w < 1280, 3);
  await td(p, () => td.startGame()); await p.waitForTimeout(300);
  const r = await td(p, () => {
    const R = e => e.getBoundingClientRect(), hud = R(document.querySelector('.hud')), bar = R(document.querySelector('.bbar'));
    const U = { l: 0, t: hud.bottom, r: innerWidth, b: innerHeight };
    if (td.L.mode === 'rail') U.r = Math.min(U.r, bar.left); else U.b = Math.min(U.b, bar.top);
    const M = td.MAPOBJ, inG = ([c, r]) => c >= 0 && c < M.cols && r >= 0 && r < M.rows, ex = [...M.path].reverse().find(inG);
    const [ex0, ey0] = td.w2s(ex[0] * 128, ex[1] * 128), k = td.L.k * 128;
    const bad = td.SPOTS.map((_, i) => [i, td.spotS(i)]).filter(([, [x, y]]) => x - 28 < U.l || y - 28 < U.t || x + 28 > U.r || y + 28 > U.b).map(a => a[0]);
    return { U, bad, exit: [ex0, ey0, k], exitIn: ex0 >= U.l - .5 && ey0 >= U.t - .5 && ex0 + k <= U.r + .5 && ey0 + k <= U.b + .5, s: td.L.s, mode: td.L.mode, spots: td.SPOTS.map((_, i) => td.spotS(i)) };
  });
  ok(r.bad.length === 0, `${w}x${h} ${r.mode}: all spot tap circles inside unobscured rect ${JSON.stringify(r.U)} (tile ${r.s.toFixed(1)}) ${r.bad}`);
  ok(r.exitIn, `${w}x${h}: path exit cell fully visible ${r.exit.map(v => v.toFixed(0))}`);
  ok(r.s >= 32, `${w}x${h}: tile ${r.s.toFixed(1)}px >= 32 (whole grid fits between bars)`);
  if (w < 1280) { // rapid taps (< 350 ms apart) each register: spot A then spot B → B selected, then same card twice builds
    const [a, b] = [r.spots[0], r.spots[1]];
    await p.touchscreen.tap(a[0], a[1]); await p.waitForTimeout(60); await p.touchscreen.tap(b[0], b[1]); await p.waitForTimeout(120);
    ok(await td(p, () => td.g.selSpot) === 1, `${w}x${h}: rapid second tap (60ms apart) registers on spot 1`);
  }
  await p.done();
}

// 3. average plan on every map: must win narrowly
const plan = [["b", 5, "archer"], ["b", 7, "archer"], ["b", 10, "archer"], ["b", 3, "archer"], ["b", 4, "archer"], ["b", 1, "archer"], ["b", 2, "cannon"], ["b", 11, "archer"], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["b", 13, "mage"], ["b", 12, "frost"], ["b", 9, "mage"], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["u", 13], ["u", 9], ["b", 0, "tesla"], ["u", 13], ["u", 9], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["b", 6, "cannon"], ["b", 8, "mage"], ["u", 12], ["u", 0], ["u", 6], ["u", 8], ["u", 12], ["u", 0], ["u", 6], ["u", 8]];
for (const map of ['landscape', 'portrait', 'square']) {
  p = await open(`?debug&ff=16&map=${map}`);
  await p.keyboard.press('Enter');
  await td(p, (plan) => {
    let i = 0;
    setInterval(() => { const g = td.g; if (!g || g.over || i >= plan.length) return; const [k, s, t] = plan[i]; if (k === 'b' ? g.towers[s] || td.build(s, t) : td.upgrade(s)) i++; }, 50);
    window.waves = [];
    setInterval(() => { const g = td.g; if (g && window.waves.at(-1)?.w !== g.wave) window.waves.push({ w: g.wave, lives: g.lives, gold: g.gold }); }, 20);
  }, plan);
  await p.waitForFunction(() => td.modal, null, { timeout: 300000 });
  const res = await td(p, () => ({ r: td.modal, lives: td.g.lives, wave: td.g.wave, kills: td.g.stats.kills, leaks: td.g.leaks, towers: Object.values(td.g.towers).map(t => t.type + t.lv).join(' ') }));
  log(map, 'average plan:', JSON.stringify(res));
  log(map, 'per wave start:', JSON.stringify(await td(p, () => window.waves)));
  ok(res.r === 'win' && !(res.leaks || {}).troll, `${map}: average plan wins (lives left ${res.lives}/20)`);
  ok(res.lives <= 18, `${map}: win is narrow (lives ${res.lives})`);
  if (map === 'landscape') await p.screenshot({ path: OUT + 'win.png' });
  await p.done();
}

// 4. lose run
p = await open('?debug&ff=20');
await p.keyboard.press('Enter');
await p.waitForFunction(() => td.modal, null, { timeout: 120000 });
ok(await td(p, () => td.modal) === 'lose', 'no towers → Defeat on wave ' + await td(p, () => td.g.wave));
ok((await td(p, () => td.played.life_lost)) > 0, 'life_lost sound on leak');
await p.done();
await browser.close();
ok(errors.length === 0, 'console errors: ' + (errors.length ? errors.join('\n') : 0));
