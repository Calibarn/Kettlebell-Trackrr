# Code-Review – Kettlebell-Trackrr / Tagwerk (`dev`)

**Datum:** 7. November 2026  
**Repository:** [Calibarn/Kettlebell-Trackrr](https://github.com/Calibarn/Kettlebell-Trackrr)  
**Branch:** `dev` (nicht `main`)  
**Untersuchter Commit:** [`121219d90bb5c8d586832c073fd2da45a0c0b6f8`](https://github.com/Calibarn/Kettlebell-Trackrr/commit/121219d90bb5c8d586832c073fd2da45a0c0b6f8)  
**App-Version:** 1.1 („Tagwerk“)  
**Methode:** Statische Review zentraler Codepfade, GitHub Actions und Tests; **keine eigenen Browser-/Mobilgeräte-Tests**.

## Kurzfazit

Der jüngste geprüfte CI-Lauf für diesen Commit hatte **148 von 148 erfolgreichen Playwright-Tests** ([GitHub Actions](https://github.com/Calibarn/Kettlebell-Trackrr/actions/runs/41897125148), 4. November 2026). `dev` lag bei der Prüfung 16 Commits vor und 0 Commits hinter `main`. Die Testbasis und das Datenschutzkonzept sind solide, aber mindestens zwei konkrete Isolationsfehler sollten vor einem Release behoben werden.

**Hinweis:** Diese Review-Datei wurde aufgrund fehlender GitHub-Schreibberechtigung der Integration **nicht** in `dev` committed. Sie liegt als eigenständige Markdown-Datei zur manuellen Übernahme vor. Am Anwendungscode wurde nichts verändert.

## Befunde nach Priorität

### KR-01 – P1 – Test-Reset greift auf Live-IndexedDB zu

- **Fundstellen:** [`app.js` Zeilen 2349–2352](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2349-L2352), [2443–2457](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2443-L2457).
- **Beobachtung:** Der DB-Name in `idb()` ist für Test und Live getrennt (`kb-tracker-test` versus `kb-tracker`). `factoryReset()` löscht hingegen unconditionally `indexedDB.deleteDatabase('kb-tracker')`.
- **Auswirkung:** Ein Werksreset unter `/dev/` kann den gespeicherten Dateihandle der Live-App beseitigen, während die eigene Test-Datenbank bestehen bleibt. Die Cloud-Sync-Datei selbst wird dadurch nicht gelöscht.
- **Empfehlung:** DB-Namen zentral bestimmen und beim Zurücksetzen immer den aktuellen Namespace verwenden. Regressionstest: Test-Reset darf Live-Handle nicht verändern und muss Test-Handle entfernen.
- **Befundtyp:** Aus Code nachvollziehbarer Fehler.

### KR-02 – P1 – Service Worker entfernt fremde Origin-Caches

- **Fundstelle:** [`sw.js` Zeilen 4–9](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/sw.js#L4-L9).
- **Beobachtung:** Der `activate`-Handler ruft Origin-weites `caches.keys()` auf. Der Live-Worker entfernt **alle** Cache-Namen außer dem aktuellen `VERSION`-Namen und Namen mit `dev-`-Präfix.
- **Auswirkung:** Andere Web-Apps unter derselben Origin (beispielsweise weitere `calibarn.github.io`-Projekte) können Offline-Caches verlieren.
- **Empfehlung:** Eindeutige, projektspezifische Präfixe (`tagwerk-live-`, `tagwerk-dev-`) verwenden und ausschließlich alte eigene Caches entfernen. Test mit fremdem Cache-Namen ergänzen.
- **Befundtyp:** Aus Code nachvollziehbarer Fehler.

### KR-03 – P2 – Unbekannte Felder gehen beim Backup-Import verloren

- **Fundstellen:** [`app.js` Zeilen 2559–2567](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2559-L2567), [2582–2597](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2582-L2597).
- **Beobachtung:** Importierte Laufdatensätze werden aus `id`, `date`, `km` und den bekannten Zusatzfeldern neu aufgebaut. Rennen werden auf feste Felder abgebildet. Andere, künftig hinzugefügte Felder bleiben nicht erhalten.
- **Auswirkung:** Beim Import einer Sicherung aus einer neueren App in eine ältere Version können Metadaten beim erneuten Export verloren gehen. Dies unterscheidet sich vom bereits vorhandenen Schutz unbekannter Datensätze beim normalen Laden.
- **Empfehlung:** Unbekannte Eigenschaften bei Backup-Roundtrips bewusst erhalten oder neuere Schema-Versionen mit verständlichem Hinweis ablehnen. Tests mit unbekannten Eigenschaften für `runLog`, `races` und `profile` ergänzen.
- **Befundtyp:** Nachvollziehbare Kompatibilitätslücke; konkreter Datenverlust hängt vom Eingabeformat ab.

### KR-04 – P2 – Gerätesynchronisierung vertraut lokalen Uhren

- **Fundstellen:** [`app.js` Zeilen 2275–2298](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2275-L2298), [2307–2343](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2307-L2343).
- **Beobachtung:** Änderungen werden über `Date.now()` datiert. Beim Zusammenführen gewinnt in Konfliktfällen regelmäßig der höchste Zeitstempel.
- **Auswirkung:** Geräte mit falsch gehender Uhr können ältere Änderungen gegenüber neueren bevorzugen oder Löschkonflikte falsch auflösen.
- **Empfehlung:** Konfliktstrategie mit Revisionszählern / Hybrid Logical Clocks oder expliziten Konflikten prüfen. Test mit 2 Geräten und deutlicher Uhrzeitabweichung.
- **Befundtyp:** Robustheitsrisiko, nicht als im Produkt aufgetretener Fehler nachgewiesen.

### KR-05 – P2 – Upgrade-Checker fehlt als verpflichtendes Release-Gate

- **Fundstellen:** [`.github/workflows/test.yml`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/.github/workflows/test.yml), [`tools/upgrade-check.js`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/tools/upgrade-check.js).
- **Beobachtung:** Das Projekt hat einen ausführlichen Datenmigrations-Checker, der Live→Dev, Backup-Roundtrips und Sync prüft. Der geprüfte GitHub-Workflow ruft nur `npx playwright test` auf. Der separate Upgrade-Checker wird darin nicht ausgeführt.
- **Auswirkung:** Ein grüner CI-Lauf bedeutet noch nicht, dass alle bestehenden Nutzerdaten durch das Upgrade unverändert erhalten bleiben.
- **Empfehlung:** Checker als eigenen CI-Job ergänzen, mit eindeutigem `main`/`dev`-Checkout; Promotion nach `main` nur bei grünem Ergebnis. Bericht als Artefakt sichern. Ein möglicher externer zeitgesteuerter Release-Prozess war nicht einsehbar.
- **Befundtyp:** Nachgewiesene Lücke im sichtbaren CI-Workflow.

### KR-06 – P2 – Backup-/Sync-Erfolg wird zu früh signalisiert

- **Fundstellen:** [`app.js` Zeilen 2374–2399](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2374-L2399), [2537–2551](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L2537-L2551).
- **Beobachtung:** Nach Übergabe an `navigator.share()` oder Auslösen eines Downloads werden `syncDone()` beziehungsweise `markBackup()` ausgeführt. Ob die Datei dauerhaft im gewünschten Ziel gespeichert bzw. eine alte Sync-Datei ersetzt wurde, lässt sich dadurch nicht zuverlässig bestätigen.
- **Auswirkung:** Der Anwender könnte eine aktuelle, verifizierbare Sicherung annehmen, obwohl eine Datei nicht am vorgesehenen Ort liegt.
- **Empfehlung:** Status „Download/Teilen gestartet“ von „Sicherung bestätigt“ unterscheiden. Bei Datei-Handles nach Möglichkeit Read-back prüfen; bei manueller Ablage verständliche Rückbestätigung verlangen.
- **Befundtyp:** Plattformabhängiges Datenintegritäts-/UX-Risiko.

### KR-07 – P2 – Datumsvalidierung akzeptiert unmögliche Tage

- **Fundstellen:** [`app.js` Zeile 31](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L31), [1051–1052](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/app.js#L1051-L1052).
- **Beobachtung:** `isDay()` prüft lediglich `/^\d{4}-\d{2}-\d{2}$/`. Auch `2026-02-31` oder `2026-13-40` werden akzeptiert.
- **Auswirkung:** Importierte Daten können Kalender- oder Trainingsplanauswertungen verfälschen.
- **Empfehlung:** Kalendergültigkeit durch Rundlaufprüfung verifizieren und Importtests mit Schaltjahr-/Monatsgrenzen ergänzen.
- **Befundtyp:** Nachgewiesener Validierungsmangel.

### KR-08 – P3 – Native Mobilbrowser-Abdeckung fehlt

- **Fundstellen:** [`playwright.config.js`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/playwright.config.js), [`tests/fixtures.js`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/tests/fixtures.js).
- **Beobachtung:** Tests laufen in Chromium mit mobilem Viewport. Die Sprachausgabe wird für deterministische Tests simuliert.
- **Auswirkung:** Safari/WebKit, PWA-Audio bei gesperrtem Bildschirm und reales Share-/Download-Verhalten sind damit nicht vollständig abgedeckt.
- **Empfehlung:** WebKit-Smoke-Tests und manuelle Checkliste für iPhone-PWA und Android ergänzen.
- **Befundtyp:** Abdeckungslücke, kein nachgewiesener Laufzeitdefekt.

### KR-09 – P3 – Pages-Dokumentation ist widersprüchlich

- **Fundstellen:** [`README.md`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/README.md), [`.github/workflows/deploy.yml`](https://github.com/Calibarn/Kettlebell-Trackrr/blob/dev/.github/workflows/deploy.yml).
- **Beobachtung:** Das README nennt einerseits „GitHub Actions“ als Pages-Quelle und an anderer Stelle „Deploy from a branch“.
- **Auswirkung:** Neuaufsetzung kann zur falschen Pages-Konfiguration führen.
- **Empfehlung:** Alte Setup-Anweisung an den Workflow-Deploy anpassen.
- **Befundtyp:** Dokumentationsfehler.

## Positiv aufgefallen

- **Tests:** 148/148 Playwright-Tests für den geprüften Commit erfolgreich; Fixtures erfassen JavaScript- und Browser-Konsolenfehler.
- **Datenschutz:** Restriktive Content Security Policy mit `connect-src 'self'` und `object-src 'none'`; HTML-Escaping über `esc()`; eigener Test gegen CSV-Formula-Injection.
- **Datenpflege:** Sicherung unlesbarer Einträge, Schema-Backups, Sync-Metadaten mit Löschmarken und separater Upgrade-Checker.
- **PWA-/Branch-Konzept:** Trennung von `dev`, `main` und `hotfix`; eigene `localStorage`-Präfixe und Manifest-Dateien für die Testversion.

## Empfohlene Abarbeitung

1. **Vor Release:** KR-01 und KR-02 korrigieren, Isolationstests ergänzen.
2. **Datenmigrationssicherheit:** KR-03 und KR-05 beheben; KR-06 im Backup-/Sync-Ablauf präzisieren.
3. **Datenvalidität und Konflikte:** KR-04 und KR-07 behandeln und mit Grenzfalltests absichern.
4. **Qualitätspflege:** KR-08/09 erledigen.
5. **Release-Gate:** Gesamte Playwright-Suite und Upgrade-Checker erfolgreich ausführen; iPhone- und Android-Smoke-Test machen.

**Geprüfte Quelle:** ausschließlich Branch `dev` bis Commit `121219d90bb5c8d586832c073fd2da45a0c0b6f8`. Keine Änderungen am Anwendungscode vorgenommen.

## Umsetzung (Stand 7. November 2026, abends)

| Befund | Bewertung | Umsetzung | Commit |
|---|---|---|---|
| KR-01 | bestätigt: `factoryReset()` löschte immer `kb-tracker` | DB-Name zentral in `IDB_NAME`, Reset löscht nur die eigene DB; Test in `testversion.spec.js` (Test-Reset lässt Live-DB stehen) | a8fc1fe |
| KR-02 | bestätigt: Live-Worker löschte alle Caches ohne `dev-`-Präfix der ganzen Origin | Worker löscht nur `kbt-…` bzw. `dev-kbt-…` außer der aktuellen Version; Namen bleiben (kein Cache-Neuaufbau). Test ohne Browser in `serviceworker.spec.js` mit fremdem Cache | a8fc1fe |
| KR-03 | teilweise: Einträge und Profil-Oberfelder blieben schon erhalten, Läufe/Rennen/Ergebnisse/Wochen/Gewicht nicht | Import übernimmt unbekannte Felder (ohne `__proto__`/`constructor`/`prototype`), bekannte Felder weiter geprüft; unbekannte Profil-Oberfelder auch beim Import. Unbekannte Felder *in* `hr`/`kit`/`week` bewusst nicht (würde ungültige Werte zurückholen). Test in `daten.spec.js` | a8fc1fe |
| KR-04 | Risiko bestätigt (Uhr eines Geräts geht vor → spätere Änderung verliert) | statt Hybrid Logical Clock: neuer Zeitstempel nie kleiner als der größte bekannte + 1 (eine Zeile). Zwei-Geräte-Test mit +1 Tag Uhrabweichung, Gegenprobe mit alter Logik schlägt fehl | a8fc1fe |
| KR-05 | bestätigt | Job `upgrade-check` auf dev/hotfix/PR, Bericht als Artefakt; Testversion wird nur bei grünen Tests **und** grüner Datenprüfung veröffentlicht | a8fc1fe |
| KR-06 | teilweise: Teilen und Datei-Dialog melden erst nach Abschluss, nur der Download war „zu früh“ | Download-Hinweis ehrlich („Download gestartet“). Ein Rücklesen ist beim Download technisch nicht möglich; „Rückbestätigung verlangen“ wäre mehr Reibung als Nutzen | a8fc1fe |
| KR-07 | bestätigt | `isDay()` prüft echte Kalendertage per Rundlauf (auch 2026-13-01 ohne Absturz); Import verwirft solche Einträge. Gespeicherte ungültige Altdaten werden nicht gelöscht, sondern wie andere unlesbare Einträge aufbewahrt | a8fc1fe |
| KR-08 | bestätigt | nicht blockierender CI-Job `webkit-smoke` (Rundgang `smoke.spec.js` in WebKit); echtes iPhone/Android bleibt Handtest (README) | dieser Commit |
| KR-09 | bestätigt | Einrichtung im README auf Quelle „GitHub Actions“ korrigiert | a8fc1fe |
