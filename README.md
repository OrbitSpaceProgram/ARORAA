# Orbit Foundry

Open **dist/index.html** in a modern browser. No setup, installation, account, or internet connection is needed. The hosted website is public and does not require ChatGPT login.

## Quick judge walkthrough

1. **Choose Mercury.** Browse the single planet card with arrows, the keyboard, dots, or a swipe. Locked worlds can be previewed, but cannot be launched.
2. **Build a basic rocket.** Choose an engine, boosters, fuel, and scientific instruments. The initial loadout costs **620 CR** from a **1,000 CR** starting balance. The orbiter chassis is included; there are no satellite-type or rocket-material selectors.
3. Click **Buy & launch**, then **Take flight**. Rotate with **A/D or Left/Right**, thrust with **W/Up**, brake with **Space/S**, and boost with **Shift + thrust**. Touch buttons are below the window.
4. Follow the direction arrow and brake near Mercury. **Stay in the cyan orbital band for six scan seconds.** Scanning and gentle stabilization happen automatically: no F key or extra action is needed. Only the chosen destination can complete the mission.
5. See a simple science report, collect the sponsor grant, and watch credit tokens fly to the global wallet. The first success unlocks **Venus**, additional parts, and more spending money. Continue through the solar system.

**P** pauses. **M** toggles a solar-system overview. Desktop **Expand** enters fullscreen. Instructions remain below the play window. Reloading resumes the already-paid flight, paused, without charging again.

## Progression and credits

There is **one persistent global balance**. Browsing and building previews cost nothing; **Buy & launch** deducts the entire cart exactly once. A successful mission deposits a grant exactly once. Failed or abandoned rockets receive no refund.

New campaigns start with Mercury and basic parts. Every successful flight opens one more world in order: **Mercury → Venus → Mars → Jupiter → Saturn → Uranus → Neptune → Pluto**. Replaying an available world also counts as a successful flight. A failure never unlocks a world.

| Successful flights | Additional parts |
| --- | --- |
| 0 | RL10A-3-3A, one engine, 3,000 kg propellant, imaging camera |
| 1 | Two-engine cluster, 8,000 kg propellant, thermal radiometer |
| 2 | Magnetometer |
| 3 | J-2X engine, 20,000 kg propellant |
| 4 | Four-engine cluster |
| 5 | 50,000 kg propellant |

Prices, rewards, and unlock thresholds are game rules. The starting balance cannot buy all the parts, and later parts are locked until earned. A first Mercury win changes the wallet from **1,000 − 620 + 900 = 1,280 CR**. Recommended loadouts are affordable on a first-try successful tour through all eight destinations.

The header wallet opens the transaction ledger. A campaign ends in **Mission failed / Bankruptcy** when a completed or failed flight leaves less than **620 CR**, the cheapest valid new build. An already-paid active flight can still win with a smaller remaining wallet. Only an explicit **Start new campaign** resets credits, badges, and history.

Progress saves to `orbit-foundry-campaign-v3` in localStorage. Existing version-two purchases, earned credits, completed missions, and paid flights are migrated rather than discarded. An untouched old starting wallet gets the new 1,000 CR starting budget. If browser storage is unavailable, the game works for the current session.

## Fuel, hull, and orbiting

- The builder uses real units: fuel in kg, engine mass in kg, and thrust in kN. Flight displays **fuel as a percentage**. Burns and boost consume fuel at a deliberately accelerated game rate; reaching 0% fails the mission. Coasting saves fuel.
- Hull starts at **100%**. A target-planet impact removes **25%**, solar heat **40%**, asteroid impacts **30%**, comet impacts **55%**, and belt-rock contacts **24%**. Impacts knock the ship back. A short cooldown stops one contact from counting repeatedly. One hit at full hull cannot end the mission; **0% hull** does.
- Scan progress accrues while the ship remains in the target's orbital band. There is no key to hold and no hidden angular-travel or minimum-speed gate. Gentle stabilization works automatically for a slow arrival, but cannot catch a fast flyby or overpower steering. Gravity continues to act.
- Only the selected planet can scan or pay a reward. Other planets exert gravity but have no mission completion or collision penalty.

Fuel, hull, and scan bars have no surrounding panel backgrounds. Every planet in the target strip has its full name. Controls, instructions, and detailed telemetry are below the play window. Planet bodies use square canvases and undistorted circular sprites; Saturn retains its elliptical ring around a circular body. The destination card has gently moving textures and a floating animation. Reduced-motion settings disable decorative motion and credit-token flight.

