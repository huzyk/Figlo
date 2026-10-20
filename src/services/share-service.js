import { dateFromKey } from '../daily.js';
import { getWeekKey } from '../domain/rewards.js';
import { track } from './analytics-service.js';

const NICK_KEY = 'puzli_share_nickname_v1';
const PUBLIC_ID_KEY = 'puzli_share_public_id_v1';
export const GAME_NAMES = { korony: 'Korony', duet: 'Duet', bloki: 'Bloki', latarnie: 'Latarnie', memory: 'Memory', zip: 'Zip', sudoku: 'Sudoku' };
let sessionPublicId;
let sessionNickname;

export function cleanShareName(value) {
  return String(value || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 24);
}
export function sharePublicId() {
  if (sessionPublicId) return sessionPublicId;
  try { sessionPublicId = localStorage.getItem(PUBLIC_ID_KEY); } catch {}
  if (!/^[a-zA-Z0-9-]{10,80}$/.test(sessionPublicId || '')) {
    sessionPublicId = globalThis.crypto?.randomUUID?.() || `share-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem(PUBLIC_ID_KEY, sessionPublicId); } catch {}
  }
  return sessionPublicId;
}
export function shareNickname() {
  if (sessionNickname !== undefined) return sessionNickname;
  try { sessionNickname = cleanShareName(localStorage.getItem(NICK_KEY)); } catch { sessionNickname = ''; }
  return sessionNickname;
}
export function saveShareNickname(value) {
  sessionNickname = cleanShareName(value);
  try { localStorage.setItem(NICK_KEY, sessionNickname); } catch {}
  return sessionNickname;
}
export function encodeSharedResult(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeSharedResult(raw) {
  if (!raw || raw.length > 1200 || !/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0));
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (data.v !== 3 || typeof data.id !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(data.id)) return null;
    if (typeof data.name !== 'string' || cleanShareName(data.name).length < 2 || data.name.length > 24) return null;
    if (!dateFromKey(data.week) || data.week !== getWeekKey(data.week)) return null;
    if (!Number.isSafeInteger(data.points) || data.points < 0 || data.points > 1190) return null;
    if (!Number.isInteger(data.iq) || data.iq < 100 || data.iq > 150) return null;
    return { v: 3, id: data.id, name: cleanShareName(data.name), week: data.week, points: data.points, iq: data.iq };
  } catch { return null; }
}
export function sharedRankingUrl(payload, baseUrl = location.href) {
  const url = new URL('index.html', baseUrl);
  url.search = '';
  url.hash = 'rywalizacja?wynik=' + encodeSharedResult(payload);
  return url.href;
}
// Remove both legacy query and fragment data before rendering or reporting page views.
export function consumeSharedResultUrl(href = location.href, replace = value => history.replaceState(null, '', value)) {
  const url = new URL(href);
  const fragment = url.hash.slice(1);
  const fragmentIsParams = fragment.startsWith('wynik=');
  const fragmentParams = new URLSearchParams(fragment.includes('?') ? fragment.split('?').slice(1).join('?') : fragmentIsParams ? fragment : '');
  const raw = fragmentParams.get('wynik') ?? url.searchParams.get('wynik');
  if (raw === null) return { present: false, data: null };
  url.searchParams.delete('wynik');
  fragmentParams.delete('wynik');
  const anchor = fragment.includes('?') ? fragment.split('?')[0] : fragmentIsParams ? '' : fragment;
  url.hash = anchor || 'rywalizacja';
  if (fragmentParams.toString()) url.hash += '?' + fragmentParams.toString();
  replace(url.pathname + url.search + url.hash);
  return { present: true, data: decodeSharedResult(raw) };
}
export function buildChallengeUrl({ gameId, date, puzzleId, baseUrl = location.href }) {
  if (!GAME_NAMES[gameId] || !dateFromKey(date) || typeof puzzleId !== 'string' || !puzzleId) return null;
  const url = new URL(gameId + '.html', baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('challenge', date);
  url.searchParams.set('v', puzzleId);
  return url.href;
}
export function formatShareTime(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const seconds = Math.floor(elapsedMs / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function gameShareCard({ gameId, date, puzzleId, record, mode = 'daily', baseUrl }) {
  if (!GAME_NAMES[gameId]) return null;
  const trainingUrl = new URL(gameId + '.html', baseUrl || location.href);
  trainingUrl.search = ''; trainingUrl.hash = '';
  const url = mode === 'training' ? trainingUrl.href : buildChallengeUrl({ gameId, date, puzzleId, baseUrl });
  if (!url) return null;
  const lines = ['PUZLI · ' + GAME_NAMES[gameId] + ' · ' + (mode === 'training' ? 'trening' : date)];
  const time = formatShareTime(record?.elapsedMs);
  lines.push('Ukończone' + (time ? ' w ' + time : '') + '.');
  // Unknown or historical counters must never become a claim of unaided play.
  if (record?.hintsUsed === 0) lines.push('Bez podpowiedzi' + (record.resets === 0 ? ' i restartów.' : '.'));
  else if (Number.isInteger(record?.hintsUsed) && record.hintsUsed > 0) lines.push('Podpowiedzi: ' + record.hintsUsed + '.');
  lines.push(mode === 'training' ? 'Dołącz do dzisiejszej gry!' : 'Podejmij wyzwanie na tej samej planszy!');
  return { title: 'PUZLI — ' + GAME_NAMES[gameId], text: lines.join('\n'), url };
}
export function setShareCard({ state, date, baseUrl = location.href }) {
  const required = state?.daily?.requiredGames || [];
  const completedSet = new Set(state?.daily?.completedGames || []);
  const completed = required.filter(id => completedSet.has(id)).length;
  const total = required.length;
  const points = state?.rewards?.daily?.[date]?.total;
  const lines = ['PUZLI · zestaw ' + date, completed + '/' + total + ' gier ukończonych' + (Number.isFinite(points) ? ' · ' + points + ' pkt' : '') + '.'];
  if (total > 0 && completed === total) lines.push('Pełny komplet!');
  else if (completed > 0) lines.push('Dzień zaliczony. Reszta to dodatkowe wyzwanie.');
  lines.push('Dołącz do dzisiejszych gier!');
  const url = new URL('index.html', baseUrl); url.search = ''; url.hash = 'gry';
  return { title: 'PUZLI — mój dzienny wynik', text: lines.join('\n'), url: url.href };
}
export function rankSharedEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'pl'));
  let place = 0, previousPoints = null;
  return sorted.map((entry, index) => {
    if (entry.points !== previousPoints) place = index + 1;
    previousPoints = entry.points;
    return { ...entry, place };
  });
}
export function createManualShareFallback(parent, id) {
  const box = document.createElement('div'); box.className = 'share-manual-fallback'; box.hidden = true;
  const label = document.createElement('label'); label.htmlFor = id;
  label.textContent = 'Skopiuj tekst i link ręcznie:';
  const field = document.createElement('textarea'); field.id = id; field.readOnly = true; field.rows = 5;
  field.setAttribute('aria-label', 'Wynik i link do ręcznego skopiowania');
  field.addEventListener('focus', () => field.select());
  box.append(label, field); parent.append(box);
  return box;
}
export async function shareCard(card, { status, fallback, context = {}, navigatorObject = navigator } = {}) {
  if (!card) return { outcome: 'unavailable' };
  const setStatus = text => { if (status) status.textContent = text; };
  if (fallback) fallback.hidden = true;
  track('share_started', context);
  if (typeof navigatorObject.share === 'function') {
    try {
      await navigatorObject.share(card);
      setStatus('Wynik przekazany do udostępnienia.'); track('share_native_completed', context);
      return { outcome: 'native' };
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('Udostępnianie anulowane.'); track('share_cancelled', context);
        return { outcome: 'cancelled' };
      }
    }
  }
  const content = card.text + '\n' + card.url;
  if (typeof navigatorObject.clipboard?.writeText === 'function') {
    try {
      await navigatorObject.clipboard.writeText(content);
      setStatus('Wynik i link skopiowane. Wyślij je znajomym!'); track('share_copied', context);
      return { outcome: 'clipboard' };
    } catch {}
  }
  if (fallback) {
    const field = fallback.querySelector('textarea');
    if (field) field.value = content;
    fallback.hidden = false;
  }
  setStatus('Przeglądarka nie udostępniła schowka. Skopiuj wynik i link z pola poniżej.');
  track('share_manual_fallback', context);
  return { outcome: 'manual', content };
}
