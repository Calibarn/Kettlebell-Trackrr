# Tagwerk

Mein persönlicher Trainings-Begleiter als Web-App für iPhone und Android – Kraft mit Tracking, Laufen und Mobility, jeden Tag das, was dran ist. Bis Version 1.0 hieß die App „KB Tracker“; Repo, Adresse, Speicherschlüssel und der Name der Sync-Datei (`kb-tracker-sync.json`) bleiben bewusst gleich, damit installierte Apps, Daten und Sync weiterlaufen.

## Bereiche

- **Kraft** (mit Timer und Verlauf)
  - Ganzkörper (Zirkel), Tabata (komplett automatisch, mit Kettlebell, Band oder Körpergewicht), Läufer (Sätze mit Progression), Oberkörper (z. B. nach dem Longrun), Core (EMOM im Knien, fest mit Kettlebell), Büro (Haltung & Rücken)
  - Geräte je Plan (z. B. Ganzkörper: Kettlebell + Körpergewicht, Tabata: Kettlebell, Läufer: Band), darunter „Du brauchst“ (Gewichte, Bänder, Matte …); Urlaub von–bis im Profil: nur Körpergewicht. Kettlebell, Bänder und Körpergewicht wählen – je Übung wird automatisch die wirksamste Variante aus der Auswahl genommen (Rangfolge mit Begründung in `data.js`, `BEST`). Ohne Auswahl gilt Körpergewicht. Die Auswahl wird gemerkt.
  - Gewicht je Übung (vorbelegt 12 kg) und Bandstärke unter „Übungen, Geräte & Gewichte“
  - Ton-Countdown und Sprachansagen (nächste Übung, Seitenwechsel, Rundenende), automatische Aufwärm-/Cooldown-Abläufe, Zeitübungen, Swing-EMOM
  - Bestwerte vergleichen nur Einheiten mit gleichem Aufbau; nach dem Speichern Zusammenfassung mit neuem Bestwert
  - Progressionshinweise: Läufer-Plan bei allen Sätzen an der Obergrenze (nächste Stufe, Gewicht, Band), Tabata nach drei kompletten Einheiten (8 Runden, dann 60 Sek. Pause), Core nach drei kompletten Einheiten eine Runde mehr
  - Gefühlte Anstrengung (1–10) und Notiz je Einheit, nachträglich im Verlauf änderbar
