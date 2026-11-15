// NASA_ORRERY_DATA is the first constant in data.js. core.js contains the equations.
const SAVE_KEY = 'osp-campaign-v4';
const $ = s => document.querySelector(s);
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let storageAvailable = true;
let campaign = loadCampaign();
let selected = campaign.mission?.target || [...WORLDS].reverse().find(w => destinationUnlocked(campaign, w.name)).name;
let parts = campaign.mission ? clone(campaign.mission.parts) : defaultParts();
let step = campaign.mission ? 2 : 0;
let lastResult = null, flightController = null, transitioning = false;
let planetAnimation = 0, rewardAnimation = 0, rewardPending = false;
let labCategory = 'engine', detailPart = null, pinnedPart = null;
let partHideTimer = 0;
const coinAnimations = [];
const sprites = new Map();

function loadCampaign() {
  try {
    const c = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem('orbit-foundry-campaign-v3') || localStorage.getItem('orbit-foundry-campaign-v2') || 'null');
    if (!c || ![2, 3, 4].includes(c.version) || !Number.isSafeInteger(c.credits) || c.credits < 0
      || !Number.isSafeInteger(c.sequence) || !Number.isFinite(c.days)
      || !Array.isArray(c.records) || !Array.isArray(c.ledger)) return newCampaign();
    // An untouched v2 starting wallet gets the new starting economy. Actual
    // purchases, earned credits, history, and paid flights are never discarded.
    if (c.version === 2 && c.sequence === 0 && c.records.length === 0 && !c.mission && c.credits === 5000) return newCampaign();
    if (c.version === 2 && c.mission) {
      const old = c.mission.parts;
      c.mission.parts = { engine: old.engine, boosters: old.boosters, fuel: old.fuel, instruments: old.instruments };
      if (c.mission.state) c.mission.state.hp = clamp(c.mission.state.hp / [80, 135, 220][old.material || 0] * 100, 0, 100);
    }
    if (c.version < 4) {
      // Preserve earned legacy destinations, credits, receipts, and paid flights.
      const oldOrder = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
      c.unlockedWorlds = c.sequence || c.records.length ? [...new Set(['Venus', ...oldOrder.slice(0, Math.min(8, campaignLevel(c) + 1))])] : ['Venus'];
      if (c.mission?.state) {
        const s = c.mission.state, ratio = GAME_RULES.auScale / 1200;
        const oldPosition = orbitalPosition(c.mission.target, s.days, 1200);
        const oldRadii = { Mercury:19, Venus:25, Earth:27, Mars:22, Jupiter:62, Saturn:54, Uranus:38, Neptune:36, Pluto:18 };
        const dx = s.x - oldPosition.x, dy = s.y - oldPosition.y;
        const oldMiddle = Math.max(100, oldRadii[c.mission.target] * 2.6);
        if (Math.hypot(dx, dy) < oldMiddle * 3) {
          const now = orbitalPosition(c.mission.target, s.days), local = captureBand(c.mission.target).middle / oldMiddle;
          const oldVelocity = orbitalVelocity(c.mission.target, s.days);
          s.x = now.x + dx * local; s.y = now.y + dy * local;
          s.vx = oldVelocity.x + (s.vx - oldVelocity.x / (ratio * GAME_RULES.daysPerSecond)) * Math.sqrt(local / 10);
          s.vy = oldVelocity.y + (s.vy - oldVelocity.y / (ratio * GAME_RULES.daysPerSecond)) * Math.sqrt(local / 10);
        } else { s.x *= ratio; s.y *= ratio; s.vx *= ratio * GAME_RULES.daysPerSecond; s.vy *= ratio * GAME_RULES.daysPerSecond; }
        s.throttle = 0; s.angularVelocity = 0; s.turnJet = 0; s.hazards = []; s.hazardClock = 0;
      }
    }
    c.version = 4;
    c.unlockedWorlds = [...new Set(['Venus', ...(c.unlockedWorlds || []).filter(name => WORLDS.some(w => w.name === name))])];
    if (c.mission && (!validParts(c.mission.parts) || !WORLDS.some(w => w.name === c.mission.target))) return newCampaign();
    if (c.mission?.state && !['x', 'y', 'vx', 'vy', 'angle', 'fuelKg', 'hp', 'days', 'scan', 'elapsed'].every(k => Number.isFinite(c.mission.state[k]))) c.mission.state = null;
    c.status = c.mission || c.credits >= minimumMissionCost() ? 'active' : 'bankrupt';
    return c;
  } catch { return newCampaign(); }
}
function saveCampaign() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(campaign)); }
  catch { storageAvailable = false; }
}
function updateHeader() {
  $('#archive-count').textContent = String(campaign.records.length).padStart(2, '0');
  $('#mission-number').textContent = String(campaign.sequence + (campaign.mission ? 0 : 1)).padStart(3, '0');
  $('#wallet-value').textContent = fmt(step === 3 && rewardPending && lastResult ? campaign.credits - lastResult.reward : campaign.credits) + ' CR';
  $('#wallet').setAttribute('aria-label', `Global balance ${campaign.credits} credits. Open ledger`);
}
function render() {
  clearTimeout(partHideTimer); detailPart = pinnedPart = null;
  cancelAnimationFrame(planetAnimation); cancelAnimationFrame(rewardAnimation);
  coinAnimations.splice(0).forEach(a => a.cancel());
  document.querySelectorAll('.credit-token').forEach(c => c.remove());
  $('#wallet').classList.remove('wallet-celebrate');
  if (flightController) { flightController.destroy(); flightController = null; }
  document.body.classList.toggle('flight-mode', step === 2);
  document.body.dataset.stage = step;
  updateHeader();
  if (campaign.status === 'bankrupt' && !campaign.mission) return bankruptcy();
  if (step === 0) destinations();
  if (step === 1) lab();
  if (step === 2 && campaign.mission) flightScreen();
  if (step === 3) results();
}
function go(next) {
  if (transitioning) return;
  flightController?.pause(); transitioning = true;
  $('#transition').classList.add('cover');
  setTimeout(() => {
    step = next; render(); $('#transition').classList.remove('cover'); transitioning = false;
    $('#screen').scrollIntoView({ block: 'start', behavior: 'instant' });
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
}
function requestStage(next) {
  if (campaign.mission) {
    if (next === 2) { if (step !== 2) go(2); return; }
    modal(`<div class="label">PAID FLIGHT IN PROGRESS</div><h2>Your spacecraft is still out there.</h2><p>Resume, or abandon this rocket. Its ${fmt(campaign.mission.cost)} CR purchase has already been charged.</p><div class="actions"><button class="primary" id="resume-current">Resume flight ↗</button><button class="secondary danger" id="abandon-current">Abandon rocket</button></div>`);
    $('#resume-current').onclick = () => { closeModal(); if (step !== 2) go(2); };
    $('#abandon-current').onclick = () => { closeModal(); finishFlight(false, 'Mission abandoned by the flight director. The purchased spacecraft was not recovered.'); };
  } else if (next === 1 && !destinationUnlocked(campaign, selected)) modal('<h2>Destination locked.</h2><p>Complete a successful mission to unlock the next planet.</p>');
  else if (next === 0 || next === 1) go(next);
  else if (next === 3 && lastResult) go(3);
  else modal('<h2>Build. Buy. Then fly.</h2><p>Buy an assembled spacecraft in the rocket lab to launch a mission.</p>');
}
function worldInfo(name) { return WORLDS.find(w => w.name === name) || { name: 'Earth', type: 'Home world', color: '#6babd6' }; }

function drawPlanet(canvas, name, phase = 0) {
  canvas.width = 128; canvas.height = 128;
  const c = canvas.getContext('2d'), color = worldInfo(name).color, r = name === 'Saturn' ? 30 : 38;
  c.imageSmoothingEnabled = false;
  if (name === 'Saturn') { c.strokeStyle = '#83734c'; c.lineWidth = 8; c.beginPath(); c.ellipse(64, 64, 58, 14, -0.3, 0, TAU); c.stroke(); }
  for (let y = -r; y <= r; y += 2) for (let x = -r; x <= r; x += 2) {
    if (x * x + y * y > r * r) continue;
    c.fillStyle = color; c.fillRect(64 + x, 64 + y, 2, 2);
    const noise = Math.sin((x + phase) * 0.7 + y * 0.9) * Math.cos((x + phase) * 0.25 - y * 0.45);
    const banded = ['Jupiter', 'Saturn', 'Neptune'].includes(name);
    if (banded && Math.floor((y + r + Math.sin(x * 0.08 + phase * 0.05) * 2) / 7) % 3 === 0) { c.fillStyle = '#76533c55'; c.fillRect(64 + x, 64 + y, 2, 2); }
    if (!banded && noise > 0.47) { c.fillStyle = name === 'Earth' ? '#73a578' : '#4e2a253d'; c.fillRect(64 + x, 64 + y, 2, 2); }
    const shade = Math.max(0, x / r + 0.15) * 0.56 + Math.max(0, (x * x + y * y) / (r * r) - 0.65) * 0.28;
    c.fillStyle = `rgba(4,9,25,${shade})`; c.fillRect(64 + x, 64 + y, 2, 2);
  }
  if (name === 'Mars') { c.fillStyle = '#ecd7d1'; c.fillRect(52, 26, 21, 3); c.fillRect(56, 29, 15, 3); }
  if (name === 'Jupiter') { c.fillStyle = '#aa6a58'; const spot = 72 + Math.sin(phase * 0.04) * 8; c.fillRect(spot, 73, 17, 7); c.fillRect(spot + 3, 71, 10, 10); }
  if (name === 'Saturn') { c.strokeStyle = '#d4bd87'; c.lineWidth = 5; c.beginPath(); c.ellipse(64, 64, 58, 14, -0.3, 0, Math.PI); c.stroke(); }
}
function planetSprite(name) {
  if (!sprites.has(name)) { const c = document.createElement('canvas'); drawPlanet(c, name); sprites.set(name, c); }
  return sprites.get(name);
}
function drawRocket(c, x, y, angle, scale, config, burning = false, turnJet = 0) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  c.fillStyle = '#c7d3e7';
  c.fillRect(-12, -5, 23, 10); c.fillRect(11, -3, 6, 6); c.fillRect(17, -1, 4, 2);
  c.fillStyle = '#ebf9ff'; c.fillRect(-8, -5, 17, 2);
  c.fillStyle = '#75e9ed'; c.fillRect(4, -3, 5, 5);
  c.fillStyle = '#5c82b1'; c.fillRect(-10, -10, 10, 5); c.fillRect(-10, 5, 10, 5);
  if (config.boosters >= 2) { c.fillStyle = '#a2b4ca'; c.fillRect(-14, -8, 13, 3); c.fillRect(-14, 5, 13, 3); }
  if (config.boosters === 4) { c.fillRect(-16, -12, 12, 3); c.fillRect(-16, 9, 12, 3); }
  if (config.instruments.length > 1) { c.fillStyle = '#7d7bd2'; c.fillRect(-4, -16, 7, 8); c.fillRect(-4, 8, 7, 8); }
  if (config.instruments.includes(2)) { c.fillStyle = '#98f9d9'; c.fillRect(2, -11, 1, 7); }
  if (burning) { c.fillStyle = '#6bd7f6'; c.fillRect(-23, -4, 11, 8); c.fillStyle = '#b8ffff'; c.fillRect(-20, -2, 8, 4); c.fillStyle = '#596eec'; c.fillRect(-29, -2, 6, 4); }
  // Rocket points along +X. Left is -Y: its forward jet pushes the nose right.
  if (turnJet) {
    const side = turnJet > 0 ? -1 : 1, length = 9 + config.boosters * 2;
    c.fillStyle = '#7198f5'; c.fillRect(4, side < 0 ? -7 - length : 7, 5, length);
    c.fillStyle = '#adffff'; c.fillRect(5, side < 0 ? -14 : 7, 3, 7);
    c.fillStyle = '#efffff'; c.fillRect(5, side < 0 ? -10 : 7, 3, 3);
  }
  c.restore();
}

function destinations(direction = 0) {
  cancelAnimationFrame(planetAnimation);
  const index = WORLDS.findIndex(w => w.name === selected), w = worldInfo(selected);
  const orbit = NASA_ORRERY_DATA[selected], facts = NASA_FACTS[selected];
  const open = destinationUnlocked(campaign, selected), distance = earthDistance(selected, campaign.days);
  const remaining = missionsUntilUnlock(campaign, selected);
  $('#screen').innerHTML = `<div class="destination-heading"><div><h1>Choose a destination.</h1></div><span class="progress-label">${unlockedWorldCount(campaign)} / 8 WORLDS UNLOCKED</span></div>
  <section class="science-intro" aria-label="About Orbit Space Program"><div><span class="label">INTERACTIVE SPACE EXPLORATION GAME</span><p>Build and pilot a spacecraft across a simplified solar system. Explore planetary orbits and compare NASA reference facts; game-scaled travel keeps the mission playable.</p></div><div class="science-links"><span class="label">NASA DATA USED</span><a href="${SOURCES.orrery}" target="_blank" rel="noopener">Orrery orbital parameters ↗</a><a href="${SOURCES.facts}" target="_blank" rel="noopener">Planetary fact sheets ↗</a></div></section>
  <section class="destination-deck ${open ? '' : 'destination-locked'}" aria-roledescription="carousel" aria-label="Mission destinations" tabindex="0">
  <button class="carousel-arrow previous" id="previous-world" aria-label="Previous planet">←</button>
  <article class="destination-card ${direction > 0 ? 'slide-next' : direction < 0 ? 'slide-prev' : ''}" aria-live="polite">
    <div class="world-stage"><span class="world-coordinate">SOL SYSTEM / 0${index + 1}</span><div class="world-orbit orbit-one"></div><div class="world-orbit orbit-two"></div><div class="planet-float"><canvas id="destination-planet" aria-label="Animated circular pixel-art ${selected}"></canvas></div><span class="world-classification">${w.type.toUpperCase()}</span></div>
    <div class="destination-copy"><span class="destination-status ${open ? 'pass' : ''}">${open ? '● MISSION AVAILABLE' : '◇ DESTINATION LOCKED'}</span><h2>${selected}<span>0${index + 1}</span></h2><p>${w.description}</p><div class="card-science">${w.science.map(s => `<span>${s}</span>`).join('')}</div><div class="destination-stats"><div><small>FROM EARTH · MODEL</small><strong>${fmt(distance, 3)} <em>AU</em></strong><span>${fmt(distance * UNITS.kmPerAU / 1e6, 1)} million km</span></div><div><small>MISSION REWARD</small><strong>+${fmt(missionReward(selected, defaultParts()))} <em>CR</em></strong><span>Added to your global credits</span></div></div>
    <button class="primary" id="build" ${open ? '' : 'disabled'}>${open ? 'Build your rocket' : remaining + ' more successful mission' + (remaining === 1 ? '' : 's') + ' to unlock'} <span>${open ? '↗' : '◇'}</span></button></div>
  </article><button class="carousel-arrow next" id="next-world" aria-label="Next planet">→</button></section>
  <section class="mission-briefing" aria-labelledby="mission-briefing-title"><div class="briefing-heading"><div><span class="label">MISSION BRIEFING · NASA REFERENCE DATA</span><h2 id="mission-briefing-title">${selected} at a glance</h2></div><a href="${SOURCES.facts}" target="_blank" rel="noopener">Planet facts ↗</a></div><p class="briefing-copy">${w.description} The “from Earth” distance above is calculated by the game’s orbit model; it is not a live position reading.</p><div class="briefing-metrics"><div><small>SEMI-MAJOR AXIS</small><strong>${fmt(orbit.sma, 3)} AU</strong></div><div><small>ORBITAL PERIOD</small><strong>${fmt(orbit.period, 2)} days</strong></div><div><small>SURFACE GRAVITY</small><strong>${fmt(facts.gravity, 1)} m/s²</strong></div><div><small>MEAN TEMPERATURE</small><strong>${fmt(facts.temperature)} °C</strong></div></div><div class="briefing-science"><span class="label">EXISTING MISSION SCIENCE GOALS</span><div>${w.science.map(goal => `<span>${goal}</span>`).join('')}</div></div><p class="science-boundary">NASA reference values are shown separately from game rules. Orbit scale, body display sizes, and flight behavior are simplified for play.</p></section>
  <div class="carousel-footer"><span>0${index + 1} <b>/ 08</b></span><div class="carousel-dots" aria-label="Planet navigation">${WORLDS.map((p, i) => `<button data-planet="${p.name}" class="${p.name === selected ? 'selected' : ''} ${destinationUnlocked(campaign, p.name) ? 'unlocked' : 'locked'}" aria-label="${p.name}${destinationUnlocked(campaign, p.name) ? '' : ', locked'}" aria-pressed="${p.name === selected}" title="${p.name}"><span></span></button>`).join('')}</div><button class="text-button notes">NASA data ↗</button></div>`;
  const canvas = $('#destination-planet'); drawPlanet(canvas, selected);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let last = 0;
    const animate = time => { if (step !== 0 || !canvas.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return; if (time - last > 70) { drawPlanet(canvas, selected, time * 0.004); last = time; } planetAnimation = requestAnimationFrame(animate); };
    planetAnimation = requestAnimationFrame(animate);
  }
  function move(offset) { selected = WORLDS[(index + offset + WORLDS.length) % WORLDS.length].name; destinations(offset); }
  $('#previous-world').onclick = () => move(-1); $('#next-world').onclick = () => move(1);
  $('.destination-deck').onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); $('.destination-deck').focus(); } };
  let touchX = null;
  $('.world-stage').onpointerdown = e => touchX = e.clientX;
  $('.world-stage').onpointerup = e => { if (touchX !== null && Math.abs(e.clientX - touchX) > 45) move(e.clientX < touchX ? 1 : -1); touchX = null; };
  document.querySelectorAll('[data-planet]').forEach(b => b.onclick = () => { const previous = index; selected = b.dataset.planet; destinations(WORLDS.findIndex(w => w.name === selected) > previous ? 1 : -1); });
  $('#build').onclick = () => { if (open) { parts = recommendedParts(campaign, selected); labCategory = 'engine'; pinnedPart = detailPart = null; go(1); } };
  $('.notes').onclick = notes;
}

