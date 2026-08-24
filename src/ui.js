import { N, allCells, rc, regionAt, setRegions } from './puzzle.js';
import { clearManualXs, conflicts, createGameState, cycleCell, isSolved, snapshot, visibleXs } from './game.js';
import { getHint } from './hints.js';
import { generatePuzzle } from './generator.js';
import { dailyPuzzleSeed, localDateKey } from './daily.js';
import { completeDailyGame, loadFigloState, updateFigloSettings } from './storage.js';

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
const nextPuzzleBtn = $('#nextPuzzle');
const roundLabel = $('#roundLabel');
const feedback = $('#feedback');
const mobileAutoX = $('#mobileAutoX');

const today = localDateKey();
let productState = loadFigloState(today);
let state = createGameState();
let history = [];
let started = false;
let start = 0;
let tick = null;
let finished = false;
let gameMode = 'daily';
let practiceNumber = 0;
let autoXEnabled = Boolean(productState.settings.autoX);

autoXInput.checked = autoXEnabled;
mobileAutoX.setAttribute('aria-pressed', String(autoXEnabled));

const crownMarkup = '<span class="mark crown" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 24h24l-2 5H6l-2-5Zm1-15 7 6 4-10 4 10 7-6-2 12H7L5 9Z"/></svg></span>';

