# Konta PUZLI — projekt i uruchomienie

Status: kod integracji przygotowany; konfiguracja domyślnie wyłączona. Bez projektu Supabase,
konfiguracji dostawców, SMTP, CAPTCHA i monitoringu nie jest to aktywne logowanie produkcyjne.

## Produkt

- Gość gra bez konta. Konto jest opcjonalne, pierwszy poprawny login tworzy użytkownika.
- Start: Google, Facebook, e-mail OTP. Kolejny wybór: Apple; Microsoft (`azure`) opcjonalnie.
  To wybór dla szerokiej grupy graczy, nie ranking popularności. Nie dokładamy kilkunastu przycisków.
- Jeden ekran logowania/rejestracji; nie pytamy o datę urodzenia, telefon ani adres.
- Profil: prywatny pseudonim, pobranie danych konta, wylogowanie bieżącej lub wszystkich sesji,
  usunięcie konta po świeżym uwierzytelnieniu. Nie pobieramy poczty, kontaktów ani listy znajomych.
- Wyniki pozostają lokalne; ta zmiana nie obiecuje synchronizacji. Import wyników, rankingi
  i subskrypcje wymagają osobnego modelu danych i weryfikacji po stronie serwera.
- Nie łączymy kont przez własne porównywanie e-maili. Tożsamości i potwierdzenie adresów obsługuje
  Supabase. Należy przetestować zasady automatycznego linking dostawcy, w tym niepotwierdzone
  adresy, Facebook bez e-maila i Apple Hide My Email. Nie włączamy ręcznego linking w tym wydaniu.

## Architektura i granice bezpieczeństwa

GitHub Pages → przypięty, lokalnie zbudowany SDK → Supabase Auth (OAuth PKCE / OTP).
Użytkownik → PostgREST → RLS → własny profil. Usunięcie → Edge Function → weryfikacja JWT,
użytkownika, aktywnej sesji i czasu logowania → Admin API. ID celu nigdy nie pochodzi z formularza.

Przeglądarka dostaje wyłącznie publishable key. Sekrety OAuth, SMTP i service_role są wyłącznie
w panelu/secrets Supabase. Klucz publiczny nie zastępuje RLS. `profiles` nie ma polityki publicznego
odczytu ani pól roli/premium/punktów. Wszelka przyszła tabela wymaga osobnego testu uprawnień.

PKCE jest obsługiwane przez SDK. Callback ma stały lokalny adres; ignoruje dowolne `next`/`redirect`.
Kod i błędy OAuth są usuwane z URL przed ładowaniem zewnętrznych zasobów. Strona konta nie ładuje
analityki, nie renderuje danych użytkownika przez HTML i ma restrykcyjne CSP oraz no-referrer.
SDK jest lokalny: `npm ci && npm run build:auth`; aktualizacje wymagają ponownego testu.

Sesja jest w sessionStorage, nie localStorage: zwykle znika po zamknięciu karty, ale przeglądarka
może przywracać sesje. To NIE chroni przed XSS w tym samym origin. Nie ma ciastek HttpOnly.
Przed płatnościami/admin panelem rekomendowana migracja do backendu/BFF z sesją HttpOnly,
Secure, SameSite, ochroną CSRF i osobnym origin dla kont. GitHub Pages nie zapewnia serwerowego
ustawiania nagłówków CSP frame-ancestors; przy produkcji przenieść hosting/proxy na taki, który
ustawia CSP, frame-ancestors 'none', HSTS, no-store na stronach kont i X-Content-Type-Options.
Przejęcie repo, CI lub hostingu pozwala podmienić aplikację — MFA administratorów jest obowiązkowe.

RLS sprawdza `auth.uid()` i istnienie sesji w auth.sessions. Dzięki temu wylogowane sesje nie
czytają profilu mimo niewygasłego JWT. Nie przenosi się to automatycznie na przyszłe Storage/API.
Usunięcie wymaga `amr` z oauth/otp/email signup sprzed maks. 5 min; odświeżenie JWT nie wystarcza.

## Konfiguracja przed włączeniem

1. Utworzyć projekt Supabase (region UE), odrębny staging, włączyć MFA dla właściciela i osób
   z dostępem; używać minimalnych uprawnień. Skonfigurować backup i sprawdzić odtworzenie.
2. Uruchomić migrację `supabase/migrations/202610160001_accounts.sql`. Nie edytować schematu
   auth; helpery jedynie go odczytują. Sprawdzić RLS na rzeczywistym stagingu z dwoma kontami.
3. Auth: wyłączyć anonymous sign-ins, włączyć potwierdzanie adresów, pozostawić manual linking
   wyłączony. OTP ważny 10 minut, limit ponownej wysyłki co najmniej 60 s; limity weryfikacji
   egzekwowane przez usługę, nie przycisk. Dostosować limity IP, signup i wysyłki do małej bety.
   E-mail template musi zawierać `{{ .Token }}`, nie tylko link. Podłączyć własny SMTP z domeną
   nadawcy i SPF/DKIM/DMARC. Przetestować kod poprawny, błędny, zużyty i wygasły.
4. Włączyć Turnstile w Auth Attack Protection, sekret w Supabase, site key w config.js.
   Zarejestrować dokładne domeny. CAPTCHA jest egzekwowana przez Supabase; frontend nie wystarczy.
5. JWT: 10 minut. Jeśli plan pozwala: maks. sesja 7 dni, bezczynność 24 h. Dostępność ograniczeń
   sesji i retencja logów zależą od planu; nie obiecujemy ich na darmowym planie.