function partButton(key, index, title, price) {
  const chosen = key === 'instruments' ? parts.instruments.includes(index) : parts[key] === index;
  const locked = partUnlockLevel(key, index) > campaignLevel(campaign);
  return `<div class="part-row"><button class="part ${chosen ? 'selected' : ''} ${locked ? 'part-locked' : ''}" data-part="${key}" data-index="${index}" aria-pressed="${chosen}" aria-disabled="${locked}" aria-describedby="part-popover"><span>${title}</span><span>${fmt(price)} CR</span></button><button class="part-info-button" data-info="${index}" aria-label="Information about ${title}" aria-expanded="false">i</button></div>`;
}

function partInformation(key, index) {
  const e = NASA_ENGINES[parts.engine], remaining = Math.max(0, partUnlockLevel(key, index) - campaignLevel(campaign));
  let title, copy, facts, source, note;
  if (key === 'engine') {
    const engine = NASA_ENGINES[index]; title = engine.name;
    copy = `${engine.note}. Burns liquid hydrogen with liquid oxygen.`;
    facts = [['Vacuum thrust', fmt(engine.thrustN / 1000, 1) + ' kN'], ['Engine mass', fmt(engine.massKg, 1) + ' kg'], ['Specific impulse', engine.ispSeconds + ' s'], ['Oxidizer / fuel', engine.oxidizerRatio + ':1']];
    source = engine.source; note = 'NASA hardware values. The price is game credits; the J-2X values are development requirements.';
  } else if (key === 'boosters') {
    const configuration = { ...parts, boosters: index }, s = engineering(configuration), steering = steeringStats(configuration);
    title = index === 1 ? 'Single engine' : `${index}-engine cluster`;
    copy = `${index} × ${e.name}. More engines add thrust and mass. Stronger attitude jets turn faster; the opposite side fires to turn the nose.`;
    facts = [['Total vacuum thrust', fmt(s.thrustN / 1000, 1) + ' kN'], ['Engine mass', fmt(e.massKg * index, 1) + ' kg'], ['Physical mass flow', fmt(s.massFlow, 1) + ' kg/s'], ['Game turn rate', fmt(steering.rate * 180 / Math.PI) + '°/s']];
    source = e.source; note = 'Thrust, mass and flow are derived from NASA engine values. Cluster arrangements and attitude control are game designs. The listed cluster price includes the selected engine(s), charged once.';
  } else if (key === 'fuel') {
    const s = engineering({ ...parts, fuel: index }); title = `${fmt(s.propellantKg)} kg propellant`;
    copy = `Liquid hydrogen (fuel) and liquid oxygen (oxidizer), using the ${e.name} mixture ratio. More propellant increases ideal delta-v, but the added mass slows acceleration.`;
    facts = [['Liquid hydrogen', fmt(s.hydrogenKg, 1) + ' kg'], ['Liquid oxygen', fmt(s.oxygenKg, 1) + ' kg'], ['Mixture ratio', e.oxidizerRatio + ':1 O/F'], ['Loaded ideal Δv', fmt(s.deltaV) + ' m/s']];
    source = e.source; note = 'Propellant chemistry and mixture ratio: NASA engine reference. Tank capacities, 4% tank-mass allocation, prices and accelerated flight consumption are game rules.';
  } else {
    const instrument = GAME_RULES.instruments[index]; title = instrument.name;
    const descriptions = [
      'Records light to image terrain and atmospheric clouds. Your mission unlocks surface or cloud observations and the planet’s reference diameter.',
      'Measures thermal radiation to study temperature patterns. Your mission unlocks thermal observations and the NASA reference mean temperature.',
      'Measures magnetic fields around a spacecraft. Your mission unlocks the planet’s reference global magnetic-field classification.'
    ];
    copy = descriptions[index];
    facts = [['Payload allocation', instrument.massKg + ' kg'], ['Science field', ['Imaging', 'Thermal radiation', 'Magnetism'][index]], ['Extra-instrument grant', '+30% of base reward']];
    source = SOURCES.data; note = 'NASA’s planetary data directory and fact sheet supply the science context and unlocked facts. These are generic instrument classes; payload masses and grant bonuses are game allocations.';
  }
  return `<button id="close-part-info" class="close-part-info" aria-label="Close part information">×</button><span class="label">${remaining ? remaining + ' MORE WIN' + (remaining === 1 ? '' : 'S') + ' TO UNLOCK' : 'PART INFORMATION'}</span><h3>${title}</h3><p>${copy}</p><dl>${facts.map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><a href="${source}" target="_blank" rel="noopener">NASA reference ↗</a><small>${note}</small>`;
}

