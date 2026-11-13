// Startseite „Heute“: beim Öffnen, mit der unteren Leiste („Start“ markiert); „Mehr“ als Zeile am Ende der Startseite.
const { test, expect, openSect } = require('./fixtures');

test.describe('mit Startseite', () => {
  test.use({ start: true });

  test('öffnet auf der Startseite, mit Leiste; Bereiche über die Leiste, „Mehr“ als Zeile, „Start“ zurück', async ({ page }) => {
    await expect(page.locator('#area-start')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('#tabbar [data-area="start"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#t-start')).toHaveText('Heute');
    await expect(page.locator('#startcontent .stile')).toHaveCount(0);
    await page.click('#tabbar [data-area="laufen"]');
    await expect(page.locator('#area-laufen')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('#tabbar [data-area]')).toHaveCount(5);
    await expect(page.locator('#tabbar [data-area="mehr"]')).toHaveCount(0);
    await page.click('#tabbar [data-area="start"]');
    await expect(page.locator('#area-start')).toBeVisible();
    await expect(page.locator('#startcontent .smorerow')).toContainText('Neuigkeiten, Sync, Daten · Version');
    await page.click('#startcontent [data-go="mehr"]');
    await expect(page.locator('#area-mehr')).toBeVisible();
    await expect(page.locator('#tabbar [data-area="start"]')).toHaveAttribute('aria-selected', 'true');
    // Neu laden: wieder die Startseite, auch wenn zuletzt ein anderer Bereich offen war
    await page.reload();
    await expect(page.locator('#area-start')).toBeVisible();
  });

  test('Heute dran: Kraft am Krafttag startet direkt; Woche zählt Kraft, Mobility-Routinen und km', async ({ page }) => {
    await page.evaluate(() => {
      const wd = new Date(localDay() + 'T12:00:00').getDay();
      Object.assign(profile.week, { strength: [wd], quality: null, long: null, group: null, extraDay: null, runner: 'runner' }); persistProfile();
      runLog = [{ id: 'r', date: localDay(), km: 6.5 }]; persistRunLog();
      logMobility('Nach dem Lauf');
      showArea('start');
    });
    await expect(page.locator('#startcontent .srowt')).toHaveCount(1);
    await expect(page.locator('#startcontent .srowt')).toContainText('Kraft · Ganzkörper');
    await expect(page.locator('#startcontent .sweek')).toContainText('0 von 1');
    await expect(page.locator('#startcontent .sweek')).toContainText('6,5 km');
    await expect(page.locator('#startcontent .sweek')).toContainText('1 ×');
    await page.click('[data-startact="kraft"]');
    await expect(page.locator('#area-kraft')).toBeVisible();
    expect(await page.evaluate(() => sessionActive())).toBe(true);
    // läuft ein Training, öffnet die App direkt beim Timer
    await page.reload();
    await expect(page.locator('#area-kraft')).toBeVisible();
  });

  test('Kraft am Lauftag: Hinweis vollständig in eigener Zeile', async ({ page }) => {
    await page.evaluate(() => {
      const wd = new Date(localDay() + 'T12:00:00').getDay();
      Object.assign(profile.week, { strength: [wd], group: wd, quality: null, long: null, extraDay: null, runner: 'runner' }); persistProfile();
      showArea('start');
    });
    const tip = page.locator('#startcontent .srowt .stip');
    await expect(tip).toHaveText('Nach dem Lauf oder mit ein paar Stunden Abstand');
    expect(await tip.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.evaluate(() => { const wd = new Date(localDay() + 'T12:00:00').getDay(); Object.assign(profile.week, { group: null, quality: wd }); persistProfile(); renderStart(); });
    await expect(tip).toHaveText('Nach dem Lauf, ohne schwere Beinübungen');
  });

  test('Lauf-Einstieg und Ruhetag', async ({ page }) => {
    await page.evaluate(() => { Object.assign(profile.week, { strength: [], quality: null, long: null, group: null, extraDay: null, runner: 'beginner' }); persistProfile(); showArea('start'); });
    await expect(page.locator('#startcontent .srowt')).toContainText('Lauf-Einstieg · Woche 1');
    await page.click('[data-startact="starter"]');
    await expect(page.locator('#routine')).toBeVisible();
    await page.evaluate(() => rtGo(rt.steps.length)); await page.click('#rt-main');
    await expect(page.locator('#startcontent .srowt')).toContainText('erledigt');
    await page.evaluate(() => { profile.week.runner = 'runner'; persistProfile(); showArea('start'); });
    await expect(page.locator('#startcontent .srowt')).toContainText('Heute ist nichts geplant');
  });

  test.describe('englisch', () => {
    test.use({ locale: 'en-US' });
    test('Startseite auf Englisch ohne fehlende Übersetzung', async ({ page }) => {
      await expect(page.locator('#t-start')).toHaveText('Today');
      await expect(page.locator('#tabbar [data-area="start"]')).toContainText('Home');
      expect(await page.evaluate(() => [...i18nMissing])).toEqual([]);
    });
  });
});

test.describe('Startbildschirm', () => {
  test.use({ splash: true });
  test('Name, Icon und Version beim ersten Öffnen, danach weg; nicht beim Neuladen, nicht bei laufendem Training', async ({ page }) => {
    // die Fixture hat die Seite schon geöffnet: erster Start der Sitzung
    const splash = page.locator('#splash');
    await expect(splash).toHaveCount(1);
    await expect(splash.locator('b')).toHaveText('Tagwerk');
    await expect(splash.locator('#splashver')).toHaveText(/^Version \d/);
    await expect(splash).toHaveCount(0, { timeout: 3000 }); // ohne künstliche Ladezeit: kurz nach dem Start entfernt
    // Neuladen in derselben Sitzung: kein Startbildschirm
    await page.reload();
    expect(await page.evaluate(() => [document.documentElement.classList.contains('nosplash'), !!document.getElementById('splash')])).toEqual([true, false]);
    // neue Sitzung mit laufendem Training: direkt zum Timer, kein Startbildschirm
    await page.evaluate(() => { sessionStorage.clear(); elapsed = 30; persistSession(); });
    await page.reload();
    expect(await page.evaluate(() => [document.documentElement.classList.contains('nosplash'), area])).toEqual([true, 'kraft']);
    // Antippen blendet sofort aus
    await page.evaluate(() => { resetState(); persistSession(); sessionStorage.clear(); });
    await page.reload();
    await page.locator('#splash').click();
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 1000 });
  });
  test('Neuigkeiten nach einem Update erst, wenn der Startbildschirm weg ist', async ({ page }) => {
    await page.evaluate(() => { localStorage.setItem(KEYS.notes, JSON.stringify({ seen: null, auto: true })); sessionStorage.clear(); });
    await page.reload();
    await expect(page.locator('#splash')).toHaveCount(1);
    expect(await page.evaluate(() => !!document.querySelector('dialog#notes[open]'))).toBe(false);
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('dialog#notes')).toBeVisible();
  });
});