## Source and code map

- **`dist/data.js`** begins with **`NASA_ORRERY_DATA`**, the nine exact rows from the supplied [NASA ontology-based orrery](https://nasa.github.io/mission-viz/RMarkdown/ontology_based_orrery_generated_from_R_code.html). Scientific values and hardware references are separate from `GAME_RULES`.
- **`dist/core.js`** contains the Kepler solver, real-unit engineering calculations, unlock rules, purchases, grants, gravity, fuel, hull collisions, and orbital scanning.
- **`dist/app.js`** implements the carousel, four-part builder, persistent campaign, migration, results, and credit-token animation. Reward animation changes only the display: the actual grant is applied once before rendering.
- **`dist/flight.js`** draws free flight, NASA orbits, the chosen-target arrow, radar, orbital band, and outer-system hazards.
- **`dist/style.css`** and **`dist/flight.css`** style the pixel-art interface. All art is procedural; there are no image or font downloads.

Each planet solves **M = 2πt/P** and **E − e sin E = M** using ten Newton iterations, then rotates **(a(cos E−e), a√(1−e²)sin E)** by **omega + raan**, matching the supplied Godot example. Every orbit uses **1,200 world units/AU** and **one simulated day per second**. Earth distance is the separation of the two model position vectors, not a difference-of-semi-major-axes proxy. Kilometers use the AU conversion in [NASA fact-sheet notes](https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html).

The orrery does not specify a common epoch. Phase zero is illustrative, not today's planetary positions. Inclination and tau remain in the source constant, but the requested 2D projection does not apply them. Planet display sizes are exaggerated for play; orbital positions retain one linear scale. The bodies are circles; the **orbital paths remain eccentric ellipses** from NASA data.

## Real engines and scientific facts

- **RL10A-3-3A**: [NASA NTRS 19910018888, printed p.176](https://ntrs.nasa.gov/api/citations/19910018888/downloads/19910018888.pdf): 16,500 lbf vacuum thrust, 305 lb mass, 444.4 s Isp, 5:1 oxidizer/fuel. The code converts to N and kg.
- **J-2X**: [NASA NTRS 20090038671, slide 2](https://ntrs.nasa.gov/api/citations/20090038671/downloads/20090038671.pdf): 1,307 kN, 2,516 kg, minimum 448 s Isp, 5.5 O/F. These are the **2009 development requirements**, not a claim of operational service.
- Both engines use liquid hydrogen and liquid oxygen. Clusters multiply thrust, mass, price, and consumption. Ideal **Δv = Isp g₀ ln(wet/dry)** and **flow = thrust/(Isp g₀)** follow [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/).
- Results unlock existing [NASA planetary fact-sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) values based on the selected instruments. They are reference facts, not newly generated scientific measurements. Descriptions use [Solar System Exploration](https://science.nasa.gov/solar-system/); the [NASA planetary data directory](https://planetary.data.nasa.gov/find-data) links real observations.

The fixed 740 kg chassis and instrument/tank masses are design allocations. Credits, HP, unlocks, fuel scaling, steering, and rewards are explicitly game parameters. Build thrust checks compare vacuum ratings with Earth-reference weight as a classroom rule; departure begins outside Earth. Ideal delta-v is not a prediction of destination feasibility. Actual mission planning needs launch windows, staging, and arrival maneuvers; the supplied [NASA Trajectory Browser](https://trajbrowser.arc.nasa.gov/traj_browser.php) remains linked.

Gravity is softened inverse-square attraction from every planet and the Sun. Time, thrust, gravity, and consumption have separate game compression. This is an educational piloting game, not a physical transfer simulator. The asteroid belt is between Mars and Jupiter; its visual bounds, rocks and comets are schematic game hazards, not measured asteroid data. Outer-planet and Pluto missions activate these hazards.

## Optional maintainer verification

Playing does not require these commands:

- `node tests/core.test.cjs` verifies source orbits, unlocks, part gating, credit accounting, bankruptcy, affordable progression, finite fuel, percentage collision damage, and all eight automatic orbital scans.
- `node tests/browser.test.cjs` uses installed Chrome, without npm dependencies, to verify migration, the carousel, circular artwork, locked navigation/parts, purchases, fuel/hull percentages, no-key scanning, animated rewards, unlocks, and mobile layouts. Set `CHROME_PATH` if needed. Artifacts go in ignored `outputs/`.