function hidePartInfo() {
  const popover = $('#part-popover'); if (popover) popover.hidden = true;
  detailPart = pinnedPart = null;
  document.querySelectorAll('[data-info]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function showPartInfo(key, index, anchor, pin = false) {
  clearTimeout(partHideTimer);
  const popover = $('#part-popover'); if (!popover) return;
  detailPart = { key, index, anchor }; if (pin) pinnedPart = index;
  popover.innerHTML = partInformation(key, index); popover.hidden = false;
  document.querySelectorAll('[data-info]').forEach(b => b.setAttribute('aria-expanded', String(+b.dataset.info === index)));
  $('#close-part-info').onclick = () => { anchor.focus({ preventScroll: true }); hidePartInfo(); };
  positionPartInfo();
}
function positionPartInfo() {
  const popover = $('#part-popover'); if (!popover || popover.hidden || !detailPart?.anchor.isConnected) return;
  const r = detailPart.anchor.getBoundingClientRect(), mobile = innerWidth < 760;
  const width = mobile ? Math.min(290, innerWidth - 28) : Math.min(290, Math.max(190, r.left - 28));
  popover.style.width = width + 'px'; popover.style.maxHeight = Math.max(220, innerHeight - 36) + 'px';
  const left = mobile ? (innerWidth - width) / 2 : Math.max(14, r.left - width - 14);
  const top = mobile ? Math.max(18, (innerHeight - popover.offsetHeight) / 2) : clamp(r.top, 16, Math.max(16, innerHeight - popover.offsetHeight - 16));
  popover.style.left = left + 'px'; popover.style.top = top + 'px';
}

function lab() {
  detailPart = pinnedPart = null;
  const s = engineering(parts), e = NASA_ENGINES[parts.engine], checks = launchChecks(parts, campaign.credits, campaignLevel(campaign));
  const categories = [['engine', '01', 'Engines'], ['boosters', '02', 'Boosters'], ['fuel', '03', 'Fuel tanks'], ['instruments', '04', 'Instruments']];
  const options = labCategory === 'engine' ? NASA_ENGINES.map((p, i) => partButton('engine', i, p.name, GAME_RULES.enginePrices[i])).join('')
    : labCategory === 'boosters' ? GAME_RULES.boosterCounts.map(n => partButton('boosters', n, n === 1 ? 'Single engine' : `${n}-engine cluster`, GAME_RULES.enginePrices[parts.engine] * n)).join('')
    : labCategory === 'fuel' ? GAME_RULES.fuelLoads.map((kg, i) => partButton('fuel', i, `${fmt(kg)} kg · LH₂ / LOX`, GAME_RULES.fuelPrices[i])).join('')
    : GAME_RULES.instruments.map((p, i) => partButton('instruments', i, p.name, p.cost)).join('');
  const names = { engine: e.name, boosters: parts.boosters + ' engine' + (parts.boosters === 1 ? '' : 's'), fuel: fmt(s.propellantKg) + ' kg', instruments: parts.instruments.length + ' selected' };
  $('#screen').innerHTML = `<div class="section-heading"><div><span class="label">${selected.toUpperCase()} EXPEDITION</span><h2>Rocket lab</h2></div><span class="tag">${campaignLevel(campaign)} SUCCESSFUL MISSIONS</span></div>
  <div class="lab-layout category-lab"><aside class="part-categories" aria-label="Rocket part categories" role="tablist" aria-orientation="vertical">${categories.map(([key,num,label]) => `<button id="category-${key}" role="tab" aria-selected="${labCategory === key}" aria-controls="part-options" tabindex="${labCategory === key ? 0 : -1}" data-category="${key}" class="${labCategory === key ? 'active' : ''}"><span>${num}</span><strong>${label}</strong><small>${names[key]}</small></button>`).join('')}</aside>
  <section class="panel part-selection" id="part-options" role="tabpanel" aria-labelledby="category-${labCategory}"><div class="part-selection-heading"><h3>${categories.find(c => c[0] === labCategory)[2]}</h3><span>${labCategory === 'instruments' ? 'SELECT ONE OR MORE' : 'SELECT ONE'}</span></div><div class="part-options">${options}</div><p class="part-note">Hover or focus a part for specifications. Tap <b>i</b> for details.</p>${labCategory === 'instruments' ? '<p class="science-bonus-note">Each additional instrument earns +30% of the mission’s base grant.</p>' : ''}</section>
  <aside class="panel assembly-summary"><span class="label">YOUR ${selected.toUpperCase()} ORBITER</span><div class="rocket-stage"><canvas id="rocket-preview" aria-label="Your custom rocket"></canvas></div><div class="cart-total"><span>Launch cost</span><strong>${fmt(s.cost)} <small>CR</small></strong></div><div class="wallet-after">${fmt(campaign.credits)} CR available <b class="${s.cost > campaign.credits ? 'fail' : 'pass'}">${fmt(campaign.credits - s.cost)} CR after launch</b></div><div class="check"><span>Orbiter chassis included</span><span>${GAME_RULES.chassisPrice} CR</span></div><div class="check"><span>Launch checks</span><span class="${checks.every(c => c.ok) ? 'pass' : 'fail'}">${checks.every(c => c.ok) ? '✓ Ready' : 'Needs revision'}</span></div><button class="primary" id="launch">Buy & launch <span>↗</span></button><p class="help">Successful mission: <strong>+${fmt(missionReward(selected, parts))} CR</strong></p><details class="engineering-details"><summary>Engineering & NASA data</summary><div class="engineering-stats"><div><small>WET MASS</small><strong>${fmt(s.wetKg)} kg</strong></div><div><small>THRUST</small><strong>${fmt(s.thrustN / 1000, 1)} kN</strong></div><div><small>IDEAL ΔV</small><strong>${fmt(s.deltaV)} m/s</strong></div><div><small>ISP</small><strong>${e.ispSeconds} s</strong></div></div><a href="${e.source}" target="_blank" rel="noopener">NASA engine reference ↗</a><p class="help">Credits and payload allocations are game rules. Ideal Δv is not a real mission prediction. Plan burns carefully and reserve fuel for braking.</p></details></aside></div>
  <aside id="part-popover" class="part-popover" role="dialog" aria-label="Part specifications" hidden></aside><div class="lab-bottom"><button class="secondary" id="back">← Destination</button><button class="text-button" id="demo">Recommended loadout ↗</button></div>`;
  const canvas = $('#rocket-preview'); canvas.width = 128; canvas.height = 128;
  drawRocket(canvas.getContext('2d'), 64, 64, -Math.PI / 2, 2.1, parts, true);
  document.querySelectorAll('[data-category]').forEach(b => {
    b.onclick = () => { labCategory = b.dataset.category; lab(); $('#category-' + labCategory).focus({ preventScroll: true }); };
    b.onkeydown = event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = categories.findIndex(c => c[0] === labCategory);
      labCategory = categories[event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowDown' ? 1 : 3)) % 4][0];
      lab(); $('#category-' + labCategory).focus({ preventScroll: true });
    };
  });
  document.querySelectorAll('[data-part]').forEach(b => {
    const key = b.dataset.part, i = +b.dataset.index, row = b.closest('.part-row');
    row.onpointerenter = event => { if (event.pointerType !== 'touch' && pinnedPart === null) showPartInfo(key, i, b); };
    row.onpointerleave = event => { if (pinnedPart === null && !$('#part-popover').contains(event.relatedTarget) && !row.contains(document.activeElement)) partHideTimer = setTimeout(hidePartInfo, 180); };
    b.onfocus = () => showPartInfo(key, i, b);
    b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return showPartInfo(key, i, b, true);
      if (key === 'instruments') parts.instruments = parts.instruments.includes(i) ? parts.instruments.filter(v => v !== i) : [...parts.instruments, i];
      else parts[key] = i;
      lab(); const chosen = document.querySelector(`[data-part="${key}"][data-index="${i}"]`); chosen.focus({ preventScroll: true });
    };
    row.querySelector('[data-info]').onclick = () => pinnedPart === i ? hidePartInfo() : showPartInfo(key, i, b, true);
  });
  $('#part-popover').onpointerleave = () => { if (pinnedPart === null && !$('#part-popover').contains(document.activeElement)) hidePartInfo(); };
  $('#part-popover').onpointerenter = () => clearTimeout(partHideTimer);
  $('#back').onclick = () => go(0); $('#launch').onclick = purchaseAndLaunch;
  $('#demo').onclick = () => { parts = recommendedParts(campaign, selected); lab(); };
}


