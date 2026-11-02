const { test, expect } = require('./fixtures');

// Neuigkeiten: einmal nach einem Update, danach nur noch unter Mehr
test.describe('Neuigkeiten', () => {
  test.use({ initScripts: [`if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('jan-kb-notes-v1', '{"seen":"alt","auto":true}'); }`] });

  test('erscheinen beim ersten Start nach einem Update, danach nicht mehr; unter Mehr jederzeit', async ({ page }) => {
    await expect(page.locator('#notes')).toBeVisible();
    await expect(page.locator('#notes-title')).toHaveText('Neu in der App');
    await expect(page.locator('#notes-body h3').first()).toHaveText(await page.evaluate(() => CHANGELOG[0].title));
    await page.click('#notes-close');
    await expect(page.locator('#notes')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem(KEYS.notes)).seen)).toBe(await page.evaluate(() => CHANGELOG[0].id));

    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator('#notes')).toBeHidden();

    await page.evaluate(() => showArea('mehr'));
    await expect(page.locator('#noteshint')).toContainText('Grundstand');
    await page.click('#notesbtn');
    await expect(page.locator('#notes-title')).toHaveText('Neuigkeiten');
    await expect(page.locator('#notes-body h3')).toHaveCount(await page.evaluate(() => CHANGELOG.length));
    await page.click('#notes-close');

    // abschalten: auch eine neue Version öffnet nichts mehr automatisch
    await page.click('#notesauto');
    await expect(page.locator('#notesautoval')).toHaveText('Aus');
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem(KEYS.notes)); o.seen = 'alt'; localStorage.setItem(KEYS.notes, JSON.stringify(o)); });
    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator('#notes')).toBeHidden();
  });
});

test('jeder Neuigkeiten-Eintrag hat eine eindeutige id, ein gültiges Datum und Punkte', async ({ page }) => {
  const c = await page.evaluate(() => CHANGELOG);
  expect(new Set(c.map(x => x.id)).size).toBe(c.length);
  for (const x of c) { expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(x.items.length).toBeGreaterThan(0); }
  expect(c.map(x => x.date)).toEqual(c.map(x => x.date).slice().sort().reverse());
});
