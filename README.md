# Kettlebell-Trackrr

Mein persönlicher Trainings-Begleiter als Web-App für iPhone und Android – Kraft mit Tracking, Laufen und Mobility als Anleitungen.

## Bereiche

- **Kraft** (mit Timer und Verlauf)
  - Ganzkörper (Zirkel), Tabata (komplett automatisch, mit Kettlebell, Band oder Körpergewicht), Läufer (Sätze mit Progression), Oberkörper (z. B. nach dem Longrun), Core (EMOM im Knien, fest mit Kettlebell), Büro (Haltung & Rücken)
  - „Heute dabei“: Kettlebell, Bänder und Körpergewicht wählen – je Übung wird automatisch die wirksamste Variante aus der Auswahl genommen (Rangfolge mit Begründung in `data.js`, `BEST`). Ohne Auswahl gilt Körpergewicht. Die Auswahl wird gemerkt.
  - Gewicht je Übung (vorbelegt 12 kg) und Bandstärke unter „Übungen, Geräte & Gewichte“
  - Ton-Countdown und Sprachansagen (nächste Übung, Seitenwechsel, Rundenende), automatische Aufwärm-/Cooldown-Abläufe, Zeitübungen, Swing-EMOM
  - Bestwerte vergleichen nur Einheiten mit gleichem Aufbau; nach dem Speichern Zusammenfassung mit neuem Bestwert
  - Progressionshinweise: Läufer-Plan bei allen Sätzen an der Obergrenze (nächste Stufe, Gewicht, Band), Tabata nach drei kompletten Einheiten (8 Runden, dann 60 Sek. Pause), Core nach drei kompletten Einheiten eine Runde mehr
  - Gefühlte Anstrengung (1–10) und Notiz je Einheit, nachträglich im Verlauf änderbar
- **Laufen** (Anleitungen, Saisonplan und Umfang)
  - Bestzeiten: Ergebnisse je Distanz (auch eigene km, aus Rennen übernehmbar), neue Bestzeiten automatisch erkannt, Verlauf als Grafik, Prognose für andere Distanzen (Riegel)
  - Plan: A- und B-Rennen mit Datum, Distanz (5 km bis Marathon) und optional Zielzeit. Die A-Rennen werden nach Datum abgearbeitet: je ein Block aus Grundlage, Aufbau, spezifischer Phase und Tapering, danach Erholung und Basis bis zum nächsten Block. B-Rennen laufen ohne eigenen Block mit. Longrun und Wochen-km kommen aus dem Umfang (höchstens +10 % pro Woche, nach drei Aufbauwochen Entlastung); Warnung, wenn A-Rennen zu dicht liegen oder das Longrun-Ziel nicht erreichbar ist. Dazu Renntempo-Rechner, Pacing, Tapering, Verpflegung und Checkliste für die Rennwoche
  - Warm-up und Cooldown für 5 km, 10 km, Halbmarathon, Marathon
  - Warm-up und Cooldown für Intervall, Speed und Longrun
  - Lauf-ABC
  - Umfang: Läufe mit Datum (einzeln oder per CSV-Import mit Vorlage) oder Wochensummen; nächster langer Lauf höchstens 10 % über dem längsten der letzten 30 Tage (Sprünge werden markiert), Zielbereich für die laufende Woche (Erhalt 0,8–1,0 × Schnitt der letzten 4 Wochen, Aufbau bis 1,3 ×), Verlauf über 8 Wochen
  - „Geführt“: Ablauf Schritt für Schritt mit Countdown und Ansage; Strecken und Wiederholungen werden abgehakt
- **Profil**
  - Trainingswoche: Tage für Qualität, Longrun, Laufgruppe, Kraft und eine weitere Einheit – Plan und Kalender-Export nutzen sie, Hinweis bei harten Tagen hintereinander
  - Herzfrequenz-Zonen: nach Karvonen aus maximaler und Ruhe-HF oder direkt von der Uhr; der Plan zeigt die bpm
  - Geräte & Gewichte: eigene Kettlebells und Bänder, Standardgewicht; der Kraft-Bereich wählt nur daraus
  - Körpergewicht (Verlauf, Ø pro Woche über 4 Wochen) und Bauchumfang
  - Ton & Ansagen