function purchaseAndLaunch() {
  if (campaign.mission || transitioning) return;
  if (!destinationUnlocked(campaign, selected)) return modal('<h2>Destination locked.</h2><p>Win a mission to unlock the next world.</p>');
  const fail = launchChecks(parts, campaign.credits, campaignLevel(campaign)).filter(c => !c.ok);
  if (fail.length) return modal(`<div class="label">PRE-FLIGHT DIAGNOSTICS</div><h2>Assembly needs a revision.</h2>${fail.map(c => `<p class="fail">× ${c.reason}</p>`).join('')}<p>Nothing was purchased. Your balance is still ${fmt(campaign.credits)} CR.</p>`);
  $('#launch').disabled = true;
  campaign = buyMission(campaign, selected, parts);
  campaign.mission.state = makeFlightState(campaign.mission, campaign.days);
  saveCampaign(); updateHeader(); go(2);
}

function flightScreen() {
  const m = campaign.mission; if (!m) return;
  selected = m.target; parts = clone(m.parts);
  $('#screen').innerHTML = `<div class="section-heading flight-heading"><div><span class="label">MISSION IN PROGRESS</span><h2>Next stop: ${selected}.</h2></div><div class="flight-heading-actions"><button class="secondary" id="fullscreen">Expand ⛶</button><button class="secondary" id="leave-flight">Mission menu</button></div></div>
  <div class="space-flight" id="flight-container"><canvas id="flight" tabindex="0" aria-label="Open solar system. W or Up: thrust. A/D or Left/Right: rotate. Space or S: brake. Shift: boost. Stay in the cyan orbital band to scan. M: map. P: pause."></canvas>
  <div class="hud telemetry"><div class="meter-label">HULL <b id="hull-readout">100%</b></div><div class="meter"><span id="hull-meter"></span></div><div class="meter-label">FUEL <b id="fuel-readout">100%</b></div><div class="meter fuel-meter"><span id="fuel-meter"></span></div></div>
  <div class="hud target-hud"><div class="hud-title">CURRENT DESTINATION</div><div class="target-name"><strong>${selected.toUpperCase()}</strong><span id="target-distance">— AU</span></div><div class="target-planets" aria-label="Solar system planets">${WORLDS.map(w => `<span class="${w.name === selected ? 'target-chosen' : ''}" style="--planet-color:${w.color}"><i></i><small>${w.name}</small></span>`).join('')}</div></div>
  <div class="radar-group"><div class="radar-actions"><button id="pause" class="hud-button">START ▷</button><button class="hud-button" id="map-toggle">MAP M</button></div><canvas id="radar" width="160" height="160" aria-label="Solar system radar"></canvas></div>
  <div class="scan-hud hud" id="scan-hud"><div class="hud-title" id="scan-label">${selected.toUpperCase()} ORBIT</div><div class="meter"><span id="scan-meter"></span></div><span id="scan-readout">SCAN 0%</span></div>
  <div class="flight-overlay" id="flight-overlay"><div class="flight-brief"><span class="label">${selected.toUpperCase()} EXPEDITION</span><h2>${m.state?.elapsed > 0 ? 'Flight paused.' : 'Ready for launch?'}</h2><button class="primary" id="start-flight">${m.state?.elapsed > 0 ? 'Resume flight' : 'Take flight'} <span>↗</span></button></div></div></div>
  <div class="flight-instructions"><p id="scan-guidance">Follow the arrow. Brake near ${selected}, then stay in the cyan orbital band to scan.</p><div class="control-guide"><span><kbd>W ↑</kbd> Thrust</span><span><kbd>A D ← →</kbd> Rotate</span><span><kbd>S SPACE</kbd> Brake</span><span><kbd>SHIFT</kbd> Boost</span><span><kbd>P</kbd> Pause</span><span><kbd>M</kbd> Map</span></div></div>
  <div class="touch-flight-controls"><div><button data-control="left" aria-label="Rotate left">↶</button><button data-control="right" aria-label="Rotate right">↷</button></div><div><button data-control="brake">Brake</button><button data-control="boost">Boost</button><button data-control="thrust" class="touch-thrust">Thrust ↑</button></div></div>
  <div class="flight-notes"><span><span id="boost-readout">COASTING</span> · <span id="velocity-readout">0 u/s</span> · MODEL DAY <span id="day-readout">0</span><span id="gravity-readout" hidden></span></span><button class="text-button notes">NASA data & rules ↗</button></div>`;
  $('#leave-flight').onclick = () => requestStage(0); $('.notes').onclick = notes;
  $('#fullscreen').onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else $('#flight-container').requestFullscreen?.().catch(() => {}); };
  flightController = createSolarFlight(m, m.state || makeFlightState(m, campaign.days), finishFlight, saveFlight);
}

