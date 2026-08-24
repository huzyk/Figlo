import { dayDifference } from '../daily.js';

export function calculateNextStreak({ previousStreak = 0, bestStreak = 0, lastCompletedDate = null, today }) {
  const difference = dayDifference(lastCompletedDate, today);
  const current = difference === 1 ? previousStreak + 1 : 1;
  return { current, best: Math.max(bestStreak, current) };
}
