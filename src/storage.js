import { dayDifference, currentDateKey } from './daily.js';
import { requiredGamesForDate } from './daily-games.js';
import { awardDailyGame, createRewardsState, getBadges, migrateRewardsScoring, LOCAL_SCORING_VERSION } from './domain/rewards.js';
import { createCompletionEvent, puzzleIdFor } from './domain/completion.js';

export const STORAGE_KEY = 'figlo_user_state_v2';

function defaultCrownSession() { return { date: null, seed: null, crowns: [], manualXs: [], history: [], elapsedMs: 0, runningSince: null, finished: false, hintsUsed: 0, resets: 0, attemptNo: 1 }; }
function defaultDuetSession() { return { date: null, seed: null, board: [], history: [], elapsedMs: 0, runningSince: null, finished: false, hintsUsed: 0, resets: 0, attemptNo: 1 }; }
function defaultGameStats() { return { bestTimeMs: null, completedCount: 0, totalTimeMs: 0, timedCompletions: 0, lastCompletedDate: null }; }

function defaultState(today = currentDateKey()) {
  return {
    version: 2,
    days: {},
    puzzleResults: {},
    user: { streak: 0, bestStreak: 0, completedDays: 0, completedGames: 0, lastCompletedDate: null, completedDates: [], activeDates: [], activeStreak: 0, bestActiveStreak: 0, lastActiveDate: null },
    daily: { date: today, requiredGames: requiredGamesForDate(today), completedGames: [] },
    games: { korony: defaultGameStats(), duet: defaultGameStats(), bloki: defaultGameStats(), latarnie: defaultGameStats(), memory: defaultGameStats(), zip: defaultGameStats(), sudoku: defaultGameStats() },
    settings: { autoX: false },
    rewards: createRewardsState(),
    sessions: { korony: defaultCrownSession(), duet: defaultDuetSession() }
  };
}

const safeNumber = (value, fallback = 0) => { if (value === null || value === undefined || value === '') return fallback; const number = Number(value); return Number.isFinite(number) ? number : fallback; };

