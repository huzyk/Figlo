import { N, rc, regionAt } from './puzzle.js';
import { conflicts } from './game.js';

function normalized(state) {
  return {
    crowns: state?.crowns instanceof Set ? state.crowns : new Set(state?.crowns || []),
    manualXs: state?.manualXs instanceof Set ? state.manualXs : new Set(state?.manualXs || [])
  };
}

export function countSolutions(inputState = {crowns: new Set(), manualXs: new Set()}, limit = Infinity) {
  const state = normalized(inputState);
  if (conflicts(state.crowns).size) return 0;

  const fixed = new Map();
  for (const index of state.crowns) {
    const [row, col] = rc(index);
    if (fixed.has(row)) return 0;
    fixed.set(row, col);
  }

  let count = 0;
  function dfs(row, previousCol, cols, regs) {
    if (count >= limit) return;
    if (row === N) {
      count += 1;
      return;
    }

    const candidates = fixed.has(row) ? [fixed.get(row)] : Array.from({length: N}, (_, col) => col);
    for (const col of candidates) {
      const index = row * N + col;
      const region = regionAt(index);
      if (state.manualXs.has(index) || cols.has(col) || regs.has(region)) continue;
      if (row > 0 && Math.abs(col - previousCol) <= 1) continue;

      cols.add(col);
      regs.add(region);
      dfs(row + 1, col, cols, regs);
      regs.delete(region);
      cols.delete(col);
      if (count >= limit) return;
    }
  }

  dfs(0, -99, new Set(), new Set());
  return count;
}

export function hasSolution(state) {
  return countSolutions(state, 1) > 0;
}
