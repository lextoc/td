import assert from 'node:assert/strict';
import { ROADS, waveFor } from '../src/world.js';
assert.equal(new Set(ROADS.map(r => r.id)).size, 4);
assert.equal(ROADS[1].hp, 1);
assert.ok(ROADS[0].hp < ROADS[1].hp && ROADS[2].hp > ROADS[1].hp);
const base = Array.from({ length: 10 }, (_, i) => [i === 9 ? [['knight', 12], ['troll', 1]] : [['goblin', 8]], 1]);
assert.deepEqual(waveFor(10, base, true), base[9]);
assert.ok(waveFor(11, base, true)[0][0][1] > 8);
assert.equal(waveFor(20, base, true)[0].find(([type]) => type === 'troll')[1], 2);
for (let wave = 1; wave <= 1000; wave++) {
  const [groups, interval] = waveFor(wave, base, true);
  assert.ok(interval >= .28);
  assert.ok(groups.every(([, count]) => Number.isInteger(count) && count > 0));
}
console.log('Road difficulty and 1,000 endless wave checks passed');
