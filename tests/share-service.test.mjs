import test from 'node:test';
import assert from 'node:assert/strict';
import { gameShareCard, setShareCard, buildChallengeUrl, encodeSharedResult, decodeSharedResult,
  sharedRankingUrl, consumeSharedResultUrl, rankSharedEntries, shareCard,
  sharePublicId, shareNickname, saveShareNickname } from '../src/services/share-service.js';
import { buildCompletionView, completionRecord, refreshCompletionTime } from '../src/ui/completion-ui.js';
import { setAnalyticsAdapter } from '../src/services/analytics-service.js';

const DATE = '2026-10-15';
const BASE = 'https://huzyk.github.io/Figlo/korony.html?date=2026-10-15';
const result = { v: 2, id: 'player-0123456789', name: 'Łucja', week: '2026-10-12', points: 25, iq: 100 };
const record = { puzzleId: 'figlo:korony:2026-10-15:v1', gameId: 'korony', date: DATE, mode: 'daily', elapsedMs: 63000, hintsUsed: 0, resets: 0 };

test('game sharing links the exact board version and omits board content', () => {
  const card = gameShareCard({ gameId: 'korony', date: DATE, puzzleId: record.puzzleId, record, baseUrl: BASE });
  const url = new URL(card.url);
  assert.equal(url.pathname, '/Figlo/korony.html');
  assert.equal(url.searchParams.get('challenge'), DATE);
  assert.equal(url.searchParams.get('v'), record.puzzleId);
  assert.equal(url.searchParams.has('date'), false);
  assert.match(card.text, /1:03/);
  assert.match(card.text, /Bez podpowiedzi i restartów/);
  assert.equal(buildChallengeUrl({ gameId: 'other', date: DATE, puzzleId: 'x', baseUrl: BASE }), null);
});

test('unknown counters and hints never become a claim of unaided play', () => {
  for (const hintsUsed of [null, undefined, 2]) {
    const card = gameShareCard({ gameId: 'korony', date: DATE, puzzleId: record.puzzleId, record: { hintsUsed, resets: null }, baseUrl: BASE });
    assert.doesNotMatch(card.text, /Bez podpowiedzi|bez pomocy|samodzielnie/i);
    assert.doesNotMatch(card.text, /restartów/);
  }
});

test('training share explicitly names training and invites to the daily game', () => {
  const card = gameShareCard({ gameId: 'duet', mode: 'training', record: { elapsedMs: 65000 }, baseUrl: BASE });
  assert.match(card.text, /trening/);
  assert.doesNotMatch(card.text, /tej samej planszy/);
  assert.equal(card.url, 'https://huzyk.github.io/Figlo/duet.html');
});

test('set share celebrates one game and full set separately', () => {
  const state = { daily: { requiredGames: ['korony', 'duet'], completedGames: ['korony'] }, rewards: { daily: { [DATE]: { total: 120 } } } };
  const card = setShareCard({ state, date: DATE, baseUrl: BASE });
  assert.match(card.text, /1\/2.*120 pkt/);
  assert.match(card.text, /Dzień zaliczony/);
  state.daily.completedGames.push('duet');
  assert.match(setShareCard({ state, date: DATE, baseUrl: BASE }).text, /Pełny komplet/);
});

test('weekly payload uses fragment, safely round trips Polish names and rejects invalid values', () => {
  const url = new URL(sharedRankingUrl(result, BASE));
  assert.equal(url.search, '');
  assert.match(url.hash, /^#rywalizacja\?wynik=/);
  assert.deepEqual(decodeSharedResult(encodeSharedResult(result)), result);
  assert.equal(decodeSharedResult(encodeSharedResult({...result,v:1,points:800})),null);
  for (const patch of [{ points: 1191 }, { week: '2026-02-30' }, { week: DATE }, { iq: 151 }, { name: 'a' }, { id: 'bad' }]) {
    assert.equal(decodeSharedResult(encodeSharedResult({ ...result, ...patch })), null);
  }
});

test('shared result is removed from legacy query and fragment, even if malformed', () => {
  for (const source of [sharedRankingUrl(result, BASE), 'https://example.test/index.html?date=' + DATE + '&wynik=' + encodeSharedResult(result) + '#rywalizacja']) {
    let replacement;
    const imported = consumeSharedResultUrl(source, value => { replacement = value; });
    assert.equal(imported.present, true);
    assert.deepEqual(imported.data, result);
    assert.doesNotMatch(replacement, /wynik/);
    assert.match(replacement, /#rywalizacja$/);
  }
  let replacement;
  const invalid = consumeSharedResultUrl('https://example.test/index.html?wynik=invalid#gry', value => { replacement = value; });
  assert.equal(invalid.present, true);
  assert.equal(invalid.data, null);
  assert.equal(replacement, '/index.html#gry');
});

test('equal point totals share the same competition rank regardless of PUZLI IQ', () => {
  const ranked = rankSharedEntries([{ name: 'A', points: 120, iq: 100 }, { name: 'B', points: 120, iq: 150 }, { name: 'C', points: 100, iq: 120 }]);
  assert.deepEqual(ranked.map(x => x.place), [1, 1, 3]);
});

function shareUi() {
  const field = { value: '' };
  return { status: { textContent: '' }, fallback: { hidden: true, querySelector: () => field }, field };
}
test('native share failure falls back to clipboard and records no private payload', async () => {
  const ui = shareUi(), events = []; let copied;
  setAnalyticsAdapter(event => events.push(event));
  const outcome = await shareCard({ title: 'PUZLI', text: 'Wynik', url: BASE }, { ...ui, context: { gameId: 'korony', date: DATE, mode: 'daily' }, navigatorObject: {
    share: async () => { throw new Error('Unavailable'); }, clipboard: { writeText: async text => { copied = text; } }
  } });
  assert.equal(outcome.outcome, 'clipboard');
  assert.equal(copied, 'Wynik\n' + BASE);
  assert.equal(ui.fallback.hidden, true);
  assert.match(ui.status.textContent, /skopiowane/);
  assert.deepEqual(events.map(e => e.eventName), ['share_started', 'share_copied']);
  assert.equal(JSON.stringify(events).includes(BASE), false);
  setAnalyticsAdapter(null);
});

test('native cancellation is neutral and never writes clipboard', async () => {
  const ui = shareUi(); let copied = false;
  const outcome = await shareCard({ title: 'PUZLI', text: 'Wynik', url: BASE }, { ...ui, navigatorObject: {
    share: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); },
    clipboard: { writeText: async () => { copied = true; } }
  } });
  assert.equal(outcome.outcome, 'cancelled');
  assert.equal(copied, false);
  assert.equal(ui.fallback.hidden, true);
  assert.match(ui.status.textContent, /anulowane/);
});

