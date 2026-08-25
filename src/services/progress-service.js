import { completeDailyGame, isTodayComplete, loadFigloState, saveFigloState } from '../storage.js';
import { createCompletionEvent } from '../domain/completion.js';

const emptyGameStats=()=>({bestTimeMs:null,completedCount:0,totalTimeMs:0,timedCompletions:0,lastCompletedDate:null});

export function getDailyProgress(dateKey) {
  const state = loadFigloState(dateKey);
  return { date: state.daily.date, completedGames: [...state.daily.completedGames], requiredGames: [...state.daily.requiredGames], complete: isTodayComplete(state), state };
}

export function completeGame({ gameId, puzzleId, date, elapsedMs = null, mode = 'daily', startedAt = null }) {
  const event = createCompletionEvent({ gameId, puzzleId, date, elapsedMs, mode, startedAt });
  if (mode !== 'daily') return { state: loadFigloState(date), firstGameCompletionToday: false, firstDayCompletionToday: false, event };
  const state=loadFigloState(date);
  if(!state.games[gameId]){state.games[gameId]=emptyGameStats();saveFigloState(state);}
  const result = completeDailyGame(gameId, { timeMs: elapsedMs, today: date });
  return { ...result, event };
}
