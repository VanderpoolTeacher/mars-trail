# Pace Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three movement paces (cautious / steady / push) viable strategic choices by scaling background damage and event rate per pace, validated by a committed simulation harness.

**Architecture:** Two flat constants become pace-indexed tables. No new mechanics, no UI, no state-schema changes. Build sim harness first (issue #4), then tune constants to target curve (issue #2).

**Tech Stack:** Vanilla ES modules (browser + Node 20+). No build step. No test framework. The sim harness *is* the validation tool.

**Target curve** (Balanced reference strategy over 500 games, ±5%):
- Cautious: ~70% win
- Steady: ~60% win
- Push: ~40–50% win
- Additional: FirstChoice strategy ≤ 80% at every pace; Skilled beats Balanced by 5–10pp.

**Related:** Spec at `docs/superpowers/specs/2026-04-16-pace-balance-design.md`. Closes issues #4 and #2.

---

## File Structure

**Create:**
- `package.json` — 3-line stub; enables Node ESM loading of `src/*.js`.
- `sim/play.mjs` — sim harness entry point. ~180 lines. Imports game modules, runs strategies, prints table.
- `sim/README.md` — 15-line usage note.

**Modify:**
- `src/systems/travel.js` — lines 50 (constant) and ~136 (call site). Replace `BACKGROUND_DAMAGE` with pace-indexed table.
- `src/systems/events.js` — lines 23 (constant) and 28 (rollEvent check). Replace `EVENT_BASE_RATE` with pace-indexed table.

---

## Task 1: Add `package.json` for Node ESM

**Files:**
- Create: `package.json`

- [ ] **Step 1: Verify we're in the project root**

Run: `pwd && ls -la src/state.js`
Expected: path ends in `Mars Trail`; `src/state.js` exists.

- [ ] **Step 2: Write `package.json`**

```json
{
  "type": "module",
  "private": true
}
```

- [ ] **Step 3: Smoke-test ESM import from Node**

Run: `node -e 'import("./src/state.js").then(m => console.log(Object.keys(m).sort().join(",")))'`

Expected output (exact order may differ):
```
CARGO_BUDGET,CARGO_MAX_LBS,PART_TYPES,ROLE_CODE,createInitialState,landmarkName
```

If you see `SyntaxError: Cannot use import statement outside a module` — the package.json was not picked up. Check the file is at the project root.

- [ ] **Step 4: Confirm browser is unaffected**

The browser loads modules via `<script type="module" src="...">` tags in `index.html` — it ignores `package.json` entirely. No test action needed, but note: if the game had a bundler it would matter. Check: `grep -l "type=\"module\"" index.html` should find a match.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
Add package.json to enable Node ESM (refs #4)

Enables the sim harness (to be added next) to import src/*.js via
Node. Browser behavior is unaffected — browsers load modules via
<script type="module"> and do not read package.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sim harness skeleton — one strategy, one config

**Files:**
- Create: `sim/play.mjs`

Start small. One strategy, one config, 100 games, make sure it runs end-to-end before layering complexity.

- [ ] **Step 1: Create `sim/` directory**

Run: `mkdir -p sim`
Expected: directory created silently.

- [ ] **Step 2: Write minimum-viable harness**

Create `sim/play.mjs`:

```js
// Mars Trail — playtest simulation harness.
// Imports pure game modules and runs many games per strategy.
// Not a test suite; a dev tool for balance validation.

import { createInitialState } from '../src/state.js';
import { advanceSol, repairBattery, cleanPanels, canRepair, canClean } from '../src/systems/travel.js';
import { applyEventChoice } from '../src/systems/events.js';

// Simplest strategy: always pick the first option.
function strategyFirst(_state, _event) { return 0; }

// Decide whether to burn a sol on REPAIR or CLEAN before the next travel sol.
function shouldMaintain(state) {
  if (state.resources.power < 35 && canRepair(state)) return 'repair';
  if (state.resources.panels < 40 && canClean(state)) return 'clean';
  return null;
}

function playGame({ pace, rations, pickChoice }) {
  let s = createInitialState();
  s.activeModal = null;          // skip title/briefing/loadout modals
  s.pace = pace;
  s.rations = rations;

  const MAX_SOLS = 200;          // safety cap
  while (s.status === 'active' && s.sol < MAX_SOLS) {
    // Resolve any open event modal FIRST.
    if (s.activeModal && s.activeModal.type === 'event') {
      const event = s.activeModal.payload;
      const idx = pickChoice(s, event);
      const { state: next } = applyEventChoice(s, event, idx);
      s = next;
      continue;
    }
    const m = shouldMaintain(s);
    if (m === 'repair') { s = repairBattery(s); continue; }
    if (m === 'clean')  { s = cleanPanels(s);   continue; }
    s = advanceSol(s, 'travel');
  }
  if (s.status === 'active') { s.status = 'lost'; s.lossReason = 'timeout'; }
  return s;
}

function runBatch(cfg, N) {
  let wins = 0;
  const reasons = {};
  let solsTotal = 0, solsWinTotal = 0, crewTotal = 0, crewWinTotal = 0, sciTotal = 0;
  for (let i = 0; i < N; i++) {
    const s = playGame({ pace: cfg.pace, rations: cfg.rations, pickChoice: cfg.pick });
    solsTotal += s.sol;
    const alive = s.crew.filter(c => c.alive).length;
    crewTotal += alive;
    sciTotal += s.sciencePoints;
    if (s.status === 'won') {
      wins++;
      solsWinTotal += s.sol;
      crewWinTotal += alive;
    } else {
      reasons[s.lossReason] = (reasons[s.lossReason] || 0) + 1;
    }
  }
  return {
    name: cfg.name,
    winRate: wins / N,
    avgSols: solsTotal / N,
    avgSolsWin: wins ? solsWinTotal / wins : null,
    avgCrew: crewTotal / N,
    avgCrewWin: wins ? crewWinTotal / wins : null,
    avgSci: sciTotal / N,
    reasons
  };
}

// --- Config rows: edit this array for ad-hoc tuning runs. ---
const N = 500;
const strategies = [
  { name: 'FirstChoice / steady / standard', pace: 'steady', rations: 'standard', pick: strategyFirst }
];

console.log(`Running ${N} games per configuration…\n`);
const results = strategies.map(cfg => runBatch(cfg, N));

console.log('Strategy'.padEnd(42) + 'Win%   AvgSols  WinSols   AvgCrew WinCrew  AvgSci   LossBreakdown');
console.log('-'.repeat(120));
for (const r of results) {
  const reasons = Object.entries(r.reasons).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${k}:${v}`).join(' ');
  console.log(
    r.name.padEnd(42) +
    (r.winRate*100).toFixed(1).padStart(5) + '  ' +
    r.avgSols.toFixed(1).padStart(7) + '  ' +
    (r.avgSolsWin ? r.avgSolsWin.toFixed(1) : '   —  ').padStart(7) + '   ' +
    r.avgCrew.toFixed(2).padStart(5) + '   ' +
    (r.avgCrewWin ? r.avgCrewWin.toFixed(2) : '  —  ').padStart(5) + '   ' +
    r.avgSci.toFixed(1).padStart(6) + '   ' +
    reasons
  );
}
```

- [ ] **Step 3: Run the harness**

Run: `node sim/play.mjs`

Expected output (values will vary slightly):
```
Running 500 games per configuration…

Strategy                                  Win%   AvgSols  WinSols   AvgCrew WinCrew  AvgSci   LossBreakdown
------------------------------------------------------------------------------------------------------------------------
FirstChoice / steady / standard             0.X     2X.X      —       0.XX     —      1XX.X   all_dead:4XX no_oxygen:XX
```

Win rate will be near 0 (expected pre-balance). What matters is the harness runs without errors and prints a formatted table.

- [ ] **Step 4: Commit**

```bash
git add sim/play.mjs
git commit -m "$(cat <<'EOF'
Add sim harness skeleton (refs #4)

One strategy (FirstChoice), one config, 500 games. Verifies the
Node ESM import path works end-to-end. More strategies next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add remaining reference strategies

**Files:**
- Modify: `sim/play.mjs`

- [ ] **Step 1: Add `strategySafe` above `strategyFirst`**

Insert after the `strategyFirst` definition:

```js
// Safe: minimize expected resource loss and crew damage.
function strategySafe(_state, event) {
  let best = 0, bestScore = Infinity;
  event.modal.choices.forEach((c, i) => {
    let score = 0;
    const pools = c.skillCheck
      ? [c.failOutcome, c.successOutcome]
      : [c.outcome];
    for (const o of pools) {
      if (!o) continue;
      if (o.crewDamage) score += 50 + (o.crewDamage.amount || 0);
      for (const k of ['oxygen','water','food','power','panels']) {
        if (typeof o[k] === 'number' && o[k] < 0) score += Math.abs(o[k]);
      }
      for (const k of ['mech','eva','cell']) {
        if (typeof o[k] === 'number' && o[k] < 0) score += Math.abs(o[k]) * 5;
      }
    }
    if (c.skillCheck) score *= (1 - (c.skillCheck.successP || 0.5)) + 0.5;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// Skilled: prefer skill-check choices when the specialist is alive.
function strategySkilled(state, event) {
  let best = -1, bestP = 0;
  event.modal.choices.forEach((c, i) => {
    if (!c.skillCheck) return;
    const alive = state.crew.some(cr => cr.role === c.skillCheck.role && cr.alive);
    const p = alive ? c.skillCheck.successP : Math.max(0.2, c.skillCheck.successP - 0.4);
    if (p > bestP) { bestP = p; best = i; }
  });
  if (best === -1) return strategySafe(state, event);
  return best;
}

// Balanced: avoid worsening any currently-critical resource; otherwise favor skill checks with alive specialists.
function strategyBalanced(state, event) {
  const crit = {};
  for (const k of ['oxygen','water','food','power']) {
    if (state.resources[k] < 30) crit[k] = true;
  }
  const choices = event.modal.choices;
  const viable = choices.map((c, i) => ({ c, i })).filter(({ c }) => {
    const pools = c.skillCheck ? [c.failOutcome] : [c.outcome];
    for (const o of pools) {
      if (!o) continue;
      for (const k of Object.keys(crit)) {
        if (typeof o[k] === 'number' && o[k] < -8) return false;
      }
    }
    return true;
  });
  const pool = viable.length ? viable.map(v => v.i) : choices.map((_, i) => i);
  let best = pool[0], bestScore = -Infinity;
  for (const i of pool) {
    const c = choices[i];
    let score = 0;
    if (c.skillCheck) {
      const alive = state.crew.some(cr => cr.role === c.skillCheck.role && cr.alive);
      score += (alive ? c.skillCheck.successP : Math.max(0.2, c.skillCheck.successP - 0.4)) * 50;
    }
    if (c.outcome && typeof c.outcome.sciencePoints === 'number') score += c.outcome.sciencePoints * 0.2;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
```

- [ ] **Step 2: Expand the `strategies` config array**

Replace the existing `strategies` array with:

```js
const strategies = [
  // Pre-balance diagnostic set. After tuning (Task 6), these should show
  // cautious ~70%, steady ~60%, push ~40–50% under Balanced.
  { name: 'FirstChoice / cautious / standard', pace: 'cautious', rations: 'standard', pick: strategyFirst },
  { name: 'FirstChoice / steady / standard',   pace: 'steady',   rations: 'standard', pick: strategyFirst },
  { name: 'FirstChoice / push / standard',     pace: 'push',     rations: 'standard', pick: strategyFirst },
  { name: 'Safe / cautious / standard',        pace: 'cautious', rations: 'standard', pick: strategySafe },
  { name: 'Safe / steady / standard',          pace: 'steady',   rations: 'standard', pick: strategySafe },
  { name: 'Safe / push / standard',            pace: 'push',     rations: 'standard', pick: strategySafe },
  { name: 'Skilled / cautious / standard',     pace: 'cautious', rations: 'standard', pick: strategySkilled },
  { name: 'Skilled / steady / standard',       pace: 'steady',   rations: 'standard', pick: strategySkilled },
  { name: 'Skilled / push / standard',         pace: 'push',     rations: 'standard', pick: strategySkilled },
  { name: 'Balanced / cautious / standard',    pace: 'cautious', rations: 'standard', pick: strategyBalanced },
  { name: 'Balanced / steady / standard',      pace: 'steady',   rations: 'standard', pick: strategyBalanced },
  { name: 'Balanced / push / standard',        pace: 'push',     rations: 'standard', pick: strategyBalanced }
];
```

- [ ] **Step 3: Run and verify**

Run: `node sim/play.mjs`

Expected:
- Table has 12 rows.
- Push configs have meaningfully higher win rates than cautious/steady (because we haven't balanced yet — this confirms the pre-balance baseline).
- Runs in under 15 seconds.

- [ ] **Step 4: Commit**

```bash
git add sim/play.mjs
git commit -m "$(cat <<'EOF'
Add Safe/Skilled/Balanced sim strategies (refs #4)

Expands the harness from one strategy to four, across all three
paces, for a 12-row diagnostic table. Pre-balance numbers confirm
the pace imbalance from #2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Sim harness README + close issue #4

**Files:**
- Create: `sim/README.md`

- [ ] **Step 1: Write the README**

Create `sim/README.md`:

```markdown
# Mars Trail — Playtest Simulation Harness

Dev tool for balance validation. Not a test suite; just runs many simulated games and prints a results table.

## Run

```bash
node sim/play.mjs
```

Prints one row per configuration (strategy × pace × rations), with win%, avg sols, avg crew survived, avg science, and loss-reason breakdown. 500 games per row, ~10 seconds total.

## Reference strategies

- **FirstChoice** — always picks the first event option. Proxy for naïve click-through play.
- **Safe** — minimizes expected resource loss and crew damage per event.
- **Skilled** — prefers skill-check choices when the matching specialist is alive.
- **Balanced** — avoids worsening any currently-critical resource; otherwise favors high-probability skill checks.

## Editing

To test other configurations, edit the `strategies` array at the bottom of `play.mjs`.

## Pass criteria for v0.2.0 pace balance (issue #2)

Balanced strategy:
- Cautious: 65–75% win
- Steady: 55–65% win
- Push: 40–55% win

Additional:
- FirstChoice ≤ 80% at every pace
- Skilled beats Balanced by 5–10 percentage points on average
```

- [ ] **Step 2: Verify the README renders**

Run: `cat sim/README.md | head -5`
Expected: title line + blank line + description line. No encoding issues.

- [ ] **Step 3: Commit and close #4**

```bash
git add sim/README.md
git commit -m "$(cat <<'EOF'
Add sim harness README, closes #4

Documents usage, reference strategies, and the pass criteria for
the pace balance work in #2.

Closes #4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

Check: `gh issue view 4` should show status `CLOSED` after the push (GitHub auto-closes on the `Closes #4` keyword).

---

## Task 5: Apply starting-guess pace-scaled constants

**Files:**
- Modify: `src/systems/travel.js` (lines ~50 and ~136)
- Modify: `src/systems/events.js` (lines ~23 and ~28)

- [ ] **Step 1: Read current travel.js constants**

Run: `grep -n "BACKGROUND_DAMAGE" src/systems/travel.js`
Expected output:
```
50:const BACKGROUND_DAMAGE = 2;
136:  for (const id of aliveIds) s = applyDamage(s, id, BACKGROUND_DAMAGE, 'fatigue').state;
```

If line numbers differ, adjust; the code identifiers are what matter.

- [ ] **Step 2: Replace the constant in travel.js**

In `src/systems/travel.js`, replace:

```js
// Background per-sol health drain (radiation, fatigue). Always present.
const BACKGROUND_DAMAGE = 2;
```

with:

```js
// Per-sol health drain (radiation, fatigue). Scales with pace:
// careful driving = less crew fatigue.
const BACKGROUND_DAMAGE_BY_PACE = {
  cautious: 1,
  steady:   2,
  push:     3
};
```

- [ ] **Step 3: Update the call site in travel.js**

In `src/systems/travel.js`, replace:

```js
  // Background wear: always present. Medic mitigates 30% via applyDamage.
  for (const id of aliveIds) s = applyDamage(s, id, BACKGROUND_DAMAGE, 'fatigue').state;
```

with:

```js
  // Background wear: always present. Medic mitigates 30% via applyDamage.
  const bgDamage = BACKGROUND_DAMAGE_BY_PACE[s.pace];
  for (const id of aliveIds) s = applyDamage(s, id, bgDamage, 'fatigue').state;
```

- [ ] **Step 4: Verify no stragglers in travel.js**

Run: `grep -n "BACKGROUND_DAMAGE" src/systems/travel.js`
Expected: only references to `BACKGROUND_DAMAGE_BY_PACE` (2 lines — the declaration and the lookup). No bare `BACKGROUND_DAMAGE` left.

- [ ] **Step 5: Read current events.js constant**

Run: `grep -n "EVENT_BASE_RATE" src/systems/events.js`
Expected output:
```
23:const EVENT_BASE_RATE = 0.65;   // P(event per sol). Will move to scenarios.js later.
28:  if (Math.random() > EVENT_BASE_RATE) return null;
```

- [ ] **Step 6: Replace the constant in events.js**

In `src/systems/events.js`, replace:

```js
const EVENT_BASE_RATE = 0.65;   // P(event per sol). Will move to scenarios.js later.
```

with:

```js
// P(event per sol) by pace. Careful driving = fewer incidents.
const EVENT_BASE_RATE_BY_PACE = {
  cautious: 0.45,
  steady:   0.60,
  push:     0.78
};
```

- [ ] **Step 7: Update rollEvent in events.js**

In `src/systems/events.js`, replace:

```js
export function rollEvent(state) {
  if (Math.random() > EVENT_BASE_RATE) return null;
```

with:

```js
export function rollEvent(state) {
  const rate = EVENT_BASE_RATE_BY_PACE[state.pace];
  if (Math.random() > rate) return null;
```

- [ ] **Step 8: Verify no stragglers in events.js**

Run: `grep -n "EVENT_BASE_RATE" src/systems/events.js`
Expected: only references to `EVENT_BASE_RATE_BY_PACE` (2 lines — declaration and lookup).

- [ ] **Step 9: Run the sim to see starting-guess results**

Run: `node sim/play.mjs`

Expected: the 12-row table runs without errors. Record the Balanced rows (cautious / steady / push) — these are the numbers we'll tune against in Task 6.

**Do not commit yet.** Task 6 will tune these values.

---

## Task 6: Tune constants to hit target curve

**Files:**
- Modify: `src/systems/travel.js` (adjust `BACKGROUND_DAMAGE_BY_PACE` values)
- Modify: `src/systems/events.js` (adjust `EVENT_BASE_RATE_BY_PACE` values)

Iterative loop. Each iteration: inspect sim output, adjust one lever, rerun. Maximum 10 iterations before escape hatch (see Step 6).

- [ ] **Step 1: Record the baseline**

Re-run `node sim/play.mjs` if needed. In a scratch note, write down:

```
Iteration 0 (starting guesses):
  Balanced / cautious: ??.?%   (target: 65–75%)
  Balanced / steady:   ??.?%   (target: 55–65%)
  Balanced / push:     ??.?%   (target: 40–55%)
  FirstChoice max:     ??.?%   (target: ≤80%)
  Skilled minus Balanced avg: ??.?pp   (target: +5 to +10)
```

- [ ] **Step 2: Apply the adjustment heuristic**

For each Balanced row outside target:

- **Too low (lethal):** decrement that pace's `BACKGROUND_DAMAGE_BY_PACE` by 1 (minimum floor: 0), OR lower its `EVENT_BASE_RATE_BY_PACE` by 0.05. Pick whichever hasn't been adjusted most recently for that pace.
- **Too high (easy):** reverse — increment background damage or raise event rate.

Change ONE pace's ONE lever per iteration, so cause/effect stays traceable.

Rules of thumb:
- If cautious is lethal, pull background damage first — it compounds over the ~38-sol cautious trip.
- If push is too easy, pull event rate — more events = more compounded damage + resource risk.
- If the FirstChoice ceiling is too high (>80%) at any pace, that pace's event rate is too low — raise it.

- [ ] **Step 3: Rerun and re-record**

Run: `node sim/play.mjs`

Update the scratch note with iteration N+1 numbers. Check:
- Did the adjusted pace move in the expected direction?
- Did the other two paces stay roughly put? (If not, your change is too wide — consider smaller increments.)

- [ ] **Step 4: Repeat Steps 2–3 until targets are met**

Exit criteria (ALL must hold):
- Balanced / cautious ∈ [65%, 75%]
- Balanced / steady ∈ [55%, 65%]
- Balanced / push ∈ [40%, 55%]
- FirstChoice (any pace) ≤ 80%
- `mean(Skilled - Balanced across paces)` ∈ [5, 10] percentage points

- [ ] **Step 5: Run once more to confirm stability**

Run: `node sim/play.mjs` a second time with the final values. Because the sim uses `Math.random()`, two runs will vary by ~1–2pp. If ALL exit criteria still hold on the second run, you're good. If a row slipped outside the band, tighten by one more iteration.

- [ ] **Step 6: Escape hatch (if stuck after 10 iterations)**

If after 10 iterations the two-lever design still can't hit target:

1. Stop tuning.
2. Open a new issue titled "Balance: pace tuning needs additional lever (follow-up to #2)" with the final sim table and iteration log as evidence.
3. Do NOT silently add a third lever in this plan — scope creep is the risk we called out in the spec.
4. Comment on #2 with status and the new follow-up issue link.
5. Skip Task 7 (do not commit mid-tune); discard uncommitted changes with `git restore src/systems/travel.js src/systems/events.js` and pick the work back up after the follow-up issue is designed.

- [ ] **Step 7: Commit the final tuned values**

```bash
git add src/systems/travel.js src/systems/events.js
git commit -m "$(cat <<'EOF'
Pace-scaled attrition: cautious/steady/push now distinct choices

Closes #2

Before (sim, 500 games, Balanced strategy):
  cautious: 0.0%    steady: 0.0%    push: 95.4%

After (same sim, final tuned values):
  cautious: XX.X%   steady: XX.X%   push: XX.X%
  FirstChoice ceiling: XX.X%
  Skilled advantage over Balanced: +X.Xpp

Two constants became pace-indexed tables:
- BACKGROUND_DAMAGE_BY_PACE in src/systems/travel.js
- EVENT_BASE_RATE_BY_PACE in src/systems/events.js

No new mechanics, no UI, no state schema changes. Full design in
docs/superpowers/specs/2026-04-16-pace-balance-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Replace the `XX.X%` placeholders with the actual numbers from your final sim run before committing. The commit message doubles as the release-notes evidence.

---

## Task 7: Browser sanity check + push + tag + release

**Files:** none modified — release / tag work only.

- [ ] **Step 1: Start a local HTTP server**

Run: `python3 -m http.server 8000 &`
Expected: `Serving HTTP on :: port 8000 (http://[::]:8000/) ...`

Background process; remember to kill it when done.

- [ ] **Step 2: Open the game in a browser**

Run: `open "http://localhost:8000/"`

- [ ] **Step 3: Play one short run at cautious pace**

- Click through title / briefing / loadout with defaults.
- Set pace to **cautious** in the UI.
- Advance 3–4 sols, resolving any events.
- Watch that the game is responsive; no JS console errors (check browser devtools).
- Mental check: does cautious *feel* softer (fewer events firing) than expected vs the prior build? No need to finish the run.

- [ ] **Step 4: Play one short run at push pace**

Reload and repeat with pace set to **push**. Confirm events fire more often and crew health tracks lower.

- [ ] **Step 5: Kill the dev server**

Run: `kill %1`
Expected: server process terminates.

- [ ] **Step 6: Push commits to `origin/main`**

Run: `git push`

Check: `gh issue view 2` should now show status `CLOSED` (from the `Closes #2` in the Task 6 commit). `gh issue view 4` is already closed from Task 4.

- [ ] **Step 7: Tag v0.2.0 and push the tag**

```bash
git tag -a v0.2.0 -m "v0.2.0 — pace balance + sim harness

Pace now a real strategic choice: cautious/steady/push have
distinct win rates. Playtest sim harness added as a permanent
dev tool. Closes #2 and #4."
git push origin v0.2.0
```

- [ ] **Step 8: Create the GitHub Release**

```bash
gh release create v0.2.0 --title "v0.2.0 — Pace Balance" --notes "$(cat <<'EOF'
## Pace is now a meaningful choice

Before v0.2.0, only the 'push' pace could win the game. Cautious and steady paces had ~0% win rate because crew attrition from background damage + random events compounded over the extra sols.

This release replaces two flat constants with pace-indexed tables:
- \`BACKGROUND_DAMAGE_BY_PACE\` — lower per-sol crew wear at slower paces
- \`EVENT_BASE_RATE_BY_PACE\` — fewer random events at slower paces

Final sim win rates (Balanced strategy, 500 games):
- Cautious: XX.X% (was 0%)
- Steady: XX.X% (was 0%)
- Push: XX.X% (was 95.4%)

## New: playtest simulation harness

\`sim/play.mjs\` is a Node ESM script that runs N games per strategy × pace × rations configuration and prints a results table. Not tied to CI; a manual dev tool for tuning.

Run: \`node sim/play.mjs\`

See \`sim/README.md\` and the design doc in \`docs/superpowers/specs/\` for details.

Closes #2, closes #4.
EOF
)"
```

Replace `XX.X%` with the final tuned numbers from Task 6.

- [ ] **Step 9: Verify the release page**

Run: `gh release view v0.2.0`
Expected: title and body render correctly; tag `v0.2.0` is listed.

---

## Self-Review Checklist (already run)

- **Spec coverage:** Every section of the spec (code changes, sim harness, tuning procedure, validation, sequencing) maps to a task above. ✓
- **Placeholder scan:** Only intentional `XX.X%` placeholders in commit / release messages, each flagged with "replace with final numbers." No TBDs. ✓
- **Type consistency:** Both constants renamed with the `_BY_PACE` suffix; both call sites use `[s.pace]` / `[state.pace]` lookup. Identifiers match across tasks. ✓
- **Escape hatch:** Task 6 Step 6 defines what to do if the two-lever design can't hit target. ✓
- **Reversibility:** Each task ends in a commit; browser sanity check and tag/release are the only externally-visible actions, and they're gated behind manual steps. ✓
