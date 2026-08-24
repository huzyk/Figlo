import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { validateDuetDailyRecord } from '../src/duet/daily-loader.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

test('preview Duet daily is valid, unique and human-solvable', async()=>{
  const record=JSON.parse(await fs.readFile(new URL('../data/duet/2026-08-24.json',import.meta.url),'utf8'));
  assert.equal(validateDuetDailyRecord(record,'2026-08-24'),true);
  assert.equal(countSolutions(record.puzzle,2),1);
  assert.equal(isSolved(record.solution,record.puzzle),true);
  assert.equal(solveLikeHuman(record.puzzle).solved,true);
});