function saveFlight(state) {
  if (!campaign.mission) return;
  campaign.mission.state = clone(state); campaign.days = state.days; saveCampaign();
}
function finishFlight(success, reason = '') {
  if (!campaign.mission) return;
  if (flightController) { flightController.pause(); saveFlight(flightController.state); }
  const m = clone(campaign.mission);
  campaign = settleMission(campaign, m.id, success, reason);
  lastResult = { ...campaign.records.at(-1), parts: m.parts }; selected = m.target;
  rewardPending = success; saveCampaign();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  go(3);
}
function discoveryCards(target, p) {
  const facts = NASA_FACTS[target];
  return p.instruments.map(i => {
    const instrument = GAME_RULES.instruments[i];
    const info = instrument.kind === 'camera' ? ['Planetary diameter', fmt(facts.diameter) + ' km', 'Surface & cloud imaging']
      : instrument.kind === 'thermal' ? ['Mean temperature', facts.temperature + ' °C', 'Thermal observations']
      : ['Global magnetic field', facts.magnetic, 'Magnetic observations'];
    return `<article class="discovery-card"><span class="label">${instrument.name.toUpperCase()}</span><strong>${info[1]}</strong><h3>${info[0]}</h3><small>${info[2]}</small></article>`;
  }).join('');
}

