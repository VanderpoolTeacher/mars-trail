// Mars Trail — codex linkifier + popup.
// Scans text for known terms and wraps them in clickable spans.
// Click a term → popup with extended info.

import { CODEX, CODEX_TERMS } from '../content/codex.js';

// Replace known codex terms in already-escaped HTML with clickable spans.
// Terms are matched longest-first so "Mars Express" beats "Mars".
// Each term is only linked once per text block (first occurrence).
export function linkifyCodex(html) {
  const linked = new Set();
  let result = html;
  for (const term of CODEX_TERMS) {
    if (linked.has(term)) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!data-term=")\\b(${escaped})\\b`, '');
    if (regex.test(result)) {
      result = result.replace(regex,
        `<span class="codex-term" data-term="${term}" tabindex="0" role="button">$1</span>`);
      linked.add(term);
    }
  }
  return result;
}

// Show a small popup with extended info for a codex term.
let activePopup = null;

export function showCodexPopup(term, anchorEl) {
  closeCodexPopup();
  const entry = CODEX[term];
  if (!entry) return;

  const popup = document.createElement('div');
  popup.className = 'codex-popup';
  popup.innerHTML = `
    <div class="codex-popup-header">
      <span class="codex-popup-title">${term.toUpperCase()}</span>
      <button class="codex-popup-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="codex-popup-body">${entry}</div>
  `;

  document.body.appendChild(popup);
  activePopup = popup;

  popup.querySelector('.codex-popup-close').addEventListener('click', closeCodexPopup);

  // Close on click outside after a short delay (prevents immediate close from same click).
  setTimeout(() => {
    document.addEventListener('click', onOutsideClick);
  }, 50);
}

export function closeCodexPopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
  document.removeEventListener('click', onOutsideClick);
}

function onOutsideClick(e) {
  if (activePopup && !activePopup.contains(e.target) && !e.target.classList.contains('codex-term')) {
    closeCodexPopup();
  }
}

// Global delegation: any click on a .codex-term anywhere in the DOM opens the popup.
document.addEventListener('click', (e) => {
  const el = e.target.closest('.codex-term');
  if (!el) return;
  e.stopPropagation();
  const term = el.dataset.term;
  if (term) showCodexPopup(term, el);
});
