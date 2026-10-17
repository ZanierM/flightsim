# Flightdeck — Heathrow to Paris

A browser based, A320 inspired flight simulator prototype. Fly a guided training route from London Heathrow to Paris Charles de Gaulle with fourteen captain led lessons.

## Play locally

You need a modern browser with WebGL and Python 3. From the repository root:

```sh
python3 -m http.server 4173 --directory docs
```

Then visit <http://localhost:4173>. The simulator must be served over HTTP because it uses JavaScript modules. It has no build step or runtime API keys.

## Put this in a new GitHub repo

1. Create an empty GitHub repository.
2. Upload the **contents of this folder** to its root, keeping `docs/`, `tests/`, `.gitignore`, and this README at the top level. If uploading through GitHub's web UI, upload the unzipped files and preserve their folders. The archive itself is not the website.
3. To host the simulator, open the repository's **Settings → Pages**, choose **Deploy from a branch**, then choose `main` and `/docs` and save. `docs/index.html` is the site's entry point. GitHub's instructions: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>.

GitHub Pages sites are public on the internet, including when the source repository is private on plans that support Pages for private repositories. Keep the repository private without enabling Pages if you want the simulator files private.

## Controls

| Control | Action |
| --- | --- |
| ↑ / ↓ | Nose down / nose up |
| ← / → | Roll, or steer while taxiing |
| W / S | Increase / decrease thrust |
| B | Hold wheel brakes |
| G | Toggle landing gear |
| F | Cycle flaps |
| A | Toggle autopilot |
| P | Pause |
| H | Hide or show lesson panels |
| 1–5 | Switch camera views |

Drag to look around. On touch devices, open the **Controls** panel and use its flight buttons. **Flight plan** contains practice checkpoints and browser local save/resume.

## Test

Node.js is needed only for the simulation checks:

```sh
node tests/flight.mjs
```

The checks cover assisted takeoff, climb, autopilot altitude capture, descent, approach, landing, gear up landing rejection, taxi, and pause. They verify the game's behavior, not real aircraft handling.

## What this prototype includes

- A real time Three.js cockpit with six instrument screens, an overhead panel, centre pedestal, five camera views, and clickable switches.
- Captain guidance with state based checks and spoken instructions where browser voices are available.
- Engine start interlocks, guided takeoff, route following autopilot, selected altitude and speed, approach, manual landing, rollout, shutdown, and debrief.
- Synthesized engine and airflow sound, representative airports and terrain, and a CC0 photographic sky.

## Scope and assets

This is an entertainment prototype, not a certified flight training device or a study level A320. Cockpit geometry, avionics, aerodynamics, procedures, and airport scenery are approximate. The routing is fictional. Some transitions condense taxi, cruise, and arrival. There is no live ATC, real navigation database, or autoland. Voice quality depends on the browser and operating system.

All browser dependencies are self hosted under `docs/vendor/`. See `docs/ASSET-CREDITS.txt` and the vendor license files. No credentials or existing hosting identity are included.
