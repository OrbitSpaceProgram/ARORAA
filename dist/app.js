// NASA_ORRERY_DATA is the first constant in data.js. core.js contains the equations.
const SAVE_KEY = 'orbit-foundry-campaign-v2';
const $ = s => document.querySelector(s);
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let storageAvailable = true;
let campaign = loadCampaign();
let selected = campaign.mission?.target || 'Mars';
let parts = campaign.mission ? clone(campaign.mission.parts) : defaultParts();
let step = campaign.mission ? 2 : 0;
let lastResult = null, flightController = null, transitioning = false;
const sprites = new Map();

function loadCampaign() {
  try {
    const c = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!c || c.version !== 2 || !Number.isSafeInteger(c.credits) || c.credits < 0
      || !Number.isSafeInteger(c.sequence) || !Number.isFinite(c.days)
      || !Array.isArray(c.records) || !Array.isArray(c.ledger)) return newCampaign();
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
  $('#wallet-value').textContent = fmt(campaign.credits) + ' CR';
  $('#wallet').setAttribute('aria-label', `Global balance ${campaign.credits} credits. Open ledger`);
  document.querySelectorAll('[data-step]').forEach(b => {
    b.classList.toggle('active', +b.dataset.step === step);
    b.setAttribute('aria-current', +b.dataset.step === step ? 'step' : 'false');
  });
}
function render() {
  if (flightController) { flightController.destroy(); flightController = null; }
  document.body.classList.toggle('flight-mode', step === 2);
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
  } else if (next === 0 || next === 1) go(next);
  else if (next === 3 && lastResult) go(3);
  else modal('<h2>Build. Buy. Then fly.</h2><p>Buy an assembled spacecraft in the rocket lab to launch a mission.</p>');
}
function worldInfo(name) { return WORLDS.find(w => w.name === name) || { name: 'Earth', type: 'Home world', color: '#6babd6' }; }

function drawPlanet(canvas, name) {
  canvas.width = 128; canvas.height = 112;
  const c = canvas.getContext('2d'), color = worldInfo(name).color, r = name === 'Saturn' ? 30 : 38;
  c.imageSmoothingEnabled = false;
  if (name === 'Saturn') { c.strokeStyle = '#83734c'; c.lineWidth = 8; c.beginPath(); c.ellipse(64, 56, 58, 14, -0.3, 0, TAU); c.stroke(); }
  for (let y = -r; y <= r; y += 2) for (let x = -r; x <= r; x += 2) {
    if (x * x + y * y > r * r) continue;
    c.fillStyle = color; c.fillRect(64 + x, 56 + y, 2, 2);
    const noise = Math.sin(x * 2.3 + y * 5.1) * Math.cos(x * 0.5 - y * 0.8);
    const banded = ['Jupiter', 'Saturn', 'Neptune'].includes(name);
    if (banded && Math.floor((y + r) / 7) % 3 === 0) { c.fillStyle = '#76533c55'; c.fillRect(64 + x, 56 + y, 2, 2); }
    if (!banded && noise > 0.47) { c.fillStyle = name === 'Earth' ? '#73a578' : '#4e2a253d'; c.fillRect(64 + x, 56 + y, 2, 2); }
    const shade = Math.max(0, x / r + 0.15) * 0.56 + Math.max(0, (x * x + y * y) / (r * r) - 0.65) * 0.28;
    c.fillStyle = `rgba(4,9,25,${shade})`; c.fillRect(64 + x, 56 + y, 2, 2);
  }
  if (name === 'Mars') { c.fillStyle = '#ecd7d1'; c.fillRect(52, 18, 21, 3); c.fillRect(56, 21, 15, 3); }
  if (name === 'Jupiter') { c.fillStyle = '#aa6a58'; c.fillRect(72, 65, 17, 7); c.fillRect(75, 63, 10, 10); }
  if (name === 'Saturn') { c.strokeStyle = '#d4bd87'; c.lineWidth = 5; c.beginPath(); c.ellipse(64, 56, 58, 14, -0.3, 0, Math.PI); c.stroke(); }
}
function planetSprite(name) {
  if (!sprites.has(name)) { const c = document.createElement('canvas'); drawPlanet(c, name); sprites.set(name, c); }
  return sprites.get(name);
}
function drawRocket(c, x, y, angle, scale, config, burning = false) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  c.fillStyle = NASA_MATERIALS[config.material].color;
  c.fillRect(-12, -5, 23, 10); c.fillRect(11, -3, 6, 6); c.fillRect(17, -1, 4, 2);
  c.fillStyle = '#ebf9ff'; c.fillRect(-8, -5, 17, 2);
  c.fillStyle = '#75e9ed'; c.fillRect(4, -3, 5, 5);
  c.fillStyle = '#5c82b1'; c.fillRect(-10, -10, 10, 5); c.fillRect(-10, 5, 10, 5);
  if (config.boosters >= 2) { c.fillStyle = '#a2b4ca'; c.fillRect(-14, -8, 13, 3); c.fillRect(-14, 5, 13, 3); }
  if (config.boosters === 4) { c.fillRect(-16, -12, 12, 3); c.fillRect(-16, 9, 12, 3); }
  if (config.satellite > 0) { c.fillStyle = '#7d7bd2'; c.fillRect(-4, -16, 7, 8); c.fillRect(-4, 8, 7, 8); }
  if (config.instruments.includes(2)) { c.fillStyle = '#98f9d9'; c.fillRect(2, -11, 1, 7); }
  if (burning) { c.fillStyle = '#6bd7f6'; c.fillRect(-23, -4, 11, 8); c.fillStyle = '#b8ffff'; c.fillRect(-20, -2, 8, 4); c.fillStyle = '#596eec'; c.fillRect(-29, -2, 6, 4); }
  c.restore();
}

