const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ console, assert, Date });
for (const file of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'), ctx, { filename: file });
vm.runInContext(`
  // Real source orbits remain unchanged, closed, eccentric and linearly scaled.
  for (const [name, o] of Object.entries(NASA_ORRERY_DATA)) {
    const a = orbitalPosition(name, 0, 1), b = orbitalPosition(name, o.period, 1);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-10);
    assert.ok(Math.abs(Math.hypot(a.x, a.y) - o.sma * (1 - o.eccentricity)) < 1e-10);
    const scaled = orbitalPosition(name, 34, 1200), unscaled = orbitalPosition(name, 34, 1);
    assert.ok(Math.hypot(scaled.x - unscaled.x * 1200, scaled.y - unscaled.y * 1200) < 1e-8);
  }
  assert.notEqual(earthDistance('Mars', 0), earthDistance('Mars', 40));
  assert.ok(Math.abs(NASA_ENGINES[0].massKg - 138.34567285) < 1e-8);
  let c = newCampaign(), p = defaultParts(), stats = engineering(p);
  assert.equal(c.credits, 1000);
  assert.equal(stats.cost, 620);
  assert.equal(minimumMissionCost(), 620);
  assert.equal(stats.hp, 100);
  assert.equal(stats.hydrogenKg + stats.oxygenKg, stats.propellantKg);
  assert.equal(unlockedWorldCount(c), 1);
  assert.ok(destinationUnlocked(c, 'Mercury'));
  assert.ok(!destinationUnlocked(c, 'Venus'));
  assert.throws(() => buyMission(c, 'Venus', p), /Destination locked/);
  assert.throws(() => buyMission(c, 'Mercury', { ...p, boosters: 2 }), /unlock/i);
  assert.throws(() => buyMission(c, 'Mercury', { ...p, instruments: [1] }), /unlock/i);
  assert.throws(() => buyMission(c, 'Mercury', { ...p, instruments: [] }), /instrument/);
  // Preview never spends money. A paid flight and reward cannot be duplicated.
  engineering(p); engineering({ ...p, engine: 1 }); assert.equal(c.credits, 1000);
  c = buyMission(c, 'Mercury', p);
  assert.equal(c.credits, 380);
  assert.equal(c.status, 'active', 'a paid flight can still win with a low wallet');
  assert.throws(() => buyMission(c, 'Mercury', p), /already in progress/);
  c = JSON.parse(JSON.stringify(c));
  const id = c.mission.id;
  c = settleMission(c, id, true);
  assert.equal(c.credits, 1280);
  assert.equal(unlockedWorldCount(c), 2);
  assert.equal(c.records[0].unlockedPlanet, 'Venus');
  assert.ok(destinationUnlocked(c, 'Venus'));
  assert.equal(lockedParts({ ...p, boosters: 2, fuel: 1, instruments: [0, 1] }, campaignLevel(c)).length, 0);
  assert.equal(lockedParts({ ...p, engine: 1 }, campaignLevel(c)).length, 1);
  const won = c.credits;
  c = settleMission(c, id, true); assert.equal(c.credits, won);
  assert.equal(c.ledger.reduce((sum, e) => sum + e.amount, 0), c.credits);
  // Every win (including replay) unlocks exactly one new world until all are open.
  c = buyMission(c, 'Mercury', p); c = settleMission(c, c.mission.id, true);
  assert.equal(c.records.at(-1).unlockedPlanet, 'Mars');
  assert.equal(unlockedWorldCount(c), 3);
  assert.equal(lockedParts({ ...p, instruments: [2] }, campaignLevel(c)).length, 0);
  const beforeLossLevel = campaignLevel(c);
  c = buyMission(c, 'Mars', p); c = settleMission(c, c.mission.id, false, 'Impact');
  assert.equal(campaignLevel(c), beforeLossLevel);
  let bankrupt = buyMission(newCampaign(), 'Mercury', p);
  bankrupt = settleMission(bankrupt, bankrupt.mission.id, false, 'Fuel exhausted');
  assert.equal(bankrupt.credits, 380);
  assert.equal(bankrupt.status, 'bankrupt');
  assert.equal(unlockedWorldCount(bankrupt), 1);
  assert.throws(() => buyMission(bankrupt, 'Mercury', p), /bankruptcy/);
  assert.equal(newCampaign().credits, 1000);

  // First-try recommended builds are affordable for the full eight-world path.
  let tour = newCampaign();
  for (const w of WORLDS) {
    assert.ok(destinationUnlocked(tour, w.name));
    const config = recommendedParts(tour, w.name);
    assert.ok(launchChecks(config, tour.credits, campaignLevel(tour)).every(v => v.ok), w.name + ' loadout');
    tour = buyMission(tour, w.name, config);
    tour = settleMission(tour, tour.mission.id, true);
  }
  assert.equal(unlockedWorldCount(tour), 8);
  assert.equal(tour.records.at(-1).unlockedPlanet, null);
  assert.ok(engineering({ ...p, boosters: 2 }).acceleration > stats.acceleration);
  assert.ok(engineering({ ...p, fuel: 1 }).deltaV > stats.deltaV);

  // Fuel drains visibly and boost can actually exhaust it in seconds.
  const mission = buyMission(newCampaign(), 'Mercury', p).mission;
  let s = { ...makeFlightState(mission, 0), x: 1000000, y: 1000000 };
  for (let i = 0; i < 600; i++) advanceFlight(s, mission, { thrust: true }, 1/120);
  assert.ok(s.fuelKg / stats.propellantKg < 0.95);
  s = { ...makeFlightState(mission, 0), x: 1000000, y: 1000000 };
  let result;
  for (let i = 0; i < 120 * 20; i++) { result = advanceFlight(s, mission, { thrust: true, boost: true }, 1/120); if (result.outcome) break; }
  assert.equal(s.fuelKg, 0); assert.equal(result.outcome, 'failure');
  assert.match(result.reason, /Propellant exhausted/);
  // One planet collision removes 25%; four distinct hits exhaust the hull.
  s = makeFlightState(mission, 0);
  for (let hit = 1; hit <= 4; hit++) {
    const point = orbitalPosition('Mercury', s.days), v = orbitalVelocity('Mercury', s.days);
    Object.assign(s, { x: point.x, y: point.y, vx: v.x, vy: v.y, damageCooldown: 0 });
    result = advanceFlight(s, mission, {}, 1/120);
    assert.equal(s.hp, 100 - hit * 25);
    assert.equal(result.outcome, hit === 4 ? 'failure' : null);
  }
  s = { ...makeFlightState(mission, 0), x: 0, y: 0 };
  result = advanceFlight(s, mission, {}, 1/120);
  assert.equal(s.hp, 60); assert.equal(result.outcome, null);
  const venus = orbitalPosition('Venus', 0);
  s = { ...makeFlightState(mission, 0), x: venus.x, y: venus.y };
  result = advanceFlight(s, mission, {}, 1/120);
  assert.equal(s.scan, 0); assert.equal(s.hp, 100); assert.equal(result.outcome, null);
  assert.ok(Math.hypot(gravityAt(10000, 10000, 0).x, gravityAt(10000, 10000, 0).y) > 0);

  // No F/assist key or flag: all targets can scan by remaining in their bands.
  for (const w of WORLDS) {
    const m = buyMission(tour, w.name, p).mission;
    const point = orbitalPosition(w.name, 0), velocity = orbitalVelocity(w.name, 0), band = captureBand(w.name);
    s = { ...makeFlightState(m, 0), x: point.x + band.middle, y: point.y, vx: velocity.x,
      vy: velocity.y + Math.sqrt(planetMu(w.name) / band.middle) };
    assert.equal('assist' in s, false);
    for (let i = 0; i < 120 * 12; i++) { result = advanceFlight(s, m, {}, 1/120); if (result.outcome) break; }
    assert.equal(result.outcome, 'success', w.name + ' automatic orbital scan');
  }
  console.log('PASS: NASA orbits, Mercury-first unlocks, part tiers, tight economy, no duplicate grants, bankruptcy, full affordable progression, finite fuel, percentage collisions, and eight no-key orbital scans.');
`, ctx);
