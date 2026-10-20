import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig, callbackUrl, validNickname, validPassword} from '../src/account/policy.js';
import {recentAuthentication} from '../supabase/functions/delete-account/policy.js';
import {evaluateSignals} from '../supabase/functions/security-monitor/rules.js';

test('auth stays off without configuration; privileged keys and untrusted URLs fail closed', () => {
  assert.equal(validateConfig({enabled:false}), false);
  const good = {enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_example',providers:['google','facebook','apple','azure'],turnstileSiteKey:'test'};
  assert.equal(validateConfig(good), true);
  for (const url of ['http://example.supabase.co','https://supabase.co.evil.test','https://evil.test','https://u:p@example.supabase.co','https://example.supabase.co/x']) assert.throws(() => validateConfig({...good,url}));
  for (const publishableKey of ['sb_secret_private','eyJhbGciOiJIUzI1NiJ9','']) assert.throws(() => validateConfig({...good,publishableKey}));
  assert.throws(() => validateConfig({...good,providers:['__proto__']}));
  assert.throws(() => validateConfig({...good,turnstileSiteKey:''}));
});
test('callback cannot be redirected by query/fragment and works on Pages subpaths', () => {
  assert.equal(callbackUrl('https://huzyk.github.io/Figlo/account.html?next=https://evil.test&code=secret#token'), 'https://huzyk.github.io/Figlo/account.html');
});
test('nickname rejects markup and overlong values', () => {
  assert.equal(validNickname('Hubert Żyła'),true);
  for (const value of ['<img src=x>','a','a'.repeat(25),'line\nbreak']) assert.equal(validNickname(value),false);
});
test('delete requires recent actual authentication, not a refreshed JWT', () => {
  const now=10000;
  const claims={role:'authenticated',is_anonymous:false,iat:now,amr:[{method:'oauth',timestamp:now-20}]};
  assert.equal(recentAuthentication(claims,now),true);
  for(const method of ['token_refresh','anonymous','recovery']) assert.equal(recentAuthentication({...claims,amr:[{method,timestamp:now}]},now),false);
  assert.equal(recentAuthentication({...claims,amr:[{method:'oauth',timestamp:now-301}]},now),false);
  assert.equal(recentAuthentication({...claims,amr:[{method:'oauth',timestamp:now+100}]},now),false);
  assert.equal(recentAuthentication({...claims,is_anonymous:true},now),false);
  assert.equal(recentAuthentication({...claims,role:'service_role'},now),false);
});
test('monitor detects configured thresholds and rejects absent telemetry', () => {
  assert.deepEqual(evaluateSignals({events:999,signups:49,identity_changes:4}),[]);
  assert.deepEqual(evaluateSignals({events:1000,signups:50,identity_changes:5}),['auth_volume','signup_spike','identity_changes']);
  assert.throws(() => evaluateSignals(null));
  assert.throws(() => evaluateSignals({events:0}));
});
test('password length validation never trims or stores passwords', () => {
  assert.equal(validPassword('this-is-a-long-password'), true);
  for (const password of ['short', '', 'x'.repeat(129), undefined, null]) assert.equal(validPassword(password), false);
});
