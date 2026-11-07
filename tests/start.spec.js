// Startseite „Heute“: beim Öffnen, ohne untere Leiste; Kacheln führen in die Bereiche, in den Bereichen „Start“ statt „Mehr“.
const { test, expect } = require('./fixtures');

test.describe('mit Startseite', () => {
  test.use({ start: true });

  test('öffnet auf der Startseite, ohne Leiste; Kachel führt in den Bereich, „Start“ zurück', async ({ page }) => {
    await expect(page.locator('#area-start')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeHidden();
    await expect(page.locator('#t-start')).toHaveText('Heute');
    await expect(page.locator('#startcontent .stile')).toHaveCount(5);
    await page.click('#startcontent [data-go="laufen"]');
    await expect(page.locator('#area-laufen')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('#tabbar [data-area]')).toHaveCount(5);
    await expect(page.locator('#tabbar [data-area="mehr"]')).toHaveCount(0);
    await page.click('#tabbar [data-area="start"]');
    await expect(page.locator('#area-start')).toBeVisible();
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
    await expect(page.locator('#startcontent [data-go="mobility"]')).toContainText('Nach dem Lauf · heute');
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
  // im Urlaub nur, was ohne Geräte gebraucht wird
  await page.evaluate(() => { profile.kit.vacation = { from: localDay(), to: addDays(localDay(), 3), gear: { kb: false, band: false, bw: true } }; persistProfile(); renderStart(); });
  await expect(row.locator('.sneed')).not.toContainText('Kettlebell');
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
    await expect(page.locator('#startfb .sfbtext')).toContainText('Das Tempo passte, der Puls lag trotzdem über Zone 2');
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
