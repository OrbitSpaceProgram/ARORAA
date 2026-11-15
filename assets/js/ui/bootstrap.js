$('.close').onclick = closeModal;
$('#sources-nav').onclick = notes;
$('#archive-nav').onclick = archive; $('#wallet').onclick = ledger;
$('#mission-nav').onclick = () => requestStage(0);

window.addEventListener('pagehide', () => { if (flightController) saveFlight(flightController.state); });
window.addEventListener('scroll', positionPartInfo, { passive: true, capture: true });
window.addEventListener('resize', positionPartInfo, { passive: true });
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePartInfo(); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.part-row,.part-popover')) hidePartInfo(); });
document.addEventListener('focusin', event => { if (!event.target.closest('.part-row,.part-popover')) hidePartInfo(); });
saveCampaign();
$('#start-program').onclick = async () => {
  const startButton = $('#start-program');
  startButton.disabled = true;
  try { await planetAssetsReady; }
  catch (error) { console.error(error); startButton.disabled = false; return; }
  $('#intro-screen').hidden = true;
  document.body.classList.remove('intro-mode');
  step = campaign.mission ? 2 : 0;
  render();
  (document.querySelector('#start-flight') || document.querySelector('#build'))?.focus({ preventScroll: true });
};
