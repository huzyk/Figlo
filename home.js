const $ = selector => document.querySelector(selector);

const storage = {
  get(key, fallback = null) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  },
  number(key, fallback = 0) {
    const value = Number(this.get(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  }
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMs(ms) {
  if (!ms) return '—';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const today = localDateKey();
const completedToday = storage.get('figlo-crowns-completed-date') === today;
const streak = storage.number('figlo-streak');
const bestMs = storage.number('figlo-crowns-best-ms');
const completedCount = storage.number('figlo-crowns-completed-count');

$('#todayProgress').textContent = `${completedToday ? 1 : 0} / 1`;
$('#completedGames').textContent = String(completedCount);
$('#bestTime').textContent = formatMs(bestMs);

if (streak > 0) {
  $('#streakValue').textContent = String(streak);
  $('#streakPill').setAttribute('aria-label', `Seria ${streak} ${streak === 1 ? 'dnia' : 'dni'}`);
  $('#streakCard').textContent = `🔥 ${streak} ${streak === 1 ? 'dzień' : 'dni'}`;
  $('#streakLabel').textContent = 'aktualna seria';
}

if (completedToday) {
  $('#crownsStatus').textContent = '✓ Ukończone';
  $('#crownsStatus').classList.add('today-badge--done');
  $('#playCrowns').textContent = 'Zagraj ponownie';
  $('#playCrowns').setAttribute('aria-label', 'Zagraj ponownie w Korony');
  if (bestMs > 0) {
    $('#featuredBest').textContent = formatMs(bestMs);
    $('#featuredResult').hidden = false;
  }
}
