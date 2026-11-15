# Orbit Space Program (OSP)

Open **dist/index.html** in a modern browser. No installation, account, internet connection, or ChatGPT login is required. The existing public link remains valid.

## Quick judge walkthrough

1. **Choose Venus.** Browse the animated circular planet cards with arrows, keyboard, dots, or a swipe. Locked cards show the number of **additional** successful missions needed. The briefing below the carousel presents the existing NASA orbital and planetary reference values and separates them from simplified gameplay.
2. **Build your rocket.** The left category panel starts on **Engines**. Switch to Boosters, Fuel tanks, or Instruments to see only those parts. Hover or focus a part to read its specifications to the left; tap **i** for details on a phone. NASA references are linked in each information panel. Escape or × closes it.
3. The basic rocket costs **620 CR** from **1,000 CR** starting credits. **Buy & launch** charges once; **Take flight** starts the paused mission.
4. Rotate with **A/D or Left/Right**, thrust with **W/Up**, brake with **Space/S**, and boost with **Shift + thrust**. Touch controls are below the play window. Left jets turn right; right jets turn left. Better booster assemblies increase turning performance. Thrust ramps up, velocity builds, and coasting preserves momentum.
5. Follow the target arrow. Burn, coast, and brake early; save fuel for arrival. **Remain in the cyan orbital band for six scan seconds.** No F key is needed. Only your chosen destination can complete the mission.
6. The victory screen shows instrument-specific NASA reference facts, an orbit recap, and the grant. These are reference values shown by the game, not measurements returned by the simulated flight. Credit tokens fly into the persistent wallet. **Explore Mars** continues to the next destination.

The first expedition can take about a minute with a controlled approach; the outer missions are substantially longer and harder. **P** pauses, **M** shows the solar-system map, and **Expand** enters fullscreen on desktop. Reloading resumes the paid spacecraft paused, without buying it again. Controls and piloting guidance stay below the game window.

## Campaign and rewards

There is **one global credit balance**. Browsing and assembly previews are free. Purchases deduct the cart once; a successful orbital scan pays once. Failed or abandoned rockets are not refunded. Bankruptcy ends the campaign when a settled mission leaves less than **620 CR**, the cheapest valid build. The wallet opens the ledger and an explicit reset action.

New campaigns unlock worlds in this order:

**Venus → Mars → Mercury → Jupiter → Saturn → Uranus → Neptune → Pluto**

Every success, including a replay, opens the next locked destination. Failures do not count. Existing earned destinations are retained when migrating older campaigns; future wins fill any missing worlds in the new order.

| Destination | Base grant, one instrument |
| --- | ---: |
| Venus | 900 CR |
| Mars | 1,200 CR |
| Mercury | 1,600 CR |
| Jupiter | 2,800 CR |
| Saturn | 3,800 CR |
| Uranus | 5,000 CR |
| Neptune | 6,500 CR |
| Pluto | 8,500 CR |

Each **additional** instrument adds **30% of the base grant**. Two instruments earn 1.3× and three earn 1.6×. For example, a three-instrument Pluto scan pays **13,600 CR**. These are game credits, not real mission costs. The first Venus win gives **1,000 − 620 + 900 = 1,280 CR**.

| Successful flights | Additional parts |
| --- | --- |
| 0 | RL10A-3-3A, single engine, 3,000 kg propellant, camera |
| 1 | Two-engine cluster, 8,000 kg propellant, thermal radiometer |
| 2 | Magnetometer |
| 3 | J-2X, 20,000 kg propellant |
| 4 | Four-engine cluster |
| 5 | 50,000 kg propellant |

Recommended builds remain affordable on a first-try successful tour and use advanced engines on outer routes. Fuel, engine count, and payload mass are genuine trade-offs within the game: extra engines increase thrust, mass, fuel use, and turning performance; more propellant improves ideal delta-v but slows initial acceleration. Cluster prices include the engines and are charged once.

Progress saves under **osp-campaign-v4** in localStorage. Version-two and version-three credits, records, earned destinations, receipts, and active paid missions migrate automatically. Old flight coordinates are converted to the larger world; near-planet saves preserve their local orbit position. An untouched old starting wallet adopts the new starting budget. Storage-unavailable browsers can play for the session.

## Flight and challenge

- Fuel appears as a **percentage** in flight; the lab uses kg. Throttle ramps up over 1.4 seconds. F/m changes velocity continuously; there is no artificial speed cap or drag. Powered steering, braking, boost, and automatic orbital stabilization use propellant. Pure coasting does not. Fuel consumption is accelerated 5× as a game rule. Empty fuel fails the mission.
- Opposite-side attitude jets visibly fire when turning. Turning has angular acceleration and inertia; releasing a turn applies counter-thrust to stop rotation. Booster count and engine tier improve torque and turn rate; added mass reduces responsiveness. These attitude-control allocations are game parameters, not NASA hardware ratings.
- Hull starts at **100%**. Target impacts remove **25%**, solar heat **40%**, asteroids and belt rocks **30%**, and comets **55%**. Collisions knock the ship back, with a short cooldown so one contact is not counted repeatedly. One hit at full hull is survivable. Zero hull ends the mission.
- Scanning and gentle stabilization begin automatically in the selected planet's orbital band. A fast flyby will overshoot, so the guidance line warns when estimated braking distance exceeds the remaining approach. Other planets have gravity but never pay rewards or progress the scan.
- Giant-planet and Pluto routes activate hazards. The main belt is a broad annulus between Mars and Jupiter: **2.1–3.5 model AU**, or **33,600 world units** wide. Deterministic spatial cells populate the whole band with larger rocks; frequent crossing streams include more comets. Slow down, find gaps, and use stronger steering to cross. Outside the belt, encounters are less frequent.

