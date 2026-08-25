import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyDifficultyForDate, difficultyForGameDate } from '../src/difficulty-schedule.js';

test('weekly difficulty rises toward the weekend',()=>{
  assert.equal(weeklyDifficultyForDate('2026-08-24'),'easy');
  assert.equal(weeklyDifficultyForDate('2026-08-25'),'easy');
  assert.equal(weeklyDifficultyForDate('2026-08-26'),'medium');
  assert.equal(weeklyDifficultyForDate('2026-08-27'),'medium');
  assert.equal(weeklyDifficultyForDate('2026-08-28'),'medium-hard');
  assert.equal(weeklyDifficultyForDate('2026-08-29'),'hard');
  assert.equal(weeklyDifficultyForDate('2026-08-30'),'challenge');
});

test('each game maps the shared curve onto supported generator levels',()=>{
  assert.equal(difficultyForGameDate('bloki','2026-08-24'),'easy');
  assert.equal(difficultyForGameDate('bloki','2026-08-28'),'hard');
  assert.equal(difficultyForGameDate('duet','2026-08-28'),'medium');
  assert.equal(difficultyForGameDate('duet','2026-08-30'),'hard');
  assert.equal(difficultyForGameDate('korony','2026-08-24'),'easy');
  assert.equal(difficultyForGameDate('korony','2026-08-30'),'hard');
});
