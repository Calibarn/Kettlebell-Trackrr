'use strict';
/* Trainingsdaten: Pläne, Übungsplätze mit Geräte-Varianten, Anleitungen.
   Gerät: kb = Kettlebell, db = Kurzhanteln (siehe DB_VARIANTS), band = Widerstandsband, bw = eigenes Körpergewicht.
   Jeder Übungsplatz hat eine bw-Variante, damit der Plan auch ganz ohne Geräte funktioniert. */

const GEAR_LABEL = { kb: 'Kettlebell', db: 'Kurzhanteln', band: 'Band', bw: 'Körpergewicht' };
const BANDS = ['10', '20', '30', '10+20', '10+30', '20+30'];
const bandLabel = b => 'Band ' + String(b).replace('+', ' + ') + ' kg';
const KB_DEFAULT = 12, DB_DEFAULT = 8;

// Variante: [Name, Ziel, Hinweis]
const PLANS = {
  wed: {
    tab: 'Ganzkörper', label: 'Ganzkörper · Zirkel', short: 'Ganzkörper', mode: 'circuit', durations: [4, 21, 5],
    intro: 'Feste Wiederholungen, feste Zeit, mehr Runden = Fortschritt. Saubere Technik geht vor Tempo.',
    slots: [
      { id: 'swing', v: { kb: ['Kettlebell-Swing', '10', 'Hüfte nach hinten, kraftvoll strecken, nur bis Brusthöhe'], band: ['Hüftheben mit Band', '15', 'Band über der Hüfte, Enden am Boden festhalten'], bw: ['Hüftheben', '15', 'Rückenlage, oben kurz halten'] } },
      { id: 'hips', v: { kb: ['Holzhacker mit Kettlebell', '8 je Seite', 'Kugel an den Hörnern, diagonal nach oben'], band: ['Holzhacker mit Band', '10 je Seite', 'Band unter dem Fuß, diagonal nach oben'], bw: ['Holzhacker', '10 je Seite', 'Diagonal von unten nach oben'] } },
      { id: 'halo', v: { kb: ['Halo um den Kopf', '10 je Richtung', 'Kopf ruhig, Rippen unten'], bw: ['Armkreisen mit Spannung', '10 je Richtung', 'Arme seitlich gestreckt, Fäuste fest'] } },
      { id: 'squat', v: { kb: ['Kniebeugen (Goblet)', '10', 'Kugel vor der Brust'], band: ['Kniebeugen mit Band', '10', 'Band unter den Füßen, Enden an den Schultern'], bw: ['Kniebeugen', '15', 'Arme nach vorne'] } },
      { id: 'lunge', v: { kb: ['Ausfallschritte', '10 je Seite', 'Rückwärts, Kugel vor der Brust'], bw: ['Ausfallschritte', '10 je Seite', 'Rückwärts, Hände an der Hüfte'] } },
      { id: 'march', v: { kb: ['Suitcase March', '20 Sek. je Seite', 'Kugel einseitig, aufrecht marschieren'], bw: ['Seitstütz', '20 Sek. je Seite', 'Auf Unterarm, Knie dürfen am Boden bleiben'] } },
      { id: 'row', band: '20', v: { kb: ['Einarmiges Rudern', '10 je Seite', 'Freie Hand abstützen'], band: ['Rudern mit Band', '10 je Seite', 'Band unter dem vorderen Fuß'], bw: ['Y-T-W in Bauchlage', '6 je Position', 'Arme anheben, Blick zum Boden'] } },
      { id: 'press', order: ['band', 'kb', 'bw'], band: '20', v: { band: ['Brustdrücken mit Band', '10–12', 'Band hinter dem oberen Rücken'], kb: ['Floor Press', '10 je Seite', 'Rückenlage, einarmig'], bw: ['Liegestütze erhöht', '8–12', 'Hände auf Tisch oder Sofalehne'] } },
      { id: 'tri', band: '10', v: { kb: ['Trizeps über Kopf', '10', 'Beide Hände am Griff'], band: ['Trizeps mit Band', '10 je Seite', 'Unteres Ende hinter dem Rücken halten'], bw: ['Enge Liegestütze erhöht', '8–10', 'Ellenbogen nah am Körper'] } },
      { id: 'curl', band: '10', v: { kb: ['Bizepscurls', '10', 'Ellenbogen am Körper'], band: ['Bizepscurls mit Band', '10–12', 'Beide Füße auf der Bandmitte'], bw: ['Handtuch-Curl (halten)', '20 Sek. je Seite', 'Gegen das Handtuch unter dem Fuß ziehen'] } },
      { id: 'balance', order: ['bw', 'kb'], v: { bw: ['Standwaage', '6–10 je Seite', 'Zunächst ohne Gewicht'], kb: ['Einbeiniges Kreuzheben', '6–10 je Seite', 'Kugel in der Hand gegenüber dem Standbein'] } },
      { id: 'crunch', v: { bw: ['Stehende Knie-Ellenbogen-Crunches', '10 je Seite', 'Ohne Gewicht'] } }
    ],
    warmup: [['0:45', 'Marschieren auf der Stelle'], ['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:45', 'Kniebeugen ohne Gewicht'], ['1:00', 'Ausfallschritt mit Rotation']],
    cooldown: [['0:45 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Vorderer Oberschenkel'], ['0:30 × 2', 'Figure-4 Gesäß'], ['0:30 × 2', 'Brustdehnung am Türrahmen'], ['0:30', 'Kindhaltung']]
  },
  run: {
    tab: 'Läufer', label: 'Kraft für Läufer', short: 'Lauftraining', mode: 'sets', durations: [4, 23, 3],
    intro: 'Wiederholungen je Satz eintragen. Erst Wiederholungen steigern (bis 15), dann Tempo 3-1-1, dann schwerere Stufe oder mehr Gewicht.',
    slots: [
      { id: 'split', sets: 3, block: 'Kraft · 3 Sätze', stages: ['Split Squat', 'Split Squat · Tempo 3-1-1', 'Bulgarian Split Squat', 'Bulgarian · Tempo 3-1-1'], v: { kb: ['Split Squat', '8–15 je Seite', 'Kugel vor der Brust'], bw: ['Split Squat', '8–15 je Seite', 'Hände an der Hüfte'] } },
      { id: 'row', sets: 3, block: 'Kraft · 3 Sätze', band: '20', stages: ['Normal', 'Tempo 3-1-1'], v: { kb: ['Einarmiges Rudern', '8–15 je Seite', 'Freie Hand abstützen'], band: ['Rudern mit Band', '8–15 je Seite', 'Band unter dem vorderen Fuß'], bw: ['Y-T-W in Bauchlage', '8–12 je Position', 'Arme anheben, Blick zum Boden'] } },
      { id: 'press', sets: 3, block: 'Kraft · 3 Sätze', order: ['band', 'kb', 'bw'], band: '20', stages: ['Normal', 'Tempo 3-1-1'], v: { band: ['Brustdrücken mit Band', '8–15', 'Band hinter dem oberen Rücken'], kb: ['Floor Press', '8–15 je Seite', 'Rückenlage, einarmig'], bw: ['Liegestütze erhöht', '8–15', 'Je niedriger die Erhöhung, desto schwerer'] } },
      { id: 'calf', sets: 2, block: 'Läufer-Block · 2 Runden', v: { kb: ['Einbeiniges Wadenheben', '8–15 je Seite', 'Bei Mittelfuß-Beschwerden erst ohne Gewicht'], bw: ['Einbeiniges Wadenheben', '8–15 je Seite', 'Langsam absenken'] } },
      { id: 'sldl', sets: 2, block: 'Läufer-Block · 2 Runden', v: { kb: ['Einbeiniges Kreuzheben', '6–10 je Seite', 'Erst ohne Gewicht testen'], bw: ['Standwaage', '6–10 je Seite', 'Becken gerade halten'] } },
      { id: 'march', sets: 2, block: 'Läufer-Block · 2 Runden', v: { kb: ['Suitcase March', '20–30 Sek. je Seite', 'Kugel einseitig'], bw: ['Seitstütz', '20–30 Sek. je Seite', 'Auf Unterarm, Knie dürfen am Boden bleiben'] } },
      { id: 'swing', sets: 3, block: 'Finisher · EMOM 3 Minuten', emom: true, setLabel: 'Min.', band: '20', v: { kb: ['Kettlebell-Swing', '10–15 pro Minute', 'Nur saubere Wiederholungen'], band: ['Hüftheben mit Band', '12–20 pro Minute', 'Oben kurz halten'], bw: ['Hüftheben', '12–20 pro Minute', 'Oben kurz halten'] } }
    ],
    warmup: [['0:30', 'Marschieren auf der Stelle'], ['0:30', 'Wadenpumpe'], ['0:30 × 2', 'Beinpendel vor/zurück'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:45', 'Ausfallschritt mit Rotation'], ['0:30', 'Schulter- und Armkreisen']],
    cooldown: [['0:30 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Wadendehnung'], ['0:30 × 2', 'Hintere Oberschenkel']]
  },
  sun: {
    tab: 'Oberkörper', label: 'Oberkörper · Schultern, Arme, Brust, Bauch', short: 'Oberkörper', mode: 'circuit', durations: [3, 16, 6],
    intro: 'Ruhiger Zirkel, z. B. nach dem Longrun. Die Beine haben Pause, der Cooldown lockert Hüfte und Brust.',
    slots: [
      { id: 'press', order: ['band', 'kb', 'bw'], band: '20', v: { band: ['Brustdrücken mit Band', '10–12', 'Band hinter dem oberen Rücken'], kb: ['Floor Press', '10 je Seite', 'Rückenlage, einarmig'], bw: ['Unterarmstütz', '20–40 Sek.', 'Körper in einer Linie, Knie dürfen am Boden bleiben'] } },
      { id: 'pushup', v: { bw: ['Liegestütze erhöht', '8–12', 'Hände auf Tisch oder Sofalehne'] } },
      { id: 'shoulder', band: '10', v: { kb: ['Schulterdrücken', '8–10 je Seite', 'Aus der Rack-Position'], band: ['Überkopfdrücken mit Band', '10–12', 'Band unter beiden Füßen'], bw: ['Pike-Liegestütze erhöht', '5–8', 'Hände auf stabilem Stuhl'] } },
      { id: 'lateral', order: ['band', 'bw'], band: '10', v: { band: ['Seitheben mit Band', '12–15', 'Nur bis Schulterhöhe'], bw: ['Wand-Seitheben (halten)', '20 Sek. je Seite', 'Handrücken gegen die Wand drücken'] } },
      { id: 'pull', order: ['band', 'kb', 'bw'], band: '10', v: { band: ['Band Pull-Apart', '15', 'Hintere Schulter'], kb: ['Einarmiges Rudern', '10 je Seite', 'Freie Hand abstützen'], bw: ['Y-T-W in Bauchlage', '6 je Position', 'Arme anheben, Blick zum Boden'] } },
      { id: 'pullover', band: '20', v: { kb: ['Kettlebell-Pullover', '10–12', 'Rückenlage, Rippen unten'], band: ['Rudern beidarmig mit Band', '12–15', 'Band unter beiden Füßen'], bw: ['Schwimmer in Bauchlage', '8–10', 'Arme im Bogen vom Kopf zur Hüfte'] } },
      { id: 'curl', band: '10', v: { kb: ['Bizepscurls', '10', 'Ellenbogen am Körper'], band: ['Bizepscurls mit Band', '10–12', 'Beide Füße auf der Bandmitte'], bw: ['Handtuch-Curl (halten)', '20 Sek. je Seite', 'Gegen das Handtuch unter dem Fuß ziehen'] } },
      { id: 'tri', band: '10', v: { kb: ['Trizeps über Kopf', '10', 'Beide Hände am Griff'], band: ['Trizeps mit Band', '10 je Seite', 'Unteres Ende hinter dem Rücken halten'], bw: ['Enge Liegestütze erhöht', '8–10', 'Ellenbogen nah am Körper'] } },
      { id: 'deadbug', v: { bw: ['Dead Bug', '8 je Seite', 'Unterer Rücken bleibt am Boden'] } },
      { id: 'hold', v: { kb: ['Suitcase Hold', '20–30 Sek. je Seite', 'Kugel ruhig halten'], bw: ['Seitstütz', '20–30 Sek. je Seite', 'Auf Unterarm, Knie dürfen am Boden bleiben'] } }
    ],
    warmup: [['0:45', 'Locker marschieren'], ['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Wand-Engel'], ['0:45', 'Katze-Kuh']],
    cooldown: [['0:30 × 2', 'Brustdehnung am Türrahmen'], ['1:00', 'Kindhaltung'], ['0:45 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Figure-4 Gesäß'], ['0:45 × 2', 'Wadendehnung']]
  }
};
PLANS.office = {
  tab: 'Büro', label: 'Büro · Haltung & Rücken', short: 'Büro', mode: 'circuit', durations: [4, 12, 4],
  intro: 'Gegen langes Sitzen: Hüftstreckung, oberer Rücken, Rumpf und Beweglichkeit. Ruhig und sauber – Tempo ist hier Nebensache.',
  slots: [
    { id: 'hinge', band: '20', v: { kb: ['Kettlebell-Kreuzheben', '10', 'Kugel zwischen den Füßen, Rücken lang'], band: ['Hüftheben mit Band', '15', 'Band über der Hüfte'], bw: ['Hüftheben', '15', 'Oben kurz halten'] } },
    { id: 'upper', order: ['band', 'kb', 'bw'], band: '10', v: { band: ['Band Pull-Apart', '15', 'Schulterblätter zusammenführen'], kb: ['Einarmiges Rudern', '10 je Seite', 'Freie Hand abstützen'], bw: ['Y-T-W in Bauchlage', '6 je Position', 'Blick zum Boden'] } },
    { id: 'squat', band: '20', v: { kb: ['Kniebeugen (Goblet)', '10', 'Kugel vor der Brust'], band: ['Kniebeugen mit Band', '10', 'Band unter den Füßen'], bw: ['Kniebeugen', '12', 'Arme nach vorne'] } },
    { id: 'angel', v: { bw: ['Wand-Engel', '8–10', 'Rücken und Arme an der Wand'] } },
    { id: 'birddog', v: { bw: ['Bird Dog', '8 je Seite', 'Becken ruhig halten'] } },
    { id: 'clam', order: ['band', 'bw'], band: '10', v: { band: ['Clamshells mit Band', '12 je Seite', 'Band doppelt um die Knie'], bw: ['Clamshells', '15 je Seite', 'Seitlage, Füße zusammen'] } },
    { id: 'tspine', v: { bw: ['Brustwirbel-Rotation im Vierfüßlerstand', '8 je Seite', 'Blick folgt dem Ellenbogen'] } }
  ],
  warmup: [['0:30', 'Marschieren auf der Stelle'], ['0:30', 'Schulter- und Armkreisen'], ['0:45', 'Katze-Kuh'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:30', 'Kniebeugen ohne Gewicht'], ['0:30 × 2', 'Beinpendel seitlich']],
  cooldown: [['0:45 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Brustdehnung am Türrahmen'], ['1:30', 'Kindhaltung']]
};
// Urlaub/Hotel: nur Körpergewicht, ohne Sprünge (leise), ca. 2 × 2 m Platz, Bett oder Stuhl als Hilfe – nur während des Urlaubs als Reiter
PLANS.hotel = {
  tab: 'Hotel', label: 'Hotel · Körpergewicht', short: 'Hotel', mode: 'circuit', durations: [4, 20, 4], vacationOnly: true,
  intro: 'Für unterwegs: nur Körpergewicht, ohne Sprünge – leise genug fürs Hotelzimmer. Es reichen etwa 2 × 2 m, Bett oder Stuhl helfen als Erhöhung und zum Festhalten. Gut 25 Minuten mit Aufwärmen und Cooldown.',
  slots: [
    { id: 'squat', v: { bw: ['Kniebeugen', '12–15', 'langsam runter, Fersen am Boden'] } },
    { id: 'split', v: { bw: ['Split Squat', '8–10 je Seite', 'mit einer Hand an Stuhl oder Wand festhalten'] } },
    { id: 'push', v: { bw: ['Liegestütze erhöht', '8–12', 'Hände auf Bettkante oder Stuhl an der Wand'] } },
    { id: 'balance', v: { bw: ['Standwaage', '6 je Seite', 'Stuhllehne zum Festhalten'] } },
    { id: 'pike', v: { bw: ['Pike-Liegestütze erhöht', '6–8', 'Hände auf einem stabilen Stuhl'] } },
    { id: 'crunch', v: { bw: ['Stehende Knie-Ellenbogen-Crunches', '10 je Seite', 'ruhig, ohne zu hüpfen'] } },
    { id: 'birddog', v: { bw: ['Bird Dog', '8 je Seite', 'auf Handtuch oder Teppich'] } },
    { id: 'bridge', v: { bw: ['Hüftheben', '15', 'oben 2 Sek. halten'] } },
    { id: 'deadbug', v: { bw: ['Dead Bug', '8 je Seite', 'unterer Rücken bleibt am Boden'] } },
    { id: 'side', v: { bw: ['Seitstütz', '20–30 Sek. je Seite', 'Knie dürfen am Boden bleiben'] } }
  ],
  warmup: [['0:30', 'Marschieren auf der Stelle'], ['0:30', 'Schulter- und Armkreisen'], ['0:45', 'Katze-Kuh'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:30', 'Kniebeugen ohne Gewicht'], ['0:30 × 2', 'Beinpendel seitlich']],
  cooldown: [['0:45 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Brustdehnung am Türrahmen'], ['1:30', 'Kindhaltung']]
};
PLANS.tabata = {
  tab: 'Tabata', label: 'Tabata · Ganzkörper', short: 'Tabata', mode: 'tabata', durations: [4, 0, 4],
  intro: 'Fünf Ganzkörper-Übungen mit Kettlebell, Band oder Körpergewicht, je 20 Sek. Vollgas und 10 Sek. Pause. Läuft komplett automatisch mit Ton bei jedem Wechsel – nichts antippen, einfach mitmachen. Runden und Pause sind einstellbar.',
  slots: [
    { id: 'swing', band: '20', v: { kb: ['Kettlebell-Swing', '20 Sek. je Runde', 'Kraft aus der Hüfte, nur bis Brusthöhe'], band: ['Hüftheben mit Band', '20 Sek. je Runde', 'zügig, oben kurz anspannen'], bw: ['Hüftheben', '20 Sek. je Runde', 'zügig, oben kurz anspannen'] } },
    { id: 'goblet', band: '20', v: { kb: ['Kniebeugen (Goblet)', '20 Sek. je Runde', 'Kugel vor der Brust, tief und kontrolliert'], band: ['Kniebeugen mit Band', '20 Sek. je Runde', 'Band unter den Füßen, Enden an den Schultern'], bw: ['Kniebeugen', '20 Sek. je Runde', 'zügig, Fersen am Boden'] } },
    { id: 'row2', band: '20', v: { kb: ['Vorgebeugtes Rudern beidarmig', '20 Sek. je Runde', 'Rücken lang, Kugel zum Bauch'], band: ['Rudern beidarmig mit Band', '20 Sek. je Runde', 'Band unter beiden Füßen'], bw: ['Y-T-W in Bauchlage', '20 Sek. je Runde', 'Y und T im Wechsel, Blick zum Boden'] } },
    { id: 'press2', band: '10', v: { kb: ['Überkopfdrücken beidarmig', '20 Sek. je Runde', 'Kugel an den Hörnern, Bauch fest'], band: ['Überkopfdrücken mit Band', '20 Sek. je Runde', 'Band unter beiden Füßen'], bw: ['Liegestütze erhöht', '20 Sek. je Runde', 'Hände auf Tisch oder Sofalehne'] } },
    { id: 'twist', band: '10', v: { kb: ['Übergabe im Grätschsitz', '20 Sek. je Runde', 'Aufrecht bleiben, Kugel kurz absetzen'], band: ['Holzhacker mit Band', '20 Sek. je Runde', 'Seite jede Runde wechseln'], bw: ['Bergsteiger erhöht', '20 Sek. je Runde', 'Hände erhöht, Knie im Wechsel zur Brust'] } }
  ],
  warmup: [['0:45', 'Marschieren auf der Stelle'], ['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:45', 'Kniebeugen ohne Gewicht'], ['1:00', 'Ausfallschritt mit Rotation']],
  cooldown: [['1:00', 'Locker marschieren'], ['0:30 × 2', 'Hintere Oberschenkel'], ['0:30 × 2', 'Hüftbeuger-Dehnung'], ['1:00', 'Kindhaltung']]
};
/* AMRAP: so viele Runden wie möglich in 20 Minuten mit einer Kettlebell. Fest auf Kettlebell (kbOnly). */
PLANS.amrap = {
  tab: 'AMRAP', label: 'AMRAP · Ganzkörper mit einer Kettlebell', short: 'AMRAP', mode: 'circuit', kbOnly: true, durations: [4, 20, 4],
  intro: 'So viele Runden wie möglich in 20 Minuten (AMRAP) mit einer Kettlebell: fünf Ganzkörper-Übungen am Stück, Pausen nimmst du dir nach Bedarf. Ergebnis = Runden + Übungen. Ein Gewicht wählen, mit dem auch die letzten Wiederholungen sauber bleiben.',
  slots: [
    { id: 'thruster', v: { kb: ['Rotational Thruster', '10 je Seite', 'Aus der Hocke aufdrehen und schräg nach oben drücken'] } },
    { id: 'dlhalo', v: { kb: ['Deadlift to Halo', '15', 'Kreuzheben, dann einmal um den Kopf'] } },
    { id: 'pressout', v: { kb: ['Lunge to Press-out', '10 je Seite', 'Unten im Ausfallschritt nach vorne drücken'] } },
    { id: 'pullrot', v: { kb: ['Pullover mit Rotation', '20', 'Vor der Brust drehen, dann über den Kopf'] } },
    { id: 'crosslunge', v: { kb: ['Cross-Body Lunge', '10 je Seite', 'Kugel quer am vorderen Bein vorbeiführen'] } }
  ],
  warmup: [['0:30', 'Marschieren auf der Stelle'], ['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Hüftbeuge ohne Gewicht'], ['0:45', 'Kniebeugen ohne Gewicht'], ['0:45', 'Ausfallschritt mit Rotation'], ['0:30', 'Halo um den Kopf']],
  cooldown: [['0:30 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Vorderer Oberschenkel'], ['0:30 × 2', 'Brustdehnung am Türrahmen'], ['1:00', 'Kindhaltung']]
};
/* Core: EMOM mit einer Kettlebell, komplett im Knien. Fest auf Kettlebell – die Geräte-Auswahl gilt hier nicht (kbOnly). */
PLANS.core = {
  tab: 'Core', label: 'Core · Oberkörper & Rumpf im Knien', short: 'Core', mode: 'emom', kbOnly: true, durations: [4, 0, 4],
  intro: 'EMOM mit einer Kettlebell, komplett im Knien: Zu Beginn jeder Minute die Wiederholungen der nächsten Übung, im Rest der Minute Pause. Drei Übungen im Wechsel, 5 Runden = 15 Minuten. Ohne die Beine als breite Basis muss der Rumpf jede Bewegung stabilisieren. Läuft automatisch mit Ton und Ansage.',
  slots: [
    { id: 'cleanpress', v: { kb: ['Clean & Press im halben Kniestand', '5 je Seite', 'Pressarm auf der Seite des Knies am Boden'] } },
    { id: 'pullover', v: { kb: ['Pullover im Kniestand', '10', 'Kugel an den Hörnern, Rippen unten'] } },
    { id: 'wrestler', v: { kb: ['Wrestler-Halo', '10 abwechselnd', 'Diagonal von Hüfte zu Hüfte, einmal um den Kopf'] } }
  ],
  warmup: [['0:30', 'Marschieren auf der Stelle'], ['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Katze-Kuh'], ['1:00', 'Ausfallschritt mit Rotation'], ['0:30', 'Kettlebell-Kreuzheben'], ['0:30', 'Halo um den Kopf']],
  cooldown: [['0:45 × 2', 'Hüftbeuger-Dehnung'], ['0:30 × 2', 'Brustdehnung am Türrahmen'], ['1:30', 'Kindhaltung']]
};
/* Finisher: kurzer Rumpf-Block im Grätschsitz, EMOM mit einer Kettlebell (Idee aus einem Video: „1 kettlebell, 10 minutes, core finisher“).
   Im Sitzen helfen Beine und Hüfte nicht mit – der Rumpf muss drehen, halten und drücken. Fest auf Kettlebell (kbOnly). */
PLANS.sitcore = {
  tab: 'Finisher', label: 'Finisher · Rumpf im Grätschsitz', short: 'Finisher', mode: 'emom', kbOnly: true, durations: [2, 0, 2], emomRounds: [2, 3, 4], emomDefault: 3,
  intro: 'Kurzer Rumpf-Finisher mit einer Kettlebell, komplett im Grätschsitz – passt nach einem lockeren Lauf oder ans Ende einer Krafteinheit. EMOM: Zu Beginn jeder Minute die nächste Übung, im Rest der Minute Pause. Vier Übungen im Wechsel, 3 Runden = 12 Minuten. Ohne Beine und Hüfte muss der Rumpf drehen, halten und drücken. Kommst du im Grätschsitz nicht aufrecht hin (runder unterer Rücken), setz dich auf ein Kissen oder beuge die Knie leicht.',
  slots: [
    { id: 'vchop', v: { kb: ['V-Chop im Grätschsitz', '5 je Seite', 'Arme lang, aus den Rippen drehen'] } },
    { id: 'wheel', v: { kb: ['Lenkrad im Grätschsitz', '20 Sek.', 'Kugel auf Augenhöhe, Ellenbogen eng, schnelle kleine Drehungen'] } },
    { id: 'press2', v: { kb: ['Press-up & Press-out im Sitz', '12', '3 × nach oben, 3 × nach vorne, im Wechsel'] } },
    { id: 'arc', v: { kb: ['Iron Arc im Grätschsitz', '4 je Seite', 'Aufrecht sitzen, die Hüfte dreht nicht mit'] } }
  ],
  warmup: [['0:45', 'Schulter- und Armkreisen'], ['0:45', 'Katze-Kuh'], ['0:30', 'Halo um den Kopf']],
  cooldown: [['0:30 × 2', 'Hintere Oberschenkel'], ['1:00', 'Kindhaltung']]
};
const EMOM_DEFAULT = { rounds: 5 }, EMOM_ROUNDS = [4, 5, 6];
const EMOM_PLAN_TEXT = 'EMOM heißt „Every Minute On the Minute“: Zu Beginn jeder Minute die angegebenen Wiederholungen, im Rest der Minute Pause. Dann folgt die nächste Übung. Die App sagt jeden Minutenwechsel per Ton und Ansage an, 3-2-1 vorher. Brauchst du mehr als etwa 45 Sekunden, nimm eine Wiederholung weniger.';
// Tabata als Zirkel: Übung 1 20″, 10″ Pause, Übung 2 … – das Ganze 3 × (je Übung 3 × 20″), zwischen den Runden eine längere Pause
const TABATA_DEFAULT = { rounds: 3, blockRest: 60 }, TABATA_ROUNDS = [3, 4, 5], TABATA_RESTS = [60, 90];
const TABATA_TEXT = 'Tabata als Zirkel: 20 Sekunden so viele saubere Wiederholungen wie möglich, 10 Sekunden Pause, dann die nächste Übung. Nach der letzten Übung folgt eine längere Pause und die nächste Runde – standardmäßig 3 Runden. Die App sagt jeden Wechsel per Ton an, 3-2-1 vorher.';
const PLAN_ORDER = ['hotel', 'wed', 'tabata', 'amrap', 'run', 'sun', 'core', 'sitcore', 'office'];

/* Zuordnung alter Einträge (vor Version 3) zu den Übungsplätzen des Ganzkörper-Zirkels,
   damit bisherige Bestwerte vergleichbar bleiben. */
const LEGACY_WED = {
  swing: ['kb', 'Kettlebell-Swing (beidarmig)'], hips: ['kb', 'Um die Hüfte schwingen'], halo: ['kb', 'Halo um den Kopf'],
  squat: ['kb', 'Kniebeugen'], lunge: ['kb', 'Ausfallschritte'], march: ['kb', 'Suitcase March'],
  row: ['eq', 'Einarmiges Rudern', 'kb'], press: ['eq', 'Brustdrücken', 'band20'], tri: ['eq', 'Trizeps über Kopf', 'kb'],
  curl: ['eq', 'Bizepscurls', 'kb'], balance: ['bw'], crunch: ['bw']
};

/* Anleitungen: steps, effect, cue. Bilder liegen in figures.js unter demselben Namen. */
const GUIDES = {
  'Kettlebell-Swing': { steps: ['Füße etwas breiter als hüftbreit. Hüfte nach hinten schieben, Knie leicht beugen, Kugel zwischen die Beine führen.', 'Hüfte kraftvoll strecken, sodass die Kugel bis etwa Brusthöhe schwingt. Die Arme führen nur.', 'Kugel zurückpendeln lassen und erneut in der Hüfte beugen.'], effect: 'Gesäß, hintere Oberschenkel, Griffkraft und Rumpf; zügig ausgeführt auch Ausdauer.', cue: 'Nicht aus den Schultern heben, kein Hohlkreuz am oberen Punkt. Wird die Technik unsauber, Wiederholungen reduzieren.' },
  'Hüftheben': { steps: ['Rückenlage, Knie angestellt, Fersen etwa eine Unterarmlänge vom Gesäß entfernt.', 'Gesäß anspannen und das Becken anheben, bis Knie, Hüfte und Schultern eine Linie bilden.', 'Oben eine Sekunde halten, langsam ablegen.'], effect: 'Gesäß und hintere Oberschenkel – die Hüftstreckung wie beim Swing, ohne Gerät.', cue: 'Nicht ins Hohlkreuz drücken; die Bewegung kommt aus dem Gesäß. Fersen bleiben am Boden.' },
  'Hüftheben mit Band': { steps: ['Rückenlage, Knie angestellt. Band quer über die Hüfte legen, die Enden links und rechts mit den Händen am Boden festhalten.', 'Becken gegen den Bandwiderstand anheben, bis Knie, Hüfte und Schultern eine Linie bilden.', 'Oben kurz halten, langsam ablegen.'], effect: 'Gesäß und hintere Oberschenkel mit zusätzlichem Widerstand.', cue: 'Band muss sicher fixiert sein und darf nicht abrutschen. Nicht ins Hohlkreuz drücken.' },
  'Holzhacker mit Kettlebell': { steps: ['Etwas breiter als hüftbreit stehen, Kugel mit beiden Händen an den Hörnern neben dem rechten Knie, leicht in die Knie gehen.', 'Kugel mit fast gestreckten Armen diagonal nach links oben über die Schulter führen. Hüfte und Oberkörper drehen mit, der rechte Fuß dreht auf dem Ballen mit.', 'Kontrolliert auf demselben Weg zurück. Alle Wiederholungen einer Seite, dann wechseln.'], effect: 'Schräge Bauchmuskeln, Rumpfrotation und Schultern mit Last – überträgt Kraft diagonal von den Beinen bis in die Arme.', cue: 'Die Drehung kommt aus Hüfte und Brustwirbelsäule, nicht aus dem unteren Rücken. Langsam abbremsen statt reißen, Kugel fest greifen.' },
  'Holzhacker': { steps: ['Hüftbreit stehen, Hände zusammen neben dem rechten Knie, leicht in die Knie gehen.', 'Hände diagonal nach links oben über die Schulter führen. Hüfte und Oberkörper drehen mit, der rechte Fuß dreht auf dem Ballen mit.', 'Kontrolliert zurück. Alle Wiederholungen einer Seite, dann wechseln.'], effect: 'Schräge Bauchmuskeln, Rumpfrotation, Koordination.', cue: 'Bewegung aus Hüfte und Oberkörper, nicht nur aus den Armen. Rücken lang lassen.' },
  'Holzhacker mit Band': { steps: ['Ein Bandende unter den rechten Fuß klemmen, das andere Ende mit beiden Händen neben dem rechten Knie greifen.', 'Diagonal nach links oben ziehen, Oberkörper mitdrehen.', 'Langsam zurückführen. Seite wechseln: Band unter den linken Fuß.'], effect: 'Schräge Bauchmuskeln und Rumpfrotation mit Widerstand.', cue: 'Band sicher unter dem Fuß fixieren. Leichtes Band wählen, die Bewegung ist weit.' },
  'Halo um den Kopf': { steps: ['Kettlebell mit beiden Händen am Griff vor der Brust halten.', 'Langsam dicht um den Kopf führen und vor die Brust zurück.', 'Alle Wiederholungen in eine Richtung, dann wechseln.'], effect: 'Schulterkontrolle und Beweglichkeit; Arme und Rumpf arbeiten mit.', cue: 'Kopf ruhig halten, Rippen nicht nach vorne schieben.' },
  'Armkreisen mit Spannung': { steps: ['Aufrecht stehen, Arme seitlich auf Schulterhöhe ausstrecken, Fäuste fest machen.', 'Kleine, kontrollierte Kreise nach vorne ausführen.', 'Nach der halben Zeit die Richtung wechseln.'], effect: 'Schulterausdauer und Schulterkontrolle ohne Gerät.', cue: 'Schultern unten lassen, nicht hochziehen. Arme bleiben auf Schulterhöhe.' },
  'Kniebeugen (Goblet)': { steps: ['Kettlebell mit beiden Händen vor der Brust halten, Füße etwa schulterbreit.', 'Knie und Hüfte beugen und zwischen die Füße absenken.', 'Über den ganzen Fuß wieder aufrichten.'], effect: 'Vordere Oberschenkel, Gesäß und Rumpfstabilität.', cue: 'Knie folgen den Zehen; nur so tief, wie Fersen und Rücken stabil bleiben.' },
  'Kniebeugen mit Band': { steps: ['Mit beiden Füßen auf die Bandmitte stellen, die Enden vor den Schultern halten.', 'In die Kniebeuge absenken, Oberkörper aufrecht.', 'Gegen den Bandwiderstand aufrichten.'], effect: 'Vordere Oberschenkel und Gesäß; der Widerstand steigt nach oben.', cue: 'Band muss mittig und sicher unter den Füßen liegen. Knie folgen den Zehen.' },
  'Kniebeugen': { steps: ['Füße etwa schulterbreit, Arme nach vorne nehmen.', 'Knie und Hüfte beugen, Gesäß nach hinten unten.', 'Über den ganzen Fuß aufrichten.'], effect: 'Vordere Oberschenkel und Gesäß.', cue: 'Fersen bleiben am Boden, Knie folgen den Zehen. Langsam absenken macht es schwerer.' },
  'Kniebeugen ohne Gewicht': { steps: ['Hüft- bis schulterbreit stehen.', 'Knie und Hüfte beugen, Arme nach vorne nehmen.', 'Kontrolliert wieder aufrichten.'], effect: 'Wärmt Oberschenkel und Gesäß auf.', cue: 'Fersen am Boden; Knie folgen den Zehen.' },
  'Ausfallschritte': { steps: ['Aufrecht stehen, mit Kugel vor der Brust oder Händen an der Hüfte.', 'Einen großen Schritt nach hinten machen und beide Knie kontrolliert beugen.', 'Über das vordere Bein zurück in den Stand drücken; Seite wechseln.'], effect: 'Gesäß und Oberschenkel; Gleichgewicht und Kontrolle von Hüfte und Knie.', cue: 'Vorderer Fuß bleibt ganz am Boden. Bei Bedarf leicht festhalten.' },
  'Split Squat': { steps: ['Großer Schritt: ein Fuß vorne, einer hinten auf dem Fußballen. Mit Kugel vor der Brust oder Händen an der Hüfte.', 'Hinteres Knie senkrecht Richtung Boden absenken, Oberkörper aufrecht.', 'Über die ganze vordere Fußsohle hochdrücken. Alle Wiederholungen einer Seite, dann wechseln.'], effect: 'Vordere Oberschenkel und Gesäß, jedes Bein einzeln; Hüft- und Kniestabilität für den Laufschritt.', cue: 'Vorderes Knie folgt den Zehen. Erst die normale Variante sicher beherrschen, bevor du auf Bulgarian wechselst.' },
  'Bulgarian Split Squat': { steps: ['Mit dem Rücken zu einer stabilen, etwa kniehohen Erhöhung stellen (Stuhl an der Wand, Sofa). Großen Schritt nach vorne, hinteren Fuß mit dem Spann auf die Erhöhung legen.', 'Kugel vor der Brust halten oder Hände an der Hüfte. Oberkörper leicht nach vorne geneigt, Rücken lang.', 'Hinteres Knie kontrolliert Richtung Boden senken, bis der vordere Oberschenkel etwa waagerecht ist.', 'Über die ganze vordere Fußsohle hochdrücken. Alle Wiederholungen einer Seite, dann wechseln.'], effect: 'Vordere Oberschenkel und Gesäß. Fast die ganze Last liegt auf einem Bein – auch mit 12 kg ein echter Kraftreiz.', cue: 'Abstand so wählen, dass die vordere Ferse am Boden bleibt. Die Erhöhung muss rutschfest stehen. Bei Knieschmerzen zurück zum normalen Split Squat.' },
  'Suitcase March': { steps: ['Kugel mit einer Hand wie einen Koffer neben dem Körper halten.', 'Aufrecht langsam auf der Stelle marschieren.', 'Nach der Zeit die Hand wechseln.'], effect: 'Seitliche Rumpfmuskeln, Griffkraft und Gleichgewicht.', cue: 'Nicht zur Seite kippen; Knie nur so hoch anheben, wie du stabil bleibst.' },
  'Suitcase Hold': { steps: ['Kugel einseitig neben dem Körper halten und stabil stehen.', 'Schultern waagerecht halten und ruhig weiteratmen.', 'Nach der Zeit die Hand wechseln.'], effect: 'Rumpfstabilität gegen seitliches Kippen und Griffkraft.', cue: 'Nicht zur Kugel oder von ihr weg lehnen; Schultern nicht hochziehen.' },
  'Seitstütz': { steps: ['Seitlich hinlegen, Ellenbogen genau unter der Schulter, Unterarm am Boden.', 'Becken anheben, bis der Körper von Kopf bis Knie (leichter) oder bis Fuß (schwerer) eine Linie bildet.', 'Halten, ruhig atmen, dann Seite wechseln.'], effect: 'Seitliche Rumpfmuskeln und Hüftstabilität – wichtig für einen stabilen Laufschritt.', cue: 'Becken nicht absacken lassen. Mit Knien am Boden beginnen; erst auf die Füße wechseln, wenn die Zeit sauber klappt.' },
  'Einarmiges Rudern': { steps: ['Versetzter Stand, Hüfte nach hinten, Rücken lang. Freie Hand auf einer stabilen Fläche oder dem Oberschenkel abstützen.', 'Kugel Richtung Hüfte ziehen, Ellenbogen nah am Körper.', 'Langsam absenken; nach allen Wiederholungen Seite wechseln.'], effect: 'Breiter Rückenmuskel, Muskeln zwischen den Schulterblättern, Bizeps und Griffkraft.', cue: 'Brust und Becken bleiben zum Boden ausgerichtet; nicht aufdrehen.' },
  'Rudern mit Band': { steps: ['Bandmitte unter dem vorderen Fuß sicher einklemmen. Ein Ende mit der gleichseitigen Hand greifen.', 'Hüfte nach hinten schieben, Rücken lang, freie Hand auf dem Oberschenkel abstützen.', 'Hand Richtung Hüfte ziehen, langsam zurück; nach allen Wiederholungen Seite wechseln.'], effect: 'Breiter Rückenmuskel, oberer Rücken, Bizeps und Rumpf.', cue: 'Band muss sicher unter dem Schuh liegen. Kein improvisierter Türanker. Nicht aufdrehen.' },
  'Y-T-W in Bauchlage': { steps: ['Bauchlage, Stirn auf einem kleinen Handtuch, Arme neben dem Körper.', 'Y: Arme schräg nach vorne heben. T: seitlich heben. W: Ellenbogen beugen und nach hinten ziehen. Jeweils kurz halten.', 'Die angegebenen Wiederholungen je Position, dann die nächste Position.'], effect: 'Oberer Rücken, hintere Schulter, Muskeln zwischen den Schulterblättern – Gegengewicht zu allen Druckübungen.', cue: 'Kleine Bewegung, Schulterblätter nach hinten unten. Blick zum Boden, Nacken lang.' },
  'Brustdrücken mit Band': { steps: ['Band hinter dem oberen Rücken unterhalb der Achseln führen, Enden neben der Brust halten.', 'Hände nach vorne drücken, Ellenbogen nicht gewaltsam durchstrecken.', 'Langsam zurückführen.'], effect: 'Brust, Trizeps und vordere Schultern; im Stand zusätzlich Rumpfstabilität.', cue: 'Band vorher auf Schäden prüfen. Die kg-Angabe ist ein Nennwert; der Widerstand steigt mit der Dehnung.' },
  'Floor Press': { steps: ['Rückenlage, Knie angestellt. Kugel mit beiden Händen sicher in die Startposition einer Hand bringen; Handgelenk gerade.', 'Oberarm etwa 30–45 Grad vom Körper, Gewicht senkrecht nach oben drücken.', 'Absenken, bis der Oberarm sanft am Boden aufliegt. Zum Seitenwechsel beide Hände nutzen.'], effect: 'Brust, Trizeps und vordere Schulter. Der Boden begrenzt die Absenktiefe.', cue: 'Niemals über Gesicht oder Kopf führen. Bei unsicherem Umsetzen lieber die Bandvariante wählen.' },
  'Liegestütze erhöht': { steps: ['Hände schulterbreit auf eine stabile Erhöhung (Tisch, Sofalehne, Fensterbank).', 'Körper bildet eine Linie, Brust kontrolliert zur Kante absenken.', 'Wieder hochdrücken. Je niedriger die Erhöhung, desto schwerer.'], effect: 'Brust, Trizeps, vordere Schultern und Rumpf.', cue: 'Erhöhung muss rutschfest stehen. Becken nicht durchhängen lassen.' },
  'Unterarmstütz': { steps: ['Bauchlage, Ellenbogen unter den Schultern, Unterarme am Boden.', 'Körper anheben, bis Kopf, Rücken und Knie (leichter) oder Füße (schwerer) eine Linie bilden.', 'Bauch und Gesäß anspannen, ruhig atmen, halten.'], effect: 'Gerade und tiefe Bauchmuskulatur, Schultern und Rumpfstabilität.', cue: 'Becken nicht durchhängen lassen und nicht hochschieben. Mit Knien am Boden beginnen.' },
  'Enge Liegestütze erhöht': { steps: ['Hände etwas enger als schulterbreit auf eine stabile Erhöhung.', 'Ellenbogen beim Absenken nah am Körper nach hinten führen.', 'Hochdrücken.'], effect: 'Trizeps, Brust und Rumpf.', cue: 'Ellenbogen nicht nach außen klappen. Bei Handgelenkbeschwerden höher abstützen.' },
  'Trizeps über Kopf': { steps: ['Kugel mit beiden Händen sicher über dem Kopf halten.', 'Ellenbogen beugen und das Gewicht langsam hinter den Kopf senken.', 'Arme kontrolliert wieder strecken.'], effect: 'Trizeps an der Rückseite der Oberarme.', cue: 'Bauch anspannen; Oberarme ruhig halten. Fehlende Schulterbeweglichkeit nicht erzwingen.' },
  'Trizeps mit Band': { steps: ['Ein Bandende mit einer Hand hinter dem unteren Rücken halten, das andere Ende mit der anderen Hand hinter dem Kopf.', 'Oberen Ellenbogen nach oben richten und den Arm kontrolliert strecken.', 'Langsam zurück; nach allen Wiederholungen Seite wechseln.'], effect: 'Trizeps; die untere Hand fixiert das Band ohne Anker.', cue: 'Mit leichtem Band beginnen. Kopf nicht nach vorne schieben, kein Hohlkreuz.' },
  'Bizepscurls': { steps: ['Aufrecht stehen, Kettlebell mit beiden Händen am Griff halten.', 'Ellenbogen beugen und die Kugel nach oben führen.', 'Langsam absenken.'], effect: 'Bizeps, weitere Ellenbogenbeuger und Unterarme.', cue: 'Ellenbogen nah am Körper; keinen Schwung aus Rücken oder Hüfte holen.' },
  'Bizepscurls mit Band': { steps: ['Mit beiden Füßen auf die Bandmitte stellen, Enden greifen.', 'Ellenbogen am Körper lassen, Hände zu den Schultern führen.', 'Langsam absenken.'], effect: 'Bizeps und Unterarme; der Widerstand steigt nach oben.', cue: 'Band vorab auf Schäden prüfen. Nicht eng um die Hände wickeln.' },
  'Handtuch-Curl (halten)': { steps: ['Ein Bein nach vorne stellen, Handtuch unter den vorderen Fuß legen und die Enden greifen.', 'Ellenbogen etwa 90 Grad beugen und mit voller Kraft gegen den Fuß nach oben ziehen – es bewegt sich nichts.', 'Spannung halten, ruhig atmen; dann Seite oder Arm wechseln.'], effect: 'Bizeps durch Halten gegen Widerstand (isometrisch), ganz ohne Gewicht.', cue: 'Nicht die Luft anhalten. Mit etwa 70–80 % Kraft beginnen.' },
  'Standwaage': { steps: ['Auf einem leicht gebeugten Bein stehen, bei Bedarf eine Hand abstützen.', 'Hüfte nach hinten schieben: Oberkörper nach vorne, freies Bein nach hinten.', 'Becken gerade halten und langsam aufrichten.'], effect: 'Gesäß, hintere Oberschenkel sowie Gleichgewicht und Fußstabilität.', cue: 'Bewegungsumfang klein beginnen; nicht ins Hohlkreuz ausweichen oder das Becken aufdrehen.' },
  'Einbeiniges Kreuzheben': { steps: ['Auf einem leicht gebeugten Bein stehen, Kugel in der Hand gegenüber dem Standbein.', 'Hüfte nach hinten schieben: Oberkörper nach vorne, freies Bein lang nach hinten, Kugel Richtung Boden.', 'Becken gerade halten und über das Gesäß aufrichten.'], effect: 'Gesäß, hintere Oberschenkel, Fuß- und Hüftstabilität.', cue: 'Erst ohne Gewicht sicher werden. Becken nicht aufdrehen, Rücken lang.' },
  'Stehende Knie-Ellenbogen-Crunches': { steps: ['Aufrecht stehen, Hände locker neben den Kopf nehmen.', 'Ein Knie und den gegenüberliegenden Ellenbogen kontrolliert zueinander bewegen.', 'Aufrichten und Seite wechseln.'], effect: 'Gerade und schräge Bauchmuskeln, Hüftbeuger und Koordination.', cue: 'Nicht am Kopf ziehen. Knie und Ellenbogen müssen sich nicht berühren.' },
  'Einbeiniges Wadenheben': { steps: ['Auf einem Bein stehen, mit einer Hand an der Wand abstützen. Kugel (falls genutzt) in der anderen Hand.', 'Langsam auf den Fußballen hochdrücken, oben kurz halten.', 'In etwa 3 Sekunden absenken, dann Seite wechseln.'], effect: 'Wade und Achillessehne – wichtig für Ermüdungsresistenz auf langen Strecken.', cue: 'Bei Beschwerden im Mittelfuß zuerst beidbeinig und ohne Gewicht beginnen; nicht wippen.' },
  'Schulterdrücken': { steps: ['Kugel einarmig vor der Schulter halten (Rack-Position), Handgelenk gerade, Bauch und Gesäß anspannen.', 'Kugel senkrecht über die Schulter drücken, bis der Arm gestreckt ist.', 'Kontrolliert zurück in die Rack-Position; nach allen Wiederholungen Seite wechseln.'], effect: 'Schultern, Trizeps und Rumpfstabilität.', cue: 'Nicht ins Hohlkreuz ausweichen. Sind 8 saubere Wiederholungen nicht möglich, Bandvariante wählen.' },
  'Überkopfdrücken mit Band': { steps: ['Mit beiden Füßen auf die Bandmitte stellen, Enden auf Schulterhöhe halten.', 'Beide Hände senkrecht nach oben drücken.', 'Langsam zurück auf Schulterhöhe.'], effect: 'Schultern und Trizeps.', cue: 'Bauch fest, kein Hohlkreuz. Leichtes Band wählen, der Widerstand steigt nach oben stark an.' },
  'Pike-Liegestütze erhöht': { steps: ['Hände auf einen stabilen Stuhl oder eine Bank, Füße am Boden, Hüfte hoch – der Körper bildet ein umgedrehtes V.', 'Ellenbogen beugen und den Kopf kontrolliert Richtung Stuhlkante senken.', 'Hochdrücken.'], effect: 'Schultern und Trizeps – das Körpergewicht-Gegenstück zum Schulterdrücken.', cue: 'Stuhl gegen eine Wand stellen. Bewegung klein beginnen; bei Schulter- oder Handgelenkbeschwerden auslassen.' },
  'Seitheben mit Band': { steps: ['Bandmitte unter beiden Füßen, Enden seitlich neben den Oberschenkeln greifen.', 'Arme leicht gebeugt seitlich bis Schulterhöhe anheben.', 'Langsam absenken.'], effect: 'Seitliche Schulter.', cue: 'Schultern nicht hochziehen, nicht über Schulterhöhe, kein Schwung.' },
  'Wand-Seitheben (halten)': { steps: ['Seitlich neben eine Wand stellen, der Arm hängt locker, Handrücken an der Wand.', 'Mit dem Handrücken kräftig seitlich gegen die Wand drücken, als wolltest du den Arm heben.', 'Spannung halten, dann Seite wechseln.'], effect: 'Seitliche Schulter durch Halten gegen Widerstand (isometrisch).', cue: 'Schulter unten lassen, nicht zur Wand lehnen. Ruhig weiteratmen.' },
  'Band Pull-Apart': { steps: ['Band schulterbreit vor der Brust greifen, Arme fast gestreckt.', 'Band auseinanderziehen, bis es die Brust berührt; Schulterblätter zusammenführen.', 'Langsam zurück.'], effect: 'Hintere Schulter und oberer Rücken – Gegengewicht zu den Druckübungen.', cue: 'Rippen unten lassen, nicht ins Hohlkreuz. Enger greifen macht es schwerer.' },
  'Dead Bug': { steps: ['Rückenlage, Arme senkrecht nach oben, Knie 90 Grad über der Hüfte.', 'Unteren Rücken sanft in den Boden drücken. Einen Arm und das gegenüberliegende Bein langsam strecken.', 'Zurückführen und Seite wechseln.'], effect: 'Gerade und tiefe Bauchmuskulatur, Rumpfkontrolle.', cue: 'Unterer Rücken bleibt am Boden; Bewegung verkleinern, wenn er abhebt. Ruhig ausatmen.' },
  'Marschieren auf der Stelle': { steps: ['Locker auf der Stelle gehen und die Arme mitnehmen.', 'Mit kleinen Schritten beginnen und das Tempo allmählich steigern.'], effect: 'Wärmt den Körper auf und erhöht die Belastung allmählich.', cue: 'Leicht auftreten und entspannt weiteratmen.' },
  'Seitliche Schritte': { steps: ['Mit lockeren Knien seitlich treten.', 'Anderen Fuß heranführen, dann die Richtung wechseln.'], effect: 'Aktiviert Beine und seitliche Hüftmuskeln.', cue: 'Füße nicht überkreuzen; kontrolliert auftreten.' },
  'Schulter- und Armkreisen': { steps: ['Aufrecht stehen, Schultern locker.', 'Erst kleine, dann größere Kreise vorwärts und rückwärts.'], effect: 'Bewegt die Schultern durch und bereitet auf Oberkörperübungen vor.', cue: 'Nur im angenehmen Bewegungsumfang kreisen.' },
  'Hüftkreisen': { steps: ['Hüftbreit stehen, Knie weich, Hände an die Hüften.', 'Langsame kleine Kreise mit dem Becken, dann Richtung wechseln.'], effect: 'Lockere Mobilisation im Beckenbereich.', cue: 'Keine großen erzwungenen Kreise aus dem unteren Rücken.' },
  'Hüftkreisen und Oberkörperrotation': { steps: ['Kleine Hüftkreise ausführen.', 'Danach den Oberkörper langsam rechts und links drehen, Arme locker mitnehmen.'], effect: 'Lockere Mobilisation von Becken und Oberkörper.', cue: 'Nicht in die Endposition schleudern.' },
  'Hüftkreisen und lockeres Marschieren': { steps: ['Kleine entspannte Hüftkreise ausführen.', 'Anschließend langsam auf der Stelle gehen und die Arme ausschütteln.'], effect: 'Lässt die Belastung abklingen.', cue: 'Ruhig weiteratmen; keine erzwungene Dehnung.' },
  'Hüftbeuger-Dehnung': { steps: ['Halber Kniestand auf weicher Unterlage, vorderer Fuß steht stabil.', 'Becken leicht aufrichten und das Gesäß der hinteren Seite anspannen.', 'Becken sanft nach vorne schieben, bis es vorne an der hinteren Hüfte zieht. Dann Seite wechseln.'], effect: 'Dehnt die Hüftbeuger – nach dem Laufen und langem Sitzen besonders wertvoll.', cue: 'Oberkörper aufrecht, kein Hohlkreuz. Bei Kniedruck im Ausfallschritt stehen.' },
  'Vorderer Oberschenkel': { steps: ['Im Stand an einer Wand festhalten.', 'Einen Fuß zum Gesäß führen und am Fuß oder Knöchel halten.', 'Knie ungefähr nebeneinander, Becken leicht aufrichten.'], effect: 'Dehnt die Vorderseite des Oberschenkels.', cue: 'Nicht am Knie ziehen oder den Rücken überstrecken.' },
  'Figure-4 Gesäß': { steps: ['Auf einen stabilen Stuhl setzen und einen Knöchel auf den anderen Oberschenkel legen.', 'Rücken lang halten und den Oberkörper leicht nach vorne neigen.', 'Sanft halten, dann wechseln.'], effect: 'Dehnt den Gesäßbereich der oben liegenden Seite.', cue: 'Nicht auf das angehobene Knie drücken; bei Kniebeschwerden Position lösen.' },
  'Adduktoren': { steps: ['Breit stehen, Füße leicht nach außen.', 'Gewicht auf eine Seite verlagern und dieses Knie beugen, das andere Bein bleibt lang.', 'Sanft halten, dann wechseln.'], effect: 'Dehnt die Innenseite des langen Beins.', cue: 'Nicht wippen; Knie bleibt in Richtung der Zehen.' },
  'Wadendehnung': { steps: ['Hände an eine Wand, ein Bein lang nach hinten, Ferse am Boden.', 'Vorderes Knie beugen, bis die hintere Wade zieht.', 'Halten, dann Seite wechseln.'], effect: 'Dehnt die Wadenmuskulatur nach Wadenheben und Laufen.', cue: 'Hintere Ferse bleibt am Boden, Fuß zeigt nach vorne; nicht wippen.' },
  'Brustdehnung am Türrahmen': { steps: ['Unterarm senkrecht an einen Türrahmen legen, Ellenbogen auf Schulterhöhe.', 'Mit dem Oberkörper langsam nach vorne gehen, bis es in der Brust zieht.', 'Halten, dann Seite wechseln.'], effect: 'Dehnt Brust und vordere Schulter nach den Druckübungen.', cue: 'Schulter nicht nach vorne schieben; nur sanfter Zug.' }
};
GUIDES['Locker marschieren'] = GUIDES['Marschieren auf der Stelle'];

Object.assign(GUIDES, {
  // Ergänzende Geräte-Varianten
  'Ausfallschritte mit Band': { steps: ['Bandmitte unter den vorderen Fuß, Enden vor den Schultern halten.', 'Kontrolliert in den Ausfallschritt absenken, hinteres Knie Richtung Boden.', 'Über das vordere Bein hochdrücken; nach allen Wiederholungen Seite wechseln.'], effect: 'Gesäß und Oberschenkel; der Widerstand steigt nach oben.', cue: 'Band sicher unter dem Schuh, vorderes Knie über dem Fuß.' },
  'Split Squat mit Band': { steps: ['Schrittstellung, Bandmitte unter dem vorderen Fuß, Enden vor den Schultern.', 'Hinteres Knie senkrecht Richtung Boden absenken.', 'Hochdrücken; nach allen Wiederholungen Seite wechseln.'], effect: 'Vordere Oberschenkel und Gesäß, jedes Bein einzeln.', cue: 'Oberkörper aufrecht, Band nicht verrutschen lassen.' },
  'Suitcase March mit Band': { steps: ['Bandende unter einen Fuß klemmen, das andere Ende mit der Hand derselben Seite neben dem Körper halten – das Band zieht nach unten.', 'Aufrecht langsam auf der Stelle marschieren.', 'Nach der Zeit Seite wechseln.'], effect: 'Seitliche Rumpfmuskeln gegen einseitigen Zug.', cue: 'Nicht zur Bandseite kippen, Schultern waagerecht.' },
  'Suitcase Hold mit Band': { steps: ['Bandende unter einen Fuß klemmen, das andere Ende seitlich mit gestrecktem Arm halten.', 'Aufrecht stehen und gegen den Zug ruhig halten.', 'Nach der Zeit Seite wechseln.'], effect: 'Rumpfstabilität gegen seitliches Kippen.', cue: 'Schultern waagerecht, ruhig weiteratmen.' },
  'Einbeiniges Kreuzheben mit Band': { steps: ['Band unter den Standfuß, Ende in der Hand der Gegenseite.', 'Hüfte nach hinten schieben, freies Bein lang nach hinten, Oberkörper nach vorne.', 'Über das Gesäß gegen das Band aufrichten.'], effect: 'Gesäß, hintere Oberschenkel, Fuß- und Hüftstabilität.', cue: 'Becken gerade halten, Rücken lang.' },
  'Einbeiniges Wadenheben mit Band': { steps: ['Band unter den Fußballen des Standbeins, Ende mit einer Hand auf Schulterhöhe halten, andere Hand an die Wand.', 'Auf den Fußballen hochdrücken, oben kurz halten.', 'In 3 Sekunden absenken; Seite wechseln.'], effect: 'Wade und Achillessehne mit Zusatzwiderstand.', cue: 'Bei Mittelfuß-Beschwerden erst beidbeinig und ohne Band.' },
  'Dead Bug mit Kettlebell': { steps: ['Rückenlage, Kugel mit beiden Händen und gestreckten Armen über der Brust halten, Knie 90 Grad über der Hüfte.', 'Unteren Rücken in den Boden drücken, ein Bein langsam strecken.', 'Zurück, Bein wechseln – die Kugel bleibt ruhig über der Brust.'], effect: 'Tiefe Bauchmuskulatur und Rumpfkontrolle, fordernder als ohne Gewicht.', cue: 'Kugel sicher greifen und nie über das Gesicht kippen lassen. Unterer Rücken bleibt am Boden.' },
  'Dead Bug mit Band': { steps: ['Rückenlage, Band unter beide Füße (Knie 90 Grad über der Hüfte), Enden mit gestreckten Armen über der Brust halten.', 'Einen Arm nach hinten und das Gegenbein nach vorne strecken – das Band spannt.', 'Zurück und Seite wechseln.'], effect: 'Rumpfstabilität gegen den Bandzug.', cue: 'Unterer Rücken bleibt am Boden; leichtes Band wählen.' },
  'Squeeze Press am Boden': { steps: ['Rückenlage, Knie angestellt. Kugel mit beiden Händen seitlich an der Kugel (nicht am Griff) über der Brust halten.', 'Die Handflächen fest gegeneinander drücken und die Kugel unter diesem Druck senkrecht nach oben drücken.', 'Langsam absenken, bis die Oberarme am Boden ankommen.'], effect: 'Brust und Trizeps. Das Zusammendrücken lässt die Brust auch mit wenig Gewicht kräftig arbeiten.', cue: 'Handgelenke gerade, Kugel nie über das Gesicht führen. Den Druck der Hände während der ganzen Bewegung halten.' },
  'Schwimmer in Bauchlage': { steps: ['Bauchlage, Stirn auf einem kleinen Handtuch, Arme lang über dem Kopf, Daumen zeigen nach oben.', 'Arme leicht vom Boden lösen und in einem großen Bogen seitlich nach hinten zur Hüfte führen; die Handflächen drehen dabei nach oben.', 'Auf demselben Weg zurück über den Kopf.'], effect: 'Breiter Rückenmuskel, unterer Trapez und Schulterblattkontrolle – die Pullover-Bewegung ohne Gewicht.', cue: 'Blick zum Boden, Nacken lang. Arme nur so hoch heben, wie es ohne Hohlkreuz geht.' },
  'Clean & Press im halben Kniestand': { steps: ['Halber Kniestand: ein Knie am Boden, das andere Bein vorne aufgestellt. Kugel auf der Seite des unteren Knies neben dem Körper.', 'Clean: Kugel mit einer Hand greifen und mit einem kurzen Zug in die Rack-Position vor die Schulter bringen – die Kugel rollt um das Handgelenk, statt auf den Unterarm zu schlagen.', 'Press: Bauch und Gesäß fest, Kugel senkrecht über den Kopf drücken und oben kurz halten. Kontrolliert zurück in die Rack-Position und ablegen.', 'Alle Wiederholungen einer Seite, dann Knie und Arm wechseln.'], effect: 'Schultern, Trizeps und oberer Rücken. Der schmale Stand zwingt den Rumpf, Kippen und Verdrehen abzufangen.', cue: 'Pressarm auf der Seite des Knies am Boden. Rippen unten, nicht ins Hohlkreuz ausweichen. Klappt der Clean aus dem Knien nicht sauber, die Kugel mit beiden Händen in die Rack-Position bringen und nur drücken.' },
  'Pullover im Kniestand': { steps: ['Aufrecht knien, Knie hüftbreit, Gesäß angespannt. Kugel an den Hörnern vor der Brust halten.', 'Kugel mit fast gestreckten Armen über den Kopf führen und hinter dem Kopf absenken, die Ellenbogen zeigen nach oben.', 'Auf demselben Weg zurück über den Kopf und vor die Brust.'], effect: 'Breiter Rückenmuskel, Schultern und Trizeps. Im Knien muss der Rumpf das Hohlkreuz aktiv verhindern.', cue: 'Rippen unten, Gesäß fest – der Rücken bleibt neutral, auch wenn die Kugel hinter den Kopf geht. Nur so weit absenken, wie die Schultern es frei zulassen.' },
  'Rotational Thruster': { steps: ['Schulterbreit stehen, Kugel mit beiden Händen an den Hörnern vor der Brust, Ellenbogen nah am Körper.', 'In die Kniebeuge absenken, Fersen bleiben am Boden, Oberkörper aufrecht.', 'Kraftvoll aufstehen und dabei auf dem Ballen des hinteren Fußes nach links aufdrehen; die Kugel aus dem Schwung schräg über den Kopf drücken.', 'Kugel kontrolliert zur Brust zurückführen, wieder nach vorne drehen und in die nächste Kniebeuge. Seiten abwechseln.'], effect: 'Beine, Gesäß und Schultern in einer Bewegung; die Drehung fordert die schrägen Bauchmuskeln. Bringt den Puls schnell hoch.', cue: 'Der Schub kommt aus den Beinen, nicht aus den Armen. Knie zeigen in Richtung der Zehen, der hintere Fuß dreht mit, damit das Knie nicht verdreht wird. Oben nicht ins Hohlkreuz fallen.' },
  'Deadlift to Halo': { steps: ['Hüftbreit stehen, Kugel zwischen den Füßen. Hüfte nach hinten schieben, Knie leicht beugen, Rücken lang, Kugel an den Hörnern greifen.', 'Mit geradem Rücken aufrichten und das Gesäß anspannen (Kreuzheben).', 'Kugel zur Brust heben und einmal dicht um den Kopf führen (Halo), Richtung bei jeder Wiederholung wechseln.', 'Kugel vor die Brust, dann mit langem Rücken wieder zwischen die Füße absenken.'], effect: 'Hintere Kette (Gesäß, Beinrückseite, Rücken) beim Kreuzheben, dazu Schulterbeweglichkeit und Rumpfstabilität beim Halo.', cue: 'Beim Absenken die Hüfte nach hinten, nicht den Rücken runden. Beim Halo Rippen unten und Bauch fest, Kopf ruhig – die Kugel bewegt sich um den Kopf, nicht umgekehrt.' },
  'Lunge to Press-out': { steps: ['Aufrecht stehen, Kugel an den Hörnern (oder am Kugelkörper) vor der Brust.', 'Großen Schritt nach hinten machen und das hintere Knie Richtung Boden absenken.', 'Unten die Kugel mit gestreckten Armen auf Brusthöhe nach vorne drücken, kurz halten und zur Brust zurückholen.', 'Über das vordere Bein zurück in den Stand drücken. Seiten abwechseln.'], effect: 'Beine und Gesäß im Ausfallschritt; das Ausdrücken nach vorne verlängert den Hebel und fordert Schultern und Rumpf.', cue: 'Oberkörper aufrecht, das vordere Knie bleibt über dem Fuß. Beim Ausdrücken nicht nach vorne kippen – Bauch fest, Schultern weg von den Ohren.' },
  'Pullover mit Rotation': { steps: ['Schulterbreit stehen, Knie leicht gebeugt, Kugel an den Hörnern vor der Brust.', 'Oberkörper mit der Kugel nach links und rechts drehen, die Hüfte zeigt nach vorne.', 'Kugel mit leicht gebeugten Ellenbogen über den Kopf und ein Stück hinter den Kopf führen (Pullover), dann zurück vor die Brust.', 'Drehung und Pullover im Wechsel, ruhig und gleichmäßig.'], effect: 'Schultern, oberer Rücken und schräge Bauchmuskeln; verbessert die Beweglichkeit über Kopf und die Kontrolle in der Drehung.', cue: 'Mit leichtem Gewicht beginnen. Beim Pullover Rippen unten und nicht ins Hohlkreuz. Die Drehung kommt aus dem Oberkörper, die Knie bleiben ruhig.' },
  'Cross-Body Lunge': { steps: ['Aufrecht stehen, Kugel einarmig am Griff, Arm hängt locker.', 'Mit dem Bein auf der Seite der Kugel einen großen Schritt nach hinten und das hintere Knie absenken.', 'Dabei die Kugel quer vor dem Körper am vorderen Bein vorbei nach außen führen.', 'Zurück in den Stand, Kugel wieder zur Seite. Nach den Wiederholungen die Hand wechseln.'], effect: 'Beine und Gesäß, dazu Rumpf und Schulter gegen die Drehung, weil die Kugel quer vor dem Körper geführt wird.', cue: 'Brust bleibt offen, Rücken lang – nicht in die Drehung fallen. Die Kugel kontrolliert führen statt schwingen; das vordere Knie zeigt in Richtung der Zehen.' },
  'Wrestler-Halo': { steps: ['Aufrecht knien, Knie hüftbreit, Gesäß angespannt. Kugel an den Hörnern neben der linken Hüfte.', 'Kugel diagonal vor dem Körper nach oben führen, einmal dicht um den Kopf kreisen und auf der anderen Seite diagonal zur rechten Hüfte absenken.', 'Von dort in die Gegenrichtung: um den Kopf und zurück zur linken Hüfte. Seiten abwechseln.'], effect: 'Schultern und schräge Bauchmuskeln: Der Oberkörper dreht kontrolliert mit (Rotation) und bremst die Kugel um den Kopf ab (Antirotation).', cue: 'Die Drehung kommt aus dem Oberkörper, das Becken zeigt nach vorne. Kugel dicht am Kopf führen – ruhig und kontrolliert statt mit Schwung.' },
  'Kettlebell-Pullover': { steps: ['Rückenlage, Knie angestellt. Kugel mit beiden Händen an den Hörnern über der Brust halten.', 'Arme fast gestreckt langsam über den Kopf Richtung Boden führen, so weit es ohne Hohlkreuz geht.', 'Kontrolliert zurück über die Brust.'], effect: 'Breiter Rückenmuskel und Brust; öffnet Brustkorb und Brustwirbelsäule.', cue: 'Kugel sicher greifen, Rippen unten lassen. Bewegungsumfang langsam steigern.' },
  'Butterfly mit Band': { steps: ['Band hinter dem oberen Rücken, Enden greifen, Arme seitlich leicht gebeugt.', 'Arme im Bogen vor der Brust zusammenführen.', 'Langsam zurück öffnen.'], effect: 'Brustmuskulatur, ergänzend zum Drücken.', cue: 'Ellenbogen leicht gebeugt lassen, Schultern unten.' },
  'Seitlicher Ausfallschritt mit Kettlebell': { steps: ['Breiter Stand, Kugel vor der Brust, Füße leicht nach außen.', 'Gewicht auf ein Bein verlagern und dieses Knie beugen, das andere Bein bleibt gestreckt.', 'Zurück in die Mitte drücken und Seite wechseln.'], effect: 'Gesäß, Adduktoren und Oberschenkel in der seitlichen Ebene – stabilisiert Hüfte und Knie.', cue: 'Knie folgt den Zehen, Fersen am Boden, Rücken lang.' },

  // Kraft · Tabata
  'Vorgebeugtes Rudern beidarmig': { steps: ['Kugel mit beiden Händen am Griff halten, Füße hüftbreit.', 'Hüfte nach hinten schieben, Oberkörper etwa 45 Grad vorneigen, Rücken lang, Arme hängen.', 'Kugel zum Bauch ziehen, Ellenbogen nach hinten, Schulterblätter zusammen. Kontrolliert absenken.'], effect: 'Oberer und breiter Rückenmuskel, hintere Schulter, Bizeps; die Haltung trainiert zusätzlich Rückenstrecker und Gesäß.', cue: 'Rücken bleibt lang, kein Rundrücken – auch wenn es in den letzten Sekunden hart wird. Nicht mit Schwung aus dem Oberkörper ziehen.' },
  'Überkopfdrücken beidarmig': { steps: ['Kugel an den Hörnern (seitlich am Griff) vor der Brust halten, Ellenbogen unten.', 'Bauch und Gesäß anspannen und die Kugel senkrecht über den Kopf drücken.', 'Kontrolliert zurück vor die Brust.'], effect: 'Schultern, Trizeps und oberer Rücken; der Rumpf stabilisiert gegen das Hohlkreuz.', cue: 'Kein Hohlkreuz, Rippen unten. Den Kopf beim Drücken leicht zurücknehmen, damit die Kugel gerade nach oben gehen kann.' },
  'Rudern beidarmig mit Band': { steps: ['Mit beiden Füßen hüftbreit auf die Bandmitte stellen, je ein Ende in einer Hand.', 'Hüfte nach hinten schieben, Oberkörper etwa 45 Grad vorneigen, Rücken lang.', 'Beide Hände zum Bauch ziehen, Ellenbogen nach hinten, Schulterblätter zusammen. Kontrolliert zurück.'], effect: 'Oberer und breiter Rückenmuskel, hintere Schulter, Bizeps.', cue: 'Rücken bleibt lang, auch in den letzten Sekunden. Band sicher unter den Füßen, Enden nicht um die Hände wickeln.' },
  'Bergsteiger erhöht': { steps: ['Hände schulterbreit auf eine stabile Erhöhung (Sofalehne, Tisch, Treppenstufe), Körper in einer Linie.', 'Abwechselnd ein Knie zügig Richtung Brust ziehen und zurücksetzen.', 'Tempo nur so hoch, wie Becken und Rücken ruhig bleiben.'], effect: 'Rumpf, Hüftbeuger und Schultern – bringt den Puls hoch, ohne zu springen.', cue: 'Je höher die Erhöhung, desto leichter. Becken nicht hochschieben oder durchhängen lassen.' },
  'Übergabe im Grätschsitz': { steps: ['Im Grätschsitz auf den Boden setzen, Beine gestreckt oder leicht gebeugt. Kippt das Becken nach hinten, auf ein Kissen oder einen gefalteten Pullover setzen.', 'Aufrichten: Brust raus, Schultern nach hinten unten. Kugel mit beiden Händen am Griff neben der rechten Hüfte.', 'Kugel anheben, vor dem Körper zur linken Seite führen und neben der linken Hüfte kurz absetzen. Dann zurück – je eine Wiederholung pro Seite.'], effect: 'Schräge Bauchmuskeln, oberer Rücken und Schultern. Der Rücken bleibt aufrecht – Haltung und Drehung in einer Übung, ohne Drehen im runden Rücken wie beim Russian Twist.', cue: 'Der Rücken bleibt lang, auch wenn es schwer wird. Lieber ein höheres Kissen oder leicht gebeugte Knie als ein runder Rücken. Kugel nah am Körper führen und absetzen statt durchschwingen.' },

  // Kraft · Büro
  'Hüftbeuge ohne Gewicht': { steps: ['Hüftbreit stehen, Hände an die Hüfte, Knie leicht gebeugt.', 'Gesäß nach hinten schieben und den Oberkörper mit langem Rücken nach vorne neigen, bis es hinten in den Oberschenkeln zieht.', 'Hüfte nach vorne strecken und oben das Gesäß kurz anspannen. Zügig, aber kontrolliert wiederholen.'], effect: 'Bereitet die Hüftbeuge vor – das Grundmuster für Swing, Kreuzheben, Rudern vorgebeugt und Hüftheben.', cue: 'Die Bewegung kommt aus der Hüfte, der Rücken bleibt lang. Die Knie beugen sich nur leicht – das ist keine Kniebeuge.' },
  'Kettlebell-Kreuzheben': { steps: ['Kugel zwischen die Füße stellen, Füße hüftbreit.', 'Hüfte nach hinten schieben, Knie leicht beugen, Rücken lang, Griff mit beiden Händen fassen.', 'Füße in den Boden drücken und aufrichten, oben Gesäß anspannen. Kontrolliert wieder absetzen.'], effect: 'Gesäß, hintere Oberschenkel, Rückenstrecker – das Gegenteil von langem Sitzen. Basis für den Swing.', cue: 'Rücken bleibt lang, kein Rundrücken. Die Kugel bleibt nah am Körper.' },
  'Wand-Engel': { steps: ['Mit Rücken, Gesäß und Hinterkopf an die Wand stellen, Füße eine Fußlänge vor der Wand.', 'Arme in W-Form an die Wand legen, Ellenbogen und Handrücken möglichst an der Wand.', 'Arme langsam nach oben schieben und zurück in die W-Form ziehen.'], effect: 'Oberer Rücken, Schulterblattkontrolle, Brust- und Schulteröffnung.', cue: 'Unterer Rücken bleibt an der Wand – lieber kleinerer Bewegungsumfang.' },
  'Bird Dog': { steps: ['Vierfüßlerstand: Hände unter den Schultern, Knie unter der Hüfte.', 'Einen Arm und das gegenüberliegende Bein lang ausstrecken, bis sie mit dem Rücken eine Linie bilden.', 'Kurz halten, zurück, Seite wechseln.'], effect: 'Rückenstrecker, Gesäß und Rumpfstabilität.', cue: 'Becken bleibt waagerecht, nicht ins Hohlkreuz. Langsam bewegen.' },
  'Clamshells': { steps: ['Seitlage, Knie etwa 45 Grad gebeugt, Füße übereinander, Kopf auf dem Arm.', 'Füße zusammen lassen und das obere Knie öffnen.', 'Langsam schließen; nach allen Wiederholungen Seite wechseln.'], effect: 'Seitliche Gesäßmuskulatur – stabilisiert Hüfte und Knie, auch beim Laufen.', cue: 'Becken nicht nach hinten kippen lassen. Bewegung kommt aus der Hüfte.' },
  'Clamshells mit Band': { steps: ['Band doppelt oberhalb der Knie umwickeln, Seitlage, Knie gebeugt, Füße übereinander.', 'Oberes Knie gegen das Band öffnen, Füße bleiben zusammen.', 'Langsam schließen; Seite wechseln.'], effect: 'Seitliche Gesäßmuskulatur mit Widerstand.', cue: 'Leichtestes Band nehmen. Becken stabil halten.' },
  'Brustwirbel-Rotation im Vierfüßlerstand': { steps: ['Vierfüßlerstand, eine Hand an den Hinterkopf.', 'Ellenbogen Richtung Stützarm nach unten führen.', 'Dann Ellenbogen zur Decke drehen, Blick folgt. Nach allen Wiederholungen Seite wechseln.'], effect: 'Beweglichkeit der Brustwirbelsäule – wichtig bei viel Sitzen und für den Armschwung beim Laufen.', cue: 'Becken bleibt ruhig über den Knien, Drehung kommt aus dem oberen Rücken.' },
  'Katze-Kuh': { steps: ['Vierfüßlerstand: Hände unter den Schultern, Knie unter der Hüfte.', 'Ausatmen: Rücken rund machen, Kinn Richtung Brust (Katze).', 'Einatmen: Brust nach vorne, Rücken sanft durchhängen lassen, Blick leicht nach vorne (Kuh).'], effect: 'Mobilisiert die ganze Wirbelsäule.', cue: 'Langsam und im angenehmen Bereich, Bewegung mit der Atmung verbinden.' },
  'Kindhaltung': { steps: ['Kniestand, Gesäß zu den Fersen sinken lassen.', 'Oberkörper nach vorne ablegen, Arme lang nach vorne.', 'Ruhig in den Rücken atmen.'], effect: 'Entspannt Rücken und Schultern, dehnt den unteren Rücken.', cue: 'Bei Kniebeschwerden ein Kissen zwischen Gesäß und Fersen legen.' },

  // Laufen
  'Einlaufen': { steps: ['Sehr locker beginnen – du solltest dich problemlos unterhalten können.', 'Nach einigen Minuten das Tempo leicht anheben.', 'Die letzten Minuten etwas zügiger, aber deutlich unter dem Wettkampftempo.'], effect: 'Erhöht Körpertemperatur, Durchblutung und Puls schrittweise und bereitet Muskeln und Sehnen vor.', cue: 'Nicht zu schnell – das Einlaufen soll vorbereiten, nicht ermüden.' },
  'Auslaufen': { steps: ['Direkt nach dem Training oder Rennen sehr locker traben oder zügig gehen.', 'Puls und Atmung langsam herunterkommen lassen.', 'Danach trockene Kleidung anziehen und trinken.'], effect: 'Hilft beim Übergang in die Erholung und lockert die Beine.', cue: 'Nach sehr harten Rennen reicht Gehen völlig.' },
  'Locker laufen': { steps: ['Langsam loslaufen – du solltest dich dabei noch unterhalten können.', 'Kurze Schritte, aufrecht, Arme locker mitschwingen.', 'Wird es zu anstrengend, langsamer laufen statt stehen zu bleiben.'], effect: 'Ausdauer, Herz und Kreislauf; Sehnen und Knochen gewöhnen sich Schritt für Schritt an die Belastung.', cue: 'Langsamer ist richtig. Wer am Ende noch reden kann, hat alles richtig gemacht.' },
  'Locker gehen': { steps: ['Zügig, aber entspannt gehen.', 'Arme locker mitschwingen, Schultern unten.'], effect: 'Sanfter Einstieg bzw. Ausklang ohne Belastung.', cue: 'Bewusst ruhig atmen.' },
  'Beinpendel vor/zurück': { steps: ['Seitlich an eine Wand stellen und mit einer Hand abstützen.', 'Das äußere Bein locker nach vorne und hinten schwingen, Bewegung langsam größer werden lassen.', 'Seite wechseln.'], effect: 'Mobilisiert Hüftbeuger und hintere Oberschenkel dynamisch.', cue: 'Oberkörper aufrecht, nicht aus dem Rücken schwingen.' },
  'Beinpendel seitlich': { steps: ['Mit dem Gesicht zur Wand stellen und beide Hände abstützen.', 'Ein Bein vor dem Standbein seitlich hin und her schwingen.', 'Seite wechseln.'], effect: 'Mobilisiert Adduktoren und seitliche Hüftmuskeln.', cue: 'Becken möglichst ruhig halten.' },
  'Ausfallschritt mit Rotation': { steps: ['Großer Schritt nach vorne in den Ausfallschritt.', 'Oberkörper zur Seite des vorderen Beins drehen, Arme mitnehmen.', 'Zurück zur Mitte, aufrichten, Seite wechseln.'], effect: 'Öffnet Hüftbeuger, mobilisiert Brustwirbelsäule und aktiviert die Beine.', cue: 'Vorderes Knie bleibt über dem Fuß.' },
  'Hüftöffner im Gehen': { steps: ['Langsam gehen. Ein Knie vor dem Körper anheben.', 'Knie im Bogen nach außen öffnen und das Bein absetzen.', 'Mit dem anderen Bein wiederholen.'], effect: 'Mobilisiert das Hüftgelenk in alle Richtungen.', cue: 'Aufrecht bleiben, bei Bedarf an einer Wand festhalten.' },
  'Wadenpumpe': { steps: ['Hüftbreit stehen.', 'Zügig auf die Fußballen hochdrücken und wieder absenken.', '15–20 Wiederholungen.'], effect: 'Aktiviert Waden und Achillessehne vor dem Lauf.', cue: 'Locker und federnd, nicht verkrampfen.' },
  'Steigerungsläufe': { steps: ['Aus dem lockeren Traben über 60–100 m allmählich beschleunigen.', 'Die letzten 20 m zügig, aber locker laufen – nicht sprinten.', 'Austraben und zurückgehen, dann den nächsten.'], effect: 'Bereitet Nerven und Muskeln auf schnelles Laufen vor, ohne zu ermüden.', cue: 'Locker bleiben, Schultern unten, aufrechte Haltung.' },
  'Fußgelenksarbeit': { steps: ['Mit kleinen, schnellen Schritten vorwärts bewegen.', 'Abwechselnd über den Fußballen abrollen, die Ferse hebt nur leicht ab, das Knie bleibt fast gestreckt.', '2 × 20 m, zurück locker gehen.'], effect: 'Kräftigt Fuß und Wade, verbessert den Fußaufsatz.', cue: 'Locker in den Sprunggelenken, aufrechter Oberkörper.' },
  'Skippings': { steps: ['Kleine, sehr schnelle Schritte auf dem Fußballen.', 'Knie nur leicht anheben, Arme schnell mitschwingen.', '2 × 20 m, zurück locker gehen.'], effect: 'Schnelligkeit und Koordination, kurzer Bodenkontakt.', cue: 'Frequenz vor Höhe. Aufrecht bleiben.' },
  'Kniehebelauf': { steps: ['Abwechselnd die Knie bis etwa Hüfthöhe anheben.', 'Auf dem Fußballen landen, aktiver Armeinsatz (Gegenarm nach vorne).', '2 × 20 m, zurück locker gehen.'], effect: 'Kräftigt Hüftbeuger, verbessert Kniehub und Haltung.', cue: 'Nicht nach hinten lehnen, Hüfte gestreckt.' },
  'Anfersen': { steps: ['Locker laufen und die Fersen abwechselnd Richtung Gesäß führen.', 'Knie zeigen nach unten, Oberschenkel bleiben fast senkrecht.', '2 × 20 m, zurück locker gehen.'], effect: 'Verbessert den Rückschwung des Beins und dehnt den vorderen Oberschenkel dynamisch.', cue: 'Schnell und locker, nicht nach vorne beugen.' },
  'Hopserlauf': { steps: ['Hüpfend vorwärts: Absprung von einem Bein, Knie des anderen Beins hoch.', 'Gegenarm kräftig nach oben schwingen.', '2 × 20–30 m, zurück locker gehen.'], effect: 'Sprungkraft, Koordination und Rhythmus.', cue: 'Weich landen. Bei Waden- oder Fußbeschwerden auslassen.' },
  'Seitgalopp': { steps: ['Seitlich zur Laufrichtung stellen.', 'Mit federnden Seitwärtssprüngen vorwärts: Füße kurz zusammen, dann wieder auseinander.', '2 × 20 m, einmal mit jeder Seite vorne.'], effect: 'Seitliche Hüftmuskulatur und Koordination.', cue: 'Füße nicht überkreuzen, auf den Fußballen bleiben.' },
  'Überkreuzlauf': { steps: ['Seitwärts laufen, das hintere Bein abwechselnd vor und hinter dem vorderen Bein kreuzen.', 'Hüfte dreht mit, Schultern bleiben möglichst ruhig.', '2 × 20 m, einmal mit jeder Seite vorne.'], effect: 'Hüftbeweglichkeit, Koordination und Rumpfrotation.', cue: 'Langsam beginnen, erst dann schneller werden.' },
  'Hintere Oberschenkel': { steps: ['Ein Bein leicht nach vorne stellen, Ferse am Boden, Zehen hoch.', 'Hüfte nach hinten schieben, Rücken lang, Hände auf dem hinteren Oberschenkel.', 'Halten, bis es hinten im vorderen Oberschenkel zieht; dann wechseln.'], effect: 'Dehnt die hintere Oberschenkelmuskulatur.', cue: 'Rücken bleibt lang – nicht mit rundem Rücken nach unten greifen.' },

  // Mobility
  '90/90-Hüftrotation': { steps: ['Auf den Boden setzen, beide Knie etwa 90 Grad gebeugt: ein Bein vorne, eines seitlich hinten.', 'Oberkörper aufrecht, dann langsam über das vordere Schienbein neigen.', 'Knie zur anderen Seite kippen und wechseln.'], effect: 'Innen- und Außenrotation der Hüfte – Basis für einen freien Laufschritt.', cue: 'Mit den Händen hinter dem Körper abstützen, wenn nötig.' },
  'Tauben-Dehnung': { steps: ['Aus dem Vierfüßlerstand ein Knie nach vorne hinter die Hand bringen, Schienbein schräg.', 'Hinteres Bein lang nach hinten strecken.', 'Aufrecht halten oder Oberkörper langsam nach vorne ablegen; dann wechseln.'], effect: 'Dehnt Gesäß und Hüftaußenrotatoren intensiv.', cue: 'Bei Kniedruck stattdessen Figure-4 im Sitzen.' },
  'Tiefe Hocke halten': { steps: ['Füße etwas breiter als hüftbreit, Zehen leicht nach außen.', 'Tief in die Hocke sinken, Fersen am Boden, Ellenbogen drücken die Knie sanft nach außen.', 'Halten und ruhig atmen.'], effect: 'Mobilisiert Hüfte, Sprunggelenke und unteren Rücken.', cue: 'Fersen heben ab? Etwas Festes zum Festhalten nutzen oder Fersen leicht erhöhen.' },
  "World's Greatest Stretch": { steps: ['Großer Ausfallschritt, beide Hände innen neben dem vorderen Fuß aufstützen.', 'Inneren Arm Richtung Decke drehen, Blick folgt der Hand.', 'Zurück, Seite wechseln.'], effect: 'Hüftbeuger, Hüfte, Brustwirbelsäule und hintere Oberschenkel in einer Bewegung.', cue: 'Hinteres Knie darf am Boden abgelegt werden.' },
  'Open Book': { steps: ['Seitlage, Knie 90 Grad angewinkelt, Arme lang nach vorne, Handflächen aufeinander.', 'Oberen Arm im Bogen zur anderen Seite öffnen, Blick folgt.', 'Langsam zurück; Seite wechseln.'], effect: 'Rotation der Brustwirbelsäule, öffnet Brust und Schultern.', cue: 'Knie bleiben aufeinander liegen.' },
  'Knie zur Brust': { steps: ['Rückenlage.', 'Beide Knie zur Brust ziehen und mit den Händen umfassen.', 'Halten oder sanft hin und her schaukeln.'], effect: 'Entlastet und dehnt den unteren Rücken.', cue: 'Nacken entspannt am Boden lassen.' },
  'Schulterkreisen mit Band': { steps: ['Band breit vor der Hüfte greifen, Arme gestreckt.', 'Arme gestreckt über den Kopf und – wenn möglich – hinter den Körper führen.', 'Langsam zurück.'], effect: 'Schulterbeweglichkeit und Öffnung der Brust.', cue: 'Griff so breit wählen, dass es ohne Zwang geht. Leichtestes Band nehmen.' },
  'Kinn-Rückzug': { steps: ['Aufrecht sitzen oder stehen, Blick geradeaus.', 'Kinn waagerecht nach hinten schieben (Doppelkinn).', 'Kurz halten, lösen.'], effect: 'Kräftigt die tiefen Nackenbeuger, wirkt dem vorgeschobenen Kopf am Bildschirm entgegen.', cue: 'Kopf nicht neigen, nur waagerecht zurück.' },
  'Nackendehnung seitlich': { steps: ['Aufrecht sitzen, eine Hand unter das Gesäß oder an die Stuhlkante.', 'Kopf zur anderen Seite neigen, die freie Hand liegt locker am Kopf.', 'Halten, Seite wechseln.'], effect: 'Dehnt die seitliche Nackenmuskulatur.', cue: 'Nicht am Kopf ziehen; das Gewicht der Hand reicht.' },
  'Knie-zur-Wand': { steps: ['Vor eine Wand stellen, vorderer Fuß eine Handbreit vor der Wand.', 'Knie Richtung Wand schieben, die Ferse bleibt am Boden.', 'Zurück; Abstand vergrößern, wenn es leicht geht.'], effect: 'Beweglichkeit des Sprunggelenks – wichtig für Kniebeuge und Laufschritt.', cue: 'Knie zeigt über die mittleren Zehen.' },
  'Fußgelenkkreisen': { steps: ['Auf einem Bein stehen und an einer Wand abstützen (oder sitzen).', 'Den freien Fuß langsam große Kreise beschreiben lassen.', 'Richtung und Seite wechseln.'], effect: 'Mobilisiert das Sprunggelenk.', cue: 'Langsam und mit vollem Bewegungsumfang.' },

  // Hüfte aktiv & stark
  'Hüft-CARs': { steps: ['Vierfüßlerstand: Hände unter den Schultern, Knie unter der Hüfte, Bauch leicht fest.', 'Ein Knie langsam nach vorne Richtung Brust ziehen, dann seitlich nach außen anheben.', 'Den Kreis fortsetzen: Knie nach hinten führen, Bein kurz nach hinten strecken und zurück unter die Hüfte bringen.', '3 langsame Kreise vorwärts, 3 rückwärts, dann Seite wechseln.'], effect: 'Bewegt das Hüftgelenk aktiv durch seinen ganzen Bewegungsumfang – beugen, abspreizen, drehen, strecken. CARs steht für „Controlled Articular Rotations“, also kontrollierte Gelenkkreise.', cue: 'Nur das Bein bewegt sich – Becken und Rücken bleiben ruhig und kippen nicht zur Seite. Lieber ein kleiner, langsamer Kreis als ein großer mit Ausweichbewegung.' },
  'Beinheben im Sitzen': { steps: ['Aufrecht sitzen, Beine lang ausgestreckt, Hände neben oder leicht hinter der Hüfte aufstützen.', 'Ein Bein gestreckt anheben, Zehen zeigen nach oben. 1–2 Sekunden oben halten.', 'Langsam absenken und wiederholen, dann Seite wechseln.'], effect: 'Kräftigt die Hüftbeuger dort, wo sie am kürzesten sind – das unterstützt einen aktiven Kniehub beim Laufen.', cue: 'Aufrecht bleiben, nicht nach hinten fallen lassen. Anfangs hebt das Bein oft nur wenige Zentimeter – das ist normal. Bei rundem Rücken auf ein Kissen setzen.' },
  'Beinüberheben im Sitzen': { steps: ['Aufrecht sitzen, Beine lang und leicht geöffnet, Hände hinter der Hüfte aufstützen. Kettlebell zwischen die Unterschenkel stellen.', 'Ein Bein gestreckt anheben und im Bogen über die Kugel zur anderen Seite führen, kurz absetzen.', 'Auf demselben Weg zurück. Erst alle Wiederholungen mit einem Bein, dann wechseln.'], effect: 'Hüftbeuger und seitliche Hüftmuskeln arbeiten im großen Bewegungsumfang – aktive Beweglichkeit statt nur Dehnen.', cue: 'Bein bleibt gestreckt, Oberkörper aufrecht. Zu hoch? Ein niedrigeres Hindernis nehmen, z. B. eine liegende Flasche oder einen Schuh.' },
  'Knieheben im Stand': { steps: ['Aufrecht stehen, Hände an die Hüfte. Kettlebell außen neben einen Fuß stellen.', 'Gewicht auf das andere Bein verlagern. Das Knie neben der Kugel über Hüfthöhe anheben und den Fuß im Bogen über die Kugel nach außen führen, kurz abtippen.', 'Auf demselben Weg zurück. Nach allen Wiederholungen Seite wechseln.'], effect: 'Kräftigt Hüftbeuger und seitliche Hüftmuskeln des freien Beins und fordert zugleich die Stabilität des Standbeins – nah am Laufschritt.', cue: 'Oberkörper aufrecht, Becken waagerecht – nicht nach hinten lehnen. Zum Einstieg an einer Wand festhalten; schwerer wird es ohne Abtippen.' },
  '90/90 mit Aufrichten': { steps: ['In den 90/90-Sitz: vorderes und hinteres Knie etwa 90 Grad gebeugt, Oberkörper aufrecht.', 'Gesäß anheben und die Hüfte nach vorne strecken, bis du auf beiden Knien hochkommst. Gesäß kurz fest anspannen.', 'Langsam zurück in den Sitz. Knie zur anderen Seite kippen und dort wiederholen.'], effect: 'Streckt die Hüfte aus der Drehung heraus und kräftigt Gesäß und Hüftrotatoren in der Endposition – die Steigerung der 90/90-Hüftrotation.', cue: 'Matte oder Kissen unter die Knie. Anfangs mit den Händen am Boden helfen; nicht ins Hohlkreuz drücken.' },
  'Copenhagen Hip Dips': { steps: ['Seitstütz auf dem Unterarm neben einem Sofa, einer Bank oder einem stabilen Stuhl, Ellenbogen unter der Schulter.', 'Einstieg: das obere Bein mit dem Knie auf die Kante legen (kurzer Hebel). Steigerung: nur Unterschenkel und Fuß auflegen (langer Hebel). Das untere Bein hängt locker darunter.', 'Becken anheben, bis der Körper eine Linie bildet, dann kontrolliert Richtung Boden absenken und wieder hochdrücken.', 'Alle Wiederholungen auf einer Seite, dann wechseln.'], effect: 'Kräftigt die Adduktoren (Innenseite der Oberschenkel) und den seitlichen Rumpf. Die Kopenhagener Adduktorenübung ist bei Fußballern gut untersucht und senkt dort Leistenprobleme.', cue: 'Krafttraining, keine Dehnung: mit der Knie-Variante und 2 × 5 beginnen und erst steigern, wenn es am Folgetag nicht zieht. Becken nicht nach hinten abknicken lassen. Bei Schmerz in der Leiste abbrechen.' },

  // Sprunggelenk & Fuß
  'Soleus-Dehnung': { steps: ['Schrittstellung vor einer Wand, Hände an der Wand, hinterer Fuß zeigt gerade nach vorne.', 'Das hintere Knie beugen und Richtung Boden sinken lassen – die Ferse bleibt am Boden.', 'Halten, bis es tief unten in der Wade zieht, dann Seite wechseln.'], effect: 'Dehnt den tiefen Wadenmuskel (Soleus), der beim Laufen einen großen Teil der Last trägt. Ergänzt die Wadendehnung mit gestrecktem Bein.', cue: 'Kürzerer Schritt als bei der normalen Wadendehnung. Ferse unten lassen, Knie zeigt über die mittleren Zehen.' },
  'Sprunggelenk mit Kettlebell': { steps: ['Halber Kniestand, vorderer Fuß flach am Boden.', 'Kettlebell mit beiden Händen auf den vorderen Oberschenkel direkt über dem Knie legen.', 'Das Knie langsam weit über die Zehen nach vorne schieben, die Ferse bleibt am Boden. 2 Sekunden halten, zurück.'], effect: 'Verbessert die Beugung im Sprunggelenk (Knie über den Fuß) – das Zusatzgewicht drückt sanft tiefer als bei Knie-zur-Wand. Wichtig für Laufschritt und Kniebeuge.', cue: 'Knie zeigt über die mittleren Zehen, nicht nach innen. Ohne Kettlebell: Unterarme aufs Knie legen und das Gewicht nach vorne verlagern.' },
  'Schienbeinheben': { steps: ['Mit dem Rücken an eine Wand lehnen, Füße etwa eine Fußlänge vor der Wand, Beine gestreckt.', 'Zehen und Vorfuß so weit wie möglich Richtung Schienbein ziehen, die Fersen bleiben am Boden.', 'Kurz halten, langsam absenken – nicht ganz ablegen – und wiederholen.'], effect: 'Kräftigt den vorderen Schienbeinmuskel – den Gegenspieler der Wade, der den Fuß beim Aufsetzen abbremst.', cue: 'Je weiter die Füße von der Wand, desto schwerer. Brennen vorne am Schienbein ist normal.' },
  'Einbeinstand': { steps: ['Auf einem Bein stehen, Knie leicht gebeugt, Hände an der Hüfte.', 'Gewicht auf Ferse, Großzehen- und Kleinzehenballen verteilen, das Fußgewölbe aktiv halten.', 'Ruhig halten, dann Seite wechseln. Steigerung: Augen zu, auf einem Kissen stehen oder den Kopf langsam drehen.'], effect: 'Trainiert Gleichgewicht und die Reaktion der Fuß- und Sprunggelenkmuskeln. Gleichgewichtstraining ist gut belegt gegen erneutes Umknicken.', cue: 'In der Nähe einer Wand üben. Wackeln ist erwünscht – genau das ist das Training. Becken bleibt waagerecht.' }
});

/* Laufumfang: Wochen-km im Verhältnis zum Schnitt der 4 abgeschlossenen Wochen davor (Acute:Chronic Workload Ratio).
   0,8–1,0 × Schnitt = Erhalt, 1,0–1,3 × = Aufbau (verbreiteter „Sweet Spot“ 0,8–1,3; das Video nannte 1,4).
   Einzelne Läufe: höchstens 10 % länger als der längste der letzten 30 Tage (BJSM 2025: Sprünge über 10 % gegenüber
   dem längsten Lauf der letzten 30 Tage gingen mit deutlich mehr Verletzungen einher; Wochen-Verhältnisse kaum). */
const LOAD = { keep: 0.8, build: 1.0, cap: 1.3, longPlus: 0.1 };
const LOAD_INTRO = 'Zuerst der lange Lauf: höchstens 10 % länger als dein längster Lauf der letzten 30 Tage – das ist die am besten belegte Regel. Für die Woche: 0,8–1,0 × Schnitt der letzten 4 Wochen hält dein Niveau, 1,0–1,3 × baut auf.';
const LOAD_NOTE = 'Richtwerte, keine Garantie gegen Verletzungen. Die Wochen-Rechnung stammt aus dem Teamsport und ist wissenschaftlich umstritten. In der bisher größten Läuferstudie (BJSM 2025, über 5.000 Läufer) hing das Risiko vor allem an einzelnen Läufen, die deutlich länger waren als der längste der letzten 30 Tage – deshalb zeigt die App beides.';

/* Laufen: Warm-up und Cooldown. Schritt: [Dauer, Übung, Hinweis] – Übungen mit Anleitung sind antippbar. */
const RUN_GUIDE = {
  race: [
    { id: '5k', label: '5 km', intro: 'Kurz und schnell: gründlich aufwärmen, damit der erste Kilometer nicht zum Aufwärmen wird. Etwa 25 Minuten, 5–10 Minuten vor dem Start fertig sein.',
      warmup: [['10–15 Min.', 'Einlaufen', 'sehr locker beginnen, zum Ende etwas zügiger'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10–15 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10–15 ×'], ['1 Min.', 'Ausfallschritt mit Rotation', 'je Seite 5 ×'], ['2 × 20 m', 'Skippings', ''], ['2 × 20 m', 'Kniehebelauf', ''], ['2 × 20 m', 'Anfersen', ''], ['4–6 ×', 'Steigerungsläufe', '80–100 m, bis knapp über Renntempo'], ['1 Min.', 'Renntempo antesten', 'kurz im geplanten Tempo, dann locker traben'], ['bis Start', 'Warm halten', 'locker bewegen, Jacke an']],
      cooldown: [['5–10 Min.', 'Auslaufen', 'sehr locker traben oder gehen'], ['45 Sek. je Seite', 'Wadendehnung', ''], ['45 Sek. je Seite', 'Hüftbeuger-Dehnung', ''], ['30 Sek. je Seite', 'Vorderer Oberschenkel', ''], ['30 Sek. je Seite', 'Hintere Oberschenkel', ''], ['30–60 Min.', 'Trinken & Essen', 'Flüssigkeit und etwas Kohlenhydrate mit Eiweiß']] },
    { id: '10k', label: '10 km', intro: 'Zügiges Renntempo ab dem Start: etwa 20 Minuten aufwärmen, 5–10 Minuten vor dem Start fertig sein.',
      warmup: [['10–12 Min.', 'Einlaufen', 'locker, zum Ende etwas zügiger'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10–15 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10–15 ×'], ['1 Min.', 'Ausfallschritt mit Rotation', 'je Seite 5 ×'], ['2 × 20 m', 'Skippings', ''], ['2 × 20 m', 'Kniehebelauf', ''], ['3–4 ×', 'Steigerungsläufe', '80 m, bis etwa Renntempo'], ['bis Start', 'Warm halten', 'locker bewegen, Jacke an']],
      cooldown: [['5–10 Min.', 'Auslaufen', 'sehr locker traben oder gehen'], ['45 Sek. je Seite', 'Wadendehnung', ''], ['45 Sek. je Seite', 'Hüftbeuger-Dehnung', ''], ['30 Sek. je Seite', 'Vorderer Oberschenkel', ''], ['30 Sek. je Seite', 'Hintere Oberschenkel', ''], ['30–60 Min.', 'Trinken & Essen', '']] },
    { id: 'hm', label: 'HM', intro: 'Halbmarathon: kürzer aufwärmen, Energie sparen – etwa 15 Minuten. Die ersten 1–2 Kilometer bewusst etwas langsamer – sie gehören zum Aufwärmen.',
      warmup: [['5–10 Min.', 'Einlaufen', 'sehr locker'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10 ×'], ['1 Min.', 'Hüftöffner im Gehen', 'je Seite 5 ×'], ['2–3 ×', 'Steigerungsläufe', '60–80 m, locker'], ['bis Start', 'Warm halten', 'im Startblock locker bewegen']],
      cooldown: [['5–10 Min.', 'Locker gehen', 'nicht abrupt stehen bleiben'], ['30–60 Min.', 'Trinken & Essen', 'früh mit dem Auffüllen beginnen'], ['30 Sek. je Seite', 'Wadendehnung', 'nur sanft'], ['30 Sek. je Seite', 'Hüftbeuger-Dehnung', 'nur sanft'], ['30 Sek. je Seite', 'Vorderer Oberschenkel', 'nur sanft']] },
    { id: 'marathon', label: 'Marathon', intro: 'Minimal aufwärmen und Energie sparen: etwa 10 Minuten Mobilisation. Die ersten Kilometer sind das eigentliche Aufwärmen.',
      warmup: [['5 Min.', 'Locker gehen', 'oder sehr locker traben'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10 ×'], ['1 Min.', 'Hüftkreisen', ''], ['30 Sek.', 'Wadenpumpe', '15 ×'], ['optional', 'Steigerungsläufe', '1–2 × 50 m, ganz locker'], ['bis Start', 'Warm halten', 'Wegwerfjacke oder Folie bis kurz vor dem Start']],
      cooldown: [['10–15 Min.', 'Locker gehen', 'in Bewegung bleiben'], ['sofort', 'Trinken & Essen', 'Flüssigkeit, Salz, Kohlenhydrate'], ['', 'Trockene Kleidung', 'schnell umziehen, warm halten'], ['1 Min.', 'Hüftkreisen', 'nur sanft lockern – heute kein intensives Dehnen'], ['10 Min.', 'Beine hochlegen', 'später am Tag'], ['Folgetage', 'Aktive Erholung', 'Gehen oder lockeres Radfahren statt Laufen']] }
  ],
  training: [
    { id: 'interval', label: 'Intervall', intro: 'Harte Abschnitte brauchen ein vollständiges Aufwärmen: etwa 25 Minuten inklusive Lauf-ABC.',
      warmup: [['15 Min.', 'Einlaufen', 'locker, Gesprächstempo'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10–15 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10–15 ×'], ['1 Min.', 'Ausfallschritt mit Rotation', 'je Seite 5 ×'], ['2 × 20 m', 'Skippings', ''], ['2 × 20 m', 'Kniehebelauf', ''], ['2 × 20 m', 'Anfersen', ''], ['3–4 ×', 'Steigerungsläufe', '80 m']],
      cooldown: [['10 Min.', 'Auslaufen', 'sehr locker'], ['45 Sek. je Seite', 'Wadendehnung', ''], ['45 Sek. je Seite', 'Hüftbeuger-Dehnung', ''], ['30 Sek. je Seite', 'Vorderer Oberschenkel', ''], ['30 Sek. je Seite', 'Hintere Oberschenkel', '']] },
    { id: 'speed', label: 'Speed', intro: 'Kurze, sehr schnelle Abschnitte: Nerven und Sehnen müssen besonders gut vorbereitet sein. Etwa 25–30 Minuten mit ausführlichem Lauf-ABC.',
      warmup: [['15 Min.', 'Einlaufen', 'locker'], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10–15 ×'], ['1 Min.', 'Hüftöffner im Gehen', 'je Seite 5 ×'], ['2 × 20 m', 'Fußgelenksarbeit', ''], ['2 × 20 m', 'Skippings', ''], ['2 × 20 m', 'Kniehebelauf', ''], ['2 × 20 m', 'Anfersen', ''], ['2 × 20 m', 'Hopserlauf', ''], ['4–6 ×', 'Steigerungsläufe', '80–100 m, die letzten deutlich schnell']],
      cooldown: [['10 Min.', 'Auslaufen', 'sehr locker'], ['45 Sek. je Seite', 'Wadendehnung', ''], ['45 Sek. je Seite', 'Hüftbeuger-Dehnung', ''], ['30 Sek. je Seite', 'Hintere Oberschenkel', ''], ['30 Sek. je Seite', 'Vorderer Oberschenkel', '']] },
    { id: 'long', label: 'Longrun', intro: 'Kein großes Aufwärmprogramm nötig: kurz mobilisieren und die ersten 10 Minuten sehr locker laufen. Nach dem Lauf bewusst erholen.',
      warmup: [['3–5 Min.', 'Locker gehen', ''], ['1 Min.', 'Beinpendel vor/zurück', 'je Bein 10 ×'], ['1 Min.', 'Beinpendel seitlich', 'je Bein 10 ×'], ['1 Min.', 'Hüftkreisen', ''], ['10 Min.', 'Einlaufen', 'Teil des Longruns – bewusst langsamer als das Zieltempo']],
      cooldown: [['5–10 Min.', 'Locker gehen', ''], ['sofort', 'Trinken & Essen', 'Kohlenhydrate und Eiweiß'], ['45 Sek. je Seite', 'Wadendehnung', 'sanft'], ['45 Sek. je Seite', 'Hüftbeuger-Dehnung', 'sanft'], ['30 Sek. je Seite', 'Vorderer Oberschenkel', 'sanft'], ['30 Sek. je Seite', 'Figure-4 Gesäß', 'zu Hause auf einem Stuhl']] }
  ],
  abc: {
    intro: 'Lauf-ABC verbessert Koordination, Fußaufsatz und Kniehub. 1–2 × pro Woche nach dem Einlaufen, je Übung 2 × 20–30 m, zurück locker gehen.',
    drills: [['2 × 20 m', 'Fußgelenksarbeit', 'Fuß und Wade'], ['2 × 20 m', 'Skippings', 'Frequenz'], ['2 × 20 m', 'Kniehebelauf', 'Kniehub und Haltung'], ['2 × 20 m', 'Anfersen', 'Rückschwung'], ['2 × 20–30 m', 'Hopserlauf', 'Sprungkraft'], ['2 × 20 m', 'Seitgalopp', 'seitliche Hüfte'], ['2 × 20 m', 'Überkreuzlauf', 'Hüftbeweglichkeit'], ['3–4 ×', 'Steigerungsläufe', 'zum Abschluss']]
  }
};
/* Rennformate ohne feste Distanz (Laufen → Plan → Rennen). Ziel ist die Strecke bzw. das Level, daraus rechnet die App.
   Wings for Life World Run: Das Catcher Car startet 30 Min. nach den Läufern mit 14 km/h und wird alle 30 Min. schneller,
   ab 4:30 h bleibt es bei 34 km/h (Regeln seit 2019, Stufen ab 3:00 h seit 2021).
   Pace Race: Runden über 1.000 m mit Zeitlimit; Level 1–5 fest, danach je Runde 10 Sek. schneller bis Level 28 (2:10).
   Die nächste Runde startet 60 Sek. nach dem Zeitlimit der vorigen. */
const WFL = { head: 1800, every: 1800, kmh: [14, 15, 16, 17, 18, 22, 26, 30, 34] };
const PACE_RACE = { cut: [480, 420, 390, 375, 360], step: 10, rest: 60, levels: 28 };

/* Laufen → Plan: Vorbereitung auf A-Rennen. B-Rennen laufen im Plan mit, ohne eigenen Block.
   phases: Wochen je Phase, die Rennwoche zählt zum Tapering. longPeak/weekPeak: Ziel-Longrun bzw. Wochen-km am Ende der
   spezifischen Phase für Hobbyläufer mit 3–4 Läufen pro Woche. taper/recover: Anteil der Spitzenwerte je Woche
   (long 0 = kein Longrun). Steigerung höchstens 10 % pro Woche, nach drei Aufbauwochen eine Entlastungswoche. */
const SEASON = {
  dist: {
    '5k': { label: '5 km', km: 5, phases: { base: 2, build: 3, spec: 2, taper: 1 }, minWeeks: 6, longPeak: 14, weekPeak: 30,
      taper: [{ wk: 0.7 }], recover: [{ wk: 0.7, long: 0.7 }] },
    '10k': { label: '10 km', km: 10, phases: { base: 3, build: 3, spec: 3, taper: 1 }, minWeeks: 6, longPeak: 16, weekPeak: 35,
      taper: [{ wk: 0.7 }], recover: [{ wk: 0.7, long: 0.7 }] },
    hm: { label: 'Halbmarathon', km: 21.0975, phases: { base: 4, build: 4, spec: 3, taper: 2 }, minWeeks: 8, longPeak: 20, weekPeak: 45,
      taper: [{ wk: 0.8, long: 0.7 }, { wk: 0.6 }], recover: [{ wk: 0.5, long: 0.4 }, { wk: 0.75, long: 0.65 }] },
    marathon: { label: 'Marathon', km: 42.195, phases: { base: 6, build: 6, spec: 4, taper: 3 }, minWeeks: 12, longPeak: 30, weekPeak: 55,
      taper: [{ wk: 0.8, long: 0.7 }, { wk: 0.65, long: 0.5 }, { wk: 0.45 }], recover: [{ wk: 0.3, long: 0 }, { wk: 0.5, long: 0.4 }, { wk: 0.7, long: 0.6 }] }
  },
  // Spitzenwerte nach Zielzeit (upTo in Sekunden, von schnell nach langsam). Ohne Zielzeit gelten longPeak/weekPeak oben.
  levels: {
    '5k': [{ upTo: 1260, long: 15, week: 45 }, { upTo: 1500, long: 14, week: 35 }, { upTo: 1800, long: 12, week: 28 }, { upTo: Infinity, long: 10, week: 20 }],
    '10k': [{ upTo: 2520, long: 18, week: 50 }, { upTo: 3000, long: 16, week: 40 }, { upTo: 3600, long: 14, week: 32 }, { upTo: Infinity, long: 12, week: 25 }],
    hm: [{ upTo: 6000, long: 22, week: 60 }, { upTo: 6900, long: 21, week: 52 }, { upTo: 8100, long: 20, week: 45 }, { upTo: Infinity, long: 18, week: 35 }],
    marathon: [{ upTo: 12600, long: 32, week: 70 }, { upTo: 14400, long: 32, week: 62 }, { upTo: 17100, long: 30, week: 55 }, { upTo: Infinity, long: 28, week: 45 }]
  },
  // Obergrenze je Phase als Anteil der Spitzenwerte; Basis = zwischen den Blöcken bzw. vor dem ersten
  cap: { basis: 0.6, base: 0.7, build: 0.85, spec: 1 },
  grow: 0.1, cutLong: 0.8, cutWeek: 0.75, cutEvery: 3,
  phase: {
    basis: ['Basis', 'Locker laufen und das Niveau halten. Der nächste Block startet später.'],
    base: ['Grundlage', 'Umfang aufbauen, fast alles locker in Zone 2. Kurze, schnelle Reize halten die Beine flink.'],
    build: ['Aufbau', 'Schwelle und längere Intervalle kommen dazu, der Longrun wächst weiter.'],
    spec: ['Spezifisch', 'Renntempo üben und Verpflegung testen. Die längsten Läufe des Blocks.'],
    taper: ['Tapering', 'Umfang runter, kurze Abschnitte im Renntempo bleiben. Frisch an den Start.'],
    recover: ['Erholung', 'Nur locker laufen, kein Tempo. Bei Beschwerden lieber Pause.'],
    cut: ['Entlastung', 'Bewusst weniger: Longrun und Qualitätseinheit kürzer, damit der Körper das Training umsetzt.']
  },
  // Qualitätseinheit je Phase und Distanz; [ungerade KW, gerade KW] – Intervall und Speed im Wechsel
  key: {
    basis: { all: ['Intervall: 6 × 400 m zügig, 400 m Trabpause', 'Speed: 8 × 100 m Steigerung, Gehpause'] },
    base: { all: ['Intervall: 5–6 × 800 m zügig, 2 Min. Trabpause', 'Speed: 10 × 200 m schnell, 200 m Trabpause'] },
    build: {
      '5k': ['6 × 800 m im 5-km-Tempo, 2 Min. Trabpause', '3 × 8 Min. Schwelle, 2 Min. Trabpause'],
      '10k': ['5 × 1 km im 10-km-Tempo, 90 Sek. Trabpause', '3 × 10 Min. Schwelle, 2 Min. Trabpause'],
      hm: ['3 × 10 Min. Schwelle, 2 Min. Trabpause', '2 × 15 Min. Schwelle, 3 Min. Trabpause'],
      marathon: ['3 × 10 Min. Schwelle, 2 Min. Trabpause', '2 × 15 Min. Schwelle, 3 Min. Trabpause'],
      pace: ['6 × 1 km steigernd bis ins Level-Tempo, 60 Sek. Stehpause', '3 × 10 Min. Schwelle, 2 Min. Trabpause']
    },
    spec: {
      '5k': ['5 × 1 km im 5-km-Tempo, 2 Min. Trabpause', '12 × 400 m etwas schneller als 5-km-Tempo'],
      '10k': ['3 × 3 km im 10-km-Tempo, 3 Min. Trabpause', '6 × 1,5 km im 10-km-Tempo, 90 Sek. Trabpause'],
      hm: ['2 × 5 km im HM-Tempo, 3 Min. Trabpause', '3 × 3 km im HM-Tempo, 2 Min. Trabpause'],
      marathon: ['2 × 15 Min. Schwelle', '8 km im Marathontempo nach 3 km Einlaufen'],
      pace: ['Probe: 8–10 × 1 km, jeder etwas schneller, die letzten 3 im Level-Tempo, 60 Sek. Stehpause', '5 × 1 km im Level-Tempo, 60 Sek. Stehpause']
    },
    taper: { all: ['3–4 × 1 km im Renntempo, sonst locker', '3–4 × 1 km im Renntempo, sonst locker'], pace: ['3–4 × 1 km im Level-Tempo, 60 Sek. Stehpause, sonst locker', '3–4 × 1 km im Level-Tempo, 60 Sek. Stehpause, sonst locker'] },
    recover: { all: ['keine – nur locker', 'keine – nur locker'] }
  },
  // Hinweis zum Longrun je Phase
  long: {
    basis: 'locker in Zone 2',
    base: 'komplett locker in Zone 2',
    build: 'locker, die letzten 10 Min. zügig',
    spec: { '5k': 'locker, mit 4 × 1 Min. zügig am Ende', '10k': 'locker, die letzten 3 km im 10-km-Tempo', hm: 'die letzten 5–8 km im HM-Tempo, Verpflegung wie im Rennen', marathon: '2 × 6–8 km im Marathontempo, Gels wie im Rennen', pace: 'locker, am Ende 3 × 1 km steigernd bis ins Level-Tempo, 60 Sek. Stehpause' },
    taper: 'kürzer und locker',
    recover: 'locker, höchstens 60–75 Min.'
  },
  bRace: 'B-Rennen: 2–3 lockere Tage davor, das Rennen ersetzt die Qualitätseinheit (ab Halbmarathon auch den Longrun). Danach 2–4 Tage locker.',
  bInTaper: 'Fällt ins Tapering vor dem A-Rennen: nur locker mitlaufen, nicht auf Zeit.',
  bInRecover: 'Fällt in die Erholung nach dem A-Rennen: nur locker mitlaufen, nicht auf Zeit – zwei harte Rennen so kurz hintereinander kosten mehr, als sie bringen.',
  // Erholung nach dem A-Rennen (Faustregeln, je härter das Rennen, desto länger)
  recoverNote: { '5k': 'Nach 5 km: etwa 2–3 Tage aktive Erholung – gehen, locker radeln oder kurz und ruhig laufen.', '10k': 'Nach 10 km: etwa 4–6 Tage locker bewegen, danach den Umfang langsam wieder steigern.', hm: 'Nach dem Halbmarathon: etwa 10–14 Tage ausreichend Ruhe und nur leichtes Training, kein Tempo.', marathon: 'Nach dem Marathon: etwa 3–4 Wochen – Erholung zuerst, dann schrittweise zurück zu Umfang und Tempo.' },
  intro: 'Trag deine A-Rennen mit Datum und Distanz ein – dafür baut der Plan je einen Block aus Grundlage, Aufbau, spezifischer Phase und Tapering. B-Rennen laufen ohne eigenen Block mit. Longrun und Wochen-km rechnet der Plan aus deinem Umfang: höchstens 10 % mehr pro Woche, jede 4. Woche Entlastung.',
  note: 'Richtwerte für Hobbyläufer, kein Ersatz für Trainerin oder Arzt. Schmerzen, die am nächsten Tag noch da sind: Umfang halten statt steigern, bei anhaltenden Beschwerden abklären lassen.'
};

/* Laufen → Plan → Wissen. Texte als Listen, alles wird escaped dargestellt. */
const SEASON_GUIDE = [
  { title: 'Lauf-Einstieg', sub: 'für alle, die mit dem Laufen beginnen', items: [
    'Profil → Trainingswoche → Laufniveau „Einsteiger“: 9 Wochen mit je 3 Einheiten. Woche 1: 8 × (1 Min. laufen, 1:30 Min. gehen). Danach werden die Laufabschnitte länger und die Gehpausen kürzer – Woche 5: 3 × 6 Min., Woche 7: 2 × 13 Min., Woche 9: 30 Min. am Stück.',
    'Jede Einheit beginnt und endet mit 5 Min. gehen. Geführt sagt die App jeden Wechsel an, der Bildschirm bleibt dabei an. Nach drei Einheiten entscheidest du: weiter oder die Woche wiederholen.',
    'Kein Testlauf, keine Tempovorgaben: so langsam, dass du dabei sprechen kannst, und ein Ruhetag zwischen zwei Einheiten. Nach Woche 9 plant die App wie für Läufer – wenn du magst, mit einem lockeren 5-km-Lauf als erstem Ergebnis.'
  ] },
  { title: 'Wie der Plan rechnet', sub: 'Phasen, Entlastung, Grenzen', items: [
    'Rückwärts ab jedem A-Rennen: Tapering (5/10 km 1 Woche, HM 2, Marathon 3), davor die spezifische Phase, Aufbau und Grundlage.',
    'Liegen zwei A-Rennen dicht beieinander, wird der zweite Block vorne gekürzt – zuerst die Grundlage. Wird er kürzer als die Mindestdauer (5/10 km 6 Wochen, HM 8, Marathon 12), bereitet der Plan beide zusammen vor: In den Wochen davor gilt jede zweite Qualitätseinheit schon dem späteren Rennen (⇄ im Saisonplan), Longrun und Wochen-km richten sich nach dem längeren Rennen. Sind beide von derselben Art (z. B. Halbmarathon und Wings for Life über 20 km), zählt die Vorbereitung einfach für beide.',
    'Es bleibt bei einer Qualitätseinheit pro Woche, und die Erholung nach dem ersten Rennen fällt nicht weg. Hat das frühere Rennen selbst nur einen gekürzten Block, bleibt der ihm – dann warnt der Plan, dass für das spätere kein Platz ist.',
    'Zu dicht sind zwei A-Rennen, wenn das zweite in die Erholung nach dem ersten fällt oder das erste ins Tapering vor dem zweiten – etwa Halbmarathon und eine Woche später Marathon. Das zeigen Plan und Rennformular als Warnung: Eines davon als B-Rennen eintragen. Ein B-Rennen in der Erholung oder im Tapering läuft nur locker mit.',
    'Nach jedem A-Rennen folgt Erholung (5/10 km 1 Woche, HM 2, Marathon 3), danach Basis bis zum nächsten Block.',
    'Longrun und Wochen-km wachsen höchstens 10 % pro Woche, ausgehend von deinem Umfang. Nach drei Aufbauwochen folgt eine Entlastungswoche.',
    'Ziel-Longrun und Wochenspitze richten sich nach der Zielzeit: Marathon unter 3:30 → 32 km und 70 km/Woche, unter 4:00 → 32 und 62, unter 4:45 → 30 und 55, sonst 28 und 45. Halbmarathon unter 1:40 → 22 und 60, unter 1:55 → 21 und 52, unter 2:15 → 20 und 45, sonst 18 und 35. 10 km unter 42 Min. → 18 und 50, unter 50 → 16 und 40, unter 60 → 14 und 32, sonst 12 und 25. 5 km unter 21 Min. → 15 und 45, unter 25 → 14 und 35, unter 30 → 12 und 28, sonst 10 und 20.',
    'Ohne Zielzeit gilt die mittlere Stufe (5 km: 14 km Longrun, 10 km: 16, HM: 20, Marathon: 30). Reicht die Zeit mit +10 % pro Woche nicht bis zum Ziel-Longrun, zeigt der Plan früh eine Warnung.',
    'Zeigt der Plan Tempo-Abschnitte (z. B. „im HM-Tempo“), steht bei eingetragener Zielzeit das passende Tempo pro Kilometer dahinter.',
    'Kalender-Export: Wochen als ganztägige Termine (Phase und km), Longruns am Sonntag, Rennen am Renntag. Am besten in einen eigenen Kalender „Laufplan“ importieren – bei einem neuen Export diesen Kalender leeren und neu importieren, da der Plan jede Woche mit deinem echten Umfang neu rechnet.'
  ] },
  { title: 'Zeiten & Prognosen', sub: 'so rechnet die App', items: [
    'Pace = Zeit ÷ Distanz. Beispiel: Halbmarathon in 1:59:00 → 7.140 s ÷ 21,0975 km = 338 s = 5:38 /km. km/h = Distanz ÷ Stunden.',
    'Zwischenzeiten = Pace × Kilometer, also gleichmäßiges Tempo ohne Zuschläge. „Erste 2–3 km“ ist die Pace plus 7 Sekunden als ruhiger Start.',
    'Prognose für andere Distanzen (Riegel-Formel): Zeit₂ = Zeit₁ × (Distanz₂ ÷ Distanz₁)^1,06. Beispiel: 10 km in 55:05 → Halbmarathon 55:05 × 2,10975^1,06 ≈ 2:01:32, Marathon ≈ 4:13:24, 5 km ≈ 26:25.',
    'Der Exponent 1,06 bildet ab, dass man auf längeren Strecken langsamer wird. Die Formel stammt aus Daten gut trainierter Läufer: Für den Marathon ist sie bei weniger als etwa 50 km pro Woche meist zu optimistisch – eher 5–10 % Puffer einplanen. Am verlässlichsten ist eine Prognose aus einer Bestzeit über eine ähnliche Distanz.',
    'Eigene Distanz (z. B. 20 km): Für Plan und Trainingsstufe zählt die nächstliegende Kategorie (bis 7,5 km → 5 km, bis 15 km → 10 km, bis 30 km → Halbmarathon, darüber Marathon). Die Zielzeit wird dafür per Riegel auf diese Distanz umgerechnet; Pace und Zwischenzeiten rechnet die App mit den echten km.',
    'Renntempo in den Einheiten („im HM-Tempo“) kommt aus deiner aktuellen Form, nicht aus der Zielzeit – nur solange noch kein Ergebnis eingetragen ist, aus der Zielzeit.',
    'Trainingstempos (Plan → Übersicht): Grundlage ist dein neuestes Ergebnis, solange es höchstens 3 % langsamer ist als dein bestes der letzten 12 Monate (sonst das beste), per Riegel auf 10 km umgerechnet. Locker = 10-km-Pace + 60–90 s/km, Schwelle = Renntempo für 15 km bis Halbmarathon (etwa eine Stunde haltbar), Intervall ≈ 5-km-Renntempo, Marathontempo per Riegel. Beispiel 10 km in 50:00: locker 6:00–6:30, Schwelle 5:05–5:15, Intervall 4:48, Marathon 5:27 /km.',
    'Fortschritt kommt über Testläufe: Ist dein letztes Ergebnis oder Rennen 8 Wochen her, macht der Plan in der nächsten passenden Woche (Basis, Grundlage oder Aufbau) die Qualitätseinheit zum 5-km-Testlauf. Ergebnis unter Bestzeiten eintragen – B-Rennen zählen genauso.',
    'Einen Testlauf gibt es erst, wenn 5 km machbar sind: in der laufenden Woche, wenn dein längster Lauf der letzten 30 Tage mindestens 5 km war, später, wenn der geplante Longrun der Woche so lang ist. Im Lauf-Einstieg nie.',
    'Die Tempos sind Richtwerte. Bei Hitze, Wind, Hügeln oder müden Beinen gilt das Gefühl bzw. die Herzfrequenz-Zone, nicht die Uhr.',
    'Herzfrequenz-Zonen (Karvonen): Ruhe-HF + Anteil × (max. HF − Ruhe-HF), Zone 1 ab 50 %, Zone 2 ab 60 %, Zone 3 ab 70 %, Zone 4 ab 80 %, Zone 5 ab 90 %. Beispiel: max. 184, Ruhe 60 → Zone 2 ab 60 + 0,6 × 124 = 134 bpm.'
  ] },
  { title: 'Wings for Life & Pace Race', sub: 'Rennen ohne feste Distanz', items: [
    'Wings for Life World Run: Es gibt keine Ziellinie. 30 Minuten nach dem Start fährt das Catcher Car los, mit 14 km/h, und wird alle 30 Minuten schneller: 15, 16, 17, 18, dann 22, 26, 30 und ab 4:30 h 34 km/h. Es ist bei km 7 nach 1:00 h, km 14,5 nach 1:30, km 22,5 nach 2:00, km 31 nach 2:30, km 40 nach 3:00, km 51 nach 3:30, km 64 nach 4:00 und km 79 nach 4:30 h.',
    'Ziel in km eintragen: Die App rechnet, wann das Catcher Car diesen Kilometer erreicht – das ist deine Zielzeit, daraus die Pace, die du im Schnitt mindestens laufen musst. Beispiel 10 km: 7 km bis 1:00 h, die letzten 3 km mit 15 km/h dauern 12 Min. → 1:12:00 = 7:12 /km. Beispiel 20 km: 1:50:38 = 5:32 /km. Gleichmäßig laufen – das Auto wird erst spät richtig schnell.',
    'Wie weit deine Form reicht: die Strecke, auf der deine Riegel-Prognose genau so lang dauert wie das Catcher Car bis dorthin. Beispiel 10 km in 55:00 → etwa 18 km. Über Marathonlänge eher zu optimistisch.',
    'Pace Race: Runden über 1.000 m, jede mit Zeitlimit – Level 1 8:00 Min., Level 2 7:00, Level 3 6:30, Level 4 6:15, Level 5 6:00, danach jede Runde 10 Sek. schneller bis Level 28 mit 2:10. Die nächste Runde startet 60 Sek. nach dem Zeitlimit: Wer schneller läuft, hat mehr Pause. Dein Level ist die Zahl der geschafften Runden.',
    'Ziel-Level eintragen: Level 12 heißt 12 km und die 12. Runde in höchstens 4:50 – das ist dein Level-Tempo. Alle 12 Runden mit Pausen dauern etwa 1:22 h. Geplant wird wie für eine eigene Distanz mit so vielen km; Qualität und Longrun bekommen im Aufbau, in der spezifischen Phase und im Tapering 1-km-Wiederholungen mit 60 Sek. Stehpause bis ins Level-Tempo. Wie beim Renntempo zählt deine Form: Ist das Level-Tempo schneller als dein aktuelles 5-km-Tempo, nimmt der Plan erst mal das 5-km-Tempo.',
    'Welches Level deine Form hergibt, schätzt die App grob: das letzte Level, dessen Zeitlimit nicht schneller ist als dein 5-km-Renntempo – nach vielen Runden ist selten mehr drin. Beispiel 10 km in 55:00 → 5-km-Tempo 5:17 → etwa Level 9. Ein Pace-Race-Ergebnis gehört wegen der Pausen nicht unter Bestzeiten – es würde die Trainingstempos verfälschen.'
  ] },
  { title: 'Tempo & Pacing', sub: 'gleichmäßig statt schnell los', items: [
    'Gleichmäßig laufen oder die zweite Hälfte leicht schneller. Jede Sekunde, die du auf den ersten Kilometern zu schnell bist, zahlst du hinten doppelt.',
    'Die ersten 2–3 km bewusst 5–10 Sek./km langsamer als das Zieltempo – im Gedränge ohnehin realistischer.',
    'Wer ab km 15–17 einbricht, ist meist zu schnell gestartet, hatte zu wenig Energie oder zu wenig lange Läufe mit Tempo am Ende. Genau das übt die spezifische Phase.',
    'Herzfrequenz als Bremse: Steigt sie in der ersten Hälfte deutlich über deinen Trainingswert für das Tempo, Tempo rausnehmen.',
    'Schwelle = „kontrolliert hart“: Du könntest nur noch einzelne Wörter sprechen, etwa das Tempo, das du rund eine Stunde halten könntest.'
  ] },
  { title: 'Tapering', sub: 'die letzten Wochen vor dem A-Rennen', items: [
    'Umfang deutlich runter, Intensität bleibt: kurze Abschnitte im Renntempo halten die Beine wach.',
    'Nichts nachholen: Verpasste Einheiten im Tapering nicht ersetzen.',
    'Unruhige Beine und das Gefühl „zu wenig trainiert“ sind normal – das ist der Effekt.',
    'Kraft-Training in der letzten Woche weglassen oder nur leicht, in der Woche davor ohne schwere Beinübungen.'
  ] },
  { title: 'Verpflegung', sub: 'im Training testen, am Renntag nichts Neues', items: [
    '5 und 10 km: kein Gel nötig, vorher normal frühstücken (2–3 Std. vor dem Start).',
    'Halbmarathon: 1–2 Gels, das erste nach etwa 40–50 Minuten, dazu Wasser an den Stationen.',
    'Marathon: ab etwa 30–45 Minuten alle 25–30 Minuten ein Gel, insgesamt etwa 60–90 g Kohlenhydrate pro Stunde – nur so viel, wie dein Magen im Training vertragen hat.',
    'Marathon: an den 2 Tagen vor dem Rennen kohlenhydratbetont und ballaststoffarm essen, nicht einfach mehr.',
    'Jeden Longrun der spezifischen Phase wie das Rennen verpflegen: gleiche Gels, gleiche Abstände.'
  ] },
  { title: 'Rennwoche', sub: 'Checkliste', items: [
    'Startunterlagen abholen, Startnummer und Zeitmessung prüfen.',
    'Schuhe und Kleidung, die du schon lange gelaufen bist. Nichts Neues.',
    'Wetter checken, Wegwerfschicht für den Startblock.',
    'Gels, Uhr laden, Herzfrequenzgurt, Pflaster und Vaseline für Scheuerstellen.',
    'Anreise und Startblock planen, Zeitpuffer für Toilette und Warm-up einrechnen.',
    'Warm-up für die Distanz unter Laufen → Warm-up ansehen und vorher einmal im Training testen.',
    'Die Nacht vor der Nacht vor dem Rennen ist für den Schlaf wichtiger als die letzte.'
  ] },
  { title: 'Erholung nach dem Rennen', sub: 'wie lange, was hilft', items: [
    'Faustregeln: 5 km etwa 2–3 Tage, 10 km 4–6 Tage, Halbmarathon 10–14 Tage, Marathon 3–4 Wochen. Je härter das Rennen und je schneller du gelaufen bist, desto länger.',
    'Der Plan rechnet nach jedem A-Rennen Erholungswochen ein (5/10 km 1 Woche, HM 2, Marathon 3): weniger Umfang, kein Tempo, nach dem Marathon zuerst kein Longrun.',
    'Aktive Erholung statt Stillstand: gehen, locker radeln, kurze ruhige Läufe. Kraft nur leicht, keine schweren Beinübungen.',
    'Zurück zu Tempo erst, wenn der Muskelkater weg ist und sich lockere Läufe wieder leicht anfühlen.',
    'Schmerzen, die nicht besser werden, oder ein mehrere Tage erhöhter Ruhepuls: weiter locker bleiben und bei Bedarf abklären lassen.'
  ] },
  { title: 'Wann nicht steigern', sub: 'Warnzeichen', items: [
    'Schmerzen, die am nächsten Tag noch da sind oder beim Laufen stärker werden.',
    'Ruhepuls morgens mehrere Tage deutlich erhöht, schlechter Schlaf, ständige Müdigkeit.',
    'Erkältung oder Fieber: kein Tempo, bei Fieber gar nicht laufen.',
    'Dann: Woche wie eine Entlastungswoche laufen. Der Plan rechnet in der Folgewoche mit deinem echten Umfang weiter.'
  ] }
];


/* Mobility (ohne Tracking): Reiter Läufer / Alltag mit je einem geführten Kurzprogramm pro Auswahl, Reiter Übungen nach Körperbereich.
   Die Reihenfolge von routines nicht ändern: data-mob verweist auf den Index. */
const MOBILITY = {
  tabs: [['laeufer', 'Läufer'], ['alltag', 'Alltag'], ['uebungen', 'Übungen']],
  regions: [['huefte', 'Hüfte'], ['ruecken', 'Rücken'], ['schultern', 'Schultern'], ['beine', 'Beine & Fuß']],
  routines: [
    { id: 'morgens', tab: 'alltag', label: 'Morgens', title: 'Morgens', time: '5 Min.', intro: 'Fünf Minuten nach dem Aufstehen: Rücken, Hüfte, Schultern und Nacken in Gang bringen.', steps: [['1 Min.', 'Katze-Kuh'], ['1 Min.', "World's Greatest Stretch"], ['1 Min.', '90/90-Hüftrotation'], ['1 Min.', 'Wand-Engel'], ['1 Min.', 'Kinn-Rückzug']] },
    { id: 'sitzen', tab: 'alltag', label: 'Nach dem Sitzen', title: 'Nach dem Sitzen', time: '6 Min.', intro: 'Gegenprogramm zum Schreibtisch: Hüftbeuger, Brust und Brustwirbelsäule öffnen, Nacken entlasten.', steps: [['1:30 Min.', 'Hüftbeuger-Dehnung'], ['1 Min.', 'Brustdehnung am Türrahmen'], ['1 Min.', 'Brustwirbel-Rotation im Vierfüßlerstand'], ['1 Min.', 'Tiefe Hocke halten'], ['30 Sek.', 'Kinn-Rückzug'], ['1 Min.', 'Nackendehnung seitlich']] },
    { id: 'nachlauf', tab: 'laeufer', label: 'Nach dem Lauf', title: 'Nach dem Laufen', time: '8 Min.', intro: 'Ruhiges Dehnen nach dem Lauf: Waden, Hüfte und Oberschenkel. Nach sehr harten Einheiten nur sanft.', steps: [['1:30 Min.', 'Wadendehnung'], ['1:30 Min.', 'Hüftbeuger-Dehnung'], ['1 Min.', 'Vorderer Oberschenkel'], ['1 Min.', 'Hintere Oberschenkel'], ['1:30 Min.', 'Tauben-Dehnung'], ['1:30 Min.', 'Knie-zur-Wand']] },
    { id: 'huefte', tab: 'laeufer', label: 'Hüfte', title: 'Hüfte für Läufer', time: '8 Min.', intro: 'Aktive Beweglichkeit und Kraft für die Hüfte, gut 2–3 × pro Woche. Nicht direkt vor Intervallen: Die Copenhagen Hip Dips sind echtes Krafttraining.', steps: [['2 Min.', 'Hüft-CARs'], ['1 Min.', 'Beinheben im Sitzen'], ['1 Min.', 'Beinüberheben im Sitzen'], ['1 Min.', 'Knieheben im Stand'], ['1:30 Min.', '90/90 mit Aufrichten'], ['6 je Seite', 'Copenhagen Hip Dips']] },
    { id: 'sprung', tab: 'laeufer', label: 'Sprunggelenk', title: 'Sprunggelenk', time: '6 Min.', intro: 'Beweglichkeit, Kraft und Gleichgewicht für Sprunggelenk und Fuß. Passt an Ruhetagen oder nach einem lockeren Lauf.', steps: [['1 Min.', 'Fußgelenkkreisen'], ['1:30 Min.', 'Sprunggelenk mit Kettlebell'], ['1:30 Min.', 'Soleus-Dehnung'], ['1 Min.', 'Schienbeinheben'], ['1 Min.', 'Einbeinstand']] }
  ],
  groups: [
    { region: 'huefte', title: 'Dehnen & mobilisieren', items: [['45 Sek. je Seite', 'Hüftbeuger-Dehnung'], ['8 je Seite', '90/90-Hüftrotation'], ['45 Sek. je Seite', 'Tauben-Dehnung'], ['30–60 Sek.', 'Tiefe Hocke halten'], ['5 je Seite', "World's Greatest Stretch"], ['30 Sek. je Seite', 'Adduktoren'], ['30 Sek. je Seite', 'Figure-4 Gesäß']] },
    { region: 'huefte', title: 'Aktiv & stark', items: [['3 je Richtung', 'Hüft-CARs'], ['8 je Seite', 'Beinheben im Sitzen'], ['6 je Seite', 'Beinüberheben im Sitzen'], ['6 je Seite', 'Knieheben im Stand'], ['5 je Seite', '90/90 mit Aufrichten'], ['6–8 je Seite', 'Copenhagen Hip Dips']] },
    { region: 'ruecken', title: 'Rücken', items: [['10 ×', 'Katze-Kuh'], ['60 Sek.', 'Kindhaltung'], ['8 je Seite', 'Open Book'], ['8 je Seite', 'Brustwirbel-Rotation im Vierfüßlerstand'], ['45 Sek.', 'Knie zur Brust'], ['8 je Seite', 'Bird Dog']] },
    { region: 'schultern', title: 'Schultern & Nacken', items: [['10 ×', 'Wand-Engel'], ['10 ×', 'Schulterkreisen mit Band'], ['30 Sek. je Seite', 'Brustdehnung am Türrahmen'], ['10 ×', 'Kinn-Rückzug'], ['30 Sek. je Seite', 'Nackendehnung seitlich']] },
    { region: 'beine', title: 'Beine', items: [['45 Sek. je Seite', 'Wadendehnung'], ['30 Sek. je Seite', 'Hintere Oberschenkel'], ['30 Sek. je Seite', 'Vorderer Oberschenkel']] },
    { region: 'beine', title: 'Sprunggelenk & Fuß', items: [['10 je Seite', 'Knie-zur-Wand'], ['10 je Seite', 'Sprunggelenk mit Kettlebell'], ['45 Sek. je Seite', 'Soleus-Dehnung'], ['10 je Richtung', 'Fußgelenkkreisen'], ['15–20 ×', 'Schienbeinheben'], ['30 Sek. je Seite', 'Einbeinstand']] }
  ]
};

/* Einseitige Übungen: Im geführten Ablauf wird bei Angaben ohne „je Seite“ nach der halben Zeit die Seite gewechselt.
   Wechselseitige Übungen (z. B. 90/90-Hüftrotation, World's Greatest Stretch) stehen bewusst nicht in der Liste. */
const SIDED = new Set(['Hüftbeuger-Dehnung', 'Brustdehnung am Türrahmen', 'Nackendehnung seitlich', 'Wadendehnung', 'Vorderer Oberschenkel', 'Hintere Oberschenkel',
  'Tauben-Dehnung', 'Knie-zur-Wand', 'Brustwirbel-Rotation im Vierfüßlerstand', 'Figure-4 Gesäß', 'Adduktoren', 'Open Book',
  'Hüft-CARs', 'Beinheben im Sitzen', 'Beinüberheben im Sitzen', 'Knieheben im Stand', 'Fußgelenkkreisen', 'Sprunggelenk mit Kettlebell', 'Soleus-Dehnung', 'Einbeinstand']);

/* Lauf-Einstieg für Einsteiger: 9 Wochen, je 3 Einheiten, von Lauf-Geh-Wechseln bis 30 Minuten am Stück.
   Jede Einheit: 5 Min. zügig gehen, die Wechsel der Woche, 5 Min. locker gehen. Eigene Stufen, kein fremdes Programm. */
const STARTER = {
  weeks: [
    { run: 60, walk: 90, reps: 8 },
    { run: 90, walk: 120, reps: 6 },
    { run: 150, walk: 120, reps: 5 },
    { run: 240, walk: 120, reps: 4 },
    { run: 360, walk: 120, reps: 3 },
    { run: 600, walk: 120, reps: 2, tail: 300 },
    { run: 780, walk: 90, reps: 2 },
    { run: 1200, walk: 60, reps: 1, tail: 420 },
    { run: 1800, walk: 0, reps: 1 }
  ],
  intro: 'Neun Wochen bis 30 Minuten am Stück: je Woche drei Einheiten mit Wechseln aus Laufen und Gehen. Zwischen zwei Einheiten mindestens ein Ruhetag. Eine Woche zu wiederholen ist völlig in Ordnung – Hauptsache regelmäßig.',
  pace: 'Tempo: so langsam, dass du dabei noch sprechen kannst. Gehpausen sind Teil des Plans, kein Scheitern.',
  health: 'Bei Vorerkrankungen, starkem Übergewicht oder nach langer Pause vorher ärztlich abklären lassen. Schmerzen (nicht nur Muskelkater): Pause und die Woche wiederholen.',
  screen: 'Während der geführten Einheit bleibt der Bildschirm an. Schaltest du ihn aus, pausiert das Handy die App meist – die Ansagen kommen dann erst nach dem Entsperren.',
  done: 'Geschafft: 30 Minuten am Stück! Ab jetzt plant die App wie für Läufer – mit Umfang aus deinen Läufen und, wenn du magst, einem lockeren 5-km-Lauf als Standortbestimmung.'
};
/* Körpergewicht in drei Stufen: leicht / mittel (= Ausführung wie beschrieben) / schwer. Bei Kettlebell und Band regelt das Gewicht.
   Übungen mit eigenen Stufen (Split Squat → Bulgarian) bekommen keine. */
const BW_LEVELS = {
  "Hüftheben": ["Beide Füße am Boden, Oberkörper flach – Bewegung kleiner, wenn nötig", "Einbeinig: ein Bein gestreckt in der Luft, Seiten abwechseln"],
  "Holzhacker": ["Kleinere Diagonale, nur bis Brusthöhe", "Tiefer in die Knie, oben auf die Zehenspitzen und zügig"],
  "Armkreisen mit Spannung": ["Kleine Kreise, Arme dürfen leicht gebeugt sein", "Große, langsame Kreise mit voller Spannung, oben kurz halten"],
  "Kniebeugen": ["Auf einen Stuhl setzen und wieder aufstehen (Box Squat)", "Langsam absenken (3 Sek.), unten 1 Sek. halten"],
  "Ausfallschritte": ["Kleinerer Schritt, mit einer Hand an Wand oder Stuhl abstützen", "Langsam absenken, unten 1 Sek. halten – oder im Gehen"],
  "Seitstütz": ["Knie am Boden lassen", "Beine gestreckt, oberes Bein anheben"],
  "Y-T-W in Bauchlage": ["Stirn auf einem Handtuch, Arme nur kurz anheben", "Positionen je 2 Sek. halten, Daumen zeigen nach oben"],
  "Liegestütze erhöht": ["Hände höher abstützen (Küchenzeile, Wand)", "Hände niedriger (Stuhl) oder auf dem Boden"],
  "Enge Liegestütze erhöht": ["Hände höher abstützen (Küchenzeile, Wand)", "Hände niedriger (Stuhl) oder auf dem Boden"],
  "Handtuch-Curl (halten)": ["Mit halber Kraft ziehen", "Mit voller Kraft ziehen, Ellenbogen 90°"],
  "Standwaage": ["Fußspitze des hinteren Beins bleibt am Boden, Hand an der Wand", "Ohne Halt, unten 2 Sek. halten"],
  "Stehende Knie-Ellenbogen-Crunches": ["Langsam, Knie nur bis Hüfthöhe", "Zügig, Knie über Hüfthöhe, Oberkörper dreht mit"],
  "Einbeiniges Wadenheben": ["Beidbeinig", "Vom Treppenabsatz, Ferse unter die Stufe absenken"],
  "Unterarmstütz": ["Knie am Boden", "Abwechselnd ein Bein anheben"],
  "Pike-Liegestütze erhöht": ["Hände höher abstützen, Hüfte weniger hoch", "Füße erhöht (Stuhl), Kopf Richtung Boden"],
  "Wand-Seitheben (halten)": ["Mit halber Kraft gegen die Wand drücken", "Mit voller Kraft drücken, länger halten"],
  "Schwimmer in Bauchlage": ["Arme nur kurz anheben, Stirn bleibt am Boden", "Arme und Beine angehoben halten, langsam"],
  "Dead Bug": ["Nur die Arme oder nur die Beine bewegen", "Langsam strecken, gestreckt 2 Sek. halten"],
  "Wand-Engel": ["Etwas Abstand zur Wand, kleinere Bewegung", "Langsam, Hände und Unterarme bleiben ganz an der Wand"],
  "Bird Dog": ["Nur einen Arm oder nur ein Bein strecken", "Gestreckt 2 Sek. halten, Knie schwebt knapp über dem Boden"],
  "Clamshells": ["Kleinere Bewegung, Kopf auf dem Arm ablegen", "Oben 2 Sek. halten, Füße leicht angehoben"],
  "Brustwirbel-Rotation im Vierfüßlerstand": ["Kleinere Drehung", "Hand hinter dem Rücken, langsam und weit drehen"],
  "Bergsteiger erhöht": ["Hände höher abstützen, ruhiges Tempo", "Hände auf dem Boden, zügig"]
};
/* Erklärungen zu Stufen, Tempo, Bändern und EMOM (Lauftraining) */
const STAGE_INFO = {
  'Split Squat': 'Beide Füße am Boden, großer Schritt. Einstiegsstufe.',
  'Split Squat · Tempo 3-1-1': 'Gleiche Übung, aber langsam (siehe Tempo). Deutlich schwerer bei gleichem Gewicht.',
  'Bulgarian Split Squat': 'Hinterer Fuß liegt erhöht auf Stuhl oder Sofa. Fast die ganze Last liegt auf dem vorderen Bein.',
  'Bulgarian · Tempo 3-1-1': 'Erhöhter hinterer Fuß plus langsames Tempo. Schwerste Stufe.',
  'Normal': 'Zügig in der Anstrengung, kontrolliert zurück.',
  'Tempo 3-1-1': 'Langsame Ausführung (siehe Tempo). Mehr Reiz ohne mehr Gewicht.'
};
const TEMPO_TEXT = '3 Sekunden absenken (bzw. zurückführen), 1 Sekunde in der Endposition halten, 1 Sekunde zurück in die Anstrengung. Laut mitzählen. Die Wiederholungsziele bleiben gleich, die Übung wird durch die längere Spannung deutlich schwerer.';
const EMOM_TEXT = '„Every Minute On the Minute“: Zu Beginn jeder Minute die Wiederholungen ausführen, im Rest der Minute Pause. Der Timer gibt bei jedem Minutenwechsel ein Signal. Brauchst du mehr als etwa 40 Sekunden, nimm weniger Wiederholungen. Die geschafften Wiederholungen trägst du unter Min. 1–3 ein.';
const BAND_TEXT = 'Kombinationen wie „Band 10 + 30 kg“: beide Bänder gleichzeitig nutzen und die Enden zusammen greifen. Vorher prüfen, dass beide gleich lang gespannt sind. Bänder vor jeder Nutzung auf Risse prüfen.';

/* Ergänzende Varianten, damit jeder Übungsplatz mit Kettlebell, Band UND Körpergewicht funktioniert.
   „Nur Kettlebell“ bzw. „Nur Band“ ergibt so ein Training ausschließlich mit diesem Gerät. */
const EXTRA = {
  wed: {
    halo: { band: ['Schulterkreisen mit Band', '10', 'Band breit greifen, gestreckt über den Kopf'], _band: '10' },
    lunge: { band: ['Ausfallschritte mit Band', '10 je Seite', 'Band unter dem vorderen Fuß, Enden an den Schultern'], _band: '20' },
    march: { band: ['Suitcase March mit Band', '20 Sek. je Seite', 'Band unter dem Fuß, Ende seitlich halten'], _band: '20' },
    balance: { band: ['Einbeiniges Kreuzheben mit Band', '6–10 je Seite', 'Band unter dem Standfuß'], _band: '20' },
    crunch: { kb: ['Übergabe im Grätschsitz', '8 je Seite', 'Aufrecht sitzen, Kugel vorne überheben'], band: ['Dead Bug mit Band', '8 je Seite', 'Band zwischen Händen und Füßen'], _band: '10' }
  },
  run: {
    split: { band: ['Split Squat mit Band', '8–15 je Seite', 'Band unter dem vorderen Fuß'], _band: '20' },
    calf: { band: ['Einbeiniges Wadenheben mit Band', '8–15 je Seite', 'Band unter dem Fußballen'], _band: '20' },
    sldl: { band: ['Einbeiniges Kreuzheben mit Band', '6–10 je Seite', 'Band unter dem Standfuß'], _band: '20' },
    march: { band: ['Suitcase March mit Band', '20–30 Sek. je Seite', 'Band unter dem Fuß, Ende seitlich halten'], _band: '20' }
  },
  sun: {
    pushup: { kb: ['Squeeze Press am Boden', '10–12', 'Kugel zwischen den Händen zusammendrücken'], band: ['Butterfly mit Band', '12–15', 'Band hinter dem Rücken, Arme schließen'], _band: '10' },
    lateral: { kb: ['Halo um den Kopf', '8 je Richtung', 'Ersatz für Seitheben – 12 kg sind dafür zu schwer'] },
    deadbug: { kb: ['Dead Bug mit Kettlebell', '8 je Seite', 'Kugel über der Brust halten'], band: ['Dead Bug mit Band', '8 je Seite', 'Band zwischen Händen und Füßen'], _band: '10' },
    hold: { band: ['Suitcase Hold mit Band', '20–30 Sek. je Seite', 'Band unter dem Fuß, Ende seitlich halten'], _band: '20' }
  },
  office: {
    angel: { kb: ['Kettlebell-Pullover', '10', 'Rückenlage, öffnet Brust und Brustwirbelsäule'], band: ['Schulterkreisen mit Band', '10', 'Band breit greifen'], _band: '10' },
    birddog: { kb: ['Dead Bug mit Kettlebell', '8 je Seite', 'Kugel über der Brust halten'], band: ['Dead Bug mit Band', '8 je Seite', 'Band zwischen Händen und Füßen'], _band: '10' },
    clam: { kb: ['Seitlicher Ausfallschritt mit Kettlebell', '8 je Seite', 'Kugel vor der Brust'] },
    tspine: { kb: ['Halo um den Kopf', '8 je Richtung', 'Schultern und oberer Rücken'], band: ['Holzhacker mit Band', '8 je Seite', 'Rotation aus dem oberen Rücken'], _band: '10' }
  }
};
for (const [pk, m] of Object.entries(EXTRA)) for (const sl of PLANS[pk].slots) if (m[sl.id]) { const { _band, ...v } = m[sl.id]; Object.assign(sl.v, v); if (_band) sl.band = _band; }

/* Was man zusätzlich zu Kettlebell und Bändern bereitlegen sollte (Kraft, Zeile „Du brauchst“), nach Übungsnamen –
   Hauptteil sowie Aufwärmen und Cooldown. Matte: alles im Liegen, Knien, Vierfüßlerstand oder Sitzen am Boden. */
const PREP = {
  mat: ['Bird Dog', 'Brustwirbel-Rotation im Vierfüßlerstand', 'Clamshells', 'Clamshells mit Band', 'Clean & Press im halben Kniestand', 'Dead Bug', 'Dead Bug mit Band', 'Dead Bug mit Kettlebell',
    'Floor Press', 'Hüftheben', 'Hüftheben mit Band', 'Kettlebell-Pullover', 'Pullover im Kniestand', 'Schwimmer in Bauchlage', 'Seitstütz', 'Squeeze Press am Boden', 'Unterarmstütz',
    'Y-T-W in Bauchlage', 'Übergabe im Grätschsitz', 'Wrestler-Halo', 'Katze-Kuh', 'Kindhaltung', 'Hüftbeuger-Dehnung', 'Figure-4 Gesäß'],
  support: ['Liegestütze erhöht', 'Enge Liegestütze erhöht', 'Bergsteiger erhöht', 'Pike-Liegestütze erhöht'],
  towel: ['Handtuch-Curl (halten)']
};

/* Beste Variante je Übungsplatz: Rangfolge nach Wirksamkeit (vorne = bevorzugt).
   Die App nimmt die erste Variante, deren Gerät für den Plan gewählt ist (Geräte je Plan).
   Grundlage: 12-kg-Kettlebell, Bänder 10/20/30 kg, eigenes Körpergewicht. */
const BEST = {
  wed: {
    swing: [['kb', 'band', 'bw'], 'Der Swing trainiert Hüftstreckung und Kondition zugleich – Hüftheben ist die schonende Alternative.'],
    hips: [['kb', 'band', 'bw'], 'Die Kugel gibt dem Holzhacker über die ganze Diagonale Last; das Band wirkt vor allem oben, ohne Gerät bleibt es Bewegungstraining.'],
    halo: [['kb', 'band', 'bw'], 'Das Gewicht über Kopf fordert die Schulterkontrolle am stärksten; das Band öffnet die Schultern, Armkreisen ist die Variante ohne Gerät.'],
    squat: [['kb', 'band', 'bw'], 'Die Kugel vor der Brust hält den Oberkörper aufrecht und belastet auch unten in der Kniebeuge; das Band wirkt vor allem oben.'],
    lunge: [['kb', 'band', 'bw'], 'Zusatzgewicht erhöht den Reiz für Gesäß und Oberschenkel; die Kugel belastet über den ganzen Weg, das Band vor allem oben.'],
    march: [['kb', 'band', 'bw'], 'Die einseitige Last trainiert den seitlichen Rumpf so, wie er beim Laufen arbeitet.'],
    row: [['kb', 'band', 'bw'], 'Rudern mit Gewicht trifft den Rücken direkter als Y-T-W; das Band unter dem Fuß verrutscht leichter.'],
    press: [['bw', 'band', 'kb'], 'Liegestütze bewegen einen großen Teil des Körpergewichts und fordern Rumpf und Brust stärker als 12 kg oder ein Band.'],
    tri: [['kb', 'band', 'bw'], 'Gezielter Reiz für den Trizeps; enge Liegestütze sind die Alternative ohne Gerät.'],
    curl: [['kb', 'band', 'bw'], 'Bewegung mit Gewicht über den vollen Weg; das Halten gegen das Handtuch ist die Notlösung.'],
    balance: [['bw', 'kb', 'band'], 'Im Zirkel unter Ermüdung zuerst ohne Gewicht – Gleichgewicht und saubere Hüftbeugung gehen vor Last.'],
    crunch: [['bw', 'kb', 'band'], 'Ohne Gerät am einfachsten sauber auszuführen; die Übergabe im Grätschsitz und der Dead Bug mit Band sind gleichwertige Rumpfübungen.']
  },
  tabata: {
    swing: [['kb', 'band', 'bw'], 'Der Swing ist die wirksamste Tabata-Übung für Hüfte und Puls.'],
    goblet: [['kb', 'band', 'bw'], 'Die Kugel vor der Brust erlaubt schnelle, saubere Wiederholungen.'],
    row2: [['kb', 'band', 'bw'], 'Beidarmiges Rudern mit Gewicht lässt sich in 20 Sekunden zügig und sicher ausführen.'],
    press2: [['bw', 'kb', 'band'], 'Liegestütze sind im Tabata-Tempo die stärkste Druckübung.'],
    twist: [['bw', 'band', 'kb'], 'Bergsteiger bringen Rumpf und Puls hoch, ohne den Rücken unter Last zu drehen.']
  },
  run: {
    split: [['kb', 'band', 'bw'], 'Zusatzgewicht macht den Split Squat zum echten Kraftreiz; die Kugel belastet gleichmäßiger als das Band.'],
    row: [['kb', 'band', 'bw'], 'Rudern mit Gewicht trifft den Rücken direkt.'],
    press: [['bw', 'band', 'kb'], 'Liegestütze bewegen mehr Last als 12 kg und lassen sich über die Höhe der Erhöhung gut steigern.'],
    calf: [['kb', 'band', 'bw'], 'Gewicht in der Hand erhöht den Reiz für Wade und Achillessehne.'],
    sldl: [['kb', 'band', 'bw'], 'Mit Gewicht wird die Standwaage zum einbeinigen Kreuzheben.'],
    march: [['kb', 'band', 'bw'], 'Die einseitige Last trainiert den seitlichen Rumpf so, wie er beim Laufen arbeitet.'],
    swing: [['kb', 'band', 'bw'], 'Der Swing trainiert Hüftstreckung und Kondition zugleich.']
  },
  sun: {
    press: [['band', 'kb', 'bw'], 'Liegestütze folgen als eigene Übung – hier deshalb Drücken mit Band; ohne Geräte der Unterarmstütz.'],
    pushup: [['bw', 'band', 'kb'], 'Liegestütze sind die stärkste Brustübung; ohne Körpergewicht-Auswahl Butterfly mit Band oder Squeeze Press.'],
    shoulder: [['kb', 'band', 'bw'], 'Einarmiges Drücken mit der Kugel fordert Schulter und Rumpf am stärksten.'],
    lateral: [['band', 'bw', 'kb'], 'Das Band gibt über die ganze Bewegung Widerstand. Mit 12 kg wäre Seitheben zu schwer – mit nur Kettlebell daher Halo.'],
    pull: [['band', 'kb', 'bw'], 'Pull-Aparts treffen die hintere Schulter gezielt – das Gegengewicht zu den Druckübungen.'],
    pullover: [['kb', 'band', 'bw'], 'Der Pullover trainiert den breiten Rückenmuskel und hält den Bauch gegen das Hohlkreuz; Rudern mit Band trifft den Rücken ähnlich, der Schwimmer ist die Variante ohne Gerät.'],
    curl: [['kb', 'band', 'bw'], 'Bewegung mit Gewicht über den vollen Weg.'],
    tri: [['kb', 'band', 'bw'], 'Gezielter Reiz für den Trizeps.'],
    deadbug: [['kb', 'band', 'bw'], 'Die Kugel über der Brust macht den Dead Bug deutlich fordernder.'],
    hold: [['kb', 'band', 'bw'], 'Die einseitige Last trainiert den seitlichen Rumpf; der Seitstütz ist die Alternative ohne Gerät.']
  },
  office: {
    hinge: [['kb', 'band', 'bw'], 'Kreuzheben trainiert genau die Muskeln, die beim Sitzen abschalten.'],
    upper: [['band', 'kb', 'bw'], 'Pull-Aparts öffnen Brust und Schultern – gezielt gegen die Sitzhaltung.'],
    squat: [['kb', 'band', 'bw'], 'Die Kugel vor der Brust hält den Oberkörper aufrecht.'],
    angel: [['bw', 'band', 'kb'], 'Der Wand-Engel trainiert Haltung und Schulterblätter am gezieltesten; Band und Pullover öffnen Brust und Schultern.'],
    birddog: [['bw', 'kb', 'band'], 'Der Bird Dog trainiert gezielt den Rückenstrecker; der Dead Bug mit Gewicht ist die gleichwertige Rumpfalternative.'],
    clam: [['band', 'kb', 'bw'], 'Das Band erhöht den Reiz für die seitliche Gesäßmuskulatur; der seitliche Ausfallschritt trainiert dieselbe Ebene mit Last.'],
    tspine: [['bw', 'band', 'kb'], 'Mobilität braucht kein Gewicht – die Rotation im Vierfüßlerstand ist hier am wirksamsten.']
  }
};
for (const [pk, m] of Object.entries(BEST)) for (const sl of PLANS[pk].slots) if (m[sl.id]) { sl.order = m[sl.id][0]; sl.why = m[sl.id][1]; }

/* Kurzhanteln (db): je Übungsplatz eine Hantel-Variante. Rangfolge: direkt vor der Kettlebell – Hanteln lassen sich frei führen
   und fein steigern, zwei Hanteln belasten beide Seiten gleich. Ausnahmen: Swing und Halo gehen mit dem Kettlebell-Griff besser
   (Hantel danach), Seitheben ist mit Kurzhanteln die klassische Übung (Hantel zuerst). */
const DB_VARIANTS = {
  wed: {
    swing: ['Kurzhantel-Swing', '10', 'Hantel am oberen Ende, Hüfte kraftvoll strecken, nur bis Brusthöhe'],
    hips: ['Holzhacker mit Kurzhantel', '8 je Seite', 'Hantel an beiden Enden, diagonal nach oben'],
    halo: ['Halo mit Kurzhantel', '10 je Richtung', 'Hantel senkrecht, Kopf ruhig, Rippen unten'],
    squat: ['Goblet-Kniebeugen mit Kurzhantel', '10', 'Hantel senkrecht vor der Brust'],
    lunge: ['Ausfallschritte mit Kurzhanteln', '10 je Seite', 'Rückwärts, Hanteln seitlich am Körper'],
    march: ['Suitcase March mit Kurzhantel', '20 Sek. je Seite', 'Hantel einseitig, aufrecht marschieren'],
    row: ['Einarmiges Rudern mit Kurzhantel', '10 je Seite', 'Freie Hand abstützen'],
    press: ['Floor Press mit Kurzhanteln', '10', 'Rückenlage, beide Arme zugleich'],
    tri: ['Trizeps über Kopf mit Kurzhantel', '10', 'Eine Hantel, beide Hände am oberen Ende'],
    curl: ['Bizepscurls mit Kurzhanteln', '10', 'Ellenbogen am Körper'],
    balance: ['Einbeiniges Kreuzheben mit Kurzhantel', '6–10 je Seite', 'Hantel in der Hand gegenüber dem Standbein'],
    crunch: ['Dead Bug mit Kurzhantel', '8 je Seite', 'Hantel über der Brust halten']
  },
  run: {
    split: ['Split Squat mit Kurzhanteln', '8–15 je Seite', 'Hanteln seitlich am Körper'],
    row: ['Einarmiges Rudern mit Kurzhantel', '8–15 je Seite', 'Freie Hand abstützen'],
    press: ['Floor Press mit Kurzhanteln', '8–15', 'Rückenlage, beide Arme zugleich'],
    calf: ['Einbeiniges Wadenheben mit Kurzhantel', '8–15 je Seite', 'Bei Mittelfuß-Beschwerden erst ohne Gewicht'],
    sldl: ['Einbeiniges Kreuzheben mit Kurzhantel', '6–10 je Seite', 'Erst ohne Gewicht testen'],
    march: ['Suitcase March mit Kurzhantel', '20–30 Sek. je Seite', 'Hantel einseitig'],
    swing: ['Kurzhantel-Swing', '10–15 pro Minute', 'Nur saubere Wiederholungen']
  },
  sun: {
    press: ['Floor Press mit Kurzhanteln', '10', 'Rückenlage, beide Arme zugleich'],
    pushup: ['Squeeze Press mit Kurzhanteln', '10–12', 'Hanteln aneinander drücken'],
    shoulder: ['Schulterdrücken mit Kurzhanteln', '8–10', 'Beide Arme, Bauch fest'],
    lateral: ['Seitheben mit Kurzhanteln', '10–12', 'Leichte Hanteln, nur bis Schulterhöhe'],
    pull: ['Einarmiges Rudern mit Kurzhantel', '10 je Seite', 'Freie Hand abstützen'],
    pullover: ['Pullover mit Kurzhantel', '10–12', 'Rückenlage, Rippen unten'],
    curl: ['Bizepscurls mit Kurzhanteln', '10', 'Ellenbogen am Körper'],
    tri: ['Trizeps über Kopf mit Kurzhantel', '10', 'Eine Hantel, beide Hände am oberen Ende'],
    deadbug: ['Dead Bug mit Kurzhantel', '8 je Seite', 'Hantel über der Brust halten'],
    hold: ['Suitcase Hold mit Kurzhantel', '20–30 Sek. je Seite', 'Hantel ruhig halten']
  },
  office: {
    hinge: ['Rumänisches Kreuzheben mit Kurzhanteln', '10', 'Hanteln nah an den Beinen, Rücken lang'],
    upper: ['Einarmiges Rudern mit Kurzhantel', '10 je Seite', 'Freie Hand abstützen'],
    squat: ['Goblet-Kniebeugen mit Kurzhantel', '10', 'Hantel senkrecht vor der Brust'],
    angel: ['Pullover mit Kurzhantel', '10', 'Rückenlage, öffnet Brust und Brustwirbelsäule'],
    birddog: ['Dead Bug mit Kurzhantel', '8 je Seite', 'Hantel über der Brust halten'],
    clam: ['Seitlicher Ausfallschritt mit Kurzhantel', '8 je Seite', 'Hantel senkrecht vor der Brust'],
    tspine: ['Halo mit Kurzhantel', '8 je Richtung', 'Schultern und oberer Rücken']
  },
  tabata: {
    swing: ['Kurzhantel-Swing', '20 Sek. je Runde', 'Kraft aus der Hüfte, nur bis Brusthöhe'],
    goblet: ['Goblet-Kniebeugen mit Kurzhantel', '20 Sek. je Runde', 'Hantel vor der Brust, tief und kontrolliert'],
    row2: ['Vorgebeugtes Rudern mit Kurzhanteln', '20 Sek. je Runde', 'Rücken lang, Hanteln zum Bauch'],
    press2: ['Schulterdrücken mit Kurzhanteln', '20 Sek. je Runde', 'Beide Arme, Bauch fest'],
    twist: ['Holzhacker mit Kurzhantel', '20 Sek. je Runde', 'Seite jede Runde wechseln']
  }
};
const DB_AFTER_KB = ['Kurzhantel-Swing', 'Halo mit Kurzhantel'], DB_FIRST = ['Seitheben mit Kurzhanteln'];
// Begründung, wenn die Hantel-Variante automatisch gewählt ist (die Texte in BEST beschreiben die Kettlebell)
const DB_WHY = 'Kurzhanteln lassen sich frei führen und fein steigern – hier die wirksamste Variante mit deinen Geräten.';
for (const [pk, m] of Object.entries(DB_VARIANTS)) for (const sl of PLANS[pk].slots) if (m[sl.id]) {
  sl.v.db = m[sl.id];
  const o = (sl.order || ['kb', 'band', 'bw']).filter(g => g !== 'db'), name = m[sl.id][0], i = o.indexOf('kb');
  if (DB_FIRST.includes(name) || i < 0) o.unshift('db'); else o.splice(DB_AFTER_KB.includes(name) ? i + 1 : i, 0, 'db');
  sl.order = o;
}
// Anleitung aus der Kettlebell-Anleitung: nur geänderte Schritte (Index) bzw. effect/cue angeben, der Rest bleibt gleich
const dbGuide = (src, ch) => { const g = GUIDES[src]; return { steps: g.steps.map((s, i) => ch[i] !== undefined ? ch[i] : s), effect: ch.effect || g.effect, cue: ch.cue || g.cue }; };
Object.assign(GUIDES, {
  'V-Chop im Grätschsitz': { steps: ['Im Grätschsitz aufrecht sitzen, Kettlebell mit beiden Händen an den Hörnern und langen Armen schräg über einer Schulter.', 'Mit langen Armen diagonal nach unten Richtung gegenüberliegende Hüfte hacken, die Drehung kommt aus den Rippen.', 'Auf demselben Weg hoch und über den Kopf zurück. Alle Wiederholungen einer Seite, dann wechseln.'], effect: 'Schräge Bauchmuskeln und Rumpfrotation; Schultern halten die Kugel auf langen Armen.', cue: 'Brust bleibt aufrecht, Becken bleibt am Boden. Abbremsen statt reißen – lieber eine leichtere Kugel.' },
  'Lenkrad im Grätschsitz': { steps: ['Im Grätschsitz aufrecht sitzen, Kettlebell an den Hörnern auf Augenhöhe, Ellenbogen eng am Körper.', 'Die Kugel wie ein Lenkrad schnell und klein nach links und rechts drehen.', 'Die ganze Zeit durchhalten, ruhig weiteratmen.'], effect: 'Schultern im Halten, Unterarme und Rumpf gegen die Drehbewegung.', cue: 'Schultern unten, nicht ins Hohlkreuz lehnen. Kleine Bewegung reicht – Tempo vor Weite.' },
  'Press-up & Press-out im Sitz': { steps: ['Im Grätschsitz aufrecht sitzen, Kettlebell an den Hörnern vor der Brust.', 'Dreimal senkrecht über den Kopf drücken, dann dreimal waagerecht nach vorne vom Körper weg drücken.', 'Im Wechsel weiter, bis die Wiederholungen erreicht sind.'], effect: 'Schultern und Trizeps; nach vorne gedrückt arbeitet der Rumpf gegen das Zurückkippen.', cue: 'Überkopf nur so weit, wie der Rücken gerade bleibt – sonst nur nach vorne drücken. Rippen unten.' },
  'Iron Arc im Grätschsitz': { steps: ['Im Grätschsitz aufrecht sitzen, Kettlebell an den Hörnern vor der Brust.', 'In einem Bogen über den Kopf zur Seite führen und neben der Hüfte Richtung Boden strecken.', 'Auf demselben Bogen zurück vor die Brust. Seiten abwechseln.'], effect: 'Seitliche Rumpfmuskeln und Schulterkontrolle über den ganzen Bogen.', cue: 'Die Hüfte dreht nicht mit, das Becken bleibt schwer am Boden. Langsam und kontrolliert.' },
  'Kurzhantel-Swing': dbGuide('Kettlebell-Swing', { 0: 'Eine Kurzhantel senkrecht am oberen Ende mit beiden Händen greifen, Füße etwas breiter als hüftbreit. Hüfte nach hinten schieben, Hantel zwischen die Beine führen.', 1: 'Hüfte kraftvoll strecken, sodass die Hantel bis etwa Brusthöhe schwingt. Die Arme führen nur.', 2: 'Hantel zurückpendeln lassen und erneut in der Hüfte beugen.', cue: 'Hantel fest greifen, nur bis Brusthöhe. Nicht aus den Schultern heben, kein Hohlkreuz am oberen Punkt.' }),
  'Holzhacker mit Kurzhantel': dbGuide('Holzhacker mit Kettlebell', { 0: 'Etwas breiter als hüftbreit stehen, Hantel mit beiden Händen an den Enden neben dem rechten Knie, leicht in die Knie gehen.', 1: 'Hantel mit fast gestreckten Armen diagonal nach links oben über die Schulter führen. Hüfte und Oberkörper drehen mit, der rechte Fuß dreht auf dem Ballen mit.', cue: 'Die Drehung kommt aus Hüfte und Brustwirbelsäule, nicht aus dem unteren Rücken. Langsam abbremsen statt reißen, Hantel fest greifen.' }),
  'Halo mit Kurzhantel': dbGuide('Halo um den Kopf', { 0: 'Kurzhantel senkrecht am oberen Ende mit beiden Händen vor der Brust halten.', cue: 'Kopf ruhig halten, Rippen nicht nach vorne schieben. Leichte Hantel wählen und fest greifen.' }),
  'Goblet-Kniebeugen mit Kurzhantel': dbGuide('Kniebeugen (Goblet)', { 0: 'Kurzhantel senkrecht am oberen Ende mit beiden Händen vor der Brust halten, Füße etwa schulterbreit.' }),
  'Ausfallschritte mit Kurzhanteln': dbGuide('Ausfallschritte', { 0: 'Aufrecht stehen, je eine Kurzhantel seitlich am Körper, Arme hängen locker.', cue: 'Vorderer Fuß bleibt ganz am Boden, Schultern unten. Erst mit leichten Hanteln sicher werden.' }),
  'Suitcase March mit Kurzhantel': dbGuide('Suitcase March', { 0: 'Kurzhantel mit einer Hand wie einen Koffer neben dem Körper halten.' }),
  'Einarmiges Rudern mit Kurzhantel': dbGuide('Einarmiges Rudern', { 1: 'Hantel Richtung Hüfte ziehen, Ellenbogen nah am Körper.' }),
  'Floor Press mit Kurzhanteln': dbGuide('Floor Press', { 0: 'Rückenlage, Knie angestellt. Je eine Kurzhantel in jeder Hand über der Brust, Handgelenke gerade.', 1: 'Oberarme etwa 30–45 Grad vom Körper, beide Hanteln senkrecht nach oben drücken.', 2: 'Absenken, bis die Oberarme sanft am Boden aufliegen.', cue: 'Niemals über Gesicht oder Kopf führen. Zum Hinlegen und Aufsetzen die Hanteln nah an der Brust halten.' }),
  'Trizeps über Kopf mit Kurzhantel': dbGuide('Trizeps über Kopf', { 0: 'Eine Kurzhantel senkrecht mit beiden Händen am oberen Ende sicher über dem Kopf halten.' }),
  'Bizepscurls mit Kurzhanteln': dbGuide('Bizepscurls', { 0: 'Aufrecht stehen, je eine Kurzhantel in jeder Hand, Handflächen nach vorne.', 1: 'Ellenbogen beugen und die Hanteln nach oben führen – beide zugleich oder abwechselnd.' }),
  'Einbeiniges Kreuzheben mit Kurzhantel': dbGuide('Einbeiniges Kreuzheben', { 0: 'Auf einem leicht gebeugten Bein stehen, Kurzhantel in der Hand gegenüber dem Standbein.', 1: 'Hüfte nach hinten schieben: Oberkörper nach vorne, freies Bein lang nach hinten, Hantel Richtung Boden.' }),
  'Dead Bug mit Kurzhantel': dbGuide('Dead Bug mit Kettlebell', { 0: 'Rückenlage, Kurzhantel mit beiden Händen an den Enden und gestreckten Armen über der Brust halten, Knie 90 Grad über der Hüfte.', 2: 'Zurück, Bein wechseln – die Hantel bleibt ruhig über der Brust.', cue: 'Hantel sicher greifen und nie über das Gesicht kippen lassen. Unterer Rücken bleibt am Boden.' }),
  'Split Squat mit Kurzhanteln': dbGuide('Split Squat', { 0: 'Großer Schritt: ein Fuß vorne, einer hinten auf dem Fußballen. Je eine Kurzhantel seitlich am Körper.' }),
  'Einbeiniges Wadenheben mit Kurzhantel': dbGuide('Einbeiniges Wadenheben', { 0: 'Auf einem Bein stehen, mit einer Hand an der Wand abstützen. Kurzhantel in der anderen Hand.' }),
  'Squeeze Press mit Kurzhanteln': dbGuide('Squeeze Press am Boden', { 0: 'Rückenlage, Knie angestellt. Zwei Kurzhanteln über der Brust aneinanderlegen, Handflächen zueinander.', 1: 'Die Hanteln fest gegeneinander drücken und unter diesem Druck senkrecht nach oben drücken.', cue: 'Handgelenke gerade, Hanteln nie über das Gesicht führen. Den Druck der Hände während der ganzen Bewegung halten.' }),
  'Schulterdrücken mit Kurzhanteln': dbGuide('Schulterdrücken', { 0: 'Je eine Kurzhantel auf Schulterhöhe halten, Handgelenke gerade, Bauch und Gesäß anspannen.', 1: 'Beide Hanteln senkrecht über die Schultern drücken, bis die Arme gestreckt sind.', 2: 'Kontrolliert zurück auf Schulterhöhe.', cue: 'Nicht ins Hohlkreuz ausweichen. Sind 8 saubere Wiederholungen nicht möglich, leichtere Hanteln wählen.' }),
  'Seitheben mit Kurzhanteln': dbGuide('Seitheben mit Band', { 0: 'Aufrecht stehen, je eine leichte Kurzhantel seitlich neben den Oberschenkeln.' }),
  'Pullover mit Kurzhantel': dbGuide('Kettlebell-Pullover', { 0: 'Rückenlage, Knie angestellt. Kurzhantel senkrecht am oberen Ende mit beiden Händen über der Brust halten.', cue: 'Hantel sicher greifen, Rippen unten lassen. Bewegungsumfang langsam steigern.' }),
  'Suitcase Hold mit Kurzhantel': dbGuide('Suitcase Hold', { 0: 'Kurzhantel einseitig neben dem Körper halten und stabil stehen.', cue: 'Nicht zur Hantel oder von ihr weg lehnen; Schultern nicht hochziehen.' }),
  'Rumänisches Kreuzheben mit Kurzhanteln': dbGuide('Kettlebell-Kreuzheben', { 0: 'Aufrecht stehen, Füße hüftbreit, je eine Kurzhantel vor den Oberschenkeln.', 1: 'Hüfte nach hinten schieben, Knie leicht beugen, Rücken lang – die Hanteln gleiten an den Beinen entlang bis etwa unter die Knie.', 2: 'Füße in den Boden drücken und aufrichten, oben Gesäß anspannen.', cue: 'Rücken bleibt lang, kein Rundrücken. Die Hanteln bleiben nah an den Beinen.' }),
  'Seitlicher Ausfallschritt mit Kurzhantel': dbGuide('Seitlicher Ausfallschritt mit Kettlebell', { 0: 'Breiter Stand, Kurzhantel senkrecht vor der Brust, Füße leicht nach außen.' }),
  'Vorgebeugtes Rudern mit Kurzhanteln': dbGuide('Vorgebeugtes Rudern beidarmig', { 0: 'Je eine Kurzhantel in jeder Hand, Füße hüftbreit.', 2: 'Beide Hanteln zum Bauch ziehen, Ellenbogen nach hinten, Schulterblätter zusammen. Kontrolliert absenken.' })
});
PREP.mat.push('Dead Bug mit Kurzhantel', 'Floor Press mit Kurzhanteln', 'Pullover mit Kurzhantel', 'Squeeze Press mit Kurzhanteln');

/* Neuigkeiten („Patch Notes“): neueste zuerst. Neuer Eintrag = neue id; die App zeigt ihn beim nächsten Start einmal an.
   Der älteste (letzte) Eintrag ist der Grundstand mit allen Funktionen; Neulinge sehen ihn plus die 3 neuesten Updates. */
/* Versionsnummer der App, angezeigt unter Mehr. Jede Veröffentlichung (mittwochs 00:00 aus dev nach main) ist eine neue
   Nebenversion: 1.0, 1.1, 1.2 … Erhöht wird mit der ersten Änderung nach einer Veröffentlichung, damit die Testversion schon
   die kommende Nummer zeigt. Der erste Neuigkeiten-Eintrag einer Version bekommt dieselbe Nummer (version). */
const APP_VERSION = '1.1';
// Ein Eintrag pro Tag: Änderungen desselben Tages kommen in den Eintrag des Tages (aka = frühere ids für „schon gesehen“)
const CHANGELOG = [
  { id: '2026-11-04', date: '2026-11-04', version: '1.1', title: 'Neuer Name Tagwerk, Startseite „Heute“ & neue Rennformate', items: [
    ['Neuer Name', 'Die App heißt jetzt Tagwerk – sie kann längst mehr als Kettlebell: Kraft, Laufen und Mobility, jeden Tag das, was dran ist. Deine Daten und die Sync-Datei bleiben, wie sie sind. Ein schon installiertes App-Icon behält auf dem iPhone den alten Namen. Wer es neu hinzufügen will, macht vorher unbedingt „Sync speichern“ oder ein Backup – beim Entfernen kann iOS die Daten der App löschen.', 'neu'],
    ['Startbildschirm', 'Beim Öffnen zeigt die App kurz Icon, Namen und Version – nur so lange, bis sie bereit ist, und nicht bei laufendem Training. Antippen blendet ihn sofort aus.', 'neu'],
    ['Ergebnis nach dem Rennen', 'Ab dem Tag nach einem A- oder B-Rennen fragt die Startseite nach deiner Zeit und speichert sie als Ergebnis – die Trainingstempos passen sich danach an. Bei Wings for Life trägst du die geschafften km ein (die Zeit kommt vom Catcher Car), beim Pace Race das Level. Die Frage bleibt, bis du das Ergebnis einträgst oder „Nicht gelaufen“ wählst.', 'neu'],
    ['Weitere Einheiten', 'Im Profil unter Trainingswoche gibt es jetzt bis zu vier weitere Einheiten, jede mit Tag und Art: lockerer Lauf, Regenerationslauf (sehr locker, 20–40 Min., Zone 1), zweite Qualität (die jeweils andere Einheit der Woche, in Erholung und Tapering locker) oder Anderes wie Rad oder Kurs. Läufe zählen beim Nachholen und Nachtragen mit; der Plan warnt bei zwei harten Tagen hintereinander. Die bisherige weitere Einheit wird übernommen.', 'neu'],
    ['Maximale HF', 'Unter Profil → Herzfrequenz lässt sich die maximale HF schätzen, wenn es noch keinen Testwert gibt: nach Tanaka und Nes statt „220 − Alter“. Ein gemessener Wert bleibt direkt eintragbar und ist immer genauer.', 'neu'],
    ['Lauf nachtragen', 'Ab dem Tag nach einem geplanten Lauf (Qualität, Laufgruppe, Longrun) fragt die Startseite nach den gelaufenen km, damit die Wochen-km stimmen. Die Frage bleibt, bis du die km einträgst oder „Nicht gelaufen“ wählst (die Einheit „entfällt“). Sind mehrere offen, steht der älteste Eintrag oben, die übrigen sind eingeklappt.', 'neu'],
    ['Was machst du?', 'Unter Profil → Trainingswoche (und in der Einrichtung) wählst du, was du machst: Kraft, Laufen, Mobility. Abgewähltes verschwindet aus der Leiste, der Startseite und dem Profil – ohne Laufen z. B. auch Herzfrequenz und Lauftage.', 'neu'],
    ['Finisher im Grätschsitz', 'Neuer Plan „Finisher“: kurzer Rumpf-Block mit einer Kettlebell im Grätschsitz – V-Chop, Lenkrad, Press-up & Press-out und Iron Arc als EMOM, 3 Runden = 12 Minuten (2–4 Runden wählbar). Passt nach einem lockeren Lauf oder ans Ende einer Krafteinheit.', 'neu'],
    ['Kurzhanteln', 'Neben Kettlebell und Bändern kannst du im Profil (und in der Einrichtung) Kurzhanteln mit ihren Gewichten eintragen. Jede Kraftübung hat eine Hantel-Variante mit Anleitung und Skizze; die App nimmt wie bisher je Übung die wirksamste Variante deiner Geräte – Swing und Halo bleiben mit Kettlebell, Seitheben geht zuerst mit Hanteln. Das Gewicht je Hantel stellst du je Übung oder für alle Hantel-Übungen eines Plans ein; Übungen mit zwei Hanteln zeigen „2 × 8 kg“.', 'neu'],
    ['Mobility planen', 'Mobility-Tage legst du im Profil fest, mit Routine je Tag (sonst die zuletzt genutzte). Am Tag steht sie unter „Heute dran“ mit „Starten“ und zählt in der Woche.', 'neu'],
    ['Weniger Tippen', 'Beim Nachtragen speichert „✓ 12 km · wie geplant“ (bzw. „wie letztes Mal“) mit einem Tipp. Die Bewertung nach dem Training speichert mit einem Tipp auf die Zahl. Ein Tag in der Wochenleiste zeigt, was geplant war, und hat „Eintragen“. In der Anleitung wischst du zur nächsten Übung.', 'neu'],
    ['Einrichtung', 'Beim ersten Start fragt die App kurz nach Laufen, Lauftagen, Krafttagen, Geräten, Puls und dem nächsten Rennen – je eine Antwort mit einem Tipp, alles überspringbar. Neu starten kannst du die Fragen jederzeit oben im Profil.', 'neu'],
    ['Wochenleiste', 'Unter „Diese Woche“ auf der Startseite zeigt eine Leiste Montag bis Sonntag: gefüllter Punkt = trainiert, Ring = geplant, grauer Ring = geplant, aber nichts eingetragen. Heute ist hervorgehoben.', 'neu'],
    ['Rückgängig statt Rückfrage', 'Läufe, Rennen, Ergebnisse, Messungen und Trainingseinträge löschst du jetzt ohne Rückfrage – dafür steht ein paar Sekunden „Rückgängig“ im Hinweis.', 'neu'],
    ['Jahresziel', 'Auf der Startseite legst du fest, wie viele km du im Jahr laufen willst, und siehst den Fortschritt mit dem Soll bis heute und einer Hochrechnung. Der Vorschlag kommt aus dem Vorjahr – bei Lücken aus den eingetragenen Wochen hochgerechnet – plus 5 %; plant der Saisonplan für deine Rennen mehr, gilt dieser Wert.', 'neu'],
    ['Sync-Ort in der Erinnerung', 'Nach dem ersten Sync fragt die App, wo du die Datei abgelegt hast. Die Sicherungs-Erinnerung nennt dann diesen Ort und speichert direkt die Sync-Datei.', 'neu'],
    ['Hotel-Plan im Urlaub', 'Während des Urlaubs gibt es unter Kraft den Reiter „Hotel“: nur Körpergewicht, ohne Sprünge, etwa 2 × 2 m Platz, Bett oder Stuhl als Hilfe, gut 25 Minuten. Krafttage im Urlaub schlagen auf der Startseite automatisch diesen Plan vor.', 'neu'],
    ['Gym/Kurs als Krafttag', 'Unter Profil → Trainingswoche kannst du für einen Krafttag „Gym/Kurs“ wählen und den Namen eintragen, z. B. Blaze. Auf der Startseite hakst du ihn ab, er zählt in der Woche als Kraft-Einheit und steht im Plan und im Kalender.', 'neu'],
    ['Reihenfolge nach Position', 'Die Kraftübungen kommen jetzt nach Position: erst alles im Stehen, dann Knien oder Sitzen, zum Schluss alles im Liegen – kein ständiges Hinlegen und Aufstehen mehr. Innerhalb einer Position bleibt die geplante Reihenfolge. Der Vergleich mit früheren Einheiten bleibt erhalten. Gilt für alle Zirkel, Tabata und EMOM, nicht für den Läufer-Plan mit Sätzen.', 'neu'],
    ['Anleitung im Training', 'Öffnest du während des Trainings die Anleitung, zeigt sie immer die aktuelle Übung – auch wenn Aufwärmen, Cooldown, Halteübungen oder Intervalle von selbst weiterschalten. Unten gibt es „Erledigt – nächste Übung“ bzw. „Nächste Übung“, du musst die Anleitung also nicht erst schließen.', 'neu'],
    ['Tabata als Zirkel', 'Tabata läuft jetzt als Zirkel: Übung 1 20 Sek., 10 Sek. Pause, Übung 2 und so weiter – nach der letzten Übung eine Rundenpause, standardmäßig 3 Runden. Die Ansage nennt in jeder Pause die nächste Übung. Ältere Tabata-Einheiten zählen nicht mehr in den Vergleich, weil der Ablauf ein anderer ist.', 'neu'],
    ['Lauf heute eintragen', 'Unter „Heute dran“ trägst du den Lauf des Tages direkt ein – mit Zeit und Ø-Puls, wenn du magst. Offene Läufe und Rennen von früher stehen jetzt mit dem neuesten zuerst da, und oben auf jeder Karte steht, für welchen Tag sie fragt („gestern“, „vor 3 Tagen“).', 'neu'],
    ['Zeit und Puls im Umfang', 'Auch unter Laufen → Umfang → Lauf eintragen gibt es jetzt Zeit, Ø-Puls und die Art des Laufs (sonst nach Plan) – mit derselben Auswertung wie auf der Startseite.', 'neu'],
    ['Datensicherheit', 'Aus einem Code-Review: Zurücksetzen der Testversion lässt die echte App in Ruhe, die App räumt nur ihre eigenen Offline-Daten auf, der Sync kommt mit einer falsch gehenden Uhr zurecht, eine Sicherung aus einer neueren Version verliert beim Import nichts, und unmögliche Daten wie der 31.02. werden abgelehnt.', 'neu'],
    ['Sicherung auf Android', 'Auf Android lädt „In Datei sichern“ die Sicherung jetzt direkt in den Ordner „Downloads“ – im Teilen-Menü fehlt dort je nach Gerät eine Möglichkeit, auf dem Gerät zu speichern.', 'neu'],
    ['Lauf auswerten', 'Beim Nachtragen auf der Startseite kannst du Zeit und Ø-Puls dazuschreiben. Die App zeigt dann, ob Tempo und Puls im empfohlenen Bereich lagen (locker: Zone 2 und dein lockeres Tempo, Regeneration: Zone 1), und gibt einen Tipp fürs nächste Mal. Bei Intervall- und Tempoeinheiten gibt es keine Wertung, weil der Durchschnitt dort wenig sagt.', 'neu'],
    ['B-Rennen im Plan', 'Bei jedem B-Rennen steht, was es in der Woche ersetzt und wie du es läufst: Es ersetzt die Qualität, ab Halbmarathon oder Longrun-Länge auch den Longrun. Ein deutlich kürzeres Rennen (z. B. 10 km im Marathonblock) läufst du als Tempoeinheit voll, sonst ist es ein Formtest. In Erholung und Tapering: locker, nicht auf Zeit.', 'neu'],
    ['Rennen im Umfang', 'Ergebnisse aus Rennen und Bestzeiten zählen automatisch in die Wochen-km und den längsten Lauf – an Tagen ohne eingetragenen Lauf, ab deinem ersten eingetragenen Lauf und nicht in Wochen mit eigener Wochensumme. Trägst du für den Tag einen Lauf ein, zählt nur der.', 'neu'],
    ['Bestzeiten', 'Wings for Life und Pace Race haben unter Bestzeiten eigene Reiter: weiteste Strecke bzw. bestes Level, mit Verbesserung und allen Ergebnissen.', 'neu'],
    ['Geräte je Plan', '„Heute dabei“ heißt jetzt „Geräte“ und gilt je Plan: z. B. Ganzkörper mit Kettlebell und Körpergewicht, Tabata nur Kettlebell, Läufer mit Band. Jeder Plan merkt sich seine Auswahl, sie wird mit den anderen Geräten abgeglichen. Bis du einen Plan umstellst, gilt die bisherige Auswahl.', 'neu'],
    ['Vorbereitung', 'Unter „Geräte“ und auf der Startseite beim Kraft-Eintrag steht, was du für den Plan bereitlegen solltest – aus den Übungen, die er gerade nutzt: Kettlebell mit Gewicht, Bänder, eine Matte bei Übungen am Boden, Stuhl oder Sofa zum Abstützen.', 'neu'],
    ['Urlaub', 'Profil → Geräte & Gewichte → Urlaub von–bis: In dieser Zeit ist in allen Plänen nur Körpergewicht vorgewählt, AMRAP und Core sind ausgeblendet. Im Urlaub dazugeschaltete Geräte gelten nur dort, danach gelten wieder deine Geräte je Plan.', 'neu'],
    ['Startseite', 'Beim Öffnen zeigt die App „Heute“: was heute dran ist (Kraft mit Start-Knopf, Läufe aus dem Plan, Lauf-Einstieg), die Woche auf einen Blick und je Bereich eine Kachel mit dem aktuellen Stand. Läuft gerade ein Training, geht es direkt zum Timer.', 'neu'],
    ['Plan je Krafttag', 'Je Krafttag lässt sich im Profil unter Trainingswoche ein fester Plan wählen, z. B. Mo Ganzkörper, Do Läufer. Wochenplanung, Startseite und Kalender zeigen ihn, „Starten“ auf der Startseite stellt ihn direkt ein. Standard bleibt „frei“: der zuletzt genutzte Plan.', 'neu'],
    ['Mobility', 'Bis zum Ende geführte Mobility-Routinen zählen jetzt für die Woche.', 'neu'],
    ['Wings for Life', 'Neu bei den Rennen: Wings for Life World Run mit Ziel in km. Die App rechnet aus dem Tempo des Catcher Cars, wann es dich dort einholt, und daraus deine Mindest-Pace – dazu, wie weit deine Form etwa reicht.', 'neu'],
    ['Pace Race', 'Neu bei den Rennen: Pace Race mit Ziel-Level. Die App zeigt das Zeitlimit der Zielrunde und plant 1-km-Wiederholungen mit 60 Sek. Pause bis ins Level-Tempo ein.', 'neu'],
    ['Dichte Rennen', 'Liegen zwei A-Rennen nah beieinander, bereitet der Plan beide zusammen vor: Vorher gilt jede zweite Qualitätseinheit schon dem späteren Rennen, Longrun und Wochen-km richten sich nach dem längeren. Fällt ein A-Rennen in die Erholung nach einem anderen oder in dessen Tapering, warnen Plan und Rennformular – eines davon besser als B-Rennen. B-Rennen in der Erholung laufen nur locker mit.', 'neu'],
    ['Navigation', 'Die untere Leiste hat jetzt „Start“ statt „Mehr“ – Mehr erreichst du über die Kachel auf der Startseite. Auf der Startseite selbst gibt es keine Leiste.', 'ux']
  ] },
  { id: '2026-11-03', aka: ['2026-11-03b', '2026-11-03c'], date: '2026-11-03', version: '1.0', title: 'Lauf-Einstieg, Trainingstempos, Testläufe, Abhaken, Stufen & Fehlerbehebungen', items: [
    ['Version 1.0', 'Die App hat jetzt eine Versionsnummer – das hier ist Version 1.0. Sie steht unten unter Mehr und bei den Neuigkeiten; jede wöchentliche Veröffentlichung bekommt die nächste Nummer.'],
    ['Lauf-Einstieg', 'Neu beim Laufen? Im Profil unter Trainingswoche das Laufniveau „Einsteiger“ wählen (oder die Frage in Plan → Übersicht beantworten): 9 Wochen mit je 3 Einheiten aus Laufen und Gehen bis zu 30 Minuten am Stück – geführt mit Ansagen, ohne Testlauf und ohne Tempovorgaben. Nach drei Einheiten weiter oder die Woche wiederholen.'],
    ['Laufen', 'Plan → Übersicht zeigt deine Tempos für locker, Schwelle, Intervall und Marathon – aus deiner aktuellen Form: dem neuesten Ergebnis, solange es höchstens 3 % langsamer ist als das beste der letzten 12 Monate. Die Wochenplanung schreibt sie zu den passenden Einheiten.'],
    ['Renntempo', 'Auch das Renntempo in den Einheiten kommt aus deiner Form statt aus der Zielzeit.'],
    ['Testlauf', 'Alle 8 Wochen ohne Ergebnis oder Rennen plant der Plan einen 5-km-Testlauf statt der Qualitätseinheit ein – aber erst, wenn 5 km machbar sind (längster Lauf der letzten 30 Tage bzw. geplanter Longrun mindestens 5 km). Ergebnis unter Bestzeiten eintragen – B-Rennen zählen genauso.'],
    ['Abhaken', 'Optional unter Profil → Trainingswoche: Einheiten im Plan abhaken und Verpasstes mit einem Tipp auf den nächsten passenden Tag derselben Woche legen. Gilt nur für die laufende Woche.'],
    ['Kraft & Laufen', 'Kraft und Laufen dürfen am selben Tag liegen: Ein nachgeholter Lauf rückt auch auf einen Krafttag, die Kraft bleibt – mit dem Hinweis, sie nach dem Lauf zu machen (nach Qualität oder Longrun ohne schwere Beinübungen). Verpasste Kraft lässt sich auch zu einem lockeren Lauf legen. An festen Krafttagen (im Profil wählbar) kommt kein Lauf dazu.'],
    ['Kalender', 'Der Plan-Export kann jetzt eine Erinnerung am Trainingstag mitbringen (Uhrzeit wählbar, Standard aus) – der Kalender meldet sich, auch wenn die App zu ist.'],
    ['Körpergewicht', 'Übungen ohne Gerät gibt es jetzt in drei Stufen – leicht, mittel, schwer. Einstellbar je Übung unter „Übungen & Varianten“; die Anleitung zeigt, wie die Übung leichter oder schwerer wird.'],
    ['App-Start', 'Zahlen werden schneller formatiert – der Start mit vielen Einträgen geht spürbar flotter.', 'ux'],
    ['Übungen & Varianten', '„Übungen & Varianten“ zeigt die Variantenauswahl und ihre Begründung nur noch, wenn es mit deinen Geräten wirklich eine Wahl gibt.', 'ux'],
    ['Profil, Mehr & Laufen', 'Weniger scrollen: Profil, Mehr und Laufen haben aufklappbare Bereiche – es ist immer nur einer offen, und die App merkt sich, welcher. Die zugeklappte Zeile zeigt das Wichtigste, z. B. deine Trainingstage oder das letzte Gewicht.', 'ux'],
    ['Im Training', 'Während eines Trainings sind die Hinweise oben und „Heute dabei“ ausgeblendet – der Timer steht sofort im Blick.', 'ux'],
    ['Wochenplanung', 'Wochenplanung: Die Knöpfe stehen unter dem Text, der dadurch die volle Breite bekommt. Kacheln stehen zu dritt nebeneinander, die Krafttage passen in eine Zeile, „Messung speichern“ geht über die volle Breite.', 'ux'],
    ['App installieren', 'Im Handy-Browser steht ein kompakter Hinweis „Als App installieren“ dauerhaft ganz oben, mit Link zur Anleitung. Die Anleitung erklärt auch, wie vorhandene Daten aus dem Browser in die App kommen.', 'ux'],
    ['Heute dabei', '„Heute dabei“: Kettlebell, Bänder und Körpergewicht stehen nebeneinander in einer Reihe, die Beschriftung darüber.', 'ux'],
    ['Übungen & Varianten', 'Übungen & Varianten: Übungsnamen antippen öffnet die Anleitung mit Skizze und Stufen – kein Hochscrollen zur Übungsliste mehr.', 'ux'],
    ['Neuigkeiten', 'Die Neuigkeiten sind nach Neu, Usability und Bugs gruppiert – statt bei jedem Punkt „Übersichtlicher“ oder „Behoben“ davorzuschreiben.', 'ux'],
    ['Laufen', 'Beim ersten Öffnen startet Laufen auf dem Reiter „Plan“ – dort beginnt auch der Lauf-Einstieg.', 'ux'],
    ['Körpermaße', 'Im Profil ist „Körpermaße“ beim ersten Öffnen zugeklappt wie die anderen Bereiche.', 'ux'],
    ['Hinweise', 'Bei den Hinweisen oben stand das Symbol in einer eigenen Zeile – jetzt links neben dem Text.', 'bug'],
    ['Profil → Geräte & Gewichte', 'Profil → Geräte & Gewichte: Das Eingabefeld für Kettlebells und Bänder nutzt die volle Breite – vorher war der Platzhalter abgeschnitten und daneben eine leere Lücke.', 'bug'],
    ['Android', 'Android: Die Tab-Leiste passt jetzt auch auf schmale Telefone – „Mehr“ war abgeschnitten. Auf sehr schmalen Displays werden Reiter nicht mehr gekürzt.', 'bug'],
    ['Kalender-Export', 'Kalender-Export: Testläufe heißen „Testlauf 5 km“. Ein vergangenes Rennen ohne eingetragenes Ergebnis verschiebt den Testlauf nicht mehr – der Plan erinnert stattdessen ans Eintragen.', 'bug'],
    ['Feste Krafttage', 'Feste Krafttage gelten nur noch für gewählte Krafttage – ein abgewählter und später wieder gewählter Tag ist nicht mehr unerwartet „fest“.', 'bug'],
    ['Einstellungen zurücksetzen', '„Einstellungen zurücksetzen“ setzt auch Haken und Verschiebungen der laufenden Woche zurück.', 'bug']
  ] },
  { id: '2026-11-02u', aka: ['2026-11-02b', '2026-11-02c', '2026-11-02d', '2026-11-02e'], date: '2026-11-02', title: 'Englisch, AMRAP, Erholung & Aufgeräumt', items: [
    ['Sprache', 'Die App gibt es jetzt auch auf Englisch. Automatisch nach Gerätesprache: Deutsch bei deutscher Gerätesprache, sonst Englisch.'],
    ['Mehr', 'Unter Mehr → Sprache lässt sich Deutsch oder Englisch fest einstellen.'],
    ['Ansagen', 'Sprachansagen kommen in der gewählten Sprache – mit einer Stimme, die auf dem Gerät läuft.'],
    ['Kraft', 'Neuer Plan „AMRAP“: 20 Minuten so viele Runden wie möglich mit einer Kettlebell – Rotational Thruster, Deadlift to Halo, Lunge to Press-out, Pullover mit Rotation und Cross-Body Lunge, jeweils mit Anleitung und Skizze.'],
    ['Ausstattung', 'Kraft bietet nur noch an, was du unter Profil → Geräte & Gewichte eingetragen hast: ohne Kettlebell keine Kettlebell-Übungen und -Pläne, ohne Bänder keine Band-Übungen.'],
    ['Neu eingerichtet', 'Wer neu startet, beginnt ohne Kettlebell und Bänder und trägt seine Geräte im Profil ein. Bestehende Einstellungen bleiben unverändert.'],
    ['Laufen', 'Nach dem A-Rennen zeigt der Plan in der Rennwoche und in den Erholungswochen, wie lange die Erholung nach der Distanz etwa dauert. Dazu neu unter Plan → Wissen: „Erholung nach dem Rennen“.'],
    ['Laufen', '„Wettkampf“ und „Training“ sind jetzt ein Reiter „Warm-up“: oben der Renntag (5 km bis Marathon), darunter Intervall, Speed und Longrun.', 'ux'],
    ['Körpermaße', 'Gewicht und Bauchumfang in einem Formular und einem Protokoll, Diagramm zum Umschalten, eine Erinnerung und ein CSV-Export für beides.', 'ux'],
    ['Skizzen', 'Ansicht von vorne in Lila, seitlich in Grün – jeweils mit kleiner Beschriftung.', 'ux'],
    ['Kraft', 'Die Wochenübersicht steht jetzt im Bereich Kraft; die Einstellung je Übung heißt „Übungen & Varianten“.', 'ux'],
    ['Sync & Backup', '„Sync speichern“ zählt als Sicherung; „Aus Datei wiederherstellen“ erkennt Sync-Dateien und gleicht sie richtig ab.', 'ux'],
    ['Erklärt', 'Plan → Wissen → „Zeiten & Prognosen“ und bei den Bestzeiten „So wird gerechnet“ zeigen, wie Pace, Zwischenzeiten und Prognosen entstehen.', 'ux'],
    ['Overlays', 'Ist eine Anleitung oder ein Fenster offen, scrollt die Seite dahinter nicht mehr mit.', 'ux'],
    ['Mehr', 'Doppelte Hinweise entfernt, der Rest steht in der Anleitung.', 'ux']
  ] },
  { id: '2026-11-02', date: '2026-11-02', title: 'Grundstand: alle Funktionen', items: [
    ['Kraft', 'Sechs Pläne für zu Hause: Ganzkörper-Zirkel, Tabata, Läufer (Sätze), Oberkörper-Zirkel, Core (EMOM mit Kettlebell) und Büro – jeweils mit Aufwärmen, Cooldown, Timer, Sprachansagen und Abhaken.'],
    ['Geräte & Varianten', '„Heute dabei“ (Kettlebell, Bänder, Körpergewicht) wählt je Übung die wirksamste Variante; Gewicht bzw. Band je Übung einstellbar.'],
    ['Fortschritt', 'Verlauf mit Diagramm, Bestwerte bei gleichem Aufbau, Anstrengung (1–10) und Notiz, Vorschläge zur Steigerung, Training nachtragen und Wochenübersicht mit Serie.'],
    ['Anleitungen', 'Jede Übung antippen: Skizze von Start und Bewegung, Ausführung, Wirkung und worauf du achten musst.'],
    ['Laufen → Warm-up', 'Warm-up und Cooldown für den Renntag (5 km bis Marathon) und fürs Training (Intervall, Speed, Longrun), dazu Lauf-ABC – geführt mit Countdown und Ansage.'],
    ['Laufen → Plan', 'A- und B-Rennen mit Datum und Distanz (auch eigene km). Je A-Rennen ein Block aus Grundlage, Aufbau, spezifischer Phase und Tapering, danach Erholung; jede Woche Longrun, Wochen-km und Qualitätseinheit auf deinen Trainingstagen. B-Rennen zählen in die Woche.'],
    ['Zielzeit', 'Bestimmt Ziel-Longrun und Wochenumfang; Tempo-Einheiten zeigen dein Renntempo pro Kilometer. Renntempo-Rechner mit Zwischenzeiten, dazu Wissen zu Pacing, Tapering, Verpflegung und Rennwoche.'],
    ['Bestzeiten', 'Ergebnisse je Distanz eintragen oder aus Rennen übernehmen; neue Bestzeiten werden erkannt, die Verbesserung als Grafik gezeigt, dazu eine Prognose für die anderen Distanzen.'],
    ['Laufen → Umfang', 'Läufe mit Datum oder Wochensummen, CSV-Import mit Vorlage. Nächster Longrun höchstens +10 % gegenüber dem längsten der letzten 30 Tage, Zielbereich der Woche, Verlauf über 8 Wochen.'],
    ['Kalender-Export', 'Saisonplan mit Wochen, Longruns, Qualität, Kraft und Rennen als Kalenderdatei.'],
    ['Mobility', 'Kurzprogramme für Läufer (Nach dem Laufen, Hüfte, Sprunggelenk) und den Alltag (Morgens, Nach dem Sitzen) sowie Einzelübungen nach Körperbereich – geführt Schritt für Schritt.'],
    ['Profil', 'Trainingswoche mit festen Tagen (abschaltbar, „Entfällt“ für einzelne Wochen), Herzfrequenz-Zonen (der Plan zeigt deine bpm), eigene Kettlebells und Bänder, Körpermaße (Gewicht und Bauchumfang mit Trend), Ton und Ansagen.'],
    ['Geräte-Sync (optional)', 'Eine Sync-Datei in iCloud Drive, Google Drive & Co. hält iPhone, iPad, Mac und PC auf dem gleichen Stand. Ohne Sync bleibt alles nur auf dem Gerät.'],
    ['Daten & Datenschutz', 'Alles bleibt lokal auf dem Gerät, keine Verbindung zu fremden Servern. Backup und Wiederherstellen, CSV-Export, automatische Sicherung vor Updates, Einstellungen zurücksetzen und Werkseinstellung.'],
    ['App', 'Als WebApp auf den Home-Bildschirm, funktioniert offline, hell und dunkel, Darstellung für iPhone und Android. Neuigkeiten wie diese erscheinen nach Updates einmal und stehen unter Mehr.']
  ] }
];
// Jeder Punkt: [Thema, Text, Art]. Art: 'neu' (Standard), 'ux' (Usability) oder 'bug' – die Neuigkeiten gruppieren danach.
const NOTE_KINDS = [['neu', 'Neu', 'New'], ['ux', 'Usability', 'Usability'], ['bug', 'Bugs', 'Bugs']];
CHANGELOG.forEach(c => c.items.forEach(it => { if (!NOTE_KINDS.some(k => k[0] === it[2])) it[2] = 'neu'; }));
