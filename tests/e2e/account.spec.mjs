import {test, expect} from '@playwright/test';

test('unconfigured accounts fail closed and guest games stay available', async ({page}) => {
  const outgoing=[];
  page.on('request',request => { if(!request.url().startsWith('http://127.0.0.1:4173')) outgoing.push(request.url()); });
  await page.goto('/account.html?code=secret&next=https://evil.example/#access_token=secret');
  await expect(page.getByRole('status')).toContainText('Konta są jeszcze przygotowywane');
  await expect(page.locator('#login')).toBeHidden();
  expect(page.url()).toBe('http://127.0.0.1:4173/account.html');
  await page.getByRole('link',{name:'Graj bez konta'}).click();
  await expect(page).toHaveURL(/index.html/);
  expect(outgoing).toEqual([]);
});

test('account form uses verified identity, escapes nickname and scopes signout', async ({page}) => {
  await page.route('**/src/account/config.js',route => route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',providers:['google','facebook','apple','azure'],emailOtpEnabled:true,turnstileSiteKey:'test'};`}));
  await page.route('**/src/account/supabase.js',route => route.fulfill({contentType:'text/javascript',body:`
    let signedIn=false;
    export function createClient(url,key,options){
      window.authOptions={flowType:options.auth.flowType,sessionStorage:options.auth.storage===sessionStorage};
      return {auth:{
        getSession:async()=>({data:{session:null}}),
        getUser:async()=>({data:{user:{id:'user-a',email:'a@example.test'}}}),
        signInWithOtp:async input=>{window.otpRequest=input;return {data:{}}},
        verifyOtp:async input=>{signedIn=true;return {data:{}}},
        signOut:async input=>{window.signoutScope=input.scope;return {data:{}}},
        signInWithOAuth:async input=>{window.oauthRequest=input;return {data:{}}}
      },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{nickname:'<img src=x onerror=alert(1)>'}})})}),upsert:async data=>{window.savedProfile=data;return {data:{}}}})};
    }
  `}));
  await page.route('https://challenges.cloudflare.com/**',route => route.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(selector,opts)=>{setTimeout(()=>opts.callback('captcha-test'),0);return 'widget'},reset:()=>{}};`}));
  await page.goto('/account.html');
  await expect(page.getByRole('button',{name:'Kontynuuj z Google'})).toBeVisible();
  await page.getByRole('button',{name:'Kontynuuj z Google'}).click();
  expect(await page.evaluate(()=>window.oauthRequest.options.redirectTo)).toBe('http://127.0.0.1:4173/account.html');
  await page.getByLabel('Adres e-mail').fill('a@example.test');
  await page.getByRole('button',{name:'Wyślij kod logowania'}).click();
  await expect(page.getByLabel('Kod z wiadomości')).toBeVisible();
  expect(await page.evaluate(()=>window.otpRequest.options.captchaToken)).toBe('captcha-test');
  await page.getByLabel('Kod z wiadomości').fill('123456');
  await page.getByRole('button',{name:'Potwierdź kod'}).click();
  await expect(page.locator('#profile')).toBeVisible();
  await expect(page.locator('#profile img')).toHaveCount(0);
  await page.getByLabel('Pseudonim').fill('Gracz');
  await page.getByRole('button',{name:'Zapisz pseudonim'}).click();
  await expect(page.getByRole('status')).toHaveText('Pseudonim zapisany.');
  expect(await page.evaluate(()=>window.savedProfile)).toEqual({id:'user-a',nickname:'Gracz'});
  expect(await page.evaluate(()=>window.authOptions)).toEqual({flowType:'pkce',sessionStorage:true});
  await page.getByRole('button',{name:'Wyloguj wszystkie urządzenia'}).click();
  await expect(page.locator('#profile')).toBeHidden();
  expect(await page.evaluate(()=>window.signoutScope)).toBe('global');
});


test('Google-only beta does not expose nonconfigured OTP or load the Turnstile widget', async ({page}) => {
  const outgoing = [];
  page.on('request', request => { if (request.url().includes('challenges.cloudflare.com')) outgoing.push(request.url()); });
  await page.route('**/src/account/config.js',route=>route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',providers:['google'],emailOtpEnabled:false,turnstileSiteKey:'test'};`}));
  await page.route('**/src/account/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`export function createClient(){return {auth:{getSession:async()=>({data:{session:null}}),signInWithOAuth:async()=>({data:{}})}}}` }));
  await page.goto('/account.html');
  await expect(page.getByRole('button',{name:'Kontynuuj z Google'})).toBeVisible();
  await expect(page.getByLabel('Adres e-mail')).toBeHidden();
  await expect(page.getByRole('button',{name:'Kontynuuj z Facebook'})).toHaveCount(0);
  expect(outgoing).toEqual([]);
});
