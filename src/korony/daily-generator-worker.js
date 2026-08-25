import { generatePuzzle } from '../generator.js';

self.addEventListener('message', event => {
  try {
    const { seed, difficulty } = event.data || {};
    const puzzle = generatePuzzle(seed, { difficulty });
    self.postMessage({ ok:true, puzzle });
  } catch (error) {
    self.postMessage({ ok:false, error:error?.message || String(error) });
  }
});
