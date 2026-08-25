const WEEKLY_LEVELS = ['challenge','easy','easy','medium','medium','medium-hard','hard'];

const GAME_LEVELS = {
  korony: { easy:'easy', medium:'medium', 'medium-hard':'hard', hard:'hard', challenge:'hard' },
  duet: { easy:'easy', medium:'medium', 'medium-hard':'medium', hard:'hard', challenge:'hard' },
  bloki: { easy:'easy', medium:'medium', 'medium-hard':'hard', hard:'hard', challenge:'hard' }
};

export function weekdayForDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) throw new Error(`Nieprawidłowa data trudności: ${dateKey}`);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function weeklyDifficultyForDate(dateKey) {
  return WEEKLY_LEVELS[weekdayForDateKey(dateKey)];
}

export function difficultyForGameDate(gameId, dateKey) {
  const weekly = weeklyDifficultyForDate(dateKey);
  return GAME_LEVELS[gameId]?.[weekly] || 'medium';
}

export function difficultyLabel(level) {
  return ({ easy:'Łatwy', medium:'Średni', hard:'Trudny', challenge:'Wyzwanie' })[level] || level;
}

export { WEEKLY_LEVELS };
