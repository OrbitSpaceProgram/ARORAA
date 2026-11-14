// NASA_ORRERY_DATA — verbatim rows of the NASA ontology-based orrery table.
// Source: https://nasa.github.io/mission-viz/RMarkdown/ontology_based_orrery_generated_from_R_code.html
// Units: sma = AU, period = days. Angles are retained in the source's degrees.
// The 2D projection below follows the supplied Godot example: rotation = omega + raan.
// The source has no absolute epoch. All bodies begin at M=0 at simulation day zero;
// these are model positions, not today's ephemerides. inclination/tau remain auditable.
const NASA_ORRERY_DATA = {
  Mercury: { eccentricity: 0.20563, inclination: 3.38, omega: 48.331, period: 88.0, raan: 281.01, sma: 0.387098, tau: 29.124 },
  Venus: { eccentricity: 0.006772, inclination: 3.86, omega: 76.68, period: 224.701, raan: 272.76, sma: 0.723332, tau: 54.884 },
  Earth: { eccentricity: 0.016708, inclination: 7.155, omega: -11.26064, period: 365.25638, raan: 23.439281, sma: 1.0, tau: 114.20783 },
  Mars: { eccentricity: 0.0934, inclination: 5.65, omega: 49.558, period: 686.971, raan: 317.68143, sma: 1.523679, tau: 286.502 },
  Jupiter: { eccentricity: 0.0489, inclination: 6.09, omega: 100.464, period: 4332.59, raan: 268.057, sma: 5.2044, tau: 273.867 },
  Saturn: { eccentricity: 0.0565, inclination: 5.51, omega: 113.665, period: 10759.22, raan: 40.589, sma: 9.5826, tau: 339.392 },
  Uranus: { eccentricity: 0.046381, inclination: 6.48, omega: 74.006, period: 30688.5, raan: 257.311, sma: 19.2184, tau: 96.998856 },
  Neptune: { eccentricity: 0.009456, inclination: 6.43, omega: 131.784, period: 60182.0, raan: 299.3, sma: 30.110388, tau: 276.336 },
  Pluto: { eccentricity: 0.2488, inclination: 11.88, omega: 110.299, period: 90560.0, raan: 132.993, sma: 39.48, tau: 113.834 }
};

const SOURCES = {
  orrery: 'https://nasa.github.io/mission-viz/RMarkdown/ontology_based_orrery_generated_from_R_code.html',
  facts: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
  units: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html',
  science: 'https://science.nasa.gov/solar-system/',
  asteroids: 'https://science.nasa.gov/solar-system/asteroids/facts/',
  data: 'https://planetary.data.nasa.gov/find-data',
  trajectory: 'https://trajbrowser.arc.nasa.gov/traj_browser.php',
  rl10: 'https://ntrs.nasa.gov/api/citations/19910018888/downloads/19910018888.pdf',
  j2x: 'https://ntrs.nasa.gov/api/citations/20090038671/downloads/20090038671.pdf',
  materials: 'https://science.nasa.gov/wp-content/uploads/2024/02/rtg-study-d-99657-final-report-june-2017-export-marking-updated1.pdf',
  equation: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/'
};

// NASA metric fact sheet: diameter (km), surface gravity (m/s²), mean temperature
// (°C), global magnetic field. Each value is a reference fact, not a new reading.
const NASA_FACTS = {
  Mercury: { diameter: 4879, gravity: 3.7, temperature: 167, magnetic: 'Yes' },
  Venus: { diameter: 12104, gravity: 8.9, temperature: 464, magnetic: 'No' },
  Earth: { diameter: 12756, gravity: 9.8, temperature: 15, magnetic: 'Yes' },
  Mars: { diameter: 6792, gravity: 3.7, temperature: -65, magnetic: 'No' },
  Jupiter: { diameter: 142984, gravity: 23.1, temperature: -110, magnetic: 'Yes' },
  Saturn: { diameter: 120536, gravity: 9.0, temperature: -140, magnetic: 'Yes' },
  Uranus: { diameter: 51118, gravity: 8.7, temperature: -195, magnetic: 'Yes' },
  Neptune: { diameter: 49528, gravity: 11.0, temperature: -200, magnetic: 'Yes' },
  Pluto: { diameter: 2376, gravity: 0.6, temperature: -225, magnetic: 'Unknown' }
};

// SI definitions for kg/lb and N/lbf; AU from NASA Fact Sheet Notes.
const UNITS = { kgPerLb: 0.45359237, newtonsPerLbf: 4.4482216152605, g0: 9.80665, kmPerAU: 149597870.7 };

