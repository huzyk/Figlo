import { A, B, EMPTY, HALF, REL_DIFFERENT, REL_SAME, SIZE, opposite } from './constants.js';
import { boardFromPuzzle, cloneBoard, indexOf } from './model.js';
import { countValues, getColumn, getRow, isPartialBoardValid, isSolved } from './rules.js';

function step(index, value, rule, reason, affected = [index]) {
  return { type: 'place', index, value, rule, reason, affected };
}

function lineSteps(line, indices, axisLabel) {
  const counts = countValues(line);
  if (counts.a === HALF || counts.b === HALF) {
    const forced = counts.a === HALF ? B : A;
    const empty = indices.filter((_, i) => line[i] === EMPTY);
    if (empty.length) return step(empty[0], forced, `${axisLabel}-balance`, `W ${axisLabel === 'row' ? 'wierszu' : 'kolumnie'} są już trzy symbole jednego typu, więc pozostałe muszą być drugiego typu.`, indices);
  }

  for (let i = 0; i <= SIZE - 3; i++) {
    const x = line[i], y = line[i + 1], z = line[i + 2];
    if (x !== EMPTY && x === y && z === EMPTY) return step(indices[i + 2], opposite(x), 'triple-right', 'Dwa takie same symbole obok siebie wymuszają przeciwny symbol na kolejnym polu.', indices.slice(i, i + 3));
    if (x === EMPTY && y !== EMPTY && y === z) return step(indices[i], opposite(y), 'triple-left', 'Dwa takie same symbole obok siebie wymuszają przeciwny symbol po drugiej stronie.', indices.slice(i, i + 3));
    if (x !== EMPTY && x === z && y === EMPTY) return step(indices[i + 1], opposite(x), 'sandwich', 'Dwa takie same symbole z jednym pustym polem między nimi wymuszają przeciwny symbol pośrodku.', indices.slice(i, i + 3));
  }
  return null;
}

function relationStep(puzzle, board) {
  for (const relation of puzzle.relations || []) {
    const left = board[relation.a], right = board[relation.b];
    if (left !== EMPTY && right === EMPTY) {
      const value = relation.type === REL_SAME ? left : opposite(left);
      return step(relation.b, value, relation.type === REL_SAME ? 'relation-same' : 'relation-different', relation.type === REL_SAME ? 'Znak równości oznacza, że oba pola muszą mieć ten sam symbol.' : 'Znak różności oznacza, że oba pola muszą mieć różne symbole.', [relation.a, relation.b]);
    }
    if (right !== EMPTY && left === EMPTY) {
      const value = relation.type === REL_SAME ? right : opposite(right);
      return step(relation.a, value, relation.type === REL_SAME ? 'relation-same' : 'relation-different', relation.type === REL_SAME ? 'Znak równości oznacza, że oba pola muszą mieć ten sam symbol.' : 'Znak różności oznacza, że oba pola muszą mieć różne symbole.', [relation.a, relation.b]);
    }
  }
  return null;
}

export function getNextHumanStep(puzzle, board) {
  if (!isPartialBoardValid(board, puzzle)) return null;

  for (let row = 0; row < SIZE; row++) {
    const indices = Array.from({ length: SIZE }, (_, col) => indexOf(row, col));
    const found = lineSteps(getRow(board, row), indices, 'row');
    if (found && board[found.index] === EMPTY) return found;
  }
  for (let col = 0; col < SIZE; col++) {
    const indices = Array.from({ length: SIZE }, (_, row) => indexOf(row, col));
    const found = lineSteps(getColumn(board, col), indices, 'column');
    if (found && board[found.index] === EMPTY) return found;
  }

  return relationStep(puzzle, board);
}

export function solveLikeHuman(puzzle, board = null, maxSteps = 200) {
  const working = board ? cloneBoard(board) : boardFromPuzzle(puzzle);
  const steps = [];
  for (let iteration = 0; iteration < maxSteps; iteration++) {
    if (isSolved(working, puzzle)) return { solved: true, board: working, steps, score: scoreHumanSteps(steps) };
    const next = getNextHumanStep(puzzle, working);
    if (!next) break;
    working[next.index] = next.value;
    if (!isPartialBoardValid(working, puzzle)) return { solved: false, board: working, steps, score: scoreHumanSteps(steps), contradiction: true };
    steps.push(next);
  }
  return { solved: isSolved(working, puzzle), board: working, steps, score: scoreHumanSteps(steps) };
}

export function scoreHumanSteps(steps) {
  const weights = {
    'triple-left': 1,
    'triple-right': 1,
    sandwich: 1,
    'row-balance': 1,
    'column-balance': 1,
    'relation-same': 1,
    'relation-different': 1
  };
  return steps.reduce((sum, item) => sum + (weights[item.rule] || 2), 0);
}
