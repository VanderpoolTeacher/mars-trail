// Mars Trail — end-of-run scoring + best-run persistence.
// Pure module. Import from game systems or UI; no state mutation.

const RANK_THRESHOLDS_WON  = [['S', 1500], ['A', 1200], ['B', 900]];  // fall through to 'C'
const RANK_THRESHOLDS_LOST = [['C', 700], ['D', 400]];                // fall through to 'F'

function totalRouteKm(state) {
  return (state.routeKm || []).reduce((sum, km) => sum + km, 0);
}

// Top ranks gate on minimum science — the mission is a SCIENCE mission, so
// S and A require real scientific output, not just survival + speed.
const SCI_FLOOR_S = 200;
const SCI_FLOOR_A = 100;

function rankFor(points, won, sciencePoints) {
  if (!won) {
    for (const [rank, min] of RANK_THRESHOLDS_LOST) {
      if (points >= min) return rank;
    }
    return 'F';
  }
  if (points >= 1500 && sciencePoints >= SCI_FLOOR_S) return 'S';
  if (points >= 1200 && sciencePoints >= SCI_FLOOR_A) return 'A';
  if (points >= 900) return 'B';
  return 'C';
}

export function computeScore(state) {
  const won = state.status === 'won';
  const breakdown = [];

  const outcomePts = won
    ? 500
    : state.totalKmTraveled >= 0.8 * totalRouteKm(state) ? 100 : 0;
  breakdown.push({ label: 'Mission outcome', value: state.status, points: outcomePts });

  const alive = state.crew.filter(c => c.alive).length;
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
  return { points, breakdown, rank: rankFor(points, won, state.sciencePoints) };
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
