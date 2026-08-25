import { generateDuetPuzzle } from './generator.js';

self.addEventListener('message', event => {
  try {
    const generated = generateDuetPuzzle(event.data?.seed);
    self.postMessage({ ok: true, generated });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || String(error) });
  }
});
