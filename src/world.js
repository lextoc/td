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

export function createWorld(parent, { images, terrain, knight, displayFont, skin, start, help, settings }) {
  const root = document.createElement('div'); root.className = 'world-menu'; parent.append(root);
  const canvas = document.createElement('canvas'); canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Explore the kingdom. Use WASD or arrow keys to walk, or tap a destination.'); root.append(canvas);
  const top = document.createElement('header'); top.innerHTML = '<strong>THE KINGDOM</strong><span>Choose a road. Defend its castle.</span>'; top.style.cssText = skin.panel; root.append(top);
  const tools = document.createElement('nav'); tools.setAttribute('aria-label', 'Kingdom menu'); top.append(tools);
  const button = (p, text, fn) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = skin.button; b.onclick = fn; p.append(b); return b; };
  button(tools, 'How to play', help); button(tools, 'Settings', settings);
  const card = document.createElement('section'); card.className = 'world-road'; card.style.cssText = skin.panel; root.append(card);
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
  const tile = terrain.grid, cols = 15, rows = 12;
  const hash = (x, y) => { let n = Math.imul(x + 173, 374761393) ^ Math.imul(y + 97, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return (n ^ n >>> 16) >>> 0; };
  const roads = new Set(), props = [];
  const cell = (x, y) => `${x},${y}`, isRoad = (x, y) => roads.has(cell(x, y));
  for (const road of ROADS) {
    let x = 7, y = 5; const endX = Math.floor(road.x / tile), endY = Math.floor((road.y + 95) / tile);
    roads.add(cell(x, y));
    while (x !== endX) { x += Math.sign(endX - x); roads.add(cell(x, y)); }
    while (y !== endY) { y += Math.sign(endY - y); roads.add(cell(x, y)); }
    props.push({ name: 'castle', x: road.x, y: road.y + 55 });
    props.push({ name: 'signpost', x: endX * tile + 108, y: endY * tile + 100 });
  }
  const ground = document.createElement('canvas'); ground.width = cols * tile; ground.height = rows * tile;
  const gc = ground.getContext('2d'); gc.imageSmoothingQuality = 'high';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const im = images[terrain.grass[hash(x, y) % terrain.grass.length]];
    if (im) gc.drawImage(im, x * tile - .5, y * tile - .5, tile + 1, tile + 1);
  }
  for (let i = 0; i < cols * rows / terrain.overlayPerCells; i++) {
    const im = images[terrain.overlays[i % terrain.overlays.length]];
    if (im) gc.drawImage(im, hash(i, 1) % ground.width - 64, hash(i, 2) % ground.height - 64, 256, 256);
  }
  for (const key of roads) {
    const [x, y] = key.split(',').map(Number);
    const mask = (isRoad(x,y-1) ? 1 : 0) | (isRoad(x+1,y) ? 2 : 0) | (isRoad(x,y+1) ? 4 : 0) | (isRoad(x-1,y) ? 8 : 0);
    const im = images[terrain.path[mask]];
    if (im) gc.drawImage(im, x * tile - .5, y * tile - .5, tile + 1, tile + 1);
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x * tile + 30 + hash(x,y) % 68, py = y * tile + 50 + hash(y,x) % 62;
    if (isRoad(x,y) || ROADS.some(r => Math.abs(px-r.x)<245 && Math.abs(py-r.y)<250) || Math.hypot(px-900,py-700)<130) continue;
    const choices = hash(x,y) % 3 ? terrain.scatter.mid : terrain.scatter.edgeTrees;
    props.push({ name: choices[hash(y,x) % choices.length], x: px, y: py });
    props.push({ name: terrain.scatter.decals[hash(x+1,y) % terrain.scatter.decals.length], x: px + 35, y: py + 25, flat: true });
  }
  function prop({ name, x, y }) {
    const def = terrain.props[name], im = def && images[def.image];
    if (im) c.drawImage(im, x - def.anchor[0], y - def.anchor[1], ...def.size);
  }
  let walkTime = 0, facing = 'down';
  function drawHero() {
    const im = images[knight.sheet]; if (!im) return;
    const frame = Math.floor(walkTime * knight.fps) % knight.frames, row = knight.rows?.[facing] ?? 0;
    c.drawImage(im, frame * knight.frameWidth, row * knight.frameHeight, knight.frameWidth, knight.frameHeight,
      hero.x - knight.anchorPx[0], hero.y - knight.anchorPx[1], knight.frameWidth, knight.frameHeight);
  }
  function frame(now) {
    if (!alive || !root.isConnected) { destroy(); return; }
    const dt = parent.querySelector('.modal') ? 0 : Math.min(.05, (now - (last || now)) / 1000); last = now;
    let dx = (+keys.has('d') + +keys.has('arrowright')) - (+keys.has('a') + +keys.has('arrowleft')), dy = (+keys.has('s') + +keys.has('arrowdown')) - (+keys.has('w') + +keys.has('arrowup'));
    if (dx || dy) { const n = Math.hypot(dx, dy); hero.x += dx / n * 300 * dt; hero.y += dy / n * 300 * dt; Object.assign(target, hero); }
    else { dx = target.x - hero.x; dy = target.y - hero.y; const n = Math.hypot(dx, dy), step = Math.min(n, 360 * dt); if (n) { hero.x += dx / n * step; hero.y += dy / n * step; } }
    if (Math.hypot(dx,dy) > 1) { walkTime += dt; facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); } else walkTime = 0;
    hero.x = Math.max(45, Math.min(1755, hero.x)); hero.y = Math.max(120, Math.min(1350, hero.y));
    near = ROADS.find(r => Math.hypot(hero.x - r.x, hero.y - r.y - 95) < 160) || null;
    if (previous !== (near?.id || '')) { previous = near?.id || ''; title.textContent = near ? `${near.name} · ${near.difficulty}` : 'Your next defense awaits'; detail.textContent = near ? near.description : 'Walk to a castle or choose a destination below.'; enter.disabled = !near; enter.textContent = near?.id === 'endless' ? 'Survive endless waves' : 'Defend castle'; }
    const w = root.clientWidth, h = root.clientHeight, dpr = (devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    scale = Math.max(w / 1800, h / 1450, .55); ox = Math.max(w - 1800 * scale, Math.min(0, w / 2 - hero.x * scale)); oy = Math.max(h - 1450 * scale, Math.min(0, h * .48 - hero.y * scale));
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#619849'; c.fillRect(0, 0, w, h); c.translate(ox, oy); c.scale(scale, scale);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(ground, 0, 0);
    props.filter(p => p.flat).forEach(prop);
    const upright = props.filter(p => !p.flat).map(p => ({ y: p.y, draw: () => prop(p) }));
    upright.push({ y: hero.y, draw: drawHero });
    upright.sort((a,b) => a.y-b.y).forEach(p => p.draw());
    ROADS.forEach(r => {
      c.textAlign = 'center'; c.font = `25px "${displayFont}", sans-serif`; c.lineWidth = 5; c.strokeStyle = '#302014';
      c.strokeText(r.name,r.x,r.y-265); c.fillStyle = r === near ? '#ffe294' : '#fff2cb'; c.fillText(r.name,r.x,r.y-265);
      c.font = `21px "${displayFont}", sans-serif`; c.strokeText(r.difficulty,r.x,r.y-237); c.fillText(r.difficulty,r.x,r.y-237);
    });
    raf = requestAnimationFrame(frame);
  }
  title.textContent = 'Your next defense awaits'; detail.textContent = 'Walk to a castle or choose a destination below.'; enter.disabled = true;
  raf = requestAnimationFrame(frame); canvas.focus(); return destroy;
}