test('clipboard rejection shows usable manual result and link', async () => {
  const ui = shareUi();
  const outcome = await shareCard({ title: 'PUZLI', text: 'Wynik', url: BASE }, { ...ui, navigatorObject: {
    clipboard: { writeText: async () => { throw new Error('denied'); } }
  } });
  assert.equal(outcome.outcome, 'manual');
  assert.equal(ui.fallback.hidden, false);
  assert.equal(ui.field.value, 'Wynik\n' + BASE);
  assert.match(ui.status.textContent, /Skopiuj.*poniżej/);
});

test('sharing identity remains usable when localStorage throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('disabled'); } });
  try {
    const id = sharePublicId();
    assert.match(id, /^[a-zA-Z0-9-]{10,80}$/);
    assert.equal(sharePublicId(), id);
    assert.equal(shareNickname(), '');
    assert.equal(saveShareNickname(' Łucja\n '), 'Łucja');
    assert.equal(shareNickname(), 'Łucja');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage;
  }
});

test('completion keeps session date, finds exact result and does not mislabel a challenge', () => {
  const state = { daily: { date: DATE, requiredGames: ['korony', 'duet'], completedGames: ['korony'] }, puzzleResults: { [record.puzzleId]: record } };
  assert.equal(completionRecord(state, { gameId: 'korony', date: DATE, puzzleId: record.puzzleId }), record);
  assert.equal(completionRecord(state, { gameId: 'korony', date: '2026-10-16', puzzleId: record.puzzleId }), null);
  assert.equal(completionRecord(state, { gameId: 'korony', date: DATE, puzzleId: 'figlo:korony:' + DATE + ':v999' }), null);
  assert.equal(completionRecord(state, { gameId: 'korony', date: DATE, puzzleId: null }), record);
  const historical = buildCompletionView({ state, gameId: 'korony', mode: 'daily', date: DATE, today: '2026-10-16' });
  assert.equal(historical.eyebrow, 'ZESTAW ' + DATE);
  assert.equal(historical.primaryHref, 'index.html#gry');
  const challenge = buildCompletionView({ state, gameId: 'korony', mode: 'challenge', date: DATE });
  assert.equal(challenge.eyebrow, 'WYZWANIE Z LINKU');
  assert.match(challenge.copy, /nie dodaje punktów/);
  const normal = buildCompletionView({ state, gameId: 'korony', mode: 'daily', date: DATE, today: DATE });
  assert.equal(normal.eyebrow, 'DZIEŃ ZALICZONY');
  assert.equal(normal.primaryHref, 'duet.html');
});


test('daily modal and sharing present the first saved result after a second completion', () => {
  const first = { ...record, elapsedMs: 30999, hintsUsed: 2, resets: 1 };
  const state = { puzzleResults: { [record.puzzleId]: first } };
  const persisted = completionRecord(state, { gameId: 'korony', date: DATE, puzzleId: record.puzzleId });
  const label = { textContent: 'Czas' };
  const time = { textContent: '01:00', parentElement: { querySelector: () => label } };
  refreshCompletionTime(time, { mode: 'daily', record: persisted });
  assert.equal(time.textContent, '00:30');
  assert.equal(label.textContent, 'Zapisany wynik');
  const card = gameShareCard({ gameId: 'korony', date: DATE, puzzleId: record.puzzleId, record: persisted, baseUrl: BASE });
  assert.match(card.text, /w 0:30/);
  assert.match(card.text, /Podpowiedzi: 2/);
  assert.doesNotMatch(card.text, /1:00|Bez podpowiedzi/);
  for (const mode of ['training', 'challenge']) {
    time.textContent = '01:00';
    refreshCompletionTime(time, { mode, record: persisted });
    assert.equal(time.textContent, '01:00');
    assert.equal(label.textContent, 'Czas');
  }
});
