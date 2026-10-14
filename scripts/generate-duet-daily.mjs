import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateFromKey, dailyPuzzleSeed } from '../src/daily.js';
import { difficultyForGameDate } from '../src/difficulty-schedule.js';
import { generateDuetPuzzle, DUET_GENERATOR_VERSION } from '../src/duet/generator.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';
import { puzzleIdFor } from '../src/domain/completion.js';
import { validateDuetDailyRecord } from '../src/duet/daily-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'data', 'duet');

function parseArgs(args = process.argv.slice(2)) {
  const result = { start: null, days: 30, skipExisting: false, checkOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start') result.start = args[++i];
    else if (args[i] === '--days') result.days = Number(args[++i]);
    else if (args[i] === '--skip-existing') result.skipExisting = true;
    else if (args[i] === '--check-only') {
      result.checkOnly = true;
      result.skipExisting = true;
    } else throw new Error('Nieznana opcja: ' + args[i]);
  }
  if (!dateFromKey(result.start)) {
    throw new Error('Użycie: node scripts/generate-duet-daily.mjs --start YYYY-MM-DD [--days N] [--skip-existing] [--check-only]');
  }
  if (!Number.isInteger(result.days) || result.days < 1 || result.days > 730) {
    throw new Error('--days musi być liczbą całkowitą od 1 do 730.');
  }
  return result;
}

function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

function assertValid(record, date) {
  if (!validateDuetDailyRecord(record, date)) {
    throw new Error(`Duet ${date}: nieprawidłowy rekord Daily.`);
  }
  if (record.puzzleId !== puzzleIdFor('duet', date, record.version)) {
    throw new Error(`Duet ${date}: identyfikator nie odpowiada opublikowanej wersji.`);
  }
  if (countSolutions(record.puzzle, 2) !== 1) {
    throw new Error(`Duet ${date}: plansza nie ma dokładnie jednego rozwiązania.`);
  }
  if (!isSolved(record.solution, record.puzzle)) {
    throw new Error(`Duet ${date}: niepoprawne rozwiązanie.`);
  }
  const human = solveLikeHuman(record.puzzle);
  if (!human.solved || human.steps.some(step => step.rule === 'guess' || step.rule === 'lookahead')) {
    throw new Error(`Duet ${date}: planszy nie można rozwiązać logicznie bez zgadywania.`);
  }
}

async function readExisting(filename) {
  try {
    return await fs.readFile(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function runDuetGeneration(args = process.argv.slice(2), options = {}) {
  const { start, days, skipExisting, checkOnly } = parseArgs(args);
  const directory = options.outputDir || outputDir;
  await fs.mkdir(directory, { recursive: true });
  let generated = 0, skipped = 0, totalMs = 0, maxMs = 0, slowestDate = null;
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(start, offset);
    const filename = path.join(directory, `${date}.json`);

    if (skipExisting) {
      const existing = await readExisting(filename);
      if (existing !== null) {
        let record;
        try { record = JSON.parse(existing); }
        catch (error) { throw new Error(`Duet ${date}: uszkodzony plik JSON: ${error.message}`); }
        // A published puzzle is immutable: players may already have saved progress.
        assertValid(record, date);
        skipped++;
        continue;
      }
      if (checkOnly) throw new Error(`Duet ${date}: brak planszy w buforze.`);
    }

    const seed = dailyPuzzleSeed('duet', date);
    const requestedDifficulty = difficultyForGameDate('duet', date);
    const started = performance.now();
    const result = generateDuetPuzzle(seed, { difficulty: requestedDifficulty });
    const elapsed = performance.now() - started;
    totalMs += elapsed;
    if (elapsed > maxMs) { maxMs = elapsed; slowestDate = date; }

    const version = result.generatorVersion || DUET_GENERATOR_VERSION;
    const record = {
      date,
      game: 'duet',
      version,
      puzzleId: puzzleIdFor('duet', date, version),
      seed,
      resolvedSeed: result.resolvedSeed,
      requestedDifficulty,
      puzzle: result.puzzle,
      solution: result.solution,
      difficulty: result.difficulty
    };
    assertValid(record, date);
    // In maintenance mode, never overwrite an existing file, even during a race.
    await fs.writeFile(filename, JSON.stringify(record, null, 2) + '\n', {
      encoding: 'utf8', flag: skipExisting ? 'wx' : 'w'
    });
    generated++;
    if (generated % 25 === 0) console.log(`Generated ${generated} new Duet days`);
  }

  const end = addDays(start, days - 1);
  const report = `Duet verified: ${start} through ${end} (${days} days); generated=${generated}, preserved=${skipped}; ` +
    `avg new=${generated ? (totalMs / generated).toFixed(1) : 0}ms, max=${maxMs.toFixed(1)}ms (${slowestDate || 'n/a'})`;
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
      `### Duet daily buffer\n\n- Dates: ${start} – ${end}\n- Validated: ${days}\n- New puzzles: ${generated}\n- Existing puzzles preserved: ${skipped}\n\n`);
  }
  return { start, end, days, generated, skipped };
}

// Importing this file from unit tests must not generate anything.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runDuetGeneration();
}
