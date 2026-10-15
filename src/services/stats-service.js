import { activityStreak } from '../domain/rewards.js';
import { dayDifference } from '../daily.js';
import { getGameAverageTime, loadFigloState } from '../storage.js';

export function getUserStats(dateKey) {
  const state = loadFigloState(dateKey);
  const gameIds = Object.keys(state.games || {});
  const timed = gameIds.map(id => ({ id, avg: getGameAverageTime(state, id), count: state.games[id]?.timedCompletions || 0 })).filter(item => item.avg && item.count);
  const weightedTotal = timed.reduce((sum, item) => sum + item.avg * item.count, 0);
  const weightedCount = timed.reduce((sum, item) => sum + item.count, 0);
  return {
    streak: [0, 1].includes(dayDifference(state.user.lastCompletedDate, dateKey)) ? state.user.streak : 0,
    bestStreak: state.user.bestStreak,
    activityStreak: activityStreak(state, dateKey),
    bestActivityStreak: state.user.bestActiveStreak || 0,
    activeDates: [...(state.user.activeDates || [])],
    completedDays: state.user.completedDays,
    completedGames: state.user.completedGames,
    completedDates: [...state.user.completedDates],
    averageGameTimeMs: weightedCount ? Math.round(weightedTotal / weightedCount) : null,
    games: state.games,
    state
  };
}
