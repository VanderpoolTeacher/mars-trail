// Mars Trail — end-of-run scoring + best-run persistence.
// Pure module. Import from game systems or UI; no state mutation.
//
// Scoring has two pieces:
// - `computeScore` produces a numeric `points` total + breakdown (unchanged
//   in v0.7.1; used for the leaderboard and run-vs-run comparison).
// - Rank is determined by a **checklist of gates** (issue #24), not by point
//   thresholds. Philosophy: surviving is C. Science + learning earn A.
//   Science + learning + no-one-left-behind earn S.

const SCI_B = 150;
const FACTS_B = 3;
const SCI_A = 300;
const FACTS_A = 5;
const CREW_A = 3;
const SCI_S = 500;
const FACTS_S = 6;
const LOST_D_ROUTE_FRACTION = 0.8;

function totalRouteKm(state) {
  return (state.routeKm || []).reduce((sum, km) => sum + km, 0);
}

function factsLearnedCount(state) {
  return (state.factsLearned || []).length;
}

function aliveCrewCount(state) {
  return state.crew.filter(c => c.alive).length;
}

function rankFor(state) {
  const won = state.status === 'won';
  if (!won) {
    const pctRoute = state.totalKmTraveled / Math.max(1, totalRouteKm(state));
    return pctRoute >= LOST_D_ROUTE_FRACTION ? 'D' : 'F';
  }
  const sci   = state.sciencePoints || 0;
  const facts = factsLearnedCount(state);
  const alive = aliveCrewCount(state);
  const totalCrew = state.crew.length;

  if (sci >= SCI_S && facts >= FACTS_S && alive === totalCrew)       return 'S';
  if (sci >= SCI_A && facts >= FACTS_A && alive >= CREW_A)           return 'A';
  if (sci >= SCI_B || facts >= FACTS_B)                              return 'B';
  return 'C';
}

// ---- nextRankGap ----
// Given a finished state, describe what's missing to earn the next rank up.
// Returns { nextRank, needs: [{label, value}, …] } or null if already S or
// if the mission was lost (losses don't progress toward rank gates).
export function nextRankGap(state) {
  if (state.status !== 'won') return null;
  const current = rankFor(state);
  if (current === 'S') return null;

  const sci   = state.sciencePoints || 0;
  const facts = factsLearnedCount(state);
  const alive = aliveCrewCount(state);
  const totalCrew = state.crew.length;

  // Map current → target rank.
  const target = current === 'C' ? 'B'
               : current === 'B' ? 'A'
               : current === 'A' ? 'S'
               : null;
  if (!target) return null;

  const needs = [];
  if (target === 'B') {
    // B: need ≥ SCI_B SCI OR ≥ FACTS_B facts. Report whichever is closer.
    const sciGap   = Math.max(0, SCI_B - sci);
    const factsGap = Math.max(0, FACTS_B - facts);
    if (sciGap === 0 || factsGap === 0) return null;   // safety
    if (sciGap * FACTS_B <= factsGap * SCI_B) {
      needs.push({ label: 'science points', delta: sciGap });
    } else {
      needs.push({ label: 'advanced facts', delta: factsGap });
    }
  } else if (target === 'A') {
    if (sci   < SCI_A)   needs.push({ label: 'science points', delta: SCI_A - sci });
    if (facts < FACTS_A) needs.push({ label: 'advanced facts', delta: FACTS_A - facts });
    if (alive < CREW_A)  needs.push({ label: 'crew alive',     delta: CREW_A - alive });
  } else if (target === 'S') {
    if (sci   < SCI_S)   needs.push({ label: 'science points', delta: SCI_S - sci });
    if (facts < FACTS_S) needs.push({ label: 'advanced facts', delta: FACTS_S - facts });
    if (alive < totalCrew) {
      needs.push({ label: 'all crew alive', delta: totalCrew - alive, hard: true });
    }
  }
  if (needs.length === 0) return null;
  return { currentRank: current, nextRank: target, needs };
}

export function computeScore(state) {
  const won = state.status === 'won';
  const breakdown = [];

  const outcomePts = won
    ? 500
    : state.totalKmTraveled >= 0.8 * totalRouteKm(state) ? 100 : 0;
  breakdown.push({ label: 'Mission outcome', value: state.status, points: outcomePts });

  const alive = aliveCrewCount(state);
  breakdown.push({ label: 'Crew survived', value: `${alive}/${state.crew.length}`, points: alive * 100 });

  const sciPts = Math.min(state.sciencePoints, 300);
  breakdown.push({ label: 'Science points', value: state.sciencePoints, points: sciPts });

  const r = state.resources;
  const rawResPts = Math.round((r.oxygen + r.water + r.food + r.power) / 4);
  const resPts = Math.min(rawResPts, 100);
  breakdown.push({ label: 'Resources remaining', value: `${rawResPts}%`, points: resPts });

  const speedPts = won ? Math.max(0, 300 - state.sol * 10) : 0;
  breakdown.push({ label: 'Speed bonus', value: `sol ${state.sol}`, points: speedPts });

  const stops = Math.max(0, state.currentLandmarkIndex);
  breakdown.push({ label: 'Landmark stops', value: stops, points: stops * 20 });

  const points = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { points, breakdown, rank: rankFor(state) };
}

// ---- Best-run persistence ----

const BEST_RUN_KEY = 'marsTrail.bestRun';

export function loadBestRun() {
  try {
    const raw = localStorage.getItem(BEST_RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveBestRun(score, state) {
  const existing = loadBestRun();
  if (existing && existing.points >= score.points) return;
  const record = {
    points: score.points,
    rank:   score.rank,
    sol:    state.sol,
    won:    state.status === 'won',
    date:   new Date().toISOString().slice(0, 10)
  };
  try {
    localStorage.setItem(BEST_RUN_KEY, JSON.stringify(record));
  } catch {
    // Quota full, disabled localStorage, etc. — silently skip.
  }
}
