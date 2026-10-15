import { getIdentity } from '../services/identity-service.js';
import { loadFigloState } from '../storage.js';
import { getBadges, getPuzliIQ, getRank, getNextRank, getWeekKey, weeklyPoints } from '../domain/rewards.js';

const FRIENDS_KEY = 'puzli_shared_friends_v1';
const NICK_KEY = 'puzli_share_nickname_v1';
const PUBLIC_ID_KEY = 'puzli_share_public_id_v1';
const $ = id => document.getElementById(id);
let initialized = false, viewDate = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function publicId() {
  let id = localStorage.getItem(PUBLIC_ID_KEY);
  if (id) return id;
  id = (globalThis.crypto?.randomUUID?.() || getIdentity().localId);
  try { localStorage.setItem(PUBLIC_ID_KEY, id); } catch {}
  return id;
}
function nickname() { return (localStorage.getItem(NICK_KEY) || '').trim(); }
function cleanName(value) { return String(value || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 24); }
function setStatus(text) { if ($('friendStatus')) $('friendStatus').textContent = text; }
function encodeResult(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeResult(raw) {
  if (!raw || raw.length > 1200 || !/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0));
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (data.v !== 1 || typeof data.id !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(data.id)) return null;
    if (typeof data.name !== 'string' || !cleanName(data.name) || data.name.length > 24) return null;
    if (!getWeekKey(data.week) || data.week !== getWeekKey(data.week)) return null;
    if (!Number.isSafeInteger(data.points) || data.points < 0 || data.points > 5600) return null;
    if (!Number.isInteger(data.iq) || data.iq < 100 || data.iq > 150) return null;
    return { v: 1, id: data.id, name: cleanName(data.name), week: data.week, points: data.points, iq: data.iq };
  } catch { return null; }
}
function friends() {
  const entries = readJson(FRIENDS_KEY, []);
  return Array.isArray(entries) ? entries.filter(value =>
    value && typeof value.id === 'string' && typeof value.week === 'string' &&
    Number.isInteger(value.points) && Number.isInteger(value.iq)
  ).slice(-100) : [];
}
function importResultFromUrl() {
  const url = new URL(location.href), raw = url.searchParams.get('wynik');
  if (!raw) return;
  url.searchParams.delete('wynik');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  const data = decodeResult(raw);
  if (!data) { setStatus('Nie można odczytać udostępnionego wyniku.'); return; }
  if (data.id === publicId()) { setStatus('To Twój własny link. Wyślij go znajomym!'); return; }
  const stored = friends().filter(entry => !(entry.id === data.id && entry.week === data.week));
  stored.push(data);
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(stored.slice(-100))); } catch {}
  setStatus(data.week === getWeekKey(viewDate) ?
    'Dodano wynik gracza ' + data.name + ' do rankingu.' :
    'Dodano wynik z innego tygodnia. Teraz widzisz bieżący tydzień.');
}
function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content != null) el.textContent = String(content);
  return el;
}
function renderBadges(state) {
  const badges = getBadges(state), grid = $('badgesGrid');
  if (!grid) return;
  $('badgesCount').textContent = badges.filter(b => b.earned).length + '/' + badges.length + ' zdobytych';
  grid.replaceChildren();
  for (const badge of badges) {
    const item = element('div', 'puzli-badge' + (badge.earned ? ' earned' : ''));
    item.title = badge.description;
    item.append(element('span', 'badge-icon', badge.earned ? badge.icon : '♙'));
    item.append(element('strong', '', badge.name));
    item.append(element('small', '', badge.earned ? 'Zdobyto ✓' : badge.description));
    grid.append(item);
  }
}
function renderRanking(state) {
  const week = getWeekKey(viewDate);
  const entries = friends().filter(item => item.week === week && item.id !== publicId());
  const me = { name: nickname() || 'Ty', id: publicId(), week, iq: getPuzliIQ(state), points: weeklyPoints(state, viewDate), mine: true };
  entries.push(me);
  entries.sort((a,b) => b.points - a.points || b.iq - a.iq || a.name.localeCompare(b.name, 'pl'));
  const list = $('friendsRanking');
  if (!list) return;
  list.replaceChildren();
  for (const [index, item] of entries.entries()) {
    const row = element('li', 'friend-row' + (item.mine ? ' is-me' : ''));
    row.append(element('span', 'friend-place', String(index + 1) + '.'));
    const player = element('span', 'friend-player');
    player.append(element('strong', '', item.name + (item.mine ? ' (Ty)' : '')));
    player.append(element('small', '', 'PUZLI IQ ' + item.iq + (item.mine ? '' : ' · wynik udostępniony')));
    row.append(player, element('strong', 'friend-points', item.points + ' pkt'));
    list.append(row);
  }
}
async function shareResult() {
  const input = $('playerNickname'), name = cleanName(input?.value);
  if (name.length < 2) { setStatus('Podaj nazwę gracza (co najmniej 2 znaki).'); input?.focus(); return; }
  try { localStorage.setItem(NICK_KEY, name); } catch {}
  const state = loadFigloState(viewDate);
  const payload = { v: 1, id: publicId(), name, week: getWeekKey(viewDate), points: weeklyPoints(state, viewDate), iq: getPuzliIQ(state) };
  const url = new URL('index.html', location.href);
  url.search = ''; url.hash = 'rywalizacja';
  url.searchParams.set('wynik', encodeResult(payload));
  const message = name + ' ma ' + payload.points + ' pkt w PUZLI w tym tygodniu. Porównaj wynik!';
  try {
    if (navigator.share) await navigator.share({ title: 'PUZLI — ranking znajomych', text: message, url: url.href });
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(message + '\n' + url.href); setStatus('Link skopiowany. Wyślij go znajomym!'); }
    else {
      const box = element('textarea'); box.value = message + '\n' + url.href;
      box.style.position = 'fixed'; box.style.opacity = '0'; document.body.append(box);
      box.select(); document.execCommand('copy'); box.remove();
      setStatus('Link skopiowany. Wyślij go znajomym!');
    }
  } catch(error) {
    if (error?.name !== 'AbortError') setStatus('Nie udało się udostępnić linku. Spróbuj ponownie.');
  }
  renderRanking(state);
}
export function renderEngagementUI(date = viewDate) {
  if (!date || !$('puzliIq')) return;
  viewDate = date;
  const state = loadFigloState(date), iq = getPuzliIQ(state), rank = getRank(iq), next = getNextRank(iq);
  $('puzliIq').textContent = iq; $('quickIq').textContent = iq;
  $('puzliRank').textContent = rank.name; $('rankCurrent').textContent = rank.name;
  $('iqMessage').textContent = 'Rozwiązuj gry, zdobywaj komplety i nagrody za samodzielność.';
  const percent = next ? Math.max(0, Math.min(100, Math.round((iq - rank.min) / (next.min - rank.min) * 100))) : 100;
  $('rankProgress').style.width = percent + '%';
  $('rankNext').textContent = next ? 'Do rangi ' + next.name + ': ' + (next.min - iq) + ' pkt IQ' : 'Najwyższa ranga!';
  $('totalPuzliPoints').textContent = Number(state.rewards.totalPoints || 0).toLocaleString('pl-PL');
  $('weekPuzliPoints').textContent = weeklyPoints(state, date).toLocaleString('pl-PL');
  $('shareWeekPoints').textContent = weeklyPoints(state, date).toLocaleString('pl-PL') + ' pkt';
  $('perfectSets').textContent = Number(state.rewards.cleanSets || 0);
  $('weekHeadingLabel').textContent = 'Tydzień od ' + getWeekKey(date);
  renderBadges(state); renderRanking(state);
}
export function initEngagementUI(date) {
  if (initialized) return;
  initialized = true; viewDate = date;
  const input = $('playerNickname');
  if (input) input.value = nickname();
  input?.addEventListener('change', () => {
    const name = cleanName(input.value);
    try { localStorage.setItem(NICK_KEY, name); } catch {}
    renderRanking(loadFigloState(viewDate));
  });
  $('sharePuzliResult')?.addEventListener('click', shareResult);
  $('clearFriendResults')?.addEventListener('click', () => {
    try { localStorage.removeItem(FRIENDS_KEY); } catch {}
    setStatus('Usunięto wyniki znajomych z tego urządzenia.');
    renderEngagementUI(viewDate);
  });
  importResultFromUrl(); renderEngagementUI(viewDate);
}
