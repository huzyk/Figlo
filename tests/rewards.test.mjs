import test from 'node:test';
import assert from 'node:assert/strict';
import { getPuzliIQ, getRank, getBadges, getWeekKey, weeklyPoints } from '../src/domain/rewards.js';
import { completeDailyGame, loadFigloState, recordDailyHint } from '../src/storage.js';

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
  assert.equal(result.state.rewards.totalPoints, 120);
  for (const game of games.slice(1)) result = completeDailyGame(game,{today:date,timeMs:50000});
  assert.equal(result.state.user.streak, 1);
  assert.equal(result.state.user.completedDays, 1);
  assert.equal(result.state.rewards.daily[date].bonus, 80);
  assert.equal(result.state.rewards.totalPoints, 800);
  assert.equal(result.state.rewards.cleanSets, 1);
  completeDailyGame('zip',{today:date,timeMs:1000});
  assert.equal(loadFigloState(date).rewards.totalPoints, 800);
});
test('tracked hint removes only clean-play bonus and is kept across repeated hints', () => {
  reset();
  assert.equal(recordDailyHint('duet',date),true);
  assert.equal(recordDailyHint('duet',date),true);
  const result=completeDailyGame('duet',{today:date});
  assert.equal(result.state.rewards.daily[date].games.duet.points,100);
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
  assert.equal(weeklyPoints(loadFigloState('2026-10-19'),'2026-10-15'),240);
  assert.equal(weeklyPoints(loadFigloState('2026-10-19'),'2026-10-19'),120);
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
  assert.equal(result.state.rewards.totalPoints,100);
  assert.equal(result.state.rewards.cleanGames,0);
  assert.equal(result.state.puzzleResults['korony:'+date+':v1'].hintsUsed,null);
  assert.deepEqual(result.state.rewards.lastAward.badges,['first-game']);
  for(const game of games.slice(1)) result=completeDailyGame(game,{today:date,hintsUsed:0});
  assert.equal(result.state.rewards.totalPoints,780);
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
  assert.equal(result.state.rewards.totalPoints,800);
  assert.equal(result.state.rewards.cleanGames,6);
  assert.equal(result.state.rewards.cleanSets,1);
  assert.equal(getBadges(result.state).find(b=>b.id==='clean-set').earned,true);
  assert.deepEqual(result.state.rewards.lastAward.badges,['first-set','clean-set']);
});
