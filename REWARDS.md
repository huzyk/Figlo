# PUZLI IQ, rangi, odznaki, punkty i ranking znajomych

## Dostępne od 15 października 2026

- **PUZLI IQ** to własny wskaźnik zaangażowania/postępu w grach, nie test psychometryczny ani miara inteligencji.
- Algorytm: 100 + min(18, floor(ukończone_gry/4)) + min(16, floor(gry_bez_podpowiedzi/5)) + min(16, floor(pełne_zestawy/4)).
- Rangi: Nowicjusz (<108), Logik (108+), Strateg (118+), Ekspert (130+), Mistrz (143+).
- 9 osiągnięć ustalanych z rzeczywistych danych w przeglądarce. Historia legacy zachowana. Brak historycznej informacji o podpowiedziach nie tworzy automatycznie odznak perfekcyjnych. Odznaka „Siedem kompletów” oznacza siedem pełnych zestawów łącznie, nie siedem kolejnych dni (ciągłość mierzy osobna odznaka aktywności).
- Ukończenie z nieznaną liczbą podpowiedzi (`null`) nie dostaje premii za samodzielność i nie zalicza czystego kompletu. Zweryfikowane `0` daje premię +5. Nowe ścieżki gry zapisują licznik podpowiedzi jawnie.
- Punktacja Daily **v3** (wspólna skala lokalna i przygotowanego backendu): **10 pkt za ukończenie + od 0 do 10 za szybkość + 5 bez podpowiedzi**, do tego **20 pkt za pełny zestaw**. Maksymalnie **170 pkt/dzień**. Szybkość liczona w 11 progach (0–10 pkt) od zapisanego czasu względem odrębnego czasu odniesienia każdej gry (Korony 240 s, Duet i Zip 210 s, Bloki i Latarnie 270 s, Sudoku 300 s). Wynik bez wiarygodnego czasu nie dostaje premii za szybkość. Trening i wyzwanie z linku nie naliczają punktów. Reset nie usuwa informacji o wykorzystanej pomocy.
- Stare nagrody w localStorage (100/120/+80 oraz poprzednia wersja premii za szybkość) są na odczycie przeliczane na nową skalę za pomocą zachowanych czasów i liczby podpowiedzi. Wyświetlane sumy i punkty tygodnia nie mieszają dwóch skal; stara suma jest zachowywana wyłącznie jako `legacyTotalPoints` do celów migracji. Gdy brakuje czasu lub historii podpowiedzi, premia nie jest dopisywana na podstawie domysłów. Zdobyte odznaki, serie i liczba ukończeń zostają zachowane.
- Wyniki z linków rankingowych mają odtąd **wersję 3**. Stare linki i wpisy znajomych w wersjach 1 i 2 nie mogą być porównywane z nową skalą; znajomi powinni przesłać nowe wyniki. Wyniki lokalne nie są weryfikowane serwerowo ani synchronizowane pomiędzy urządzeniami.
- Osobne serie: aktywności (minimum jedna gra dziennie) i pełnych zestawów (wszystkie dostępne gry). Poprzednia seria zachowana jako seria kompletów.
- Dzienny rekord nagród jest zapisywany w localStorage; tygodniowe wyniki są sumowane od poniedziałku według daty Europe/Warsaw.
- Ranking znajomych działa w trybie **wymiany linków**: użytkownik wybiera nazwę i udostępnia link zawierający wynik tygodniowy; odbiorca otwiera link, a nadawca pojawia się na jego lokalnej liście. Aktualizacja wyników wymaga ponownego udostępnienia linku. Udostępnione wyniki nie są podpisane ani weryfikowane, więc nie należy ich wykorzystywać do nagród lub oficjalnej rywalizacji.
- Payload rankingu jest w fragmencie URL (`#rywalizacja?wynik=...`), który nie jest wysyłany w żądaniu strony; po odczycie jest usuwany z paska adresu. Link nadal zawiera dane możliwe do odczytania przez odbiorcę — to nie szyfrowanie.
- Karta po pojedynczej grze prowadzi do tej samej daty i wersji planszy w trybie `challenge`. Nieznana lub niedostępna wersja daje jawny błąd. Karta zestawu zaprasza do bieżących gier i nie obiecuje historycznego manifestu.
- Odczyt starszego dnia nie usuwa postępu nowszego; pierwszy zapisany wynik jest trwały i służy deduplikacji. Ciężkie sesje Koron i Duetu przechowywane są przez 14 dni, historia nagród przez 400 dni.
- Punkty za szybkość: do 10% czasu odniesienia = 10 pkt, do 20% = 9, do 34% = 8, do 50% = 7, do 70% = 6, do 100% = 5, do 130% = 4, do 160% = 3, do 190% = 2, do 230% = 1, powyżej = 0. Czas krótszy niż 3 sekundy nie daje bonusu. Nowa wersja przelicza zachowane lokalne wyniki i zmienia sumy punktów, ale nie usuwa ukończeń ani odznak.
- Nie ma centralnego rankingu, automatycznej synchronizacji ani kont między urządzeniami. Do tego wymagany jest backend i serwerowa weryfikacja rezultatów.

## Testy

Node: \`npm test\`; Playwright: \`npm run test:e2e\`.

## Integracja przyszłego backendu

Zamiast ufać wynikowi z linku, zapisać profile użytkowników, identyfikator dziennej łamigłówki i ukończenia na serwerze oraz generować ligę z serwerowych danych. Wprowadzić limity, walidację rozwiązania i ochronę przed duplikacją. Publiczny klient GitHub Pages nie może zawierać tajnego klucza API.

