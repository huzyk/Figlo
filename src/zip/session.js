import { snapshotSessionTimer } from '../ui/session-timer.js';

const KEY = 'figlo_zip_session_v1';
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function createZipSession({date, seed} = {}) {
  return {date, seed, path: [], history: [], elapsedMs: 0, runningSince: null,
    startedAt: null, finished: false, hintsUsed: 0, resets: 0};
}

function clean(raw, {date, seed}) {
  const initial = createZipSession({date, seed});
  if (!raw || raw.date !== date || raw.seed !== seed) return initial;
  return {...initial, ...raw,
    path: Array.isArray(raw.path) ? raw.path.filter(Number.isInteger) : [],
    history: Array.isArray(raw.history) ? raw.history.filter(Array.isArray).slice(-100).map(path => path.filter(Number.isInteger)) : [],
    elapsedMs: count(raw.elapsedMs),
    runningSince: null,
    hintsUsed: count(raw.hintsUsed),
    resets: count(raw.resets)};
}

export function loadZipSession({date, seed}) {
  try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null'), {date, seed}); }
  catch { return createZipSession({date, seed}); }
}

export function saveZipSession(session) {
  try { localStorage.setItem(KEY, JSON.stringify(snapshotSessionTimer(session))); return true; }
  catch { return false; }
}

export function clearZipSession() {
  try { localStorage.removeItem(KEY); } catch {}
}

