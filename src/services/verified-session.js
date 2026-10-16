// Buffered official scoring events, never used for local game completion.
// Network operations are serialized per attempt so hints cannot race finish.
// Safe default: the feature flag is false until staging has passed E2E tests.
import {verifiedBackendEnabled,beginVerifiedAttempt,registerVerifiedHint,finishVerifiedAttempt} from './verified-game-api.js';
const active=new Map();
const keyOf = ({gameId,puzzleId,date}) => [gameId,puzzleId,date].join('|');
function eligible(input){
 return verifiedBackendEnabled && input?.mode==='daily' &&
   typeof input.gameId==='string' && typeof input.puzzleId==='string' && typeof input.date==='string';
}
function ensure(input){
 const key=keyOf(input);
 if(active.has(key))return active.get(key);
 const tracker={attemptId:null,failed:false,queue:Promise.resolve(),finished:false};
 tracker.queue=beginVerifiedAttempt(input.puzzleId).then(result=>{
   if(!result.available || result.finished || !result.attempt_id){tracker.failed=true;return;}
   tracker.attemptId=result.attempt_id;
 }).catch(()=>{tracker.failed=true;});
 active.set(key,tracker);
 return tracker;
}
export function notifyVerifiedEvent(eventName,input){
 if(!eligible(input))return;
 if(eventName==='game_started'){ensure(input);return;}
 if(eventName==='hint_used'){
   const tracker=ensure(input);
   tracker.queue=tracker.queue.then(async()=>{
     if(tracker.failed||tracker.finished)return;
     try{await registerVerifiedHint(tracker.attemptId);}
     catch {tracker.failed=true;}
   });
 }
}
export function submitVerifiedCompletion(input,proof){
 if(!eligible(input) || !Array.isArray(proof))return false;
 const tracker=ensure(input);
 if(tracker.finished)return false;
 tracker.finished=true;
 tracker.queue=tracker.queue.then(async()=>{
   if(tracker.failed || !tracker.attemptId){
     window.dispatchEvent(new CustomEvent('puzli-verified-result',{detail:{ok:false,gameId:input.gameId}}));
     return;
   }
   try {
     const result=await finishVerifiedAttempt(tracker.attemptId,proof);
     window.dispatchEvent(new CustomEvent('puzli-verified-result',{detail:{
       ok:Boolean(result.available),gameId:input.gameId,points:result.points??null,bonus:result.bonus??0,
     }}));
   }catch{
     window.dispatchEvent(new CustomEvent('puzli-verified-result',{detail:{ok:false,gameId:input.gameId}}));
   }
 });
 return true;
}
