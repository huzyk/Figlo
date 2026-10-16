import test from 'node:test';
import assert from 'node:assert/strict';
import { completeGame } from '../src/services/progress-service.js';
import { STORAGE_KEY, clearCrownSession, clearDuetSession, completeDailyGame, getCrownSession, getDuetSession, loadFigloState, recordDailyHint, saveCrownSession, saveDuetSession, saveFigloState } from '../src/storage.js';

class Store {
  constructor() { this.map = new Map(); this.writes = 0; }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.writes++; this.map.set(key, String(value)); }
  clear() { this.map.clear(); }
}
const oldDate = '2026-10-14', newDate = '2026-10-15';
function reset(store = new Store()) { globalThis.localStorage = store; return store; }
function interleaveBeforeSave(store, completeOtherTab) {
  const getItem = store.getItem.bind(store);
  let reads = 0;
  store.getItem = key => {
    if (key === STORAGE_KEY && ++reads === 2) {
      store.getItem = getItem;
      completeOtherTab();
    }
    return getItem(key);
  };
}

test('interleaved different-game completions add both stats, first results and rewards', () => {
  const store = reset();
  interleaveBeforeSave(store, () => completeDailyGame('duet', { today: newDate, timeMs: 2000, event: { eventId: 'other-tab' } }));
  const result = completeDailyGame('korony', { today: newDate, timeMs: 1000, event: { eventId: 'this-tab' } });
  const state = loadFigloState(newDate);
  assert.equal(result.firstGameCompletionToday, true);
  assert.equal(result.state.user.completedGames, 2, 'the returned state must also contain the rebased aggregate');
  assert.equal(state.user.completedGames, 2);
  assert.equal(state.games.korony.completedCount, 1);
  assert.equal(state.games.korony.totalTimeMs, 1000);
  assert.equal(state.games.duet.completedCount, 1);
  assert.equal(state.games.duet.totalTimeMs, 2000);
  assert.equal(Object.keys(state.puzzleResults).length, 2);
  assert.equal(state.rewards.totalPoints, 30);
  assert.equal(state.rewards.daily[newDate].total, 30);
  assert.equal(state.rewards.cleanGames, 2);
  assert.deepEqual(new Set(state.daily.completedGames), new Set(['korony','duet']));
});

test('interleaved submissions of the same puzzle preserve the first event and count it once', () => {
  const store = reset();
  interleaveBeforeSave(store, () => completeDailyGame('korony', { today: newDate, timeMs: 60000, hintsUsed: 2, event: { eventId: 'first' } }));
  const result = completeDailyGame('korony', { today: newDate, timeMs: 1000, hintsUsed: 0, event: { eventId: 'duplicate' } });
  const state = loadFigloState(newDate);
  assert.equal(result.firstGameCompletionToday, false);
  assert.equal(state.user.completedGames, 1);
  assert.equal(state.games.korony.completedCount, 1);
  assert.equal(state.games.korony.totalTimeMs, 60000);
  assert.equal(state.games.korony.timedCompletions, 1);
  assert.equal(state.games.korony.bestTimeMs, 60000);
  assert.equal(state.rewards.totalPoints, 20);
  assert.equal(state.rewards.daily[newDate].total, 20);
  assert.equal(state.rewards.cleanGames, 0);
  assert.equal(state.puzzleResults[`korony:${newDate}:v1`].eventId, 'first');
  assert.equal(state.puzzleResults[`korony:${newDate}:v1`].hintsUsed, 2);
});

test('interleaved completions of one game on different dates accumulate times and counts', () => {
  const store = reset();
  interleaveBeforeSave(store, () => completeDailyGame('korony', { today: newDate, timeMs: 2000 }));
  completeDailyGame('korony', { today: oldDate, timeMs: 1000 });
  const state = loadFigloState(newDate);
  assert.equal(state.games.korony.completedCount, 2);
  assert.equal(state.games.korony.timedCompletions, 2);
  assert.equal(state.games.korony.totalTimeMs, 3000);
  assert.equal(state.games.korony.bestTimeMs, 1000);
  assert.equal(state.games.korony.lastCompletedDate, newDate);
  assert.equal(state.user.completedGames, 2);
  assert.equal(state.rewards.totalPoints, 30);
  assert.equal(state.user.activeStreak, 2);
});