function fmt(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function startTimer() {
  if (started || finished) return;
  started = true;
  start = Date.now();
  tick = setInterval(() => {
    timer.textContent = fmt(Date.now() - start);
  }, 250);
}

function stopTimer() {
  if (tick) clearInterval(tick);
  tick = null;
}

function clearHint() {
  [...board.children].forEach(cell => cell.classList.remove('hint-candidate', 'hint-error', 'hint-eliminate', 'hint-area', 'hint-focus'));
  hintCard.classList.remove('show');
}

function regionBorders(index, element) {
  const [row, column] = rc(index);
  const region = regionAt(index);
  if (row === 0 || regionAt(index - N) !== region) element.classList.add('rt');
  if (column === N - 1 || regionAt(index + 1) !== region) element.classList.add('rr');
  if (row === N - 1 || regionAt(index + N) !== region) element.classList.add('rb');
  if (column === 0 || regionAt(index - 1) !== region) element.classList.add('rl');
}

function cellStateLabel(index, xs) {
  if (state.crowns.has(index)) return 'korona';
  if (xs.has(index)) return 'X';
  return 'puste';
}

function refreshStats() {
  const game = productState.games.korony;
  $('#crownsBest').textContent = game.bestTimeMs ? fmt(game.bestTimeMs) : '—';
  $('#modalBest').textContent = game.bestTimeMs ? fmt(game.bestTimeMs) : '—';
  $('#crownsCount').textContent = String(game.completedCount || 0);
  $('#crownsStreak').textContent = productState.user.streak ? String(productState.user.streak) : '—';
}

function updateControls() {
  undoBtn.disabled = !history.length || finished;
  $('#mobileUndo').disabled = !history.length || finished;
  hintBtn.disabled = finished;
  $('#mobileHint').disabled = finished;
  mobileAutoX.setAttribute('aria-pressed', String(autoXEnabled));
  mobileAutoX.classList.toggle('is-active', autoXEnabled);
}

function updateFeedback(bad) {
  feedback.className = 'feedback';
  if (finished) {
    feedback.textContent = gameMode === 'daily'
      ? 'Dzisiejsze Korony ukończone. Świetna robota.'
      : 'Plansza treningowa ukończona. Świetna robota.';
    feedback.classList.add('success');
    return;
  }
  if (bad.size) {
    feedback.textContent = 'Te korony łamią jedną z zasad.';
    feedback.classList.add('error');
    return;
  }
  const remaining = N - state.crowns.size;
  feedback.textContent = remaining === N
    ? 'Powodzenia. Znajdź miejsce dla każdej korony.'
    : remaining === 1
      ? 'Dobrze idzie. Została 1 korona.'
      : `Dobrze idzie. Zostały ${remaining} korony.`;
}

function render() {
  const xs = visibleXs(state, autoXEnabled);
  const bad = conflicts(state.crowns);
  board.innerHTML = '';

  for (const index of allCells) {
    const cell = document.createElement('button');
    const [row, column] = rc(index);
    cell.type = 'button';
    cell.className = `cell r${regionAt(index)}`;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Wiersz ${row + 1}, kolumna ${column + 1}, ${cellStateLabel(index, xs)}`);
    cell.dataset.index = String(index);
    regionBorders(index, cell);
    if (bad.has(index)) cell.classList.add('bad');
    if (state.crowns.has(index)) cell.innerHTML = crownMarkup;
    else if (xs.has(index)) cell.innerHTML = '<span class="mark x-mark" aria-hidden="true">×</span>';
    cell.addEventListener('click', () => makeMove(index));
    cell.addEventListener('keydown', handleCellKeys);
    board.appendChild(cell);
  }

  $('#crownCounter').textContent = `${state.crowns.size}/${N}`;
  updateControls();
  updateFeedback(bad);
  done.classList.toggle('show', finished);
}

function handleCellKeys(event) {
  const index = Number(event.currentTarget.dataset.index);
  const [row, column] = rc(index);
  let next = null;
  if (event.key === 'ArrowUp' && row > 0) next = index - N;
  if (event.key === 'ArrowDown' && row < N - 1) next = index + N;
  if (event.key === 'ArrowLeft' && column > 0) next = index - 1;
  if (event.key === 'ArrowRight' && column < N - 1) next = index + 1;
  if (next !== null) {
    event.preventDefault();
    board.children[next]?.focus();
  }
}

function finishGame(ms) {
  finished = true;
  timer.textContent = fmt(ms);
  stopTimer();
  finalTime.textContent = `Czas ${timer.textContent}`;

  if (gameMode === 'daily') {
    const previousBest = productState.games.korony.bestTimeMs;
    const result = completeDailyGame('korony', { timeMs: ms, today });
    productState = result.state;
    const currentBest = productState.games.korony.bestTimeMs;
    const isNewRecord = Number.isFinite(currentBest) && currentBest === ms && (!previousBest || ms < previousBest);
    $('#recordBadge').hidden = !isNewRecord;
  } else {
    $('#recordBadge').hidden = true;
  }

  refreshStats();
}

function makeMove(index) {
  if (finished) return;
  startTimer();
  clearHint();
  history.push(snapshot(state));
  state = cycleCell(state, index, { autoXEnabled });
  if (isSolved(state)) finishGame(Date.now() - start);
  render();
}

function showHint() {
  if (finished) return;
  clearHint();
  const hint = getHint(state, history);
  if (!hint) {
    hintText.textContent = 'Nie znalazłem teraz prostej, uczciwej dedukcji.';
    hintCard.classList.add('show');
    return;
  }
  for (const index of hint.area || []) board.children[index]?.classList.add('hint-area');
  for (const index of hint.focus || []) board.children[index]?.classList.add('hint-focus');
  for (const index of hint.cells || []) board.children[index]?.classList.add(hint.kind === 'error' ? 'hint-error' : 'hint-candidate');
  for (const index of hint.eliminate || []) board.children[index]?.classList.add('hint-eliminate');
  hintText.innerHTML = '<div class="hint-section"><span class="hint-label">Dlaczego</span><p class="hint-copy"></p></div><div class="hint-section"><span class="hint-label">Co zrobić</span><p class="hint-copy"></p></div>';
  const copies = hintText.querySelectorAll('.hint-copy');
  copies[0].textContent = hint.reason || hint.text;
  copies[1].textContent = hint.action || hint.text;
  hintCard.classList.add('show');
}

function resetRound() {
  state = createGameState();
  history = [];
  finished = false;
  started = false;
  stopTimer();
  timer.textContent = '00:00';
  finalTime.textContent = '';
  $('#recordBadge').hidden = true;
  clearHint();
  render();
}

function practiceSeed() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function undo() {
  if (!history.length || finished) return;
  clearHint();
  const previous = history.pop();
  state = createGameState(previous.crowns, previous.manualXs);
  render();
}

function setAutoX(value) {
  autoXEnabled = value;
  autoXInput.checked = value;
  productState = updateFigloSettings({ autoX: value });
  clearHint();
  render();
}

function toggleRules(forceOpen = null) {
  const rules = $('#rules');
  rules.open = forceOpen === null ? !rules.open : forceOpen;
  if (rules.open) rules.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadDailyPuzzle() {
  const puzzle = generatePuzzle(dailyPuzzleSeed('korony', today));
  setRegions(puzzle.regions);
  gameMode = 'daily';
  roundLabel.textContent = 'Dzisiaj';
  resetRound();
}

function loadPracticePuzzle() {
  const puzzle = generatePuzzle(practiceSeed());
  setRegions(puzzle.regions);
  gameMode = 'practice';
  practiceNumber += 1;
  roundLabel.textContent = `Trening #${practiceNumber}`;
  resetRound();
}

undoBtn.addEventListener('click', undo);
$('#mobileUndo').addEventListener('click', undo);
$('#reset').addEventListener('click', resetRound);
$('#mobileReset').addEventListener('click', resetRound);
$('#clearMarks').addEventListener('click', () => {
  if (finished || !state.manualXs.size) return;
  startTimer();
  clearHint();
  history.push(snapshot(state));
  state = clearManualXs(state);
  render();
});
hintBtn.addEventListener('click', showHint);
$('#mobileHint').addEventListener('click', showHint);
$('#hintClose').addEventListener('click', clearHint);
$('#rulesBtn').addEventListener('click', () => toggleRules());
$('#helpTop').addEventListener('click', () => toggleRules(true));
autoXInput.addEventListener('change', () => setAutoX(autoXInput.checked));
mobileAutoX.addEventListener('click', () => setAutoX(!autoXEnabled));
nextPuzzleBtn.addEventListener('click', async () => {
  nextPuzzleBtn.disabled = true;
  nextPuzzleBtn.textContent = 'Generuję…';
  await new Promise(resolve => requestAnimationFrame(resolve));
  try {
    loadPracticePuzzle();
    nextPuzzleBtn.textContent = 'Następna plansza →';
  } catch (error) {
    console.error(error);
    nextPuzzleBtn.textContent = 'Spróbuj ponownie';
  }
  nextPuzzleBtn.disabled = false;
});

refreshStats();
loadDailyPuzzle();
