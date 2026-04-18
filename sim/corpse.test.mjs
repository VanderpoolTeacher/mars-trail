// Tests for src/systems/corpse.js. Run: node --test sim/corpse.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCorpse, corpseWeight, DEFAULT_CORPSE_LBS } from '../src/systems/corpse.js';

function makeState(overrides = {}) {
  return { corpses: [], ...overrides };
}

test('addCorpse adds an entry with default 180 LB', () => {
  const s0 = makeState();
  const s1 = addCorpse(s0, 'c2');
  assert.equal(s1.corpses.length, 1);
  assert.equal(s1.corpses[0].crewId, 'c2');
  assert.equal(s1.corpses[0].weightLbs, DEFAULT_CORPSE_LBS);
  assert.equal(DEFAULT_CORPSE_LBS, 180);
});

test('addCorpse accepts an explicit weight', () => {
  const s0 = makeState();
  const s1 = addCorpse(s0, 'c2', 210);
  assert.equal(s1.corpses[0].weightLbs, 210);
});

test('addCorpse is idempotent for the same crewId', () => {
  const s0 = makeState();
  const s1 = addCorpse(s0, 'c2');
  const s2 = addCorpse(s1, 'c2', 999);
  assert.equal(s2.corpses.length, 1);
  assert.equal(s2.corpses[0].weightLbs, DEFAULT_CORPSE_LBS);
});

test('addCorpse is immutable (does not mutate input state)', () => {
  const s0 = makeState();
  const s1 = addCorpse(s0, 'c2');
  assert.equal(s0.corpses.length, 0);
  assert.notEqual(s1.corpses, s0.corpses);
});

test('corpseWeight sums multiple entries', () => {
  const s = makeState({
    corpses: [
      { crewId: 'c1', weightLbs: 180 },
      { crewId: 'c2', weightLbs: 200 }
    ]
  });
  assert.equal(corpseWeight(s), 380);
});

test('corpseWeight is 0 for empty state', () => {
  assert.equal(corpseWeight(makeState()), 0);
});
