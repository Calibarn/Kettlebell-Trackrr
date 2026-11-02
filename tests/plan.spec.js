const { test, expect } = require('./fixtures');

// Laufen → Plan: Saisonplan aus A-/B-Rennen, Rennen verwalten, Renntempo-Rechner.
const RACES = [
  { id: 'a1', name: 'Halbmarathon Frühjahr', date: '2027-03-01', dist: 'hm', prio: 'A', goal: 7140 },
  { id: 'b1', name: 'Testlauf 10', date: '2027-01-24', dist: '10k', prio: 'B', goal: null },
  { id: 'a2', name: 'Marathon Herbst', date: '2027-10-01', dist: 'marathon', prio: 'A', goal: 15300 }
];
const setRaces = (page, list) => page.evaluate(l => { races = l.map(r => Object.assign({}, r)); persistRaces(); }, list);
// Plan mit festem „heute“ und Startwerten (Longrun L0, Wochen-km W0) – unabhängig vom echten Datum
const plan = (page, today, opt = {}) => page.evaluate(([t, o]) => {
  const S = seasonPlan(t, o);
  return { warn: S.warn, weeks: S.weeks.map(x => ({ week: x.week, phase: x.cut ? 'cut' : x.phase, long: x.long, km: x.km, a: x.a && x.a.id, b: x.b.map(r => r.id) })) };
}, [today, opt]);
async function openPlan(page, sub) {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="plan"]');
  if (sub) await page.click(`[data-runsub="${sub}"]`);
}

test('Saison: Blöcke rückwärts ab jedem A-Rennen, Erholung, B-Rennen ohne eigenen Block', async ({ page }) => {
  await setRaces(page, RACES);
  const { weeks, warn } = await plan(page, '2026-11-04', { L0: 14, W0: 22 });
  expect(warn).toEqual([]);
  expect(weeks[0].week).toBe('2026-11-02');
  expect(weeks.at(-1).a).toBe('a2');
  const ph = w => weeks.find(x => x.week === w).phase;
  // HM: 2 Wochen Tapering inkl. Rennwoche, davor 3 Wochen spezifisch; danach 2 Wochen Erholung
  expect(['2027-02-22', '2027-03-01'].map(ph)).toEqual(['taper', 'taper']);
  expect(weeks.find(x => x.week === '2027-03-01').a).toBe('a1');
  expect(['2027-02-01', '2027-02-08', '2027-02-15'].every(w => ['spec', 'cut'].includes(ph(w)))).toBe(true);
  expect(['2027-03-08', '2027-03-15'].map(ph)).toEqual(['recover', 'recover']);
  // Marathon: 3 Wochen Tapering, Block 19 Wochen, davor Basis
  expect(['2027-09-13', '2027-09-20', '2027-09-27'].map(ph)).toEqual(['taper', 'taper', 'taper']);
  expect(ph('2027-05-17')).toMatch(/basis|cut/);
  expect(ph('2027-05-24')).toMatch(/base|cut/);
  // B-Rennen steht in seiner Woche, ändert die Phase aber nicht
  const bw = weeks.find(x => x.b.includes('b1'));
  expect(bw.week).toBe('2027-01-18');
  expect(bw.phase).not.toBe('taper');
  // Ziel-Longrun wird erreicht, Steigerung nie über 10 %, Entlastung spätestens jede 4. Woche
  expect(Math.max(...weeks.filter(x => x.week < '2027-03-01').map(x => x.long || 0))).toBeCloseTo(20, 5);
  expect(Math.max(...weeks.map(x => x.long || 0))).toBeCloseTo(30, 5);
  let last = { long: 14, km: 22 }, run = 0;
  for (const x of weeks) {
    if (['base', 'build', 'spec', 'basis'].includes(x.phase)) {
      expect(x.long).toBeLessThanOrEqual(last.long * 1.1 + 1e-9);
      expect(x.km).toBeLessThanOrEqual(last.km * 1.1 + 1e-9);
      run++; expect(run).toBeLessThanOrEqual(4); // direkt vor dem Tapering keine Entlastung
    } else run = 0;
    if (x.phase !== 'cut' && x.long) last = { long: x.long, km: x.km };
  }
  expect(weeks.find(x => x.week === '2027-03-01').long).toBeNull();
});

test('Saison: zu dichte A-Rennen und zu wenig Zeit werden gewarnt', async ({ page }) => {
  await setRaces(page, [
    { id: 'x1', name: 'HM eins', date: '2027-03-07', dist: 'hm', prio: 'A', goal: null },
    { id: 'x2', name: 'Marathon zwei', date: '2027-05-02', dist: 'marathon', prio: 'A', goal: null }
  ]);
  const { warn, weeks } = await plan(page, '2026-11-04', { L0: 10, W0: 20 });
  expect(warn.join(' ')).toContain('Marathon zwei: nur 6 Wochen nach der Erholung von HM eins');
  expect(warn.join(' ')).toContain('Longrun von etwa');
  expect(weeks.find(x => x.week === '2027-04-26').phase).toBe('taper');

  await setRaces(page, [{ id: 'x3', name: 'Kurzfristig', date: '2026-11-22', dist: '10k', prio: 'A', goal: null }]);
  expect((await plan(page, '2026-11-04')).warn.join(' ')).toContain('Kurzfristig: nur noch 3 Wochen');
});

