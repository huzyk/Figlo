import { dayDifference, localDateKey } from './daily.js';

export const STORAGE_KEY = 'figlo_user_state_v2';
const DEFAULT_REQUIRED_GAMES = ['korony'];

function defaultState(today = localDateKey()) {
  return {
    version: 2,
    user: {
      streak: 0,
      bestStreak: 0,
      completedDays: 0,
      completedGames: 0,
      lastCompletedDate: null,
      completedDates: []
    },
    daily: {
      date: today,
      requiredGames: [...DEFAULT_REQUIRED_GAMES],
      completedGames: []
    },
    games: {
      korony: {
        bestTimeMs: null,
        completedCount: 0,
        totalTimeMs: 0,
        timedCompletions: 0,
        lastCompletedDate: null
      }
    },
    settings: {
      autoX: false
    }
  };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function migrateLegacyState(today) {
  const state = defaultState(today);
  const legacyStreak = safeNumber(localStorage.getItem('figlo-streak'));
  const legacyBestStreak = safeNumber(localStorage.getItem('figlo-best-streak'), legacyStreak);
  const legacyActiveDays = safeNumber(localStorage.getItem('figlo-active-days'), legacyStreak);
  const legacyCompleted = safeNumber(
    localStorage.getItem('figlo-total-completed'),
    safeNumber(localStorage.getItem('figlo-crowns-completed-count'))
  );
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
    user: {
      ...fallback.user,
      ...(raw.user || {}),
      completedDates: Array.isArray(raw.user?.completedDates)
        ? raw.user.completedDates
        : legacyHistoryDates
    },
    daily: {
      ...fallback.daily,
      ...(raw.daily || {})
    },
    games: {
      ...fallback.games,
      ...(raw.games || {}),
      korony: {
        ...fallback.games.korony,
        ...(raw.games?.korony || {})
      }
    },
    settings: {
      ...fallback.settings,
      ...(raw.settings || {})
    }
  };

  if (!Array.isArray(state.daily.requiredGames)) state.daily.requiredGames = [...DEFAULT_REQUIRED_GAMES];
  if (!Array.isArray(state.daily.completedGames)) state.daily.completedGames = [];
  if (!Array.isArray(state.user.completedDates)) state.user.completedDates = [];
  delete state.history;
  return state;
}

function rollDailyState(state, today) {
  if (state.daily.date === today) return state;
  return {
    ...state,
    daily: {
      date: today,
      requiredGames: [...DEFAULT_REQUIRED_GAMES],
      completedGames: []
    }
  };
}

export function loadFigloState(today = localDateKey()) {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isTodayComplete(state) {
  return state.daily.requiredGames.every(gameId => state.daily.completedGames.includes(gameId));
}

export function completeDailyGame(gameId, { timeMs = null, today = localDateKey() } = {}) {
  const state = loadFigloState(today);
  const gameState = state.games[gameId];
  if (!gameState) throw new Error(`Nieznana gra: ${gameId}`);

  if (Number.isFinite(timeMs) && timeMs > 0 && (!gameState.bestTimeMs || timeMs < gameState.bestTimeMs)) {
    gameState.bestTimeMs = timeMs;
  }

  const alreadyCompletedToday = state.daily.completedGames.includes(gameId);
  if (alreadyCompletedToday) {
    saveFigloState(state);
    return { state, firstGameCompletionToday: false, firstDayCompletionToday: false };
  }

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
