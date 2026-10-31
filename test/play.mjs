import { chromium } from 'playwright';
const BASE = process.env.TD_URL || 'http://127.0.0.1:5173/';
const SHOT = new URL('../screenshots/', import.meta.url).pathname;
const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(q) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(q + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(q + ': ' + e.message));
  await page.goto(BASE + q);
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 });
  return page;
}
const td = (page, f, a) => page.evaluate(f, a);
const log = (...a) => console.log(...a);
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

// 1. title + manual interactions
let p = await open('?debug');
await p.screenshot({ path: SHOT + '01-title.png' });
await p.keyboard.press('Enter'); // Play is autofocused
await p.waitForTimeout(300);
ok(await td(p, () => td.screen) === 'game', 'Enter on autofocused Play starts the game');
let s = await td(p, () => ({ gold: td.g.gold, lives: td.g.lives, cd: td.g.countdown }));
ok(s.gold === 250 && s.lives === 20 && s.cd > 14, `start: gold ${s.gold}, lives ${s.lives}, countdown ${s.cd.toFixed(1)}`);
// mouse: click spot (2,3), radial, click Archer slot
await p.mouse.click(2 * 128 + 64, 3 * 128 + 64);
await p.waitForTimeout(200);
await p.screenshot({ path: SHOT + '02-build-radial.png' });
await p.locator('button.slot[aria-label="Archer Tower (1)"]').nth(1).click();
ok(await td(p, () => td.g.towers[1]?.type) === 'archer' && await td(p, () => td.g.gold) === 180, 'mouse build archer on (2,3), gold 250→180');
// keyboard: select slot 4 (frost), focus spot via arrows, Enter opens radial, Enter builds
await p.keyboard.press('4');
await p.keyboard.press('ArrowRight');
const f = await td(p, () => td.g.focus);
await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.keyboard.press('Enter');
ok(await td(p, (f) => td.g.towers[f]?.type, f) === 'frost', `keyboard build frost on focused spot ${f}`);
// upgrade via click
await p.mouse.click(2 * 128 + 64, 3 * 128 + 64); await p.waitForTimeout(100);
await td(p, () => { td.g.gold += 500; });
await p.getByRole('button', { name: /^Upgrade 60/ }).click();
ok(await td(p, () => td.g.towers[1].lv) === 2, 'mouse Upgrade → Lv2');
await p.screenshot({ path: SHOT + '03-upgrade-panel.png' });
await p.keyboard.press('u');
ok(await td(p, () => td.g.towers[1].lv) === 3, 'U key → Lv3');
ok(await p.getByRole('button', { name: 'Max level' }).isDisabled(), 'Max level button disabled');
// sell + undo
let g0 = await td(p, () => td.g.gold);
await p.keyboard.press('s');
let g1 = await td(p, () => td.g.gold);
ok(!(await td(p, () => !!td.g.towers[1])) && g1 - g0 === Math.floor(220 * .7), `S sells for ${g1 - g0} (70% of 220)`);
await p.keyboard.press('z');
ok(await td(p, () => td.g.towers[1]?.lv) === 3 && await td(p, () => td.g.gold) === g0, 'Z undoes sale');
await p.mouse.click(2 * 128 + 64, 3 * 128 + 64); await p.getByRole('button', { name: /^Sell/ }).click();
ok(!(await td(p, () => !!td.g.towers[1])), 'Sell button sells');
await p.keyboard.press('z');
// more towers of all types, start wave with Space
await td(p, () => { td.g.gold += 2000; td.build(4, 'cannon'); td.build(3, 'mage'); td.build(5, 'tesla'); td.build(0, 'archer'); td.build(2, 'cannon'); });
await p.keyboard.press('Escape'); await p.keyboard.press('Space');
ok(await td(p, () => td.g.wave) === 1, 'Space starts wave 1 (early bonus)');
await p.waitForTimeout(400);
await p.screenshot({ path: SHOT + '04-wave-banner.png' });
await p.keyboard.press('f');
ok(await td(p, () => td.g.speed) === 2, 'F toggles 2x');
await p.waitForFunction(() => td.g.enemies.length >= 2 && td.g.projs.length + td.g.arcs.length > 0, null, { timeout: 30000 });
await p.screenshot({ path: SHOT + '05-towers-firing.png' });
await p.waitForFunction(() => td.g.wave === 2 || (td.g.phase === 'build' && td.g.wave === 1), null, { timeout: 60000 });
const played = await td(p, () => td.played);
ok(played.fire_archer > 0 && played.fire_frost > 0, 'wave 1 fire sounds triggered: ' + JSON.stringify(played) + ' audio=' + await td(p, () => td.actx));
function ORDER_ALL(pl) { return ['archer', 'cannon', 'mage', 'frost', 'tesla'].every(k => pl['fire_' + k] > 0); }
await p.keyboard.press('p'); await p.waitForTimeout(100);
ok(await td(p, () => td.g.paused), 'P pauses');
await p.screenshot({ path: SHOT + '06-paused.png' });
await p.keyboard.press('Escape');
ok(!(await td(p, () => td.g.paused)), 'Esc resumes');
await p.close();

