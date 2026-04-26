// Mars Trail — The Lounge: a themed soundtrack jukebox screen.
// Renders into #lounge-layer. Selecting a row calls audio.selectTrack
// so playback continues seamlessly when the player closes the Lounge.

import {
  TITLE_TRACK,
  GAMEPLAY_TRACKS,
  selectTrack,
  play,
  togglePlayPause,
  isPlaying,
  isMuted,
  toggleMute,
  cycleTrack,
  onTrackChange,
  onTimeUpdate,
  seekTo,
  getCurrentTrackId,
  getDuration,
  getCurrentTime,
  isSfxMuted,
  toggleSfx
} from '../audio.js';
import { getFlavor } from '../content/trackFlavor.js';
import { getActiveTheme, setActiveTheme, THEMES } from '../theme.js';
import { startVisualizer, stopVisualizer, popBubbleAt, addBubble, removeBubble } from './visualizer.js';

const ALL_TRACKS = [TITLE_TRACK, ...GAMEPLAY_TRACKS];

let opened = false;
let onCloseCb = null;

// Listeners are registered exactly once at module load. They no-op
// whenever the Lounge is closed, so re-opening doesn't accumulate them.
onTrackChange(() => {
  if (!opened) return;
  refreshNowPlaying();
  refreshPlayPause();
});
onTimeUpdate((cur, dur) => {
  if (!opened) return;
  refreshProgress(cur, dur);
});

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function render() {
  const layer = document.getElementById('lounge-layer');
  if (!layer) return;
  const theme = getActiveTheme();

  const rows = ALL_TRACKS.map(t => `
    <li class="lounge-row" data-track="${t.id}">
      <div class="lounge-row-main">
        <span class="lounge-row-name">${escapeHtml(t.name)}</span>
        <span class="lounge-row-flavor">${escapeHtml(getFlavor(t.id, theme))}</span>
      </div>
      <span class="lounge-row-indicator" aria-hidden="true">▶</span>
    </li>
  `).join('');

  layer.innerHTML = `
    <div class="lounge-screen">
      <header class="lounge-header">
        <h1 class="lounge-title">THE LOUNGE</h1>
        <div class="lounge-header-actions">
          <label class="lounge-theme-label">
            THEME
            <select class="lounge-theme-select" id="lounge-theme-select" aria-label="Interface theme">
              ${THEMES.map(t => `<option value="${t.id}" ${t.id === theme ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
            </select>
          </label>
          <button class="lounge-close" id="lounge-close" type="button" aria-label="Close the Lounge">CLOSE ✕</button>
        </div>
      </header>

      <section class="lounge-now-playing" id="lounge-now-playing" aria-live="polite">
        <div class="lounge-np-text">
          <div class="lounge-np-label">NOW PLAYING</div>
          <div class="lounge-np-name"  id="lounge-np-name">—</div>
          <div class="lounge-np-flavor" id="lounge-np-flavor"></div>
          <div class="lounge-progress-row">
            <span class="lounge-time" id="lounge-time-current">0:00</span>
            <div class="lounge-progress" id="lounge-progress" role="slider"
                 aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="lounge-progress-fill" id="lounge-progress-fill"></div>
            </div>
            <span class="lounge-time" id="lounge-time-total">0:00</span>
          </div>
          <div class="lounge-controls">
            <button class="lounge-ctrl" id="lounge-prev"  type="button" aria-label="Previous track">⏮</button>
            <button class="lounge-ctrl lounge-ctrl-play" id="lounge-playpause" type="button" aria-label="Play/Pause">⏸</button>
            <button class="lounge-ctrl" id="lounge-next"  type="button" aria-label="Next track">⏭</button>
            <button class="lounge-ctrl" id="lounge-mute"  type="button" aria-label="Mute/Unmute">🔊</button>
          </div>
        </div>
        <div class="lounge-visualizer-wrap">
          <div class="lounge-visualizer-frame" id="lounge-visualizer-frame">
            <canvas class="lounge-visualizer" id="lounge-visualizer" aria-hidden="true"></canvas>
          </div>
          <div class="lounge-visualizer-footer">
            <span class="lounge-visualizer-hint">POP BUBBLES BEFORE THEY HIT THE DIAMOND · F FULLSCREEN</span>
            <button class="lounge-sfx-btn" id="lounge-sfx" type="button" aria-label="Toggle pop sounds" title="Toggle pop sounds">${isSfxMuted() ? '🔇' : '🔊'}</button>
          </div>
        </div>
      </section>

      <section class="lounge-list-section">
        <h2 class="lounge-list-header">SOUNDTRACK</h2>
        <ul class="lounge-list" id="lounge-list">${rows}</ul>
      </section>
    </div>
  `;

  wire();
  refreshNowPlaying();
  refreshPlayPause();
  refreshMute();
  refreshProgress();
}

function wire() {
  const layer = document.getElementById('lounge-layer');

  layer.querySelector('#lounge-close').addEventListener('click', close);

  layer.querySelector('#lounge-theme-select').addEventListener('change', (e) => {
    setActiveTheme(e.target.value);
    stopVisualizer();
    render();
    const c = document.getElementById('lounge-visualizer');
    if (c) startVisualizer(c, getCurrentTrackId);
  });

  layer.querySelector('#lounge-list').addEventListener('click', (e) => {
    const row = e.target.closest('.lounge-row');
    if (!row) return;
    const id = row.dataset.track;
    if (id === 'title') {
      play('title');
    } else {
      selectTrack(id);
    }
  });

  layer.querySelector('#lounge-prev').addEventListener('click', () => cycleTrack(-1));
  layer.querySelector('#lounge-next').addEventListener('click', () => cycleTrack(1));
  layer.querySelector('#lounge-playpause').addEventListener('click', () => {
    togglePlayPause();
    refreshPlayPause();
  });
  layer.querySelector('#lounge-mute').addEventListener('click', () => {
    toggleMute();
    refreshMute();
  });

  const visFrame = layer.querySelector('#lounge-visualizer-frame');
  visFrame.addEventListener('click', (e) => {
    const rect = visFrame.getBoundingClientRect();
    popBubbleAt(e.clientX - rect.left, e.clientY - rect.top);
  });

  const sfxBtn = layer.querySelector('#lounge-sfx');
  sfxBtn.addEventListener('click', () => {
    const muted = toggleSfx();
    sfxBtn.textContent = muted ? '🔇' : '🔊';
  });

  // Seek by clicking anywhere on the progress bar.
  const bar = layer.querySelector('#lounge-progress');
  const seekFromEvent = (e) => {
    const rect = bar.getBoundingClientRect();
    const x = (e.clientX ?? (e.touches?.[0]?.clientX ?? 0)) - rect.left;
    seekTo(Math.max(0, Math.min(1, x / rect.width)));
  };
  bar.addEventListener('click', seekFromEvent);

  // Drag-to-scrub.
  let dragging = false;
  bar.addEventListener('mousedown', (e) => { dragging = true; seekFromEvent(e); });
  window.addEventListener('mousemove', (e) => { if (dragging) seekFromEvent(e); });
  window.addEventListener('mouseup',   () => { dragging = false; });
}

function escClose(e) {
  if (!opened) return;
  if (e.key === 'Escape') {
    // If in fullscreen, let the browser handle ESC (it'll exit fullscreen);
    // only close the Lounge when not in fullscreen.
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) close();
    return;
  }
  if (e.key === 'f' || e.key === 'F') {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT')) return;
    e.preventDefault();
    const frame = document.getElementById('lounge-visualizer-frame');
    if (!frame) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (frame.requestFullscreen || frame.webkitRequestFullscreen).call(frame);
    }
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT')) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') addBubble(); else removeBubble();
  }
}

function refreshNowPlaying() {
  const id = getCurrentTrackId();
  const track = ALL_TRACKS.find(t => t.id === id);
  const layer = document.getElementById('lounge-layer');
  if (!layer || !layer.querySelector('#lounge-np-name')) return;

  layer.querySelector('#lounge-np-name').textContent = track ? track.name : '—';
  layer.querySelector('#lounge-np-flavor').textContent = track ? getFlavor(track.id, getActiveTheme()) : '';

  layer.querySelectorAll('.lounge-row').forEach(row => {
    row.classList.toggle('playing', row.dataset.track === id);
  });
}

function refreshProgress(current, duration) {
  const layer = document.getElementById('lounge-layer');
  if (!layer || !layer.querySelector('#lounge-progress-fill')) return;

  const cur = (current !== undefined) ? current : getCurrentTime();
  const dur = (duration !== undefined) ? duration : getDuration();
  const pct = (dur > 0) ? Math.min(100, (cur / dur) * 100) : 0;

  layer.querySelector('#lounge-progress-fill').style.width = `${pct}%`;
  layer.querySelector('#lounge-progress').setAttribute('aria-valuenow', pct.toFixed(0));
  layer.querySelector('#lounge-time-current').textContent = fmtTime(cur);
  layer.querySelector('#lounge-time-total').textContent   = fmtTime(dur);
}

function refreshPlayPause() {
  const layer = document.getElementById('lounge-layer');
  const el = layer && layer.querySelector('#lounge-playpause');
  if (!el) return;
  el.textContent = isPlaying() ? '⏸' : '▶';
}

function refreshMute() {
  const layer = document.getElementById('lounge-layer');
  const el = layer && layer.querySelector('#lounge-mute');
  if (!el) return;
  el.textContent = isMuted() ? '🔇' : '🔊';
}

export function openLounge(onClose) {
  if (opened) return;
  opened = true;
  onCloseCb = onClose || null;

  const layer = document.getElementById('lounge-layer');
  layer.classList.add('active');
  render();

  const canvas = layer.querySelector('#lounge-visualizer');
  if (canvas) startVisualizer(canvas, getCurrentTrackId);

  document.addEventListener('keydown', escClose);
}

export function close() {
  if (!opened) return;
  opened = false;
  stopVisualizer();
  const layer = document.getElementById('lounge-layer');
  if (layer) {
    layer.classList.remove('active');
    layer.innerHTML = '';
  }
  document.removeEventListener('keydown', escClose);
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
}

export function isLoungeOpen() { return opened; }
