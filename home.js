const $ = selector => document.querySelector(selector);
const number = (key, fallback = 0) => { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) ? value : fallback; };
function localDateKey(date = new Date()) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }

const today = localDateKey();
const availableToday = 1;
const crownsDone = localStorage.getItem('figlo-crowns-completed-date') === today;
const completedToday = crownsDone ? 1 : 0;
const figloStreak = number('figlo-streak');
const activeDays = number('figlo-active-days', figloStreak);
const totalCompleted = number('figlo-total-completed', number('figlo-crowns-completed-count'));

$('#todayProgress').textContent = `${completedToday} / ${availableToday} ukończonych`;
$('#todayProgressBar').style.width = `${(completedToday / availableToday) * 100}%`;
$('#activeDays').textContent = String(activeDays);
$('#totalCompleted').textContent = String(totalCompleted);

if (figloStreak > 0) {
  const streakPill = $('#streakPill');
  streakPill.hidden = false;
  $('#streakValue').textContent = `${figloStreak} ${figloStreak === 1 ? 'dzień' : 'dni'}`;
  streakPill.setAttribute('aria-label', `Seria Figlo: ${figloStreak} ${figloStreak === 1 ? 'dzień' : 'dni'}`);
}

if (crownsDone) {
  $('#crownsStatus').textContent = '✓ Ukończone';
  $('#crownsCard').classList.add('game-card--done');
  $('#crownsCard').setAttribute('aria-label','Korony ukończone dzisiaj. Zagraj ponownie');
}
