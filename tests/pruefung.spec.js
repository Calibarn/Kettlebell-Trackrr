// Fehler aus der Prüfung vom 24.11.2026: Datenverlust bei zwei Tabs und beim Zurücksetzen, Intervall-Raster, Wiederholungen, Uhr-Schritte, Android.
const { test, expect, setupQualityToday } = require('./fixtures');

const second = async page => { const p = await page.context().newPage(); await p.addInitScript('window.__kbtNoStart=window.__kbtNoSplash=window.__kbtNoSetup=true;'); await p.goto('/index.html'); return p; };
const stored = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(KEYS[k])), key);

test('Zwei Tabs: jeder speichert einen Lauf – beide bleiben, auch im Sync ohne Löschmarke', async ({ page }) => {
  const b = await second(page);
  const id = await page.evaluate(() => addRun(localDay(), 5).id);
  await b.evaluate(() => addRun(localDay(), 7));
  expect((await stored(page, 'runlog')).map(r => r.km).sort()).toEqual([5, 7]);
  expect(await b.evaluate(() => runLog.map(r => r.km).sort())).toEqual([5, 7]);
  // danach der erste Tab wieder: auch der Lauf des zweiten bleibt
  await page.evaluate(() => addRun(localDay(), 9));
  expect((await stored(page, 'runlog')).map(r => r.km).sort()).toEqual([5, 7, 9]);
  expect(await page.evaluate(i => { syncTrack(); return Object.keys(syncMeta.del).includes('runlog:' + i); }, id)).toBe(false);
});

test('Zwei Tabs: Löschen und Ändern im anderen Tab gelten, eigene Löschung bleibt gelöscht', async ({ page }) => {
  await page.evaluate(() => { weights = [{ date: '2026-01-01', kg: 100 }, { date: '2026-01-02', kg: 101 }, { date: '2026-01-03', kg: 102 }]; persistWeight(); });
  const b = await second(page);
  await page.evaluate(() => { weights = weights.filter(w => w.date !== '2026-01-01'); weights.find(w => w.date === '2026-01-02').kg = 90; persistWeight(); });
  await b.evaluate(() => { weights = weights.filter(w => w.date !== '2026-01-03').concat({ date: '2026-01-04', kg: 103 }); persistWeight(); });
  expect(await stored(page, 'weight')).toEqual([{ date: '2026-01-02', kg: 90 }, { date: '2026-01-04', kg: 103 }]);
});

test('Zwei Tabs: alle Listen werden zusammengeführt', async ({ page }) => {
  const b = await second(page);
  const add = (p, d) => p.evaluate(d => {
    waist.push({ id: 'w' + d, date: d, cm: 90, note: '', at: d + 'T08:00:00Z' }); persistWaist();
    vo2s.push({ date: d, v: 40 }); persistVo2();
    races.push({ id: 'r' + d, name: 'R', date: d, dist: 'hm', prio: 'A', goal: null, km: null }); persistRaces();
    results.push({ id: 'x' + d, date: d, km: 10, time: 3000, dist: '10k' }); persistResults();
    runWeeks.push({ week: weekStart(d), km: 20, long: 10 }); persistRunWeeks();
    saved.push({ id: 'e' + d, plan: 'wed', date: d, total: 5, v: 3, mode: 'sets', sets: [] }); persistEntries();
  }, d);
  await add(page, '2026-03-02'); await add(b, '2026-03-16');
  for (const k of ['waist', 'vo2', 'races', 'results', 'runweeks', 'entries']) expect((await stored(page, k)).length, k).toBe(2);
});

