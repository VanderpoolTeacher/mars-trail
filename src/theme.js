// Mars Trail — theme switcher (mission control ↔ LCARS)
// Persists choice to localStorage. Toggled via button in topbar.

const STORAGE_KEY = 'marsTrail.theme';
const THEMES = ['mc', 'lcars'];   // 'mc' = mission control (default), 'lcars' = TNG

function load() {
  return localStorage.getItem(STORAGE_KEY) || 'mc';
}

function save(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

function apply(theme) {
  if (theme === 'mc') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', theme);
  }
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = theme === 'mc' ? 'TNG SKIN' : 'MC SKIN';
}

function toggle() {
  const current = load();
  const next = current === 'mc' ? 'lcars' : 'mc';
  save(next);
  apply(next);
}

export function initTheme() {
  apply(load());
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.addEventListener('click', toggle);
}

initTheme();