6. OAuth: zarejestrować aplikacje Google i Meta pod własnymi kontami właściciela; wpisać
   callback Supabase `https://PROJECT.supabase.co/auth/v1/callback`, podstawowe scope profilu/email.
   W Google skonfigurować branding/audience; w Meta wymagany tryb produkcyjny i wymagane adresy
   polityki prywatności/usuwania danych. Apple wymaga właściwej konfiguracji deweloperskiej
   i terminowego odnawiania sekretu. Azure skonfigurować dla zamierzonego typu kont.
7. Supabase Site URL i allowlist: wyłącznie dokładny adres strony konta, np.
   `https://huzyk.github.io/Figlo/account.html`; po podpięciu domeny zmienić na właściwy adres.
   Bez wildcardów produkcyjnych i bez localhost w produkcji. Staging ma osobne callbacki.
8. Deploy `delete-account` z weryfikacją JWT w kodzie (`supabase functions deploy delete-account
   --no-verify-jwt`); ustawić `APP_ORIGIN` na dokładny origin, np. `https://huzyk.github.io`.
   Bramka legacy JWT może odrzucać nowe klucze asymetryczne; kod zawsze sprawdza token samodzielnie.
9. Włączyć zapis Auth Audit Logs do bazy. Uruchomić monitoring opisany niżej i alarm testowy.
10. Uzupełnić informację o administratorze danych/kontakcie, celach, podstawach, odbiorcach,
    retencji, transferach i prawach zgodnie z faktycznym modelem działalności. Ustalić retencję
    logów (proponowane 30 dni) i kopii (np. 30 dni); nie są automatycznie wdrożone przez ten kod.
11. Dopiero po testach wpisać url, **sb_publishable_…**, site key i faktycznie skonfigurowanych
    providers w `src/account/config.js`, ustawić enabled=true. Nie wysyłać sekretów na czacie.

## Wykrywanie i alarmy

Jest przygotowana funkcja `security-monitor`: co 5 minut analizuje ostatnie 10 minut Auth Audit
Logs. Alarmuje przy ≥50 rejestracjach, ≥1000 zdarzeniach auth albo ≥5 wybranych zmianach tożsamości.
Progi startowe, do kalibracji. Nakładające się okna mogą dawać powtórzenia; odbiornik powinien
deduplikować i agregować. To NIE jest pełny IDS i nie wykrywa każdego przejęcia lub odczytu danych.

Deploy: `supabase functions deploy security-monitor --no-verify-jwt`. W secrets ustawić:
`MONITOR_SECRET` (losowy, min. 32 znaki), `SECURITY_WEBHOOK_URL` (HTTPS endpoint akceptujący
JSON text/counts, przekazujący alarm właścicielowi), `SECURITY_HEARTBEAT_URL` (zewnętrzny dead-man
monitor). Harmonogram Supabase Cron lub zewnętrzny scheduler ma wysyłać POST co 5 min z
`Authorization: Bearer MONITOR_SECRET`. Sekret schedulera przechowywać w Vault, nie w SQL w repo.
Brak poprawnego heartbeat przez 15 min musi alarmować niezależnym kanałem. Nie skonfigurowano
odbiorcy ani harmonogramu w repo: bez tej konfiguracji powiadomienia NIE działają.

Monitoring auth nie obejmuje niezalogowanych nieudanych prób w całości. Przed produkcją dołączyć:
- Auth/API gateway logi: skoki 401/403/429, błędnych OTP, nietypowy odczyt/eksport danych;
- GitHub/hosting: zmiany uprawnień, kluczy, workflow i deploy poza procesem, MFA/security alerts;
- Supabase platform audit/configuration alerts (dostępność zależy od planu);
- ostrzeganie o nowych urządzeniach wymaga dodatkowego, wiarygodnego rejestru urządzeń i dostawy
  wiadomości — obecny interfejs tego nie udaje. IP/geolokalizacja to sygnał, nie dowód;
- alarm awarii źródła logów: zerowy wynik zapytania nie dowodzi, że logowanie zdarzeń działa.
  Regularnie wykonywać kontrolne logowanie i potwierdzać jego pojawienie się w audycie.

Po alarmie: zachować logi w oddzielnym miejscu, ustalić zasięg, zablokować zagrożone konto lub
wejście, unieważnić sesje, zmienić narażone sekrety, usunąć przyczynę i zweryfikować poprawkę.
Nie kasować śladów, nie traktować cofnięcia deployu jako usunięcia wycieku. Ocenić obowiązki
prawne i powiadomienia z osobą odpowiedzialną za ochronę danych. Brak alarmu nie dowodzi braku ataku.

## Warunki odbioru produkcyjnego

- Realny Google/Meta + nowe i istniejące konto; e-mail z polskim tekstem; anulowanie OAuth,
  zużyty code, callback z innej karty i innego projektu odrzucony.
- Anon nie czyta profili; A nie czyta/zmienia B; user nie zmienia created_at; token po logout
  nie czyta własnego profilu; JWT podrobiony/wygasły i anon nie usuwają konta.
- Deletion: ID B w body ignorowane; A może usunąć tylko A; stary amr i odświeżony token
  odrzucone; cascade usuwa profil. Zmiana konta nie przenosi danych konta między użytkownikami.
- Kontrolowany skok rejestracji wywołuje dostarczony alarm; awaria webhooka/schedulera daje alarm
  z dead-man monitora. Zachować dowód testu bez tokenów i danych osobowych.
- Safari/iPhone i Android, dostępność formularzy, błędy sieci i blokada CAPTCHA.

Źródła: https://supabase.com/docs/guides/auth/social-login,
https://supabase.com/docs/guides/auth/auth-email-passwordless,
https://supabase.com/docs/guides/auth/sessions,
https://supabase.com/docs/guides/auth/audit-logs,
https://supabase.com/docs/guides/security/platform-audit-logs
