const STORAGE_KEY='figlo_user_state_v2';
const $=s=>document.querySelector(s);
const localDateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt=ms=>{if(!ms)return'—';const s=Math.floor(ms/1000);return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const dayDiff=(a,b)=>{if(!a||!b)return null;const A=new Date(`${a}T12:00:00`),B=new Date(`${b}T12:00:00`);return Math.round((B-A)/86400000)};
function migrateLegacy(){const today=localDateKey();const completed=localStorage.getItem('figlo-crowns-completed-date')===today;return{version:2,user:{streak:Number(localStorage.getItem('figlo-streak'))||0,bestStreak:Number(localStorage.getItem('figlo-best-streak'))||Number(localStorage.getItem('figlo-streak'))||0,completedDays:Number(localStorage.getItem('figlo-active-days'))||0,completedGames:Number(localStorage.getItem('figlo-total-completed'))||Number(localStorage.getItem('figlo-crowns-completed-count'))||0,lastCompletedDate:localStorage.getItem('figlo-last-play-date')||null},daily:{date:today,requiredGames:['korony'],completedGames:completed?['korony']:[]},games:{korony:{bestTimeMs:Number(localStorage.getItem('figlo-crowns-best-ms'))||null,completedCount:Number(localStorage.getItem('figlo-crowns-completed-count'))||0,totalTimeMs:Number(localStorage.getItem('figlo-crowns-total-ms'))||0}},settings:{autoX:localStorage.getItem('figlo-auto-x')==='1'},history:{completedDates:[]}}}
function loadState(){let state;try{state=JSON.parse(localStorage.getItem(STORAGE_KEY))}catch{}if(!state||state.version!==2)state=migrateLegacy();const today=localDateKey();if(state.daily?.date!==today)state.daily={date:today,requiredGames:['korony'],completedGames:[]};state.history=state.history||{completedDates:[]};state.games=state.games||{};state.games.korony=state.games.korony||{bestTimeMs:null,completedCount:0,totalTimeMs:0};state.settings=state.settings||{autoX:false};localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return state}
const state=loadState();
const today=localDateKey();
const dailyDone=state.daily.requiredGames.every(id=>state.daily.completedGames.includes(id));
const completedCount=state.daily.completedGames.length;
const requiredCount=state.daily.requiredGames.length;
const dateText=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
$('#todayDate').textContent=dateText.charAt(0).toUpperCase()+dateText.slice(1);
$('#progressRing').textContent=`${completedCount}/${requiredCount}`;
$('#progressRingVisual').style.background=`conic-gradient(var(--purple) 0 ${(completedCount/requiredCount)*100}%,var(--purple-light) ${(completedCount/requiredCount)*100}% 100%)`;
$('#streakValue').textContent=`${state.user.streak} ${state.user.streak===1?'dzień':'dni'}`;
$('#cardStreak').textContent=`${state.user.streak} ${state.user.streak===1?'dzień':'dni'}`;
$('#statStreak').textContent=state.user.streak;
$('#bestStreak').textContent=`Najlepsza: ${state.user.bestStreak}`;
$('#activeDays').textContent=state.user.completedDays;
$('#totalCompleted').textContent=state.user.completedGames;
const k=state.games.korony;
$('#averageTime').textContent=k.completedCount&&k.totalTimeMs?fmt(k.totalTimeMs/k.completedCount):fmt(k.bestTimeMs);
if(dailyDone){$('#crownsStatus').textContent='Ukończone';$('#dailyStatusTitle').textContent='Dzisiejszy zestaw gotowy';$('#dailyStatusText').textContent='Świetnie. Wróć jutro po kolejne Figlo.';$('#crownsCard').setAttribute('aria-label','Korony ukończone dzisiaj. Zagraj ponownie')}
const week=$('#weekStrip');
const labels=['P','W','Ś','C','P','S','N'];
const now=new Date();const monday=new Date(now);const jsDay=(now.getDay()+6)%7;monday.setDate(now.getDate()-jsDay);monday.setHours(12,0,0,0);
for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=localDateKey(d);const item=document.createElement('div');item.className='week-day';if(key===today)item.classList.add('today');const completed=state.history.completedDates.includes(key)||(key===today&&dailyDone);if(completed)item.classList.add('completed');const label=document.createElement('span');label.className='week-day-label';label.textContent=labels[i];const dot=document.createElement('span');dot.className='week-day-state';dot.textContent=completed?'✓':key===today?'•':'·';item.append(label,dot);week.appendChild(item)}
const menu=$('.menu');menu?.addEventListener('click',()=>{const nav=document.querySelector('nav');const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('nav-open',!open)});