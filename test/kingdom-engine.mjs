import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as kingdom from '../src/kingdom.js';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const noop = () => {};
const sandbox = {
  ...kingdom, console, Math, performance, DEBUG: false, Q: new URLSearchParams(), TS: 128,
  BREATHER: 12, BOSS_BREATHER: 18, PLEN: 100000, PTS: [[0, 0]], SPARK: {}, M: {},
  play: noop, toast: noop, shake: noop, banner: noop, burst: noop, coinFx: noop,
  sprite: () => null, addFx: noop, sparks: noop, floatText: noop, deathDur: () => 1,
  animDur: () => 1, ring: noop, spotC: () => [0, 0], pathPos: d => [d, 0],
  closePanels: noop, openSel: noop, buzz: noop,
  waveLabel: () => 'Test wave',
  endGame: win => { sandbox.g.over = true; sandbox.win = win; },
  modal: { kingdom: true },
};
vm.createContext(sandbox);
vm.runInContext([
  section("const ORDER =", '// ---------- maps:'),
  section('function newGame()', 'const BREATHER'),
  section('const isBoss =', 'function startWave()'),
  section('function startWave()', 'const floatText'),
  section('function inRange(', '// ---------- UI: title'),
  section('const clearedWaves =', 'function updateCastleAccess()')
].join('\n'), sandbox);
const run = code => vm.runInContext(code, sandbox);
run('newGame()');
assert.equal(sandbox.g.kingdom.spent, 0);
run("build(0, 'archer')");
assert.equal(sandbox.g.gold, 180);
assert.equal(sandbox.g.towers[0].st[1], 12);
run("applyKingdomPurchase(buyResearch(g.kingdom, 'steel', 0, g.gold))");
assert.equal(sandbox.g.gold, 135);
assert.equal(sandbox.g.towers[0].st[1], 12.96);
run("build(1, 'archer')");
assert.equal(sandbox.g.towers[1].st[1], 12.96);
sandbox.g.gold = 1000;
run('upgrade(0)');
assert.equal(sandbox.g.towers[0].lv, 2);
assert.equal(sandbox.g.towers[0].st[1], 19.44);
run('sell(0)');
assert.equal(sandbox.g.undo.r, 91);
sandbox.g.gold = 0; run('undoSell()');
assert.equal(sandbox.g.gold, 0); assert.equal(sandbox.g.towers[0], undefined);
sandbox.g.gold = 1000; run('undoSell()'); assert.equal(sandbox.g.gold, 909);
assert.equal(sandbox.g.towers[0].st[1], 19.44);

run('newGame()'); sandbox.g.gold = 1000;
run("applyKingdomPurchase(buyResearch(g.kingdom, 'masonry', 0, g.gold))");
assert.equal(sandbox.g.lives, 22);
run("applyKingdomPurchase(buyResearch(g.kingdom, 'wards', 0, g.gold))");
assert.equal(sandbox.g.kingdom.wards, 1);
sandbox.g.kingdom.wards = 0; run('startWave()');
assert.equal(sandbox.g.kingdom.wards, 1);
sandbox.g.paused = true; sandbox.g.phase = 'build'; const wave = sandbox.g.wave;
run('startWave()'); assert.equal(sandbox.g.wave, wave);
sandbox.g.paused = false; sandbox.g.phase = 'wave'; sandbox.g.queue = [];
sandbox.g.enemies = [{ d: { sp: 0, lives: 5 }, type: 'troll', dist: 100001, x: 0, y: 0, walkT: 0, slow: 0, slowT: 0 }];
sandbox.g.remaining = 1; run('step(1/60)');
assert.equal(sandbox.g.lives, 18); assert.equal(sandbox.g.kingdom.wards, 0);
assert.equal(sandbox.g.phase, 'build');
run('newGame()'); sandbox.g.gold = 1000;
run("applyKingdomPurchase(buyResearch(g.kingdom, 'bounty', 0, g.gold))");
const goldBefore = sandbox.g.gold;
run("damage({ hp: 1, d: {gold: 4}, type: 'goblin', x: 0, y: 0 }, 2)");
assert.equal(sandbox.g.gold, goldBefore + 5);
run("applyKingdomPurchase(buyResearch(g.kingdom, 'stipend', 0, g.gold))");
sandbox.g.phase = 'wave'; sandbox.g.wave = 1; sandbox.g.queue = []; sandbox.g.enemies = [];
const beforeClear = sandbox.g.gold; run('step(1/60)');
assert.equal(sandbox.g.gold, beforeClear + 33);
assert.equal(run('clearedWaves()'), 1);
sandbox.g.phase = 'wave'; sandbox.g.wave = 3;
assert.equal(run('clearedWaves()'), 2);
run('newGame()');
assert.deepEqual(JSON.stringify(sandbox.g.kingdom), JSON.stringify(kingdom.newKingdom()));
assert.equal(sandbox.g.lives, 20);
run("g.kingdom.ranks.alchemy = 3; build(0, 'frost')");
const frostEnemy = { hp: 1000, max: 1000, d: {gold: 4}, type: 'goblin', x: 0, y: 0, pend: 6, slow: 0, slowT: 0 };
sandbox.target = frostEnemy;
run('hitProj({t: g.towers[0], tgt: target, dmg: 6, x: 0, y: 0})');
assert.equal(frostEnemy.slow, .35); assert.equal(frostEnemy.slowT, 1.5 * 1.45);
sandbox.g.gold = 1000; run("build(1, 'cannon')");
sandbox.g.enemies = [{ hp: 1000, type: 'orc', d: {gold: 8}, x: .8 * 128, y: 0 }];
run('hitProj({t: g.towers[1], tgt: g.enemies[0], dmg: 0, x: 0, y: 0})');
assert.equal(sandbox.g.enemies[0].hp, 970);
run("build(2, 'tesla')");
sandbox.g.enemies = Array.from({length: 4}, (_, i) => ({ hp: 1000, d: {gold: 4}, type: 'goblin', dist: i, x: i * 30, y: 0 }));
run('fire(g.towers[2])');
assert.equal(sandbox.g.enemies.filter(enemy => enemy.hp < 1000).length, 4);
console.log('Engine integration: research affects existing/new/upgraded towers, gold, sale undo, wards, payouts and run reset');
