// Ausstattung aus dem Profil: Kraft bietet nur an, was eingetragen ist. Dazu der AMRAP-Plan.
const { test, expect, closeRating } = require('./fixtures');

test.describe('neu eingerichtet (keine Geräte)', () => {
  test.use({ kit: false });

  test('ohne Kettlebell und Bänder: nur Körpergewicht, keine Kettlebell-Pläne', async ({ page }) => {
    expect(await page.evaluate(() => [profile.kit.kb, profile.kit.bands])).toEqual([[], []]);
    await expect(page.locator('#tabs button')).toHaveText(['Ganzkörper', 'Tabata', 'Läufer', 'Oberkörper', 'Büro']);
    await expect(page.locator('#gearbar [data-gear]')).toHaveCount(1);
    await expect(page.locator('#gearbar [data-gear="bw"]')).toHaveAttribute('aria-pressed', 'true');
    // keine einzige Übung und keine Variante mit Gerät
    const r = await page.evaluate(() => {
      const used = PLAN_ORDER.filter(planOwned).flatMap(pk => exList(pk).map(x => x.g));
      const offered = PLAN_ORDER.filter(planOwned).flatMap(pk => PLANS[pk].slots.flatMap(sl => resolve(pk, sl).avail));
      return [...new Set(used.concat(offered))];
    });
    expect(r).toEqual(['bw']);
    await page.evaluate(() => { document.querySelector('#fold-settings').open = true; });
    await expect(page.locator('#allkg')).toHaveCount(0);
  });

  test('Kettlebell im Profil eintragen → Kettlebell-Pläne und -Chip erscheinen; wieder entfernen → zurück zum Ganzkörper-Plan', async ({ page }) => {
    await page.evaluate(() => showArea('profil'));
    await page.fill('#kbnew', '16'); await page.click('#kbadd');
    await expect(page.locator('#tabs button')).toHaveText(['Ganzkörper', 'Tabata', 'AMRAP', 'Läufer', 'Oberkörper', 'Core', 'Büro']);
    await expect(page.locator('#gearbar [data-gear]')).toHaveCount(2);
    await page.evaluate(() => { showArea('kraft'); setPlan('amrap'); });
    expect(await page.evaluate(() => exList().map(x => x.gearText))).toEqual(Array(5).fill('Kettlebell 16 kg'));
    await page.evaluate(() => showArea('profil'));
    await page.click('[data-kbdel="16"]');
    expect(await page.evaluate(() => plan)).toBe('wed');
    await expect(page.locator('#tabs button')).toHaveCount(5);
  });

  test('wer schon Daten hat, behält die alten Standard-Geräte', async ({ page }) => {
    await page.evaluate(() => { localStorage.removeItem(KEYS.profile); store(KEYS.entries, []); });
    await page.reload();
    expect(await page.evaluate(() => [profile.kit.kb, profile.kit.bands, JSON.parse(localStorage.getItem(KEYS.profile)).kit.kb])).toEqual([[12], [10, 20, 30], [12]]);
  });
});

test('AMRAP: 20 Minuten Zirkel mit einer Kettlebell, Runden + Übungen werden gespeichert', async ({ page }) => {
  await page.evaluate(() => setPlan('amrap'));
  expect(await page.evaluate(() => [PLANS.amrap.mode, phaseSecs('amrap', 1) / 60, exList().map(x => x.name)]))
    .toEqual(['circuit', 20, ['Rotational Thruster', 'Deadlift to Halo', 'Lunge to Press-out', 'Pullover mit Rotation', 'Cross-Body Lunge']]);
  await expect(page.locator('#gearbar')).toContainText('Fest mit Kettlebell');
  await page.click('#btnMain'); await page.click('#btnNext');
  for (let i = 0; i < 7; i++) await page.click('#btnDone');
  await page.click('#btnNext'); await page.click('#btnNext');
  await page.click('#btnMain');
  await closeRating(page);
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.plan, e.total]).toEqual(['amrap', 7]);
  expect(await page.evaluate(() => resultText(saved.at(-1)))).toBe('1 Runden + 2 Übungen');
});
