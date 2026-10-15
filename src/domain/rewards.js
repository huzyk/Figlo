import { dayDifference } from '../daily.js';

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
  { id: 'sets-7', name: 'Tydzień kompletów', description: 'Ukończ 7 dziennych zestawów', icon: '★' },
  { id: 'clean-set', name: 'Bez podpowiedzi', description: 'Zdobądź cały komplet bez podpowiedzi', icon: '◆' },
  { id: 'games-100', name: 'Setka', description: 'Rozwiąż 100 gier Daily', icon: '✹' },
  { id: 'sets-30', name: 'Wytrwały', description: 'Ukończ 30 dziennych zestawów', icon: '♛' },
  { id: 'master', name: 'Mistrz PUZLI', description: 'Osiągnij rangę Mistrz', icon: '♕' }
];
export function createRewardsState() {
  return { daily: {}, hintDate: null, hintCounts: {}, totalPoints: 0, cleanGames: 0, cleanSets: 0 };
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
export function awardDailyGame(state, { date, gameId, hintsUsed = 0, completeSet = false }) {
  const rewards = state.rewards;
  if (!rewards.daily[date]) rewards.daily[date] = { games: {}, bonus: 0, total: 0 };
  const record = rewards.daily[date];
  if (record.games[gameId]) return record.games[gameId].points;
  const clean = hintsUsed === 0;
  const points = 100 + (clean ? 20 : 0);
  record.games[gameId] = { points, hintsUsed: Math.max(0, hintsUsed) };
  record.total += points;
  rewards.totalPoints += points;
  if (clean) rewards.cleanGames += 1;
  if (completeSet && !record.bonus) {
    record.bonus = 80;
    record.total += 80;
    rewards.totalPoints += 80;
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
