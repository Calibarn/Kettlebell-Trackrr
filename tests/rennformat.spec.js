const { test, expect } = require('./fixtures');

// Rennen ohne feste Distanz: Wings for Life World Run (Ziel in km) und Pace Race (Ziel-Level).
async function openRaces(page) {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="plan"]');
  await page.click('[data-runsub="rennen"]');
}
// 10 km in 55:00 vor einer Woche als aktuelle Form
const setForm = page => page.evaluate(() => { results = [{ id: 'f', date: addDays(localDay(), -7), km: 10, time: 3300, dist: '10k' }]; persistResults(); });

test('Rechnung: Catcher Car, Zeitlimits und Dauer des Pace Race', async ({ page }) => {
  const v = await page.evaluate(() => ({
    car: [7, 10, 14.5, 20, 40, 79, 90].map(carTime),
    cut: [1, 2, 3, 4, 5, 6, 11, 12, 15, 17, 28].map(paceCut),
    total: [12, 28].map(paceTotal)
  }));
  // 30 Min. Vorsprung, dann 14 km/h; km 7 nach 1:00, km 14,5 nach 1:30, km 40 nach 3:00, km 79 nach 4:30, danach 34 km/h
  expect(v.car[0]).toBeCloseTo(3600, 6);
  expect(v.car[1]).toBeCloseTo(4320, 6); // 1:12:00
  expect(v.car[2]).toBeCloseTo(5400, 6);
  expect(v.car[3]).toBeCloseTo(6637.5, 6); // 1:50:38
  expect(v.car[4]).toBeCloseTo(10800, 6);
  expect(v.car[5]).toBeCloseTo(16200, 6);
  expect(v.car[6]).toBeCloseTo(16200 + 11 / 34 * 3600, 6);
  // Level 1–5 fest, dann je Runde 10 Sek. schneller bis 2:10
  expect(v.cut).toEqual([480, 420, 390, 375, 360, 350, 300, 290, 260, 240, 130]);
  // Zeitlimits plus 60 Sek. Pause zwischen den Runden
  expect(v.total).toEqual([4925, 9165]);
});

