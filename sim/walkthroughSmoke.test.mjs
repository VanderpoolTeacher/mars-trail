// Smoke test for the code-tour demos.
// Asserts each demo module imports cleanly under Node and exposes the expected surface.
// Does NOT exercise DOM behavior — only catches import-path drift and top-level export rot.
//
// Run: node --test sim/walkthroughSmoke.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Install a minimal DOM shim for modules that touch document at import time.
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({ style: {}, appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {} } }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => [],
    body: { setAttribute() {}, removeAttribute() {}, appendChild() {} },
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { location: { hash: '' }, history: { pushState() {} }, addEventListener() {} };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
}

test('loop demo module imports and exposes init()', async () => {
  const mod = await import('../docs/walkthrough/demos/loop.js');
  assert.equal(typeof mod.init, 'function');
});

test('eventPreview demo module imports, exposes init() and its documented export constant', async () => {
  const mod = await import('../docs/walkthrough/demos/eventPreview.js');
  assert.equal(typeof mod.init, 'function');
  assert.equal(typeof mod.REQUIRED_MODAL_EXPORT, 'string');
  assert.ok(mod.REQUIRED_MODAL_EXPORT.length > 0);
});

test('mashEmergency demo module imports, exposes init() and its documented export constants', async () => {
  const mod = await import('../docs/walkthrough/demos/mashEmergency.js');
  assert.equal(typeof mod.init, 'function');
  assert.ok(Array.isArray(mod.REQUIRED_MEDICAL_EXPORTS));
  assert.ok(mod.REQUIRED_MEDICAL_EXPORTS.every(k => typeof k === 'string' && k.length > 0));
  assert.equal(typeof mod.REQUIRED_MODAL_EXPORT, 'string');
});

test('eventPreview declared modal export exists on src/ui/modals.js', async () => {
  const demo = await import('../docs/walkthrough/demos/eventPreview.js');
  const modals = await import('../src/ui/modals.js');
  assert.equal(
    typeof modals[demo.REQUIRED_MODAL_EXPORT],
    'function',
    `src/ui/modals.js must export ${demo.REQUIRED_MODAL_EXPORT}; update either the source or demos/eventPreview.js.`
  );
});

test('mashEmergency declared exports exist on their source modules', async () => {
  const demo = await import('../docs/walkthrough/demos/mashEmergency.js');
  const med = await import('../src/systems/medicalEmergency.js');
  for (const k of demo.REQUIRED_MEDICAL_EXPORTS) {
    // REQUIRED_MEDICAL_EXPORTS mixes functions (beginMedicalEmergency,
    // resolveMedicalStage, getMedicalStageView) with a string constant
    // (MEDICAL_EMERGENCY_ID). Asserting `!== 'undefined'` catches
    // import-path rot — which is all this smoke test needs to do —
    // without forcing the test to know each name's kind.
    assert.notEqual(
      typeof med[k],
      'undefined',
      `src/systems/medicalEmergency.js must export ${k} (function or value); update either source or demos/mashEmergency.js.`
    );
  }
  const modals = await import('../src/ui/modals.js');
  assert.equal(
    typeof modals[demo.REQUIRED_MODAL_EXPORT],
    'function',
    `src/ui/modals.js must export ${demo.REQUIRED_MODAL_EXPORT}.`
  );
});

test('glossary module imports and exposes a non-empty GLOSSARY object', async () => {
  const mod = await import('../docs/walkthrough/glossary.js');
  assert.equal(typeof mod.GLOSSARY, 'object');
  assert.ok(mod.GLOSSARY !== null);
  const keys = Object.keys(mod.GLOSSARY);
  assert.ok(keys.length > 0, 'GLOSSARY must have at least one entry');
});

test('every glossary entry has non-empty term + def strings', async () => {
  const { GLOSSARY } = await import('../docs/walkthrough/glossary.js');
  for (const [slug, entry] of Object.entries(GLOSSARY)) {
    assert.equal(typeof entry.term, 'string', `${slug}: term must be a string`);
    assert.ok(entry.term.length > 0, `${slug}: term must be non-empty`);
    assert.equal(typeof entry.def, 'string', `${slug}: def must be a string`);
    assert.ok(entry.def.length > 0, `${slug}: def must be non-empty`);
  }
});

test('every glossary slug is kebab-case (lowercase letters, digits, hyphens)', async () => {
  const { GLOSSARY } = await import('../docs/walkthrough/glossary.js');
  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const slug of Object.keys(GLOSSARY)) {
    assert.match(slug, kebab, `${slug} is not kebab-case`);
  }
});
