// Tests for src/systems/scoring.js. Run: node --test sim/scoring.test.mjs
//
// v0.7.1: rank is a checklist of gates (issue #24), not threshold math.
// Points still computed (for leaderboard); tests cover point math AND
// rank gates separately.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, nextRankGap, loadBestRun, saveBestRun } from '../src/systems/scoring.js';

function makeState(overrides = {}) {
  return {
    status: 'won',
    sol: 24,
    totalKmTraveled: 2550,
    currentLandmarkIndex: 7,
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],   // sum 2550
    sciencePoints: 240,
    factsLearned: [],
    resources: { oxygen: 40, water: 50, food: 35, power: 80, panels: 100, mech: 1, eva: 1, cell: 1 },
    crew: [
      { id:'c1', alive:true  },
      { id:'c2', alive:true  },
      { id:'c3', alive:true  },
      { id:'c4', alive:true  },
      { id:'c5', alive:false }
    ],
    ...overrides
  };
}

// ---- Point math (unchanged from v0.7.0) ----

test('computeScore point math is unchanged: won, 4/5 crew, 240 SCI, sol 24', () => {
  const { points, breakdown } = computeScore(makeState());
  // 500 + 400 + 240 + 51 + 60 + 140 = 1391
  assert.equal(points, 1391);
  assert.equal(breakdown.length, 6);
});

// ---- Rank gates (issue #24) ----

test('rank C: won but no science + no facts → baseline C', () => {
  const { rank } = computeScore(makeState({
    sciencePoints: 0,
    factsLearned: [],
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true }, { id:'c3', alive:true },
      { id:'c4', alive:true }, { id:'c5', alive:true }
    ]
  }));
  assert.equal(rank, 'C');
});

test('rank B via SCI: won + ≥150 SCI → B', () => {
  const { rank } = computeScore(makeState({ sciencePoints: 150, factsLearned: [] }));
  assert.equal(rank, 'B');
});

test('rank B via facts: won + ≥3 facts → B (even with low SCI)', () => {
  const { rank } = computeScore(makeState({
    sciencePoints: 10,
    factsLearned: ['a', 'b', 'c']
  }));
  assert.equal(rank, 'B');
});

test('rank A requires SCI + facts + ≥3 crew alive', () => {
  const base = { sciencePoints: 300, factsLearned: ['a','b','c','d','e'] };
  // 3 alive: A qualifies
  const a3 = computeScore(makeState({
    ...base,
    crew: [{id:'c1',alive:true},{id:'c2',alive:true},{id:'c3',alive:true},
           {id:'c4',alive:false},{id:'c5',alive:false}]
  }));
  assert.equal(a3.rank, 'A');

  // 2 alive: fails crew gate → falls to B
  const a2 = computeScore(makeState({
    ...base,
    crew: [{id:'c1',alive:true},{id:'c2',alive:true},
           {id:'c3',alive:false},{id:'c4',alive:false},{id:'c5',alive:false}]
  }));
  assert.equal(a2.rank, 'B');

  // Missing fact count
  const fewFacts = computeScore(makeState({
    ...base,
    factsLearned: ['a','b','c','d']                // 4 < 5
  }));
  assert.equal(fewFacts.rank, 'B');

  // Low SCI
  const lowSci = computeScore(makeState({ ...base, sciencePoints: 250 }));
  assert.equal(lowSci.rank, 'B');
});

test('rank S requires all 5 crew alive + ≥500 SCI + ≥6 facts', () => {
  const sFixture = makeState({
    sciencePoints: 500,
    factsLearned: ['a','b','c','d','e','f'],
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true }, { id:'c3', alive:true },
      { id:'c4', alive:true }, { id:'c5', alive:true }
    ]
  });
  assert.equal(computeScore(sFixture).rank, 'S');

  // One crew dead → S gate fails, but A gate (3+ alive, 300+ SCI, 5+ facts) holds
  const oneDead = computeScore(makeState({
    ...sFixture,
    crew: sFixture.crew.map((c, i) => i === 0 ? { ...c, alive: false } : c)
  }));
  assert.equal(oneDead.rank, 'A');

  // 6 facts + all alive + 499 SCI → A (below S SCI floor)
  const lowSci = computeScore(makeState({
    ...sFixture,
    sciencePoints: 499
  }));
  assert.equal(lowSci.rank, 'A');

  // 5 facts (below S gate) + all alive + 500 SCI → A
  const fewFacts = computeScore(makeState({
    ...sFixture,
    factsLearned: ['a','b','c','d','e']
  }));
  assert.equal(fewFacts.rank, 'A');
});

// ---- Loss gates ----

