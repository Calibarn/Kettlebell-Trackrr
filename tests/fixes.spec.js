// Regressionstests für Fehler aus der Durchsicht am 3.11.2026
const { test, expect } = require('./fixtures');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

test.describe('Android, schmales Telefon', () => {
  test.use({ userAgent: ANDROID, viewport: { width: 360, height: 760 } });
  test('Tab-Leiste passt in die Breite – „Mehr“ ragt nicht aus dem Bild', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.dataset.os)).toBe('android');
    for (const w of [360, 320]) {
      await page.setViewportSize({ width: w, height: 760 });
      const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#tabbar button')].map(b => b.getBoundingClientRect().right)));
      expect(right).toBeLessThanOrEqual(w + 0.5);
    }
  });
});

test('Zahlen: Formatierung unverändert (Komma auf Deutsch)', async ({ page }) => {
  expect(await page.evaluate(() => [kgText(12.5), kgText(12), cmString(100), kmText(21.0975), kgOne(8)])).toEqual(['12,5', '12', '100,0', '21,1', '8,0']);
});

test('Kalender-Export: Testlauf heißt „Testlauf 5 km“, nicht „Qualität: …“', async ({ page }) => {
  const ics = await page.evaluate(() => {
    races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 7 * 20), dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    profile.week.quality = WEEK_ORDER[6]; persistProfile(); // Sonntag: liegt nie in der Vergangenheit dieser Woche
    return planIcs(seasonPlan());
  });
  expect(ics).toContain('SUMMARY:Testlauf 5 km');
  expect(ics).not.toContain('SUMMARY:Qualität: nach 15 Min.');
});

test('Testlauf: ein vergangenes Rennen ohne Ergebnis zählt nicht als neuer Wert, Hinweis auf das Ergebnis', async ({ page }) => {
  await page.evaluate(() => {
    races = [{ id: 'p', name: 'Stadtlauf', date: addDays(localDay(), -5), dist: '10k', prio: 'B', goal: null, km: null },
      { id: 'h', name: 'HM', date: addDays(localDay(), 7 * 20), dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    results = [{ id: 'o', date: addDays(localDay(), -90), km: 10, time: 3000, dist: '10k' }]; persistResults();
    showArea('laufen'); runView.tab = 'plan'; runView.plan = 'woche'; renderRun();
  });
  expect(await page.evaluate(() => seasonPlan().weeks[0].test)).toBe(true);
  await expect(page.locator('#runcontent')).toContainText('Wie lief Stadtlauf?');
  // Ergebnis eingetragen: Hinweis weg, kein Testlauf mehr diese Woche
  await page.evaluate(() => { results.push({ id: 'n', date: addDays(localDay(), -5), km: 10, time: 2950, dist: '10k', race: 'p' }); persistResults(); renderRun(); });
  await expect(page.locator('#runcontent')).not.toContainText('Wie lief Stadtlauf?');
  expect(await page.evaluate(() => !!seasonPlan().weeks[0].test)).toBe(false);
});

test('Feste Krafttage nur unter den Krafttagen', async ({ page }) => {
  expect(await page.evaluate(() => normProfile({ week: { strength: [1, 4], strengthFixed: [1, 3, 9] } }).week.strengthFixed)).toEqual([1]);
});

test('Abhaken: für einen Lauf ausgefallene Kraft kommt zurück, wenn „Abhaken & nachholen“ ausgeschaltet wird', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(() => {
    races = [{ id: 'h', name: 'HM', date: '2027-03-21', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    Object.assign(profile.week, { quality: 2, long: 0, group: 4, strength: [1, 3, 5], extraDay: null, track: true, strengthFixed: [] }); persistProfile();
    showArea('laufen'); runView.tab = 'plan'; runView.plan = 'woche'; renderRun();
  });
  await page.click('[data-move="quality"]');
  await expect(page.locator('#planschedule .sched-strength.skipped')).toContainText('entfällt für den nachgeholten Lauf');
  expect(await page.evaluate(() => weekSkip[weekStart(localDay())] || [])).toEqual([]); // nicht bei „Entfällt“ abgelegt
  await page.evaluate(() => { profile.week.track = false; persistProfile(); renderRun(); });
  await expect(page.locator('#planschedule .skipped')).toHaveCount(0);
});
