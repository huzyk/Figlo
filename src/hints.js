import { N, allCells, cellsInColumn, cellsInRegion, cellsInRow, rc, regionAt } from './puzzle.js';
import { cloneState, conflicts, createGameState, isBlockedByCrowns, restore } from './game.js';
import { hasSolution } from './solver.js';

export function isCandidate(state, index) {
  return !state.crowns.has(index) && !state.manualXs.has(index) && !isBlockedByCrowns(index, state.crowns);
}

export function getCandidatesForRow(state, row) {
  return cellsInRow(row).filter(index => isCandidate(state, index));
}

export function getCandidatesForColumn(state, col) {
  return cellsInColumn(col).filter(index => isCandidate(state, index));
}

export function getCandidatesForRegion(state, region) {
  return cellsInRegion(region).filter(index => isCandidate(state, index));
}

function hasCrownIn(state, cells) {
  return cells.some(index => state.crowns.has(index));
}

export function getUnits(state) {
  const units = [];
  for (let row = 0; row < N; row++) {
    const scope = cellsInRow(row);
    if (!hasCrownIn(state, scope)) units.push({type:'row', label:`${row + 1}. rzędzie`, scope, cells:getCandidatesForRow(state, row)});
  }
  for (let col = 0; col < N; col++) {
    const scope = cellsInColumn(col);
    if (!hasCrownIn(state, scope)) units.push({type:'col', label:`${col + 1}. kolumnie`, scope, cells:getCandidatesForColumn(state, col)});
  }
  for (let region = 0; region < N; region++) {
    const scope = cellsInRegion(region);
    if (!hasCrownIn(state, scope)) units.push({type:'region', label:'wyróżnionym regionie', scope, cells:getCandidatesForRegion(state, region), region});
  }
  return units;
}

function moveRecency(history, state, type, index) {
  const key = type === 'crown' ? 'crowns' : 'manualXs';
  const states = history.map(restore);
  states.push(state);
  let recency = -1;

  for (let i = 1; i < states.length; i++) {
    if (states[i][key].has(index) && !states[i - 1][key].has(index)) recency = i;
  }

  return recency;
}

function activeMistakes(state, history) {
  const mistakes = [];

  for (const index of state.crowns) {
    if (!hasSolution(createGameState([index], []))) {
      mistakes.push({type:'crown', index, recency:moveRecency(history, state, 'crown', index)});
    }
  }

  for (const index of state.manualXs) {
    if (!hasSolution(createGameState([], [index]))) {
      mistakes.push({type:'x', index, recency:moveRecency(history, state, 'x', index)});
    }
  }

  mistakes.sort((a, b) => b.recency - a.recency || b.index - a.index);
  return mistakes;
}

export function findMistake(state, history = []) {
  const direct = [...conflicts(state.crowns)];
  if (direct.length) return {kind:'error', cells:direct, text:'Te korony łamią jedną z zasad.'};
  if (hasSolution(state)) return null;

  const mistakes = activeMistakes(state, history);
  if (mistakes.length) {
    const mistake = mistakes[0];
    if (mistake.type === 'x') {
      return {
        kind:'error',
        cells:[mistake.index],
        text:'To X wyklucza pole potrzebne do rozwiązania.'
      };
    }

    return {
      kind:'error',
      cells:[mistake.index],
      text:'Ta korona stoi w miejscu, które uniemożliwia poprawne rozwiązanie planszy.'
    };
  }

  return {
    kind:'error',
    cells:[],
    text:'Kilka aktualnych oznaczeń razem uniemożliwia rozwiązanie. Cofnij ostatnie ruchy.'
  };
}

function crownKeepsSolution(state, index) {
  const hypothetical = cloneState(state);
  hypothetical.manualXs.delete(index);
  hypothetical.crowns.add(index);
  return hasSolution(hypothetical);
}

function crownIsImpossible(state, index) {
  return !crownKeepsSolution(state, index);
}

function crossoutKeepsSolution(state, index) {
  const hypothetical = cloneState(state);
  hypothetical.crowns.delete(index);
  hypothetical.manualXs.add(index);
  return hasSolution(hypothetical);
}

function combinations(values, size, start = 0, prefix = [], out = []) {
  if (prefix.length === size) {
    out.push([...prefix]);
    return out;
  }
  for (let i = start; i <= values.length - (size - prefix.length); i++) {
    prefix.push(values[i]);
    combinations(values, size, i + 1, prefix, out);
    prefix.pop();
  }
  return out;
}

function formatNumberList(values) {
  const numbers = values.map(value => String(value + 1));
  if (numbers.length <= 1) return numbers[0] || '';
  if (numbers.length === 2) return `${numbers[0]} i ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(', ')} i ${numbers[numbers.length - 1]}`;
}

