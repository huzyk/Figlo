# PUZLI — lista startowa bety (październik 2026)

## 1. Bramka przed zaproszeniem testerów

- [ ] `main` i `preview` wskazują tę samą, zatwierdzoną wersję.
- [ ] `Figlo tests`, `Publish tested main to GitHub Pages` i `pages build and deployment` mają zielony status dla tej wersji.
- [ ] Na prawdziwym telefonie otwiera się **każda z sześciu gier**, działają cofnięcie, reset, podpowiedź i ukończenie. Plansza i podstawowe przyciski mieszczą się w ekranie.
- [ ] Po odświeżeniu strony ruchy i postęp Daily są zachowane; ponowne wejście w zaliczoną grę uruchamia Trening.
- [ ] Przetestowano iPhone/Safari i Android/Chrome; brak powiększania przy dwukrotnym stuknięciu.
- [ ] Sprawdzono zmianę dnia wg `Europe/Warsaw` (również trwającą grę o północy), zapis serii i nowe plansze.
- [ ] `Check Duet daily buffer` jest zielony, a kolejne 14 dni ma pliki `data/duet/YYYY-MM-DD.json`.
- [ ] Udostępniony wynik otwiera prawidłowy tryb Wyzwanie, nie zmienia Daily ani PUZLI IQ.
- [ ] Nie ma krytycznych błędów konsoli ani nieobsłużonych błędów załadowania.
- [ ] Ustawiono i zweryfikowano zgodę na GA4, jeśli chcemy mierzyć retencję podczas bety.

**Ważne:** obecnie identyfikator `GA4_MEASUREMENT_ID` w `src/services/analytics-config.js` jest pusty. Dopóki właściciel nie utworzy strumienia GA4 i nie uzupełni poprawnego identyfikatora `G-...`, nie będzie danych z analityki. Nie zastępować go losowym identyfikatorem. Sprawdzić także konfigurację prywatności strumienia opisną w `ANALYTICS.md`.

## 2. Plan pilotażu

- **Próba:** 30–50 osób niezwiązanych z tworzeniem produktu. W miarę możliwości różne grupy wiekowe i urządzenia.
- **Czas:** 14 kolejnych dni. Jeden link do produkcji: https://huzyk.github.io/Figlo/ .
- **Dzień 0:** udostępnić link z prostą prośbą „Zagraj w kilka gier bez instrukcji i daj znać, co było niejasne”. Nie sugerować najlepszego sposobu gry.
- **Dni 1–7:** obserwować rzeczywiste użycie i błędy. Nie przypominać codziennie uczestnikom; chcemy poznać spontaniczne powroty.
- **Dzień 7:** zebrać krótkie odpowiedzi: którą grę lubią najbardziej/najmniej, czy podpowiedzi były zrozumiałe, co ich zatrzymało, czy chcą wrócić.
- **Dzień 14:** podsumować zdarzenia i feedback, wybrać maksymalnie trzy najważniejsze usprawnienia. Drobne sugestie wizualne odłożyć.

Użytkownicy mogą grać bez analityki. Dane GA4 opisują **wyłącznie osoby, które wyraziły zgodę**, i nie są pełnym obrazem wszystkich odwiedzających. Nie żądać od testerów zrzutów localStorage ani prywatnych linków porównania wyników.

## 3. Obserwowane wskaźniki

| Wskaźnik | Definicja |
| --- | --- |
| Start gry | Użytkownicy z `game_started`, osobno dla `game_id` i `game_mode=daily` |
| Ukończenie gry | Użytkownicy z `game_completed` po rozpoczęciu gry, osobno dla tytułów; nie dzielić liczników zdarzeń bez deduplikacji użytkowników |
| Pełny komplet | `daily_completed` — wszystkie wymagane gry danego dnia |
| Aktywacja | `player_activated` — pierwszy pełny komplet Daily **od zgody** |
| D1 i D7 | Kohorta `player_activated` oraz odpowiednio `activation_day_1_return` i `activation_day_7_return` |
| Podpowiedzi | Użycia `hint_used` i ukończenia z `hints_used` |
| Problemy | `game_load_failed`, zgłoszenia testerów, błędy w przeglądarce |
| Udostępnianie | `share_started`, `share_copied`, `share_native_completed`; nie mylić intencji z rzeczywistym poleceniem |

D1/D7 liczyć dopiero dla kohort, którym upłynęła odpowiednio pełna doba / siedem dni obserwacji. Strefa raportowania: `Europe/Warsaw`. Same liczniki zdarzeń nie wystarczą do obliczenia retencji — użyć eksploracji kohort GA4.

## 4. Zasada wejścia na otwartą premierę

Nie otwierać dużej kampanii, dopóki nie ma awarii krytycznych, codzienne plansze pozostają stabilne, a kluczowe ścieżki działają na rzeczywistych telefonach. Wyniki bety traktować jako sygnał jakościowy (30–50 osób to mała próba), nie dowód na skalowalną retencję. W pierwszej kolejności naprawiać zgłoszone blokery, potem problemy ze zrozumieniem zasad i podpowiedzi.

## 5. Przedstawienie błędu

Prosić o: nazwę gry, model telefonu i przeglądarkę, datę (dzień planszy), wykonane kroki, oczekiwany i zaobserwowany wynik. Screen tylko wtedy, gdy nie ujawnia prywatnych danych. Publiczne zgłoszenia GitHub wymagają konta GitHub; dla nietechnicznych testerów właściciel powinien przygotować prosty, prywatny kanał odpowiedzi (np. formularz).
