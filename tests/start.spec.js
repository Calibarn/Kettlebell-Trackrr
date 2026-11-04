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
    // das älteste zuerst
    await expect(page.locator('#startresult b')).toHaveText('Wie lief Wings for Life?');
    await page.fill('#sreskm', '18,4');
    await expect(page.locator('#sresinfo')).toContainText('Catcher Car bei km 18,4 nach 1:44:38');
    await page.click('[data-ressave="w"]');
    expect(await page.evaluate(() => results.map(r => [r.race, r.dist, r.km, r.time]))).toEqual([['w', null, 18.4, 6278]]);
    await expect(page.locator('#startresult b')).toHaveText(/Wie lief (Pace Race|Stadtlauf)\?/);
    const next = await page.locator('#startresult [data-ressave]').getAttribute('data-ressave');
    if (next === 'x') { await page.click('[data-resdns="x"]'); }
    await expect(page.locator('#startresult b')).toHaveText('Wie lief Pace Race?');
    await page.fill('#sreslevel', '30');
    await page.click('[data-ressave="p"]');
    await expect(page.locator('#sreslevel')).toHaveAttribute('aria-invalid', 'true');
    await page.fill('#sreslevel', '11,753');
    await page.click('[data-ressave="p"]');
    if (next !== 'x') await page.click('[data-resdns="x"]');
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
    await expect(page.locator('#startrun b')).toHaveText('Gestern · Laufgruppe');
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
    await expect(page.locator('#startrun b')).toHaveText('Gestern · Longrun');
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
    await expect(page.locator('#startresult .srowt b')).toHaveText('Wie lief Herbstlauf?');
    await expect(page.locator('#startmore summary')).toContainText('2 weitere offen');
    await expect(page.locator('#startrun-1')).toBeHidden(); // eingeklappt
    await page.click('#startmore summary');
    await expect(page.locator('#startmore .sres .srowt b')).toHaveText([/Longrun/, /Longrun/]);
    // eintragen im eingeklappten Bereich: bleibt aufgeklappt, der Lauf zählt
    await page.fill('#srunkm-1', '14');
    await page.click('#startrun-1 [data-runsave]');
    expect(await page.evaluate(() => runLog.map(r => r.km))).toEqual([14]);
    await expect(page.locator('#startmore')).toHaveAttribute('open', '');
    await expect(page.locator('#startmore .sres')).toHaveCount(1);
    // nach dem Neuladen immer noch da (keine Frist)
    await page.reload(); await page.evaluate(() => showArea('start'));
    await expect(page.locator('#startresult .srowt b')).toHaveText('Wie lief Herbstlauf?');
    await page.click('[data-resdns="alt"]');
    await expect(page.locator('#startrun .srowt b')).toContainText('Longrun');
    await page.click('[data-runskip]');
    await expect(page.locator('#startcontent .sres')).toHaveCount(0);
    expect(await page.evaluate(() => load(KEYS.runask, null))).toBe(await d(0));
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
