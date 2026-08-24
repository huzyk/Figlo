import test from 'node:test';
import assert from 'node:assert/strict';
class LocalStorageMock{constructor(){this.map=new Map();}getItem(k){return this.map.has(k)?this.map.get(k):null;}setItem(k,v){this.map.set(k,String(v));}clear(){this.map.clear();}}
globalThis.localStorage=new LocalStorageMock();
const { saveDuetSession, getDuetSession, loadFigloState }=await import('../src/storage.js');

test('Duet session restores board, history and timer',()=>{localStorage.clear();const seed='figlo:duet:2026-08-24:v1';saveDuetSession({date:'2026-08-24',seed,board:Array(36).fill(0).map((v,i)=>i===1?1:v),history:[Array(36).fill(0)],elapsedMs:4200,runningSince:null,finished:false},'2026-08-24');const session=getDuetSession({today:'2026-08-24',seed});assert.equal(session.board[1],1);assert.equal(session.history.length,1);assert.equal(session.elapsedMs,4200);});
test('Duet session is ignored for another seed',()=>{localStorage.clear();saveDuetSession({date:'2026-08-24',seed:'a',board:Array(36).fill(0)},'2026-08-24');assert.equal(getDuetSession({today:'2026-08-24',seed:'b'}),null);});
test('new day clears Duet session but preserves game state',()=>{localStorage.clear();saveDuetSession({date:'2026-08-24',seed:'a',board:Array(36).fill(1)},'2026-08-24');const next=loadFigloState('2026-08-25');assert.equal(next.sessions.duet.date,null);assert.deepEqual(next.sessions.duet.board,[]);assert.deepEqual(next.daily.requiredGames,['korony','duet']);});
