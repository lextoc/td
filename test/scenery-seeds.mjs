import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genMaps } from '../src/mapgen.js';
import { findCastle } from '../src/scenery.js';
const templates = Object.fromEntries(['portrait', 'landscape', 'square'].map(id => [id, JSON.parse(readFileSync(new URL(`../src/maps/${id}.json`, import.meta.url)))]));
let placed = 0;
for (let seed = 0; seed < 100; seed++) for (const map of Object.values(genMaps(seed, templates))) {
  const view = { left: 0, top: 0, right: map.cols, bottom: map.rows };
  const castle = findCastle(map, view);
  assert.deepEqual(findCastle(map, view), castle);
  if (!castle) continue;
  placed++;
  const { c, r, width, height } = castle;
  assert.ok(c >= 0 && r >= 0 && c + width <= map.cols && r + height <= map.rows);
  for (const [x, y] of [...map.path, ...map.spots, ...map.terrain.water]) {
    assert.ok(x + 1 <= c - .75 || x >= c + width + .75 || y + 1 <= r - .75 || y >= r + height + .75);
  }
}
assert.ok(placed > 0);
console.log(`Validated 300 generated maps; castle fits ${placed}`);
