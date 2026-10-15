import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipSession, loadZipSession, saveZipSession } from '../src/zip/session.js';
import { snapshotSessionTimer, resumeSessionTimer } from '../src/ui/session-timer.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};
const options = { date: '2026-10-15', seed: 'zip:2026-10-15:v2' };

test('timer snapshot includes active play, does not mutate live timer, and resumes from now', () => {
  const live = { elapsedMs: 1200, runningSince: 5000, startedAt: 'started', history: [] };
  const saved = snapshotSessionTimer(live, 8000);
  assert.equal(saved.elapsedMs, 4200);
  assert.equal(saved.runningSince, null);
  assert.equal(live.runningSince, 5000);
  assert.equal(live.elapsedMs, 1200);
  assert.equal(resumeSessionTimer(saved, 1000000), true);
  assert.equal(saved.runningSince, 1000000);
  assert.equal(saved.elapsedMs, 4200);
});

test('Zip restores a crashed legacy session without counting time away', () => {
  values.set('figlo_zip_session_v1', JSON.stringify({ ...createZipSession(options), path: [1, 2],
    elapsedMs: 4200, runningSince: 10, hintsUsed: 2, resets: 1 }));
  const restored = loadZipSession(options);
  assert.equal(restored.elapsedMs, 4200);
  assert.equal(restored.runningSince, null);
  assert.equal(restored.hintsUsed, 2);
  assert.equal(restored.resets, 1);
  assert.deepEqual(restored.path, [1, 2]);
  assert.equal(resumeSessionTimer(restored, 1000000), true);
  assert.equal(restored.runningSince, 1000000);
});

test('Zip persisted timer is stopped while the active session keeps running', () => {
  const live = { ...createZipSession(options), elapsedMs: 1200, runningSince: Date.now() - 500 };
  assert.equal(saveZipSession(live), true);
  const restored = loadZipSession(options);
  assert.equal(restored.runningSince, null);
  assert.ok(restored.elapsedMs >= 1700 && restored.elapsedMs < 2000);
  assert.ok(live.runningSince);
  assert.equal(live.elapsedMs, 1200);
});

test('Zip save tolerates unavailable local storage', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { setItem() { throw new Error('quota'); } };
  assert.equal(saveZipSession(createZipSession(options)), false);
  globalThis.localStorage = original;
});
