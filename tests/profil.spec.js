const { test, expect } = require('./fixtures');

// Profil: Herzfrequenz-Zonen, Trainingswoche, Geräte & Gewichte, Körpergewicht
const openProfil = page => page.evaluate(() => showArea('profil'));

test('Herzfrequenz: Zonen nach Karvonen, manuell anpassbar, im Plan als bpm', async ({ page }) => {
  await openProfil(page);
  await page.fill('#hrmax', '184');
  await page.fill('#hrrest', '60');
  await page.click('#hrcalc');
  expect(await page.evaluate(() => profile.hr)).toEqual({ max: 184, rest: 60, z: [122, 134, 147, 159, 172] });
  await expect(page.locator('.zonelist')).toContainText('Zone 2134–146 bpm');

  // Werte der Uhr übernehmen; nicht aufsteigend → abgelehnt
  await page.fill('[data-zone="3"]', '120');
  await page.dispatchEvent('[data-zone="3"]', 'change');
  await expect(page.locator('[data-zone="3"]')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => profile.hr.z[2])).toBe(147);
  await page.fill('[data-zone="2"]', '136');
  await page.dispatchEvent('[data-zone="2"]', 'change');
  await page.fill('[data-zone="3"]', '149');
  await page.dispatchEvent('[data-zone="3"]', 'change');
  expect(await page.evaluate(() => [zoneRange(2), hrize('locker in Zone 2'), hrize('Zone 2 (schon da)')])).toEqual(['136–148 bpm', 'locker in Zone 2 (136–148 bpm)', 'Zone 2 (schon da)']);

  const date = await page.evaluate(() => addDays(localDay(), 7 * 20));
  await page.evaluate(d => { races = [{ id: 'h', name: 'HM', date: d, dist: 'hm', prio: 'A', goal: null }]; persistRaces(); }, date);
  await page.reload();
  await page.evaluate(() => { showArea('laufen'); });
  await page.click('[data-runtab="plan"]');
  await expect(page.locator('#planschedule')).toContainText('Zone 2 (136–148 bpm)');
});

test('Trainingswoche: Tage aus dem Profil im Plan und im Kalender, Hinweise bei harten Tagen hintereinander', async ({ page }) => {
  const date = await page.evaluate(() => addDays(localDay(), 7 * 12));
  await page.evaluate(d => { races = [{ id: 'h', name: 'HM', date: d, dist: 'hm', prio: 'A', goal: 7140 }]; persistRaces(); }, date);
  await openProfil(page);
  await page.selectOption('#wkquality', '6');
  await expect(page.locator('#weekpanel .alert')).toContainText('Qualität am Samstag direkt vor dem Longrun');
  await page.selectOption('#wkquality', '4');
  await page.selectOption('#wkgroup', '');
  await page.click('[data-strength="4"]');
  await page.click('[data-strength="1"]');
  await page.selectOption('#wkextraday', '1');
  await page.fill('#wkextraname', 'Blaze');
  await page.dispatchEvent('#wkextraname', 'change');
  expect(await page.evaluate(() => profile.week)).toEqual({ group: null, quality: 4, long: 0, strength: [6, 1], extraName: 'Blaze', extraDay: 1 });
  await expect(page.locator('#weekpanel .alert')).toHaveCount(0);

  await page.reload();
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="plan"]');
  await expect(page.locator('#planschedule .dur')).toHaveText(['Mo', 'Mo', 'Do', 'Sa', 'So']);
  await expect(page.locator('#planschedule')).not.toContainText('Laufgruppe');
  await expect(page.locator('#planschedule')).toContainText('Blaze');

  const ics = (await page.evaluate(() => planIcs())).replace(/\r\n /g, '');
  const days = [...ics.matchAll(/UID:kb-quality-(\d{4}-\d{2}-\d{2})@/g)].map(m => m[1]);
  expect(days.length).toBeGreaterThan(5);
  expect(await page.evaluate(ds => ds.map(d => new Date(d + 'T12:00:00').getDay()), days)).toEqual(days.map(() => 4));
  expect(ics).toContain('SUMMARY:Blaze');
  expect(ics).not.toContain('UID:kb-group-');
  // Rennwoche: kein Longrun, Qualität nur mit 2 Tagen Abstand vor dem Rennen
  const rw = await page.evaluate(() => { const S = seasonPlan(); return weekSchedule(S.weeks.at(-1)).map(i => i.kind); });
  expect(rw).toContain('race');
  expect(rw).not.toContain('long');
});

