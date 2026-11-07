// Einrichtung beim ersten Start: Fragen mit einem Tipp je Antwort, alles landet im Profil
const { test, expect } = require('./fixtures');

test.describe('Einrichtung', () => {
  test.use({ setup: true, kit: false, start: true });
  test('neues Gerät: Fragen durchgehen – Laufen, Tage, Kraft, Geräte, Puls, Rennen', async ({ page }) => {
    const dlg = page.locator('#setup');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.setprog')).toContainText('Frage 1 von');
    await dlg.locator('[data-setopt="run"][data-v="runner"]').click();
    await dlg.locator('[data-setday="long"][data-v="0"]').click();
    await dlg.locator('[data-setday="quality"][data-v="2"]').click();
    await dlg.locator('[data-setday="group"][data-v=""]').click();
    // Vorbelegung aus dem Profil ist schon gedrückt: auf Mo + Do bringen
    for (const d of [1, 2, 3, 4, 5, 6, 0]) { const c = dlg.locator(`[data-setmulti="strength"][data-v="${d}"]`); if ((await c.getAttribute('aria-pressed') === 'true') !== [1, 4].includes(d)) await c.click(); }
    await dlg.locator('[data-setnext]').click();
    await dlg.locator('[data-setmulti="kit"][data-v="kb"]').click();
    await dlg.locator('[data-setnext]').click();
    await dlg.locator('[data-setmulti="kb"][data-v="12"]').click();
    await dlg.locator('[data-setmulti="kb"][data-v="16"]').click();
    await dlg.locator('[data-setnext]').click();
    await page.fill('#setage', '43'); await dlg.locator('[data-setnext]').click();
    await page.fill('#setrest', '55'); await dlg.locator('[data-setnext]').click();
    const date = await page.evaluate(() => addDays(localDay(), 120));
    await page.fill('#setrname', 'Cardiff HM'); await page.fill('#setrdate', date); await dlg.locator('[data-setnext]').click();
    await expect(dlg.locator('.setq')).toHaveText('Fertig – los geht’s!');
    await dlg.locator('[data-setnext]').click();
    await expect(dlg).toBeHidden();
    const r = await page.evaluate(() => ({ w: [profile.week.runner, profile.week.long, profile.week.quality, profile.week.group, profile.week.strength], kit: [profile.kit.kb, profile.kit.bands], hr: profile.hr, races: races.map(x => [x.name, x.dist, x.prio]), done: !!load(KEYS.setup, null) }));
    expect(r.w).toEqual(['runner', 0, 2, null, [1, 4]]);
    expect(r.kit).toEqual([[12, 16], []]);
    expect([r.hr.max, r.hr.rest, r.hr.z && r.hr.z.length]).toEqual([178, 55, 5]); // 208 − 0,7 × 43
    expect(r.races).toEqual([['Cardiff HM', 'hm', 'A']]);
    expect(r.done).toBe(true);
    // kommt nicht wieder
    await page.reload();
    await page.waitForTimeout(400);
    await expect(dlg).toBeHidden();
  });
  test('„Später“ schließt und fragt nicht wieder; im Profil neu starten', async ({ page }) => {
    await page.locator('#setup [data-setclose]').click();
    await expect(page.locator('#setup')).toBeHidden();
    await page.reload(); await page.waitForTimeout(400);
    await expect(page.locator('#setup')).toBeHidden();
    await page.evaluate(() => showArea('profil'));
    await page.click('#setupstart');
    await expect(page.locator('#setup .setq')).toHaveText('Läufst du?');
    await page.locator('[data-setopt="run"][data-v="none"]').click();
    await expect(page.locator('#setup .setq')).toHaveText('An welchen Tagen machst du Kraft?');
    expect(await page.evaluate(() => [profile.week.quality, profile.week.long, profile.week.group])).toEqual([null, null, null]);
  });
});
