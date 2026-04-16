// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState, CARGO_BUDGET, PART_TYPES } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations, repairBattery, cleanPanels } from './systems/travel.js';
import { applyEventChoice } from './systems/events.js';
import { showEventModal, showOutcomeModal, showBriefingModal, showLoadoutModal, closeModal } from './ui/modals.js';

let state = createInitialState();
renderAll();

// ---- NEXT SOL ----
document.getElementById('next-sol-btn').addEventListener('click', () => {
  if (state.activeModal || state.status !== 'active') return;
  state = advanceSol(state);
  renderAll();
});

// ---- REPAIR ----
document.getElementById('repair-btn').addEventListener('click', () => {
  if (state.activeModal || state.status !== 'active') return;
  if (state.resources.cell < 1 || state.resources.power >= 100) return;
  state = repairBattery(state);
  renderAll();
});

// ---- CLEAN PANELS ----
document.getElementById('clean-btn').addEventListener('click', () => {
  if (state.activeModal || state.status !== 'active') return;
  if (state.resources.eva < 1 || state.resources.panels >= 100) return;
  state = cleanPanels(state);
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
  const modal = state.activeModal;
  if (!modal) { closeModal(); return; }

  if (modal.type === 'briefing') {
    showBriefingModal(() => {
      state = { ...state, activeModal: { type: 'loadout' } };
      renderAll();
    });
    return;
  }

  if (modal.type === 'loadout') {
    const initial = {
      mech: state.resources.mech,
      eva:  state.resources.eva,
      cell: state.resources.cell
    };
    showLoadoutModal(initial, CARGO_BUDGET, PART_TYPES, (picked) => {
      state = {
        ...state,
        resources: { ...state.resources, ...picked },
        activeModal: null
      };
      closeModal();
      renderAll();
    });
    return;
  }

  if (modal.type === 'event') {
    const event = modal.payload;
    showEventModal(event, (choiceIdx) => {
      const { state: next, resolution } = applyEventChoice(state, event, choiceIdx);
      state = next;
      render(state);   // dashboard reflects the change behind the outcome modal
      showOutcomeModal(resolution, () => {
        closeModal();
        renderAll();
      });
    });
    return;
  }

  closeModal();
}

// Expose for browser-console inspection.
window.__marsTrail = {
  get state() { return state; },
  render: renderAll
};