test('lost run: ≥80% route traversed → D, else F', () => {
  const near = computeScore(makeState({
    status: 'lost',
    totalKmTraveled: 2100,        // 82%
    currentLandmarkIndex: 5
  }));
  assert.equal(near.rank, 'D');

  const early = computeScore(makeState({
    status: 'lost',
    totalKmTraveled: 100,         // 4%
    currentLandmarkIndex: 0
  }));
  assert.equal(early.rank, 'F');
});

// ---- nextRankGap (directional feedback) ----

test('nextRankGap returns null after S', () => {
  const s = makeState({
    sciencePoints: 600,
    factsLearned: ['a','b','c','d','e','f','g'],
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true }, { id:'c3', alive:true },
      { id:'c4', alive:true }, { id:'c5', alive:true }
    ]
  });
  assert.equal(nextRankGap(s), null);
});

test('nextRankGap returns null for lost runs', () => {
  const s = makeState({ status: 'lost', totalKmTraveled: 100, currentLandmarkIndex: 0 });
  assert.equal(nextRankGap(s), null);
});

test('nextRankGap at C: reports the easier of SCI-to-B or facts-to-B', () => {
  // Player sitting at C with 140 SCI and 0 facts → 10 more SCI reaches B.
  const closeSci = nextRankGap(makeState({ sciencePoints: 140, factsLearned: [] }));
  assert.equal(closeSci.nextRank, 'B');
  assert.equal(closeSci.needs[0].label, 'science points');
  assert.equal(closeSci.needs[0].delta, 10);

  // Player sitting at C with 0 SCI and 2 facts → 1 more fact reaches B.
  const closeFacts = nextRankGap(makeState({ sciencePoints: 0, factsLearned: ['a','b'] }));
  assert.equal(closeFacts.nextRank, 'B');
  assert.equal(closeFacts.needs[0].label, 'advanced facts');
  assert.equal(closeFacts.needs[0].delta, 1);
});

test('nextRankGap at B lists all A gaps (SCI, facts, crew) that apply', () => {
  // 200 SCI, 4 facts, 2 crew alive → sits at B; missing 100 SCI, 1 fact, 1 crew.
  const s = makeState({
    sciencePoints: 200,
    factsLearned: ['a','b','c','d'],
    crew: [{id:'c1',alive:true},{id:'c2',alive:true},{id:'c3',alive:false},
           {id:'c4',alive:false},{id:'c5',alive:false}]
  });
  const gap = nextRankGap(s);
  assert.equal(gap.nextRank, 'A');
  const byLabel = Object.fromEntries(gap.needs.map(n => [n.label, n.delta]));
  assert.equal(byLabel['science points'], 100);
  assert.equal(byLabel['advanced facts'], 1);
  assert.equal(byLabel['crew alive'], 1);
});

test('nextRankGap at A points toward S with hard all-crew gate', () => {
  // Player earned A but lost 1 crew → S requires all-crew-alive, which is a
  // permanent fail for this run (flagged hard=true).
  const s = makeState({
    sciencePoints: 400,
    factsLearned: ['a','b','c','d','e','f'],
    crew: [{id:'c1',alive:true},{id:'c2',alive:true},{id:'c3',alive:true},
           {id:'c4',alive:true},{id:'c5',alive:false}]
  });
  assert.equal(computeScore(s).rank, 'A');
  const gap = nextRankGap(s);
  assert.equal(gap.nextRank, 'S');
  const crewNeed = gap.needs.find(n => n.label === 'all crew alive');
  assert.ok(crewNeed);
  assert.equal(crewNeed.hard, true);
});

// ---- Persistence ----

function installLocalStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };
}

test('loadBestRun returns null when nothing is stored', () => {
  installLocalStorage();
  assert.equal(loadBestRun(), null);
});

test('loadBestRun returns null on malformed JSON (no throw)', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.bestRun', '{not json');
  assert.equal(loadBestRun(), null);
});

test('saveBestRun writes on first save', () => {
  installLocalStorage();
  saveBestRun({ points: 1200, rank: 'A' }, { sol: 24, status: 'won' });
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1200);
  assert.equal(loaded.rank, 'A');
  assert.equal(loaded.sol, 24);
  assert.equal(loaded.won, true);
});

test('saveBestRun skips when new score is not higher', () => {
  installLocalStorage();
  saveBestRun({ points: 1500, rank: 'S' }, { sol: 12, status: 'won' });
  saveBestRun({ points: 1200, rank: 'A' }, { sol: 24, status: 'won' });
  assert.equal(loadBestRun().points, 1500);
});

test('saveBestRun overwrites when new score is higher', () => {
  installLocalStorage();
  saveBestRun({ points: 900, rank: 'B' }, { sol: 35, status: 'won' });
  saveBestRun({ points: 1400, rank: 'A' }, { sol: 20, status: 'won' });
  assert.equal(loadBestRun().points, 1400);
});
