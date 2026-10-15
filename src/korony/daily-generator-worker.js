import { generatePuzzle } from '../generator.js';

self.addEventListener('message', event => {
  try {
    const { seed, difficulty, difficultySamples = 3 } = event.data || {};
    const puzzle = generatePuzzle(seed, { difficulty, difficultySamples });
    self.postMessage({ ok:true, puzzle });
  } catch (error) {
    self.postMessage({ ok:false, error:error?.message || String(error) });
  }
});
