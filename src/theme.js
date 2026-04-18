// Tractus Martis — theme switcher (Mission Control / LCARS / Voltron).
// Persists choice to localStorage. Toggled via button in topbar.

const STORAGE_KEY = 'marsTrail.theme';
const THEMES = ['mc', 'lcars', 'voltron'];

const NEXT_LABEL = {
  mc:      'TNG SKIN',
  lcars:   'VLD SKIN',
  voltron: 'MC SKIN'
};

function load() {
  const raw = localStorage.getItem(STORAGE_KEY) || 'mc';
  return THEMES.includes(raw) ? raw : 'mc';
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
  if (btn) btn.textContent = NEXT_LABEL[theme] || 'MC SKIN';
}

function cycle() {
  const current = load();
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  save(next);
  apply(next);
}

export function initTheme() {
  apply(load());
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.addEventListener('click', cycle);
}

initTheme();
