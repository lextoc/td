import assert from 'node:assert/strict';
import { STRIDES, newWalk, advanceWalk, walkFrameTime, drawWalking } from '../src/walking.js';
function travel(fps, distance, stride) {
  const walk = newWalk();
  for (let frame = 0; frame < fps; frame++) advanceWalk(walk, distance / fps, 0, 1 / fps, stride);
  return walk;
}
for (const stride of Object.values(STRIDES)) {
  const a = travel(30, stride * .75, stride), b = travel(144, stride * .75, stride);
  assert.ok(Math.abs(a.phase - b.phase) < 1e-10, 'Gait follows distance at any frame rate');
  assert.equal(a.facing, 'right');
  assert.ok(travel(60, stride * .375, stride).phase < a.phase, 'Slowed movement slows footsteps');
}
const walk = travel(60, 100, STRIDES.knight), phase = walk.phase;
advanceWalk(walk, 100, 0, 0, STRIDES.knight);
assert.equal(walk.phase, phase, 'Pause freezes gait');
for (let i = 0; i < 120; i++) advanceWalk(walk, 0, 0, 1/60, STRIDES.knight);
assert.ok(walk.strength < .001, 'Standing settles without restarting the walk cycle');
assert.equal(walk.phase, phase);
const animation = { frames: 8, fps: 10 };
assert.ok(Math.abs(walkFrameTime(walk,animation) * 10 - phase * 8) < 1e-10);
let depth = 0, draws = 0, rotations = 0;
const original = {}, fr = { i: original, sx: 228, sy: 124, sw: 114, sh: 124, ax: 57, ay: 114, frames: 8 };
const context = {
  save(){depth++}, restore(){depth--}, beginPath(){}, ellipse(){}, fill(){}, translate(){}, scale(){}, rotate(angle){if(angle)rotations++},
  drawImage(image,x,y,w,h){assert.equal(image,original);assert.ok(x >= fr.sx && y >= fr.sy);assert.ok(x+w <= fr.sx+fr.sw && y+h <= fr.sy+fr.sh);draws++}
};
walk.strength = 1;
drawWalking(context,fr,walk);
assert.equal(draws,1,'Walking preserves the complete sprite without sliced body parts');assert.equal(depth,0);
rotations=0;draws=0;
drawWalking(context,fr,walk,{reduced:true});
assert.equal(draws,1);assert.equal(rotations,0);assert.equal(depth,0);
console.log('Walking checks passed: distance matching, frame-rate independence, slow/pause/idle, original-art crops and reduced motion');
