// Sauna (ab 1.7): Mobility → Recovery mit Eintragen, Verlauf und Anleitung; Sauna-Tage in der Trainingswoche stehen in „Heute dran“
// mit einem Hinweis passend zum Training. Dazu die neuen Qualitätseinheiten (Cruise-Intervalle, Norweger 4 × 4).
const { test, expect, openSect } = require('./fixtures');

// Läufer mit frischem Ergebnis (kein Testlauf), A-Rennen weit weg; Qualität und Longrun an festen Tagen relativ zu heute
const setupWeek = (page, { quality = null, long = null } = {}) => page.evaluate(({ quality, long }) => {
  const wd = new Date(localDay() + 'T12:00:00').getDay(), at = n => n === null ? null : (wd + n) % 7;
  results = [{ id: 'a', date: addDays(localDay(), -20), km: 10, time: 3300, dist: '10k' }]; persistResults();
  races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 140), dist: 'hm', prio: 'A', goal: null }]; persistRaces();
  Object.assign(profile.week, { runner: 'runner', quality: at(quality), long: at(long), group: null, extras: [], strength: [], mobility: [], sauna: [wd] }); persistProfile();
  runLog = []; persistRunLog(); localStorage.removeItem(KEYS.runask);
}, { quality, long });

test('Hinweis: Rennen heute oder morgen → lieber keine Sauna, harter Lauf heute → erst laufen, morgen → mild', async ({ page }) => {
  const hint = (o, race) => page.evaluate(async ([o, race]) => {
    const wd = new Date(localDay() + 'T12:00:00').getDay(), at = n => n === null ? null : (wd + n) % 7;
    results = [{ id: 'a', date: addDays(localDay(), -20), km: 10, time: 3300, dist: '10k' }];
    races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 140), dist: 'hm', prio: 'A', goal: null }].concat(race === null ? [] : [{ id: 'c', name: 'Stadtlauf', date: addDays(localDay(), race), dist: '10k', prio: 'C', goal: null }]);
    Object.assign(profile.week, { runner: 'runner', quality: at(o.quality ?? null), long: at(o.long ?? null), group: null, extras: [], strength: o.strength ? [wd] : [], mobility: [] });
    profile = normProfile(profile);
    return saunaHint(localDay());
  }, [o, race]);
  expect(await hint({}, 0)).toEqual({ warn: true, text: 'Heute Stadtlauf: danach keine Sauna – frühestens morgen, dann kurz und mild.' });
  expect(await hint({ quality: 0 }, 1)).toEqual({ warn: true, text: 'Morgen Stadtlauf: heute lieber keine Sauna – sie kostet Flüssigkeit und frische Beine.' });
  expect((await hint({ quality: 0 }, null)).text).toBe('Erst Qualität, dann Sauna – vorher trinken und etwas essen, dann 2–3 Gänge.');
  expect((await hint({ long: 1 }, null)).text).toBe('Morgen Longrun: heute mild – 2 Gänge und viel trinken.');
  expect((await hint({ strength: true }, null)).text).toBe('Nach dem Krafttraining: erst trinken, dann 2–3 Gänge.');
  expect((await hint({}, null)).text).toBe('2–3 Gänge à 8–12 Min., dazwischen abkühlen und ruhen, viel trinken.');
});

