// Mars Trail — music manager.
// Title loops. Gameplay plays a shuffled queue that reshuffles each run
// and avoids back-to-back repeats across cycle boundaries.

const STORAGE_KEY_TRACK = 'marsTrail.musicTrack';
const STORAGE_KEY_MUTE  = 'marsTrail.musicMute';
const STORAGE_KEY_SFX   = 'marsTrail.sfxMute';

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
  play(trackId);
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

// ---- Seek / progress / play-pause API (used by the Lounge) ----

const timeUpdateListeners = [];
export function onTimeUpdate(cb) { timeUpdateListeners.push(cb); }
audio.addEventListener('timeupdate', () => {
  timeUpdateListeners.forEach(cb => { try { cb(audio.currentTime, audio.duration || 0); } catch {} });
});

export function getCurrentTime() { return audio.currentTime || 0; }
export function getDuration()    { return audio.duration   || 0; }
export function getProgress()    {
  const d = audio.duration;
  return (d && isFinite(d)) ? (audio.currentTime / d) : 0;
}
export function seekTo(fraction) {
  const d = audio.duration;
  if (!d || !isFinite(d)) return;
  audio.currentTime = Math.max(0, Math.min(1, fraction)) * d;
}
export function isPlaying() { return !audio.paused; }
export function getCurrentTrackId() { return currentTrackId; }

export function pauseAudio() { audio.pause(); }
export function resumeAudio() {
  if (currentTrackId) audio.play().catch(() => {});
}
export function togglePlayPause() {
  if (audio.paused) resumeAudio(); else pauseAudio();
  return !audio.paused;
}

// ---- Web Audio analyser (used by the Lounge visualizer) ----
// Lazily wires the existing <audio> element through an AnalyserNode.
// Created on first call (which only happens after the user opens the
// Lounge — i.e., after a user gesture, satisfying autoplay policies).
let analyser = null;
let audioCtx = null;
let mediaSource = null;

export function getAnalyser() {
  if (analyser) return analyser;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx    = new AudioCtx();
    mediaSource = audioCtx.createMediaElementSource(audio);
    analyser    = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    mediaSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    return analyser;
  } catch (err) {
    // createMediaElementSource throws if called twice on the same element.
    // Anything else: degrade silently — visualizer falls back to backdrop-only.
    return analyser;
  }
}

export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// ---- SFX (game-action sounds, separate from music mute) ----

export function isSfxMuted() {
  return localStorage.getItem(STORAGE_KEY_SFX) === '1';
}

export function setSfxMuted(muted) {
  localStorage.setItem(STORAGE_KEY_SFX, muted ? '1' : '0');
}

export function toggleSfx() {
  const next = !isSfxMuted();
  setSfxMuted(next);
  return next;
}

function getSfxContext() {
  if (audioCtx) return audioCtx;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
    return audioCtx;
  } catch { return null; }
}

export function playSfx(kind) {
  if (isSfxMuted()) return;
  const ac = getSfxContext();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});

  const now = ac.currentTime;

  if (kind === 'good') {
    // Pleasant short pop — triangle wave, quick upward chirp.
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (kind === 'bad') {
    // Low thunk — square wave, downward slide.
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }
}
