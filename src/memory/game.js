import {dateKey, makeDeck, isPair, formatTime, packForDate, packById, nextPackId} from './core.js';
import {ART} from './symbols.js';

const backIcon = '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M16 1v30M1 16h30M5 5l22 22M27 5 5 27"/><circle cx="16" cy="16" r="5" fill="#efe8ff" stroke="none"/></svg>';

const el = id => document.getElementById(id);
const today = dateKey();
let mode = new URL(location.href).searchParams.has('try') ? 'training' : 'daily';
const storageKey = () => 'puzli:memory:prototype:v1:' + (mode === 'daily' ? today : 'training');

function fresh(modeName, packId = packForDate(today).id) {
  return {
    version: 1, day: today, mode: modeName,
    seed: modeName === 'daily' ? 'daily:' + today : 'training:' + Date.now() + ':' + Math.random(),
    packId,
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
        const deck = makeDeck(value.seed, packById(value.packId).symbols);
        if ([...valid].every(i => {
          const matching = deck.findIndex((s, j) => j !== i && s === deck[i]);
          return valid.has(matching);
        })) return {...value, packId: value.packId || 'discoveries', matched: [...valid]};
      }
    }
  } catch { /* Storage is optional in the prototype. */ }
  return fresh(mode);
}
let session = load();
let deck = makeDeck(session.seed, packById(session.packId).symbols);
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
  el('packName').textContent = packById(session.packId).name;
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
  el('newButton').textContent = mode === 'daily' ? 'Zobacz następny zestaw (Trening)' : 'Następny zestaw i nowa plansza';
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
  session = fresh('training', nextPackId(session.packId));
  deck = makeDeck(session.seed, packById(session.packId).symbols);
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
