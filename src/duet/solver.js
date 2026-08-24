import { A, B, EMPTY, SIZE } from './constants.js';
import { boardFromPuzzle, cloneBoard } from './model.js';
import { isPartialBoardValid, isSolved } from './rules.js';

function candidatesFor(board, puzzle, index) {
  if (board[index] !== EMPTY) return [board[index]];
  const result = [];
  for (const value of [A, B]) {
    board[index] = value;
    if (isPartialBoardValid(board, puzzle)) result.push(value);
  }
  board[index] = EMPTY;
  return result;
}

function chooseCell(board, puzzle) {
  let bestIndex = -1;
  let bestCandidates = null;
  for (let index = 0; index < board.length; index++) {
    if (board[index] !== EMPTY) continue;
    const candidates = candidatesFor(board, puzzle, index);
    if (candidates.length === 0) return { index, candidates };
    if (!bestCandidates || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  return { index: bestIndex, candidates: bestCandidates || [] };
}

function initialBoard(puzzle, board) {
  const result = board ? cloneBoard(board) : boardFromPuzzle(puzzle);
  for (const given of puzzle.givens || []) {
    if (result[given.index] !== EMPTY && result[given.index] !== given.value) return null;
    result[given.index] = given.value;
  }
  return isPartialBoardValid(result, puzzle) ? result : null;
}

export function solveOne(puzzle, board = null) {
  const start = initialBoard(puzzle, board);
  if (!start) return null;

  function search(current) {
    if (isSolved(current, puzzle)) return cloneBoard(current);
    const { index, candidates } = chooseCell(current, puzzle);
    if (index < 0 || candidates.length === 0) return null;
    for (const value of candidates) {
      current[index] = value;
      const solved = search(current);
      if (solved) return solved;
      current[index] = EMPTY;
    }
    return null;
  }

  return search(start);
}

export function countSolutions(puzzle, limit = 2, board = null) {
  const start = initialBoard(puzzle, board);
  if (!start) return 0;
  let count = 0;

  function search(current) {
    if (count >= limit) return;
    if (isSolved(current, puzzle)) {
      count += 1;
      return;
    }
    const { index, candidates } = chooseCell(current, puzzle);
    if (index < 0 || candidates.length === 0) return;
    for (const value of candidates) {
      current[index] = value;
      search(current);
      current[index] = EMPTY;
      if (count >= limit) return;
    }
  }

  search(start);
  return count;
}

export function validCandidates(puzzle, board, index) {
  const working = cloneBoard(board);
  return candidatesFor(working, puzzle, index);
}
