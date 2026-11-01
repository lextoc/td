import assert from 'node:assert/strict';
import { findCastle } from '../src/scenery.js';
const map = { cols: 8, rows: 8, seed: 42, path: [], spots: [], entry: [-1, 4], exit: [8, 4], terrain: {} };
const view = { left: 0, top: 0, right: 8, bottom: 8 };
const castle = findCastle(map, view);
assert.ok(castle);
assert.deepEqual(findCastle(map, view), castle);
assert.equal(findCastle(map, { ...view, right: 2 }), null);
assert.equal(findCastle({ ...map, cols: 2 }, view), null);
assert.equal(findCastle({ ...map, hudRows: [0, 1, 2, 3, 4, 5, 6, 7] }, view), null);
for (const field of ['path', 'spots']) {
  const full = Array.from({ length: 64 }, (_, i) => [i % 8, Math.floor(i / 8)]);
  assert.equal(findCastle({ ...map, [field]: full }, view), null);
}
for (const terrain of [{ water: [[1, 1]] }, { fixed: { '1,1': 'tree_oak' } }, { bridges: [[1, 1]] }]) {
  assert.equal(findCastle({ ...map, cols: 3, rows: 3, terrain }, view), null);
}
assert.equal(findCastle({ ...map, cols: 4, rows: 3, spots: [[3, 1]] }, view), null);
assert.equal(findCastle(map, { left: .1, top: .1, right: 3, bottom: 3 }), null);
console.log('Castle placement checks passed');
