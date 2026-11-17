// Intervalle (ab 1.6): je Wiederholung Strecke, Zeit und Max-Puls eintragen, Vergleich mit der letzten gleich aufgebauten Einheit,
// Fortschritt unter Laufen → Läufe (VO2max und Intervalle im Verlauf).
const { test, expect, openSect } = require('./fixtures');

const setupQualityToday = page => page.evaluate(() => {
  const wd = new Date(localDay() + 'T12:00:00').getDay();
  results = [{ id: 'a', date: addDays(localDay(), -30), km: 10, time: 3300, dist: '10k' }]; persistResults();
  races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 120), dist: 'hm', prio: 'A', goal: null }]; persistRaces();
  Object.assign(profile.week, { runner: 'runner', quality: wd, long: (wd + 4) % 7, group: null, extras: [], strength: [], mobility: [] }); persistProfile();
  runLog = []; persistRunLog(); localStorage.removeItem(KEYS.runask); startFeedback = null;
});

test('Eingabe: Aufbau aus dem Plan, Strecke in m oder km, Zeit als 4:05', async ({ page }) => {
  const r = await page.evaluate(() => ({
    plan: ['4 × 6 Min. Schwelle, 90 Sek. Trabpause', '12 × 400 m etwas schneller als 5-km-Tempo', '3 × 2 km im Renntempo', 'Locker 40 Min.', '8 × 30 Sek. zügig'].map(repPlan),
    km: ['400', '0,4', '1,02', '1000 m', '', 'x'].map(repKmIn), sec: ['4:05', '4,05', '6', '', '4:75', 'abc'].map(repSecIn),
    key: [repKey([{ sec: 360, km: 1.02 }, { sec: 360, km: 1.05 }]).label, repKey([{ km: 0.4, sec: 101 }, { km: 0.4, sec: 98 }]).label, repKey([{ km: 2, sec: 600 }, { km: 1, sec: 290 }]).label]
  }));
  expect(r.plan).toEqual([{ n: 4, sec: 360 }, { n: 12, km: 0.4 }, { n: 3, km: 2 }, null, { n: 8, sec: 30 }]);
  expect(r.km).toEqual([0.4, 0.4, 1.02, 1, null, NaN]);
  expect(r.sec).toEqual([245, 245, 360, null, NaN, NaN]);
  expect(r.key).toEqual(['2 × 6 Min.', '2 × 400 m', '2 Intervalle']);
});

test.describe('mit Startseite', () => {
  test.use({ start: true });

  test('Intervall heute eintragen: Raster vorbelegt, Summe live, Auswertung je Intervall und Vergleich mit dem letzten Mal', async ({ page }) => {
    await setupQualityToday(page);
    // die letzte gleich aufgebaute Einheit (4 × 6 Min.) vor einer Woche
    await page.evaluate(() => { runLog = [{ id: 'alt', date: addDays(localDay(), -7), km: 9, kind: 'quality', reps: [1.0, 1.01, 0.99, 1.0].map((km, i) => ({ km, sec: 360, max: 175 + (i % 2) })) }]; persistRunLog(); showArea('start'); });
    await page.click('[data-logtoday]');
    const box = page.locator('#srunreps-90');
    await expect(box).toBeVisible();
    await expect(page.locator('#srunreps-90-n')).toHaveValue('4');
    await expect(box.locator('[data-f="sec"]')).toHaveCount(4);
    for (let i = 0; i < 4; i++) await expect(box.locator('[data-f="sec"]').nth(i)).toHaveValue('6:00');
    await expect(page.locator('#startrun-90 [data-runquick]')).toHaveCount(0); // „wie letztes Mal“ würde die Intervalle übergehen
    const km = ['1,05', '1,06', '1,04', '1,05'], max = ['172', '173', '174', '174'];
    for (let i = 0; i < 4; i++) { await box.locator('[data-f="km"]').nth(i).fill(km[i]); await box.locator('[data-f="max"]').nth(i).fill(max[i]); }
    await expect(page.locator('#srunreps-90-sum')).toHaveText('4 × 6 Min. · 4,2 km · 24:00 · Ø 5:43 /km · Max-Puls Ø 173 (bis 174)');
    // ungültig: Max-Puls 300 → nichts gespeichert
    await box.locator('[data-f="max"]').nth(2).fill('300');
    await page.fill('#srunkm-90', '9,2');
    await page.click('#startrun-90 [data-runsave]');
    await expect(box.locator('[data-f="max"]').nth(2)).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => runLog.length)).toBe(1);
    await box.locator('[data-f="max"]').nth(2).fill('174');
    await page.fill('#srunhr-90', '150');
    await page.click('#startrun-90 [data-runsave]');
    const run = await page.evaluate(() => runLog.find(r => r.id !== 'alt'));
    expect(run).toMatchObject({ km: 9.2, hr: 150, kind: 'quality', reps: [{ km: 1.05, sec: 360, max: 172 }, { km: 1.06, sec: 360, max: 173 }, { km: 1.04, sec: 360, max: 174 }, { km: 1.05, sec: 360, max: 174 }] });
    const fb = page.locator('#startfb');
    await expect(fb.locator('.repfbhead')).toHaveText('4 × 6 Min. · 4,2 km · 24:00 · Ø 5:43 /km · Max-Puls Ø 173 (bis 174)');
    await expect(fb.locator('.reptab li')).toHaveCount(5);
    await expect(fb.locator('.reptab li').nth(1)).toHaveText(/1\s*1,05 km\s*6:00\s*5:43\s*172/);
    await expect(fb.locator('.repfb .sfbtext.good')).toContainText('✓ 17 s/km schneller, Max-Puls 3 niedriger');
    await expect(fb.locator('.repfb .sfbtext')).toContainText('Letztes Mal (');
    // Durchschnitt des ganzen Laufs wird bei Intervallen nicht bewertet – dafür die Intervalle
    await expect(fb).not.toContainText('sagt der Durchschnitt wenig');
  });

  test('Nachtragen: Intervalle nur bei Art Intervall/Tempo', async ({ page }) => {
    await page.evaluate(() => { const wd = new Date(addDays(localDay(), -1) + 'T12:00:00').getDay();
      Object.assign(profile.week, { runner: 'runner', quality: wd, long: null, group: null, extras: [], strength: [] }); persistProfile();
      races = []; persistRaces(); runLog = []; persistRunLog(); localStorage.removeItem(KEYS.runask); showArea('start'); });
    await page.click('#startpend [data-pendopen]');
    await expect(page.locator('#srunreps')).toBeVisible();
    await page.selectOption('#srunkind', 'group');
    await expect(page.locator('#srunreps')).toBeHidden();
    await page.evaluate(() => { document.querySelector('#srunreps [data-f="max"]').value = '999'; }); // versteckt: wird nicht geprüft und nicht gespeichert
    await page.fill('#srunkm', '8');
    await page.click('#startrun [data-runsave]');
    expect(await page.evaluate(() => runLog.map(r => [r.kind, 'reps' in r]))).toEqual([['group', false]]);
  });
});

