// Mars Trail — music manager.
// Title loops. Gameplay plays a shuffled queue that reshuffles each run
// and avoids back-to-back repeats across cycle boundaries.

const STORAGE_KEY_TRACK = 'marsTrail.musicTrack';
const STORAGE_KEY_MUTE  = 'marsTrail.musicMute';

export const TITLE_TRACK = {
  id: 'title', name: 'Title Theme', file: 'assets/music/title-screen.mp3'
};

export const GAMEPLAY_TRACKS = [
  { id: 'vacuum',    name: 'Vacuum Lullaby',    file: 'assets/music/Vacuum Lullaby.mp3' },
  { id: 'choir',     name: 'Vacuum Choir',      file: 'assets/music/Vacuum Choir.mp3' },
  { id: 'violin',    name: 'Vacuum Violin',     file: 'assets/music/Vacuum Violin.mp3' },
  { id: 'void',      name: 'Void Algebra',      file: 'assets/music/Void Algebra.mp3' },
  { id: 'star',      name: 'Star-Salt Silence',  file: 'assets/music/Star-Salt Silence.mp3' },
  { id: 'crater',    name: 'Crater Tongue',     file: 'assets/music/Crater Tongue.mp3' },
  { id: 'voidbread', name: 'Voidbread Hymn',    file: 'assets/music/Voidbread Hymn.mp3' }
];

const audio = new Audio();
audio.volume = 0.4;

let currentTrackId = null;
let unlocked = false;   // audio context unlocked by first user interaction
let shuffleQueue = [];  // remaining gameplay tracks in current shuffled cycle

const trackChangeListeners = [];
export function onTrackChange(cb) { trackChangeListeners.push(cb); }
function notifyTrackChange(id) { trackChangeListeners.forEach(cb => { try { cb(id); } catch {} }); }

function buildShuffleQueue(avoidFirstId = null) {
  const ids = GAMEPLAY_TRACKS.map(t => t.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // Avoid back-to-back repeat across cycle boundary.
  if (avoidFirstId && ids.length > 1 && ids[0] === avoidFirstId) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }
  return ids;
}

function nextShuffledId() {
  if (shuffleQueue.length === 0) {
    shuffleQueue = buildShuffleQueue(currentTrackId);
  }
  let next = shuffleQueue.shift();
  // Defensive: if the user jumped to a track that's also next in queue,
  // swap so we don't play it twice in a row.
  if (next === currentTrackId && shuffleQueue.length > 0) {
    const after = shuffleQueue.shift();
    shuffleQueue.unshift(next);
    next = after;
  }
  return next;
}

audio.addEventListener('ended', () => {
  if (currentTrackId === 'title') return; // title loops; shouldn't fire
  play(nextShuffledId());
});

export function getSelectedTrackId() {
  return localStorage.getItem(STORAGE_KEY_TRACK) || GAMEPLAY_TRACKS[0].id;
}

export function isMuted() {
  return localStorage.getItem(STORAGE_KEY_MUTE) === '1';
}

export function play(trackId) {
  const track = trackId === 'title'
    ? TITLE_TRACK
    : GAMEPLAY_TRACKS.find(t => t.id === trackId);
  if (!track) return;
  if (currentTrackId === track.id && !audio.paused) return;

  currentTrackId = track.id;
  audio.src = track.file;
  audio.loop = (track.id === 'title'); // title loops; gameplay advances via 'ended'
  audio.muted = isMuted();
  audio.play().catch(() => {});
  unlocked = true;
  notifyTrackChange(track.id);
}

export function stop() {
  audio.pause();
  audio.currentTime = 0;
  currentTrackId = null;
}

export function setMuted(muted) {
  localStorage.setItem(STORAGE_KEY_MUTE, muted ? '1' : '0');
  audio.muted = muted;
}

export function toggleMute() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export function selectTrack(trackId) {
  localStorage.setItem(STORAGE_KEY_TRACK, trackId);
  if (currentTrackId !== 'title') {
    play(trackId);
  }
}

export function cycleTrack(direction) {
  const current = getSelectedTrackId();
  const idx = GAMEPLAY_TRACKS.findIndex(t => t.id === current);
  const next = (idx + direction + GAMEPLAY_TRACKS.length) % GAMEPLAY_TRACKS.length;
  selectTrack(GAMEPLAY_TRACKS[next].id);
  return GAMEPLAY_TRACKS[next].id;
}

export function playTitle() {
  play('title');
}

export function playGameplay() {
  // Start a fresh shuffled cycle each time gameplay music begins.
  shuffleQueue = buildShuffleQueue(currentTrackId);
  play(shuffleQueue.shift());
}

// Shared fade timer so a new fade cancels any in-flight fade.
let currentFadeTimer = null;

function clearFade() {
  if (currentFadeTimer) { clearInterval(currentFadeTimer); currentFadeTimer = null; }
}

export function fadeOut(durationMs = 1500) {
  return new Promise(resolve => {
    clearFade();
    const startVol = audio.volume;
    const steps = 30;
    const interval = durationMs / steps;
    let step = 0;
    currentFadeTimer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearFade();
        audio.pause();
        audio.volume = startVol;
        resolve();
      }
    }, interval);
  });
}

export function fadeInGameplay(durationMs = 1500) {
  clearFade();
  // New run: reshuffle track order.
  shuffleQueue = buildShuffleQueue(currentTrackId);
  const trackId = shuffleQueue.shift();
  const track = GAMEPLAY_TRACKS.find(t => t.id === trackId);
  if (!track) return;
  currentTrackId = track.id;
  audio.src = track.file;
  audio.loop = false;
  audio.muted = isMuted();
  audio.volume = 0;
  audio.play().catch(() => {});
  notifyTrackChange(track.id);
  const targetVol = 0.4;
  const steps = 30;
  const interval = durationMs / steps;
  let step = 0;
  currentFadeTimer = setInterval(() => {
    step++;
    audio.volume = Math.min(targetVol, targetVol * (step / steps));
    if (step >= steps) clearFade();
  }, interval);
}

export function isUnlocked() { return unlocked; }
