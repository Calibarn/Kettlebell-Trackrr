// Entlastungswoche (ab 1.8): gezählt aus den eingetragenen Wochen statt ab heute – vorher lag sie immer drei Wochen in der Zukunft.
// In der Entlastungswoche: weniger km, Qualität mit weniger Wiederholungen bei gleichem Tempo, Kraft mit 1 Satz weniger.
const { test, expect } = require('./fixtures');

// Läufe je Woche vor der laufenden: kms[0] = letzte Woche, kms[1] = vorletzte …; cur = km in der laufenden Woche (am Montag)
const history = (page, kms, cur = 0) => page.evaluate(([kms, cur]) => {
  const w0 = weekStart(localDay());
  // Ergebnis weit genug zurück, damit es nicht in die km der betrachteten Wochen fällt
  results = [{ id: 'a', date: addDays(localDay(), -100), km: 10, time: 3300, dist: '10k' }]; persistResults();
  races = [{ id: 'h', name: 'HM', date: addDays(w0, 7 * 30 + 6), dist: 'hm', prio: 'A' }]; persistRaces();
  runLog = kms.flatMap((km, i) => km === null ? [] : [{ id: 'w' + i, date: addDays(w0, -7 * (i + 1) + 2), km, kind: 'easy' }]).concat(cur ? [{ id: 'cur', date: w0, km: cur, kind: 'easy' }] : []);
  persistRunLog(); runWeeks = []; persistRunWeeks();
  const S = seasonPlan();
  return { cut: S.weeks.slice(0, 5).map(x => !!x.cut), after: S.weeks[0].cutAfter || null, streak: buildStreak(w0) };
}, [kms, cur]);

test('Entlastung nach drei Aufbauwochen aus den eingetragenen Läufen – nicht immer erst in drei Wochen', async ({ page }) => {
  // acht Wochen um 25 km: laufende Woche ist Entlastung
  let r = await history(page, [25, 25, 26, 25, 24, 25, 25, 25]);
  expect(r.streak).toBe(7);
  expect(r.cut).toEqual([true, false, false, false, true]);
  expect(r.after).toBe(7);
  // laufende Woche schon normal gelaufen (über 90 %): zählt als Aufbau, Entlastung kommt nächste Woche
  r = await history(page, [25, 25, 26, 25, 24, 25, 25, 25], 24);
  expect(r.cut).toEqual([false, true, false, false, false]);
  // vorletzte Woche war locker (höchstens 80 % des Schnitts davor): erst eine Aufbauwoche seitdem → Entlastung in zwei Wochen
  r = await history(page, [25, 18, 26, 25, 24, 25, 25, 25]);
  expect(r.streak).toBe(1);
  expect(r.cut).toEqual([false, false, true, false, false]);
  // ohne Läufe wie bisher: drei Wochen Aufbau, dann Entlastung
  r = await history(page, []);
  expect(r.streak).toBe(0);
  expect(r.cut.slice(0, 4)).toEqual([false, false, false, true]);
  // eine Woche ohne Einträge beendet die Zählung (Pause)
  r = await history(page, [25, 25, null, 25, 25, 25, 25]);
  expect(r.streak).toBe(2);
  expect(r.cut.slice(0, 3)).toEqual([false, true, false]);
});

test('Entlastungswoche: Qualität mit weniger Wiederholungen bei gleichem Tempo', async ({ page }) => {
  const r = await page.evaluate(() => {
    results = [{ id: 'a', date: addDays(localDay(), -10), km: 10, time: 3000, dist: '10k' }];
    races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 200), dist: 'hm', prio: 'A' }];
    const x = Object.assign({}, seasonPlan().weeks[0], { phase: 'base', cut: true }), k = [weekKey(x), weekKey(x, true)].sort();
    return { k, plan: k.map(repPlan) };
  });
  expect(r.k[0]).toMatch(/^kürzer: 2 × 10 Min\. Schwelle, 2 Min\. Trabpause, danach 6 × 100 m Steigerung \(.+\) – statt 3 ×$/);
  expect(r.k[1]).toMatch(/^kürzer: 3 × 1 km Schwelle, 1 Min\. Trabpause \(.+\) – statt 5 ×$/);
  expect(r.plan).toEqual([{ n: 2, sec: 600 }, { n: 3, km: 1 }]);
});

test.describe('mit Startseite', () => {
  test.use({ start: true });
  test('Entlastungswoche in „Heute dran“, bei Kraft und in der Wochenkarte', async ({ page }) => {
    await page.evaluate(() => { const wd = new Date(localDay() + 'T12:00:00').getDay(); Object.assign(profile.week, { runner: 'runner', quality: null, long: null, group: null, extras: [], strength: [wd], strengthPlan: {}, mobility: [], sauna: [] }); persistProfile(); });
    await history(page, [25, 25, 26, 25, 24, 25, 25, 25]);
    await page.evaluate(() => showArea('start'));
    await expect(page.locator('#startcontent .skicker').first()).toHaveText('Heute dran · Entlastungswoche');
    await expect(page.locator('#startcontent .srowt', { hasText: 'Kraft' }).locator('.stip')).toContainText('Entlastungswoche: gleiches Gewicht, je Übung 1 Satz weniger');
    await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="woche"]');
    await expect(page.locator('#plancut')).toContainText('Entlastungswoche nach 7 Wochen Aufbau');
    // normale Woche: kein Hinweis
    await history(page, [25, 18, 26, 25]);
    await page.evaluate(() => { renderAll(); showArea('start'); });
    await expect(page.locator('#startcontent .skicker').first()).toHaveText('Heute dran');
    await expect(page.locator('#startcontent .stip', { hasText: 'Entlastungswoche' })).toHaveCount(0);
  });
});
