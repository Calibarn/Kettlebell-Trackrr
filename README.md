# Kettlebell-Trackrr

Mein persönlicher Trainingstracker für Kettlebell, Widerstandsbänder und Körpergewicht – als Web-App für das iPhone.

- **Drei Pläne:** Ganzkörper (Zirkel), Lauftraining (Sätze mit Progression), Oberkörper (z. B. nach dem Longrun)
- **„Heute dabei“:** Kettlebell und Bänder an- oder abwählen, die Übungen passen sich an (Körpergewicht geht immer). Die Auswahl wird gemerkt.
- **Gewicht je Übung:** vorbelegt mit 12 kg, unter „Übungen, Geräte & Gewichte“ änderbar
- **Timer mit Ton**, automatische Aufwärm- und Cooldown-Abläufe, Zeitübungen, Swing-EMOM
- **Anleitungen** mit Skizze (Start → Bewegung) für jede Übung und Variante
- **Verlauf und Bestwerte** – nur Einheiten mit gleichem Aufbau werden verglichen
- **Bauchumfang** mit Verlauf, CSV und Kalender-Erinnerung
- **Offline-fähig** und wiederaufnehmbar: Wird die App mitten im Training geschlossen, geht es beim nächsten Öffnen weiter

## Datenschutz

Alle Trainings, Messungen und Einstellungen liegen ausschließlich im lokalen Speicher des Geräts (`localStorage`). Es gibt keinen Server, keine Analyse, keine externen Skripte. Die Daten verlassen das Gerät nur über „Backup exportieren“.

Hinweis: Alle GitHub-Pages-Projekte unter `calibarn.github.io` teilen sich denselben Speicherbereich im Browser. Andere eigene Pages-Projekte könnten die Daten also technisch lesen.

## Einrichtung

1. Im Repository unter **Settings → Pages** bei „Build and deployment“ die Quelle **Deploy from a branch**, Branch **main**, Ordner **/ (root)** wählen und speichern.
2. Nach ein bis zwei Minuten ist die App unter `https://calibarn.github.io/Kettlebell-Trackrr/` erreichbar.
3. Auf dem iPhone die Adresse in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**.
4. Ab jetzt **nur noch über das Symbol** öffnen. Safari und die Home-Bildschirm-App haben getrennte Speicher; nur die Home-Bildschirm-App ist vor dem automatischen Löschen nach Nichtnutzung geschützt.

### Daten aus der alten Version übernehmen

- Alte HTML-Datei öffnen → „Backup exportieren“ (JSON).
- In der neuen App unter „Daten, Backup & Ton“ → „Backup importieren“.
- Doppelte Einträge werden erkannt und übersprungen. Ganzkörper-Einheiten mit 12 Übungen und Standard-Geräten bleiben mit neuen Einheiten vergleichbar.

## Aktualisieren

Bei Änderungen an den Dateien in `sw.js` die Konstante `VERSION` erhöhen (z. B. `kbt-v2`). Die App lädt online immer die neueste Version und nutzt den Cache nur offline.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenstruktur |
| `styles.css` | Gestaltung |
| `data.js` | Pläne, Übungen mit Geräte-Varianten, Anleitungstexte |
| `figures.js` | Bewegungsskizzen |
| `app.js` | Timer, Erfassung, Verlauf, Backup |
| `sw.js`, `manifest.webmanifest`, Icons | Offline-Betrieb und Home-Bildschirm |
