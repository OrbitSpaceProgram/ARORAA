// NASA_ORRERY_DATA is the first constant in data.js. core.js contains the equations.
const SAVE_KEY = 'orbit-foundry-campaign-v3';
const $ = s => document.querySelector(s);
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let storageAvailable = true;
let campaign = loadCampaign();
let selected = campaign.mission?.target || WORLDS[unlockedWorldCount(campaign) - 1].name;
let parts = campaign.mission ? clone(campaign.mission.parts) : defaultParts();
let step = campaign.mission ? 2 : 0;
let lastResult = null, flightController = null, transitioning = false;
let planetAnimation = 0, rewardAnimation = 0, rewardPending = false;
const coinAnimations = [];
const sprites = new Map();

function loadCampaign() {
  try {
    const c = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem('orbit-foundry-campaign-v2') || 'null');
    if (!c || ![2, 3].includes(c.version) || !Number.isSafeInteger(c.credits) || c.credits < 0
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
    c.version = 3;
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
  document.querySelectorAll('[data-step]').forEach(b => {
    b.classList.toggle('active', +b.dataset.step === step);
    b.setAttribute('aria-current', +b.dataset.step === step ? 'step' : 'false');
  });
}
function render() {
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
function drawRocket(c, x, y, angle, scale, config, burning = false) {
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
  c.restore();
}

function destinations(direction = 0) {
  cancelAnimationFrame(planetAnimation);
  const index = WORLDS.findIndex(w => w.name === selected), w = worldInfo(selected);
  const open = destinationUnlocked(campaign, selected), distance = earthDistance(selected, campaign.days);
  $('#screen').innerHTML = `<div class="destination-heading"><div><span class="label">CHOOSE YOUR NEXT CHAPTER</span><h1>A whole universe of possibility.</h1></div><span class="progress-label">${unlockedWorldCount(campaign)} / 8 WORLDS UNLOCKED</span></div>
  <section class="destination-deck ${open ? '' : 'destination-locked'}" aria-roledescription="carousel" aria-label="Mission destinations" tabindex="0">
  <button class="carousel-arrow previous" id="previous-world" aria-label="Previous planet">←</button>
  <article class="destination-card ${direction > 0 ? 'slide-next' : direction < 0 ? 'slide-prev' : ''}" aria-live="polite">
    <div class="world-stage"><span class="world-coordinate">SOL SYSTEM / 0${index + 1}</span><div class="world-orbit orbit-one"></div><div class="world-orbit orbit-two"></div><div class="planet-float"><canvas id="destination-planet" aria-label="Animated circular pixel-art ${selected}"></canvas></div><span class="world-classification">${w.type.toUpperCase()}</span></div>
    <div class="destination-copy"><span class="destination-status ${open ? 'pass' : ''}">${open ? '● MISSION AVAILABLE' : '◇ DESTINATION LOCKED'}</span><h2>${selected}<span>0${index + 1}</span></h2><p>${w.description}</p><div class="card-science">${w.science.map(s => `<span>${s}</span>`).join('')}</div><div class="destination-stats"><div><small>FROM EARTH · MODEL</small><strong>${fmt(distance, 3)} <em>AU</em></strong><span>${fmt(distance * UNITS.kmPerAU / 1e6, 1)} million km</span></div><div><small>MISSION REWARD</small><strong>+${fmt(missionReward(selected, defaultParts()))} <em>CR</em></strong><span>Added to your global credits</span></div></div>
    <button class="primary" id="build" ${open ? '' : 'disabled'}>${open ? 'Build your rocket' : 'Win ' + index + ' mission' + (index === 1 ? '' : 's') + ' to unlock'} <span>${open ? '↗' : '◇'}</span></button><p class="progress-hint">${open ? 'Every successful mission unlocks a new world.' : 'Complete an available expedition to move forward.'}</p></div>
  </article><button class="carousel-arrow next" id="next-world" aria-label="Next planet">→</button></section>
  <div class="carousel-footer"><span>0${index + 1} <b>/ 08</b></span><div class="carousel-dots" aria-label="Planet navigation">${WORLDS.map((p, i) => `<button data-planet="${p.name}" class="${p.name === selected ? 'selected' : ''} ${destinationUnlocked(campaign, p.name) ? 'unlocked' : 'locked'}" aria-label="${p.name}${destinationUnlocked(campaign, p.name) ? '' : ', locked'}" aria-pressed="${p.name === selected}" title="${p.name}"><span></span></button>`).join('')}</div><button class="text-button notes">NASA data ↗</button></div>`;
  const canvas = $('#destination-planet'); drawPlanet(canvas, selected);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let last = 0;
    const animate = time => { if (step !== 0 || !canvas.isConnected) return; if (time - last > 70) { drawPlanet(canvas, selected, time * 0.004); last = time; } planetAnimation = requestAnimationFrame(animate); };
    planetAnimation = requestAnimationFrame(animate);
  }
  function move(offset) { selected = WORLDS[(index + offset + WORLDS.length) % WORLDS.length].name; destinations(offset); }
  $('#previous-world').onclick = () => move(-1); $('#next-world').onclick = () => move(1);
  $('.destination-deck').onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); $('.destination-deck').focus(); } };
  let touchX = null;
  $('.world-stage').onpointerdown = e => touchX = e.clientX;
  $('.world-stage').onpointerup = e => { if (touchX !== null && Math.abs(e.clientX - touchX) > 45) move(e.clientX < touchX ? 1 : -1); touchX = null; };
  document.querySelectorAll('[data-planet]').forEach(b => b.onclick = () => { const previous = index; selected = b.dataset.planet; destinations(WORLDS.findIndex(w => w.name === selected) > previous ? 1 : -1); });
  $('#build').onclick = () => { if (open) { parts = recommendedParts(campaign, selected); go(1); } };
  $('.notes').onclick = notes;
}

