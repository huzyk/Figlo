import { generateBloki } from './generator.js';

self.addEventListener('message', event => {
  try {
    const puzzle = generateBloki(event.data || {});
    self.postMessage({ ok: true, puzzle });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || String(error) });
  }
});
