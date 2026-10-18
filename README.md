# A320 Heathrow to Paris

A browser flight simulator. You fly an Airbus A320 from London Heathrow to Paris Charles de Gaulle, with a training captain who talks you through the whole flight, from cold and dark at the stand to engine shutdown in Paris.

## Play

Open `index.html` in a modern desktop browser (Chrome, Edge, Safari or Firefox) with WebGL. Headphones and a keyboard are recommended. Three.js loads from cdnjs, so you need an internet connection.

To host it on GitHub Pages: **Settings → Pages → Deploy from a branch → `main`**, with either `/ (root)` or `/docs`. Both folders hold the same built `index.html`, and `.nojekyll` tells Pages to serve the files as they are.

## What's in it

- **3D flight deck**: working PFD, ND (LS, VOR, NAV, ARC and PLAN modes), upper and lower ECAM with 11 system pages, FCU with 7-segment windows, EFIS panels, MCDU, overhead panel, pedestal, standby horizon and clock. Every switch, knob and push button works.
- **Systems**: APU, engine start sequence, electrics, hydraulics, bleed air, fuel pumps, fire test, flight-control computers and autobrake. Switching something off has a real effect and raises an amber ECAM caution.
- **Flight model and automation**: fly-by-wire normal law with protections, autothrust, autopilot modes (SRS, CLB, DES, ALT, V/S, HDG, NAV, LOC, G/S), managed speeds and an automatic landing.
- **Captain tutorial**: 48 step-locked lessons with voice, checklists and ATC. "Show me" turns your view to the control, "Do it for me" carries out the step, and skipping moves the aircraft to where that step happens.
- **World**: scenery generated from real coastlines, rivers, towns and runway layouts for both airports, with airport grass variation, runway shoulders, nearby tree belts and scattered clouds. It is not satellite imagery.

## Controls

Press **H** in the simulator for the full list. Press **F2** to search cockpit controls, read their current settings, focus the camera on them, and operate them with keyboard buttons. Opening **Menu** pauses the flight; choose **Resume flight** to continue.

Choose **Full panel** in the view buttons to see both pilots' PFD/ND pairs, the upper and lower ECAM, and the standby instrument together. **Instruments** gives a closer captain-side view for reading and using the controls. The full-panel camera adjusts its field of view to fit the display arrangement when the window size changes.

| Control | Action |
| --- | --- |
| ↑ ↓ ← → | Sidestick (W / S also pitch) |
| Z / X | Rudder |
| , / . | Nosewheel tiller |
| PgUp / PgDn | Thrust levers |
| Shift F / Shift T / Shift C / I | FLX, TOGA, CL, idle detents |
| G, F / V, / | Gear, flaps, arm ground spoilers |
| B, Shift B | Brakes, parking brake |
| A, Q, Shift R | AP1, AP disconnect, autothrust |
| Knobs | Scroll to turn, click to push, right-click to pull |
| MCDU | Click its keys, or point at it and type |
| C, T, P | Change view, time acceleration, pause |

## Voices

The captain, ATC and callouts use your browser's speech voices. Open **Voices** in the top bar to choose them. Names containing Natural, Premium, Enhanced or Google sound the most human. On a Mac you can download better voices in System Settings → Accessibility → Spoken Content → System voice → Manage Voices.

## Graphics quality

Open **Graphics** from the start menu or the top bar. **Balanced** keeps full scenery and cockpit shadows. **Performance** renders at up to 1× device resolution, draws fewer buildings, trees and clouds, and disables cockpit shadows. **High** keeps full scenery and renders at up to 2× device resolution for sharper detail on high-density displays. Changes take effect immediately and the preset is saved in your browser. The panel shows the current frame rate and render size to help you choose.

## Source

`src/` holds the modules, which `build.py` combines into the single `index.html`:

| File | Contents |
| --- | --- |
| `00_util.js` | Maths, geodesy, noise, ISA atmosphere |
| `01_data.js` | Coastlines, rivers, towns, airports, runways, flight plan |
| `02_world.js` | Terrain, sky, clouds, airports, buildings |
| `03_model.js` | Exterior A320 model |
| `04_aircraft.js` | Flight model, systems, autopilot, warnings |
| `05_displays.js` | PFD, ND, ECAM and MCDU rendering |
| `06_cockpit.js` | 3D flight deck, panels and controls |
| `07_audio.js` | Synthesised sound and speech |
| `08_tutorial.js` | Captain tutorial |
| `09_main.js` | Renderer, input, scenarios, UI |
| `shell.html` | Page markup and styles |

After editing anything in `src/`, run `python3 build.py`. It rewrites both `index.html` and `docs/index.html`.

Run `node tests/smoke.cjs` to check the take-off configuration and dual-autopilot tutorial requirements, and `node tests/landing-lights.cjs` to check landing-light switch positions and tutorial actions.

No airline affiliation and no certified aircraft data. This is for learning and fun, not for training real pilots.