test('Einstellungen zurücksetzen: Sync-Datei gewinnt, nichts Leeres geht an andere Geräte', async ({ page }) => {
  await page.evaluate(() => { profile.kit.kb = [12, 16]; persistProfile(); choices = { 'wed.x': { kg: 16 } }; store(KEYS.choice, choices); });
  const file = await page.evaluate(() => syncPayload());
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => { settingsReset(); }).catch(() => {})]);
  const before = await page.evaluate(() => { const p = syncPayload(); return { kb: profile.kit.kb, settings: Object.entries(p.settings).map(([n, s]) => [n, s.ts]) }; });
  expect(before.kb).toEqual([]);
  // nichts davon ist neuer als der Stand in der Datei
  for (const [n, ts] of before.settings) if (file.settings[n]) expect(ts, n).toBeLessThanOrEqual(file.settings[n].ts);
  const r = await page.evaluate(f => { const res = syncMerge(f); return { res, kb: JSON.parse(localStorage.getItem(KEYS.profile)).kit.kb, dirty: syncMeta.dirty }; }, file);
  expect(r.kb).toEqual([12, 16]);
  expect(r.res.changed).toBe(true);
  expect(r.dirty).toBe(false);
});

test('Einstellungen zurücksetzen: auch eine Sync-Datei mit Zeitstempel 0 gewinnt; eigene Änderungen danach gelten', async ({ page }) => {
  const file = await page.evaluate(() => { profile.kit.kb = [20]; persistProfile(); const f = syncPayload(); f.settings.profile.ts = 0; return f; });
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => { settingsReset(); }).catch(() => {})]);
  expect(await page.evaluate(f => { syncMerge(f); return JSON.parse(localStorage.getItem(KEYS.profile)).kit.kb; }, file)).toEqual([20]);
  await page.reload();
  expect(await page.evaluate(() => { profile.kit.kb = [24]; persistProfile(); return syncPayload().settings.profile; })).toMatchObject({ v: { kit: { kb: [24] } } });
  expect(await page.evaluate(() => syncPayload().settings.profile.ts > 0)).toBe(true);
});

test('Intervall-Raster: unverändert vorbelegt wird nicht gespeichert, ein Wert genügt', async ({ page }) => {
  await setupQualityToday(page);
  const r = await page.evaluate(() => {
    const host = document.createElement('div'); document.body.append(host);
    const read = (plan, reps, edit) => { host.innerHTML = repsHtml('tst', reps, plan, true); if (edit) edit(host); return repsRead('tst'); };
    const set = (f, i, v) => h => { h.querySelectorAll(`[data-f="${f}"]`)[i].value = v; };
    return {
      count: read({ n: 4, sec: 360 }, null, h => { h.querySelector('[data-repn]').value = 3; repsResize('tst'); }), none: read({ n: 4, sec: 360 }), km: read({ n: 12, km: 0.4 }),
      one: read({ n: 2, sec: 360 }, null, set('km', 0, '1,05')), max: read({ n: 2, sec: 360 }, null, set('max', 1, '170')),
      saved: read({ n: 2, sec: 360 }, [{ sec: 360 }, { sec: 360 }])
    };
  });
  expect(r.none).toEqual([]);
  expect(r.count).toEqual([{ sec: 360 }, { sec: 360 }, { sec: 360 }]); // geänderte Anzahl ist eine Angabe
  expect(r.km).toEqual([]);
  expect(r.one).toEqual([{ km: 1.05, sec: 360 }, { sec: 360 }]);
  expect(r.max).toEqual([{ sec: 360 }, { sec: 360, max: 170 }]);
  expect(r.saved).toEqual([{ sec: 360 }, { sec: 360 }]); // gespeicherte Werte bleiben beim Bearbeiten
});

test('Intervall-Raster: anderes Datum holt den Plan des Tages, Eingetragenes bleibt', async ({ page }) => {
  await setupQualityToday(page);
  const day = await page.evaluate(() => addDays(localDay(), -1));
  const res = await page.evaluate(d => {
    const host = document.createElement('div'); document.body.append(host);
    document.querySelectorAll('#runreps,#rundate,#runkind').forEach(e => e.remove());
    host.innerHTML = `<input type="date" id="rundate" value="${localDay()}"><select id="runkind"><option value="quality" selected>q</option></select>` + repsHtml('runreps', null, repPlanOn(localDay()), true);
    const times = () => [...document.querySelectorAll('#runreps [data-f="sec"]')].map(i => i.value);
    const go = v => { $('rundate').value = v; $('rundate').dispatchEvent(new Event('change', { bubbles: true })); };
    const out = { today: times() };
    go(d); out.other = times();
    go(localDay()); out.back = times();
    document.querySelector('#runreps [data-f="km"]').value = '1,1'; go(d); out.kept = times();
    return out;
  }, day);
  expect(res.today).toEqual(['6:00', '6:00', '6:00', '6:00']);
  expect(res.other).toEqual(['', '', '', '']);
  expect(res.back).toEqual(['6:00', '6:00', '6:00', '6:00']);
  expect(res.kept).toEqual(['6:00', '6:00', '6:00', '6:00']);
});

