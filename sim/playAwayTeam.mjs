// Away-team acceptance simulator. Exercises the full dispatch → camp →
// stage-chain → reunion flow across many runs to surface runtime errors
// and report impact on mission outcome. Not part of the test suite.

import { createInitialState } from '../src/state.js';
import { advanceSol, canRepair, canClean, repairBattery, cleanPanels } from '../src/systems/travel.js';
import { applyEventChoice } from '../src/systems/events.js';
import { applyStageChoice } from '../src/systems/multiStage.js';
import { acceptAwayTeam, resolveAwayTeamStage, finalizeReunion } from '../src/systems/awayTeam.js';
import { resolveMedicalStage } from '../src/systems/medicalEmergency.js';
import { makeLandmarkEncounter } from '../src/content/landmarks.js';
import { declineWaypoint } from '../src/systems/waypoints.js';

function playGame({ acceptDiverts, maxSend = 2 }) {
  let s = createInitialState();
  s.activeModal = null;
  s.pace = 'steady';
  s.rations = 'standard';

  const stats = {
    divertsOffered:  0,
    divertsAccepted: 0,
    reunionsSeen:    0,
    deathsAway:      0,
    corpsesBrought:  0,
    medicalsSeen:    0,
    sciFromAway:     0
  };

  const MAX = 250;
  while (s.status === 'active' && s.sol < MAX) {
    const m = s.activeModal;

    if (m && m.type === 'event') {
      const event = m.payload;
      const { state: next } = applyEventChoice(s, event, 0);
      s = next;
      continue;
    }

    if (m && m.type === 'waypoint_offer') {
      stats.divertsOffered++;
      if (!acceptDiverts) {
        s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id], activeModal: null };
      } else {
        s = { ...s, activeModal: { type: 'away_team_picker', payload: m.payload } };
      }
      continue;
    }

    if (m && m.type === 'away_team_picker') {
      const aliveIds = s.crew.filter(c => c.alive).map(c => c.id);
      const toSend = aliveIds.slice(0, Math.min(maxSend, aliveIds.length - 1));
      if (toSend.length < 1) {
        s = { ...s, activeModal: null };
        continue;
      }
      stats.divertsAccepted++;
      s = acceptAwayTeam(s, m.payload.waypoint.id, toSend);
      s = { ...s, firedWaypoints: [...s.firedWaypoints, m.payload.waypoint.id] };
      const arrivedId = s.route[s.currentLandmarkIndex];
      s = { ...s, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
      continue;
    }

    if (m && m.type === 'away_team_reunion') {
      stats.reunionsSeen++;
      stats.deathsAway += m.payload.deaths.length;
      stats.sciFromAway += m.payload.sciencePoints;
      const corpseChoices = {};
      for (const d of m.payload.deaths) {
        corpseChoices[d.id] = 'bring';
        stats.corpsesBrought++;
      }
      s = finalizeReunion(s, corpseChoices);
      continue;
    }

    if (m && m.type === 'multi_stage') {
      if (m.payload.source === 'medical') {
        stats.medicalsSeen++;
        s = resolveMedicalStage(s, 0);
        continue;
      }
      if (m.payload.source === 'awayTeam') {
        s = resolveAwayTeamStage(s, 0);
        continue;
      }
      const { event, stageId } = m.payload;
      const { state: next, nextStage } = applyStageChoice(s, event, stageId, 0);
      if (nextStage !== null) {
        s = { ...next, activeModal: { type: 'multi_stage', payload: { event, stageId: nextStage } } };
      } else {
        s = { ...next, activeModal: null };
      }
      continue;
    }

    if (canRepair(s) && s.resources.power < 35) { s = repairBattery(s); continue; }
    if (canClean(s)  && s.resources.panels < 40) { s = cleanPanels(s);   continue; }
    s = advanceSol(s, 'travel');
  }
  if (s.status === 'active') s.status = 'lost', s.lossReason = 'timeout';
  return { state: s, stats };
}

function run(label, opts, N) {
  let wins = 0, totalSols = 0, totalSci = 0, totalCrew = 0;
  const agg = { divertsOffered: 0, divertsAccepted: 0, reunionsSeen: 0,
                deathsAway: 0, corpsesBrought: 0, medicalsSeen: 0, sciFromAway: 0 };
  for (let i = 0; i < N; i++) {
    const { state, stats } = playGame(opts);
    if (state.status === 'won') wins++;
    totalSols += state.sol;
    totalSci  += state.sciencePoints;
    totalCrew += state.crew.filter(c => c.alive).length;
    for (const k of Object.keys(agg)) agg[k] += stats[k];
  }
  const pct = (v) => (v / N).toFixed(2);
  console.log(
    `${label.padEnd(20)} ` +
    `win=${((wins / N) * 100).toFixed(1).padStart(5)}%  ` +
    `sols=${pct(totalSols).padStart(5)}  ` +
    `sci=${pct(totalSci).padStart(6)}  ` +
    `crew=${pct(totalCrew)}  |  ` +
    `offers=${pct(agg.divertsOffered)}  accepted=${pct(agg.divertsAccepted)}  ` +
    `reunions=${pct(agg.reunionsSeen)}  deaths=${pct(agg.deathsAway)}  ` +
    `corpses=${pct(agg.corpsesBrought)}  medicals=${pct(agg.medicalsSeen)}  ` +
    `sci_away=${pct(agg.sciFromAway)}`
  );
}

const N = 200;
console.log(`Running ${N} games per configuration\n`);
console.log('label'.padEnd(20) +
  '  win%     sols    sci     crew  |  offers  accepted  reunions  deaths  corpses  medicals  sci_away');
console.log('-'.repeat(140));
run('Decline diverts',      { acceptDiverts: false }, N);
run('Accept (send 1)',      { acceptDiverts: true, maxSend: 1 }, N);
run('Accept (send 2)',      { acceptDiverts: true, maxSend: 2 }, N);
run('Accept (send 3)',      { acceptDiverts: true, maxSend: 3 }, N);
