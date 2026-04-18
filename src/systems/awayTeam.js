// Mars Trail — away-team systems (issue #17).
// Pure. Manages the lifecycle of a detour-as-away-mission: dispatch,
// per-sol stage advancement, stage resolution (with returnSolDelta +
// awayTeamDamage), and reunion packaging. Rewards accumulate in
// state.awayTeam.accumulated and only land on the rover when the
// reunion modal is acknowledged via finalizeReunion.

import { WAYPOINTS } from '../content/waypoints.js';
import { AWAY_TEAM_CHAINS } from '../content/awayTeamChains.js';
import {
  ADVANCED_GEOLOGY_FACTS,
  ADVANCED_WATER_FACTS,
  ADVANCED_ATMOSPHERE_FACTS,
  ADVANCED_ASTROBIOLOGY_FACTS
} from '../content/advancedFacts.js';
import { applyOutcome } from './events.js';
import { applyDamage } from './crew.js';
import { addCorpse } from './corpse.js';

export const MIN_CREW_FOR_DIVERT = 3;

const ADVANCED_POOLS = {
  GEOLOGY:      ADVANCED_GEOLOGY_FACTS,
  WATER:        ADVANCED_WATER_FACTS,
  ATMOSPHERE:   ADVANCED_ATMOSPHERE_FACTS,
  ASTROBIOLOGY: ADVANCED_ASTROBIOLOGY_FACTS
};

function emptyAccumulated() {
  return { sciencePoints: 0, facts: [] };
}

// ---- Accept ----
// Dispatch an away team. Sets state.awayTeam; does NOT touch kmToNextLandmark
// (rover camps at the turn-off until the team returns).
export function acceptAwayTeam(state, waypointId, crewIds) {
  const aliveCount = state.crew.filter(c => c.alive).length;
  if (aliveCount < MIN_CREW_FOR_DIVERT) {
    return {
      ...state,
      log: [...state.log, { sol: state.sol, text: 'Too few crew to dispatch an away team. Divert cancelled.' }]
    };
  }
  const waypoint = WAYPOINTS.find(w => w.id === waypointId);
  const chain = AWAY_TEAM_CHAINS[waypointId];
  if (!waypoint || !chain) return state;

  const validIds = crewIds.filter(id => state.crew.some(c => c.id === id && c.alive));
  if (validIds.length === 0) return state;
  if (validIds.length > aliveCount - 1) return state;   // keep ≥1 on rover

  const returnSol = state.sol + waypoint.detourSols;
  return {
    ...state,
    awayTeam: {
      waypointId,
      crewIds:      [...validIds],
      departSol:    state.sol,
      returnSol,
      currentStage: chain.startStage,
      accumulated:  emptyAccumulated(),
      deaths:       []
    },
    log: [
      ...state.log,
      { sol: state.sol, text: `Away team dispatched to ${waypoint.name}. Due back sol ${returnSol}.` }
    ]
  };
}

// ---- Advance (one camp sol) ----
// Called from advanceSol when state.awayTeam is set. Either fires the next
// stage modal, triggers return, or emits an idle-camp log line.
export function advanceAwayTeam(state) {
  if (!state.awayTeam) return state;
  const { waypointId, currentStage, returnSol, departSol } = state.awayTeam;

  if (currentStage !== null) {
    const chain = AWAY_TEAM_CHAINS[waypointId];
    const event = {
      id:         `away:${waypointId}`,
      multiStage: true,
      stages:     chain.stages,
      startStage: chain.startStage
    };
    return {
      ...state,
      activeModal: {
        type:    'multi_stage',
        payload: { event, stageId: currentStage, source: 'awayTeam' }
      }
    };
  }

  if (state.sol >= returnSol) {
    return returnAwayTeam(state);
  }

  return {
    ...state,
    log: [
      ...state.log,
      { sol: state.sol, text: `Camp day ${state.sol - departSol + 1}. Away team still out.` }
    ]
  };
}