test('Geräte & Gewichte: eigene Kettlebells und Bänder steuern die Auswahl im Kraft-Bereich', async ({ page }) => {
  await openProfil(page);
  await page.fill('#kbnew', '16');
  await page.click('#kbadd');
  await page.fill('#kbnew', '8,5');
  await page.click('#kbadd');
  await page.fill('#kbnew', '99');
  await page.click('#kbadd');
  expect(await page.evaluate(() => profile.kit.kb)).toEqual([8.5, 12, 16]);
  await page.selectOption('#kbdefault', '16');
  await page.click('[data-banddel="30"]');
  expect(await page.evaluate(() => bandOptions())).toEqual(['10', '20', '10+20']);

  await page.evaluate(() => showArea('kraft'));
  await page.evaluate(() => { document.querySelector('#fold-settings').open = true; });
  const kgSel = page.locator('#settings select[data-kg]').first();
  await expect(kgSel).toHaveValue('16');
  await expect(kgSel.locator('option')).toHaveText(['8,5 kg', '12 kg', '16 kg']);
  await expect(page.locator('#allkg')).toHaveValue('16');
  const bandSel = page.locator('#settings select[data-band]').first();
  if (await bandSel.count()) await expect(bandSel.locator('option')).toHaveCount(3);

  // explizit gewähltes Gewicht bleibt, auch wenn es nicht mehr im Profil ist
  await kgSel.selectOption('12');
  await page.evaluate(() => { profile.kit.kb = [16]; persistProfile(); renderAll(); document.querySelector('#fold-settings').open = true; });
  await expect(page.locator('#settings select[data-kg]').first()).toHaveValue('12');
  await expect(page.locator('#settings select[data-kg]').first().locator('option')).toHaveText(['12 kg (nicht im Profil)', '16 kg']);
});

test('Körpermaße: Gewicht und Bauchumfang in einem Formular, ersetzen, Trend, Diagramm-Umschalter, löschen, Backup und Import', async ({ page }) => {
  await openProfil(page);
  const d = await page.evaluate(() => [21, 14, 7, 0].map(n => addDays(localDay(), -n)));
  const save = async (date, kg, cm = '') => { await page.fill('#measuredate', date); await page.fill('#measurekg', kg); await page.fill('#measurecm', cm); await page.click('#measureform button[type=submit]'); };
  for (const [i, kg] of ['123,4', '122,6', '122,3', '121,6'].entries()) await save(d[i], kg, i === 0 ? '118' : i === 3 ? '116,5' : '');
  await expect(page.locator('#weightlatest')).toHaveText('121,6 kg');
  await expect(page.locator('#weightdelta')).toHaveText('-1,8 kg');
  await expect(page.locator('#weightrate')).toHaveText('-0,6 kg');
  await expect(page.locator('#waistlatest')).toHaveText('116,5 cm');
  await expect(page.locator('#waistdelta')).toHaveText('-1,5 cm');
  await page.evaluate(() => { document.querySelector('#measurehistory').closest('details').open = true; });
  await expect(page.locator('#measurehistory tr')).toHaveCount(4);
  await expect(page.locator('#measurechart svg circle')).toHaveCount(4);
  await page.click('[data-measure="waist"]');
  await expect(page.locator('#measurechart svg circle')).toHaveCount(2);
  await expect(page.locator('#measurechart svg')).toHaveAttribute('aria-label', /Bauchumfang/);
  // nur Bauchumfang ändern: Gewicht des Tages bleibt
  await save(d[3], '', '116');
  expect(await page.evaluate(ds => [weights.find(e => e.date === ds).kg, waist.find(e => e.date === ds).cm], d[3])).toEqual([121.6, 116]);
  await save(d[3], '121,0');
  expect(await page.evaluate(() => weights.length)).toBe(4);
  await expect(page.locator('#weightlatest')).toHaveText('121,0 kg');
  await save(d[3], '12');
  await expect(page.locator('#measurekg')).toHaveAttribute('aria-invalid', 'true');
  await save(d[3], '', '');
  await expect(page.locator('#toast')).toContainText('Gewicht oder Bauchumfang');
  await page.evaluate(() => { document.querySelector('#measurehistory').closest('details').open = true; });
  await expect(page.locator('#measurehistory tr')).toHaveCount(4);
  await page.click(`[data-measure-delete="${d[0]}"]`);
  await expect(page.locator('#weightdelta')).toHaveText('-1,6 kg');
  expect(await page.evaluate(ds => waist.some(e => e.date === ds), d[0])).toBe(false); // beide Werte des Tages gelöscht
  const dl = page.waitForEvent('download');
  await page.click('#measurecsv');
  const csv = require('fs').readFileSync(await (await dl).path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  expect(csv[0]).toBe('Datum;Gewicht (kg);Bauchumfang (cm);Notiz');
  expect(csv.at(-1)).toBe(`${d[3]};121,0;116,0;`);

  const backup = JSON.parse(await page.evaluate(() => backupJson()));
  expect(backup.weights.map(e => e.date)).toEqual(d.slice(1));
  expect(backup.settings.profile.kit.kbDefault).toBe(12);
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 3, weights: [{ date: d[0], kg: 124 }, { date: d[1], kg: 99 }, { date: 'kaputt', kg: 1 }],
    settings: { profile: { hr: { max: 180, rest: 55, z: [118, 130, 143, 155, 168] }, week: { quality: 5 }, zukunft: true } }
  })) });
  await expect.poll(() => page.evaluate(() => weights.length)).toBe(4);
  expect(await page.evaluate(ds => weights.find(e => e.date === ds).kg, d[1])).toBe(122.6);
  expect(await page.evaluate(() => [profile.hr.max, profile.week.quality, profile.week.long])).toEqual([180, 5, 0]);
});