test('Entlastungswoche: auch Bereiche werden ganz gekürzt', async ({ page }) => {
  expect(await page.evaluate(() => ['Probe: 8–10 × 1 km, jeder etwas schneller', '3–4 × 1 km im Renntempo', '5 × 1 km Schwelle', '2 × 5 km im HM-Tempo', 'keine – nur locker'].map(fewerReps))).toEqual([
    { txt: 'Probe: 5–7 × 1 km, jeder etwas schneller', n: '8–10' }, { txt: '2–3 × 1 km im Renntempo', n: '3–4' }, { txt: '3 × 1 km Schwelle', n: 5 }, null, null]);
});

// Uhr: je Sprache dieselben Einheiten
for (const [locale, w] of [
  ['de-DE', { mp: ['Aufwärmen: Strecke 3 km', 'Training: Strecke 8 km, Ziel Tempo 5:25–5:35 /km', 'Cool-down: Offen'], rest: '· Erholung Offen', warm: 'Aufwärmen: Offen – mit Doppeltippen weiter',
    end: ['Training: Strecke 13 km, Ziel Herzfrequenz Zone 2', 'Training: Strecke 5 km, Ziel Tempo 5:15–5:25 /km'], fast: 'Training: Strecke 18 km, ohne Ziel – schneller Teil laut Plan', easy: 'Training: Strecke 18 km, Ziel Herzfrequenz Zone 2',
    ten: ['Training: Offen, Ziel Herzfrequenz Zone 2 – 10 Min. vor Schluss doppeltippen', 'Training: Zeit 10:00 Min., ohne Ziel – zügig'], tenPace: ['Training: Strecke 16 km, Ziel Herzfrequenz Zone 2', 'Training: Zeit 10:00 Min., ohne Ziel – zügig'],
    probe: '8 × wiederholen (Plan 8–10): Training Strecke 1 km, ohne Ziel (nur die letzten 3: 4:45–4:55 /km) · Erholung Zeit 1:00 Min.' }],
  ['en-US', { mp: ['Warm-up: distance 3 km', 'Work: distance 8 km, target pace 5:25–5:35 /km', 'Cooldown: open'], rest: '· recovery open', warm: 'Warm-up: Open – double-tap to move on',
    end: ['Work: distance 13 km, target heart rate Zone 2', 'Work: distance 5 km, target pace 5:15–5:25 /km'], fast: 'Work: distance 18 km, no target – faster part as planned', easy: 'Work: distance 18 km, target heart rate Zone 2',
    ten: ['Work: open, target heart rate Zone 2 – double-tap 10 min before the end', 'Work: time 10:00 min, no target – brisk'], tenPace: ['Work: distance 16 km, target heart rate Zone 2', 'Work: time 10:00 min, no target – brisk'],
    probe: 'Repeat 8 × (plan 8–10): work distance 1 km, no target (only the last 3: 4:45–4:55 /km) · recovery time 1:00 min' }]
]) test.describe(`Uhr ${locale}`, () => {
  test.use({ locale });
  test('Tempolauf, fehlende Pause, Longrun mit schnellem Ende, Pace-Race-Probe', async ({ page }) => {
    const r = await page.evaluate(() => {
      profile.hr.z = null;
      const q = (t, s = '') => watchSteps({ kind: 'quality', title: 'Q', detail: tr(t) + s }), l = (t, s = '', km = 18) => watchSteps({ kind: 'long', title: 'L', km, detail: tr(t) + s });
      const L = SEASON.long, all = v => typeof v === 'string' ? [v] : Object.values(v).flatMap(all);
      return { mp: q('8 km im Marathontempo nach 3 km Einlaufen', ' (5:30 /km)'), none: q('Intervall oder Tempo'), noneEn: watchSteps({ kind: 'quality', title: 'Q', detail: 'Intervals or tempo' }), ctl: watchCtl({ kind: 'quality', title: 'Q', detail: 'Intervall oder Tempo' }),
        rests: ['12 × 400 m etwas schneller als 5-km-Tempo', '2 × 15 Min. Schwelle', '3–4 × 1 km im Renntempo, sonst locker'].map(t => q(t)[1]),
        end: l('die letzten 5–8 km im HM-Tempo, Verpflegung wie im Rennen', ' (5:20 /km)'), short: l('die letzten 5–8 km im HM-Tempo, Verpflegung wie im Rennen', ' (5:20 /km)', 5),
        fast: ['locker, mit 4 × 1 Min. zügig am Ende', '2 × 6–8 km im Marathontempo, Gels wie im Rennen', 'locker, am Ende 3 × 1 km steigernd bis ins Level-Tempo, 60 Sek. Stehpause'].map(t => l(t)),
        ten: l('locker, die letzten 10 Min. zügig'), tenPace: (() => { results = [{ id: 'a', date: addDays(localDay(), -20), km: 10, time: 3000, dist: '10k' }]; return l('locker, die letzten 10 Min. zügig'); })(), tenShort: l('locker, die letzten 10 Min. zügig', '', null),
        easy: ['locker in Zone 2', 'kürzer und locker', 'locker, höchstens 60–75 Min.'].map(t => l(t, ' · 6:20–6:50 /km')),
        probe: q('Probe: 8–10 × 1 km, jeder etwas schneller, die letzten 3 im Level-Tempo, 60 Sek. Stehpause', ' (4:50 /km)')[1],
        // jede Wiederholungs-Einheit hat eine Erholung
        noRest: all(SEASON.key).map(t => tr(t)).filter(t => /×/.test(t)).filter(t => !/Erholung|recovery/.test(q(t)[1])) };
    });
    expect(r.mp).toEqual(w.mp);
    expect([r.none, r.noneEn, r.ctl]).toEqual([null, null, '']);
    for (const t of r.rests) expect(t).toContain(w.rest);
    expect(r.end).toEqual(w.end);
    expect(r.short).toHaveLength(1);
    expect(r.ten).toEqual(w.ten); expect(r.tenPace).toEqual(w.tenPace); expect(r.tenShort).toEqual(w.ten);
    for (const f of r.fast) expect(f).toEqual([w.fast]);
    for (const f of r.easy) expect(f).toEqual([w.easy]);
    expect(r.probe).toBe(w.probe);
    expect(r.noRest).toEqual([]);
  });
});

