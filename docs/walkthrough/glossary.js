// Glossary for the code-tour slideshow.
// Each entry's `def` is trusted HTML — rendered unescaped when a term is clicked.
// Definitions authored in-repo for entry-level devs: 1–3 sentences, plain language.
// Keys are kebab-case; `term` is the display label; `def` is short HTML.

export const GLOSSARY = {
  'es-modules': {
    term: 'ES modules',
    def: `<p>The official JavaScript module system (<code>import</code> / <code>export</code>). Each file is its own scope, and the browser loads imports on demand. No bundler or build step needed.</p>`,
  },
  'dom': {
    term: 'DOM',
    def: `<p>The "Document Object Model" — the live tree of HTML elements in your browser tab. JavaScript reads and mutates it to change what the user sees.</p>`,
  },
  'pure-function': {
    term: 'pure function',
    def: `<p>A function whose output depends only on its arguments and that doesn't touch the outside world. Same inputs always give the same outputs, which makes them trivial to unit-test.</p>`,
  },
  'single-source-of-truth': {
    term: 'single source of truth',
    def: `<p>A pattern where one object (here, <code>state.js</code>'s state tree) is the only place a given piece of data lives. Everything else reads from it and writes through well-defined paths, so there's never a "which copy is right?" question.</p>`,
  },
  'virtual-dom': {
    term: 'virtual DOM',
    def: `<p>A technique popularized by React where the framework keeps a JS-object copy of the DOM, diffs new versus old on each change, and applies only the minimum updates. Mars Trail deliberately doesn't use one — it just rebuilds from scratch.</p>`,
  },
  'reactive-framework': {
    term: 'reactive framework',
    def: `<p>A library (React, Vue, Svelte, Solid, …) that automatically re-renders UI when the data it depends on changes. Mars Trail doesn't use one; <code>render(state)</code> is called manually after every state change.</p>`,
  },
  'css-variable': {
    term: 'CSS variable',
    def: `<p>Also called a "custom property." A value you define once (<code>--panel-border: #0a8;</code>) and reuse with <code>var(--panel-border)</code>. Themes override the variables so every element using them repaints automatically.</p>`,
  },
  'hash-routing': {
    term: 'hash-based routing',
    def: `<p>Using the part of a URL after <code>#</code> (like <code>#slide-5</code>) as the page's current "location." It never hits the server, works with browser back/forward, and needs no backend — perfect for a single-file app.</p>`,
  },
  'factory-function': {
    term: 'factory function',
    def: `<p>A plain function that builds and returns a fresh object. <code>createInitialState()</code> is the example here: call it to get a new game state without touching any existing ones.</p>`,
  },
  'dispatch': {
    term: 'dispatch',
    def: `<p>In this codebase, a callback passed down into UI so it can say "the user chose X." The UI doesn't mutate state directly — it calls <code>dispatch</code> and lets the system decide what to do. Keeps the flow one-directional.</p>`,
  },
  'local-storage': {
    term: 'localStorage',
    def: `<p>A browser key-value store that persists across tabs and page reloads on the same origin. The game uses it for theme choice and best-run score; the tour intentionally does not.</p>`,
  },
  'dynamic-import': {
    term: 'dynamic import',
    def: `<p>An <code>import()</code> call inside a function (not at the top of the file). It returns a promise, so the module only loads when that code runs — useful for demos that shouldn't load until the user opens the slide.</p>`,
  },
  'try-finally': {
    term: 'try/finally',
    def: `<p>A JS block that guarantees the <code>finally</code> branch runs whether the <code>try</code> succeeded or threw. The tour uses it to restore DOM ids even if a real game modal blows up while rendering a demo.</p>`,
  },
  'heuristic': {
    term: 'heuristic',
    def: `<p>A rule-of-thumb that's usually right but not guaranteed. The anti-mashing detector uses heuristics (response time + bucket patterns) — it might flag a thoughtful-but-fast player, but in aggregate it catches careless clicking.</p>`,
  },
  'multi-stage-event': {
    term: 'multi-stage event',
    def: `<p>An in-game event with more than one screen: each choice can point to another stage (e.g., diagnose → treat → dispose), rather than resolving immediately. The engine that walks these chains is <code>src/systems/multiStage.js</code>.</p>`,
  },
  'sol': {
    term: 'sol',
    def: `<p>A Martian day — about 24 hours 39 minutes. The game's turn unit. "Sol 5" = day 5 of the mission.</p>`,
  },
  'eva': {
    term: 'EVA',
    def: `<p>Extravehicular activity — a crewed trip outside the rover (spacewalk, surface work). The game tracks EVA suit charges as a limited resource.</p>`,
  },
  'lmst': {
    term: 'LMST',
    def: `<p>Local Mean Solar Time — the clock that keeps the rover's day aligned with the Martian sun, used by NASA mission planners. Shown in the tour's header clock for flavor.</p>`,
  },
  'waypoint': {
    term: 'waypoint',
    def: `<p>An optional off-route detour along the mission path. Accepting one dispatches an "away team" of 1–3 crew while the rover camps; the chain plays out over a few sols, then the team returns (or doesn't).</p>`,
  },
  'anti-mashing': {
    term: 'anti-mashing',
    def: `<p>Detection that a player is clicking through event modals too fast or always-first to actually have read them. If the score gets high enough, the game rolls a punitive emergency — the only path you can't button-mash through.</p>`,
  },
};
