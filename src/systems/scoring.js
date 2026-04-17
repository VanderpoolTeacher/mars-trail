// Mars Trail — end-of-run scoring + best-run persistence.
// Pure module. Import from game systems or UI; no state mutation.

const RANK_THRESHOLDS_WON  = [['S', 1500], ['A', 1200], ['B', 900]];  // fall through to 'C'
const RANK_THRESHOLDS_LOST = [['C', 700], ['D', 400]];                // fall through to 'F'

function totalRouteKm(state) {
  return (state.routeKm || []).reduce((sum, km) => sum + km, 0);
}

function rankFor(points, won) {
  const table = won ? RANK_THRESHOLDS_WON : RANK_THRESHOLDS_LOST;
  for (const [rank, min] of table) {
    if (points >= min) return rank;
  }
  return won ? 'C' : 'F';
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
  return { points, breakdown, rank: rankFor(points, won) };
}
