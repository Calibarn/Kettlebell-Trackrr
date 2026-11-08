const fs = require('fs');
const { test, expect, openSect } = require('./fixtures');

test.describe('Fehlerprotokoll', () => {
  test.use({ allowedErrors: [/Testfehler/] });

  test('Fehler werden mitgeschrieben (gleiche zusammengefasst), als Textdatei exportiert und lassen sich leeren', async ({ page }) => {
    await page.evaluate(() => showArea('mehr'));
    await openSect(page, 'sect-data');
    await expect(page.locator('#errhint')).toHaveText('Keine Fehler aufgezeichnet – Datei für die Fehlersuche');
    await expect(page.locator('#errclear')).toBeHidden();
    // zweimal derselbe Fehler, einmal ein abgelehntes Promise
    await page.evaluate(() => { setPlan('wed'); for (let i = 0; i < 2; i++) setTimeout(() => { throw new Error('Testfehler A'); }, 0); setTimeout(() => Promise.reject(new Error('Testfehler B')), 5); });
    await expect.poll(() => page.evaluate(() => readErrLog().length)).toBe(2);
    const log = await page.evaluate(() => readErrLog());
    expect(log.map(e => [e.msg.replace(/^Uncaught /, ''), e.n || 1, e.v, e.area, e.plan])).toEqual([['Error: Testfehler A', 2, '1.1', 'mehr', 'wed'], ['Testfehler B', 1, '1.1', 'mehr', 'wed']]);
    expect(log[1].where).toBe('Promise');
    // Anzeige aktualisiert sich beim Öffnen des Bereichs
    await page.evaluate(() => { document.getElementById('sect-data').open = false; });
    await openSect(page, 'sect-data');
    await expect(page.locator('#errhint')).toContainText('3 Fehler, zuletzt');
    // Export als Textdatei
    const dl = page.waitForEvent('download');
    await page.click('#errexport');
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/^tagwerk-fehler-\d{4}-\d{2}-\d{2}\.txt$/);
    const txt = fs.readFileSync(await d.path(), 'utf8');
    expect(txt).toContain('Tagwerk Fehlerprotokoll');
    expect(txt).toContain('Version: 1.1');
    expect(txt).toContain('Einträge: 2');
    expect(txt).toMatch(/\[1\] .* \(×2\) · v1\.1 · mehr\/wed/);
    expect(txt).toContain('Testfehler B');
    // nicht in Backup oder Sync
    expect(await page.evaluate(() => backupJson().includes('Testfehler'))).toBe(false);
    // leeren (mit Rückgängig)
    await page.click('#errclear');
    expect(await page.evaluate(() => readErrLog().length)).toBe(0);
    await expect(page.locator('#errclear')).toBeHidden();
    await page.click('#toastundo');
    expect(await page.evaluate(() => readErrLog().length)).toBe(2);
  });

  test('höchstens 50 Einträge, die ältesten fallen heraus', async ({ page }) => {
    const r = await page.evaluate(() => { for (let i = 0; i < 60; i++) logError('Testfehler ' + i, 'x'); const l = readErrLog(); return [l.length, l[0].msg, l[49].msg]; });
    expect(r).toEqual([50, 'Testfehler 10', 'Testfehler 59']);
  });
});