test('Trainingswoche: Einheiten dauerhaft abschalten oder nur diese Woche „Entfällt“', async ({ page }) => {
  const date = await page.evaluate(() => addDays(localDay(), 7 * 12));
  await page.evaluate(d => { races = [{ id: 'h', name: 'HM', date: d, dist: 'hm', prio: 'A', goal: null }]; persistRaces(); }, date);
  // dauerhaft: Qualität „keine“ → Hinweis, fehlt im Plan
  await openProfil(page);
  await page.selectOption('#wkquality', '');
  await expect(page.locator('#weekpanel .alert')).toContainText('Ohne Qualitätseinheit');
  expect(await page.evaluate(() => profile.week.quality)).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => profile.week.quality)).toBeNull();
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="plan"]');
  await expect(page.locator('#planschedule')).not.toContainText('Qualität');

  // nur diese Woche: Laufgruppe entfällt
  const grp = page.locator('#planschedule [data-skip="group"]');
  await grp.click();
  await expect(page.locator('#planschedule .row.skipped')).toContainText('entfällt diese Woche');
  await expect(page.locator('#planschedule [data-skip="group"]')).toHaveText('Wieder rein');
  const ics = (await page.evaluate(() => planIcs())).replace(/\r\n /g, '');
  const thisWeek = await page.evaluate(() => weekStart(localDay()));
  const grpDay = await page.evaluate(w => addDays(w, 2), thisWeek);
  if (grpDay >= await page.evaluate(() => localDay())) expect(ics).not.toContain(`UID:kb-group-${grpDay}@`);
  expect(ics).toContain('Laufgruppe (entfällt)');
  // nächste Woche ist sie wieder da
  expect(await page.evaluate(() => { const S = seasonPlan(); return [weekSchedule(S.weeks[0]).find(i => i.kind === 'group').skip, weekSchedule(S.weeks[1]).find(i => i.kind === 'group').skip]; })).toEqual([true, false]);
  expect(JSON.parse(await page.evaluate(() => backupJson())).weekSkip[thisWeek]).toEqual(['group']);
  await page.reload();
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runsub="woche"]');
  await page.click('#planschedule [data-skip="group"]');
  await expect(page.locator('#planschedule .row.skipped')).toHaveCount(0);
});

test('Körpergewicht bleibt nach dem Neuladen erhalten, beiseitegelegte Werte (Fehler bis v27) kommen zurück', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(KEYS.weight, JSON.stringify([{ date: '2026-10-30', kg: 121.9 }]));
    localStorage.setItem(KEYS.weight + '-unlesbar-123', JSON.stringify([{ date: '2026-10-20', kg: 123.4 }, { date: '2026-10-30', kg: 999 }]));
  });
  await page.reload();
  expect(await page.evaluate(() => weights.map(w => [w.date, w.kg]))).toEqual([['2026-10-20', 123.4], ['2026-10-30', 121.9]]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('unlesbar')))).toEqual([]);
  await page.reload();
  expect(await page.evaluate(() => weights.length)).toBe(2);
});
