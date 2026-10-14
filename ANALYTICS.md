# PUZLI — analityka zachowania graczy

## Uruchomienie

PUZLI działa na GitHub Pages, dlatego GA4 wymaga **publicznego identyfikatora pomiaru** zaczynającego się od `G-`. Nie jest to hasło ani token dostępu.

1. Utwórz usługę i strumień danych **Web** w Google Analytics 4 dla adresu PUZLI.
2. Otwórz `src/services/analytics-config.js` i wstaw swój identyfikator zamiast pustego stringa.
3. Opublikuj commit w gałęzi używanej przez Pages (`preview` w obecnym ustawieniu).
4. Otwórz opublikowaną stronę w czystej przeglądarce. Wybierz **Włącz statystyki**. Sprawdź obecność zdarzeń w **GA4 → Raporty → Czas rzeczywisty**.
5. Po odmowie Google Analytics nie powinien być wczytywany. Zgoda jest opcjonalna, a użytkownik może ją zmienić w stopce strony głównej.

Uwaga: brak skonfigurowanego identyfikatora wyłącza analitykę całkowicie, łącznie z banerem. Lokalny serwer testowy także jej nie ładuje.

## Co mierzymy

| Zdarzenie | Interpretacja |
| --- | --- |
| `home_opened` | otwarcie strony głównej |
| `game_selected` | wybór karty gry lub przycisku dziennego zestawu |
| `game_opened` | załadowanie planszy |
| `game_started` | pierwszy ruch, wykluczając wznowienia |
| `hint_used` | użycie podpowiedzi |
| `game_completed` | ukończenie gry, z trybem Daily lub Trening |
| `daily_completed` | komplet pięciu gier na dany dzień |
| `game_load_failed` | błąd przygotowania planszy |
| `daily_visit` | pierwsza wizyta w nowym dniu kalendarzowym (po wyrażeniu zgody) |
| `day_1_return` | wizyta dzień po **pierwszym dniu zbierania danych**, nie po pierwszej historycznej wizycie |
| `day_7_return` | wizyta siódmego dnia od pierwszego dnia zbierania danych |

W parametrze `game_id` są: korony, duet, bloki, latarnie, zip; `game_mode` rozróżnia Daily i Trening. `elapsed_seconds` i `hints_used` opisują wykonanie zadania.

Dane `localId`, `eventId`, losowe `puzzleId`, maile i adresy URL nie są przekazywane do GA4. Zdarzenia ukończenia Daily mają ochronę przed wielokrotnym wysłaniem z jednego urządzenia.

## Jak oceniać produkt

- **Główna metryka:** powroty D1 — liczba `day_1_return` względem liczby osób z pierwszą wizytą w kohorcie z poprzedniego dnia. Same liczniki zdarzeń nie wystarczą do dokładnego wyliczenia kohort.
- **Lejek gry:** `game_opened` → `game_started` → `game_completed`, filtrowany po `game_id` i `game_mode = daily`.
- **Ukończenie zestawu:** `daily_completed` względem aktywnych graczy Daily w danym dniu.
- **Jakość:** `hint_used`, `game_load_failed`, czas ukończenia gry, osobno dla każdego tytułu.

Dla poprawnych odsetków konwersji i kohort użyj eksploracji GA4 z użytkownikami, zamiast dzielić surowe liczby wydarzeń, bo jedna osoba może otwierać tę samą planszę wielokrotnie. Ponieważ GA4 wymaga zgody, raporty obejmą jedynie użytkowników, którzy ją wyrazili. Nie należy automatycznie uogólniać ich na wszystkich odwiedzających.

## Ograniczenia

Przechowywanie postępów gry nadal działa **lokalnie w przeglądarce**, niezależnie od zgody. Brak kont i brak synchronizacji między urządzeniami. GA4 nie zbiera historycznych zdarzeń sprzed uruchomienia identyfikatora pomiaru.
