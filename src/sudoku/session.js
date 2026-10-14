const KEY = 'puzli_sudoku_session_v1:';
const emptyNotes = () => Array(81).fill(0);
export function createSudokuSession({date,seed,puzzle}) {
  return {date,seed,values:[...puzzle],notes:emptyNotes(),history:[],elapsedMs:0,
    runningSince:null,startedAt:null,finished:false,hintsUsed:0};
}
export function loadSudokuSession({date,seed,puzzle}) {
  let data = null;
  try {data = JSON.parse(localStorage.getItem(KEY + date) || 'null');} catch {}
  if (!data || data.date !== date || data.seed !== seed ||
    !Array.isArray(data.values) || data.values.length !== 81 ||
    !Array.isArray(data.notes) || data.notes.length !== 81) {
    return createSudokuSession({date,seed,puzzle});
  }
  if (puzzle.some((given, index) => given && data.values[index] !== given)) {
    return createSudokuSession({date,seed,puzzle});
  }
  data.values = data.values.map((v,i) => puzzle[i] || (Number.isInteger(v) && v >= 0 && v <= 9 ? v : 0));
  data.notes = data.notes.map(v => Number.isInteger(v) && v >= 0 && v < 1024 ? v : 0);
  if (!Array.isArray(data.history)) data.history = [];
  data.history = data.history.slice(-80).filter(h =>
    Array.isArray(h.values) && h.values.length === 81 && Array.isArray(h.notes) && h.notes.length === 81);
  data.elapsedMs = Math.max(0,Number(data.elapsedMs)||0);
  data.runningSince = null; // Browser was closed; do not include time away from game.
  data.hintsUsed = Math.max(0,Number(data.hintsUsed)||0);
  return data;
}
export function saveSudokuSession(session) {
  try {localStorage.setItem(KEY + session.date,JSON.stringify({
    ...session,runningSince:null,history:session.history.slice(-80)
  })); return true;} catch {return false;}
}
export function clearSudokuSession(date) {try {localStorage.removeItem(KEY + date);} catch {}}
