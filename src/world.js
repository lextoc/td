export const ROADS = [
  { id: 'easy', name: 'Willow Keep', difficulty: 'Easy', x: 360, y: 340, hp: .75, speed: .9, gold: 300, description: 'A gentle woodland road. Weaker, slower enemies and 300 starting gold.' },
  { id: 'normal', name: 'Crownwatch', difficulty: 'Normal', x: 1280, y: 280, hp: 1, speed: 1, gold: 250, description: 'The original ten-wave defense. 250 starting gold.' },
  { id: 'hard', name: 'Ironthorn', difficulty: 'Hard', x: 1530, y: 1040, hp: 1.4, speed: 1.12, gold: 225, description: 'A brutal frontier road. Stronger, faster enemies and 225 starting gold.' },
  { id: 'endless', name: 'The Last Gate', difficulty: 'Endless', x: 390, y: 1120, hp: 1, speed: 1, gold: 250, description: 'No final wave. Hordes grow stronger forever, with a Troll every tenth wave.' }
];
export function waveFor(wave, base, endless = false) {
  const original = base[(wave - 1) % base.length];
  if (!endless || wave <= base.length) return original;
  const cycle = Math.floor((wave - 1) / base.length);
  return [original[0].map(([type, count]) => [type, type === 'troll' ? Math.min(5, cycle + 1) : Math.ceil(count * (1 + cycle * .25))]), Math.max(.28, original[1] / (1 + cycle * .12))];
}

