// 1000-game playtest sweep. Compares CURRENT scoring-by-points against
// the PROPOSED rank-as-checklist from issue #24. Runs several player
// archetypes × divert modes and reports rank distributions, avg stats,
// and what % of games would move ranks under the proposal.

import { createInitialState } from '../src/state.js';
import { advanceSol, canRepair, canClean, repairBattery, cleanPanels } from '../src/systems/travel.js';
import { applyEventChoice } from '../src/systems/events.js';
import { applyStageChoice } from '../src/systems/multiStage.js';
import { acceptAwayTeam, resolveAwayTeamStage, finalizeReunion } from '../src/systems/awayTeam.js';
import { resolveMedicalStage } from '../src/systems/medicalEmergency.js';
import { computeScore } from '../src/systems/scoring.js';
import { makeLandmarkEncounter } from '../src/content/landmarks.js';

// ---- Strategies ----

function pickRandom(_state, event) {
  return Math.floor(Math.random() * event.modal.choices.length);
}

function pickFirst(_state, _event) { return 0; }

// "Engaged player": skill check if specialist is alive, else choice 0.
function pickSmart(state, event) {
  let best = -1, bestP = 0;
  event.modal.choices.forEach((c, i) => {
    if (!c.skillCheck) return;
    const alive = state.crew.some(cr => cr.role === c.skillCheck.role && cr.alive);
    const p = alive ? c.skillCheck.successP : Math.max(0.2, c.skillCheck.successP - 0.4);
    if (p > bestP) { bestP = p; best = i; }
  });
  return best === -1 ? 0 : best;
}

// "Science chaser": prefer choices with sciencePoints on an outcome.
function pickScience(state, event) {
  let best = 0, bestSci = -1;
  event.modal.choices.forEach((c, i) => {
    const pools = c.skillCheck ? [c.successOutcome, c.failOutcome] : [c.outcome];
    let sci = 0;
    for (const o of pools) if (o && typeof o.sciencePoints === 'number') sci += o.sciencePoints;
    if (c.skillCheck) {
      const alive = state.crew.some(cr => cr.role === c.skillCheck.role && cr.alive);
      sci *= alive ? c.skillCheck.successP : 0.35;
    }
    if (sci > bestSci) { bestSci = sci; best = i; }
  });
  return best;
}

// ---- Proposed rank gate (issue #24 final table) ----

function proposedRank(state) {
  const total = (state.routeKm || []).reduce((s, k) => s + k, 0);
  const pctRoute = total ? state.totalKmTraveled / total : 0;
  const won = state.status === 'won';
  const sci = state.sciencePoints;
  const facts = state.factsLearned.length;
  const alive = state.crew.filter(c => c.alive).length;
  const crewCount = state.crew.length;

  if (!won) {
    if (pctRoute >= 0.8) return 'D';
    return 'F';
  }
  if (sci >= 500 && facts >= 6 && alive === crewCount) return 'S';
  if (sci >= 300 && facts >= 5 && alive >= 3) return 'A';
  if (sci >= 150 || facts >= 3) return 'B';
  return 'C';
}

// ---- Game loop ----

function playGame({ pickChoice, acceptDiverts, sendCrew = 2 }) {
  let s = createInitialState();
  s.activeModal = null;
  s.pace = 'steady';
  s.rations = 'standard';

  const MAX = 250;
  while (s.status === 'active' && s.sol < MAX) {
    const m = s.activeModal;
    if (m && m.type === 'event') {
      const idx = pickChoice(s, m.payload);
      s = applyEventChoice(s, m.payload, idx).state;
      continue;
    }
    if (m && m.type === 'waypoint_offer') {
      if (!acceptDiverts) {
        s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id], activeModal: null };
      } else {
        s = { ...s, activeModal: { type: 'away_team_picker', payload: m.payload } };
      }
      continue;
    }
    if (m && m.type === 'away_team_picker') {
      const aliveIds = s.crew.filter(c => c.alive).map(c => c.id);
      const toSend = aliveIds.slice(0, Math.min(sendCrew, aliveIds.length - 1));
      if (toSend.length < 1) { s = { ...s, activeModal: null }; continue; }
      s = acceptAwayTeam(s, m.payload.waypoint.id, toSend);
      s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id] };
      const arrivedId = s.route[s.currentLandmarkIndex];
      s = { ...s, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
      continue;
    }
    if (m && m.type === 'away_team_reunion') {
      const corpseChoices = {};
      for (const d of m.payload.deaths) corpseChoices[d.id] = 'bring';
      s = finalizeReunion(s, corpseChoices);
      continue;
    }
    if (m && m.type === 'multi_stage') {
      if (m.payload.source === 'medical')   { s = resolveMedicalStage(s, 0); continue; }
      if (m.payload.source === 'awayTeam')  { s = resolveAwayTeamStage(s, 0); continue; }
      const { event, stageId } = m.payload;
      const { state: next, nextStage } = applyStageChoice(s, event, stageId, 0);
      s = nextStage !== null
        ? { ...next, activeModal: { type: 'multi_stage', payload: { event, stageId: nextStage } } }
        : { ...next, activeModal: null };
      continue;
    }
    if (canRepair(s) && s.resources.power < 35) { s = repairBattery(s); continue; }
    if (canClean(s)  && s.resources.panels < 40) { s = cleanPanels(s);   continue; }
    s = advanceSol(s, 'travel');
  }
  if (s.status === 'active') { s.status = 'lost'; s.lossReason = 'timeout'; }
  return s;
}

