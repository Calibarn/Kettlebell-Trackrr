const { test, expect, forward, closeRating } = require('./fixtures');

test('lädt ohne Fehler und zeigt alle Kraft-Pläne', async ({ page }) => {
  await expect(page.locator('#tabs button')).toHaveText(['Ganzkörper', 'Tabata', 'Läufer', 'Oberkörper', 'Büro']);
  await expect(page.locator('#gearbar [data-gear]')).toHaveCount(3);
});

test('Geräte-Auswahl: ein Gerät → nur dieses Gerät, nichts gewählt → Körpergewicht', async ({ page }) => {
  const result = await page.evaluate(() => {
    const out = {};
    for (const g of ['kb', 'band', 'bw']) {
      gear = { kb: g === 'kb', band: g === 'band', bw: g === 'bw' };
      out[g] = PLAN_ORDER.flatMap(pk => exList(pk).map(x => x.g));
    }
    gear = { kb: false, band: false, bw: false }; ensureGear();
    out.none = PLAN_ORDER.flatMap(pk => exList(pk).map(x => x.g));
    return out;
  });
  for (const g of ['kb', 'band', 'bw']) expect(new Set(result[g])).toEqual(new Set([g]));
  expect(new Set(result.none)).toEqual(new Set(['bw']));
});

test('Geräte-Auswahl wird gemerkt', async ({ page }) => {
  await page.click('[data-gear="band"]');
  await page.reload();
  expect(await page.evaluate(() => gear)).toEqual({ kb: true, band: false, bw: true });
});

test('Zirkel: abhaken, Zeitübung, zurücknehmen, Wiederherstellen, Speichern mit Bewertung', async ({ page }) => {
  await page.click('#btnMain');
  await page.click('#btnNext');
  await expect(page.locator('#btnDone')).toBeVisible();
  // bis zur ersten Zeitübung abhaken
  for (let i = 0; i < 12 && !(await page.locator('#timerwork').isVisible()); i++) await page.click('#btnDone');
  await expect(page.locator('#timerwork')).toBeVisible();
  const before = await page.evaluate(() => completions);
  await page.click('#timedstart');
  await expect(page.locator('#btnDone')).toHaveText('● Zeitübung läuft');
  await page.evaluate(() => { timed.start -= timed.seconds * timed.sides + 1; tick(); });
  expect(await page.evaluate(() => completions)).toBe(before + 1);
  await page.click('#btnUndo');
  expect(await page.evaluate(() => completions)).toBe(before);
  await page.click('#btnDone');

  await page.reload();
  expect(await page.evaluate(() => [plan, phase, completions, running])).toEqual(['wed', 1, before + 1, true]);

  await page.click('#btnNext'); await page.click('#btnNext');
  await expect(page.locator('#btnMain')).toHaveText('💾 Speichern');
  await page.click('#btnMain');
  await expect(page.locator('#rate-title')).toHaveText('Einheit gespeichert');
  await expect(page.locator('#rate-progress')).toContainText('Erste Einheit mit diesem Aufbau');
  await page.click('[data-rpe="7"]');
  await page.fill('#ratenote', 'gut geschlafen');
  await page.click('#rateform button[type=submit]');
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.total, e.rpe, e.note]).toEqual([before + 1, 7, 'gut geschlafen']);
  expect(await page.evaluate(() => comparable(saved.at(-1)))).toBe(true);
  await expect(page.locator('#statsline')).toContainText('Diese Woche 1');
});

test('Zirkel: neuer Bestwert wird nach dem Speichern gemeldet und im Verlauf markiert', async ({ page }) => {
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 20 }));
  await closeRating(page);
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 25 }));
  await expect(page.locator('#rate-progress')).toContainText('Neuer Bestwert');
  await closeRating(page);
  await page.evaluate(() => { document.querySelector('#fold-history').open = true; });
  await expect(page.locator('#history tr').first()).toContainText('🏆');
  await page.locator('#history [data-rate]').first().click();
  await expect(page.locator('#rate-title')).toHaveText('Einheit bewerten');
});

test('Tabata läuft automatisch durch und speichert nach dem Cooldown', async ({ page }) => {
  await page.click('[data-plan="tabata"]');
  await page.click('#btnMain');
  await forward(page, 4 * 60 + 1);
  expect(await page.evaluate(() => phase)).toBe(1);
  await expect(page.locator('#phase-badge')).toHaveText('Arbeit');
  await forward(page, 21);
  await expect(page.locator('#phase-badge')).toHaveText('Pause');
  await forward(page, await page.evaluate(() => durationSecs() - secNow() + 1));
  expect(await page.evaluate(() => phase)).toBe(2);
  await forward(page, 4 * 60 + 1);
  await expect(page.locator('#rate-progress')).toContainText('Alle 30 Intervalle geschafft');
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.mode, e.total, e.of]).toEqual(['tabata', 30, 30]);
});

