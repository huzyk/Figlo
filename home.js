import { currentDateKey, dateFromKey, getWeekDateKeys } from './src/daily.js';
import { getOverallAverageTime, isTodayComplete, loadFigloState } from './src/storage.js';

const $ = selector => document.querySelector(selector);
const today = currentDateKey();
const todayDate = dateFromKey(today) || new Date();
const state = loadFigloState(today);
const dailyDone = isTodayComplete(state);
const completedCount = state.daily.completedGames.length;
const requiredCount = state.daily.requiredGames.length;

function formatDuration(ms) { if (!Number.isFinite(ms) || ms <= 0) return '—'; const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function streakLabel(value) { return value === 1 ? '1 dzień' : `${value} dni`; }
function injectDuetCard() {
  if (!state.daily.requiredGames.includes('duet') || $('#duetCard')) return;
  const games=document.querySelector('.games'); const placeholder=games?.children?.[1]; if(!games||!placeholder)return;
  const card=document.createElement('a'); card.className='game-card active';card.id='duetCard';card.href='duet.html';
  card.innerHTML='<div class="game-art dots-art" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="22" cy="32" r="11"/><path d="M42 19 53 32 42 45 31 32Z"/></svg></div><span class="badge">Nowe</span><h3>Duet</h3><p>Ułóż dwa symbole tak, żeby każdy wiersz i kolumna zachował równowagę.</p><span class="play" id="duetStatus">Graj</span>';
  placeholder.replaceWith(card);
  const cta=document.querySelector('.daily-cta .btn.white'); if(cta && state.daily.completedGames.includes('korony') && !state.daily.completedGames.includes('duet')){cta.href='duet.html';cta.textContent='Zagraj w Duet →';}
}
function renderDate() { const formatted=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'}).format(todayDate); $('#todayDate').textContent=formatted.charAt(0).toUpperCase()+formatted.slice(1); }
function markGame(id,cardId,statusId){const done=state.daily.completedGames.includes(id);const card=$(cardId),status=$(statusId);if(done&&card&&status){status.textContent='Zagraj ponownie';card.classList.add('completed');card.setAttribute('aria-label',`${id==='korony'?'Korony':'Duet'} ukończone dzisiaj. Zagraj ponownie`);}}
function renderDailyProgress(){
  $('#progressRing').textContent=`${completedCount}/${requiredCount}`;const percent=requiredCount?completedCount/requiredCount:0;$('#progressRingVisual').style.background=`conic-gradient(var(--purple) 0 ${percent*100}%, var(--purple-light) ${percent*100}% 100%)`;
  if(dailyDone){$('#dailyStatusTitle').textContent='Dzisiejsze Figlo zrobione';$('#dailyStatusText').textContent='Świetna robota. Wróć jutro po nowe wyzwanie.';}
  else if(completedCount===0&&requiredCount===2){$('#dailyStatusTitle').textContent='Dwie gry czekają';$('#dailyStatusText').textContent='Ukończ Korony i Duet, żeby zaliczyć dzisiejszy dzień.';}
  else if(completedCount===1&&requiredCount===2){$('#dailyStatusTitle').textContent='Jeszcze jedna gra';$('#dailyStatusText').textContent='Jesteś w połowie dzisiejszego zestawu.';}
  else{$('#dailyStatusTitle').textContent='Korony czekają';$('#dailyStatusText').textContent='Ukończ aktywną grę, żeby zaliczyć dzisiejszy dzień.';}
  markGame('korony','#crownsCard','#crownsStatus');markGame('duet','#duetCard','#duetStatus');
}
function renderStats(){const average=getOverallAverageTime(state);$('#streakValue').textContent=streakLabel(state.user.streak);$('#cardStreak').textContent=streakLabel(state.user.streak);$('#statStreak').textContent=String(state.user.streak);$('#bestStreak').textContent=`Najlepsza: ${state.user.bestStreak}`;$('#activeDays').textContent=String(state.user.completedDays);$('#totalCompleted').textContent=String(state.user.completedGames);$('#averageTime').textContent=formatDuration(average);}
function renderWeek(){const root=$('#weekStrip');const labels=['P','W','Ś','C','P','S','N'];const dates=getWeekDateKeys(todayDate);root.innerHTML='';dates.forEach((dateKey,index)=>{const item=document.createElement('div');item.className='week-day';const isToday=dateKey===today,isCompleted=state.user.completedDates.includes(dateKey);if(isToday)item.classList.add('today');if(isCompleted)item.classList.add('completed');if(isToday)item.setAttribute('aria-current','date');const label=document.createElement('span');label.className='week-day-label';label.textContent=labels[index];const dot=document.createElement('span');dot.className='week-day-state';dot.textContent=isCompleted?'✓':isToday?'•':'·';item.setAttribute('aria-label',`${labels[index]}${isCompleted?', ukończony':''}${isToday?', dzisiaj':''}`);item.append(label,dot);root.appendChild(item);});}
function renderGamesSummary(){const available=state.daily.requiredGames.length;$('#gamesSummary').textContent=available===1?'1 gra dostępna. Kolejne Figlo już powstają.':`${available} gry dostępne dzisiaj.`;}
function wireMobileMenu(){const menu=$('.menu');menu?.addEventListener('click',()=>{const nav=document.querySelector('nav');const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('nav-open',!open);});}
injectDuetCard();renderDate();renderDailyProgress();renderStats();renderWeek();renderGamesSummary();wireMobileMenu();
