import test from'node:test';
import assert from'node:assert/strict';
import{requiredGamesForDate}from'../src/daily-games.js';
import{difficultyForGameDate}from'../src/difficulty-schedule.js';
import{loadZipDaily}from'../src/zip/daily-loader.js';

test('Zip joins the daily set on 2026-08-28',()=>{assert.deepEqual(requiredGamesForDate('2026-08-27'),['korony','duet','bloki','latarnie']);assert.deepEqual(requiredGamesForDate('2026-08-28'),['korony','duet','bloki','latarnie','zip']);});

test('Zip daily generation is stable',async()=>{const first=await loadZipDaily('2026-08-28'),second=await loadZipDaily('2026-08-28');assert.equal(first.puzzleId,'zip:2026-08-28:v1');assert.deepEqual(first.puzzle,second.puzzle);assert.deepEqual(first.solution,second.solution);assert.equal(first.puzzle.difficulty,difficultyForGameDate('zip','2026-08-28'));});
