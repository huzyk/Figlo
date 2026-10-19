// Standalone PUZLI Memory prototype. Does not participate in Daily or PUZLI IQ.
export const SYMBOLS = Object.freeze(['atom','dna','brain','volcano','saturn','crystal','snowflake','magnet']);

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function makeDeck(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cards = [...SYMBOLS, ...SYMBOLS];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function isPair(deck, a, b) {
  return Number.isInteger(a) && Number.isInteger(b) &&
    a !== b && a >= 0 && b >= 0 && a < deck.length && b < deck.length &&
    deck[a] === deck[b];
}

export function formatTime(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
