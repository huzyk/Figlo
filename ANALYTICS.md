# PUZLI — analityka zachowania graczy

## Uruchomienie

PUZLI działa na GitHub Pages, dlatego GA4 wymaga **publicznego identyfikatora pomiaru** zaczynającego się od `G-`. Nie jest to hasło ani token dostępu.

1. Utwórz usługę i strumień danych **Web** w Google Analytics 4 dla adresu PUZLI.
2. Otwórz `src/services/analytics-config.js` i wstaw swój identyfikator zamiast pustego stringa.
3. Wprowadź zmianę przez PR do `main`. Publikator przetestuje dokładną wersję przed wdrożeniem do Pages; nie wypychaj zmian bezpośrednio do `preview`.
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
| `game_completed` | ukończenie gry, z trybem Daily, Trening lub Wyzwanie |
| `daily_completed` | komplet sześciu gier na dany dzień |
| `player_activated` | pierwsze ukończenie Daily od rozpoczęcia pomiaru po zgodzie |
| `activation_day_1_return`, `activation_day_7_return` | ukończenie Daily dokładnie w dniu 1/7 od aktywacji |
| `share_started` | zamiar udostępnienia, nie dowód wysłania |
| `share_native_completed` | system przyjął udostępnienie; nie dowodzi odbioru |
| `share_copied` | skuteczne skopiowanie |
| `share_cancelled`, `share_manual_fallback` | anulowanie lub tekst do ręcznego skopiowania |
| `shared_result_opened` | odczyt udostępnionego wyniku znajomego |
| `game_load_failed` | błąd przygotowania planszy |
| `daily_visit` | pierwsza wizyta w nowym dniu kalendarzowym (po wyrażeniu zgody) |
| `day_1_return` | wizyta dzień po **pierwszym dniu zbierania danych**, nie po pierwszej historycznej wizycie |
| `day_7_return` | wizyta siódmego dnia od pierwszego dnia zbierania danych |

W parametrze `game_id` są: korony, duet, bloki, latarnie, zip, sudoku; `game_mode` rozróżnia `daily`, `training` i `challenge`. `elapsed_seconds` i `hints_used` opisują wykonanie zadania.

Własne zdarzenia nie przekazują `localId`, `eventId`, `puzzleId`, maili, pseudonimów ani treści linków. Standardowy kontekst `page_view` zawiera adres strony i referrer ustawione bez parametrów oraz fragmentów URL. Przed aktywacją sprawdź żądania sieciowe i wyłącz automatyczne pomiary zmian historii URL w ustawieniach strumienia GA4; allowlista zdarzeń nie zastępuje konfiguracji usługi Google. Zdarzenia ukończenia Daily mają ochronę przed wielokrotnym wysłaniem z jednego urządzenia.

## Jak oceniać produkt

- **Retencja aktywowanych:** kohorta pierwszego ukończenia Daily w D0, potem dowolne ukończenie Daily dokładnie w D1/D7 (`activation_day_1_return`/`activation_day_7_return`). Uwzględniaj tylko kohorty, dla których minął cały dzień obserwacji, w strefie Europe/Warsaw. Same liczniki wydarzeń nie zastępują kohort użytkowników.
- **Retencja wizyt:** `day_1_return`/`day_7_return` liczą wizyty od pierwszego dnia pomiaru. To oddzielna miara, nie ukończenie gry.
- **Udostępnianie:** porównuj zamiar, kopiowanie i ukończenia w trybie `challenge`; aktualna implementacja nie przypisuje jeszcze nowych graczy do konkretnego polecającego i nie jest pełnym systemem atrybucji poleceń.
- **Lejek gry:** `game_opened` → `game_started` → `game_completed`, filtrowany po `game_id` i `game_mode = daily`.
- **Ukończenie zestawu:** `daily_completed` względem aktywnych graczy Daily w danym dniu.
- **Jakość:** `hint_used`, `game_load_failed`, czas ukończenia gry, osobno dla każdego tytułu.

Dla poprawnych odsetków konwersji i kohort użyj eksploracji GA4 z użytkownikami, zamiast dzielić surowe liczby wydarzeń, bo jedna osoba może otwierać tę samą planszę wielokrotnie. Ponieważ GA4 wymaga zgody, raporty obejmą jedynie użytkowników, którzy ją wyrazili. Nie należy automatycznie uogólniać ich na wszystkich odwiedzających.

## Ograniczenia

Przechowywanie postępów gry nadal działa **lokalnie w przeglądarce**, niezależnie od zgody. Brak kont i brak synchronizacji między urządzeniami. GA4 nie zbiera historycznych zdarzeń sprzed uruchomienia identyfikatora pomiaru.


Pomiar aktywacji zaczyna się dopiero po zgodzie. Cofnięcie zgody usuwa lokalne daty pomiaru; ponowne włączenie rozpoczyna nową lokalną obserwację. Historia gry nie jest odtwarzana do GA4.
