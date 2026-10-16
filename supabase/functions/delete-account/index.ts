import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { recentAuthentication } from './policy.js';

Deno.serve(async req => {
  const origin = Deno.env.get('APP_ORIGIN');
  const headers = {'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store', 'Content-Type': 'application/json'};
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), {status, headers});
  if (!origin || req.headers.get('origin') !== origin) return reply(403, {error:'forbidden'});
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers});
  if (req.method !== 'POST') return reply(405, {error:'method'});
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, {error:'unauthorized'});
  try {
    if ((await req.json()).confirm !== 'DELETE') return reply(400, {error:'confirmation_required'});
    const url = Deno.env.get('SUPABASE_URL')!;
    const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global:{headers:{Authorization:authorization}}, auth:{persistSession:false, autoRefreshToken:false},
    });
    const token = authorization.slice(7);
    const {data, error} = await scoped.auth.getClaims(token);
    if (error || !data || !recentAuthentication(data.claims)) return reply(401, {error:'reauthenticate'});
    const {data: identity, error: identityError} = await scoped.auth.getUser(token);
    const {data: active, error: sessionError} = await scoped.rpc('account_session_active');
    if (identityError || !identity.user || sessionError || active !== true || identity.user.id !== data.claims.sub) return reply(401, {error:'unauthorized'});
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false, autoRefreshToken:false}});
    // Never accept a target ID from request data.
    const {error: deleteError} = await admin.auth.admin.deleteUser(identity.user.id);
    if (deleteError) return reply(503, {error:'unavailable'});
    return reply(200, {deleted:true});
  } catch { return reply(400, {error:'invalid_request'}); }
});
