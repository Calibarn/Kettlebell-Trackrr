const { test, expect, closeRating } = require('./fixtures');

// Zurücksetzen: Einstellungen (Daten bleiben) und Werkseinstellung (alles weg, mit Bestätigung)
async function fill(page) {
  await page.evaluate(() => {
    const t = localDay();
    saveSession(t, { manual: true, total: 20 });
    addRun(addDays(t, -2), 10);
    races = [{ id: 'r', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    weights.push({ date: t, kg: 120 }); persistWeight();
    profile.week.quality = 5; profile.kit.kb = [12, 16]; persistProfile();
    choices = { 'wed.x': { kg: 16 } }; store(KEYS.choice, choices);
    toggleSkip(weekStart(t), 'group');
  });
  await closeRating(page);
  await page.waitForTimeout(400);
}
const answer = (page, list) => { page.removeAllListeners('dialog'); const seen = []; page.on('dialog', d => { seen.push(d.type()); const a = list.shift(); if (a === false) d.dismiss(); else d.accept(typeof a === 'string' ? a : undefined); }); return seen; };

test('Einstellungen zurücksetzen: Profil und Übungen auf Ausgangszustand, Daten bleiben', async ({ page }) => {
  await fill(page);
  await page.evaluate(() => showArea('mehr'));
  answer(page, [true]);
  await Promise.all([page.waitForEvent('load'), page.click('#settingsreset')]);
  expect(await page.evaluate(() => [saved.length, runLog.length, races.length, weights.length])).toEqual([1, 1, 1, 1]);
  expect(await page.evaluate(() => [profile.week.quality, profile.kit.kb, Object.keys(choices).length, Object.keys(weekSkip).length])).toEqual([2, [12], 0, 0]);
  await expect(page.locator('#toast')).toContainText('Einstellungen zurückgesetzt');
});

test('Werkseinstellung: falsches Wort löscht nichts, LÖSCHEN löscht alles inkl. Sync-Stand', async ({ page }) => {
  await fill(page);
  const dev = await page.evaluate(() => syncMeta.device);
  await page.evaluate(() => showArea('mehr'));
  // abbrechen bei der ersten Frage
  answer(page, [false]);
  await page.click('#factoryreset');
  await page.waitForTimeout(200);
  // falsches Wort
  answer(page, [true, false, 'loeschen bitte']);
  await page.click('#factoryreset');
  await expect(page.locator('#toast')).toContainText('es wurde nichts gelöscht');
  expect(await page.evaluate(() => runLog.length)).toBe(1);
  // richtig: ohne Backup, LÖSCHEN
  const seen = answer(page, [true, false, 'LÖSCHEN']);
  await Promise.all([page.waitForEvent('load'), page.click('#factoryreset')]);
  expect(seen).toEqual(['confirm', 'confirm', 'prompt']);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [saved.length, runLog.length, races.length, weights.length, profile.week.quality, Object.keys(weekSkip).length])).toEqual([0, 0, 0, 0, 2, 0]);
  const meta = await page.evaluate(() => syncMeta);
  expect(meta.device).not.toBe(dev);
  expect(Object.keys(meta.del)).toEqual([]); // keine Löschmarken, die sich auf andere Geräte übertragen könnten
  await expect(page.locator('#toast')).toContainText('Werkseinstellung');
});
