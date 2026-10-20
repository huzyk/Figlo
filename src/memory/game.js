import {dateKey, makeDeck, isPair, formatTime, packForDate, packById, nextPackId} from './core.js';
import {ART} from './symbols.js';
import {currentDateKey} from '../daily.js';
import {MEMORY_LAUNCH_DATE} from '../daily-games.js';
import {getDailyProgress, completeGame} from '../services/progress-service.js';
import {track} from '../services/analytics-service.js';
import {requestedGameMode,requestedPuzzleDate,validateChallengeRecord,setGameMode} from '../ui/game-mode.js';
import {watchDayRollover} from '../ui/day-rollover.js';

const backIcon='<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M16 1v30M1 16h30M5 5l22 22M27 5 5 27"/><circle cx="16" cy="16" r="5" fill="#efe8ff" stroke="none"/></svg>';
const el=id=>document.getElementById(id);
const today=currentDateKey();
const parameters=new URLSearchParams(location.search);
let mode=parameters.has('try')?'training':requestedGameMode();
let gameDate=mode==='challenge'?requestedPuzzleDate():today;
let stopped=false;
let showAll=false,blocked=false,selected=[],timerHandle=null;
let running=false,startClock=performance.now();
const cardEls=[];
const officialPuzzleId=date=>'memory:'+date+':v1';

function randomSeed() {return 'training:'+Date.now()+':'+(globalThis.crypto?.randomUUID?.()||Math.random());}
function storageKey(){
  return 'puzli:memory:session:v2:'+(mode==='training'?'training':mode+':'+gameDate);
}
function fresh(modeName,packId=packForDate(gameDate).id){
  return {version:2,date:gameDate,mode:modeName,packId,
    seed:modeName==='training'?randomSeed():'daily:'+gameDate,
    stage:'study',studyMs:0,playMs:0,reveals:0,hintsUsed:0,matched:[],
    startedAt:new Date().toISOString()};
}
function load(){
  let value;
  try{value=JSON.parse(localStorage.getItem(storageKey()));}catch{}
  if(!value||value.version!==2||value.mode!==mode||value.date!==gameDate||
      !['study','play','done'].includes(value.stage)||
      typeof value.seed!=='string'||typeof value.packId!=='string'||
      !Array.isArray(value.matched)||!Number.isFinite(value.studyMs)||
      !Number.isFinite(value.playMs)||!Number.isInteger(value.reveals)||
      !Number.isInteger(value.hintsUsed)||value.hintsUsed<0||
      value.studyMs<0||value.playMs<0||value.reveals<0)return fresh(mode);
  if(mode!=='training'&&(value.seed!=='daily:'+gameDate||value.packId!==packForDate(gameDate).id))return fresh(mode);
  if(mode==='training'&&!packById(value.packId).symbols.includes(makeDeck(value.seed,packById(value.packId).symbols)[0]))return fresh(mode);
  const matched=new Set(value.matched);
  const values=[...matched];
  if(values.some(i=>!Number.isInteger(i)||i<0||i>=16)||matched.size!==value.matched.length||matched.size%2)return fresh(mode);
  const valuesDeck=makeDeck(value.seed,packById(value.packId).symbols);
  if(values.some(i=>!matched.has(valuesDeck.findIndex((s,j)=>j!==i&&s===valuesDeck[i]))))return fresh(mode);
  if(value.stage==='done'&&matched.size!==16)return fresh(mode);
  return {...value,matched:values};
}
if(mode==='challenge'){
  try{
    if(gameDate<MEMORY_LAUNCH_DATE)throw Error('Memory jest dostępne w wyzwaniach od '+MEMORY_LAUNCH_DATE+'.');
    validateChallengeRecord({date:gameDate,puzzleId:officialPuzzleId(gameDate)});
  }catch(error){
    stopped=true;
    el('loadError').hidden=false;
    el('loadError').textContent=error.message||'Nie można uruchomić wyzwania.';
    el('readyButton').disabled=true;
    el('newButton').hidden=true;
    el('board').setAttribute('aria-disabled','true');
  }
}
if(mode==='daily'&&(today<MEMORY_LAUNCH_DATE||getDailyProgress(today).completedGames.includes('memory'))){
  mode='training';
  const url=new URL(location.href);url.searchParams.delete('try');url.searchParams.set('mode','training');
  history.replaceState(null,'',url);
}
let session=load();
let deck=makeDeck(session.seed,packById(session.packId).symbols);
setGameMode(mode,{date:gameDate,puzzleId:officialPuzzleId(gameDate)});
watchDayRollover(today);
const eventContext=()=>({gameId:'memory',mode,date:gameDate,puzzleId:officialPuzzleId(gameDate)});

