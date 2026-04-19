// Mash-playtest (issue #63). Simulates 1000 runs of a player who
// clicks the first choice on every modal in <100 ms — i.e. the exact
// behaviour the click-metrics heuristic is meant to punish — and
// compares it against a "reader" who takes long enough on each choice
// that mashScore never trips.
//
// Run: node sim/mashPlaytest.mjs

import { createInitialState } from '../src/state.js';
import { advanceSol, canRepair, canClean, repairBattery, cleanPanels } from '../src/systems/travel.js';
import { applyEventChoice } from '../src/systems/events.js';
import { applyStageChoice } from '../src/systems/multiStage.js';
import { acceptAwayTeam, resolveAwayTeamStage, finalizeReunion } from '../src/systems/awayTeam.js';
import { resolveMedicalStage } from '../src/systems/medicalEmergency.js';
import { makeLandmarkEncounter } from '../src/content/landmarks.js';
import { recordDecision } from '../src/systems/clickMetrics.js';

function isEmergency(event) { return typeof event?.id === 'string' && event.id.startsWith('emer_'); }

function playGame({ elapsedMs, pick }) {
  let s = createInitialState();
  s.activeModal = null;
  s.pace = 'steady';
  s.rations = 'standard';

  const stats = {
    emergenciesFired: 0,
    emergencyCorrectPicks: 0,
    emergencyWrongPicks: 0,
    crewDeathsDuringEmergency: 0
  };

  const MAX_SOL = 250;
  while (s.status === 'active' && s.sol < MAX_SOL) {
    const m = s.activeModal;

    if (m?.type === 'event') {
      const event = m.payload;
      s = { ...s, clickMetrics: recordDecision(s.clickMetrics, elapsedMs, event.modal.description) };
      const idx = pick(event.modal.choices);
      s = applyEventChoice(s, event, idx).state;
      continue;
    }

    if (m?.type === 'waypoint_offer') {
      s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id], activeModal: null };
      continue;
    }

    if (m?.type === 'away_team_picker') {
      const aliveIds = s.crew.filter(c => c.alive).map(c => c.id);
      const toSend = aliveIds.slice(0, Math.min(2, aliveIds.length - 1));
      if (toSend.length < 1) { s = { ...s, activeModal: null }; continue; }
      s = acceptAwayTeam(s, m.payload.waypoint.id, toSend);
      s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id] };
      const arrivedId = s.route[s.currentLandmarkIndex];
      s = { ...s, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
      continue;
    }

    if (m?.type === 'away_team_reunion') {
      const corpseChoices = {};
      for (const d of m.payload.deaths) corpseChoices[d.id] = 'bring';
      s = finalizeReunion(s, corpseChoices);
      continue;
    }

    if (m?.type === 'multi_stage') {
      if (m.payload.source === 'medical')   { s = resolveMedicalStage(s, 0); continue; }
      if (m.payload.source === 'awayTeam')  { s = resolveAwayTeamStage(s, 0); continue; }
      const { event, stageId } = m.payload;
      const stage = event.stages[stageId];
      s = { ...s, clickMetrics: recordDecision(s.clickMetrics, elapsedMs, stage.description) };

      const emergencyEvent = isEmergency(event);
      const aliveBefore = s.crew.filter(c => c.alive).length;
      if (emergencyEvent && stageId === event.startStage) stats.emergenciesFired++;

      const idx = pick(stage.choices);
      if (emergencyEvent) {
        if (stage.choices[idx]?.correct) stats.emergencyCorrectPicks++;
        else stats.emergencyWrongPicks++;
      }

      const { state: next, nextStage } = applyStageChoice(s, event, stageId, idx);
      const aliveAfter = next.crew.filter(c => c.alive).length;
      if (emergencyEvent) stats.crewDeathsDuringEmergency += Math.max(0, aliveBefore - aliveAfter);

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
  return { state: s, stats };
}

function summary(label, runs) {
  const n = runs.length;
  const won = runs.filter(r => r.state.status === 'won').length;
  const avgSol = runs.reduce((a, r) => a + r.state.sol, 0) / n;
  const avgCrew = runs.reduce((a, r) => a + r.state.crew.filter(c => c.alive).length, 0) / n;
  const lossReasons = {};
  for (const r of runs) {
    const reason = r.state.lossReason || 'won';
    lossReasons[reason] = (lossReasons[reason] || 0) + 1;
  }
  const emerFired = runs.reduce((a, r) => a + r.stats.emergenciesFired, 0);
  const emerCorrect = runs.reduce((a, r) => a + r.stats.emergencyCorrectPicks, 0);
  const emerWrong = runs.reduce((a, r) => a + r.stats.emergencyWrongPicks, 0);
  const emerCrewDeaths = runs.reduce((a, r) => a + r.stats.crewDeathsDuringEmergency, 0);

  const pct = (x) => (x * 100).toFixed(1).padStart(5);
  const pad = (x, w) => String(x).padStart(w);

  console.log(`\n── ${label} (${n} runs) ───────────────────────────`);
  console.log(`  wins:              ${pct(won / n)}% (${won}/${n})`);
  console.log(`  avg sol:           ${avgSol.toFixed(1)}`);
  console.log(`  avg crew alive:    ${avgCrew.toFixed(2)} / 5`);
  console.log(`  emergencies fired: ${emerFired} total   (${(emerFired / n).toFixed(2)}/run avg)`);
  console.log(`  emergency picks:   ${emerCorrect} correct · ${emerWrong} wrong   (${pct(emerCorrect / Math.max(1, emerCorrect + emerWrong))}% correct-by-chance)`);
  console.log(`  crew lost during emergencies: ${emerCrewDeaths}`);
  console.log(`  loss reasons:`);
  for (const [k, v] of Object.entries(lossReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(v, 4)} · ${k}`);
  }
}

// ---- Run ----

const N = 1000;
const pickFirst = (choices) => 0;
const pickRandom = (choices) => Math.floor(Math.random() * choices.length);

const masher = [];
for (let i = 0; i < N; i++) masher.push(playGame({ elapsedMs: 50, pick: pickFirst }));

const reader = [];
for (let i = 0; i < N; i++) reader.push(playGame({ elapsedMs: 20_000, pick: pickFirst }));

const mashRandom = [];
for (let i = 0; i < N; i++) mashRandom.push(playGame({ elapsedMs: 50, pick: pickRandom }));

summary('MASHER (50ms · first choice)', masher);
summary('READER (20s · first choice)', reader);
summary('MASH-RANDOM (50ms · random choice)', mashRandom);

console.log(`\nExpected correct-by-chance with 3 choices: 33.3%`);
console.log(`Emergency cap per run: 2\n`);
