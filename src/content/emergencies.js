// Mars Trail — emergency events (issue #63).
// Fired only when the click-metrics heuristic flags sustained mash-through
// behavior. Each event has exactly one "correct" choice whose clue is buried
// in the description text — the wrong choices are catastrophic. If the
// player is still mashing, they will almost certainly die. If they read
// carefully, survival is likely but not free.

export const EMERGENCIES = [
  {
    id: 'emer_cabin_breach',
    severity: 'emergency',
    oneShot: false,
    modal: {
      title: 'CABIN BREACH — SECTION 4',
      description:
        'Klaxons. Section 4 is venting atmosphere. Alex is already at the lockers, shouting: ' +
        '"The patch is in the GREEN locker. The red one is the oxygen bottle — if you grab that, ' +
        'it ruptures and we all die." Pressure drop warning. You have seconds.',
      choices: [
        {
          label: 'Grab the red locker',
          outcome: {
            oxygen: -35,
            crewDamage: { amount: 55 },
            narrative:
              'The oxygen bottle ruptures. Shrapnel and a pressure wave tear through the cabin. ' +
              'Crew take blunt-force injuries before the bulkhead seals.'
          }
        },
        {
          label: 'Grab the green locker',
          correct: true,
          outcome: {
            oxygen: -8,
            narrative:
              'You slap the patch over the breach. Hull holds. Atmospherics stabilize after a long minute.'
          }
        },
        {
          label: 'Suit up first and re-assess',
          outcome: {
            oxygen: -22,
            crewDamage: { amount: 25 },
            narrative:
              'Too slow. Half the cabin vents before the patch goes on. Crew take decompression injuries.'
          }
        }
      ]
    }
  },

  {
    id: 'emer_reactor_anomaly',
    severity: 'emergency',
    oneShot: false,
    modal: {
      title: 'REACTOR — FLUX EXCURSION',
      description:
        'Power core warning. Mei reads the board out loud: "Neutron flux climbing. Manual override ' +
        'is the LEFT handle. Do NOT pull the right handle — that dumps the coolant and we lose the core ' +
        'for the rest of the run." You can hear the shielding ticking.',
      choices: [
        {
          label: 'Pull the right handle',
          outcome: {
            power: -45,
            cell: -2,
            narrative:
              'Coolant dumps. The core scrams cold and half your stored charge bleeds away trying to stabilize the bus.'
          }
        },
        {
          label: 'Pull the left handle',
          correct: true,
          outcome: {
            power: -10,
            narrative:
              'Override engages. Flux drops into the green. A scare, nothing more.'
          }
        },
        {
          label: 'Shut it all down and wait',
          outcome: {
            power: -28,
            crewDamage: { amount: 18 },
            narrative:
              'The flux keeps climbing while you stall. Shielding barely holds. Crew take a radiation dose before it settles.'
          }
        }
      ]
    }
  },

  {
    id: 'emer_dust_nav',
    severity: 'emergency',
    oneShot: false,
    modal: {
      title: 'NAV BLACKOUT — DUST STORM',
      description:
        'Primary nav cuts out mid-drive. Tomás is hunched over the backup chart: "Cliff two hundred meters ' +
        'ahead on the current heading. Swing WEST along the ridge — NOT east, east drops into a boulder field. ' +
        'West, now." Visibility is nothing.',
      choices: [
        {
          label: 'Hold heading',
          outcome: {
            mech: -2,
            crewDamage: { amount: 45 },
            narrative:
              'Rover tips over the cliff edge. Three crew take blunt-force trauma before the roll cage arrests the tumble.'
          }
        },
        {
          label: 'Swing east',
          outcome: {
            mech: -1,
            crewDamage: { amount: 20 },
            narrative:
              'East slope is worse. Rover slams a boulder and slides. Minor injuries, bent chassis.'
          }
        },
        {
          label: 'Swing west',
          correct: true,
          outcome: {
            power: -6,
            narrative:
              'Ridge holds. You crawl down through the dust, comms garbled, until the storm passes.'
          }
        }
      ]
    }
  }
];

// Pick an emergency event at random. Pure function.
export function pickEmergency() {
  return EMERGENCIES[Math.floor(Math.random() * EMERGENCIES.length)];
}
