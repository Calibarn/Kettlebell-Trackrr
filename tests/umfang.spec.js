const fs = require('fs');
const { test, expect, openSect } = require('./fixtures');

// Wochen relativ zu heute: 0 = laufende Woche (Montag), 1 = Vorwoche usw.
const weeksAgo = page => page.evaluate(() => [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart(localDay()), -7 * i)));
async function openUmfang(page) {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="umfang"]');
  await expect(page.locator('#runsub')).toBeHidden();
  await openSect(page, 'sect-weeks'); // Wochensummen sind aufklappbar
}
const field = (w, f = 'km') => `[data-wk="${w}"][data-f="${f}"]`;
async function addRun(page, date, km) {
  await page.fill('#rundate', date);
  await page.fill('#runkm', km);
  await page.click('#runaddbtn');
}

test('Umfang mit Wochensummen: Schnitt, Zielbereich, langer Lauf – bleibt gespeichert', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await expect(page.locator('#loadresult')).toContainText('Trag zuerst deine km');
  await expect(page.locator('#longresult')).toContainText('Trag Läufe mit Datum ein');
  for (let i = 1; i <= 4; i++) await page.fill(field(w[i]), '15');
  await page.fill(field(w[1], 'long'), '8');
  await page.fill(field(w[2], 'long'), '10');
  await page.evaluate(ws => setWeekKm(ws[6], 'long', 14), w); // liegt sicher außerhalb der 30 Tage
  await page.fill(field(w[0]), '8');
  await expect(page.locator('#loadresult .metric b')).toHaveText(['15 km', '8 km']);
  await expect(page.locator('#loadresult .loadstatus')).toHaveText('Bisher 8 km. Noch 4 km bis zum Erhalt (12–15 km), Aufbau bis 19,5 km.');
  await expect(page.locator('#longresult b')).toHaveText('höchstens 11 km');
  await expect(page.locator('#longresult')).toContainText('aus der Wochensumme');
  await expect(page.locator('#loadchart rect.bar')).toHaveCount(5);

  await page.fill(field(w[0]), '12,5');
  await expect(page.locator('#loadresult .loadstatus')).toHaveText('Im Erhalt. Für Aufbau 15–19,5 km – noch bis zu 7 km diese Woche.');
  await page.fill(field(w[0]), '21');
  await expect(page.locator('#loadresult .loadstatus')).toContainText('Über der Obergrenze von 19,5 km (1,4 × Schnitt)');
  await expect(page.locator('#loadchart rect.bar.over')).toHaveCount(1);

  await page.fill(field(w[1]), 'abc');
  await expect(page.locator(field(w[1]))).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(wk => weekKm(wk), w[1])).toBe(15);
  await page.fill(field(w[1]), '15');

  await page.reload();
  await page.evaluate(() => showArea('laufen'));
  await expect(page.locator('[data-runtab="umfang"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(field(w[2]))).toHaveValue('15');
  await expect(page.locator(field(w[0]))).toHaveValue('21');
});

test('Umfang mit einzelnen Läufen: Wochen werden summiert, 30 Tage taggenau, Sprünge markiert', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await addRun(page, w[5], '20');          // 35+ Tage her: zählt nicht mehr für den langen Lauf
  await addRun(page, w[1], '12');
  await addRun(page, await page.evaluate(x => addDays(x, 2), w[1]), '9,5');
  await addRun(page, w[0], '15');          // +25 % gegenüber dem längsten der 30 Tage davor (12 km)
  await expect(page.locator(field(w[1]))).toHaveValue('21,5');
  await expect(page.locator(field(w[1]))).toBeDisabled();
  await expect(page.locator(field(w[1], 'long'))).toHaveValue('12');
  await expect(page.locator('#kmweeks')).toContainText('aus 2 Läufen');
  await expect(page.locator('#longresult b')).toHaveText('höchstens 16,5 km');
  await expect(page.locator('#runlist .row')).toHaveCount(3);
  await expect(page.locator('#runlist .spike')).toHaveText(['+25 % gegenüber dem längsten der 30 Tage davor']);
  await expect(page.locator('#loadresult .metric b').nth(1)).toHaveText('15 km');

  // Ungültige km werden nicht gespeichert
  await page.fill('#runkm', '0');
  await page.click('#runaddbtn');
  await expect(page.locator('#runkm')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => runLog.length)).toBe(4);

  // Löschen: Wochenwert fällt auf die (leere) Wochensumme zurück, Feld wird wieder editierbar
  await page.locator('#runlist [data-rundel]').first().click();
  await expect(page.locator('#runlist .row')).toHaveCount(2);
  await expect(page.locator(field(w[0]))).toBeEnabled();
  await expect(page.locator('#longresult b')).toHaveText('höchstens 13,2 km');

  await page.reload();
  expect(await page.evaluate(() => runLog.map(r => r.km))).toEqual([20, 12, 9.5]);
});

