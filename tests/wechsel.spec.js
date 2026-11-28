// Krafttage „wechselnd“ (ab 1.13): an diesen Tagen kommt der Plan, der am längsten nicht dran war – so kommen alle Pläne an die Reihe, dann von vorn.
// Feste Pläne anderer Tage sind nicht dabei; am Tag vor der Qualität und an Tagen mit Qualität oder Longrun nur Pläne ohne schwere Beinarbeit.
const { test, expect } = require('./fixtures');

// Mittwoch, 2.12.2026; Minibänder dabei, damit alle zehn Pläne mitmachen
async function setup(page, week = {}) {
  await page.clock.setFixedTime(new Date('2026-12-02T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(w => {
    profile.kit.mini = true; profile.kit.vacation = null;
    races = [{ id: 'h', name: 'HM', date: '2027-04-18', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    Object.assign(profile.week, { runner: 'runner', quality: null, long: null, group: null, extras: [], strength: [1, 3, 5], strengthPlan: { 1: 'rot', 3: 'rot', 5: 'rot' }, gymNames: {}, gymHard: [], mobility: [], sauna: [], track: false }, w);
    persistProfile(); saved = []; persistEntries();
  }, week);
}
// Pläne an den nächsten n Wechseltagen ab heute (Mo, Mi, Fr)
const upcoming = (page, n) => page.evaluate(n => {
  const out = []; for (let d = localDay(); out.length < n; d = addDays(d, 1)) { const wd = new Date(d + 'T12:00:00').getDay(); if (profile.week.strengthPlan[wd] === 'rot') out.push(dayPlan(wd, d)); }
  return out;
}, n);

test('der Reihe nach: erst alle Pläne einmal, dann von vorn – was du schon gemacht hast, kommt später', async ({ page }) => {
  await setup(page);
  const pool = await page.evaluate(() => rotPool());
  expect(pool).toEqual(['wed', 'tabata', 'amrap', 'run', 'mini', 'sun', 'core', 'sitcore', 'standcore', 'office']);
  const seq = await upcoming(page, 20);
  expect(seq.slice(0, 10)).toEqual(pool); // ohne Verlauf in der Reihenfolge der Reiter
  expect(seq.slice(10)).toEqual(pool); // dann von vorn
  // Ganzkörper vorgestern und Tabata letzte Woche gemacht: beide wandern ans Ende, Tabata (länger her) zuerst
  await page.evaluate(() => { saved = [{ plan: 'wed', date: '2026-11-30', total: 1 }, { plan: 'tabata', date: '2026-11-25', total: 1 }]; });
  expect((await upcoming(page, 10)).slice(-2)).toEqual(['tabata', 'wed']);
  expect((await upcoming(page, 1))[0]).toBe('amrap');
  // heute schon trainiert: der Tag zeigt, was eingetragen ist, und der Wechsel geht danach weiter
  await page.evaluate(() => { saved.push({ plan: 'core', date: '2026-12-02', total: 1 }); });
  const s2 = await upcoming(page, 3);
  expect(s2[0]).toBe('core');
  expect(s2.slice(1)).toEqual(['amrap', 'run']);
  // ein verpasster Tag: der Plan bleibt vorne und kommt am nächsten Wechseltag
  await page.evaluate(() => { saved = [{ plan: 'wed', date: '2026-11-27', total: 1 }]; });
  expect(await page.evaluate(() => dayPlan(1, '2026-11-30'))).toBe('tabata'); // Montag, nichts eingetragen
  expect(await page.evaluate(() => dayPlan(3, '2026-12-02'))).toBe('tabata'); // heute wieder dran
  // ohne Wechseltag am Datum: kein Plan
  expect(await page.evaluate(() => dayPlan(2, '2026-12-01'))).toBe(null);
});

test('feste Pläne anderer Tage sind nicht dabei; vor und an der Qualität und am Longrun-Tag nur ohne schwere Beine', async ({ page }) => {
  await setup(page, { strength: [1, 3, 5, 6], strengthPlan: { 1: 'rot', 3: 'rot', 5: 'run', 6: 'rot' } });
  expect(await page.evaluate(() => rotPool())).not.toContain('run');
  expect(await upcoming(page, 27)).not.toContain('run');
  // Qualität Donnerstag, Longrun Samstag: Mittwoch (Vortag) und Samstag nur Oberkörper, Core, Finisher, Stand-Core, Büro – Montag alles
  await page.evaluate(() => { Object.assign(profile.week, { quality: 4, long: 6 }); });
  const r = await page.evaluate(() => { const out = []; for (let d = localDay(), i = 0; i < 42; i++, d = addDays(d, 1)) { const wd = new Date(d + 'T12:00:00').getDay(); if (profile.week.strengthPlan[wd] === 'rot') out.push([wd, dayPlan(wd, d)]); } return out; });
  const legs = ['wed', 'tabata', 'amrap', 'mini'];
  expect(r.filter(([wd]) => wd !== 1).every(([, pk]) => !legs.includes(pk))).toBe(true);
  expect(r.filter(([wd]) => wd === 1).map(([, pk]) => pk)).toEqual(expect.arrayContaining(legs)); // die Beinpläne kommen montags dran
  // ohne Laufen (Bereich abgewählt) gilt die Regel nicht
  await page.evaluate(() => { profile.modules = { kraft: true, laufen: false, mobility: true }; });
  expect(await page.evaluate(() => dayPlan(3, '2026-12-02'))).toBe('wed');
  // Hinweis „Qualität direkt nach Kraft“ nicht für Wechseltage – der Wechsel nimmt dort ohnehin nichts für die Beine
  await page.evaluate(() => { profile.modules = { kraft: true, laufen: true, mobility: true }; });
  expect((await page.evaluate(() => weekWarnings())).filter(t => t.includes('direkt nach Kraft'))).toEqual([]);
});

test('Profil: „wechselnd“ wählbar, mit Reihenfolge; Startseite und Wochenplan zeigen den Plan des Tages', async ({ page }) => {
  await setup(page, { strengthPlan: {} });
  await page.evaluate(() => { saved = [{ plan: 'wed', date: '2026-11-30', total: 1 }]; renderProfile(); showArea('profil'); document.getElementById('sect-week').open = true; });
  await page.selectOption('#weekpanel [data-wkplan="3"]', 'rot');
  expect(await page.evaluate(() => [profile.week.strengthPlan, JSON.parse(localStorage.getItem(KEYS.profile)).week.strengthPlan])).toEqual([{ 3: 'rot' }, { 3: 'rot' }]);
  await expect(page.locator('#rothint')).toContainText('Wechselnd: immer der Plan, der am längsten her ist – als Nächstes Tabata → AMRAP → Läufer → Miniband → Oberkörper → Core → Finisher → Stand-Core → Büro → Ganzkörper, dann von vorn. Fällt einer aus, bleibt er vorne und kommt am nächsten Wechseltag.');
  // Ganzkörper fest am Montag: fällt aus dem Wechsel
  await page.selectOption('#weekpanel [data-wkplan="1"]', 'wed');
  await expect(page.locator('#rothint')).not.toContainText('Ganzkörper');
  // beim Laden bleibt „wechselnd“ erhalten
  expect(await page.evaluate(() => normProfile({ week: { strength: [3], strengthPlan: { 3: 'rot', 4: 'rot' } } }).week.strengthPlan)).toEqual({ 3: 'rot' });
  // Startseite (Mittwoch): Kraft · Tabata, „Starten“ stellt den Plan ein
  await page.evaluate(() => { plan = 'wed'; store(KEYS.plan, 'wed'); showArea('start'); });
  const row = page.locator('#startcontent .srowt', { hasText: 'Kraft' });
  await expect(row).toContainText('Kraft · Tabata');
  // Wochenplan und Kalender
  await page.evaluate(() => { showArea('laufen'); runView.tab = 'woche'; renderRun(); });
  await expect(page.locator('#planschedule .row.sched-strength', { hasText: 'Mi' })).toContainText('Kraft · Tabata');
  expect(await page.evaluate(() => planIcs(seasonPlan()))).toContain('SUMMARY:Kraft · AMRAP'); // nächster Mittwoch
});
