// „Nicht geschafft“ auf der Startseite (ab 1.13): die Einheit von heute rückt auf den nächsten passenden Tag dieser Woche
// (Regeln wie beim Nachholen) – auch ohne „Abhaken & nachholen“. Ist kein Tag mehr frei, entfällt sie diese Woche. Rückgängig geht.
const { test, expect } = require('./fixtures');

test.use({ start: true });

// Woche 2.–8.11.2026: Mo Kraft, Di Qualität, Mi Kraft, Do Laufgruppe, Fr Kraft, So Longrun – ohne Abhaken
async function setup(page, day) {
  await page.clock.setFixedTime(new Date(day + 'T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(() => {
    races = [{ id: 'h', name: 'HM', date: '2027-03-21', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    Object.assign(profile.week, { runner: 'runner', quality: 2, long: 0, group: 4, extras: [], strength: [1, 3, 5], strengthPlan: {}, strengthFixed: [], mobility: [3], sauna: [], track: false }); persistProfile();
    weekPlan = null; storeWeekPlan(); showArea('start');
  });
}
const rowOf = (page, text) => page.locator('#startcontent .srowt', { hasText: text });
const sched = page => page.evaluate(() => weekSchedule(seasonPlan().weeks[0]).filter(o => !o.skip).map(o => `${o.key}@${o.d}${o.from !== undefined ? '<' + o.from : ''}`));

test('Kraft nicht geschafft: rückt auf den nächsten freien Tag, Rückgängig holt sie zurück', async ({ page }) => {
  await setup(page, '2026-11-04'); // Mittwoch
  const kraft = rowOf(page, 'Kraft');
  await expect(kraft.locator('[data-missed]')).toHaveText('Nicht geschafft');
  await expect(rowOf(page, 'Mobility').locator('[data-missed]')).toHaveCount(0); // Mobility hängt an nichts
  await kraft.locator('[data-missed]').click();
  await expect(page.locator('#toast')).toContainText('Auf Samstag verschoben.'); // Do Laufgruppe, Fr Kraft – Sa ist frei
  await expect(rowOf(page, 'Kraft')).toHaveCount(0);
  expect(await sched(page)).toContain('strength-3@6<3');
  // im Wochenplan mit Hinweis und dort rückgängig zu machen
  await page.evaluate(() => { showArea('laufen'); runView.tab = 'woche'; renderRun(); });
  await expect(page.locator('#planschedule .row.sched-strength', { hasText: 'Sa' })).toContainText('verschoben von Mi');
  await page.evaluate(() => showArea('start'));
  await page.click('#toastundo');
  await expect(rowOf(page, 'Kraft')).toHaveCount(1);
  expect(await sched(page)).toContain('strength-3@3');
});

test('Qualität nicht geschafft: nicht neben den Longrun – lieber zur Kraft am Mittwoch; am Sonntag entfällt der Longrun', async ({ page }) => {
  await setup(page, '2026-11-03'); // Dienstag
  await rowOf(page, 'Qualität').locator('[data-missed]').click();
  await expect(page.locator('#toast')).toContainText('Auf Mittwoch verschoben.');
  expect(await sched(page)).toContain('quality@3<2');
  // Sonntag: danach ist kein Tag mehr in der Woche
  await setup(page, '2026-11-08');
  await rowOf(page, 'Longrun').locator('[data-missed]').click();
  await expect(page.locator('#toast')).toContainText('Entfällt diese Woche – kein Tag mehr frei.');
  expect(await page.evaluate(() => weekSkip['2026-11-02'])).toEqual(['long']);
  await expect(rowOf(page, 'Longrun').locator('[data-missed]')).toHaveCount(0); // (die Zeile „So 01.11. · Longrun – Nachtragen“ ist von letzter Woche)
  await page.click('#toastundo');
  expect(await page.evaluate(() => weekSkip['2026-11-02'] || [])).toEqual([]);
  await expect(rowOf(page, 'Longrun').locator('[data-missed]')).toHaveCount(1);
});