test.describe('Ergebnis nach dem Rennen', () => {
  const setRaces = (page, list) => page.evaluate(l => { races = l.map(r => Object.assign({}, r)); persistRaces(); showArea('start'); }, list);
  const day = (page, n) => page.evaluate(d => addDays(localDay(), d), n);
  test('ab dem Tag danach fragt die Startseite nach der Zeit und speichert sie als Ergebnis', async ({ page }) => {
    await setRaces(page, [{ id: 'heute', name: 'Heutiger Lauf', date: await day(page, 0), dist: '10k', prio: 'B', goal: null }]);
    await expect(page.locator('#startresult')).toHaveCount(0); // am Renntag selbst noch nicht
    await setRaces(page, [{ id: 'hm', name: 'Berliner HM', date: await day(page, -1), dist: 'hm', prio: 'A', goal: 7140 }]);
    await expect(page.locator('#startresult')).toContainText('Wie lief Berliner HM?');
    await page.click('[data-ressave="hm"]');
    await expect(page.locator('#srestime [data-tpart="0"]')).toHaveAttribute('aria-invalid', 'true');
    for (const [i, v] of ['1', '58', '12'].entries()) await page.fill(`#srestime [data-tpart="${i}"]`, v);
    await page.click('[data-ressave="hm"]');
    await expect(page.locator('#startresult')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('1:58:12 über Halbmarathon gespeichert');
    expect(await page.evaluate(() => results.map(r => [r.race, r.dist, r.km, r.time, r.name]))).toEqual([['hm', 'hm', 21.0975, 7092, 'Berliner HM']]);
    // Tempos kommen jetzt aus dem Ergebnis, die Rennliste zeigt es
    expect(await page.evaluate(() => trainingPaces().ref.r.race)).toBe('hm');
    await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="plan"]'); await page.click('[data-runsub="rennen"]');
    await expect(page.locator('#racelist')).toContainText('gelaufen: 1:58:12');
  });

  test('Wings for Life: geschaffte km, Zeit vom Catcher Car; Pace Race: Level beim Rennen; nicht gelaufen', async ({ page }) => {
    await setRaces(page, [{ id: 'w', name: 'Wings for Life', date: await day(page, -2), dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' },
      { id: 'p', name: 'Pace Race', date: await day(page, -1), dist: '10k', prio: 'A', goal: null, km: 12, fmt: 'pace' },
      { id: 'x', name: 'Stadtlauf', date: await day(page, -1), dist: '10k', prio: 'B', goal: null }]);
    // das neueste zuerst (vor 1 Tag: Pace Race und Stadtlauf), Wings for Life von vor 2 Tagen danach
    await expect(page.locator('#startresult .skicker')).toContainText('gestern');
    await expect(page.locator('#startresult .srowt b')).toHaveText(/Wie lief (Pace Race|Stadtlauf)\?/);
    if (await page.locator('#startresult [data-resdns="x"]').count()) await page.click('#startresult [data-resdns="x"]');
    await expect(page.locator('#startresult .srowt b')).toHaveText('Wie lief Pace Race?');
    await page.fill('#sreslevel', '30');
    await page.click('#startresult [data-ressave="p"]');
    await expect(page.locator('#sreslevel')).toHaveAttribute('aria-invalid', 'true');
    await page.fill('#sreslevel', '11,753');
    await page.click('#startresult [data-ressave="p"]');
    if (await page.locator('[data-resdns="x"]').count()) await page.click('[data-resdns="x"]');
    await expect(page.locator('#startresult .srowt b')).toHaveText('Wie lief Wings for Life?');
    await expect(page.locator('#startresult .skicker')).toContainText('vor 2 Tagen');
    await page.fill('#sreskm', '18,4');
    await expect(page.locator('#sresinfo')).toContainText('Catcher Car bei km 18,4 nach 1:44:38');
    await page.click('[data-ressave="w"]');
    expect(await page.evaluate(() => results.map(r => [r.race, r.dist, r.km, r.time]))).toEqual([['w', null, 18.4, 6278]]);
    await expect(page.locator('#startresult')).toHaveCount(0);
    expect(await page.evaluate(() => [races.find(r => r.id === 'p').level, races.find(r => r.id === 'x').dns, results.length])).toEqual([11.753, true, 1]);
    // bleibt nach dem Neuladen gültig, Rennliste zeigt Level und „nicht gelaufen“
    await page.reload();
    expect(await page.evaluate(() => [races.find(r => r.id === 'p').level, races.find(r => r.id === 'x').dns])).toEqual([11.753, true]);
    await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="plan"]'); await page.click('[data-runsub="rennen"]');
    await expect(page.locator('#racelist')).toContainText('geschafft: Level 11,753');
    await expect(page.locator('#racelist')).toContainText('nicht gelaufen');
    await expect(page.locator('#racelist')).toContainText('gelaufen: 18,4 km in 1:44:38');
  });
});

test('Startseite: beim Kraft-Eintrag steht, was du bereitlegen solltest', async ({ page }) => {
  await page.evaluate(() => { const d = new Date(localDay() + 'T12:00:00').getDay(); profile.week.strength = [d]; profile.week.strengthPlan = { [d]: 'wed' }; persistProfile(); setPlanGear('wed', { kb: true, band: false, bw: true }); showArea('start'); });
  const row = page.locator('#startcontent .srowt', { hasText: 'Kraft · Ganzkörper' });
  await expect(row.locator('.sneed')).toContainText('Du brauchst: Kettlebell 12 kg');
  await expect(row.locator('.sneed')).toContainText('Matte');
  // im Urlaub: Hotel-Plan statt Ganzkörper, nur was ohne Geräte gebraucht wird
  await page.evaluate(() => { profile.kit.vacation = { from: localDay(), to: addDays(localDay(), 3), gear: { kb: false, band: false, bw: true } }; persistProfile(); renderStart(); });
  const hotel = page.locator('#startcontent .srowt', { hasText: 'Kraft · Hotel' });
  await expect(hotel.locator('.sneed')).toContainText('Matte');
  await expect(hotel.locator('.sneed')).not.toContainText('Kettlebell');
});

test('Hotel-Plan nur im Urlaub als Reiter; Gym/Kurs als Krafttag mit Namen, abhaken zählt als Kraft', async ({ page }) => {
  await page.evaluate(() => showArea('kraft'));
  await expect(page.locator('#tabs button', { hasText: 'Hotel' })).toHaveCount(0);
  await page.evaluate(() => { profile.kit.vacation = { from: localDay(), to: addDays(localDay(), 7), gear: { kb: false, band: false, bw: true } }; persistProfile(); renderAll(); showArea('kraft'); });
  await expect(page.locator('#tabs button').first()).toHaveText('Hotel');
  const r = await page.evaluate(() => { const ex = exList('hotel'); return { n: ex.length, g: [...new Set(ex.map(x => x.g))], secs: phaseSecs('hotel', 0) + phaseSecs('hotel', 1) + phaseSecs('hotel', 2) }; });
  expect(r).toEqual({ n: 10, g: ['bw'], secs: 28 * 60 });
  // Gym/Kurs
  await page.evaluate(() => { profile.kit.vacation = null; const d = new Date(localDay() + 'T12:00:00').getDay(); profile.week.strength = [d]; profile.week.strengthPlan = {}; persistProfile(); renderProfile(); showArea('profil'); });
  await openSect(page, 'sect-week');
  const d = await page.evaluate(() => new Date(localDay() + 'T12:00:00').getDay());
  await page.selectOption(`[data-wkplan="${d}"]`, 'gym');
  await page.fill(`[data-wkgym="${d}"]`, 'Blaze'); await page.dispatchEvent(`[data-wkgym="${d}"]`, 'change');
  expect(await page.evaluate(() => [profile.week.strengthPlan, profile.week.gymNames])).toEqual([{ [d]: 'gym' }, { [d]: 'Blaze' }]);
  await page.evaluate(() => showArea('start'));
  const row = page.locator('#startcontent .srowt', { hasText: 'Kurs · Blaze' });
  await row.locator('[data-gymdone]').click();
  await expect(row.locator('.sdone')).toBeVisible();
  await expect(page.locator('#startcontent .sweek')).toContainText('1 von 1');
  expect(await page.evaluate(() => getGymLog().map(e => e.n))).toEqual(['Blaze']);
});

