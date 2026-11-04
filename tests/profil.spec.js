const { test, expect, openSect } = require('./fixtures');

// Profil: Herzfrequenz-Zonen, Trainingswoche, Geräte & Gewichte, Körpergewicht
const openProfil = page => page.evaluate(() => showArea('profil'));

test('Herzfrequenz: Zonen nach Karvonen, manuell anpassbar, im Plan als bpm', async ({ page }) => {
  await openProfil(page);
  await openSect(page, 'sect-hr');
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
  await openSect(page, 'sect-week');
  await page.selectOption('#wkquality', '6');
  await expect(page.locator('#weekpanel .alert')).toContainText('Qualität am Samstag direkt vor dem Longrun');
  await page.selectOption('#wkquality', '4');
  await page.selectOption('#wkgroup', '');
  await page.click('[data-strength="4"]');
  await page.click('[data-strength="1"]');
  // weitere Einheit: Montag, „Anderes“ mit Namen
  await page.click('#wkxadd');
  await page.selectOption('[data-xday="0"]', '1');
  await page.selectOption('[data-xtype="0"]', 'other');
  await page.fill('[data-xname="0"]', 'Blaze');
  await page.dispatchEvent('[data-xname="0"]', 'change');
  expect(await page.evaluate(() => profile.week)).toEqual({ group: null, quality: 4, long: 0, strength: [6, 1], extras: [{ d: 1, type: 'other', name: 'Blaze' }], track: false, runner: null, strengthFixed: [], strengthPlan: {} });
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
  await openSect(page, 'sect-kit');
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
  await openSect(page, 'sect-measure');
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
  await openSect(page, 'sect-week');
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

test('Weitere Einheiten: mehrere, mit Art – lockerer Lauf, zweite Qualität, Anderes; Hinweise; alte Einzel-Einheit wird übernommen', async ({ page }) => {
  // Übernahme aus der bisherigen einen „weiteren Einheit“
  expect(await page.evaluate(() => normProfile({ week: { extraDay: 4, extraName: 'Regeneration' } }).week.extras)).toEqual([{ d: 4, type: 'other', name: 'Regeneration' }]);
  const date = await page.evaluate(() => addDays(localDay(), 7 * 14));
  await page.evaluate(d => { races = [{ id: 'h', name: 'HM', date: d, dist: 'hm', prio: 'A', goal: 7140 }]; persistRaces();
    Object.assign(profile.week, { quality: 2, long: 0, group: 3, strength: [], extras: [{ d: 4, type: 'easy', name: 'Regeneration' }, { d: 5, type: 'quality', name: '' }, { d: 6, type: 'other', name: 'Radfahren' }] }); persistProfile(); }, date);
  const sched = await page.evaluate(() => { const S = seasonPlan(localDay(), { L0: 14, W0: 30 }); const x = S.weeks.find(w => ['base', 'build'].includes(w.phase) && !w.cut && !w.test); return weekSchedule(x).map(i => [i.d, i.kind, i.title, i.key, RUN(i), HARD(i)]); });
  expect(sched.find(i => i[0] === 4)).toEqual([4, 'easy', 'Regeneration', 'x0', true, false]);
  expect(sched.find(i => i[0] === 5).slice(1, 6)).toEqual(['quality2', 'Qualität 2', 'x1', true, true]);
  expect(sched.find(i => i[0] === 6)).toEqual([6, 'extra', 'Radfahren', 'x2', false, false]);
  // zweite Qualität ist die jeweils andere Einheit der Woche
  const pair = await page.evaluate(() => { const S = seasonPlan(localDay(), { L0: 14, W0: 30 }); const x = S.weeks.find(w => w.phase === 'build' && !w.cut && !w.test); return [weekKey(x), weekKey(x, true)]; });
  expect(pair[0]).not.toEqual(pair[1]);
  // Fr-Qualität: Do ist locker, Sa „Anderes“ → kein Hinweis; auf Montag direkt vor der Di-Qualität → Hinweis
  expect(await page.evaluate(() => weekWarnings().some(t => /2\. Qualität/.test(t)))).toBe(false);
  await page.evaluate(() => { profile.week.extras[1].d = 1; persistProfile(); }); // Mo direkt vor Di-Qualität
  expect(await page.evaluate(() => weekWarnings().some(t => /2\. Qualität am Montag liegt direkt neben Qualität/.test(t)))).toBe(true);
  // im Profil: hinzufügen und entfernen, höchstens 4
  await openProfil(page); await page.evaluate(() => renderProfile()); await openSect(page, 'sect-week');
  await expect(page.locator('#wkextras .extrarow')).toHaveCount(3);
  await page.click('#wkxadd');
  await expect(page.locator('#wkextras .extrarow')).toHaveCount(4);
  await expect(page.locator('#wkxadd')).toHaveCount(0);
  await page.click('[data-xdel="3"]');
  await expect(page.locator('#wkextras .extrarow')).toHaveCount(3);
  // Startseite fragt am Tag danach auch nach dem lockeren Lauf
  const wd = await page.evaluate(() => new Date(addDays(localDay(), -1) + 'T12:00:00').getDay());
  await page.evaluate(d => { races = []; persistRaces(); Object.assign(profile.week, { quality: null, long: null, group: null, extras: [{ d, type: 'easy', name: 'Regeneration' }], runner: 'runner' }); persistProfile(); runLog = []; persistRunLog(); showArea('start'); }, wd);
  await expect(page.locator('#startrun b')).toHaveText('Gestern · Regeneration');
  // Art „Regenerationslauf“: zählt als lockerer Lauf, eigener Name und Hinweis
  await page.evaluate(d => { profile.week.extras = [{ d, type: 'recovery', name: '' }]; persistProfile(); renderStart(); }, wd);
  await expect(page.locator('#startrun b')).toHaveText('Gestern · Regenerationslauf');
  const rec = await page.evaluate(d => { races = [{ id: 'h', name: 'HM', date: d, dist: 'hm', prio: 'A', goal: 7140 }]; const S = seasonPlan(localDay(), { L0: 14, W0: 30 }); const x = S.weeks.find(w => w.phase === 'base'), it = weekSchedule(x).find(i => i.key === 'x0'); races = []; return it && [it.kind, it.title, it.detail, RUN(it), HARD(it)]; }, date);
  expect(rec).toEqual(['easy', 'Regenerationslauf', 'sehr locker, 20–40 Min., Zone 1', true, false]);
  await openProfil(page); await page.evaluate(() => renderProfile()); await openSect(page, 'sect-week');
  await expect(page.locator('#wkxt0')).toHaveValue('recovery');
  await expect(page.locator('#wkxt0 option')).toHaveText(['Lockerer Lauf', 'Regeneration', 'Intervall/Tempo (2. Qualität)', 'Anderes (Rad, Kurs …)']);
});

test('Max. HF schätzen: Tanaka und Nes statt 220 − Alter, übernehmen setzt nur die max. HF; manuell bleibt möglich', async ({ page }) => {
  await openProfil(page); await openSect(page, 'sect-hr');
  await page.evaluate(() => { document.getElementById('hrestimate').open = true; });
  await page.click('#hrestbtn');
  await expect(page.locator('#hrage')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#hrage', '43');
  await page.click('#hrestbtn');
  await expect(page.locator('#hrestout')).toContainText('Tanaka · 178 bpm');
  await expect(page.locator('#hrestout')).toContainText('Nes (HUNT) · 183 bpm');
  await expect(page.locator('#hrestout')).toContainText('„220 − Alter“: 177 bpm');
  await page.click('[data-hrset="183"]');
  expect(await page.evaluate(() => profile.hr.max)).toBe(183);
  await expect(page.locator('#hrmax')).toHaveValue('183');
  // ein Testwert lässt sich weiter direkt eintragen
  await page.fill('#hrmax', '186'); await page.dispatchEvent('#hrmax', 'change');
  expect(await page.evaluate(() => profile.hr.max)).toBe(186);
  // das Alter wird nicht gespeichert
  expect(await page.evaluate(() => JSON.stringify(profile).includes('43'))).toBe(false);
});
