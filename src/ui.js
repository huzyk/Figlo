import { N, allCells, rc, regionAt, setRegions } from './puzzle.js';
import { clearManualXs, conflicts, createGameState, cycleCell, isSolved, snapshot, visibleXs } from './game.js';
import { getHint } from './hints.js';
import { generatePuzzle } from './generator.js';
import { currentDateKey, dailyPuzzleSeed } from './daily.js';
import {
  completeDailyGame,
  getCrownSession,
  loadFigloState,
  saveCrownSession,
  clearCrownSession,
  updateFigloSettings
} from './storage.js';

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

const today = currentDateKey();
const dailySeed = dailyPuzzleSeed('korony', today);
const isLocalTest = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
let currentPuzzle = null;
let productState = loadFigloState(today);
let state = createGameState();
let history = [];
let started = false;
let tick = null;
let finished = false;
let gameMode = 'daily';
let practiceNumber = 0;
let autoXEnabled = Boolean(productState.settings.autoX);
let elapsedMs = 0;
let runningSince = null;

autoXInput.checked = autoXEnabled;
mobileAutoX.setAttribute('aria-pressed', String(autoXEnabled));

const crownMarkup = '<span class="mark crown" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 24h24l-2 5H6l-2-5Zm1-15 7 6 4-10 4 10 7-6-2 12H7L5 9Z"/></svg></span>';

