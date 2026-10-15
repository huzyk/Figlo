import test from 'node:test';
import assert from 'node:assert/strict';
import { toGA4Event, visitEvents, activationEvents, analyticsPageUrl } from '../src/services/analytics-metrics.js';

test('analytics maps only explicitly allowed event fields', () => {
  const event = toGA4Event({
    eventName:'game_completed',
    payload:{
      gameId:'zip',mode:'daily',date:'2026-10-14',elapsedMs:93500,hintsUsed:2,
      localId:'private-local-user-id',email:'someone@example.test',puzzleId:'internal:seed',
      eventId:'identifier',url:'https://example.com/?secret=1'
    }
  });
  assert.deepEqual(event,{
    name:'game_completed',
    params:{game_id:'zip',game_mode:'daily',puzzle_date:'2026-10-14',elapsed_seconds:94,hints_used:2}
  });
  assert.ok(!JSON.stringify(event).includes('private-local-user-id'));
  assert.ok(!JSON.stringify(event).includes('example.test'));
});

test('activation retention requires a completion and does not repeat within a day', () => {
  assert.deepEqual(activationEvents({today:'2026-10-15'}), ['player_activated']);
  assert.deepEqual(activationEvents({firstCompletionDay:'2026-10-15',lastActiveDay:'2026-10-15',today:'2026-10-15'}), []);
  assert.deepEqual(activationEvents({firstCompletionDay:'2026-10-15',lastActiveDay:'2026-10-15',today:'2026-10-16'}), ['activation_day_1_return']);
  assert.deepEqual(activationEvents({firstCompletionDay:'2026-10-15',today:'2026-10-22'}), ['activation_day_7_return']);
  assert.deepEqual(activationEvents({firstCompletionDay:'2026-10-15',today:'2026-10-23'}), []);
  assert.deepEqual(activationEvents({today:'invalid'}), []);
});

test('analytics page context strips private ranking payloads, queries and fragments', () => {
  assert.equal(analyticsPageUrl('https://example.test/Figlo/index.html?wynik=private#rywalizacja?wynik=secret'), 'https://example.test/Figlo/index.html');
  assert.equal(analyticsPageUrl(''), '');
  assert.equal(analyticsPageUrl('javascript:alert(1)'), '');
  const event=toGA4Event({eventName:'share_copied',payload:{gameId:'duet',mode:'challenge',nickname:'private',url:'secret'}});
  assert.deepEqual(event,{name:'share_copied',params:{game_id:'duet',game_mode:'challenge'}});
});

test('analytics ignores unknown events and invalid values', () => {
  assert.equal(toGA4Event({ eventName:'unlisted_event',payload:{gameId:'zip'} }),null);
  const mapped=toGA4Event({eventName:'game_started',payload:{
    gameId:'unknown',mode:'invalid',date:'now',elapsedMs:-5,hintsUsed:-2
  }});
  assert.deepEqual(mapped,{name:'game_started',params:{}});
});

test('return visit events distinguish day 1 and day 7 without repeating same-day visits', () => {
  assert.deepEqual(visitEvents({today:'2026-10-14'}),['daily_visit']);
  assert.deepEqual(visitEvents({firstDay:'2026-10-14',lastDay:'2026-10-14',today:'2026-10-14'}),[]);
  assert.deepEqual(visitEvents({firstDay:'2026-10-14',lastDay:'2026-10-14',today:'2026-10-15'}),['daily_visit','day_1_return']);
  assert.deepEqual(visitEvents({firstDay:'2026-10-14',lastDay:'2026-10-20',today:'2026-10-21'}),['daily_visit','day_7_return']);
  assert.deepEqual(visitEvents({firstDay:'2026-10-14',lastDay:'2026-10-20',today:'2026-10-22'}),['daily_visit']);
  assert.deepEqual(visitEvents({firstDay:'2026-10-14',today:'bad-date'}),[]);
});

