import { currentDateKey } from '../daily.js';
import { getDailyGame } from '../services/daily-service.js';
import { completeGame } from '../services/progress-service.js';
import { loadFigloState } from '../storage.js';
import { track } from '../services/analytics-service.js';
import { requestedGameMode, setGameMode } from '../ui/game-mode.js';
import { SIZE, CELL_COUNT, BOX_ROWS, BOX_COLS, buildSudokuPuzzle, candidates, hasConflict, isSudokuSolved } from './engine.js';
import { createSudokuSession, loadSudokuSession, saveSudokuSession, clearSudokuSession } from './session.js';
import { findSudokuHint, newlyCompletedSudokuUnits, boardHasSudokuConflict } from './hints.js';

const $ = selector => document.querySelector(selector);
const today = currentDateKey(), requestedMode = requestedGameMode();
let record = null, session = null, mode = 'daily', selected = null;
let notesMode = false, hinted = null, tick = null, trainingCount = 0;
let unitFlashTimer = null, winTimer = null;
const flashingCells = new Set();
const board = $('#board'), cells = [];
const fmt = value => {
  const seconds = Math.floor(Math.max(0, value) / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
    String(seconds % 60).padStart(2, '0');
};
const elapsed = () => session ? session.elapsedMs +
  (session.runningSince ? Math.max(0, Date.now() - session.runningSince) : 0) : 0;
const persist = () => { if (mode === 'daily' && session) saveSudokuSession(session); };
function renderTimer() { $('#timer').textContent = fmt(elapsed()); }
function startTimer() {
  if (!session || session.finished || session.runningSince) return;
  session.runningSince = Date.now();
  if (!session.startedAt) {
    session.startedAt = new Date().toISOString();
    track('game_started', {gameId:'sudoku',puzzleId:record.puzzleId,date:today,mode});
  }
  if (!tick) tick = setInterval(renderTimer,250);
}
function pauseTimer() {
  if (!session) return;
  if (session.runningSince) {
    session.elapsedMs += Math.max(0,Date.now() - session.runningSince);
    session.runningSince = null;
  }
  if (tick) clearInterval(tick);
  tick = null;
  renderTimer();
  persist();
}
function resetFocus() {
  const first = session.values.findIndex((value,index) => !record.puzzle[index] && !value);
  selected = first < 0 ? session.values.findIndex((value,index) => !record.puzzle[index]) : first;
  if (selected < 0) selected = 0;
}
function isPeer(a,b) {
  const ar=Math.floor(a/SIZE),ac=a%SIZE,br=Math.floor(b/SIZE),bc=b%SIZE;
  return ar===br||ac===bc||(Math.floor(ar/BOX_ROWS)===Math.floor(br/BOX_ROWS)&&Math.floor(ac/BOX_COLS)===Math.floor(bc/BOX_COLS));
}
function buildBoard() {
  board.replaceChildren();
  cells.length = 0;
  for(let i=0;i<CELL_COUNT;i++){
    const el=document.createElement('button');
    el.type='button';
    el.className='sudoku-cell';
    el.dataset.index=String(i);
    el.setAttribute('role','gridcell');
    el.setAttribute('aria-rowindex',String(Math.floor(i/SIZE)+1));
    el.setAttribute('aria-colindex',String(i%SIZE+1));
    el.addEventListener('click',()=>{
      if(hinted !== null && hinted !== i){
        hinted=null;
        announce('Wybierz cyfrę 1–6 lub skorzystaj z podpowiedzi.');
      }
      selected=i;render();
    });
    cells.push(el);
    board.appendChild(el);
  }
}
function render() {
  if (!session || !record) return;
  const focusedDigit = selected != null ? session.values[selected] : 0;
  let filled=0;
  const totalDigits = Array(SIZE+1).fill(0);
  session.values.forEach(value => {if(value){filled++;totalDigits[value]++;}});
  for(let i=0;i<CELL_COUNT;i++){
    const cell=cells[i],value=session.values[i],notes=session.notes[i];
    const cls=['sudoku-cell'];
    if (i%SIZE===BOX_COLS-1) cls.push('box-right');
    if (Math.floor(i/SIZE)%BOX_ROWS===BOX_ROWS-1 && Math.floor(i/SIZE)<SIZE-1) cls.push('box-bottom');
    if (record.puzzle[i]) cls.push('given');
    if (selected!=null && selected!==i && isPeer(selected,i)) cls.push('peer');
    if (focusedDigit && value===focusedDigit && selected!==i) cls.push('same-digit');
    if (selected===i) cls.push('selected');
    if (value && hasConflict(session.values,i)) cls.push('conflict');
    if (hinted!==null) {
      if (hinted===i) cls.push('hinted');
      else cls.push(isPeer(hinted,i)?'hint-context':'hint-muted');
    }
    if (flashingCells.has(i)) cls.push('unit-complete');
    cell.className=cls.join(' ');
    cell.replaceChildren();
    if(value) cell.textContent=String(value);
    else if(notes) {
      const grid=document.createElement('span');grid.className='sudoku-notes';
      for(let n=1;n<=SIZE;n++){
        const marker=document.createElement('span');
        marker.textContent=notes&(1<<n)?String(n):'';
        grid.appendChild(marker);
      }
      cell.appendChild(grid);
    }
    cell.setAttribute('aria-label','Wiersz '+(Math.floor(i/SIZE)+1)+', kolumna '+(i%SIZE+1)+
      (value?', '+value:' puste')+(record.puzzle[i]?', podana cyfra':''));
    cell.setAttribute('aria-selected',String(selected===i));
    cell.disabled = session.finished;
  }
  $('#filledCounter').textContent=filled+'/'+CELL_COUNT;
  $('#undo').disabled=session.finished || !session.history.length;
  $('#erase').disabled=session.finished || selected===null || !!record.puzzle[selected];
  $('#notes').setAttribute('aria-pressed',String(notesMode));
  for (const button of $('#keypad').querySelectorAll('[data-digit]')) {
    button.classList.toggle('complete-digit',totalDigits[Number(button.dataset.digit)]>=SIZE);
    button.disabled=session.finished;
  }
}
function announce(message,error=false) {
  const el=$('#feedback'); el.textContent=message;
  el.className='sudoku-feedback'+(error?' error':'');
}
function remember() {
  session.history.push({values:[...session.values],notes:[...session.notes]});
  if(session.history.length>80)session.history.shift();
}
function clearUnitFlash() {
  if(unitFlashTimer)clearTimeout(unitFlashTimer);
  unitFlashTimer=null;
  flashingCells.clear();
  for(const cell of cells)cell.classList.remove('unit-complete');
}
function clearPendingWin(){
  if(winTimer)clearTimeout(winTimer);
  winTimer=null;
}
function celebrateUnits(before){
  const completed=newlyCompletedSudokuUnits(before,session.values);
  if(!completed.length)return false;
  for(const unit of completed)for(const index of unit.indices)flashingCells.add(index);
  for(const index of flashingCells)cells[index]?.classList.add('unit-complete');
  unitFlashTimer=setTimeout(()=>{
    unitFlashTimer=null;
    flashingCells.clear();
    for(const cell of cells)cell.classList.remove('unit-complete');
  },1150);
  return true;
}
function settlePendingWin(){
  if(!winTimer)return;
  clearPendingWin();
  if(session&&!session.finished&&isSudokuSolved(session.values))finish();
}
function finish() {
  if(session.finished)return;
  session.finished=true;
  pauseTimer();
  const ms=session.elapsedMs;
  let best=loadFigloState(today).games.sudoku?.bestTimeMs||null;
  if(mode==='daily'){
    const result=completeGame({
      gameId:'sudoku',puzzleId:record.puzzleId,date:today,elapsedMs:ms,
      mode:'daily',startedAt:session.startedAt
    });
    best=result.state.games.sudoku.bestTimeMs||ms;
    if(result.firstGameCompletionToday){
      track('game_completed',{...result.event,gameId:'sudoku',mode:'daily',date:today,elapsedMs:ms,hintsUsed:session.hintsUsed});
    }
    if(result.firstDayCompletionToday)track('daily_completed',{date:today});
  }else{
    track('game_completed',{gameId:'sudoku',puzzleId:record.puzzleId,date:today,
      mode:'training',elapsedMs:ms,hintsUsed:session.hintsUsed});
  }
  $('#finalTime').textContent=fmt(ms);
  $('#bestTime').textContent=best?fmt(best):'—';
  $('#done').hidden=false;
  render();
  $('#replay').focus();
}
function inputDigit(value) {
  if(!session || session.finished || selected==null || record.puzzle[selected])return;
  if(notesMode && value !== 0 && session.values[selected])return;
  if(!notesMode && session.values[selected]===value && session.notes[selected]===0)return;
  const before=[...session.values];
  clearPendingWin();
  clearUnitFlash();
  if(notesMode && value!==0){
    remember();
    session.notes[selected] ^= (1<<value);
  }else{
    remember();
    session.values[selected]=value;
    session.notes[selected]=0;
  }
  hinted=null;
  startTimer();persist();render();
  const celebrated = !notesMode && value!==0 && celebrateUnits(before);
  if(isSudokuSolved(session.values)){
    pauseTimer();
    if(celebrated){
      const solvedRound=session;
      winTimer=setTimeout(()=>{
        winTimer=null;
        if(session===solvedRound&&!session.finished&&isSudokuSolved(session.values))finish();
      },950);
    }else finish();
    return;
  }
  if(hasConflict(session.values,selected))announce('Ta cyfra powtarza się w wierszu, kolumnie lub bloku.',true);
  else if(boardHasSudokuConflict(session.values))announce('Na planszy jest konflikt — sprawdź czerwone pola.',true);
  else if(celebrated)announce('Świetnie! Ukończony obszar zaznaczono na zielono.');
  else announce(notesMode?'Kandydat zapisany.':'Cyfra wpisana. Kontynuuj rozwiązywanie.');
}
function undo() {
  if(!session || session.finished || !session.history.length)return;
  clearPendingWin();clearUnitFlash();
  const state=session.history.pop();
  session.values=[...state.values];
  session.notes=[...state.notes];
  hinted=null;persist();render();announce('Cofnięto ostatni ruch.');
}
function clearCell() { if(!session?.finished)inputDigit(0); }
function toggleNotes() {
  if(session?.finished)return;
  notesMode=!notesMode;render();
  announce(notesMode?'Notatki włączone — cyfry zapisują kandydatów.':'Notatki wyłączone — cyfry wypełniają pola.');
}
function hint() {
  if(!session || session.finished)return;
  const step=findSudokuHint(session.values,record.puzzle);
  if(!step){
    announce('Sprawdź, czy wszystkie wpisane cyfry są poprawne.');
    return;
  }
  clearPendingWin();clearUnitFlash();
  notesMode=false;
  selected=step.index;
  hinted=step.index;
  session.hintsUsed++;
  startTimer();persist();render();
  track('hint_used',{gameId:'sudoku',puzzleId:record.puzzleId,date:today,mode,hintsUsed:session.hintsUsed});
  announce(step.reason);
  $('#feedback').classList.add('hint-message');
}
function reset() {
  if(!session || session.finished)return;
  clearPendingWin();clearUnitFlash();pauseTimer();
  if(mode==='daily')clearSudokuSession(today);
  session=createSudokuSession({date:today,seed:record.puzzleId,puzzle:record.puzzle});
  notesMode=false;hinted=null;resetFocus();persist();render();announce('Plansza wyczyszczona. Zacznij od nowa.');
}
async function loadRound(training) {
  clearPendingWin();clearUnitFlash();
  $('#board').setAttribute('aria-busy','true');
  $('#done').hidden=true;
  $('#loadError').hidden=true;
  pauseTimer();
  try {
    if(training) {
      const seed=globalThis.crypto?.randomUUID?.()||Math.random().toString(36);
      record=buildSudokuPuzzle('training:'+seed,{givens:17});
      record.puzzleId='sudoku-training:'+seed;
      mode='training';trainingCount++;
    } else {
      record=await getDailyGame('sudoku',today);
      mode='daily';
    }
    setGameMode(mode);
    session=mode==='daily'
      ?loadSudokuSession({date:today,seed:record.puzzleId,puzzle:record.puzzle})
      :createSudokuSession({date:today,seed:record.puzzleId,puzzle:record.puzzle});
    if(session.finished)session=createSudokuSession({date:today,seed:record.puzzleId,puzzle:record.puzzle});
    $('#roundLabel').textContent=mode==='daily'?'Dzisiaj':'Trening #'+trainingCount;
    notesMode=false;hinted=null;buildBoard();resetFocus();render();renderTimer();
    if(session.startedAt&&!session.finished&&!document.hidden){
      session.runningSince=Date.now();
      tick=setInterval(renderTimer,250);
    }
    track(mode==='daily'?'game_opened':'game_training_started',{
      gameId:'sudoku',puzzleId:record.puzzleId,date:today,mode
    });
    announce('Wybierz pole i wpisz cyfrę 1–6. Możesz używać notatek.');
  } catch(error) {
    console.error('Sudoku: puzzle loading failed',error);
    $('#loadError').hidden=false;
    track('game_load_failed',{gameId:'sudoku',date:today,mode:training?'training':'daily'});
  } finally {board.setAttribute('aria-busy','false');}
}
function handleKey(event) {
  if(!session || !record || session.finished || $('#done').hidden===false)return;
  const active=document.activeElement;
  if(['INPUT','TEXTAREA','SELECT'].includes(active?.tagName))return;
  if(event.ctrlKey||event.metaKey){
    if(event.key.toLowerCase()==='z'){event.preventDefault();undo();}
    return;
  }
  const row=Math.floor(selected/SIZE),col=selected%SIZE;
  const delta={ArrowUp:row>0?-SIZE:null,ArrowDown:row<SIZE-1?SIZE:null,
    ArrowLeft:col>0?-1:null,ArrowRight:col<SIZE-1?1:null};
  if(event.key in delta){
    event.preventDefault();
    const previous=selected;
    if(delta[event.key]!=null)selected+=delta[event.key];
    if(hinted!==null && previous!==selected){
      hinted=null;announce('Wybierz cyfrę 1–6 lub skorzystaj z podpowiedzi.');
    }
    render();cells[selected]?.focus({preventScroll:true});return;
  }
  if(/^[1-6]$/.test(event.key)){event.preventDefault();inputDigit(Number(event.key));}
  else if(['Backspace','Delete','0'].includes(event.key)){event.preventDefault();clearCell();}
  else if(event.key.toLowerCase()==='n'){event.preventDefault();toggleNotes();}
}
$('#keypad').addEventListener('click',event=>{
  const target=event.target.closest('button[data-digit]');
  if(target)inputDigit(Number(target.dataset.digit));
});
$('#undo').addEventListener('click',undo);
$('#erase').addEventListener('click',clearCell);
$('#notes').addEventListener('click',toggleNotes);
$('#hint').addEventListener('click',hint);
$('#reset').addEventListener('click',reset);
$('#replay').addEventListener('click',()=>loadRound(true));
$('#rulesTop').addEventListener('click',()=>{
  if(matchMedia('(max-width: 767px)').matches){
    const aside=$('.sudoku-aside');
    const open=aside.classList.toggle('mobile-open');
    $('#rulesTop').setAttribute('aria-expanded',String(open));
    if(open)aside.querySelector('.sudoku-reset')?.focus({preventScroll:true});
    return;
  }
  const rules=$('#rules');rules.open=true;rules.scrollIntoView({behavior:'smooth'});
});
document.addEventListener('keydown',handleKey);
document.addEventListener('visibilitychange',()=>{
  if(!session||session.finished)return;
  if(document.hidden){settlePendingWin();pauseTimer();}
  else if(session.startedAt&&!session.runningSince){
    session.runningSince=Date.now();if(!tick)tick=setInterval(renderTimer,250);
  }
});
window.addEventListener('pagehide',()=>{settlePendingWin();pauseTimer();});
const shouldTrain=requestedMode==='training'||
  loadFigloState(today).daily.completedGames.includes('sudoku');
loadRound(shouldTrain);
