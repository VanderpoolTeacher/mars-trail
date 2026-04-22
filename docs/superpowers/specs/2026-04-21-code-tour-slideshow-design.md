# Code Tour Slideshow — Design

**Date:** 2026-04-21
**Status:** Draft — pending user review
**Related issue:** #65

## Problem

The Mars Trail codebase is ~5,700 lines of vanilla ES modules across `src/systems/`, `src/content/`, `src/ui/`, plus a `sim/` test harness and a themed UI. The structure is deliberate and well-bounded, but there is no guided entry point: anyone stepping in (including the author after a gap) has to read files cold and reconstruct the architecture by inference. `docs/superpowers/specs/*` capture per-feature intent but don't give a bird's-eye view of how the pieces fit together.

## Goal

Ship a standalone, interactive, theme-toggleable HTML slideshow at `docs/walkthrough/index.html` that walks a programmer-literate reader through how this codebase is set up — from entry point to systems to content to tests to release workflow — in roughly 15 minutes, with the option to drill into any single system, expand code, or run small live demos that exercise the real modules.

Success criteria:

1. A reader with general JS/web knowledge but no prior exposure to Mars Trail can open the file, navigate end-to-end, and correctly answer "where would I look to change X?" for the major subsystems.
2. The slideshow repaints correctly under all four existing themes (Mission Control / LCARS / Voltron / Starfighter) using the game's own stylesheets, and doubles as a live demo of the theme system.
3. At least three live demos import and exercise real game modules (no mock reimplementations), proving behavior as documented.

## Scope

**In:**

