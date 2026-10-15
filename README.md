# PUZLI

Codzienny zestaw gier logicznych. Kod produktu znajduje się w repozytorium `Figlo`; aplikacja jest statyczna i nie wymaga serwera aplikacyjnego.

## Uruchomienie lokalne

Wymagany Node.js 22.

```sh
npm ci
node tests/server.mjs
```

Otwórz `http://127.0.0.1:4173`. Stan gry jest przechowywany w przeglądarce. Data zestawu jest liczona według strefy `Europe/Warsaw`.

## Pilotaż

Przed zaproszeniem pierwszych testerów przejdź przez [listę startową bety](BETA.md). Konfiguracja statystyk: [ANALYTICS.md](ANALYTICS.md).

## Sprawdzenie zmian

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

Testy przeglądarkowe obejmują Chromium na ekranie komputera i telefonu. Przed większą premierą sprawdź również prawdziwy telefon i Safari.

## Publikacja

Zmiany przechodzą przez PR do `main`, testy, a następnie automatyczny awans sprawdzonego commita do gałęzi `preview`, z której korzysta obecna produkcja GitHub Pages. Instrukcja publikacji, cofnięcia wydania i ochrony gałęzi: [RELEASE.md](RELEASE.md).
