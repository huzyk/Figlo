// Standalone PUZLI Memory prototype. Does not participate in Daily or PUZLI IQ.
// Rotate every 3 calendar days in Europe/Warsaw, not every 72 hours.
// A pack is shared by everybody on a given date; training may preview the next pack.
export const PACKS = Object.freeze([
  Object.freeze({id:'discoveries', name:'Odkrycia', symbols:Object.freeze(['atom','dna','brain','volcano','saturn','crystal','snowflake','magnet'])}),
  Object.freeze({id:'cosmos', name:'Ziemia i kosmos', symbols:Object.freeze(['earth','moon','rocket','comet','galaxy','sun','star','telescope'])}),
  Object.freeze({id:'mind', name:'Umysł i logika', symbols:Object.freeze(['eye','maze','puzzle','target','hourglass','key','bulb','knight'])}),
  Object.freeze({id:'nature', name:'Natura jako wzór', symbols:Object.freeze(['leaf','shell','honeycomb','lightning','mountain','tree','droplet','flower'])})
]);
export const SYMBOLS = PACKS[0].symbols; // backwards-compatible initial test board
const DAY_MS = 86400000;
const ANCHOR_DAY = Date.UTC(2026, 9, 19);

export function packById(id) {
  return PACKS.find(pack => pack.id === id) || PACKS[0];
}

export function packForDate(day) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(day)) throw new TypeError('Expected YYYY-MM-DD');
  const [year,month,date] = day.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, date);
  if (new Date(utc).toISOString().slice(0,10) !== day) throw new RangeError('Invalid calendar date');
  const days = Math.floor((utc - ANCHOR_DAY) / DAY_MS);
  return PACKS[((Math.floor(days / 3) % PACKS.length) + PACKS.length) % PACKS.length];
}

export function nextPackId(id) {
  const index = PACKS.findIndex(pack => pack.id === id);
  return PACKS[(index + 1) % PACKS.length].id;
}

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function makeDeck(seed, symbols = SYMBOLS) {
  if (!Array.isArray(symbols) || symbols.length !== 8 || new Set(symbols).size !== 8) {
    throw new RangeError('Memory requires eight unique symbols');
  }
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
  const cards = [...symbols, ...symbols];
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
