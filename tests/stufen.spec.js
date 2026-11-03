// Körpergewicht in drei Stufen: leicht / mittel / schwer – je Übung, zählt für die Vergleichbarkeit
const { test, expect } = require('./fixtures');

test('Stufe je Körpergewicht-Übung: Hinweis, Anzeige, eigene Bestwerte, Anleitung', async ({ page }) => {
  await page.evaluate(() => { gear = { kb: false, band: false, bw: true }; store(KEYS.gear, gear); setPlan('wed'); renderAll(); document.querySelector('#fold-settings').open = true; });
  const before = await page.evaluate(() => { const x = exList().find(x => x.slot.id === 'squat'); return [x.name, x.lvl, x.cfg]; });
  expect(before).toEqual(['Kniebeugen', 'mittel', 'bw']);
  await page.selectOption('[data-lvl="squat"]', 'leicht');
  const after = await page.evaluate(() => { const x = exList().find(x => x.slot.id === 'squat'); return [x.lvl, x.cfg, x.note, x.gearText]; });
  expect(after).toEqual(['leicht', 'bw:leicht', 'Auf einen Stuhl setzen und wieder aufstehen (Box Squat)', 'Körpergewicht · leicht']);
  await expect(page.locator('#worklist')).toContainText('Körpergewicht · leicht');
  expect(await page.evaluate(() => cfgText('bw:schwer'))).toBe('Körpergewicht · schwer');
  // Anleitung zeigt alle drei Stufen, die gewählte markiert
  await page.evaluate(() => openExerciseGuide(exList().findIndex(x => x.slot.id === 'squat')));
  await expect(page.locator('#guide-body')).toContainText('Leichter oder schwerer');
  await expect(page.locator('#guide-body .stagelist li.cur')).toContainText('leicht (gewählt)');
  await page.evaluate(() => guide.close());
  // zurück auf mittel: keine Abweichung mehr
  await page.selectOption('[data-lvl="squat"]', 'mittel');
  expect(await page.evaluate(() => [choices['wed.squat'].lvl, exList().find(x => x.slot.id === 'squat').cfg])).toEqual([null, 'bw']);
});

test('Stufen nur bei Körpergewicht und nicht bei Übungen mit eigenen Stufen', async ({ page }) => {
  const r = await page.evaluate(() => {
    gear = { kb: true, band: true, bw: true };
    const withKb = exList('wed').every(x => !!x.lvls === (x.g === 'bw' && !!BW_LEVELS[x.name]));
    gear = { kb: false, band: false, bw: true };
    const run = exList('run').map(x => [x.slot.id, !!x.lvls]);
    return { withKb, split: run.find(([id]) => id === 'split')[1], calf: run.find(([id]) => id === 'calf')[1] };
  });
  expect(r).toEqual({ withKb: true, split: false, calf: true }); // Stufen genau bei den Körpergewicht-Varianten
});

test('Sätze an der Obergrenze: nächste Stufe vorschlagen und übernehmen', async ({ page }) => {
  await page.evaluate(() => {
    gear = { kb: false, band: false, bw: true }; store(KEYS.gear, gear); setPlan('run');
    const i = exList().findIndex(x => x.slot.id === 'calf'), sl = exList()[i].slot;
    for (const k of Object.keys(runReps)) runReps[k] = runReps[k].map(() => k === 'calf' ? '15' : '8');
    saveSession(localDay(), { manual: true }); document.querySelectorAll('dialog[open]').forEach(d => d.close()); resetState(); renderAll();
  });
  const adv = page.locator('[data-lvlup="calf"]');
  await expect(adv).toHaveAttribute('data-to', 'schwer');
  await adv.click();
  expect(await page.evaluate(() => exList().find(x => x.slot.id === 'calf').lvl)).toBe('schwer');
});

test.describe('englisch', () => {
  test.use({ locale: 'en-US' });
  test('alle Stufen-Texte sind übersetzt', async ({ page }) => {
    const miss = await page.evaluate(() => { for (const [a, b] of Object.values(BW_LEVELS)) { tr(a); tr(b); } return [...i18nMissing]; });
    expect(miss).toEqual([]);
    expect(await page.evaluate(() => LVL_LABEL.schwer)).toBe('hard');
  });
});
