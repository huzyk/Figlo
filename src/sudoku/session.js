import {snapshotSessionTimer} from '../ui/session-timer.js';
import {SIZE,CELL_COUNT} from './engine.js';
const KEY = 'puzli_sudoku_session_v2:';
const emptyNotes = () => Array(CELL_COUNT).fill(0);
export function createSudokuSession({date,seed,puzzle}) {
  return {date,seed,values:[...puzzle],notes:emptyNotes(),history:[],elapsedMs:0,
    runningSince:null,startedAt:null,finished:false,hintsUsed:0,resets:0};
}
export function loadSudokuSession({date,seed,puzzle}) {
  let data = null;
  try {data = JSON.parse(localStorage.getItem(KEY + date) || 'null');} catch {}
  if (!data || data.date !== date || data.seed !== seed ||
    !Array.isArray(data.values) || data.values.length !== CELL_COUNT ||
    !Array.isArray(data.notes) || data.notes.length !== CELL_COUNT) {
    return createSudokuSession({date,seed,puzzle});
  }
  if (puzzle.some((given, index) => given && data.values[index] !== given)) {
    return createSudokuSession({date,seed,puzzle});
  }
  data.values = data.values.map((v,i) => puzzle[i] || (Number.isInteger(v) && v >= 0 && v <= SIZE ? v : 0));
  data.notes = data.notes.map(v => Number.isInteger(v) && v >= 0 && v < (1 << (SIZE + 1)) ? v : 0);
  if (!Array.isArray(data.history)) data.history = [];
  data.history = data.history.slice(-80).filter(h =>
    h && Array.isArray(h.values) && h.values.length === CELL_COUNT && Array.isArray(h.notes) && h.notes.length === CELL_COUNT);
  data.elapsedMs = Number.isFinite(data.elapsedMs)?Math.max(0,data.elapsedMs):0;
  data.runningSince = null; // Browser was closed; do not include time away from game.
  data.hintsUsed = Number.isFinite(data.hintsUsed)?Math.max(0,Math.floor(data.hintsUsed)):0;
  data.resets = Number.isFinite(data.resets)?Math.max(0,Math.floor(data.resets)):0;
  return data;
}
export function saveSudokuSession(session) {
  try {localStorage.setItem(KEY + session.date,JSON.stringify({
    ...snapshotSessionTimer(session),history:session.history.slice(-80)
  })); return true;} catch {return false;}
}
export function clearSudokuSession(date) {try {localStorage.removeItem(KEY + date);} catch {}}

