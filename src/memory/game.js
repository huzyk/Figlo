import {SYMBOLS, dateKey, makeDeck, isPair, formatTime} from './core.js';

// Distinct science / nature glyphs. Authored as vectors; no external icon fonts or requests.
const ART = {
  atom: {
    label: 'atom', color: '#8064d8',
    art: '<ellipse cx="32" cy="32" rx="26" ry="10"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)"/><circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none"/>'
  },
  dna: {
    label: 'DNA', color: '#389a9e',
    art: '<path d="M19 7 C51 17 51 25 19 32 S-13 48 45 57"/><path d="M45 7 C13 17 13 25 45 32 S77 48 19 57"/><path d="M23 13h18M31 20h2M17 32h30M31 44h2M23 51h18" stroke-width="2.5"/>'
  },
  brain: {
    label: 'mózg', color: '#d35b92',
    art: '<path d="M31 14C22 6 12 14 13 23C6 27 7 39 15 41C12 50 21 57 30 51L31 14Z"/><path d="M33 14C42 6 52 14 51 23C58 27 57 39 49 41C52 50 43 57 34 51L33 14Z"/><path d="M19 23c9 0 9 8 6 11M15 41c5-4 10-3 12 3M45 23c-9 0-9 8-6 11M49 41c-5-4-10-3-12 3"/><path d="M32 13v41" stroke-width="2"/>'
  },
  volcano: {
    label: 'wulkan', color: '#ce654d',
    art: '<path d="M6 54h52L42 28l-8 10-10-10L6 54Z" fill="currentColor" fill-opacity=".16"/><path d="M6 54h52L42 28l-8 10-10-10L6 54Z"/><path d="M23 27c7 5 15 5 20 0M32 22l-3-7m8 7 4-9m-10-5-1-4m-10 10-5-6"/><path d="M32 40v14" stroke-width="2"/>'
  },
  saturn: {
    label: 'Saturn', color: '#9c7e40',
    art: '<circle cx="32" cy="32" r="15" fill="currentColor" fill-opacity=".14"/><circle cx="32" cy="32" r="15"/><ellipse cx="32" cy="32" rx="29" ry="10" transform="rotate(-24 32 32)"/><path d="M20 26c7 3 15 3 23-1" stroke-width="2"/><path d="M24 40c6 2 13 2 18-1" stroke-width="2"/>'
  },
  crystal: {
    label: 'kryształ', color: '#527ab6',
    art: '<path d="M21 9h22l13 17-24 30L8 26 21 9Z" fill="currentColor" fill-opacity=".10"/><path d="M21 9h22l13 17-24 30L8 26 21 9Z"/><path d="M8 26h48M21 9l-5 17 16 30 16-30-5-17M16 26h32"/>'
  },
  snowflake: {
    label: 'płatek śniegu', color: '#3a98c9',
    art: '<path d="M32 5v54M5 32h54M13 13l38 38M51 13 13 51"/><path d="m25 12 7 7 7-7M25 52l7-7 7 7M12 25l7 7-7 7M52 25l-7 7 7 7M16 11v10h10M48 11v10H38M16 53V43h10M48 53V43H38" stroke-width="2.5"/>'
  },
  magnet: {
    label: 'magnes', color: '#d27752',
    art: '<path d="M16 9h12v27a4 4 0 0 0 8 0V9h12v27a16 16 0 0 1-32 0V9Z" fill="currentColor" fill-opacity=".10"/><path d="M16 9h12v27a4 4 0 0 0 8 0V9h12v27a16 16 0 0 1-32 0V9Z"/><path d="M16 19h12M36 19h12" stroke-width="4"/>'
  }
};
const backIcon = '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M16 1v30M1 16h30M5 5l22 22M27 5 5 27"/><circle cx="16" cy="16" r="5" fill="#efe8ff" stroke="none"/></svg>';

const el = id => document.getElementById(id);
const today = dateKey();
let mode = new URL(location.href).searchParams.has('try') ? 'training' : 'daily';
const storageKey = () => 'puzli:memory:prototype:v1:' + (mode === 'daily' ? today : 'training');

function fresh(modeName) {
  return {
    version: 1, day: today, mode: modeName,
    seed: modeName === 'daily' ? 'daily:' + today : 'training:' + Date.now() + ':' + Math.random(),
    stage: 'study', studyMs: 0, playMs: 0, reveals: 0, matched: []
  };
}
function load() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()));
    if (value && value.version === 1 && value.mode === mode &&
        (mode !== 'daily' || value.day === today) &&
        ['study','play','done'].includes(value.stage) &&
        Array.isArray(value.matched) && typeof value.seed === 'string' &&
        Number.isFinite(value.studyMs) && Number.isFinite(value.playMs) &&
        Number.isInteger(value.reveals)) {
      const valid = new Set(value.matched);
      if ([...valid].every(i => Number.isInteger(i) && i >= 0 && i < 16)) {
        const deck = makeDeck(value.seed);
        if ([...valid].every(i => {
          const matching = deck.findIndex((s, j) => j !== i && s === deck[i]);
          return valid.has(matching);
        })) return {...value, matched: [...valid]};
      }
    }
  } catch { /* Storage is optional in the prototype. */ }
  return fresh(mode);
}
let session = load();
let deck = makeDeck(session.seed);
let selected = [];
let blocked = false;
let running = false;
let startClock = performance.now();
const cardEls = [];

