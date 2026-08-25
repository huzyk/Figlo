import { currentDateKey } from '../daily.js';
import { loadFigloState } from '../storage.js';
import { getGameMode } from './game-mode.js';

const GAME_META = {
  korony: { name: 'Korony', title: 'Korony ukończone!', href: 'korony.html' },
  duet: { name: 'Duet', title: 'Duet ukończony!', href: 'duet.html' },
  bloki: { name: 'Bloki', title: 'Bloki ukończone!', href: 'bloki.html' }
};

function gameIdFromPath() {
  const file = location.pathname.split('/').pop() || '';
  if (file.startsWith('korony')) return 'korony';
  if (file.startsWith('duet')) return 'duet';
  if (file.startsWith('bloki')) return 'bloki';
  return null;
}

function progressFor(state) {
  const required = Array.isArray(state?.daily?.requiredGames) ? state.daily.requiredGames : [];
  const completedSet = new Set(Array.isArray(state?.daily?.completedGames) ? state.daily.completedGames : []);
  const completed = required.filter(id => completedSet.has(id)).length;
  return { required, completedSet, completed, total: required.length };
}

function nextUnfinished(progress, currentGameId) {
  return progress.required.find(id => id !== currentGameId && !progress.completedSet.has(id)) || null;
}

function ensureElement(root, selector, tag, className, beforeSelector) {
  let element = root.querySelector(selector);
  if (element) return element;
  element = document.createElement(tag);
  element.className = className;
  element.setAttribute(selector.replace(/^\[|\]$/g, ''), '');
  const before = beforeSelector ? root.querySelector(beforeSelector) : null;
  if (before) before.before(element); else root.appendChild(element);
  return element;
}

function elementsFor(root, gameId) {
  const title = root.querySelector('#doneTitle');
  const time = root.querySelector('#finalTime');
  const best = root.querySelector(gameId === 'korony' ? '#modalBest' : '#bestTime');
  const primary = root.querySelector('#backToSet') || root.querySelector('a');
  const secondary = root.querySelector(gameId === 'korony' ? '#nextPuzzle' : '#replay');

  const eyebrow = ensureElement(root, '[data-completion-eyebrow]', 'span', 'completion-eyebrow', '#doneTitle');
  const copy = ensureElement(root, '[data-completion-copy]', 'p', 'completion-copy', '.completion-stats');
  const progress = ensureElement(root, '[data-completion-progress]', 'div', 'completion-progress', '.completion-stats');

  return { title, time, best, primary, secondary, eyebrow, copy, progress };
}

export function buildCompletionView({ state, gameId, mode }) {
  const meta = GAME_META[gameId];
  const progress = progressFor(state);

  if (mode !== 'daily') {
    return {
      eyebrow: 'TRENING',
      title: meta?.title || 'Ukończone!',
      copy: 'Dobra robota. Tryb treningowy nie wpływa na dzisiejszy zestaw.',
      progress: null,
      primaryLabel: 'Wróć do dzisiejszego zestawu',
      primaryHref: 'index.html#gry',
      secondaryLabel: 'Nowa plansza treningowa'
    };
  }

  const next = nextUnfinished(progress, gameId);
  const dayDone = progress.total > 0 && progress.completed >= progress.total;

  if (dayDone) {
    return {
      eyebrow: 'DZISIEJSZE FIGLO',
      title: 'Dzisiejszy zestaw ukończony!',
      copy: 'Masz komplet na dziś.',
      progress: `${progress.completed}/${progress.total}`,
      primaryLabel: 'Wróć do dzisiejszego zestawu',
      primaryHref: 'index.html#gry',
      secondaryLabel: 'Nowa plansza treningowa'
    };
  }

  return {
    eyebrow: 'GRA UKOŃCZONA',
    title: meta?.title || 'Ukończone!',
    copy: `Zostało jeszcze ${Math.max(0, progress.total - progress.completed)} z dzisiejszego zestawu.`,
    progress: progress.total ? `${progress.completed}/${progress.total}` : null,
    primaryLabel: next ? `Graj dalej: ${GAME_META[next]?.name || next}` : 'Wróć do dzisiejszego zestawu',
    primaryHref: next ? GAME_META[next]?.href || 'index.html#gry' : 'index.html#gry',
    secondaryLabel: 'Nowa plansza treningowa'
  };
}

export function refreshCompletion(root = document.querySelector('#done')) {
  const gameId = gameIdFromPath();
  if (!root || !gameId) return null;

  const state = loadFigloState(currentDateKey());
  const view = buildCompletionView({ state, gameId, mode: getGameMode() });
  const elements = elementsFor(root, gameId);

  if (elements.eyebrow) elements.eyebrow.textContent = view.eyebrow;
  if (elements.title) elements.title.textContent = view.title;
  if (elements.copy) elements.copy.textContent = view.copy;
  if (elements.progress) {
    elements.progress.hidden = !view.progress;
    elements.progress.textContent = view.progress || '';
  }
  if (elements.primary) {
    elements.primary.textContent = view.primaryLabel;
    elements.primary.href = view.primaryHref;
    elements.primary.classList.add('completion-primary');
  }
  if (elements.secondary) {
    elements.secondary.textContent = view.secondaryLabel;
    elements.secondary.classList.add('completion-secondary');
  }
  if (gameId === 'korony' && elements.time) {
    elements.time.textContent = elements.time.textContent.replace(/^Czas\s+/i, '');
  }

  return view;
}

function modalIsVisible(root) {
  return Boolean(root && !root.hidden);
}

function init() {
  const root = document.querySelector('#done');
  if (!root) return;
  const observer = new MutationObserver(() => {
    if (modalIsVisible(root)) queueMicrotask(() => refreshCompletion(root));
  });
  observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  if (modalIsVisible(root)) refreshCompletion(root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
