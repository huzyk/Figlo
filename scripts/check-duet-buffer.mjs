import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { figloDateKey, dateFromKey } from '../src/daily.js';
import { validateDuetDailyRecord } from '../src/duet/daily-loader.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

export async function checkDuetBuffer({ start = figloDateKey(), days = 14, directory = fileURLToPath(new URL('../data/duet/', import.meta.url)) } = {}) {
  if (!dateFromKey(start) || !Number.isInteger(days) || days < 1) throw new Error('Invalid start date or buffer length.');
  const failures = [];
  const [year, month, day] = start.split('-').map(Number);
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    try {
      const record = JSON.parse(await fs.readFile(path.join(directory, `${date}.json`), 'utf8'));
      if (!validateDuetDailyRecord(record, date) || !isSolved(record.solution, record.puzzle) || countSolutions(record.puzzle, 2) !== 1) throw new Error('Invalid or non-unique puzzle');
      const human = solveLikeHuman(record.puzzle);
      if (!human.solved || human.steps.some(step => ['guess', 'lookahead'].includes(step.rule))) throw new Error('Puzzle requires guessing');
    } catch (error) {
      failures.push(`${date}: ${error.message}`);
    }
  }
  if (failures.length) throw new Error(`Duet buffer incomplete or invalid:\n${failures.join('\n')}`);
  return { start, days };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--start') options.start = process.argv[++i];
    else if (process.argv[i] === '--days') options.days = Number(process.argv[++i]);
    else throw new Error(`Unknown argument: ${process.argv[i]}`);
  }
  const result = await checkDuetBuffer(options);
  console.log(`Duet buffer OK: ${result.days} days from ${result.start}`);
}
