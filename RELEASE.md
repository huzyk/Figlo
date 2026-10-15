# Publikacja PUZLI

Produkcja pozostaje na dotychczasowym GitHub Pages: **Deploy from a branch → `preview` → `/ (root)`**. Nazwa `preview` jest historyczna — to gałąź produkcyjna. Kod nie zmienia ustawień hostingu ani domeny.

## Zwykłe wydanie

1. Otwórz PR do `main`. Workflow **Figlo tests** uruchamia `npm ci`, testy jednostkowe i Playwright na Node.js 22. Przejrzyj zmianę i scal PR po zielonym wyniku.
2. Po testach commita na `main` automatycznie startuje **Publish tested main to GitHub Pages**. Publisher pobiera konkretny SHA z zakończonego CI i ponownie uruchamia komplet testów dla tego samego checkoutu.
3. Publisher sprawdza źródło Pages, aktualny `main` i zgodność historii `preview`. Wysyła wyłącznie przetestowany SHA, wyłącznie fast-forward. Jeżeli `main` już się zmienił, starszy run pomija publikację; następny run obsłuży nowy commit. Rozbieżna historia zatrzymuje publikację bez nadpisywania produkcji.
4. Publisher zleca standardowy build Pages. Poczekaj na zielony **pages build and deployment** i sprawdź stronę pod adresem pokazanym w **Settings → Pages**. Sprawdź otwarcie gry, zakończenie i udostępnienie wyniku na telefonie.

Aktualizacja gałęzi `preview` nie jest jeszcze potwierdzeniem zakończonego wdrożenia. Status builda Pages jest osobnym krokiem. Produkcja działa dalej, jeżeli testy lub publikacja nowej wersji się zatrzymają.

## Publikacja ręczna i ponowienie

W **Actions → Publish tested main to GitHub Pages → Run workflow** wybierz `main`. Ta ścieżka również instaluje zależności i uruchamia unit + E2E dla konkretnego SHA; nie omija bramki testowej. Workflow uruchomiony dla innej gałęzi nie publikuje.

Nocny run o **04:47 UTC** jest zapasową ścieżką dla zmian automatyzacji i nieudanych zleceń. Po błędzie API lub builda Pages ponów publisher na `main`: także gdy `preview` wskazuje już ten sam SHA, ponownie zleci build. Workflow nie czeka na wynik zewnętrznego builda Pages, więc należy sprawdzić jego status w Actions/Pages.

Publikacje mają wspólną kolejkę. Fast-forward i weryfikacja SHA nie pozwalają staremu runowi cofnąć nowszego `preview`. Nie używaj `force push` do naprawiania wydania.

## Plansze Duetu

Jedynym automatycznym generatorem jest **Refresh Duet daily puzzles** (`duet-daily-buffer.yml`). Codziennie o **03:41 UTC** uzupełnia 365 dni od dzisiejszej daty warszawskiej i waliduje istniejące rekordy.

- `--skip-existing` zachowuje opublikowane pliki bajt po bajcie. Uszkodzony plik zatrzymuje zadanie, zamiast podmieniać planszę graczom.
- Generator zapisuje tylko `data/duet/` na `main`. Nie publikuje i nie zapisuje do `preview`.
- Po commicie zleca publisher przez `workflow_dispatch`, ponieważ push z `GITHUB_TOKEN` nie uruchamia kolejnego workflow typu push. Publisher przetestuje wybrany SHA. Nocny publisher pozostaje ścieżką zapasową, gdy dispatch się nie powiedzie.
- Gdy ktoś zmieni `main` podczas generowania, zwykły push zostanie odrzucony. Ponów generator; nie rebazuje on automatycznie niezweryfikowanych danych.
- Workflow **Check Duet daily buffer** niezależnie zgłasza brak co najmniej 14 kolejnych dni. Czerwony wynik wymaga sprawdzenia logu generatora i ponowienia go.

Starsze workflowy `generate-duet-daily.yml` i `refresh-duet-today.yml` zostały usunięte, aby nie nadpisywały tych samych dat lub gałęzi produkcyjnej.

Lokalne, bezpieczne uzupełnienie i sprawdzenie:

```sh
node scripts/generate-duet-daily.mjs --start YYYY-MM-DD --days 365 --skip-existing
node scripts/check-duet-buffer.mjs --start YYYY-MM-DD --days 14
```

Zmiany danych przeprowadź przez PR, tak jak zmianę kodu. Nie regeneruj już udostępnionej daty innym generatorem.

## Cofnięcie wydania

Utwórz PR na `main` z `git revert <SHA-błędnej-zmiany>`. Dla merge commita użyj `git revert -m 1 <SHA-merge>`. Cofnięcie jest nowym commitem: przechodzi te same testy i automatyczną publikację, zachowując historię obu gałęzi. Nie cofaj gałęzi `preview` przez reset ani force push.

Jeżeli błąd dotyczy generatora, cofnij kod generatora i zatrzymaj/ponów jego run po poprawce. Usuwanie lub zamiana dzisiejszej opublikowanej planszy może unieważnić zapisany postęp; traktuj taki przypadek osobno. Nie wycofuj istniejących plansz tylko po to, aby cofnąć interfejs.

## Zalecane ustawienia administratora

Te ustawienia nie zostały zmienione przez kod i nie są wymagane do uruchomienia obecnej ścieżki publikacji:

- **Pages:** zachowaj źródło `preview`, katalog `/`. Publisher zatrzyma się z czytelnym błędem przy innym źródle; przejście na Pages Actions wymaga osobnej migracji.
- **Actions:** organizacja/repozytorium muszą dopuszczać zadeklarowane uprawnienia tokena: publisher `contents: write` i `pages: write`; generator `contents: write` i `actions: write` do dispatcha. Nie są potrzebne nowe sekrety.
- **`main`:** blokuj force push i usunięcie gałęzi; dla zmian produktu wymagaj PR i zielonego joba `test` z workflow **Figlo tests**. Przed włączeniem bezwzględnego wymogu PR rozwiąż wyjątek automatyzacji: obecny generator robi bezpośredni, ograniczony commit danych przez `GITHUB_TOKEN`, który może być blokowany przez ochronę. W takim przypadku potrzebna jest dedykowana GitHub App z wąskim wyjątkiem albo zmiana generatora na PR. Nie wyłączaj testów produktu, aby przepuścić bota.
- **`preview`:** blokuj force push/usunięcie i ogranicz zapis do tożsamości publishera. Nie wymagaj tu PR, jeśli zachowujesz bezpośredni awans FF. Jeżeli reguły repozytorium nie pozwalają odróżnić publishera używającego `GITHUB_TOKEN`, pełne ograniczenie zapisu wymaga dedykowanej GitHub App/tokena oraz konfiguracji administratora.

**Granica zabezpieczenia:** obecne Pages buduje z gałęzi. Zewnętrzny użytkownik lub aplikacja z prawem bezpośredniego zapisu do `preview` może ominąć workflow i uruchomić build przed testami. Repozytorium usuwa konkurujących writerów i zabezpiecza własny publisher; pełna bramka dla wszystkich aktorów wymaga ochrony `preview` po stronie GitHub. Takiej gwarancji nie daje sam plik YAML.
