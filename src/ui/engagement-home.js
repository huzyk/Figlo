import { loadFigloState } from '../storage.js';
import { getBadges, getPuzliIQ, getRank, getNextRank, getWeekKey, weeklyPoints } from '../domain/rewards.js';
import { track } from '../services/analytics-service.js';
import { cleanShareName, sharePublicId, shareNickname, saveShareNickname, decodeSharedResult,
  encodeSharedResult, consumeSharedResultUrl, sharedRankingUrl, setShareCard, shareCard,
  createManualShareFallback, rankSharedEntries } from '../services/share-service.js';

const FRIENDS_KEY = 'puzli_shared_friends_v1';
const $ = id => document.getElementById(id);
let initialized = false, viewDate = null;
function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function setStatus(text) { if ($('friendStatus')) $('friendStatus').textContent = text; }
function friends() {
  const entries = readJson(FRIENDS_KEY, []);
  return Array.isArray(entries) ? entries.map(value => {
    try { return decodeSharedResult(encodeSharedResult(value)); } catch { return null; }
  }).filter(Boolean).slice(-100) : [];
}
function importResultFromUrl() {
  const { present, data } = consumeSharedResultUrl();
  if (!present) return;
  if (!data) { setStatus('Nie można odczytać udostępnionego wyniku.'); return; }
  if (data.id === sharePublicId()) { setStatus('To Twój własny link. Wyślij go znajomym!'); return; }
  const stored = friends().filter(entry => !(entry.id === data.id && entry.week === data.week));
  stored.push(data);
  let saved = true;
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(stored.slice(-100))); } catch { saved = false; }
  track('shared_result_opened', { date: viewDate });
  setStatus(!saved ? 'Pamięć przeglądarki jest niedostępna. Nie udało się zapisać wyniku znajomego.' : data.week === getWeekKey(viewDate) ?
    'Dodano wynik gracza ' + data.name + '. Zaktualizuje się po otwarciu kolejnego linku od tej osoby.' :
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
  const entries = friends().filter(item => item.week === week && item.id !== sharePublicId());
  entries.push({ name: shareNickname() || 'Ty', id: sharePublicId(), week, iq: getPuzliIQ(state), points: weeklyPoints(state, viewDate), mine: true });
  const list = $('friendsRanking');
  if (!list) return;
  list.replaceChildren();
  for (const item of rankSharedEntries(entries)) {
    const row = element('li', 'friend-row' + (item.mine ? ' is-me' : ''));
    row.append(element('span', 'friend-place', item.place + '.'));
    const player = element('span', 'friend-player');
    player.append(element('strong', '', item.name + (item.mine ? ' (Ty)' : '')));
    player.append(element('small', '', item.mine ? 'PUZLI IQ ' + item.iq + ' · Twój wynik lokalny' : 'PUZLI IQ ' + item.iq + ' · wynik z otrzymanego linku'));
    row.append(player, element('strong', 'friend-points', item.points + ' pkt'));
    list.append(row);
  }
}
async function shareWeeklyResult() {
  const input = $('playerNickname'), name = cleanShareName(input?.value);
  if (name.length < 2) { setStatus('Podaj nazwę gracza (co najmniej 2 znaki).'); input?.focus(); return; }
  saveShareNickname(name);
  const state = loadFigloState(viewDate);
  const payload = { v: 1, id: sharePublicId(), name, week: getWeekKey(viewDate), points: weeklyPoints(state, viewDate), iq: getPuzliIQ(state) };
  const card = { title: 'PUZLI — ranking znajomych', text: name + ' ma ' + payload.points + ' pkt w PUZLI w tygodniu od ' + payload.week + '. Porównaj wynik!', url: sharedRankingUrl(payload) };
  await shareCard(card, { status: $('friendStatus'), fallback: $('weeklyShareFallback'), context: { date: viewDate } });
  renderRanking(state);
}
function initDailyShare() {
  const panel = document.querySelector('.friends-panel');
  if (!panel) return;
  const section = element('div', 'daily-share-summary'); section.id = 'dailyShareSummary';
  const title = element('strong', '', 'Twój dzisiejszy zestaw');
  const summary = element('p'); summary.id = 'dailyShareProgress';
  const actions = element('div', 'friends-actions');
  const button = element('button', '', 'Udostępnij dzisiejszy zestaw ↗'); button.id = 'shareDailyResult'; button.type = 'button';
  const status = element('p', 'friend-status'); status.id = 'dailyShareStatus'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(button); section.append(title, summary, actions, status);
  const fallback = createManualShareFallback(section, 'dailyShareText');
  panel.prepend(section);
  button.addEventListener('click', async () => {
    const date = viewDate;
    await shareCard(setShareCard({ state: loadFigloState(date), date }), { status, fallback, context: { date } });
  });
  const weeklyFallback = createManualShareFallback(panel, 'weeklyShareText');
  weeklyFallback.id = 'weeklyShareFallback'; $('friendStatus')?.after(weeklyFallback);
  const disclaimer = panel.querySelector('.friend-disclaimer');
  if (disclaimer) disclaimer.textContent = 'To ranking na tym urządzeniu, złożony z Twojego wyniku i wyników z otrzymanych linków. Wynik znajomego zmienia się dopiero po otwarciu nowego linku. Remisy zajmują wspólne miejsce. Wyniki nie są weryfikowane przez serwer.';
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
  const completed = new Set(state.daily.completedGames);
  const count = state.daily.requiredGames.filter(id => completed.has(id)).length;
  const total = state.daily.requiredGames.length;
  if ($('dailyShareProgress')) $('dailyShareProgress').textContent = count + '/' + total + ' gier · ' + (count === total && total > 0 ? 'Pełny komplet i premia!' : count > 0 ? 'Dzień zaliczony. Komplet to dodatkowa premia.' : 'Pierwsza ukończona gra zaliczy dzień.');
  if ($('shareDailyResult')) $('shareDailyResult').disabled = count === 0;
  renderBadges(state); renderRanking(state);
}
export function initEngagementUI(date) {
  if (initialized) return;
  initialized = true; viewDate = date;
  initDailyShare();
  const input = $('playerNickname');
  if (input) input.value = shareNickname();
  input?.addEventListener('change', () => {
    saveShareNickname(input.value);
    renderRanking(loadFigloState(viewDate));
  });
  const weeklyButton = $('sharePuzliResult');
  if (weeklyButton) weeklyButton.textContent = 'Udostępnij wynik tygodnia ↗';
  weeklyButton?.addEventListener('click', shareWeeklyResult);
  $('clearFriendResults')?.addEventListener('click', () => {
    try { localStorage.removeItem(FRIENDS_KEY); setStatus('Usunięto wyniki znajomych z tego urządzenia.'); }
    catch { setStatus('Pamięć przeglądarki jest niedostępna. Nie udało się usunąć wyników.'); }
    renderEngagementUI(viewDate);
  });
  // A shared result is carried in the URL fragment. Navigation between two
  // shares on the same page does not reload the document.
  window.addEventListener('hashchange', () => {
    importResultFromUrl();
    renderRanking(loadFigloState(viewDate));
  });
  importResultFromUrl(); renderEngagementUI(viewDate);
}
