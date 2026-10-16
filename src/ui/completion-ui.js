import { currentDateKey } from '../daily.js';
import { loadFigloState } from '../storage.js';
import { BADGES } from '../domain/rewards.js';
import { getGameMode, getGameDate, getGamePuzzleId } from './game-mode.js';
import { gameShareCard, shareCard, createManualShareFallback, formatShareTime } from '../services/share-service.js';
import { playVictory } from './victory-fx.js';

const GAME_META = {
  korony: { name: 'Korony', title: 'Korony ukończone!', href: 'korony.html' },
  duet: { name: 'Duet', title: 'Duet ukończony!', href: 'duet.html' },
  bloki: { name: 'Bloki', title: 'Bloki ukończone!', href: 'bloki.html' },
  latarnie: { name: 'Latarnie', title: 'Latarnie ukończone!', href: 'latarnie.html' },
  zip: { name: 'Zip', title: 'Zip ukończony!', href: 'zip.html' },
  sudoku: { name: 'Sudoku', title: 'Sudoku ukończone!', href: 'sudoku.html' }
};
function gameIdFromPath() { return Object.keys(GAME_META).find(id => location.pathname.split('/').pop()?.startsWith(id)) || null; }
function progressFor(state) {
  const required = Array.isArray(state?.daily?.requiredGames) ? state.daily.requiredGames : [];
  const completedSet = new Set(state?.daily?.completedGames || []);
  return { required, completedSet, completed: required.filter(id => completedSet.has(id)).length, total: required.length };
}
function ensureElement(root, selector, tag, className, beforeSelector) {
  let element = root.querySelector(selector);
  if (element) return element;
  element = document.createElement(tag); element.className = className;
  element.setAttribute(selector.replace(/^\[|\]$/g, ''), '');
  const before = beforeSelector ? root.querySelector(beforeSelector) : null;
  if (before) before.before(element); else root.appendChild(element);
  return element;
}
function elementsFor(root, gameId) {
  const copy = root.querySelector('#doneCopy') || ensureElement(root, '[data-completion-copy]', 'p', 'completion-copy', '.completion-stats');
  copy.classList.add('completion-copy'); copy.setAttribute('data-completion-copy', '');
  return {
    title: root.querySelector('#doneTitle'), time: root.querySelector('#finalTime'),
    primary: root.querySelector('#backToSet') || root.querySelector('a'),
    secondary: root.querySelector(gameId === 'korony' ? '#nextPuzzle' : '#replay'),
    eyebrow: ensureElement(root, '[data-completion-eyebrow]', 'span', 'completion-eyebrow', '#doneTitle'),
    copy,
    progress: ensureElement(root, '[data-completion-progress]', 'div', 'completion-progress', '.completion-stats')
  };
}
export function buildCompletionView({ state, gameId, mode, date, today }) {
  const meta = GAME_META[gameId], progress = progressFor(state);
  const base = { primaryLabel: 'Wróć do dzisiejszego zestawu', primaryHref: 'index.html#gry', secondaryLabel: 'Nowa plansza treningowa' };
  if (mode !== 'daily') return { ...base, eyebrow: mode === 'challenge' ? 'WYZWANIE Z LINKU' : 'TRENING', title: meta?.title || 'Ukończone!',
    copy: mode === 'challenge' ? 'Wyzwanie ukończone. Ten wynik nie dodaje punktów ani nie zmienia Twojej serii.' : 'Dobra robota. Tryb treningowy nie wpływa na dzisiejszy zestaw.', progress: null };
  const dayDone = progress.total > 0 && progress.completed >= progress.total;
  const historical = Boolean(date && today && date !== today);
  if (dayDone) return { ...base, eyebrow: historical ? 'ZESTAW ' + date : 'DZISIEJSZE PUZLI', title: historical ? 'Pełny komplet!' : 'Dzisiejszy zestaw ukończony!',
    copy: 'Pełny komplet — dodatkowe osiągnięcie i premia do punktów.', progress: `${progress.completed}/${progress.total}` };
  const next = progress.required.find(id => id !== gameId && !progress.completedSet.has(id));
  return { ...base, eyebrow: historical ? 'ZESTAW ' + date : 'DZIEŃ ZALICZONY', title: meta?.title || 'Ukończone!',
    copy: 'Pierwsza gra zalicza dzień i podtrzymuje serię. Pełny komplet to dodatkowa premia.', progress: progress.total ? `${progress.completed}/${progress.total}` : null,
    primaryLabel: next && !historical ? 'Graj dalej: ' + (GAME_META[next]?.name || next) : base.primaryLabel,
    primaryHref: next && !historical ? GAME_META[next]?.href || base.primaryHref : base.primaryHref };
}
export function completionRecord(state, { gameId, date, puzzleId }) {
  const record = puzzleId ? state?.puzzleResults?.[puzzleId] : Object.values(state?.puzzleResults || {}).find(item => item.date === date && item.gameId === gameId && item.mode === 'daily');
  return record?.date === date && record.gameId === gameId && record.mode === 'daily' ? record : null;
}
export function refreshCompletionTime(time, { mode, record }) {
  if (!time) return;
  const persisted = mode === 'daily' && record;
  const label = time.parentElement?.querySelector('span,small');
  if (label) label.textContent = persisted ? 'Zapisany wynik' : 'Czas';
  if (persisted) time.textContent = formatShareTime(record.elapsedMs)?.padStart(5, '0') || '—';
}
function elapsedFromModal(root) {
  const match = root.querySelector('#finalTime')?.textContent?.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return (match[3] ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number(match[1]) * 60 + Number(match[2])) * 1000;
}
function renderRewardSummary(root, state, gameId, date, mode, result) {
  let summary = root.querySelector('#completionRewardSummary');
  if (!summary) {
    summary = document.createElement('div'); summary.id = 'completionRewardSummary'; summary.className = 'completion-reward-summary';
    summary.setAttribute('aria-live', 'polite'); root.querySelector('.completion-stats')?.after(summary);
  }
  summary.replaceChildren(); summary.hidden = mode !== 'daily';
  if (mode !== 'daily') return;
  const record = state.rewards?.daily?.[date], points = record?.games?.[gameId]?.points || 0;
  const line = document.createElement('strong');
  line.textContent = '+' + points + ' pkt PUZLI';
  summary.append(line);
  const game = record?.games?.[gameId];
  const supplement = document.createElement('span');
  if (game) {
    supplement.textContent = '+' + game.base + ' za ukończenie · +' + game.speed +
      ' za szybkość · +' + game.clean + ' bez podpowiedzi' +
      (game.hintsUsed > 0 ? ' · użyto podpowiedzi' : game.hintsUsed == null ? ' · brak danych o podpowiedziach' : '');
  } else {
    supplement.textContent = 'Wynik zapisany';
  }
  summary.append(supplement);
  const progress = progressFor(state);
  if (progress.total > 0 && progress.completed === progress.total && record?.bonus) {
    const full = document.createElement('span'); full.textContent = 'Pełny komplet: +' + record.bonus + ' pkt!'; summary.append(full);
  }
}
function renderShare(root, { state, gameId, date, mode, puzzleId }) {
  const result = mode === 'daily' ? completionRecord(state, { gameId, date, puzzleId }) : null;
  const card = gameShareCard({ gameId, date, mode, puzzleId: result?.puzzleId || puzzleId,
    record: result || { elapsedMs: elapsedFromModal(root) } });
  let button = root.querySelector('#completionShare');
  if (!button) {
    button = document.createElement('button'); button.id = 'completionShare'; button.type = 'button';
    button.className = 'completion-share'; button.textContent = 'Udostępnij wynik ↗';
    const container = root.querySelector('.completion-card') || root;
    const secondary = container.querySelector('#nextPuzzle,#replay');
    if (secondary) secondary.before(button); else container.append(button);
    const status = document.createElement('p'); status.id = 'completionShareStatus'; status.className = 'completion-share-status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); button.after(status);
    createManualShareFallback(container, 'completionShareText').id = 'completionShareFallback';
  }
  button.hidden = !card;
  button.onclick = async () => {
    button.disabled = true;
    try { await shareCard(card, { status: root.querySelector('#completionShareStatus'), fallback: root.querySelector('#completionShareFallback'), context: { gameId, date, mode } }); }
    finally { button.disabled = false; }
  };
  return result;
}
export function refreshCompletion(root = document.querySelector('#done')) {
  const gameId = gameIdFromPath();
  if (!root || !gameId) return null;
  // Session date stays attached to the board, including a completion after midnight.
  const date = getGameDate(), mode = getGameMode(), puzzleId = getGamePuzzleId();
  const state = loadFigloState(date), view = buildCompletionView({ state, gameId, mode, date, today: currentDateKey() }), elements = elementsFor(root, gameId);
  elements.eyebrow.textContent = view.eyebrow;
  if (elements.title) elements.title.textContent = view.title;
  elements.copy.textContent = view.copy; elements.progress.hidden = !view.progress; elements.progress.textContent = view.progress || '';
  if (elements.primary) { elements.primary.textContent = view.primaryLabel; elements.primary.href = view.primaryHref; elements.primary.classList.add('completion-primary'); }
  if (elements.secondary) { elements.secondary.textContent = view.secondaryLabel; elements.secondary.classList.add('completion-secondary'); }
  const result = renderShare(root, { state, gameId, date, mode, puzzleId });
  refreshCompletionTime(elements.time, { mode, record: result });
  renderRewardSummary(root, state, gameId, date, mode, result);
  let link = root.querySelector('#completionRewardsLink');
  if (!link) { link = document.createElement('a'); link.id = 'completionRewardsLink'; link.className = 'completion-rewards-link'; link.textContent = 'Zobacz odznaki i ranking znajomych'; root.querySelector('.completion-card')?.append(link); }
  link.href = 'index.html#rywalizacja'; link.hidden = mode !== 'daily';
  if (gameId === 'korony' && elements.time) elements.time.textContent = elements.time.textContent.replace(/^Czas\s+/i, '');
  return view;
}
// Victory is presentation-only: no score mutation, overlay or interaction lock.
// The unlocked badge stays in the result card; motion only plays once per puzzle.
function renderUnlockedBadge(root, state, gameId, date) {
  const award = state.rewards?.lastAward;
  const badges = award?.date === date && award.gameId === gameId
    ? (award.badges || []).map(id => BADGES.find(badge => badge.id === id)).filter(Boolean)
    : [];
  let panel = root.querySelector('.puzli-badge-unlock');
  if (!badges.length) {
    panel?.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'puzli-badge-unlock';
    const card = root.querySelector('.completion-card');
    const anchor = card?.querySelector('.completion-progress') || card?.querySelector('.completion-copy') || card?.querySelector('h2');
    if (anchor) anchor.after(panel); else card?.prepend(panel);
  }
  const icon = document.createElement('span');
  icon.className = 'puzli-badge-unlock-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = badges.length === 1 ? badges[0].icon : '✦';
  const copy = document.createElement('span');
  copy.className = 'puzli-badge-unlock-copy';
  const label = document.createElement('small');
  label.textContent = badges.length === 1 ? 'Odznaka odblokowana' : 'Odznaki odblokowane';
  const name = document.createElement('strong');
  name.textContent = badges.map(badge => badge.name).join(' · ');
  copy.append(label, name);
  panel.replaceChildren(icon, copy);
}

