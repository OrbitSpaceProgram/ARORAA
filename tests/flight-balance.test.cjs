// Deterministic flight benchmarks. The pilot issues the same turn/thrust inputs
// as a player, with no teleporting, direct angle assignments, or fuel refills.
// It flies a conservative approach; it deliberately DOES NOT dodge obstacles.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ console, assert });
for (const file of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'), ctx);
vm.runInContext(`
function flyApproach(target, parts, maximumSeconds = 500) {
  const mission = {id:1,target,parts}, state = makeFlightState(mission,0), initial = state.fuelKg;
  const stats = engineering(parts), dt = 1/120;
  let result;
  for(let tick=0;tick<maximumSeconds/dt;tick++) {
    const cap=captureStatus(state,target,state.days), dx=cap.planet.x-state.x, dy=cap.planet.y-state.y;
    const acceleration=stats.thrustN/(stats.dryKg+state.fuelKg)*GAME_RULES.controlAccelerationScale;
    const gap=Math.max(0,cap.r-cap.band.middle);
    const approachSpeed=Math.min(450,Math.sqrt(2*acceleration*gap*.6));
    const desiredVX=cap.planetVelocity.x+dx/cap.r*approachSpeed;
    const desiredVY=cap.planetVelocity.y+dy/cap.r*approachSpeed;
    const ex=desiredVX-state.vx,ey=desiredVY-state.vy;
    const error=normalizeAngle(Math.atan2(ey,ex)-state.angle),input={};
    if(!(cap.inBand&&cap.speed<Math.max(90,cap.circular*2))) {
      input.right=error>.05;input.left=error<-.05;
      input.thrust=Math.abs(error)<.15&&Math.hypot(ex,ey)>8;
    }
    result=advanceFlight(state,mission,input,dt);
    if(result.outcome)break;
  }
  return {outcome:result.outcome,fuel:state.fuelKg/initial,seconds:state.elapsed,hp:state.hp,
    remainingAU:captureStatus(state,target,state.days).r/GAME_RULES.auScale};
}
for(const target of ['Venus','Mercury']) {
  const result=flyApproach(target,defaultParts());
  assert.equal(result.outcome,'success',target+' is challenging but reachable');
  assert.ok(result.fuel>.02&&result.fuel<.25,target+' must leave a tight fuel reserve');
  assert.ok(result.seconds>30&&result.seconds<100,target+' remains a quick judge mission');
  console.log(target+': '+Math.round(result.seconds)+' s; '+Math.round(result.fuel*100)+'% fuel left, using real control inputs.');
}
const starterOuter=flyApproach('Pluto',defaultParts(),1200);
assert.equal(starterOuter.outcome,'failure','a starter ship cannot blindly cruise through the outer route');
assert.ok(starterOuter.remainingAU>20,'the belt should stop this unsafe attempt early');
console.log('PASS: starter inner-route fuel margins, gradual controlled approaches, and a meaningful outer-system obstacle gate.');
`,ctx);
