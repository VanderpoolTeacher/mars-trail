# Tractus Martis · Mission Control

A browser-based Mars colony survival game — Oregon Trail in space. No build step; open `index.html` in a browser to play.

**New to this repo?** Serve the repo over HTTP and open `/docs/walkthrough/` for an interactive code tour.

## Running locally

Browsers block ES-module imports from `file://` URLs, so both the game and the code tour need to be served over HTTP.

```bash
python3 -m http.server 8765
```

Then:
- Play the game: http://localhost:8765/
- Take the code tour: http://localhost:8765/docs/walkthrough/

Run the sim test suite: `node --test sim/*.test.mjs`.

## Layout

- `src/` — game modules (systems, UI, content, state).
- `styles/` — theme and component CSS (four themes: Mission Control, LCARS, Voltron, Starfighter).
- `sim/` — headless Node tests and playtest scripts.
- `docs/walkthrough/` — interactive code tour that introduces the architecture slide by slide.
- `docs/superpowers/plans/` — design plans for larger features.
