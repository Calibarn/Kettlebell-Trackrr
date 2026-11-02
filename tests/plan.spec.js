const { test, expect } = require('./fixtures');

// Laufen → Plan: Saisonplan aus A-/B-Rennen, Rennen verwalten, Renntempo-Rechner.
const RACES = [
  { id: 'a1', name: 'Halbmarathon Frühjahr', date: '2027-03-01', dist: 'hm', prio: 'A', goal: 7140 },
  { id: 'b1', name: 'Testlauf 10', date: '2027-01-24', dist: '10k', prio: 'B', goal: null },
  { id: 'a2', name: 'Marathon Herbst', date: '2027-10-01', dist: 'marathon', prio: 'A', goal: 15300 }
];
// Zeit in die drei Felder (Std./Min./Sek.) eintragen
async function fillTime(page, id, h, m, sec) { for (const [i, v] of [h, m, sec].entries()) await page.fill(`#${id} [data-tpart="${i}"]`, String(v)); }
const setRaces = (page, list) => page.evaluate(l => { races = l.map(r => Object.assign({}, r)); persistRaces(); }, list);
// Plan mit festem „heute“ und Startwerten (Longrun L0, Wochen-km W0) – unabhängig vom echten Datum
const plan = (page, today, opt = {}) => page.evaluate(([t, o]) => {
  const S = seasonPlan(t, o);
  return { warn: S.warn, weeks: S.weeks.map(x => ({ week: x.week, phase: x.cut ? 'cut' : x.phase, long: x.long, km: x.km, a: x.a && x.a.id, b: x.b.map(r => r.id) })) };
}, [today, opt]);
async function openPlan(page, sub) {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="plan"]');
  if (sub) await page.click(`[data-runsub="${sub}"]`);
}

test('Saison: Blöcke rückwärts ab jedem A-Rennen, Erholung, B-Rennen ohne eigenen Block', async ({ page }) => {
  await setRaces(page, RACES);
  const { weeks, warn } = await plan(page, '2026-11-04', { L0: 14, W0: 22 });
  expect(warn).toEqual([]);
  expect(weeks[0].week).toBe('2026-11-02');
  expect(weeks.at(-1).a).toBe('a2');
  const ph = w => weeks.find(x => x.week === w).phase;
  // HM: 2 Wochen Tapering inkl. Rennwoche, davor 3 Wochen spezifisch; danach 2 Wochen Erholung
  expect(['2027-02-22', '2027-03-01'].map(ph)).toEqual(['taper', 'taper']);
  expect(weeks.find(x => x.week === '2027-03-01').a).toBe('a1');
  expect(['2027-02-01', '2027-02-08', '2027-02-15'].every(w => ['spec', 'cut'].includes(ph(w)))).toBe(true);
  expect(['2027-03-08', '2027-03-15'].map(ph)).toEqual(['recover', 'recover']);
  // Marathon: 3 Wochen Tapering, Block 19 Wochen, davor Basis
  expect(['2027-09-13', '2027-09-20', '2027-09-27'].map(ph)).toEqual(['taper', 'taper', 'taper']);
  expect(ph('2027-05-17')).toMatch(/basis|cut/);
  expect(ph('2027-05-24')).toMatch(/base|cut/);
  // B-Rennen steht in seiner Woche, ändert die Phase aber nicht
  const bw = weeks.find(x => x.b.includes('b1'));
  expect(bw.week).toBe('2027-01-18');
  expect(bw.phase).not.toBe('taper');
  // Ziel-Longrun wird erreicht, Steigerung nie über 10 %, Entlastung spätestens jede 4. Woche
  expect(Math.max(...weeks.filter(x => x.week < '2027-03-01').map(x => x.long || 0))).toBeCloseTo(20, 5);
  expect(Math.max(...weeks.map(x => x.long || 0))).toBeCloseTo(30, 5);
  let last = { long: 14, km: 22 }, run = 0;
  for (const x of weeks) {
    if (['base', 'build', 'spec', 'basis'].includes(x.phase)) {
      expect(x.long).toBeLessThanOrEqual(last.long * 1.1 + 1e-9);
      expect(x.km).toBeLessThanOrEqual(last.km * 1.1 + 1e-9);
      run++; expect(run).toBeLessThanOrEqual(4); // direkt vor dem Tapering keine Entlastung
    } else run = 0;
    if (x.phase !== 'cut' && x.long) last = { long: x.long, km: x.km };
  }
  expect(weeks.find(x => x.week === '2027-03-01').long).toBeNull();
});

