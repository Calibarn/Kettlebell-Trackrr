// Übungen & Varianten: Übungsname antippen öffnet die Anleitung mit Skizze und Stufen, ohne zur Übungsliste zu scrollen.
const { test, expect } = require('./fixtures');

test('Name in „Übungen & Varianten“ öffnet die Anleitung; Schließen bleibt an derselben Stelle', async ({ page }) => {
  await page.evaluate(() => { gear.kb = false; gear.band = false; gear.bw = true; store(KEYS.gear, gear); plan = 'wed'; resetState(); renderAll(); document.querySelector('#fold-settings').open = true; });
  const btn = page.locator('#settings [data-sguide]').first();
  await expect(page.locator('#settings')).toContainText('Übungsnamen antippen');
  const name = await page.evaluate(() => exList()[0].name);
  await expect(btn).toHaveAttribute('aria-label', `Anleitung: ${name}`);
  await btn.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  await btn.click();
  await expect(page.locator('#guide')).toBeVisible();
  await expect(page.locator('#guide-title')).toHaveText(name);
  await expect(page.locator('#guide')).toContainText('Leichter oder schwerer');
  await expect(page.locator('#guide svg').first()).toBeVisible();
  await page.click('#guide-close');
  await expect(page.locator('#guide')).toBeHidden();
  expect(Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThan(5);
  await expect(btn).toBeFocused();
});
