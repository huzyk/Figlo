import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, cycleCell, snapshot } from '../src/game.js';
import { findMistake } from '../src/hints.js';

const solution = [5,10,22,29,43,45,62,66,78];

test('historia wskazuje pierwszy ruch, który zepsuł planszę, nawet gdy później doszły kolejne błędy', () => {
  const initial = createGameState();
  const firstBad = cycleCell(initial, solution[0]);
  const secondBad = cycleCell(firstBad, solution[1]);

  const hint = findMistake(secondBad, [snapshot(initial), snapshot(firstBad)]);

  assert.equal(hint.kind, 'error');
  assert.deepEqual(hint.cells, [solution[0]]);
  assert.match(hint.text, /pierwszym ruchem/);
});
