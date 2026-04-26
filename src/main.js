// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState, CARGO_BUDGET, PART_TYPES } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations, repairBattery, cleanPanels } from './systems/travel.js';
import { applyEventChoice } from './systems/events.js';
import { recordDecision } from './systems/clickMetrics.js';
import { showEventModal, showOutcomeModal, showBriefingModal, showLoadoutModal, showTitleLayer, dimTitleStart, hideTitleLayer, showEndOfRunModal, closeModal, showWaypointOfferModal, showMultiStageModal, showAwayTeamPickerModal, showAwayTeamReunionModal, showDeathDialog } from './ui/modals.js';
import { declineWaypoint } from './systems/waypoints.js';
import { applyStageChoice } from './systems/multiStage.js';
import { acceptAwayTeam, resolveAwayTeamStage, finalizeReunion } from './systems/awayTeam.js';
import { resolveMedicalStage, getMedicalStageView } from './systems/medicalEmergency.js';
import { WAYPOINTS } from './content/waypoints.js';
import { makeLandmarkEncounter } from './content/landmarks.js';
import './ui/codex.js';   // registers global click handler for codex terms
import { isMuted, playTitle, playGameplay, toggleMute, fadeOut, fadeInGameplay, cycleTrack } from './audio.js';
import { openLounge } from './ui/lounge.js';

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

  // Auto-trigger the end-of-run modal when status changes to won/lost.
  if (state.status !== 'active' && !state.activeModal) {
    state = { ...state, activeModal: { type: 'end_of_run' } };
  }

  const modal = state.activeModal;

  // Death queue drains before any gameplay modal — setup screens unaffected.
  const isSetup = modal && ['title', 'briefing', 'loadout'].includes(modal.type);
  if (!isSetup && state.deathQueue && state.deathQueue.length > 0) {
    const entry = state.deathQueue[0];
    showDeathDialog(entry, state, () => {
      state = { ...state, deathQueue: state.deathQueue.slice(1) };
      renderAll();
    });
    return;
  }

  if (!modal) { closeModal(); return; }

  if (modal.type === 'title') {
    showTitleLayer(() => {
      playTitle();
      dimTitleStart();   // START button fades out, backdrop stays
      state = { ...state, activeModal: { type: 'briefing' } };
      renderAll();
    });
    closeModal();
    return;
  }

  if (modal.type === 'briefing') {
    showBriefingModal(state, () => {
      state = { ...state, activeModal: { type: 'loadout' } };
      renderAll();
    });
    return;
  }

  if (modal.type === 'loadout') {
    const initial = {};
    PART_TYPES.forEach(t => { initial[t.key] = state.resources[t.key] ?? t.default ?? 0; });
    showLoadoutModal(initial, CARGO_BUDGET, PART_TYPES, (picked) => {
      // Sequenced cinematic: loadout fades first (title stays visible),
      // brief hold on title, then black overlay covers everything,
      // state swaps, dashboard reveals.
      const modalRoot = document.getElementById('modal-root');
      const overlay   = document.getElementById('transition-overlay');

      // Step 1: loadout modal fades out (~1s). Title layer remains.
      modalRoot.classList.add('fading');

      setTimeout(() => {
        // Step 2: start black overlay + audio fade. Title + empty
        //         modal-root fade to black together.
        overlay.classList.add('active');
        fadeOut(2500);

        setTimeout(() => {
          // Step 3: overlay is fully black — swap state silently.
          const resources = { ...state.resources };
          for (const t of PART_TYPES) {
            if (t.supply) {
              resources[t.supply.resource] = Math.min(100, resources[t.supply.resource] + picked[t.key] * t.supply.perUnit);
            } else {
              resources[t.key] = picked[t.key];
            }
          }
          state = { ...state, resources, activeModal: null };
          modalRoot.classList.remove('fading');
          closeModal();

          // Title layer removed under cover of black.
          const layer = document.getElementById('title-layer');
          if (layer) { layer.classList.remove('active'); layer.innerHTML = ''; }

          renderAll();

          // Step 4: brief hold on black, then fade back to dashboard.
          setTimeout(() => {
            overlay.classList.remove('active');
            fadeInGameplay(1500);
          }, 500);
        }, 1700);
      }, 1200);
    });
    return;
  }

  if (modal.type === 'end_of_run') {
    showEndOfRunModal(state, () => {
      state = createInitialState();
      closeModal();
      renderAll();
    });
    return;
  }

  if (modal.type === 'waypoint_offer') {
    const { waypoint } = modal.payload;
    showWaypointOfferModal(waypoint, state, {
      onAccept: () => {
        state = { ...state, activeModal: { type: 'away_team_picker', payload: { waypoint } } };
        renderAll();
      },
      onDecline: () => {
        state = declineWaypoint(state, waypoint.id);
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
        renderAll();
      }
    });
    return;
  }

  if (modal.type === 'away_team_picker') {
    const { waypoint } = modal.payload;
    showAwayTeamPickerModal(state, waypoint, {
      onConfirm: (crewIds) => {
        state = acceptAwayTeam(state, waypoint.id, crewIds);
        state = { ...state, firedWaypoints: [...state.firedWaypoints, waypoint.id] };
        // Fire the landmark encounter for the turn-off. The rover is parked
        // at this landmark while the away team is out.
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
        renderAll();
      },
      onCancel: () => {
        state = declineWaypoint(state, waypoint.id);
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
        renderAll();
      }
    });
    return;
  }

  if (modal.type === 'away_team_reunion') {
    showAwayTeamReunionModal(modal.payload, (corpseChoices) => {
      state = finalizeReunion(state, corpseChoices);
      renderAll();
    });
    return;
  }

  if (modal.type === 'multi_stage') {
    const { event, stageId, source } = modal.payload;

    // Medical emergency uses a custom resolver (patient-targeted damage,
    // conditional Stage 3, addCorpse). Stage view is built per-run from
    // the payload context (patient + ailment + selfTreat), so we
    // synthesize an event shape for the modal renderer.
    if (source === 'medical') {
      const view = getMedicalStageView(state, stageId, modal.payload.context);
      if (!view) { state = { ...state, activeModal: null }; renderAll(); return; }
      const stageEvent = { id: 'medical_emergency', severity: 'medical', stages: { [stageId]: view } };
      showMultiStageModal(stageEvent, stageId, (choiceIdx) => {
        state = resolveMedicalStage(state, choiceIdx);
        renderAll();
      });
      return;
    }

    // Away-team chain uses its own resolver so rewards accumulate on
    // state.awayTeam.accumulated until reunion. No mid-chain outcome modal.
    if (source === 'awayTeam') {
      showMultiStageModal(event, stageId, (choiceIdx) => {
        state = resolveAwayTeamStage(state, choiceIdx);
        renderAll();
      });
      return;
    }

    const stageOpenedAt = performance.now();
    showMultiStageModal(event, stageId, (choiceIdx) => {
      const elapsed = performance.now() - stageOpenedAt;
      const stageText = event.stages?.[stageId]?.description || '';
      state = {
        ...state,
        clickMetrics: recordDecision(state.clickMetrics, elapsed, stageText)
      };
      const { state: next, nextStage, skillResult, damageTarget, applied } = applyStageChoice(state, event, stageId, choiceIdx);
      state = next;
      render(state);

      if (nextStage !== null) {
        state = { ...state, activeModal: { type: 'multi_stage', payload: { event, stageId: nextStage } } };
        renderAll();
      } else {
        // Chain ended — clear the modal so renderAll doesn't re-open this stage.
        state = { ...state, activeModal: null };
        const choice = event.stages[stageId].choices[choiceIdx];
        const outcome = choice.outcome || (skillResult?.success ? choice.successOutcome : choice.failOutcome);
        const resolution = {
          event: { ...event, modal: event.stages[stageId] },
          choice, outcome, applied, skillResult, damageTarget
        };
        showOutcomeModal(resolution, () => { closeModal(); renderAll(); });
      }
    });
    return;
  }

  if (modal.type === 'event') {
    const event = modal.payload;
    const openedAt = performance.now();
    showEventModal(event, (choiceIdx) => {
      const elapsed = performance.now() - openedAt;
      state = {
        ...state,
        clickMetrics: recordDecision(state.clickMetrics, elapsed, event.modal.description)
      };
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
const loungeOpenBtn = document.getElementById('lounge-open');
const musicMute     = document.getElementById('music-mute');

musicMute.textContent = isMuted() ? '🔇' : '🔊';
musicMute.classList.toggle('muted', isMuted());

loungeOpenBtn.addEventListener('click', () => openLounge());

musicMute.addEventListener('click', () => {
  const muted = toggleMute();
  musicMute.textContent = muted ? '🔇' : '🔊';
  musicMute.classList.toggle('muted', muted);
});

// Left/right arrows cycle gameplay tracks; M toggles mute.
// (Up/down arrows are reserved for the Lounge bubble-count game.)
document.addEventListener('keydown', (e) => {
  // Don't hijack keys when a select/input is focused.
  if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT')) return;

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    cycleTrack(dir);
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    const muted = toggleMute();
    musicMute.textContent = muted ? '🔇' : '🔊';
    musicMute.classList.toggle('muted', muted);
  }
});

// Expose for browser-console inspection.
window.__marsTrail = {
  get state() { return state; },
  render: renderAll
};
