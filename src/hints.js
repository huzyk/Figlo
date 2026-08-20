import { N, allCells, cellsInColumn, cellsInRegion, cellsInRow, rc } from './puzzle.js';
import { conflicts, isBlockedByCrowns, restore } from './game.js';
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

export function findMistake(state, history = []) {
  const direct = [...conflicts(state.crowns)];
  if (direct.length) return {kind:'error', cells:direct, text:'Te korony łamią jedną z zasad.'};
  if (hasSolution(state)) return null;

  for (let h = history.length - 1; h >= 0; h--) {
    const previous = restore(history[h]);
    if (!hasSolution(previous)) continue;

    const addedCrown = [...state.crowns].find(index => !previous.crowns.has(index));
    if (addedCrown != null) return {kind:'error', cells:[addedCrown], text:'Ta korona sprawia, że planszy nie da się już poprawnie rozwiązać.'};

    const addedX = [...state.manualXs].find(index => !previous.manualXs.has(index));
    if (addedX != null) return {kind:'error', cells:[addedX], text:'To X wyklucza pole potrzebne do rozwiązania.'};
  }

  return {kind:'error', cells:[], text:'W obecnym układzie jest sprzeczność. Cofnij ostatni ręczny ruch.'};
}

export function deductionHint(state) {
  const units = getUnits(state);
  const impossible = units.find(unit => unit.cells.length === 0);
  if (impossible) return {kind:'error', cells:[], area:impossible.scope, text:`W ${impossible.label} nie zostało żadne możliwe pole dla korony.`};

  const forced = units.filter(unit => unit.cells.length === 1).sort((a,b) => a.scope.length - b.scope.length)[0];
  if (forced) return {kind:'candidate', cells:forced.cells, text:`W ${forced.label} korona może stanąć już tylko na wyróżnionym polu.`};

  for (const unit of units.filter(unit => unit.type === 'region' && unit.cells.length >= 2 && unit.cells.length <= 4)) {
    const rows = new Set(unit.cells.map(index => rc(index)[0]));
    const cols = new Set(unit.cells.map(index => rc(index)[1]));

    if (rows.size === 1) {
      const row = [...rows][0];
      const eliminate = cellsInRow(row).filter(index => !unit.scope.includes(index) && isCandidate(state, index));
      if (eliminate.length) return {kind:'eliminate', cells:unit.cells, eliminate, text:'W tym regionie korona musi znaleźć się w tym rzędzie, więc pozostałe wyróżnione pola tego rzędu można wykluczyć.'};
    }

    if (cols.size === 1) {
      const col = [...cols][0];
      const eliminate = cellsInColumn(col).filter(index => !unit.scope.includes(index) && isCandidate(state, index));
      if (eliminate.length) return {kind:'eliminate', cells:unit.cells, eliminate, text:'W tym regionie korona musi znaleźć się w tej kolumnie, więc pozostałe wyróżnione pola tej kolumny można wykluczyć.'};
    }
  }

  const shortUnit = units.filter(unit => unit.cells.length >= 2 && unit.cells.length <= 4).sort((a,b) => a.cells.length - b.cells.length)[0];
  if (shortUnit) return {kind:'candidate', cells:shortUnit.cells, text:`W ${shortUnit.label} korona może znajdować się tylko na wyróżnionych polach.`};

  const candidates = allCells.filter(index => isCandidate(state, index));
  return candidates.length ? {kind:'candidate', cells:candidates.slice(0, 4), text:'Te pola są nadal logicznie możliwe. Spróbuj znaleźć jednostkę z najmniejszą liczbą kandydatów.'} : null;
}

export function getHint(state, history = []) {
  return findMistake(state, history) || deductionHint(state);
}
