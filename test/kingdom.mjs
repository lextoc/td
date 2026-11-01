import assert from 'node:assert/strict';
import { RESEARCH, DOCTRINES, newKingdom, modifiers, towerStats, researchOffer, buyResearch, chooseDoctrine, doctrineOffer, killReward, waveReward, sellValue, absorbLeak, buyRepair } from '../src/kingdom.js';

const fresh = newKingdom(), base = [70, 12, 1.25, 2.5];
assert.deepEqual(towerStats(base, fresh), base);
assert.equal(buyResearch(fresh, 'steel', 0, 44), null);
assert.equal(buyResearch(fresh, 'drill', 0, 1000), null);
assert.equal(buyResearch(fresh, 'unknown', 10, 1000), null);
let purchase = buyResearch(fresh, 'steel', 0, 45);
assert.equal(purchase.gold, 0);
assert.equal(purchase.state.ranks.steel, 1);
assert.deepEqual(fresh, newKingdom());
assert.equal(buyResearch(purchase.state, 'steel', 2, 1000), null);
purchase = buyResearch(purchase.state, 'steel', 3, 1000);
assert.equal(purchase.state.ranks.steel, 2);
assert.equal(buyResearch(purchase.state, 'steel', 5, 1000), null);
purchase = buyResearch(purchase.state, 'steel', 6, 1000);
assert.equal(purchase.state.ranks.steel, 3);
assert.equal(buyResearch(purchase.state, 'steel', 10, 1000), null);
assert.equal(researchOffer(purchase.state, 'steel', 10, 1000).reason, 'Fully researched');
assert.ok(Math.abs(towerStats(base, purchase.state)[1] - 14.88) < 1e-9);
assert.deepEqual(towerStats(base, purchase.state), towerStats(base, purchase.state));
assert.deepEqual(base, [70, 12, 1.25, 2.5]);

let state = newKingdom(), gold = 10000, spent = 0;
for (const research of RESEARCH) for (let rank = 0; rank < 3; rank++) {
  const before = JSON.stringify(state), result = buyResearch(state, research.id, 6, gold);
  assert.ok(result); assert.equal(JSON.stringify(state), before);
  spent += research.costs[rank]; state = result.state; gold = result.gold;
}
assert.equal(gold, 10000 - spent); assert.equal(state.spent, spent);
assert.equal(modifiers(state).maxLives, 26); assert.equal(modifiers(state).wards, 3);
assert.equal(modifiers(state).chain, 1); assert.equal(modifiers(state).slowDuration, 1.45);
assert.equal(modifiers(state).splash, 1.15);
assert.equal(killReward(4, state), 7); assert.equal(waveReward(1, state), 49);
assert.equal(sellValue(70, state), 59);
assert.equal(chooseDoctrine(newKingdom(), 'conquest', 6, 1000), null);
assert.equal(chooseDoctrine(state, 'conquest', 4, 1000), null);
assert.equal(chooseDoctrine(state, 'conquest', 6, 119), null);
assert.equal(chooseDoctrine(state, 'bogus', 6, 1000), null);
for (const doctrine of DOCTRINES) {
  const result = chooseDoctrine(state, doctrine.id, 5, 120);
  assert.equal(result.gold, 0); assert.equal(result.state.doctrine, doctrine.id);
  assert.equal(chooseDoctrine(result.state, 'commerce', 10, 1000), null);
  assert.equal(doctrineOffer(result.state, 10, 1000).ok, false);
}
const conquest = chooseDoctrine(state, 'conquest', 5, 120).state;
assert.equal(killReward(4, conquest), 5);
assert.equal(waveReward(1, chooseDoctrine(state, 'commerce', 5, 120).state), 61);
const bastion = chooseDoctrine(state, 'bastion', 5, 120);
assert.equal(bastion.heal, 4); assert.equal(modifiers(bastion.state).maxLives, 30);
let leak = absorbLeak({ ...state, wards: 3 }, 5);
assert.equal(leak.lost, 2); assert.equal(leak.absorbed, 3); assert.equal(leak.state.wards, 0);
leak = absorbLeak(leak.state, 1); assert.equal(leak.lost, 1);
assert.equal(absorbLeak({ ...state, wards: 3 }, 1).state.wards, 2);
assert.equal(buyRepair(state, 26, 1000), null);
assert.equal(buyRepair(state, 10, 34), null);
const repair = buyRepair(state, 25, 35);
assert.equal(repair.lives, 26); assert.equal(repair.gold, 0); assert.equal(repair.state.repairs, 1);
assert.equal(buyResearch(newKingdom(), 'masonry', 0, 45).heal, 2);
assert.equal(buyResearch({ ...fresh, ranks: { masonry: 1 } }, 'wards', 0, 45).state.wards, 1);
console.log('Kingdom research, economy, doctrines, wards and repair checks passed');