test('Umfang: weniger als 4 Wochen → vorläufig; Pausenwochen zählen als 0', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await page.fill(field(w[1]), '20');
  await page.fill(field(w[2]), '10');
  await expect(page.locator('#loadresult .metric small').first()).toHaveText('vorläufig: 2 von 4 Wochen');
  await expect(page.locator('#loadresult .metric b').first()).toHaveText('15 km');
  await page.fill(field(w[3]), '0');
  await page.fill(field(w[4]), '0');
  await expect(page.locator('#loadresult .metric b').first()).toHaveText('7,5 km');
  await page.fill(field(w[1]), '');
  await page.fill(field(w[2]), '');
  await expect(page.locator('#loadresult .loadstatus')).toContainText('Die letzten Wochen stehen auf 0 km');
});

test('Umfang: Wochen und Läufe im Backup, Import ergänzt nur Fehlendes', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await page.fill(field(w[2]), '30');
  await addRun(page, w[1], '10');
  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-data');
  await page.click('#savefile');
  const backup = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
  expect(backup.runWeeks).toEqual([{ week: w[2], km: 30, long: null }]);
  expect(backup.runLog.map(r => [r.date, r.km])).toEqual([[w[1], 10]]);

  const runId = backup.runLog[0].id;
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 3, entries: [],
    runWeeks: [{ week: w[2], km: 99, long: null }, { week: w[3], km: 25, long: 12 }, { week: 'kaputt', km: 1 }],
    runLog: [{ id: runId, date: w[1], km: 50 }, { id: 'neu', date: w[4], km: 8 }, { id: 'x', date: w[4], km: -3 }]
  })) });
  await expect.poll(() => page.evaluate(() => [runWeeks.length, runLog.length])).toEqual([2, 2]);
  expect(await page.evaluate(ws => [weekKm(ws[2]), weekKm(ws[3]), weekKm(ws[1]), weekKm(ws[4])], w)).toEqual([30, 25, 10, 8]);
});

