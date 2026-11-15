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
  <aside class="panel assembly-summary"><span class="label">YOUR ${selected.toUpperCase()} ORBITER</span><div class="rocket-stage"><canvas id="rocket-preview" aria-label="Your custom rocket"></canvas></div><div class="credit-summary"><div><span>Launch cost</span><span>${fmt(s.cost)} CR</span></div><div><span>After launch</span><span>${fmt(campaign.credits - s.cost)} CR</span></div><div><span>Successful mission</span><span>+${fmt(missionReward(selected, parts))} CR</span></div></div><div class="launch-requirements">${checks.slice(1).map((c, i) => `<div class="check" title="${escapeHTML(c.ok ? c.title + ': ' + c.value : c.reason)}"><span>${['Thrust / weight ≥ 1', 'Propellant loaded', 'At least 1 scientific instrument', 'All selected parts unlocked'][i]}</span><span class="${c.ok ? 'pass' : 'fail'}">${c.ok ? '✓' : '×'} ${escapeHTML(c.value)}</span></div>`).join('')}</div><div class="engineering-stats launch-stats"><div><small>WET MASS</small><strong>${fmt(s.wetKg)} kg</strong></div><div><small>THRUST</small><strong>${fmt(s.thrustN / 1000, 1)} kN</strong></div><div><small>ISP</small><strong>${e.ispSeconds} s</strong></div></div><button class="primary" id="launch">Buy & launch <span>↗</span></button><div class="engineering-reference"><a href="${e.source}" target="_blank" rel="noopener">NASA engine reference ↗</a></div></aside></div>
  <aside id="part-popover" class="part-popover" role="dialog" aria-label="Part specifications" hidden></aside><div class="lab-bottom"><button class="secondary" id="back">← Destination</button></div>`;
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

