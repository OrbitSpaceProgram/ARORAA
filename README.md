# Orbit Foundry

Open **dist/index.html** in a modern browser. No installation, server, account, or internet connection is required. All graphics are procedural canvas pixel art. The game also supports static hosting.

## Quick judge walkthrough

1. Select **Mercury** for a short inner-system flight and choose **Build your rocket**.
2. Choose engine, booster count, propellant load, material, satellite, and instruments. **Recommended assembly** selects a viable starting build.
3. **Buy & launch** deducts the purchase from the single global wallet. Click **Take flight**.
4. The ship begins outside Earth, facing the target. Hold **W / Up** to thrust. **A/D / Left/Right** rotate; **Space / S** fires retrograde brakes; **Shift + thrust** boosts cruise. Use small burns rather than holding boost through arrival.
5. Follow the cyan direction arrow. Brake before the target, enter its cyan orbital band, and press **F** for optional orbital trim. Keep moving in the band for six scan seconds and at least 0.4 radians of orbital travel. The target has gravity; touching it fails the mission.
6. Read the facts unlocked by your instruments. A successful scan deposits a sponsor grant and records an Explorer badge. Failed flights receive no refund.

**M** toggles a solar-system overview, **P** pauses, and touch buttons provide the same controls. **Expand** enters fullscreen on supported desktop browsers. Flight starts paused; a browser reload resumes the same already-paid mission, also paused.

## Campaign credits

There is **one balance**, initially **5,000 game credits**. No planet has its own budget. Selection previews cost nothing; buying the cart charges its full cost once. A win deposits a grant once. A failed or abandoned flight keeps its purchase charge. Retry means buying another rocket.

The header wallet opens a transaction ledger. Credits, ledger, paid flight state, and mission outcomes share one localStorage record (`orbit-foundry-campaign-v2`). Old version-one mission budgets and badge bonuses are not used. A campaign ends in **Mission failed / Bankruptcy** when an ended flight leaves less than **820 CR**, the cheapest valid new spacecraft. An active paid flight can still finish even when its remaining wallet is low. Only an explicit **Start new campaign** restores starting capital and resets history.

## Data and code map

- **`dist/data.js`** starts with the clearly labeled **`NASA_ORRERY_DATA`** constant: all nine exact source rows, including Earth, with source comments. `NASA_FACTS`, `NASA_ENGINES`, `NASA_MATERIALS`, and `GAME_RULES` are kept separate.
- **`dist/core.js`** contains the Kepler solver, engineering calculations, credit transactions, softened gravity, thrust/inertia integration, and target-only capture rules.
- **`dist/flight.js`** draws the freely navigable solar system, ship, flight telemetry, direction arrow, radar, orbital bands, and hazards.
- **`dist/app.js`** implements the builder, persistence, purchases, results, bankruptcy, ledger, and source dialog.

Each planet solves **M = 2πt/P** and **E − e sin E = M** with ten Newton iterations. Coordinates match the supplied Godot example and rotate by **omega + raan**. The same **1,200 world units/AU** applies everywhere, with **one simulated day per second**. Positions update continuously; Earth separation is the magnitude of the two model position vectors, displayed in AU and converted to km. This replaces the old difference-of-semi-major-axes proxy.

The orrery source does not provide a common ephemeris epoch. Phase zero is therefore illustrative, not today's planetary positions. Source inclination and tau are retained verbatim, but the requested 2D projection does not apply inclination or infer tau's convention. Planet diameters on screen are exaggerated so the game remains playable; orbital distances retain one linear scale. The radar can fit the local region while **M** shows the entire solar system.

## Verified hardware and units

