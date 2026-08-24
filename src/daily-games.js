export const DUET_LAUNCH_DATE = '2026-08-24';

export function requiredGamesForDate(dateKey) {
  if (String(dateKey) < DUET_LAUNCH_DATE) return ['korony'];
  return ['korony', 'duet'];
}