function destinations() {
  const w = worldInfo(selected), dist = earthDistance(selected, campaign.days);
  $('#screen').innerHTML = `<div class="section-heading"><div><h2>Where will curiosity take you?</h2><p>One campaign. One credit balance. Choose your next science target.</p></div><span class="tag">GLOBAL WALLET · ${fmt(campaign.credits)} CR</span></div>
  <div class="destination-layout"><div><div class="planet-grid">${WORLDS.map((p, i) => `<button class="planet-card ${p.name === selected ? 'selected' : ''}" data-planet="${p.name}" aria-pressed="${p.name === selected}"><span class="idx">0${i + 1}</span>${p.name === selected ? '<span class="selected-mark">⊕</span>' : ''}<canvas aria-label="Pixel art ${p.name}"></canvas><h3>${p.name}</h3><small>${p.type.toUpperCase()}</small><span class="difficulty">${i < 3 ? '▰▱▱ · INNER SYSTEM' : i < 5 ? '▰▰▱ · OUTER SYSTEM' : '▰▰▰ · DEEP SPACE'}</span></button>`).join('')}</div><div class="source-line"><span>◈ NASA orbital elements · linear AU scale in flight<br>Model day ${fmt(campaign.days, 1)} · illustrative epoch</span><button class="notes">Explore the data ↗</button></div>
  <div class="campaign-strip"><div><span class="label">CAMPAIGN CAPITAL</span><strong>${fmt(campaign.credits)} <small>CR</small></strong></div><p>Buy your spacecraft at launch. Bring back science to earn more. No destination refills your wallet.</p><button class="secondary" id="ledger-inline">View ledger ↗</button></div></div>
  <aside class="planet-detail"><div class="label">DESTINATION BRIEFING</div><div class="detail-title"><h2>${selected}</h2><span>${w.type.toUpperCase()}</span></div><canvas id="detail-planet" aria-label="${selected} pixel illustration"></canvas><p>${w.description}</p><div class="stats"><div><small>EARTH SEPARATION · MODEL</small><strong>${fmt(dist, 3)} <span style="font-size:11px">AU</span></strong><em>${fmt(dist * UNITS.kmPerAU / 1e6, 1)} million km</em></div><div><small>SUCCESS GRANT</small><strong>${fmt(missionReward(selected, parts))} <span style="font-size:11px">CR</span></strong><em>Game grant · chosen payload</em></div></div><div class="science-list"><div class="label">SCIENCE OPPORTUNITIES</div>${w.science.map(s => `<span>+ &nbsp;${s}</span>`).join('')}<span>+ &nbsp;Orbital & planetary properties</span></div><button class="primary" id="build">Build your rocket <span>↗</span></button></aside></div>`;
  document.querySelectorAll('[data-planet]').forEach(b => { drawPlanet(b.querySelector('canvas'), b.dataset.planet); b.onclick = () => { selected = b.dataset.planet; destinations(); }; });
  drawPlanet($('#detail-planet'), selected);
  $('#build').onclick = () => go(1); $('.notes').onclick = notes; $('#ledger-inline').onclick = ledger;
}
function partButton(key, i, title, detail, price) {
  const chosen = key === 'instruments' ? parts.instruments.includes(i) : parts[key] === i;
  return `<button class="part ${chosen ? 'selected' : ''}" data-part="${key}" data-index="${i}" aria-pressed="${chosen}"><span>${title}<small>${detail}</small></span><span>${fmt(price)} CR${chosen ? ' ✓' : ''}</span></button>`;
}
function lab() {
  const s = engineering(parts), e = NASA_ENGINES[parts.engine];
  $('#screen').innerHTML = `<div class="section-heading"><div><h2>Engineer your next discovery.</h2><p>Build for ${selected}. Preview freely; credits are charged when you buy and launch.</p></div><span class="tag">GLOBAL WALLET · ${fmt(campaign.credits)} CR</span></div><div class="lab-layout"><div><div class="parts-grid">
  <section class="panel"><h3>01 · Engine</h3><p class="help">Real vacuum ratings. Mass and specific impulse feed the model.</p>${NASA_ENGINES.map((p, i) => partButton('engine', i, p.name, `${fmt(p.massKg, 1)} kg · ${fmt(p.thrustN / 1000, 1)} kN · Isp ${p.ispSeconds} s`, GAME_RULES.enginePrices[i])).join('')}<a class="small-source" href="${e.source}" target="_blank" rel="noopener">NASA specification ↗</a><p class="help">${e.note}</p></section>
  <section class="panel"><h3>02 · Booster cluster</h3><p class="help">More engines add thrust, mass, speed, and fuel consumption.</p>${GAME_RULES.boosterCounts.map(n => partButton('boosters', n, `${n} × ${e.name}`, `${fmt(e.thrustN * n / 1000, 1)} kN · ${fmt(e.massKg * n, 1)} kg`, GAME_RULES.enginePrices[parts.engine] * n)).join('')}<p class="help">Engine price × count. Charged once in the total.</p></section>
  <section class="panel"><h3>03 · Fuel & oxidizer</h3><div class="fuel-type">LH₂ + LOX <span>${e.oxidizerRatio}:1 oxidizer / fuel</span></div><p class="help">Liquid hydrogen + liquid oxygen. Choose the total propellant mass.</p>${GAME_RULES.fuelLoads.map((kg, i) => partButton('fuel', i, `${fmt(kg)} kg propellant`, `${fmt(kg / (1 + e.oxidizerRatio), 1)} kg LH₂ + ${fmt(kg * e.oxidizerRatio / (1 + e.oxidizerRatio), 1)} kg LOX`, GAME_RULES.fuelPrices[i])).join('')}</section>
  <section class="panel"><h3>04 · Rocket material</h3><p class="help">Same 0.2 m³ of material. More mass means slower acceleration and more game endurance.</p>${NASA_MATERIALS.map((m, i) => partButton('material', i, m.name, `${fmt(m.density)} kg/m³ · ${fmt(m.density * GAME_RULES.hullVolumeM3)} kg hull · ${GAME_RULES.hullHP[i]} HP`, GAME_RULES.materialPrices[i])).join('')}<a class="small-source" href="${SOURCES.materials}" target="_blank" rel="noopener">NASA/JPL density table F-4 ↗</a></section>
  <section class="panel"><h3>05 · Satellite</h3><p class="help">Your satellite design; mass is a payload allocation.</p>${GAME_RULES.satellites.map((p, i) => partButton('satellite', i, p.name, `${p.massKg} kg · ${p.scanRate}× scan rate`, p.cost)).join('')}</section>
  <section class="panel"><h3>06 · Scientific instruments</h3><p class="help">Select one or more. Each unlocks different NASA facts.</p>${GAME_RULES.instruments.map((p, i) => partButton('instruments', i, p.name, `${p.massKg} kg allocated payload`, p.cost)).join('')}</section>
  </div><div class="notice">Engine ratings and material densities are NASA-sourced. Hull volume, tank allocation, satellite designs, HP, and credit prices are design choices. Departure begins outside Earth. <button class="text-button notes">Sources & equations ↗</button></div><button class="secondary" id="back">← Change destination</button></div>
  <aside class="panel assembly-summary"><div class="label">LIVE ASSEMBLY / ${selected.toUpperCase()}</div><div class="rocket-stage"><canvas id="rocket-preview" aria-label="Your assembled rocket"></canvas></div><h3>Launch purchase</h3><div class="budget-line">${fmt(s.cost)} <span>CR</span></div><div class="wallet-after">${fmt(campaign.credits)} wallet → <b class="${s.cost > campaign.credits ? 'fail' : 'pass'}">${fmt(campaign.credits - s.cost)} CR after purchase</b></div>
  <div class="engineering-stats"><div><small>WET MASS</small><strong>${fmt(s.wetKg, 1)} kg</strong></div><div><small>DRY MASS</small><strong>${fmt(s.dryKg, 1)} kg</strong></div><div><small>INITIAL ACCELERATION</small><strong>${fmt(s.acceleration, 1)} m/s²</strong></div><div><small>IDEAL ΔV</small><strong>${fmt(s.deltaV)} m/s</strong></div><div><small>FULL-THRUST FLOW</small><strong>${fmt(s.massFlow, 1)} kg/s</strong></div><div><small>HULL ENDURANCE</small><strong>${s.hp} HP</strong></div></div>
  ${launchChecks(parts, campaign.credits).map(c => `<div class="check"><span>${c.ok ? '✓' : '×'} ${c.title}</span><span class="${c.ok ? 'pass' : 'fail'}">${c.value}</span></div>`).join('')}<div class="check"><span>Integration + avionics</span><span>${GAME_RULES.integrationPrice} CR</span></div><button class="primary" id="launch">Buy & launch <span>↗</span></button><p class="help">Spends ${fmt(s.cost)} CR from your global balance. A failed flight does not refund the rocket.</p><button class="secondary" id="demo">Recommended assembly ✧</button><p class="help">Ideal ΔV is a real rocket-equation calculation, not a prediction that this design can reach ${selected}.</p></aside></div>`;
  const c = $('#rocket-preview'); c.width = 120; c.height = 150; drawRocket(c.getContext('2d'), 60, 70, -Math.PI / 2, 2.5, parts, true);
  document.querySelectorAll('[data-part]').forEach(b => b.onclick = () => {
    const key = b.dataset.part, i = +b.dataset.index;
    if (key === 'instruments') parts.instruments = parts.instruments.includes(i) ? parts.instruments.filter(v => v !== i) : [...parts.instruments, i];
    else parts[key] = i;
    lab();
  });
  $('#back').onclick = () => go(0); $('.notes').onclick = notes; $('#launch').onclick = purchaseAndLaunch;
  $('#demo').onclick = () => {
    const p = NASA_ORRERY_DATA[selected].sma > 3 ? { engine: 1, boosters: 1, fuel: 2, material: 1, satellite: 0, instruments: [0] } : defaultParts();
    parts = engineering(p).cost <= campaign.credits ? p : { ...defaultParts(), boosters: 1 }; lab();
  };
}
function purchaseAndLaunch() {
  if (campaign.mission || transitioning) return;
  const fail = launchChecks(parts, campaign.credits).filter(c => !c.ok);
  if (fail.length) return modal(`<div class="label">PRE-FLIGHT DIAGNOSTICS</div><h2>Assembly needs a revision.</h2>${fail.map(c => `<p class="fail">× ${c.reason}</p>`).join('')}<p>Nothing was purchased. Your balance is still ${fmt(campaign.credits)} CR.</p>`);
  $('#launch').disabled = true;
  campaign = buyMission(campaign, selected, parts);
  campaign.mission.state = makeFlightState(campaign.mission, campaign.days);
  saveCampaign(); updateHeader(); go(2);
}