test('Umfang: Läufe aus CSV importieren, Vorlage herunterladen, Duplikate und Fehler melden', async ({ page }) => {
  await openUmfang(page);
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-csv');
  await page.click('#runcsvtpl');
  const d = await dl;
  expect(d.suggestedFilename()).toBe('laeufe-vorlage.csv');
  const tpl = require('fs').readFileSync(await d.path(), 'utf8');
  expect(tpl.replace(/^﻿/, '').split('\r\n')[0]).toBe('Datum;km');
  // Vorlage unverändert importieren: nichts passiert (Beispielzeilen sind Kommentare)
  expect(await page.evaluate(t => parseRunCsv(t).add.length, tpl)).toBe(0);

  const w = await weeksAgo(page), de = x => x.split('-').reverse().join('.');
  const day = (i, n = 0) => de(n ? w2[i] : w[i]), w2 = await page.evaluate(ws => ws.map(x => addDays(x, 2)), w);
  await addRun(page, w[1], '8');
  const csv = ['﻿Datum;km', `${day(1)};8`, `${day(1, 2)};10,5`, `${w[2]};"12,3"`, `${day(3)};5 km`, '32.13.2026;7', `${day(2)};0`, 'irgendwas', '', `# ${day(4)};9`].join('\r\n');
  await page.setInputFiles('#runcsvfile', { name: 'laeufe.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('#runcsvmsg')).toContainText('3 Läufe importiert, 1 doppelt übersprungen. 3 Zeilen nicht lesbar (Zeile 6, 7, 8)');
  expect(await page.evaluate(() => runLog.map(r => r.km).sort((a, b) => a - b))).toEqual([5, 8, 10.5, 12.3]);
  await expect(page.locator(`[data-wk="${w[1]}"][data-f="km"]`)).toHaveValue('18,5');

  // englisches Format mit Komma als Trenner und eigener Spaltenreihenfolge
  const en = ['date,activity,distance', `${w[4]},Run,6.2`, `${w[4]}T07:30:00,Run,3`].join('\n');
  expect(await page.evaluate(t => parseRunCsv(t).add.map(r => [r.date, r.km]), en)).toEqual([[w[4], 6.2], [w[4], 3]]);
  // Zukunft wird abgelehnt
  expect(await page.evaluate(() => parseRunCsv(`Datum;km\n${addDays(localDay(), 3)};5`).bad)).toEqual([2]);
});

test('Rennen füllen Lücken im Umfang: ab dem ersten Lauf, nur an Tagen ohne Lauf, nicht in Wochen mit Wochensumme', async ({ page }) => {
  const r = await page.evaluate(() => {
    const d = n => addDays(localDay(), n), out = {};
    // Läufe vor 10 und 3 Tagen; Rennen vor 12 (vor dem ersten Lauf), 6 (Lücke) und 3 Tagen (da ist schon ein Lauf)
    runLog = [{ id: 'a', date: d(-10), km: 8 }, { id: 'b', date: d(-3), km: 6 }]; persistRunLog();
    results = [{ id: 'x1', date: d(-12), km: 10, time: 3000, dist: '10k', name: 'Vorher' }, { id: 'x2', date: d(-6), km: 21.0975, time: 7200, dist: 'hm', name: 'Stadt-HM' }, { id: 'x3', date: d(-3), km: 5, time: 1500, dist: '5k', name: 'Parkrun' }]; persistResults();
    races = [{ id: 'p', name: 'Pace Race', date: d(-5), dist: '10k', prio: 'A', goal: null, km: 12, fmt: 'pace', level: 11.753 }]; persistRaces();
    out.runs = allRuns().map(x => [x.id, x.km]);
    out.longest = longestIn(localDay()).km;
    out.stored = runLog.length; // nichts gespeichert
    // ein eingetragener Lauf am Renntag ersetzt das Rennen
    addRun(d(-6), 21.4); out.replaced = allRuns().filter(x => x.date === d(-6)).map(x => x.km);
    // ohne eingetragene Läufe zählen Rennen nicht (die Woche wäre unvollständig)
    const keep = runLog; runLog = []; out.none = raceRuns().length; runLog = keep;
    // Woche, die über ihre Wochensumme zählt: die enthält das Rennen schon
    runLog = [{ id: 'c', date: d(-40), km: 5 }]; runWeeks = [{ week: weekStart(d(-6)), km: 40, long: null }];
    out.sum = [weekKm(weekStart(d(-6))), raceRuns().some(x => x.date === d(-6))];
    return out;
  });
  expect(r.runs).toEqual([['a', 8], ['race-x2', 21.1], ['race-p', 11.8], ['b', 6]]);
  expect([r.longest, r.stored, r.replaced, r.none]).toEqual([21.1, 2, [21.4], 0]);
  expect(r.sum).toEqual([40, false]);
});

test('Umfang zeigt Rennen aus dem Ergebnis ohne Löschen; Ergebnis speichern meldet die km', async ({ page }) => {
  await page.evaluate(() => {
    const d = n => addDays(localDay(), n);
    runLog = [{ id: 'a', date: d(-10), km: 8 }]; persistRunLog(); runWeeks = []; persistRunWeeks();
    storeResult({ id: 'x2', date: d(-4), km: 21.0975, time: 7200, dist: 'hm', name: 'Stadt-HM' });
  });
  await expect(page.locator('#toast')).toContainText('21,1 km im Umfang');
  await openUmfang(page);
  await expect(page.locator('#runlist .racerun')).toContainText('Stadt-HM · aus dem Ergebnis');
  await expect(page.locator('#runlist .racerun [data-rundel]')).toHaveCount(0);
  await expect(page.locator('#runlist [data-rundel]')).toHaveCount(1);
});

test('Zeit, Ø-Puls und Art des Laufs bleiben beim Import einer Sicherung erhalten, Ungültiges fällt weg', async ({ page }) => {
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, entries: [],
    runLog: [{ id: 'r1', date: '2026-10-20', km: 12, sec: 4300, hr: 141, kind: 'long' }, { id: 'r2', date: '2026-10-22', km: 6, sec: 5, hr: 999, kind: 'quatsch' }] })) });
  await expect.poll(() => page.evaluate(() => runLog.length)).toBe(2);
  expect(await page.evaluate(() => runLog.map(r => JSON.stringify(r)))).toEqual(['{"id":"r1","date":"2026-10-20","km":12,"sec":4300,"hr":141,"kind":"long"}', '{"id":"r2","date":"2026-10-22","km":6}']);
});
