import { A, B, EMPTY, HALF, REL_DIFFERENT, REL_SAME, SIZE } from './constants.js';
import { indexOf } from './model.js';

export function getRow(board, row) {
  return Array.from({ length: SIZE }, (_, col) => board[indexOf(row, col)]);
}

export function getColumn(board, col) {
  return Array.from({ length: SIZE }, (_, row) => board[indexOf(row, col)]);
}

export function countValues(line) {
  let a = 0, b = 0, empty = 0;
  for (const value of line) {
    if (value === A) a++;
    else if (value === B) b++;
    else empty++;
  }
  return { a, b, empty };
}

export function hasTriple(line) {
  for (let i = 0; i <= line.length - 3; i++) {
    const [x, y, z] = [line[i], line[i + 1], line[i + 2]];
    if (x !== EMPTY && x === y && y === z) return true;
  }
  return false;
}

export function respectsBalance(line) {
  const { a, b } = countValues(line);
  return a <= HALF && b <= HALF;
}

export function relationSatisfied(board, relation) {
  const left = board[relation.a];
  const right = board[relation.b];
  if (left === EMPTY || right === EMPTY) return true;
  if (relation.type === REL_SAME) return left === right;
  if (relation.type === REL_DIFFERENT) return left !== right;
  return false;
}

export function areAdjacent(a, b) {
  const ar = Math.floor(a / SIZE), ac = a % SIZE;
  const br = Math.floor(b / SIZE), bc = b % SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export function isPartialBoardValid(board, puzzle = { relations: [] }) {
  if (!Array.isArray(board) || board.length !== SIZE * SIZE) return false;
  for (const value of board) if (![EMPTY, A, B].includes(value)) return false;
  for (let row = 0; row < SIZE; row++) {
    const line = getRow(board, row);
    if (!respectsBalance(line) || hasTriple(line)) return false;
  }
  for (let col = 0; col < SIZE; col++) {
    const line = getColumn(board, col);
    if (!respectsBalance(line) || hasTriple(line)) return false;
  }
  for (const relation of puzzle.relations || []) {
    if (!areAdjacent(relation.a, relation.b) || !relationSatisfied(board, relation)) return false;
  }
  return true;
}

export function isSolved(board, puzzle) {
  if (!isPartialBoardValid(board, puzzle)) return false;
  if (board.some(value => value === EMPTY)) return false;
  for (let row = 0; row < SIZE; row++) {
    const { a, b } = countValues(getRow(board, row));
    if (a !== HALF || b !== HALF) return false;
  }
  for (let col = 0; col < SIZE; col++) {
    const { a, b } = countValues(getColumn(board, col));
    if (a !== HALF || b !== HALF) return false;
  }
  return true;
}