test.describe('Lauf nachtragen', () => {
  const yWd = page => page.evaluate(() => new Date(addDays(localDay(), -1) + 'T12:00:00').getDay());
  test('am Tag nach dem geplanten Lauf fragt die Startseite nach den km und trägt sie in den Umfang ein', async ({ page }) => {
    const wd = await yWd(page);
    await page.evaluate(d => { profile.week = Object.assign(profile.week, { group: d, quality: null, long: null, runner: 'runner' }); persistProfile(); runLog = []; persistRunLog(); showArea('start'); }, wd);
    await expect(page.locator('#startrun .srowt b')).toHaveText(/^\S+ \d\d\.\d\d\. · Laufgruppe$/);
    await page.click('[data-runsave]');
    await expect(page.locator('#srunkm')).toHaveAttribute('aria-invalid', 'true');
    await page.fill('#srunkm', '8,5');
    await page.click('[data-runsave]');
    await expect(page.locator('#startrun')).toHaveCount(0);
    expect(await page.evaluate(() => runLog.map(r => [r.date, r.km]))).toEqual([[await page.evaluate(() => addDays(localDay(), -1)), 8.5]]);
    await expect(page.locator('#toast')).toContainText('8,5 km am');
  });
  test('„Nicht gelaufen“ markiert die Einheit als entfallen; eine Wochensumme oder der Lauf-Einstieg fragen nicht', async ({ page }) => {
    const wd = await yWd(page);
    await page.evaluate(d => { profile.week = Object.assign(profile.week, { group: null, quality: null, long: d, runner: 'runner' }); persistProfile(); runLog = []; persistRunLog(); showArea('start'); }, wd);
    await expect(page.locator('#startrun .srowt b')).toHaveText(/^\S+ \d\d\.\d\d\. · Longrun$/);
    await page.click('[data-runskip]');
    await expect(page.locator('#startrun')).toHaveCount(0);
    expect(await page.evaluate(() => weekSkip[weekStart(addDays(localDay(), -1))])).toContain('long');
    // Wochensumme statt einzelner Läufe: keine Frage
    await page.evaluate(() => { const w = weekStart(addDays(localDay(), -1)); weekSkip[w] = []; store(KEYS.skip, weekSkip); setWeekKm(w, 'km', 30); renderStart(); });
    await expect(page.locator('#startrun')).toHaveCount(0);
    // Lauf-Einstieg: keine Frage
    await page.evaluate(() => { runWeeks = []; persistRunWeeks(); profile.week.runner = 'beginner'; persistProfile(); renderStart(); });
    await expect(page.locator('#startrun')).toHaveCount(0);
  });
  test('offene Einträge verschwinden nicht nach Tagen, nur eingetragen oder „nicht gelaufen“; mehrere sind eingeklappt', async ({ page }) => {
    const d = n => page.evaluate(x => addDays(localDay(), x), n);
    const wd = await page.evaluate(() => new Date(addDays(localDay(), -9) + 'T12:00:00').getDay());
    // Longrun jede Woche am selben Wochentag, zuletzt vor 9 und 2 Tagen; das Rennen ist 40 Tage her; gemerkt ist ein Tag vor 12 Tagen
    await page.evaluate(([w, r, from]) => { profile.week = Object.assign(profile.week, { group: null, quality: null, long: w, extras: [], runner: 'runner' }); persistProfile(); runLog = []; persistRunLog();
      races = [{ id: 'alt', name: 'Herbstlauf', date: r, dist: '10k', prio: 'B', goal: null }]; persistRaces(); store(KEYS.runask, from); showArea('start'); }, [wd, await d(-40), await d(-12)]);
    // neueste zuerst: Longrun vor 2 Tagen oben, eingeklappt der vor 9 Tagen und das Rennen
    await expect(page.locator('#startrun .srowt b')).toContainText('Longrun');
    await expect(page.locator('#startrun .skicker')).toContainText('vor 2 Tagen');
    await expect(page.locator('#startmore summary')).toContainText('2 weitere offen');
    await expect(page.locator('#startrun-1')).toBeHidden(); // eingeklappt
    await page.click('#startmore summary');
    await expect(page.locator('#startrun-1 .skicker')).toContainText('vor 9 Tagen');
    await expect(page.locator('#startresult-2 .srowt b')).toHaveText('Wie lief Herbstlauf?');
    // eintragen im eingeklappten Bereich: bleibt aufgeklappt, der Lauf zählt
    await page.fill('#srunkm-1', '14');
    await page.click('#startrun-1 [data-runsave]');
    expect(await page.evaluate(() => runLog.map(r => r.km))).toEqual([14]);
    await expect(page.locator('#startmore')).toHaveAttribute('open', '');
    await expect(page.locator('#startmore .sres')).toHaveCount(1);
    // nach dem Neuladen immer noch da (keine Frist)
    await page.reload(); await page.evaluate(() => showArea('start'));
    await expect(page.locator('#startrun .srowt b')).toContainText('Longrun');
    await page.click('#startrun [data-runskip]');
    await expect(page.locator('#startresult .srowt b')).toHaveText('Wie lief Herbstlauf?');
    await page.click('[data-resdns="alt"]');
    await expect(page.locator('#startcontent .sres')).toHaveCount(0);
    expect(await page.evaluate(() => load(KEYS.runask, null))).toBe(await d(0));
  });
  test('Zeit und Ø-Puls optional: Auswertung gegen Zone 2 und lockeres Tempo, bei Intervallen ohne Wertung', async ({ page }) => {
    const wd = await page.evaluate(() => new Date(addDays(localDay(), -1) + 'T12:00:00').getDay());
    const setup = kind => page.evaluate(([w, k]) => { profile.week = Object.assign(profile.week, { group: null, quality: k === 'q' ? w : null, long: k === 'l' ? w : null, extras: [], runner: 'runner' });
      profile.hr = Object.assign({}, profile.hr, { max: 185, rest: 55, z: hrZonesFrom(185, 55) }); persistProfile(); // Zone 2: 133–145
      results = [{ id: 'r', date: addDays(localDay(), -40), km: 10, time: 3000, dist: '10k' }]; persistResults(); // locker 6:00–6:30 /km
      races = []; persistRaces(); runLog = []; persistRunLog(); localStorage.removeItem(KEYS.runask); startFeedback = null; showArea('start'); }, [wd, kind]);
    const fill = async (km, t, hr) => { await page.fill('#srunkm', km); for (const [i, v] of t.entries()) await page.fill(`#sruntime [data-tpart="${i}"]`, v); await page.fill('#srunhr', hr); await page.click('[data-runsave]'); };
    await setup('l');
    // ungültiger Puls wird markiert, nichts gespeichert
    await fill('14', ['1', '24', '00'], '30');
    await expect(page.locator('#srunhr')).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => runLog.length)).toBe(0);
    await fill('14', ['1', '24', '00'], '138');
    await expect(page.locator('#startfb')).toContainText('14\u00a0km · 1:24:00 · 6:00\u00a0/km · Ø\u00a0138\u00a0bpm');
    await expect(page.locator('#startfb .sfbtext')).toHaveText('✓ Super – alles im empfohlenen Bereich.');
    await expect(page.locator('#startfb svg.chk')).toHaveCount(2);
    expect(await page.evaluate(() => { const r = runLog[0]; return [r.km, r.sec, r.hr, r.kind]; })).toEqual([14, 5040, 138, 'long']);
    await page.click('[data-fbclose]');
    await expect(page.locator('#startfb')).toHaveCount(0);
    // in der Liste unter Umfang
    await page.evaluate(() => { showArea('laufen'); }); await page.click('[data-runtab="umfang"]');
    await expect(page.locator('#runlist')).toContainText('1:24:00 · 6:00\u00a0/km · Ø\u00a0138\u00a0bpm · ✓ im Bereich');
    // Puls zu hoch bei passendem Tempo
    await setup('l');
    await fill('10', ['1', '02', '00'], '152');
    await expect(page.locator('#startfb .sfbtext').first()).toContainText('Das Tempo passte, der Puls lag trotzdem über Zone 2');
    // dazu: lockeres Tempo 5 s/km langsamer (Puls über Zone 2 bei Tempo im Bereich)
    await expect(page.locator('#sfbeasy')).toContainText('→ 6:05–6:35 /km – Puls über Zone 2.');
    // ohne Zeit und Puls: keine Auswertung
    await setup('l');
    await page.fill('#srunkm', '8'); await page.click('[data-runsave]');
    await expect(page.locator('#startfb')).toHaveCount(0);
    // Intervall: Werte ja, Wertung nein
    await setup('q');
    await fill('9', ['', '50', '00'], '160');
    await expect(page.locator('#startfb .sfbtext')).toHaveText('Bei Intervall- und Tempoeinheiten sagt der Durchschnitt wenig – entscheidend sind die schnellen Abschnitte.');
    await expect(page.locator('#startfb svg.chk')).toHaveCount(0);
  });
  test('lockeres Tempo folgt den Läufen langsam in beide Richtungen: Puls in Zone 2 → 10 s/km je Lauf, höchstens 30 s/km, nur locker', async ({ page }) => {
    const wd = await page.evaluate(() => new Date(addDays(localDay(), -1) + 'T12:00:00').getDay());
    await page.evaluate(w => { profile.week = Object.assign(profile.week, { group: null, quality: null, long: w, extras: [], runner: 'runner' });
      profile.hr = Object.assign({}, profile.hr, { max: 185, rest: 55, z: hrZonesFrom(185, 55) }); persistProfile(); // Zone 2: 133–145
      results = [{ id: 'r', date: addDays(localDay(), -40), km: 10, time: 3000, dist: '10k' }]; persistResults(); // locker 6:00–6:30 /km
      races = []; persistRaces(); localStorage.removeItem(KEYS.runask); startFeedback = null; }, wd);
    // Läufe: [vor Tagen, km, s/km, Ø-Puls, Art]
    const easy = async runs => page.evaluate(rs => { runLog = rs.map(([ago, km, pace, hr, kind], i) => ({ id: 'x' + i, date: addDays(localDay(), -ago), km, sec: Math.round(km * pace), hr, kind: kind || 'easy' })); const tp = trainingPaces(); return [paceRange(tp.easy), tp.adapt && tp.adapt.shift, paceRange(tp.threshold)]; }, runs);
    const thr = (await easy([]))[2];
    // Jans Beispiel: Bereich 6:00–6:30, ein Lauf in 5:50 mit Puls in Zone 2 → 5:50–6:20 (nicht gleich auf 5:50 als Mitte)
    expect(await easy([[5, 8, 350, 140]])).toEqual(['5:50–6:20 /km', 10, thr]);
    // noch ein Lauf in 5:50 ändert nichts – nie schneller als tatsächlich gelaufen
    expect((await easy([[5, 8, 350, 140], [3, 8, 350, 139]]))[0]).toBe('5:50–6:20 /km');
    // schnell und im Bereich, Lauf für Lauf je 10 s/km, höchstens 30 s/km (5:30–6:00); Schwelle bleibt bei der Bestzeit
    expect(await easy([[12, 8, 320, 140], [9, 8, 315, 138], [6, 12, 318, 142, 'long'], [3, 8, 300, 141]])).toEqual(['5:30–6:00 /km', 30, thr]);
    // Puls über Zone 2 nimmt 5 s/km zurück
    expect(await easy([[9, 8, 330, 140], [6, 8, 330, 140], [3, 8, 340, 152]])).toEqual(['5:45–6:15 /km', 15, thr]);
    // andere Richtung: Puls in Zone 2 erst bei langsamerem Tempo → 10 s/km langsamer je Lauf, höchstens 30 s/km (Jans Beispiel: auf 7:00)
    expect(await easy([[5, 8, 405, 140]])).toEqual(['6:10–6:40 /km', -10, thr]);
    expect(await easy([[9, 8, 430, 140], [6, 8, 430, 139], [3, 10, 430, 141, 'long'], [1, 8, 440, 140]])).toEqual(['6:30–7:00 /km', -30, thr]);
    // langsam mit Puls unter Zone 2 (ganz ruhig gelaufen) ändert nichts
    expect((await easy([[5, 8, 430, 120]]))[0]).toBe('6:00–6:30 /km');
    // Puls über Zone 2 im Bereich → 5 s/km langsamer; Puls hoch, weil zu schnell gelaufen → keine Änderung
    expect(await easy([[5, 8, 370, 152]])).toEqual(['6:05–6:35 /km', -5, thr]);
    expect((await easy([[5, 8, 320, 152]]))[0]).toBe('6:00–6:30 /km');
    // Intervalle, kurze Läufe, Läufe vor dem letzten Ergebnis und Läufe ohne Puls zählen nicht
    expect((await easy([[10, 8, 330, 140, 'quality'], [5, 2, 330, 138], [45, 8, 330, 142], [2, 8, 330, null]]))[0]).toBe('6:00–6:30 /km');
    // ohne Pulszonen keine Anpassung
    expect(await page.evaluate(() => { runLog = [{ id: 'a', date: addDays(localDay(), -3), km: 8, sec: 2800, hr: 140, kind: 'easy' }]; const z = profile.hr.z; profile.hr.z = null; const e = paceRange(trainingPaces().easy); profile.hr.z = z; return e; })).toBe('6:00–6:30 /km');
    // über die Startseite: Hinweis beim Eintragen, die Tempos unter Laufen zeigen die Anpassung
    await page.evaluate(() => { runLog = []; persistRunLog(); showArea('start'); });
    await page.fill('#srunkm', '12'); for (const [i, v] of ['1', '10', '00'].entries()) await page.fill(`#sruntime [data-tpart="${i}"]`, v); await page.fill('#srunhr', '141');
    await page.click('[data-runsave]');
    await expect(page.locator('#sfbeasy')).toHaveText('Lockeres Tempo angepasst: 6:00–6:30 /km → 5:50–6:20 /km – Puls in Zone 2 bei schnellerem Tempo. Die App rückt höchstens 10 s/km pro Lauf nach.');
    // Reiter „Laufen“ zeigt den neuen Stand sofort (ohne Unterreiter-Wechsel)
    await page.evaluate(() => { runView.tab = 'plan'; runView.plan = 'woche'; });
    await page.evaluate(() => showArea('laufen')); // wie der Reiter in der Leiste
    await expect(page.locator('#runcontent')).toContainText('an deine Läufe angepasst: 10 s/km schneller als aus der Bestzeit (6:00–6:30 /km), weil lockere Läufe mit Puls in Zone 2 schneller waren');
    // langsamer Lauf mit Puls in Zone 2 über die Startseite: Hinweis in der Auswertung
    await page.evaluate(() => { runLog = []; persistRunLog(); startFeedback = null; localStorage.removeItem(KEYS.runask); const wp = curWeekPlan(weekStart(addDays(localDay(), -1))); if (wp) { wp.done = []; storeWeekPlan(); } showArea('start'); });
    await page.fill('#srunkm', '10'); for (const [i, v] of ['1', '07', '30'].entries()) await page.fill(`#sruntime [data-tpart="${i}"]`, v); await page.fill('#srunhr', '140');
    await page.click('[data-runsave]');
    await expect(page.locator('#sfbeasy')).toHaveText('Lockeres Tempo angepasst: 6:00–6:30 /km → 6:10–6:40 /km – Puls in Zone 2 erst bei langsamerem Tempo. Die App passt höchstens 10 s/km pro Lauf an.');
  });
  test('heutigen Lauf direkt aus „Heute dran“ eintragen, mit Zeit und Puls', async ({ page }) => {
    const wd = await page.evaluate(() => new Date(localDay() + 'T12:00:00').getDay());
    await page.evaluate(w => { profile.week = Object.assign(profile.week, { group: w, quality: null, long: null, extras: [], strength: [], runner: 'runner' });
      profile.hr = Object.assign({}, profile.hr, { max: 185, rest: 55, z: hrZonesFrom(185, 55) }); persistProfile(); races = []; persistRaces(); runLog = []; persistRunLog(); startFeedback = null; showArea('start'); }, wd);
    await page.click('[data-logtoday="group"]');
    await expect(page.locator('#startrun-90 .skicker')).toHaveText('Lauf eintragen · heute');
    await page.click('[data-logcancel]');
    await expect(page.locator('#startrun-90')).toHaveCount(0);
    await page.click('[data-logtoday="group"]');
    await page.fill('#srunkm-90', '9'); await page.fill('#srunhr-90', '140');
    await page.click('#startrun-90 [data-runsave]');
    expect(await page.evaluate(() => runLog.map(r => [r.date === localDay(), r.km, r.hr, r.kind]))).toEqual([[true, 9, 140, 'group']]);
    await expect(page.locator('#startfb .sfbtext')).toContainText('Super');
    await expect(page.locator('[data-logtoday]')).toHaveCount(0);
    await expect(page.locator('#startcontent .sdone')).toHaveCount(1);
  });
  test('Umfang: Lauf eintragen mit Zeit, Puls und Art; Auswertung unter dem Formular', async ({ page }) => {
    await page.evaluate(() => { profile.hr = Object.assign({}, profile.hr, { max: 185, rest: 55, z: hrZonesFrom(185, 55) }); persistProfile();
      results = [{ id: 'r', date: addDays(localDay(), -40), km: 10, time: 3000, dist: '10k' }]; persistResults(); runLog = []; persistRunLog(); showArea('laufen'); });
    await page.click('[data-runtab="umfang"]');
    await page.fill('#runkm', '10');
    for (const [i, v] of ['1', '02', '00'].entries()) await page.fill(`#runtime [data-tpart="${i}"]`, v);
    await page.fill('#runhr', '152'); await page.selectOption('#runkind', 'easy');
    await page.click('#runaddbtn');
    expect(await page.evaluate(() => { const r = runLog[0]; return [r.km, r.sec, r.hr, r.kind]; })).toEqual([10, 3720, 152, 'easy']);
    await expect(page.locator('#runfbcard .sfbtext')).toContainText('Puls lag trotzdem über Zone 2');
    await expect(page.locator('#runfbcard svg.chk')).toHaveCount(2);
    await expect(page.locator('#runlist')).toContainText('Puls über Zone 2');
    await page.click('#runfbcard [data-fbclose]');
    await expect(page.locator('#runfbcard')).toHaveCount(0);
    await expect(page.locator('#runhr')).toHaveValue('');
  });
  test('mehrere offene Läufe auf einmal als „nicht gelaufen“ markieren', async ({ page }) => {
    const wd = await page.evaluate(() => new Date(addDays(localDay(), -1) + 'T12:00:00').getDay());
    await page.evaluate(w => { profile.week = Object.assign(profile.week, { group: null, quality: null, long: w, extras: [], runner: 'runner' }); persistProfile(); runLog = []; persistRunLog(); races = []; persistRaces(); store(KEYS.runask, addDays(localDay(), -20)); showArea('start'); }, wd);
    await page.click('#startmore summary');
    await page.click('[data-runskipall]');
    await expect(page.locator('#startcontent .sres')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('3 Läufe nicht gelaufen');
  });
});

