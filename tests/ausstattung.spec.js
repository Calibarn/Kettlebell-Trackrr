// Ausstattung aus dem Profil: Kraft bietet nur an, was eingetragen ist. Dazu der AMRAP-Plan.
const { test, expect, closeRating, openSect } = require('./fixtures');

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
    await openSect(page, 'sect-kit');
    await page.fill('#kbnew', '16'); await page.click('#kbadd');
    await expect(page.locator('#tabs button')).toHaveText(['Ganzkörper', 'Tabata', 'AMRAP', 'Läufer', 'Oberkörper', 'Core', 'Finisher', 'Büro']);
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
  await expect(page.locator('#gearbar')).toContainText('AMRAP ist fest mit Kettlebell');
  await page.click('#btnMain'); await page.click('#btnNext');
  for (let i = 0; i < 7; i++) await page.click('#btnDone');
  await page.click('#btnNext'); await page.click('#btnNext');
  await page.click('#btnMain');
  await closeRating(page);
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.plan, e.total]).toEqual(['amrap', 7]);
  expect(await page.evaluate(() => resultText(saved.at(-1)))).toBe('1 Runden + 2 Übungen');
});

test.describe('Kurzhanteln', () => {
  test.use({ kit: false });

  test('im Profil eintragen → Chip, Hantel-Varianten mit eigenem Gewicht je Übung, Skizze und „Du brauchst“', async ({ page }) => {
    await page.evaluate(() => showArea('profil'));
    await openSect(page, 'sect-kit');
    await expect(page.locator('#dbhint')).toHaveCount(0);
    await page.fill('#dbnew', '8'); await page.click('#dbadd');
    // beim Eintragen: Hinweis, dass Übungen mit zwei Hanteln ein Paar brauchen
    await expect(page.locator('#dbhint')).toContainText('Übungen mit zwei Hanteln brauchen ein Paar gleicher Gewichte');
    await page.fill('#dbnew', '4'); await page.click('#dbadd');
    expect(await page.evaluate(() => [profile.kit.db, profile.kit.dbDefault])).toEqual([[4, 8], 8]);
    await expect(page.locator('#sum-kit')).toHaveText('Kurzhanteln 4 · 8 kg');
    await page.evaluate(() => { showArea('kraft'); setPlan('sun'); });
    await expect(page.locator('#gearbar [data-gear]')).toHaveCount(2);
    await expect(page.locator('#gearbar [data-gear="db"]')).toHaveAttribute('aria-pressed', 'true');
    const ex = await page.evaluate(() => exList().map(x => [x.name, x.gearText]));
    // zwei Hanteln (Mehrzahl im Namen) → „2 × 8 kg“, eine Hantel → „8 kg“
    expect(ex).toContainEqual(['Seitheben mit Kurzhanteln', 'Kurzhanteln 2 × 8 kg']);
    expect(ex).toContainEqual(['Pullover mit Kurzhantel', 'Kurzhantel 8 kg']);
    // Liegestütze bleiben vor der Hantel (Körpergewicht ist dort die stärkste Variante)
    expect(ex).toContainEqual(['Liegestütze erhöht', 'Körpergewicht']);
    // Gewicht je Übung: Seitheben mit 4 kg, eigener Schlüssel (dbkg) neben dem Kettlebell-Gewicht
    await page.evaluate(() => { document.querySelector('#fold-settings').open = true; });
    await page.selectOption('[data-dbkg="lateral"]', '4');
    expect(await page.evaluate(() => { const x = exList().find(e => e.slot.id === 'lateral'); return [x.gearText, x.cfg, choices['sun.lateral']]; })).toEqual(['Kurzhanteln 2 × 4 kg', 'db:4', { dbkg: 4 }]);
    await expect(page.locator('#gearbar .needs')).toContainText('Kurzhanteln 2 × 4 kg + 2 × 8 kg');
    // Anleitung mit Hantel-Skizze (Stange + zwei Scheiben)
    await page.evaluate(() => openExerciseGuide(exList().findIndex(e => e.slot.id === 'lateral')));
    await expect(page.locator('#guide-title')).toHaveText('Seitheben mit Kurzhanteln');
    expect(await page.locator('#guide-body svg rect.fkb').count()).toBeGreaterThanOrEqual(4);
    // Kurzhanteln aus: zurück zu Band/Körpergewicht
    await page.evaluate(() => guide.close());
    await page.click('[data-gear="db"]');
    expect(await page.evaluate(() => exList().some(x => x.g === 'db'))).toBe(false);
    await page.click('[data-gear="db"]');
    await expect(page.locator('#toast')).toContainText('Oberkörper: Kurzhanteln an – beste Übungen gewählt.');
  });

  test('mit Kettlebell und Kurzhanteln: Swing bleibt Kettlebell, Rudern und Drücken mit Hanteln; Einrichtung fragt nach Hanteln', async ({ page }) => {
    await page.evaluate(() => { profile.kit.kb = [12]; profile.kit.db = [6, 10]; persistProfile(); setPlan('wed'); renderAll(); });
    const g = await page.evaluate(() => Object.fromEntries(exList().map(x => [x.slot.id, x.g])));
    expect([g.swing, g.halo, g.row, g.curl, g.squat]).toEqual(['kb', 'kb', 'db', 'db', 'db']);
    // „Alle Kurzhantel-Übungen“ setzt das Gewicht je Hantel für den Plan
    await page.evaluate(() => { document.querySelector('#fold-settings').open = true; });
    await page.selectOption('#alldbkg', '10'); await page.click('#alldbkgbtn');
    expect(await page.evaluate(() => [...new Set(exList().filter(x => x.g === 'db').map(x => x.kg))])).toEqual([10]);
    // Einrichtung: Kurzhanteln wählen → eigene Frage nach den Gewichten
    await page.evaluate(() => { profile.modules = { kraft: true, laufen: false, mobility: false }; persistProfile(); openSetup(); setupStep = 'kit'; setupAns = {}; renderSetup(); });
    await page.click('[data-setmulti="kit"][data-v="db"]');
    await page.click('[data-setnext]');
    await expect(page.locator('.setq')).toHaveText('Welche Kurzhanteln hast du?');
    await page.click('[data-setmulti="db"][data-v="5"]');
    expect(await page.evaluate(() => [profile.kit.kb, profile.kit.db])).toEqual([[], [5, 6, 10]]);
  });
});
