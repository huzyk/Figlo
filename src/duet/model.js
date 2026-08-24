import { CELL_COUNT, EMPTY, SIZE } from './constants.js';

export function createBoard(values = []) {
  const board = Array(CELL_COUNT).fill(EMPTY);
  for (let index = 0; index < Math.min(values.length, CELL_COUNT); index++) board[index] = values[index];
  return board;
}

export function cloneBoard(board) {
  return [...board];
}

export function indexOf(row, col) {
  return row * SIZE + col;
}

export function rowCol(index) {
  return [Math.floor(index / SIZE), index % SIZE];
}

export function boardFromPuzzle(puzzle) {
  const board = createBoard();
  for (const given of puzzle.givens || []) board[given.index] = given.value;
  return board;
}

export function normalizePuzzle(puzzle) {
  return {
    size: SIZE,
    givens: [...(puzzle.givens || [])].map(g => ({ index: Number(g.index), value: Number(g.value) })),
    relations: [...(puzzle.relations || [])].map(r => ({ a: Number(r.a), b: Number(r.b), type: r.type }))
  };
}
