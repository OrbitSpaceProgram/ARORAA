function destinations(direction = 0) {
  cancelAnimationFrame(planetAnimation);
  const index = WORLDS.findIndex(w => w.name === selected), w = worldInfo(selected);
  const orbit = NASA_ORRERY_DATA[selected], facts = NASA_FACTS[selected];
  const open = destinationUnlocked(campaign, selected), distance = earthDistance(selected, campaign.days);
  const remaining = missionsUntilUnlock(campaign, selected);
  $('#screen').innerHTML = `<div class="destination-heading"><div><h1>Choose a destination.</h1></div><span class="progress-label">${unlockedWorldCount(campaign)} / 8 WORLDS UNLOCKED</span></div>
  <section class="destination-deck ${open ? '' : 'destination-locked'}" aria-roledescription="carousel" aria-label="Mission destinations" tabindex="0">
  <button class="carousel-arrow previous" id="previous-world" aria-label="Previous planet">←</button>
  <article class="destination-card ${direction > 0 ? 'slide-next' : direction < 0 ? 'slide-prev' : ''}" aria-live="polite">
    <div class="world-stage"><div class="world-orbit orbit-one"></div><div class="world-orbit orbit-two"></div><div class="planet-float"><canvas id="destination-planet" aria-label="Animated circular pixel-art ${selected}"></canvas></div><span class="world-classification">${w.type.toUpperCase()}</span></div>
    <div class="destination-copy"><span class="destination-status ${open ? 'pass' : ''}">${open ? '● MISSION AVAILABLE' : '◇ DESTINATION LOCKED'}</span><h2>${selected}</h2><p>${w.description}</p><div class="card-science">${w.science.map(s => `<span>${s}</span>`).join('')}</div><div class="destination-stats"><div><small>FROM EARTH · MODEL</small><strong>${fmt(distance, 3)} <em>AU</em></strong><span>${fmt(distance * UNITS.kmPerAU / 1e6, 1)} million km</span></div><div><small>MISSION REWARD</small><strong>+${fmt(missionReward(selected, defaultParts()))} <em>CR</em></strong><span>Added to your global credits</span></div></div>
    <button class="primary" id="build" ${open ? '' : 'disabled'}>${open ? 'Build your rocket' : remaining + ' more successful mission' + (remaining === 1 ? '' : 's') + ' to unlock'} <span>${open ? '↗' : '◇'}</span></button></div>
  </article><button class="carousel-arrow next" id="next-world" aria-label="Next planet">→</button></section>
  <div class="carousel-footer"><span>0${index + 1} <b>/ 08</b></span><div class="carousel-dots" aria-label="Planet navigation">${WORLDS.map((p, i) => `<button data-planet="${p.name}" class="${p.name === selected ? 'selected' : ''} ${destinationUnlocked(campaign, p.name) ? 'unlocked' : 'locked'}" aria-label="${p.name}${destinationUnlocked(campaign, p.name) ? '' : ', locked'}" aria-pressed="${p.name === selected}" title="${p.name}"><span></span></button>`).join('')}</div></div>`;
  const canvas = $('#destination-planet'); drawPlanet(canvas, selected);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let last = 0;
    const animate = time => { if (step !== 0 || !canvas.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return; if (time - last > 70) { drawPlanet(canvas, selected, time * 0.004); last = time; } planetAnimation = requestAnimationFrame(animate); };
    planetAnimation = requestAnimationFrame(animate);
  }
  function move(offset) { selected = WORLDS[(index + offset + WORLDS.length) % WORLDS.length].name; destinations(offset); }
  $('#previous-world').onclick = () => move(-1); $('#next-world').onclick = () => move(1);
  $('.destination-deck').onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); $('.destination-deck').focus(); } };
  let touchX = null;
  $('.world-stage').onpointerdown = e => touchX = e.clientX;
  $('.world-stage').onpointerup = e => { if (touchX !== null && Math.abs(e.clientX - touchX) > 45) move(e.clientX < touchX ? 1 : -1); touchX = null; };
  document.querySelectorAll('[data-planet]').forEach(b => b.onclick = () => { const previous = index; selected = b.dataset.planet; destinations(WORLDS.findIndex(w => w.name === selected) > previous ? 1 : -1); });
  $('#build').onclick = () => { if (open) { parts = recommendedParts(campaign, selected); labCategory = 'engine'; pinnedPart = detailPart = null; go(1); } };
}

