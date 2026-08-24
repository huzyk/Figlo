import { completeDailyGame, isTodayComplete, loadFigloState } from '../storage.js';
import { createCompletionEvent } from '../domain/completion.js';

export function getDailyProgress(dateKey) {
  const state = loadFigloState(dateKey);
  return {
    date: state.daily.date,
    completedGames: [...state.daily.completedGames],
    requiredGames: [...state.daily.requiredGames],
    complete: isTodayComplete(state),
    state
  };
}

export function completeGame({ gameId, puzzleId, date, elapsedMs = null, mode = 'daily', startedAt = null }) {
  const event = createCompletionEvent({ gameId, puzzleId, date, elapsedMs, mode, startedAt });
  const result = completeDailyGame(gameId, { timeMs: elapsedMs, today: date });
  return { ...result, event };
}