function results() {
  if (!lastResult) { step = 0; return destinations(); }
  const r = lastResult, unlocked = r.unlockedPlanet;
  $('#screen').innerHTML = `<section class="mission-result ${r.success ? 'mission-won' : 'mission-lost'}"><div class="result-emblem">${r.success ? '<canvas id="result-planet" aria-label="' + r.planet + '"></canvas><span>✓</span>' : '<div class="failure-sigil">!</div>'}</div><span class="label">${r.success ? 'SCIENCE RECEIVED · MISSION COMPLETE' : 'EXPEDITION ENDED'}</span><h1>${r.success ? 'A little farther. A little wiser.' : 'Mission failed.'}</h1><p class="result-subtitle">${r.success ? 'Your ' + r.planet + ' expedition brought back new knowledge.' : escapeHTML(r.reason)}</p>
    ${r.success ? `<div class="reward-award"><span>SPONSOR GRANT</span><strong id="reward-amount">+${fmt(r.reward)} <small>CR</small></strong></div><p class="reward-breakdown">${fmt(missionReward(r.planet, { ...r.parts, instruments: [0] }))} CR base${r.parts.instruments.length > 1 ? " + " + fmt(r.reward - missionReward(r.planet, { ...r.parts, instruments: [0] })) + " CR science bonus" : " · 1 instrument"}</p><div class="discoveries">${discoveryCards(r.planet, r.parts)}</div><section class="science-recap" aria-label="Mission science recap"><div><span class="label">SCIENCE RECAP · NASA REFERENCE DATA</span><h2>What this mission explored</h2><p>${escapeHTML(worldInfo(r.planet).description)} Your selected instruments unlocked the reference facts shown above; they are not measurements returned by the simulated flight.</p></div><div class="recap-orbit"><span><small>SEMI-MAJOR AXIS</small><strong>${fmt(NASA_ORRERY_DATA[r.planet].sma, 3)} AU</strong></span><span><small>ORBITAL PERIOD</small><strong>${fmt(NASA_ORRERY_DATA[r.planet].period, 2)} days</strong></span></div><a href="${SOURCES.orrery}" target="_blank" rel="noopener">Explore the NASA orrery source ↗</a></section><div class="unlock-reveal">${unlocked ? '<span>✧ ' + unlocked + ' unlocked</span>' : '<span>✧ All worlds unlocked</span>'}${campaignLevel(campaign) <= 5 ? '<span>New parts in the rocket lab</span>' : ''}</div>` : `<p class="loss-balance">${fmt(campaign.credits)} CR remaining · Rocket cost ${fmt(r.cost)} CR</p>`}
    <div class="result-actions"><button class="primary" id="next-mission">${r.success ? unlocked ? 'Explore ' + unlocked : 'Choose your next mission' : 'Build another rocket'} <span>↗</span></button></div>${r.success ? '<small class="result-reference">NASA reference facts unlocked by your instruments. <a href="' + SOURCES.facts + '" target="_blank" rel="noopener">View source ↗</a></small>' : '<small class="result-reference">Your next attempt uses the same global credit balance.</small>'}</section>`;
  if (r.success) drawPlanet($('#result-planet'), r.planet);
  $('#next-mission').onclick = () => { rewardPending = false; if (r.success && unlocked) selected = unlocked; go(r.success ? 0 : 1); };
  if (r.success && rewardPending) animateCreditReward(r.reward);
}