test('Übersicht: diese Woche mit Phase, Countdown und Grenzen aus dem Umfang', async ({ page }) => {
  await openPlan(page);
  await expect(page.locator('#runcontent')).toContainText('Noch kein A-Rennen geplant');
  await page.click('[data-runsub-go="rennen"]');
  await expect(page.locator('[data-runsub="rennen"]')).toHaveAttribute('aria-selected', 'true');

  const date = await page.evaluate(() => addDays(localDay(), 7 * 20));
  await setRaces(page, [{ id: 'h', name: 'Mein HM', date, dist: 'hm', prio: 'A', goal: 7140 }]);
  await page.click('[data-runsub="woche"]');
  await expect(page.locator('#planweek')).toContainText('Mein HM');
  await expect(page.locator('#planweek')).toContainText('Ziel 1:59:00 = 5:38 /km');
  await expect(page.locator('#planweek .metric b')).toHaveText(['?', '?']);
  await expect(page.locator('#planweek')).toContainText('unter Umfang');

  // mit Umfang: Longrun 12 km vor 9 Tagen, Wochen à 20 km → +10 %
  await page.evaluate(() => { const t = localDay(); for (let i = 1; i <= 4; i++) setWeekKm(addDays(weekStart(t), -7 * i), 'km', 20); addRun(addDays(t, -9), 12); renderRun(); });
  const exp = await page.evaluate(() => { const S = seasonPlan(); return [Math.round(Math.min(S.weeks[0].long, longestIn(localDay()).max)), Math.round(S.weeks[0].km)]; });
  await expect(page.locator('#planweek .metric b')).toHaveText([`ca. ${exp[0]} km`, `ca. ${exp[1]} km`]);
  expect(exp[0]).toBeLessThanOrEqual(13);
  await expect(page.locator('#planseason .planweek.now')).toHaveCount(1);
  await expect(page.locator('#planmore')).toContainText('Weitere 13 Wochen');
});

test('Rennen: eintragen, Fehler markieren, bearbeiten, löschen – bleibt gespeichert', async ({ page }) => {
  await openPlan(page, 'rennen');
  await page.click('#racesave');
  await expect(page.locator('#racename')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#racename', 'Stadtlauf');
  await page.fill('#racedate', '2027-04-04');
  await page.selectOption('#racedist', '10k');
  await page.fill('#racegoal', '55');
  await page.click('#racesave');
  await expect(page.locator('#racegoal')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#racegoal', '54:30');
  await page.press('#racegoal', 'Enter');
  await expect(page.locator('#racelist')).toContainText('Stadtlauf');
  await expect(page.locator('#racelist')).toContainText('10 km · Ziel 54:30 = 5:27 /km');

  await page.reload();
  await openPlan(page, 'rennen');
  await page.click('[data-raceedit]');
  await expect(page.locator('#racename')).toHaveValue('Stadtlauf');
  await expect(page.locator('#racegoal')).toHaveValue('54:30');
  await page.selectOption('#raceprio', 'B');
  await page.fill('#racegoal', '');
  await page.click('#racesave');
  await expect(page.locator('#racelist .prio')).toHaveText('B');
  expect(await page.evaluate(() => races.map(r => [r.prio, r.goal]))).toEqual([['B', null]]);

  await page.click('[data-raceedit]');
  await page.click('#racedel');
  await expect(page.locator('#racelist')).toContainText('Noch keine Rennen');
  // HM-Zeit „1:59“ heißt Stunden:Minuten
  expect(await page.evaluate(() => [parseGoal('1:59', 'hm'), parseGoal('24:30', '5k'), parseGoal('1:75', 'hm'), parseGoal('x', 'hm'), parseGoal('', 'hm')])).toEqual([7140, 1470, NaN, NaN, null]);
});

test('Rennen im Backup, Import ergänzt nur Fehlendes, unbekannte Einträge bleiben', async ({ page }) => {
  await setRaces(page, [RACES[0]]);
  await page.evaluate(() => localStorage.setItem(KEYS.races, JSON.stringify(races.concat([{ id: 'zukunft', dist: 'ultra' }]))));
  await page.reload();
  expect(await page.evaluate(() => [races.length, JSON.parse(backupJson()).races.length])).toEqual([1, 2]);
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 3, races: RACES.concat([{ id: '<b>', name: 'kaputt', date: 'morgen', dist: 'hm', prio: 'A' }])
  })) });
  await expect.poll(() => page.evaluate(() => races.map(r => r.id))).toEqual(['b1', 'a1', 'a2']); // nach Datum sortiert
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(KEYS.races)).length)).toBe(4);
});

test('Renntempo-Rechner: Pace und Zwischenzeiten', async ({ page }) => {
  await openPlan(page, 'wissen');
  await expect(page.locator('#pcout')).toContainText('Zielzeit eingeben');
  await page.selectOption('#pcdist', 'marathon');
  await page.fill('#pctime', '4:15:00');
  await expect(page.locator('#pcout .longnext b')).toHaveText('6:03 /km');
  await expect(page.locator('#pcout .splits')).toContainText('Halbzeit2:07:30');
  await page.selectOption('#pcdist', '5k');
  await page.fill('#pctime', '25:00');
  await expect(page.locator('#pcout .longnext b')).toHaveText('5:00 /km');
  await page.fill('#pctime', '25:99');
  await expect(page.locator('#pctime')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#runcontent details')).toHaveCount(6);
});