test('Saison: zu dichte A-Rennen und zu wenig Zeit werden gewarnt', async ({ page }) => {
  await setRaces(page, [
    { id: 'x1', name: 'HM eins', date: '2027-03-07', dist: 'hm', prio: 'A', goal: null },
    { id: 'x2', name: 'Marathon zwei', date: '2027-05-02', dist: 'marathon', prio: 'A', goal: null }
  ]);
  const { warn, weeks } = await plan(page, '2026-11-04', { L0: 10, W0: 20 });
  expect(warn.join(' ')).toContain('Marathon zwei: nur 6 Wochen nach der Erholung von HM eins');
  expect(warn.join(' ')).toContain('Longrun von etwa');
  expect(weeks.find(x => x.week === '2027-04-26').phase).toBe('taper');

  await setRaces(page, [{ id: 'x3', name: 'Kurzfristig', date: '2026-11-22', dist: '10k', prio: 'A', goal: null }]);
  expect((await plan(page, '2026-11-04')).warn.join(' ')).toContain('Kurzfristig: nur noch 3 Wochen');
});

test('Übersicht: diese Woche mit Phase, Countdown und Grenzen aus dem Umfang', async ({ page }) => {
  await openPlan(page);
  await expect(page.locator('#runcontent')).toContainText('Noch kein A-Rennen geplant');
  await page.click('[data-runsub-go="rennen"]');
  await expect(page.locator('[data-runsub="rennen"]')).toHaveAttribute('aria-selected', 'true');

  const date = await page.evaluate(() => addDays(localDay(), 7 * 20));
  await setRaces(page, [{ id: 'h', name: 'Mein HM', date, dist: 'hm', prio: 'A', goal: 7140 }]);
  await page.click('[data-runsub="woche"]');
  await expect(page.locator('#planweek')).toContainText('Mein HM');
  await expect(page.locator('#planweek')).toContainText('Ziel 1:59:00 = 5:38 /km');
  await expect(page.locator('#planweek .metric b')).toHaveText(['?', '?']);
  await expect(page.locator('#planweek')).toContainText('unter Umfang');

  // mit Umfang: Longrun 12 km vor 9 Tagen, Wochen à 20 km → +10 %
  await page.evaluate(() => { const t = localDay(); for (let i = 1; i <= 4; i++) setWeekKm(addDays(weekStart(t), -7 * i), 'km', 20); addRun(addDays(t, -9), 12); renderRun(); });
  const exp = await page.evaluate(() => { const S = seasonPlan(); return [Math.round(Math.min(S.weeks[0].long, longestIn(localDay()).max)), Math.round(S.weeks[0].km)]; });
  await expect(page.locator('#planweek .metric b')).toHaveText([`ca. ${exp[0]} km`, `ca. ${exp[1]} km`]);
  expect(exp[0]).toBeLessThanOrEqual(13);
  await expect(page.locator('#planseason .planweek.now')).toHaveCount(1);
  await expect(page.locator('#planmore')).toContainText('Weitere 13 Wochen');
});