test('Bestzeiten: eigene Reiter für Wings for Life (weiteste Strecke) und Pace Race (bestes Level)', async ({ page }) => {
  await page.evaluate(() => {
    races = [{ id: 'w', name: 'Wings for Life', date: '2026-05-10', dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' }, { id: 'w2', name: 'Wings for Life', date: '2027-05-09', dist: 'hm', prio: 'A', goal: null, km: 20, fmt: 'wfl' },
      { id: 'p', name: 'Pace Race Berlin', date: '2026-06-13', dist: '10k', prio: 'A', goal: null, km: 12, fmt: 'pace', level: 11.753 }];
    persistRaces();
    results = [{ id: 'r1', date: '2026-05-10', km: 17.2, time: Math.round(carTime(17.2)), dist: null, name: 'Wings for Life', race: 'w' }, { id: 'r2', date: '2027-05-09', km: 18.4, time: Math.round(carTime(18.4)), dist: null, name: 'Wings for Life', race: 'w2' },
      { id: 'r3', date: '2026-09-06', km: 21.0975, time: 7300, dist: 'hm', name: 'HM' }];
    persistResults(); bestView.group = 'hm'; showArea('laufen');
  });
  await page.click('[data-runtab="plan"]'); await page.click('[data-runsub="bestzeiten"]');
  // keine eigenen Reiter „17,2 km“ / „18,4 km“
  await expect(page.locator('#bestgroups [data-bestgroup]')).toHaveText(['Halbmarathon', 'Wings for Life', 'Pace Race']);
  await page.click('[data-bestgroup="wfl"]');
  await expect(page.locator('#bestcard .longnext b')).toHaveText('18,4 km');
  await expect(page.locator('#bestkmfield')).toBeHidden(); // Formular nicht mit „NaN“ vorbelegt
  await expect(page.locator('#bestcard')).toContainText('+1,2 km');
  await expect(page.locator('#bestlist .row')).toHaveCount(2);
  await page.click('[data-bestgroup="pace"]');
  await expect(page.locator('#bestcard .longnext b')).toHaveText('Level 11,753');
  await page.click('#bestlist [data-leveldel="p"]');
  expect(await page.evaluate(() => races.find(r => r.id === 'p').level)).toBeUndefined();
  // Wings for Life zählt weiter für die Tempos
  expect(await page.evaluate(() => fitnessRef('2027-05-20').r.id)).toBe('r2');
});

test.describe('Jahresziel', () => {
  test.use({ start: true });
  test('Vorschlag aus dem Vorjahr (hochgerechnet + 5 %), übernehmen, Fortschritt mit Soll und Hochrechnung', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-02T10:00:00+02:00'));
    await page.reload();
    await page.evaluate(() => {
      // Vorjahr: 26 Wochen à 20 km (nur halb eingetragen) → hochgerechnet 1.040 km, + 5 % = 1.092 → 1.100
      runLog = []; for (let i = 0; i < 26; i++) runLog.push({ id: 'p' + i, date: addDays('2025-06-02', i * 7), km: 20 });
      // dieses Jahr: 26 Wochen à 25 km
      for (let i = 0; i < 26; i++) runLog.push({ id: 'c' + i, date: addDays('2026-01-01', i * 7), km: 25 });
      persistRunLog(); races = []; persistRaces(); profile.week.runner = 'runner'; persistProfile(); showArea('start');
    });
    const card = page.locator('#yearcard');
    await expect(card).toContainText('Jahresziel 2026');
    await page.click('#yearcard summary'); // eine Zeile in „Diese Woche“, Eingabe zum Aufklappen
    await expect(card).toContainText('Vorschlag: 1.100 km – Vorjahr 520 km, hochgerechnet aus 26 Wochen, + 5 %');
    await expect(page.locator('#yeargoal')).toHaveValue('1100');
    await page.fill('#yeargoal', '1200'); await page.click('#yearsave');
    expect(await page.evaluate(() => profile.yearKm)).toEqual({ 2026: 1200 });
    await expect(card.locator('summary')).toContainText('Jahr 2026650 / 1.200 km');
    await expect(card).toContainText('Soll bis heute 602 km');
    await expect(card).toContainText('48 km voraus');
    await expect(card).toContainText('Hochrechnung ca. 1.296 km');
    await page.click('#yearcard summary');
    await page.click('#yearedit');
    await expect(page.locator('#yeargoal')).toHaveValue('1200');
  });
});

