import {watchDayRollover} from './src/ui/day-rollover.js';
import { initEngagementUI, renderEngagementUI } from './src/ui/engagement-home.js';
import{currentDateKey,dateFromKey,getWeekDateKeys}from'./src/daily.js';
import{getDailyManifest}from'./src/services/daily-service.js';
import{getDailyProgress}from'./src/services/progress-service.js';
import{getUserStats}from'./src/services/stats-service.js';
import{getIdentity}from'./src/services/identity-service.js';
import{track}from'./src/services/analytics-service.js';
const $=selector=>document.querySelector(selector);
const today=currentDateKey(),todayDate=dateFromKey(today)||new Date(),identity=getIdentity();
let progress=getDailyProgress(today),stats=getUserStats(today),manifest=null;
const gameNames={korony:'Korony',duet:'Duet',bloki:'Bloki',latarnie:'Latarnie',memory:'Memory',zip:'Zip',sudoku:'Sudoku'};
const gameLinks={korony:'korony.html',duet:'duet.html',bloki:'bloki.html',latarnie:'latarnie.html',memory:'memory.html',zip:'zip.html',sudoku:'sudoku.html'};
function formatDuration(ms){if(!Number.isFinite(ms)||ms<=0)return'—';const s=Math.floor(ms/1000);return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function streakLabel(value){return value===1?'1 dzień':`${value} dni`;}
function gameCountLabel(value){if(value===1)return'1 gra dostępna dzisiaj.';if(value>=2&&value<=4)return`${value} gry dostępne dzisiaj.`;return`${value} gier dostępnych dzisiaj.`;}
function waitingLabel(value){if(value===1)return'Jedna gra czeka';if(value>=2&&value<=4)return`${value} gry czekają`;return`${value} gier czeka`;}
function syncAvailableCards(){
  // One visual slot, two identities: preserve historic sets and their links
  // without changing the six-card homepage or overwriting old scores.
  const legacy=progress.requiredGames.includes('latarnie');
  const card=document.getElementById(legacy?'memoryCard':'latarnieCard');
  if(card){
    card.id=legacy?'latarnieCard':'memoryCard';
    card.classList.toggle('game-latarnie',legacy);
    card.classList.toggle('game-memory',!legacy);
    card.querySelector('h3').textContent=legacy?'Latarnie':'Memory';
    card.querySelector('.game-card-body p').textContent=legacy?'Oświetl każde pole.':'Zapamiętaj symbole. Odnajdź pary.';
    card.querySelector('.play').id=legacy?'latarnieStatus':'memoryStatus';
    card.href=legacy?'latarnie.html':'memory.html';
  }
  for(const gameId of Object.keys(gameNames)){
    const card=document.getElementById(gameId==='korony'?'crownsCard':gameId+'Card');
    if(card)card.hidden=!progress.requiredGames.includes(gameId);
  }
}
function renderDate(){const formatted=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'}).format(todayDate);$('#todayDate').textContent=formatted.charAt(0).toUpperCase()+formatted.slice(1);}
function markGame(id,cardId,statusId){
  const done=progress.completedGames.includes(id),card=$(cardId),status=$(statusId);
  if(!card||!status)return;
  card.classList.toggle('completed',done);
  card.href=done?`${gameLinks[id]}?mode=training`:gameLinks[id];
  status.textContent=done?'Zagraj ponownie':'Graj';
  card.setAttribute('aria-label',done?
    `${gameNames[id]} ukończone dzisiaj. Zagraj w trybie treningowym`:
    `${gameNames[id]}. Zagraj w dzisiejszą łamigłówkę`);
}
function renderDailyProgress(){
  syncAvailableCards();
  const completed=progress.completedGames.length,required=progress.requiredGames.length,remaining=Math.max(0,required-completed);
  $('#progressRing').textContent=`${completed}/${required}`;
  const percentage=required?completed/required*100:0;
  $('#progressRingVisual').style.background=
    `conic-gradient(var(--purple) 0 ${percentage}%, var(--purple-light) ${percentage}% 100%)`;
  if(progress.complete){
    $('#dailyStatusTitle').textContent='Zestaw ukończony!';
    $('#dailyStatusText').textContent='Brawo! Wróć jutro po nowe łamigłówki.';
  }else if(completed===0){
    $('#dailyStatusTitle').textContent=waitingLabel(required);
    $('#dailyStatusText').textContent='Wybierz dowolną grę. Twój postęp zapisze się automatycznie.';
  }else{
    $('#dailyStatusTitle').textContent='Dzień zaliczony!';
    $('#dailyStatusText').textContent=`${completed}/${required} gier. Chwila dla głowy już za Tobą. Masz ochotę na kolejną?`;
  }
  for(const [id,card,status] of [
    ['korony','#crownsCard','#crownsStatus'],['duet','#duetCard','#duetStatus'],
    ['bloki','#blokiCard','#blokiStatus'],['latarnie','#latarnieCard','#latarnieStatus'],['memory','#memoryCard','#memoryStatus'],
    ['zip','#zipCard','#zipStatus'],['sudoku','#sudokuCard','#sudokuStatus']
  ])markGame(id,card,status);
  const next=progress.requiredGames.find(id=>!progress.completedGames.includes(id));
  const cta=$('.daily-cta .btn.white');
  if(cta&&next){
    cta.href=gameLinks[next];
    cta.textContent=`Zagraj w ${gameNames[next]}`;
  }else if(cta){
    cta.href='korony.html?mode=training';
    cta.textContent='Zagraj treningowo';
  }
}
function renderStats(){$('#cardStreak').textContent=streakLabel(stats.activityStreak);$('#statStreak').textContent=String(stats.activityStreak);$('#bestStreak').textContent=`Najlepsza: ${stats.bestActivityStreak}`;$('#activeDays').textContent=String(stats.completedDays);$('#totalCompleted').textContent=String(stats.completedGames);$('#averageTime').textContent=formatDuration(stats.averageGameTimeMs);const dates=getWeekDateKeys(todayDate),active=dates.filter(date=>date<=today&&stats.activeDates.includes(date)).length;const goal=$('#weeklyGoal');if(goal)goal.textContent=active>=5?`Cel tygodnia osiągnięty — ${active} aktywnych dni!`:`${active}/5 aktywnych dni w tym tygodniu`;}
function renderWeek(){const root=$('#weekStrip'),labels=['P','W','Ś','C','P','S','N'],dates=getWeekDateKeys(todayDate);root.innerHTML='';dates.forEach((dateKey,index)=>{const item=document.createElement('div');item.className='week-day';const isToday=dateKey===today,isCompleted=stats.activeDates.includes(dateKey);if(isToday)item.classList.add('today');if(isCompleted)item.classList.add('completed');if(isToday)item.setAttribute('aria-current','date');const label=document.createElement('span');label.className='week-day-label';label.textContent=labels[index];const dot=document.createElement('span');dot.className='week-day-state';dot.textContent=isCompleted?'✓':isToday?'•':'·';item.setAttribute('aria-label',`${labels[index]}${isCompleted?', ukończony':''}${isToday?', dzisiaj':''}`);item.append(label,dot);root.appendChild(item);});}
function renderGamesSummary(){const available=manifest?.games?.filter(game=>game.available).length||progress.requiredGames.length;$('#gamesSummary').textContent=gameCountLabel(available);}
function wireMobileMenu(){
  const menu=$('.menu'),nav=document.querySelector('.nav-wrap nav');
  if(!menu||!nav)return;
  const close=()=>{menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Otwórz menu');nav.classList.remove('nav-open');};
  menu.addEventListener('click',()=>{
    const open=menu.getAttribute('aria-expanded')==='true';
    menu.setAttribute('aria-expanded',String(!open));
    menu.setAttribute('aria-label',open?'Otwórz menu':'Zamknij menu');
    nav.classList.toggle('nav-open',!open);
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  window.addEventListener('resize',()=>{if(window.innerWidth>600)close();});
}
function refreshProgress(){
  if(currentDateKey()!==today){location.reload();return;}
  progress=getDailyProgress(today);
  stats=getUserStats(today);
  renderDailyProgress();renderStats();renderWeek();renderGamesSummary();renderEngagementUI(today);
}
function wireGameSelection(){
  const ids={crownsCard:'korony',duetCard:'duet',blokiCard:'bloki',latarnieCard:'latarnie',memoryCard:'memory',zipCard:'zip',sudokuCard:'sudoku'};
  const root=document.querySelector('.games');
  root?.addEventListener('click',event=>{
    const card=event.target.closest('a.game-card');
    const gameId=card&&ids[card.id];
    if(gameId)track('game_selected',{gameId,date:today,mode:progress.completedGames.includes(gameId)?'training':'daily'});
  });
  const cta=document.querySelector('.daily-cta .btn.white');
  cta?.addEventListener('click',()=>{
    const next=progress.requiredGames.find(id=>!progress.completedGames.includes(id));
    track('game_selected',{gameId:next||'korony',date:today,mode:next?'daily':'training'});
  });
}
async function start(){
  renderDate();refreshProgress();wireMobileMenu();wireGameSelection();initEngagementUI(today);
  window.addEventListener('pageshow',event=>{if(event.persisted)refreshProgress();});
  window.addEventListener('storage',event=>{if(event.key==='figlo_user_state_v2')refreshProgress();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshProgress();});
  manifest=await getDailyManifest(today);
  renderGamesSummary();
  track('home_opened',{date:today,localId:identity.localId,games:manifest.games.map(game=>game.id)});
}
start().catch(error=>console.error('Nie udało się uruchomić strony PUZLI:',error));


watchDayRollover(today);
