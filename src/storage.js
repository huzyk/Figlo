import { dayDifference, currentDateKey } from './daily.js';
import { requiredGamesForDate } from './daily-games.js';

export const STORAGE_KEY = 'figlo_user_state_v2';

function defaultCrownSession() {
  return { date: null, seed: null, crowns: [], manualXs: [], history: [], elapsedMs: 0, runningSince: null, finished: false };
}

function defaultDuetSession() {
  return { date: null, seed: null, board: [], history: [], elapsedMs: 0, runningSince: null, finished: false };
}

function defaultGameStats() {
  return { bestTimeMs: null, completedCount: 0, totalTimeMs: 0, timedCompletions: 0, lastCompletedDate: null };
}

function defaultState(today = currentDateKey()) {
  return {
    version: 2,
    user: { streak: 0, bestStreak: 0, completedDays: 0, completedGames: 0, lastCompletedDate: null, completedDates: [] },
    daily: { date: today, requiredGames: requiredGamesForDate(today), completedGames: [] },
    games: { korony: defaultGameStats(), duet: defaultGameStats(), bloki: defaultGameStats() },
    settings: { autoX: false },
    sessions: { korony: defaultCrownSession(), duet: defaultDuetSession() }
  };
}

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function migrateLegacyState(today) {
  const state = defaultState(today);
  const legacyStreak = safeNumber(localStorage.getItem('figlo-streak'));
  const legacyBestStreak = safeNumber(localStorage.getItem('figlo-best-streak'), legacyStreak);
  const legacyActiveDays = safeNumber(localStorage.getItem('figlo-active-days'), legacyStreak);
  const legacyCompleted = safeNumber(localStorage.getItem('figlo-total-completed'), safeNumber(localStorage.getItem('figlo-crowns-completed-count')));
  const legacyBestMs = safeNumber(localStorage.getItem('figlo-crowns-best-ms'));
  const legacyLastDay = localStorage.getItem('figlo-last-play-date') || localStorage.getItem('figlo-crowns-completed-date') || null;
  const crownsCompletedToday = localStorage.getItem('figlo-crowns-completed-date') === today;

  state.user.streak = legacyStreak;
  state.user.bestStreak = Math.max(legacyBestStreak, legacyStreak);
  state.user.completedDays = legacyActiveDays;
  state.user.completedGames = legacyCompleted;
  state.user.lastCompletedDate = legacyLastDay;
  if (legacyLastDay) state.user.completedDates = [legacyLastDay];

  state.games.korony.completedCount = safeNumber(localStorage.getItem('figlo-crowns-completed-count'), legacyCompleted);
  state.games.korony.bestTimeMs = legacyBestMs > 0 ? legacyBestMs : null;
  state.games.korony.totalTimeMs = safeNumber(localStorage.getItem('figlo-crowns-total-ms'));
  state.games.korony.timedCompletions = state.games.korony.totalTimeMs > 0 ? Math.max(1, state.games.korony.completedCount) : 0;
  state.games.korony.lastCompletedDate = localStorage.getItem('figlo-crowns-completed-date') || null;
  state.settings.autoX = localStorage.getItem('figlo-auto-x') === '1';
  if (crownsCompletedToday) state.daily.completedGames = ['korony'];
  return state;
}

