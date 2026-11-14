/* Pure orbital, engineering, and campaign logic. No DOM or dependencies. */
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const clone = value => JSON.parse(JSON.stringify(value));
const defaultParts = () => ({ engine: 0, boosters: 1, fuel: 0, instruments: [0] });

function validParts(p) {
  return p && [0, 1].includes(p.engine) && GAME_RULES.boosterCounts.includes(p.boosters)
    && [0, 1, 2, 3].includes(p.fuel) && Array.isArray(p.instruments)
    && p.instruments.every(i => [0, 1, 2].includes(i))
    && new Set(p.instruments).size === p.instruments.length;
}

const campaignLevel = c => c.records.filter(r => r.success).length;
const unlockedWorldCount = c => Math.min(WORLDS.length, campaignLevel(c) + 1);
const destinationUnlocked = (c, name) => WORLDS.findIndex(w => w.name === name) >= 0
  && WORLDS.findIndex(w => w.name === name) < unlockedWorldCount(c);
const partUnlockLevel = (key, index) => GAME_RULES.unlocks[key][index];
function lockedParts(p, level) {
  const values = [['engine', p.engine], ['boosters', p.boosters], ['fuel', p.fuel], ...p.instruments.map(i => ['instruments', i])];
  return values.filter(([key, index]) => partUnlockLevel(key, index) > level);
}

function recommendedParts(c, target) {
  const rank = WORLDS.findIndex(w => w.name === target), level = campaignLevel(c);
  const p = { engine: rank >= 3 && level >= 3 ? 1 : 0,
    boosters: rank >= 1 && rank < 3 && level >= 1 ? 2 : 1,
    fuel: rank >= 7 && level >= 5 ? 3 : rank >= 3 && level >= 3 ? 2 : rank >= 2 && level >= 1 ? 1 : 0,
    instruments: [0] };
  return engineering(p).cost <= c.credits && launchChecks(p, c.credits, level).every(check => check.ok) ? p : defaultParts();
}

