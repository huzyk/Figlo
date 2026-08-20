import { regions } from './puzzle.js';
import { conflicts, createGameState, restore } from './game.js';
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

export function deductionHint(state) {
  const deduction = nextHumanDeduction(regions, {
    crowns: state.crowns,
    crossed: state.manualXs
  });

  if (!deduction) return null;

  if (deduction.action === 'error') {
    return {
      kind:'error',
      cells:deduction.cells || [],
      area:deduction.area || [],
      text:deduction.reason
    };
  }

  if (deduction.action === 'crown') {
    return {
      kind:'candidate',
      cells:deduction.cells,
      area:deduction.area || [],
      text:deduction.reason,
      rule:deduction.rule
    };
  }

  return {
    kind:'eliminate',
    cells:[],
    eliminate:deduction.cells,
    area:deduction.area || [],
    text:deduction.reason,
    rule:deduction.rule
  };
}

export function getHint(state, history = []) {
  return findMistake(state, history) || deductionHint(state);
}
