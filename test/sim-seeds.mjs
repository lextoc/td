// npm run sim-seeds: average plan on N random seeds per variant (default 20), needs the dev server. Asserts win with >= 8 lives.
import { chromium } from 'playwright';
import { runPlan } from './sim.mjs';
const BASE = process.env.TD_URL || 'http://127.0.0.1:5173/', N = +process.argv[2] || 20, PAR = +process.env.PAR || 6;
const browser = await chromium.launch(), jobs = [], out = {}; let fail = 0, errs = 0;
for (const map of ['portrait', 'landscape', 'square']) for (let i = 0; i < N; i++) jobs.push([map, 1000 + i * 7919]);
await Promise.all(Array.from({ length: PAR }, async () => {
  for (let j; (j = jobs.shift());) {
    const [map, seed] = j, c = await browser.newContext({ viewport: { width: 1280, height: 720 } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs++; }); p.on('pageerror', () => errs++);
    await p.goto(`${BASE}?debug&ff=16&map=${map}&seed=${seed}`); await p.getByRole('button', { name: 'Play', exact: true }).waitFor();
    const r = await runPlan(p); await c.close();
    (out[map] ||= []).push(r.r === 'win' ? r.lives : 0);
    if (r.r !== 'win' || r.lives < 8) { fail++; console.log('FAIL', map, seed, r.r, r.lives); }
  }
}));
await browser.close();
for (const [m, l] of Object.entries(out)) console.log(`${m}: ${l.length} seeds, lives min ${Math.min(...l)} avg ${(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1)} max ${Math.max(...l)} | ${l.sort((a, b) => a - b).join(' ')}`);
console.log(fail || errs ? `FAIL ${fail} runs, ${errs} console errors` : 'ALL WIN with >= 8 lives, 0 console errors'); process.exit(fail || errs ? 1 : 0);
