import { A, B, EMPTY, REL_DIFFERENT, REL_SAME, SIZE } from './constants.js';
import { indexOf } from './model.js';
import { isPartialBoardValid, isSolved } from './rules.js';
import { countSolutions } from './solver.js';
import { solveLikeHuman } from './human-solver.js';
import { gradeDifficulty } from './difficulty.js';

export const DUET_GENERATOR_VERSION = 4;
export const DAILY_MIN_SCORE = 24;
export const DAILY_TARGET_SCORE = 30;
export const DAILY_MAX_SCORE = 38;
export const DAILY_MIN_GIVENS = 9;
export const DAILY_MAX_GIVENS = 11;
export const DAILY_MIN_RELATIONS = 4;
const BEST_CANDIDATE_EARLY_RETURN_ATTEMPT = 31;

const DIFFICULTY_PROFILES = {
  easy: { minScore:24, targetScore:25, maxScore:28 },
  medium: { minScore:24, targetScore:30, maxScore:38 },
  hard: { minScore:30, targetScore:35, maxScore:38 }
};

function profileFor(level='medium') { return DIFFICULTY_PROFILES[level] || DIFFICULTY_PROFILES.medium; }
function hashSeed(value) { let hash = 2166136261 >>> 0; for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed) { let value = seed >>> 0; return () => { value = (value + 0x6D2B79F5) | 0; let t = Math.imul(value ^ (value >>> 15), 1 | value); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(values, random) { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function validRowPatterns() { const rows = []; for (let mask = 0; mask < 1 << SIZE; mask++) { const row = Array.from({ length: SIZE }, (_, i) => ((mask >> i) & 1) ? A : B); if (row.filter(v => v === A).length !== SIZE / 2) continue; let triple = false; for (let i = 0; i <= SIZE - 3; i++) if (row[i] === row[i + 1] && row[i + 1] === row[i + 2]) triple = true; if (!triple) rows.push(row); } return rows; }
const ROW_PATTERNS = validRowPatterns();
function generateSolution(random) { const board = Array(SIZE * SIZE).fill(EMPTY); const rowOrder = shuffle(ROW_PATTERNS, random); function search(row) { if (row === SIZE) return isSolved(board, { givens: [], relations: [] }); for (const pattern of shuffle(rowOrder, random)) { for (let col = 0; col < SIZE; col++) board[indexOf(row, col)] = pattern[col]; if (isPartialBoardValid(board, { relations: [] }) && search(row + 1)) return true; for (let col = 0; col < SIZE; col++) board[indexOf(row, col)] = EMPTY; } return false; } if (!search(0)) throw new Error('Nie udało się zbudować rozwiązania Duetu.'); return [...board]; }
function allAdjacentPairs() { const pairs = []; for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) { const a = indexOf(row, col); if (col + 1 < SIZE) pairs.push([a, indexOf(row, col + 1)]); if (row + 1 < SIZE) pairs.push([a, indexOf(row + 1, col)]); } return pairs; }
function createRelations(solution, random, count = 6) { return shuffle(allAdjacentPairs(), random).slice(0, count).map(([a,b]) => ({ a, b, type: solution[a] === solution[b] ? REL_SAME : REL_DIFFERENT })); }
function createInitialPuzzle(solution, random) { const givens = shuffle(Array.from({ length: solution.length }, (_, index) => index), random).slice(0, DAILY_MAX_GIVENS).map(index => ({ index, value: solution[index] })); return { size: SIZE, givens, relations: createRelations(solution, random, 6) }; }
function acceptable(puzzle) { if (countSolutions(puzzle, 2) !== 1) return null; const human = solveLikeHuman(puzzle); return human.solved ? human : null; }
function minimizePuzzle(puzzle, random) {
  let current = { size: SIZE, givens: [...puzzle.givens], relations: [...puzzle.relations] };
  const clues = shuffle([...current.givens.map(item => ({ kind:'given', item })), ...current.relations.map(item => ({ kind:'relation', item }))], random);
  for (const clue of clues) {
    if (clue.kind === 'given' && current.givens.length <= DAILY_MIN_GIVENS) continue;
    if (clue.kind === 'relation' && current.relations.length <= DAILY_MIN_RELATIONS) continue;
    const candidate = { size: SIZE, givens:[...current.givens], relations:[...current.relations] };
    if (clue.kind === 'given') {
      if (!current.givens.includes(clue.item)) continue;
      candidate.givens = candidate.givens.filter(item => item !== clue.item);
    } else {
      if (!current.relations.includes(clue.item)) continue;
      candidate.relations = candidate.relations.filter(item => item !== clue.item);
    }
    if (acceptable(candidate)) current = candidate;
  }
  return current;
}
function distanceFromTarget(score, target) { return Math.abs(score - target); }
function isDailyCandidate(puzzle, difficulty, profile) { return puzzle.givens.length >= DAILY_MIN_GIVENS && puzzle.givens.length <= DAILY_MAX_GIVENS && puzzle.relations.length >= DAILY_MIN_RELATIONS && difficulty.score >= profile.minScore && difficulty.score <= profile.maxScore; }

export function generateDuetPuzzle(seed, { maxAttempts = 160, difficulty = 'medium' } = {}) {
  const normalizedSeed = String(seed);
  const profile = profileFor(difficulty);
  let best = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = `${normalizedSeed}:${attempt}`;
    const random = seededRandom(hashSeed(`figlo:duet:${DUET_GENERATOR_VERSION}:${attemptSeed}`));
    const solution = generateSolution(random);
    const puzzle = minimizePuzzle(createInitialPuzzle(solution, random), random);
    const human = acceptable(puzzle);
    if (!human) continue;
    const graded = gradeDifficulty(human);
    const candidate = { seed:normalizedSeed, resolvedSeed:attemptSeed, generatorVersion:DUET_GENERATOR_VERSION, requestedDifficulty:difficulty, puzzle, solution, difficulty:graded };
    if (!isDailyCandidate(puzzle, graded, profile)) continue;
    if (!best || distanceFromTarget(graded.score, profile.targetScore) < distanceFromTarget(best.difficulty.score, profile.targetScore)) best = candidate;
    if (graded.score === profile.targetScore) return candidate;
    if (best && attempt >= BEST_CANDIDATE_EARLY_RETURN_ATTEMPT) return best;
  }
  if (best) return best;
  throw new Error(`Nie udało się wygenerować Duetu (${difficulty}): score ${profile.minScore}-${profile.maxScore}.`);
}

export { DIFFICULTY_PROFILES };
