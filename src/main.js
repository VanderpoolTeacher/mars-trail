// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations } from './systems/travel.js';
import { applyEventChoice } from './systems/events.js';
import { showEventModal, showOutcomeModal, closeModal } from './ui/modals.js';

let state = createInitialState();
renderAll();

// ---- NEXT SOL ----
document.getElementById('next-sol-btn').addEventListener('click', () => {
  if (state.activeModal || state.status !== 'active') return;
  state = advanceSol(state);
  renderAll();
});

// ---- Pace selector ----
document.getElementById('pace-seg').addEventListener('click', (e) => {
  if (state.activeModal) return;
  const v = e.target.dataset.value;
  if (!v) return;
  state = setPace(state, v);
  renderAll();
});

// ---- Rations selector ----
document.getElementById('rations-seg').addEventListener('click', (e) => {
  if (state.activeModal) return;
  const v = e.target.dataset.value;
  if (!v) return;
  state = setRations(state, v);
  renderAll();
});

// ---- Renderer that also handles modal lifecycle ----
function renderAll() {
  render(state);
  if (state.activeModal && state.activeModal.type === 'event') {
    const event = state.activeModal.payload;
    showEventModal(event, (choiceIdx) => {
      const { state: next, resolution } = applyEventChoice(state, event, choiceIdx);
      state = next;
      render(state);   // dashboard reflects the change behind the outcome modal
      showOutcomeModal(resolution, () => {
        closeModal();
        renderAll();
      });
    });
  } else {
    closeModal();
  }
}

// Expose for browser-console inspection.
window.__marsTrail = {
  get state() { return state; },
  render: renderAll
};
