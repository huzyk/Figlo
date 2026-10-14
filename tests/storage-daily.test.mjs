import test from 'node:test';
import assert from 'node:assert/strict';
class LocalStorageMock { constructor(){this.map=new Map();} getItem(k){return this.map.has(k)?this.map.get(k):null;} setItem(k,v){this.map.set(k,String(v));} removeItem(k){this.map.delete(k);} clear(){this.map.clear();} }
globalThis.localStorage=new LocalStorageMock();
const storage=await import('../src/storage.js');
const progress=await import('../src/services/progress-service.js');
const {getUserStats}=await import('../src/services/stats-service.js');
const {requiredGamesForDate}=await import('../src/daily-games.js');
const {STORAGE_KEY,isTodayComplete,loadFigloState,updateFigloSettings}=storage;
const resetStorage=()=>localStorage.clear();
const complete=(game,date,timeMs=60000)=>progress.completeGame({gameId:game,puzzleId:`${game}:${date}:v1`,date,elapsedMs:timeMs,mode:'daily'});
function completeDay(date,order=requiredGamesForDate(date)){let result;for(const game of order)result=complete(game,date);return result;}
test('Duet launch state starts with two required games',()=>{resetStorage();const state=loadFigloState('2026-08-24');assert.deepEqual(state.daily.requiredGames,['korony','duet']);assert.deepEqual(state.daily.completedGames,[]);assert.equal(isTodayComplete(state),false);});
test('first game gives 1/2 and does not grow streak',()=>{resetStorage();const result=complete('korony','2026-08-24',120000);assert.equal(result.firstGameCompletionToday,true);assert.equal(result.firstDayCompletionToday,false);assert.equal(result.state.user.streak,0);assert.equal(result.state.user.completedDays,0);assert.equal(result.state.user.completedGames,1);assert.deepEqual(result.state.daily.completedGames,['korony']);assert.equal(isTodayComplete(result.state),false);});
test('second different game completes 2/2 before Bloki launch',()=>{resetStorage();complete('korony','2026-08-24',120000);const result=complete('duet','2026-08-24',90000);assert.equal(result.firstDayCompletionToday,true);assert.equal(result.state.user.streak,1);assert.equal(result.state.user.completedDays,1);assert.equal(result.state.user.completedGames,2);assert.equal(result.state.games.duet.completedCount,1);assert.equal(isTodayComplete(result.state),true);});
test('Bloki and Latarnie launch together and require 4/4',()=>{resetStorage();complete('korony','2026-08-25');complete('duet','2026-08-25');complete('bloki','2026-08-25');let state=loadFigloState('2026-08-25');assert.deepEqual(state.daily.requiredGames,['korony','duet','bloki','latarnie']);assert.equal(isTodayComplete(state),false);assert.ok(state.games.latarnie);const result=complete('latarnie','2026-08-25',75000);assert.equal(result.firstDayCompletionToday,true);assert.equal(result.state.user.streak,1);assert.equal(result.state.games.bloki.completedCount,1);assert.equal(result.state.games.latarnie.completedCount,1);assert.equal(result.state.games.latarnie.bestTimeMs,75000);assert.equal(isTodayComplete(result.state),true);});
test('replays do not increment counters or improve daily best time',()=>{resetStorage();completeDay('2026-08-24');const before=loadFigloState('2026-08-24');complete('duet','2026-08-24',30000);complete('korony','2026-08-24',30000);const after=loadFigloState('2026-08-24');assert.equal(after.user.streak,before.user.streak);assert.equal(after.user.completedDays,before.user.completedDays);assert.equal(after.user.completedGames,before.user.completedGames);assert.equal(after.games.duet.bestTimeMs,60000);assert.equal(after.games.korony.bestTimeMs,60000);});
test('training completion never mutates Daily progress or stats',()=>{resetStorage();const before=loadFigloState('2026-08-25');const result=progress.completeGame({gameId:'korony',puzzleId:'training-1',date:'2026-08-25',elapsedMs:15000,mode:'training'});const after=loadFigloState('2026-08-25');assert.deepEqual(after.daily.completedGames,before.daily.completedGames);assert.equal(after.user.completedGames,before.user.completedGames);assert.equal(after.games.korony.completedCount,before.games.korony.completedCount);assert.equal(after.games.korony.bestTimeMs,before.games.korony.bestTimeMs);assert.equal(result.firstGameCompletionToday,false);assert.equal(result.firstDayCompletionToday,false);});
test('consecutive full days increase streak only after all required games',()=>{resetStorage();completeDay('2026-08-24');complete('korony','2026-08-25');complete('duet','2026-08-25');complete('bloki','2026-08-25');let mid=loadFigloState('2026-08-25');assert.equal(mid.user.streak,1);const end=complete('latarnie','2026-08-25');assert.equal(end.state.user.streak,2);assert.deepEqual(end.state.user.completedDates,['2026-08-24','2026-08-25']);});
test('skipping a day resets streak after next full set',()=>{resetStorage();completeDay('2026-08-24');const result=completeDay('2026-08-26');assert.equal(result.state.user.streak,1);assert.equal(result.state.user.completedDays,2);});
test('new date resets daily progress and switches to four games',()=>{resetStorage();completeDay('2026-08-24');const next=loadFigloState('2026-08-25');assert.deepEqual(next.daily.completedGames,[]);assert.deepEqual(next.daily.requiredGames,['korony','duet','bloki','latarnie']);assert.equal(next.user.streak,1);assert.equal(next.user.completedDays,1);assert.equal(next.user.completedGames,2);});
test('dates before Duet launch remain Korony-only',()=>{resetStorage();const state=loadFigloState('2026-08-23');assert.deepEqual(state.daily.requiredGames,['korony']);const result=complete('korony','2026-08-23');assert.equal(result.firstDayCompletionToday,true);assert.equal(result.state.user.streak,1);});
test('Auto-X setting persists in unified storage',()=>{resetStorage();updateFigloSettings({autoX:true});const state=loadFigloState('2026-08-24');assert.equal(state.settings.autoX,true);assert.ok(localStorage.getItem(STORAGE_KEY));});

