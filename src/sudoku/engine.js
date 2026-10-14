// PUZLI Sudoku 6x6: deterministic puzzles with 2-row x 3-column boxes.
export const SIZE = 6;
export const BOX_ROWS = 2;
export const BOX_COLS = 3;
export const CELL_COUNT = SIZE * SIZE;
const ALL = (1 << (SIZE + 1)) - 2;
const DIGITS = Array.from({length: SIZE}, (_, i) => i + 1);

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
const boxOf = index =>
  Math.floor(Math.floor(index / SIZE) / BOX_ROWS) * (SIZE / BOX_COLS) +
  Math.floor((index % SIZE) / BOX_COLS);

export function candidates(board, index) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT ||
      !Number.isInteger(index) || index < 0 || index >= CELL_COUNT || board[index]) return [];
  const used = new Set();
  const row = Math.floor(index / SIZE), col = index % SIZE;
  for (let k = 0; k < SIZE; k++) {
    used.add(board[row * SIZE + k]);
    used.add(board[k * SIZE + col]);
  }
  const firstRow = Math.floor(row / BOX_ROWS) * BOX_ROWS;
  const firstCol = Math.floor(col / BOX_COLS) * BOX_COLS;
  for (let r = firstRow; r < firstRow + BOX_ROWS; r++) {
    for (let c = firstCol; c < firstCol + BOX_COLS; c++) used.add(board[r * SIZE + c]);
  }
  return DIGITS.filter(n => !used.has(n));
}

export function isSudokuSolved(board) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) return false;
  for (let group = 0; group < SIZE; group++) {
    const row = new Set(), col = new Set(), box = new Set();
    const boxRow = Math.floor(group / (SIZE / BOX_COLS)) * BOX_ROWS;
    const boxCol = (group % (SIZE / BOX_COLS)) * BOX_COLS;
    for (let i = 0; i < SIZE; i++) {
      row.add(board[group * SIZE + i]);
      col.add(board[i * SIZE + group]);
      box.add(board[(boxRow + Math.floor(i / BOX_COLS)) * SIZE +
        boxCol + (i % BOX_COLS)]);
    }
    if (row.size !== SIZE || col.size !== SIZE || box.size !== SIZE ||
        row.has(0) || col.has(0) || box.has(0) ||
        [...row, ...col, ...box].some(n => !Number.isInteger(n) || n < 1 || n > SIZE)) return false;
  }
  return true;
}

// MRV search using bit masks. Stop at two solutions to validate uniqueness.
export function countSudokuSolutions(input, limit = 2) {
  if (!Array.isArray(input) || input.length !== CELL_COUNT) return 0;
  const board = input.slice(), rows = Array(SIZE).fill(0),
    cols = Array(SIZE).fill(0), boxes = Array(SIZE).fill(0);
  const blanks = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = board[i], r = Math.floor(i / SIZE), c = i % SIZE, b = boxOf(i);
    if (value === 0) { blanks.push(i); continue; }
    if (!Number.isInteger(value) || value < 1 || value > SIZE) return 0;
    const bit = 1 << value;
    if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let count = 0;
  function walk(depth) {
    if (count >= limit) return;
    if (depth === blanks.length) { count++; return; }
    let choice = -1, possibilities = 0, smallest = SIZE + 1;
    for (let j = depth; j < blanks.length; j++) {
      const i = blanks[j], r = Math.floor(i / SIZE), c = i % SIZE, b = boxOf(i);
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
    const i = blanks[depth], r = Math.floor(i / SIZE), c = i % SIZE, b = boxOf(i);
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

export function buildSudokuPuzzle(seed, { givens = 18 } = {}) {
  const rng = random(seed), digits = shuffled(DIGITS, rng);
  const shuffledBands = shuffled(Array.from({length: SIZE / BOX_ROWS}, (_, i) => i), rng);
  const shuffledStacks = shuffled(Array.from({length: SIZE / BOX_COLS}, (_, i) => i), rng);
  const rows = shuffledBands.flatMap(b =>
    shuffled(Array.from({length: BOX_ROWS}, (_, i) => i), rng).map(r => b * BOX_ROWS + r));
  const cols = shuffledStacks.flatMap(b =>
    shuffled(Array.from({length: BOX_COLS}, (_, i) => i), rng).map(c => b * BOX_COLS + c));
  const solution = rows.flatMap(r =>
    cols.map(c => digits[(r * BOX_COLS + Math.floor(r / BOX_ROWS) + c) % SIZE]));
  const puzzle = [...solution];
  const positions = shuffled(Array.from({length: CELL_COUNT}, (_, i) => i), rng);
  const target = Math.max(12, Math.min(25, Math.floor(givens)));
  let filled = CELL_COUNT;
  for (const position of positions) {
    if (filled <= target) break;
    const saved = puzzle[position];
    puzzle[position] = 0;
    if (countSudokuSolutions(puzzle, 2) === 1) filled--;
    else puzzle[position] = saved;
  }
  return {game: 'sudoku', seed: String(seed), size: SIZE, boxRows: BOX_ROWS,
    boxCols: BOX_COLS, puzzle, solution, givens: filled,
    puzzleId: 'sudoku:' + String(seed) + ':v2'};
}

export function hasConflict(board, index) {
  const value = board[index];
  if (!value) return false;
  const copy = board.slice();
  copy[index] = 0;
  return !candidates(copy, index).includes(value);
}
