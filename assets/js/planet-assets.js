/* Supplied artwork normalized to the existing 128px sprite coordinate system. */
const PLANET_ARTWORK = Object.create(null);
const PLANET_ASSET_URLS = {
  "Mercury": "assets/images/planets/mercury.png",
  "Venus": "assets/images/planets/venus.png",
  "Earth": "assets/images/planets/earth.png",
  "Mars": "assets/images/planets/mars.png",
  "Jupiter": "assets/images/planets/jupiter.png",
  "Saturn": "assets/images/planets/saturn.png",
  "Uranus": "assets/images/planets/uranus.png",
  "Neptune": "assets/images/planets/neptune.png",
  "Pluto": "assets/images/planets/pluto.png"
};
const planetAssetsReady = Promise.all(Object.entries(PLANET_ASSET_URLS).map(([name, url]) => new Promise((resolve, reject) => {
  const image = new Image(); PLANET_ARTWORK[name] = image;
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not load planet artwork: ' + name));
  image.src = url;
})));
planetAssetsReady.catch(error => console.error(error));
