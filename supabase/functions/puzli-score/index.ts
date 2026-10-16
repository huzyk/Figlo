import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {validateSolvedProof} from '../../../src/domain/seasonal-scoring.js';

type Input = {action?:unknown;puzzleId?:unknown;attemptId?:unknown;proof?:unknown};
const MAX_BODY = 3200;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowed = (s:unknown):s is string => typeof s==='string' && s.length>0 && s.length<100;

Deno.serve(async req => {
  const origin=Deno.env.get('APP_ORIGIN');
  const headers={
    'Access-Control-Allow-Origin':origin||'',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin', 'Cache-Control':'no-store','Content-Type':'application/json'
  };
  const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers});
  if(!origin || req.headers.get('origin')!==origin)return reply(403,{error:'forbidden'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'method'});
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer ') || authorization.length>4096)return reply(401,{error:'unauthorized'});
  const url=Deno.env.get('SUPABASE_URL'),publishableKey=Deno.env.get('SUPABASE_ANON_KEY'),
    serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!publishableKey||!serviceRole)return reply(503,{error:'not_ready'});
  try{
    const raw=await req.text();
    if(raw.length>MAX_BODY)return reply(413,{error:'payload_too_large'});
    const data=JSON.parse(raw) as Input;
    if(!data || typeof data!=='object' || !['start','hint','finish'].includes(String(data.action)))return reply(400,{error:'invalid_request'});
    // Never accept user_id, points, time, hint totals or an arbitrary board definition.
    const token=authorization.slice(7);
    const scoped=createClient(url,publishableKey,{global:{headers:{Authorization:authorization}},
      auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error:identityError}=await scoped.auth.getUser(token);
    if(identityError||!identity.user)return reply(401,{error:'unauthorized'});
    const {data:active,error:sessionError}=await scoped.rpc('account_session_active');
    if(sessionError||active!==true)return reply(401,{error:'unauthorized'});
    const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const userId=identity.user.id;
    if(data.action==='start'){
      if(!allowed(data.puzzleId))return reply(400,{error:'invalid_puzzle_id'});
      const {data:started,error}=await admin.rpc('puzli_begin_attempt',{p_user:userId,p_puzzle_id:data.puzzleId});
      if(error)return reply(409,{error:'puzzle_not_ready_or_closed'});
      return reply(200,{...started});
    }
    if(typeof data.attemptId!=='string'||!UUID.test(data.attemptId))return reply(400,{error:'invalid_attempt'});
    if(data.action==='hint'){
      const {data:hints,error}=await admin.rpc('puzli_add_hint',{p_user:userId,p_attempt:data.attemptId});
      return error?reply(409,{error:'attempt_not_active'}):reply(200,{hints_used:hints});
    }
    if(!Array.isArray(data.proof)||data.proof.length>100)return reply(400,{error:'invalid_proof'});
    const {data:attempt,error:attemptError}=await admin.from('puzli_attempts')
      .select('puzzle_id,finished_at').eq('id',data.attemptId).eq('user_id',userId).maybeSingle();
    if(attemptError||!attempt)return reply(404,{error:'attempt_not_found'});
    if(attempt.finished_at){
      const {data:record}=await admin.from('puzli_verified_results').select('points')
        .eq('puzzle_id',attempt.puzzle_id).eq('user_id',userId).maybeSingle();
      return reply(200,{points:record?.points??0,already_finished:true,bonus:0});
    }
    const {data:puzzle,error:puzzleError}=await admin.from('puzli_puzzles')
      .select('game_id,solution').eq('puzzle_id',attempt.puzzle_id).maybeSingle();
    if(puzzleError||!puzzle)return reply(404,{error:'puzzle_not_found'});
    if(!validateSolvedProof(puzzle.game_id,data.proof,puzzle.solution)){
      return reply(422,{error:'solution_not_verified'});
    }
    const {data:result,error}=await admin.rpc('puzli_finish_attempt',{p_user:userId,p_attempt:data.attemptId});
    return error?reply(409,{error:'attempt_expired_or_duplicate'}):reply(200,result);
  }catch{
    // Never log user IDs, proof, tokens or raw exception messages.
    console.error('puzli_score_failed');
    return reply(400,{error:'invalid_request'});
  }
});