- **Mobility** (ohne Tracking), in Reitern wie Laufen
  - Läufer: Nach dem Lauf, Hüfte, Sprunggelenk
  - Alltag: Morgens, Nach dem Sitzen
  - Übungen nach Körperbereich: Hüfte, Rücken, Schultern, Beine & Fuß
  - Kurzprogramme mit geführtem Timer inkl. Seitenwechsel und Ansage
- **Mehr**: Wochenübersicht, Anleitung, Geräte-Sync, Datensicherung, Hinweise

## Zurücksetzen

Unter **Mehr → Daten & Datenschutz**:
- **Einstellungen zurücksetzen**: Profil, Übungs-Varianten und Gewichte, Stufen, „Entfällt“, Ton und Ansichten auf Ausgangszustand; alle Daten bleiben.
- **Werkseinstellung**: löscht alle Daten auf diesem Gerät (Backup-Angebot, Bestätigung mit „LÖSCHEN“). Auch der Sync-Stand des Geräts wird zurückgesetzt, damit keine Löschung auf andere Geräte übertragen wird; die Sync-Datei in der Cloud bleibt unberührt.

## Mehrere Geräte (Sync-Datei)

Unter **Mehr → Geräte-Sync** schreibt **Sync speichern** den kompletten Stand in `kb-tracker-sync.json`, **Sync laden** gleicht ihn ab. Die Datei liegt in einem Cloud-Ordner, den alle Geräte sehen (iCloud Drive, Google Drive, OneDrive, Dropbox) – die App selbst verbindet sich mit keinem Server.

- Abgleich je Eintrag mit Änderungszeitpunkt und Löschmarken: neu, geändert und gelöscht kommen an, der neuere Stand gewinnt. Vorhandene Daten zählen beim ersten Sync als „alt“ (Zeitstempel 0), damit sie fremde Änderungen nicht überstimmen.
- Abgeglichen: Trainings, Läufe, Wochensummen, Rennen, Gewicht, Bauchumfang, Übungs-Einstellungen, Stufen, Profil, „Entfällt“. Je Gerät bleiben Ton, Stimme und „Heute dabei“.
- Chrome/Edge am Mac/PC: **Sync-Datei festlegen** merkt sich die Datei (File System Access API, Handle in IndexedDB); Speichern gleicht vorher mit der Datei ab.
- iPhone/iPad: Speichern über „Teilen“ → In Dateien sichern → Ersetzen, Laden über die Dateiauswahl. Web-Apps können dort keinen Pfad selbst öffnen; der Speicherort lässt sich als Erinnerung je Gerät eintragen.


Jede Übung hat eine Anleitung mit Skizze (Start → Bewegung).

## Design

Orientiert sich an Apples Gestaltungsrichtlinien: große Titel, gruppierte Listen, Tab-Leiste, Fortschrittsring. Hell- und Dunkelmodus folgen automatisch der Systemeinstellung. Auf Android werden Navigationsleiste, Schalter und Bedienelemente an das Material-Erscheinungsbild angepasst (`platform.js`).

## Datenschutz: alles bleibt lokal

- Trainings, Messungen und Einstellungen liegen ausschließlich im Speicher des Geräts (`localStorage`).
- Eine **Content-Security-Policy** verbietet der App jede Verbindung zu anderen Servern (`connect-src 'self'`) und lädt nur eigene Dateien. Es gibt keine Analyse, keine externen Schriften oder Skripte.
- Daten verlassen das Gerät nur, wenn du selbst **„In Datei sichern“** wählst: auf dem iPhone über „Teilen → In Dateien sichern“, auf anderen Geräten über einen Dateidialog oder als Download.
- Sprachansagen nutzen nur Stimmen, die auf dem Gerät laufen (`localService`). Online-Stimmen, z. B. in Chrome am Desktop, werden bewusst nicht verwendet, weil sie den Text an fremde Server schicken würden. Ohne deutsche Gerätestimme gibt es nur Tonsignale.
- Hinweis: Alle GitHub-Pages-Projekte unter `calibarn.github.io` teilen sich denselben Browser-Speicherbereich.