function migrateLegacyState(today) {
  const localStorage = { getItem(key) { try { return storageHandle()?.getItem(key) ?? null; } catch { return null; } } };
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
  if (legacyLastDay) { state.user.completedDates = [legacyLastDay]; state.user.activeDates = [legacyLastDay]; state.user.activeStreak = legacyStreak; state.user.bestActiveStreak = legacyBestStreak; state.user.lastActiveDate = legacyLastDay; }
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
    user: { ...fallback.user, ...(raw.user || {}), completedDates: Array.isArray(raw.user?.completedDates) ? raw.user.completedDates : legacyHistoryDates, activeDates: Array.isArray(raw.user?.activeDates) ? raw.user.activeDates : (Array.isArray(raw.user?.completedDates) ? raw.user.completedDates : legacyHistoryDates), activeStreak: Number.isFinite(raw.user?.activeStreak) ? raw.user.activeStreak : (raw.user?.streak || 0), bestActiveStreak: Number.isFinite(raw.user?.bestActiveStreak) ? raw.user.bestActiveStreak : (raw.user?.bestStreak || 0), lastActiveDate: raw.user?.lastActiveDate || raw.user?.lastCompletedDate || null },
    daily: { ...fallback.daily, ...(raw.daily || {}) },
    games: {
      ...fallback.games,
      ...(raw.games || {}),
      korony: { ...fallback.games.korony, ...(raw.games?.korony || {}) },
      duet: { ...fallback.games.duet, ...(raw.games?.duet || {}) },
      bloki: { ...fallback.games.bloki, ...(raw.games?.bloki || {}) },
      latarnie: { ...fallback.games.latarnie, ...(raw.games?.latarnie || {}) },
      memory: { ...fallback.games.memory, ...(raw.games?.memory || {}) },
      zip: { ...fallback.games.zip, ...(raw.games?.zip || {}) },
      sudoku: { ...fallback.games.sudoku, ...(raw.games?.sudoku || {}) }
    },
    settings: { ...fallback.settings, ...(raw.settings || {}) },
    rewards: { ...createRewardsState(), ...(raw.rewards || {}), daily: { ...(raw.rewards?.daily && typeof raw.rewards.daily === 'object' && !Array.isArray(raw.rewards.daily) ? raw.rewards.daily : {}) }, hintCounts: { ...(raw.rewards?.hintCounts && typeof raw.rewards.hintCounts === 'object' && !Array.isArray(raw.rewards.hintCounts) ? raw.rewards.hintCounts : {}) } },
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
  if (!Array.isArray(state.user.activeDates)) state.user.activeDates = [...state.user.completedDates];
  if (!Array.isArray(state.sessions.korony.crowns)) state.sessions.korony.crowns = [];
  if (!Array.isArray(state.sessions.korony.manualXs)) state.sessions.korony.manualXs = [];
  if (!Array.isArray(state.sessions.korony.history)) state.sessions.korony.history = [];
  state.sessions.korony.elapsedMs = safeNumber(state.sessions.korony.elapsedMs);
  state.sessions.korony.runningSince = Number.isFinite(Number(state.sessions.korony.runningSince)) ? Number(state.sessions.korony.runningSince) : null;
  if (!Array.isArray(state.sessions.duet.board)) state.sessions.duet.board = [];
  if (!Array.isArray(state.sessions.duet.history)) state.sessions.duet.history = [];
  state.sessions.duet.elapsedMs = safeNumber(state.sessions.duet.elapsedMs);
  state.sessions.duet.runningSince = Number.isFinite(Number(state.sessions.duet.runningSince)) ? Number(state.sessions.duet.runningSince) : null;
  for (const gameId of ['korony', 'duet', 'bloki', 'latarnie', 'memory', 'zip', 'sudoku']) {
    state.games[gameId].completedCount = safeNumber(state.games[gameId].completedCount);
    state.games[gameId].totalTimeMs = safeNumber(state.games[gameId].totalTimeMs);
    state.games[gameId].timedCompletions = safeNumber(state.games[gameId].timedCompletions);
    if (!state.games[gameId].timedCompletions && state.games[gameId].totalTimeMs > 0) state.games[gameId].timedCompletions = Math.max(1, state.games[gameId].completedCount);
  }
  delete state.history;
  return state;
}