function persist() {
  try { localStorage.setItem(storageKey(), JSON.stringify(session)); }
  catch { /* Private browsing/storage denial must not prevent playing. */ }
}
function elapsed(stage) {
  const base = session[stage + 'Ms'] || 0;
  return base + (running && session.stage === stage ? Math.max(0, performance.now() - startClock) : 0);
}
function freeze() {
  if (!running) return;
  if (session.stage === 'study' || session.stage === 'play') session[session.stage + 'Ms'] = elapsed(session.stage);
  running = false;
  persist();
}
function startClockIfVisible() {
  if (!document.hidden && session.stage !== 'done') {
    startClock = performance.now();
    running = true;
  }
}
function iconSvg(symbol) {
  const {art} = ART[symbol];
  return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + art + '</svg>';
}
function createBoard() {
  const boardEl = el('board');
  boardEl.replaceChildren();
  cardEls.length = 0;
  deck.forEach((symbol, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'memory-card';
    card.style.setProperty('--symbol-color', ART[symbol].color);
    card.innerHTML = '<span class="card-rotator"><span class="card-face card-back">' + backIcon +
      '</span><span class="card-face card-front">' + iconSvg(symbol) + '</span></span>';
    card.addEventListener('click', () => reveal(index));
    boardEl.append(card);
    cardEls.push(card);
  });
}
function renderCards() {
  cardEls.forEach((card,index) => {
    const matched = session.matched.includes(index);
    const open = session.stage === 'study' || selected.includes(index) || matched;
    card.classList.toggle('is-faceup', open);
    card.classList.toggle('is-matched', matched);
    card.disabled = session.stage !== 'play' || blocked || matched || selected.includes(index);
    card.setAttribute('aria-label', open ?
      ('Karta ' + (index + 1) + ': ' + ART[deck[index]].label + (matched ? ', para odkryta' : '')) :
      ('Karta ' + (index + 1) + ': zakryta'));
  });
}
function tick() {
  el('studyTime').textContent = formatTime(elapsed('study'));
  el('playTime').textContent = formatTime(elapsed('play'));
}
function render() {
  el('pairsCount').textContent = session.matched.length / 2 + ' / 8';
  if (session.stage === 'study') {
    el('stageLabel').textContent = '01 / ZAPAMIĘTUJ';
    el('stageTitle').textContent = 'Masz to w pamięci?';
    el('stageText').textContent = 'Przyjrzyj się symbolom. Kiedy uznasz, że je pamiętasz, zakryj karty i znajdź wszystkie pary.';
    el('boardCaption').textContent = 'Nie śpiesz się. To Ty decydujesz, kiedy jesteś gotowy.';
    el('readyButton').hidden = false;
  } else {
    el('stageLabel').textContent = session.stage === 'done' ? '03 / ODKRYTE' : '02 / ODKRYWAJ';
    el('stageTitle').textContent = session.stage === 'done' ? 'Wszystkie pary!' : 'Zaufaj swojej pamięci';
    el('stageText').textContent = session.stage === 'done'
      ? 'Wszystkie symbole odnalazły swoją parę.'
      : 'Odkrywaj po dwie karty. Każda odsłonięta karta pomaga Ci rozpoznać układ.';
    el('boardCaption').textContent = session.stage === 'done'
      ? 'Zestaw ukończony.' : 'Znajdź osiem par. Liczy się Twoja pamięć.';
    el('readyButton').hidden = true;
  }
  el('newButton').textContent = mode === 'daily' ? 'Nowa plansza treningowa' : 'Wylosuj nową planszę';
  renderCards();
  tick();
  if (session.stage === 'done') showFinish();
  else el('finish').hidden = true;
}
function begin() {
  if (session.stage !== 'study') return;
  freeze();
  session.stage = 'play';
  persist();
  startClockIfVisible();
  selected = [];
  render();
}
function complete() {
  freeze();
  session.stage = 'done';
  persist();
  render();
}
function reveal(index) {
  if (session.stage !== 'play' || blocked || selected.includes(index) || session.matched.includes(index)) return;
  selected.push(index);
  session.reveals += 1;
  persist();
  if (selected.length < 2) { renderCards(); return; }
  blocked = true;
  const [first,second] = selected;
  if (isPair(deck, first, second)) {
    session.matched.push(first,second);
    persist();
    renderCards();
    el('pairsCount').textContent = session.matched.length / 2 + ' / 8';
    setTimeout(() => {
      selected = [];
      blocked = false;
      if (session.matched.length === 16) complete();
      else renderCards();
    }, 520);
  } else {
    renderCards();
    setTimeout(() => {
      selected = [];
      blocked = false;
      renderCards();
    }, 920);
  }
}
function showFinish() {
  el('finish').hidden = false;
  el('finishStudy').textContent = formatTime(session.studyMs);
  el('finishPlay').textContent = formatTime(session.playMs);
  el('finishReveals').textContent = String(session.reveals);
  const perfect = session.reveals === 16;
  el('finishTitle').textContent = perfect ? 'Fenomenalna pamięć!' : 'Wszystkie pary odkryte!';
  el('finishCopy').textContent = perfect
    ? 'Osiem par, szesnaście odkryć. Każda karta trafiła od razu na swoją parę.'
    : 'Świetnie! Zapamiętane symbole znalazły swoje pary. Zobacz, jak poszło Ci w tej rundzie.';
}
function training() {
  freeze();
  mode = 'training';
  const url = new URL(location.href);
  url.searchParams.set('try','1');
  history.replaceState(null,'',url);
  session = fresh('training');
  deck = makeDeck(session.seed);
  selected = [];
  blocked = false;
  persist();
  startClockIfVisible();
  createBoard();
  render();
  el('finish').hidden = true;
}
el('readyButton').addEventListener('click', begin);
el('newButton').addEventListener('click', training);
el('againButton').addEventListener('click', training);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) freeze();
  else startClockIfVisible();
});
window.addEventListener('pagehide', freeze);
createBoard();
startClockIfVisible();
render();
setInterval(tick, 200);