function normalizeState(raw, today) {
  const fallback = defaultState(today);
  if (!raw || raw.version !== 2) return fallback;
  const legacyHistoryDates = Array.isArray(raw.history?.completedDates) ? raw.history.completedDates : [];
  const state = {
    ...fallback,
    ...raw,
    user: { ...fallback.user, ...(raw.user || {}), completedDates: Array.isArray(raw.user?.completedDates) ? raw.user.completedDates : legacyHistoryDates },
    daily: { ...fallback.daily, ...(raw.daily || {}) },
    games: {
      ...fallback.games,
      ...(raw.games || {}),
      korony: { ...fallback.games.korony, ...(raw.games?.korony || {}) },
      duet: { ...fallback.games.duet, ...(raw.games?.duet || {}) },
      bloki: { ...fallback.games.bloki, ...(raw.games?.bloki || {}) }
    },
    settings: { ...fallback.settings, ...(raw.settings || {}) },
    sessions: {
      ...fallback.sessions,
      ...(raw.sessions || {}),
      korony: { ...fallback.sessions.korony, ...(raw.sessions?.korony || {}) },
      duet: { ...fallback.sessions.duet, ...(raw.sessions?.duet || {}) }
    }
  };

  state.daily.requiredGames = requiredGamesForDate(state.daily.date || today);
  if (!Array.isArray(state.daily.completedGames)) state.daily.completedGames = [];
  state.daily.completedGames = state.daily.completedGames.filter(id => state.daily.requiredGames.includes(id));
  if (!Array.isArray(state.user.completedDates)) state.user.completedDates = [];

  if (!Array.isArray(state.sessions.korony.crowns)) state.sessions.korony.crowns = [];
  if (!Array.isArray(state.sessions.korony.manualXs)) state.sessions.korony.manualXs = [];
  if (!Array.isArray(state.sessions.korony.history)) state.sessions.korony.history = [];
  state.sessions.korony.elapsedMs = safeNumber(state.sessions.korony.elapsedMs);
  state.sessions.korony.runningSince = Number.isFinite(Number(state.sessions.korony.runningSince)) ? Number(state.sessions.korony.runningSince) : null;

  if (!Array.isArray(state.sessions.duet.board)) state.sessions.duet.board = [];
  if (!Array.isArray(state.sessions.duet.history)) state.sessions.duet.history = [];
  state.sessions.duet.elapsedMs = safeNumber(state.sessions.duet.elapsedMs);
  state.sessions.duet.runningSince = Number.isFinite(Number(state.sessions.duet.runningSince)) ? Number(state.sessions.duet.runningSince) : null;

  for (const gameId of ['korony', 'duet', 'bloki']) {
    state.games[gameId].completedCount = safeNumber(state.games[gameId].completedCount);
    state.games[gameId].totalTimeMs = safeNumber(state.games[gameId].totalTimeMs);
    state.games[gameId].timedCompletions = safeNumber(state.games[gameId].timedCompletions);
    if (!state.games[gameId].timedCompletions && state.games[gameId].totalTimeMs > 0) state.games[gameId].timedCompletions = Math.max(1, state.games[gameId].completedCount);
  }
  delete state.history;
  return state;
}

function rollDailyState(state, today) {
  if (state.daily.date === today) {
    state.daily.requiredGames = requiredGamesForDate(today);
    state.daily.completedGames = state.daily.completedGames.filter(id => state.daily.requiredGames.includes(id));
    return state;
  }
  return {
    ...state,
    daily: { date: today, requiredGames: requiredGamesForDate(today), completedGames: [] },
    sessions: { ...state.sessions, korony: defaultCrownSession(), duet: defaultDuetSession() }
  };
}

export function loadFigloState(today = currentDateKey()) {
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state = migrateLegacyState(today);
      saveFigloState(state);
      return state;
    }
    state = normalizeState(JSON.parse(raw), today);
  } catch (error) {
    console.error('Nie udało się odczytać stanu Figlo:', error);
    state = defaultState(today);
  }
  const rolled = rollDailyState(state, today);
  saveFigloState(rolled);
  return rolled;
}

export function saveFigloState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('Nie udało się zapisać stanu Figlo:', error);
    return false;
  }
}

export function isTodayComplete(state) {
  return state.daily.requiredGames.every(gameId => state.daily.completedGames.includes(gameId));
}