test('Läufe: Intervalle eintragen, Anzahl ändern, bearbeiten; Fortschritt mit VO2max und Intervallen', async ({ page }) => {
  await setupQualityToday(page);
  await page.evaluate(() => { vo2s = []; persistVo2(); showArea('laufen'); runView.tab = 'laeufe'; renderRun(); });
  // heute ist Qualitätstag: „nach Plan“ zeigt das Raster, vorbelegt mit 4 × 6:00
  await expect(page.locator('#runreps')).toBeVisible();
  await page.selectOption('#runkind', 'easy');
  await expect(page.locator('#runreps')).toBeHidden();
  await page.selectOption('#runkind', 'quality');
  await expect(page.locator('#runreps')).toBeVisible();
  // Anzahl 4 → 5: neue Zeile übernimmt Strecke/Zeit der letzten, Eingaben bleiben
  await page.locator('#runreps [data-f="km"]').first().fill('400');
  await page.fill('#runreps-n', '5'); await page.locator('#runreps-n').dispatchEvent('change');
  await expect(page.locator('#runreps [data-f="km"]')).toHaveCount(5);
  await expect(page.locator('#runreps [data-f="km"]').first()).toHaveValue('400');
  await expect(page.locator('#runreps [data-f="sec"]').nth(4)).toHaveValue('6:00');
  await page.fill('#runreps-n', '2'); await page.locator('#runreps-n').dispatchEvent('change');
  await expect(page.locator('#runreps [data-f="km"]')).toHaveCount(2);
  await page.locator('#runreps [data-f="km"]').nth(1).fill('0,4');
  await page.locator('#runreps [data-f="sec"]').nth(0).fill('1:40'); await page.locator('#runreps [data-f="sec"]').nth(1).fill('1:38');
  await page.fill('#runkm', '6');
  await page.click('#runaddbtn');
  expect(await page.evaluate(() => runLog.map(r => r.reps))).toEqual([[{ km: 0.4, sec: 100 }, { km: 0.4, sec: 98 }]]);
  await expect(page.locator('#runlist .repmini')).toHaveText('2 × 400 m · Ø 4:08 /km');
  await expect(page.locator('#runfb .repfb')).toContainText('Beim nächsten Mal 2 × 400 m siehst du hier den Vergleich.');
  // bearbeiten: Raster mit den gespeicherten Werten; Art ändern entfernt die Intervalle
  await page.click('#runlist [data-runedit]');
  await expect(page.locator('#runreps [data-f="km"]')).toHaveCount(2);
  await expect(page.locator('#runreps [data-f="km"]').first()).toHaveValue('400');
  await page.locator('#runreps [data-f="max"]').first().fill('181');
  await page.click('#runaddbtn');
  expect(await page.evaluate(() => runLog[0].reps[0])).toEqual({ km: 0.4, sec: 100, max: 181 });
  // Fortschritt: VO2max eintragen (Prüfung, gleicher Tag überschreibt, löschen mit Rückgängig)
  await openSect(page, 'sect-progress');
  await expect(page.locator('#sect-progress summary')).toContainText('2 × 400 m Ø 4:08 /km');
  await page.fill('#vo2val', '9'); await page.click('#vo2save');
  await expect(page.locator('#vo2val')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#vo2val', '37,4'); await page.click('#vo2save');
  await page.fill('#vo2date', await page.evaluate(() => addDays(localDay(), -28))); await page.fill('#vo2val', '36,2'); await page.click('#vo2save');
  expect(await page.evaluate(() => vo2s)).toEqual([{ date: await page.evaluate(() => addDays(localDay(), -28)), v: 36.2 }, { date: await page.evaluate(() => localDay()), v: 37.4 }]);
  await expect(page.locator('#sect-progress .prognum')).toHaveText('37,4');
  await expect(page.locator('#sect-progress .progtitle').first()).toContainText('+1,2 seit');
  await expect(page.locator('#sect-progress svg.chart')).toHaveCount(1);
  await page.fill('#vo2val', '38'); await page.click('#vo2save'); // heute nochmal → überschreibt
  expect(await page.evaluate(() => vo2s.map(e => e.v))).toEqual([36.2, 38]);
  await page.locator('[data-vo2del]').first().click();
  expect(await page.evaluate(() => vo2s.map(e => e.v))).toEqual([36.2]);
  await page.click('#toastundo');
  expect(await page.evaluate(() => vo2s.map(e => e.v))).toEqual([36.2, 38]);
  // Sicherung enthält VO2max und Intervalle; Import auf leerem Gerät stellt sie wieder her
  const json = await page.evaluate(() => backupJson());
  expect(JSON.parse(json).vo2).toHaveLength(2);
  await page.evaluate(() => { vo2s = []; persistVo2(); runLog = []; persistRunLog(); });
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect.poll(() => page.evaluate(() => [vo2s.length, runLog.length && runLog[0].reps.length])).toEqual([2, 2]);
  // eine Datei nur mit VO2max-Werten (z. B. aus der Health-App übertragen) lässt sich ebenfalls importieren
  await page.evaluate(() => { vo2s = []; persistVo2(); });
  await page.setInputFiles('#importfile', { name: 'vo2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, entries: [], vo2: [{ date: '2026-08-23', v: 50.1 }, { date: '2026-11-17', v: 42.5 }, { date: 'kaputt', v: 1 }] })) });
  await expect.poll(() => page.evaluate(() => vo2s.map(e => e.v))).toEqual([50.1, 42.5]);
});

test('Fortschritt: gleich aufgebaute Einheiten im Verlauf (Ø-Tempo und Max-Puls), andere Aufbauten getrennt', async ({ page }) => {
  await page.evaluate(() => {
    const d = n => addDays(localDay(), -n), mk = (n, km, max) => ({ id: 'q' + n, date: d(n), km: 9, kind: 'quality', reps: [0, 1, 2, 3].map(() => ({ km, sec: 360, max })) });
    runLog = [mk(28, 0.98, 176), mk(21, 1.0, 175), mk(14, 1.02, 174), { id: 's', date: d(10), km: 7, kind: 'quality', reps: [0, 1, 2, 3, 4, 5].map(() => ({ km: 0.4, sec: 100 })) }, mk(7, 1.05, 172)];
    persistRunLog(); showArea('laufen'); runView.tab = 'laeufe'; renderRun(); document.getElementById('sect-progress').open = true;
  });
  const blocks = page.locator('#sect-progress .progblock');
  await expect(blocks).toHaveCount(3); // VO2max, 4 × 6 Min. (zuletzt), 6 × 400 m
  await expect(blocks.nth(1).locator('.progtitle')).toContainText('4 × 6 Min.');
  await expect(blocks.nth(1).locator('.progtitle')).toContainText('4× seit');
  await expect(blocks.nth(1).locator('.progline')).toHaveText('Ø 6:07 → 5:43 /km (−24 s) · Max-Puls Ø 176 → 172');
  await expect(blocks.nth(1).locator('svg.chart')).toHaveCount(1);
  await expect(blocks.nth(2).locator('.progtitle')).toContainText('6 × 400 m');
  await expect(blocks.nth(2).locator('svg.chart')).toHaveCount(0);
});