function partButton(key, index, title, detail, price) {
  const chosen = key === 'instruments' ? parts.instruments.includes(index) : parts[key] === index;
  const required = partUnlockLevel(key, index), locked = required > campaignLevel(campaign);
  return `<button class="part ${chosen ? 'selected' : ''} ${locked ? 'part-locked' : ''}" data-part="${key}" data-index="${index}" aria-pressed="${chosen}" ${locked ? 'disabled' : ''}><span>${title}<small>${locked ? '◇ Unlock after ' + required + ' successful mission' + (required === 1 ? '' : 's') : detail}</small></span><span>${fmt(price)} CR${chosen && !locked ? ' ✓' : ''}</span></button>`;
}

function lab() {
  const s = engineering(parts), e = NASA_ENGINES[parts.engine], checks = launchChecks(parts, campaign.credits, campaignLevel(campaign));
  $('#screen').innerHTML = `<div class="section-heading"><div><span class="label">ROCKET LAB / ${selected.toUpperCase()}</span><h2>A small build. A big mission.</h2><p>Choose your loadout. Win missions to unlock more.</p></div><span class="tag">${campaignLevel(campaign)} SUCCESSFUL MISSIONS</span></div><div class="lab-layout simplified-lab"><div class="parts-grid">
  <section class="panel"><h3><span>01</span> Engine</h3>${NASA_ENGINES.map((p, i) => partButton('engine', i, p.name, `${fmt(p.thrustN / 1000, 1)} kN · ${fmt(p.massKg, 1)} kg`, GAME_RULES.enginePrices[i])).join('')}<small class="part-note">NASA engine specifications · vacuum ratings</small></section>
  <section class="panel"><h3><span>02</span> Boosters</h3>${GAME_RULES.boosterCounts.map(n => partButton('boosters', n, n === 1 ? 'Single engine' : `${n}-engine cluster`, `${fmt(e.thrustN * n / 1000, 1)} kN total thrust`, GAME_RULES.enginePrices[parts.engine] * n)).join('')}<small class="part-note">Engine price × count · charged once</small></section>
  <section class="panel"><h3><span>03</span> Fuel</h3>${GAME_RULES.fuelLoads.map((kg, i) => partButton('fuel', i, `${fmt(kg)} kg`, 'Liquid hydrogen + liquid oxygen', GAME_RULES.fuelPrices[i])).join('')}<small class="part-note">More fuel lasts longer, but adds mass.</small></section>
  <section class="panel"><h3><span>04</span> Scientific instruments</h3>${GAME_RULES.instruments.map((p, i) => partButton('instruments', i, p.name, `${p.massKg} kg · unlocks a science finding`, p.cost)).join('')}<small class="part-note">Take at least one instrument.</small></section>
  </div><aside class="panel assembly-summary"><span class="label">YOUR ${selected.toUpperCase()} ORBITER</span><div class="rocket-stage"><canvas id="rocket-preview" aria-label="Your custom rocket"></canvas></div><div class="cart-total"><span>Launch cost</span><strong>${fmt(s.cost)} <small>CR</small></strong></div><div class="wallet-after">${fmt(campaign.credits)} CR available <b class="${s.cost > campaign.credits ? 'fail' : 'pass'}">${fmt(campaign.credits - s.cost)} CR after launch</b></div><div class="check"><span>Orbiter chassis included</span><span>${GAME_RULES.chassisPrice} CR</span></div><div class="check"><span>Launch checks</span><span class="${checks.every(c => c.ok) ? 'pass' : 'fail'}">${checks.every(c => c.ok) ? '✓ Ready' : 'Needs revision'}</span></div><button class="primary" id="launch">Buy & launch <span>↗</span></button><p class="help">A win earns <strong>+${fmt(missionReward(selected, parts))} CR</strong> and unlocks the next world.</p><details class="engineering-details"><summary>Engineering & NASA data</summary><div class="engineering-stats"><div><small>WET MASS</small><strong>${fmt(s.wetKg)} kg</strong></div><div><small>THRUST</small><strong>${fmt(s.thrustN / 1000, 1)} kN</strong></div><div><small>IDEAL ΔV</small><strong>${fmt(s.deltaV)} m/s</strong></div><div><small>ISP</small><strong>${e.ispSeconds} s</strong></div></div><a href="${e.source}" target="_blank" rel="noopener">NASA engine reference ↗</a><p class="help">Credits, chassis mass, and game difficulty are design choices. ΔV is an ideal comparison, not a real mission prediction.</p></details></aside></div><div class="lab-bottom"><button class="secondary" id="back">← Destination</button><button class="text-button" id="demo">Recommended loadout ↗</button></div>`;
  const canvas = $('#rocket-preview'); canvas.width = 128; canvas.height = 128;
  drawRocket(canvas.getContext('2d'), 64, 64, -Math.PI / 2, 2.1, parts, true);
  document.querySelectorAll('[data-part]').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    const key = b.dataset.part, i = +b.dataset.index;
    if (key === 'instruments') parts.instruments = parts.instruments.includes(i) ? parts.instruments.filter(v => v !== i) : [...parts.instruments, i];
    else parts[key] = i;
    lab();
  });
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
    ${r.success ? `<div class="reward-award"><span>SPONSOR GRANT</span><strong id="reward-amount">+${fmt(r.reward)} <small>CR</small></strong></div><div class="discoveries">${discoveryCards(r.planet, r.parts)}</div><div class="unlock-reveal">${unlocked ? '<span>✧ ' + unlocked + ' unlocked</span>' : '<span>✧ All worlds unlocked</span>'}${campaignLevel(campaign) <= 5 ? '<span>New parts in the rocket lab</span>' : ''}</div>` : `<p class="loss-balance">${fmt(campaign.credits)} CR remaining · Rocket cost ${fmt(r.cost)} CR</p>`}
    <div class="result-actions"><button class="primary" id="next-mission">${r.success ? unlocked ? 'Explore ' + unlocked : 'Choose your next mission' : 'Build another rocket'} <span>↗</span></button><button class="text-button" id="view-ledger">View credits</button></div>${r.success ? '<small class="result-reference">NASA reference facts unlocked by your instruments. <a href="' + SOURCES.facts + '" target="_blank" rel="noopener">View source ↗</a></small>' : '<small class="result-reference">Your next attempt uses the same global credit balance.</small>'}</section>`;
  if (r.success) drawPlanet($('#result-planet'), r.planet);
  $('#next-mission').onclick = () => { rewardPending = false; if (r.success && unlocked) selected = unlocked; go(r.success ? 0 : 1); };
  $('#view-ledger').onclick = ledger;
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
  $('#confirm-reset').onclick = () => { flightController?.destroy(); flightController = null; campaign = newCampaign(); parts = defaultParts(); selected = 'Mercury'; lastResult = null; rewardPending = false; saveCampaign(); closeModal(); go(0); };
}
function archive() {
  modal(`<div class="label">EXPLORATION LOG</div><h2>Flight archive</h2>${campaign.records.length ? `<p>${campaign.records.filter(r => r.success).length} successful missions. Credits are tracked independently of badges.</p><div class="table-scroll"><table><tr><th>World</th><th>Outcome</th><th>Net credits</th></tr>${[...campaign.records].reverse().map(r => `<tr><td>${escapeHTML(r.planet)}</td><td>${r.success ? '✧ Explorer' : 'Mission failed'}</td><td class="${r.reward - r.cost >= 0 ? 'pass' : 'fail'}">${fmt(r.reward - r.cost)} CR</td></tr>`).join('')}</table></div>` : '<p class="empty">No flights logged yet.<br>Build a rocket to start your first expedition.</p>'}`);
}
function notes() {
  modal(`<div class="label">OPEN SCIENCE</div><h2>NASA data. Clear game rules.</h2><p><strong>data.js</strong> begins with the verbatim <strong>NASA_ORRERY_DATA</strong> constant. All game prices, unlocks, collision damage and fuel scaling are separate in <strong>GAME_RULES</strong>.</p>
  <h3>Solar system</h3><p><a href="${SOURCES.orrery}" target="_blank" rel="noopener">NASA orrery</a> provides a, e, period and orientation. The solver uses M=2πt/P and ten Newton iterations for E−e sin E=M, then rotates (a(cos E−e), a√(1−e²)sin E) by omega+raan, matching your Godot example. All orbits share 1,200 world units/AU and one day per second. The source has no common epoch: phase zero is illustrative, not today's positions. The 2D projection retains but does not apply inclination/tau.</p><p>Planet bodies are circular pixel sprites; their display sizes are exaggerated. Earth distances are model vector separations. The <a href="${SOURCES.units}" target="_blank" rel="noopener">NASA AU conversion</a> supplies kilometers. Gravity acts from every planet and the Sun, with game softening and local scale factors.</p>
  <h3>Engine specifications</h3><p><a href="${SOURCES.rl10}" target="_blank" rel="noopener">RL10A-3-3A · NTRS p.176</a>: 16,500 lbf vacuum thrust, 305 lb, 444.4 s Isp, 5:1 O/F, converted to N and kg. <a href="${SOURCES.j2x}" target="_blank" rel="noopener">J-2X · NTRS slide 2</a>: 1,307 kN, 2,516 kg, minimum 448 s Isp, 5.5 O/F, from 2009 development requirements. Both use LH₂/LOX. J-2X is not presented as operationally flown.</p><p>The builder keeps kg and kN. Ideal Δv = Isp g₀ ln(wet/dry) and flow = thrust/(Isp g₀), following the <a href="${SOURCES.equation}" target="_blank" rel="noopener">NASA rocket equation</a>. A fixed 740 kg orbiter chassis is a design allocation, not measured NASA hardware. The Earth-reference thrust check uses vacuum ratings as a classroom comparison. Flight begins outside Earth.</p>
  <h3>Progression & credits</h3><p>New campaigns start at ${GAME_RULES.initialCredits} game credits, with Mercury and basic parts unlocked. Every win opens the next world. Two-engine boosters, 8,000 kg fuel and thermal imaging unlock after one win; the magnetometer after two; J-2X and 20,000 kg fuel after three; four-engine boosters after four; 50,000 kg fuel after five. Prices and grants are fictional credits, not real mission costs.</p><p>Shopping is free until Buy & launch. Purchases charge once. Wins pay once; failures have no refund. Bankruptcy occurs after a flight if fewer than ${minimumMissionCost()} CR remain for the cheapest build. Only an explicit restart restores the starting balance. Existing saved credits and completed missions are preserved when upgrading to this version.</p>
  <h3>Flight</h3><p>Fuel is shown as remaining percent, with faster game consumption so boost is a meaningful trade-off. Empty fuel fails the mission. Scanning starts automatically in the chosen planet's cyan band; stay there for ${GAME_RULES.scanSeconds} scan seconds. No F key, hidden speed requirement or extra action is needed. Gentle stabilization helps once inside.</p><p>Hull starts at 100%. Target impacts remove 25%, solar heat 40%, asteroids 30%, comets 55%, and belt rocks 24%. A short cooldown prevents one contact from counting as many impacts. The ship is knocked back. Only zero hull ends the flight.</p><p>Other planets exert gravity but do not scan or award a mission. The <a href="${SOURCES.asteroids}" target="_blank" rel="noopener">main belt is between Mars and Jupiter</a>. Display bounds, asteroid positions, density and comets are schematic hazards, not an asteroid dataset. Outer-planet and Pluto routes activate these hazards.</p><p>Flight distances, thrust, gravity, time and consumption are compressed separately for play. This is not an actual trajectory simulation; see <a href="${SOURCES.trajectory}" target="_blank" rel="noopener">NASA Trajectory Browser</a> for real planning. Unlocks, chassis/payload allocation and credit prices are game rules.</p><p>Discoveries are existing <a href="${SOURCES.facts}" target="_blank" rel="noopener">NASA fact-sheet</a> values unlocked by instruments. <a href="${SOURCES.science}" target="_blank" rel="noopener">Solar System Exploration</a> supports descriptions; the <a href="${SOURCES.data}" target="_blank" rel="noopener">planetary data directory</a> links real observation archives.</p>
  <div class="table-scroll"><table><tr><th>World</th><th>a / AU</th><th>Period / days</th><th>e</th></tr>${Object.entries(NASA_ORRERY_DATA).map(([name,o])=>`<tr><td>${name}</td><td>${o.sma}</td><td>${o.period}</td><td>${o.eccentricity}</td></tr>`).join('')}</table></div>`);
}


$('.close').onclick = closeModal;
$('#sources-nav').onclick = $('#method-footer').onclick = notes;
$('#archive-nav').onclick = archive; $('#wallet').onclick = ledger;
$('#mission-nav').onclick = () => requestStage(0);
document.querySelectorAll('[data-step]').forEach(b => b.onclick = () => requestStage(+b.dataset.step));
window.addEventListener('pagehide', () => { if (flightController) saveFlight(flightController.state); });
saveCampaign(); render();
