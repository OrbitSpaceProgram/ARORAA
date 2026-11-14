# Orbit Foundry

Open **dist/index.html** in a modern browser. No installation, server, account, or internet connection is required. All graphics are procedural canvas pixel art. The game also supports static hosting.

## Two-minute judge walkthrough

1. Select Mars and choose **Build your rocket**.
2. Click **Quick judge loadout**, then **Run launch checks**.
3. Click **Start flight**. Steer with arrow keys/WASD or touch arrow buttons. P pauses.
4. Dodge debris. On arrival, enter the cyan band around the destination and stay there for five seconds. Avoid the planet. You can remain on the left side of the orbital band; you do not need to circle the planet.
5. View your unlocked NASA facts and Explorer sponsor badge. Future budgets include earned bonus credits.

To demonstrate diagnostics, choose the deep-space fuel tank and light engine for Mars, or the compact tank for Pluto. Retry without penalties.

## Source integrity

`dist/app.js` starts with `NASA_ORRERY_DATA`: complete, verbatim numeric rows from the supplied NASA orrery, with citations and field names. `NASA_FACTS` cites the supplied NASA planetary fact sheet. The in-game **NASA data** dialog links all sources and explains formulas.

Earth separation is explicitly a **mean-orbit distance proxy**: absolute difference between target and Earth semi-major axes, in AU. It is not current separation, minimum approach, or transfer length. The schematic heliocentric diagram uses eccentricity and period but illustrative phase; source angles are retained without assuming their conventions or epoch. Planet visuals and screen sizes are schematic, not a scale model.

**Scientific limitation:** supplied pages do not specify a purchasable component catalog or game budgets. `GAME_BALANCE` explicitly separates fictional credits and abstract component ratings from NASA facts. These are required to implement the requested budget/range/thrust rules and are not real mission metrics. An actual mission planner would additionally need launch windows, trajectory results, propulsion data, staging, and orbit-insertion delta-v. NASA Trajectory Browser is linked for real planning; this game does not fabricate a NASA feasibility result.

Fact cards unlock existing NASA reference information, not newly measured discoveries. Sponsor badges are fictional game rewards. Only gas giant and Pluto routes have a dense arcade belt; this does not represent a physical belt around a planet. The five-second orbital hold is an arcade exercise.

Progress is stored in localStorage when available; gameplay still works when storage is unavailable. No analytics or personal information is collected. All keyboard controls work offline. Motion respects the reduced-motion setting for screen transitions.
