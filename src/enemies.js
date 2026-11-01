const clamp = n => Math.max(0, Math.min(1, n));
export function markEnemyHit(enemy) {
  enemy.hpTrail = Math.max(enemy.hpTrail ?? enemy.max ?? enemy.hp, enemy.hp);
  enemy.chipHold = .18; enemy.hurt = .18;
}
export function updateEnemyVisuals(enemy, dt) {
  enemy.age = (enemy.age || 0) + dt;
  enemy.hurt = Math.max(0, (enemy.hurt || 0) - dt);
  enemy.chipHold = Math.max(0, (enemy.chipHold || 0) - dt);
  enemy.hpTrail ??= enemy.max;
  const health = Math.max(0, enemy.hp);
  if (health > enemy.hpTrail) enemy.hpTrail = health;
  else if (!enemy.chipHold) enemy.hpTrail += (health - enemy.hpTrail) * (1 - Math.exp(-dt * 8));
}
export function enemyAppearance(enemy, reduced = false) {
  const arrival = clamp((enemy.age ?? 1) / .22), hit = reduced ? 0 : Math.sin(clamp((enemy.hurt || 0) / .18) * Math.PI);
  return { alpha: arrival, scale: reduced ? 1 : .96 + arrival * .04, tilt: reduced ? 0 : hit * (enemy.face === 'left' ? .035 : -.035) / (enemy.d.boss ? 2 : 1) };
}
export function enemyHealth(enemy, cameraScale = 1) {
  const boss = !!enemy.d.boss;
  return { width: Math.max(boss ? 100 : 48, (boss ? 65 : 28) / Math.max(.1,cameraScale)), height: Math.max(boss ? 9 : 6, 4 / Math.max(.1,cameraScale)),
    fraction: clamp(enemy.hp / enemy.max), trail: clamp((enemy.hpTrail ?? enemy.hp) / enemy.max), boss };
}
export function drawEnemyGround(c, enemy, reduced = false) {
  const boss = enemy.d.boss, radius = boss ? 42 : enemy.type === 'goblin' ? 18 : 25;
  c.save(); c.fillStyle = '#172016'; c.globalAlpha = .18;
  c.beginPath(); c.ellipse(0,0,radius,radius*.25,0,0,Math.PI*2); c.fill(); c.globalAlpha = 1;
  if (boss) {
    c.strokeStyle = '#9d4839'; c.globalAlpha = .45; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0,0,radius+8,15,0,0,Math.PI*2); c.stroke();
  }
  if (enemy.slowT > 0) {
    c.globalAlpha = .8; c.strokeStyle = '#d2f6ff'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(0,0,radius+4,8,0,0,Math.PI*2); c.stroke();
    for(let i=0;i<3;i++){
      const phase = reduced ? 0 : Math.sin((enemy.age || 0)*3+i)*2;
      const x = (i-1)*radius*.65, y = -8 - i%2*5 + phase;
      c.beginPath(); c.moveTo(x-3,y);c.lineTo(x+3,y);c.moveTo(x,y-4);c.lineTo(x,y+4);c.stroke();
    }
  }
  c.restore();
}
