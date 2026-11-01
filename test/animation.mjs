import assert from 'node:assert/strict';
import { animationFrame, attackPose, deathOpacity, effectPose, projectileLift } from '../src/animation.js';
const loop = { frames: 8, fps: 10 }, once = {...loop,loop:false};
assert.equal(animationFrame(loop,-1),0);
assert.equal(animationFrame(loop,.8),0);
assert.equal(animationFrame(once,10),7);
assert.equal(animationFrame({frames:1},100),0);
for(let i=0;i<=100;i++){
 const t=i/100;
 for(const type of ['archer','cannon','mage','frost','tesla']){
  const pose=attackPose(t,type);
  assert.ok(pose.x > .9 && pose.x < 1.1 && pose.y > .9 && pose.y < 1.1,'Recoil preserves sprite proportions');
  assert.deepEqual(attackPose(t,type,true),{x:1,y:1,offset:0});
 }
 assert.ok(deathOpacity(t)>=0 && deathOpacity(t)<=1);
 assert.ok(effectPose(t).alpha>=0 && effectPose(t).alpha<=1);
 assert.equal(effectPose(t,true).scale,1);
 assert.ok(projectileLift('cannon',t)>=0 && projectileLift('cannon',t)<=38);
 assert.equal(projectileLift('cannon',t,true),0);
 assert.equal(projectileLift('archer',t),0);
}
assert.equal(deathOpacity(0),1);assert.equal(deathOpacity(.72),1);assert.equal(deathOpacity(1),0);
assert.equal(effectPose(1).alpha,0);
assert.equal(projectileLift('cannon',0),0);assert.equal(projectileLift('cannon',1),0);
console.log('Animation checks passed: one-shot/loop timing, bounded recoil, complete fades, cannon arcs and reduced motion');