test.describe('Wochenleiste', () => {
  test.use({ start: true });
  test('Mo–So: trainiert, geplant, verpasst, frei; heute markiert', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-04T10:00:00+01:00')); // Mittwoch
    await page.reload();
    await page.evaluate(() => { races = []; persistRaces(); profile.week = Object.assign(profile.week, { quality: 2, long: 0, group: null, strength: [1, 5], extras: [], runner: 'runner' }); persistProfile();
      runLog = [{ id: 'r', date: '2026-11-03', km: 9 }]; persistRunLog(); showArea('start'); });
    const days = page.locator('.sstrip .sday');
    await expect(days).toHaveCount(7);
    expect(await days.evaluateAll(l => l.map(x => x.className.replace('sday ', '')))).toEqual(['miss', 'done', 'rest today', 'rest', 'plan', 'rest', 'plan']);
  });
});

test.describe('Weniger Tipps', () => {
  test.use({ start: true });
  test('„✓ km wie geplant“ / „wie letztes Mal“ speichert mit einem Tipp; Tag in der Wochenleiste zeigt Plan und Eintragen', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+01:00')); // Donnerstag
    await page.reload();
    await page.evaluate(() => { races = []; persistRaces(); profile.week = Object.assign(profile.week, { quality: null, long: null, group: 3, strength: [1], extras: [], runner: 'runner' }); persistProfile();
      runLog = [{ id: 'g', date: '2026-10-28', km: 7.5, kind: 'group' }]; persistRunLog(); localStorage.removeItem(KEYS.runask); showArea('start'); });
    // Laufgruppe gestern: wie letztes Mal 7,5 km
    await expect(page.locator('#startrun [data-runquick]')).toHaveText('✓ 7,5 km · wie letztes Mal');
    await page.click('#startrun [data-runquick]');
    expect(await page.evaluate(() => runLog.filter(r => r.date === '2026-11-04').map(r => [r.km, r.kind]))).toEqual([[7.5, 'group']]);
    // Wochenleiste: Montag antippen → Kraft geplant, nichts erledigt; nochmal tippen schließt
    await page.click('[data-stripday="2026-11-02"]');
    await expect(page.locator('.sstripinfo')).toContainText('Kraft');
    await page.click('[data-stripday="2026-11-02"]');
    await expect(page.locator('.sstripinfo')).toHaveCount(0);
    // Mittwoch: Laufgruppe ✓
    await page.click('[data-stripday="2026-11-04"]');
    await expect(page.locator('.sstripinfo')).toContainText('Laufgruppe ✓');
  });
});

