import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { evaluateSignals } from './rules.js';

// Private scheduler endpoint; deploy with JWT verification disabled only because
// a separate random scheduler secret is verified here. Never expose it to the browser.
Deno.serve(async req => {
  const secret = Deno.env.get('MONITOR_SECRET');
  if (req.method !== 'POST' || !secret || secret.length < 32 || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Forbidden', {status:403});
  try {
    const hook = new URL(Deno.env.get('SECURITY_WEBHOOK_URL')!);
    const heartbeat = new URL(Deno.env.get('SECURITY_HEARTBEAT_URL')!);
    if (hook.protocol !== 'https:' || heartbeat.protocol !== 'https:') throw new Error('HTTPS required');
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false, autoRefreshToken:false}});
    const {data, error} = await client.rpc('security_counts');
    if (error) throw error;
    const alerts = evaluateSignals(data);
    if (alerts.length) {
      const response = await fetch(hook, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:`PUZLI: podejrzana aktywność (${alerts.join(', ')}). Sprawdź Auth Audit Logs. To sygnał, nie potwierdzenie włamania.`, counts:data}), signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Alert delivery failed');
    }
    const health = await fetch(heartbeat, {method:'POST', signal:AbortSignal.timeout(10000)});
    if (!health.ok) throw new Error('Heartbeat failed');
    return Response.json({ok:true, alerts:alerts.length}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    // No tokens, URLs, credentials or raw exception messages in logs.
    console.error('security_monitor_failed');
    return Response.json({ok:false}, {status:503});
  }
});
