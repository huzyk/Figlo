import test from 'node:test';
import assert from 'node:assert/strict';
import { N } from '../src/puzzle.js';
import { calculateAutoXs, conflicts, createGameState, cycleCell, isSolved, restore, snapshot, visibleXs } from '../src/game.js';
import { countSolutions, hasSolution } from '../src/solver.js';
import { getHint, isCandidate } from '../src/hints.js';

const solution = [5,10,22,29,43,45,62,66,78];

test('plansza ma dokładnie jedno rozwiązanie', () => {
  assert.equal(countSolutions(createGameState(), 2), 1);
});

test('korony nie mogą dzielić wiersza', () => {
  assert.deepEqual([...conflicts(new Set([0, 8]))].sort((a,b)=>a-b), [0,8]);
});

test('korony nie mogą dzielić kolumny', () => {
  assert.deepEqual([...conflicts(new Set([0, 72]))].sort((a,b)=>a-b), [0,72]);
});

test('korony nie mogą dzielić regionu', () => {
  assert.deepEqual([...conflicts(new Set([0, 9]))].sort((a,b)=>a-b), [0,9]);
});

test('korony nie mogą się stykać po przekątnej', () => {
  assert.deepEqual([...conflicts(new Set([3, 13]))].sort((a,b)=>a-b), [3,13]);
});

test('postawienie korony wylicza Auto X w rzędzie, kolumnie, regionie i sąsiedztwie', () => {
  const auto = calculateAutoXs(new Set([5]));
  for (const cell of [0,4,6,14,41]) assert.equal(auto.has(cell), true, `brak Auto X na ${cell}`);
  assert.equal(auto.has(5), false);
});

test('zdjęcie korony usuwa tylko wynikające z niej Auto X', () => {
  const before = calculateAutoXs(new Set([5]));
  const after = calculateAutoXs(new Set());
  assert.equal(before.size > 0, true);
  assert.equal(after.size, 0);
});

test('ręczne X pozostaje po zdjęciu korony', () => {
  const state = createGameState([5], [0]);
  const withAuto = visibleXs(state, true);
  assert.equal(withAuto.has(0), true);
  const withoutCrown = createGameState([], [0]);
  assert.equal(visibleXs(withoutCrown, true).has(0), true);
});

test('wyłączenie Auto X ukrywa tylko automatyczne X', () => {
  const state = createGameState([5], [0]);
  assert.equal(visibleXs(state, false).has(0), true);
  assert.equal(visibleXs(state, false).has(14), false);
  assert.equal(visibleXs(state, true).has(14), true);
});

test('undo snapshot przywraca wyłącznie crowns i manualXs', () => {
  const state = createGameState([5], [0,1]);
  const snap = snapshot(state);
  const changed = cycleCell(state, 2);
  assert.equal(changed.manualXs.has(2), true);
  const restored = restore(snap);
  assert.deepEqual([...restored.crowns], [5]);
  assert.deepEqual([...restored.manualXs], [0,1]);
  assert.equal('autoXs' in snap, false);
});

test('podpowiedź nigdy nie wskazuje niemożliwego pola jako kandydata', () => {
  const state = createGameState([5], []);
  const hint = getHint(state, []);
  if (hint?.kind === 'candidate') {
    for (const cell of hint.cells) assert.equal(isCandidate(state, cell), true, `niemożliwy kandydat ${cell}`);
  }
});

test('poprawne rozwiązanie kończy grę', () => {
  const state = createGameState(solution, []);
  assert.equal(state.crowns.size, N);
  assert.equal(hasSolution(state), true);
  assert.equal(isSolved(state), true);
});