- Standalone HTML at `docs/walkthrough/index.html` — open directly in a browser, no build step, no server required (ES modules load via relative paths from the doc's location).
- Linear spine of ~16 slides plus one hub slide with ~8 branch slides.
- Three live demos (game-loop animation, click-mash medical emergency, event-card preview) plus the always-on theme-toggle demo.
- Expandable inline code snippets on relevant slides, each with a filename + line range label and a "View on GitHub" link.
- Keyboard navigation (← → arrows, Esc to exit hub branch, number keys for hub tile shortcuts).
- Theme dropdown in the slideshow chrome that repaints the page by swapping a `data-theme` attribute, mirroring the game's own approach.
- Progress indicator (slide N of M on the spine; breadcrumbs inside hub branches).
- README link pointing readers to the tour.

**Out (deferred):**

- Narration audio / video.
- Quiz or checkpoint interactions.
- Search-across-slides.
- Speaker-notes / presentation mode for projection.
- Auto-advance / slide timers.
- Print / PDF export.
- Any change to the game itself beyond a one-line README link.
- Hosting on GitHub Pages (the file works locally; pages is a future option, not a requirement).

## Architecture

**New files:**

- `docs/walkthrough/index.html` — entry point. Loads the game's existing stylesheets (`theme.css`, `layout.css`, `components.css`, `modals.css`, `theme-lcars.css`, `theme-voltron.css`, `theme-starfighter.css` — via relative paths into `../../styles/`), a slideshow-specific stylesheet, and the slideshow ES module.
- `docs/walkthrough/tour.css` — layout and chrome styles (slide container, nav bar, progress, hub tiles, code-block frame). Uses the same CSS variables the game theme files set, so theme-swapping Just Works.
- `docs/walkthrough/tour.js` — slideshow engine: slide registry, routing (hash-based: `#slide-5`, `#branch-events-1`), keyboard nav, code-snippet expand/collapse.
- `docs/walkthrough/slides.js` — slide content manifest. An ordered array of slide descriptors (id, title, body HTML, optional code snippets, optional demo id). The hub slide carries a `branches` array; each branch is itself an ordered list of sub-slides.
- `docs/walkthrough/demos/loop.js` — game-loop animation demo (scrubbable sol counter that pulses through the phases).
- `docs/walkthrough/demos/mashEmergency.js` — wraps the click-mash medical emergency UI using real `src/ui/modals.js` + `src/systems/medicalEmergency.js` imports.
- `docs/walkthrough/demos/eventPreview.js` — picks a random event from `src/content/events.js` and renders its card via the real modal renderer.

**Modified files:**

- `README.md` — add a one-line "Code tour: open `docs/walkthrough/index.html` in a browser" link near the top of the project section.

**Untouched:** every file under `src/`, `styles/`, `sim/`, `assets/`, and the game's `index.html`. The slideshow consumes the game code; it does not require any edit to it.

## Visual style & theming

The slideshow reuses the game's existing stylesheets (`styles/theme.css` base + `theme-lcars.css` / `theme-voltron.css` / `theme-starfighter.css` overlays, plus `layout.css`, `components.css`, `modals.css`). A theme selector in the slideshow chrome imports the `THEMES` list and `resolveTheme` helper from `src/theme.js`, setting `data-theme` on `<body>` (or removing the attribute for `mc`), identical to how `src/theme.js` does it.

`tour.css` only defines layout primitives — slide frame, nav bar, code-block wrapper, hub tile grid, progress bar. Colors, borders, typography, and decorative elements all come from the game theme CSS via CSS custom properties. This means:

- Adding a new theme to the game automatically offers it in the slideshow's dropdown (the dropdown enumerates the same `THEMES` list the game uses).
- The slideshow's visual polish is proportional to the game's.

Default theme on load: `mc` (Mission Control), matching the game's default. The slideshow does **not** read the game's `localStorage` key (`marsTrail.theme`) — tour theme is a session-only choice to avoid surprise state bleed between the game and the tour.

## Slide spine

One linear path, indexed 1–16. Slide 9 is the hub.

| # | Title | Notes |
|---|---|---|
| 1 | Welcome | Title, one-paragraph hook, "Press → to begin." |
| 2 | What is Mars Trail? | Screenshot + one-paragraph pitch. |
| 3 | Tech stack | "Vanilla ES modules, no build step, no framework — and why." |
| 4 | Repo layout | Annotated directory tree; top-level folders each get one sentence. |
| 5 | The game loop | Diagram + **live demo**: animated sol cycle (input → systems → render → log). |
| 6 | Entry point | `index.html` + `src/main.js` with a code snippet of the boot sequence. |
| 7 | State | `src/state.js` as the single source of truth; shape overview. |
| 8 | Render | `src/render.js` as unidirectional `state → DOM`. |
| 9 | **HUB · Systems architecture** | Tile grid; each tile is a clickable branch. See below. |
| 10 | Content vs systems | Why data lives in `src/content/`; contrast with logic in `src/systems/`. |
| 11 | UI layer | `src/ui/modals.js`, `src/ui/codex.js` — how modals and overlays work. |
| 12 | Theme system | `src/theme.js` + `styles/theme-*.css`; **live demo:** the slideshow itself repaints when you change the dropdown. |
| 13 | Audio | `src/audio.js` — music shuffle, mute, track select. |
| 14 | Testing | `sim/*.test.mjs`, `sim/playtest1000.mjs`, how unit tests + playtests differ. |
| 15 | Workflow | Issue → spec → plan → implement → tag. Reference `docs/superpowers/`. |
| 16 | Credits / further reading | Links to specs, plans, the repo. "End of tour." |

## Hub branches (slide 9)

Eight tiles, each opens a mini-tour that returns to the hub. Each branch has 1–2 sub-slides unless noted.

1. **travel.js** — pace, tick, arrival (2 slides).
2. **events.js + content/events.js** — roll, select, apply (2 slides).
3. **multiStage.js + emergencies / multiStageEvents** — stage chains.
4. **medicalEmergency.js** — **live demo:** the click-mash rescue UI (2 slides).
5. **clickMetrics.js** — anti-mash detection.
6. **awayTeam.js + content/awayTeamChains.js** — waypoint divert flow (2 slides).
7. **crew.js / corpse.js / waypoints.js** — small systems grouped together.
8. **career.js / scoring.js** — end-of-run scoring, persistent SCI.

Branch sub-slides get an "Back to hub" button and breadcrumb (`HUB › travel.js › 2 of 2`). Pressing Esc returns to the hub. `→` at the last branch sub-slide also returns to the hub.

## Live demos

Four demos total. Three are opt-in (click a button on the relevant slide); the theme toggle is always on.

1. **Game-loop animation** (slide 5). An SVG/CSS animation of one sol's phases. No real-module import needed; this is explanatory, not a behavior proof. Runs in a loop until you leave the slide.
2. **Click-mash medical emergency** (hub branch 4). Imports `src/systems/medicalEmergency.js` and `src/ui/modals.js` directly, calls the real "show modal" path with a minimal seeded state, and lets the reader actually mash the button and see the anti-mashing penalty fire. Reusing the modal DOM container the slideshow provides.
3. **Event-card preview** (hub branch 2). Imports `src/content/events.js` and the modal renderer, picks a random non-multi-stage event, and renders its card. Each click re-rolls.
4. **Theme toggle** (always-on; slide 12 explicitly highlights it). The dropdown in the slideshow chrome flips `data-theme`; every piece of chrome and every demo repaints.

### Live-demo coupling (decision B1)

Demos import real modules. This is a deliberate trade-off:

- **Benefit:** demos stay honest. If behavior changes, the slideshow shows the new behavior.
- **Cost:** refactors that change a module's *exports* (rename a function, change a signature) will break the slideshow.
- **Mitigation:** (a) demos are isolated in `docs/walkthrough/demos/*.js` so breakage is obvious and scoped; (b) each demo file begins with a one-line comment listing the imports it depends on, so a future refactor can grep for dependents; (c) a smoke-test script (`sim/walkthroughSmoke.test.mjs`) loads each demo module under Node with a DOM shim and asserts the imports resolve and top-level exports exist. This won't catch visual breakage, but it catches import-path rot — the most likely failure mode.

## Interactivity / UX

- **Keyboard:** `←` / `→` for prev/next. `Home` / `End` jump to first/last slide on the spine. `Esc` returns to hub when inside a branch; no-op on the spine. Digit keys `1`–`8` on the hub slide open that branch.
- **Click:** prev / next buttons in the bottom chrome. Hub tiles are clickable. Code blocks have an "Expand" toggle (default collapsed). "View on GitHub" opens `https://github.com/<owner>/<repo>/blob/main/<path>#L<start>-L<end>` in a new tab; `package.json` does not declare a `repository` field, so owner/repo live in a single constant at the top of `tour.js`.
- **Progress indicator:** bottom-left chrome shows `Spine 7 / 16` on the spine, `Hub › travel.js › 2 / 2` inside a branch.
- **Deep-linking:** URL hash tracks location (`#slide-5`, `#branch-events-1`). Back/forward browser buttons work.
- **No persistence:** refreshing loads slide 1 unless a hash is present. No local storage, no cookies.

## Slide data shape

```js
// docs/walkthrough/slides.js
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: '...HTML string...',
  },
  // ...
  {
    id: 'loop',
    title: 'The game loop',
    body: '...',
    demo: 'loop',                    // key into demos registry
  },
  {
    id: 'hub',
    title: 'Systems architecture',
    branches: [
      {
        id: 'travel',
        label: 'travel.js',
        sub: [ /* each sub-slide uses the same shape as a spine slide:
                 id, title, body, and optional snippets / demo */ ],
      },
      // ...
    ],
  },
  // ...
];

// A slide's optional snippets (applies to spine slides and branch sub-slides)
snippets: [
  {
    path: 'src/main.js',
    lines: [1, 40],
    caption: 'Boot sequence',
    code: '...extracted at build time? no — inlined here manually...',
  },
]
```

Code in snippets is **inlined as string literals**, authored by hand when writing each slide. Rationale: no build step, and the curated subset (10–30 lines) beats a raw import dump. Snippets reference exact line numbers so the "View on GitHub" link stays precise; if the code changes, the slide content is updated in the same PR as the code change.

## Testing

- **Unit smoke test:** `sim/walkthroughSmoke.test.mjs` — imports each demo module under a JSDOM shim, asserts top-level exports resolve and demo init functions don't throw. Catches import-path rot.
- **Manual checklist** (documented in the slideshow spec itself, not automated): open the file under each theme; click through the spine; click each hub tile; run each live demo; confirm deep-linking via hash; confirm keyboard nav works on the spine and in a branch.
- **No visual-regression suite.** Not worth building for a doc artifact.

## Workflow notes

- A GitHub issue must be opened before implementation begins (per project convention). This spec and its accompanying plan will reference that issue.
- Ships as a patch release (no game behavior change): likely `v0.9.3` if no other features land first. The tag summary calls out the new tour.

## Open questions

None blocking. Worth noting during implementation:

- **Branch count** — eight hub tiles is the current plan; if any single branch balloons past 3 sub-slides, split the system off into its own hub tile rather than growing the branch.

## Risks

- **Import-path drift (B1 coupling).** Mitigated by the smoke test and by isolating demos in their own folder. Acceptable for the payoff in demo honesty.
- **Theme CSS coupling.** The slideshow relies on CSS variables defined by the game's theme files. If those variables are renamed, the slideshow's chrome may lose polish. Low-frequency risk; easy to fix when spotted.
- **Slide rot.** Content slides with specific file/line references will drift as code changes. Mitigation: expectation set in this spec that PRs touching `src/**` check whether a slide's snippet or description needs updating. No tooling enforcement for now; worth a future "link-checker" if this becomes a problem.
