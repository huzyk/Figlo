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
const { STORAGE_KEY, getCrownSession, loadFigloState, saveCrownSession } = storage;

const seed = 'figlo:korony:2026-08-24:v1';

test('daily Crown session restores board, history and timer fields', () => {
  localStorage.clear();
  saveCrownSession({
    date: '2026-08-24',
    seed,
    crowns: [3, 14],
    manualXs: [7, 8],
    history: [
      { crowns: [3], manualXs: [7] },
      { crowns: [3, 14], manualXs: [7] }
    ],
    elapsedMs: 42000,
    runningSince: 100000,
    finished: false
  }, '2026-08-24');

  const restored = getCrownSession({ today: '2026-08-24', seed });
  assert.deepEqual(restored.crowns, [3, 14]);
  assert.deepEqual(restored.manualXs, [7, 8]);
  assert.deepEqual(restored.history[0], { crowns: [3], manualXs: [7] });
  assert.equal(restored.elapsedMs, 42000);
  assert.equal(restored.runningSince, 100000);
  assert.equal(restored.finished, false);
});

test('different seed does not restore an old session', () => {
  localStorage.clear();
  saveCrownSession({ date: '2026-08-24', seed, crowns: [3] }, '2026-08-24');
  const restored = getCrownSession({
    today: '2026-08-24',
    seed: 'figlo:korony:2026-08-24:v2'
  });
  assert.equal(restored, null);
});

test('new day clears yesterday Crown session but keeps user state', () => {
  localStorage.clear();
  const first = loadFigloState('2026-08-24');
  first.user.streak = 4;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
  saveCrownSession({ date: '2026-08-24', seed, crowns: [3], elapsedMs: 2000 }, '2026-08-24');

  const next = loadFigloState('2026-08-25');
  assert.equal(next.user.streak, 4);
  assert.equal(next.daily.date, '2026-08-25');
  assert.deepEqual(next.daily.completedGames, []);
  assert.equal(next.sessions.korony.date, null);
  assert.deepEqual(next.sessions.korony.crowns, []);
});

test('corrupted unified storage falls back to a safe state', () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, '{broken json');
  const state = loadFigloState('2026-08-24');
  assert.equal(state.version, 2);
  assert.equal(state.daily.date, '2026-08-24');
  assert.deepEqual(state.daily.completedGames, []);
  assert.deepEqual(state.sessions.korony.crowns, []);
});
