// Mars Trail — medical emergency event (issue #6).
// A 3-stage multi-stage event: diagnose → treat → (only if patient dies) dispose.
//
// Stage logic is authored here as data, but resolution runs through
// src/systems/medicalEmergency.js (not the generic applyStageChoice) so
// that outcomes can target the specific patient crew member, route
// conditionally on death, and handle addCorpse for the "keep body" path.
//
// Patient is picked at event-fire time by pickPatient(state):
// first alive non-medic crew member. If only the medic is alive,
// the medic is the patient and selfTreat=true (skill-check penalty).

export const MEDICAL_EMERGENCY = {
  id:             'medical_emergency',
  multiStage:     true,
  customResolver: 'medical',   // opens via beginMedicalEmergency, resolves via resolveMedicalStage
  weight:         3,
  severity:       'severe',
  oneShot:        true,
  startStage:     'diagnose',
  stages: {
    diagnose: {
      title:       'Medical Emergency',
      description: 'Vitals are dropping. Pain localized. You need a diagnosis — fast.',
      choices: [
        { label: 'Consult the medic',           key: 'medic'  },
        { label: 'Query Earth (comms delay)',   key: 'earth'  },
        { label: 'Dose from med kit and hope',  key: 'hope'   }
      ]
    },
    treat: {
      title:       'Treatment Window',
      description: 'Diagnosis in hand, or close to it. Pick the treatment plan.',
      choices: [
        { label: 'Surgery in the rover',         key: 'surgery' },
        { label: 'Stabilize and push to landmark', key: 'push'   },
        { label: 'Induced coma — buy time',      key: 'coma'    }
      ]
    },
    dispose: {
      title:       'Body Disposal',
      description: 'The patient did not make it. The body is 180 LB of suited mass. Call it.',
      choices: [
        { label: 'Bury at next landmark',  key: 'bury'     },
        { label: 'Keep the body with us',  key: 'keep'     },
        { label: 'Jettison the suit now',  key: 'jettison' }
      ]
    }
  }
};