function flightScreen() {
  const m = campaign.mission; if (!m) return;
  selected = m.target; parts = clone(m.parts);
  $('#screen').innerHTML = `<div class="section-heading flight-heading"><div><h2>Flight operations</h2><p>Free flight · intercept ${selected}, brake, and enter its orbital sweet spot.</p></div><div class="flight-heading-actions"><button class="secondary" id="fullscreen">Expand ⛶</button><button class="secondary" id="leave-flight">Mission menu</button></div></div>
  <div class="space-flight" id="flight-container"><canvas id="flight" tabindex="0" aria-label="Open solar system. W or Up: thrust. A/D or Left/Right: rotate. Space or S: brake. Shift: boost. F: orbit trim. M: map. P: pause."></canvas>
  <div class="hud telemetry"><div class="hud-title">SHIP TELEMETRY <span id="velocity-readout">0 u/s</span></div><div class="meter-label">HULL INTEGRITY <b id="hull-readout">100%</b></div><div class="meter"><span id="hull-meter"></span></div><div class="meter-label">PROPELLANT <b id="fuel-readout">— kg</b></div><div class="meter fuel-meter"><span id="fuel-meter"></span></div><div class="telemetry-bottom"><span id="gravity-readout">GRAVITY ACTIVE</span><span id="boost-readout">COASTING</span></div></div>
  <div class="hud target-hud"><div class="hud-title">CURRENT EXPEDITION TARGET</div><div class="target-name"><strong>${selected.toUpperCase()}</strong><span id="target-distance">— AU</span></div><div class="target-planets">${WORLDS.map(w => `<span class="${w.name === selected ? 'target-chosen' : ''}" title="${w.name}${w.name === selected ? ': target' : ': no mission reward'}">${w.name.slice(0, 2).toUpperCase()}</span>`).join('')}</div></div>
  <div class="radar-group"><div class="radar-actions"><button id="pause" class="hud-button">START ▷</button><button class="hud-button" id="map-toggle">MAP M</button></div><canvas id="radar" width="160" height="160" aria-label="Solar system radar"></canvas><span>MODEL DAY <b id="day-readout">0</b></span></div>
  <div class="scan-hud hud" id="scan-hud"><div class="hud-title" id="scan-label">INTERCEPT ${selected.toUpperCase()}</div><p id="scan-guidance">Follow the arrow. Start braking before arrival.</p><div class="meter"><span id="scan-meter"></span></div><span id="scan-readout">ORBITAL SCAN 0%</span></div>
  <div class="flight-keyboard"><span><kbd>W ↑</kbd> Thrust</span><span><kbd>A D ← →</kbd> Rotate</span><span><kbd>S SPACE</kbd> Brake</span><span><kbd>SHIFT</kbd> Cruise</span><span><kbd>F</kbd> Orbit trim</span></div>
  <div class="flight-overlay" id="flight-overlay"><div class="flight-brief"><span class="label">FLIGHT DIRECTOR / ${selected.toUpperCase()}</span><h2>Your solar system.<br>Your flight path.</h2><p>Rotate toward the arrow and hold thrust. Coast between burns. Brake early on approach. Keep moving through the cyan orbit zone to scan.</p><div class="brief-controls"><span>W / ↑<small>THRUST</small></span><span>A D / ← →<small>ROTATE</small></span><span>SPACE / S<small>BRAKE</small></span><span>SHIFT<small>CRUISE BOOST</small></span></div><button class="primary" id="start-flight">${m.state?.elapsed > 0 ? 'Resume paid mission' : 'Take flight'} <span>↗</span></button><small>Rocket already paid · ${fmt(campaign.credits)} CR remaining</small></div></div></div>
  <div class="touch-flight-controls"><div><button data-control="left" aria-label="Rotate left">↶</button><button data-control="right" aria-label="Rotate right">↷</button></div><div><button data-control="brake">Brake</button><button id="orbit-trim">Orbit trim F</button><button data-control="boost">Boost</button><button data-control="thrust" class="touch-thrust">Thrust ↑</button></div></div>
  <div class="flight-notes"><span>NASA Keplerian orbits · 1 AU = 1,200 world units · 1 day/s · planet sizes exaggerated</span><button class="text-button notes">Physics & data ↗</button></div><p class="help flight-save-note">One paid rocket, one destination. Other planets never trigger a scan or reward. Progress and credits save in this browser${storageAvailable ? '.' : ' for this session only; browser storage is unavailable.'}</p>`;
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
  lastResult = { ...campaign.records.at(-1), parts: m.parts }; selected = m.target; saveCampaign();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  go(3);
}
function discoveryCards(target, p) {
  const f = NASA_FACTS[target];
  return p.instruments.map(i => {
    const instrument = GAME_RULES.instruments[i]; let title, value, description;
    if (instrument.kind === 'camera') { title = 'A world in perspective'; value = fmt(f.diameter) + ' km'; description = 'NASA planetary diameter. Images help investigate terrain, clouds, or rings, depending on the world.'; }
    if (instrument.kind === 'thermal') { title = 'The thermal picture'; value = f.temperature + ' °C'; description = 'NASA fact-sheet mean temperature. Real measurements vary with location, atmosphere, and observation time.'; }
    if (instrument.kind === 'magnetic') { title = 'A magnetic signature'; value = f.magnetic; description = 'Global magnetic field in the NASA fact sheet. No global field does not exclude local fields; unknown is not evidence of absence.'; }
    return `<article class="panel"><div class="label">${instrument.name.toUpperCase()}</div><h3>${title}</h3><strong>${value}</strong><p>${description}</p><a href="${SOURCES.facts}" target="_blank" rel="noopener">Verify NASA fact ↗</a></article>`;
  }).join('');
}
function results() {
  if (!lastResult) { step = 0; return destinations(); }
  const r = lastResult;
  $('#screen').innerHTML = `<div class="results-hero ${r.success ? '' : 'failure-result'}"><div class="badge">${r.success ? '✧' : '!'}</div><div class="label">${r.success ? 'ORBIT ESTABLISHED · SCIENCE DOWNLINK COMPLETE' : 'SIGNAL LOST · MISSION FAILED'}</div><h2>${r.success ? 'Science secured. Mission complete.' : 'Mission failed.'}</h2><p>${r.success ? `Your ${r.planet} satellite scanned the selected target. Your sponsor grant has been deposited.` : escapeHTML(r.reason)}</p><div class="result-accounting"><span>Rocket purchase <b>−${fmt(r.cost)} CR</b></span><span>Science grant <b class="pass">+${fmt(r.reward)} CR</b></span><span>Global balance <b>${fmt(campaign.credits)} CR</b></span></div></div>
  ${r.success ? `<div class="discoveries">${discoveryCards(r.planet, r.parts)}</div><div class="notice">Your ${r.planet} Explorer badge is in the archive. These are NASA reference facts unlocked by your instruments, not new real-world measurements. Sponsor rewards are game credits.</div>` : '<div class="notice">No refund was issued. A retry means building and buying another spacecraft from the same global balance.</div>'}<div class="actions"><button class="primary" id="next-mission">${r.success ? 'Plan another mission' : 'Build another rocket'} ↗</button><button class="secondary" id="view-ledger">Credit ledger</button></div>`;
  $('#next-mission').onclick = () => go(r.success ? 0 : 1); $('#view-ledger').onclick = ledger;
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
  $('#confirm-reset').onclick = () => { flightController?.destroy(); flightController = null; campaign = newCampaign(); parts = defaultParts(); selected = 'Mars'; lastResult = null; saveCampaign(); closeModal(); go(0); };
}
function archive() {
  modal(`<div class="label">EXPLORATION LOG</div><h2>Flight archive</h2>${campaign.records.length ? `<p>${campaign.records.filter(r => r.success).length} successful missions. Credits are tracked independently of badges.</p><div class="table-scroll"><table><tr><th>World</th><th>Outcome</th><th>Net credits</th></tr>${[...campaign.records].reverse().map(r => `<tr><td>${escapeHTML(r.planet)}</td><td>${r.success ? '✧ Explorer' : 'Mission failed'}</td><td class="${r.reward - r.cost >= 0 ? 'pass' : 'fail'}">${fmt(r.reward - r.cost)} CR</td></tr>`).join('')}</table></div>` : '<p class="empty">No flights logged yet.<br>Build a rocket to start your first expedition.</p>'}`);
}
function notes() {
  modal(`<div class="label">OPEN SCIENCE / SOURCE MANIFEST</div><h2>Trace every number.</h2><p><strong>data.js</strong> begins with the complete <strong>NASA_ORRERY_DATA</strong> table. NASA facts and hardware ratings are separate from <strong>GAME_RULES</strong>.</p>
  <h3>Solar system & gravity</h3><p><a href="${SOURCES.orrery}" target="_blank" rel="noopener">NASA orrery</a>: M = 2πt/P; ten Newton iterations solve E − e sin E = M. Position is (a(cos E − e), a√(1−e²)sin E), rotated by omega + raan, following your Godot example. One linear scale: 1,200 units/AU; one day per second. No common epoch is supplied, so phase zero is illustrative, not today's sky. This 2D projection does not apply inclination or infer the meaning of tau.</p><p>Earth distance is the separation of the two model position vectors. AU conversion follows <a href="${SOURCES.units}" target="_blank" rel="noopener">NASA fact-sheet notes</a>. Sizes are exaggerated. Every planet and the Sun attract the spacecraft. Softened inverse-square fields use NASA surface gravities with game scaling. Time, thrust, gravity, and consumption are compressed separately for play; these are not real transfer trajectories.</p>
  <h3>Real hardware</h3><p><a href="${SOURCES.rl10}" target="_blank" rel="noopener">RL10A-3-3A, NASA NTRS p.176</a>: 16,500 lbf vacuum thrust, 305 lb, 444.4 s Isp, O/F 5. Converted to N and kg. <a href="${SOURCES.j2x}" target="_blank" rel="noopener">J-2X, NASA NTRS slide 2</a>: 1,307 kN, 2,516 kg, minimum 448 s Isp, O/F 5.5, from 2009 development requirements. Both use LH₂/LOX. J-2X is a development engine; no operational flight is implied. These additional NASA hardware documents meet your real-engine request.</p><p><a href="${SOURCES.materials}" target="_blank" rel="noopener">JPL D-99657 table F-4, PDF p.145</a>: densities of aluminum, titanium and Inconel are 2,700, 4,430 and 8,440 kg/m³. Hull mass = density × 0.2 m³ design volume. More mass reduces acceleration F/m. HP is a game trade-off; density does not determine real strength.</p><p><a href="${SOURCES.equation}" target="_blank" rel="noopener">NASA ideal rocket equation</a>: Δv = Isp g₀ ln(wet/dry). Flow = thrust/(Isp g₀). Engine clusters multiply thrust, mass and consumption. Reference T/W uses vacuum ratings against Earth-reference weight as a classroom check. Flight begins outside Earth, not at a terrestrial launch pad.</p>
  <h3>Game rules</h3><p>Capture needs ${GAME_RULES.scanSeconds} scan seconds in the chosen planet's band, controlled relative speed, low radial velocity and ${GAME_RULES.minimumAngularTravel} radians of orbital travel. Only the chosen planet can complete a scan. Other worlds still exert gravity. Only the target and Sun cause planetary collision failure.</p><p>The <a href="${SOURCES.asteroids}" target="_blank" rel="noopener">main belt is between Mars and Jupiter</a>. Its drawn 2.1–3.3 AU bounds, density, rocks and comets are schematic game hazards. Only outer-planet and Pluto routes activate collision hazards. No belt is placed around a gas giant.</p><p>One ${GAME_RULES.initialCredits} CR starting balance. Buy & launch deducts the cart once. Wins deposit a grant once; failures give no refund. Reloading resumes the paid flight. Bankruptcy means less than ${minimumMissionCost()} CR for the cheapest valid assembly after a mission ends. Only an explicit reset restores starting capital.</p><p>Satellite and instrument masses are design allocations, not measured hardware. Volume, tank fraction, HP, prices, rewards, steering, boost and fuel-burn scaling are documented game parameters. <a href="${SOURCES.trajectory}" target="_blank" rel="noopener">NASA Trajectory Browser</a> is linked for actual planning; no NASA feasibility result is fabricated.</p><p><a href="${SOURCES.facts}" target="_blank" rel="noopener">NASA fact sheet</a> supplies results; <a href="${SOURCES.science}" target="_blank" rel="noopener">Solar System Exploration</a> supplies world descriptions; <a href="${SOURCES.data}" target="_blank" rel="noopener">NASA's data directory</a> links real observations.</p>
  <div class="table-scroll"><table><tr><th>World</th><th>a / AU</th><th>Period / days</th><th>e</th></tr>${Object.entries(NASA_ORRERY_DATA).map(([name, o]) => `<tr><td>${name}</td><td>${o.sma}</td><td>${o.period}</td><td>${o.eccentricity}</td></tr>`).join('')}</table></div>`);
}
$('.close').onclick = closeModal;
$('#sources-nav').onclick = $('#method-footer').onclick = notes;
$('#archive-nav').onclick = archive; $('#wallet').onclick = ledger;
$('#mission-nav').onclick = () => requestStage(0);
document.querySelectorAll('[data-step]').forEach(b => b.onclick = () => requestStage(+b.dataset.step));
window.addEventListener('pagehide', () => { if (flightController) saveFlight(flightController.state); });
saveCampaign(); render();
