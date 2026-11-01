const TAU = Math.PI * 2;
export function extractHighlights(pixels) {
  for (let i = 0; i < pixels.length; i += 4) {
    const light = (.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]) / 255;
    const t = Math.max(0, Math.min(1, (light - .59) / .33));
    pixels[i + 3] = Math.round(pixels[i + 3] * t * t * (3 - 2 * t));
  }
}

export function createAtmosphere(random = Math.random) {
  let highlights, highlightContext, countdown = 7 + random() * 7, clock = 0, bloomClock = 1;
  const birds = [];
  function update(dt, width, height, enabled) {
    if (!enabled) { birds.length = 0; return; }
    if (dt <= 0) return;
    clock += dt; countdown -= dt;
    if (countdown <= 0) {
      countdown = 19 + random() * 24;
      const direction = random() < .5 ? 1 : -1, y = .2 + random() * .42;
      const count = 2 + Math.floor(random() * 4), speed = 65 + random() * 30;
      for (let i = 0; i < count; i++) birds.push({
        x: direction > 0 ? -60 - i * 22 : width + 60 + i * 22,
        y: y * height + (i % 2 ? 1 : -1) * i * 13,
        direction, speed: speed + random() * 5, phase: random() * TAU, size: 4 + random() * 2.5,
        glide: random() * 5, age: 0
      });
    }
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i]; b.age += dt; b.x += b.direction * b.speed * dt; b.y -= dt * 8;
      if (b.age > 40 || (b.direction > 0 ? b.x > width + 200 : b.x < -200)) birds.splice(i,1);
    }
  }
  function drawBird(c, b, shadow = false) {
    const gliding = Math.sin(clock * .7 + b.glide) > .55;
    const flap = gliding ? .25 : Math.sin(clock * 9 + b.phase);
    c.save(); c.translate(b.x + (shadow ? 25 : 0), b.y + (shadow ? 90 : 0));
    c.scale(b.direction, shadow ? .45 : 1); c.rotate(-.12);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = shadow ? 2.8 : 1.8;
    c.strokeStyle = shadow ? '#172016' : '#38413a'; c.globalAlpha = shadow ? .1 : .8;
    const wing = b.size * (1.2 + Math.abs(flap) * .55), lift = flap * b.size * .75;
    c.beginPath(); c.moveTo(-wing, lift); c.quadraticCurveTo(-wing * .4, -2, 0, 1);
    c.quadraticCurveTo(wing * .4, -2, wing, lift); c.stroke();
    if (!shadow) { c.lineWidth = 2.2; c.beginPath(); c.moveTo(0,-2); c.lineTo(0,3); c.stroke(); }
    c.restore();
  }
  function draw(c, canvas, { dt = 0, dpr = 1, bloom = true, wildlife = true, reduced = false } = {}) {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    if (!w || !h) return;
    update(Math.min(.1, dt), w, h, wildlife && !reduced);
    c.save(); c.setTransform(dpr,0,0,dpr,0,0);
    if (bloom) {
      if (!highlights) { highlights = document.createElement('canvas'); highlightContext = highlights.getContext('2d', { willReadFrequently: true }); }
      const factor = Math.min(1, 256 / Math.max(w,h)), sw = Math.max(1, Math.round(w * factor)), sh = Math.max(1, Math.round(h * factor));
      bloomClock += dt;
      if (highlights.width !== sw || highlights.height !== sh || bloomClock >= 1/24) {
        highlights.width = sw; highlights.height = sh;
        highlightContext.drawImage(canvas, 0,0,sw,sh);
        const pixels = highlightContext.getImageData(0,0,sw,sh); extractHighlights(pixels.data); highlightContext.putImageData(pixels,0,0); bloomClock = 0;
      }
      c.globalCompositeOperation = 'screen'; c.imageSmoothingEnabled = true;
      if ('filter' in c) {
        c.globalAlpha = .18; c.filter = `blur(${9 * dpr}px)`; c.drawImage(highlights,0,0,w,h);
        c.globalAlpha = .08; c.filter = `blur(${23 * dpr}px)`; c.drawImage(highlights,0,0,w,h); c.filter = 'none';
      } else {
        c.globalAlpha = .026;
        for (let i=0;i<8;i++) { const a = i * TAU/8; c.drawImage(highlights,Math.cos(a)*7,Math.sin(a)*7,w,h); }
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      const sunlight = c.createRadialGradient(w*.28,h*.1,0,w*.28,h*.1,Math.max(w,h)*.85);
      sunlight.addColorStop(0,'rgba(255,218,151,.055)'); sunlight.addColorStop(1,'rgba(255,218,151,0)');
      c.fillStyle = sunlight; c.fillRect(0,0,w,h);
    }
    for (const b of birds) drawBird(c,b,true);
    for (const b of birds) drawBird(c,b);
    c.restore();
  }
  return { draw, reset() { birds.length = 0; countdown = 7 + random()*7; clock = 0; bloomClock = 1; }, get birdCount() { return birds.length; } };
}
