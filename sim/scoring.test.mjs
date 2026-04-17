// Tests for src/systems/scoring.js. Run: node --test sim/scoring.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../src/systems/scoring.js';

// --- Helper: build a minimal end-of-run state for tests ---
function makeState(overrides = {}) {
  return {
    status: 'won',
    sol: 24,
    totalKmTraveled: 2550,
    currentLandmarkIndex: 7,              // destination reached
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],   // sum 2550
    sciencePoints: 240,
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

test('won run with 4/5 crew, moderate speed, 240 sci → A rank', () => {
  const { points, rank, breakdown } = computeScore(makeState());
  // Expected:
  //   outcome 500 + crew 400 + sci 240 + resources round((40+50+35+80)/4)=51 cap100 → 51
  //   + speed max(0, 300-24*10)=60 + landmarks 7*20=140 = 1391
  assert.equal(rank, 'A');
  assert.equal(points, 1391);
  assert.equal(breakdown.length, 6);
});

test('perfect won run (5/5 crew, fast, high sci, full resources) → S rank', () => {
  const s = makeState({
    sol: 12,
    sciencePoints: 500,
    resources: { oxygen: 90, water: 90, food: 90, power: 90, panels: 100, mech: 1, eva: 1, cell: 1 },
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true }, { id:'c3', alive:true },
      { id:'c4', alive:true }, { id:'c5', alive:true }
    ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 500 + 300 (capped) + 90 + 180 (300-120) + 140 = 1710
  assert.equal(rank, 'S');
  assert.equal(points, 1710);
});

test('won run with only 2/5 crew and low sci → B rank', () => {
  const s = makeState({
    sciencePoints: 50,
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true },
      { id:'c3', alive:false }, { id:'c4', alive:false }, { id:'c5', alive:false }
    ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 200 + 50 + 51 + 60 + 140 = 1001 → B (≥900)
  assert.equal(rank, 'B');
  assert.equal(points, 1001);
});

test('lost run at >80% distance → C rank (near-miss loss)', () => {
  const s = makeState({
    status: 'lost',
    totalKmTraveled: 2100,                 // 2100/2550 = 82%
    currentLandmarkIndex: 5,
    sol: 30,
    sciencePoints: 180,
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:false }, { id:'c3', alive:false },
      { id:'c4', alive:false }, { id:'c5', alive:false }
    ]
  });
  const { points, rank } = computeScore(s);
  // outcome 100 (≥80%) + crew 100 + sci 180 + resources 51 + speed 0 (lost) + landmarks 5*20=100
  // = 531. Lost with 531 → D (<700).
  assert.equal(points, 531);
  assert.equal(rank, 'D');
});

test('early-wipe lost run → F rank', () => {
  const s = makeState({
    status: 'lost',
    totalKmTraveled: 100,
    currentLandmarkIndex: 0,
    sol: 4,
    sciencePoints: 5,
    resources: { oxygen: 0, water: 0, food: 0, power: 0, panels: 0, mech: 0, eva: 0, cell: 0 },
    crew: [ { id:'c1', alive:false }, { id:'c2', alive:false }, { id:'c3', alive:false },
            { id:'c4', alive:false }, { id:'c5', alive:false } ]
  });
  const { points, rank } = computeScore(s);
  // 0 + 0 + 5 + 0 + 0 (lost) + 0 = 5 → F
  assert.equal(points, 5);
  assert.equal(rank, 'F');
});

test('won run with very low score still at least C', () => {
  const s = makeState({
    sol: 80,                               // speed bonus = max(0, 300-800) = 0
    sciencePoints: 0,
    resources: { oxygen: 0, water: 0, food: 0, power: 0, panels: 0, mech: 0, eva: 0, cell: 0 },
    crew: [ { id:'c1', alive:true }, { id:'c2', alive:false }, { id:'c3', alive:false },
            { id:'c4', alive:false }, { id:'c5', alive:false } ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 100 + 0 + 0 + 0 + 140 = 740 → B (≥900 no), C floor for won
  assert.equal(points, 740);
  assert.equal(rank, 'C');
});

// ---- Persistence tests: stub localStorage before each test ----

import { loadBestRun, saveBestRun } from '../src/systems/scoring.js';

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
  const score = { points: 1200, rank: 'A' };
  const state = { sol: 24, status: 'won' };
  saveBestRun(score, state);
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1200);
  assert.equal(loaded.rank, 'A');
  assert.equal(loaded.sol, 24);
  assert.equal(loaded.won, true);
  assert.match(loaded.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('saveBestRun skips when new score is not higher', () => {
  installLocalStorage();
  saveBestRun({ points: 1500, rank: 'S' }, { sol: 12, status: 'won' });
  saveBestRun({ points: 1200, rank: 'A' }, { sol: 24, status: 'won' });
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1500);
  assert.equal(loaded.rank, 'S');
});

test('saveBestRun overwrites when new score is higher', () => {
  installLocalStorage();
  saveBestRun({ points: 900, rank: 'B' }, { sol: 35, status: 'won' });
  saveBestRun({ points: 1400, rank: 'A' }, { sol: 20, status: 'won' });
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1400);
});
