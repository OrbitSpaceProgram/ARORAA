function flightScreen() {
  const m = campaign.mission; if (!m) return;
  selected = m.target; parts = clone(m.parts);
  $('#screen').innerHTML = `<div class="section-heading flight-heading"><div><span class="label">MISSION IN PROGRESS</span><h2>Next stop: ${selected}.</h2></div><div class="flight-heading-actions"><button class="secondary" id="pause" aria-label="Pause mission">Pause Ⅱ</button></div></div>
  <div class="space-flight" id="flight-container"><canvas id="flight" tabindex="0" aria-label="Open solar system. W or Up: thrust. A/D or Left/Right: rotate. Space or S: brake. Shift: boost. Stay in the cyan orbital band to scan. P: pause."></canvas>
  <div class="hud telemetry"><div class="meter-label">HULL <b id="hull-readout">100%</b></div><div class="meter"><span id="hull-meter"></span></div><div class="meter-label">FUEL <b id="fuel-readout">100%</b></div><div class="meter fuel-meter"><span id="fuel-meter"></span></div><div class="meter-label speed-label">SPEED <b id="speed-readout">0 m/s</b></div></div>
  <div class="hud target-hud"><div class="hud-title">CURRENT DESTINATION</div><div class="target-name"><strong>${selected.toUpperCase()}</strong><span id="target-distance">— AU</span></div></div>
  
  <div class="scan-hud hud" id="scan-hud"><div class="hud-title" id="scan-label">${selected.toUpperCase()} ORBIT</div><div class="meter"><span id="scan-meter"></span></div><span id="scan-readout">SCAN 0%</span></div>
  <div class="flight-overlay" id="flight-overlay"><div class="flight-brief"><span class="label">${selected.toUpperCase()} EXPEDITION</span><h2>${m.state?.elapsed > 0 ? 'Flight paused.' : 'Ready for launch?'}</h2><div class="pause-mission-actions"><button class="primary" id="start-flight">${m.state?.elapsed > 0 ? 'Resume mission' : 'Take flight'} <span>↗</span></button><button class="secondary" id="leave-paused-mission">Leave mission <span>↗</span></button></div></div></div></div>
  <div class="flight-instructions"><p id="scan-guidance">Follow the arrow. Brake near ${selected}, then stay in the cyan orbital band to scan.</p><div class="control-guide"><span><kbd>W ↑</kbd> Thrust</span><span><kbd>A D ← →</kbd> Rotate</span><span><kbd>S SPACE</kbd> Brake</span><span><kbd>SHIFT</kbd> Boost</span><span><kbd>P</kbd> Pause</span></div></div>
  `;
  $('#leave-paused-mission').onclick = () => requestStage(0);
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
