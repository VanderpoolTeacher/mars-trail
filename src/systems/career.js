// Mars Trail — cross-run career science progression (issue #13).
// Pure module. localStorage reads/writes isolated here; game systems
// consume the flat `bonuses` object via defensive reads.

const CAREER_KEY = 'marsTrail.careerScience';

export const CAREER_TIERS = [
  { minSci:   0, id: 'rookie',          name: 'Rookie',
    description: 'No bonuses yet.',
    effect: {} },
  { minSci:  30, id: 'calibration',     name: 'Calibration Data Analysis',
    description: 'Waypoint offers show exact reward estimates.',
    effect: { exactWaypointReward: true } },
  { minSci: 100, id: 'navigation',      name: 'Navigation Pattern Analysis',
    description: 'Rover base km/sol +5% at every pace.',
    effect: { kmMult: 1.05 } },
  { minSci: 225, id: 'methodology',     name: 'Field Methodology Training',
    description: 'Skill-check success +10 percentage points across all events.',
    effect: { skillBonus: 0.10 } },
  { minSci: 400, id: 'life_support',    name: 'Life-Support Optimization',
    description: 'O₂ and H₂O consumption −10% at every pace.',
    effect: { lifeSupportMult: 0.90 } },
  { minSci: 700, id: 'intel_synthesis', name: 'Mission Intel Synthesis',
    description: 'One upcoming event previewed on the briefing screen each run.',
    effect: { eventPreview: true } }
];

// ---- Persistence ----

export function loadCareerScience() {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addCareerScience(runState) {
  const earned = runState.sciencePoints || 0;
  let credit;
  if (runState.status === 'won') {
    credit = earned;
  } else {
    const frac = 0.2 + Math.random() * 0.4;
    credit = Math.floor(earned * frac);
  }
  const current = loadCareerScience();
  const total = current + credit;
  try {
    localStorage.setItem(CAREER_KEY, String(total));
  } catch { /* quota/disabled — silent */ }
  return { credit, total };
}

// ---- Tier computation ----

export function computeActiveBonuses(careerSci) {
  const bonuses = {};
  for (const tier of CAREER_TIERS) {
    if (careerSci >= tier.minSci) Object.assign(bonuses, tier.effect);
  }
  return bonuses;
}

export function nextTier(careerSci) {
  return CAREER_TIERS.find(t => t.minSci > careerSci) || null;
}

export function currentTier(careerSci) {
  let earned = CAREER_TIERS[0];
  for (const tier of CAREER_TIERS) {
    if (careerSci >= tier.minSci) earned = tier;
  }
  return earned;
}
