// Mars Trail — game state shape
// Pure data + factory. Mutations live in src/systems/.

import { rollWaypoints } from './systems/waypoints.js';
import { loadCareerScience, computeActiveBonuses } from './systems/career.js';
import { EVENTS } from './content/events.js';

const LANDMARK_NAMES = {
  jezero:       'Jezero Crater',
  syrtis:       'Syrtis Major',
  arabia:       'Arabia Terra',
  meridiani:    'Meridiani Planum',
  gale:         'Gale Crater',
  elysium:      'Elysium Planitia',
  tharsis:      'Tharsis Montes',
  olympus_base: 'Olympus Base'
};

const TREK_ROUTE = {
  ids:  ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
  kms:  [330, 420, 290, 360, 460, 315, 375]   // 7 segments, ~2550 km total
};

function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'r-' + Math.random().toString(36).slice(2, 10);
}

export function createInitialState() {
  const careerSci = loadCareerScience();
  const careerBonuses = computeActiveBonuses(careerSci);

  // If tier 5 is active, sample one non-one-shot event for briefing preview.
  let eventPreview = null;
  if (careerBonuses.eventPreview) {
    const pool = EVENTS.filter(e => !e.oneShot);
    if (pool.length) {
      eventPreview = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  const baseState = {
    schemaVersion: 1,
    runId: uuid(),
    scenario: 'trek',
    startedAt: Date.now(),
    sol: 1,
    status: 'active',          // 'active' | 'won' | 'lost'
    lossReason: null,

    // Geography
    route: TREK_ROUTE.ids,
    routeKm: TREK_ROUTE.kms,
    currentLandmarkIndex: 0,
    kmToNextLandmark: TREK_ROUTE.kms[0],
    totalKmTraveled: 0,

    // Resources. % values (except panels which is efficiency, and parts which
    // are discrete). Base levels are lower — supply loadout items bring them up.
    resources: {
      oxygen: 76,     // base; +8% per O₂ canister (default 3 = 100%)
      water:  76,     // base; +8% per H₂O tank (default 3 = 100%)
      power:  100,
      food:   76,     // base; +8% per ration pack (default 3 = 100%)
      panels: 100,
      mech: 4,
      eva:  4,
      cell: 3
    },

    // Crew (4 specialists + 1 security)
    crew: [
      { id:'c1', name:'Alex',  role:'engineer',  health:100, status:'healthy', alive:true },
      { id:'c2', name:'Riya',  role:'biologist', health:100, status:'healthy', alive:true },
      { id:'c3', name:'Tomás', role:'medic',     health:100, status:'healthy', alive:true },
      { id:'c4', name:'Mei',   role:'pilot',     health:100, status:'healthy', alive:true },
      { id:'c5', name:'Sam',   role:'security',  health:100, status:'healthy', alive:true }
    ],

    // Run choices
    pace:    'steady',     // 'cautious' | 'steady' | 'push'
    rations: 'standard',   // 'meager' | 'standard' | 'full'

    // Score & log
    sciencePoints: 0,
    factsLearned: [],
    firedEvents: [],   // IDs of one-shot events already triggered this run
    waypoints:       [],    // [{ waypointId, segmentIdx }] — rolled at run start
    pendingWaypoint: null,  // full waypoint object while detour is in progress
    firedWaypoints:  [],    // ids already resolved or declined
    corpses:         [],    // [{ crewId, weightLbs }] — bodies carried, count toward cargoPounds
    log: [
      { sol: 1, text: 'Mission begins. Crew nominal. Departing Jezero Crater.' }
    ],

    // Career science (cross-run progression).
    careerSci,
    careerBonuses,
    eventPreview,

    // UI ephemeral — open with the title screen, then briefing, then loadout.
    activeModal: { type: 'title' }
  };
  return rollWaypoints(baseState);
}

// Cargo budget / loadout constants shared between state and UI.
export const CARGO_BUDGET = 20;    // cargo hold slots
export const CARGO_MAX_LBS = 600;  // full hold — 100% weight on display

// Each item has: slot cost (1), mass in pounds, and either a supply conversion
// (consumed at mission start into resources) or persistent parts count.
export const PART_TYPES = [
  { key: 'rations', label: 'FOOD', default: 3, lbs: 8,
    name:  'Ration Packs',
    desc:  'Vacuum-packed rations. 8 LB each.',
    supply: { resource: 'food', perUnit: 8 } },
  { key: 'h2o', label: 'H₂O', default: 3, lbs: 40,
    name:  'Water Tanks',
    desc:  'Pressurized H₂O. 40 LB each.',
    supply: { resource: 'water', perUnit: 8 } },
  { key: 'o2', label: 'O₂', default: 3, lbs: 20,
    name:  'Oxygen Canisters',
    desc:  'Compressed O₂. 20 LB each.',
    supply: { resource: 'oxygen', perUnit: 8 } },
  { key: 'mech', label: 'MECH', default: 4, lbs: 30,
    name:  'Mechanical Parts',
    desc:  'Bearings, gears, drill bits. 30 LB each.' },
  { key: 'eva',  label: 'EVA', default: 4, lbs: 12,
    name:  'EVA Supplies',
    desc:  'Patches, tethers, O₂ lines. 12 LB each.' },
  { key: 'cell', label: 'CELL', default: 3, lbs: 80,
    name:  'Power Cells',
    desc:  'Battery modules. 80 LB each. REPAIR consumes one.' }
];

export function landmarkName(id) {
  return LANDMARK_NAMES[id] || id;
}

// Pretty role short-codes used in the crew panel
export const ROLE_CODE = {
  engineer:  'ENG',
  biologist: 'BIO',
  medic:     'MED',
  pilot:     'PIL',
  security:  'SEC'
};

export const RESOURCE_LABELS = {
  oxygen: 'O₂',
  water:  'H₂O',
  power:  'PWR',
  food:   'FOOD',
  panels: 'PANELS',
  mech:   'MECH',
  eva:    'EVA',
  cell:   'CELL'
};