function animateCreditReward(amount) {
  rewardPending = false;
  const target = $('#wallet'), counter = $('#wallet-value');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { counter.textContent = fmt(campaign.credits) + ' CR'; return; }
  const from = $('#reward-amount').getBoundingClientRect(), to = target.getBoundingClientRect();
  const origin = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const dx = to.left + to.width / 2 - origin.x, dy = to.top + to.height / 2 - origin.y;
  for (let i = 0; i < 14; i++) {
    const token = document.createElement('span'); token.className = 'credit-token'; token.setAttribute('aria-hidden', 'true');
    token.style.left = origin.x + 'px'; token.style.top = origin.y + 'px'; document.body.append(token);
    const spread = (i - 6.5) * 9;
    const animation = token.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: `translate(${spread}px, ${-25 - Math.abs(spread) * 0.4}px) scale(1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 1, offset: 0.94 },
      { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
    ], { duration: 1050, delay: 180 + i * 48, easing: 'cubic-bezier(.42,0,.6,1)', fill: 'both' });
    animation.onfinish = () => token.remove(); coinAnimations.push(animation);
  }
  const beginning = performance.now(), balanceBefore = campaign.credits - amount;
  const tick = time => {
    const progress = clamp((time - beginning - 450) / 1550, 0, 1);
    counter.textContent = fmt(Math.round(balanceBefore + amount * (1 - (1 - progress) ** 2))) + ' CR';
    if (progress > 0 && progress < 1) target.classList.add('wallet-celebrate');
    if (progress < 1) rewardAnimation = requestAnimationFrame(tick);
    else { target.classList.remove('wallet-celebrate'); counter.textContent = fmt(campaign.credits) + ' CR'; }
  };
  rewardAnimation = requestAnimationFrame(tick);
}

function bankruptcy() {
  const last = campaign.records.at(-1);
  $('#screen').innerHTML = `<div class="bankruptcy-panel"><div class="failure-sigil">!</div><div class="label">CAMPAIGN ENDED / BANKRUPTCY</div><h2>Mission failed.</h2><p>Your balance cannot fund another launch.</p><div class="result-accounting"><span>Credits remaining <b>${fmt(campaign.credits)} CR</b></span><span>Cheapest viable spacecraft <b>${fmt(minimumMissionCost())} CR</b></span><span>Completed missions <b>${campaign.records.filter(r => r.success).length}</b></span></div>${last && !last.success ? `<p class="help">Last flight: ${escapeHTML(last.reason)}</p>` : ''}<div class="actions"><button class="primary" id="restart-campaign">New campaign · ${fmt(GAME_RULES.initialCredits)} CR ↗</button><button class="secondary" id="bankrupt-ledger">Review ledger</button></div><p class="help">Starting again resets the balance, mission records, and badges. There is no automatic bailout.</p></div>`;
  $('#restart-campaign').onclick = confirmReset; $('#bankrupt-ledger').onclick = ledger;
}
function modal(html) { flightController?.pause(); $('#modal-content').innerHTML = html; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function ledger() {
  modal(`<div class="label">CAMPAIGN FINANCES</div><h2>One balance. Every transaction.</h2><div class="ledger-balance">${fmt(campaign.credits)} <span>CR AVAILABLE</span></div><p>Purchases subtract credits at launch. Successful scans pay a grant. Destination changes never change this balance.</p><div class="table-scroll"><table><tr><th>Transaction</th><th>Credits</th></tr>${[...campaign.ledger].reverse().map(e => `<tr><td>${escapeHTML(e.type)}</td><td class="${e.amount < 0 ? 'fail' : 'pass'}">${e.amount > 0 ? '+' : ''}${fmt(e.amount)} CR</td></tr>`).join('')}</table></div><p class="help">Prices and grants are game credits, not real mission costs.</p><button class="secondary danger" id="reset-ledger">Reset campaign</button>`);
  $('#reset-ledger').onclick = confirmReset;
}
function confirmReset() {
  modal('<div class="label">NEW CAMPAIGN</div><h2>Start again?</h2><p>This resets the saved balance, badges, and history. Any active rocket is discarded.</p><div class="actions"><button class="primary" id="confirm-reset">Start new campaign ↗</button><button class="secondary" id="cancel-reset">Keep campaign</button></div>');
  $('#cancel-reset').onclick = closeModal;
  $('#confirm-reset').onclick = () => { flightController?.destroy(); flightController = null; campaign = newCampaign(); parts = defaultParts(); selected = 'Venus'; lastResult = null; rewardPending = false; saveCampaign(); closeModal(); go(0); };
}
function archive() {
  modal(`<div class="label">EXPLORATION LOG</div><h2>Flight archive</h2>${campaign.records.length ? `<p>${campaign.records.filter(r => r.success).length} successful missions. Credits are tracked independently of badges.</p><div class="table-scroll"><table><tr><th>World</th><th>Outcome</th><th>Net credits</th></tr>${[...campaign.records].reverse().map(r => `<tr><td>${escapeHTML(r.planet)}</td><td>${r.success ? '✧ Explorer' : 'Mission failed'}</td><td class="${r.reward - r.cost >= 0 ? 'pass' : 'fail'}">${fmt(r.reward - r.cost)} CR</td></tr>`).join('')}</table></div>` : '<p class="empty">No flights logged yet.<br>Build a rocket to start your first expedition.</p>'}`);
}
function notes() {
  modal(`<div class="label">OPEN SCIENCE</div><h2>NASA data. Clear game rules.</h2><p><strong>data.js</strong> begins with the verbatim <strong>NASA_ORRERY_DATA</strong> constant. All game prices, unlocks, collision damage and fuel scaling are separate in <strong>GAME_RULES</strong>.</p>
  <h3>Solar system</h3><p><a href="${SOURCES.orrery}" target="_blank" rel="noopener">NASA orrery</a> provides a, e, period and orientation. The solver uses M=2πt/P and ten Newton iterations for E−e sin E=M, then rotates (a(cos E−e), a√(1−e²)sin E) by omega+raan, matching your Godot example. All orbits share 24,000 world units/AU (20× the previous map) and 0.08 simulated days per second. The source has no common epoch: phase zero is illustrative, not today's positions. The 2D projection retains but does not apply inclination/tau.</p><p>Planet bodies are circular pixel sprites. Their display radius is 65 × (diameter / Earth diameter)^0.55, using NASA fact-sheet diameters. The Sun uses twice its 695,700 km mean radius from the <a href="${SOURCES.sun}" target="_blank" rel="noopener">NASA Sun Fact Sheet</a>. This separate, compressed size scale makes small planets visible and the Sun clearly largest; it does not alter the linear orbital scale. Earth distances are model vector separations. The <a href="${SOURCES.units}" target="_blank" rel="noopener">NASA AU conversion</a> supplies kilometers. Gravity acts from every planet and the Sun, with game softening and local scale factors.</p>
  <h3>Background art</h3><p>The drifting stars, stellar explosions, supernova shell and black-hole formation are decorative pixel-art scenes, not modeled observations. Events last 12–18 seconds and fade away. Pause background stops them; reduced-motion preferences disable them.</p><h3>Engine specifications</h3><p><a href="${SOURCES.rl10}" target="_blank" rel="noopener">RL10A-3-3A · NTRS p.176</a>: 16,500 lbf vacuum thrust, 305 lb, 444.4 s Isp, 5:1 O/F, converted to N and kg. <a href="${SOURCES.j2x}" target="_blank" rel="noopener">J-2X · NTRS slide 2</a>: 1,307 kN, 2,516 kg, minimum 448 s Isp, 5.5 O/F, from 2009 development requirements. Both use LH₂/LOX. J-2X is not presented as operationally flown.</p><p>The builder keeps kg and kN. Ideal Δv = Isp g₀ ln(wet/dry) and flow = thrust/(Isp g₀), following the <a href="${SOURCES.equation}" target="_blank" rel="noopener">NASA rocket equation</a>. A fixed 740 kg orbiter chassis is a design allocation, not measured NASA hardware. The Earth-reference thrust check uses vacuum ratings as a classroom comparison. Flight begins outside Earth.</p>
  <h3>Progression & credits</h3><p>New campaigns start at ${GAME_RULES.initialCredits} game credits, with Venus and basic parts unlocked. Wins open Mars, Mercury, Jupiter, Saturn, Uranus, Neptune, then Pluto. Cards show wins still needed. Each extra instrument adds 30% of the base grant, and base grants increase with route difficulty. Two-engine boosters, 8,000 kg fuel and thermal imaging unlock after one win; the magnetometer after two; J-2X and 20,000 kg fuel after three; four-engine boosters after four; 50,000 kg fuel after five. Prices and grants are fictional credits, not real mission costs.</p><p>Shopping is free until Buy & launch. Purchases charge once. Wins pay once; failures have no refund. Bankruptcy occurs after a flight if fewer than ${minimumMissionCost()} CR remain for the cheapest build. Only an explicit restart restores the starting balance. Existing saved credits and completed missions are preserved when upgrading to this version.</p>
  <h3>Flight</h3><p>Fuel is shown as remaining percent. Throttle rises over 1.4 seconds; thrust uses F/m to change velocity, with no artificial top speed or drag. Coasting conserves momentum. Braking, steering, and stabilization use fuel; burn rate is accelerated 5× for game difficulty. The opposite side jet fires to rotate the nose. More boosters improve turn acceleration and rate; added mass reduces both. These steering allocations are game rules, not published NASA engine torque ratings. Empty fuel fails the mission. Scanning starts automatically in the chosen planet's cyan band; stay there for ${GAME_RULES.scanSeconds} scan seconds. No F key, hidden speed requirement or extra action is needed. Gentle stabilization helps once inside.</p><p>Hull starts at 100%. Target impacts remove 25%, solar heat 40%, asteroids 30%, comets 55%, and belt rocks 30%. A short cooldown prevents one contact from counting as many impacts. The ship is knocked back. Only zero hull ends the flight.</p><p>Other planets exert gravity but do not scan or award a mission. The <a href="${SOURCES.asteroids}" target="_blank" rel="noopener">main belt is between Mars and Jupiter</a>. The game band spans 2.1–3.5 model AU. Large deterministic rocks fill the whole band, with denser streams and more comets while crossing. These boundaries, density, rock sizes and comets are schematic challenge settings, not measured asteroid data. Real interplanetary asteroid spacing is not depicted. Outer-planet and Pluto routes activate these hazards.</p><p>Flight distances, thrust, gravity, time and consumption are compressed separately for play. This is not an actual trajectory simulation; see <a href="${SOURCES.trajectory}" target="_blank" rel="noopener">NASA Trajectory Browser</a> for real planning. Unlocks, chassis/payload allocation and credit prices are game rules.</p><p>Discoveries are existing <a href="${SOURCES.facts}" target="_blank" rel="noopener">NASA fact-sheet</a> values unlocked by instruments. <a href="${SOURCES.science}" target="_blank" rel="noopener">Solar System Exploration</a> supports descriptions; the <a href="${SOURCES.data}" target="_blank" rel="noopener">planetary data directory</a> links real observation archives.</p>
  <div class="table-scroll"><table><tr><th>World</th><th>a / AU</th><th>Period / days</th><th>e</th></tr>${Object.entries(NASA_ORRERY_DATA).map(([name,o])=>`<tr><td>${name}</td><td>${o.sma}</td><td>${o.period}</td><td>${o.eccentricity}</td></tr>`).join('')}</table></div>`);
}


$('.close').onclick = closeModal;
$('#sources-nav').onclick = $('#method-footer').onclick = notes;
$('#archive-nav').onclick = archive; $('#wallet').onclick = ledger;
$('#mission-nav').onclick = () => requestStage(0);

window.addEventListener('pagehide', () => { if (flightController) saveFlight(flightController.state); });
window.addEventListener('scroll', positionPartInfo, { passive: true, capture: true });
window.addEventListener('resize', positionPartInfo, { passive: true });
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePartInfo(); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.part-row,.part-popover')) hidePartInfo(); });
document.addEventListener('focusin', event => { if (!event.target.closest('.part-row,.part-popover')) hidePartInfo(); });
saveCampaign(); render();
