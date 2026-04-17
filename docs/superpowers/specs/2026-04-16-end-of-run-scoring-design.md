# End-of-Run Scoring and Ranking Design (issue #9)

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Related issue:** #9

## Problem

End-of-run currently shows a stats grid (sols, km, crew survived, science points) with no synthesis. There's no way to compare one run to another, no sense of "how well did I do", and no reason to replay for a better outcome. Every completed run feels the same.

## Goal

Give every completed run (won or lost) a single memorable summary:
- A letter rank (S/A/B/C/D/F)
- A total point score (~0–1740 ceiling)
- A breakdown showing how each factor contributed
- A persisted "best ever" record, shown on the title screen

Rank should reflect *completion quality*, not just *did you finish*. A slow B-rank win and a fast S-rank win are both wins, but one of them is clearly a better mission.

## Architecture — pure scoring module + thin UI integration

One new file, one styling pass, two modal touches:

**New:**
- `src/systems/scoring.js` — pure module. Exports three functions:
  - `computeScore(state)` → `{ points, breakdown, rank }`
  - `loadBestRun()` → `{ points, rank, sol, won, date } | null`
  - `saveBestRun(score, state)` → void (writes only on new-best)

**Modified:**
- `src/ui/modals.js` — `showEndOfRunModal` computes score, saves if best, renders rank block above the existing stats grid.
- `src/ui/modals.js` — title-screen rendering reads best-run via `loadBestRun`, shows a "BEST" caption line if present.
- `styles/modals.css` — rank block (big letter, points line, breakdown table) + title-screen BEST caption.

**Untouched:** `src/state.js`, `src/systems/travel.js`, `src/systems/events.js`, all content modules. The game-state pipeline stays pure — no localStorage I/O leaks into gameplay systems.

## Scoring formula

```js
function computeScore(state) {
  const breakdown = [];

  // Outcome — biggest single lever
  const outcomePts =
    state.status === 'won' ? 500
    : state.totalKmTraveled >= 0.8 * totalRouteKm(state) ? 100
    : 0;
  breakdown.push({ label: 'Mission outcome', value: state.status, points: outcomePts });

  // Crew survived — 100 per alive crew member
  const alive = state.crew.filter(c => c.alive).length;
  breakdown.push({ label: 'Crew survived', value: `${alive}/${state.crew.length}`, points: alive * 100 });

  // Science — capped at 300 (beyond that is flavor, not score)
  const sciPts = Math.min(state.sciencePoints, 300);
  breakdown.push({ label: 'Science points', value: state.sciencePoints, points: sciPts });

  // Resources remaining — average of O₂/H₂O/food/power, capped at 100
  const r = state.resources;
  const rawResPts = Math.round((r.oxygen + r.water + r.food + r.power) / 4);
  const resPts = Math.min(rawResPts, 100);
  breakdown.push({ label: 'Resources remaining', value: `${rawResPts}%`, points: resPts });

  // Speed — only on won runs; 300 − (sols × 10), floor 0
  const speedPts = state.status === 'won' ? Math.max(0, 300 - state.sol * 10) : 0;
  breakdown.push({ label: 'Speed bonus', value: `sol ${state.sol}`, points: speedPts });

  // Landmark stops — 20 per non-destination landmark reached
  const stops = Math.max(0, state.currentLandmarkIndex);
  breakdown.push({ label: 'Landmark stops', value: stops, points: stops * 20 });

  const points = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { points, breakdown, rank: rankFor(points, state.status === 'won') };
}

// Helper: total route length from state.routeKm
function totalRouteKm(state) {
  return (state.routeKm || []).reduce((sum, km) => sum + km, 0);
}
```

**Point ceiling ~1740:**
- Outcome 500 + Crew 500 + Sci 300 + Resources 100 + Speed 300 (fastest theoretical ~sol 1) + Landmarks 6 × 20 = 120.
- Realistic won-run ceiling: ~1500 (speed bonus erodes with each sol).

