// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations } from './systems/travel.js';

let state = createInitialState();
render(state);

// ---- NEXT SOL ----
document.getElementById('next-sol-btn').addEventListener('click', () => {
  state = advanceSol(state);
  render(state);
});

// ---- Pace selector (event delegation; buttons re-rendered each tick) ----
document.getElementById('pace-seg').addEventListener('click', (e) => {
  const v = e.target.dataset.value;
  if (!v) return;
  state = setPace(state, v);
  render(state);
});

// ---- Rations selector ----
document.getElementById('rations-seg').addEventListener('click', (e) => {
  const v = e.target.dataset.value;
  if (!v) return;
  state = setRations(state, v);
  render(state);
});

// Expose live state for browser-console inspection.
window.__marsTrail = {
  get state() { return state; },
  render: () => render(state)
};