test('Wings for Life: Ziel in km, Catcher-Car-Zeit und Mindest-Pace, Form, Plan wie eigene Distanz', async ({ page }) => {
  await setForm(page);
  await openRaces(page);
  await page.fill('#racename', 'Wings for Life München');
  await page.fill('#racedate', '2027-05-09');
  await page.selectOption('#racedist', 'wfl');
  await expect(page.locator('#racekmfield label')).toHaveText('Ziel in km');
  await expect(page.locator('#racegoalfield')).toBeHidden();
  await expect(page.locator('#racefmtinfo')).toContainText('Ziel in km eintragen');
  await page.fill('#racekm', '20');
  await expect(page.locator('#racefmtinfo')).toContainText('bei km 20 nach 1:50:38');
  await expect(page.locator('#racefmtinfo')).toContainText('mindestens 5:32 /km');
  // 10 km in 55:00 → Riegel-Prognose und Catcher Car treffen sich bei etwa 18,3 km
  await expect(page.locator('#racefmtinfo')).toContainText('reicht für etwa 18 km');
  expect(await page.evaluate(() => formReach('wfl').km)).toBeGreaterThan(18);
  expect(await page.evaluate(() => formReach('wfl').km)).toBeLessThan(18.5);

  await page.fill('#racekm', '0');
  await page.click('#racesave');
  await expect(page.locator('#racekm')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#racekm', '20');
  await page.click('#racesave');
  expect(await page.evaluate(() => races.map(r => [r.fmt, r.dist, r.km, r.goal]))).toEqual([['wfl', 'hm', 20, null]]);
  await expect(page.locator('#racelist')).toContainText('Wings for Life, Ziel 20 km (geplant wie Halbmarathon) · Catcher Car bei km 20 nach 1:50:38 → mind. 5:32 /km');
  // Zielzeit für die Plan-Stufe ist die Catcher-Car-Zeit: 1:50:38 auf 20 km ≈ 1:57 auf HM → Stufe „unter 2:15“
  expect(await page.evaluate(() => [raceGoal(races[0]), peaks(races[0])])).toEqual([6638, { long: 20, week: 45, fromGoal: true }]);

  // Bearbeiten zeigt Format und Ziel wieder
  await page.click('[data-raceedit]');
  await expect(page.locator('#racedist')).toHaveValue('wfl');
  await expect(page.locator('#racekm')).toHaveValue('20');
  await expect(page.locator('#racefmtinfo')).toContainText('1:50:38');
  // zurück auf feste Distanz: Zielzeit wieder da, Format weg
  await page.selectOption('#racedist', '10k');
  await expect(page.locator('#racegoalfield')).toBeVisible();
  await expect(page.locator('#racefmtinfo')).toBeHidden();
  await page.click('#racesave');
  expect(await page.evaluate(() => races.map(r => [r.fmt, r.dist, r.km]))).toEqual([[undefined, '10k', null]]);
});

test('Pace Race: Ziel-Level, Zeitlimit der Zielrunde, Level-Tempo und 1-km-Wiederholungen im Plan', async ({ page }) => {
  await setForm(page);
  await openRaces(page);
  await page.fill('#racename', 'Pace Race Berlin');
  await page.fill('#racedate', '2027-06-05');
  await page.selectOption('#racedist', 'pace');
  await expect(page.locator('#racekmfield label')).toHaveText('Ziel-Level (1–28)');
  await page.fill('#racekm', '12');
  await expect(page.locator('#racefmtinfo')).toContainText('12. Runde in höchstens 4:50');
  await expect(page.locator('#racefmtinfo')).toContainText('mit Pausen etwa 1:22 h');
  // 5-km-Tempo aus 55:00 auf 10 km: 5:17 → Level 9 (5:20) geht noch, Level 10 (5:10) nicht
  await expect(page.locator('#racefmtinfo')).toContainText('5-km-Tempo 5:17) reicht grob für Level 9');
  await expect(page.locator('#racefmtinfo')).toContainText('Level 9 – die Wiederholungen im Plan laufen erst mal in 5:17 /km.');
  for (const bad of ['12,5', '29']) {
    await page.fill('#racekm', bad);
    await page.click('#racesave');
    await expect(page.locator('#racekm')).toHaveAttribute('aria-invalid', 'true');
  }
  await page.fill('#racekm', '12');
  await page.click('#racesave');
  expect(await page.evaluate(() => races.map(r => [r.fmt, r.dist, r.km, r.goal]))).toEqual([['pace', '10k', 12, null]]);
  await expect(page.locator('#racelist')).toContainText('Pace Race, Ziel Level 12 (geplant wie 10 km) · Runde 12 in höchstens 4:50 Min.');

  // Plan: Level-Tempo in den Wiederholungen, eigene Einheiten im Aufbau, in der spezifischen Phase und im Tapering
  const notes = await page.evaluate(() => {
    const S = seasonPlan('2027-02-01', { L0: 12, W0: 25 }), of = p => S.weeks.filter(w => w.phase === p && !w.cut);
    return { build: of('build').map(weekKey), spec: of('spec').map(weekKey), long: of('spec').map(weekLongNote), taper: of('taper').map(weekKey) };
  });
  // Level 12 verlangt 4:50, die Form gibt 5:17 her: geplant wird mit dem 5-km-Tempo, bis neue Ergebnisse schneller sind
  expect(notes.build.join(' | ')).toContain('6 × 1 km steigernd bis ins Level-Tempo, 60 Sek. Stehpause (5:17 /km)');
  expect(notes.spec.join(' | ')).toMatch(/1 km.*Level-Tempo.*\(5:17 \/km\)/);
  expect(notes.long.join(' | ')).toContain('3 × 1 km steigernd bis ins Level-Tempo');
  expect(notes.taper.join(' | ')).toContain('3–4 × 1 km im Level-Tempo');
  expect(await page.evaluate(() => Math.round(racePace(races[0])))).toBe(317);
  await expect(page.locator('#racelist')).toBeVisible();
  // ohne Ergebnis bzw. bei leichterem Ziel gilt das Zeitlimit der Zielrunde
  expect(await page.evaluate(() => racePace({ fmt: 'pace', km: 8, dist: '10k' }))).toBe(330);
  expect(await page.evaluate(() => { const keep = results; results = []; const v = racePace(races[0]); results = keep; return v; })).toBe(290);

  // Ergebnis eines Pace Race nicht als Bestzeit übernehmen (Pausen verfälschen die Tempos)
  await page.evaluate(() => { races[0].date = addDays(localDay(), -3); persistRaces(); });
  await page.click('[data-runsub="bestzeiten"]');
  await expect(page.locator('#bestsave')).toBeVisible();
  await expect(page.locator('#bestfrom')).toHaveCount(0);
  expect(await page.evaluate(() => missingResultHint())).toBe('');
});

test('Rennformate: alte Einträge bleiben gültig, ungültige Ziele werden aussortiert, Import übernimmt das Format', async ({ page }) => {
  const ok = await page.evaluate(() => [
    { id: 'a', name: 'A', date: '2027-05-09', dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' },
    { id: 'b', name: 'B', date: '2027-06-05', dist: '10k', prio: 'B', goal: null, km: 12, fmt: 'pace' },
    { id: 'c', name: 'C', date: '2027-06-05', dist: '10k', prio: 'B', goal: null, km: 12.5, fmt: 'pace' },
    { id: 'd', name: 'D', date: '2027-06-05', dist: '10k', prio: 'B', goal: null, km: 12, fmt: 'other' },
    { id: 'e', name: 'E', date: '2027-06-05', dist: '10k', prio: 'B', goal: null, km: null, fmt: 'wfl' },
    { id: 'f', name: 'F', date: '2027-06-05', dist: '10k', prio: 'B', goal: 3000 }
  ].map(validRace));
  expect(ok).toEqual([true, true, false, false, false, true]);
  const label = await page.evaluate(() => [raceLabel({ fmt: 'wfl', km: 20, dist: 'hm' }), raceLabel({ fmt: 'pace', km: 12, dist: '10k' }), raceLabel({ dist: 'hm' })]);
  expect(label).toEqual(['Wings for Life, Ziel 20 km', 'Pace Race, Ziel Level 12', 'Halbmarathon']);

  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, races: [
    { id: 'w', name: 'Wings', date: '2027-05-09', dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' },
    { id: 'p', name: 'Pace', date: '2027-06-05', dist: '10k', prio: 'B', goal: null, km: 12, fmt: 'pace' }
  ] })) });
  await expect.poll(() => page.evaluate(() => races.map(r => [r.id, r.fmt, r.km]))).toEqual([['w', 'wfl', 20], ['p', 'pace', 12]]);
  await page.reload();
  expect(await page.evaluate(() => races.map(r => [r.id, r.fmt]))).toEqual([['w', 'wfl'], ['p', 'pace']]);
});
