import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredGamesForDate } from '../src/daily-games.js';
import { getDailyGame, getDailyManifest } from '../src/services/daily-service.js';
import { GAME_IDS, targetSeconds, validateSolvedProof } from '../src/domain/seasonal-scoring.js';
import { completeDailyGame,loadFigloState } from '../src/storage.js';

class Store {
  constructor(){this.map=new Map();}
  getItem(key){return this.map.get(key)||null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
  clear(){this.map.clear();}
}
globalThis.localStorage=new Store();

test('Memory enters six-game Daily on launch date without rewriting historic requirements',()=>{
  assert.deepEqual(requiredGamesForDate('2026-10-19'),
    ['korony','duet','bloki','latarnie','zip','sudoku']);
  assert.deepEqual(requiredGamesForDate('2026-10-20'),
    ['korony','duet','bloki','memory','zip','sudoku']);
  assert.equal(requiredGamesForDate('2027-01-01').length,6);
  assert.ok(GAME_IDS.includes('memory'));
  assert.equal(targetSeconds('memory'),100);
});

test('Memory has canonical deterministic Daily deck, pack and puzzle ID',async()=>{
  const a=await getDailyGame('memory','2026-10-20');
  const b=await getDailyGame('memory','2026-10-20');
  assert.equal(a.puzzleId,'memory:2026-10-20:v1');
  assert.equal(a.packId,'discoveries');
  assert.deepEqual(a.solution,b.solution);
  assert.equal(a.solution.length,16);
  assert.equal(new Set(a.solution).size,8);
  assert.equal((await getDailyGame('memory','2026-10-22')).packId,'cosmos');
  const fetchImpl=async()=>({ok:false});
  const manifest=await getDailyManifest('2026-10-20',{fetchImpl});
  assert.deepEqual(manifest.games.map(g=>g.id),
    ['korony','duet','bloki','memory','zip','sudoku']);
  assert.equal(manifest.games.find(g=>g.id==='memory').puzzleId,a.puzzleId);
});

test('Memory Daily completion persists without altering historical Latarnie progress',()=>{
  localStorage.clear();
  completeDailyGame('latarnie',{today:'2026-10-19',timeMs:270000,hintsUsed:0});
  const first=completeDailyGame('memory',{today:'2026-10-20',
    puzzleId:'memory:2026-10-20:v1',timeMs:100000,hintsUsed:0});
  assert.ok(first.firstGameCompletionToday);
  assert.equal(first.state.games.memory.completedCount,1);
  assert.equal(first.state.rewards.daily['2026-10-20'].games.memory.points,20);
  const again=completeDailyGame('memory',{today:'2026-10-20',
    puzzleId:'memory:2026-10-20:v1',timeMs:3000,hintsUsed:0});
  assert.equal(again.firstGameCompletionToday,false);
  assert.equal(again.state.games.memory.completedCount,1);
  const historical=loadFigloState('2026-10-19');
  assert.ok(historical.daily.completedGames.includes('latarnie'));
  assert.ok(!historical.daily.requiredGames.includes('memory'));
  assert.deepEqual(loadFigloState('2026-10-20').daily.completedGames,['memory']);
  assert.equal(loadFigloState('2026-10-20').daily.requiredGames.length,6);
});

test('memory completion proof accepts only eight true unique pairs',async()=>{
  const deck=(await getDailyGame('memory','2026-10-20')).solution;
  const bySymbol=new Map();
  deck.forEach((symbol,index)=>{
    const positions=bySymbol.get(symbol)||[];
    positions.push(index);
    bySymbol.set(symbol,positions);
  });
  const ordered=[...bySymbol.values()].flat();
  assert.equal(validateSolvedProof('memory',ordered,deck),true);
  assert.equal(validateSolvedProof('memory',[...ordered.slice(0,14),ordered[0],ordered[15]],deck),false);
  assert.equal(validateSolvedProof('memory',[ordered[0],ordered[2],...ordered.slice(2)],deck),false);
  assert.equal(validateSolvedProof('memory',ordered.map(String),deck),false);
});
