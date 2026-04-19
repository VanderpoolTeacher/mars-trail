// Mars Trail — emergency events (issue #63).
// Multi-stage scenarios fired only when the click-metrics heuristic flags
// sustained mash-through behavior.
//
// Each stage is a TEMPLATE: a description with {{slot}} placeholders, choice
// templates (labels also using placeholders), and a list of variants. At
// fire time we pick a fresh variant per stage and shuffle choice order so
// the player can't memorize the "right button" across runs. A reader who
// slows down and follows the clue survives; a masher almost certainly does
// not.

export const EMERGENCY_TEMPLATES = [

  // ── 1. Cabin breach ────────────────────────────────────────────────
  {
    id: 'emer_cabin_breach',
    severity: 'emergency',
    startStage: 'breach',
    stages: {
      breach: {
        title: 'CABIN BREACH — SECTION 4',
        descriptionTemplate:
          'Klaxons. Section 4 is venting atmosphere. Alex is already at the lockers, shouting: ' +
          '"The patch is in the {{correct}} locker. The {{wrong1}} one is the oxygen bottle — if you ' +
          'grab that it ruptures and we lose the cabin." Pressure drop warning. You have seconds.',
        variants: [
          { correct: 'GREEN',  wrong1: 'red',    wrong2: 'yellow' },
          { correct: 'BLUE',   wrong1: 'amber',  wrong2: 'grey'   },
          { correct: 'SILVER', wrong1: 'black',  wrong2: 'orange' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Grab the {{wrong1}} locker',
            outcome: { oxygen: -35, crewDamage: { amount: 55 },
              narrative: 'The oxygen bottle ruptures. Shrapnel tears through the cabin before the bulkhead seals.' },
            nextStage: null },
          { labelTemplate: 'Grab the {{correct}} locker', correct: true,
            outcome: { oxygen: -6, narrative: 'Patch on. Now the weld.' },
            nextStage: 'weld' },
          { labelTemplate: 'Grab the {{wrong2}} locker',
            outcome: { oxygen: -22, crewDamage: { amount: 25 },
              narrative: 'Wrong locker. Half the cabin vents before you get the right one out.' },
            nextStage: null }
        ]
      },
      weld: {
        title: 'SEAL THE BREACH',
        descriptionTemplate:
          'Patch is on but weeping. Riya at the scrubber console: "Cycle the O₂ scrubbers to {{correct}} ' +
          'before you strike the torch — sparks in a higher-O₂ atmosphere will ignite the seals. ' +
          '{{correct}} first, then weld. Not {{wrong1}}."',
        variants: [
          { correct: 'MAX',     wrong1: 'MIN',     wrong2: 'AUTO'    },
          { correct: 'LEVEL 3', wrong1: 'LEVEL 1', wrong2: 'STANDBY' },
          { correct: 'PURGE',   wrong1: 'IDLE',    wrong2: 'CYCLE'   }
        ],
        choiceTemplates: [
          { labelTemplate: 'Scrubbers to {{wrong1}}, then weld',
            outcome: { oxygen: -18, crewDamage: { amount: 30 },
              narrative: 'Flash-fire. Two crew take burn injuries before the halon kicks in.' },
            nextStage: null },
          { labelTemplate: 'Scrubbers to {{correct}}, then weld', correct: true,
            outcome: { oxygen: -4, narrative: 'Weld holds. Atmospherics stabilize.' },
            nextStage: null },
          { labelTemplate: 'Skip the weld — let the patch ride',
            outcome: { oxygen: -12,
              narrative: 'Seal leaks the rest of the sol. You bleed atmosphere until a later repair.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 2. Reactor flux excursion ──────────────────────────────────────
  {
    id: 'emer_reactor_flux',
    severity: 'emergency',
    startStage: 'handle',
    stages: {
      handle: {
        title: 'REACTOR — FLUX EXCURSION',
        descriptionTemplate:
          'Power core warning. Mei reads the board: "Neutron flux climbing. Manual override is the ' +
          '{{correct}} handle. Do NOT pull the {{wrong1}} handle — that dumps the coolant and we lose ' +
          'the core for the run." Shielding is ticking.',
        variants: [
          { correct: 'LEFT',  wrong1: 'RIGHT', wrong2: 'CENTER' },
          { correct: 'UPPER', wrong1: 'LOWER', wrong2: 'SIDE'   },
          { correct: 'NEAR',  wrong1: 'FAR',   wrong2: 'REAR'   }
        ],
        choiceTemplates: [
          { labelTemplate: 'Pull the {{wrong1}} handle',
            outcome: { power: -45, cell: -2,
              narrative: 'Coolant dumps. Core cold-scrams; stored charge bleeds trying to hold the bus.' },
            nextStage: null },
          { labelTemplate: 'Pull the {{correct}} handle', correct: true,
            outcome: { power: -5, narrative: 'Override engages. Flux drops. Now bleed the poisons out.' },
            nextStage: 'rods' },
          { labelTemplate: 'Pull the {{wrong2}} handle',
            outcome: { power: -25, crewDamage: { amount: 20 },
              narrative: 'Wrong handle. Flux spike holds long enough for crew to take a dose.' },
            nextStage: null }
        ]
      },
      rods: {
        title: 'FLUSH THE POISONS',
        descriptionTemplate:
          'Flux is down but xenon is accumulating. Mei at the control panel: "Drop control rods ' +
          '{{correct}} — not {{wrong1}}. {{wrong1}} kills the core and we run on panels for the rest ' +
          'of the trip."',
        variants: [
          { correct: '30%', wrong1: '60%', wrong2: '10%' },
          { correct: '25%', wrong1: '50%', wrong2: '75%' },
          { correct: '40%', wrong1: '80%', wrong2: '15%' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Drop rods {{wrong1}}',
            outcome: { power: -35, cell: -1,
              narrative: 'Core goes subcritical. The rover limps on panels alone.' },
            nextStage: null },
          { labelTemplate: 'Drop rods {{correct}}', correct: true,
            outcome: { power: -6, narrative: 'Xenon burns off. Core stable.' },
            nextStage: null },
          { labelTemplate: 'Drop rods {{wrong2}}',
            outcome: { power: -18,
              narrative: 'Too little. Xenon keeps climbing overnight. Half output for a sol.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 3. Nav blackout / dust storm ───────────────────────────────────
  {
    id: 'emer_dust_nav',
    severity: 'emergency',
    startStage: 'heading',
    stages: {
      heading: {
        title: 'NAV BLACKOUT — DUST STORM',
        descriptionTemplate:
          'Primary nav cuts out mid-drive. Tomás on the backup chart: "Cliff two hundred meters ahead ' +
          'on current heading. Swing {{correct}} along the ridge — NOT {{wrong1}}, {{wrong1}} drops ' +
          'into a boulder field. {{correct}}. Now."',
        variants: [
          { correct: 'WEST',  wrong1: 'east',  wrong2: 'south' },
          { correct: 'NORTH', wrong1: 'south', wrong2: 'east'  },
          { correct: 'UPHILL', wrong1: 'downhill', wrong2: 'straight' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Hold heading',
            outcome: { mech: -2, crewDamage: { amount: 45 },
              narrative: 'Rover tips over the cliff edge. Three crew take blunt-force trauma.' },
            nextStage: null },
          { labelTemplate: 'Swing {{wrong1}}',
            outcome: { mech: -1, crewDamage: { amount: 20 },
              narrative: 'Wrong side. Rover slams a boulder and slides. Minor injuries, bent chassis.' },
            nextStage: null },
          { labelTemplate: 'Swing {{correct}}', correct: true,
            outcome: { power: -4, narrative: 'Ridge holds. Now re-establish comms.' },
            nextStage: 'relay' }
        ]
      },
      relay: {
        title: 'RAISE THE RELAY',
        descriptionTemplate:
          'Through the ridge, dust thinning. Tomás: "Use the {{correct}} passphrase from briefing — ' +
          '{{wrong1}} is an old decoy left in the log. {{correct}} unlock first, then ping Earth."',
        variants: [
          { correct: 'LONG',    wrong1: 'short',   wrong2: 'legacy' },
          { correct: 'PRIMARY', wrong1: 'backup',  wrong2: 'test'   },
          { correct: 'SIGMA',   wrong1: 'OMEGA',   wrong2: 'THETA'  }
        ],
        choiceTemplates: [
          { labelTemplate: 'Enter the {{wrong1}} passphrase',
            outcome: { power: -8, sciencePoints: -5,
              narrative: 'Decoy triggers lockout. Two sols of comms blackout; one data cache lost.' },
            nextStage: null },
          { labelTemplate: 'Enter the {{correct}} passphrase', correct: true,
            outcome: { power: -3, narrative: 'Relay live. Earth acknowledges.' },
            nextStage: null },
          { labelTemplate: 'Skip it — drive through quiet',
            outcome: { power: -6,
              narrative: 'No comms for a sol. Minor nav drift until the uplink is restored.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 4. Airlock jam with crew outside ───────────────────────────────
  {
    id: 'emer_airlock_jam',
    severity: 'emergency',
    startStage: 'vent',
    stages: {
      vent: {
        title: 'AIRLOCK JAMMED — SAM OUTSIDE',
        descriptionTemplate:
          'Outer seal stuck. Sam is on tether, O₂ bleeding. Alex at the panel: "Cycle the {{correct}} ' +
          'vent three times — do NOT hit the {{wrong1}}. {{wrong1}} blows the hatch outward and takes ' +
          'Sam with it. {{correct}} vent. Three cycles. Now."',
        variants: [
          { correct: 'MANUAL',  wrong1: 'emergency purge', wrong2: 'override' },
          { correct: 'SECONDARY', wrong1: 'blast vent',   wrong2: 'primary'  },
          { correct: 'SLOW',    wrong1: 'full purge',     wrong2: 'rapid'    }
        ],
        choiceTemplates: [
          { labelTemplate: 'Hit the {{wrong1}}',
            outcome: { oxygen: -20, crewDamage: { role: 'security', amount: 80 },
              narrative: 'Hatch blows. Sam takes the full decompression; tether holds but barely.' },
            nextStage: null },
          { labelTemplate: '{{correct}} vent, three cycles', correct: true,
            outcome: { oxygen: -4, narrative: 'Seal breaks. Sam is stumbling through the inner hatch.' },
            nextStage: 'stabilize' },
          { labelTemplate: 'Hit the {{wrong2}}',
            outcome: { oxygen: -10, crewDamage: { role: 'security', amount: 35 },
              narrative: 'Sam runs out of O₂ on the tether before you cycle through. Brain-hypoxia injury.' },
            nextStage: null }
        ]
      },
      stabilize: {
        title: 'STABILIZE SAM',
        descriptionTemplate:
          'Sam is in, unconscious. Tomás readies the kit: "{{correct}} injector FIRST — it opens the ' +
          'airway. Then oxygen. Reverse the order and you trigger a seizure. {{correct}} before ' +
          'oxygen. Not {{wrong1}}."',
        variants: [
          { correct: 'BLUE',    wrong1: 'red',    wrong2: 'the large' },
          { correct: 'AMBER',   wrong1: 'clear',  wrong2: 'secondary' },
          { correct: 'LABELED-A', wrong1: 'labeled-B', wrong2: 'unlabeled' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Oxygen first, then the {{correct}} injector',
            outcome: { crewDamage: { role: 'security', amount: 40 },
              narrative: 'Seizure. Sam survives, but with lasting damage.' },
            nextStage: null },
          { labelTemplate: '{{correct}} injector first, then oxygen', correct: true,
            outcome: { crewDamage: { role: 'security', amount: 8 }, narrative: 'Airway opens. Sam stabilizes.' },
            nextStage: null },
          { labelTemplate: '{{wrong1}} injector first, then oxygen',
            outcome: { crewDamage: { role: 'security', amount: 55 },
              narrative: 'Wrong drug. Cardiac arrest. Tomás restarts the heart, but damage is done.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 5. Radiation storm spike ───────────────────────────────────────
  {
    id: 'emer_radiation_storm',
    severity: 'emergency',
    startStage: 'shelter',
    stages: {
      shelter: {
        title: 'RADIATION STORM — INCOMING',
        descriptionTemplate:
          'Flare alert. Mei over the intercom: "Head to the {{correct}} shelter — the {{wrong1}} ' +
          'shelter\'s lead liner cracked last week. {{correct}}. Not {{wrong1}}. {{correct}}."',
        variants: [
          { correct: 'STARBOARD', wrong1: 'port',     wrong2: 'forward' },
          { correct: 'UPPER',     wrong1: 'lower',    wrong2: 'aft'     },
          { correct: 'AFT',       wrong1: 'forward',  wrong2: 'central' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Run to the {{wrong1}} shelter',
            outcome: { crewDamage: { amount: 50 },
              narrative: 'Cracked liner leaks. Half the crew take a heavy dose before you relocate.' },
            nextStage: null },
          { labelTemplate: 'Run to the {{correct}} shelter', correct: true,
            outcome: { power: -3, narrative: 'Shielding holds. Now wait it out.' },
            nextStage: 'wait' },
          { labelTemplate: 'Shelter in the rover cab',
            outcome: { crewDamage: { amount: 25 },
              narrative: 'Cab shielding is thin. Dose is manageable but will cost you later.' },
            nextStage: null }
        ]
      },
      wait: {
        title: 'WAIT OUT THE FLARE',
        descriptionTemplate:
          'Dosimeters flickering. Tomás: "We wait {{correct}} minutes — not {{wrong1}}. Early exit ' +
          'kills the bone marrow. {{correct}}. Even if it feels fine."',
        variants: [
          { correct: '90',  wrong1: '45',  wrong2: '180' },
          { correct: '120', wrong1: '60',  wrong2: '240' },
          { correct: '75',  wrong1: '30',  wrong2: '150' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Exit at {{wrong1}} minutes',
            outcome: { crewDamage: { amount: 35 },
              narrative: 'Secondary flare catches the crew in the open. Marrow damage across the roster.' },
            nextStage: null },
          { labelTemplate: 'Wait {{correct}} minutes', correct: true,
            outcome: { water: -4, food: -4, narrative: 'Flare passes. Everyone out healthy.' },
            nextStage: null },
          { labelTemplate: 'Wait {{wrong2}} minutes to be safe',
            outcome: { water: -10, food: -10, oxygen: -8,
              narrative: 'Extra hours burn resources you needed for the next leg.' },
            nextStage: null }
        ]
      }
    }
  },

  // ── 6. Software lockup ─────────────────────────────────────────────
  {
    id: 'emer_software_lockup',
    severity: 'emergency',
    startStage: 'reboot',
    stages: {
      reboot: {
        title: 'SOFTWARE LOCKUP — CONTROL FROZEN',
        descriptionTemplate:
          'Main control unresponsive. Alex working the diagnostic: "WARM reboot — hold the {{correct}} ' +
          'key for ten seconds. Do NOT hit the {{wrong1}} key — that cold-boots us and wipes the ' +
          'waypoint cache."',
        variants: [
          { correct: 'AMBER', wrong1: 'red',    wrong2: 'green' },
          { correct: 'BLUE',  wrong1: 'yellow', wrong2: 'white' },
          { correct: 'F7',    wrong1: 'F12',    wrong2: 'F2'    }
        ],
        choiceTemplates: [
          { labelTemplate: 'Hit the {{wrong1}} key',
            outcome: { sciencePoints: -10, power: -8,
              narrative: 'Cold boot. Waypoint cache scrubbed. You lose a batch of cached science.' },
            nextStage: null },
          { labelTemplate: 'Hold the {{correct}} key ten seconds', correct: true,
            outcome: { power: -2, narrative: 'Warm reboot. Systems coming back. One more step.' },
            nextStage: 'autopilot' },
          { labelTemplate: 'Pull the battery and wait',
            outcome: { power: -15,
              narrative: 'Hard shutdown. Boot takes the better part of an hour.' },
            nextStage: null }
        ]
      },
      autopilot: {
        title: 'RE-ENABLE AUTOPILOT',
        descriptionTemplate:
          'Control back. Riya from the copilot seat: "Disable {{correct}} BEFORE you re-arm autopilot. ' +
          'If autopilot ingests the garbage from the freeze window, it will steer us sideways for a sol. ' +
          '{{correct}} off first."',
        variants: [
          { correct: 'motion-learning', wrong1: 'all autopilot settings', wrong2: 'autopilot entirely' },
          { correct: 'adaptive-nav',    wrong1: 'the full sensor stack',  wrong2: 'autopilot entirely' },
          { correct: 'terrain-predict', wrong1: 'the cached map',         wrong2: 'autopilot entirely' }
        ],
        choiceTemplates: [
          { labelTemplate: 'Re-arm autopilot as-is',
            outcome: { mech: -1, power: -10,
              narrative: 'Autopilot corrects for phantom obstacles all sol. Drift costs you distance.' },
            nextStage: null },
          { labelTemplate: 'Disable {{correct}}, then re-arm', correct: true,
            outcome: { power: -2, narrative: 'Clean re-arm. Rover runs straight.' },
            nextStage: null },
          { labelTemplate: 'Disable {{wrong1}}',
            outcome: { power: -12, crewDamage: { role: 'pilot', amount: 10 },
              narrative: 'You cut too much. Mei drives manually while the stack reboots.' },
            nextStage: null }
        ]
      }
    }
  }
];

// ---- Materialization ----

function fillTemplate(str, vars) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function materializeStage(stageTemplate) {
  const variant = stageTemplate.variants[Math.floor(Math.random() * stageTemplate.variants.length)];
  const choices = stageTemplate.choiceTemplates.map(c => ({
    label: fillTemplate(c.labelTemplate, variant),
    outcome: c.outcome,
    nextStage: c.nextStage,
    correct: !!c.correct
  }));
  return {
    title: stageTemplate.title,
    description: fillTemplate(stageTemplate.descriptionTemplate, variant),
    choices: shuffled(choices)
  };
}

export function materializeEmergency(template) {
  const stages = {};
  for (const [stageId, stageTemplate] of Object.entries(template.stages)) {
    stages[stageId] = materializeStage(stageTemplate);
  }
  return {
    id: template.id,
    multiStage: true,
    severity: template.severity,
    oneShot: false,
    startStage: template.startStage,
    stages
  };
}

// Pick an emergency template at random and materialize it (fresh variant
// per stage + shuffled choices). Returns a concrete event consumable by
// applyStageChoice/showMultiStageModal.
export function pickEmergency() {
  const template = EMERGENCY_TEMPLATES[Math.floor(Math.random() * EMERGENCY_TEMPLATES.length)];
  return materializeEmergency(template);
}
