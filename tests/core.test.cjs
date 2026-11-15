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
    const scaled = orbitalPosition(name, 34, 24000), unscaled = orbitalPosition(name, 34, 1);
    assert.ok(Math.hypot(scaled.x - unscaled.x * 24000, scaled.y - unscaled.y * 24000) < 1e-8);
  }
  assert.notEqual(earthDistance('Mercury', 0), earthDistance('Mercury', 40));
  assert.ok(Math.abs(NASA_ENGINES[0].massKg - 138.34567285) < 1e-8);
  let c = newCampaign(), p = defaultParts(), stats = engineering(p);
  assert.equal(c.credits, 1000);
  assert.equal(stats.cost, 620);
  assert.equal(minimumMissionCost(), 620);
  assert.equal(stats.hp, 100);
  assert.equal(stats.hydrogenKg + stats.oxygenKg, stats.propellantKg);
  assert.equal(unlockedWorldCount(c), 1);
  assert.ok(destinationUnlocked(c, 'Venus'));
  assert.ok(!destinationUnlocked(c, 'Mars'));
  assert.throws(() => buyMission(c, 'Mars', p), /Destination locked/);
  assert.throws(() => buyMission(c, 'Venus', { ...p, boosters: 2 }), /unlock/i);
  assert.throws(() => buyMission(c, 'Venus', { ...p, instruments: [1] }), /unlock/i);
  assert.throws(() => buyMission(c, 'Venus', { ...p, instruments: [] }), /instrument/);
  // Preview never spends money. A paid flight and reward cannot be duplicated.
  engineering(p); engineering({ ...p, engine: 1 }); assert.equal(c.credits, 1000);
  c = buyMission(c, 'Venus', p);
  assert.equal(c.credits, 380);
  assert.equal(c.status, 'active', 'a paid flight can still win with a low wallet');
  assert.throws(() => buyMission(c, 'Venus', p), /already in progress/);
  c = JSON.parse(JSON.stringify(c));
  const id = c.mission.id;
  c = settleMission(c, id, true);
  assert.equal(c.credits, 1280);
  assert.equal(unlockedWorldCount(c), 2);
  assert.equal(c.records[0].unlockedPlanet, 'Mars');
  assert.ok(destinationUnlocked(c, 'Mars'));
  assert.equal(lockedParts({ ...p, boosters: 2, fuel: 1, instruments: [0, 1] }, campaignLevel(c)).length, 0);
  assert.equal(lockedParts({ ...p, engine: 1 }, campaignLevel(c)).length, 1);
  const won = c.credits;
  c = settleMission(c, id, true); assert.equal(c.credits, won);
  assert.equal(c.ledger.reduce((sum, e) => sum + e.amount, 0), c.credits);
  // Every win (including replay) unlocks exactly one new world until all are open.
  c = buyMission(c, 'Venus', p); c = settleMission(c, c.mission.id, true);
  assert.equal(c.records.at(-1).unlockedPlanet, 'Mercury');
  assert.equal(unlockedWorldCount(c), 3);
  assert.equal(lockedParts({ ...p, instruments: [2] }, campaignLevel(c)).length, 0);
  const beforeLossLevel = campaignLevel(c);
  c = buyMission(c, 'Mercury', p); c = settleMission(c, c.mission.id, false, 'Impact');
  assert.equal(campaignLevel(c), beforeLossLevel);
  let bankrupt = buyMission(newCampaign(), 'Venus', p);
  bankrupt = settleMission(bankrupt, bankrupt.mission.id, false, 'Fuel exhausted');
  assert.equal(bankrupt.credits, 380);
  assert.equal(bankrupt.status, 'bankrupt');
  assert.equal(unlockedWorldCount(bankrupt), 1);
  assert.throws(() => buyMission(bankrupt, 'Venus', p), /bankruptcy/);
  assert.equal(newCampaign().credits, 1000);

  // First-try recommended builds are affordable for the full eight-world path.
  let tour = newCampaign();
  for (const w of WORLDS) {
    assert.ok(destinationUnlocked(tour, w.name));
    const config = recommendedParts(tour, w.name);
    if (NASA_ORRERY_DATA[w.name].sma > 3) assert.equal(config.engine, 1, w.name + ' needs an advanced recommended engine');
    assert.ok(launchChecks(config, tour.credits, campaignLevel(tour)).every(v => v.ok), w.name + ' loadout');
    tour = buyMission(tour, w.name, config);
    tour = settleMission(tour, tour.mission.id, true);
  }
  assert.equal(unlockedWorldCount(tour), 8);
  assert.equal(tour.records.at(-1).unlockedPlanet, null);
  assert.ok(engineering({ ...p, boosters: 2 }).acceleration > stats.acceleration);
  assert.ok(engineering({ ...p, fuel: 1 }).deltaV > stats.deltaV);

  // Fuel drains visibly and boost can actually exhaust it in seconds.
  const mission = buyMission(newCampaign(), 'Venus', p).mission;
  let s = { ...makeFlightState(mission, 0), x: 1000000, y: 1000000 };
  for (let i = 0; i < 600; i++) advanceFlight(s, mission, { thrust: true }, 1/120);
  assert.ok(s.fuelKg / stats.propellantKg < 0.95);
  s = { ...makeFlightState(mission, 0), x: 1000000, y: 1000000 };
  let result;
  for (let i = 0; i < 120 * 40; i++) { result = advanceFlight(s, mission, { thrust: true, boost: true }, 1/120); if (result.outcome) break; }
  assert.equal(s.fuelKg, 0); assert.equal(result.outcome, 'failure');
  assert.match(result.reason, /Propellant exhausted/);
  // One planet collision removes 25%; four distinct hits exhaust the hull.
  s = makeFlightState(mission, 0);
  for (let hit = 1; hit <= 4; hit++) {
    const point = orbitalPosition('Venus', s.days), v = orbitalVelocity('Venus', s.days);
    Object.assign(s, { x: point.x, y: point.y, vx: v.x, vy: v.y, damageCooldown: 0 });
    result = advanceFlight(s, mission, {}, 1/120);
    assert.equal(s.hp, 100 - hit * 25);
    assert.equal(result.outcome, hit === 4 ? 'failure' : null);
  }
  s = { ...makeFlightState(mission, 0), x: 0, y: 0 };
  result = advanceFlight(s, mission, {}, 1/120);
  assert.equal(s.hp, 60); assert.equal(result.outcome, null);
  const venus = orbitalPosition('Mars', 0);
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
  assert.deepEqual(WORLDS.map(w=>w.name),['Venus','Mars','Mercury','Jupiter','Saturn','Uranus','Neptune','Pluto']);
  assert.equal(missionsUntilUnlock(newCampaign(),'Mercury'),2);
  let unlocked=buyMission(newCampaign(),'Venus',p);unlocked=settleMission(unlocked,unlocked.mission.id,true);
  assert.equal(missionsUntilUnlock(unlocked,'Mercury'),1);
  const legacy={...newCampaign(),credits:4000,records:[{success:true}],unlockedWorlds:['Venus','Mercury']};
  assert.equal(missionsUntilUnlock(legacy,'Jupiter'),2);
  let old=buyMission(legacy,'Mercury',p);old=settleMission(old,old.mission.id,true);
  assert.equal(old.records.at(-1).unlockedPlanet,'Mars');
  let grant=0;
  for(const w of WORLDS){
    const amount=missionReward(w.name,p);assert.ok(amount>grant);grant=amount;
    assert.ok(missionReward(w.name,{...p,instruments:[0,1,2]})>missionReward(w.name,{...p,instruments:[0,1]}));
    assert.ok(missionReward(w.name,{...p,instruments:[0,1]})>amount);
  }
  assert.equal(missionReward('Pluto',{...p,instruments:[0,1,2]}),13600);
  for(const a of Object.keys(NASA_FACTS)){
    assert.ok(planetRadius('Sun')>planetRadius(a)*3);
    for(const b of Object.keys(NASA_FACTS))if(NASA_FACTS[a].diameter>NASA_FACTS[b].diameter)assert.ok(planetRadius(a)>planetRadius(b));
  }
  const blank=()=>({...makeFlightState(mission,0),x:1e10,y:1e10,vx:0,vy:0,angle:0});
  s=blank();advanceFlight(s,mission,{thrust:true},1/120);
  assert.ok(s.vx>0&&s.vx<.01,'thrust builds gradually');
  const early=s.vx;for(let n=0;n<240;n++)advanceFlight(s,mission,{thrust:true},1/120);
  assert.ok(s.vx>early*100&&s.vx<60,'no instant speed jump');
  s={...blank(),vx:2500,vy:-300};
  for(let n=0;n<1200;n++)advanceFlight(s,mission,{},1/120);
  assert.ok(Math.abs(s.vx-2500)<1e-6&&Math.abs(s.vy+300)<1e-6,'inertia, no artificial cruise cap');
  assert.equal(s.fuelKg,stats.propellantKg,'pure coasting consumes no propellant');
  for(const turn of ['left','right']){
    s=blank();advanceFlight(s,mission,{[turn]:true},1/120);
    assert.equal(Math.sign(s.angle),turn==='right'?1:-1);
    assert.equal(s.turnJet,turn==='right'?1:-1,'opposite-side steering jet');
    assert.ok(s.fuelKg<stats.propellantKg);
  }
  assert.ok(steeringStats({...p,boosters:4}).rate>steeringStats({...p,boosters:2}).rate);
  assert.ok(steeringStats({...p,boosters:2}).rate>steeringStats(p).rate);
  assert.ok(steeringStats({...p,fuel:1}).rate<steeringStats(p).rate);
  const rocks=beltRocksNear(2.8*GAME_RULES.auScale,0);
  assert.ok(rocks.length>500&&rocks.some(r=>r.r>60));
  for(const rock of rocks)assert.ok(inAsteroidBelt(rock.x,rock.y));
  const outer={id:1,target:'Jupiter',parts:{engine:1,boosters:2,fuel:2,instruments:[0]}};
  const rock=rocks[0];s={...makeFlightState(outer,0),x:rock.x,y:rock.y,vx:0,vy:0};
  advanceFlight(s,outer,{},1/120);assert.equal(s.hp,70,'survivable belt impact');
  s={...makeFlightState(mission,0),x:rock.x,y:rock.y,vx:0,vy:0};
  advanceFlight(s,mission,{},1/120);assert.equal(s.hp,100,'no hazards in inner missions');
  s={...makeFlightState(outer,0),x:2.8*GAME_RULES.auScale,y:0,elapsed:10};
  for(let n=0;n<30;n++){s.hazardClock=0;advanceHazards(s,outer,1/120);}
  assert.ok(s.hazards.length>=60&&s.hazards.filter(h=>h.comet).length>=10);
  console.log('PASS: 20x scale, ordered body sizes, remaining unlock wins, scaled science grants, gradual thrust, conserved momentum, steering jets and booster performance, dense belt and comets.');

  console.log('PASS: NASA orbits, Venus-first unlocks, part tiers, tight economy, no duplicate grants, bankruptcy, full affordable progression, finite fuel, percentage collisions, and eight no-key orbital scans.');
`, ctx);
