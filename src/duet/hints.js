import { getNextHumanStep } from './human-solver.js';

// Return only the logical deduction. The UI renders the actual circle/diamond
// instead of describing obsolete theme colors.
export function getDuetHint(puzzle,board) {
  return getNextHumanStep(puzzle,board);
}
