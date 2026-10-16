import test from 'node:test';
import assert from 'node:assert/strict';
import {crownDailyConfig} from '../src/korony/difficulty.js';
import {dailyPuzzleSeed} from '../src/daily.js';
import {difficultyForGameDate} from '../src/difficulty-schedule.js';
import {getDailyGame,getDailyManifest} from '../src/services/daily-service.js';
import {generatePuzzle,countRegionSolutions,validateGeneratedRegions} from '../src/generator.js';

test('historical Korony retain their original seed, version, and difficulty',()=>{
 for(const date of ['2026-08-24','2026-10-15']){
  assert.deepEqual(crownDailyConfig(date),{seed:dailyPuzzleSeed('korony',date),version:1,difficulty:difficultyForGameDate('korony',date)});
 }
});
test('published v2 links keep their original board instead of silently switching',()=>{
 assert.deepEqual(crownDailyConfig('2026-10-16',{challengeId:'figlo:korony:2026-10-16:v2'}),
   {seed:'figlo:korony:2026-10-16:v2',version:2,difficulty:'medium'});
 assert.deepEqual(crownDailyConfig('2026-10-19',{challengeId:'figlo:korony:2026-10-19:v2'}),
   {seed:'figlo:korony:2026-10-19:v2',version:2,difficulty:'easy'});
});
test('new Korony are gentle on all weekdays',()=>{
 for(const date of ['2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-22']){
  assert.deepEqual(crownDailyConfig(date),{seed:`figlo:korony:${date}:v3`,version:3,difficulty:'gentle'});
 }
});
test('manifest and daily service advertise the actual versioned Crown puzzle',async()=>{
 for(const date of ['2026-10-15','2026-10-16']){
  const expected=crownDailyConfig(date);
  const record=await getDailyGame('korony',date);
  const manifest=await getDailyManifest(date,{fetchImpl:null});
  assert.equal(record.puzzleId,expected.seed);
  assert.equal(record.version,expected.version);
  assert.equal(manifest.games.find(g=>g.id==='korony').puzzleId,expected.seed);
 }
});
test('new randomized puzzles are genuinely easy, unique and start without pieces',{timeout:120000},()=>{
 for(const date of ['2026-10-16','2026-10-18','2026-10-22']){
  const c=crownDailyConfig(date),p=generatePuzzle(c.seed,{difficulty:c.difficulty});
  assert.equal(p.size,9);
  assert.equal(countRegionSolutions(p.regions,2).count,1);
  assert.equal(validateGeneratedRegions(p.regions),true);
  assert.ok(p.difficultyScore<=21,`Harder-than-expected ${date}`);
  assert.equal(p.deductionRules.includes('hypothetical-crossout'),false);
  assert.equal(p.solution.length,9);
  assert.equal(Object.hasOwn(p,'givens'),false);
 }
});
test('fallback layout has low deduction complexity and unique solution',{timeout:120000},()=>{
 const p=generatePuzzle('figlo:korony:2026-10-22:v3',{difficulty:'gentle'});
 assert.ok(p.difficultyScore<=21);
 assert.equal(countRegionSolutions(p.regions,2).count,1);
 assert.equal(p.deductionRules.includes('hypothetical-crossout'),false);
});

test('short-budget gentle Crown training falls back promptly to an easy valid board',{timeout:120000},()=>{
 const p=generatePuzzle('test-fast-training-2026',{difficulty:'gentle',maxAttempts:150});
 assert.equal(p.size,9);
 assert.equal(countRegionSolutions(p.regions,2).count,1);
 assert.ok(p.difficultyScore<=21);
 assert.equal(p.deductionRules.includes('hypothetical-crossout'),false);
});
