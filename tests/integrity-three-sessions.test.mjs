import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlokiSession,restoreOrCreateBlokiSession,saveBlokiSession,clearBlokiSession} from '../src/bloki/session.js';
import {createLatarnieSession,loadLatarnieSession,saveLatarnieSession,clearLatarnieSession} from '../src/latarnie/session.js';
import {createSudokuSession,loadSudokuSession,saveSudokuSession,clearSudokuSession} from '../src/sudoku/session.js';

const date='2026-10-15',seed='integrity:v1',puzzle=Array(36).fill(0);
const cases=[
  {name:'Bloki',prefix:'figlo-bloki-session-v1:',create:createBlokiSession,load:restoreOrCreateBlokiSession,save:saveBlokiSession,clear:clearBlokiSession,invalid:{placements:null}},
  {name:'Latarnie',prefix:'figlo-latarnie-session-v1:',create:createLatarnieSession,load:loadLatarnieSession,save:saveLatarnieSession,clear:clearLatarnieSession,invalid:{bulbs:'broken'}},
  {name:'Sudoku',prefix:'puzli_sudoku_session_v2:',create:createSudokuSession,load:loadSudokuSession,save:saveSudokuSession,clear:clearSudokuSession,invalid:{values:null}}
];
const args={date,seed,puzzle};
function useMemoryStorage(){
  const saved=new Map();
  globalThis.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  return saved;
}

for(const spec of cases){
  test(`${spec.name}: a crash restores time at the last save without counting time away`,()=>{
    const saved=useMemoryStorage(),originalNow=Date.now;
    try{
      Date.now=()=>5000;
      const session={...spec.create(args),elapsedMs:700,runningSince:2000,startedAt:'2026-10-15T12:00:00Z',hintsUsed:3,resets:2};
      spec.save(session);
      assert.equal(session.runningSince,2000,'saving must not stop the live timer');
      assert.equal(session.elapsedMs,700,'saving must not count active time twice');
      assert.equal(JSON.parse(saved.get(spec.prefix+date)).runningSince,null);
      Date.now=()=>900000;
      const restored=spec.load(args);
      assert.equal(restored.elapsedMs,3700);
      assert.equal(restored.runningSince,null);
      assert.equal(restored.hintsUsed,3);
      assert.equal(restored.resets,2);
    }finally{Date.now=originalNow;}
  });

  test(`${spec.name}: a paused timer keeps its exact elapsed time`,()=>{
    useMemoryStorage();
    spec.save({...spec.create(args),elapsedMs:900,runningSince:null});
    assert.equal(spec.load(args).elapsedMs,900);
  });

  test(`${spec.name}: corrupt arrays and malformed history cannot break restoration`,()=>{
    const saved=useMemoryStorage();
    saved.set(spec.prefix+date,JSON.stringify({...spec.create(args),...spec.invalid}));
    const fresh=spec.load(args);
    assert.ok(fresh===null||fresh.elapsedMs===0);
    saved.set(spec.prefix+date,JSON.stringify({...spec.create(args),history:[null,{},'broken']}));
    assert.deepEqual(spec.load(args).history,[]);
    saved.set(spec.prefix+date,JSON.stringify({...spec.create(args),date:'2026-10-14'}));
    const otherDay=spec.load(args);
    assert.ok(otherDay===null||otherDay.date===date);
  });

  test(`${spec.name}: denied storage never breaks play or reset`,()=>{
    globalThis.localStorage={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');},removeItem(){throw new Error('denied');}};
    assert.doesNotThrow(()=>spec.load(args));
    assert.equal(spec.save(spec.create(args)),false);
    assert.doesNotThrow(()=>spec.clear(date));
  });
}
