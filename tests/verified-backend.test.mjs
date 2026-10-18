import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {calculateVerifiedPoints,speedPoints,periodStart,validateSolvedProof,
  targetSeconds,GAME_IDS} from '../src/domain/seasonal-scoring.js';
import {parseArgs,makeCanonicalRecord,plusDays} from '../scripts/seed-verified-puzzles.mjs';

test('competitive scoring ranges from 10 to 25 per game, 170 per day',()=>{
  assert.equal(calculateVerifiedPoints({elapsedMs:15000,targetSecs:240,hintsUsed:0}).total,25);
  assert.equal(calculateVerifiedPoints({elapsedMs:900000,targetSecs:180,hintsUsed:1}).total,10);
  assert.equal(speedPoints(240000,240),5);
  assert.equal(speedPoints(30000,targetSeconds('duet')),9);
  assert.equal(speedPoints(90000,targetSeconds('duet')),7);
  assert.equal(speedPoints(60000,targetSeconds('sudoku')),9);
  assert.equal(6*25+20,170);
  assert.throws(()=>calculateVerifiedPoints({elapsedMs:1000,targetSecs:240,hintsUsed:0}));
  assert.throws(()=>calculateVerifiedPoints({elapsedMs:10000,targetSecs:240,hintsUsed:null}));
  assert.equal(targetSeconds('korony','gentle'),180);
  assert.equal(targetSeconds('zip','hard'),252);
});
test('weekly, monthly and yearly boundaries handle cross-year and leap days',()=>{
  assert.equal(periodStart('2026-10-16','week'),'2026-10-12');
  assert.equal(periodStart('2027-01-01','week'),'2026-12-28');
  assert.equal(periodStart('2026-10-16','month'),'2026-10-01');
  assert.equal(periodStart('2026-10-16','year'),'2026-01-01');
  assert.equal(periodStart('2026-10-16','all'),'2026-01-01');
  assert.throws(()=>periodStart('2026-02-30','week'));
  assert.equal(plusDays('2026-12-31',1),'2027-01-01');
});
test('submitted solutions must match their canonical puzzle, irrespective of allowed ordering',()=>{
  const crown=[0,11,22,33,44,55,66,77,80];
  assert.equal(validateSolvedProof('korony',[...crown].reverse(),crown),true);
  assert.equal(validateSolvedProof('korony',[0,0,...crown.slice(2)],crown),false);
  assert.equal(validateSolvedProof('duet',[1,2,1],[1,2,1]),true);
  assert.equal(validateSolvedProof('duet',[1,2,2],[1,2,1]),false);
  assert.equal(validateSolvedProof('latarnie',[9,4,6],[4,6,9]),true);
  assert.equal(validateSolvedProof('zip',[0,1,2],[0,2,1]),false);
  assert.equal(validateSolvedProof('sudoku',[1,2,3],[1,3,2]),false);
  const blocks=[{clueId:'b1',rect:{row:0,col:0,width:2,height:2}},
    {clueId:'b2',rect:{row:0,col:2,width:2,height:2}}];
  assert.equal(validateSolvedProof('bloki',[...blocks].reverse(),blocks),true);
  assert.equal(validateSolvedProof('bloki',[{...blocks[0],rect:{...blocks[0].rect,width:3}},blocks[1]],blocks),false);
  assert.equal(validateSolvedProof('bloki',[null,blocks[1]],blocks),false);
  for(const game of GAME_IDS)assert.equal(validateSolvedProof(game,Array(101).fill(1),Array(101).fill(1)),false);
});
test('canonical seeder uses published versioned Daily IDs',async()=>{
  assert.deepEqual(parseArgs(['--start','2026-10-16','--days','7']),{start:'2026-10-16',days:7,upload:false});
  assert.throws(()=>parseArgs(['--start','2026-02-30']));
  assert.throws(()=>parseArgs(['--days','90']));
  const duet=await makeCanonicalRecord('duet','2026-10-16');
  assert.equal(duet.puzzle_id,'duet:2026-10-16:v4');
  assert.equal(duet.solution.length,36);
  const sudoku=await makeCanonicalRecord('sudoku','2026-10-16');
  assert.equal(sudoku.puzzle_id,'sudoku:2026-10-16:v2');
  assert.equal(sudoku.solution.length,36);
});
test('Postgres blocks client writes, hides private data, and serializes score completion',async()=>{
  const db=new PGlite();
  const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
  try{
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth;");
    await db.exec("create table auth.users(id uuid primary key); insert into auth.users values ('"+alice+"'),('"+bob+"');");
    await db.exec("create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;");
    await db.exec("create function public.account_session_active() returns boolean language sql stable as $$select auth.uid() is not null$$;");
    await db.exec(await readFile(new URL('../supabase/migrations/202610160002_verified_scores.sql',import.meta.url),'utf8'));
    const date=(await db.query("select (now() at time zone 'Europe/Warsaw')::date::text as date")).rows[0].date;
    const id='korony:'+date+':v-test';
    await db.query('insert into public.puzli_puzzles(puzzle_id,puzzle_date,game_id,difficulty,target_seconds,solution) values ($1,$2,$3,$4,$5,$6)',[id,date,'korony','easy',200,JSON.stringify([1,2,3])]);
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:alice})]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.puzli_puzzles'));
    await assert.rejects(db.query('insert into public.puzli_verified_results(user_id,puzzle_id,game_id,puzzle_date,elapsed_ms,hints_used,base_points,speed_points,clean_points) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[alice,id,'korony',date,100000,0,10,10,5]));
    await assert.rejects(db.query('select public.puzli_begin_attempt($1,$2)',[alice,id]));
    await db.query("select public.puzli_set_leaderboard('Gracz A',true)");
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:bob})]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.puzli_leaderboard($1,$2,$3)',['week',date,50])).rows.length,0);
    await db.exec('reset role');
    const started=await db.query('select public.puzli_begin_attempt($1,$2) as attempt',[alice,id]);
    const attempt=started.rows[0].attempt.attempt_id;
    assert.ok(attempt);
    assert.equal((await db.query('select public.puzli_begin_attempt($1,$2) as attempt',[alice,id])).rows[0].attempt.attempt_id,attempt);
    await db.query('select public.puzli_add_hint($1,$2)',[alice,attempt]);
    await db.query("update public.puzli_attempts set started_at=now()-interval '90 seconds' where id=$1",[attempt]);
    const finished=(await db.query('select public.puzli_finish_attempt($1,$2) as result',[alice,attempt])).rows[0].result;
    assert.equal(finished.clean,0);
    assert.equal(finished.points<=20,true);
    const repeated=(await db.query('select public.puzli_finish_attempt($1,$2) as result',[alice,attempt])).rows[0].result;
    assert.equal(repeated.already_finished,true);
    assert.equal((await db.query('select count(*)::integer as n from public.puzli_verified_results')).rows[0].n,1);
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:alice})]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.puzli_my_results()')).rows.length,1);
    const progress=(await db.query('select public.puzli_my_progress() as progress')).rows[0].progress;
    assert.equal(progress.games,1);
    assert.equal(progress.iq,100);
    assert.deepEqual(progress.badges,['first-game']);
    assert.equal((await db.query('select * from public.puzli_leaderboard($1,$2,$3)',['week',date,50])).rows.length,1);
    assert.equal((await db.query('select public.puzli_my_percentile($1) as p',[id])).rows[0].p,null);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:bob})]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.puzli_my_results()')).rows.length,0);
    assert.equal((await db.query('select public.puzli_my_percentile($1) as p',[id])).rows[0].p,null);
  }finally{await db.close();}
});
