# Tractus Martis · Mission Control

A browser-based Mars colony survival game — Oregon Trail in space. No build step; open `index.html` in a browser to play.

**New to this repo?** Open [`docs/walkthrough/index.html`](docs/walkthrough/index.html) for an interactive code tour.

## Running locally

- Play the game: open `index.html` directly, or serve the repo root (e.g. `python3 -m http.server`) and visit `/`.
- Run the sim test suite: `node --test sim/*.test.mjs`.

## Layout

- `src/` — game modules (systems, UI, content, state).
- `styles/` — theme and component CSS (four themes: Mission Control, LCARS, Voltron, Starfighter).
- `sim/` — headless Node tests and playtest scripts.
- `docs/walkthrough/` — interactive code tour that introduces the architecture slide by slide.
- `docs/superpowers/plans/` — design plans for larger features.
