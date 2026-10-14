import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeSessionTimer } from '../src/ui/session-timer.js';

test('fresh, reset and completed rounds do not resume', () => {
  for (const session of [null, { elapsedMs: 0, history: [] }, { finished: true, elapsedMs: 1000 }]) {
    assert.equal(resumeSessionTimer(session, 5000), false);
  }
});

test('started rounds resume after undoing all moves without counting time away', () => {
  const session = { elapsedMs: 1200, startedAt: '2026-10-14', runningSince: null, history: [] };
  assert.equal(resumeSessionTimer(session, 10000), true);
  assert.equal(session.elapsedMs, 1200);
  assert.equal(session.runningSince, 10000);
  resumeSessionTimer(session, 12000);
  assert.equal(session.runningSince, 10000);
});
