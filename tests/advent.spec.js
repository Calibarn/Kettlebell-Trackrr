// Lauf-Adventskalender (ab 1.11): 24 Türchen vom 1. bis 24. Dezember, Ziel aus dem Plan, Pause zählt mit.
const { test, expect } = require('./fixtures');

test.use({ start: true });

// Läufer mit Plan (Di Qualität, Mi Laufgruppe, So Longrun, Do Kraft) und vier Wochen um 25 km vor dem 1. Dezember
const setup = (page, runs = []) => page.evaluate(runs => {
  results = [{ id: 'a', date: '2026-10-20', km: 10, time: 3300, dist: '10k' }]; persistResults();
  races = [{ id: 'h', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A' }]; persistRaces();
  Object.assign(profile.week, { runner: 'runner', quality: 2, group: 3, long: 0, extras: [], strength: [4], strengthPlan: {}, mobility: [], sauna: [] }); persistProfile();
  const hist = [];
  for (let w = 1; w <= 6; w++) { const wk = addDays('2026-11-30', -7 * w); hist.push({ id: 'h' + w + 'a', date: addDays(wk, 1), km: 7 }, { id: 'h' + w + 'b', date: addDays(wk, 2), km: 7 }, { id: 'h' + w + 'c', date: addDays(wk, 6), km: 11 }); }
  runLog = hist.concat(runs); persistRunLog(); localStorage.removeItem(KEYS.advent); showArea('start');
}, runs);

test('Ende November: Vorgeschmack mit Ziel aus dem Plan, alle Türchen zu', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T10:00:00+01:00'));
  await page.reload();
  await setup(page);
  const card = page.locator('#advent');
  await expect(card.locator('.skicker')).toContainText('Lauf-Adventskalender');
  const head = await card.locator('.advhead').textContent();
  expect(head).toMatch(/^Ab 1\. Dezember: 24 Türchen bis Heiligabend\. Dein Ziel: ca\. (\d+) km/);
  const goal = Number(head.match(/ca\. (\d+) km/)[1]);
  expect(goal % 5).toBe(0);
  expect(goal).toBeGreaterThanOrEqual(60); expect(goal).toBeLessThanOrEqual(110); // um 25 km pro Woche, nicht fest 100
  await expect(card.locator('.advdoor')).toHaveCount(24);
  await expect(card.locator('.advdoor:disabled')).toHaveCount(24);
});

test('Dezember: trainiert ✓, Pause ✓, ausgelassen, heute, noch zu – Tipp beim Antippen, ausblenden mit Rückgängig', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-05T10:00:00+01:00')); // Samstag
  await page.reload();
  await setup(page, [{ id: 'd1', date: '2026-12-01', km: 8, kind: 'quality' }, { id: 'd2', date: '2026-12-02', km: 6, kind: 'group' }]);
  const card = page.locator('#advent'), doors = card.locator('.advdoor');
  // 1. Di gelaufen, 2. Mi gelaufen, 3. Do Kraft geplant, nichts eingetragen, 4. Fr nichts geplant (Pause), 5. heute
  expect(await doors.evaluateAll(l => l.slice(0, 6).map(x => x.className.replace('advdoor ', '')))).toEqual(['done', 'done', 'miss', 'rest', 'open today', 'closed']);
  await expect(doors.nth(0)).toHaveText('✓');
  await expect(doors.nth(2)).toHaveText('3');
  await expect(card.locator('.advdoor:disabled')).toHaveCount(19);
  await expect(card.locator('.advhead')).toContainText(/^14 von \d+ km bis Heiligabend · Plan bis heute ca\. \d+ km$/);
  await doors.nth(1).click();
  await expect(card.locator('.advtip')).toHaveText('Türchen 2 Im Dunkeln: Licht an Brust oder Kopf, Reflektoren an die Beine – was sich bewegt, fällt Autofahrern auf.');
  await card.locator('.advdoor').nth(1).click();
  await expect(card.locator('.advtip')).toHaveCount(0);
  await card.locator('[data-adventhide]').click();
  await expect(page.locator('#advent')).toHaveCount(0);
  await page.click('#toastundo');
  await expect(page.locator('#advent')).toHaveCount(1);
});

test('Nach Heiligabend die Bilanz, ab 27. Dezember weg', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-25T10:00:00+01:00'));
  await page.reload();
  await setup(page, [{ id: 'd1', date: '2026-12-01', km: 8 }, { id: 'd24', date: '2026-12-24', km: 10.5 }, { id: 'd25', date: '2026-12-25', km: 5 }]);
  await expect(page.locator('#advent .advhead')).toHaveText('18,5 km seit dem 1. Dezember – frohe Weihnachten!');
  await expect(page.locator('#advent .advdoor:disabled')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-12-27T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(() => showArea('start'));
  await expect(page.locator('#advent')).toHaveCount(0);
});