function celebrateCompletion(root) {
  if (getGameMode() !== 'daily') {
    // Training and shared challenges deserve the same satisfying finish,
    // but never award daily points or badges.
    root.querySelector('.puzli-badge-unlock')?.remove();
    playVictory(root);
    return;
  }
  const gameId = gameIdFromPath(), date = getGameDate(), puzzleId = getGamePuzzleId();
  const state = loadFigloState(date);
  if (!completionRecord(state, { gameId, date, puzzleId })) return;
  renderUnlockedBadge(root, state, gameId, date);

  // Daily wins play only once per puzzle. Preview uses playVictory directly.
  const key = ['puzli-win-seen', date, gameId, puzzleId || 'daily'].join(':');
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* Private browsing may block sessionStorage. */ }
  playVictory(root);
}

function init() {
  const root = document.querySelector('#done'); if (!root) return;
  let previousFocus = document.activeElement;
  let previousBoardIndex = -1;
  let wasVisible = !root.hidden;
  document.addEventListener('focusin', event => {
    if (!root.hidden || root.contains(event.target)) return;
    previousFocus = event.target;
    previousBoardIndex = Array.from(document.querySelector('#board')?.children || []).indexOf(event.target);
  });
  const focusableElements = () => Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(element => !element.closest('[hidden]') && element.getClientRects().length > 0);
  document.addEventListener('keydown', event => {
    if (root.hidden || event.key !== 'Tab') return;
    const elements = focusableElements(), first = elements[0], last = elements.at(-1);
    if (!first) return;
    if (!root.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  });
  const update = () => {
    const visible = !root.hidden;
    if (visible) {
      refreshCompletion(root);
      if (!wasVisible) celebrateCompletion(root);
      // Keep the existing game's focus on replay when it already sits in the dialog.
      if (!root.contains(document.activeElement)) focusableElements()[0]?.focus({ preventScroll: true });
    } else if (wasVisible) {
      const active = document.activeElement;
      if (!active || active === document.body || root.contains(active)) {
        const target = previousFocus?.isConnected ? previousFocus : document.querySelector('#board')?.children[previousBoardIndex];
        target?.focus({ preventScroll: true });
      }
      root.querySelector('#completionShareFallback')?.setAttribute('hidden', '');
      const status = root.querySelector('#completionShareStatus'); if (status) status.textContent = '';
    }
    wasVisible = visible;
  };
  const observer = new MutationObserver(() => queueMicrotask(update));
  observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  if (!root.hidden) update();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
}