test('Tabata: nach drei kompletten Einheiten wird die Steigerung vorgeschlagen', async ({ page }) => {
  await page.click('[data-plan="tabata"]');
  await expect(page.locator('#planhint')).toBeHidden();
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) saved.push({ v: 3, id: 'tb' + i, date: '2026-10-2' + i, plan: 'tabata', mode: 'tabata', total: 30, of: 30, cfg: currentCfg('tabata'), names: exList().map(x => x.name), at: '2026-10-2' + i + 'T10:00:00Z' });
    persistEntries(); renderAll();
  });
  await expect(page.locator('#planhint')).toContainText('bereit für 8 Runden');
  await page.click('#planhintbtn');
  expect(await page.evaluate(() => tabataCfg().rounds)).toBe(8);
  await expect(page.locator('#planhint')).toBeHidden();
});

test('Läufer: Sätze, EMOM und Hinweis „bereit für mehr“ mit Stufenwechsel', async ({ page }) => {
  await page.click('[data-plan="run"]');
  for (let i = 0; i < 3; i++) await page.fill(`[data-slot="split"][data-idx="${i}"]`, '15');
  for (let i = 0; i < 3; i++) await page.fill(`[data-slot="row"][data-idx="${i}"]`, '12');
  await page.click('#btnMain'); await page.click('#btnNext');
  await page.click('#emomstart');
  await expect(page.locator('#emominfo')).toContainText('Minute 1 von 3');
  await page.fill('[data-slot="swing"][data-idx="0"]', '12');
  await page.click('#btnNext'); await page.click('#btnNext'); await page.click('#btnMain');
  await expect(page.locator('#rate-progress')).toContainText('Split Squat: Nächste Stufe: Split Squat · Tempo 3-1-1');
  await expect(page.locator('#rate-progress')).not.toContainText('Rudern');
  await closeRating(page);
  const e = await page.evaluate(() => saved.at(-1));
  expect(e.sets[0]).toEqual([15, 15, 15]);
  expect(e.total).toBe(45 + 36 + 12);
  await expect(page.locator('.setcard .advice')).toHaveCount(1);
  await page.click('[data-advance="split"]');
  expect(await page.evaluate(() => stageOf('run', PLANS.run.slots[0]))).toBe('Split Squat · Tempo 3-1-1');
  await expect(page.locator('.setcard .advice')).toHaveCount(0);
});

test('Sprachansagen: Phase, Schritte und Übungen – nur mit der Gerätestimme', async ({ page }) => {
  await page.evaluate(() => showArea('mehr'));
  await expect(page.locator('#voiceval')).toHaveText('An');
  await expect(page.locator('#voicehint')).toContainText('Anna');
  await page.evaluate(() => showArea('kraft'));
  await page.click('#btnMain');
  await page.waitForTimeout(800);
  await forward(page, await page.evaluate(() => STEPS[plan].warmup[0].end - secNow() + 0.2));
  await page.click('#btnNext');
  await page.waitForTimeout(800);
  await page.click('#btnDone');
  await page.waitForTimeout(100);
  const spoken = await page.evaluate(() => __spoken);
  expect(spoken.every(s => s.voice === 'Anna')).toBe(true);
  const texts = spoken.map(s => s.text);
  expect(texts[0]).toMatch(/^Aufwärmen\. /);
  expect(texts.some(t => /^Zirkel, 21 Minuten\. Erste Übung: /.test(t))).toBe(true);
  expect(texts.at(-1)).toMatch(/, \d/);
});

test.describe('ohne deutsche Gerätestimme', () => {
  test.use({ initScripts: ['window.__voices = [{ name: "Google Deutsch", lang: "de-DE", localService: false, default: true }];'] });
  test('werden Online-Stimmen nicht genutzt', async ({ page }) => {
    await page.evaluate(() => showArea('mehr'));
    await expect(page.locator('#voiceval')).toHaveText('Nicht verfügbar');
    await page.evaluate(() => showArea('kraft'));
    await page.click('#btnMain');
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => __spoken.length)).toBe(0);
  });
});

test.describe('iPhone mit Audio Session API', () => {
  test.use({ initScripts: ['navigator.audioSession = { type: "auto" };'] });
  test('„Ton trotz Stummschalter“ schaltet auf playback', async ({ page }) => {
    await page.evaluate(() => showArea('mehr'));
    await expect(page.locator('#loudrow')).toBeVisible();
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('auto');
    await page.click('#loudrow');
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('playback');
    await page.reload();
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('playback');
  });
});