- **Start („Heute“)**: erscheint bei jedem Öffnen (außer ein Training läuft), ohne untere Leiste: was heute dran ist (Kraft mit Start, Läufe aus dem Plan, Lauf-Einstieg), die Woche (Kraft gegen Krafttage, km gegen Plan, geführte Mobility-Routinen) und je Bereich eine Kachel mit Stand; in den Bereichen hat die Leiste „Start“ statt „Mehr“
- **Laufen** (Anleitungen, Saisonplan und Umfang)
  - Bestzeiten: Ergebnisse je Distanz (auch eigene km, aus Rennen übernehmbar; ab dem Tag nach einem Rennen fragt die Startseite nach der Zeit), neue Bestzeiten automatisch erkannt, Verlauf als Grafik, Prognose für andere Distanzen (Riegel)
  - Plan: A- und B-Rennen mit Datum, Distanz (5 km bis Marathon, eigene km) und optional Zielzeit – oder als Wings for Life World Run mit Ziel in km (Zielzeit und Mindest-Pace aus dem Tempo des Catcher Cars, dazu wie weit die Form reicht) bzw. Pace Race mit Ziel-Level (Zeitlimit der Zielrunde, 1-km-Wiederholungen mit 60 Sek. Pause im Plan). Die A-Rennen werden nach Datum abgearbeitet: je ein Block aus Grundlage, Aufbau, spezifischer Phase und Tapering, danach Erholung und Basis bis zum nächsten Block. B-Rennen laufen ohne eigenen Block mit. Longrun und Wochen-km kommen aus dem Umfang (höchstens +10 % pro Woche, nach drei Aufbauwochen Entlastung); Warnung, wenn A-Rennen zu dicht liegen oder das Longrun-Ziel nicht erreichbar ist. Dazu Renntempo-Rechner, Pacing, Tapering, Verpflegung und Checkliste für die Rennwoche
  - Lauf-Einstieg für Laufanfänger (Profil → Trainingswoche → Laufniveau „Einsteiger“, oder die Frage in Plan → Übersicht): 9 Wochen mit je 3 Einheiten aus Laufen und Gehen bis 30 Minuten am Stück, geführt mit Ansagen (Bildschirm bleibt an), nach 3 Einheiten weiter oder Woche wiederholen; kein Testlauf, keine Tempos. Ist ein A-Rennen geplant, zeigt die App, ob nach dem Einstieg genug Zeit für den Rennblock bleibt. Danach geht es als Läufer mit dem Saisonplan weiter
  - Testläufe (5 km alle 8 Wochen ohne Ergebnis) nur, wenn 5 km machbar sind: längster Lauf der letzten 30 Tage bzw. geplanter Longrun mindestens 5 km
  - Warm-up: Warm-up und Cooldown für den Renntag (5 km bis Marathon) und fürs Training (Intervall, Speed, Longrun)
  - Lauf-ABC
  - Umfang: Läufe mit Datum (einzeln oder per CSV-Import mit Vorlage) oder Wochensummen; nächster langer Lauf höchstens 10 % über dem längsten der letzten 30 Tage (Sprünge werden markiert), Zielbereich für die laufende Woche (Erhalt 0,8–1,0 × Schnitt der letzten 4 Wochen, Aufbau bis 1,3 ×), Verlauf über 8 Wochen
  - „Geführt“: Ablauf Schritt für Schritt mit Countdown und Ansage; Strecken und Wiederholungen werden abgehakt
- **Profil**
  - Trainingswoche: Tage für Qualität, Longrun, Laufgruppe, Kraft und bis zu vier weitere Einheiten (lockerer Lauf, zweite Qualität, Anderes) – Plan und Kalender-Export nutzen sie, Hinweis bei harten Tagen hintereinander; je Krafttag optional ein fester Kraft-Plan (sonst der zuletzt genutzte); Kraft und Lauf dürfen am selben Tag liegen (Hinweis „danach“), feste Krafttage bekommen beim Nachholen keinen Lauf dazu
  - Herzfrequenz-Zonen: nach Karvonen aus maximaler und Ruhe-HF oder direkt von der Uhr; der Plan zeigt die bpm
  - Geräte & Gewichte: eigene Kettlebells und Bänder, Standardgewicht; der Kraft-Bereich wählt nur daraus
  - Körpermaße: Gewicht und Bauchumfang in einem Formular und Protokoll, Diagramm umschaltbar, Ø pro Woche (Gewicht, 4 Wochen), Erinnerung, CSV
  - Ton & Ansagen
- **Mobility** (ohne Tracking), in Reitern wie Laufen
  - Läufer: Nach dem Lauf, Hüfte, Sprunggelenk
  - Alltag: Morgens, Nach dem Sitzen
  - Übungen nach Körperbereich: Hüfte, Rücken, Schultern, Beine & Fuß
  - Kurzprogramme mit geführtem Timer inkl. Seitenwechsel und Ansage
- **Mehr** (Kachel auf der Startseite): Neuigkeiten, Anleitung (inkl. Hinweise), Geräte-Sync, Datensicherung, Zurücksetzen
- **Im Handy-Browser** (iPhone/Android, nicht als App geöffnet) steht in jedem Bereich ganz oben der Hinweis „Als App installieren“ mit Link zur Anleitung – nicht wegklickbar, während eines Trainings ausgeblendet

## Neuigkeiten (Patch Notes)

