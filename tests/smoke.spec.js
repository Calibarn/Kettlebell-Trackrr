// Kurzer Rundgang durch alle Bereiche ohne Konsolenfehler – läuft in der CI zusätzlich in WebKit (Safari-Engine)
const { test, expect, forward, openSect } = require('./fixtures');

test('Rundgang: alle Bereiche öffnen, kurz trainieren, Lauf eintragen, Sicherung speichern', async ({ page }) => {
  for (const a of ['start', 'kraft', 'laufen', 'mobility', 'profil', 'mehr']) await page.evaluate(x => showArea(x), a);
  await page.evaluate(() => showArea('kraft'));
  await page.click('[data-plan="tabata"]');
  await page.click('#btnMain');
  await forward(page, 4 * 60 + 25);
  await expect(page.locator('#phase-badge')).toHaveText(/Arbeit|Pause/);
  await page.evaluate(() => { showArea('laufen'); });
  await page.click('[data-runtab="umfang"]');
  await page.fill('#runkm', '5');
  await page.click('#runaddbtn');
  await expect(page.locator('#runlist')).toContainText('5 km');
  await page.evaluate(() => showArea('mehr'));
  await openSect(page, 'sect-data');
  const dl = page.waitForEvent('download');
  await page.click('#savefile');
  expect((await dl).suggestedFilename()).toMatch(/^tagwerk-backup-/);
});
