import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock { constructor(){this.map=new Map();} getItem(k){return this.map.has(k)?this.map.get(k):null;} setItem(k,v){this.map.set(k,String(v));} removeItem(k){this.map.delete(k);} clear(){this.map.clear();} }
globalThis.localStorage=new LocalStorageMock();
const storage=await import('../src/storage.js');
const {STORAGE_KEY,completeDailyGame,isTodayComplete,loadFigloState,updateFigloSettings}=storage;
const resetStorage=()=>localStorage.clear();

function completeDay(date, order=['korony','duet']) { let result; for(const game of order) result=completeDailyGame(game,{timeMs:60000,today:date}); return result; }

test('fresh launch state starts with two required games',()=>{resetStorage();const state=loadFigloState('2026-08-24');assert.deepEqual(state.daily.requiredGames,['korony','duet']);assert.deepEqual(state.daily.completedGames,[]);assert.equal(isTodayComplete(state),false);});

test('first game gives 1/2 and does not grow streak',()=>{resetStorage();const result=completeDailyGame('korony',{timeMs:120000,today:'2026-08-24'});assert.equal(result.firstGameCompletionToday,true);assert.equal(result.firstDayCompletionToday,false);assert.equal(result.state.user.streak,0);assert.equal(result.state.user.completedDays,0);assert.equal(result.state.user.completedGames,1);assert.deepEqual(result.state.daily.completedGames,['korony']);assert.equal(isTodayComplete(result.state),false);});

test('second different game completes 2/2 and grows streak once',()=>{resetStorage();completeDailyGame('korony',{timeMs:120000,today:'2026-08-24'});const result=completeDailyGame('duet',{timeMs:90000,today:'2026-08-24'});assert.equal(result.firstDayCompletionToday,true);assert.equal(result.state.user.streak,1);assert.equal(result.state.user.completedDays,1);assert.equal(result.state.user.completedGames,2);assert.equal(result.state.games.duet.completedCount,1);assert.equal(isTodayComplete(result.state),true);});

test('reverse completion order also grows streak only at 2/2',()=>{resetStorage();const first=completeDailyGame('duet',{timeMs:90000,today:'2026-08-24'});assert.equal(first.state.user.streak,0);const second=completeDailyGame('korony',{timeMs:120000,today:'2026-08-24'});assert.equal(second.state.user.streak,1);assert.equal(second.firstDayCompletionToday,true);});

test('replays do not increment counters but can improve best time',()=>{resetStorage();completeDay('2026-08-24');const before=loadFigloState('2026-08-24');completeDailyGame('duet',{timeMs:30000,today:'2026-08-24'});completeDailyGame('korony',{timeMs:30000,today:'2026-08-24'});const after=loadFigloState('2026-08-24');assert.equal(after.user.streak,before.user.streak);assert.equal(after.user.completedDays,before.user.completedDays);assert.equal(after.user.completedGames,before.user.completedGames);assert.equal(after.games.duet.bestTimeMs,30000);});

test('consecutive full days increase streak only after both games',()=>{resetStorage();completeDay('2026-08-24');completeDailyGame('korony',{timeMs:60000,today:'2026-08-25'});let mid=loadFigloState('2026-08-25');assert.equal(mid.user.streak,1);const end=completeDailyGame('duet',{timeMs:60000,today:'2026-08-25'});assert.equal(end.state.user.streak,2);assert.deepEqual(end.state.user.completedDates,['2026-08-24','2026-08-25']);});

test('skipping a day resets streak after next full set',()=>{resetStorage();completeDay('2026-08-24');const result=completeDay('2026-08-26');assert.equal(result.state.user.streak,1);assert.equal(result.state.user.completedDays,2);});

test('new date resets daily progress but preserves history',()=>{resetStorage();completeDay('2026-08-24');const next=loadFigloState('2026-08-25');assert.deepEqual(next.daily.completedGames,[]);assert.deepEqual(next.daily.requiredGames,['korony','duet']);assert.equal(next.user.streak,1);assert.equal(next.user.completedDays,1);assert.equal(next.user.completedGames,2);});

test('dates before Duet launch remain Korony-only',()=>{resetStorage();const state=loadFigloState('2026-08-23');assert.deepEqual(state.daily.requiredGames,['korony']);const result=completeDailyGame('korony',{timeMs:60000,today:'2026-08-23'});assert.equal(result.firstDayCompletionToday,true);assert.equal(result.state.user.streak,1);});

test('Auto-X setting persists in unified storage',()=>{resetStorage();updateFigloSettings({autoX:true});const state=loadFigloState('2026-08-24');assert.equal(state.settings.autoX,true);assert.ok(localStorage.getItem(STORAGE_KEY));});