function fmt(ms) { const seconds = Math.floor(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function currentElapsed(now = Date.now()) { return elapsedMs + (runningSince ? Math.max(0, now - runningSince) : 0); }
function refreshTimer() { timer.textContent = fmt(currentElapsed()); }
function startTimer() { if (finished) return; if (!started) started = true; if (!runningSince) runningSince = Date.now(); if (!tick) tick = setInterval(refreshTimer, 250); }
function pauseTimer(now = Date.now()) { if (runningSince) { elapsedMs += Math.max(0, now - runningSince); runningSince = null; } if (tick) clearInterval(tick); tick = null; refreshTimer(); }
function serializeHistory() { return history.map(item => ({ crowns: [...(item.crowns || [])], manualXs: [...(item.manualXs || [])] })); }
function persistSession() { if (gameMode !== 'daily') return; saveCrownSession({ date: today, seed: dailySeed, crowns: [...state.crowns], manualXs: [...state.manualXs], history: serializeHistory(), elapsedMs, runningSince, finished }, today); }
function clearHint() { [...board.children].forEach(cell => cell.classList.remove('hint-candidate','hint-error','hint-eliminate','hint-area','hint-focus')); hintCard.classList.remove('show'); }
function regionBorders(index, element) { const [row,column]=rc(index), region=regionAt(index); if(row===0||regionAt(index-N)!==region)element.classList.add('rt'); if(column===N-1||regionAt(index+1)!==region)element.classList.add('rr'); if(row===N-1||regionAt(index+N)!==region)element.classList.add('rb'); if(column===0||regionAt(index-1)!==region)element.classList.add('rl'); }
function cellStateLabel(index,xs){ if(state.crowns.has(index))return'korona'; if(xs.has(index))return'X'; return'puste'; }
function refreshStats(){ const game=productState.games.korony; $('#crownsBest').textContent=game.bestTimeMs?fmt(game.bestTimeMs):'—'; $('#modalBest').textContent=game.bestTimeMs?fmt(game.bestTimeMs):'—'; $('#crownsCount').textContent=String(game.completedCount||0); $('#crownsStreak').textContent=productState.user.streak?String(productState.user.streak):'—'; }
function updateControls(){ undoBtn.disabled=!history.length||finished; $('#mobileUndo').disabled=!history.length||finished; hintBtn.disabled=finished; $('#mobileHint').disabled=finished; mobileAutoX.setAttribute('aria-pressed',String(autoXEnabled)); mobileAutoX.classList.toggle('is-active',autoXEnabled); }
function updateFeedback(bad){ feedback.className='feedback'; if(finished){ feedback.textContent=gameMode==='daily'?'Dzisiejsze Korony ukończone. Świetna robota.':gameMode==='replay'?'Replay ukończony. Wynik dnia nie został naliczony ponownie.':'Plansza treningowa ukończona. Świetna robota.'; feedback.classList.add('success'); return; } if(bad.size){ feedback.textContent='Te korony łamią jedną z zasad.'; feedback.classList.add('error'); return; } const remaining=N-state.crowns.size; feedback.textContent=remaining===N?'Powodzenia. Znajdź miejsce dla każdej korony.':remaining===1?'Dobrze idzie. Została 1 korona.':`Dobrze idzie. Zostały ${remaining} korony.`; }
function render(){ const focusedIndex=board.contains(document.activeElement)?Number(document.activeElement?.dataset?.index):null; const xs=visibleXs(state,autoXEnabled), bad=conflicts(state.crowns); board.innerHTML=''; for(const index of allCells){ const cell=document.createElement('button'); const [row,column]=rc(index); cell.type='button'; cell.className=`cell r${regionAt(index)}`; cell.setAttribute('role','gridcell'); cell.setAttribute('aria-label',`Wiersz ${row+1}, kolumna ${column+1}, ${cellStateLabel(index,xs)}`); cell.dataset.index=String(index); regionBorders(index,cell); if(bad.has(index))cell.classList.add('bad'); if(state.crowns.has(index))cell.innerHTML=crownMarkup; else if(xs.has(index))cell.innerHTML='<span class="mark x-mark" aria-hidden="true">×</span>'; cell.addEventListener('click',()=>makeMove(index)); cell.addEventListener('keydown',handleCellKeys); board.appendChild(cell); } if(Number.isInteger(focusedIndex)&&focusedIndex>=0)board.children[focusedIndex]?.focus(); $('#crownCounter').textContent=`${state.crowns.size}/${N}`; updateControls(); updateFeedback(bad); done.classList.toggle('show',finished); if(finished)requestAnimationFrame(()=>nextPuzzleBtn.focus()); }
function handleCellKeys(event){ const index=Number(event.currentTarget.dataset.index); const [row,column]=rc(index); let next=null; if(event.key==='ArrowUp'&&row>0)next=index-N; if(event.key==='ArrowDown'&&row<N-1)next=index+N; if(event.key==='ArrowLeft'&&column>0)next=index-1; if(event.key==='ArrowRight'&&column<N-1)next=index+1; if(event.key==='Enter'||event.key===' '){event.preventDefault();makeMove(index);return;} if(next!==null){event.preventDefault();board.children[next]?.focus();} }
function finishGame(ms){ finished=true; pauseTimer(); elapsedMs=ms; runningSince=null; timer.textContent=fmt(ms); finalTime.textContent=`Czas ${timer.textContent}`; if(gameMode==='daily'||gameMode==='replay'){ const previousBest=productState.games.korony.bestTimeMs; const result=completeDailyGame('korony',{timeMs:ms,today}); productState=result.state; const currentBest=productState.games.korony.bestTimeMs; const isNewRecord=Number.isFinite(currentBest)&&currentBest===ms&&(!previousBest||ms<previousBest); $('#recordBadge').hidden=!isNewRecord; } else $('#recordBadge').hidden=true; if(gameMode==='daily')persistSession(); refreshStats(); }
function makeMove(index){ if(finished)return; startTimer(); clearHint(); history.push(snapshot(state)); state=cycleCell(state,index,{autoXEnabled}); persistSession(); if(isSolved(state))finishGame(currentElapsed()); render(); }
function showHint(){
  if(finished)return;
  clearHint();
  const hint=getHint(state,history);
  if(!hint){hintText.textContent='Nie znalazłem teraz prostej, uczciwej dedukcji.';hintCard.classList.add('show');return;}
  for(const index of hint.area||[])board.children[index]?.classList.add('hint-area');
  for(const index of hint.focus||[])board.children[index]?.classList.add('hint-focus');
  for(const index of hint.cells||[])board.children[index]?.classList.add(hint.kind==='error'?'hint-error':'hint-candidate');
  for(const index of hint.eliminate||[])board.children[index]?.classList.add('hint-eliminate');
  const reason=hint.reason||hint.text;
  if(hint.action){
    hintText.innerHTML='<div class="hint-section"><span class="hint-label">Dlaczego</span><p class="hint-copy"></p></div><div class="hint-section"><span class="hint-label">Co zrobić</span><p class="hint-copy"></p></div>';
    const copies=hintText.querySelectorAll('.hint-copy');
    copies[0].textContent=reason;
    copies[1].textContent=hint.action;
  }else{
    hintText.innerHTML='<div class="hint-section"><p class="hint-copy"></p></div>';
    hintText.querySelector('.hint-copy').textContent=reason;
  }
  hintCard.classList.add('show');
}
function resetRound({persist=true}={}){ state=createGameState(); history=[]; finished=false; started=false; pauseTimer(); elapsedMs=0; runningSince=null; timer.textContent='00:00'; finalTime.textContent=''; $('#recordBadge').hidden=true; clearHint(); if(persist)persistSession(); render(); }
function practiceSeed(){ return globalThis.crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`; }
function undo(){ if(!history.length||finished)return; clearHint(); const previous=history.pop(); state=createGameState(previous.crowns,previous.manualXs); persistSession(); render(); }
function setAutoX(value){ autoXEnabled=value; autoXInput.checked=value; productState=updateFigloSettings({autoX:value}); clearHint(); persistSession(); render(); }
function toggleRules(forceOpen=null){ const rules=$('#rules'); rules.open=forceOpen===null?!rules.open:forceOpen; if(rules.open)rules.scrollIntoView({behavior:'smooth',block:'nearest'}); }
function restoreSession(session){ state=createGameState(session.crowns,session.manualXs); history=(session.history||[]).map(item=>({crowns:new Set(item.crowns||[]),manualXs:new Set(item.manualXs||[])})); elapsedMs=Number(session.elapsedMs)||0; runningSince=Number(session.runningSince)||null; started=elapsedMs>0||Boolean(runningSince)||state.crowns.size>0||state.manualXs.size>0; finished=false; if(started&&!runningSince)runningSince=Date.now(); if(started)tick=setInterval(refreshTimer,250); refreshTimer(); }
function exposeTestHook(){ if(!isLocalTest||!currentPuzzle)return; globalThis.__FIGLO_TEST__={ getSolution:()=>[...currentPuzzle.solution] }; }
function loadDailyPuzzle(){ currentPuzzle=generatePuzzle(dailySeed); setRegions(currentPuzzle.regions); exposeTestHook(); const alreadyCompleted=productState.daily.completedGames.includes('korony'); const session=getCrownSession({today,seed:dailySeed}); if(!alreadyCompleted&&session&&!session.finished){gameMode='daily';roundLabel.textContent='Dzisiaj';restoreSession(session);render();return;} if(alreadyCompleted){gameMode='replay';roundLabel.textContent='Replay';clearCrownSession(today);resetRound({persist:false});return;} gameMode='daily';roundLabel.textContent='Dzisiaj';resetRound({persist:true}); }
function loadPracticePuzzle(){ pauseTimer(); currentPuzzle=generatePuzzle(practiceSeed()); setRegions(currentPuzzle.regions); exposeTestHook(); gameMode='practice'; practiceNumber+=1; roundLabel.textContent=`Trening #${practiceNumber}`; resetRound({persist:false}); }

undoBtn.addEventListener('click',undo); $('#mobileUndo').addEventListener('click',undo); $('#reset').addEventListener('click',()=>resetRound({persist:gameMode==='daily'})); $('#mobileReset').addEventListener('click',()=>resetRound({persist:gameMode==='daily'})); $('#clearMarks').addEventListener('click',()=>{if(finished||!state.manualXs.size)return;startTimer();clearHint();history.push(snapshot(state));state=clearManualXs(state);persistSession();render();}); hintBtn.addEventListener('click',showHint); $('#mobileHint').addEventListener('click',showHint); $('#hintClose').addEventListener('click',clearHint); $('#rulesBtn').addEventListener('click',()=>toggleRules()); $('#helpTop').addEventListener('click',()=>toggleRules(true)); autoXInput.addEventListener('change',()=>setAutoX(autoXInput.checked)); mobileAutoX.addEventListener('click',()=>setAutoX(!autoXEnabled)); nextPuzzleBtn.addEventListener('click',async()=>{nextPuzzleBtn.disabled=true;nextPuzzleBtn.textContent='Generuję…';await new Promise(resolve=>requestAnimationFrame(resolve));try{loadPracticePuzzle();nextPuzzleBtn.textContent='Następna plansza →';}catch(error){console.error(error);nextPuzzleBtn.textContent='Spróbuj ponownie';}nextPuzzleBtn.disabled=false;});

document.addEventListener('visibilitychange',()=>{if(gameMode!=='daily'||finished||!started)return;if(document.hidden){pauseTimer();persistSession();}else{runningSince=Date.now();if(!tick)tick=setInterval(refreshTimer,250);persistSession();}});
window.addEventListener('pagehide',()=>{if(gameMode==='daily'&&!finished){pauseTimer();persistSession();}});

refreshStats();
loadDailyPuzzle();