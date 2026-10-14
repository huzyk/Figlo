import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, BOX_ROWS, BOX_COLS, CELL_COUNT, buildSudokuPuzzle,
  candidates, countSudokuSolutions, hasConflict, isSudokuSolved
} from '../src/sudoku/engine.js';
import { requiredGamesForDate } from '../src/daily-games.js';

test('6x6 Sudoku launches with the existing five games intact', () => {
  assert.equal(SIZE, 6);
  assert.equal(CELL_COUNT, 36);
  assert.equal(BOX_ROWS, 2);
  assert.equal(BOX_COLS, 3);
  assert.equal(requiredGamesForDate('2026-10-13').length, 5);
  assert.deepEqual(requiredGamesForDate('2026-10-14'),
    ['korony', 'duet', 'bloki', 'latarnie', 'zip', 'sudoku']);
});

test('one hundred consecutive Daily puzzles are deterministic and uniquely solvable', () => {
  const dates = Array.from({length: 100}, (_, i) =>
    new Date(Date.UTC(2026, 9, 14 + i)).toISOString().slice(0, 10));
  for (const date of dates) {
    const seed = 'puzli:sudoku:' + date + ':v2';
    const one = buildSudokuPuzzle(seed, {givens: 18});
    const two = buildSudokuPuzzle(seed, {givens: 18});
    assert.deepEqual(one, two, 'reproducible ' + date);
    assert.ok(one.givens >= 18 && one.givens <= 36, 'clues ' + date);
    assert.equal(one.puzzle.length, CELL_COUNT);
    assert.equal(one.solution.length, CELL_COUNT);
    assert.equal(one.size, SIZE);
    assert.equal(one.boxRows, BOX_ROWS);
    assert.equal(one.boxCols, BOX_COLS);
    assert.ok(isSudokuSolved(one.solution), 'valid full solution ' + date);
    assert.equal(countSudokuSolutions(one.puzzle), 1, 'unique ' + date);
    assert.ok(one.puzzle.every((value, i) => value === 0 || value === one.solution[i]));
  }
});

test('training puzzles use the same valid rules at lower clue count', () => {
  for (let i = 0; i < 30; i++) {
    const sudoku = buildSudokuPuzzle('training:test:' + i, {givens: 17});
    assert.ok(isSudokuSolved(sudoku.solution));
    assert.equal(countSudokuSolutions(sudoku.puzzle), 1);
    assert.ok(sudoku.givens >= 17);
  }
});

test('validation catches conflicts in rows, columns and 2x3 regions', () => {
  const full = buildSudokuPuzzle('validation:v2').solution;
  assert.equal(isSudokuSolved(full), true);
  assert.equal(countSudokuSolutions(full), 1);
  const sameRow = full.slice();
  sameRow[0] = sameRow[1];
  assert.equal(isSudokuSolved(sameRow), false);
  assert.equal(hasConflict(sameRow, 0), true);
  assert.equal(countSudokuSolutions(sameRow), 0);
  const sameColumn = full.slice();
  sameColumn[0] = sameColumn[SIZE];
  assert.equal(isSudokuSolved(sameColumn), false);
  assert.equal(hasConflict(sameColumn, 0), true);
  const sameBox = full.slice();
  sameBox[0] = sameBox[SIZE + 1];
  assert.equal(isSudokuSolved(sameBox), false);
  assert.equal(hasConflict(sameBox, 0), true);
  const missing = full.slice();
  missing[0] = 0;
  assert.deepEqual(candidates(missing, 0), [full[0]]);
  assert.equal(isSudokuSolved(missing), false);
  assert.equal(countSudokuSolutions(missing), 1);
  assert.equal(countSudokuSolutions(Array(81).fill(0)), 0);
  assert.equal(isSudokuSolved(Array(81).fill(1)), false);
});

test('versioned 6x6 sessions do not reuse 9x9 values or notes', async () => {
  const map = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem:k => map.has(k) ? map.get(k) : null,
    setItem:(k,v) => map.set(k, String(v)),
    removeItem:k => map.delete(k),
  };
  try {
    const {createSudokuSession,loadSudokuSession,saveSudokuSession,clearSudokuSession} =
      await import('../src/sudoku/session.js');
    const {puzzle,puzzleId} = (() => {
      const p = buildSudokuPuzzle('session:v2');
      return {puzzle:p.puzzle,puzzleId:p.puzzleId};
    })();
    map.set('puzli_sudoku_session_v1:2026-10-15', JSON.stringify({
      values:Array(81).fill(9),notes:Array(81).fill(1023)
    }));
    const fresh=loadSudokuSession({date:'2026-10-15',seed:puzzleId,puzzle});
    assert.equal(fresh.values.length,36);
    assert.equal(fresh.notes.length,36);
    assert.ok(fresh.notes.every(n=>n===0));
    fresh.values[puzzle.findIndex(v=>!v)]=3;
    saveSudokuSession(fresh);
    const restored=loadSudokuSession({date:'2026-10-15',seed:puzzleId,puzzle});
    assert.deepEqual(restored.values,fresh.values);
    clearSudokuSession('2026-10-15');
    assert.equal(map.has('puzli_sudoku_session_v2:2026-10-15'),false);
    assert.equal(map.has('puzli_sudoku_session_v1:2026-10-15'),true);
  } finally {
    globalThis.localStorage=previous;
  }
});
