import { A, B, EMPTY, SIZE, REL_SAME } from './constants.js';
import { currentDateKey, dailyPuzzleSeed } from '../daily.js';
import { loadDuetDaily } from './daily-loader.js';
import { getDuetHint } from './hints.js';
import { getColumn, getRow, countValues, hasTriple, isPartialBoardValid, isSolved, relationSatisfied } from './rules.js';
import { completeDailyGame, loadFigloState } from '../storage.js';
import { restoreOrCreateDuetSession, saveDuetSession, clearDuetSession } from './session.js';

const $ = s => document.querySelector(s);
const boardEl = $('#board');
const today = currentDateKey();
const seed = dailyPuzzleSeed('duet', today);
let record = null;
let puzzle = null;
let givens = new Set();
let session = null;
let timerTick = null;

function formatMs(ms) {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
}
function elapsedNow() {
  if (!session) return 0;
  return session.elapsedMs + (session.runningSince ? Date.now() - session.runningSince : 0);
}
function ensureTimerStarted() {
  if (!session.runningSince && !session.finished) session.runningSince = Date.now();
  if (!timerTick) timerTick = setInterval(renderTimer, 250);
}
function pauseTimer() {
  if (!session?.runningSince) return;
  session.elapsedMs += Date.now() - session.runningSince;
  session.runningSince = null;
  saveSession();
}
function renderTimer() { $('#timer').textContent = formatMs(elapsedNow()); }
function saveSession() { if (session) saveDuetSession(session, today); }

