import test from 'node:test';
import assert from 'node:assert/strict';
import { N, regions, validatePuzzleDefinition } from '../src/puzzle.js';
import { calculateAutoXs, conflicts, createGameState, cycleCell, isSolved, restore, snapshot, visibleXs } from '../src/game.js';
import { countSolutions, hasSolution } from '../src/solver.js';
import { deductionHint, findMistake, getHint, isCandidate, solverBackedElimination } from '../src/hints.js';

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

test('zdjęcie korony usuwa wynikające z niej Auto X', () => {
  const before = calculateAutoXs(new Set([5]));
  const after = calculateAutoXs(new Set());
  assert.equal(before.size > 0, true);
  assert.equal(after.size, 0);
});

test('manual X pozostaje po zmianie koron', () => {
  const state = createGameState([5], [0]);
  const changed = cycleCell(state, 5);
  assert.equal(changed.crowns.has(5), false);
  assert.equal(changed.manualXs.has(0), true);
});

test('wyłączenie Auto X ukrywa tylko automatyczne X i nie zmienia manualXs', () => {
  const state = createGameState([5], [0]);
  assert.equal(visibleXs(state, false).has(0), true);
  assert.equal(visibleXs(state, false).has(14), false);
  assert.equal(visibleXs(state, true).has(14), true);
  assert.deepEqual([...state.manualXs], [0]);
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

test('sprzeczność po kolejnych ruchach wskazuje ruch, który faktycznie ją spowodował', () => {
  const initial = createGameState();
  const badA = cycleCell(initial, solution[0]);
  const afterB = cycleCell(badA, 0);
  const history = [snapshot(initial), snapshot(badA)];
  const hint = findMistake(afterB, history);
  assert.deepEqual(hint.cells, [solution[0]]);
});

test('forced-cell hint wskazuje dokładnie jednego poprawnego kandydata', () => {
  const state = createGameState([], Array.from({length:N - 1}, (_, col) => col));
  const hint = deductionHint(state);
  assert.equal(hint.kind, 'candidate');
  assert.equal(hint.cells.length, 1);
  assert.equal(isCandidate(state, hint.cells[0]), true);
});

test('hint eliminacji nie eliminuje pola z poprawnego rozwiązania', () => {
  const hint = deductionHint(createGameState());
  assert.equal(hint.kind, 'eliminate');
  assert.equal((hint.eliminate || []).length > 0, true);
  for (const cell of hint.eliminate) assert.equal(solution.includes(cell), false, `wyeliminowano pole rozwiązania ${cell}`);
});

test('solver-backed elimination rzeczywiście prowadziłaby do 0 rozwiązań', () => {
  const state = createGameState();
  const hint = solverBackedElimination(state);
  assert.equal(hint.kind, 'eliminate');
  assert.equal(hint.eliminate.length, 1);
  const hypothetical = createGameState([hint.eliminate[0]], []);
  assert.equal(countSolutions(hypothetical, 1), 0);
  assert.equal(solution.includes(hint.eliminate[0]), false);
});

test('solver zwraca 0 dla jawnie sprzecznego stanu', () => {
  assert.equal(countSolutions(createGameState([0,8], []), 1), 0);
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