// 2. Realistic full run with normal economy (250 gold), scripted builder, fast-forward
p = await open('?debug&ff=16');
await p.keyboard.press('Enter');
const plan = [["b", 5, "archer"], ["b", 7, "archer"], ["b", 10, "archer"], ["b", 3, "archer"], ["b", 4, "archer"], ["b", 1, "archer"], ["b", 2, "cannon"], ["b", 11, "archer"], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["b", 13, "mage"], ["b", 12, "frost"], ["b", 9, "mage"], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["u", 13], ["u", 9], ["b", 0, "tesla"], ["u", 13], ["u", 9], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["b", 6, "cannon"], ["b", 8, "mage"], ["u", 12], ["u", 0], ["u", 6], ["u", 8], ["u", 12], ["u", 0], ["u", 6], ["u", 8]];
await td(p, (plan) => {
  let i = 0;
  setInterval(() => {
    const g = td.g; if (!g || g.over || i >= plan.length) return;
    const [k, s, t] = plan[i];
    if (k === 'b' ? g.towers[s] || g.gold >= 0 && td.build(s, t) : td.upgrade(s)) i++;
  }, 50);
  window.waves = [];
  setInterval(() => { const g = td.g; if (g && window.waves.at(-1)?.w !== g.wave) window.waves.push({ w: g.wave, lives: g.lives, gold: g.gold }); }, 20);
}, plan);
await p.waitForFunction(() => td.modal || (td.g.wave === 10 && td.g.enemies.some(e => e.type === 'troll')), null, { timeout: 300000 });
log('pre-troll:', JSON.stringify(await td(p, () => ({m: td.modal, w: td.g.wave, l: td.g.lives, waves: window.waves}))));
await p.screenshot({ path: SHOT + '07-wave10-troll.png' });
await p.waitForFunction(() => td.modal, null, { timeout: 300000 });
const played2 = await td(p, () => td.played);
ok(ORDER_ALL(played2) && played2.life_lost !== undefined || ORDER_ALL(played2), 'all 5 weapon fire sounds triggered in full run: ' + JSON.stringify(played2));
const res = await td(p, () => ({ r: td.modal, lives: td.g.lives, wave: td.g.wave, kills: td.g.stats.kills, gold: td.g.stats.gold, leaks: td.g.leaks, towers: Object.values(td.g.towers).map(t => t.type + t.lv).join(' '), best: localStorage.getItem('td.best') }));
log('full run:', JSON.stringify(res));
log('per wave start:', JSON.stringify(await td(p, () => window.waves)));
ok(res.r === 'win' && res.kills + Object.values(res.leaks || {}).reduce((a, b) => a + b, 0) === 188 && !(res.leaks || {}).troll, 'scripted normal-economy run wins all 10 waves (all 188 enemies resolved, troll killed)');
await p.screenshot({ path: SHOT + '08-win.png' });
await p.close();

// 3. Lose run: no towers
p = await open('?debug&ff=20');
await p.keyboard.press('Enter');
await p.waitForFunction(() => td.modal, null, { timeout: 120000 });
ok(await td(p, () => td.modal) === 'lose', 'no towers → Defeat on wave ' + await td(p, () => td.g.wave));
ok((await td(p, () => td.played.life_lost)) > 0, 'life_lost sound on leak');
await p.screenshot({ path: SHOT + '09-lose.png' });
await p.close();
await browser.close();
ok(errors.length === 0, 'console errors: ' + (errors.length ? errors.join('\n') : 0));
