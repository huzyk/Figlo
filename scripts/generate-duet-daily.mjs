import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailyPuzzleSeed } from '../src/daily.js';
import { generateDuetPuzzle } from '../src/duet/generator.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'data', 'duet');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { start: null, days: 30 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start') result.start = args[++i];
    else if (args[i] === '--days') result.days = Number(args[++i]);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.start || '')) {
    throw new Error('Użycie: node scripts/generate-duet-daily.mjs --start YYYY-MM-DD [--days N]');
  }
  if (!Number.isInteger(result.days) || result.days < 1) throw new Error('--days musi być dodatnią liczbą całkowitą.');
  return result;
}

function addDays(dateKey, offset) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offset));
  return date.toISOString().slice(0, 10);
}

const { start, days } = parseArgs();
await fs.mkdir(outputDir, { recursive: true });

let totalMs = 0;
let maxMs = 0;
let slowestDate = null;

for (let offset = 0; offset < days; offset++) {
  const date = addDays(start, offset);
  const seed = dailyPuzzleSeed('duet', date);
  const started = performance.now();
  const generated = generateDuetPuzzle(seed);
  const elapsed = performance.now() - started;
  totalMs += elapsed;
  if (elapsed > maxMs) { maxMs = elapsed; slowestDate = date; }

  if (countSolutions(generated.puzzle, 2) !== 1) throw new Error(`Duet ${date}: plansza nie jest unikalna.`);
  if (!isSolved(generated.solution, generated.puzzle)) throw new Error(`Duet ${date}: solution jest niepoprawne.`);
  const human = solveLikeHuman(generated.puzzle);
  if (!human.solved || human.steps.some(step => step.rule === 'guess' || step.rule === 'lookahead')) {
    throw new Error(`Duet ${date}: human solver nie rozwiązuje planszy bez zgadywania.`);
  }

  const record = {
    date,
    game: 'duet',
    version: 1,
    seed,
    resolvedSeed: generated.resolvedSeed,
    puzzle: generated.puzzle,
    solution: generated.solution,
    difficulty: generated.difficulty
  };

  await fs.writeFile(
    path.join(outputDir, `${date}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  );

  if ((offset + 1) % 25 === 0 || offset + 1 === days) console.log(`Generated ${offset + 1}/${days}`);
}

console.log(`Duet daily package ready: ${days} days, avg=${(totalMs / days).toFixed(1)}ms, max=${maxMs.toFixed(1)}ms (${slowestDate})`);
