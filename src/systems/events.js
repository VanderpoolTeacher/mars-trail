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

const EVENT_BASE_RATE = 0.65;   // P(event per sol). Will move to scenarios.js later.

// Pick a random event using weighted selection. One-shot events that have
// already fired this run are filtered out. Returns an event object or null.
export function rollEvent(state) {
  if (Math.random() > EVENT_BASE_RATE) return null;
  const fired = state.firedEvents || [];
  const eligible = EVENTS.filter(e => !(e.oneShot && fired.includes(e.id)));
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of eligible) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return eligible[eligible.length - 1];
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

  let { state: s, damageTarget, applied } = applyOutcome(state, resolvedOutcome);

  // Resolve dialogue (if present) to the matching alive crew member and
  // pin it on state.crewDialogue — crew panel will show a bubble until
  // the next advanceSol clears it.
  if (resolvedOutcome && resolvedOutcome.dialogue) {
    const dlg = resolvedOutcome.dialogue;
    const speaker = s.crew.find(c => c.role === dlg.role && c.alive);
    if (speaker) {
      s = {
        ...s,
        crewDialogue: { crewId: speaker.id, name: speaker.name, text: dlg.text }
      };
    }
  }

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
    resolution: { event, choice, outcome: resolvedOutcome, applied, skillResult, damageTarget }
  };
}

// Jitter a numeric value by ±varianceFraction. Rarely rolls a "catastrophe"
// (8% chance) that amplifies the negative by 1.8x, simulating a complication.
const VARIANCE_FRACTION = 0.25;
const CATASTROPHE_CHANCE = 0.08;
const CATASTROPHE_MULT = 1.8;

function jitter(value) {
  const jitterAmount = (Math.random() * 2 - 1) * VARIANCE_FRACTION;
  let result = value * (1 + jitterAmount);
  // Catastrophe only amplifies negative values (bad luck gets worse).
  if (value < 0 && Math.random() < CATASTROPHE_CHANCE) {
    result *= CATASTROPHE_MULT;
  }
  return Math.round(result);
}

// Apply a single outcome object (resource deltas, science, crew damage).
// Returns { state, damageTarget, applied } — `applied` holds the actual
// jittered values so callers can show real numbers in the outcome modal.
function applyOutcome(state, outcome) {
  if (!outcome) return { state, damageTarget: null, applied: {} };
  let s = {
    ...state,
    resources: { ...state.resources },
    log: [...state.log]
  };

  const applied = {};
  let catastrophe = false;
  const jitterAndTrack = (v) => {
    const j = jitter(v);
    if (v < 0 && j < v * 1.5) catastrophe = true;   // detect amplified bad roll
    return j;
  };

  if (typeof outcome.oxygen === 'number') { applied.oxygen = jitterAndTrack(outcome.oxygen); s.resources.oxygen = clamp(s.resources.oxygen + applied.oxygen, 0, 100); }
  if (typeof outcome.water  === 'number') { applied.water  = jitterAndTrack(outcome.water);  s.resources.water  = clamp(s.resources.water  + applied.water,  0, 100); }
  if (typeof outcome.power  === 'number') { applied.power  = jitterAndTrack(outcome.power);  s.resources.power  = clamp(s.resources.power  + applied.power,  0, 100); }
  if (typeof outcome.food   === 'number') { applied.food   = jitterAndTrack(outcome.food);   s.resources.food   = clamp(s.resources.food   + applied.food,   0, 100); }
  if (typeof outcome.panels === 'number') { applied.panels = jitterAndTrack(outcome.panels); s.resources.panels = clamp(s.resources.panels + applied.panels, 0, 100); }

  // Discrete parts don't jitter (can't have half a bearing).
  if (typeof outcome.mech === 'number') { applied.mech = outcome.mech; s.resources.mech = Math.max(0, s.resources.mech + outcome.mech); }
  if (typeof outcome.eva  === 'number') { applied.eva  = outcome.eva;  s.resources.eva  = Math.max(0, s.resources.eva  + outcome.eva);  }
  if (typeof outcome.cell === 'number') { applied.cell = outcome.cell; s.resources.cell = Math.max(0, s.resources.cell + outcome.cell); }

  if (typeof outcome.sciencePoints === 'number') {
    applied.sciencePoints = jitter(outcome.sciencePoints);
    s.sciencePoints = Math.max(0, s.sciencePoints + applied.sciencePoints);
  }

  if (typeof outcome.crewHeal === 'number' && outcome.crewHeal > 0) {
    applied.crewHeal = Math.max(0, jitter(outcome.crewHeal));
    s.crew = s.crew.map(c => {
      if (!c.alive) return c;
      const newHealth = clamp(c.health + applied.crewHeal, 0, 100);
      return { ...c, health: newHealth, status: deriveStatus(newHealth) };
    });
  }

  let damageTarget = null;
  if (outcome.crewDamage) {
    const { role, amount } = outcome.crewDamage;
    const actualAmount = Math.max(0, jitter(-amount) * -1);  // amount is positive; jitter as -amount then flip
    if (amount > actualAmount * 1.5) catastrophe = true;
    const result = applyDamage(s, role || null, actualAmount, 'event injuries');
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

  if (catastrophe) {
    s.log = [...s.log, { sol: s.sol, text: 'Complication — the situation turned worse than expected.' }];
    applied.catastrophe = true;
  }

  s = checkAllDead(s);
  return { state: s, damageTarget, applied };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
