import { dayDifference } from '../daily.js';
import { DAILY_SET_BONUS, VERIFIED_SCORING_VERSION, speedPoints, targetSeconds } from './seasonal-scoring.js';

/** PUZLI IQ is an in-game progression index, NOT a psychometric IQ test. */
export const RANKS = [
  { min: 0, name: 'Nowicjusz' },
  { min: 108, name: 'Logik' },
  { min: 118, name: 'Strateg' },
  { min: 130, name: 'Ekspert' },
  { min: 143, name: 'Mistrz' }
];
export const BADGES = [
  { id: 'first-game', name: 'Pierwszy krok', description: 'Rozwiąż pierwszą grę', icon: '✦' },
  { id: 'first-set', name: 'Komplecista', description: 'Ukończ pierwszy dzienny zestaw', icon: '✓' },
  { id: 'games-25', name: 'Rozgrzewka', description: 'Rozwiąż 25 gier Daily', icon: '◈' },
  { id: 'active-7', name: 'Stały bywalec', description: '7 dni aktywności z rzędu', icon: '✳' },
  { id: 'sets-7', name: 'Siedem kompletów', description: 'Ukończ 7 pełnych dziennych zestawów — nie muszą być z rzędu', icon: '★' },
  { id: 'clean-set', name: 'Bez podpowiedzi', description: 'Zdobądź cały komplet bez podpowiedzi', icon: '◆' },
  { id: 'games-100', name: 'Setka', description: 'Rozwiąż 100 gier Daily', icon: '✹' },
  { id: 'sets-30', name: 'Wytrwały', description: 'Ukończ 30 dziennych zestawów', icon: '♛' },
  { id: 'master', name: 'Mistrz PUZLI', description: 'Osiągnij rangę Mistrz', icon: '♕' }
];
export const LOCAL_SCORING_VERSION = 2;
export function createRewardsState() {
  return { scoringVersion: LOCAL_SCORING_VERSION, daily: {}, hintDate: null, hintCounts: {},
    totalPoints: 0, cleanGames: 0, cleanSets: 0 };
}

/** Convert old 100/120/80 local rewards to the same 10/speed/clean/20 scale
 *  as the future server scoring. Preserve old totals only as historical metadata;
 *  NEVER combine old and new scales in weekly or lifetime points.
 *  Done in memory during load; the next ordinary state save persists the migration.
 */