test('Android: keine Verweise auf den ausgeblendeten Abschnitt Apple Watch, Rennplan-Tipps bleiben', async ({ page }) => {
  const r = await page.evaluate(() => {
    document.documentElement.dataset.os = 'android';
    results = [{ id: 'a', date: addDays(localDay(), -20), km: 10, time: 3300, dist: '10k' }]; persistResults();
    races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 3), dist: 'hm', prio: 'A', goal: 7200, km: null }]; persistRaces();
    vo2s = []; persistVo2();
    const host = document.createElement('div'); host.id = 'tsthost'; document.body.append(host); host.innerHTML = racePlanCard() + progressHtml();
    showArea('profil'); document.getElementById('sect-hr').open = true;
    return [...document.querySelectorAll('[data-watchhelp]')].filter(b => getComputedStyle(b).display !== 'none').length;
  });
  expect(r).toBe(0);
  await expect(page.locator('#tsthost .rpwatch')).toContainText('je Abschnitt eine Distanz und den Tempo-Bereich als Warnung');
  await expect(page.locator('#tsthost .rpwatch')).toContainText('misst meist etwas mehr');
  await expect(page.locator('#sect-hr .footer')).toContainText('Zonen am besten von der Uhr übernehmen.');
});

test('Zwei Tabs: Einstellungen – jeder ändert etwas anderes, beides bleibt', async ({ page }) => {
  await page.evaluate(() => { profile.week.quality = 2; profile.week.long = 0; persistProfile(); choices = { a: { kg: 8 }, b: { kg: 8 } }; store(KEYS.choice, choices); });
  const b = await second(page);
  await page.evaluate(() => { profile.week.quality = 1; profile.hr.rest = 55; persistProfile(); choices.a = { kg: 12 }; delete choices.b; choices.c = { kg: 20 }; store(KEYS.choice, choices); });
  await b.evaluate(() => { profile.week.long = 6; persistProfile(); choices.d = { kg: 24 }; store(KEYS.choice, choices); });
  const p = await stored(page, 'profile');
  expect([p.week.quality, p.week.long, p.hr.rest]).toEqual([1, 6, 55]);
  expect(await b.evaluate(() => [profile.week.quality, profile.week.long, profile.hr.rest])).toEqual([1, 6, 55]);
  expect(await stored(page, 'choice')).toEqual({ a: { kg: 12 }, c: { kg: 20 }, d: { kg: 24 } });
  // beide ändern dasselbe: der zuletzt Speichernde gewinnt
  await page.evaluate(() => { profile.week.quality = 4; persistProfile(); });
  await b.evaluate(() => { profile.week.quality = 5; persistProfile(); });
  expect((await stored(page, 'profile')).week.quality).toBe(5);
});

