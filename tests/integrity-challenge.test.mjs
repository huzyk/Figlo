import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedGameMode, requestedPuzzleDate, validateChallengeRecord, setGameMode, getGameMode, getGameDate, getGamePuzzleId } from '../src/ui/game-mode.js';

function link(search) {
  globalThis.location = { hostname: 'localhost', search: `?date=2026-10-15&${search}` };
}

test('challenge wins over training and uses the shared date without changing today', () => {
  link('mode=training&challenge=2026-08-24&v=duet%3A2026-08-24%3Av4');
  assert.equal(requestedGameMode(), 'challenge');
  assert.equal(requestedPuzzleDate(), '2026-08-24');
  const record = { date: '2026-08-24', puzzleId: 'duet:2026-08-24:v4' };
  assert.equal(validateChallengeRecord(record), record);
});

test('missing or changed versions never silently open a replacement puzzle', () => {
  const record = { date: '2026-08-24', puzzleId: 'duet:2026-08-24:v4' };
  link('challenge=2026-08-24');
  assert.throws(() => validateChallengeRecord(record), /brakuje wersji/);
  link('challenge=2026-08-24&v=duet%3A2026-08-24%3Av3');
  assert.throws(() => validateChallengeRecord(record), /wersja wyzwania/);
});

test('invalid, future, and pre-launch challenge dates are explicitly rejected', () => {
  for (const date of ['2026-02-30', '2026-08-23', '2026-10-16', '../data']) {
    link(`challenge=${encodeURIComponent(date)}&v=anything`);
    assert.equal(requestedGameMode(), 'challenge');
    assert.equal(requestedPuzzleDate(), '2026-10-15');
    assert.throws(() => validateChallengeRecord({ puzzleId: 'anything' }), /nieprawidłową datę/);
  }
});

test('game context keeps its date and puzzle ID across a date rollover', () => {
  globalThis.document = { documentElement: { dataset: {} } };
  link('');
  setGameMode('challenge', { date: '2026-08-24', puzzleId: 'duet:2026-08-24:v4' });
  link('date=2026-10-16');
  assert.equal(getGameMode(), 'challenge');
  assert.equal(getGameDate(), '2026-08-24');
  assert.equal(getGamePuzzleId(), 'duet:2026-08-24:v4');
  setGameMode('training', { date: '2026-10-16', puzzleId: 'duet-training:random' });
  assert.equal(getGameMode(), 'training');
  assert.equal(getGamePuzzleId(), 'duet-training:random');
});

test('ordinary daily and local debug links remain supported', () => {
  link('');
  assert.equal(requestedGameMode(), 'daily');
  assert.equal(requestedPuzzleDate(), '2026-10-15');
  link('mode=training');
  assert.equal(requestedGameMode(), 'training');
  assert.doesNotThrow(() => validateChallengeRecord(null));
});
