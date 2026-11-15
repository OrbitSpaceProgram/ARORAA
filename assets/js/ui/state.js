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
  $('#wallet-value').textContent = fmt(step === 3 && rewardPending && lastResult ? campaign.credits - lastResult.reward : campaign.credits) + ' CR';
  $('#wallet').setAttribute('aria-label', `Balance ${campaign.credits} credits. Open ledger`);
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
    modal(`<div class="label">PAID FLIGHT IN PROGRESS</div><h2>Your spacecraft is still out there.</h2><p>Resume, or abandon this rocket. Its ${fmt(campaign.mission.cost)} CR purchase has already been charged.</p><div class="actions"><button class="primary" id="resume-current">Resume mission ↗</button><button class="secondary danger" id="abandon-current">Abandon rocket</button></div>`);
    $('#resume-current').onclick = () => { closeModal(); if (step !== 2) go(2); else flightController?.resume(); };
    $('#abandon-current').onclick = () => { closeModal(); finishFlight(false, 'Mission abandoned by the flight director. The purchased spacecraft was not recovered.'); };
  } else if (next === 1 && !destinationUnlocked(campaign, selected)) modal('<h2>Destination locked.</h2><p>Complete a successful mission to unlock the next planet.</p>');
  else if (next === 0 || next === 1) go(next);
  else if (next === 3 && lastResult) go(3);
  else modal('<h2>Build. Buy. Then fly.</h2><p>Buy an assembled spacecraft in the rocket lab to launch a mission.</p>');
}