// Root daily/sessions stay compatible with existing clients. The per-date maps
// keep old tabs from rolling the persisted state backwards or losing results.
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const count = value => Math.max(0, Math.floor(safeNumber(value)));
const uniqueDates = values => [...new Set(values)].filter(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
const snapshots = new WeakMap();
const saveOutcomes = new WeakMap();
let memoryRaw = null, memoryStore, memoryPending = false, warnedStorage = false;

function storageHandle() {
  let handle;
  try { handle = globalThis.localStorage; } catch { handle = undefined; }
  if (handle !== memoryStore) { memoryStore = handle; memoryRaw = null; memoryPending = false; warnedStorage = false; }
  return handle;
}
function reportStorage(error) {
  if (warnedStorage) return;
  warnedStorage = true;
  console.warn('Zapis PUZLI jest niedostępny. Postęp pozostaje w pamięci tej karty.', error);
}
function normalizeSession(raw, gameId) {
  const session = { ...(gameId === 'korony' ? defaultCrownSession() : defaultDuetSession()), ...(raw || {}) };
  for (const key of gameId === 'korony' ? ['crowns','manualXs','history'] : ['board','history']) if (!Array.isArray(session[key])) session[key] = [];
  session.elapsedMs = Math.max(0, safeNumber(session.elapsedMs));
  // Persisted timestamps never charge the player for time outside the game.
  session.runningSince = null;
  session.hintsUsed = count(session.hintsUsed);
  session.resets = count(session.resets);
  session.attemptNo = Math.max(1, count(session.attemptNo));
  return session;
}
function defaultDay() { return { completedGames: [], sessions: { korony: defaultCrownSession(), duet: defaultDuetSession() }, hintCounts: {} }; }
function normalizeCanonical(raw, today) {
  const state = normalizeState(raw, today);
  state.days = {};
  state.puzzleResults = { ...(raw?.puzzleResults || {}) };
  // Old saved browser points used a different 100/120/80 scale. Convert on
  // every read of a legacy snapshot before the weekly rankings are calculated.
  if (raw?.rewards?.scoringVersion !== LOCAL_SCORING_VERSION) state.rewards.scoringVersion = 0;
  migrateRewardsScoring(state.rewards, state.puzzleResults);
  for (const [date, day] of Object.entries(raw?.days || {})) {
    state.days[date] = {
      completedGames: [...new Set((Array.isArray(day.completedGames) ? day.completedGames : []).filter(id => requiredGamesForDate(date).includes(id)))],
      sessions: { korony: normalizeSession(day.sessions?.korony, 'korony'), duet: normalizeSession(day.sessions?.duet, 'duet') },
      hintCounts: { ...(day.hintCounts || {}) }
    };
  }
  const date = state.daily.date || today;
  const day = state.days[date] ||= defaultDay();
  day.completedGames = [...new Set([...day.completedGames, ...state.daily.completedGames])];
  for (const id of ['korony','duet']) if (raw?.sessions?.[id]?.date === date) day.sessions[id] = normalizeSession(raw.sessions[id], id);
  if (state.rewards.hintDate) {
    const hintDay = state.days[state.rewards.hintDate] ||= defaultDay();
    for (const [id, hints] of Object.entries(state.rewards.hintCounts)) hintDay.hintCounts[id] = Math.max(count(hints), count(hintDay.hintCounts[id]));
  }
  // Legacy reward records and historical complete sets are completion evidence.
  for (const [rewardDate, reward] of Object.entries(state.rewards.daily)) {
    const rewardDay = state.days[rewardDate] ||= defaultDay();
    rewardDay.completedGames = [...new Set([...rewardDay.completedGames, ...Object.keys(reward.games || {})])].filter(id => requiredGamesForDate(rewardDate).includes(id));
  }
  for (const completedDate of state.user.completedDates) if (!state.days[completedDate]) state.days[completedDate] = { ...defaultDay(), completedGames: requiredGamesForDate(completedDate) };
  for (const result of Object.values(state.puzzleResults)) {
    if (!result?.date || result.mode !== 'daily') continue;
    const resultDay = state.days[result.date] ||= defaultDay();
    if (requiredGamesForDate(result.date).includes(result.gameId) && !resultDay.completedGames.includes(result.gameId)) resultDay.completedGames.push(result.gameId);
  }
  for (const [id, game] of Object.entries(state.games)) {
    if (!game.lastCompletedDate) continue;
    const completedDay = state.days[game.lastCompletedDate] ||= defaultDay();
    if (requiredGamesForDate(game.lastCompletedDate).includes(id) && !completedDay.completedGames.includes(id)) completedDay.completedGames.push(id);
  }
  state.daily = { date, requiredGames: requiredGamesForDate(date), completedGames: [...day.completedGames] };
  state.sessions = clone(day.sessions);
  return state;
}
function readCanonical(today) {
  const handle = storageHandle();
  let raw;
  try { raw = handle?.getItem(STORAGE_KEY) ?? null; if (memoryPending && memoryRaw) raw = memoryRaw; }
  catch (error) { reportStorage(error); raw = memoryRaw; }
  if (!raw) {
    const migrated = normalizeCanonical(migrateLegacyState(today), today);
    memoryRaw = JSON.stringify(migrated);
    return migrated;
  }
  try { const state = normalizeCanonical(JSON.parse(raw), today); memoryRaw = JSON.stringify(state); return state; }
  catch (error) {
    reportStorage(error);
    // Keep the last readable state when this tab already has one. A damaged
    // disk value must not erase a completed game during the next session save.
    const fallback = memoryRaw ? normalizeCanonical(JSON.parse(memoryRaw), today) : normalizeCanonical(defaultState(today), today);
    memoryRaw = JSON.stringify(fallback);
    memoryPending = true;
    return fallback;
  }
}
function viewForDate(canonical, today) {
  const state = clone(canonical);
  const day = state.days[today] || defaultDay();
  state.daily = { date: today, requiredGames: requiredGamesForDate(today), completedGames: [...day.completedGames] };
  state.sessions = clone(day.sessions || defaultDay().sessions);
  state.rewards.hintDate = today;
  state.rewards.hintCounts = { ...day.hintCounts };
  return state;
}
export function loadFigloState(today = currentDateKey()) {
  // This read is deliberately side-effect free, including after midnight.
  const state = viewForDate(readCanonical(today), today);
  snapshots.set(state, clone(state));
  return state;
}
function applyChanges(latest, incoming, baseline) {
  if (equal(incoming, baseline)) return clone(latest);
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return clone(incoming);
  const result = { ...(latest || {}) };
  for (const [key, value] of Object.entries(incoming)) if (!equal(value, baseline?.[key])) result[key] = applyChanges(latest?.[key], value, baseline?.[key]);
  return result;
}
export function saveFigloState(state) {
  const date = state.daily.date, latest = readCanonical(date), baseline = snapshots.get(state), merged = clone(latest);
  const pendingResults = Object.values(state.puzzleResults || {}).filter(result => result?.mode === 'daily' && !baseline?.puzzleResults?.[result.puzzleId]);
  // Reapply new completion events to the newest ledger. Snapshot counters can
  // neither sum independent completions nor distinguish duplicate submissions.
  for (const key of pendingResults.length ? ['settings'] : ['user','games','settings','rewards']) merged[key] = applyChanges(latest[key], state[key], baseline?.[key]);
  merged.puzzleResults = { ...(pendingResults.length ? baseline?.puzzleResults : state.puzzleResults), ...latest.puzzleResults };
  const outcomes = new Map();
  for (const result of pendingResults) outcomes.set(result.eventId, applyDailyResult(merged, result));
  saveOutcomes.set(state, outcomes);
  // Stale settings/session snapshots cannot lower aggregates or rewind dates.
  for (const key of ['completedGames','completedDays','bestStreak','bestActiveStreak']) merged.user[key] = Math.max(count(latest.user[key]), count(merged.user[key]));
  for (const key of ['completedDates','activeDates']) merged.user[key] = uniqueDates([...(latest.user[key] || []), ...(state.user[key] || [])]);
  for (const key of ['lastCompletedDate','lastActiveDate']) merged.user[key] = uniqueDates([latest.user[key], merged.user[key]]).at(-1) || null;
  if (!pendingResults.length) for (const [lastKey, streakKey] of [['lastCompletedDate','streak'],['lastActiveDate','activeStreak']]) if (latest.user[lastKey] && latest.user[lastKey] > (state.user[lastKey] || '')) merged.user[streakKey] = latest.user[streakKey];
  for (const id of Object.keys(merged.games)) {
    for (const key of ['completedCount','totalTimeMs','timedCompletions']) merged.games[id][key] = Math.max(count(latest.games[id]?.[key]), count(merged.games[id][key]));
    merged.games[id].lastCompletedDate = uniqueDates([latest.games[id]?.lastCompletedDate, merged.games[id].lastCompletedDate]).at(-1) || null;
    const times = [latest.games[id]?.bestTimeMs, merged.games[id].bestTimeMs].filter(time => Number.isFinite(time) && time > 0);
    merged.games[id].bestTimeMs = times.length ? Math.min(...times) : null;
  }
  for (const key of ['totalPoints','cleanGames','cleanSets']) merged.rewards[key] = Math.max(count(latest.rewards[key]), count(merged.rewards[key]));
  merged.rewards.daily = { ...latest.rewards.daily, ...merged.rewards.daily };
  const rewardDates = Object.keys(merged.rewards.daily).sort();
  for (const oldDate of rewardDates.slice(0, Math.max(0, rewardDates.length - 400))) delete merged.rewards.daily[oldDate];
  const day = merged.days[date] ||= defaultDay();
  day.completedGames = [...new Set([...day.completedGames, ...state.daily.completedGames])];
  for (const id of ['korony','duet']) if (!baseline || !equal(state.sessions[id], baseline.sessions[id])) day.sessions[id] = normalizeSession(state.sessions[id], id);
  for (const [id, hints] of Object.entries(state.rewards.hintCounts || {})) day.hintCounts[id] = Math.max(count(hints), count(day.hintCounts[id]));
  const latestDate = [latest.daily.date, date].sort().at(-1), rootDay = merged.days[latestDate] ||= defaultDay();
  merged.daily = { date: latestDate, requiredGames: requiredGamesForDate(latestDate), completedGames: [...rootDay.completedGames] };
  merged.sessions = clone(rootDay.sessions);
  merged.rewards.hintDate = latestDate;
  merged.rewards.hintCounts = { ...rootDay.hintCounts };
  // Board histories are much heavier than the permanent completion ledger.
  // Retain two weeks of resumable sessions, including the canonical latest day.
  for (const [savedDate, savedDay] of Object.entries(merged.days)) if (dayDifference(savedDate, latestDate) >= 14) delete savedDay.sessions;
  const handle = storageHandle();
  memoryRaw = JSON.stringify(merged);
  Object.assign(state, viewForDate(merged, date));
  snapshots.set(state, clone(state));
  try {
    if (!handle) throw new Error('localStorage is unavailable');
    handle.setItem(STORAGE_KEY, memoryRaw);
    memoryPending = false;
    return true;
  } catch (error) { memoryPending = true; reportStorage(error); return false; }
}
export function isTodayComplete(state) { return state.daily.requiredGames.every(gameId => state.daily.completedGames.includes(gameId)); }
function addActivityDate(user, date, fullSet = false) {
  const datesKey = fullSet ? 'completedDates' : 'activeDates', lastKey = fullSet ? 'lastCompletedDate' : 'lastActiveDate', streakKey = fullSet ? 'streak' : 'activeStreak', bestKey = fullSet ? 'bestStreak' : 'bestActiveStreak';
  if (user[datesKey].includes(date) || user[lastKey] === date) return false;
  const previousLast = user[lastKey];
  user[datesKey] = uniqueDates([...user[datesKey], date]);
  if (!previousLast || date > previousLast) { user[streakKey] = dayDifference(previousLast, date) === 1 ? user[streakKey] + 1 : 1; user[lastKey] = date; }
  let run = 0, best = 0, previous = null;
  for (const activeDate of user[datesKey]) { run = dayDifference(previous, activeDate) === 1 ? run + 1 : 1; best = Math.max(best, run); previous = activeDate; }
  if (previous === user[lastKey]) user[streakKey] = Math.max(user[streakKey], run);
  user[bestKey] = Math.max(user[bestKey], user[streakKey], best);
  return true;
}
function applyDailyResult(state, result) {
  const { gameId, date: today, puzzleId: id, elapsedMs: timeMs } = result;
  const day = state.days[today] ||= defaultDay();
  if (day.completedGames.includes(gameId) || state.puzzleResults[id]) return { firstGameCompletionToday: false, firstDayCompletionToday: false };
  const recordedHints = day.hintCounts[gameId];
  const knownHints = Number.isFinite(result.hintsUsed) || Number.isFinite(recordedHints) ? Math.max(count(recordedHints), count(result.hintsUsed)) : null;
  state.puzzleResults[id] = { ...result, hintsUsed: knownHints };
  state.daily = { date: today, requiredGames: requiredGamesForDate(today), completedGames: day.completedGames };
  const gameState = state.games[gameId];
  if (Number.isFinite(timeMs) && timeMs > 0 && (!gameState.bestTimeMs || timeMs < gameState.bestTimeMs)) gameState.bestTimeMs = timeMs;
  const wasDayComplete = isTodayComplete(state), oldBadges = new Set(getBadges(state).filter(b => b.earned).map(b => b.id));
  state.daily.completedGames.push(gameId);
  gameState.completedCount += 1;
  gameState.lastCompletedDate = uniqueDates([gameState.lastCompletedDate, today]).at(-1);
  if (Number.isFinite(timeMs) && timeMs > 0) { gameState.totalTimeMs += timeMs; gameState.timedCompletions += 1; }
  state.user.completedGames += 1;
  addActivityDate(state.user, today);
  const dayIsNowComplete = isTodayComplete(state);
  const setAlreadyRecorded = state.user.completedDates.includes(today) || state.user.lastCompletedDate === today;
  awardDailyGame(state, { date: today, gameId, hintsUsed: knownHints, elapsedMs: timeMs, completeSet: dayIsNowComplete && !setAlreadyRecorded });
  let firstDayCompletionToday = false;
  if (!wasDayComplete && dayIsNowComplete && addActivityDate(state.user, today, true)) { firstDayCompletionToday = true; state.user.completedDays += 1; }
  state.rewards.lastAward = { date: today, gameId, badges: getBadges(state).filter(b => b.earned && !oldBadges.has(b.id)).map(b => b.id) };
  return { firstGameCompletionToday: true, firstDayCompletionToday };
}
export function completeDailyGame(gameId, { timeMs = null, hintsUsed = 0, resets = null, attemptNo = null, puzzleId = null, event = null, today = currentDateKey() } = {}) {
  const state = loadFigloState(today);
  if (!state.games[gameId]) throw new Error(`Nieznana gra: ${gameId}`);
  if (!state.daily.requiredGames.includes(gameId)) throw new Error(`Gra ${gameId} nie należy do zestawu na ${today}`);
  const id = puzzleId || puzzleIdFor(gameId, today);
  if (state.daily.completedGames.includes(gameId) || state.puzzleResults[id]) return { state, firstGameCompletionToday: false, firstDayCompletionToday: false };
  const completion = createCompletionEvent({ ...(event || {}), gameId, puzzleId: id, date: today, elapsedMs: timeMs, hintsUsed, resets, attemptNo });
  const initialOutcome = applyDailyResult(state, completion);
  saveFigloState(state);
  return { state, ...(saveOutcomes.get(state)?.get(completion.eventId) || initialOutcome) };
}
export function recordDailyHint(gameId, today = currentDateKey()) {
  const state = loadFigloState(today);
  if (!state.daily.requiredGames.includes(gameId) || state.daily.completedGames.includes(gameId)) return false;
  state.rewards.hintDate = today;
  state.rewards.hintCounts[gameId] = Math.min(999, count(state.rewards.hintCounts[gameId]) + 1);
  saveFigloState(state);
  return true;
}
export function updateFigloSettings(patch) { const state = loadFigloState(); state.settings = { ...state.settings, ...patch }; saveFigloState(state); return state; }
export function getGameAverageTime(state, gameId) { const game = state.games[gameId]; if (!game || !game.timedCompletions) return null; return Math.round(game.totalTimeMs / game.timedCompletions); }
export function getOverallAverageTime(state) { let total = 0, totalCount = 0; for (const game of Object.values(state.games || {})) { total += safeNumber(game.totalTimeMs); totalCount += safeNumber(game.timedCompletions); } return totalCount ? Math.round(total / totalCount) : null; }
export function getCrownSession({ today = currentDateKey(), seed } = {}) { const session = loadFigloState(today).sessions.korony; return session.date === today && session.seed === seed ? session : null; }
function snapshotSession(session, gameId, today) {
  const elapsedMs = Math.max(0, safeNumber(session.elapsedMs)) + (Number.isFinite(session.runningSince) ? Math.max(0, Date.now() - session.runningSince) : 0);
  return clone(normalizeSession({ ...session, date: today, elapsedMs }, gameId));
}
export function saveCrownSession(session, today = currentDateKey()) { const state = loadFigloState(today); state.sessions.korony = snapshotSession(session, 'korony', today); saveFigloState(state); return state.sessions.korony; }
export function clearCrownSession(today = currentDateKey()) { const state = loadFigloState(today); state.sessions.korony = defaultCrownSession(); saveFigloState(state); }
export function getDuetSession({ today = currentDateKey(), seed } = {}) { const session = loadFigloState(today).sessions.duet; return session.date === today && session.seed === seed ? session : null; }
export function saveDuetSession(session, today = currentDateKey()) { const state = loadFigloState(today); state.sessions.duet = snapshotSession(session, 'duet', today); saveFigloState(state); return state.sessions.duet; }
export function clearDuetSession(today = currentDateKey()) { const state = loadFigloState(today); state.sessions.duet = defaultDuetSession(); saveFigloState(state); }