export function migrateRewardsScoring(rewards, puzzleResults = {}) {
  // A stale tab can append an old 100/120-point entry even after this
  // device has already migrated. Detect mixed ledgers, not just root version.
  const mixed = Object.values(rewards.daily || {}).some(day =>
    (Number(day?.bonus) || 0) > DAILY_SET_BONUS ||
    Object.values(day?.games || {}).some(game => game && game.scoringVersion !== VERIFIED_SCORING_VERSION)
  );
  if (rewards.scoringVersion === LOCAL_SCORING_VERSION && !mixed) return rewards;
  const outcomes = new Map();
  for (const result of Object.values(puzzleResults || {})) {
    if (result?.mode === 'daily' && result.date && result.gameId) {
      outcomes.set(result.date + ':' + result.gameId, result);
    }
  }
  const oldTotal = Number(rewards.totalPoints) || 0;
  let total = 0;
  for (const [date, day] of Object.entries(rewards.daily || {})) {
    if (!day || typeof day !== 'object' || Array.isArray(day)) continue;
    let dayTotal = 0;
    for (const [gameId, existing] of Object.entries(day.games || {})) {
      if (!existing || typeof existing !== 'object') continue;
      // Never overwrite an already converted game's saved breakdown.
      if (existing.scoringVersion === VERIFIED_SCORING_VERSION && Number.isInteger(existing.points)) {
        dayTotal += existing.points;
        continue;
      }
      let targetSecs;
      try { targetSecs = targetSeconds(gameId); } catch { continue; }
      const result = outcomes.get(date + ':' + gameId);
      const elapsedMs = Number.isFinite(result?.elapsedMs) ? result.elapsedMs : null;
      const hintsUsed = Number.isFinite(existing.hintsUsed) ? Math.max(0, Math.floor(existing.hintsUsed)) : null;
      const base = 10, speed = speedPoints(elapsedMs, targetSecs), clean = hintsUsed === 0 ? 5 : 0;
      const points = base + speed + clean;
      day.games[gameId] = { ...existing, points, hintsUsed, base, speed, clean,
        elapsedMs, targetSecs, scoringVersion: VERIFIED_SCORING_VERSION };
      dayTotal += points;
    }
    day.bonus = Number(day.bonus) > 0 ? DAILY_SET_BONUS : 0;
    day.total = dayTotal + day.bonus;
    total += day.total;
  }
  rewards.legacyTotalPoints = Number.isFinite(rewards.legacyTotalPoints) ? rewards.legacyTotalPoints : oldTotal;
  rewards.totalPoints = total;
  rewards.scoringVersion = LOCAL_SCORING_VERSION;
  return rewards;
}
export function getPuzliIQ(state) {
  const played = Math.max(0, Number(state?.user?.completedGames) || 0);
  const sets = Math.max(0, Number(state?.user?.completedDays) || 0);
  const clean = Math.max(0, Number(state?.rewards?.cleanGames) || 0);
  return 100 + Math.min(18, Math.floor(played / 4)) +
    Math.min(16, Math.floor(clean / 5)) +
    Math.min(16, Math.floor(sets / 4));
}
export function getRank(iq) {
  return [...RANKS].reverse().find(rank => iq >= rank.min) || RANKS[0];
}
export function getNextRank(iq) {
  return RANKS.find(rank => rank.min > iq) || null;
}
export function getBadges(state) {
  const games = Number(state?.user?.completedGames) || 0;
  const sets = Number(state?.user?.completedDays) || 0;
  const active = Number(state?.user?.bestActiveStreak) || 0;
  const cleanSets = Number(state?.rewards?.cleanSets) || 0;
  const iq = getPuzliIQ(state);
  const owned = new Set();
  if (games >= 1) owned.add('first-game');
  if (sets >= 1) owned.add('first-set');
  if (games >= 25) owned.add('games-25');
  if (active >= 7) owned.add('active-7');
  if (sets >= 7) owned.add('sets-7');
  if (cleanSets >= 1) owned.add('clean-set');
  if (games >= 100) owned.add('games-100');
  if (sets >= 30) owned.add('sets-30');
  if (iq >= 143) owned.add('master');
  return BADGES.map(badge => ({ ...badge, earned: owned.has(badge.id) }));
}
export function awardDailyGame(state, { date, gameId, hintsUsed = 0, elapsedMs = null, completeSet = false }) {
  const rewards = state.rewards;
  if (!rewards.daily[date]) rewards.daily[date] = { games: {}, bonus: 0, total: 0 };
  const record = rewards.daily[date];
  if (record.games[gameId]) return record.games[gameId].points;
  const targetSecs = targetSeconds(gameId);
  const base = 10, speed = speedPoints(elapsedMs, targetSecs), clean = hintsUsed === 0 ? 5 : 0;
  const points = base + speed + clean;
  record.games[gameId] = { points, base, speed, clean, elapsedMs, targetSecs,
    scoringVersion: VERIFIED_SCORING_VERSION,
    hintsUsed: Number.isFinite(hintsUsed) ? Math.max(0, Math.floor(hintsUsed)) : null };
  record.total += points;
  rewards.totalPoints += points;
  if (clean) rewards.cleanGames += 1;
  if (completeSet && !record.bonus) {
    record.bonus = DAILY_SET_BONUS;
    record.total += DAILY_SET_BONUS;
    rewards.totalPoints += DAILY_SET_BONUS;
    if (state.daily.requiredGames.every(id => record.games[id]?.hintsUsed === 0)) rewards.cleanSets += 1;
  }
  const dates = Object.keys(rewards.daily).sort();
  for (const old of dates.slice(0, Math.max(0, dates.length - 400))) delete rewards.daily[old];
  return points;
}
export function getWeekKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const d = new Date(dateKey + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function weeklyPoints(state, dateKey) {
  const week = getWeekKey(dateKey);
  return Object.entries(state?.rewards?.daily || {}).reduce(
    (sum, [date, record]) => sum + (getWeekKey(date) === week ? (Number(record.total) || 0) : 0), 0
  );
}
export function activityStreak(state, today) {
  return [0, 1].includes(dayDifference(state?.user?.lastActiveDate, today)) ? (state?.user?.activeStreak || 0) : 0;
}