test('Rennen: eintragen, Fehler markieren, bearbeiten, löschen – bleibt gespeichert', async ({ page }) => {
  await openPlan(page, 'rennen');
  await page.click('#racesave');
  await expect(page.locator('#racename')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#racename', 'Stadtlauf');
  await page.fill('#racedate', '2027-04-04');
  await page.selectOption('#racedist', '10k');
  await fillTime(page, 'racegoal', '', '75', '00');
  await page.click('#racesave');
  await expect(page.locator('#racegoal [data-tpart="1"]')).toHaveAttribute('aria-invalid', 'true');
  await fillTime(page, 'racegoal', '', '54', '30');
  await page.press('#racegoal [data-tpart="2"]', 'Enter');
  await expect(page.locator('#racelist')).toContainText('Stadtlauf');
  await expect(page.locator('#racelist')).toContainText('10 km · Ziel 54:30 = 5:27 /km');

  await page.reload();
  await openPlan(page, 'rennen');
  await page.click('[data-raceedit]');
  await expect(page.locator('#racename')).toHaveValue('Stadtlauf');
  expect(await page.locator('#racegoal input').evaluateAll(l => l.map(i => i.value))).toEqual(['', '54', '30']);
  await page.selectOption('#raceprio', 'B');
  await fillTime(page, 'racegoal', '', '', '');
  await page.click('#racesave');
  await expect(page.locator('#racelist .prio')).toHaveText('B');
  expect(await page.evaluate(() => races.map(r => [r.prio, r.goal]))).toEqual([['B', null]]);

  await page.click('[data-raceedit]');
  await page.click('#racedel');
  await expect(page.locator('#racelist')).toContainText('Noch keine Rennen');
  // HM-Zeit „1:59“ heißt Stunden:Minuten
  expect(await page.evaluate(() => [parseGoal('1:59', 'hm'), parseGoal('24:30', '5k'), parseGoal('1:75', 'hm'), parseGoal('x', 'hm'), parseGoal('', 'hm')])).toEqual([7140, 1470, NaN, NaN, null]);
});

test('Rennen im Backup, Import ergänzt nur Fehlendes, unbekannte Einträge bleiben', async ({ page }) => {
  await setRaces(page, [RACES[0]]);
  await page.evaluate(() => localStorage.setItem(KEYS.races, JSON.stringify(races.concat([{ id: 'zukunft', dist: 'ultra' }]))));
  await page.reload();
  expect(await page.evaluate(() => [races.length, JSON.parse(backupJson()).races.length])).toEqual([1, 2]);
  await page.setInputFiles('#importfile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 3, races: RACES.concat([{ id: '<b>', name: 'kaputt', date: 'morgen', dist: 'hm', prio: 'A' }])
  })) });
  await expect.poll(() => page.evaluate(() => races.map(r => r.id))).toEqual(['b1', 'a1', 'a2']); // nach Datum sortiert
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(KEYS.races)).length)).toBe(4);
});

test('Renntempo-Rechner: Pace und Zwischenzeiten', async ({ page }) => {
  await openPlan(page, 'wissen');
  await expect(page.locator('#pcout')).toContainText('Zielzeit eingeben');
  await page.selectOption('#pcdist', 'marathon');
  await fillTime(page, 'pctime', '4', '15', '00');
  await expect(page.locator('#pcout .longnext b')).toHaveText('6:03 /km');
  await expect(page.locator('#pcout .splits')).toContainText('Halbzeit2:07:30');
  await page.selectOption('#pcdist', '5k');
  await fillTime(page, 'pctime', '0', '25', '00');
  await expect(page.locator('#pcout .longnext b')).toHaveText('5:00 /km');
  await fillTime(page, 'pctime', '0', '25', '99');
  await expect(page.locator('#pctime [data-tpart="2"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#runcontent details')).toHaveCount(6);
});

test('Zielzeit bestimmt Ziel-Longrun und Wochenspitze, Tempo steht bei den Tempo-Einheiten', async ({ page }) => {
  const pk = (r) => page.evaluate(x => peaks(x), r);
  expect(await pk({ dist: 'marathon', goal: 3 * 3600 + 50 * 60 })).toEqual({ long: 32, week: 62, fromGoal: true });
  expect(await pk({ dist: 'marathon', goal: 4 * 3600 + 15 * 60 })).toEqual({ long: 30, week: 55, fromGoal: true });
  expect(await pk({ dist: 'marathon', goal: 5 * 3600 })).toEqual({ long: 28, week: 45, fromGoal: true });
  expect(await pk({ dist: 'hm', goal: 6000 })).toEqual({ long: 22, week: 60, fromGoal: true });
  expect(await pk({ dist: '10k', goal: null })).toEqual({ long: 16, week: 35, fromGoal: false });

  // schnelleres Ziel → höhere Spitzen im Plan
  const peakOf = goal => page.evaluate(g => { races = [{ id: 'm', name: 'M', date: '2027-10-03', dist: 'marathon', prio: 'A', goal: g }]; const S = seasonPlan('2026-11-04', { L0: 15, W0: 30 }); return [Math.max(...S.weeks.map(x => x.long || 0)), Math.max(...S.weeks.map(x => x.km || 0))]; }, goal);
  const [slow, fast] = [await peakOf(5 * 3600), await peakOf(3 * 3600 + 50 * 60)];
  expect(slow[0]).toBeCloseTo(28, 5); expect(slow[1]).toBeCloseTo(45, 5);
  expect(fast[0]).toBeCloseTo(32, 5); expect(fast[1]).toBeCloseTo(62, 5);

  const notes = await page.evaluate(() => {
    races = [{ id: 'h', name: 'HM', date: '2027-03-07', dist: 'hm', prio: 'A', goal: 7140 }];
    const S = seasonPlan('2026-11-04', { L0: 14, W0: 25 }), x = S.weeks.find(w => w.phase === 'spec');
    return [weekKey(x), weekLongNote(x)];
  });
  expect(notes[0]).toMatch(/im HM-Tempo.*\(5:38 \/km\)$/);
  expect(notes[1]).toContain('HM-Tempo, Verpflegung wie im Rennen (5:38 /km)');

  const date = await page.evaluate(() => addDays(localDay(), 7 * 20));
  await setRaces(page, [{ id: 'h', name: 'Mein HM', date, dist: 'hm', prio: 'A', goal: null }]);
  await openPlan(page);
  await expect(page.locator('#planpeaks')).toContainText('Longrun bis 20 km, Woche bis 45 km (Standard) – Zielzeit eintragen');
  await page.click('[data-runsub="rennen"]');
  await page.click('[data-raceedit]');
  await fillTime(page, 'racegoal', '1', '50', '00');
  await page.click('#racesave');
  await expect(page.locator('#racelist')).toContainText('Longrun bis 21 km, Woche bis 52 km');
  await page.click('[data-runsub="woche"]');
  await expect(page.locator('#planpeaks')).toContainText('Longrun bis 21 km, Woche bis 52 km – aus der Zielzeit 1:50:00');
});