test('Profil: Sauna-Tage als Chips in der Trainingswoche', async ({ page }) => {
  await page.evaluate(() => { profile.week.sauna = []; persistProfile(); showArea('profil'); });
  await openSect(page, 'sect-week');
  const chip = page.locator('[data-saunaday="3"]');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(page.locator('[data-saunaday="3"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [profile.week.sauna, JSON.parse(localStorage.getItem(KEYS.profile)).week.sauna])).toEqual([[3], [3]]);
  // ungültige Tage fallen beim Laden weg
  expect(await page.evaluate(() => normProfile({ week: { sauna: [1, 1, 9, 'x', 6] } }).week.sauna)).toEqual([1, 6]);
});

test.describe('mit Startseite', () => {
  test.use({ start: true });

  test('Sauna-Tag: steht in „Heute dran“ mit Hinweis, Abhaken trägt ein, Rückgängig nimmt es zurück', async ({ page }) => {
    await setupWeek(page, { quality: 0 });
    await page.evaluate(() => showArea('start'));
    const row = page.locator('#startcontent .srowt', { hasText: 'Sauna' });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.stip')).toHaveText('Erst Qualität, dann Sauna – vorher trinken und etwas essen, dann 2–3 Gänge.');
    await row.locator('[data-saunadone]').click();
    await expect(page.locator('#startcontent .srowt', { hasText: 'Sauna' }).locator('.sdone')).toBeVisible();
    expect(await page.evaluate(() => getSaunaLog().map(e => e.d))).toEqual([await page.evaluate(() => localDay())]);
    await page.click('#toastundo');
    await expect(page.locator('#startcontent [data-saunadone]')).toHaveCount(1);
    expect(await page.evaluate(() => getSaunaLog())).toEqual([]);
    // ohne Sauna-Tag keine Zeile – außer, heute ist schon eine eingetragen (z. B. spontan unter Recovery)
    await page.evaluate(() => { profile.week.sauna = []; persistProfile(); renderStart(); });
    await expect(page.locator('#startcontent .srowt', { hasText: 'Sauna' })).toHaveCount(0);
    await page.evaluate(() => { putSaunaLog([{ d: localDay(), g: 3 }]); renderStart(); });
    await expect(page.locator('#startcontent .srowt', { hasText: 'Sauna' })).toContainText('3 Gänge');
  });
});

test('Mobility → Recovery: nachträglich mit Gängen eintragen, Verlauf, löschen mit Rückgängig', async ({ page }) => {
  await setupWeek(page);
  await page.evaluate(() => { profile.week.sauna = []; persistProfile(); showArea('mobility'); });
  await page.click('[data-mobtab="recovery"]');
  await expect(page.locator('#mobsub')).toBeHidden(); // nur ein Thema – keine zweite Reiterzeile
  await expect(page.locator('#saunalist')).toContainText('Noch keine Sauna eingetragen.');
  await expect(page.locator('#saunatoday .tiny')).toContainText('Profil → Trainingswoche');
  const d = await page.evaluate(() => addDays(localDay(), -2));
  await page.fill('#saunadate', d);
  await page.selectOption('#saunag', '3');
  await page.click('#saunasave');
  expect(await page.evaluate(() => getSaunaLog())).toEqual([{ d, g: 3 }]);
  await expect(page.locator('#saunalist')).toContainText('1 × in 4 Wochen');
  await expect(page.locator('#saunalist')).toContainText('Ø 3 Gänge');
  await expect(page.locator('#saunalist .row').nth(1)).toContainText('3 Gänge');
  // derselbe Tag noch einmal ohne Auswahl: ein Eintrag je Tag, die Gänge bleiben
  await page.fill('#saunadate', d);
  await page.click('#saunasave');
  expect(await page.evaluate(() => getSaunaLog())).toEqual([{ d, g: 3 }]);
  await page.click(`[data-saunadel="${d}"]`);
  await expect(page.locator('#saunalist')).toContainText('Noch keine Sauna eingetragen.');
  await page.click('#toastundo');
  await expect(page.locator(`[data-saunadel="${d}"]`)).toHaveCount(1);
  // Zukunft geht nicht
  await page.fill('#saunadate', await page.evaluate(() => addDays(localDay(), 1)));
  await page.click('#saunasave');
  expect(await page.evaluate(() => getSaunaLog().length)).toBe(1);
  // bleibt nach dem Neuladen auf dem Reiter
  await page.reload();
  await page.evaluate(() => showArea('mobility'));
  await expect(page.locator('[data-mobtab="recovery"]')).toHaveAttribute('aria-selected', 'true');
});

test('Sauna im Backup, Import ergänzt fehlende Tage, Sync kennt die Liste', async ({ page }) => {
  const r = await page.evaluate(() => {
    putSaunaLog([{ d: '2026-11-01', g: 2 }, { d: '2026-11-03' }, { d: '2026-11-03', g: 9 }, { d: 'x' }]);
    return { log: getSaunaLog(), backup: JSON.parse(backupJson()).saunaLog, sync: !!SYNC_COLLS.saunalog && SYNC_COLLS.saunalog.id({ d: '2026-11-01' }) };
  });
  // je Tag ein Eintrag (der letzte gewinnt), Gänge nur 1–6
  expect(r.log).toEqual([{ d: '2026-11-01', g: 2 }, { d: '2026-11-03' }]);
  expect(r.backup).toEqual(r.log);
  expect(r.sync).toBe('2026-11-01');
  const file = JSON.stringify({ version: 3, entries: [], saunaLog: [{ d: '2026-11-01', g: 4 }, { d: '2026-11-05', g: 3 }], settings: {} });
  await page.evaluate(() => showArea('start'));
  await page.setInputFiles('#importfile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  // vorhandene Tage bleiben, fehlende kommen dazu
  await expect.poll(() => page.evaluate(() => getSaunaLog())).toEqual([{ d: '2026-11-01', g: 2 }, { d: '2026-11-03' }, { d: '2026-11-05', g: 3 }]);
});

test('Qualität: Cruise-Intervalle in der Grundlage, Norweger 4 × 4 vor 10 km – mit Tempo, Vorbelegung und Warm-up', async ({ page }) => {
  const r = await page.evaluate(() => {
    results = [{ id: 'a', date: addDays(localDay(), -10), km: 10, time: 3000, dist: '10k' }];
    races = [{ id: 'a', name: 'A', date: '2027-05-02', dist: '10k', prio: 'A' }];
    const S = seasonPlan('2027-01-04', { L0: 12, W0: 25 }), keys = S.weeks.filter(w => !w.a && !w.test).flatMap(w => [w.phase, weekKey(w), weekKey(w, true)].join('|'));
    const nor = 'Intervall: Norweger 4 × 4 Min. hart, 3 Min. Trabpause', cru = '5 × 1 km Schwelle, 1 Min. Trabpause';
    return { base: keys.filter(k => k.startsWith('base|')).join(' '), spec: keys.filter(k => k.startsWith('spec|')).join(' '), plan: [repPlan(cru), repPlan(nor)], warm: warmFor({ kind: 'quality', detail: nor }), pace: hms(trainingPaces().interval) };
  });
  expect(r.base).toMatch(/[35] × 1 km Schwelle, 1 Min\. Trabpause \(\d:\d\d–\d:\d\d \/km\)/); // in einer Entlastungswoche 3 statt 5
  expect(r.spec).toContain(`Intervall: Norweger 4 × 4 Min. hart, 3 Min. Trabpause (≈ ${r.pace} /km)`);
  expect(r.plan).toEqual([{ n: 5, km: 1 }, { n: 4, sec: 240 }]);
  expect(r.warm).toBe('interval');
});
