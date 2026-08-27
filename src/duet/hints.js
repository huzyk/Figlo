import { A, B } from './constants.js';
import { getNextHumanStep } from './human-solver.js';

export function getDuetHint(puzzle, board) {
  const hint = getNextHumanStep(puzzle, board);
  if (!hint) return null;
  const action = hint.value === A
    ? 'Wstaw tu symbol fioletowy.'
    : hint.value === B
      ? 'Wstaw tu symbol złoty.'
      : '';
  return action ? { ...hint, reason: `${hint.reason} ${action}` } : hint;
}
