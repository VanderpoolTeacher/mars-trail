// Mars Trail — medical emergency content (issue #6, expanded #32).
//
// The medical event is a 3-stage chain resolved by the custom resolver
// in src/systems/medicalEmergency.js. Stage VIEWS (title/description/
// choices) are built per-run by getMedicalStageView so each instance
// can weave in the specific patient + the rolled ailment + whether the
// medic is the patient (selfTreat path).
//
// The static structure below only defines the stage-key skeleton and
// the ailment pool. All visible text comes from the view builder.

export const MEDICAL_EMERGENCY = {
  id:             'medical_emergency',
  multiStage:     true,
  customResolver: 'medical',
  weight:         3,
  severity:       'medical',
  oneShot:        true,
  startStage:     'diagnose',
  stages: {
    diagnose: { choices: [] },    // rendered by getMedicalStageView
    treat:    { choices: [] },
    dispose:  { choices: [] }
  }
};

// ---- Ailment pool (#32) ----
// Each entry carries a headline label, a symptom string woven into the
// diagnose-stage description, and a short cause for log lines.
export const AILMENTS = [
  {
    id:      'appendicitis',
    label:   'Appendicitis',
    symptom: 'Sharp pain, lower right quadrant. Fever spiking. Abdomen rigid to touch.',
    cause:   'appendix rupture'
  },
  {
    id:      'crush_injury',
    label:   'Crush Injury',
    symptom: 'Compression trauma to the torso. Shallow breathing. Internal bleeding likely.',
    cause:   'EVA rigging accident'
  },
  {
    id:      'radiation_sickness',
    label:   'Acute Radiation Sickness',
    symptom: 'Nausea, skin erythema, platelet count dropping. Dosimeter logged a spike during last EVA.',
    cause:   'solar particle event exposure'
  },
  {
    id:      'cardiac_arrhythmia',
    label:   'Cardiac Arrhythmia',
    symptom: 'Irregular rhythm on the monitor. Chest pain, cold sweat, pallor.',
    cause:   'ischemic cardiac event'
  },
  {
    id:      'perchlorate_exposure',
    label:   'Perchlorate Exposure',
    symptom: 'Thyroid panic, dizziness, respiratory distress. Suit log shows a dust breach at the last airlock cycle.',
    cause:   'perchlorate ingestion'
  },
  {
    id:      'decompression_trauma',
    label:   'Decompression Trauma',
    symptom: 'Joint pain, disorientation, skin mottling. Pressure log shows a six-second drop during EVA.',
    cause:   'suit-pressure fluctuation'
  }
];
