import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompletionEvent, puzzleIdFor } from '../src/domain/completion.js';
import { calculateNextStreak } from '../src/domain/streak.js';
import { getDailyManifest } from '../src/services/daily-service.js';

class LocalStorageMock {
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
  clear(){this.map.clear();}
}
globalThis.localStorage ||= new LocalStorageMock();

const { getIdentity } = await import('../src/services/identity-service.js');

test('puzzle ids are stable and versioned',()=>{
  assert.equal(puzzleIdFor('duet','2026-08-24',2),'duet:2026-08-24:v2');
});

test('completion event is backend-ready and idempotency-ready',()=>{
  const event=createCompletionEvent({gameId:'duet',puzzleId:'duet:2026-08-24:v2',date:'2026-08-24',elapsedMs:12345,eventId:'evt-test'});
  assert.equal(event.eventId,'evt-test');
  assert.equal(event.gameId,'duet');
  assert.equal(event.puzzleId,'duet:2026-08-24:v2');
  assert.equal(event.elapsedMs,12345);
});

test('streak calculation is pure and handles consecutive days',()=>{
  assert.deepEqual(calculateNextStreak({previousStreak:4,bestStreak:7,lastCompletedDate:'2026-08-23',today:'2026-08-24'}),{current:5,best:7});
});

test('anonymous identity is persistent',()=>{
  localStorage.clear();
  const a=getIdentity(); const b=getIdentity();
  assert.equal(a.localId,b.localId); assert.equal(a.type,'anonymous');
});

test('daily manifest service accepts static manifest',async()=>{
  const manifest=await getDailyManifest('2026-08-24',{fetchImpl:async()=>({ok:true,json:async()=>({date:'2026-08-24',games:[{id:'korony',available:true}]})})});
  assert.equal(manifest.games[0].id,'korony');
});