**Why these weights:**
- Outcome is the single largest factor — you did or didn't complete the mission.
- Crew survival at 500 total = outcome-weight, so losing all crew feels as bad as failing the mission.
- Science and landmarks together reward exploration without dominating.
- Speed on won runs only — losing fast is not virtuous.
- Resources remaining rewards efficient play (didn't burn everything to get here).

## Rank thresholds

```js
function rankFor(points, won) {
  if (!won) {
    // Lost runs capped at C — completion matters
    if (points >= 700) return 'C';
    if (points >= 400) return 'D';
    return 'F';
  }
  if (points >= 1500) return 'S';
  if (points >= 1200) return 'A';
  if (points >= 900)  return 'B';
  return 'C'; // won but low — at least C for completion
}
```

| Rank | Min points | Condition | Reachability |
|---|---|---|---|
| **S** | 1500 | won | Near-perfect: all crew, fast (< sol ~18), high sci |
| **A** | 1200 | won | Strong: one concession (crew loss OR slow OR low sci) |
| **B** | 900 | won | Rough: multiple concessions |
| **C** | any | won, or lost ≥ 700 | Baseline completion, or near-miss loss |
| **D** | 400 | lost | Made it most of the way |
| **F** | < 400 | lost | Early wipe |

## End-of-run modal — rank block

Insert **above** the existing stats grid in `showEndOfRunModal`:

```
╭────────────────────────────────╮
│        MISSION RANK            │
│                                │
│              A                 │
│         1,483 points           │
│                                │
│  Mission outcome  won    · 500 │
│  Crew survived    4/5    · 400 │
│  Science points   237    · 237 │
│  Resources        42%    ·  42 │
│  Speed bonus      sol 24 ·  60 │
│  Landmark stops   6      · 120 │
╰────────────────────────────────╯
```

The rank letter renders large (probably 5–8rem), color-coded:
- **S/A** — LCARS gold
- **B/C** — LCARS neutral tan
- **D/F** — LCARS red

The existing stats grid (SOLS / KM / CREW / SCIENCE) stays as-is below this block — it's still useful at-a-glance context.

## Best-run persistence

**Storage key:** `marsTrail.bestRun`

**Shape:**
```json
{
  "points": 1483,
  "rank": "A",
  "sol": 24,
  "won": true,
  "date": "2026-04-17"
}
```

**`loadBestRun()`**
- Read key, parse JSON. Return `null` on missing or malformed data.
- Wrap in try/catch — any parse error returns `null`. No thrown errors reach callers.

**`saveBestRun(score, state)`**
- Compare `score.points` against `loadBestRun().points` (treat null as 0).
- Save only when `score.points > existing.points`.
- Date captured as `new Date().toISOString().slice(0, 10)` (YYYY-MM-DD).
- Called from `showEndOfRunModal` after `computeScore`, before render. (Order matters so the displayed rank reflects the just-saved record; no "was this a new best?" indicator in v1.)

**Scope:**
- One global best record, not per-scenario. The game has one scenario today (`trek`). Extendable later with a key suffix.
- Ties broken by raw points only — a C-rank win at 800 points beats a D-rank loss at 650 because 800 > 650. No special won/lost tiebreaker logic.

## Title-screen "BEST" readout

**Where:** Under the main title / subtitle on the title modal. Only renders if `loadBestRun()` returns non-null; on first-ever run, the line is omitted entirely (no placeholder).

**Format examples:**
```
BEST: RANK A · 1,483 pts · sol 24 · won
BEST: RANK D · 620 pts · sol 18 · lost
```

**Styling:** small LCARS-grey caption under the title. De-emphasized. Same font family as existing labels.

**Rationale for showing lost-run bests:** early in a player's career all their records will be losses. Showing them keeps the feature alive from run #1, not "nothing until you win once."

**No celebratory flourish for new-best** — that's scope C (deferred). Player notices their best updated next time they see the title.

## Validation

- **Manual:** Play a won run and verify the rank block renders with correct breakdown numbers; verify title screen shows the BEST caption on next page load.
- **Manual negative:** Clear localStorage (`localStorage.removeItem('marsTrail.bestRun')`) and verify title screen omits the BEST caption.
- **Manual lost-run:** Intentionally die early and verify rank F displays correctly.
- **Optional sim hook (future):** `sim/play.mjs` could call `computeScore` on each finished game and report rank distributions — nice for validating that each pace produces a sane rank curve. Out of scope for v1.

## Scope boundary

**Explicitly in scope (B-scope per brainstorm):**
- Rank + score + breakdown in end-of-run modal.
- Best-run localStorage persistence.
- Title screen BEST caption.

**Explicitly out of scope (C-scope deferred):**
- Animated breakdown reveal (one factor at a time).
- New-best celebratory SFX / flash.
- Rank distribution in sim harness output.
- Per-scenario best tracking (only one scenario exists).
- Share/export of best-run results.

**Interaction with other open issues:**
- #7 (career science) — unrelated storage keys; can land in either order.
- #8 (event tiers) — unrelated; #8 blocks on #7, not on this.
- #6 (medical event) — if landed after this, the crew-death body-disposal flow won't affect scoring beyond the existing crew-survived tally.

## Sequencing

One commit — scoped small enough:

1. Create `src/systems/scoring.js` with the three exported functions.
2. Wire into `showEndOfRunModal` (rank block above existing stats) and title rendering (BEST caption).
3. Add styles.
4. Manual browser check, commit, PR, merge, tag `v0.3.0` (minor — new feature), release.

After merge: tag `v0.3.0`, GitHub Release summarizing the ranking system.
