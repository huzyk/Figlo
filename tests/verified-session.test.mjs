import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedBackendEnabled,beginVerifiedAttempt,registerVerifiedHint,
  finishVerifiedAttempt,getVerifiedLeaderboard} from '../src/services/verified-game-api.js';
import {notifyVerifiedEvent,submitVerifiedCompletion} from '../src/services/verified-session.js';
test('backend guard disables all network activity and preserves guest play',async()=>{
  assert.equal(verifiedBackendEnabled,false);
  assert.deepEqual(await beginVerifiedAttempt('id'),{available:false});
  assert.deepEqual(await registerVerifiedHint('id'),{available:false});
  assert.deepEqual(await finishVerifiedAttempt('id',[]),{available:false});
  assert.deepEqual(await getVerifiedLeaderboard('week','2026-10-16'),{available:false,entries:[]});
  notifyVerifiedEvent('hint_used',{gameId:'korony',puzzleId:'puzzle',date:'2026-10-16',mode:'daily'});
  assert.equal(submitVerifiedCompletion({gameId:'korony',puzzleId:'puzzle',date:'2026-10-16',mode:'daily'},[0,1]),false);
});