function persist(){
  try{localStorage.setItem(storageKey(),JSON.stringify(session));}
  catch{/* Private mode may refuse local persistence. */}
}
function elapsed(stage){
  return (session[stage+'Ms']||0)+(running&&session.stage===stage?Math.max(0,performance.now()-startClock):0);
}
function freeze(){
  if(!running)return;
  if(session.stage==='study'||session.stage==='play')session[session.stage+'Ms']=elapsed(session.stage);
  running=false;
  persist();
}
function resume(){
  if(!document.hidden&&!stopped&&session.stage!=='done'){startClock=performance.now();running=true;}
}
function iconSvg(symbol){
  return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'+ART[symbol].art+'</svg>';
}
function createBoard(){
  const board=el('board');board.replaceChildren();cardEls.length=0;
  deck.forEach((symbol,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='memory-card';
    button.style.setProperty('--symbol-color',ART[symbol].color);
    button.innerHTML='<span class="card-rotator"><span class="card-face card-back">'+backIcon+
      '</span><span class="card-face card-front">'+iconSvg(symbol)+'</span></span>';
    button.addEventListener('click',()=>reveal(index));
    board.append(button);cardEls.push(button);
  });
}
function renderCards(){
  cardEls.forEach((card,i)=>{
    const matched=session.matched.includes(i);
    const open=session.stage==='study'||showAll||selected.includes(i)||matched;
    card.classList.toggle('is-faceup',open);
    card.classList.toggle('is-matched',matched);
    card.disabled=stopped||session.stage!=='play'||blocked||matched||selected.includes(i);
    card.setAttribute('aria-label',open?
      'Karta '+(i+1)+': '+ART[deck[i]].label+(matched?', para odnaleziona':''):
      'Karta '+(i+1)+': zakryta');
  });
}
function tick(){
  el('studyTime').textContent=formatTime(elapsed('study'));
  el('playTime').textContent=formatTime(elapsed('play'));
}
function render(){
  el('packName').textContent=packById(session.packId).name;
  el('roundLabel').textContent=mode==='training'?'Trening':mode==='challenge'?'Wyzwanie':'Dzisiaj';
  el('pairsCount').textContent=(session.matched.length/2)+' / 8';
  if(session.stage==='study'){
    el('stageLabel').textContent='01 / ZAPAMIĘTUJ';
    el('stageTitle').textContent='Masz to w pamięci?';
    el('stageText').textContent='Przyjrzyj się symbolom. Zakryj karty wtedy, kiedy uznasz, że jesteś gotowy.';
    el('boardCaption').textContent='Nie śpiesz się. To Ty decydujesz, kiedy jesteś gotowy.';
  }else{
    el('stageLabel').textContent=session.stage==='done'?'03 / ODKRYTE':'02 / ODKRYWAJ';
    el('stageTitle').textContent=session.stage==='done'?'Wszystkie pary!':'Zaufaj swojej pamięci';
    el('stageText').textContent=session.stage==='done'?'Osiem par znalazło swoje miejsce.':
      'Odkrywaj dwie karty. Każde odkrycie pomaga Ci rozpoznać układ.';
    el('boardCaption').textContent=session.stage==='done'?'Świetnie! Zestaw ukończony.':'Odkryj osiem par we własnym tempie.';
  }
  el('readyButton').hidden=session.stage!=='study';
  el('hintButton').hidden=session.stage!=='play';
  el('hintButton').disabled=blocked||stopped;
  el('newButton').textContent=mode==='training'?'Następny zestaw i nowa plansza':
    'Zobacz następny zestaw (Trening)';
  renderCards();tick();
  if(session.stage==='done')showFinish();
  else el('done').hidden=true;
}
function begin(){
  if(stopped||session.stage!=='study')return;
  freeze();session.stage='play';session.startedAt ||=new Date().toISOString();
  persist();resume();selected=[];render();
  track('game_started',eventContext());
}
function complete(){
  freeze();session.stage='done';persist();
  if(!stopped){
    let result=null;
    if(mode==='daily'){
      result=completeGame({
        gameId:'memory',puzzleId:officialPuzzleId(gameDate),
        date:gameDate,elapsedMs:session.studyMs+session.playMs,mode,
        startedAt:session.startedAt,hintsUsed:session.hintsUsed,resets:0,attemptNo:1
      });
    }
    track('game_completed',{...eventContext(),elapsedMs:session.studyMs+session.playMs,
      hintsUsed:session.hintsUsed});
    if(result?.firstDayCompletionToday)track('daily_completed',{...eventContext()});
  }
  render();
}
function reveal(i){
  if(stopped||session.stage!=='play'||blocked||selected.includes(i)||session.matched.includes(i))return;
  selected.push(i);session.reveals++;persist();
  if(selected.length===1){renderCards();return;}
  blocked=true;renderCards();
  const [a,b]=selected;
  if(isPair(deck,a,b)){
    session.matched.push(a,b);persist();
    el('pairsCount').textContent=session.matched.length/2+' / 8';
    renderCards();
    setTimeout(()=>{
      selected=[];blocked=false;
      if(session.matched.length===16)complete();else render();
    },510);
  }else{
    setTimeout(()=>{selected=[];blocked=false;render();},920);
  }
}
function peek(){
  if(stopped||session.stage!=='play'||blocked||selected.length)return;
  blocked=true;showAll=true;session.hintsUsed++;
  if(mode==='daily')track('hint_used',eventContext());
  persist();renderCards();el('hintButton').disabled=true;
  setTimeout(()=>{showAll=false;blocked=false;render();},2000);
}
function showFinish(){
  el('finishStudy').textContent=formatTime(session.studyMs);
  el('finalTime').textContent=formatTime(session.playMs);
  el('finishReveals').textContent=String(session.reveals);
  el('memoryInsight').textContent=session.reveals===16?
    '16 odkryć i osiem idealnie dobranych par. Fenomenalna pamięć!':
    'Wszystkie osiem par odnalezione. Każde odkrycie przybliżało Cię do celu.';
  el('done').hidden=false;
}
function training(){
  freeze();mode='training';gameDate=today;
  const url=new URL(location.href);
  url.searchParams.delete('challenge');url.searchParams.delete('v');url.searchParams.delete('try');
  url.searchParams.set('mode','training');history.replaceState(null,'',url);
  session=fresh('training',nextPackId(session.packId));
  deck=makeDeck(session.seed,packById(session.packId).symbols);
  selected=[];blocked=false;showAll=false;stopped=false;
  persist();resume();createBoard();
  setGameMode('training',{date:gameDate,puzzleId:session.seed});
  el('done').hidden=true;render();
  track('game_training_started',eventContext());
}
el('readyButton').addEventListener('click',begin);
el('hintButton').addEventListener('click',peek);
el('newButton').addEventListener('click',training);
el('replay').addEventListener('click',training);
document.addEventListener('visibilitychange',()=>{if(document.hidden)freeze();else resume();});
window.addEventListener('pagehide',freeze);
createBoard();resume();render();
if(!stopped)track('game_opened',eventContext());
timerHandle=setInterval(tick,200);