## Einrichtung

1. Repository → **Settings → Pages** → „Deploy from a branch“, Branch **main**, Ordner **/ (root)**.
2. Nach ein bis zwei Minuten `https://calibarn.github.io/Kettlebell-Trackrr/` öffnen.
3. **iPhone:** in Safari „Teilen“ → „Zum Home-Bildschirm“. **Android:** in Chrome Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
4. Danach nur noch über das App-Symbol öffnen. Browser und installierte App haben getrennte Speicher; die installierte App ist zuverlässiger vor dem automatischen Löschen geschützt.

### Daten aus einer alten Version übernehmen

Alte Version öffnen → „Backup exportieren“, in der neuen App unter **Mehr → Aus Datei wiederherstellen** einlesen. Doppelte Einträge werden übersprungen. Auf derselben Adresse übernimmt die neue Version vorhandene Daten automatisch.

## Updates und deine Daten

Updates ersetzen nur die App-Dateien (HTML, CSS, JavaScript). Die Daten liegen getrennt im Speicher des Geräts und bleiben erhalten. Zusätzlich gilt:

- Einträge, die eine App-Version nicht kennt (z. B. aus einer neueren Version), werden nie verworfen, sondern unverändert mitgespeichert.
- Unlesbare Daten werden vor dem Überschreiben unter einem eigenen Schlüssel aufbewahrt, die App weist darauf hin.
- Bei einer Änderung des Datenformats (`SCHEMA` in `app.js`) legt die App vorher automatisch eine Sicherung an; sie ist unter **Mehr → Sicherung vor dem letzten Update** als Datei abrufbar.

Daten gehen nur verloren, wenn die Adresse (Domain) wechselt, das App-Symbol vom Home-Bildschirm gelöscht wird oder die Website-Daten im Browser gelöscht werden. Dagegen hilft nur eine Sicherung in eine Datei.

## Aktualisieren

Bei Änderungen an Dateien in `sw.js` die Konstante `VERSION` erhöhen (z. B. `kbt-v21`). Online lädt die App immer die neueste Version, offline den Cache.

## Ton auf dem iPhone

Safari spielt Web-Töne normalerweise nicht, wenn der Stummschalter an ist. Unter **Profil → Ton trotz Stummschalter** stellt die App die Audio-Sitzung auf „playback“ (Audio Session API; die Option erscheint nur, wenn das iPhone sie unterstützt). Nachteil: Laufende Musik kann dabei pausieren. Bei gesperrtem Bildschirm pausiert iOS Web-Apps grundsätzlich; die App hält den Bildschirm deshalb während des Trainings an.

## Tests

Automatische Tests mit Playwright (Chromium) prüfen Zirkel, Tabata, Core-EMOM, Sätze, Geräte-Auswahl, Ansagen, geführte Routinen, Import/Export, Update-Sicherheit, Saisonplan und Rennen, Profil, Content-Security-Policy und dass jede Übung Anleitung und Skizze hat. Sie laufen bei jedem Push über GitHub Actions (`.github/workflows/test.yml`).

Lokal (Node 22 und Python 3 nötig):

```
npm ci
npx playwright install chromium
npm test
```

Die App selbst braucht kein Node – `package.json` dient nur den Tests.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenstruktur, Content-Security-Policy |
| `platform.js` | Erkennt iOS/Android für die passende Darstellung |
| `styles.css` | Gestaltung (hell/dunkel, iOS/Android) |
| `data.js` | Pläne, Übungsvarianten, Lauf-, Saisonplan- und Mobility-Inhalte, Anleitungstexte |
| `figures.js` | Bewegungsskizzen |
| `app.js` | Timer, Ansagen, Erfassung, Verlauf, Fortschritt, Wochenübersicht, Saisonplan, geführte Routinen, Datensicherung, Navigation |
| `sw.js`, `manifest.webmanifest`, Icons | Offline-Betrieb und Installation |
| `tests/`, `playwright.config.js`, `package.json` | Automatische Tests (nicht Teil der App) |
