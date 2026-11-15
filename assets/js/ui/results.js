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
    ${r.success ? `<div class="reward-award"><span>SPONSOR GRANT</span><strong id="reward-amount">+${fmt(r.reward)} <small>CR</small></strong></div><p class="reward-breakdown">${fmt(missionReward(r.planet, { ...r.parts, instruments: [0] }))} CR base${r.parts.instruments.length > 1 ? " + " + fmt(r.reward - missionReward(r.planet, { ...r.parts, instruments: [0] })) + " CR science bonus" : " · 1 instrument"}</p><div class="discoveries">${discoveryCards(r.planet, r.parts)}</div><section class="science-recap" aria-label="Mission science recap"><div><span class="label">SCIENCE RECAP · NASA REFERENCE DATA</span><h2>What this mission explored</h2><p>${escapeHTML(worldInfo(r.planet).description)} Your selected instruments unlocked the reference facts shown above; they are not measurements returned by the simulated flight.</p></div><div class="recap-orbit"><span><small>SEMI-MAJOR AXIS</small><strong>${fmt(NASA_ORRERY_DATA[r.planet].sma, 3)} AU</strong></span><span><small>ORBITAL PERIOD</small><strong>${fmt(NASA_ORRERY_DATA[r.planet].period, 2)} days</strong></span></div><a href="${SOURCES.orrery}" target="_blank" rel="noopener">Explore the NASA orrery source ↗</a></section><div class="unlock-reveal">${unlocked ? '<span>✧ ' + unlocked + ' unlocked</span>' : '<span>✧ All worlds unlocked</span>'}${campaignLevel(campaign) <= 5 ? '<span>New parts in the rocket lab</span>' : ''}</div>` : `<p class="loss-balance">${fmt(campaign.credits)} CR remaining · Rocket cost ${fmt(r.cost)} CR</p>`}
    <div class="result-actions"><button class="primary" id="next-mission">${r.success ? unlocked ? 'Explore ' + unlocked : 'Choose your next mission' : 'Build another rocket'} <span>↗</span></button></div>${r.success ? '<small class="result-reference">NASA reference facts unlocked by your instruments. <a href="' + SOURCES.facts + '" target="_blank" rel="noopener">View source ↗</a></small>' : '<small class="result-reference">Your next attempt uses the same global credit balance.</small>'}</section>`;
  if (r.success) drawPlanet($('#result-planet'), r.planet);
  $('#next-mission').onclick = () => { rewardPending = false; if (r.success && unlocked) selected = unlocked; go(r.success ? 0 : 1); };
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
