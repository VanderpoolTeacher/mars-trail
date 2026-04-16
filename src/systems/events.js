// Mars Trail — random event roller + outcome applier
// Pure functions over state.

import { EVENTS } from '../content/events.js';
import { applyDamage, checkAllDead, deriveStatus } from './crew.js';
import {
  GEOLOGY_FACTS, WATER_FACTS, ATMOSPHERE_FACTS, ASTROBIOLOGY_FACTS,
  RADIATION_FACTS, MISSIONS_FACTS, HUMAN_EXPLORATION_FACTS,
  ASTRONOMY_FROM_MARS_FACTS, getRandomFact
} from '../content/marsFacts.js';

const FACT_POOLS = {
  GEOLOGY:           GEOLOGY_FACTS,
  WATER:             WATER_FACTS,
  ATMOSPHERE:        ATMOSPHERE_FACTS,
  ASTROBIOLOGY:      ASTROBIOLOGY_FACTS,
  RADIATION:         RADIATION_FACTS,
  MISSIONS:          MISSIONS_FACTS,
  HUMAN_EXPLORATION: HUMAN_EXPLORATION_FACTS,
  ASTRONOMY:         ASTRONOMY_FROM_MARS_FACTS
};

const EVENT_BASE_RATE = 0.50;   // P(event per sol). Will move to scenarios.js later.

// Pick a random event using weighted selection. Returns an event object or null.
export function rollEvent(state) {
  if (Math.random() > EVENT_BASE_RATE) return null;
  const totalWeight = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return EVENTS[EVENTS.length - 1];   // fallback (floating-point edges)
}

// Resolve a chosen event option.
// Returns { state, resolution } where resolution describes what happened
// for the outcome screen: { choice, outcome, skillResult?, damageTarget? }.
export function applyEventChoice(state, event, choiceIdx) {
  const choice = event.modal.choices[choiceIdx];
  if (!choice) return { state, resolution: null };

  let outcome    = choice.outcome;
  let skillResult = null;

  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const effectiveP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const success = Math.random() < effectiveP;
    outcome = success ? choice.successOutcome : choice.failOutcome;
    skillResult = { role, success, specialistAlive, effectiveP };
  }

  // Resolve factCategory → a concrete fact string from the pool.
  let resolvedOutcome = outcome;
  if (outcome && outcome.factCategory) {
    const pool = FACT_POOLS[outcome.factCategory];
    const fact = pool ? getRandomFact(pool) : '';
    resolvedOutcome = { ...outcome, fact };
  }

  const { state: s, damageTarget } = applyOutcome(state, resolvedOutcome);

  // If the resolved outcome includes a Mars fact, log and remember it.
  if (resolvedOutcome && resolvedOutcome.fact) {
    s.log.push({ sol: s.sol, text: `Data logged: ${resolvedOutcome.fact}` });
    if (!s.factsLearned.includes(resolvedOutcome.fact)) {
      s.factsLearned = [...s.factsLearned, resolvedOutcome.fact];
    }
  }

  // Append a log entry summarizing the resolution.
  const checkLabel = skillResult
    ? ` (${skillResult.role} check: ${skillResult.success ? 'success' : 'failed'})`
    : '';
  s.log = [...s.log, {
    sol: s.sol,
    text: `${event.modal.title} → ${choice.label}${checkLabel}.`
  }];

  // Clear the modal and check post-outcome loss conditions.
  s.activeModal = null;
  if (s.resources.oxygen === 0 && s.status === 'active') {
    s.status = 'lost';
    s.lossReason = 'no_oxygen';
    s.log.push({ sol: s.sol, text: 'Oxygen tanks depleted. Mission lost.' });
  }

  return {
    state: s,
    resolution: { event, choice, outcome: resolvedOutcome, skillResult, damageTarget }
  };
}

// Apply a single outcome object (resource deltas, science, crew damage).
// Returns { state, damageTarget } so the caller can describe what happened.
function applyOutcome(state, outcome) {
  if (!outcome) return { state, damageTarget: null };
  let s = {
    ...state,
    resources: { ...state.resources },
    log: [...state.log]
  };

  if (typeof outcome.oxygen        === 'number') s.resources.oxygen     = clamp(s.resources.oxygen     + outcome.oxygen,     0, 200);
  if (typeof outcome.water         === 'number') s.resources.water      = clamp(s.resources.water      + outcome.water,      0, 200);
  if (typeof outcome.power         === 'number') s.resources.power      = clamp(s.resources.power      + outcome.power,      0, 200);
  if (typeof outcome.food          === 'number') s.resources.food       = clamp(s.resources.food       + outcome.food,       0, 200);
  if (typeof outcome.panels        === 'number') s.resources.panels     = clamp(s.resources.panels     + outcome.panels,     0, 100);
  if (typeof outcome.mech          === 'number') s.resources.mech       = Math.max(0, s.resources.mech + outcome.mech);
  if (typeof outcome.eva           === 'number') s.resources.eva        = Math.max(0, s.resources.eva  + outcome.eva);
  if (typeof outcome.cell          === 'number') s.resources.cell       = Math.max(0, s.resources.cell + outcome.cell);
  if (typeof outcome.sciencePoints === 'number') s.sciencePoints        = Math.max(0, s.sciencePoints  + outcome.sciencePoints);

  // Crew healing (e.g., rest at a landmark). Heals all alive crew.
  if (typeof outcome.crewHeal === 'number' && outcome.crewHeal > 0) {
    s.crew = s.crew.map(c => {
      if (!c.alive) return c;
      const newHealth = clamp(c.health + outcome.crewHeal, 0, 100);
      return { ...c, health: newHealth, status: deriveStatus(newHealth) };
    });
  }

  let damageTarget = null;
  if (outcome.crewDamage) {
    const { role, amount } = outcome.crewDamage;
    const result = applyDamage(s, role || null, amount, 'event injuries');
    s = result.state;
    if (result.target) {
      damageTarget = {
        name:   result.target.name,
        role:   result.target.role,
        amount: result.dealt,
        died:   result.died
      };
    }
  }

  s = checkAllDead(s);
  return { state: s, damageTarget };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
