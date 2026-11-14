const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ console, assert, Date });
for (const file of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'), ctx, { filename: file });
vm.runInContext(`
  // All NASA eccentric ellipses close at one source period and preserve periapsis.
  for (const [name, o] of Object.entries(NASA_ORRERY_DATA)) {
    const a = orbitalPosition(name, 0, 1), b = orbitalPosition(name, o.period, 1);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-10, name + ' orbit closure');
    assert.ok(Math.abs(Math.hypot(a.x, a.y) - o.sma * (1 - o.eccentricity)) < 1e-10);
    const scaled = orbitalPosition(name, 34, 1200), unscaled = orbitalPosition(name, 34, 1);
    assert.ok(Math.hypot(scaled.x - unscaled.x * 1200, scaled.y - unscaled.y * 1200) < 1e-8);
  }
  assert.notEqual(earthDistance('Mars', 0), earthDistance('Mars', 40));
  assert.ok(Math.abs(NASA_ENGINES[0].massKg - 138.34567285) < 1e-8);
  let p = defaultParts(), stats = engineering(p);
  assert.equal(stats.hullKg, 540);
  assert.equal(stats.hydrogenKg + stats.oxygenKg, stats.propellantKg);
  const light = stats, heavy = engineering({ ...p, material: 2 });
  assert.ok(heavy.acceleration < light.acceleration);
  assert.ok(heavy.hp > light.hp && heavy.wetKg > light.wetKg && heavy.cost > light.cost);
  assert.ok(engineering({ ...p, boosters: 4 }).acceleration > stats.acceleration);
  assert.ok(engineering({ ...p, fuel: 1 }).deltaV > stats.deltaV);

  // Shopping is a preview. Purchase once; destination changes never mint credits.
  let c = newCampaign();
  const start = c.credits;
  engineering(p); engineering({ ...p, material: 2 });
  assert.equal(c.credits, start);
  c = buyMission(c, 'Mars', p);
  assert.equal(c.credits, start - stats.cost);
  assert.throws(() => buyMission(c, 'Pluto', p), /already in progress/);
  c = JSON.parse(JSON.stringify(c)); // persisted flight survives serialization
  const afterBuy = c.credits;
  c = settleMission(c, c.mission.id, false, 'Impact');
  assert.equal(c.credits, afterBuy);
  assert.equal(c.records[0].success, false);
  c = buyMission(c, 'Mercury', p);
  const id = c.mission.id, beforeReward = c.credits;
  c = settleMission(c, id, true);
  assert.equal(c.credits, beforeReward + missionReward('Mercury', p));
  const won = c.credits;
  c = settleMission(c, id, true);
  assert.equal(c.credits, won, 'duplicate settlement must not pay');
  assert.equal(c.ledger.reduce((sum, e) => sum + e.amount, 0), c.credits);

  let bankrupt = newCampaign();
  while (bankrupt.credits >= stats.cost) {
    bankrupt = buyMission(bankrupt, 'Mars', p);
    bankrupt = settleMission(bankrupt, bankrupt.mission.id, false, 'Impact');
  }
  const cheap = { ...p, boosters: 1 };
  if (bankrupt.credits >= engineering(cheap).cost) {
    bankrupt = buyMission(bankrupt, 'Mars', cheap);
    bankrupt = settleMission(bankrupt, bankrupt.mission.id, false, 'Impact');
  }
  assert.equal(bankrupt.status, 'bankrupt');
  assert.ok(bankrupt.credits < minimumMissionCost());
  assert.throws(() => buyMission(bankrupt, 'Mars', p), /bankruptcy/);
  assert.equal(newCampaign().credits, GAME_RULES.initialCredits);
  assert.equal(minimumMissionCost(), 820);
  assert.throws(() => buyMission(newCampaign(), 'Mars', { ...p, instruments: [] }), /instrument/);
  assert.throws(() => buyMission(newCampaign(), 'Mars', { ...p, boosters: 1, fuel: 3 }), /weight/);

  // True inertia, force/mass acceleration, fuel consumption and global gravity.
  const m = buyMission(newCampaign(), 'Mars', p).mission;
  let s = makeFlightState(m, 0), beforeFuel = s.fuelKg;
  const startVelocity = Math.hypot(s.vx, s.vy);
  for (let i = 0; i < 120; i++) advanceFlight(s, m, { thrust: true }, 1 / 120);
  assert.ok(s.fuelKg < beforeFuel);
  assert.ok(Math.hypot(s.vx, s.vy) > startVelocity);
  assert.ok(Math.hypot(gravityAt(10000, 10000, 0).x, gravityAt(10000, 10000, 0).y) > 0);
  const venus = orbitalPosition('Venus', 0);
  s = { ...makeFlightState(m, 0), x: venus.x, y: venus.y, vx: 0, vy: 0 };
  const nonTarget = advanceFlight(s, m, {}, 1 / 120);
  assert.equal(nonTarget.outcome, null, 'non-target planet cannot win or cause planet collision failure');
  assert.equal(s.scan, 0);
  const mars = orbitalPosition('Mars', 0);
  s = { ...makeFlightState(m, 0), x: mars.x, y: mars.y };
  assert.equal(advanceFlight(s, m, {}, 1 / 120).outcome, 'failure');
  s = { ...makeFlightState(m, 0), fuelKg: 0 };
  assert.match(advanceFlight(s, m, {}, 1 / 120).reason, /Propellant exhausted/);

  // Each target can be captured; this integrates moving planets and gravity.
  for (const world of WORLDS) {
    const mission = buyMission(newCampaign(), world.name, p).mission;
    const pos = orbitalPosition(world.name, 0), velocity = orbitalVelocity(world.name, 0);
    const band = captureBand(world.name), circular = Math.sqrt(planetMu(world.name) / band.middle);
    const state = { ...makeFlightState(mission, 0), x: pos.x + band.middle, y: pos.y,
      vx: velocity.x, vy: velocity.y + circular, assist: true };
    let result;
    for (let i = 0; i < 120 * 18; i++) {
      result = advanceFlight(state, mission, {}, 1 / 120);
      if (result.outcome) break;
    }
    assert.equal(result.outcome, 'success', world.name + ' must have achievable orbital capture');
  }
  console.log('PASS: NASA orbits, SI engineering, single ledger, purchase/reward idempotency, bankruptcy, fuel, wrong-target lock, gravity, and eight orbital captures.');
`, ctx);