function symbolMarkup(value) {
  if (value === A) return '<span class="symbol a" aria-hidden="true"></span>';
  if (value === B) return '<span class="symbol b" aria-hidden="true"></span>';
  return '';
}
function valueName(value) { return value === A ? 'koło' : value === B ? 'romb' : 'puste'; }
function relationForCell(index) {
  return (puzzle.relations || []).filter(r => r.a === index || r.b === index);
}
function conflictCells() {
  const bad = new Set();
  for (let row=0; row<SIZE; row++) {
    const line = getRow(session.board,row); const {a,b}=countValues(line);
    if (hasTriple(line) || a>SIZE/2 || b>SIZE/2) for(let col=0;col<SIZE;col++) bad.add(row*SIZE+col);
  }
  for (let col=0; col<SIZE; col++) {
    const line=getColumn(session.board,col); const {a,b}=countValues(line);
    if (hasTriple(line) || a>SIZE/2 || b>SIZE/2) for(let row=0;row<SIZE;row++) bad.add(row*SIZE+col);
  }
  for (const rel of puzzle.relations || []) if (!relationSatisfied(session.board,rel)) { bad.add(rel.a); bad.add(rel.b); }
  return bad;
}
function relationMarkup(index) {
  return (puzzle.relations || []).filter(r=>r.a===index).map(rel => {
    const ar=Math.floor(rel.a/SIZE), ac=rel.a%SIZE, br=Math.floor(rel.b/SIZE), bc=rel.b%SIZE;
    const cls = ar===br ? 'horizontal' : 'vertical';
    const symbol = rel.type===REL_SAME ? '=' : '≠';
    return `<span class="relation ${cls}" aria-hidden="true">${symbol}</span>`;
  }).join('');
}
function renderBoard({focusIndex=null,hintIndex=null}={}) {
  const bad=conflictCells();
  boardEl.innerHTML='';
  session.board.forEach((value,index)=>{
    const row=Math.floor(index/SIZE), col=index%SIZE;
    const cell=document.createElement('button');
    cell.type='button'; cell.className='duet-cell'; cell.dataset.index=String(index); cell.setAttribute('role','gridcell');
    if(givens.has(index)){cell.classList.add('given');cell.setAttribute('aria-readonly','true');}
    if(bad.has(index)) cell.classList.add('conflict');
    if(hintIndex===index) cell.classList.add('hint');
    const rels=relationForCell(index); const relText=rels.map(r=>`${r.type===REL_SAME?'taki sam jak':'różny od'} pola ${r.a===index?r.b+1:r.a+1}`).join(', ');
    cell.setAttribute('aria-label',`Wiersz ${row+1}, kolumna ${col+1}, ${valueName(value)}${givens.has(index)?', pole stałe':''}${relText?`, ${relText}`:''}`);
    cell.innerHTML=symbolMarkup(value)+relationMarkup(index);
    cell.addEventListener('click',()=>cycle(index));
    cell.addEventListener('keydown',event=>handleKey(event,index));
    boardEl.appendChild(cell);
  });
  if(focusIndex!==null) boardEl.querySelector(`[data-index="${focusIndex}"]`)?.focus();
  $('#filledCounter').textContent=`${session.board.filter(v=>v!==EMPTY).length}/36`;
  renderFeedback(); renderTimer(); updateButtons();
}
function pushHistory(){session.history.push([...session.board]); if(session.history.length>100) session.history.shift();}
function setValue(index,value){
  if(session.finished||givens.has(index)) return;
  ensureTimerStarted(); pushHistory(); session.board[index]=value; saveSession();
  const solved=isSolved(session.board,puzzle); if(solved) finish(); else renderBoard({focusIndex:index});
}
function cycle(index){const v=session.board[index]; setValue(index,v===EMPTY?A:v===A?B:EMPTY);}
function handleKey(event,index){
  const row=Math.floor(index/SIZE),col=index%SIZE; let next=null;
  if(event.key==='ArrowLeft')next=row*SIZE+Math.max(0,col-1);
  if(event.key==='ArrowRight')next=row*SIZE+Math.min(SIZE-1,col+1);
  if(event.key==='ArrowUp')next=Math.max(0,row-1)*SIZE+col;
  if(event.key==='ArrowDown')next=Math.min(SIZE-1,row+1)*SIZE+col;
  if(next!==null){event.preventDefault();boardEl.querySelector(`[data-index="${next}"]`)?.focus();return;}
  if(event.key==='1'){event.preventDefault();setValue(index,A);}
  else if(event.key==='2'){event.preventDefault();setValue(index,B);}
  else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();setValue(index,EMPTY);}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();cycle(index);}
}
function renderFeedback(){
  const el=$('#feedback'); el.className='feedback';
  if(session.finished){el.textContent='Duet ukończony!';el.classList.add('success');return;}
  if(!isPartialBoardValid(session.board,puzzle)){el.textContent='Sprawdź zaznaczone pola — jedna z zasad jest naruszona.';el.classList.add('error');return;}
  const left=session.board.filter(v=>v===EMPTY).length; el.textContent=left?`Dobrze idzie. Zostało ${left} pól.`:'Sprawdź układ jeszcze raz.';
}
function updateButtons(){const disabled=!session.history.length||session.finished; $('#undo').disabled=disabled;$('#mobileUndo').disabled=disabled;$('#hint').disabled=session.finished;$('#mobileHint').disabled=session.finished;}
function undo(){if(!session.history.length||session.finished)return;session.board=session.history.pop();saveSession();renderBoard();}
function reset(){if(session.finished)return; session=restoreOrCreateDuetSession({date:today,seed,givens:puzzle.givens}); const fresh=Array(SIZE*SIZE).fill(EMPTY); for(const g of puzzle.givens) fresh[g.index]=g.value; session.board=fresh;session.history=[];session.elapsedMs=0;session.runningSince=null;saveSession();renderBoard();}
function showHint(){
  const hint=getDuetHint(puzzle,session.board); const card=$('#hintCard'); card.hidden=false;
  if(!hint){$('#hintText').textContent='Nie widzę teraz prostego logicznego kroku. Sprawdź, czy na planszy nie ma sprzeczności.';return;}
  const copy={sandwich:'Dwa takie same symbole z przerwą wymuszają przeciwny symbol pośrodku.',balance:'W tym wierszu lub kolumnie jest już komplet jednego symbolu.',relation:'Relacja między polami wymusza wartość tego pola.','triple-left':'Dwa takie same symbole obok siebie wymuszają przeciwny trzeci.','triple-right':'Dwa takie same symbole obok siebie wymuszają przeciwny trzeci.'};
  $('#hintText').textContent=hint.reason||copy[hint.rule]||'Ta wartość wynika bezpośrednio z zasad Duetu.'; renderBoard({hintIndex:hint.index});
}
function finish(){
  session.finished=true; pauseTimer(); const ms=session.elapsedMs; saveSession(); const result=completeDailyGame('duet',{timeMs:ms,today});
  $('#finalTime').textContent=formatMs(ms); $('#bestTime').textContent=formatMs(result.state.games.duet.bestTimeMs||ms);
  $('#doneCopy').textContent=result.firstDayCompletionToday?'Dzisiejsze Figlo zrobione!':'Świetna robota. Duet zaliczony.';
  $('#done').hidden=false; $('#backToSet').focus(); renderBoard();
}
function replay(){clearDuetSession(today); session=restoreOrCreateDuetSession({date:today,seed,givens:puzzle.givens}); $('#done').hidden=true; renderBoard();}

async function start(){
  try {
    record=await loadDuetDaily(today); puzzle=record.puzzle; givens=new Set(puzzle.givens.map(g=>g.index));
    session=restoreOrCreateDuetSession({date:today,seed,givens:puzzle.givens});
    if(session.board.length!==SIZE*SIZE){clearDuetSession(today);session=restoreOrCreateDuetSession({date:today,seed,givens:puzzle.givens});}
    if(session.runningSince) timerTick=setInterval(renderTimer,250);
    renderBoard();
  } catch(error) {
    console.error('duet daily load failure',error); $('#loadError').hidden=false; boardEl.setAttribute('aria-disabled','true');
  }
}

$('#undo').addEventListener('click',undo);$('#mobileUndo').addEventListener('click',undo);
$('#hint').addEventListener('click',showHint);$('#mobileHint').addEventListener('click',showHint);
$('#reset').addEventListener('click',reset);$('#mobileReset').addEventListener('click',reset);
$('#hintClose').addEventListener('click',()=>{$('#hintCard').hidden=true;renderBoard();});
$('#rulesTop').addEventListener('click',()=>{$('#rules').open=true;$('#rules').scrollIntoView({behavior:'smooth'});});
$('#replay').addEventListener('click',replay);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseTimer();else if(session&&!session.finished&&session.history.length){session.runningSince=Date.now();saveSession();timerTick ||= setInterval(renderTimer,250);}});
window.addEventListener('pagehide',pauseTimer);
start();