test.describe('Longrun selbst setzen', () => {
  test.use({ start: true });
  test('heute weniger oder mehr: Wert gilt für die Woche, Vorschlag bleibt zurückholbar, Hinweis bei deutlich mehr', async ({ page }) => {
    const wd = await page.evaluate(() => new Date(localDay() + 'T12:00:00').getDay());
    await page.evaluate(w => { profile.week = Object.assign(profile.week, { group: null, quality: null, long: w, extras: [], strength: [], runner: 'runner' }); persistProfile(); races = [{ id: 'a', name: 'HM', date: addDays(localDay(), 120), dist: 'hm', prio: 'A' }]; persistRaces();
      runLog = [7, 14, 21, 28].flatMap(d => [{ id: 'l' + d, date: addDays(localDay(), -d), km: 12, kind: 'long' }, { id: 'e' + d, date: addDays(localDay(), -d - 3), km: 8, kind: 'easy' }]).sort((a, b) => a.date.localeCompare(b.date)); persistRunLog(); showArea('start'); }, wd);
    const sug = await page.evaluate(() => todayItems().find(i => i.kind === 'long').suggested);
    expect(sug).toBeGreaterThan(0);
    // weniger („fühl mich nicht gut“)
    await page.click('[data-longedit]');
    await page.fill('#slongkm', String(sug - 2)); await page.click('[data-longsave]');
    await expect(page.locator('#startcontent')).toContainText(`Longrun ${sug - 2} km · selbst gesetzt`);
    await expect(page.locator('.slong')).toContainText(`Vorschlag des Plans: ${sug} km`);
    expect(await page.evaluate(() => [longSet[weekStart(localDay())], todayItems().find(i => i.kind === 'long').km])).toEqual([sug - 2, sug - 2]);
    // „✓ … wie geplant“ beim Eintragen nimmt den eigenen Wert
    await page.click('[data-logtoday="long"]');
    await expect(page.locator('[data-runquick]')).toContainText(`${sug - 2} km`);
    await page.click('[data-logcancel]');
    // deutlich mehr („übelst Bock“): Hinweis
    await page.click('[data-longedit]');
    await page.fill('#slongkm', '25'); await page.click('[data-longsave]');
    await expect(page.locator('#toast')).toContainText(`Longrun 25 km – deutlich mehr als geplant (${sug} km)`);
    // zurück auf den Vorschlag
    await page.click('[data-longedit]');
    await page.click('[data-longreset]');
    await expect(page.locator('#startcontent')).toContainText(`Longrun ca. ${sug} km`);
    expect(await page.evaluate(() => Object.keys(longSet).length)).toBe(0);
    // ungültig
    await page.click('[data-longedit]');
    await page.fill('#slongkm', '0'); await page.click('[data-longsave]');
    await expect(page.locator('#slongkm')).toHaveAttribute('aria-invalid', 'true');
    // im Backup
    await page.fill('#slongkm', '14'); await page.click('[data-longsave]');
    expect(await page.evaluate(() => JSON.parse(backupJson()).longSet)).toEqual(await page.evaluate(() => ({ [weekStart(localDay())]: 14 })));
  });
});