export function createWorld(parent, { images, start, help, settings }) {
  const root = document.createElement('div'); root.className = 'world-menu'; parent.append(root);
  const canvas = document.createElement('canvas'); canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Explore the kingdom. Use WASD or arrow keys to walk, or tap a destination.'); root.append(canvas);
  const top = document.createElement('header'); top.innerHTML = '<strong>THE KINGDOM</strong><span>Choose a road. Defend its castle.</span>'; root.append(top);
  const tools = document.createElement('nav'); tools.setAttribute('aria-label', 'Kingdom menu'); top.append(tools);
  const button = (p, text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; p.append(b); return b; };
  button(tools, 'How to play', help); button(tools, 'Settings', settings);
  const card = document.createElement('section'); card.className = 'world-road'; root.append(card);
  const title = document.createElement('h2'), detail = document.createElement('p'); card.append(title, detail);
  const enter = button(card, 'Defend castle', () => { if (near) { destroy(); start(near); } });
  const destinations = document.createElement('nav'); destinations.className = 'world-destinations'; destinations.setAttribute('aria-label', 'Travel to a castle'); root.append(destinations);
  const hero = { x: 900, y: 700 }, target = { ...hero }, keys = new Set(); let near = null, previous = '', alive = true, raf, last = 0;
  ROADS.forEach(road => button(destinations, `${road.name} · ${road.difficulty}`, () => { target.x = road.x; target.y = road.y + 95; canvas.focus(); }));
  const hint = document.createElement('div'); hint.className = 'world-hint'; hint.textContent = 'Tap to walk · WASD / arrows · Enter to defend'; root.append(hint);
  const c = canvas.getContext('2d'); let scale = 1, ox = 0, oy = 0;
  function pointer(e) { const r = canvas.getBoundingClientRect(); target.x = Math.max(45, Math.min(1755, (e.clientX - r.left - ox) / scale)); target.y = Math.max(120, Math.min(1350, (e.clientY - r.top - oy) / scale)); canvas.focus(); }
  canvas.addEventListener('pointerdown', pointer);
  function down(e) { if (!root.isConnected || parent.querySelector('.modal') || e.target.tagName === 'BUTTON') return; const k = e.key.toLowerCase(); if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)) { e.preventDefault(); keys.add(k); } if (k === 'enter' && near) enter.click(); }
  const up = e => keys.delete(e.key.toLowerCase()), blur = () => keys.clear();
  addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
  function destroy() { alive = false; cancelAnimationFrame(raf); removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); root.remove(); }
  function sprite(key, x, y, w, h) { const im = images[key]; if (im) c.drawImage(im, x - w / 2, y - h, w, h); }
  function frame(now) {
    if (!alive || !root.isConnected) { destroy(); return; }
    const dt = parent.querySelector('.modal') ? 0 : Math.min(.05, (now - (last || now)) / 1000); last = now;
    let dx = (+keys.has('d') + +keys.has('arrowright')) - (+keys.has('a') + +keys.has('arrowleft')), dy = (+keys.has('s') + +keys.has('arrowdown')) - (+keys.has('w') + +keys.has('arrowup'));
    if (dx || dy) { const n = Math.hypot(dx, dy); hero.x += dx / n * 300 * dt; hero.y += dy / n * 300 * dt; Object.assign(target, hero); }
    else { dx = target.x - hero.x; dy = target.y - hero.y; const n = Math.hypot(dx, dy), step = Math.min(n, 360 * dt); if (n) { hero.x += dx / n * step; hero.y += dy / n * step; } }
    hero.x = Math.max(45, Math.min(1755, hero.x)); hero.y = Math.max(120, Math.min(1350, hero.y));
    near = ROADS.find(r => Math.hypot(hero.x - r.x, hero.y - r.y - 95) < 160) || null;
    if (previous !== (near?.id || '')) { previous = near?.id || ''; title.textContent = near ? `${near.name} · ${near.difficulty}` : 'Your next defense awaits'; detail.textContent = near ? near.description : 'Walk to a castle or choose a destination below.'; enter.disabled = !near; enter.textContent = near?.id === 'endless' ? 'Survive endless waves' : 'Defend castle'; }
    const w = root.clientWidth, h = root.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    scale = Math.max(w / 1800, h / 1450, .55); ox = Math.max(w - 1800 * scale, Math.min(0, w / 2 - hero.x * scale)); oy = Math.max(h - 1450 * scale, Math.min(0, h * .48 - hero.y * scale));
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#619849'; c.fillRect(0, 0, w, h); c.translate(ox, oy); c.scale(scale, scale);
    for (let y = 0; y < 1500; y += 128) for (let x = 0; x < 1900; x += 128) { const im = images['grass_' + ((x / 128 + y / 128) % 3)] || images.t_grass_0; if (im) c.drawImage(im, x, y, 128, 128); }
    c.lineCap = 'round'; ROADS.forEach(r => { c.beginPath(); c.moveTo(900, 700); c.quadraticCurveTo(r.x, 700, r.x, r.y + 90); c.strokeStyle = '#73583a'; c.lineWidth = 76; c.stroke(); c.strokeStyle = '#c6ad70'; c.lineWidth = 60; c.stroke(); });
    for (let i = 0; i < 65; i++) { const x = (i * 373 + 90) % 1760, y = (i * 211 + 170) % 1400; if (ROADS.some(r => Math.hypot(x-r.x,y-r.y) < 240) || Math.hypot(x-900,y-700)<200) continue; sprite('p_tree_oak',x,y,105,140); }
    ROADS.forEach(r => { c.fillStyle = r === near ? '#ffe4a0' : '#edd8a3'; c.beginPath(); c.ellipse(r.x,r.y+45,130,45,0,0,Math.PI*2); c.fill(); sprite('p_castle',r.x,r.y+55,260,230); c.textAlign = 'center'; c.font = 'bold 25px sans-serif'; c.lineWidth = 5; c.strokeStyle = '#223421'; c.strokeText(r.name,r.x,r.y-195); c.fillStyle = '#fff2cb'; c.fillText(r.name,r.x,r.y-195); c.font = 'bold 21px sans-serif'; c.strokeText(r.difficulty,r.x,r.y-165); c.fillText(r.difficulty,r.x,r.y-165); });
    c.fillStyle = '#0005'; c.beginPath(); c.ellipse(hero.x,hero.y+5,20,8,0,0,7); c.fill(); c.fillStyle = '#3159ae'; c.beginPath(); c.arc(hero.x,hero.y-12,18,0,7); c.fill(); c.fillStyle = '#ffe0ab'; c.beginPath(); c.arc(hero.x,hero.y-34,11,0,7); c.fill(); c.strokeStyle = '#fff2ba'; c.lineWidth = 3; c.stroke();
    raf = requestAnimationFrame(frame);
  }
  title.textContent = 'Your next defense awaits'; detail.textContent = 'Walk to a castle or choose a destination below.'; enter.disabled = true;
  raf = requestAnimationFrame(frame); canvas.focus(); return destroy;
}
