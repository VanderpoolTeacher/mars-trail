// Slide manifest. All HTML in `title`, `body`, and `snippets[].caption` is
// authored in-repo and trusted — rendered unescaped. Snippet `code` contains
// literal source text and is escaped at render time. Do not route user input
// through this file.
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: `
      <p class="subtitle">A ~15-minute guided tour of how this game is organized.</p>
      <p>Use <strong>← →</strong> to navigate. <strong>Esc</strong> returns from a hub branch. Theme selector in the top-right repaints everything — the tour itself is a live demo of the game's theme system.</p>
      <p>Press <strong>→</strong> or click <strong>NEXT</strong> to begin.</p>
    `,
  },
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: `
      <p>An Oregon-Trail-style survival sim set on Mars, built for a game jam. You captain a rover across Acidalia Planitia, rationing power and EVA suits, managing crew, responding to emergencies, and diverting for side missions ("away teams") that chase science points.</p>
      <p>Runs are short (~10–20 sols of play), most of the difficulty is in the event system, and a run ends when you reach the goal or lose the crew.</p>
    `,
  },
  {
    id: 'stack',
    title: 'Tech stack',
    body: `
      <p><strong>Vanilla ES modules.</strong> No framework, no bundler, no build step. Open <code>index.html</code> in a browser and you're running the game.</p>
      <p>This is deliberate: the project is small enough that a build toolchain would be more complexity than feature. It also makes the code unusually easy to read — what you see in the file is what runs.</p>
      <p>Testing uses Node's built-in <code>node --test</code> runner (see <code>sim/</code>). The simulation harness at <code>sim/play.mjs</code> runs thousands of AI-driven playthroughs to validate balance.</p>
    `,
  },
  {
    id: 'layout',
    title: 'Repo layout',
    body: `
      <p>The whole project fits in a handful of folders. Each has one job.</p>
      <pre style="line-height:1.35;font-size:0.9em"><code>Mars Trail/
├── index.html          — game entry point
├── src/
│   ├── main.js         — boots the game, wires UI
│   ├── state.js        — single source of truth
│   ├── render.js       — state → DOM
│   ├── theme.js        — theme switcher
│   ├── audio.js        — music + mute
│   ├── systems/        — game logic (pure where possible)
│   ├── content/        — data: events, emergencies, facts, waypoints
│   └── ui/             — modals, codex overlay
├── styles/             — theme.css + per-theme overlays
├── sim/                — unit tests + playtest harness
├── assets/             — images, music
└── docs/superpowers/   — per-feature specs + implementation plans
</code></pre>
      <p>The rest of the tour follows the data flow: entry point → state → render → systems (via a hub) → content → UI → themes → audio → tests → workflow.</p>
    `,
  },
  // Slides 5–8 added in Task 7, slide 9 (hub) in Task 9, 10–16 in Task 13.
];