test('interleaved last two games award the full-set bonus and counters exactly once', () => {
  const store = reset();
  for (const game of ['bloki','latarnie','zip','sudoku']) completeDailyGame(game, { today: newDate });
  let otherResult;
  interleaveBeforeSave(store, () => { otherResult = completeDailyGame('duet', { today: newDate }); });
  const result = completeDailyGame('korony', { today: newDate });
  const state = loadFigloState(newDate);
  assert.equal(otherResult.firstDayCompletionToday, false);
  assert.equal(result.firstDayCompletionToday, true);
  assert.equal(state.user.completedGames, 6);
  assert.equal(state.user.completedDays, 1);
  assert.equal(state.rewards.totalPoints, 110);
  assert.equal(state.rewards.daily[newDate].total, 110);
  assert.equal(state.rewards.daily[newDate].bonus, 20);
  assert.equal(state.rewards.cleanGames, 6);
  assert.equal(state.rewards.cleanSets, 1);
});

test('reward history remains bounded after merging with a larger existing disk history', () => {
  const store = reset();
  const raw = loadFigloState(newDate);
  for (let index = 0; index < 405; index++) {
    const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
    raw.rewards.daily[date] = { games: { korony: { hintsUsed: 0, points: 120 } }, bonus: 0, total: 120 };
  }
  store.setItem(STORAGE_KEY, JSON.stringify(raw));
  completeDailyGame('duet', { today: newDate });
  const state = loadFigloState(newDate);
  assert.equal(Object.keys(state.rewards.daily).length, 400);
  assert.equal(state.rewards.daily['2025-01-01'], undefined);
  assert.deepEqual(state.days['2025-01-01'].completedGames, ['korony']);
  assert.equal(completeDailyGame('korony', { today: '2025-01-01' }).firstGameCompletionToday, false);
});

test('adding a new game to a legacy full set cannot award its set bonus again after reward pruning', () => {
  const store = reset();
  const raw = loadFigloState(newDate);
  raw.daily.completedGames = ['korony','duet','bloki','latarnie','zip'];
  raw.user.completedDays = 1;
  raw.user.completedGames = 5;
  raw.user.completedDates = [newDate];
  raw.user.lastCompletedDate = newDate;
  raw.rewards.totalPoints = 680;
  delete raw.rewards.scoringVersion;
  raw.rewards.daily[newDate] = {
    games: Object.fromEntries(['korony','duet','bloki','latarnie','zip'].map(id=>[id,{points:120,hintsUsed:0}])),
    bonus:80,total:680
  };
  store.setItem(STORAGE_KEY, JSON.stringify(raw));
  const result = completeDailyGame('sudoku', { today: newDate });
  assert.equal(result.firstDayCompletionToday, false);
  assert.equal(result.state.user.completedDays, 1);
  assert.equal(result.state.rewards.totalPoints, 110);
  assert.equal(result.state.rewards.daily[newDate].bonus, 20);
  assert.equal(result.state.rewards.legacyTotalPoints, 680);
});

test('reading an old tab is side-effect free and preserves the new day progress and sessions', () => {
  const store = reset();
  completeDailyGame('korony', { today: oldDate, timeMs: 30000 });
  completeDailyGame('duet', { today: newDate, timeMs: 40000 });
  saveCrownSession({ seed: 'new', crowns: [4], elapsedMs: 5000 }, newDate);
  saveDuetSession({ seed: 'new', board: [1,0], elapsedMs: 6000 }, newDate);
  const before = store.getItem(STORAGE_KEY), writes = store.writes;
  assert.deepEqual(loadFigloState(oldDate).daily.completedGames, ['korony']);
  assert.equal(store.getItem(STORAGE_KEY), before);
  assert.equal(store.writes, writes);
  assert.deepEqual(loadFigloState(newDate).daily.completedGames, ['duet']);
  assert.deepEqual(getCrownSession({ today: newDate, seed: 'new' }).crowns, [4]);
  assert.deepEqual(getDuetSession({ today: newDate, seed: 'new' }).board, [1,0]);
});

test('old session saves and clears only touch their own date', () => {
  reset();
  saveCrownSession({ seed: 'new', crowns: [4] }, newDate);
  saveDuetSession({ seed: 'new', board: [1] }, newDate);
  saveCrownSession({ seed: 'old', crowns: [1] }, oldDate);
  saveDuetSession({ seed: 'old', board: [0] }, oldDate);
  clearCrownSession(oldDate);
  clearDuetSession(oldDate);
  assert.equal(getCrownSession({ today: oldDate, seed: 'old' }), null);
  assert.equal(getDuetSession({ today: oldDate, seed: 'old' }), null);
  assert.deepEqual(getCrownSession({ today: newDate, seed: 'new' }).crowns, [4]);
  assert.deepEqual(getDuetSession({ today: newDate, seed: 'new' }).board, [1]);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).daily.date, newDate);
});

