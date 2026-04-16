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
