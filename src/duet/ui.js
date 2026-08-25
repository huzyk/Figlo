import { A, B, EMPTY, SIZE, REL_SAME } from './constants.js';
import { currentDateKey } from '../daily.js';
import { getDailyGame } from '../services/daily-service.js';
import { completeGame } from '../services/progress-service.js';
import { getSession, saveSession as persistSession, clearSession } from '../services/session-service.js';
import { getIdentity } from '../services/identity-service.js';
import { track } from '../services/analytics-service.js';
import { loadFigloState } from '../storage.js';
import { getDuetHint } from './hints.js';
import { generateDuetPuzzleAsync } from './freeplay-generator.js';
import { createDuetSession } from './session.js';
import { getColumn, getRow, countValues, hasTriple, isPartialBoardValid, isSolved, relationSatisfied } from './rules.js';

const $ = s => document.querySelector(s);
const boardEl = $('#board');
const today = currentDateKey();
const identity = getIdentity();
const CONFLICT_FEEDBACK_DELAY_MS = 380;
let record = null;
let puzzle = null;
let givens = new Set();
let session = null;
let timerTick = null;
let conflictFeedbackVisible = true;
let conflictFeedbackTimer = null;
let gameMode = 'daily';
let freeplayNumber = 0;
let relationsByCell = new Map();
let outgoingRelationsByCell = new Map();

