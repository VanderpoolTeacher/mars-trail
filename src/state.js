// Mars Trail — game state shape
// Pure data + factory. Mutations live in src/systems/.

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
  return {
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

    // Resources (% except parts; parts are discrete by type)
    // Default loadout — player can rebalance in the pre-mission loadout modal.
    resources: {
      oxygen: 100,
      water:  100,
      power:  100,
      food:   100,
      panels: 100,   // solar panel efficiency 0-100; multiplies solar recharge
      mech: 4,
      eva:  3,
      cell: 3
    },

    // Crew (4 specialists + 2 security)
    crew: [
      { id:'c1', name:'Alex',   role:'engineer',  health:100, status:'healthy', alive:true },
      { id:'c2', name:'Riya',   role:'biologist', health:100, status:'healthy', alive:true },
      { id:'c3', name:'Tomás',  role:'medic',     health:100, status:'healthy', alive:true },
      { id:'c4', name:'Mei',    role:'pilot',     health:100, status:'healthy', alive:true },
      { id:'c5', name:'Sam',    role:'security',  health:100, status:'healthy', alive:true },
      { id:'c6', name:'Jordan', role:'security',  health:100, status:'healthy', alive:true }
    ],

    // Run choices
    pace:    'steady',     // 'cautious' | 'steady' | 'push'
    rations: 'standard',   // 'meager' | 'standard' | 'full'

    // Score & log
    sciencePoints: 0,
    factsLearned: [],
    log: [
      { sol: 1, text: 'Mission begins. Crew nominal. Departing Jezero Crater.' }
    ],

    // UI ephemeral — open with the mission briefing, then the loadout picker.
    activeModal: { type: 'briefing' }
  };
}

// Cargo budget / loadout constants shared between state and UI.
export const CARGO_BUDGET = 10;
export const PART_TYPES = [
  { key: 'mech', label: 'MECH',
    name:  'Mechanical Parts',
    desc:  'Bearings, gears, drill bits. Rover repair, mining, most events.' },
  { key: 'eva',  label: 'EVA',
    name:  'EVA Supplies',
    desc:  'Patches, tethers, O₂ lines. External work, climbs, cave descents.' },
  { key: 'cell', label: 'CELL',
    name:  'Power Cells',
    desc:  'Battery modules. Consumed by REPAIR to restore +25% PWR.' }
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