test('stale snapshots rebase settings without overwriting latest stats, rewards or sessions', () => {
  reset();
  const oldTab = loadFigloState(oldDate);
  completeDailyGame('korony', { today: newDate, timeMs: 30000 });
  saveCrownSession({ seed: 'new', crowns: [5] }, newDate);
  oldTab.settings.autoX = true;
  saveFigloState(oldTab);
  const state = loadFigloState(newDate);
  assert.equal(state.settings.autoX, true);
  assert.equal(state.user.completedGames, 1);
  assert.equal(state.rewards.totalPoints, 25);
  assert.deepEqual(state.daily.completedGames, ['korony']);
  assert.deepEqual(state.sessions.korony.crowns, [5]);
});

test('replaying an older puzzle cannot duplicate stats, points or the first result', () => {
  reset();
  const input = { gameId: 'duet', puzzleId: `duet:${oldDate}:v2`, date: oldDate, elapsedMs: 45000, hintsUsed: 2, resets: 1, attemptNo: 2 };
  const first = completeGame(input);
  completeDailyGame('duet', { today: newDate, timeMs: 40000 });
  const before = loadFigloState(newDate);
  const replay = completeGame({ ...input, elapsedMs: 1000, hintsUsed: 0, resets: 0, attemptNo: 1 });
  const after = loadFigloState(newDate);
  assert.equal(replay.firstGameCompletionToday, false);
  assert.deepEqual(after.user, before.user);
  assert.deepEqual(after.games, before.games);
  assert.deepEqual(after.rewards, before.rewards);
  assert.deepEqual(replay.event, first.event);
  assert.equal(after.puzzleResults[input.puzzleId].elapsedMs, 45000);
  assert.equal(after.puzzleResults[input.puzzleId].hintsUsed, 2);
  assert.equal(after.puzzleResults[input.puzzleId].resets, 1);
  assert.equal(after.puzzleResults[input.puzzleId].attemptNo, 2);
});

test('finishing an earlier date never rewinds the latest streak or per-game date', () => {
  reset();
  completeDailyGame('korony', { today: '2026-10-15' });
  completeDailyGame('korony', { today: '2026-10-16' });
  completeDailyGame('korony', { today: oldDate });
  const state = loadFigloState(newDate);
  assert.equal(state.user.lastActiveDate, '2026-10-16');
  assert.equal(state.user.activeStreak, 3);
  assert.equal(state.games.korony.lastCompletedDate, '2026-10-16');
});

test('hints are isolated by date even when two tabs alternate between days', () => {
  reset();
  recordDailyHint('korony', oldDate);
  recordDailyHint('korony', newDate);
  recordDailyHint('korony', oldDate);
  completeDailyGame('korony', { today: newDate });
  completeDailyGame('korony', { today: oldDate });
  const state = loadFigloState(newDate);
  assert.equal(state.rewards.daily[newDate].games.korony.hintsUsed, 1);
  assert.equal(state.rewards.daily[oldDate].games.korony.hintsUsed, 2);
  assert.equal(state.puzzleResults[`korony:${oldDate}:v1`].hintsUsed, 2);
});

test('first result still deduplicates after the reward history has been pruned', () => {
  reset();
  completeDailyGame('korony', { today: oldDate });
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  delete raw.rewards.daily[oldDate];
  delete raw.days[oldDate];
  raw.daily = { date: newDate, completedGames: [], requiredGames: [] };
  raw.games.korony.lastCompletedDate = newDate;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const result = completeDailyGame('korony', { today: oldDate, timeMs: 1000 });
  assert.equal(result.firstGameCompletionToday, false);
  assert.equal(result.state.user.completedGames, 1);
  assert.equal(result.state.rewards.totalPoints, 15);
});

test('only old board histories expire after fourteen days; completions, hints and first results survive', () => {
  reset();
  const archivedDate = '2026-10-01';
  recordDailyHint('duet', archivedDate);
  completeDailyGame('korony', { today: archivedDate, timeMs: 45000 });
  saveCrownSession({ seed: 'archive', crowns: [2], history: [{ crowns: [1], manualXs: [] }] }, archivedDate);
  saveDuetSession({ seed: 'archive', board: [1,0], history: [[0,0]] }, archivedDate);
  saveCrownSession({ seed: 'recent', crowns: [3] }, oldDate);
  saveCrownSession({ seed: 'new', crowns: [4] }, newDate);
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(raw.days[archivedDate].sessions, undefined);
  assert.deepEqual(raw.days[archivedDate].completedGames, ['korony']);
  assert.equal(raw.days[archivedDate].hintCounts.duet, 1);
  assert.equal(raw.puzzleResults[`korony:${archivedDate}:v1`].elapsedMs, 45000);
  assert.equal(getCrownSession({ today: archivedDate, seed: 'archive' }), null);
  assert.equal(getDuetSession({ today: archivedDate, seed: 'archive' }), null);
  assert.deepEqual(getCrownSession({ today: oldDate, seed: 'recent' }).crowns, [3]);
  assert.equal(completeDailyGame('korony', { today: archivedDate }).firstGameCompletionToday, false);
  assert.equal(loadFigloState(newDate).user.completedGames, 1);
});

