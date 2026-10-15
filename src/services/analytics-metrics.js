// Strict allowlist: never forward localId, eventId, raw URLs, search terms or free text.
const EVENTS = new Set([
  'home_opened', 'game_selected', 'game_opened', 'game_started',
  'game_training_started', 'hint_used', 'game_completed', 'daily_completed',
  'game_load_failed', 'daily_visit', 'day_1_return', 'day_7_return',
  'player_activated', 'activation_day_1_return', 'activation_day_7_return',
  'share_started', 'share_native_completed', 'share_copied', 'share_cancelled',
  'share_manual_fallback', 'shared_result_opened'
]);
const GAMES = new Set(['korony', 'duet', 'bloki', 'latarnie', 'zip', 'sudoku']);
const MODES = new Set(['daily', 'training', 'challenge']);

export function toGA4Event(event) {
  if (!event || !EVENTS.has(event.eventName)) return null;
  const payload = event.payload || {};
  const params = {};
  if (GAMES.has(payload.gameId)) params.game_id = payload.gameId;
  if (MODES.has(payload.mode)) params.game_mode = payload.mode;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || ''))) params.puzzle_date = payload.date;
  if (Number.isFinite(payload.elapsedMs) && payload.elapsedMs >= 0)
    params.elapsed_seconds = Math.round(payload.elapsedMs / 1000);
  if (Number.isInteger(payload.hintsUsed) && payload.hintsUsed >= 0)
    params.hints_used = payload.hintsUsed;
  return { name: event.eventName, params };
}

export function visitEvents({ firstDay = null, lastDay = null, today }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return [];
  if (lastDay === today) return [];
  const first = /^\d{4}-\d{2}-\d{2}$/.test(String(firstDay || '')) ? firstDay : today;
  const daysSinceFirst = Math.round((
    Date.parse(today + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')
  ) / 86400000);
  const events = ['daily_visit'];
  if (daysSinceFirst === 1) events.push('day_1_return');
  if (daysSinceFirst === 7) events.push('day_7_return');
  return events;
}

// These events require an actual daily completion, not merely a page visit.
export function activationEvents({ firstCompletionDay = null, lastActiveDay = null, today }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) || lastActiveDay === today) return [];
  if (!firstCompletionDay) return ['player_activated'];
  const gap = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(firstCompletionDay + 'T00:00:00Z')) / 86400000);
  if (gap === 1) return ['activation_day_1_return'];
  if (gap === 7) return ['activation_day_7_return'];
  return [];
}

export function analyticsPageUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin + url.pathname : '';
  } catch { return ''; }
}