- **RL10A-3-3A**: NASA NTRS [19910018888, printed p.176](https://ntrs.nasa.gov/api/citations/19910018888/downloads/19910018888.pdf): 16,500 lbf vacuum thrust, 305 lb mass, 444.4 s specific impulse, oxidizer/fuel ratio 5:1. The code converts lbf to N and lb to kg.
- **J-2X**: NASA NTRS [20090038671, slide 2](https://ntrs.nasa.gov/api/citations/20090038671/downloads/20090038671.pdf): 1,307 kN, 2,516 kg, minimum 448 s Isp, 5.5 O/F. These are the **2009 development requirements**, not a claim of operational service.
- Both use **liquid hydrogen / liquid oxygen**. Players choose numeric total propellant loads in **kg**; the builder calculates the separate fuel and oxidizer masses using the chosen engine's mixture ratio. Clustering 1, 2, or 4 engines multiplies thrust, mass, price, and flow.
- Material densities come from NASA/JPL [D-99657, table F-4, PDF p.145](https://science.nasa.gov/wp-content/uploads/2024/02/rtg-study-d-99657-final-report-june-2017-export-marking-updated1.pdf): aluminum 6061-T6, 2,700; titanium Ti-6Al-4V, 4,430; Inconel 625, 8,440 kg/m³. A common design volume of 0.2 m³ gives hull masses of 540, 886, and 1,688 kg.

Wet/dry mass is in **kg**, thrust in **kN**, initial acceleration in **m/s²**, ideal delta-v in **m/s**, Isp in **seconds**, and propellant flow in **kg/s**. The ideal rocket equation is **Δv = Isp g₀ ln(wet/dry)**, as explained by [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/). More mass reduces F/m and the game cruise ceiling; a larger booster cluster improves acceleration but adds mass and burns more propellant.

These NASA hardware documents supplement the original planetary sources to satisfy the updated real-engine request. All source links and formulas are also available through **NASA data** in the game.

## Simulation limits and game rules

Gravity is inverse-square with softening. Every planet exerts attraction, including non-target bodies. The Sun's world-space gravitational parameter is derived from the model Earth orbit. Local planet gravity starts with the NASA fact-sheet surface values and is scaled for play. Steering, thrust, boost, fuel burn, local gravity, and ship speeds are compressed separately: this is a playable gravity/inertia challenge, not a physical interplanetary transfer simulator. Velocity and gravity HUDs explicitly use **world units/s** and **world units/s²**.

Build checks cover affordability, positive propellant, a science instrument, and rated thrust against Earth-reference weight. That final check uses vacuum engine ratings and is a classroom rule, not sea-level launch certification. Departure begins outside Earth. Fuel is consumed during actual burns; there is no invented engine range in AU. The real rocket-equation delta-v is an assembly comparison, not a claim that this cart reaches any particular world. Real mission planning would additionally require launch windows, staging, arrival delta-v and trajectory calculations; the supplied [NASA Trajectory Browser](https://trajbrowser.arc.nasa.gov/traj_browser.php) remains linked.

Satellite/instrument masses, hull volume, tank mass fraction, avionics allocation, prices, grants, HP, scan rates and compression are explicit **game design choices**. Higher hull mass receives more game HP as requested; density alone does not determine real material strength. Fact cards unlock existing NASA reference information rather than generating new measurements or invented discoveries.

**Only the selected destination** can scan, finish a mission, or award a grant. Other planets have gravity but no scan, reward, or planet collision failure. The selected planet and Sun cause collision failure. Scanning requires suitable relative speed, low radial velocity, time in the band, and real angular progress, so stationary hovering cannot finish the mission. Optional **F** trim uses propellant and only acts near the chosen planet's band.

The asteroid belt is drawn **between Mars and Jupiter**. Rock positions, schematic 2.1–3.3 AU display bounds, spacing and comets are game hazards, not measured asteroid data. Outer-planet and Pluto missions activate belt/asteroid/comet collisions; inner-system routes do not. No physical asteroid belt is placed around a gas giant.

## Maintainer checks (not needed to play)

`node tests/core.test.cjs` checks source orbital closure/scale, SI engineering, mass/acceleration trade-offs, one-time purchases and rewards, bankruptcy, fuel, target gating, and achievable capture at all eight destinations.

`node tests/browser.test.cjs` runs optional dependency-free headless Chrome checks: purchases, keyboard flight, pause, reload/resume, instrument results, rewards, bankruptcy/reset, insufficient funds, and mobile layouts. On Windows it uses the installed Chrome path; set `CHROME_PATH` for another installation. Screenshots and the disposable browser profile go in ignored `outputs/`.

All art is procedural pixel art. There are no third-party libraries, font downloads, analytics, accounts, or setup steps. Gameplay works offline, with in-memory persistence if storage is unavailable. Screen transitions respect reduced-motion settings. The hosted site remains public and does not require ChatGPT login.