// ---- Resolve a stage choice ----
// Mirrors multiStage.applyStageChoice but routes rewards into
// state.awayTeam.accumulated (deferred) and restricts skill-check +
// awayTeamDamage targeting to the away-team roster.
export function resolveAwayTeamStage(state, choiceIdx) {
  if (!state.awayTeam) return state;
  const { waypointId, currentStage, crewIds } = state.awayTeam;
  const chain  = AWAY_TEAM_CHAINS[waypointId];
  const stage  = chain?.stages[currentStage];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return state;

  // ---- Skill check (specialist must be ON the away team) ----
  let outcome = choice.outcome;
  let skillSuccess = null;
  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const awayCrew = state.crew.filter(c => crewIds.includes(c.id) && c.alive);
    const specialistAlive = awayCrew.some(c => c.role === role);
    const baseP  = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const bonus  = state.careerBonuses?.skillBonus || 0;
    const effP   = Math.min(0.95, baseP + bonus);
    skillSuccess = Math.random() < effP;
    outcome = skillSuccess ? choice.successOutcome : choice.failOutcome;
  }

  // ---- Split reward-only fields from outcome fields that hit rover state ----
  const {
    sciencePoints = 0,
    awayTeamDamage = 0,
    ...restOutcome
  } = outcome || {};
  const hasRest = Object.keys(restOutcome).length > 0;

  let s = hasRest ? applyOutcome(state, restOutcome).state : state;

  // ---- Away-team damage (random alive member on the team) ----
  let deaths = [...s.awayTeam.deaths];
  if (awayTeamDamage > 0) {
    const alive = s.crew.filter(c => crewIds.includes(c.id) && c.alive);
    if (alive.length > 0) {
      const victim = alive[Math.floor(Math.random() * alive.length)];
      const res = applyDamage(s, victim.id, awayTeamDamage, 'away-team hazard');
      s = res.state;
      if (res.died) deaths.push(victim.id);
    }
  }

  // ---- Accumulate deferred rewards ----
  let accumulated = {
    ...s.awayTeam.accumulated,
    sciencePoints: s.awayTeam.accumulated.sciencePoints + sciencePoints
  };

  // Advanced fact awarded only on success of a terminal skill check.
  const isTerminal = (choice.nextStage ?? null) === null;
  if (isTerminal && skillSuccess === true) {
    const waypoint = WAYPOINTS.find(w => w.id === waypointId);
    const pool = ADVANCED_POOLS[waypoint?.factPool] || [];
    if (pool.length) {
      const fact = pool[Math.floor(Math.random() * pool.length)];
      if (!s.factsLearned.includes(fact) && !accumulated.facts.includes(fact)) {
        accumulated = { ...accumulated, facts: [...accumulated.facts, fact] };
      }
    }
  }

  const newReturnSol = s.awayTeam.returnSol + (choice.returnSolDelta || 0);
  const newAwayTeam = {
    ...s.awayTeam,
    currentStage: choice.nextStage ?? null,
    accumulated,
    deaths,
    returnSol:    newReturnSol
  };

  s = { ...s, awayTeam: newAwayTeam, activeModal: null };

  // All away-team crew dead → skip the rest of the chain, jump to reunion.
  const anyAlive = s.crew.some(c => crewIds.includes(c.id) && c.alive);
  if (!anyAlive) return returnAwayTeam(s);

  return s;
}

// ---- Return ----
// Packages the reunion modal. Does not yet apply rewards or awayTeam=null —
// that happens in finalizeReunion when the player acknowledges the modal.
export function returnAwayTeam(state) {
  if (!state.awayTeam) return state;
  const { waypointId, crewIds, accumulated, deaths } = state.awayTeam;
  const waypoint = WAYPOINTS.find(w => w.id === waypointId);

  const survivors = state.crew
    .filter(c => crewIds.includes(c.id) && c.alive)
    .map(c => ({ id: c.id, name: c.name, role: c.role, health: c.health }));
  const deadCrew = state.crew
    .filter(c => deaths.includes(c.id))
    .map(c => ({ id: c.id, name: c.name, role: c.role }));

  const summary = deadCrew.length
    ? `Away team reunited: ${survivors.length} back, ${deadCrew.length} lost.`
    : `Away team reunited: ${survivors.length} back, all present.`;

  return {
    ...state,
    log: [...state.log, { sol: state.sol, text: summary }],
    activeModal: {
      type: 'away_team_reunion',
      payload: {
        waypoint,
        survivors,
        deaths: deadCrew,
        sciencePoints: accumulated.sciencePoints,
        facts: [...accumulated.facts]
      }
    }
  };
}

// ---- Finalize (reunion modal acknowledged) ----
// corpseChoices: { [crewId]: 'bring' | 'leave' } — decides whether each
// fallen crew member's body is carried back (addCorpse) or left at the site.
export function finalizeReunion(state, corpseChoices = {}) {
  if (!state.awayTeam) return state;
  const { accumulated, deaths } = state.awayTeam;

  let s = {
    ...state,
    sciencePoints: state.sciencePoints + accumulated.sciencePoints
  };
  const newFacts = accumulated.facts.filter(f => !s.factsLearned.includes(f));
  if (newFacts.length) s = { ...s, factsLearned: [...s.factsLearned, ...newFacts] };

  for (const crewId of deaths) {
    if (corpseChoices[crewId] === 'bring') s = addCorpse(s, crewId);
  }

  const debriefText = accumulated.sciencePoints > 0
    ? `Away-team debrief: +${accumulated.sciencePoints} SCI recovered.`
    : 'Away-team debrief: no science recovered.';

  return {
    ...s,
    awayTeam:    null,
    activeModal: null,
    log: [...s.log, { sol: s.sol, text: debriefText }]
  };
}
