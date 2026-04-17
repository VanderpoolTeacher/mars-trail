// Tests for src/systems/career.js. Run: node --test sim/career.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_TIERS,
  loadCareerScience,
  addCareerScience,
  computeActiveBonuses,
  nextTier,
  currentTier
} from '../src/systems/career.js';

function installLocalStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };
}

// --- CAREER_TIERS shape ---

test('CAREER_TIERS has exactly 6 entries (rookie + 5 unlocks)', () => {
  assert.equal(CAREER_TIERS.length, 6);
  assert.equal(CAREER_TIERS[0].id, 'rookie');
  assert.equal(CAREER_TIERS[0].minSci, 0);
});

test('CAREER_TIERS is ordered by ascending minSci', () => {
  for (let i = 1; i < CAREER_TIERS.length; i++) {
    assert.ok(CAREER_TIERS[i].minSci > CAREER_TIERS[i - 1].minSci);
  }
});

test('CAREER_TIERS thresholds match spec (0, 30, 100, 225, 400, 700)', () => {
  assert.deepEqual(
    CAREER_TIERS.map(t => t.minSci),
    [0, 30, 100, 225, 400, 700]
  );
});

// --- loadCareerScience ---

test('loadCareerScience returns 0 when nothing is stored', () => {
  installLocalStorage();
  assert.equal(loadCareerScience(), 0);
});

test('loadCareerScience returns the stored integer', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.careerScience', '437');
  assert.equal(loadCareerScience(), 437);
});

test('loadCareerScience returns 0 on malformed data (no throw)', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.careerScience', 'not-a-number');
  assert.equal(loadCareerScience(), 0);
});

// --- addCareerScience ---

test('addCareerScience credits full SCI on a won run', () => {
  installLocalStorage();
  const runState = { status: 'won', sciencePoints: 150 };
  const { credit, total } = addCareerScience(runState);
  assert.equal(credit, 150);
  assert.equal(total, 150);
  assert.equal(loadCareerScience(), 150);
});

test('addCareerScience credits 20-60% on a lost run (bounded range)', () => {
  installLocalStorage();
  const runState = { status: 'lost', sciencePoints: 200 };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 100; i++) {
    installLocalStorage();
    const { credit } = addCareerScience(runState);
    if (credit < min) min = credit;
    if (credit > max) max = credit;
  }
  // With 200 SCI, range should be [40, 120]. Allow some floor() slack.
  assert.ok(min >= 40, `min credit ${min} should be >= 40`);
  assert.ok(max <= 120, `max credit ${max} should be <= 120`);
});

test('addCareerScience credits 0 when sciencePoints is 0', () => {
  installLocalStorage();
  for (const status of ['won', 'lost']) {
    installLocalStorage();
    const { credit, total } = addCareerScience({ status, sciencePoints: 0 });
    assert.equal(credit, 0);
    assert.equal(total, 0);
  }
});

test('addCareerScience accumulates on repeated calls', () => {
  installLocalStorage();
  addCareerScience({ status: 'won', sciencePoints: 100 });
  addCareerScience({ status: 'won', sciencePoints: 50 });
  assert.equal(loadCareerScience(), 150);
});

// --- computeActiveBonuses ---

test('computeActiveBonuses returns empty at 0 SCI', () => {
  assert.deepEqual(computeActiveBonuses(0), {});
});

test('computeActiveBonuses merges earned tiers additively', () => {
  const bonuses = computeActiveBonuses(225);
  assert.equal(bonuses.exactWaypointReward, true);
  assert.equal(bonuses.kmMult, 1.05);
  assert.equal(bonuses.skillBonus, 0.10);
  assert.ok(!('lifeSupportMult' in bonuses));
  assert.ok(!('eventPreview' in bonuses));
});

test('computeActiveBonuses at max SCI includes all effects', () => {
  const bonuses = computeActiveBonuses(9999);
  assert.equal(bonuses.exactWaypointReward, true);
  assert.equal(bonuses.kmMult, 1.05);
  assert.equal(bonuses.skillBonus, 0.10);
  assert.equal(bonuses.lifeSupportMult, 0.90);
  assert.equal(bonuses.eventPreview, true);
});

// --- nextTier ---

test('nextTier returns the first unearned tier', () => {
  const t = nextTier(50);
  assert.equal(t.minSci, 100);
  assert.equal(t.id, 'navigation');
});

test('nextTier at max returns null', () => {
  assert.equal(nextTier(9999), null);
});

test('nextTier at 0 returns calibration (first unlock)', () => {
  const t = nextTier(0);
  assert.equal(t.id, 'calibration');
});

// --- currentTier ---

test('currentTier returns rookie at 0', () => {
  assert.equal(currentTier(0).id, 'rookie');
});

test('currentTier returns the highest earned tier', () => {
  assert.equal(currentTier(50).id, 'calibration');
  assert.equal(currentTier(100).id, 'navigation');
  assert.equal(currentTier(9999).id, 'intel_synthesis');
});