test.describe('Rennbereit?', () => {
  test.use({ start: true });
  test('je Rennen: schaffen (längster Lauf, Wochen-km) und Zielzeit (Prognose); Erfolge eingeklappt, sichtbar der neueste', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-08T10:00:00+01:00')); // Sonntag
    await page.reload();
    await page.evaluate(() => {
      localStorage.removeItem(KEYS.badges);
      // 6 volle Wochen à 31 km: Mo 9, Mi 8, Sa 14 (Longrun)
      runLog = []; for (let w = 1; w <= 6; w++) { const m = addDays('2026-11-02', -7 * w); runLog.push({ id: 'a' + w, date: m, km: 9 }, { id: 'b' + w, date: addDays(m, 2), km: 8 }, { id: 'c' + w, date: addDays(m, 5), km: 14, kind: 'long' }); }
      runLog.sort((a, b) => a.date.localeCompare(b.date)); persistRunLog();
      results = [{ id: 'r', date: '2026-09-27', km: 10, time: 3060, dist: '10k' }]; persistResults(); // 51:00 → HM-Prognose 1:52:32
      races = [{ id: 'b', name: 'Silvesterlauf', date: '2026-12-31', dist: '10k', prio: 'B' }, { id: 's', name: 'Stadtlauf', date: '2027-01-31', dist: '10k', prio: 'A' }, { id: 'h', name: 'Spandauer HM', date: '2027-03-14', dist: 'hm', prio: 'A', goal: 7500 },
        { id: 'm', name: 'Berlin', date: '2027-09-26', dist: 'marathon', prio: 'A', goal: 15300 }]; persistRaces();
      profile.week.runner = 'runner'; persistProfile(); showArea('start');
    });
    const card = page.locator('#readycard'), row = n => card.locator('.srowt', { hasText: n });
    // nur A-Rennen
    await expect(row('Silvesterlauf')).toHaveCount(0);
    await expect(row('Stadtlauf')).toContainText('in 84 Tagen · Ziel: ankommen');
    await expect(row('Stadtlauf').locator('.spill')).toHaveText('✓ bereit');
    await expect(row('Spandauer HM')).toContainText('längster Lauf 14/16 km · Ziel 2:05:00 · Prognose 1:52:32');
    await expect(row('Spandauer HM').locator('.spill')).toHaveText('noch nicht');
    // Marathon: weder schaffen noch Zielzeit (4:15 Ziel, Prognose aus 10 km ≈ 3:56 → Zeit passt, aber Longrun/Umfang fehlen)
    await expect(row('Berlin')).toContainText('längster Lauf 14/28 km · Ø 31/40 km pro Woche');
    // Erfolge: eingeklappt, sichtbar der neueste
    await expect(card.locator('#badges')).not.toHaveAttribute('open', '');
    await expect(card.locator('#badges summary')).toContainText('★ Neu: 10 km ready');
    await expect(card.locator('#badges summary')).toContainText('2 Erfolge');
    await card.locator('#badges summary').click();
    await expect(card.locator('.sbadge.got')).toHaveCount(3); // Kopf + 5 km + 10 km
    await expect(card.locator('.sbadgehint')).toHaveText('Für Halbmarathon ready: Lauf ≥ 16 km in 6 Wochen, Ø 25 km pro Woche.');
    // ein 17-km-Lauf: HM ist zu schaffen und die Prognose passt → bereit, neuer Erfolg
    await page.evaluate(() => { runLog.push({ id: 'x', date: '2026-11-07', km: 17, kind: 'long' }); persistRunLog(); renderStart(); });
    await expect(row('Spandauer HM').locator('.spill')).toHaveText('✓ bereit');
    await expect(card.locator('#badges summary')).toContainText('★ Neu: Halbmarathon ready');
    // mit Zielzeit, die die Form nicht hergibt: noch nicht
    await page.evaluate(() => { races[2].goal = 6000; persistRaces(); renderStart(); });
    await expect(row('Spandauer HM')).toContainText('Ziel 1:40:00 · Prognose 1:52:32');
    await expect(row('Spandauer HM').locator('.spill')).toHaveText('noch nicht');
    // Erfolge bleiben, auch wenn der Stand später sinkt
    await page.evaluate(() => { runLog = []; persistRunLog(); renderStart(); });
    await expect(card.locator('#badges summary')).toContainText('3 Erfolge');
    // ohne Laufen-Bereich keine Karte
    await page.evaluate(() => { profile.modules = { kraft: true, laufen: false, mobility: true }; persistProfile(); renderAll(); renderStart(); });
    await expect(page.locator('#readycard')).toHaveCount(0);
  });
});

test('Heute tauschen: „Heute stattdessen …“ – Kraft zu Hause statt Kurs (Plan wählbar), locker laufen, Mobility, Ruhetag, zurücknehmen', async ({ page }) => {
  const wd = await page.evaluate(() => new Date().getDay());
  await page.evaluate(wd => {
    const next = (wd + 1) % 7, other = (wd + 3) % 7;
    races = [{ id: 'a', name: 'A', date: addDays(localDay(), 100), dist: 'hm', prio: 'A' }]; results = []; persistRaces();
    Object.assign(profile.week, { group: null, quality: next, long: (wd + 5) % 7, extras: [], strength: [wd, other], strengthPlan: { [wd]: 'gym' }, gymNames: { [wd]: 'Hyrox' }, gymHard: [wd], mobility: [] });
    persistProfile(); renderAll(); showArea('start');
  }, wd);
  const card = page.locator('#startcontent .scard', { hasText: 'Heute dran' });
  await expect(card).toContainText('Kurs · Hyrox');
  const qualTomorrow = () => page.evaluate(wd => { const it = weekSchedule(seasonPlan().weeks[0]).find(o => o.kind === 'quality' && o.d === (wd + 1) % 7); return it ? !!it.easy : null; }, wd);
  const before = await qualTomorrow(); if (before !== null) expect(before).toBe(true);
  // Auswahl öffnen: Locker laufen, Kraft (mit Plan), Mobility, Ruhetag
  await card.locator('[data-swapopen]').click();
  await expect(card.locator('[data-swap]')).toHaveText(['Locker laufen', 'Intervall/Tempo', 'Kraft', 'Mobility', 'Ruhetag']);
  await page.selectOption('#swapplan', 'run');
  await card.locator('[data-swap="kraft"]').click();
  await expect(card).toContainText('Kraft · Läufer');
  await expect(card).toContainText('heute statt Hyrox');
  await expect(card).not.toContainText('Kurs · Hyrox');
  await expect(card.locator('[data-startact="kraft"][data-startplan="run"]')).toHaveCount(1);
  if (before !== null) expect(await qualTomorrow()).toBe(false); // kein harter Kurs mehr am Vortag
  await expect(page.locator('.sweek')).toContainText('0 von 2'); // Kraft bleibt Kraft
  // bleibt nach dem Neuladen, steht im Backup
  await page.reload();
  await expect(page.locator('#startcontent .scard', { hasText: 'Heute dran' })).toContainText('heute statt Hyrox');
  expect(await page.evaluate(() => JSON.parse(backupJson()).daySwap[localDay()])).toEqual({ from: `strength-${new Date().getDay()}`, to: 'kraft', plan: 'run' });
  // zurücknehmen, dann locker laufen
  await page.locator('[data-swapundo]').click();
  await expect(card).toContainText('Kurs · Hyrox');
  await card.locator('[data-swapopen]').click(); await card.locator('[data-swap="run"]').click();
  await expect(card).toContainText('Locker laufen');
  await expect(card.locator('[data-logtoday="swap"]')).toHaveCount(1);
  await expect(page.locator('.sweek')).toContainText('0 von 1'); // Kurs fällt aus
  // Mobility und Ruhetag
  await page.locator('[data-swapundo]').click();
  await card.locator('[data-swapopen]').click(); await card.locator('[data-swap="mob"]').click();
  await expect(card).toContainText('Mobility ·'); await expect(card.locator('[data-startmob]')).toHaveCount(1);
  await page.locator('[data-swapundo]').click();
  await card.locator('[data-swapopen]').click(); await card.locator('[data-swap="rest"]').click();
  await expect(card).toContainText('Ruhetag'); await expect(card).toContainText('heute statt Hyrox');
  // Abbrechen schließt die Auswahl
  await page.locator('[data-swapundo]').click();
  await card.locator('[data-swapopen]').click(); await card.locator('[data-swapclose]').click();
  await expect(card.locator('[data-swap]')).toHaveCount(0);
  // Lauf statt: Laufgruppe → Kraft (ohne „Locker laufen“, ist schon locker)
  await page.evaluate(wd => { Object.assign(profile.week, { group: wd, strength: [(wd + 3) % 7], strengthPlan: {}, gymNames: {}, gymHard: [] }); persistProfile(); renderAll(); showArea('start'); }, wd);
  await expect(card).toContainText('Laufgruppe');
  await card.locator('[data-swapopen]').click();
  await expect(card.locator('[data-swap]')).toHaveText(['Intervall/Tempo', 'Kraft', 'Mobility', 'Ruhetag']);
  await card.locator('[data-swap="kraft"]').click();
  await expect(card).toContainText('heute statt Laufgruppe');
  // ein Tausch von gestern wirkt nicht auf heute
  await page.evaluate(() => { setSwap(addDays(localDay(), -1), { from: 'group', to: 'kraft' }); setSwap(localDay(), null); renderStart(); });
  await expect(card).toContainText('Laufgruppe');
  await expect(card.locator('[data-swapopen]')).toHaveCount(1);
});

