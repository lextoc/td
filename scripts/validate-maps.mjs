// npm run validate-maps: 1000 seeds x 3 variants through src/mapgen.js; asserts TD-9b validity + fairness, prints distributions.
import { readFileSync } from 'node:fs';
import { genMaps, SIZES, LEN, NSPOTS, COVER, cover } from '../src/mapgen.js';
const tpl = Object.fromEntries(Object.keys(SIZES).map(id => [id, JSON.parse(readFileSync(new URL(`../src/maps/${id}.json`, import.meta.url)))]));
const N = +process.argv[2] || 1000, fails = [], st = {};
const hist = a => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '); };
for (let seed = 1; seed <= N; seed++) {
  const maps = genMaps(seed, tpl), again = genMaps(seed, tpl);
  for (const [id, m] of Object.entries(maps)) {
    const s = st[id] ||= { len: [], cov: [], tries: [] }, [C, R] = SIZES[id], p = m.path, k = q => q + '';
    const bad = msg => fails.push(`${id} seed ${seed}: ${msg}`), P = new Map(p.map((q, i) => [k(q), i]));
    if (JSON.stringify(m) !== JSON.stringify(again[id])) bad('not reproducible');
    if (m.cols !== C || m.rows !== R) bad('size');
    if (p.length < LEN[0] || p.length > LEN[1]) bad('length ' + p.length);
    if (P.size !== p.length) bad('repeat tile');
    p.forEach(([c, r], i) => {
      if (c < 0 || c >= C || r < 1 || r >= R - 1) bad('path out of play rows');
      if (i && Math.abs(c - p[i - 1][0]) + Math.abs(r - p[i - 1][1]) !== 1) bad('discontinuous');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = P.get(k([c + dx, r + dy])); if (j != null && Math.abs(j - i) !== 1) bad('self-touching at ' + i); }
    });
    const edge = q => (q[0] === 0 || q[0] === C - 1);
    if (!edge(p[0]) || !edge(p.at(-1)) || p[0][0] === p.at(-1)[0]) bad('entry/exit not on opposite edges');
    if (Math.abs(m.entry[0] - p[0][0]) !== 1 || m.entry[0] >= 0 && m.entry[0] < C) bad('entry not off-map');
    if (Math.abs(m.exit[0] - p.at(-1)[0]) !== 1 || m.exit[0] >= 0 && m.exit[0] < C) bad('exit not off-map');
    const S = m.spots;
    if (S.length !== NSPOTS || new Set(S.map(k)).size !== NSPOTS) bad('spot count');
    S.forEach(q => {
      if (q[0] < 0 || q[0] >= C || q[1] < 1 || q[1] >= R - 1) bad('spot in HUD row/out of grid ' + q); // hudRows [0, rows-1]
      if (P.has(k(q))) bad('spot on path');
      if (!p.some(t => Math.max(Math.abs(t[0] - q[0]), Math.abs(t[1] - q[1])) === 1)) bad('spot not adjacent to path');
      const cv = cover(q, p); if (cv < COVER[0] || cv > COVER[1]) bad('coverage ' + cv); s.cov.push(cv);
    });
    const busy = new Set([...p, ...S].map(k));
    if (m.terrain.water.some(w => busy.has(k(w)))) bad('water on path/spot');
    s.len.push(p.length); s.tries.push(m.tries);
  }
}
for (const [id, s] of Object.entries(st)) {
  console.log(`== ${id} ${SIZES[id].join('x')}: ${N} seeds`);
  console.log('  path length  ', hist(s.len));
  console.log('  coverage/spot', hist(s.cov), `(bound ${COVER.join('..')} path tiles within 2.5)`);
  console.log('  retries      ', hist(s.tries.map(t => Math.min(t, 10))), ' max', Math.max(...s.tries));
}
console.log(fails.length ? `FAIL ${fails.length}\n` + fails.slice(0, 20).join('\n') : `ALL PASS (${N * 3} maps)`);
process.exit(fails.length ? 1 : 0);