test('Kalender-Export: Wochen, Longruns und Rennen als gültige ics-Datei', async ({ page }) => {
  const base = await page.evaluate(() => localDay());
  const [a, b] = await page.evaluate(() => [addDays(localDay(), 7 * 10), addDays(localDay(), 7 * 5)]);
  await setRaces(page, [
    { id: 'a', name: 'Lauf, mit; Komma', date: a, dist: '10k', prio: 'A', goal: 3300 },
    { id: 'b', name: 'Test-B', date: b, dist: '5k', prio: 'B', goal: null }
  ]);
  await page.evaluate(() => { const t = localDay(); for (let i = 1; i <= 4; i++) setWeekKm(addDays(weekStart(t), -7 * i), 'km', 20); addRun(addDays(t, -9), 10); });
  await openPlan(page);
  const dl = page.waitForEvent('download');
  await page.click('#planics');
  const d = await dl;
  expect(d.suggestedFilename()).toBe(`laufplan-${base}.ics`);
  const raw = require('fs').readFileSync(await d.path(), 'utf8'), ics = raw.replace(/\r\n /g, ''); // Zeilenumbrüche (Folding) entfernen
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  const weeks = await page.evaluate(() => seasonPlan().weeks.length);
  expect((ics.match(/UID:kb-plan-/g) || []).length).toBe(weeks);
  expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe((ics.match(/END:VEVENT/g) || []).length);
  expect(ics).toContain('UID:kb-race-a@kb-tracker.local');
  expect(ics).toContain('UID:kb-race-b@kb-tracker.local');
  expect(ics).toContain('Lauf\\, mit\\; Komma');
  expect(ics).toContain('DTSTART;VALUE=DATE:' + a.replace(/-/g, ''));
  expect(ics).toMatch(/SUMMARY:Longrun ca\. \d+ km/);
  // keine Zeile über 75 Bytes
  for (const line of raw.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
});

test('Eigene Distanz: 20 km werden wie ein Halbmarathon geplant, aber mit 20 km angezeigt und gerechnet', async ({ page }) => {
  await openPlan(page, 'rennen');
  await expect(page.locator('#racekmfield')).toBeHidden();
  await page.fill('#racename', 'Lauf in den Tropen');
  await page.fill('#racedate', '2026-11-22');
  await page.selectOption('#racedist', 'custom');
  await expect(page.locator('#racekmfield')).toBeVisible();
  await page.selectOption('#raceprio', 'B');
  await page.click('#racesave');
  await expect(page.locator('#racekm')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#racekm', '20');
  await fillTime(page, 'racegoal', '1', '55', '00');
  await page.click('#racesave');
  expect(await page.evaluate(() => races.map(r => [r.dist, r.km, r.goal]))).toEqual([['hm', 20, 6900]]);
  await expect(page.locator('#racelist')).toContainText('20 km (geplant wie Halbmarathon) · Ziel 1:55:00 = 5:45 /km');

  // Bearbeiten zeigt die eigene Distanz wieder an
  await page.click('[data-raceedit]');
  await expect(page.locator('#racedist')).toHaveValue('custom');
  await expect(page.locator('#racekm')).toHaveValue('20');
  await page.click('#racecancel');

  expect(await page.evaluate(() => [distForKm(5), distForKm(8), distForKm(16), distForKm(30), distForKm(50)])).toEqual(['5k', '10k', 'hm', 'hm', 'marathon']);
  // Zielzeit wird per Riegel auf 21,1 km umgerechnet: 1:55 auf 20 km ≈ 2:02 auf HM → Stufe „unter 2:15“
  expect(await page.evaluate(() => peaks({ dist: 'hm', km: 20, goal: 6900 }))).toEqual({ long: 20, week: 45, fromGoal: true });
  expect(await page.evaluate(() => peaks({ dist: 'hm', km: 20, goal: 5900 }))).toEqual({ long: 21, week: 52, fromGoal: true });

  // B-Rennen in der Saison mit 20 km
  const d = await page.evaluate(() => addDays(localDay(), 7 * 15));
  await page.evaluate(dd => { races.push({ id: 'a', name: 'HM', date: dd, dist: 'hm', prio: 'A', goal: null, km: null }); persistRaces(); }, d);
  const bDate = await page.evaluate(() => addDays(localDay(), 7 * 3));
  await page.evaluate(bd => { races.find(r => r.km === 20).date = bd; persistRaces(); }, bDate);
  await page.click('[data-runsub="woche"]');
  const ics = (await page.evaluate(() => planIcs())).replace(/\r\n /g, '');
  expect(ics).toContain('Lauf in den Tropen (20 km)');

  // Renntempo-Rechner mit eigener Distanz
  await page.click('[data-runsub="wissen"]');
  await page.selectOption('#pcdist', 'custom');
  await fillTime(page, 'pctime', '1', '55', '00');
  await expect(page.locator('#pcout')).toContainText('Distanz in km eingeben');
  await page.fill('#pckm', '20');
  await expect(page.locator('#pcout .longnext b')).toHaveText('5:45 /km');
  await expect(page.locator('#pcout .splits span small')).toHaveText(['5 km', '10 km', '15 km', 'Ziel']);
});

test('B-Rennen zählt in die Woche: ersetzt Qualität bzw. Longrun, Warnung bei deutlich längerem Rennen', async ({ page }) => {
  await setRaces(page, [
    { id: 'a', name: 'HM Frühjahr', date: '2027-03-01', dist: 'hm', prio: 'A', goal: null },
    { id: 't', name: 'Lauf in den Tropen', date: '2026-11-22', dist: 'hm', prio: 'B', goal: null, km: 20 },
    { id: 'z', name: 'Zehner', date: '2027-01-17', dist: '10k', prio: 'B', goal: null }
  ]);
  const S = await page.evaluate(() => { const S = seasonPlan('2026-11-04', { L0: 11, W0: 14 }); return { warn: S.warn, w: S.weeks.map(x => ({ week: x.week, long: x.long, km: x.km, bLong: !!x.bLong, b: x.bRace && x.bRace.id, sched: weekSchedule(x).map(i => i.kind) })) }; });
  const t = S.w.find(x => x.b === 't'), z = S.w.find(x => x.b === 'z');
  expect(t.week).toBe('2026-11-16');
  expect(t.bLong).toBe(true);
  expect(t.km).toBeGreaterThanOrEqual(20);
  expect(t.sched).toContain('brace');
  expect(t.sched).not.toContain('long');
  expect(t.sched).not.toContain('quality');
  expect(S.warn.join(' ')).toContain('Lauf in den Tropen (20 km): deutlich länger als dein Longrun');
  // 10 km ersetzen bei einem Longrun von ~14 km nur die Qualität
  expect(z.bLong).toBe(false);
  expect(z.sched).toContain('long');
  expect(z.km).toBeGreaterThanOrEqual(10 + z.long - 1e-9);

  // Hinweis, wenn der Longrun fast die ganze Woche ausmacht
  await page.evaluate(() => { const t = localDay(); for (let i = 1; i <= 4; i++) setWeekKm(addDays(weekStart(t), -7 * i), 'km', 14); addRun(addDays(t, -9), 12); });
  await openPlan(page);
  await expect(page.locator('#planratio')).toContainText('% deiner Wochen-km');
});
