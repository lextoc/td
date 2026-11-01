// How to play: 4 illustrated steps render and fit phone viewports, no console errors.
import { chromium } from 'playwright';
const BASE = process.env.TD_URL || 'http://127.0.0.1:5173/';
const SHOTS = process.env.HOWTO_SHOTS; // optional dir for screenshots
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [844, 390]]) {
  const errors = [];
  const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '?seed=7');
  await p.getByRole('button', { name: 'How to play' }).click({ timeout: 30000 });
  const steps = p.locator('.hstep');
  await steps.first().waitFor();
  ok(await steps.count() === 4, `${w}x${h}: 4 steps`);
  const txt = await steps.allInnerTexts();
  ok(/spot/i.test(txt[0]) && /bottom bar/i.test(txt[1]) && /Start wave/i.test(txt[2]) && /li(fe|ves)/i.test(txt[3]), `${w}x${h}: step copy`);
  ok(await p.locator('.hstep img').evaluateAll(a => a.every(i => i.complete && i.naturalWidth > 0)), `${w}x${h}: step art loaded`);
  ok(await p.locator('.hstep p').evaluateAll(a => a.every(e => parseFloat(getComputedStyle(e).fontSize) >= 16)), `${w}x${h}: text >= 16px`);
  const got = p.getByRole('button', { name: 'Got it' }), bb = await got.boundingBox();
  ok(bb.height >= 48 && bb.width >= 48 && bb.y + bb.height <= h && bb.x + bb.width <= w, `${w}x${h}: Got it visible, >=48px`);
  ok(await p.evaluate(() => { const e = document.querySelector('.mpanel'); const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && e.scrollHeight <= e.clientHeight + 1; }), `${w}x${h}: panel fits, no overflow`);
  ok(await p.locator('.hstep').evaluateAll(a => a.every(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })), `${w}x${h}: steps not covered`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/howto-${w}x${h}.png` });
  await got.click();
  ok(await steps.count() === 0, `${w}x${h}: Got it closes`);
  ok(errors.length === 0, `${w}x${h}: console errors: ${errors.join('; ') || 0}`);
  await c.close();
}
await browser.close();
