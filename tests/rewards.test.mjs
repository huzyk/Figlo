import test from 'node:test';
import assert from 'node:assert/strict';
import { getPuzliIQ, getRank, getBadges, getWeekKey, weeklyPoints, migrateRewardsScoring } from '../src/domain/rewards.js';
import { completeDailyGame, loadFigloState, recordDailyHint } from '../src/storage.js';
import { calculateVerifiedPoints, speedPoints, targetSeconds } from '../src/domain/seasonal-scoring.js';

class Store {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v) { this.map.set(k,String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new Store();
const date = '2026-10-15';
const games = ['korony','duet','bloki','latarnie','zip','sudoku'];
function reset() { localStorage.clear(); }

test('new player starts at PUZLI IQ 100 and rank Nowicjusz', () => {
  reset();
  const state = loadFigloState(date);
  assert.equal(getPuzliIQ(state), 100);
  assert.equal(getRank(100).name, 'Nowicjusz');
  assert.equal(state.rewards.totalPoints, 0);
});
test('one game counts as an active day, not as a full set; bonus applies once', () => {
  reset();
  let result = completeDailyGame('korony',{today:date,timeMs:40000});
  assert.equal(result.state.user.activeStreak, 1);
  assert.equal(result.state.user.streak, 0);
  assert.equal(result.state.rewards.totalPoints, 24);
  for (const game of games.slice(1)) result = completeDailyGame(game,{today:date,timeMs:50000});
  assert.equal(result.state.user.streak, 1);
  assert.equal(result.state.user.completedDays, 1);
  assert.equal(result.state.rewards.daily[date].bonus, 20);
  assert.equal(result.state.rewards.totalPoints, 162);
  assert.equal(result.state.rewards.cleanSets, 1);
  completeDailyGame('zip',{today:date,timeMs:1000});
  assert.equal(loadFigloState(date).rewards.totalPoints, 162);
});
test('tracked hint removes only clean-play bonus and is kept across repeated hints', () => {
  reset();
  assert.equal(recordDailyHint('duet',date),true);
  assert.equal(recordDailyHint('duet',date),true);
  const result=completeDailyGame('duet',{today:date});
  assert.equal(result.state.rewards.daily[date].games.duet.points,10);
  assert.equal(result.state.rewards.daily[date].games.duet.hintsUsed,2);
  assert.equal(result.state.rewards.cleanGames,0);
  assert.equal(recordDailyHint('duet',date),false);
});
test('training does not affect reward state', async () => {
  reset();
  const {completeGame} = await import('../src/services/progress-service.js');
  completeGame({gameId:'korony',puzzleId:'training-1',date,mode:'training'});
  assert.equal(loadFigloState(date).rewards.totalPoints,0);
});
test('active streak survives partial days and resets on a gap, full-set streak remains separate', () => {
  reset();
  completeDailyGame('korony',{today:'2026-10-15'});
  completeDailyGame('korony',{today:'2026-10-16'});
  assert.equal(loadFigloState('2026-10-16').user.activeStreak,2);
  completeDailyGame('korony',{today:'2026-10-18'});
  assert.equal(loadFigloState('2026-10-18').user.activeStreak,1);
  assert.equal(loadFigloState('2026-10-18').user.streak,0);
});
test('weekly results begin on Monday and are isolated from the next week', () => {
  reset();
  completeDailyGame('korony',{today:'2026-10-15'});
  completeDailyGame('korony',{today:'2026-10-18'});
  completeDailyGame('korony',{today:'2026-10-19'});
  assert.equal(getWeekKey(date),'2026-10-12');
  assert.equal(weeklyPoints(loadFigloState('2026-10-19'),'2026-10-15'),30);
  assert.equal(weeklyPoints(loadFigloState('2026-10-19'),'2026-10-19'),15);
});
test('existing v2 state migrates new fields without destroying legacy progress', () => {
  reset();
  const state = loadFigloState('2026-10-15');
  state.user.streak=4;
  state.user.bestStreak=5;
  state.user.completedDates=['2026-10-14'];
  state.user.lastCompletedDate='2026-10-14';
  delete state.user.activeStreak;
  delete state.user.activeDates;
  delete state.user.lastActiveDate;
  delete state.user.bestActiveStreak;
  delete state.rewards;
  localStorage.setItem('figlo_user_state_v2',JSON.stringify(state));
  const restored=loadFigloState('2026-10-15');
  assert.equal(restored.user.streak,4);
  assert.equal(restored.user.activeStreak,4);
  assert.equal(restored.user.activeDates[0],'2026-10-14');
  assert.equal(restored.rewards.totalPoints,0);
});
test('badges unlock automatically from real state', () => {
  reset();
  completeDailyGame('korony',{today:date});
  const earned=getBadges(loadFigloState(date)).filter(b=>b.earned).map(b=>b.id);
  assert.ok(earned.includes('first-game'));
  assert.ok(!earned.includes('first-set'));
});

test('all nine achievements have distinct IDs, correct thresholds and stable progress', () => {
  reset();
  const state=loadFigloState(date);
  const checks=[
    {id:'first-game', field:'completedGames', threshold:1},
    {id:'first-set', field:'completedDays', threshold:1},
    {id:'games-25', field:'completedGames', threshold:25},
    {id:'active-7', field:'bestActiveStreak', threshold:7},
    {id:'sets-7', field:'completedDays', threshold:7},
    {id:'games-100', field:'completedGames', threshold:100},
    {id:'sets-30', field:'completedDays', threshold:30},
  ];
  assert.equal(new Set(getBadges(state).map(b=>b.id)).size,9);
  assert.ok(getBadges(state).every(b=>!b.earned));
  for(const check of checks){
    const current=structuredClone(state);
    current.user[check.field]=check.threshold-1;
    assert.equal(getBadges(current).find(b=>b.id===check.id).earned,false,check.id+' before threshold');
    current.user[check.field]=check.threshold;
    assert.equal(getBadges(current).find(b=>b.id===check.id).earned,true,check.id+' at threshold');
  }
  const clean=structuredClone(state);
  clean.rewards.cleanSets=1;
  assert.equal(getBadges(clean).find(b=>b.id==='clean-set').earned,true);
  assert.equal(getBadges(state).find(b=>b.id==='clean-set').earned,false);
  const master=structuredClone(state);
  master.user.completedGames=100;
  master.user.completedDays=36;
  master.rewards.cleanGames=100;
  assert.equal(getPuzliIQ(master),143);
  assert.equal(getRank(getPuzliIQ(master)).name,'Mistrz');
  assert.equal(getBadges(master).find(b=>b.id==='master').earned,true);
  assert.equal(getBadges(state).find(b=>b.id==='master').earned,false);
});

test('seven total daily sets earn the badge even without a seven-day streak', () => {
  reset();
  const state=loadFigloState(date);
  state.user.completedDays=7;
  state.user.bestActiveStreak=1;
  const badges=getBadges(state);
  assert.equal(badges.find(b=>b.id==='sets-7').earned,true);
  assert.match(badges.find(b=>b.id==='sets-7').name,/Siedem kompletów/);
  assert.equal(badges.find(b=>b.id==='active-7').earned,false);
});

test('unknown hint history cannot produce a clean game, clean set or clean badge', () => {
  reset();
  let result=completeDailyGame('korony',{today:date,hintsUsed:null});
  assert.equal(result.state.rewards.totalPoints,10);
  assert.equal(result.state.rewards.cleanGames,0);
  assert.equal(result.state.puzzleResults['korony:'+date+':v1'].hintsUsed,null);
  assert.deepEqual(result.state.rewards.lastAward.badges,['first-game']);
  for(const game of games.slice(1)) result=completeDailyGame(game,{today:date,hintsUsed:0});
  assert.equal(result.state.rewards.totalPoints,105);
  assert.equal(result.state.rewards.cleanGames,5);
  assert.equal(result.state.rewards.cleanSets,0);
  assert.equal(result.state.rewards.daily[date].games.korony.hintsUsed,null);
  assert.equal(getBadges(result.state).find(b=>b.id==='clean-set').earned,false);
  assert.deepEqual(result.state.rewards.lastAward.badges,['first-set']);
});

test('a confirmed zero hint count earns clean-game and full-set achievements', () => {
  reset();
  let result;
  for(const game of games) result=completeDailyGame(game,{today:date,hintsUsed:0});
  assert.equal(result.state.rewards.totalPoints,110);
  assert.equal(result.state.rewards.cleanGames,6);
  assert.equal(result.state.rewards.cleanSets,1);
  assert.equal(getBadges(result.state).find(b=>b.id==='clean-set').earned,true);
  assert.deepEqual(result.state.rewards.lastAward.badges,['first-set','clean-set']);
});

test('speed bonus varies with elapsed time and matches future server formula', () => {
  reset();
  const secs = targetSeconds('korony');
  assert.equal(secs, 240);
  const veryFast = calculateVerifiedPoints({ elapsedMs: 40000, targetSecs: secs, hintsUsed: 0 });
  const medium = calculateVerifiedPoints({ elapsedMs: 240000, targetSecs: secs, hintsUsed: 0 });
  const slow = calculateVerifiedPoints({ elapsedMs: 600000, targetSecs: secs, hintsUsed: 0 });
  assert.deepEqual(veryFast, { base: 10, speed: 9, clean: 5, total: 24 });
  assert.ok(medium.speed < veryFast.speed);
  assert.equal(slow.speed, 0);
  assert.equal(speedPoints(null, secs), 0);
  assert.equal(speedPoints(1000, secs), 0);
  const real = completeDailyGame('korony',{ today:date,timeMs:240000,hintsUsed:0 });
  const scored = real.state.rewards.daily[date].games.korony;
  assert.equal(scored.points, medium.total);
  assert.equal(scored.speed, medium.speed);
  assert.equal(scored.clean, 5);
  completeDailyGame('korony',{today:date,timeMs:10000,hintsUsed:0});
  assert.equal(loadFigloState(date).rewards.daily[date].games.korony.points, medium.total);
});

test('old 800-point browser ledger migrates once; keep badges and historic times', () => {
  reset();
  let result;
  for (const game of games) result=completeDailyGame(game,{today:date,timeMs:90000,hintsUsed:0});
  const old=result.state;
  old.rewards.scoringVersion=undefined;
  old.rewards.totalPoints=800;
  old.rewards.daily[date].bonus=80;
  old.rewards.daily[date].total=800;
  for(const game of games){
    old.rewards.daily[date].games[game].points=120;
    delete old.rewards.daily[date].games[game].base;
    delete old.rewards.daily[date].games[game].speed;
    delete old.rewards.daily[date].games[game].clean;
  }
  localStorage.setItem('figlo_user_state_v2',JSON.stringify(old));
  const migrated=loadFigloState(date);
  assert.equal(migrated.rewards.scoringVersion,3);
  assert.equal(migrated.rewards.legacyTotalPoints,800);
  assert.equal(migrated.rewards.daily[date].bonus,20);
  assert.ok(migrated.rewards.totalPoints<=170);
  assert.equal(migrated.rewards.totalPoints,migrated.rewards.daily[date].total);
  assert.equal(migrated.rewards.cleanSets,1);
  assert.equal(migrated.user.completedDays,1);
  assert.deepEqual(loadFigloState(date).rewards.daily[date],migrated.rewards.daily[date]);
  completeDailyGame('korony',{today:date,timeMs:3000});
  assert.equal(loadFigloState(date).rewards.totalPoints,migrated.rewards.totalPoints);
});

test('migration never invents a speed or clean bonus for missing historic evidence',()=>{
  const legacy={totalPoints:220,daily:{'2026-10-15':{games:{
    korony:{points:120,hintsUsed:null},duet:{points:100,hintsUsed:2}
  },bonus:0,total:220}}};
  migrateRewardsScoring(legacy,{});
  assert.equal(legacy.totalPoints,20);
  assert.equal(legacy.daily['2026-10-15'].games.korony.speed,0);
  assert.equal(legacy.daily['2026-10-15'].games.korony.clean,0);
  assert.equal(legacy.daily['2026-10-15'].games.duet.points,10);
  assert.equal(legacy.legacyTotalPoints,220);
  migrateRewardsScoring(legacy,{});
  assert.equal(legacy.totalPoints,20);
});

test('new scoring detects a legacy game from another browser tab without corrupting recent scores',()=>{
  const modern={scoringVersion:2,totalPoints:25,cleanGames:1,cleanSets:0,
    daily:{'2026-10-15':{games:{
      korony:{points:25,base:10,speed:10,clean:5,hintsUsed:0,elapsedMs:20000,scoringVersion:1},
      duet:{points:120,hintsUsed:0}
    },bonus:0,total:145}}};
  migrateRewardsScoring(modern,{
    'duet:2026-10-15:v1':{gameId:'duet',date:'2026-10-15',mode:'daily',elapsedMs:240000}
  });
  assert.equal(modern.daily['2026-10-15'].games.korony.points,25);
  assert.equal(modern.daily['2026-10-15'].games.duet.points,19);
  assert.equal(modern.daily['2026-10-15'].total,44);
  assert.equal(modern.totalPoints,44);
  assert.equal(modern.daily['2026-10-15'].games.duet.speed,4);
  assert.equal(modern.scoringVersion,3);
});


test('speed calibration distinguishes 30 from 90 seconds, on every game', () => {
  const sample = {};
  for(const game of games) {
    const target = targetSeconds(game);
    const scores = [3000,15000,30000,60000,90000,120000,180000,300000,600000,1200000]
      .map(ms => speedPoints(ms,target));
    assert.ok(scores.every(n => Number.isInteger(n) && n >= 0 && n <= 10),game);
    assert.ok(scores.every((n,i) => !i || n <= scores[i-1]),game+' monotonic');
    sample[game] = [speedPoints(30000,target),speedPoints(90000,target)];
    assert.ok(sample[game][0] > sample[game][1],game+' 30s should beat 90s');
  }
  assert.deepEqual(sample.duet,[9,7]);
  assert.deepEqual(sample.sudoku,[10,7]);
  assert.equal(speedPoints(2999,targetSeconds('duet')),0);
  assert.equal(speedPoints(3000,targetSeconds('duet')),10);
  assert.equal(speedPoints(30000,targetSeconds('duet', 'hard')),9);
  assert.equal(speedPoints(30000,targetSeconds('duet', 'gentle')),9);
});

test('v2 point records migrate to v3 from their original elapsedMs, without double-counting', () => {
  const old = {scoringVersion:2,totalPoints:50,cleanGames:2,cleanSets:0,
    daily:{'2026-10-15':{games:{
      duet:{points:25,base:10,speed:10,clean:5,elapsedMs:30000,hintsUsed:0,scoringVersion:1},
      sudoku:{points:25,base:10,speed:10,clean:5,elapsedMs:120000,hintsUsed:0,scoringVersion:1}
    },bonus:0,total:50}}};
  migrateRewardsScoring(old,{});
  assert.equal(old.scoringVersion,3);
  assert.equal(old.daily['2026-10-15'].games.duet.speed,9);
  assert.equal(old.daily['2026-10-15'].games.sudoku.speed,7);
  assert.equal(old.daily['2026-10-15'].total,46);
  assert.equal(old.totalPoints,46);
  assert.equal(old.daily['2026-10-15'].games.sudoku.scoringVersion,2);
  const after=structuredClone(old);
  migrateRewardsScoring(old,{});
  assert.deepEqual(old,after);
});

test('v3 migration never assumes a fast solve when elapsed time is missing',()=>{
  const old = {scoringVersion:2,totalPoints:25,daily:{'2026-10-15':{
    games:{duet:{points:25,base:10,speed:10,clean:5,elapsedMs:null,hintsUsed:0,scoringVersion:1}},
    bonus:0,total:25}}};
  migrateRewardsScoring(old,{});
  assert.equal(old.daily['2026-10-15'].games.duet.speed,0);
  assert.equal(old.daily['2026-10-15'].total,15);
});
