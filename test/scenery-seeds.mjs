import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genMaps, NSPOTS, COVER, cover } from '../src/mapgen.js';
import { findCastle, mapBounds } from '../src/scenery.js';
const templates = Object.fromEntries(['portrait', 'landscape', 'square'].map(id => [id, JSON.parse(readFileSync(new URL(`../src/maps/${id}.json`, import.meta.url)))]));
let placed = 0;
for (let seed = 0; seed < 1000; seed++) for (const map of Object.values(genMaps(seed, templates))) {
  const view = { left: 0, top: 0, right: map.cols, bottom: map.rows };
  const castle = findCastle(map, view);
  assert.deepEqual(findCastle(map, view), castle);
  assert.ok(castle, `${map.id} seed ${seed} must contain a castle`);
  assert.deepEqual(map.castle, castle);
  assert.equal(map.spots.length, NSPOTS);
  assert.equal(new Set(map.spots.map(spot => spot.join(','))).size, NSPOTS);
  const blocked = new Set([...map.path, ...map.terrain.water].map(cell => cell.join(',')));
  for (const [c, r] of map.spots) {
    assert.ok(c >= 0 && c < map.cols && r >= 1 && r < map.rows - 1);
    assert.ok(!(map.hudRows || []).includes(r));
    assert.ok(!blocked.has([c, r].join(',')));
    assert.ok(map.path.some(([x, y]) => Math.max(Math.abs(x - c), Math.abs(y - r)) === 1));
    const coverage = cover([c, r], map.path);
    assert.ok(coverage >= COVER[0] && coverage <= COVER[1]);
  }
  assert.ok(map.path.length >= 23 && map.path.length <= 27);
  placed++;
  const { c, r, width, height } = castle;
  const bounds = mapBounds(map);
  assert.ok(c >= bounds.c0 && r >= bounds.r0 && c + width <= bounds.c1 + 1 && r + height <= bounds.r1 + 1);
  assert.ok(c >= 0 && r >= 0 && c + width <= map.cols && r + height <= map.rows);
  for (const [x, y] of [...map.path, ...map.spots, ...map.terrain.water]) {
    assert.ok(x + 1 <= c - .75 || x >= c + width + .75 || y + 1 <= r - .75 || y >= r + height + .75);
  }
}
assert.equal(placed, 3000);
console.log(`Validated ${placed} generated maps; every map has ${NSPOTS} distinct usable tower spots and a clear castle site`);
