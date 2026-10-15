import { dailyPuzzleSeed } from '../daily.js';
import { difficultyForGameDate } from '../difficulty-schedule.js';

// New rounds use v2 so previously published boards and challenge links stay intact.
export const CROWNS_EASIER_FROM = '2026-10-16';

export function crownDailyConfig(dateKey) {
  const legacy = dateKey < CROWNS_EASIER_FROM;
  const previousDifficulty = difficultyForGameDate('korony', dateKey);
  const difficulty = legacy ? previousDifficulty : ({
    easy: 'easy',
    medium: 'easy',
    hard: 'medium'
  }[previousDifficulty] || 'medium');
  return {
    seed: legacy ? dailyPuzzleSeed('korony', dateKey) : `figlo:korony:${dateKey}:v2`,
    version: legacy ? 1 : 2,
    difficulty
  };
}
