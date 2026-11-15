/* Decorative pixel-art sky. These cinematic scenes are illustrations, not
 * astronomical observations or a simulation of stellar lifetimes. No assets
 * or network requests. Each event lasts 12–18 seconds, then is discarded. */
const cosmicBackground = (() => {
  const canvas = document.querySelector('#cosmic-background'), ctx = canvas.getContext('2d');
  const control = document.querySelector('#cosmic-toggle');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 1, height = 1, frame = 0, last = 0, clock = 0, nextScene = 7;
  let paused = false, scene = null, lastKind = -1;
  const stars = Array.from({ length: 155 }, () => ({ x: Math.random(), y: Math.random(), depth: .25 + Math.random(), glow: Math.random(), phase: Math.random() * Math.PI * 2 }));
  function resize() {
    // A small rendering surface deliberately preserves the pixel-art grain.
    width = Math.ceil(innerWidth / 2); height = Math.ceil(innerHeight / 2);
    canvas.width = width; canvas.height = height; draw();
  }
  function createScene(kind = (lastKind + 1 + Math.floor(Math.random() * 2)) % 3) {
    lastKind = kind;
    scene = { kind, started: clock, duration: [12, 16, 18][kind], x: (.12 + Math.random() * .76) * width,
      y: (.14 + Math.random() * .66) * height, radius: Math.min(width, height) * (.13 + Math.random() * .07),
      particles: Array.from({ length: kind === 1 ? 150 : 90 }, () => ({ a: Math.random() * Math.PI * 2, speed: .3 + Math.random() * .7, size: 1 + Math.floor(Math.random() * 2) })) };
  }
  function glow(x, y, radius, color, opacity) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = opacity; ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.globalAlpha = 1;
  }
  function drawScene() {
    if (!scene) return;
    const t = (clock - scene.started) / scene.duration;
    if (t >= 1) { scene = null; nextScene = clock + 8 + Math.random() * 12; return; }
    const { x, y, radius: r, kind, particles } = scene;
    const fade = Math.min(1, t * 5) * Math.min(1, (1 - t) * 4);
    if (kind === 2) {
      // Inward spiral, accretion glow, dark center, then a gentle fade.
      const collapse = Math.min(1, t * 3), hole = r * .3 * collapse;
      glow(x, y, r * 1.4, '#7662d4', fade * .22);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.35);
      for (let ring = 0; ring < 7; ring++) {
        ctx.globalAlpha = fade * (.16 - ring * .015); ctx.strokeStyle = ring % 2 ? '#94b7ff' : '#ca99e8';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, hole + ring * 4 + 5, (hole + ring * 4 + 5) * .36, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = fade; ctx.fillStyle = '#030611'; ctx.beginPath(); ctx.arc(0, 0, hole, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.globalAlpha = fade * .55; ctx.fillStyle = '#c7bbff';
      for (const p of particles) {
        const orbit = hole + ((p.speed * r * 1.4 - t * r * .8 + r * 2) % (r * 1.3));
        const angle = p.a + t * 7 / p.speed;
        ctx.fillRect(Math.round(x + Math.cos(angle) * orbit), Math.round(y + Math.sin(angle) * orbit * .48), 1, 1);
      }
    } else {
      // A swelling star becomes a slow expanding shell; no white-screen flash.
      const expansion = Math.max(0, (t - .18) / .82), core = Math.max(2, r * .13 * (1 - expansion));
      glow(x, y, core * (3 + Math.sin(t * 6)), kind === 0 ? '#addcff' : '#e0a4e8', fade * .58);
      if (expansion > 0) {
        const shell = r * expansion * (kind === 1 ? 1.9 : 1.3);
        glow(x, y, shell * 1.4, kind === 0 ? '#3f79c0' : '#843fab', fade * .2);
        ctx.globalAlpha = fade * (1 - expansion) * .5; ctx.strokeStyle = kind === 0 ? '#77c5e8' : '#d8a7ed';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, shell, 0, Math.PI * 2); ctx.stroke();
        for (const p of particles) {
          const distance = shell * p.speed, angle = p.a + t * .1;
          ctx.fillStyle = p.speed > .65 ? '#a6c4f3' : '#b18bdf'; ctx.globalAlpha = fade * .5;
          ctx.fillRect(Math.round(x + Math.cos(angle) * distance), Math.round(y + Math.sin(angle) * distance), p.size, p.size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      const x = (star.x * width + clock * star.depth * 1.8) % width;
      const y = (star.y * height + clock * star.depth * .45) % height;
      ctx.fillStyle = star.glow > .8 ? '#c2c9e8' : '#7383b5';
      ctx.globalAlpha = .28 + star.glow * .32 + Math.sin(clock * .3 + star.phase) * .08;
      ctx.fillRect(Math.floor(x), Math.floor(y), star.glow > .95 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1; drawScene();
  }
  function tick(now) {
    // Apply the visual state before stopping the loop. Some browsers update
    // matches during animation sampling before dispatching the change event.
    if (motion.matches) { sync(); return; }
    if (paused || document.hidden) { frame = 0; last = 0; return; }
    if (now - last >= 32) {
      clock += last ? Math.min((now - last) / 1000, .1) : 0; last = now;
      if (!scene && clock >= nextScene) createScene();
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (motion.matches) { scene = null; canvas.hidden = true; }
    else { canvas.hidden = false; draw(); }
    control.textContent = motion.matches ? 'Background motion off' : paused ? 'Play background' : 'Pause background';
    control.disabled = motion.matches; control.setAttribute('aria-pressed', String(paused || motion.matches));
    if (!paused && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  control.onclick = () => { paused = !paused; sync(); };
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync);
  resize(); sync();
  return { get activeScene() { return scene ? { kind: scene.kind, duration: scene.duration, elapsed: clock - scene.started } : null; }, get paused() { return paused || motion.matches; } };
})();
