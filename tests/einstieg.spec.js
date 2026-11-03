// Laufanfänger: Laufniveau, Lauf-Einstieg (9 Wochen × 3 Einheiten, geführt), kein Testlauf ohne 5 km.
const { test, expect, openSect } = require('./fixtures');

const openOverview = page => page.evaluate(() => { showArea('laufen'); runView.tab = 'plan'; runView.plan = 'woche'; store(KEYS.run, runView); renderRun(); });

test('Neu ohne Daten: Übersicht fragt einmal; „Ich laufe schon“ → Saisonplan, im Profil umstellbar', async ({ page }) => {
  await openOverview(page);
  await expect(page.locator('#levelask')).toContainText('Neu beim Laufen?');
  await page.click('#levelask [data-level="runner"]');
  await expect(page.locator('#levelask')).toHaveCount(0);
  await expect(page.locator('#runcontent')).toContainText('Noch kein A-Rennen geplant');
  expect(await page.evaluate(() => profile.week.runner)).toBe('runner');
  // Wer schon etwas eingetragen hat, wird nicht gefragt
  await page.evaluate(() => { profile.week.runner = null; persistProfile(); runLog = [{ id: 'r', date: localDay(), km: 5 }]; persistRunLog(); renderRun(); });
  await expect(page.locator('#levelask')).toHaveCount(0);
  // Profil → Trainingswoche: Laufniveau wählen
  await page.evaluate(() => showArea('profil'));
  await openSect(page, 'sect-week');
  await page.selectOption('#wklevel', 'beginner');
  expect(await page.evaluate(() => [profile.week.runner, JSON.parse(localStorage.getItem(KEYS.profile)).week.runner])).toEqual(['beginner', 'beginner']);
  await expect(page.locator('#sum-week')).toContainText('Lauf-Einstieg');
  await openOverview(page);
  await expect(page.locator('#starter')).toContainText('Woche 1 von 9');
});

test('Lauf-Einstieg: geführte Einheit zählt, nach 3 Einheiten weiter oder wiederholen, nach Woche 9 als Läufer weiter', async ({ page }) => {
  await openOverview(page);
  await page.click('#levelask [data-level="beginner"]');
  await expect(page.locator('#startersum')).toHaveText('8 × (1 Min. laufen · 1:30 Min. gehen)');
  await expect(page.locator('#starter')).toContainText('insgesamt etwa 29 Min.');
  await expect(page.locator('#starter')).toContainText('Bildschirm an');
  // Kein Saisonplan, keine Tempos, kein Testlauf
  await expect(page.locator('#runcontent')).not.toContainText('Trainingstempos');
  await expect(page.locator('#runcontent')).not.toContainText('Testlauf');
  // geführt: 5 Min. gehen, 8 × laufen mit 7 Gehpausen, 5 Min. gehen – alles mit Zeit, Bildschirm bleibt an
  await page.click('[data-starter="go"]');
  const steps = await page.evaluate(() => rt.steps.map(s => [s.name, s.secs]));
  expect(steps.length).toBe(17);
  expect(steps[0]).toEqual(['Locker gehen', 300]);
  expect(steps[1]).toEqual(['Locker laufen', 60]);
  expect(steps[2]).toEqual(['Locker gehen', 90]);
  expect(steps.at(-1)).toEqual(['Locker gehen', 300]);
  await page.waitForFunction(() => window.__spoken.length > 0);
  expect(await page.evaluate(() => window.__spoken.at(-1).text)).toMatch(/^Lauf-Einstieg, Woche 1\. Locker gehen, 5 Minuten/);
  await page.evaluate(() => rtGo(rt.steps.length));
  await page.click('#rt-main');
  expect(await page.evaluate(() => getStarter().done)).toBe(1);
  await expect(page.locator('#starter')).toContainText('Einheit 2 von 3');
  await expect(page.locator('.sdot.on')).toHaveCount(1);
  // zurücknehmen und ohne Führung erledigen
  await page.click('[data-starter="undo"]');
  expect(await page.evaluate(() => [getStarter().done, getStarter().log.length])).toEqual([0, 0]);
  for (let i = 0; i < 3; i++) await page.click('[data-starter="done"]');
  await expect(page.locator('#starterweekdone')).toContainText('Woche 1 geschafft!');
  await page.click('[data-starter="repeat"]');
  await expect(page.locator('#starter')).toContainText('Einheit 1 von 3');
  for (let i = 0; i < 3; i++) await page.click('[data-starter="done"]');
  await page.click('[data-starter="next"]');
  await expect(page.locator('#startersum')).toHaveText('6 × (1:30 Min. laufen · 2 Min. gehen)');
  // Woche wählen: Woche 6 mit Schluss-Abschnitt, Woche 9 am Stück (lange Abschnitte laufen getaktet)
  await page.selectOption('#starterweek', '5');
  await expect(page.locator('#startersum')).toHaveText('2 × (10 Min. laufen · 2 Min. gehen) · 5 Min. laufen');
  expect(await page.evaluate(() => starterItems(5).map(it => routineStep(it).secs))).toEqual([300, 600, 120, 600, 120, 300, 300]);
  await page.selectOption('#starterweek', '8');
  await expect(page.locator('#startersum')).toHaveText('30 Min. am Stück laufen');
  expect(await page.evaluate(() => starterItems(8).map(it => routineStep(it).secs))).toEqual([300, 1800, 300]);
  for (let i = 0; i < 3; i++) await page.click('[data-starter="done"]');
  await expect(page.locator('#starterdone')).toContainText('30 Minuten am Stück');
  await page.click('[data-starter="graduate"]');
  expect(await page.evaluate(() => profile.week.runner)).toBe('runner');
  await expect(page.locator('#starter')).toHaveCount(0);
  await expect(page.locator('#levelask')).toHaveCount(0);
  await expect(page.locator('#runcontent')).toContainText('Noch kein A-Rennen geplant');
});

