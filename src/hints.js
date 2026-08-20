import { N, allCells, rc, regionAt, regions } from './puzzle.js';
import { conflicts, createGameState, isBlockedByCrowns, restore } from './game.js';
import { hasSolution } from './solver.js';
import { nextHumanDeduction } from './human-solver.js';

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
  if (direct.length) {
    return {kind:'error', cells:direct, text:'Te korony łamią jedną z zasad.'};
  }

  if (hasSolution(state)) return null;

  const mistakes = activeMistakes(state, history);
  if (!mistakes.length) {
    return {
      kind:'error',
      cells:[],
      text:'Kilka aktualnych oznaczeń razem blokuje rozwiązanie. Cofnij ostatni ruch.'
    };
  }

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

function currentRegionCandidates(state, region) {
  return allCells.filter(index => {
    if (regionAt(index) !== region) return false;
    if (state.crowns.has(index) || state.manualXs.has(index)) return false;
    return !isBlockedByCrowns(index, state.crowns);
  });
}

function axisInfo(area = []) {
  if (!area.length) return null;
  const areaSet = new Set(area);
  const rows = [...new Set(area.map(index => rc(index)[0]))].sort((a,b) => a-b);
  const cols = [...new Set(area.map(index => rc(index)[1]))].sort((a,b) => a-b);

  const fullRows = rows.length * N === area.length && rows.every(row =>
    Array.from({length:N}, (_, col) => row * N + col).every(index => areaSet.has(index))
  );
  if (fullRows) return {axis:'row', values:rows};

  const fullCols = cols.length * N === area.length && cols.every(col =>
    Array.from({length:N}, (_, row) => row * N + col).every(index => areaSet.has(index))
  );
  if (fullCols) return {axis:'col', values:cols};

  return null;
}

function formatNumbers(values) {
  const numbers = values.map(value => String(value + 1));
  if (numbers.length === 1) return numbers[0];
  if (numbers.length === 2) return `${numbers[0]} i ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(', ')} i ${numbers[numbers.length - 1]}`;
}

function presentDeduction(deduction, state) {
  const result = {...deduction, focus:deduction.focus || []};
  const info = axisInfo(deduction.area);

  if (deduction.rule === 'forced-crown') {
    result.focus = deduction.cells;
    result.reason = deduction.reason.replace('Tutaj musi stanąć korona.', 'Korona musi stanąć na wyróżnionym polu.');
    return result;
  }

  if (deduction.rule === 'region-subset' && info) {
    const axisSet = new Set(info.values);
    const confinedRegions = [];

    for (let region = 0; region < N; region++) {
      if (allCells.some(index => regionAt(index) === region && state.crowns.has(index))) continue;
      const candidates = currentRegionCandidates(state, region);
      if (!candidates.length) continue;
      const confined = candidates.every(index => {
        const [row, col] = rc(index);
        return axisSet.has(info.axis === 'row' ? row : col);
      });
      if (confined) confinedRegions.push({region, candidates});
    }

    const needed = info.values.length;
    const sources = confinedRegions.slice(0, needed);
    result.focus = sources.flatMap(source => source.candidates);
    const numbers = formatNumbers(info.values);

    if (needed === 1) {
      const axisName = info.axis === 'row' ? 'wierszu' : 'kolumnie';
      const outside = info.axis === 'row' ? 'tego wiersza' : 'tej kolumny';
      result.reason = `Wyróżniony region ma możliwe pola tylko w ${numbers}. ${axisName}. Jego korona musi więc znaleźć się w tym ${axisName}. Pozostałe wyróżnione pola ${outside} możesz oznaczyć X.`;
    } else {
      const axisName = info.axis === 'row' ? 'wierszach' : 'kolumnach';
      result.reason = `Wyróżnione ${needed} regiony mają możliwe pola tylko w ${axisName} ${numbers}. Ich korony muszą pozostać w tych ${axisName}. Pozostałe wyróżnione pola możesz oznaczyć X.`;
    }
    return result;
  }

  if (deduction.rule === 'axis-subset' && info) {
    const targetRegions = new Set((deduction.cells || []).map(index => regionAt(index)));
    result.focus = (deduction.area || []).filter(index => {
      if (state.crowns.has(index) || state.manualXs.has(index)) return false;
      if (isBlockedByCrowns(index, state.crowns)) return false;
      return targetRegions.has(regionAt(index));
    });
    return result;
  }

  if (deduction.rule === 'hypothetical-crossout') {
    result.focus = deduction.cells;
    return result;
  }

  return result;
}

export function deductionHint(state) {
  const raw = nextHumanDeduction(regions, {
    crowns: state.crowns,
    crossed: state.manualXs
  });

  if (!raw) return null;
  const deduction = presentDeduction(raw, state);

  if (deduction.action === 'error') {
    return {
      kind:'error',
      cells:deduction.cells || [],
      area:deduction.area || [],
      focus:deduction.focus || [],
      text:deduction.reason
    };
  }

  if (deduction.action === 'crown') {
    return {
      kind:'candidate',
      cells:deduction.cells,
      area:deduction.area || [],
      focus:deduction.focus || deduction.cells,
      text:deduction.reason,
      rule:deduction.rule
    };
  }

  return {
    kind:'eliminate',
    cells:[],
    eliminate:deduction.cells,
    area:deduction.area || [],
    focus:deduction.focus || [],
    text:deduction.reason,
    rule:deduction.rule
  };
}

export function getHint(state, history = []) {
  return findMistake(state, history) || deductionHint(state);
}
