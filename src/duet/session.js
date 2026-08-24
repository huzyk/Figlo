import { EMPTY, SIZE } from './constants.js';
import { getDuetSession, saveDuetSession, clearDuetSession } from '../storage.js';

export function createDuetSession({ date, seed, givens = [] }) {
  const board = Array(SIZE * SIZE).fill(EMPTY);
  for (const given of givens) board[given.index] = given.value;
  return { date, seed, board, history: [], elapsedMs: 0, runningSince: null, finished: false };
}

export function restoreOrCreateDuetSession({ date, seed, givens }) {
  return getDuetSession({ today: date, seed }) || createDuetSession({ date, seed, givens });
}

export { saveDuetSession, clearDuetSession };
