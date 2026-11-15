function worldInfo(name) { return WORLDS.find(w => w.name === name) || { name: 'Earth', type: 'Home world', color: '#6babd6' }; }

function drawPlanet(canvas, name, phase = 0) {
  const image = PLANET_ARTWORK[name];
  if (!image || !image.complete || !image.naturalWidth) throw Error('Planet artwork is not ready: ' + name);
  canvas.width = 128; canvas.height = 128;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, 128, 128); c.drawImage(image, 0, 0, 128, 128);
  // Keep the original animation callback/phase. Gentle surface drift leaves
  // the supplied artwork, fixed silhouette, and Saturn's rings intact.
  if (phase && name !== 'Saturn') {
    const radius = 37, shift = Math.sin(phase * .04) * 1.1;
    c.save(); c.beginPath(); c.arc(64, 64, radius, 0, TAU); c.clip(); c.globalAlpha = .45;
    for (let y = 28; y < 101; y++) {
      const latitude = (y - 64) / radius;
      const offset = shift * Math.sqrt(Math.max(0, 1 - latitude * latitude));
      c.drawImage(image, 0, y, 128, 1, offset, y, 128, 1);
    }
    c.restore();
  }
}

function planetSprite(name) {
  if (!sprites.has(name)) { const c = document.createElement('canvas'); drawPlanet(c, name); sprites.set(name, c); }
  return sprites.get(name);
}
function drawRocket(c, x, y, angle, scale, config, burning = false, turnJet = 0) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  c.fillStyle = '#c7d3e7';
  c.fillRect(-12, -5, 23, 10); c.fillRect(11, -3, 6, 6); c.fillRect(17, -1, 4, 2);
  c.fillStyle = '#ebf9ff'; c.fillRect(-8, -5, 17, 2);
  c.fillStyle = '#75e9ed'; c.fillRect(4, -3, 5, 5);
  c.fillStyle = '#5c82b1'; c.fillRect(-10, -10, 10, 5); c.fillRect(-10, 5, 10, 5);
  if (config.boosters >= 2) { c.fillStyle = '#a2b4ca'; c.fillRect(-14, -8, 13, 3); c.fillRect(-14, 5, 13, 3); }
  if (config.boosters === 4) { c.fillRect(-16, -12, 12, 3); c.fillRect(-16, 9, 12, 3); }
  if (config.instruments.length > 1) { c.fillStyle = '#7d7bd2'; c.fillRect(-4, -16, 7, 8); c.fillRect(-4, 8, 7, 8); }
  if (config.instruments.includes(2)) { c.fillStyle = '#98f9d9'; c.fillRect(2, -11, 1, 7); }
  if (burning) { c.fillStyle = '#6bd7f6'; c.fillRect(-23, -4, 11, 8); c.fillStyle = '#b8ffff'; c.fillRect(-20, -2, 8, 4); c.fillStyle = '#596eec'; c.fillRect(-29, -2, 6, 4); }
  // Rocket points along +X. Left is -Y: its forward jet pushes the nose right.
  if (turnJet) {
    const side = turnJet > 0 ? -1 : 1, length = 9 + config.boosters * 2;
    c.fillStyle = '#7198f5'; c.fillRect(4, side < 0 ? -7 - length : 7, 5, length);
    c.fillStyle = '#adffff'; c.fillRect(5, side < 0 ? -14 : 7, 3, 7);
    c.fillStyle = '#efffff'; c.fillRect(5, side < 0 ? -10 : 7, 3, 3);
  }
  c.restore();
}

