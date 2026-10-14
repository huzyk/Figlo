// Sudoku Daily: seeded, uniquely solvable 9x9 puzzles, with no network dependency.
export const SIZE = 9;
export const CELL_COUNT = 81;
const ALL = 0b1111111110;

function random(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const boxOf = index => Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3);

export function candidates(board, index) {
  if (board[index]) return [];
  const used = new Set();
  const row = Math.floor(index / 9), col = index % 9;
  for (let k = 0; k < 9; k++) {
    used.add(board[row * 9 + k]);
    used.add(board[k * 9 + col]);
  }
  const firstRow = Math.floor(row / 3) * 3, firstCol = Math.floor(col / 3) * 3;
  for (let r = firstRow; r < firstRow + 3; r++) {
    for (let c = firstCol; c < firstCol + 3; c++) used.add(board[r * 9 + c]);
  }
  return Array.from({ length: 9 }, (_, i) => i + 1).filter(n => !used.has(n));
}

export function isSudokuSolved(board) {
  if (!Array.isArray(board) || board.length !== 81) return false;
  for (let group = 0; group < 9; group++) {
    const row = new Set(), col = new Set(), box = new Set();
    for (let i = 0; i < 9; i++) {
      row.add(board[group * 9 + i]);
      col.add(board[i * 9 + group]);
      box.add(board[(Math.floor(group / 3) * 3 + Math.floor(i / 3)) * 9 +
        (group % 3) * 3 + (i % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9 ||
      row.has(0) || col.has(0) || box.has(0)) return false;
  }
  return true;
}

// Minimum Remaining Values with bit masks. Stop once 2 solutions are found.
export function countSudokuSolutions(input, limit = 2) {
  if (!Array.isArray(input) || input.length !== CELL_COUNT) return 0;
  const board = input.slice(), rows = Array(9).fill(0),
    cols = Array(9).fill(0), boxes = Array(9).fill(0);
  const blanks = [];
  for (let i = 0; i < 81; i++) {
    const value = board[i], r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
    if (value === 0) { blanks.push(i); continue; }
    if (!Number.isInteger(value) || value < 1 || value > 9) return 0;
    const bit = 1 << value;
    if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let count = 0;
  function walk(depth) {
    if (count >= limit) return;
    if (depth === blanks.length) { count++; return; }
    let choice = -1, possibilities = 0, smallest = 10;
    for (let j = depth; j < blanks.length; j++) {
      const i = blanks[j], r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
      const mask = ALL & ~(rows[r] | cols[c] | boxes[b]);
      let size = 0;
      for (let bits = mask; bits; bits &= bits - 1) size++;
      if (!size) return;
      if (size < smallest) {
        smallest = size; choice = j; possibilities = mask;
        if (size === 1) break;
      }
    }
    [blanks[depth], blanks[choice]] = [blanks[choice], blanks[depth]];
    const i = blanks[depth], r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
    for (let bits = possibilities; bits; bits &= bits - 1) {
      const bit = bits & -bits, value = Math.log2(bit);
      board[i] = value; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      walk(depth + 1);
      rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; board[i] = 0;
      if (count >= limit) break;
    }
    [blanks[depth], blanks[choice]] = [blanks[choice], blanks[depth]];
  }
  walk(0);
  return count;
}

export function buildSudokuPuzzle(seed, { givens = 39 } = {}) {
  const rng = random(seed), digits = shuffled([1,2,3,4,5,6,7,8,9], rng);
  const shuffledBands = shuffled([0,1,2], rng);
  const shuffledStacks = shuffled([0,1,2], rng);
  const rows = shuffledBands.flatMap(b => shuffled([0,1,2], rng).map(r => b * 3 + r));
  const cols = shuffledStacks.flatMap(b => shuffled([0,1,2], rng).map(c => b * 3 + c));
  const solution = rows.flatMap(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
  const puzzle = [...solution], positions = shuffled(Array.from({ length: 81 }, (_, i) => i), rng);
  const target = Math.max(28, Math.min(55, givens));
  let filled = 81;
  for (const position of positions) {
    if (filled <= target) break;
    const saved = puzzle[position];
    puzzle[position] = 0;
    if (countSudokuSolutions(puzzle, 2) === 1) filled--;
    else puzzle[position] = saved;
  }
  return { game: 'sudoku', seed: String(seed), puzzle, solution, givens: filled,
    puzzleId: 'sudoku:' + String(seed) + ':v1' };
}

export function hasConflict(board, index) {
  const value = board[index];
  if (!value) return false;
  const copy = board.slice();
  copy[index] = 0;
  return !candidates(copy, index).includes(value);
}
