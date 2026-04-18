// Mars Trail — multi-stage event pool (issue #17 prerequisite).
// Events with branching stages. Engine in src/systems/multiStage.js.

export const MULTI_STAGE_EVENTS = [
  {
    id:         'drill_bit_seized',
    multiStage: true,
    weight:     4,
    severity:   'moderate',
    oneShot:    true,
    startStage: 'discover',
    stages: {
      discover: {
        title:       'Drill Bit Seized',
        description: 'Regolith drill bound up mid-sample. Motor housing climbing toward thermal cutoff. Clock is live.',
        choices: [
          { label:     'Attempt hot-swap (engineer on station)',
            outcome:   {},
            nextStage: 'swap_attempt' },
          { label:     'Bypass the drill, limp on',
            outcome:   { power: -10, mech: -1 },
            nextStage: null }
        ]
      },
      swap_attempt: {
        title:       'Replacing the Bit',
        description: 'Motor still hot. Engineer is gloved up, new bit in hand. Go or wait?',
        choices: [
          { label:          'Swap now — engineer check',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { mech: -1, sciencePoints: 10 },
            failOutcome:    { mech: -2, crewDamage: { role: 'engineer', amount: 15 } },
            nextStage:      null },
          { label:     'Let it cool — sit for 2 sols',
            outcome:   { oxygen: -3, water: -3, food: -3 },
            nextStage: null }
        ]
      }
    }
  }
];
