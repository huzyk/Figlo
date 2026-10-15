import { currentDateKey, dateFromKey } from '../daily.js';

export const FIRST_CHALLENGE_DATE = '2026-08-24';
const modes = new Set(['daily', 'training', 'challenge']);
const parameters = () => new URLSearchParams(globalThis.location?.search || '');

export function requestedGameMode() {
  const params = parameters();
  if (params.has('challenge')) return 'challenge';
  return params.get('mode') === 'training' ? 'training' : 'daily';
}

function validChallengeDate(value) {
  return Boolean(dateFromKey(value)) && value >= FIRST_CHALLENGE_DATE && value <= currentDateKey();
}

// Invalid links still reach the normal loading error UI; they never choose an
// unvalidated date for a generator or become an ordinary daily round.
export function requestedPuzzleDate() {
  const value = parameters().get('challenge');
  return requestedGameMode() === 'challenge' && validChallengeDate(value) ? value : currentDateKey();
}

export function validateChallengeRecord(record) {
  if (requestedGameMode() !== 'challenge') return record;
  const params = parameters(), date = params.get('challenge'), version = params.get('v');
  if (!validChallengeDate(date)) {
    throw new Error(`Wyzwanie ma nieprawidłową datę. Dostępne są plansze od ${FIRST_CHALLENGE_DATE} do ${currentDateKey()}.`);
  }
  if (!version) throw new Error('W linku do wyzwania brakuje wersji planszy. Poproś znajomego o nowy link.');
  if (!record?.puzzleId || version !== record.puzzleId) {
    throw new Error('Ta wersja wyzwania nie jest już dostępna. Poproś znajomego o nowy link — nie zamieniliśmy planszy na inną.');
  }
  if (record.date && record.date !== date) throw new Error('Data planszy nie zgadza się z linkiem do wyzwania.');
  return record;
}

export function challengeRoundLabel() {
  return `Wyzwanie · ${requestedPuzzleDate()}`;
}

export function showChallengeError(error) {
  if (requestedGameMode() !== 'challenge') return false;
  const message = error?.message || 'Nie udało się otworzyć tego wyzwania. Poproś znajomego o nowy link.';
  const target = document.querySelector('#loadError') || document.querySelector('#feedback');
  if (target) {
    target.hidden = false;
    target.textContent = message;
    target.setAttribute('role', 'alert');
  }
  const board = document.querySelector('#board');
  if (board) {
    board.replaceChildren();
    board.setAttribute('aria-disabled', 'true');
    board.inert = true;
  }
  for (const control of document.querySelectorAll('#hint,#mobileHint,#undo,#mobileUndo,#reset,#mobileReset,#keypad button')) control.disabled = true;
  return true;
}

export function setGameMode(mode, { date = requestedPuzzleDate(), puzzleId = '' } = {}) {
  const normalized = modes.has(mode) ? mode : 'daily';
  Object.assign(document.documentElement.dataset, { gameMode: normalized, gameDate: date, gamePuzzleId: puzzleId });
  return normalized;
}

export function getGameMode() {
  const mode = document.documentElement.dataset.gameMode;
  return modes.has(mode) ? mode : 'daily';
}

export function getGameDate() {
  return document.documentElement.dataset.gameDate || currentDateKey();
}

export function getGamePuzzleId() {
  return document.documentElement.dataset.gamePuzzleId || null;
}

