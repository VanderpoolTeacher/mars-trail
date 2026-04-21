// Unit tests for docs/walkthrough/router.js. Run: node --test sim/walkthroughRouter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHash,
  hashFor,
  routeForward,
  routeBack,
} from '../docs/walkthrough/router.js';

// Minimal slide set used by all tests.
const slides = {
  spine: [
    { id: 'welcome' },
    { id: 'pitch' },
    {
      id: 'hub',
      branches: [
        { id: 'travel', sub: [{ id: 's1' }, { id: 's2' }] },
        { id: 'events', sub: [{ id: 's1' }] },
      ],
    },
    { id: 'credits' },
  ],
};

test('parseHash returns spine location for empty / slide hash', () => {
  assert.deepEqual(parseHash(''),        { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-0'), { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-2'), { kind: 'spine', index: 2 });
});

test('parseHash returns branch location for branch hash', () => {
  assert.deepEqual(parseHash('#branch-travel-0'), { kind: 'branch', branchId: 'travel', subIndex: 0 });
  assert.deepEqual(parseHash('#branch-events-0'), { kind: 'branch', branchId: 'events', subIndex: 0 });
});

test('parseHash clamps invalid input to spine index 0', () => {
  assert.deepEqual(parseHash('#gibberish'),  { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-999'),  { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide--1'),   { kind: 'spine', index: 0 });
});

test('hashFor round-trips a spine location', () => {
  assert.equal(hashFor({ kind: 'spine', index: 0 }), '#slide-0');
  assert.equal(hashFor({ kind: 'spine', index: 3 }), '#slide-3');
});

test('hashFor round-trips a branch location', () => {
  assert.equal(hashFor({ kind: 'branch', branchId: 'travel', subIndex: 1 }), '#branch-travel-1');
});

test('routeForward on spine advances to next spine slide', () => {
  assert.deepEqual(
    routeForward({ kind: 'spine', index: 0 }, slides),
    { kind: 'spine', index: 1 }
  );
});

test('routeForward on last spine slide is a no-op', () => {
  assert.deepEqual(
    routeForward({ kind: 'spine', index: 3 }, slides),
    { kind: 'spine', index: 3 }
  );
});

test('routeForward on last sub-slide of a branch returns to hub', () => {
  // hub is index 2 in the slides spine above
  assert.deepEqual(
    routeForward({ kind: 'branch', branchId: 'travel', subIndex: 1 }, slides),
    { kind: 'spine', index: 2 }
  );
});

test('routeForward inside a multi-sub branch advances sub-index', () => {
  assert.deepEqual(
    routeForward({ kind: 'branch', branchId: 'travel', subIndex: 0 }, slides),
    { kind: 'branch', branchId: 'travel', subIndex: 1 }
  );
});

test('routeBack on first spine slide is a no-op', () => {
  assert.deepEqual(
    routeBack({ kind: 'spine', index: 0 }, slides),
    { kind: 'spine', index: 0 }
  );
});

test('routeBack on first sub-slide of a branch returns to hub', () => {
  assert.deepEqual(
    routeBack({ kind: 'branch', branchId: 'travel', subIndex: 0 }, slides),
    { kind: 'spine', index: 2 }
  );
});

test('routeBack inside a multi-sub branch decrements sub-index', () => {
  assert.deepEqual(
    routeBack({ kind: 'branch', branchId: 'travel', subIndex: 1 }, slides),
    { kind: 'branch', branchId: 'travel', subIndex: 0 }
  );
});
