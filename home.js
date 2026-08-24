import { currentDateKey, dateFromKey, getWeekDateKeys } from './src/daily.js';
import { getGameAverageTime, isTodayComplete, loadFigloState } from './src/storage.js';

const $ = selector => document.querySelector(selector);
const today = currentDateKey();
const todayDate = dateFromKey(today) || new Date();
const state = loadFigloState(today);
const dailyDone = isTodayComplete(state);
const completedCount = state.daily.completedGames.length;
const requiredCount = state.daily.requiredGames.length;

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function streakLabel(value) {
  return value === 1 ? '1 dzień' : `${value} dni`;
}

function renderDate() {
  const formatted = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(todayDate);
  $('#todayDate').textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function renderDailyProgress() {
  $('#progressRing').textContent = `${completedCount}/${requiredCount}`;
  const percent = requiredCount > 0 ? completedCount / requiredCount : 0;
  $('#progressRingVisual').style.background = `conic-gradient(var(--purple) 0 ${percent * 100}%, var(--purple-light) ${percent * 100}% 100%)`;

  if (dailyDone) {
    $('#dailyStatusTitle').textContent = 'Dzisiejsze Figlo zrobione';
    $('#dailyStatusText').textContent = 'Świetna robota. Wróć jutro po nowe wyzwanie.';
    $('#crownsStatus').textContent = 'Zagraj ponownie';
    $('#crownsCard').classList.add('completed');
    $('#crownsCard').setAttribute('aria-label', 'Korony ukończone dzisiaj. Zagraj ponownie');
  } else {
    $('#dailyStatusTitle').textContent = 'Korony czekają';
    $('#dailyStatusText').textContent = 'Ukończ aktywną grę, żeby zaliczyć dzisiejszy dzień.';
  }
}

function renderStats() {
  const averageTime = getGameAverageTime(state, 'korony');
  $('#streakValue').textContent = streakLabel(state.user.streak);
  $('#cardStreak').textContent = streakLabel(state.user.streak);
  $('#statStreak').textContent = String(state.user.streak);
  $('#bestStreak').textContent = `Najlepsza: ${state.user.bestStreak}`;
  $('#activeDays').textContent = String(state.user.completedDays);
  $('#totalCompleted').textContent = String(state.user.completedGames);
  $('#averageTime').textContent = formatDuration(averageTime);
}

function renderWeek() {
  const root = $('#weekStrip');
  const labels = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];
  const dates = getWeekDateKeys(todayDate);
  root.innerHTML = '';

  dates.forEach((dateKey, index) => {
    const item = document.createElement('div');
    item.className = 'week-day';
    const isToday = dateKey === today;
    const isCompleted = state.user.completedDates.includes(dateKey);
    if (isToday) item.classList.add('today');
    if (isCompleted) item.classList.add('completed');
    if (isToday) item.setAttribute('aria-current', 'date');

    const label = document.createElement('span');
    label.className = 'week-day-label';
    label.textContent = labels[index];

    const dot = document.createElement('span');
    dot.className = 'week-day-state';
    dot.textContent = isCompleted ? '✓' : isToday ? '•' : '·';

    item.setAttribute('aria-label', `${labels[index]}${isCompleted ? ', ukończony' : ''}${isToday ? ', dzisiaj' : ''}`);
    item.append(label, dot);
    root.appendChild(item);
  });
}

function renderGamesSummary() {
  const available = state.daily.requiredGames.length;
  $('#gamesSummary').textContent = available === 1
    ? '1 gra dostępna. Kolejne Figlo już powstają.'
    : `${available} gry dostępne dzisiaj.`;
}

function wireMobileMenu() {
  const menu = $('.menu');
  menu?.addEventListener('click', () => {
    const nav = document.querySelector('nav');
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('nav-open', !open);
  });
}

renderDate();
renderDailyProgress();
renderStats();
renderWeek();
renderGamesSummary();
wireMobileMenu();
