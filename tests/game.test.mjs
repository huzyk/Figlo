import test from 'node:test';
import assert from 'node:assert/strict';
import { N, regions, validatePuzzleDefinition } from '../src/puzzle.js';
import { calculateAutoXs, conflicts, createGameState, cycleCell, isSolved, restore, snapshot, visibleXs } from '../src/game.js';
import { countSolutions, hasSolution } from '../src/solver.js';
import { deductionHint, findMistake, getHint } from '../src/hints.js';

const solution = [5,10,22,29,43,45,62,66,78];

test('plansza ma dokładnie jedno rozwiązanie', () => {
  assert.equal(countSolutions(createGameState(), 2), 1);
});

test('definicja puzzle ma poprawny rozmiar i dokładnie N niepustych regionów', () => {
  assert.deepEqual(validatePuzzleDefinition(regions, N), {valid:true, errors:[]});
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

test('Auto X nie zapisują się do state', () => {
  const state = createGameState([5], [0]);
  const auto = calculateAutoXs(state.crowns);
  assert.equal(auto.has(14), true);
  assert.equal(state.manualXs.has(14), false);
  assert.equal('autoXs' in state, false);
});

test('kliknięcie widocznego Auto X przechodzi bezpośrednio do korony', () => {
  const state = createGameState([5], []);
  assert.equal(visibleXs(state, true).has(14), true);
  const next = cycleCell(state, 14, {autoXEnabled:true});
  assert.equal(next.crowns.has(14), true);
  assert.equal(next.manualXs.has(14), false);
});

test('puste -> manual X -> korona -> puste', () => {
  const initial = createGameState();
  const x = cycleCell(initial, 20);
  assert.equal(x.manualXs.has(20), true);
  const crown = cycleCell(x, 20);
  assert.equal(crown.crowns.has(20), true);
  assert.equal(crown.manualXs.has(20), false);
  const empty = cycleCell(crown, 20);
  assert.equal(empty.crowns.has(20), false);
  assert.equal(empty.manualXs.has(20), false);
});

test('undo snapshot przywraca wyłącznie crowns i manualXs', () => {
  const state = createGameState([5], [0,1]);
  const snap = snapshot(state);
  const restored = restore(snap);
  assert.deepEqual([...restored.crowns], [5]);
  assert.deepEqual([...restored.manualXs], [0,1]);
});

test('aktywny błędny znak jest wskazywany zamiast historycznego ruchu', () => {
  const initial = createGameState();
  const current = createGameState([], [solution[0]]);
  const hint = findMistake(current, [snapshot(initial)]);
  assert.equal(hint.kind, 'error');
  assert.deepEqual(hint.cells, [solution[0]]);
  assert.match(hint.text, /To X/);
});

test('human hint daje konkretny logiczny krok', () => {
  const hint = deductionHint(createGameState());
  assert.ok(hint);
  assert.ok(['candidate','eliminate'].includes(hint.kind));
  assert.equal(typeof hint.text, 'string');
  assert.ok(hint.text.length > 0);
});

test('każda eliminacja z human hint nie usuwa pola poprawnego rozwiązania', () => {
  const hint = deductionHint(createGameState());
  for (const cell of hint?.eliminate || []) {
    assert.equal(solution.includes(cell), false, `wyeliminowano pole rozwiązania ${cell}`);
    assert.equal(hasSolution(createGameState([cell], [])), false, `fałszywe X na ${cell}`);
  }
});

test('kandydat na koronę z human hint jest zgodny z rozwiązaniem', () => {
  const hint = deductionHint(createGameState());
  if (hint?.kind !== 'candidate') return;
  for (const cell of hint.cells) {
    assert.equal(hasSolution(createGameState([cell], [])), true, `fałszywa korona na ${cell}`);
  }
});

test('solver zwraca 0 dla jawnie sprzecznego stanu', () => {
  assert.equal(countSolutions(createGameState([0,8], []), 1), 0);
});

test('getHint zwraca podpowiedź dla poprawnego stanu', () => {
  const hint = getHint(createGameState(), []);
  assert.ok(hint);
});

test('poprawne rozwiązanie kończy grę', () => {
  const state = createGameState(solution, []);
  assert.equal(state.crowns.size, N);
  assert.equal(hasSolution(state), true);
  assert.equal(isSolved(state), true);
});