test('legacy counters and Crown completions migrate without losing missing-key fallbacks', () => {
  const store = reset();
  store.setItem('figlo-streak', '3');
  store.setItem('figlo-crowns-completed-count', '8');
  store.setItem('figlo-crowns-completed-date', oldDate);
  const state = loadFigloState(oldDate);
  assert.equal(state.user.streak, 3);
  assert.equal(state.user.bestStreak, 3);
  assert.equal(state.user.completedDays, 3);
  assert.equal(state.user.completedGames, 8);
  assert.deepEqual(state.daily.completedGames, ['korony']);
  assert.equal(completeDailyGame('korony', { today: oldDate }).firstGameCompletionToday, false);
});

test('read and write failures preserve progress in memory across subsequent reads', () => {
  const store = reset({ getItem() { throw new Error('blocked read'); }, setItem() { throw new Error('blocked write'); } });
  completeDailyGame('korony', { today: oldDate });
  assert.equal(loadFigloState(oldDate).user.completedGames, 1);
  completeDailyGame('duet', { today: oldDate });
  assert.equal(loadFigloState(oldDate).user.completedGames, 2);
  assert.equal(loadFigloState(oldDate).rewards.totalPoints, 30);
  globalThis.localStorage = store;
  assert.equal(loadFigloState(oldDate).user.completedGames, 2);
  reset();
  assert.equal(loadFigloState(oldDate).user.completedGames, 0);
});

test('quota errors do not cause a readable but stale storage value to erase memory progress', () => {
  const store = reset();
  completeDailyGame('korony', { today: oldDate });
  store.setItem = () => { throw new Error('quota exceeded'); };
  completeDailyGame('duet', { today: oldDate });
  assert.equal(loadFigloState(oldDate).user.completedGames, 2);
  assert.equal(loadFigloState(oldDate).rewards.totalPoints, 30);
});

test('missing localStorage keeps a working in-memory state and is isolated from a later storage handle', () => {
  reset();
  delete globalThis.localStorage;
  completeDailyGame('korony', { today: oldDate });
  completeDailyGame('duet', { today: oldDate });
  assert.equal(loadFigloState(oldDate).user.completedGames, 2);
  assert.equal(loadFigloState(oldDate).rewards.totalPoints, 30);
  reset();
  assert.equal(loadFigloState(oldDate).user.completedGames, 0);
});

test('a corrupted disk value cannot erase the last readable progress held by this tab', () => {
  const store = reset();
  completeDailyGame('korony', { today: oldDate, timeMs: 30000 });
  store.setItem(STORAGE_KEY, '{broken json');
  assert.equal(loadFigloState(oldDate).user.completedGames, 1);
  completeDailyGame('duet', { today: oldDate, timeMs: 40000 });
  assert.equal(loadFigloState(oldDate).user.completedGames, 2);
  assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).user.completedGames, 2);
});

test('challenge completion leaves persistent progress completely unchanged', () => {
  const store = reset();
  completeDailyGame('korony', { today: newDate });
  const before = store.getItem(STORAGE_KEY);
  const result = completeGame({ gameId: 'duet', puzzleId: 'historical', date: oldDate, mode: 'challenge', hintsUsed: 1 });
  assert.equal(result.firstGameCompletionToday, false);
  assert.equal(result.event.hintsUsed, 1);
  assert.equal(store.getItem(STORAGE_KEY), before);
});

test('Crown and Duet storage freezes active time and keeps attempt metadata without mutating live sessions', () => {
  reset();
  const originalNow = Date.now;
  Date.now = () => 10000;
  try {
    for (const [save, get] of [[saveCrownSession, getCrownSession], [saveDuetSession, getDuetSession]]) {
      const live = { seed: 'timer', elapsedMs: 1200, runningSince: 5000, hintsUsed: 2, resets: 1, attemptNo: 2 };
      save(live, oldDate);
      Date.now = () => 1000000;
      const restored = get({ today: oldDate, seed: 'timer' });
      assert.equal(restored.elapsedMs, 6200);
      assert.equal(restored.runningSince, null);
      assert.equal(restored.hintsUsed, 2);
      assert.equal(restored.resets, 1);
      assert.equal(restored.attemptNo, 2);
      assert.equal(live.runningSince, 5000);
      Date.now = () => 10000;
    }
  } finally { Date.now = originalNow; }
});
