# PUZLI IQ, rangi, odznaki, punkty i ranking znajomych

## Dostępne od 15 października 2026

- **PUZLI IQ** to własny wskaźnik zaangażowania/postępu w grach, nie test psychometryczny ani miara inteligencji.
- Algorytm: 100 + min(18, floor(ukończone_gry/4)) + min(16, floor(gry_bez_podpowiedzi/5)) + min(16, floor(pełne_zestawy/4)).
- Rangi: Nowicjusz (<108), Logik (108+), Strateg (118+), Ekspert (130+), Mistrz (143+).
- 9 osiągnięć ustalanych z rzeczywistych danych w przeglądarce. Historia legacy zachowana. Brak historycznej informacji o podpowiedziach nie tworzy automatycznie odznak perfekcyjnych.
- Punktacja Daily: 100 za pierwsze ukończenie gry + 20 jeśli bez podpowiedzi; +80 za pierwszy pełny komplet dnia (maksymalnie 800 pkt/dzień). Trening i wyzwanie z linku nie naliczają punktów. Reset nie usuwa informacji o wykorzystanej pomocy.
- Osobne serie: aktywności (minimum jedna gra dziennie) i pełnych zestawów (wszystkie dostępne gry). Poprzednia seria zachowana jako seria kompletów.
- Dzienny rekord nagród jest zapisywany w localStorage; tygodniowe wyniki są sumowane od poniedziałku według daty Europe/Warsaw.
- Ranking znajomych działa w trybie **wymiany linków**: użytkownik wybiera nazwę i udostępnia link zawierający wynik tygodniowy; odbiorca otwiera link, a nadawca pojawia się na jego lokalnej liście. Aktualizacja wyników wymaga ponownego udostępnienia linku. Udostępnione wyniki nie są podpisane ani weryfikowane, więc nie należy ich wykorzystywać do nagród lub oficjalnej rywalizacji.
- Payload rankingu jest w fragmencie URL (`#rywalizacja?wynik=...`), który nie jest wysyłany w żądaniu strony; po odczycie jest usuwany z paska adresu. Link nadal zawiera dane możliwe do odczytania przez odbiorcę — to nie szyfrowanie.
- Karta po pojedynczej grze prowadzi do tej samej daty i wersji planszy w trybie `challenge`. Nieznana lub niedostępna wersja daje jawny błąd. Karta zestawu zaprasza do bieżących gier i nie obiecuje historycznego manifestu.
- Odczyt starszego dnia nie usuwa postępu nowszego; pierwszy zapisany wynik jest trwały i służy deduplikacji. Ciężkie sesje Koron i Duetu przechowywane są przez 14 dni, historia nagród przez 400 dni.
- Nie ma centralnego rankingu, automatycznej synchronizacji ani kont między urządzeniami. Do tego wymagany jest backend i serwerowa weryfikacja rezultatów.

## Testy

Node: \`npm test\`; Playwright: \`npm run test:e2e\`.

## Integracja przyszłego backendu

Zamiast ufać wynikowi z linku, zapisać profile użytkowników, identyfikator dziennej łamigłówki i ukończenia na serwerze oraz generować ligę z serwerowych danych. Wprowadzić limity, walidację rozwiązania i ochronę przed duplikacją. Publiczny klient GitHub Pages nie może zawierać tajnego klucza API.

