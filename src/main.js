// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState, CARGO_BUDGET, PART_TYPES } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations, repairBattery, cleanPanels } from './systems/travel.js';
import { applyEventChoice } from './systems/events.js';
import { showEventModal, showOutcomeModal, showBriefingModal, showLoadoutModal, showTitleModal, closeModal } from './ui/modals.js';
import './ui/codex.js';   // registers global click handler for codex terms
import { GAMEPLAY_TRACKS, getSelectedTrackId, isMuted, playTitle, playGameplay, selectTrack, toggleMute, fadeOut, fadeInGameplay, cycleTrack } from './audio.js';

let state = createInitialState();
renderAll();

// Try playing title music immediately. If browser blocks autoplay,
// a one-time interaction listener picks it up.
playTitle();
function unlockAudio() {
  playTitle();
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

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

  if (modal.type === 'title') {
    showTitleModal(() => {
      playTitle();   // first user click unlocks audio → title theme starts
      state = { ...state, activeModal: { type: 'briefing' } };
      renderAll();
    });
    return;
  }

  if (modal.type === 'briefing') {
    showBriefingModal(() => {
      state = { ...state, activeModal: { type: 'loadout' } };
      renderAll();
    });
    return;
  }

  if (modal.type === 'loadout') {
    const initial = {};
    PART_TYPES.forEach(t => { initial[t.key] = state.resources[t.key] ?? t.default ?? 0; });
    showLoadoutModal(initial, CARGO_BUDGET, PART_TYPES, (picked) => {
      // Cinematic transition: fade audio + screen to black, switch, fade in.
      const overlay = document.getElementById('transition-overlay');
      overlay.classList.add('active');
      fadeOut(2500);

      setTimeout(() => {
        const resources = { ...state.resources };
        for (const t of PART_TYPES) {
          if (t.supply) {
            resources[t.supply.resource] = Math.min(100, resources[t.supply.resource] + picked[t.key] * t.supply.perUnit);
          } else {
            resources[t.key] = picked[t.key];
          }
        }
        state = { ...state, resources, activeModal: null };
        closeModal();
        renderAll();

        setTimeout(() => {
          overlay.classList.remove('active');
          fadeInGameplay(1500);
        }, 400);
      }, 2600);
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

// ---- Music controls ----
const musicSelect = document.getElementById('music-select');
const musicMute   = document.getElementById('music-mute');

// Populate track selector.
GAMEPLAY_TRACKS.forEach(t => {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.name;
  musicSelect.appendChild(opt);
});
musicSelect.value = getSelectedTrackId();
musicMute.textContent = isMuted() ? '🔇' : '🔊';
musicMute.classList.toggle('muted', isMuted());

musicSelect.addEventListener('change', () => {
  selectTrack(musicSelect.value);
});

musicMute.addEventListener('click', () => {
  const muted = toggleMute();
  musicMute.textContent = muted ? '🔇' : '🔊';
  musicMute.classList.toggle('muted', muted);
});

// Up/down arrows cycle gameplay tracks.
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // Don't hijack arrows when a select/input is focused.
    if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT')) return;
    e.preventDefault();
    const dir = e.key === 'ArrowUp' ? -1 : 1;
    const newId = cycleTrack(dir);
    musicSelect.value = newId;
  }
});

// Expose for browser-console inspection.
window.__marsTrail = {
  get state() { return state; },
  render: renderAll
};
