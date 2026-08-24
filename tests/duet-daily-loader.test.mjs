import test from 'node:test';
import assert from 'node:assert/strict';
import { duetDailyPath, loadDuetDaily, validateDuetDailyRecord } from '../src/duet/daily-loader.js';

const record = {
  date: '2026-08-24',
  game: 'duet',
  version: 1,
  seed: 'figlo:duet:2026-08-24:v1',
  puzzle: { size: 6, givens: [], relations: [] },
  solution: Array(36).fill(1),
  difficulty: { label: 'easy', score: 1, steps: 1 }
};

test('daily loader builds deterministic static path', () => {
  assert.equal(duetDailyPath('2026-08-24'), 'data/duet/2026-08-24.json');
});

test('daily record schema is validated', () => {
  assert.equal(validateDuetDailyRecord(record, '2026-08-24'), true);
  assert.equal(validateDuetDailyRecord({ ...record, date: '2026-08-25' }, '2026-08-24'), false);
  assert.equal(validateDuetDailyRecord({ ...record, solution: [1, 2] }, '2026-08-24'), false);
});

test('client loader fetches a pre-generated record instead of invoking generator', async () => {
  let requested = null;
  const loaded = await loadDuetDaily('2026-08-24', {
    fetchImpl: async path => {
      requested = path;
      return { ok: true, json: async () => record };
    }
  });
  assert.equal(requested, 'data/duet/2026-08-24.json');
  assert.deepEqual(loaded, record);
});

test('missing daily asset fails clearly', async () => {
  await assert.rejects(
    () => loadDuetDaily('2026-08-24', { fetchImpl: async () => ({ ok: false, status: 404 }) }),
    /Brak wygenerowanej planszy/
  );
});
