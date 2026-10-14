import test from 'node:test';
import assert from 'node:assert/strict';
import { toGA4Event, visitEvents } from '../src/services/analytics-metrics.js';

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