function subsetDescription(mode, subsetValues) {
  const numbers = formatNumberList(subsetValues);
  if (mode === 'row') {
    return subsetValues.length === 1
      ? {where:`w ${numbers}. wierszu`, outside:`poza tym wierszem`}
      : {where:`w wierszach ${numbers}`, outside:'poza tymi wierszami'};
  }
  return subsetValues.length === 1
    ? {where:`w ${numbers}. kolumnie`, outside:'poza tą kolumną'}
    : {where:`w kolumnach ${numbers}`, outside:'poza tymi kolumnami'};
}

export function forcedUnitHint(state) {
  const forced = getUnits(state)
    .filter(unit => unit.cells.length === 1)
    .sort((a, b) => a.scope.length - b.scope.length)[0];

  if (!forced) return null;
  const index = forced.cells[0];
  if (!crownKeepsSolution(state, index)) return null;

  return {
    kind:'candidate',
    cells:[index],
    area:forced.scope,
    text:`W ${forced.label} została tylko jedna możliwość. Korona musi stanąć na wyróżnionym polu.`
  };
}

// Pigeonhole/subset deduction: if k available rows (or columns) can use only
// k regions, those regions must place their crowns inside that subset.
export function subsetElimination(state) {
  for (const mode of ['row', 'col']) {
    const occupied = new Set([...state.crowns].map(index => rc(index)[mode === 'row' ? 0 : 1]));
    const available = Array.from({length:N}, (_, index) => index).filter(index => !occupied.has(index));
    const maxSize = Math.min(4, available.length);

    for (let size = 1; size <= maxSize; size++) {
      for (const subsetValues of combinations(available, size)) {
        const subset = new Set(subsetValues);
        const regions = new Set();

        for (const index of allCells) {
          const [row, col] = rc(index);
          const axis = mode === 'row' ? row : col;
          if (subset.has(axis) && isCandidate(state, index)) regions.add(regionAt(index));
        }

        if (regions.size !== size) continue;

        const eliminate = allCells.filter(index => {
          if (!isCandidate(state, index) || !regions.has(regionAt(index))) return false;
          const [row, col] = rc(index);
          const axis = mode === 'row' ? row : col;
          return !subset.has(axis) && crownIsImpossible(state, index);
        });

        if (!eliminate.length) continue;

        const area = allCells.filter(index => {
          const [row, col] = rc(index);
          return subset.has(mode === 'row' ? row : col);
        });
        const cells = area.filter(index => isCandidate(state, index) && regions.has(regionAt(index)));
        const description = subsetDescription(mode, subsetValues);

        const text = size === 1
          ? `Wszystkie możliwe pola ${description.where} należą do jednego regionu. Korona tego regionu musi więc znaleźć się ${description.where}. Pozostałe pola tego regionu ${description.outside} możesz oznaczyć X.`
          : `Możliwe pola ${description.where} należą tylko do ${size} regionów. Korony tych regionów muszą więc znaleźć się ${description.where}. Pozostałe pola tych regionów ${description.outside} możesz oznaczyć X.`;

        return {
          kind:'eliminate',
          area,
          cells,
          eliminate,
          text
        };
      }
    }
  }
  return null;
}

// One-level contradiction: assume a crown here. If the solver finds no full
// solution, the cell is safe to cross out.
export function solverBackedElimination(state) {
  for (const index of allCells) {
    if (!isCandidate(state, index)) continue;
    if (crownIsImpossible(state, index)) {
      return {
        kind:'eliminate',
        cells:[],
        eliminate:[index],
        text:'Gdyby stanęła tu korona, plansza nie miałaby rozwiązania. To pole można oznaczyć X.'
      };
    }
  }
  return null;
}

// Dual contradiction: assume this cell is crossed out. If that removes every
// solution, the crown is forced here.
export function solverBackedForcedCrown(state) {
  for (const index of allCells) {
    if (!isCandidate(state, index)) continue;
    if (!crossoutKeepsSolution(state, index) && crownKeepsSolution(state, index)) {
      return {
        kind:'candidate',
        cells:[index],
        text:'Gdyby wykluczyć to pole, plansza nie miałaby rozwiązania. Korona musi stanąć tutaj.'
      };
    }
  }
  return null;
}

export function deductionHint(state) {
  const units = getUnits(state);
  const impossible = units.find(unit => unit.cells.length === 0);
  if (impossible) return {kind:'error', cells:[], area:impossible.scope, text:`W ${impossible.label} nie zostało żadne możliwe pole dla korony.`};

  return forcedUnitHint(state)
    || subsetElimination(state)
    || solverBackedElimination(state)
    || solverBackedForcedCrown(state);
}

export function getHint(state, history = []) {
  return findMistake(state, history) || deductionHint(state);
}
