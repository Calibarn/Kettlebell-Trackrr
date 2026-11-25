---
name: verify
description: Tagwerk in der laufenden App prüfen (Chromium über Playwright) – starten, bedienen, Stolpersteine.
---

# Tagwerk in der App prüfen

Kein Build. `npm ci` und `npx playwright install chromium`, dann das Repo als statische Dateien ausliefern
(`python3 -m http.server 4190 --bind 127.0.0.1`) und mit `@playwright/test` (`chromium`) bedienen, 390 × 844.

## Starten
- Vor dem Laden per `addInitScript`: `window.__kbtNoSplash = window.__kbtNoSetup = true`; Neuigkeiten aus: `jan-kb-notes-v1` = `{"seen":null,"auto":false}`.
- Daten einmalig in `localStorage` legen (Schlüssel: `KEYS` in `app.js`), z. B. Profil, Ergebnisse, Rennen, Läufe.
- Datum: `page.clock.setFixedTime(...)` – so erreicht man jede Planwoche. Kontext mit `timezoneId: 'Europe/Berlin'`, `serviceWorkers: 'block'`.
- Plattform über den User-Agent (Android/iPhone), sonst `data-os=other` (Desktop: zeigt beides).

## Wege
- Start → „Heute dran“ (`#startcontent .srowt`, Uhr-Schritte `.swatch`); Laufen → Läufe (`[data-runtab="laeufe"]`, `#runkm`, `#runaddbtn`, `#runreps`).
- Mehr: Kachel `[data-go="mehr"]`; Sync `#syncsave` (Download) und `#syncfile` (Datei laden); Zurücksetzen `#settingsreset`.
- Zwei Tabs: zwei Seiten im selben Kontext. Anderes Gerät: neuer Kontext.

## Stolpersteine
- Pace Race braucht eine feste Distanz (`dist: '10k', km: 12, fmt: 'pace'`), sonst plant die App nichts.
- Aufklappbare Bereiche: das `toggle`-Ereignis kommt verzögert und klappt andere derselben Gruppe zu – kurz warten.
- Tests lokal mit `--workers=2`, sonst laden Skripte unter Last nicht rechtzeitig. `sync.spec.js` nutzt fest Port 4173.
