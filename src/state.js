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
  kms:  [220, 280, 195, 240, 305, 210, 250]   // 7 segments between 8 landmarks
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

    // Resources (% except parts)
    resources: {
      oxygen: 100,
      water:  100,
      power:  100,
      food:   100,
      spareParts: 8
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

    // UI ephemeral
    activeModal: null
  };
}

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
  food:   'FOOD'
};
