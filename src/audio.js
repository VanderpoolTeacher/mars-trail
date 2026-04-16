// Mars Trail — music manager.
// Single <audio> element, looped. Track selection + mute persisted to localStorage.

const STORAGE_KEY_TRACK = 'marsTrail.musicTrack';
const STORAGE_KEY_MUTE  = 'marsTrail.musicMute';

export const TITLE_TRACK = {
  id: 'title', name: 'Title Theme', file: 'assets/music/title-screen.mp3'
};

export const GAMEPLAY_TRACKS = [
  { id: 'vacuum',    name: 'Vacuum Lullaby',    file: 'assets/music/Vacuum Lullaby.mp3' },
  { id: 'choir',     name: 'Vacuum Choir',      file: 'assets/music/Vacuum Choir.mp3' },
  { id: 'void',      name: 'Void Algebra',      file: 'assets/music/Void Algebra.mp3' },
  { id: 'star',      name: 'Star-Salt Silence',  file: 'assets/music/Star-Salt Silence.mp3' },
  { id: 'voidbread', name: 'Voidbread Hymn',    file: 'assets/music/Voidbread Hymn.mp3' }
];

const audio = new Audio();
audio.loop = true;
audio.volume = 0.4;

let currentTrackId = null;
let unlocked = false;   // audio context unlocked by first user interaction

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
  audio.muted = isMuted();
  audio.play().catch(() => {});
  unlocked = true;
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
  play(getSelectedTrackId());
}

export function fadeOut(durationMs = 1500) {
  return new Promise(resolve => {
    const startVol = audio.volume;
    const steps = 30;
    const interval = durationMs / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(timer);
        audio.pause();
        audio.volume = startVol;
        resolve();
      }
    }, interval);
  });
}

export function fadeInGameplay(durationMs = 1500) {
  const trackId = getSelectedTrackId();
  const track = GAMEPLAY_TRACKS.find(t => t.id === trackId);
  if (!track) return;
  currentTrackId = track.id;
  audio.src = track.file;
  audio.muted = isMuted();
  audio.volume = 0;
  audio.play().catch(() => {});
  const targetVol = 0.4;
  const steps = 30;
  const interval = durationMs / steps;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    audio.volume = Math.min(targetVol, targetVol * (step / steps));
    if (step >= steps) clearInterval(timer);
  }, interval);
}

export function isUnlocked() { return unlocked; }
