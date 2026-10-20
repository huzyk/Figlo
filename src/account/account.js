import { accountConfig as config } from './config.js';
import { validateConfig, providers, callbackUrl, validNickname, validPassword } from './policy.js';

const $ = id => document.getElementById(id);
const message = text => { $('status').textContent = text; };
// Remove credentials before any third-party resource loads. No analytics on this page.
const params = new URLSearchParams(location.search);
const code = params.get('code');
const callbackError = params.has('error') || params.has('error_description');
history.replaceState(null, '', callbackUrl(location.href));
let client, user, email, captchaToken, widget;
let busy = false;
let recoveryEvent = false;
const recoveryStorageKey = 'puzli-password-recovery-v1';

async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await action(); }
  catch (error) { message(authErrorMessage(error)); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => { b.disabled = false; });
    $('sendCode').disabled = !captchaToken;
  }
}
function checked(result) { if (result.error) throw result.error; return result.data; }
function authErrorMessage(error) {
  switch (error?.code) {
    case 'invalid_credentials': return 'Nieprawidłowy adres e-mail lub hasło.';
    case 'email_not_confirmed': return 'Najpierw potwierdź adres e-mail z otrzymanej wiadomości.';
    case 'captcha_failed': return 'Zabezpieczenie antybotowe wygasło. Spróbuj ponownie.';
    case 'weak_password': return 'Hasło jest zbyt słabe. Użyj dłuższego, unikalnego hasła.';
    case 'over_email_send_rate_limit':
    case 'email_rate_limit_exceeded': return 'Limit wiadomości e-mail został osiągnięty. Spróbuj później.';
    case 'email_address_not_authorized': return 'Wysyłka na ten adres jest zablokowana w ustawieniach poczty Supabase.';
    default: return 'Nie udało się wykonać operacji. Sprawdź dane i spróbuj ponownie.';
  }
}
function requireCaptcha() {
  if (captchaToken) return true;
  message('Poczekaj na weryfikację antybotową i spróbuj ponownie.');
  return false;
}
function showResetPassword() {
  $('login').hidden = true;
  $('profile').hidden = true;
  $('resetPassword').hidden = false;
  message('Link potwierdzony. Możesz ustawić nowe hasło.');
}
function switchPasswordMode(mode) {
  $('signinForm').hidden = mode !== 'signin';
  $('signupForm').hidden = mode !== 'signup';
  $('recoveryForm').hidden = mode !== 'recovery';
  $('tabSignin').classList.toggle('is-active', mode === 'signin');
  $('tabSignup').classList.toggle('is-active', mode === 'signup');
  $('tabSignin').setAttribute('aria-pressed', String(mode === 'signin'));
  $('tabSignup').setAttribute('aria-pressed', String(mode === 'signup'));
}
async function showProfile() {
  user = checked(await client.auth.getUser()).user;
  if (!user) throw new Error('No verified user');
  $('login').hidden = true; $('profile').hidden = false; $('resetPassword').hidden = true;
  $('identity').textContent = user.email || 'Konto połączone';
  const profile = checked(await client.from('profiles').select('nickname').eq('id', user.id).maybeSingle());
  const suggestedNickname = user.user_metadata?.nickname;
  // Email-signup metadata persists until a confirmation link opens the verified session.
  if (!profile && validNickname(suggestedNickname)) {
    const inserted = await client.from('profiles').insert({id:user.id, nickname:suggestedNickname});
    if (inserted.error && inserted.error.code !== '23505') throw inserted.error;
  }
  $('nickname').value = profile?.nickname || (validNickname(suggestedNickname) ? suggestedNickname : '');
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
  $('code').value = ''; $('deleteConfirm').value = '';
  $('codeForm').hidden = true; $('emailForm').hidden = false;
  $('resetPassword').hidden = true;
  sessionStorage.removeItem(recoveryStorageKey);
  if (config.passwordAuthEnabled) switchPasswordMode('signin');
  resetCaptcha();
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
  if (config.passwordAuthEnabled === true) {
    $('passwordAuth').hidden = false;
    $('tabSignin').addEventListener('click', () => switchPasswordMode('signin'));
    $('tabSignup').addEventListener('click', () => switchPasswordMode('signup'));
    $('forgotPassword').addEventListener('click', () => {
      $('recoveryEmail').value = $('signinEmail').value;
      switchPasswordMode('recovery');
    });
    $('backToSignin').addEventListener('click', () => switchPasswordMode('signin'));

    $('signupForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const nickname = $('signupNickname').value.trim();
      const emailAddress = $('signupEmail').value.trim();
      const password = $('signupPassword').value;
      if (!validNickname(nickname)) { message('Pseudonim musi mieć od 2 do 24 znaków.'); return; }
      if (!validPassword(password)) { message('Hasło musi mieć od 12 do 128 znaków.'); return; }
      if (password !== $('signupPasswordRepeat').value) { message('Hasła nie są identyczne.'); return; }
      if (!requireCaptcha()) return;
      let data;
      try {
        data = checked(await client.auth.signUp({
          email: emailAddress,
          password,
          options: {emailRedirectTo:callbackUrl(location.href),data:{nickname},captchaToken},
        }));
      } finally { resetCaptcha(); }
      $('signupPassword').value = '';
      $('signupPasswordRepeat').value = '';
      if (data.session) await showProfile();
      else message('Jeśli rejestracja jest możliwa, sprawdź pocztę i potwierdź adres e-mail.');
    }); });
    $('signinForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      if (!requireCaptcha()) return;
      try {
        checked(await client.auth.signInWithPassword({
          email:$('signinEmail').value.trim(),password:$('signinPassword').value,options:{captchaToken},
        }));
      } finally { $('signinPassword').value = ''; resetCaptcha(); }
      await showProfile();
    }); });
    $('recoveryForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      if (!requireCaptcha()) return;
      sessionStorage.setItem(recoveryStorageKey, String(Date.now()));
      try {
        checked(await client.auth.resetPasswordForEmail($('recoveryEmail').value.trim(), {
          redirectTo:callbackUrl(location.href),captchaToken,
        }));
      } finally { resetCaptcha(); }
      message('Jeśli konto istnieje, otrzymasz e-mail z linkiem do ustawienia nowego hasła.');
    }); });
    $('resetPasswordForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const newPassword = $('newPassword').value;
      if (!validPassword(newPassword)) { message('Hasło musi mieć od 12 do 128 znaków.'); return; }
      if (newPassword !== $('newPasswordRepeat').value) { message('Hasła nie są identyczne.'); return; }
      checked(await client.auth.updateUser({password:newPassword}));
      $('newPassword').value = ''; $('newPasswordRepeat').value = '';
      sessionStorage.removeItem(recoveryStorageKey);
      await showProfile();
      message('Nowe hasło zostało zapisane.');
    }); });
  }
  // One Turnstile widget protects email signup, login, recovery and optional OTP.
  if (config.passwordAuthEnabled === true || config.emailOtpEnabled === true) {
    $('captcha').hidden = false;
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
  }
  if (config.emailOtpEnabled === true) {
    $('emailLogin').hidden = false;
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
  }
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
  client.auth.onAuthStateChange?.(event => { if (event === 'PASSWORD_RECOVERY') recoveryEvent = true; });
  if (callbackError) { message('Logowanie zostało anulowane lub odrzucone. Spróbuj ponownie.'); return; }
  if (code) {
    try { checked(await client.auth.exchangeCodeForSession(code)); }
    catch { message('Link logowania wygasł lub został już wykorzystany. Rozpocznij logowanie ponownie w tej karcie.'); return; }
  }
  const session = checked(await client.auth.getSession()).session;
  const recoveryAge = Date.now() - Number(sessionStorage.getItem(recoveryStorageKey));
  if (session && config.passwordAuthEnabled && code &&
    (recoveryEvent || params.get('type') === 'recovery' ||
    (recoveryAge >= 0 && recoveryAge < 20 * 60 * 1000))) {
    showResetPassword();
    return;
  }
  if (session) await showProfile();
  else message('Wybierz sposób logowania lub założenia konta.');
}
init().catch(() => { $('login').hidden = true; $('profile').hidden = true; message('Konta są chwilowo niedostępne. Możesz nadal grać bez logowania.'); });
