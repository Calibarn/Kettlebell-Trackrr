// Handy-Browser: Hinweis zum Installieren dauerhaft ganz oben (nicht wegklickbar), Link öffnet die Anleitung.
const { test, expect } = require('./fixtures');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

test.describe('iPhone im Browser', () => {
  test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 } });
  test('ganz oben, ohne Schließen-Knopf, in allen Bereichen; Link führt zur Anleitung', async ({ page }) => {
    const bar = page.locator('#installbar');
    await expect(bar).toContainText('Als App installieren');
    await expect(bar).toContainText('Zum Home-Bildschirm');
    await expect(bar.locator('button')).toHaveCount(1);
    expect(await page.evaluate(() => document.body.firstElementChild.id)).toBe('installbar');
    for (const a of ['laufen', 'mobility', 'profil', 'mehr']) { await page.evaluate(x => showArea(x), a); await expect(bar).toBeVisible(); }
    await page.evaluate(() => showArea('kraft'));
    await page.click('#installguide');
    await expect(page.locator('#area-mehr')).toBeVisible();
    await expect(page.locator('#guide-install')).toHaveAttribute('open', '');
    await expect(page.locator('#guide-install')).toContainText('Schon Daten im Browser?');
    // Neu laden: weiterhin da (nichts wird gemerkt)
    await page.reload();
    await expect(bar).toBeVisible();
    // Während des Trainings ausgeblendet
    await page.evaluate(() => showArea('kraft'));
    await page.click('#btnMain');
    await expect(bar).toBeHidden();
  });
});

test('Desktop-Browser: kein Hinweis', async ({ page }) => {
  await expect(page.locator('#installbar')).toBeHidden();
  expect(await page.evaluate(() => $('installbar').innerHTML)).toBe('');
});
