// Mars Trail — away-team chain content (issue #17).
// Keyed by waypointId. Each chain matches the v0.6.0 multiStage shape
// (stages dict, startStage, per-choice outcome | skillCheck | nextStage)
// with one extension: choices may carry `returnSolDelta` (number). When a
// choice is taken inside an away-team camp, that delta is added to
// state.awayTeam.returnSol — "go deeper" pushes the due-back sol out;
// "bail early" pulls it in.
//
// Also supported: outcome.awayTeamDamage (number). Applies HP damage to
// a random alive away-team member rather than the full crew.
//
// The final stage's skill check is where the advanced fact reward is
// gated — earlier stages may grant partial SCI, but factsLearned only
// grows on a terminal-stage success.

export const AWAY_TEAM_CHAINS = {
  olivine_outcrop: {
    startStage: 'approach',
    stages: {
      approach: {
        title:       'Olivine Outcrop — On Foot',
        description: 'The cliff face drops fifteen meters to a fresh volcanic scar. Rappel gear is in the kit; ridgeline scan is the safe read.',
        choices: [
          { label:          'Rappel to the fresh face (deeper sample)',
            nextStage:      'deep_sample',
            returnSolDelta: 1 },
          { label:          'Scan the face from the ridgeline',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      deep_sample: {
        title:       'Down the Face',
        description: 'You are halfway down the scar, rope anchored above. Fresh olivine vein exposed at eye level — drillable if you commit.',
        choices: [
          { label:          'Drill the exposed vein',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 80 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Bag a chip sample and climb out',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 35 },
            nextStage:      null }
        ]
      }
    }
  }
};