test('Zurücksetzen, dann Sync speichern: die Datei behält die bisherigen Einstellungen, anderes Gerät bekommt sie', async ({ page }) => {
  const file = await page.evaluate(() => { profile.kit.kb = [12, 16]; persistProfile(); choices = { 'wed.x': { kg: 16 } }; store(KEYS.choice, choices); longSet[weekStart(localDay())] = 14; store(KEYS.longset, longSet); syncTrack(); syncMeta.auto = true; syncSaveMeta(); return syncPayload(); });
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  for (const round of [1, 2]) { // auch ein zweites Zurücksetzen verliert nichts
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => { settingsReset(); }).catch(() => {})]);
    const r = await page.evaluate(() => ({ kb: profile.kit.kb, p: syncPayload(), auto: !!syncMeta.auto, dirty: syncMeta.dirty }));
    expect(r.kb, 'hier zurückgesetzt ' + round).toEqual([]);
    for (const n of ['profile', 'choices', 'longSet']) expect(r.p.settings[n], n).toEqual(file.settings[n]);
    expect(r.auto).toBe(false); // sonst käme das Zurückgesetzte mit dem nächsten Abgleich sofort wieder
  }
  // eine eigene Änderung danach gilt statt des bisherigen Stands
  const own = await page.evaluate(() => { profile.kit.kb = [24]; persistProfile(); return syncPayload().settings; });
  expect(own.profile.v.kit.kb).toEqual([24]);
  expect(own.choices).toEqual(file.settings.choices);
});

test('Intervall-Raster: Hinweis beim Speichern, wenn nur der Plan drinsteht', async ({ page }) => {
  await setupQualityToday(page);
  await page.evaluate(() => { showArea('laufen'); });
  await page.click('[data-runtab="laeufe"]');
  await page.fill('#runkm', '9');
  await page.click('#runaddbtn');
  await expect(page.locator('#toast')).toContainText('Intervalle unverändert vom Plan – nicht gespeichert');
  expect(await page.evaluate(() => runLog[0].reps)).toBeUndefined();
  await page.fill('#runkm', '8');
  await page.locator('#runreps [data-f="km"]').first().fill('1,1');
  await page.click('#runaddbtn');
  await expect(page.locator('#toast')).toContainText('8 km');
  await expect(page.locator('#toast')).not.toContainText('unverändert');
});

test('Neuigkeiten: Eintrag zur aktuellen Version', async ({ page }) => {
  // der neueste Eintrag gehört zur aktuellen Version und hat Inhalt (die Zahl der Punkte hängt vom Tag ab)
  expect(await page.evaluate(() => [CHANGELOG[0].version === APP_VERSION, APP_VERSION !== '1.10', CHANGELOG[0].items.length > 0])).toEqual([true, true, true]);
});
