import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new LocalStorageMock();

const storage = await import('../src/storage.js');
const {
  STORAGE_KEY,
  completeDailyGame,
  isTodayComplete,
  loadFigloState,
  updateFigloSettings
} = storage;

function resetStorage() {
  localStorage.clear();
}

test('fresh state starts with incomplete Korony day', () => {
  resetStorage();
  const state = loadFigloState('2026-08-24');
  assert.equal(state.user.streak, 0);
  assert.equal(state.user.completedDays, 0);
  assert.equal(state.user.completedGames, 0);
  assert.deepEqual(state.daily.requiredGames, ['korony']);
  assert.deepEqual(state.daily.completedGames, []);
  assert.equal(isTodayComplete(state), false);
});

test('first daily completion increments game, day and streak once', () => {
  resetStorage();
  const result = completeDailyGame('korony', { timeMs: 120000, today: '2026-08-24' });
  assert.equal(result.firstGameCompletionToday, true);
  assert.equal(result.firstDayCompletionToday, true);
  assert.equal(result.state.user.streak, 1);
  assert.equal(result.state.user.bestStreak, 1);
  assert.equal(result.state.user.completedDays, 1);
  assert.equal(result.state.user.completedGames, 1);
  assert.equal(result.state.games.korony.completedCount, 1);
  assert.equal(result.state.games.korony.bestTimeMs, 120000);
  assert.deepEqual(result.state.daily.completedGames, ['korony']);
  assert.equal(isTodayComplete(result.state), true);
});

test('replay on the same day does not increment streak or completion counters', () => {
  resetStorage();
  completeDailyGame('korony', { timeMs: 120000, today: '2026-08-24' });
  const replay = completeDailyGame('korony', { timeMs: 90000, today: '2026-08-24' });
  assert.equal(replay.firstGameCompletionToday, false);
  assert.equal(replay.firstDayCompletionToday, false);
  assert.equal(replay.state.user.streak, 1);
  assert.equal(replay.state.user.completedDays, 1);
  assert.equal(replay.state.user.completedGames, 1);
  assert.equal(replay.state.games.korony.completedCount, 1);
  assert.equal(replay.state.games.korony.bestTimeMs, 90000);
});

test('consecutive completed days increase streak', () => {
  resetStorage();
  completeDailyGame('korony', { timeMs: 120000, today: '2026-08-24' });
  const secondDay = completeDailyGame('korony', { timeMs: 110000, today: '2026-08-25' });
  assert.equal(secondDay.state.user.streak, 2);
  assert.equal(secondDay.state.user.bestStreak, 2);
  assert.equal(secondDay.state.user.completedDays, 2);
  assert.equal(secondDay.state.user.completedGames, 2);
  assert.deepEqual(secondDay.state.user.completedDates, ['2026-08-24', '2026-08-25']);
});

test('skipping a day resets streak to one on next completion', () => {
  resetStorage();
  completeDailyGame('korony', { timeMs: 120000, today: '2026-08-24' });
  const afterGap = completeDailyGame('korony', { timeMs: 100000, today: '2026-08-26' });
  assert.equal(afterGap.state.user.streak, 1);
  assert.equal(afterGap.state.user.bestStreak, 1);
  assert.equal(afterGap.state.user.completedDays, 2);
});

test('loading a new date resets only daily progress and keeps history', () => {
  resetStorage();
  completeDailyGame('korony', { timeMs: 120000, today: '2026-08-24' });
  const nextDay = loadFigloState('2026-08-25');
  assert.equal(nextDay.daily.date, '2026-08-25');
  assert.deepEqual(nextDay.daily.completedGames, []);
  assert.equal(nextDay.user.streak, 1);
  assert.equal(nextDay.user.completedDays, 1);
  assert.equal(nextDay.user.completedGames, 1);
  assert.equal(nextDay.games.korony.completedCount, 1);
});

test('Auto-X setting persists in unified storage', () => {
  resetStorage();
  updateFigloSettings({ autoX: true });
  const state = loadFigloState('2026-08-24');
  assert.equal(state.settings.autoX, true);
  assert.ok(localStorage.getItem(STORAGE_KEY));
});
