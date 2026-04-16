// Mars Trail — playtest simulation harness.
// Imports pure game modules and runs many games per strategy.
// Not a test suite; a dev tool for balance validation.

import { createInitialState } from '../src/state.js';
import { advanceSol, repairBattery, cleanPanels, canRepair, canClean } from '../src/systems/travel.js';
import { applyEventChoice } from '../src/systems/events.js';

// Simplest strategy: always pick the first option.
function strategyFirst(_state, _event) { return 0; }

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