`CHANGELOG` in `data.js`, neueste zuerst. Jeder Punkt ist `[Thema, Text, Art]` mit Art `'neu'` (Standard), `'ux'` (Usability) oder `'bug'`; das Fenster gruppiert danach unter „Neu“, „Usability“ und „Bugs“. Als Thema den betroffenen Bereich nehmen, nicht „Übersichtlicher“ oder „Behoben“; der älteste (letzte) Eintrag ist der Grundstand mit allen Funktionen. Neulinge sehen beim ersten Start die 3 neuesten Updates plus den Grundstand. Ein neuer Eintrag mit neuer `id` erscheint beim nächsten Start einmal als Fenster (abschaltbar unter **Mehr → Nach Updates anzeigen**) und steht danach unter **Mehr → Was ist neu?**. Bei jedem Update mit sichtbaren Änderungen: Eintrag oben ergänzen und in `sw.js` `VERSION` erhöhen.

## Versionsnummer

`APP_VERSION` in `data.js`, angezeigt unten unter **Mehr** (in der Testversion mit „Testversion“) und beim zugehörigen Neuigkeiten-Eintrag (`version`). Jede Veröffentlichung ist eine neue Nebenversion: 1.0, 1.1, 1.2 … Erhöht wird mit der ersten Änderung nach einer Veröffentlichung auf `dev`, damit die Testversion schon die kommende Nummer zeigt. Größere Umbauten (z. B. ein neues Datenformat) bekommen eine neue Hauptversion (2.0). Unabhängig davon steht in `sw.js` die Cache-Version, die bei jeder Änderung an den Dateien steigt.

## Testversion und Veröffentlichung