The belt's density, precise boundaries, obstacle sizes, and encounter rates are **game settings**, not measured asteroid data or a depiction of real asteroid spacing. Advanced ships give better control; they do not make the belt harmless.

## NASA data and scale

**dist/data.js begins with NASA_ORRERY_DATA**, retaining the exact nine rows of the supplied [NASA ontology-based orrery](https://nasa.github.io/mission-viz/RMarkdown/ontology_based_orrery_generated_from_R_code.html), including unused inclination and tau fields. Comments cite the source; game allocations are clearly separated in **GAME_RULES**.

The destination briefing and post-flight science recap display existing values from **NASA_ORRERY_DATA** and **NASA_FACTS**, with links to their existing NASA sources. They do not add or modify scientific data. The game continues to label its compressed travel, visual scale, and flight behavior as simplified mechanics.

The JavaScript solver follows the supplied Godot example: **M = 2πt/P**, ten Newton iterations for **E − e sin E = M**, then rotate **(a(cos E−e), a√(1−e²)sin E)** by **omega + raan**. All orbital positions use **one linear scale of 24,000 world units/AU**, 20× the previous map, and **0.08 simulated days per real second**. No planet is moved independently to make a level. Earth distances use the separation between model vectors and the [NASA AU conversion](https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html).

The source supplies no common epoch: phase zero is illustrative, not today's ephemerides. The requested 2D projection retains but does not apply inclination/tau. Orbital paths remain eccentric ellipses; planet bodies are circles.

Body display sizes use a separate monotonic law: **radius = 65 × (diameter / Earth diameter)^0.55**. This uses [NASA planetary diameters](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and the [Sun's 695,700 km mean radius](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html). The Sun is clearly largest and planet size ordering is preserved. The exponent compresses true diameter ratios for play; body sizes are not drawn at the orbital distance scale.

Gravity is softened inverse-square attraction from every planet and the Sun. Solar gravity is derived from Earth's period at the compressed time scale; planetary surface-gravity references have game scaling. This is a piloting game, not a real transfer feasibility calculator. The [NASA Trajectory Browser](https://trajbrowser.arc.nasa.gov/traj_browser.php) remains linked for actual mission planning.

## Hardware and science sources

- **RL10A-3-3A**: [NASA NTRS 19910018888, printed p.176](https://ntrs.nasa.gov/api/citations/19910018888/downloads/19910018888.pdf): 16,500 lbf vacuum thrust, 305 lb mass, 444.4 s Isp, 5:1 oxidizer/fuel. Converted to N and kg in code.
- **J-2X**: [NASA NTRS 20090038671, slide 2](https://ntrs.nasa.gov/api/citations/20090038671/downloads/20090038671.pdf): 1,307 kN vacuum thrust, 2,516 kg, minimum 448 s Isp, 5.5 O/F. These are **2009 development requirements**, not operational flight claims.
- Both use liquid hydrogen/liquid oxygen. Ideal **Δv = Isp g₀ ln(wet/dry)** and **flow = thrust/(Isp g₀)** follow [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/). Fuel-card composition is calculated from the selected engine's mixture ratio. Clusters multiply engine specifications; cluster layouts and steering are game designs.
- Imaging, thermal observations, and magnetic-field science use [NASA Solar System Exploration](https://science.nasa.gov/solar-system/), [planetary reference facts](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), and the [planetary data directory](https://planetary.data.nasa.gov/find-data). Results unlock reference information, not newly generated NASA measurements.

The fixed 740 kg chassis, 4% tank-mass fraction, generic instrument payload masses, credits, HP, unlocks, and control parameters are explicitly **game allocations**. Engine checks compare vacuum thrust with Earth-reference weight as a classroom rule; departure starts outside Earth. The lab's information panels distinguish sourced specifications from design choices.

## Art and accessibility

All graphics use procedural pixel art, canvas, CSS, or the included rocket SVG. No image/font downloads. The background has drifting stars and randomly selected starburst, supernova-shell, and black-hole-formation scenes lasting **12, 16, and 18 seconds**. They fade out and are discarded before another appears. These are decorative illustrations, not astronomical observations. **Pause background** stops motion; reduced-motion preferences disable the background events, planet animations, split-rocket transition, and reward-token flight. Hidden tabs pause the background and flight.

The lab supports keyboard category navigation, focus-triggered details, Escape to dismiss, and tap information buttons. Controls sit below the flight window. The four stage tabs and requested decorative copy are removed.

## Code and verification

- **data.js** — exact NASA orbit rows, cited hardware/facts, separate game rules.
- **core.js** — orbital math, engineering, campaign accounting, steering/thrust physics, collisions, spatial belt, and automatic orbital scans.
- **app.js** — migration, destination carousel, category lab, part details, results, and wallet-token animation.
- **flight.js** — open-world renderer, input, camera, radar, direction/braking guidance, and pause/save lifecycle.
- **background.js** — bounded decorative cosmic animation, pause, and reduced-motion support.

Optional maintainer checks (Node is **not** required to play):

```
node tests/core.test.cjs
node tests/flight-balance.test.cjs
node tests/browser.test.cjs
```

Browser QA uses installed Chrome without npm dependencies; set CHROME_PATH if needed. Screenshots are written to ignored outputs/. The offline judge ZIP contains dist/ and this README.
