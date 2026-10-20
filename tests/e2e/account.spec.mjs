import {test, expect} from '@playwright/test';

test('unconfigured accounts fail closed and guest games stay available', async ({page}) => {
  const outgoing=[];
  page.on('request',request => { if(!request.url().startsWith('http://127.0.0.1:4173')) outgoing.push(request.url()); });
  // Force the disabled variant: production config is now Google-only beta.
  await page.route('**/src/account/config.js',route => route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:false};`}));
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
  await page.locator('#email').fill('a@example.test');
  await page.getByRole('button',{name:'Wyślij kod logowania'}).click();
  await expect(page.getByLabel('Kod z wiadomości')).toBeVisible();
  expect(await page.evaluate(()=>window.otpRequest.options.captchaToken)).toBe('captcha-test');
  await page.getByLabel('Kod z wiadomości').fill('123456');
  await page.getByRole('button',{name:'Potwierdź kod'}).click();
  await expect(page.locator('#profile')).toBeVisible();
  await expect(page.locator('#profile img')).toHaveCount(0);
  await page.locator('#nickname').fill('Gracz');
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
  await expect(page.locator('#email')).toBeHidden();
  await expect(page.getByRole('button',{name:'Kontynuuj z Facebook'})).toHaveCount(0);
  expect(outgoing).toEqual([]);
});

test('password signup uses Supabase captcha, PKCE redirect and persists nickname only after verification', async ({page}) => {
  await page.route('**/src/account/config.js', route => route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',providers:['google'],emailOtpEnabled:false,passwordAuthEnabled:true,turnstileSiteKey:'test'};`}));
  await page.route('**/src/account/supabase.js', route => route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){
      return {auth:{
        getSession: async()=>({data:{session:null}}),
        signUp:async input=>{window.signupInput=input;return {data:{user:{id:'new-user'},session:null}};},
        signInWithOAuth:async()=>({data:{}}),
      }};
    }
  `}));
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(el,opts)=>{setTimeout(()=>opts.callback('captcha-signup'),0);return 1;},reset:()=>{}};`}));
  await page.goto('/account.html');
  await page.getByRole('button',{name:'Załóż konto'}).click();
  await page.locator('#signupNickname').fill('Testerka');
  await page.locator('#signupEmail').fill('testerka@example.org');
  await page.locator('#signupPassword').fill('long-unique-password');
  await page.locator('#signupPasswordRepeat').fill('long-unique-password');
  await expect(page.locator('#captcha')).toBeVisible();
  await expect(page.locator('#signupForm button[type=submit]')).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.turnstile))).toBe(true);
  await page.locator('#signupForm button[type=submit]').click();
  await expect(page.getByRole('status')).toContainText('potwierdź adres e-mail');
  const input=await page.evaluate(()=>window.signupInput);
  expect(input.email).toBe('testerka@example.org');
  expect(input.password).toBe('long-unique-password');
  expect(input.options.data).toEqual({nickname:'Testerka'});
  expect(input.options.captchaToken).toBe('captcha-signup');
  expect(input.options.emailRedirectTo).toBe('http://127.0.0.1:4173/account.html');
  await expect(page.locator('#signupPassword')).toHaveValue('');
  await expect(page.locator('#signupPasswordRepeat')).toHaveValue('');
});

test('password login and password recovery enforce Turnstile and never expose credentials in the URL', async ({page}) => {
  await page.route('**/src/account/config.js', route => route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',providers:['google'],emailOtpEnabled:false,passwordAuthEnabled:true,turnstileSiteKey:'test'};`}));
  await page.route('**/src/account/supabase.js', route => route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){
      return {auth:{
        getSession:async()=>({data:{session:null}}),
        getUser:async()=>({data:{user:{id:'user-a',email:'a@example.org',user_metadata:{nickname:'Nowy Gracz'}}}}),
        signInWithPassword:async input=>{window.signinInput=input;return {data:{user:{id:'user-a'}}};},
        resetPasswordForEmail:async (email,options)=>{window.recoveryInput={email,options};return {data:{}};},
        signInWithOAuth:async()=>({data:{}}),
      },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{nickname:'Nowy Gracz'}})})})})};
    }
  `}));
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(el,opts)=>{window.completeCaptcha=()=>opts.callback('captcha-login');window.completeCaptcha();return 1;},reset:()=>{}};`}));
  await page.goto('/account.html');
  await page.locator('#signinEmail').fill('a@example.org');
  await page.locator('#signinPassword').fill('strong-secret-123');
  await page.getByRole('button',{name:'Zaloguj się e-mailem'}).click();
  await expect(page.getByRole('status')).toContainText('Jesteś zalogowany');
  const input=await page.evaluate(()=>window.signinInput);
  expect(input.email).toBe('a@example.org');
  expect(input.password).toBe('strong-secret-123');
  expect(input.options.captchaToken).toBe('captcha-login');
  expect(page.url()).not.toContain('secret');

  // Start from a fresh page to exercise recovery without an authenticated session.
  await page.reload();
  await page.locator('#signinEmail').fill('a@example.org');
  await page.getByRole('button',{name:'Nie pamiętasz hasła?'}).click();
  await expect(page.locator('#recoveryForm')).toBeVisible();
  await page.getByRole('button',{name:'Wyślij link do zmiany hasła'}).click();
  await expect(page.getByRole('status')).toContainText('Jeśli konto istnieje');
  expect(await page.evaluate(()=>window.recoveryInput)).toEqual({
    email:'a@example.org', options:{redirectTo:'http://127.0.0.1:4173/account.html',captchaToken:'captcha-login'}
  });
});

test('recovery callback accepts a verified PKCE session and lets the user change password', async ({page}) => {
  await page.route('**/src/account/config.js', route => route.fulfill({contentType:'text/javascript',body:`export const accountConfig={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',providers:['google'],emailOtpEnabled:false,passwordAuthEnabled:true,turnstileSiteKey:'test'};`}));
  await page.route('**/src/account/supabase.js', route => route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){
      let authCb;
      return {auth:{
        onAuthStateChange:callback=>{authCb=callback;return {data:{subscription:{unsubscribe(){}}}};},
        exchangeCodeForSession:async()=>{authCb?.('PASSWORD_RECOVERY',{});return {data:{session:{}}};},
        getSession:async()=>({data:{session:{}}}),
        getUser:async()=>({data:{user:{id:'user-a',email:'a@example.org'}}}),
        updateUser:async info=>{window.updatedPassword=info.password;return {data:{user:{id:'user-a'}}};},
        signInWithOAuth:async()=>({data:{}})
      },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{nickname:'Nowy Gracz'}})})})})};
    }
  `}));
  await page.goto('/account.html?code=recovery-test');
  await expect(page.locator('#resetPassword')).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4173/account.html');
  await page.locator('#newPassword').fill('long-new-password');
  await page.locator('#newPasswordRepeat').fill('long-new-password');
  await page.getByRole('button',{name:'Ustaw nowe hasło'}).click();
  await expect(page.getByRole('status')).toContainText('Nowe hasło zostało zapisane');
  expect(await page.evaluate(()=>window.updatedPassword)).toBe('long-new-password');
});