- **Branch `dev`**: Hier landet jede Änderung. Nach grünen Tests stößt `.github/workflows/test.yml` den Pages-Workflow an, die Testversion liegt dann unter **…/Kettlebell-Trackrr/dev/** (Titel mit „Test“-Markierung).
- **Branch `main`**: die echte App. Eine geplante Aufgabe übernimmt den Stand von `dev` einmal pro Woche, **mittwochs um 00:00** (nur bei grünen Tests, nur als Fast-Forward). `.github/workflows/deploy.yml` veröffentlicht bei jedem Push auf `main`.
- **Branch `hotfix`**: Fehlerbehebungen für die laufende Version (1.0.1, 1.0.2 …), ohne auf den Mittwoch zu warten. Arbeitsweise: `hotfix` zuerst auf `origin/main` vorziehen (Fast-Forward), Fehler beheben, Tests grün, pushen – und **sofort auch in `dev` mergen**, damit der Wochen-Release die Behebung enthält und `main` ein Vorfahre von `dev` bleibt. Eine geplante Aufgabe veröffentlicht täglich um 00:05 (außer mittwochs, da läuft der Wochen-Release), wenn `hotfix` Neues hat: nur bei grünen Tests, nur als Fast-Forward. Nach dem Wochen-Release wird `hotfix` auf den neuen Stand von `main` vorgezogen. Versionsnummer: Fehlerbehebungen erhöhen die dritte Stelle (1.0.1); beim Mergen in `dev` behält `dev` seine kommende Nummer (z. B. 1.1).
- **Getrennte Daten**: Beide Versionen liegen unter derselben Adresse. Die Testversion nutzt deshalb eigene Speicherschlüssel (`dev:` vorn, `KEY_NS` in `platform.js`), einen eigenen Cache (`dev-kbt-…` in `sw.js`), eine eigene Sync-Datei (`kb-tracker-test-sync.json`) und ein eigenes Manifest (`manifest-test.webmanifest`). Sie kann die Daten der echten App nicht verändern.
- GitHub → Settings → Pages: Quelle „GitHub Actions“.

## Sprache (Deutsch / Englisch)

Automatisch nach Gerätesprache: Deutsch bei deutscher Gerätesprache (`de`, `de-AT`, `de-CH` …), sonst Englisch. Unter **Mehr → Sprache** lässt sich Deutsch oder Englisch fest einstellen (je Gerät, wird nicht synchronisiert; „Einstellungen zurücksetzen“ stellt wieder auf Automatisch).

So ist es gebaut (`i18n.js`):

- Die Daten bleiben intern deutsch. Übungsnamen sind Schlüssel (Anleitungen, Skizzen, gespeicherte Einträge), Angaben wie „45 Sek. je Seite“ werden für Timer und Seitenwechsel ausgewertet. Übersetzt wird nur, was angezeigt oder angesagt wird.
- `T('deutsch', 'english')` für Texte im Code, `tr(text)` für Inhalte aus `data.js` (Wörterbuch `EN_TEXT` in `lang-en.js`), Kurzangaben wie „10 je Seite“ regelbasiert.
- `localizeContent()` übersetzt reine Anzeige-Texte in `data.js` beim Start, `localizeHtml()` die festen Texte in `index.html` (Wörterbuch `EN_HTML`).
- Pflege: Neue oder geänderte deutsche Texte brauchen einen Eintrag in `lang-en.js` (Schlüssel = deutscher Text, exakt). Fehlt einer, bleibt der Text deutsch und landet in `i18nMissing`; der Test `tests/englisch.spec.js` schlägt dann fehl.

## Zurücksetzen

Unter **Mehr → Daten & Datenschutz**:
- **Einstellungen zurücksetzen**: Profil, Übungs-Varianten und Gewichte, Stufen, „Entfällt“, Ton und Ansichten auf Ausgangszustand; alle Daten bleiben.
- **Werkseinstellung**: löscht alle Daten auf diesem Gerät (Backup-Angebot, Bestätigung mit „LÖSCHEN“). Auch der Sync-Stand des Geräts wird zurückgesetzt, damit keine Löschung auf andere Geräte übertragen wird; die Sync-Datei in der Cloud bleibt unberührt.

## Mehrere Geräte (Sync-Datei)

Unter **Mehr → Geräte-Sync** schreibt **Sync speichern** den kompletten Stand in `kb-tracker-sync.json`, **Sync laden** gleicht ihn ab. Die Datei liegt in einem Cloud-Ordner, den alle Geräte sehen (iCloud Drive, Google Drive, OneDrive, Dropbox) – die App selbst verbindet sich mit keinem Server.

- Abgleich je Eintrag mit Änderungszeitpunkt und Löschmarken: neu, geändert und gelöscht kommen an, der neuere Stand gewinnt. Vorhandene Daten zählen beim ersten Sync als „alt“ (Zeitstempel 0), damit sie fremde Änderungen nicht überstimmen.
- Abgeglichen: Trainings, Läufe, Wochensummen, Rennen, Gewicht, Bauchumfang, Übungs-Einstellungen, Stufen, Profil, „Entfällt“. Die Geräte je Plan gehören zu den Übungs-Einstellungen; je Gerät bleiben Ton und Stimme.
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

**Datenprüfung vor dem Release:** `node tools/upgrade-check.js [--base origin/main] [--head origin/dev] [--report bericht.md]` legt mit der Live-Version echte Daten an und prüft vier Wege: Update an Ort und Stelle (neue Version liest den Speicher der alten), Sicherung Live → Testversion, Sicherung Testversion → Testversion und Sync-Datei Live → Testversion. Exit-Code 0 = nichts verloren oder verändert.

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
| `i18n.js`, `lang-en.js` | Sprache: Auswahl, Übersetzungshelfer, englisches Wörterbuch |
| `styles.css` | Gestaltung (hell/dunkel, iOS/Android) |
| `data.js` | Pläne, Übungsvarianten, Lauf-, Saisonplan- und Mobility-Inhalte, Anleitungstexte |
| `figures.js` | Bewegungsskizzen |
| `app.js` | Timer, Ansagen, Erfassung, Verlauf, Fortschritt, Wochenübersicht, Saisonplan, geführte Routinen, Datensicherung, Navigation |
| `sw.js`, `manifest.webmanifest`, Icons | Offline-Betrieb und Installation |
| `tests/`, `playwright.config.js`, `package.json` | Automatische Tests (nicht Teil der App) |
