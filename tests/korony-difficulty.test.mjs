import test from 'node:test';
import assert from 'node:assert/strict';
import { crownDailyConfig, CROWNS_EASIER_FROM } from '../src/korony/difficulty.js';
import { dailyPuzzleSeed } from '../src/daily.js';
import { difficultyForGameDate } from '../src/difficulty-schedule.js';
import { getDailyGame, getDailyManifest } from '../src/services/daily-service.js';
import { generatePuzzle, countRegionSolutions, validateGeneratedRegions } from '../src/generator.js';

test('historical Korony preserve the original seed, version and difficulty', () => {
  assert.equal(CROWNS_EASIER_FROM, '2026-10-16');
  for (const date of ['2026-08-24','2026-10-14','2026-10-15']) {
    const config=crownDailyConfig(date);
    assert.equal(config.seed, dailyPuzzleSeed('korony',date));
    assert.equal(config.version, 1);
    assert.equal(config.difficulty, difficultyForGameDate('korony',date));
  }
});

test('new Korony are one level gentler but keep the 9x9 format', () => {
  assert.deepEqual(crownDailyConfig('2026-10-16'), {
    seed:'figlo:korony:2026-10-16:v2', version:2, difficulty:'medium'
  });
  assert.equal(crownDailyConfig('2026-10-17').difficulty,'medium');
  assert.equal(crownDailyConfig('2026-10-18').difficulty,'medium');
  assert.equal(crownDailyConfig('2026-10-19').difficulty,'easy');
  assert.equal(crownDailyConfig('2026-10-21').difficulty,'easy');
  assert.equal(crownDailyConfig('2026-10-22').difficulty,'easy');
});

test('daily service and manifest expose the same versioned Korony ID', async () => {
  for (const date of ['2026-10-15','2026-10-16']) {
    const config=crownDailyConfig(date);
    const record=await getDailyGame('korony',date);
    const manifest=await getDailyManifest(date,{fetchImpl:null});
    assert.equal(record.version,config.version);
    assert.equal(record.puzzleId,config.seed);
    assert.equal(manifest.games.find(game=>game.id==='korony').puzzleId,config.seed);
  }
});

test('new easier daily sample stays unique and human-solvable', { timeout: 120000 }, () => {
  const config=crownDailyConfig('2026-10-16');
  const puzzle=generatePuzzle(config.seed,{difficulty:config.difficulty});
  assert.equal(puzzle.size,9);
  assert.equal(validateGeneratedRegions(puzzle.regions),true);
  assert.equal(countRegionSolutions(puzzle.regions,2).count,1);
  assert.ok(puzzle.deductionCount>0);
});
