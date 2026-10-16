// Optional bridge for a signed-in PUZLI user. No calls occur until both
// accountConfig.enabled and verifiedBackendEnabled are set by the owner.
import {accountConfig} from '../account/config.js';

export const verifiedBackendEnabled = false;
let clientPromise;
async function getClient(){
  if(!verifiedBackendEnabled||!accountConfig.enabled)return null;
  clientPromise ||= import('../account/supabase.js').then(({createClient})=>
    createClient(accountConfig.url,accountConfig.publishableKey,{auth:{
      flowType:'pkce',detectSessionInUrl:false,persistSession:true,
      storage:sessionStorage,storageKey:'puzli-account-v1',autoRefreshToken:true,
    }}));
  const client=await clientPromise;
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return null;
  return client;
}
export async function invokeVerifiedScore(body){
  const client=await getClient();
  if(!client)return {available:false};
  const {data,error}=await client.functions.invoke('puzli-score',{body});
  if(error)throw new Error('Nie udało się zweryfikować wyniku.');
  return {available:true,...data};
}
export const beginVerifiedAttempt=puzzleId=>invokeVerifiedScore({action:'start',puzzleId});
export const registerVerifiedHint=attemptId=>invokeVerifiedScore({action:'hint',attemptId});
export const finishVerifiedAttempt=(attemptId,proof)=>invokeVerifiedScore({action:'finish',attemptId,proof});
export async function getVerifiedLeaderboard(period,anchor,limit=50){
  const client=await getClient();
  if(!client)return {available:false,entries:[]};
  const {data,error}=await client.rpc('puzli_leaderboard',{p_period:period,p_anchor:anchor,p_limit:limit});
  if(error)throw new Error('Ranking jest chwilowo niedostępny.');
  return {available:true,entries:data};
}
export async function getMyVerifiedPercentile(puzzleId){
  const client=await getClient();
  if(!client)return {available:false,percentile:null};
  const {data,error}=await client.rpc('puzli_my_percentile',{p_puzzle_id:puzzleId});
  if(error)throw new Error('Statystyki porównawcze są chwilowo niedostępne.');
  return {available:true,percentile:data};
}
export async function getLeaderboardMembership(){
  const client=await getClient();
  if(!client)return {available:false,membership:null};
  const {data,error}=await client.rpc('puzli_my_membership');
  if(error)throw new Error('Nie udało się odczytać zgody na ranking.');
  return {available:true,membership:data};
}
export async function setLeaderboardVisibility(nickname,optedIn){
  const client=await getClient();
  if(!client)return {available:false};
  const {error}=await client.rpc('puzli_set_leaderboard',{p_nickname:nickname,p_opted_in:optedIn});
  if(error)throw new Error('Nie udało się zmienić widoczności w rankingu.');
  return {available:true};
}