test('Lauf-Einstieg mit geplantem Rennen: Hinweis, ob die Zeit danach reicht', async ({ page }) => {
  await page.evaluate(() => { profile.week.runner = 'beginner'; persistProfile(); });
  await page.evaluate(() => { races = [{ id: 'h', name: 'Mein HM', date: addDays(localDay(), 7 * 12), dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces(); });
  await openOverview(page);
  await expect(page.locator('#runcontent .alert.due')).toContainText('Mein HM');
  await expect(page.locator('#runcontent .alert.due')).toContainText('sinnvoll sind mindestens 8');
  await page.evaluate(() => { races[0].date = addDays(localDay(), 7 * 30); persistRaces(); renderRun(); });
  await expect(page.locator('#runcontent .alert').first()).toContainText('dafür bleiben 22 Wochen');
  await expect(page.locator('#runcontent .alert.due')).toHaveCount(0);
});

test('Testlauf nur, wenn 5 km machbar sind – und nie im Lauf-Einstieg', async ({ page }) => {
  const r = await page.evaluate(() => {
    races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 7 * 20), dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    const first = () => { const S = seasonPlan(); return [!!S.weeks[0].test, S.weeks.findIndex(x => x.test)]; };
    const out = {};
    runLog = []; out.none = first();
    runLog = [{ id: 'a', date: addDays(localDay(), -3), km: 3 }]; out.short = first();
    runLog = [{ id: 'a', date: addDays(localDay(), -3), km: 5 }]; out.five = first();
    profile.week.runner = 'beginner'; out.beginner = first(); profile.week.runner = null;
    return out;
  });
  expect(r.none).toEqual([false, -1]);
  expect(r.short[0]).toBe(false);           // 3 km: diese Woche kein Testlauf …
  expect(r.short[1]).toBeGreaterThan(0);    // … erst, wenn der geplante Longrun 5 km erreicht
  expect(r.five).toEqual([true, 0]);
  expect(r.beginner).toEqual([false, -1]);
});

test('Einstieg-Stand steht in der Sicherung und wird per Sync abgeglichen', async ({ page }) => {
  const r = await page.evaluate(() => { putStarter({ week: 2, done: 1, log: [{ d: localDay(), w: 2 }] }); return [JSON.parse(backupJson()).starter, Object.values(SYNC_SETTINGS).includes(KEYS.starter)]; });
  expect(r[0]).toEqual({ week: 2, done: 1, log: [{ d: await page.evaluate(() => localDay()), w: 2 }] });
  expect(r[1]).toBe(true);
});

test.describe('englisch', () => {
  test.use({ locale: 'en-US', initScripts: [`window.__voices = [{ name: 'Daniel', lang: 'en-GB', localService: true, default: true, voiceURI: 'daniel' }];`] });
  test('Lauf-Einstieg auf Englisch, Ansage englisch', async ({ page }) => {
    await page.evaluate(() => { profile.week.runner = 'beginner'; persistProfile(); });
    await openOverview(page);
    await expect(page.locator('#startersum')).toHaveText('8 × (run 1 min · walk 1:30 min)');
    await expect(page.locator('#runcontent')).toContainText('Nine weeks to 30 minutes non-stop');
    await page.click('[data-starter="go"]');
    await page.waitForFunction(() => window.__spoken.length > 0);
    expect(await page.evaluate(() => window.__spoken.at(-1).text)).toMatch(/^Running starter, week 1\. Easy walking, 5 minutes/);
    expect(await page.evaluate(() => [...i18nMissing])).toEqual([]);
  });
});
