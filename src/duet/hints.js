import { getNextHumanStep } from './human-solver.js';

export function getDuetHint(puzzle, board) {
  return getNextHumanStep(puzzle, board);
}