export function completeDailyGame(gameId, { timeMs = null, today = currentDateKey() } = {}) {
  const state = loadFigloState(today);
  const gameState = state.games[gameId];
  if (!gameState) throw new Error(`Nieznana gra: ${gameId}`);
  if (!state.daily.requiredGames.includes(gameId)) throw new Error(`Gra ${gameId} nie należy do zestawu na ${today}`);

  const alreadyCompletedToday = state.daily.completedGames.includes(gameId);
  if (alreadyCompletedToday) {
    return { state, firstGameCompletionToday: false, firstDayCompletionToday: false };
  }

  if (Number.isFinite(timeMs) && timeMs > 0 && (!gameState.bestTimeMs || timeMs < gameState.bestTimeMs)) gameState.bestTimeMs = timeMs;

  const wasDayComplete = isTodayComplete(state);
  state.daily.completedGames.push(gameId);
  gameState.completedCount += 1;
  gameState.lastCompletedDate = today;
  if (Number.isFinite(timeMs) && timeMs > 0) {
    gameState.totalTimeMs += timeMs;
    gameState.timedCompletions += 1;
  }
  state.user.completedGames += 1;

  const dayIsNowComplete = isTodayComplete(state);
  let firstDayCompletionToday = false;
  if (!wasDayComplete && dayIsNowComplete) {
    firstDayCompletionToday = true;
    const difference = dayDifference(state.user.lastCompletedDate, today);
    state.user.streak = difference === 1 ? state.user.streak + 1 : 1;
    state.user.bestStreak = Math.max(state.user.bestStreak, state.user.streak);
    state.user.completedDays += 1;
    state.user.lastCompletedDate = today;
    if (!state.user.completedDates.includes(today)) {
      state.user.completedDates.push(today);
      state.user.completedDates = state.user.completedDates.slice(-120);
    }
  }

  saveFigloState(state);
  return { state, firstGameCompletionToday: true, firstDayCompletionToday };
}

export function updateFigloSettings(patch) {
  const state = loadFigloState();
  state.settings = { ...state.settings, ...patch };
  saveFigloState(state);
  return state;
}

export function getGameAverageTime(state, gameId) {
  const game = state.games[gameId];
  if (!game || !game.timedCompletions) return null;
  return Math.round(game.totalTimeMs / game.timedCompletions);
}

export function getOverallAverageTime(state) {
  let total = 0;
  let count = 0;
  for (const game of Object.values(state.games || {})) {
    total += safeNumber(game.totalTimeMs);
    count += safeNumber(game.timedCompletions);
  }
  return count ? Math.round(total / count) : null;
}

export function getCrownSession({ today = currentDateKey(), seed } = {}) {
  const state = loadFigloState(today);
  const session = state.sessions.korony || defaultCrownSession();
  if (session.date !== today || session.seed !== seed) return null;
  return session;
}

export function saveCrownSession(session, today = currentDateKey()) {
  const state = loadFigloState(today);
  state.sessions.korony = {
    ...defaultCrownSession(), ...session, date: session.date || today,
    crowns: [...(session.crowns || [])], manualXs: [...(session.manualXs || [])],
    history: (session.history || []).map(item => ({ crowns: [...(item.crowns || [])], manualXs: [...(item.manualXs || [])] }))
  };
  saveFigloState(state);
  return state.sessions.korony;
}

export function clearCrownSession(today = currentDateKey()) {
  const state = loadFigloState(today);
  state.sessions.korony = defaultCrownSession();
  saveFigloState(state);
}

export function getDuetSession({ today = currentDateKey(), seed } = {}) {
  const state = loadFigloState(today);
  const session = state.sessions.duet || defaultDuetSession();
  if (session.date !== today || session.seed !== seed) return null;
  return session;
}

export function saveDuetSession(session, today = currentDateKey()) {
  const state = loadFigloState(today);
  state.sessions.duet = {
    ...defaultDuetSession(), ...session, date: session.date || today,
    board: [...(session.board || [])],
    history: (session.history || []).map(board => [...board])
  };
  saveFigloState(state);
  return state.sessions.duet;
}

export function clearDuetSession(today = currentDateKey()) {
  const state = loadFigloState(today);
  state.sessions.duet = defaultDuetSession();
  saveFigloState(state);
}