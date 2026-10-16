import { accountConfig as config } from './config.js';
import { validateConfig, providers, callbackUrl, validNickname } from './policy.js';

const $ = id => document.getElementById(id);
const message = text => { $('status').textContent = text; };
// Remove credentials before any third-party resource loads. No analytics on this page.
const params = new URLSearchParams(location.search);
const code = params.get('code');
const callbackError = params.has('error') || params.has('error_description');
history.replaceState(null, '', callbackUrl(location.href));
let client, user, email, captchaToken, widget;
let busy = false;

async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await action(); }
  catch { message('Nie udało się wykonać operacji. Spróbuj ponownie. Jeśli kod wygasł, poproś o nowy.'); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => { b.disabled = false; });
    $('sendCode').disabled = !captchaToken;
  }
}
function checked(result) { if (result.error) throw result.error; return result.data; }
async function showProfile() {
  user = checked(await client.auth.getUser()).user;
  if (!user) throw new Error('No verified user');
  $('login').hidden = true; $('profile').hidden = false;
  $('identity').textContent = user.email || 'Konto połączone';
  const profile = checked(await client.from('profiles').select('nickname').eq('id', user.id).maybeSingle());
  $('nickname').value = profile?.nickname || '';
  message('Jesteś zalogowany. Sesja jest zapisana tylko w tej karcie przeglądarki.');
}
function resetCaptcha() {
  captchaToken = undefined;
  if (widget !== undefined) window.turnstile.reset(widget);
}
async function logout(scope) {
  checked(await client.auth.signOut({scope}));
  user = undefined;
  $('profile').hidden = true; $('login').hidden = false;
  $('identity').textContent = ''; $('nickname').value = '';
  message(scope === 'global' ? 'Sesje zostały wylogowane. Dostęp do danych konta został cofnięty.' : 'Wylogowano z konta.');
}
async function init() {
  if (!validateConfig(config)) {
    message('Konta są jeszcze przygotowywane. Wszystkie gry są dostępne bez logowania.');
    return;
  }
  const { createClient } = await import('./supabase.js');
  client = createClient(config.url, config.publishableKey, { auth: {
    flowType: 'pkce', detectSessionInUrl: false, persistSession: true,
    storage: sessionStorage, storageKey: 'puzli-account-v1', autoRefreshToken: true,
  }});
  $('login').hidden = false;
  for (const provider of config.providers) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = `Kontynuuj z ${providers[provider]}`;
    button.addEventListener('click', () => run(async () => {
      checked(await client.auth.signInWithOAuth({provider, options: {
        redirectTo: callbackUrl(location.href),
        ...(provider === 'azure' ? {scopes: 'email'} : {}),
      }}));
    }));
    $('providers').append(button);
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onload = () => {
    widget = window.turnstile.render('#captcha', { sitekey: config.turnstileSiteKey,
      callback: token => { captchaToken = token; $('sendCode').disabled = busy; },
      'expired-callback': () => { captchaToken = undefined; $('sendCode').disabled = true; },
      'error-callback': () => { captchaToken = undefined; $('sendCode').disabled = true; message('Nie udało się sprawdzić zabezpieczenia. Odśwież stronę.'); },
    });
  };
  script.onerror = () => message('Nie udało się wczytać zabezpieczenia logowania e-mailem. Odśwież stronę.');
  document.head.append(script);
  $('emailForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!captchaToken) return;
    run(async () => {
      email = $('email').value.trim();
      try { checked(await client.auth.signInWithOtp({email, options: {shouldCreateUser: true, captchaToken}})); }
      finally { resetCaptcha(); }
      $('emailForm').hidden = true; $('codeForm').hidden = false;
      message('Jeśli wiadomość może zostać dostarczona, otrzymasz kod. Sprawdź skrzynkę i folder spam.');
      $('code').focus();
    });
  });
  $('codeForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    checked(await client.auth.verifyOtp({email, token: $('code').value.trim(), type: 'email'}));
    $('code').value = ''; await showProfile();
  }); });
  $('changeEmail').addEventListener('click', () => {
    $('codeForm').hidden = true; $('emailForm').hidden = false; $('code').value = ''; resetCaptcha();
  });
  $('profileForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const nickname = $('nickname').value.trim();
    if (!validNickname(nickname)) { message('Wpisz 2–24 znaki: litery, cyfry, spację, myślnik lub podkreślenie.'); return; }
    checked(await client.from('profiles').upsert({id: user.id, nickname}));
    message('Pseudonim zapisany.');
  }); });
  $('signOut').addEventListener('click', () => run(() => logout('local')));
  $('signOutAll').addEventListener('click', () => run(() => logout('global')));
  $('exportData').addEventListener('click', () => run(async () => {
    const verified = checked(await client.auth.getUser()).user;
    const profile = checked(await client.from('profiles').select('nickname,created_at').eq('id', verified.id).maybeSingle());
    const blob = new Blob([JSON.stringify({id: verified.id, email: verified.email, created_at: verified.created_at, profile}, null, 2)], {type:'application/json'});
    const href = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = href; a.download = 'puzli-konto.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }));
  $('deleteAccount').addEventListener('click', () => run(async () => {
    if ($('deleteConfirm').value !== 'USUŃ') { message('Potwierdź usunięcie, wpisując USUŃ.'); return; }
    const result = await client.functions.invoke('delete-account', {body: {confirm:'DELETE'}});
    if (result.error) { message('Nie usunięto konta. Zaloguj się ponownie i spróbuj w ciągu 5 minut.'); return; }
    await client.auth.signOut({scope:'local'});
    sessionStorage.removeItem('puzli-account-v1');
    location.replace(callbackUrl(location.href));
  }));
  if (callbackError) { message('Logowanie zostało anulowane lub odrzucone. Spróbuj ponownie.'); return; }
  if (code) {
    try { checked(await client.auth.exchangeCodeForSession(code)); }
    catch { message('Link logowania wygasł lub został już wykorzystany. Rozpocznij logowanie ponownie w tej karcie.'); return; }
  }
  const session = checked(await client.auth.getSession()).session;
  if (session) await showProfile();
  else message('Wybierz sposób logowania lub założenia konta.');
}
init().catch(() => { $('login').hidden = true; $('profile').hidden = true; message('Konta są chwilowo niedostępne. Możesz nadal grać bez logowania.'); });