test('Heute zusätzlich: lockerer Lauf, Kraft (Plan wählbar) oder Mobility dazuplanen, nur was heute fehlt; wieder entfernen', async ({ page }) => {
  const wd = await page.evaluate(() => new Date().getDay());
  await page.evaluate(wd => {
    races = [{ id: 'a', name: 'A', date: addDays(localDay(), 100), dist: 'hm', prio: 'A' }]; results = []; persistRaces();
    Object.assign(profile.week, { group: wd, quality: (wd + 2) % 7, long: (wd + 4) % 7, extras: [], strength: [(wd + 3) % 7], strengthPlan: {}, gymNames: {}, gymHard: [], mobility: [] });
    persistProfile(); renderAll(); showArea('start');
  }, wd);
  const card = page.locator('#startcontent .scard', { hasText: 'Heute dran' });
  await expect(card).toContainText('Laufgruppe');
  await card.locator('[data-addopen]').click();
  await expect(card.locator('[data-add]')).toHaveText(['Kraft', 'Mobility']); // Lauf gibt es heute schon
  await page.selectOption('#addplan', 'core');
  await card.locator('[data-add="kraft"]').click();
  await expect(card).toContainText('Laufgruppe');
  await expect(card).toContainText('heute zusätzlich');
  await expect(card.locator('[data-startact="kraft"][data-startplan="core"]')).toHaveCount(1);
  await expect(page.locator('.sweek')).toContainText('0 von 2');
  expect(await page.evaluate(() => JSON.parse(backupJson()).dayAdd[localDay()])).toEqual({ to: 'kraft', plan: 'core' });
  // nur eine Zusatzeinheit pro Tag; entfernen
  await expect(card.locator('[data-addopen]')).toHaveCount(0);
  await card.locator('[data-addundo]').click();
  await expect(card).not.toContainText('heute zusätzlich');
  await expect(page.locator('.sweek')).toContainText('0 von 1');
  // Ruhetag: Lauf dazuplanen erscheint im Wochenplan und lässt sich eintragen
  await page.evaluate(wd => { profile.week.group = null; persistProfile(); renderAll(); showArea('start'); }, wd);
  await expect(card).toContainText('Heute ist nichts geplant');
  await card.locator('[data-addopen]').click();
  await expect(card.locator('[data-add]')).toHaveText(['Locker laufen', 'Kraft', 'Mobility']);
  await card.locator('[data-add="run"]').click();
  await expect(card).toContainText('Locker laufen');
  await expect(card.locator('[data-logtoday="add"]')).toHaveCount(1);
  expect(await page.evaluate(wd => weekSchedule(seasonPlan().weeks[0]).some(o => o.key === 'add' && o.d === wd && o.kind === 'easy'), wd)).toBe(true);
  await card.locator('[data-addundo]').click();
  await card.locator('[data-addopen]').click(); await card.locator('[data-add="mob"]').click();
  await expect(card.locator('[data-startmob]')).toHaveCount(1);
  await expect(card).toContainText('heute zusätzlich');
});

test('Heute tauschen: Laufgruppe fällt aus → Intervall oder Testlauf; die reguläre Qualität später in der Woche wird locker', async ({ page }) => {
  // Montag als „heute“, damit die Qualität (Donnerstag) sicher später in derselben Woche liegt
  await page.evaluate(() => {
    const mon = weekStart(localDay());
    races = [{ id: 'a', name: 'A', date: addDays(mon, 100), dist: 'hm', prio: 'A' }]; results = []; persistRaces();
    runLog.push({ id: 'l1', date: addDays(localDay(), -3), km: 8, kind: 'long' }); persistRunLog();
    Object.assign(profile.week, { group: 1, quality: 4, long: 0, extras: [], strength: [3], strengthPlan: {}, gymNames: {}, gymHard: [], mobility: [] });
    persistProfile();
  });
  const sched = () => page.evaluate(() => { const S = seasonPlan(weekStart(localDay())); return weekSchedule(S.weeks[0]).filter(o => RUN(o) && !o.skip).map(o => [o.d, o.kind, o.title, !!o.easy]); });
  const q0 = (await sched()).find(i => i[0] === 4);
  expect(q0[3]).toBe(false);
  // Tausch am Montag (Laufgruppe) → Qualität
  await page.evaluate(() => setSwap(weekStart(localDay()), { from: 'group', to: 'quality' }));
  const s1 = await sched();
  expect(s1.find(i => i[0] === 1)).toEqual([1, 'quality2', 'Qualität', false]);
  expect(s1.find(i => i[0] === 4)).toEqual([4, 'quality', 'Locker laufen', true]);
  // Testlauf statt Laufgruppe
  await page.evaluate(() => setSwap(weekStart(localDay()), { from: 'group', to: 'test' }));
  const s2 = await sched();
  expect(s2.find(i => i[0] === 1)).toEqual([1, 'quality2', 'Testlauf 5 km', false]);
  expect(s2.find(i => i[0] === 4)[3]).toBe(true);
  // Auswahl heute: Testlauf nur, wenn 5 km schon machbar sind (längster Lauf 8 km)
  await page.evaluate(() => { setSwap(weekStart(localDay()), null); const wd = new Date().getDay(); profile.week.group = wd; profile.week.quality = (wd + 3) % 7; persistProfile(); renderAll(); showArea('start'); });
  const card = page.locator('#startcontent .scard', { hasText: 'Heute dran' });
  await card.locator('[data-swapopen]').click();
  await expect(card.locator('[data-swap]')).toHaveText(['Intervall/Tempo', 'Testlauf 5 km', 'Kraft', 'Mobility', 'Ruhetag']);
  await card.locator('[data-swap="test"]').click();
  await expect(card).toContainText('Testlauf 5 km');
  await expect(card).toContainText('heute statt Laufgruppe');
});
