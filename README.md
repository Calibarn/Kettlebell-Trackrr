# Kettlebell-Trackrr

Mein persönlicher Trainings-Begleiter als Web-App für iPhone und Android – Kraft mit Tracking, Laufen und Mobility als Anleitungen.

## Bereiche

- **Kraft** (mit Timer und Verlauf)
  - Ganzkörper (Zirkel), Tabata (komplett automatisch, mit Kettlebell, Band oder Körpergewicht), Läufer (Sätze mit Progression), Oberkörper (z. B. nach dem Longrun), Büro (Haltung & Rücken)
  - „Heute dabei“: Kettlebell und Bänder an- oder abwählen, die Übungen passen sich an; Körpergewicht geht immer. Die Auswahl wird gemerkt.
  - Gewicht je Übung (vorbelegt 12 kg) und Bandstärke unter „Übungen, Geräte & Gewichte“
  - Ton-Countdown, automatische Aufwärm-/Cooldown-Abläufe, Zeitübungen, Swing-EMOM
  - Bestwerte vergleichen nur Einheiten mit gleichem Aufbau
- **Laufen** (nur Anleitungen)
  - Warm-up und Cooldown für 5 km, 10 km, Halbmarathon, Marathon
  - Warm-up und Cooldown für Intervall, Speed und Longrun
  - Lauf-ABC
- **Mobility** (nur Anleitungen): Kurzprogramme sowie Übungen für Hüfte, Rücken, Schultern & Nacken, Beine & Füße
- **Mehr**: Bauchumfang, Datensicherung, Ton, Hinweise

Jede Übung hat eine Anleitung mit Skizze (Start → Bewegung).

## Design

Orientiert sich an Apples Gestaltungsrichtlinien: große Titel, gruppierte Listen, Tab-Leiste, Fortschrittsring. Hell- und Dunkelmodus folgen automatisch der Systemeinstellung. Auf Android werden Navigationsleiste, Schalter und Bedienelemente an das Material-Erscheinungsbild angepasst (`platform.js`).

## Datenschutz: alles bleibt lokal

- Trainings, Messungen und Einstellungen liegen ausschließlich im Speicher des Geräts (`localStorage`).
- Eine **Content-Security-Policy** verbietet der App jede Verbindung zu anderen Servern (`connect-src 'self'`) und lädt nur eigene Dateien. Es gibt keine Analyse, keine externen Schriften oder Skripte.
- Daten verlassen das Gerät nur, wenn du selbst **„In Datei sichern“** wählst: auf dem iPhone über „Teilen → In Dateien sichern“, auf anderen Geräten über einen Dateidialog oder als Download.
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

Bei Änderungen an Dateien in `sw.js` die Konstante `VERSION` erhöhen (z. B. `kbt-v7`). Online lädt die App immer die neueste Version, offline den Cache.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenstruktur, Content-Security-Policy |
| `platform.js` | Erkennt iOS/Android für die passende Darstellung |
| `styles.css` | Gestaltung (hell/dunkel, iOS/Android) |
| `data.js` | Pläne, Übungsvarianten, Lauf- und Mobility-Inhalte, Anleitungstexte |
| `figures.js` | Bewegungsskizzen |
| `app.js` | Timer, Erfassung, Verlauf, Datensicherung, Navigation |
| `sw.js`, `manifest.webmanifest`, Icons | Offline-Betrieb und Installation |