// Direct JavaScript equivalent of the user's Godot Planet2D example.
function orbitalPosition(name, days, scale = GAME_RULES.auScale) {
  const o = NASA_ORRERY_DATA[name];
  const meanAnomaly = TAU * (((days % o.period) + o.period) % o.period) / o.period;
  let E = meanAnomaly;
  for (let i = 0; i < 10; i++) E -= (E - o.eccentricity * Math.sin(E) - meanAnomaly) / (1 - o.eccentricity * Math.cos(E));
  const x = o.sma * (Math.cos(E) - o.eccentricity);
  const y = o.sma * Math.sqrt(1 - o.eccentricity ** 2) * Math.sin(E);
  const angle = (o.omega + o.raan) * Math.PI / 180;
  return { x: (x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: (x * Math.sin(angle) + y * Math.cos(angle)) * scale };
}

function orbitalVelocity(name, days) {
  const a = orbitalPosition(name, days), b = orbitalPosition(name, days + 0.001);
  return { x: (b.x - a.x) / 0.001 * GAME_RULES.daysPerSecond, y: (b.y - a.y) / 0.001 * GAME_RULES.daysPerSecond };
}

function earthDistance(name, days = 0) {
  const e = orbitalPosition('Earth', days, 1), p = orbitalPosition(name, days, 1);
  return Math.hypot(p.x - e.x, p.y - e.y);
}

function engineering(p) {
  const engine = NASA_ENGINES[p.engine];
  const propellantKg = GAME_RULES.fuelLoads[p.fuel];
  const tankKg = propellantKg * GAME_RULES.tankMassFraction;
  const dryKg = engine.massKg * p.boosters + GAME_RULES.chassisKg + tankKg
    + p.instruments.reduce((s, i) => s + GAME_RULES.instruments[i].massKg, 0);
  const wetKg = dryKg + propellantKg;
  const thrustN = engine.thrustN * p.boosters;
  const cost = GAME_RULES.enginePrices[p.engine] * p.boosters + GAME_RULES.chassisPrice
    + GAME_RULES.fuelPrices[p.fuel] + p.instruments.reduce((s, i) => s + GAME_RULES.instruments[i].cost, 0);
  const deltaV = engine.ispSeconds * UNITS.g0 * Math.log(wetKg / dryKg);
  return { cost, dryKg, wetKg, tankKg, propellantKg, thrustN,
    acceleration: thrustN / wetKg, twr: thrustN / (wetKg * UNITS.g0), deltaV,
    massFlow: thrustN / (engine.ispSeconds * UNITS.g0),
    hydrogenKg: propellantKg / (1 + engine.oxidizerRatio),
    oxygenKg: propellantKg * engine.oxidizerRatio / (1 + engine.oxidizerRatio),
    hp: GAME_RULES.hullHP };
}

function launchChecks(p, credits, level = Infinity) {
  const s = engineering(p);
  return [
    { ok: s.cost <= credits, title: 'Available credits', value: `${s.cost} / ${credits} CR`, reason: `You need ${Math.max(0, s.cost - credits)} more credits. Choose a less expensive assembly.` },
    { ok: s.twr >= 1, title: 'Thrust check', value: `${s.twr.toFixed(2)} T/W`, reason: 'Add boosters or reduce the fuel load: rated thrust is below Earth-reference weight.' },
    { ok: s.propellantKg > 0, title: 'Propellant loaded', value: `${s.propellantKg.toLocaleString('en-US')} kg`, reason: 'Load propellant before departure.' },
    { ok: p.instruments.length > 0, title: 'Science payload', value: `${p.instruments.length} instrument${p.instruments.length === 1 ? '' : 's'}`, reason: 'Select at least one instrument to gather science.' },
    { ok: lockedParts(p, level).length === 0, title: 'Parts unlocked', value: lockedParts(p, level).length ? 'Locked parts selected' : 'Ready', reason: 'Win more missions to unlock these parts, or choose an available part.' }
  ];
}

let cachedMinimum;
function minimumMissionCost() {
  if (cachedMinimum !== undefined) return cachedMinimum;
  let min = Infinity;
  for (let engine = 0; engine < NASA_ENGINES.length; engine++) for (const boosters of GAME_RULES.boosterCounts)
    for (let fuel = 0; fuel < GAME_RULES.fuelLoads.length; fuel++) {
      const p = { ...defaultParts(), engine, boosters, fuel };
      if (launchChecks(p, Infinity).every(c => c.ok)) min = Math.min(min, engineering(p).cost);
    }
  return cachedMinimum = min;
}

function newCampaign() {
  return { version: 3, credits: GAME_RULES.initialCredits, status: 'active', sequence: 0, days: 0,
    records: [], ledger: [{ type: 'Starting capital', amount: GAME_RULES.initialCredits }], mission: null };
}

function buyMission(c, target, p) {
  if (!WORLDS.some(w => w.name === target) || !validParts(p)) throw Error('Invalid mission assembly.');
  if (c.mission) throw Error('A paid mission is already in progress. Resume or abandon it first.');
  if (c.status === 'bankrupt') throw Error('Campaign ended in bankruptcy. Start a new campaign.');
  if (!destinationUnlocked(c, target)) throw Error('Destination locked. Complete a successful mission to unlock the next planet.');
  const failures = launchChecks(p, c.credits, campaignLevel(c)).filter(check => !check.ok);
  if (failures.length) throw Error(failures.map(f => f.reason).join(' '));
  const next = clone(c), stats = engineering(p);
  next.credits -= stats.cost;
  next.sequence++;
  next.mission = { id: next.sequence, target, parts: clone(p), cost: stats.cost, state: null };
  next.ledger.push({ type: `${target} rocket purchase`, amount: -stats.cost, missionId: next.sequence });
  return next;
}

function missionReward(target, p) {
  return 900 + WORLDS.findIndex(w => w.name === target) * 200 + Math.max(0, p.instruments.length - 1) * 100;
}

// Settlement is idempotent: a cleared mission cannot pay out a second time.
function settleMission(c, id, success, reason = '') {
  if (!c.mission || c.mission.id !== id) return c;
  const next = clone(c), m = next.mission;
  const reward = success ? missionReward(m.target, m.parts) : 0;
  next.credits += reward;
  const nextWorld = success && unlockedWorldCount(c) < WORLDS.length ? WORLDS[unlockedWorldCount(c)].name : null;
  next.records.push({ id: m.id, planet: m.target, success, reason, cost: m.cost, reward, unlockedPlanet: nextWorld,
    date: new Date().toISOString(), instruments: m.parts.instruments });
  if (reward) next.ledger.push({ type: `${m.target} science grant`, amount: reward, missionId: m.id });
  next.mission = null;
  next.status = next.credits < minimumMissionCost() ? 'bankrupt' : 'active';
  return next;
}

function planetRadius(name) { return GAME_RULES.planetRadii[name]; }
function planetMu(name) { return NASA_FACTS[name].gravity * planetRadius(name) ** 2 * GAME_RULES.gravityScale; }
function captureBand(name) {
  const radius = planetRadius(name);
  return { inner: Math.max(75, radius * 2), outer: Math.max(125, radius * 3.2), middle: Math.max(100, radius * 2.6) };
}

function gravityAt(x, y, days) {
  const r2 = x * x + y * y, distance = Math.sqrt(r2);
  let ax = distance > 0 ? -GAME_RULES.sunMu * x / ((r2 + 1600) * distance) : 0;
  let ay = distance > 0 ? -GAME_RULES.sunMu * y / ((r2 + 1600) * distance) : 0;
  for (const name of Object.keys(NASA_ORRERY_DATA)) {
    const p = orbitalPosition(name, days), dx = p.x - x, dy = p.y - y;
    const d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
    // Softened inverse-square gravity: every planet exerts a force, selected or not.
    const a = planetMu(name) / (d2 + (planetRadius(name) * 0.7) ** 2);
    if (d > 0.001) { ax += dx / d * a; ay += dy / d * a; }
  }
  return { x: ax, y: ay };
}

function captureStatus(ship, target, days) {
  const p = orbitalPosition(target, days), pv = orbitalVelocity(target, days), band = captureBand(target);
  const dx = ship.x - p.x, dy = ship.y - p.y, r = Math.hypot(dx, dy);
  const vx = ship.vx - pv.x, vy = ship.vy - pv.y;
  const speed = Math.hypot(vx, vy), circular = Math.sqrt(planetMu(target) / Math.max(1, r));
  const radial = r > 0 ? (vx * dx + vy * dy) / r : 0;
  const inBand = r >= band.inner && r <= band.outer;
  // The player only has to stay in the orbital band. No key or hidden speed gate.
  const stable = inBand;
  return { r, speed, circular, radial, inBand, stable, angle: Math.atan2(dy, dx), planet: p, planetVelocity: pv, band };
}

function makeFlightState(mission, days) {
  const earth = orbitalPosition('Earth', days), target = orbitalPosition(mission.target, days);
  const a = Math.atan2(target.y - earth.y, target.x - earth.x), vel = orbitalVelocity('Earth', days);
  return { x: earth.x + Math.cos(a) * 150, y: earth.y + Math.sin(a) * 150,
    vx: vel.x, vy: vel.y, angle: a, fuelKg: engineering(mission.parts).propellantKg,
    hp: engineering(mission.parts).hp, scan: 0, angularTravel: 0, scanAngle: null,
    elapsed: 0, days, damageCooldown: 0, hazardClock: 0, hazards: [] };
}

function normalizeAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

// A collision removes a fraction of the 100% hull; it does not instantly end play.
function surfaceImpact(s, center, velocity, radius, percent, label) {
  const dx = s.x - center.x, dy = s.y - center.y, distance = Math.hypot(dx, dy);
  const nx = distance > 0.001 ? dx / distance : -Math.cos(s.angle);
  const ny = distance > 0.001 ? dy / distance : -Math.sin(s.angle);
  s.x = center.x + nx * (radius + 20); s.y = center.y + ny * (radius + 20);
  const vx = s.vx - velocity.x, vy = s.vy - velocity.y, inward = vx * nx + vy * ny;
  s.vx = velocity.x + vx - Math.min(0, inward) * nx * 1.7 + nx * 25;
  s.vy = velocity.y + vy - Math.min(0, inward) * ny * 1.7 + ny * 25;
  if (s.damageCooldown <= 0) {
    s.hp = Math.max(0, s.hp - GAME_RULES.hullHP * percent / 100);
    s.damageCooldown = 1.2; s.lastImpact = label;
  }
  s.scan = 0;
}

// Semi-implicit Euler, called at <= 1/120 s. Gravity, inertia, thrust and fuel use
// independent, documented arcade compression; this is not a trajectory predictor.
function advanceFlight(s, mission, input, dt) {
  const p = mission.parts, stats = engineering(p), engine = NASA_ENGINES[p.engine];
  s.elapsed += dt;
  s.days += dt * GAME_RULES.daysPerSecond;
  s.damageCooldown = Math.max(0, s.damageCooldown - dt);
  const cap = captureStatus(s, mission.target, s.days);
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  s.angle += turn * (2.5 / Math.sqrt((stats.dryKg + s.fuelKg) / 1600)) * dt;
  let ax = 0, ay = 0, demand = 0;
  const wetKg = stats.dryKg + s.fuelKg;
  const acceleration = engine.thrustN * p.boosters / wetKg * GAME_RULES.controlAccelerationScale;
  if (input.thrust && s.fuelKg > 0) {
    const power = input.boost ? GAME_RULES.cruiseBoost : 1;
    ax += Math.cos(s.angle) * acceleration * power;
    ay += Math.sin(s.angle) * acceleration * power;
    demand += power;
  }
  // Brake is a fueled retrograde burn, relative to target motion near arrival.
  if (input.brake && s.fuelKg > 0) {
    const local = cap.r < 700, rx = s.vx - (local ? cap.planetVelocity.x : 0), ry = s.vy - (local ? cap.planetVelocity.y : 0);
    const speed = Math.hypot(rx, ry), decel = Math.min(acceleration * 4, speed / dt);
    if (speed > 0.1) { ax -= rx / speed * decel; ay -= ry / speed * decel; demand += 2; }
  }
  // Gentle automatic stabilization in the sweet spot. No F key is required.
  // It cannot catch a fast flyby or overpower active steering/braking.
  if (cap.inBand && cap.speed < Math.max(90, cap.circular * 2) && !input.thrust && !input.brake && s.fuelKg > 0) {
    const dx = s.x - cap.planet.x, dy = s.y - cap.planet.y, r = Math.max(1, cap.r);
    const sign = dx * (s.vy - cap.planetVelocity.y) - dy * (s.vx - cap.planetVelocity.x) < 0 ? -1 : 1;
    const radialCorrection = clamp((cap.band.middle - r) * 0.8, -22, 22);
    const desiredX = cap.planetVelocity.x - dy / r * cap.circular * sign + dx / r * radialCorrection;
    const desiredY = cap.planetVelocity.y + dx / r * cap.circular * sign + dy / r * radialCorrection;
    const tx = (desiredX - s.vx) * 1.5, ty = (desiredY - s.vy) * 1.5, mag = Math.hypot(tx, ty);
    const limit = Math.min(acceleration, 30), f = mag > limit ? limit / mag : 1;
    ax += tx * f; ay += ty * f; demand += 0.15;
  }
  const needed = stats.massFlow * GAME_RULES.fuelBurnTimeScale * demand * dt;
  const burnFraction = needed > 0 ? Math.min(1, s.fuelKg / needed) : 1;
  s.fuelKg = Math.max(0, s.fuelKg - needed);
  const gravity = gravityAt(s.x, s.y, s.days);
  s.vx += (ax * burnFraction + gravity.x) * dt;
  s.vy += (ay * burnFraction + gravity.y) * dt;
  const velocity = Math.hypot(s.vx, s.vy);
  // Arcade cruise ceiling depends on thrust/mass: more engines are faster,
  // heavier fuel loads are slower. A real vacuum rocket has no top speed.
  const cruiseLimit = Math.min(GAME_RULES.maximumCruiseSpeed, 450 + stats.acceleration * 10);
  if (velocity > cruiseLimit) { s.vx *= cruiseLimit / velocity; s.vy *= cruiseLimit / velocity; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  const capture = captureStatus(s, mission.target, s.days);
  if (capture.stable) {
    s.scan += dt;
    if (s.scanAngle !== null) s.angularTravel += Math.abs(normalizeAngle(capture.angle - s.scanAngle));
    s.scanAngle = capture.angle;
  } else { s.scan = Math.max(0, s.scan - dt * 0.8); s.scanAngle = null; s.angularTravel = Math.max(0, s.angularTravel - dt * 0.03); }
  if (capture.r < planetRadius(mission.target) + 9) surfaceImpact(s, capture.planet, capture.planetVelocity, planetRadius(mission.target), 25, `${mission.target} collision`);
  if (Math.hypot(s.x, s.y) < 100) surfaceImpact(s, { x: 0, y: 0 }, { x: 0, y: 0 }, 100, 40, 'Solar heat damage');
  if (s.hp <= 0) return { outcome: 'failure', reason: 'Hull integrity reached 0% after repeated impacts. Brake earlier and steer clear of obstacles.' };
  if (s.fuelKg <= 0) return { outcome: 'failure', reason: 'Propellant exhausted before the orbital scan was completed. Coast between burns, use boost sparingly, or buy a larger propellant load.' };
  if (s.scan >= GAME_RULES.scanSeconds) return { outcome: 'success' };
  return { outcome: null, capture };
}
