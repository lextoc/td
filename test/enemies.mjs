import assert from 'node:assert/strict';
import { markEnemyHit, updateEnemyVisuals, enemyAppearance, enemyHealth } from '../src/enemies.js';
const enemy={hp:100,max:100,d:{boss:false},face:'right'};
markEnemyHit(enemy);enemy.hp=60;
updateEnemyVisuals(enemy,.1);assert.equal(enemy.hpTrail,100,'Damage chip holds briefly');
for(let i=0;i<120;i++)updateEnemyVisuals(enemy,1/60);
assert.ok(enemy.hpTrail>=60&&enemy.hpTrail<61);
assert.equal(enemy.hp,60,'Presentation never changes health');
const a=enemyHealth(enemy,.5),b=enemyHealth({...enemy,d:{boss:true}},.5);
assert.ok(a.width*.5>=28);assert.ok(b.width>a.width);assert.equal(a.fraction,.6);
assert.deepEqual(enemyAppearance({...enemy,age:1,hurt:.09},true),{alpha:1,scale:1,tilt:0});
assert.equal(enemyAppearance({...enemy,age:0}).alpha,0);
assert.equal(enemyAppearance({...enemy,age:1}).alpha,1);
for(let i=0;i<100;i++){const health=enemyHealth({...enemy,hp:i-10,hpTrail:200},.2);assert.ok(health.fraction>=0&&health.fraction<=1);assert.ok(health.trail<=1)}
console.log('Enemy presentation checks passed: damage trails, health preservation, mobile bar sizing, boss distinction, spawn fade and reduced motion');
