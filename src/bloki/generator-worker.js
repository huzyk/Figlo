import { generateBloki } from './generator.js';
import { solve } from './solver.js';

self.addEventListener('message', event => {
  try {
    const puzzle = generateBloki(event.data || {});
    const solution = solve(puzzle, { limit: 1 })[0] || null;
    if (!solution) throw new Error('Bloki puzzle has no solution');
    self.postMessage({ ok: true, puzzle, solution });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || String(error) });
  }
});