// ---- Sweep ----

const CONFIGS = [
  { label: 'Random / decline',       pickChoice: pickRandom,  acceptDiverts: false },
  { label: 'Random / accept',        pickChoice: pickRandom,  acceptDiverts: true  },
  { label: 'FirstChoice / decline',  pickChoice: pickFirst,   acceptDiverts: false },
  { label: 'FirstChoice / accept',   pickChoice: pickFirst,   acceptDiverts: true  },
  { label: 'Smart / decline',        pickChoice: pickSmart,   acceptDiverts: false },
  { label: 'Smart / accept',         pickChoice: pickSmart,   acceptDiverts: true  },
  { label: 'Sci-chaser / decline',   pickChoice: pickScience, acceptDiverts: false },
  { label: 'Sci-chaser / accept',    pickChoice: pickScience, acceptDiverts: true  }
];

const N_PER = 125;
const TOTAL = CONFIGS.length * N_PER;
const RANKS = ['S', 'A', 'B', 'C', 'D', 'F'];

function blankHist() { return Object.fromEntries(RANKS.map(r => [r, 0])); }
function pct(n, total) { return total ? ((n / total) * 100).toFixed(1).padStart(5) : '  0.0'; }

const results = [];
const globalCurrent  = blankHist();
const globalProposed = blankHist();
let globalN = 0;
let rankChanged = 0;

for (const cfg of CONFIGS) {
  const current = blankHist();
  const proposed = blankHist();
  let wins = 0, sumSci = 0, sumFacts = 0, sumCrew = 0, sumSols = 0;
  for (let i = 0; i < N_PER; i++) {
    const s = playGame(cfg);
    const { rank } = computeScore(s);
    const pRank = proposedRank(s);
    current[rank]++;
    proposed[pRank]++;
    globalCurrent[rank]++;
    globalProposed[pRank]++;
    globalN++;
    if (rank !== pRank) rankChanged++;
    if (s.status === 'won') wins++;
    sumSci   += s.sciencePoints;
    sumFacts += s.factsLearned.length;
    sumCrew  += s.crew.filter(c => c.alive).length;
    sumSols  += s.sol;
  }
  results.push({
    cfg, current, proposed,
    win: wins / N_PER,
    avgSci: sumSci / N_PER,
    avgFacts: sumFacts / N_PER,
    avgCrew: sumCrew / N_PER,
    avgSol:  sumSols / N_PER
  });
}

// ---- Report ----

console.log(`\nRunning ${TOTAL} games across ${CONFIGS.length} configs (${N_PER} each)\n`);

console.log('Per-config rank distributions (% of games at each rank):\n');
console.log(
  'config'.padEnd(25) +
  '  win%  avg_sci  avg_fact  avg_crew  avg_sol' +
  '  |  CURRENT S/A/B/C/D/F' +
  '           | PROPOSED S/A/B/C/D/F'
);
console.log('-'.repeat(140));
for (const r of results) {
  const curStr = RANKS.map(k => pct(r.current[k], N_PER)).join(' ');
  const propStr = RANKS.map(k => pct(r.proposed[k], N_PER)).join(' ');
  console.log(
    r.cfg.label.padEnd(25) +
    `  ${pct(r.win * N_PER, N_PER)}  ${r.avgSci.toFixed(1).padStart(6)}  ` +
    `${r.avgFacts.toFixed(2).padStart(7)}  ${r.avgCrew.toFixed(2).padStart(7)}  ` +
    `${r.avgSol.toFixed(1).padStart(6)}  |  ${curStr}  |  ${propStr}`
  );
}

console.log('\n---- Global distributions (all configs combined) ----');
console.log('rank  |  current  |  proposed');
console.log('-'.repeat(35));
for (const rk of RANKS) {
  console.log(
    `  ${rk}   |   ${pct(globalCurrent[rk], TOTAL)}%  |  ${pct(globalProposed[rk], TOTAL)}%`
  );
}
console.log('\nrank changed in ' + pct(rankChanged, TOTAL) + '% of games');
console.log();
