/* Open-world flight: camera follows the ship; the solar system never scrolls
 * on rails. Every planet position comes from orbitalPosition() in core.js. */
function createSolarFlight(mission, initialState, onFinish, onSave) {
  const canvas = document.querySelector('#flight'), c = canvas.getContext('2d');
  const container = document.querySelector('#flight-container');
  const state = clone(initialState), stats = engineering(mission.parts);
  const input = { thrust: false, left: false, right: false, brake: false, boost: false };
  state.hazards ||= []; state.hazardClock ||= 0;
  const bindings = new AbortController(), signal = bindings.signal;
  let paused = true, ended = false, destroyed = false;
  const map = false;
  let width = 1000, height = 600, dpr = 1, animation = 0, lastTime = 0, saveTimer = 0;
  let trail = [], trailTimer = 0, flash = 0;
  const outerMission = NASA_ORRERY_DATA[mission.target].sma > 3;
  const orbitPaths = Object.entries(NASA_ORRERY_DATA).map(([name, data]) => ({ name,
    points: Array.from({ length: 181 }, (_, i) => orbitalPosition(name, i / 180 * data.period)) }));
  // Seeded, reproducible schematic asteroid belt. No individual asteroid claim.
  let seed = 431;
  function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
  const belt = Array.from({ length: 2400 }, () => {
    const angle = random() * TAU, r = (GAME_RULES.beltInnerAU + random() * (GAME_RULES.beltOuterAU - GAME_RULES.beltInnerAU)) * GAME_RULES.auScale;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, r: 20 + random() * 45, shade: random() };
  });
  const starfield = Array.from({ length: 230 }, () => ({ x: random(), y: random(), bright: random(), depth: 0.025 + random() * 0.12 }));

  function resize() {
    const bounds = container.getBoundingClientRect();
    width = bounds.width; height = bounds.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    c.imageSmoothingEnabled = false;
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();

  function syncPause() {
    document.querySelector('#flight-overlay').hidden = !paused;
    document.querySelector('#pause').textContent = 'Pause Ⅱ';
    document.querySelector('#pause').setAttribute('aria-pressed', String(paused));
    document.querySelector('.flight-brief h2').textContent = state.elapsed > 0 ? 'Flight paused.' : 'Ready for launch?';
    document.querySelector('#start-flight').firstChild.textContent = state.elapsed > 0 ? 'Resume mission ' : 'Take flight ';
  }
  function pause() {
    if (destroyed) return;
    paused = true; clearInput(); syncPause(); onSave(state);
  }
  function resume() {
    if (ended || destroyed) return;
    paused = false; lastTime = 0; syncPause(); canvas.focus({ preventScroll: true });
  }
  function togglePause() { if (paused) resume(); else pause(); }
  function clearInput() { Object.keys(input).forEach(k => input[k] = false); }
  document.querySelector('#pause').onclick = pause;
  document.querySelector('#start-flight').onclick = resume;
  const keyMap = { KeyW: 'thrust', ArrowUp: 'thrust', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyS: 'brake', ArrowDown: 'brake', Space: 'brake', ShiftLeft: 'boost', ShiftRight: 'boost' };
  document.addEventListener('keydown', e => {
    if (document.querySelector('#modal').open || e.target.matches?.('input,textarea')) return;
    if (keyMap[e.code] || e.code === 'KeyP') e.preventDefault();
    if (keyMap[e.code]) input[keyMap[e.code]] = true;
    if (e.repeat) return;
    if (e.code === 'KeyP') togglePause();
  }, { signal });
  document.addEventListener('keyup', e => { if (keyMap[e.code]) input[keyMap[e.code]] = false; }, { signal });
  window.addEventListener('blur', pause, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', e => {
      e.preventDefault(); button.setPointerCapture(e.pointerId);
      input[button.dataset.control] = true;
      if (button.dataset.control === 'boost') input.thrust = true;
    }, { signal });
    const release = () => { input[button.dataset.control] = false; if (button.dataset.control === 'boost') input.thrust = false; };
    button.addEventListener('pointerup', release, { signal });
    button.addEventListener('pointercancel', release, { signal });
  });

  function draw() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#070d19'; c.fillRect(0, 0, width, height);
    const speed = Math.hypot(state.vx, state.vy);
    const zoom = map ? Math.min(width, height) / (GAME_RULES.auScale * 105) : clamp(650 / (650 + speed), 0.14, 1);
    const cameraX = map ? 0 : state.x, cameraY = map ? 0 : state.y;
    const sx = x => width / 2 + (x - cameraX) * zoom, sy = y => height / 2 + (y - cameraY) * zoom;
    for (const star of starfield) {
      const x = ((star.x * width - cameraX * star.depth) % width + width) % width;
      const y = ((star.y * height - cameraY * star.depth) % height + height) % height;
      c.fillStyle = star.bright > 0.8 ? '#afc7e1a8' : '#6c85a94a'; c.fillRect(x, y, star.bright > 0.9 ? 2 : 1, star.bright > 0.9 ? 2 : 1);
    }
    // Draw each real ellipse with a common scale. Camera zoom never rearranges bodies.
    for (const orbit of orbitPaths) {
      c.strokeStyle = orbit.name === mission.target ? '#2d738629' : '#29465b21'; c.lineWidth = 1; c.beginPath();
      orbit.points.forEach((p, i) => i ? c.lineTo(sx(p.x), sy(p.y)) : c.moveTo(sx(p.x), sy(p.y))); c.stroke();
    }
    for (const rock of (map ? belt : beltRocksNear(state.x, state.y))) {
      const x = sx(rock.x), y = sy(rock.y);
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      c.fillStyle = map ? '#92765b66' : rock.shade > 0.5 ? '#8e8776' : '#565e6f';
      const size = map ? 1 : Math.max(2, rock.r * zoom);
      if (map) c.fillRect(x, y, 1, 1);
      else {
        c.beginPath(); c.moveTo(x - size, y); c.lineTo(x - size * .6, y - size * .8);
        c.lineTo(x + size * .4, y - size); c.lineTo(x + size, y + size * .25);
        c.lineTo(x + size * .3, y + size); c.lineTo(x - size * .7, y + size * .65); c.closePath(); c.fill();
        c.fillStyle = '#303d50'; c.fillRect(x - size * .3, y - size * .3, size * .45, size * .3);
      }
    }
    const sunX = sx(0), sunY = sy(0), sunR = map ? 7 : planetRadius('Sun') * zoom;
    if (sunX > -sunR * 2 && sunX < width + sunR * 2 && sunY > -sunR * 2 && sunY < height + sunR * 2) {
      const glow = c.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, map ? 25 : sunR * 1.9);
      glow.addColorStop(0, '#ffba4b6b'); glow.addColorStop(0.4, '#de6b2627'); glow.addColorStop(1, '#b53a1000');
      c.fillStyle = glow; c.fillRect(0, 0, width, height);
      c.fillStyle = '#eab871'; c.beginPath(); c.arc(sunX, sunY, sunR, 0, TAU); c.fill();
      c.font = '10px monospace'; c.fillStyle = '#c69761'; c.fillText('SUN', sunX - 10, sunY + sunR + 20);
    }
    for (const name of Object.keys(NASA_ORRERY_DATA)) {
      const p = orbitalPosition(name, state.days), x = sx(p.x), y = sy(p.y), r = map ? (name === mission.target ? 5 : 3) : planetRadius(name) * zoom;
      if (x < -r * 4 || x > width + r * 4 || y < -r * 4 || y > height + r * 4) continue;
      if (name === mission.target && !map) {
        const band = captureBand(name); c.fillStyle = '#43e1e309'; c.beginPath();
        c.arc(x, y, band.outer * zoom, 0, TAU); c.arc(x, y, band.inner * zoom, 0, TAU, true); c.fill();
        c.strokeStyle = '#47e6e494'; c.lineWidth = 1.5; c.setLineDash([4, 6]); c.beginPath(); c.arc(x, y, band.middle * zoom, 0, TAU); c.stroke(); c.setLineDash([]);
      }
      if (map) { c.fillStyle = name === mission.target ? '#7df8f6' : worldInfo(name).color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      else { const sprite = planetSprite(name); const size = r / (name === 'Saturn' ? 30 : 38); c.drawImage(sprite, x - 64 * size, y - 64 * size, 128 * size, 128 * size); }
      c.font = `${map ? 9 : 10}px monospace`; c.textAlign = 'center'; c.fillStyle = name === mission.target ? '#79e7ea' : '#728a9c';
      if (!map || NASA_ORRERY_DATA[name].sma > 3) c.fillText(name.toUpperCase(), x, y + r + (map ? 13 : 23));
      if (!map && name !== mission.target) { c.fillStyle = '#536478'; c.font = '8px monospace'; c.fillText(name === 'Earth' ? 'DEPARTURE / NO SCAN' : 'NON-TARGET / NO SCAN', x, y + r + 36); }
      c.textAlign = 'left';
    }
    if (!map) {
      for (let i = 0; i < trail.length; i++) { c.fillStyle = `rgba(98,225,236,${i / trail.length * 0.5})`; const t = trail[i]; c.fillRect(sx(t.x), sy(t.y), i % 3 === 0 ? 3 : 2, 2); }
      for (const h of state.hazards) {
        const x = sx(h.x), y = sy(h.y), r = h.r * zoom;
        if (h.comet) { c.strokeStyle = '#86dbea4d'; c.lineWidth = r; c.beginPath(); c.moveTo(x, y); c.lineTo(x - h.vx * 0.5 * zoom, y - h.vy * 0.5 * zoom); c.stroke(); }
        c.fillStyle = h.hit ? '#6b5868' : h.comet ? '#b3dce3' : '#89867e';
        c.beginPath(); c.moveTo(x - r, y); c.lineTo(x - r * 0.4, y - r); c.lineTo(x + r * 0.7, y - r * 0.6); c.lineTo(x + r, y + r * 0.4); c.lineTo(x, y + r); c.closePath(); c.fill();
        c.fillStyle = '#4a5363'; c.fillRect(x - r * 0.3, y - r * 0.2, r * 0.5, r * 0.5);
      }
      if (state.damageCooldown <= 0 || Math.floor(state.elapsed * 12) % 2) drawRocket(c, width / 2, height / 2, state.angle, width < 600 ? 0.85 : 1, mission.parts, !paused && state.throttle > .04, !paused ? state.turnJet : 0);
      drawArrow(sx, sy);
    } else {
      const x = sx(state.x), y = sy(state.y); c.fillStyle = '#f3ffff'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill();
      c.font = '10px monospace'; c.fillText('YOUR SHIP', x + 12, y - 25);
      if (NASA_ORRERY_DATA[mission.target].sma < 3) {
        c.fillStyle = '#78dce4'; c.fillText('INNER SYSTEM / ' + mission.target.toUpperCase(), width / 2 + 17, height / 2 + 22);
      }
      c.textAlign = 'center'; c.fillStyle = '#95b1bd'; c.font = '12px monospace'; c.fillText('SOLAR SYSTEM OVERVIEW · M TO RETURN TO COCKPIT', width / 2, height - 100); c.textAlign = 'left';
    }
    if (flash > 0) { c.fillStyle = `rgba(235,76,105,${flash * 0.3})`; c.fillRect(0, 0, width, height); }
    updateTelemetry();
  }

  function drawArrow(sx, sy) {
    const target = orbitalPosition(mission.target, state.days), dx = target.x - state.x, dy = target.y - state.y;
    const angle = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    if (d < captureBand(mission.target).outer * 1.2) return;
    const edgeX = width / 2 - 55, edgeY = height / 2 - (width < 600 ? 155 : 100);
    const radius = Math.min(edgeX / Math.max(0.001, Math.abs(Math.cos(angle))), Math.max(45, edgeY) / Math.max(0.001, Math.abs(Math.sin(angle))));
    const x = width / 2 + Math.cos(angle) * radius, y = height / 2 + Math.sin(angle) * radius;
    c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#69f1f2';
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-7, -7); c.lineTo(-3, 0); c.lineTo(-7, 7); c.closePath(); c.fill(); c.restore();
    c.fillStyle = '#6cd9df'; c.font = '10px monospace'; c.textAlign = 'center';
    c.fillText(mission.target.toUpperCase(), clamp(x, 60, width - 60), y + 24);
    c.font = '9px monospace'; c.fillStyle = '#7d9cae'; c.fillText((d / GAME_RULES.auScale).toFixed(2) + ' AU', clamp(x, 60, width - 60), y + 39); c.textAlign = 'left';
  }

  function updateTelemetry() {
    const cap = captureStatus(state, mission.target, state.days);
    const hp = clamp(state.hp / stats.hp * 100, 0, 100), fuel = clamp(state.fuelKg / stats.propellantKg * 100, 0, 100);
    document.querySelector('#speed-readout').textContent = Math.round(Math.hypot(state.vx, state.vy) * (UNITS.kmPerAU * 1000 / GAME_RULES.auScale) / (GAME_RULES.daysPerSecond * 86400)).toLocaleString('en-US') + ' m/s';
    document.querySelector('#hull-readout').textContent = Math.round(hp) + '%';
    document.querySelector('#hull-meter').style.width = hp + '%';
    document.querySelector('#fuel-readout').textContent = Math.ceil(fuel) + '%';
    document.querySelector('#fuel-meter').style.width = fuel + '%';
    document.querySelector('#target-distance').textContent = (cap.r / GAME_RULES.auScale).toFixed(3) + ' AU';
    const g = gravityAt(state.x, state.y, state.days);
    const scanPercent = clamp(state.scan / GAME_RULES.scanSeconds * 100, 0, 100);
    document.querySelector('#scan-meter').style.width = scanPercent + '%';
    document.querySelector('#scan-readout').textContent = 'SCAN ' + Math.floor(scanPercent) + '%';
    document.querySelector('#scan-hud').classList.toggle('scanning', cap.stable);
    document.querySelector('#scan-label').textContent = cap.inBand ? 'SCANNING ' + mission.target.toUpperCase() : mission.target.toUpperCase() + ' ORBIT';
    const acceleration = stats.thrustN / (stats.dryKg + state.fuelKg) * GAME_RULES.controlAccelerationScale;
    const stoppingDistance = cap.speed ** 2 / (2 * acceleration);
    const beltWarning = outerMission && inAsteroidBelt(state.x, state.y);
    document.querySelector('#scan-guidance').textContent = cap.inBand ? 'Scanning. Stay in the cyan band until the scan finishes.' : cap.r < cap.band.inner ? 'Too close! Thrust away from the surface.' : stoppingDistance > cap.r - cap.band.middle && cap.speed > 60 ? 'Brake now — your momentum will carry you past the orbital band.' : beltWarning ? 'ASTEROID BELT · Slow down for gaps. Watch for crossing comets and save fuel for corrections.' : cap.r < cap.band.outer * 4 ? 'Brake to match the planet, then coast into the cyan orbital band.' : 'Thrust builds speed gradually. Coast to save fuel; reserve propellant for braking and steering.';
  }

  function tick(now) {
    if (destroyed) return;
    let dt = Math.min((now - (lastTime || now)) / 1000, 0.05); lastTime = now;
    if (!paused && !ended) {
      while (dt > 0) {
        const h = Math.min(dt, 1 / 120); dt -= h;
        const hpBefore = state.hp;
        const result = advanceFlight(state, mission, input, h);
        if (state.hp < hpBefore) flash = 0.5;
        if (result.outcome) { ended = true; clearInput(); onSave(state); onFinish(result.outcome === 'success', result.reason || ''); break; }
      }
      trailTimer += 1 / 60; flash = Math.max(0, flash - 1 / 60);
      if (trailTimer > 0.045) { trail.push({ x: state.x, y: state.y }); if (trail.length > 80) trail.shift(); trailTimer = 0; }
      saveTimer += 1 / 60;
      if (saveTimer > 0.8) { onSave(state); saveTimer = 0; }
    }
    draw(); animation = requestAnimationFrame(tick);
  }
  syncPause(); animation = requestAnimationFrame(tick);
  return { state, input, pause, resume, get paused() { return paused; },
    destroy() { if (destroyed) return; onSave(state); destroyed = true; cancelAnimationFrame(animation); bindings.abort(); observer.disconnect(); clearInput(); } };
}
