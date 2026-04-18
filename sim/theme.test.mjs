// Tests for src/theme.js pure helpers. Run: node --test sim/theme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, resolveTheme, STORAGE_KEY } from '../src/theme.js';

test('THEMES exposes the four supported skins in display order', () => {
  assert.deepEqual(
    THEMES.map(t => t.id),
    ['mc', 'lcars', 'voltron', 'starfighter']
  );
});

test('each theme has an id and a human label', () => {
  for (const t of THEMES) {
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length > 0);
    assert.equal(typeof t.label, 'string');
    assert.ok(t.label.length > 0);
  }
});

test('resolveTheme returns mc for unknown / missing input', () => {
  assert.equal(resolveTheme(null), 'mc');
  assert.equal(resolveTheme(undefined), 'mc');
  assert.equal(resolveTheme(''), 'mc');
  assert.equal(resolveTheme('bogus'), 'mc');
});

test('resolveTheme returns the id unchanged for known themes', () => {
  assert.equal(resolveTheme('mc'), 'mc');
  assert.equal(resolveTheme('lcars'), 'lcars');
  assert.equal(resolveTheme('voltron'), 'voltron');
  assert.equal(resolveTheme('starfighter'), 'starfighter');
});

test('STORAGE_KEY is stable (migrations would break existing users)', () => {
  assert.equal(STORAGE_KEY, 'marsTrail.theme');
});