test('Zip starts with statistics and older states gain its entry',()=>{
  resetStorage();
  const state=loadFigloState('2026-10-14');
  assert.equal(state.games.zip.completedCount,0);
  delete state.games.zip;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  assert.equal(loadFigloState('2026-10-14').games.zip.completedCount,0);
  completeDay('2026-10-14');
  assert.equal(loadFigloState('2026-10-14').games.zip.completedCount,1);
});

test('visible streak expires after missing a whole day, but best streak remains',()=>{
  resetStorage();
  completeDay('2026-10-14');
  assert.equal(getUserStats('2026-10-14').streak,1);
  assert.equal(getUserStats('2026-10-15').streak,1);
  assert.equal(getUserStats('2026-10-16').streak,0);
  assert.equal(getUserStats('2026-10-16').bestStreak,1);
  completeDay('2026-10-16');
  assert.equal(getUserStats('2026-10-16').streak,1);
});

test('Sudoku is added without deleting five-game saves, and full days require 6/6',()=>{
  resetStorage();
  const old=loadFigloState('2026-10-13');
  old.daily={date:'2026-10-14',requiredGames:['korony','duet','bloki','latarnie','zip'],completedGames:[]};
  delete old.games.sudoku;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(old));
  const migrated=loadFigloState('2026-10-14');
  assert.equal(migrated.games.sudoku.completedCount,0);
  assert.equal(migrated.daily.requiredGames.length,6);
  for(const name of ['korony','duet','bloki','latarnie','zip'])complete(name,'2026-10-14');
  assert.equal(isTodayComplete(loadFigloState('2026-10-14')),false);
  const result=complete('sudoku','2026-10-14',120000);
  assert.equal(result.firstDayCompletionToday,true);
  assert.equal(result.state.games.sudoku.completedCount,1);
  assert.equal(result.state.user.completedGames,6);
  assert.equal(result.state.user.completedDays,1);
});
test('new sixth game does not count the same day twice for returning 5/5 players',()=>{
  resetStorage();
  const state=loadFigloState('2026-10-14');
  state.daily.completedGames=['korony','duet','bloki','latarnie','zip'];
  state.user={...state.user,streak:3,bestStreak:3,completedDays:3,
    lastCompletedDate:'2026-10-14',completedDates:['2026-10-14']};
  state.user.completedGames=5;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  const result=complete('sudoku','2026-10-14');
  assert.equal(result.firstDayCompletionToday,false);
  assert.equal(result.state.user.completedDays,3);
  assert.equal(result.state.user.streak,3);
  assert.equal(result.state.user.completedGames,6);
  assert.equal(isTodayComplete(result.state),true);
});