// NASA hardware references, separated from every game price or multiplier.
// RL10: NTRS 19910018888, printed p.176, RL10A-3-3A ENGINE box:
// 16,500 lbf vacuum thrust, 305 lb mass, 444.4 s Isp, 5:1 oxidizer/fuel.
// J-2X: NTRS 20090038671, slide 2, 2009 design requirements:
// 1307 kN vacuum thrust, 2516 kg mass, minimum 448 s Isp, 5.5 O/F.
// J-2X was a development engine; this is not a claim it flew operationally.
const NASA_ENGINES = [
  { id: 'rl10', name: 'RL10A-3-3A', massKg: 305 * UNITS.kgPerLb, thrustN: 16500 * UNITS.newtonsPerLbf, ispSeconds: 444.4, oxidizerRatio: 5, propellant: 'Liquid hydrogen / liquid oxygen', source: SOURCES.rl10, note: 'Centaur heritage · vacuum rating' },
  { id: 'j2x', name: 'J-2X', massKg: 2516, thrustN: 1307000, ispSeconds: 448, oxidizerRatio: 5.5, propellant: 'Liquid hydrogen / liquid oxygen', source: SOURCES.j2x, note: '2009 development requirements · vacuum rating' }
];

// JPL D-99657, June 2017, Table F-4, printed F-7 / PDF p.145.
// Densities only. Gameplay collision endurance is NOT a measured material strength.
const NASA_MATERIALS = [
  { id: 'aluminum', name: 'Aluminum 6061-T6', density: 2700, color: '#c7d3e7' },
  { id: 'titanium', name: 'Titanium Ti-6Al-4V', density: 4430, color: '#a4a0c9' },
  { id: 'inconel', name: 'Inconel 625', density: 8440, color: '#d4b899' }
];

const WORLDS = [
  { name: 'Mercury', type: 'Rocky planet', color: '#a8a39d', description: 'Map a cratered surface and examine a world of extreme temperatures.', science: ['Surface imaging', 'Thermal observations'] },
  { name: 'Venus', type: 'Rocky planet', color: '#dab66f', description: 'Observe a cloud-covered world with a dense atmosphere.', science: ['Cloud observations', 'Thermal data'] },
  { name: 'Mars', type: 'Rocky planet', color: '#df8064', description: 'A rocky world. A new perspective. Investigate its terrain and environment.', science: ['Surface mapping', 'Thermal observations'] },
  { name: 'Jupiter', type: 'Gas giant', color: '#d2b094', description: 'Investigate cloud systems and the environment of a giant planet.', science: ['Cloud imaging', 'Magnetic fields'] },
  { name: 'Saturn', type: 'Gas giant', color: '#d9c58d', description: 'Explore the rings and atmospheric environment of a gas giant.', science: ['Ring imaging', 'Magnetic fields'] },
  { name: 'Uranus', type: 'Ice giant', color: '#8ad2d7', description: 'Study an ice giant through atmospheric and magnetic observations.', science: ['Atmospheric imaging', 'Magnetic fields'] },
  { name: 'Neptune', type: 'Ice giant', color: '#638de5', description: 'Investigate the atmospheric environment of a distant ice giant.', science: ['Cloud imaging', 'Thermal observations'] },
  { name: 'Pluto', type: 'Dwarf planet', color: '#b8a99a', description: 'Travel beyond the planets to examine an icy dwarf world.', science: ['Surface imaging', 'Thermal observations'] }
];

// GAME_RULES: fictional prices, design allocations, HP, and arcade compression.
// These are never attributed to NASA or presented as real hardware specifications.
// All bus/instrument/tank masses are YOUR design allocations, expressed in kg.
const GAME_RULES = {
  initialCredits: 5000, scanSeconds: 6, minimumAngularTravel: 0.4,
  hullVolumeM3: 0.2, tankMassFraction: 0.04, avionicsKg: 120,
  fuelLoads: [3000, 8000, 20000, 50000], fuelPrices: [180, 360, 750, 1500],
  enginePrices: [180, 650], materialPrices: [120, 260, 440], hullHP: [80, 135, 220],
  boosterCounts: [1, 2, 4], integrationPrice: 120,
  satellites: [{ name: 'Imaging orbiter', massKg: 80, cost: 140, scanRate: 1 }, { name: 'Survey orbiter', massKg: 180, cost: 240, scanRate: 1.15 }, { name: 'Research orbiter', massKg: 420, cost: 360, scanRate: 1.3 }],
  instruments: [{ name: 'Imaging camera', massKg: 5, cost: 80, kind: 'camera' }, { name: 'Thermal radiometer', massKg: 10, cost: 110, kind: 'thermal' }, { name: 'Magnetometer', massKg: 4, cost: 100, kind: 'magnetic' }],
  // All heliocentric positions use ONE linear scale. Planet radii are exaggerated.
  // Solar GM in compressed world units, derived from Earth's a and period.
  auScale: 1200, daysPerSecond: 1, gravityScale: 12,
  sunMu: 4 * Math.PI ** 2 * 1200 ** 3 / NASA_ORRERY_DATA.Earth.period ** 2,
  controlAccelerationScale: 6, fuelBurnTimeScale: 0.08,
  cruiseBoost: 5, maximumCruiseSpeed: 1800,
  // Belt is a schematic distribution between Mars and Jupiter, not asteroid data.
  beltInnerAU: 2.1, beltOuterAU: 3.3,
  planetRadii: { Mercury: 19, Venus: 25, Earth: 27, Mars: 22, Jupiter: 62, Saturn: 54, Uranus: 38, Neptune: 36, Pluto: 18 }
};
