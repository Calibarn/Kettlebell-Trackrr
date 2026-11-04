const { test, expect } = require('./fixtures');

// Mehrere A-Rennen dicht hintereinander: Erholung und Tapering beachten, gemeinsamer Block, B-Rennen in der Erholung.
const setRaces = (page, list) => page.evaluate(l => { races = l.map(r => Object.assign({}, r)); persistRaces(); }, list);
const season = (page, today = '2026-11-04', o = { L0: 12, W0: 25 }) => page.evaluate(([t, opt]) => {
  const S = seasonPlan(t, opt);
  return { warn: S.warn, note: S.note, weeks: S.weeks.map(x => ({ week: x.week, phase: x.cut ? 'cut' : x.phase, target: x.target && x.target.id, with: x.with && x.with.id, long: x.long, km: x.km, key: weekKey(x) })) };
}, [today, o]);
const WFL = { id: 'w', name: 'Wings for Life', date: '2027-05-09', dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' };
const PACE = { id: 'p', name: 'Pace Race', date: '2027-06-05', dist: '10k', prio: 'A', goal: null, km: 12, fmt: 'pace' };
const HM = { id: 'h', name: 'Berliner HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: 7140, km: null };

test('Zu dicht: zweites A-Rennen in der Erholung des ersten oder erstes im Tapering des zweiten', async ({ page }) => {
  await setRaces(page, [{ id: 'a', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: null }, { id: 'b', name: 'Marathon', date: '2027-04-11', dist: 'marathon', prio: 'A', goal: null }]);
  expect((await season(page)).warn.join(' ')).toContain('Marathon liegt nur 1 Woche nach HM – zwei A-Rennen so dicht sind zu viel');
  // 10 km zwei Wochen vor dem Marathon: Erholung (1 Woche) vorbei, aber mitten im Tapering (3 Wochen)
  await setRaces(page, [{ id: 'a', name: '10er', date: '2027-09-12', dist: '10k', prio: 'A', goal: null }, { id: 'b', name: 'Marathon', date: '2027-09-26', dist: 'marathon', prio: 'A', goal: null }]);
  expect((await season(page)).warn.join(' ')).toContain('Marathon liegt nur 2 Wochen nach 10er');
  // drei Wochen Abstand zwischen zwei 10ern: passt (Erholung 1 Woche, Tapering 1 Woche)
  await setRaces(page, [{ id: 'a', name: '10er A', date: '2027-09-05', dist: '10k', prio: 'A', goal: null }, { id: 'b', name: '10er B', date: '2027-09-26', dist: '10k', prio: 'A', goal: null }]);
  expect((await season(page)).warn.join(' ')).not.toContain('zu dicht');
});

test('Gemeinsamer Block: Wings for Life im Mai und Pace Race im Juni bereiten sich zusammen vor', async ({ page }) => {
  await setRaces(page, [WFL, PACE]);
  const S = await season(page);
  expect(S.warn).toEqual([]);
  expect(S.note.join(' ')).toContain('Pace Race kommt 4 Wochen nach Wings for Life: Der Plan bereitet beide zusammen vor. Vorher gilt jede zweite Qualitätseinheit schon Pace Race (2 × ⇄ im Saisonplan)');
  // Wochen im Vorbereitungsfenster des Pace Race (10 Wochen ab 29.03.), die noch Wings for Life gehören – ohne Tapering und Erholung
  const shared = S.weeks.filter(x => x.with === 'p');
  expect(shared.map(x => x.week)).toEqual(['2027-03-29', '2027-04-05', '2027-04-12', '2027-04-19']);
  expect(shared.every(x => x.target === 'w')).toBe(true);
  // gerade KW: Einheit fürs Pace Race, ungerade KW: für Wings for Life
  const k = w => S.weeks.find(x => x.week === w).key;
  expect(k('2027-04-05')).toMatch(/Level-Tempo.*· für Pace Race$/);
  expect(k('2027-04-19')).toMatch(/Level-Tempo.*· für Pace Race$/);
  expect(k('2027-03-29')).not.toContain('Pace Race');
  expect(k('2027-03-29')).toContain('Schwelle');
  // keine zusätzliche harte Einheit: es bleibt eine Qualitätseinheit pro Woche, die Erholung nach Wings for Life bleibt
  expect(['2027-05-10', '2027-05-17'].map(w => S.weeks.find(x => x.week === w).phase)).toEqual(['recover', 'recover']);
  expect(k('2027-05-10')).toContain('keine – nur locker');
  // ⇄ im Saisonplan
  await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="plan"]'); await page.click('[data-runsub="woche"]');
  await expect(page.locator('#runcontent .alert.planmix')).toContainText('bereitet beide zusammen vor');
  const html = await page.evaluate(() => renderPlanSeason(seasonPlan('2026-11-04', { L0: 12, W0: 25 })));
  expect((html.match(/⇄ Pace Race/g) || []).length).toBe(2);
});

test('Gemeinsamer Block: Longrun und Wochen-km nach dem längeren Rennen, Longrun-Ziel zählt aus dem Block davor', async ({ page }) => {
  // Pace Race zuerst, Wings for Life (20 km) 4 Wochen danach: der Pace-Race-Block baut den Longrun schon Richtung 20 km
  await setRaces(page, [Object.assign({}, PACE, { date: '2027-04-10' }), Object.assign({}, WFL, { date: '2027-05-09' })]);
  const mixed = await page.evaluate(() => { const S = seasonPlan('2026-11-04', { L0: 12, W0: 25 }); return S.weeks.filter(x => x.with).map(x => bothPeaks(x)); });
  expect(mixed.length).toBeGreaterThan(0);
  expect(mixed.every(p => p.long === 20 && p.week === 45)).toBe(true);
  // Halbmarathon, dann Wings for Life (gleiche Art): Vorbereitung zählt mit, keine Longrun-Warnung trotz kurzem eigenem Block
  await setRaces(page, [HM, WFL]);
  const S = await season(page);
  expect(S.note.join(' ')).toContain('Wings for Life kommt 5 Wochen nach Berliner HM: Die Vorbereitung auf Berliner HM zählt auch für Wings for Life');
  expect(S.warn.join(' ')).not.toContain('Longrun von etwa');
});

test('Drei A-Rennen in 9 Wochen: kein Platz fürs dritte – Warnung; mit Wings for Life als B-Rennen eigener Block fürs Pace Race', async ({ page }) => {
  await setRaces(page, [HM, WFL, PACE]);
  let S = await season(page);
  expect(S.warn.join(' ')).toContain('Pace Race kommt 4 Wochen nach Wings for Life: Nach der Erholung bleiben nur 2 Wochen für Pace Race');
  // die eine spezifische Woche für Wings for Life bleibt Wings for Life
  expect(S.weeks.find(x => x.week === '2027-04-19').key).not.toContain('Pace Race');
  expect(S.warn.join(' ')).not.toContain('Longrun von etwa');

  await setRaces(page, [HM, Object.assign({}, WFL, { prio: 'B' }), PACE]);
  S = await season(page);
  expect(S.warn.join(' ')).toContain('Pace Race: Block auf 7 statt 10 Wochen gekürzt');
  expect(S.weeks.filter(x => x.target === 'p' && ['build', 'spec'].includes(x.phase)).length).toBeGreaterThanOrEqual(4);
});

test('B-Rennen in der Erholung: nur locker mitlaufen; Formular warnt schon beim Eintragen', async ({ page }) => {
  const today = await page.evaluate(() => localDay());
  const at = d => page.evaluate(n => addDays(weekStart(localDay()), n), d);
  const hmDate = await at(7 * 12 + 6), bDate = await at(7 * 13 + 6);
  await setRaces(page, [{ id: 'h', name: 'Frühjahrs-HM', date: hmDate, dist: 'hm', prio: 'A', goal: null }, { id: 'b', name: 'Stadtlauf', date: bDate, dist: '10k', prio: 'B', goal: null },
    { id: 'm', name: 'Herbst-Marathon', date: await at(7 * 40 + 6), dist: 'marathon', prio: 'A', goal: null }]);
  const wk = await page.evaluate(d => { const S = seasonPlan(); const x = S.weeks.find(w => w.b.some(b => b.id === 'b')); return { phase: x.phase, brace: weekSchedule(x).find(i => i.kind === 'brace').detail }; }, today);
  expect(wk.phase).toBe('recover');
  expect(wk.brace).toContain('locker, nicht auf Zeit');

  await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="plan"]'); await page.click('[data-runsub="rennen"]');
  await expect(page.locator('#racewarn')).toBeHidden();
  await page.fill('#racename', 'Marathon');
  await page.selectOption('#racedist', 'marathon');
  await page.fill('#racedate', await at(7 * 13 + 6));
  await expect(page.locator('#racewarn')).toContainText('Zu dicht für zwei A-Rennen: Es fällt in die Erholung nach Frühjahrs-HM');
  await expect(page.locator('#racewarn')).toContainText('etwa 2 Wochen');
  await page.selectOption('#raceprio', 'B');
  await expect(page.locator('#racewarn')).toContainText('Als B-Rennen nur locker mitlaufen');
  // vor dem A-Rennen im Tapering
  await page.selectOption('#raceprio', 'A');
  await page.fill('#racedate', await at(7 * 11 + 6));
  await expect(page.locator('#racewarn')).toContainText('Zu dicht für zwei A-Rennen');
  // weit genug weg: kein Hinweis
  await page.fill('#racedate', await at(7 * 30 + 6));
  await expect(page.locator('#racewarn')).toBeHidden();
  // Bearbeiten eines zu dichten Rennens zeigt den Hinweis sofort
  await page.click('[data-raceedit="b"]');
  await expect(page.locator('#racewarn')).toContainText('in die Erholung nach Frühjahrs-HM');
});
