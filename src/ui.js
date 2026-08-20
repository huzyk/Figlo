import { N, allCells, rc, regionAt } from './puzzle.js';
import { clearManualXs, conflicts, createGameState, cycleCell, isSolved, snapshot, visibleXs } from './game.js';
import { getHint } from './hints.js';

const $ = selector => document.querySelector(selector);
const board = $('#board');
const timer = $('#timer');
const undoBtn = $('#undo');
const hintBtn = $('#hint');
const hintCard = $('#hintCard');
const hintText = $('#hintText');
const autoXInput = $('#autoX');
const done = $('#done');
const finalTime = $('#finalTime');

let state = createGameState();
let history = [];
let started = false;
let start = 0;
let tick = null;
let finished = false;
let autoXEnabled = localStorage.getItem('figlo-auto-x') === '1';
autoXInput.checked = autoXEnabled;

function fmt(ms) {
  const seconds = Math.floor(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function startTimer() {
  if (started || finished) return;
  started = true;
  start = Date.now();
  tick = setInterval(() => { timer.textContent = fmt(Date.now() - start); }, 250);
}

function stopTimer() {
  if (tick) clearInterval(tick);
  tick = null;
}

function clearHint() {
  [...board.children].forEach(cell => cell.classList.remove('hint-candidate','hint-error','hint-eliminate','hint-area'));
  hintCard.classList.remove('show');
}

function regionBorders(index, element) {
  const [row, col] = rc(index);
  const region = regionAt(index);
  if (row === 0 || regionAt(index - N) !== region) element.classList.add('rt');
  if (col === N - 1 || regionAt(index + 1) !== region) element.classList.add('rr');
  if (row === N - 1 || regionAt(index + N) !== region) element.classList.add('rb');
  if (col === 0 || regionAt(index - 1) !== region) element.classList.add('rl');
}

function render() {
  const xs = visibleXs(state, autoXEnabled);
  const bad = conflicts(state.crowns);
  board.innerHTML = '';

  for (const index of allCells) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `cell r${regionAt(index)}`;
    regionBorders(index, cell);
    if (bad.has(index)) cell.classList.add('bad');

    if (state.crowns.has(index)) cell.innerHTML = '<span class="mark crown">♛</span>';
    else if (xs.has(index)) cell.innerHTML = '<span class="mark">×</span>';

    cell.addEventListener('click', () => makeMove(index));
    board.appendChild(cell);
  }

  undoBtn.disabled = history.length === 0 || finished;
  hintBtn.disabled = finished;
  done.classList.toggle('show', finished);
}

function makeMove(index) {
  if (finished) return;
  startTimer();
  clearHint();
  history.push(snapshot(state));
  state = cycleCell(state, index, {autoXEnabled});
  if (isSolved(state)) {
    finished = true;
    stopTimer();
    finalTime.textContent = `Czas: ${timer.textContent}`;
  }
  render();
}

function showHint() {
  if (finished) return;
  clearHint();
  const hint = getHint(state, history);
  if (!hint) {
    hintText.textContent = 'Nie znalazłem teraz prostej dedukcji. Spróbuj oznaczyć kolejne pewne wykluczenia.';
    hintCard.classList.add('show');
    return;
  }

  for (const index of hint.area || []) board.children[index]?.classList.add('hint-area');
  for (const index of hint.cells || []) board.children[index]?.classList.add(hint.kind === 'error' ? 'hint-error' : 'hint-candidate');
  for (const index of hint.eliminate || []) board.children[index]?.classList.add('hint-eliminate');
  hintText.textContent = hint.text;
  hintCard.classList.add('show');
}

undoBtn.addEventListener('click', () => {
  if (!history.length || finished) return;
  clearHint();
  const previous = history.pop();
  state = createGameState(previous.crowns, previous.manualXs);
  render();
});

$('#reset').addEventListener('click', () => {
  state = createGameState();
  history = [];
  finished = false;
  started = false;
  stopTimer();
  timer.textContent = '00:00';
  finalTime.textContent = '';
  clearHint();
  render();
});

$('#clearMarks').addEventListener('click', () => {
  if (finished || state.manualXs.size === 0) return;
  startTimer();
  clearHint();
  history.push(snapshot(state));
  state = clearManualXs(state);
  render();
});

hintBtn.addEventListener('click', showHint);
$('#hintClose').addEventListener('click', clearHint);

autoXInput.addEventListener('change', () => {
  autoXEnabled = autoXInput.checked;
  localStorage.setItem('figlo-auto-x', autoXEnabled ? '1' : '0');
  clearHint();
  render();
});

render();
