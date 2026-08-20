import test from 'node:test';
import assert from 'node:assert/strict';
import { allCells } from '../src/puzzle.js';
import { createGameState, snapshot } from '../src/game.js';
import { hasSolution } from '../src/solver.js';
import { findMistake } from '../src/hints.js';

const solution = [5,10,22,29,43,45,62,66,78];

test('podpowiedź ignoruje historyczny błąd, którego nie ma już na planszy', () => {
  const badCrown = allCells.find(index => !solution.includes(index) && !hasSolution(createGameState([index], [])));
  assert.notEqual(badCrown, undefined);

  const initial = createGameState();
  const withBadCrown = createGameState([badCrown], []);
  const afterRemovingCrown = createGameState();
  const current = createGameState([], [solution[0]]);

  const hint = findMistake(current, [
    snapshot(initial),
    snapshot(withBadCrown),
    snapshot(afterRemovingCrown)
  ]);

  assert.equal(hint.kind, 'error');
  assert.deepEqual(hint.cells, [solution[0]]);
  assert.equal(current.manualXs.has(hint.cells[0]), true);
  assert.match(hint.text, /To X/);
  assert.doesNotMatch(hint.text, /Ta korona/);
});

test('przy kilku aktywnych błędach podpowiedź wskazuje najnowszy z nich', () => {
  const initial = createGameState();
  const firstBadX = createGameState([], [solution[0]]);
  const current = createGameState([], [solution[0], solution[1]]);

  const hint = findMistake(current, [snapshot(initial), snapshot(firstBadX)]);

  assert.equal(hint.kind, 'error');
  assert.deepEqual(hint.cells, [solution[1]]);
  assert.equal(current.manualXs.has(hint.cells[0]), true);
  assert.match(hint.text, /To X/);
});

test('po usunięciu najnowszego błędu podpowiedź wskazuje kolejny aktywny błąd', () => {
  const initial = createGameState();
  const current = createGameState([], [solution[0]]);

  const hint = findMistake(current, [snapshot(initial)]);

  assert.equal(hint.kind, 'error');
  assert.deepEqual(hint.cells, [solution[0]]);
  assert.equal(current.manualXs.has(hint.cells[0]), true);
});