function formatMs(ms) {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
}
function elapsedNow() { return !session ? 0 : session.elapsedMs + (session.runningSince ? Date.now() - session.runningSince : 0); }
function ensureTimerStarted() {
  if (!session.runningSince && !session.finished) {
    session.runningSince = Date.now();
    session.startedAt ||= new Date().toISOString();
    track('game_started', { gameId:'duet', puzzleId:record?.puzzleId, date:today, mode:gameMode, localId:identity.localId });
  }
  if (!timerTick) timerTick = setInterval(renderTimer, 250);
}
function pauseTimer() {
  if (!session?.runningSince) return;
  session.elapsedMs += Date.now() - session.runningSince;
  session.runningSince = null;
  saveSession();
}
function renderTimer() { $('#timer').textContent = formatMs(elapsedNow()); }
function saveSession() { if (session && gameMode === 'daily') persistSession('duet', session, today); }
function delayConflictFeedback(index) {
  conflictFeedbackVisible = false;
  if (conflictFeedbackTimer) clearTimeout(conflictFeedbackTimer);
  conflictFeedbackTimer = setTimeout(() => {
    conflictFeedbackTimer = null;
    conflictFeedbackVisible = true;
    if (session && !session.finished) renderBoard({focusIndex:index});
  }, CONFLICT_FEEDBACK_DELAY_MS);
}
function showConflictFeedbackNow() {
  if (conflictFeedbackTimer) clearTimeout(conflictFeedbackTimer);
  conflictFeedbackTimer = null;
  conflictFeedbackVisible = true;
}
function randomSeed() { return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function dailyBest() { return loadFigloState(today).games.duet?.bestTimeMs || null; }
function indexRelations() {
  relationsByCell = new Map();
  outgoingRelationsByCell = new Map();
  for (const rel of puzzle?.relations || []) {
    if (!relationsByCell.has(rel.a)) relationsByCell.set(rel.a, []);
    if (!relationsByCell.has(rel.b)) relationsByCell.set(rel.b, []);
    if (!outgoingRelationsByCell.has(rel.a)) outgoingRelationsByCell.set(rel.a, []);
    relationsByCell.get(rel.a).push(rel);
    relationsByCell.get(rel.b).push(rel);
    outgoingRelationsByCell.get(rel.a).push(rel);
  }
}

function symbolMarkup(value) {
  if (value === A) return '<span class="symbol a" aria-hidden="true"></span>';
  if (value === B) return '<span class="symbol b" aria-hidden="true"></span>';
  return '';
}
function valueKey(value) { return value === A ? 'a' : value === B ? 'b' : 'empty'; }
function valueName(value) { return value === A ? 'symbol fioletowy' : value === B ? 'symbol złoty' : 'puste'; }
function relationForCell(index) { return relationsByCell.get(index) || []; }
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
  return (outgoingRelationsByCell.get(index) || []).map(rel => {
    const ar=Math.floor(rel.a/SIZE), br=Math.floor(rel.b/SIZE);
    const cls = ar===br ? 'horizontal' : 'vertical';
    const typeCls = rel.type===REL_SAME ? 'same' : 'different';
    return `<span class="relation ${cls} ${typeCls}" aria-hidden="true">${rel.type===REL_SAME ? '=' : '≠'}</span>`;
  }).join('');
}
function renderBoard({focusIndex=null,hintIndex=null}={}) {
  const bad=conflictFeedbackVisible ? conflictCells() : new Set();
  boardEl.innerHTML='';
  session.board.forEach((value,index)=>{
    const row=Math.floor(index/SIZE), col=index%SIZE;
    const cell=document.createElement('button');
    cell.type='button'; cell.className='duet-cell'; cell.dataset.index=String(index); cell.dataset.value=valueKey(value); cell.setAttribute('role','gridcell');
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
  if(isSolved(session.board,puzzle)) { showConflictFeedbackNow(); finish(); }
  else { delayConflictFeedback(index); renderBoard({focusIndex:index}); }
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
  if(session.finished){el.textContent=gameMode==='daily'?'Duet Daily ukończony!':'Duet Freeplay ukończony!';el.classList.add('success');return;}
  if(conflictFeedbackVisible && !isPartialBoardValid(session.board,puzzle)){el.textContent='Sprawdź zaznaczone pola — jedna z zasad jest naruszona.';el.classList.add('error');return;}
  const left=session.board.filter(v=>v===EMPTY).length; el.textContent=left?`Dobrze idzie. Zostało ${left} pól.`:'Sprawdź układ jeszcze raz.';
}
function updateButtons(){const disabled=!session.history.length||session.finished; $('#undo').disabled=disabled;$('#mobileUndo').disabled=disabled;$('#hint').disabled=session.finished;$('#mobileHint').disabled=session.finished;}
function undo(){if(!session.history.length||session.finished)return;showConflictFeedbackNow();session.board=session.history.pop();saveSession();renderBoard();}
function reset(){
  if(session.finished)return;
  showConflictFeedbackNow();
  if(gameMode==='daily'){
    clearSession('duet',today);
    session=getSession('duet',{date:today,seed:record.puzzleId,givens:puzzle.givens});
  }else session=createDuetSession({date:today,seed:record.puzzleId,givens:puzzle.givens});
  renderBoard();
}
function showHint(){
  showConflictFeedbackNow();
  const hint=getDuetHint(puzzle,session.board); const card=$('#hintCard'); card.hidden=false;
  track('hint_used',{gameId:'duet',puzzleId:record?.puzzleId,date:today,mode:gameMode,localId:identity.localId});
  if(!hint){$('#hintText').textContent='Nie widzę teraz prostego logicznego kroku. Sprawdź, czy na planszy nie ma sprzeczności.';return;}
  const copy={sandwich:'Dwa takie same symbole z przerwą wymuszają przeciwny symbol pośrodku.',balance:'W tym wierszu lub kolumnie jest już komplet jednego symbolu.',relation:'Relacja między polami wymusza wartość tego pola.','triple-left':'Dwa takie same symbole obok siebie wymuszają przeciwny trzeci.','triple-right':'Dwa takie same symbole obok siebie wymuszają przeciwny trzeci.'};
  $('#hintText').textContent=hint.reason||copy[hint.rule]||'Ta wartość wynika bezpośrednio z zasad Duetu.'; renderBoard({hintIndex:hint.index});
}
function finish(){
  session.finished=true; pauseTimer(); const ms=session.elapsedMs;
  let best=dailyBest();
  if(gameMode==='daily'){
    saveSession();
    const result=completeGame({gameId:'duet',puzzleId:record.puzzleId,date:today,elapsedMs:ms,mode:'daily',startedAt:session.startedAt||null});
    best=result.state.games.duet.bestTimeMs||ms;
    track('game_completed',{...result.event,localId:identity.localId});
    if(result.firstDayCompletionToday) track('daily_completed',{date:today,localId:identity.localId});
    $('#doneCopy').textContent=result.firstDayCompletionToday?'Dzisiejsze Figlo zrobione!':'Świetna robota. Duet zaliczony.';
  }else{
    track('game_completed',{gameId:'duet',puzzleId:record.puzzleId,date:today,elapsedMs:ms,mode:'freeplay',localId:identity.localId});
    $('#doneCopy').textContent='Freeplay ukończony. Ten wynik nie wpływa na Daily.';
  }
  $('#finalTime').textContent=formatMs(ms); $('#bestTime').textContent=best?formatMs(best):'—';
  $('#replay').textContent='Freeplay: nowa plansza';
  $('#done').hidden=false; $('#replay').focus(); renderBoard();
}
async function loadFreeplay(){
  showConflictFeedbackNow(); pauseTimer();
  const button=$('#replay'); button.disabled=true; button.textContent='Generuję…';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try{
    const seed=randomSeed();
    const generated=await generateDuetPuzzleAsync(seed);
    record={puzzleId:`duet-freeplay:${seed}`,puzzle:generated.puzzle};
    puzzle=generated.puzzle; givens=new Set(puzzle.givens.map(g=>g.index)); indexRelations();
    session=createDuetSession({date:today,seed:record.puzzleId,givens:puzzle.givens});
    gameMode='freeplay'; freeplayNumber+=1;
    $('#roundLabel').textContent=`Freeplay #${freeplayNumber}`;
    $('#hintCard').hidden=true; $('#done').hidden=true;
    track('game_freeplay_started',{gameId:'duet',puzzleId:record.puzzleId,date:today,localId:identity.localId});
    renderBoard();
  }catch(error){
    console.error('duet freeplay generation failure',error);
    button.textContent='Spróbuj ponownie';
  }finally{
    button.disabled=false;
  }
}

async function start(){
  try {
    record=await getDailyGame('duet',today); puzzle=record.puzzle; givens=new Set(puzzle.givens.map(g=>g.index)); indexRelations();
    session=getSession('duet',{date:today,seed:record.puzzleId,givens:puzzle.givens});
    if(session.board.length!==SIZE*SIZE){clearSession('duet',today);session=getSession('duet',{date:today,seed:record.puzzleId,givens:puzzle.givens});}
    gameMode='daily'; $('#roundLabel').textContent='Daily';
    if(session.runningSince) timerTick=setInterval(renderTimer,250);
    track('game_opened',{gameId:'duet',puzzleId:record.puzzleId,date:today,mode:'daily',localId:identity.localId});
    renderBoard();
    if(session.finished){
      $('#finalTime').textContent=formatMs(session.elapsedMs);
      const best=dailyBest(); $('#bestTime').textContent=best?formatMs(best):'—';
      $('#doneCopy').textContent='Dzisiejszy Duet jest już ukończony. Możesz zagrać nową planszę Freeplay.';
      $('#done').hidden=false;
    }
  } catch(error) {
    console.error('duet daily load failure',error); $('#loadError').hidden=false; boardEl.setAttribute('aria-disabled','true');
  }
}

$('#undo').addEventListener('click',undo);$('#mobileUndo').addEventListener('click',undo);
$('#hint').addEventListener('click',showHint);$('#mobileHint').addEventListener('click',showHint);
$('#reset').addEventListener('click',reset);$('#mobileReset').addEventListener('click',reset);
$('#hintClose').addEventListener('click',()=>{$('#hintCard').hidden=true;renderBoard();});
$('#rulesTop').addEventListener('click',()=>{$('#rules').open=true;$('#rules').scrollIntoView({behavior:'smooth'});});
$('#replay').addEventListener('click',loadFreeplay);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseTimer();else if(session&&!session.finished&&session.history.length){session.runningSince=Date.now();saveSession();timerTick ||= setInterval(renderTimer,250);}});
window.addEventListener('pagehide',pauseTimer);
start();