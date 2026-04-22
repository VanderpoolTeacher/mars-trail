// Real-module demo: imports the game's event content and modal renderer
// to render a random event card as a read-only preview.
//
// NOTE: imports below must stay in sync with src/content/events.js and
// src/ui/modals.js. If those files move or rename exports, update here
// and the Task 15 smoke test (which asserts on REQUIRED_MODAL_EXPORT)
// will flag the break.
//
// Approach: (b) from the plan. showEventModal targets the document-level
// #modal-root via getElementById. We temporarily rename the walkthrough
// page's real #modal-root, give our scoped card container that id, let
// the real renderer paint into it, then restore. onChoose is wired to a
// no-op that shows a "read-only preview" note — no state is mutated.

import { EVENTS } from '../../../src/content/events.js';
import { showEventModal } from '../../../src/ui/modals.js';

// Name of the modals export this demo depends on. The Task 15 smoke test
// should assert this export still exists in src/ui/modals.js.
export const REQUIRED_MODAL_EXPORT = 'showEventModal';

// Filter out any multi-stage events. The current events.js has none
// (multi-stage events live elsewhere and use `stages` instead of `modal`),
// but keep the guard so future data additions don't surprise us.
function previewableEvents() {
  return EVENTS.filter(e => e && e.modal && !e.stages);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function renderCard(cardHost, noteEl) {
  const pool = previewableEvents();
  if (pool.length === 0) {
    cardHost.innerHTML = '<p style="opacity:0.8">No previewable events found.</p>';
    return;
  }
  const event = pickRandom(pool);

  // Temporarily rename the page-level #modal-root so the real
  // showEventModal writes into OUR scoped container instead of the
  // full-screen overlay.
  const pageRoot = document.getElementById('modal-root');
  const restoreId = pageRoot ? pageRoot.id : null;
  if (pageRoot) pageRoot.id = 'modal-root--stashed-by-eventPreview';

  const prevCardId = cardHost.id;
  cardHost.id = 'modal-root';

  try {
    showEventModal(event, () => {
      if (noteEl) {
        noteEl.textContent = '(read-only preview — choices are not applied)';
      }
    });
  } catch (err) {
    console.warn('eventPreview: showEventModal threw', err);
    cardHost.innerHTML = `<p style="color:var(--text-danger,#f66)">Failed to render event card: ${String(err && err.message || err)}</p>`;
  } finally {
    // Restore ids regardless of outcome.
    cardHost.id = prevCardId;
    if (pageRoot) pageRoot.id = restoreId;
  }
}

export function init(mount) {
  try {
    mount.innerHTML = `
      <div class="event-preview-demo" style="margin-top:12px">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <button type="button" id="event-preview-roll" class="btn-primary">Roll another</button>
          <span id="event-preview-note" style="opacity:0.8;font-size:0.9em"></span>
        </div>
        <div id="event-preview-card"></div>
      </div>
    `;
    const cardHost = mount.querySelector('#event-preview-card');
    const noteEl   = mount.querySelector('#event-preview-note');
    const rollBtn  = mount.querySelector('#event-preview-roll');

    const doRoll = () => {
      if (noteEl) noteEl.textContent = '';
      renderCard(cardHost, noteEl);
    };

    rollBtn.addEventListener('click', doRoll);
    doRoll();
  } catch (err) {
    console.warn('eventPreview init failed:', err);
    try {
      mount.innerHTML = `<p style="color:var(--text-danger,#f66)">Event preview unavailable: ${String(err && err.message || err)}</p>`;
    } catch { /* nothing more we can do */ }
  }
  return () => {};
}
