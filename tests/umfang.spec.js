const fs = require('fs');
const { test, expect } = require('./fixtures');

// Wochen relativ zu heute: 0 = laufende Woche, 1 = Vorwoche usw.
const weeksAgo = page => page.evaluate(() => [0, 1, 2, 3, 4, 5].map(i => addDays(weekStart(localDay()), -7 * i)));
async function openUmfang(page) {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="umfang"]');
  await expect(page.locator('#runsub')).toBeHidden();
}
const field = (w, f = 'km') => `[data-wk="${w}"][data-f="${f}"]`;

test('Umfang: Schnitt der letzten 4 Wochen, Zielbereich, langer Lauf – bleibt gespeichert', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await expect(page.locator('#loadresult')).toContainText('Trag zuerst deine km');
  for (let i = 1; i <= 4; i++) await page.fill(field(w[i]), '15');
  await page.fill(field(w[1], 'long'), '8');
  await page.fill(field(w[2], 'long'), '9');
  await page.fill(field(w[3], 'long'), '10');
  await page.fill(field(w[4], 'long'), '14'); // älter als 4 Wochen inkl. dieser – zählt nicht für den langen Lauf
  await page.fill(field(w[0]), '8');
  await page.fill(field(w[0], 'long'), '6');
  const m = page.locator('#loadresult .metric b');
  await expect(m).toHaveText(['15 km', '8 km', '≤ 11 km']);
  await expect(page.locator('#loadresult .loadstatus')).toHaveText('Bisher 8 km. Noch 4 km bis zum Erhalt (12–15 km), Aufbau bis 19,5 km.');
  await expect(page.locator('#loadresult svg')).toHaveCount(1);
  await expect(page.locator('#loadchart rect.bar')).toHaveCount(5);

  // Komma-Eingabe
  await page.fill(field(w[0]), '12,5');
  await expect(m.nth(1)).toHaveText('12,5 km');
  await expect(page.locator('#loadresult .loadstatus')).toHaveText('Im Erhalt. Für Aufbau 15–19,5 km – noch bis zu 7 km diese Woche.');
  await page.fill(field(w[0]), '17');
  await expect(page.locator('#loadresult .loadstatus')).toHaveText('Im Aufbau. Obergrenze 19,5 km – noch 2,5 km diese Woche.');
  await page.fill(field(w[0]), '21');
  await expect(page.locator('#loadresult .loadstatus')).toContainText('Über der Obergrenze von 19,5 km (1,4 × Schnitt)');
  await expect(page.locator('#loadchart rect.bar.over')).toHaveCount(1);

  // Ungültige Eingabe wird markiert und nicht gespeichert
  await page.fill(field(w[1]), 'abc');
  await expect(page.locator(field(w[1]))).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(wk => weekKm(wk), w[1])).toBe(15);
  await page.fill(field(w[1]), '15');

  await page.reload();
  await page.evaluate(() => showArea('laufen'));
  await expect(page.locator('[data-runtab="umfang"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(field(w[2]))).toHaveValue('15');
  await expect(page.locator(field(w[0]))).toHaveValue('21');
  await expect(page.locator('#loadresult .metric b').first()).toHaveText('15 km');
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

test('Umfang: im Backup enthalten, Import ergänzt nur fehlende Wochen', async ({ page }) => {
  const w = await weeksAgo(page);
  await openUmfang(page);
  await page.fill(field(w[1]), '30');
  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await page.click('#savefile');
  const backup = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
  expect(backup.runWeeks).toEqual([{ week: w[1], km: 30, long: null }]);

  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, entries: [], runWeeks: [{ week: w[1], km: 99, long: null }, { week: w[2], km: 25, long: 12 }, { week: 'kaputt', km: 1 }] })) });
  await expect.poll(() => page.evaluate(() => runWeeks.length)).toBe(2);
  expect(await page.evaluate(ws => [weekKm(ws[1]), weekKm(ws[2]), weekKm(ws[2], 'long')], w)).toEqual([30, 25, 12]);
});
