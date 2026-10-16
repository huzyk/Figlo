// Shared reward-card renderer for real Daily wins and the visual preview.
// Presentation only: never calculates, awards or changes a saved score.
export const SCORE_PARTS = Object.freeze([
  { key: 'base', label: 'Ukończenie', max: 10 },
  { key: 'speed', label: 'Szybkość', max: 10 },
  { key: 'clean', label: 'Bez podpowiedzi', max: 5 }
]);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};
function boundedPoints(value, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
}
export function renderScoreBreakdown(summary, game, { setBonus = 0 } = {}) {
  summary.replaceChildren();
  if (!game || !SCORE_PARTS.every(part => Number.isFinite(game[part.key]))) {
    summary.append(el('span', 'score-unavailable', 'Wynik zapisany'));
    return;
  }

  const points = SCORE_PARTS.reduce((sum, part) => sum + boundedPoints(game[part.key], part.max), 0);
  const header = el('div', 'score-header');
  const title = el('div', 'score-headline');
  const caption = el('span', 'score-kicker', 'PUNKTY ZA GRĘ');
  const total = el('strong', 'score-total', '+' + points);
  total.append(el('span', 'score-maximum', ' / 25 pkt'));
  title.append(caption, total);
  header.append(title, el('span', 'score-peak', points === 25 ? 'Maksimum!' : points >= 20 ? 'Świetny wynik' : 'Gra ukończona'));
  summary.append(header);

  const rows = el('div', 'score-rows');
  rows.setAttribute('role', 'list');
  for (const part of SCORE_PARTS) {
    const value = boundedPoints(game[part.key], part.max);
    const row = el('div', 'score-row score-' + part.key);
    row.setAttribute('role', 'listitem');
    const labels = el('div', 'score-row-head');
    labels.append(el('span', 'score-row-label', part.label), el('strong', 'score-row-value', value + '/' + part.max));
    const track = el('div', 'score-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', part.label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(part.max));
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-valuetext', value + ' z ' + part.max + ' punktów');
    const fill = el('div', 'score-fill');
    fill.style.width = (100 * value / part.max) + '%';
    track.append(fill);
    row.append(labels, track);
    rows.append(row);
  }
  summary.append(rows);
  if (game.hintsUsed > 0 || game.hintsUsed === null) {
    summary.append(el('small', 'score-note',
      game.hintsUsed > 0 ? 'Podpowiedź wykorzystana — bez premii za samodzielność.' : 'Brak danych o podpowiedziach — bez premii za samodzielność.'));
  }
  if (Number.isFinite(setBonus) && setBonus > 0) {
    const bonus = el('div', 'score-set-bonus');
    bonus.append(el('span', '', '★ Premia za pełny zestaw'), el('strong', '', '+' + setBonus + ' pkt'));
    summary.append(bonus);
  }
}
