// Mars Trail — emergency events (issue #63).
// Multi-stage scenarios fired only when the click-metrics heuristic flags
// sustained mash-through behavior. In each stage, the correct option is
// spelled out in the description text; the wrong choices are catastrophic
// (stage-1 wrong ends the scenario immediately with heavy losses).
// A reader who slows down and pays attention can survive; a masher almost
// certainly cannot.

export const EMERGENCIES = [

  // ── 1. Cabin breach ────────────────────────────────────────────────
  {
    id: 'emer_cabin_breach',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'breach',
    stages: {
      breach: {
        title: 'CABIN BREACH — SECTION 4',
        description:
          'Klaxons. Section 4 is venting atmosphere. Alex is already at the lockers, shouting: ' +
          '"The patch is in the GREEN locker. The red one is the oxygen bottle — if you grab that ' +
          'one it ruptures and we lose the cabin." Pressure drop warning. You have seconds.',
        choices: [
          { label: 'Grab the red locker',
            outcome: {
              oxygen: -35, crewDamage: { amount: 55 },
              narrative: 'The oxygen bottle ruptures. Shrapnel tears through the cabin before the bulkhead seals.'
            }, nextStage: null },
          { label: 'Grab the green locker', correct: true,
            outcome: { oxygen: -6, narrative: 'Patch on. Now the weld.' },
            nextStage: 'weld' },
          { label: 'Suit up first and re-assess',
            outcome: {
              oxygen: -22, crewDamage: { amount: 25 },
              narrative: 'Too slow. Half the cabin vents before you get the patch on. Crew take decompression injuries.'
            }, nextStage: null }
        ]
      },
      weld: {
        title: 'SEAL THE BREACH',
        description:
          'Patch is on but weeping. Riya at the scrubber console: "Cycle the O₂ scrubbers to MAX before ' +
          'you strike the torch — sparks in high-O₂ atmosphere will ignite the seals. MAX first, then weld."',
        choices: [
          { label: 'Strike the torch now',
            outcome: {
              oxygen: -18, crewDamage: { amount: 30 },
              narrative: 'Flash-fire. Two crew take burn injuries before the halon kicks in.'
            }, nextStage: null },
          { label: 'Scrubbers to MAX, then weld', correct: true,
            outcome: { oxygen: -4, narrative: 'Weld holds. Atmospherics stabilize.' },
            nextStage: null },
          { label: 'Skip the weld — let the patch ride',
            outcome: {
              oxygen: -12,
              narrative: 'Seal leaks for the rest of the sol. You lose atmosphere until a later repair.'
            }, nextStage: null }
        ]
      }
    }
  },

  // ── 2. Reactor flux excursion ──────────────────────────────────────
  {
    id: 'emer_reactor_flux',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'handle',
    stages: {
      handle: {
        title: 'REACTOR — FLUX EXCURSION',
        description:
          'Power core warning. Mei reads the board: "Neutron flux climbing. Manual override is the LEFT ' +
          'handle. Do NOT pull the right handle — that dumps the coolant and we lose the core for the run." ' +
          'Shielding is ticking.',
        choices: [
          { label: 'Pull the right handle',
            outcome: {
              power: -45, cell: -2,
              narrative: 'Coolant dumps. Core cold-scrams; stored charge bleeds trying to hold the bus.'
            }, nextStage: null },
          { label: 'Pull the left handle', correct: true,
            outcome: { power: -5, narrative: 'Override engages. Flux drops. Now bleed the poisons out.' },
            nextStage: 'rods' },
          { label: 'Shut everything down and wait',
            outcome: {
              power: -28, crewDamage: { amount: 18 },
              narrative: 'Flux keeps climbing while you stall. Shielding barely holds. Crew take a dose.'
            }, nextStage: null }
        ]
      },
      rods: {
        title: 'FLUSH THE POISONS',
        description:
          'Flux is down but xenon is accumulating. Mei at the control panel: "Drop control rods THIRTY ' +
          'percent — not sixty. Sixty kills the core and we run on panels for the rest of the trip."',
        choices: [
          { label: 'Drop rods 60%',
            outcome: {
              power: -35, cell: -1,
              narrative: 'Core goes subcritical. The rover limps on panels alone.'
            }, nextStage: null },
          { label: 'Drop rods 30%', correct: true,
            outcome: { power: -6, narrative: 'Xenon burns off. Core stable.' },
            nextStage: null },
          { label: 'Leave the rods alone',
            outcome: {
              power: -20,
              narrative: 'Xenon poisons the core overnight. Half the output for a day before it clears.'
            }, nextStage: null }
        ]
      }
    }
  },

  // ── 3. Nav blackout / dust storm ───────────────────────────────────
  {
    id: 'emer_dust_nav',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'heading',
    stages: {
      heading: {
        title: 'NAV BLACKOUT — DUST STORM',
        description:
          'Primary nav cuts out mid-drive. Tomás on the backup chart: "Cliff two hundred meters ahead ' +
          'on current heading. Swing WEST along the ridge — NOT east, east drops into a boulder field. ' +
          'West. Now."',
        choices: [
          { label: 'Hold heading',
            outcome: {
              mech: -2, crewDamage: { amount: 45 },
              narrative: 'Rover tips over the cliff. Roll cage arrests the tumble; three crew hurt.'
            }, nextStage: null },
          { label: 'Swing east',
            outcome: {
              mech: -1, crewDamage: { amount: 20 },
              narrative: 'East slope is worse. Rover slams a boulder. Minor injuries, bent chassis.'
            }, nextStage: null },
          { label: 'Swing west', correct: true,
            outcome: { power: -4, narrative: 'Ridge holds. Now re-establish comms.' },
            nextStage: 'relay' }
        ]
      },
      relay: {
        title: 'RAISE THE RELAY',
        description:
          'Through the ridge, dust thinning. Tomás: "Use the LONG passphrase from briefing — the short ' +
          'one is an old decoy left in the log. Long unlock first, then ping Earth."',
        choices: [
          { label: 'Enter the short passphrase',
            outcome: {
              power: -8, sciencePoints: -5,
              narrative: 'Decoy triggers lockout. Two sols of comms blackout; one data cache lost.'
            }, nextStage: null },
          { label: 'Enter the long passphrase', correct: true,
            outcome: { power: -3, narrative: 'Relay live. Earth acknowledges.' },
            nextStage: null },
          { label: 'Skip it, drive through quiet',
            outcome: { power: -6, narrative: 'No comms for a sol. Minor navigation drift until uplink is restored.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 4. NEW: Airlock jam with crew outside ──────────────────────────
  {
    id: 'emer_airlock_jam',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'vent',
    stages: {
      vent: {
        title: 'AIRLOCK JAMMED — SAM OUTSIDE',
        description:
          'Outer seal stuck. Sam is on tether, O₂ bleeding. Alex at the panel: "Cycle the MANUAL vent ' +
          'three times — do NOT hit the emergency purge. Purge blows the hatch outward and takes Sam ' +
          'with it. Manual vent, three cycles, now."',
        choices: [
          { label: 'Emergency purge',
            outcome: {
              oxygen: -20, crewDamage: { role: 'security', amount: 80 },
              narrative: 'Hatch blows. Sam takes the full decompression; tether holds but barely.'
            }, nextStage: null },
          { label: 'Manual vent, three cycles', correct: true,
            outcome: { oxygen: -4, narrative: 'Seal breaks. Sam is stumbling through the inner hatch.' },
            nextStage: 'stabilize' },
          { label: 'Call Sam to re-tether and wait',
            outcome: {
              oxygen: -10, crewDamage: { role: 'security', amount: 35 },
              narrative: 'Sam runs out of O₂ on the tether before you can re-cycle. Brain-hypoxia injury.'
            }, nextStage: null }
        ]
      },
      stabilize: {
        title: 'STABILIZE SAM',
        description:
          'Sam is in, unconscious. Tomás readies the kit: "Blue injector FIRST — it opens the airway. ' +
          'Then oxygen. Reverse the order and you trigger a seizure."',
        choices: [
          { label: 'Oxygen first, then blue injector',
            outcome: {
              crewDamage: { role: 'security', amount: 40 },
              narrative: 'Seizure. Sam survives, but with lasting damage.'
            }, nextStage: null },
          { label: 'Blue injector first, then oxygen', correct: true,
            outcome: { crewDamage: { role: 'security', amount: 8 }, narrative: 'Airway opens. Sam stabilizes.' },
            nextStage: null },
          { label: 'Skip the injector — O₂ should be enough',
            outcome: {
              crewDamage: { role: 'security', amount: 25 },
              narrative: 'Airway stays half-closed. Sam gets enough O₂ to live but coughs blood for a sol.'
            }, nextStage: null }
        ]
      }
    }
  },

  // ── 5. NEW: Radiation storm spike ──────────────────────────────────
  {
    id: 'emer_radiation_storm',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'shelter',
    stages: {
      shelter: {
        title: 'RADIATION STORM — INCOMING',
        description:
          'Flare alert. Mei over the intercom: "Head to the STARBOARD shelter — the port shelter\'s ' +
          'lead liner cracked last week. Starboard. Not port. Starboard."',
        choices: [
          { label: 'Run to the port shelter',
            outcome: {
              crewDamage: { amount: 50 },
              narrative: 'Liner leaks. Half the crew take a heavy dose before you relocate.'
            }, nextStage: null },
          { label: 'Run to the starboard shelter', correct: true,
            outcome: { power: -3, narrative: 'Shielding holds. Now wait it out.' },
            nextStage: 'wait' },
          { label: 'Shelter in the rover cab instead',
            outcome: {
              crewDamage: { amount: 25 },
              narrative: 'Cab shielding is thin. Crew dose is manageable but will cost you later.'
            }, nextStage: null }
        ]
      },
      wait: {
        title: 'WAIT OUT THE FLARE',
        description:
          'Dosimeters flickering. Tomás: "We wait NINETY minutes — not forty-five. Early exit kills the ' +
          'bone marrow. Ninety. Even if it feels fine."',
        choices: [
          { label: 'Exit at 45 minutes',
            outcome: {
              crewDamage: { amount: 35 },
              narrative: 'Secondary flare catches the crew in the open. Marrow damage; HP loss across the roster.'
            }, nextStage: null },
          { label: 'Wait 90 minutes', correct: true,
            outcome: { water: -4, food: -4, narrative: 'Flare passes. Everyone out healthy. Morale hit, but alive.' },
            nextStage: null },
          { label: 'Wait indefinitely to be safe',
            outcome: {
              water: -10, food: -10, oxygen: -8,
              narrative: 'Extra hours burn resources you needed for the next leg.'
            }, nextStage: null }
        ]
      }
    }
  },

  // ── 6. NEW: Software lockup (nav freeze) ───────────────────────────
  {
    id: 'emer_software_lockup',
    multiStage: true,
    severity: 'emergency',
    oneShot: false,
    startStage: 'reboot',
    stages: {
      reboot: {
        title: 'SOFTWARE LOCKUP — CONTROL FROZEN',
        description:
          'Main control unresponsive. Alex working the diagnostic: "WARM reboot — hold the AMBER key ' +
          'for ten seconds. Do NOT hit the red key — that cold-boots us and wipes the waypoint cache."',
        choices: [
          { label: 'Hit the red key',
            outcome: {
              sciencePoints: -10, power: -8,
              narrative: 'Cold boot. Waypoint cache scrubbed. You lose a batch of cached science.'
            }, nextStage: null },
          { label: 'Hold the amber key ten seconds', correct: true,
            outcome: { power: -2, narrative: 'Warm reboot. Systems coming back. One more step.' },
            nextStage: 'autopilot' },
          { label: 'Pull the battery and wait',
            outcome: {
              power: -15,
              narrative: 'Hard shutdown. Boot takes the better part of an hour.'
            }, nextStage: null }
        ]
      },
      autopilot: {
        title: 'RE-ENABLE AUTOPILOT',
        description:
          'Control back. Riya from the copilot seat: "Disable motion-learning BEFORE you re-arm autopilot. ' +
          'If autopilot ingests the garbage from the freeze window, it\'ll steer us sideways for a sol."',
        choices: [
          { label: 'Re-arm autopilot as-is',
            outcome: {
              mech: -1, power: -10,
              narrative: 'Autopilot corrects for phantom obstacles all sol. Drift costs you distance.'
            }, nextStage: null },
          { label: 'Disable motion-learning, then re-arm', correct: true,
            outcome: { power: -2, narrative: 'Clean re-arm. Rover runs straight.' },
            nextStage: null },
          { label: 'Drive manual the rest of the sol',
            outcome: {
              crewDamage: { role: 'pilot', amount: 10 },
              narrative: 'Long shift in the seat. Mei takes a neck strain but the trip is uneventful.'
            }, nextStage: null }
        ]
      }
    }
  }
];

// Pick an emergency event at random. Pure function.
export function pickEmergency() {
  return EMERGENCIES[Math.floor(Math.random() * EMERGENCIES.length)];
}
