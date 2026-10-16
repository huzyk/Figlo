# PUZLI — backend punktów i rankingów

## Status

Kod jest przygotowany, ale **nie jest aktywny dla graczy**. Przed podłączeniem Supabase
PUZLI nadal działa bez konta, a dotychczasowe lokalne wyniki, odznaki, punkty i
ranking znajomych nie zostają zmienione ani usunięte.

Nowe punkty to osobny, oficjalny rejestr **zweryfikowanych** wyników. Nie
przeliczamy automatycznie starych wyników z przeglądarki na oficjalny ranking.

## Architektura

- Migracja 202610160001_accounts.sql: prywatne profile i aktywne sesje.
- Migracja 202610160002_verified_scores.sql: prywatne kanoniczne rozwiązania,
  rejestr prób i wyników, premie za zestawy, opt-in pseudonimów oraz API SQL.
- Supabase Edge Function puzli-score: start, hint, finish po uwierzytelnieniu.
- scripts/seed-verified-puzzles.mjs: przygotowywanie kanonicznych, niezmiennych
  rozwiązań dla wszystkich sześciu gier.
- Workflow seed-verified-daily.yml: uzupełnianie siedmiu dni w przód po konfiguracji sekretów.
- src/domain/seasonal-scoring.js: punktacja, czas docelowy i zasady sezonów.
- src/services/verified-game-api.js: wyłączony klient dla przyszłej integracji gier.

## Punkty i tabela wyników

Za grę: 10 za ukończenie + 0–10 za szybkość + 5 za brak podpowiedzi.
Za pełny zweryfikowany dzienny zestaw: +20. Maksymalnie 170 punktów na
sześciogrowy dzień. Czas jest mierzony na serwerze, z uwzględnieniem
gry i poziomu trudności. Targety to początkowe założenia; należy je
skalibrować na rzeczywistych danych przed uruchomieniem rywalizacji.

Jedna historia wyników zasila rankingi: TOP tygodnia (poniedziałek–niedziela),
miesiąca, roku i wszech czasów. Wyniki nie są kasowane po tygodniu.
Dane rankingowe są udostępniane wyłącznie za zgodą gracza (opt-in),
a nazwy kont prywatnych nie są automatycznie publikowane.
Porównanie procentowe pojawia się dopiero po 100 wynikach od graczy z opt-in
dla konkretnej planszy. Brak fikcyjnych percentyli i graczy.

## Bezpieczeństwo i ograniczenia

Baza przechowuje kanoniczne rozwiązania poza uprawnieniami przeglądarki.
Skuteczne operacje serwerowe wymagają JWT, potwierdzenia aktywnej sesji
i przynależności próby do użytkownika. Nie przyjmujemy wyniku punktowego,
czasu, liczby podpowiedzi ani user_id przesłanego z aplikacji.
Ukończenie jest idempotentne. Próba trwa co najmniej 3 sekundy i nie dłużej
niż 24 godziny. Nie zaczynamy historycznych plansz; ukończenie po północy
ma jednodniowy margines.

WAŻNE: w pełni klientowa gra nigdy nie daje gwarancji wykluczenia oszustw.
Gracz może podejrzeć lokalną odpowiedź, użyć automatu albo ominąć raportowanie
podpowiedzi. Mechanizm eliminuje podstawowe fałszerstwa API i duplikaty;
do turniejów o nagrody potrzebny byłby bardziej rygorystyczny model gry.

Klucz service_role nie może trafić do frontendowego JavaScriptu, GitHub Pages,
logów albo czatu. Używaj go wyłącznie w Edge Functions i sekretach Actions.

## Co właściciel musi podłączyć

1. Utwórz staging i projekt produkcyjny Supabase w UE, skonfiguruj uwierzytelnianie
   oraz ochronę zgodnie z docs/security/ACCOUNTS.md.
2. Na stagingu uruchom migracje kont, następnie migrację verified_scores.
3. Dla Edge Function puzli-score ustaw APP_ORIGIN na dokładny origin strony
   (np. https://huzyk.github.io). Opisana funkcja samodzielnie sprawdza JWT
   i sesję. Sprawdź wymogi platformowego verify_jwt dla wybranego typu tokenów.
4. W GitHub Actions ustaw sekrety SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY.
   Nocny workflow automatycznie zasili siedem kolejnych dni kanonicznych
   rozwiązań po aktywacji. Ręczna komenda:

       npm ci
       node scripts/seed-verified-puzzles.mjs --start 2026-10-16 --days 7 --upload

   Bez flagi --upload komenda sprawdza plansze bez wysyłania danych i bez sekretów.
   Powtarzając zasilanie, nie wolno nadpisać istniejącego rekordu.
5. Sprawdź na dwóch rzeczywistych kontach ochronę tabel i RPC, ukończenie
   prawidłowe i nieprawidłowe, idempotencję, cofnięte sesje, brak publicznego
   dostępu do rozwiązania i opóźnienia po północy.
6. Uzupełnij politykę prywatności o oficjalne wyniki, retencję i zgodę na
   publiczny ranking.

## Dalsze czynności w kodzie po połączeniu kont

Flaga verifiedBackendEnabled w src/services/verified-game-api.js jest FALSE.
Wszystkie sześć kontrolerów przesyła przygotowany dowód ukończenia do
src/services/verified-session.js, który buforuje zdarzenia rozpoczęcia,
podpowiedzi i ukończenia we właściwej kolejności. Po podłączeniu kont i
rzetelnych testach staging można włączyć flagę, aby rozpocząć oficjalne
zliczanie. Gry lokalne nadal działają także bez połączenia z siecią.
Front-end NIE pokazuje fikcyjnych centralnych rankingów.

Po aktywacji stworzyć interfejs przełącznika zgody na publikację pseudonimu,
prawdziwe rankingi oraz percentyle. Zmiany targetów i reguł punktacji
wymagają wersjonowania, aby nie zmieniać historycznych wyników.

## Testy

npm test — czysta punktacja, walidacja rozwiązań i izolacja PostgreSQL w PGlite.
npm run test:e2e — dotychczasowe gry bez aktywnego backendu.
Testy rzeczywistego projektu staging Supabase pozostają konieczne.

Puzli IQ i dziewięć odznak otrzymują również osobny, prywatny widok po stronie
serwera (puzli_my_progress), pochodzący wyłącznie ze zweryfikowanych wyników.
Dotychczasowe lokalne PUZLI IQ pozostaje bez zmian aż do jawnej migracji.
