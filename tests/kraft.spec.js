const { test, expect, forward, closeRating, openSect } = require('./fixtures');

test('lädt ohne Fehler und zeigt alle Kraft-Pläne', async ({ page }) => {
  await expect(page.locator('#tabs button')).toHaveText(['Ganzkörper', 'Tabata', 'AMRAP', 'Läufer', 'Oberkörper', 'Core', 'Finisher', 'Büro']);
  await expect(page.locator('#gearbar [data-gear]')).toHaveCount(3);
});

test('Geräte-Auswahl: ein Gerät → nur dieses Gerät, nichts gewählt → Körpergewicht', async ({ page }) => {
  const result = await page.evaluate(() => {
    const out = {};
    for (const g of ['kb', 'band', 'bw']) {
      gear = { kb: g === 'kb', band: g === 'band', bw: g === 'bw' };
      out[g] = PLAN_ORDER.filter(pk => !PLANS[pk].kbOnly && !PLANS[pk].vacationOnly).flatMap(pk => exList(pk).map(x => x.g));
    }
    gear = { kb: false, band: false, bw: false }; ensureGear();
    out.none = PLAN_ORDER.filter(pk => !PLANS[pk].kbOnly && !PLANS[pk].vacationOnly).flatMap(pk => exList(pk).map(x => x.g));
    return out;
  });
  for (const g of ['kb', 'band', 'bw']) expect(new Set(result[g])).toEqual(new Set([g]));
  expect(new Set(result.none)).toEqual(new Set(['bw']));
});

test('keine Übung doppelt in einem Plan – bei jeder Geräte-Auswahl', async ({ page }) => {
  const dupes = await page.evaluate(() => {
    const out = [];
    for (let m = 1; m < 8; m++) {
      gear = { kb: !!(m & 1), band: !!(m & 2), bw: !!(m & 4) };
      for (const pk of PLAN_ORDER) {
        const names = exList(pk).map(x => x.name);
        names.forEach((n, i) => { if (names.indexOf(n) !== i) out.push(`${pk} ${JSON.stringify(gear)} ${n}`); });
      }
    }
    return out;
  });
  expect(dupes).toEqual([]);
});

test('Kettlebell: Holzhacker im Ganzkörper-Zirkel, Pullover im Oberkörper', async ({ page }) => {
  const names = await page.evaluate(() => {
    gear = { kb: true, band: true, bw: true };
    const all = [exList('wed').map(x => x.name), exList('sun').map(x => x.name)];
    gear = { kb: true, band: false, bw: false };
    return all.concat([exList('sun').map(x => x.name)]);
  });
  expect(names[0]).toContain('Holzhacker mit Kettlebell');
  expect(names[1]).toContain('Kettlebell-Pullover');
  expect(names[1]).toContain('Liegestütze erhöht');
  expect(names[2]).toEqual(expect.arrayContaining(['Kettlebell-Pullover', 'Squeeze Press am Boden', 'Floor Press']));
});

test('Geräte je Plan: Auswahl gilt nur für diesen Plan, wird gemerkt und abgeglichen', async ({ page }) => {
  const plans = () => page.evaluate(() => ({ cur: plan, wed: planGear('wed'), run: planGear('run'), stored: choices['wed.gear'] || null }));
  await page.evaluate(() => setPlan('wed'));
  await expect(page.locator('#gearbar .lbl').first()).toHaveText('Geräte für Ganzkörper');
  await page.click('[data-gear="band"]');
  await expect(page.locator('#toast')).toContainText('Ganzkörper: Bänder aus');
  let p = await plans();
  expect(p.wed).toEqual({ kb: true, db: true, band: false, bw: true });
  // anderer Plan: unverändert (bisherige Auswahl dieses Geräts)
  expect(p.run).toEqual({ kb: true, db: true, band: true, bw: true });
  // Läufer nur mit Band
  await page.evaluate(() => setPlan('run'));
  await page.click('[data-gear="kb"]'); await page.click('[data-gear="bw"]');
  expect((await plans()).run).toEqual({ kb: false, db: true, band: true, bw: false });
  expect(await page.evaluate(() => exList('run').every(x => ['band', 'bw'].includes(x.g)))).toBe(true);
  await page.reload();
  p = await plans();
  expect([p.wed, p.run]).toEqual([{ kb: true, db: true, band: false, bw: true }, { kb: false, db: true, band: true, bw: false }]);
  // steckt in den Übungs-Einstellungen → wird mit den anderen Geräten abgeglichen
  expect(await page.evaluate(() => [JSON.parse(localStorage.getItem(KEYS.choice))['run.gear'], SYNC_SETTINGS.choices === KEYS.choice])).toEqual([{ kb: false, db: true, band: true, bw: false }, true]);
  // alles aus → Körpergewicht
  await page.click('[data-gear="band"]');
  expect((await plans()).run).toEqual({ kb: false, db: true, band: false, bw: true });
});

test('Zirkel: abhaken, Zeitübung, zurücknehmen, Wiederherstellen, Speichern mit Bewertung', async ({ page }) => {
  await page.click('#btnMain');
  await page.click('#btnNext');
  await expect(page.locator('#btnDone')).toBeVisible();
  // bis zur ersten Zeitübung abhaken
  for (let i = 0; i < 12 && !(await page.locator('#timerwork').isVisible()); i++) await page.click('#btnDone');
  await expect(page.locator('#timerwork')).toBeVisible();
  const before = await page.evaluate(() => completions);
  await page.click('#timedstart');
  await expect(page.locator('#btnDone')).toHaveText('● Zeitübung läuft');
  await page.evaluate(() => { timed.start -= timed.seconds * timed.sides + 1; tick(); });
  expect(await page.evaluate(() => completions)).toBe(before + 1);
  await page.click('#btnUndo');
  expect(await page.evaluate(() => completions)).toBe(before);
  await page.click('#btnDone');

  await page.reload();
  expect(await page.evaluate(() => [plan, phase, completions, running])).toEqual(['wed', 1, before + 1, true]);

  await page.click('#btnNext'); await page.click('#btnNext');
  await expect(page.locator('#btnMain')).toHaveText('💾 Speichern');
  await page.click('#btnMain');
  await expect(page.locator('#rate-title')).toHaveText('Einheit gespeichert');
  await expect(page.locator('#rate-progress')).toContainText('Erste Einheit mit diesem Aufbau');
  await page.fill('#ratenote', 'gut geschlafen');
  await page.click('[data-rpe="7"]'); // ein Tipp auf die Zahl speichert, die Notiz kommt mit
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.total, e.rpe, e.note]).toEqual([before + 1, 7, 'gut geschlafen']);
  expect(await page.evaluate(() => comparable(saved.at(-1)))).toBe(true);
  await expect(page.locator('#statsline')).toContainText('Diese Woche 1');
});

test('Zirkel: neuer Bestwert wird nach dem Speichern gemeldet und im Verlauf markiert', async ({ page }) => {
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 20 }));
  await closeRating(page);
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 25 }));
  await expect(page.locator('#rate-progress')).toContainText('Neuer Bestwert');
  await closeRating(page);
  await page.evaluate(() => { document.querySelector('#fold-history').open = true; });
  await expect(page.locator('#history tr').first()).toContainText('🏆');
  await page.locator('#history [data-rate]').first().click();
  await expect(page.locator('#rate-title')).toHaveText('Einheit bewerten');
});

test('Tabata läuft automatisch durch und speichert nach dem Cooldown', async ({ page }) => {
  await page.click('[data-plan="tabata"]');
  await page.click('#btnMain');
  await forward(page, 4 * 60 + 1);
  expect(await page.evaluate(() => phase)).toBe(1);
  await expect(page.locator('#phase-badge')).toHaveText('Arbeit');
  await forward(page, 21);
  await expect(page.locator('#phase-badge')).toHaveText('Pause');
  await forward(page, await page.evaluate(() => durationSecs() - secNow() + 1));
  expect(await page.evaluate(() => phase)).toBe(2);
  await forward(page, 4 * 60 + 1);
  await expect(page.locator('#rate-progress')).toContainText('Alle 15 Intervalle geschafft');
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.mode, e.total, e.of]).toEqual(['tabata', 15, 15]);
});

test('Tabata als Zirkel: Übung 1, 10 Sek. Pause, Übung 2 … – 3 Runden mit Rundenpause; Ansage nennt die nächste Übung', async ({ page }) => {
  const r = await page.evaluate(() => { const seg = tabataSegments(); return { order: seg.filter(x => x.type === 'work').map(x => x.block).join(''), rounds: [...new Set(seg.map(x => x.round))].join(''),
    types: seg.slice(8, 11).map(x => x.type + x.block), total: seg.at(-1).end, cfg: tabataCfg() }; });
  expect(r.order).toBe('012340123401234');
  expect(r.rounds).toBe('012');
  expect(r.types).toEqual(['work4', 'blockrest4', 'work0']); // nach der 5. Übung die Rundenpause, dann wieder Übung 1
  expect(r.total).toBe(15 * 20 + 12 * 10 + 2 * 60);
  expect(r.cfg).toMatchObject({ rounds: 3, blockRest: 60 });
  // alte Einstellung (6 Runden je Übung) gibt es nicht mehr: Zirkel mit 3 Runden
  await page.evaluate(() => { choices['tabata.cfg'] = { rounds: 6, blockRest: 90 }; });
  expect(await page.evaluate(() => tabataCfg())).toMatchObject({ rounds: 3, blockRest: 90 });
  await page.click('[data-plan="tabata"]');
  await page.click('#btnMain');
  await forward(page, 4 * 60 + 21);
  await expect(page.locator('#phase-badge')).toHaveText('Pause');
  await expect(page.locator('#ringsub')).toContainText('gleich:');
  await expect(page.locator('#stepname')).toHaveText(await page.evaluate(() => tr(exList()[1].name)));
});

test('Tabata: nach drei kompletten Einheiten wird die Steigerung vorgeschlagen', async ({ page }) => {
  await page.click('[data-plan="tabata"]');
  await expect(page.locator('#planhint')).toBeHidden();
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) saved.push({ v: 3, id: 'tb' + i, date: '2026-10-2' + i, plan: 'tabata', mode: 'tabata', total: 15, of: 15, cfg: currentCfg('tabata'), names: exList().map(x => x.name), at: '2026-10-2' + i + 'T10:00:00Z' });
    persistEntries(); renderAll();
  });
  await expect(page.locator('#planhint')).toContainText('bereit für 4 Runden');
  await page.click('#planhintbtn');
  expect(await page.evaluate(() => tabataCfg().rounds)).toBe(4);
  await expect(page.locator('#planhint')).toBeHidden();
});

test('Core: fest mit Kettlebell, egal was bei „Heute dabei“ steht', async ({ page }) => {
  const r = await page.evaluate(() => [1, 2, 4, 7].map(m => { gear = { kb: !!(m & 1), band: !!(m & 2), bw: !!(m & 4) }; return exList('core').map(x => x.g + (x.fallback ? '!' : '')).join(','); }));
  expect(r).toEqual(Array(4).fill('kb,kb,kb'));
  await page.click('[data-gear="kb"]');
  await page.click('[data-plan="core"]');
  await expect(page.locator('#gearbar')).toContainText('Core ist fest mit Kettlebell');
  await expect(page.locator('#gearbar [data-gear]')).toHaveCount(0);
  await expect(page.locator('#worklist .row small').first()).toContainText('Kettlebell 12 kg');
  await expect(page.locator('#worklist')).not.toContainText('Ersatz');
});

test('Core: EMOM läuft automatisch, jede Minute die nächste Übung, Speichern nach dem Cooldown', async ({ page }) => {
  await page.click('[data-plan="core"]');
  await expect(page.locator('#workoutname')).toHaveText('3 Übungen · 15 Min.');
  await page.click('#btnMain');
  await forward(page, 4 * 60 + 1);
  expect(await page.evaluate(() => phase)).toBe(1);
  await expect(page.locator('#phase-badge')).toHaveText('Minute 1/15');
  await expect(page.locator('#stepname')).toHaveText('Clean & Press im halben Kniestand');
  await expect.poll(() => page.evaluate(() => (__spoken.at(-1) || {}).text)).toBe('EMOM, 15 Minuten. Erste Übung: Clean und Press im halben Kniestand, 5 je Seite.');
  await forward(page, 60);
  await expect(page.locator('#phase-badge')).toHaveText('Minute 2/15');
  await expect(page.locator('#stepname')).toHaveText('Pullover im Kniestand');
  await expect.poll(() => page.evaluate(() => (__spoken.at(-1) || {}).text)).toBe('Pullover im Kniestand, 10');
  await forward(page, 120);
  await expect(page.locator('#ringsub')).toHaveText('Runde 2/5 · 5 je Seite');
  await expect.poll(() => page.evaluate(() => (__spoken.at(-1) || {}).text)).toBe('Runde 2. Clean und Press im halben Kniestand, 5 je Seite');
  await forward(page, await page.evaluate(() => durationSecs() - secNow() + 1));
  expect(await page.evaluate(() => phase)).toBe(2);
  await forward(page, 4 * 60 + 1);
  await expect(page.locator('#rate-progress')).toContainText('Alle 15 Minuten geschafft');
  const e = await page.evaluate(() => saved.at(-1));
  expect([e.plan, e.mode, e.total, e.of, e.cfg]).toEqual(['core', 'emom', 15, 15, ['kb:12', 'kb:12', 'kb:12', 'rounds:5']]);
  await closeRating(page);
  await expect(page.locator('#history')).toContainText('15 von 15 Minuten · komplett · 5 Runden');
});

test('Core: nach drei kompletten Einheiten eine Runde mehr vorschlagen', async ({ page }) => {
  await page.click('[data-plan="core"]');
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) saved.push({ v: 3, id: 'c' + i, date: '2026-10-2' + i, plan: 'core', mode: 'emom', total: 15, of: 15, cfg: currentCfg('core'), names: exList('core').map(x => x.name), at: '2026-10-2' + i + 'T10:00:00Z' });
    persistEntries(); renderAll();
  });
  await expect(page.locator('#planhint')).toContainText('bereit für 6 Runden (18 Min.)');
  await page.click('#planhintbtn');
  expect(await page.evaluate(() => [emomCfg().rounds, Math.round(phaseSecs('core', 1) / 60)])).toEqual([6, 18]);
  await expect(page.locator('#planhint')).toBeHidden();
});

test('Läufer: Sätze, EMOM und Hinweis „bereit für mehr“ mit Stufenwechsel', async ({ page }) => {
  await page.click('[data-plan="run"]');
  for (let i = 0; i < 3; i++) await page.fill(`[data-slot="split"][data-idx="${i}"]`, '15');
  for (let i = 0; i < 3; i++) await page.fill(`[data-slot="row"][data-idx="${i}"]`, '12');
  await page.click('#btnMain'); await page.click('#btnNext');
  await page.click('#emomstart');
  await expect(page.locator('#emominfo')).toContainText('Minute 1 von 3');
  await page.fill('[data-slot="swing"][data-idx="0"]', '12');
  await page.click('#btnNext'); await page.click('#btnNext'); await page.click('#btnMain');
  await expect(page.locator('#rate-progress')).toContainText('Split Squat: Nächste Stufe: Split Squat · Tempo 3-1-1');
  await expect(page.locator('#rate-progress')).not.toContainText('Rudern');
  await closeRating(page);
  const e = await page.evaluate(() => saved.at(-1));
  expect(e.sets[0]).toEqual([15, 15, 15]);
  expect(e.total).toBe(45 + 36 + 12);
  await expect(page.locator('.setcard .advice')).toHaveCount(1);
  await page.click('[data-advance="split"]');
  expect(await page.evaluate(() => stageOf('run', PLANS.run.slots[0]))).toBe('Split Squat · Tempo 3-1-1');
  await expect(page.locator('.setcard .advice')).toHaveCount(0);
});

test('Sprachansagen: Phase, Schritte und Übungen – nur mit der Gerätestimme', async ({ page }) => {
  await page.evaluate(() => showArea('profil'));
  await expect(page.locator('#voiceval')).toHaveText('An');
  await expect(page.locator('#voicehint')).toContainText('Anna');
  await page.evaluate(() => showArea('kraft'));
  await page.click('#btnMain');
  await page.waitForTimeout(800);
  await forward(page, await page.evaluate(() => STEPS[plan].warmup[0].end - secNow() + 0.2));
  await page.click('#btnNext');
  await page.waitForTimeout(800);
  await page.click('#btnDone');
  await page.waitForTimeout(100);
  const spoken = await page.evaluate(() => __spoken);
  expect(spoken.every(s => s.voice === 'Anna')).toBe(true);
  const texts = spoken.map(s => s.text);
  expect(texts[0]).toMatch(/^Aufwärmen\. /);
  expect(texts.some(t => /^Zirkel, 21 Minuten\. Erste Übung: /.test(t))).toBe(true);
  expect(texts.at(-1)).toMatch(/, \d/);
});

test.describe('ohne deutsche Gerätestimme', () => {
  test.use({ initScripts: ['window.__voices = [{ name: "Google Deutsch", lang: "de-DE", localService: false, default: true }];'] });
  test('werden Online-Stimmen nicht genutzt', async ({ page }) => {
    await page.evaluate(() => showArea('profil'));
    await expect(page.locator('#voiceval')).toHaveText('Nicht verfügbar');
    await page.evaluate(() => showArea('kraft'));
    await page.click('#btnMain');
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => __spoken.length)).toBe(0);
  });
});

test.describe('iPhone mit Audio Session API', () => {
  test.use({ initScripts: ['navigator.audioSession = { type: "auto" };'] });
  test('„Ton trotz Stummschalter“ schaltet auf playback', async ({ page }) => {
    await page.evaluate(() => showArea('profil'));
    await openSect(page, 'sect-tone');
    await expect(page.locator('#loudrow')).toBeVisible();
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('auto');
    await page.click('#loudrow');
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('playback');
    await page.reload();
    expect(await page.evaluate(() => navigator.audioSession.type)).toBe('playback');
  });
});

test('Plan-Leiste: zweizeilig, wenn nicht alle Pläne in eine Zeile passen; breit oder mit weniger Plänen einzeilig', async ({ page }) => {
  await expect(page.locator('#tabs')).toHaveClass(/wrap/);
  expect(await page.evaluate(() => $('tabs').scrollWidth <= $('tabs').clientWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator('#tabs')).not.toHaveClass(/wrap/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#tabs')).toHaveClass(/wrap/);
  // ohne Kettlebell fallen AMRAP und Core weg – dann passt es in eine Zeile
  await page.evaluate(() => { profile.kit.kb = []; profileChanged('kit'); showArea('kraft'); });
  await expect(page.locator('#tabs button')).toHaveCount(5);
  await expect(page.locator('#tabs')).not.toHaveClass(/wrap/);
});

test('„Du brauchst“: aus den Übungen des Plans – Gewichte, Bänder, Matte, Erhöhung', async ({ page }) => {
  const needs = () => page.locator('#gearbar .needs');
  // Büro mit allen Geräten: Kettlebell, Band, Matte (Hüftheben, Bird Dog, Kindhaltung …)
  await page.evaluate(() => { setPlan('office'); setPlanGear('office', { kb: true, band: true, bw: true }); renderAll(); });
  await expect(needs()).toContainText('Du brauchst:');
  await expect(needs()).toContainText('Kettlebell 12 kg');
  await expect(needs()).toContainText('Matte');
  // nur Körpergewicht: keine Kettlebell, kein Band
  await page.evaluate(() => { setPlanGear('office', { kb: false, band: false, bw: true }); renderAll(); });
  await expect(needs()).not.toContainText('Kettlebell');
  await expect(needs()).not.toContainText('Band');
  // verschiedene Gewichte werden zusammengefasst
  await page.evaluate(() => { profile.kit.kb = [8, 12]; setPlanGear('office', { kb: true, band: false, bw: false }); updateChoice('squat', { kg: 8 }); renderAll(); });
  await expect(needs()).toContainText('Kettlebell 8 + 12 kg');
  // Liegestütze erhöht → Stuhl, Bank oder Sofa
  const sup = await page.evaluate(() => { const pk = Object.keys(PLANS).find(k => PLANS[k].slots.some(sl => Object.values(sl.v).some(v => PREP.support.includes(v[0])))); setPlan(pk); setPlanGear(pk, { kb: false, band: false, bw: true }); renderAll(); return pk; });
  expect(sup).toBeTruthy();
  await expect(needs()).toContainText('Stuhl, Bank oder Sofa');
  // feste Kettlebell-Pläne zeigen es auch
  await page.evaluate(() => { setPlan('core'); renderAll(); });
  await expect(needs()).toContainText('Kettlebell');
  await expect(needs()).toContainText('Matte');
});

test('Urlaub von–bis: alle Pläne nur Körpergewicht, AMRAP/Core weg, dazugeschaltete Geräte nur im Urlaub, danach wieder je Plan', async ({ page }) => {
  const day = n => page.evaluate(d => addDays(localDay(), d), n);
  await page.evaluate(() => { setPlan('wed'); setPlanGear('wed', { kb: true, band: false, bw: true }); setPlan('core'); renderAll(); });
  await page.evaluate(() => showArea('profil'));
  await page.evaluate(() => { const d = document.getElementById('sect-kit'); d.open = true; });
  await page.fill('#vacfrom', await day(-1));
  await page.fill('#vacto', await day(5));
  await expect(page.locator('#toast')).toContainText('nur Körpergewicht');
  expect(await page.evaluate(() => [!!vacation(), planGear('wed'), planGear('run'), planOwned('core'), plan])).toEqual([true, { kb: false, db: false, band: false, bw: true }, { kb: false, db: false, band: false, bw: true }, false, 'wed']);
  await expect(page.locator('#sum-kit')).toContainText('Urlaub');
  await page.evaluate(() => showArea('kraft'));
  await expect(page.locator('#gearbar .lbl').first()).toContainText('Urlaub bis');
  expect(await page.evaluate(() => exList('wed').every(x => x.g === 'bw'))).toBe(true);
  await expect(page.locator('#tabs [data-plan="core"]')).toHaveCount(0);
  // Bänder dazuschalten: gilt nur für den Urlaub, die Ganzkörper-Auswahl bleibt
  await page.click('[data-gear="band"]');
  await expect(page.locator('#toast')).toContainText('Urlaub: Bänder an');
  expect(await page.evaluate(() => [planGear('run').band, choices['wed.gear'], profile.kit.vacation.gear])).toEqual([true, { kb: true, db: false, band: false, bw: true }, { kb: false, db: false, band: true, bw: true }]);
  // nach dem Urlaub: wieder je Plan
  await page.evaluate(() => { profile.kit.vacation.to = addDays(localDay(), -1); persistProfile(); renderAll(); });
  expect(await page.evaluate(() => [vacation(), planGear('wed'), planOwned('core')])).toEqual([null, { kb: true, db: false, band: false, bw: true }, true]);
  // falsche Reihenfolge wird markiert, Löschen entfernt den Urlaub
  await page.evaluate(() => showArea('profil'));
  await page.evaluate(() => { document.getElementById('sect-kit').open = true; });
  await page.fill('#vacfrom', await day(10));
  await page.fill('#vacto', await day(3));
  await expect(page.locator('#vacto')).toHaveAttribute('aria-invalid', 'true');
  await page.click('#vacclear');
  expect(await page.evaluate(() => profile.kit.vacation)).toBe(null);
});

test('Anleitung im Training folgt der aktuellen Übung: „Erledigt – nächste Übung“ im Zirkel, Aufwärmen schaltet mit', async ({ page }) => {
  await page.click('[data-plan="wed"]');
  await page.click('#btnMain');
  // Aufwärmen: Anleitung zum aktuellen Schritt, „Nächste Übung“ springt weiter, Anleitung zieht mit
  await page.click('#stepstatus');
  await expect(page.locator('#guide')).toBeVisible();
  const first = await page.locator('#guide-title').textContent();
  await page.click('#guide-foot [data-gact="step"]');
  await expect(page.locator('#guide-title')).not.toHaveText(first);
  expect(await page.evaluate(() => currentStep().group)).toBe(1);
  await page.click('#guide-close');
  // Zirkel: Anleitung zur aktuellen Übung, Erledigt im Fenster, nächste Übung erscheint ohne Schließen
  await page.click('#btnNext');
  await page.click('#current');
  const names = await page.evaluate(() => exList().map(x => tr(x.name)));
  await expect(page.locator('#guide-title')).toHaveText(names[0]);
  await page.click('#guide-foot [data-gact="done"]');
  await expect(page.locator('#guide')).toBeVisible();
  await expect(page.locator('#guide-title')).toHaveText(names[1]);
  expect(await page.evaluate(() => completions)).toBe(1);
  // außerhalb des Trainings (Übungen & Varianten) kein Weiter-Knopf
  await page.click('#guide-close');
  await expect(page.locator('#guide-foot')).toBeEmpty();
});

test('Kraftübungen nach Position: erst stehend, dann knien/sitzen, zuletzt liegend – innerhalb gleich wie geplant; Vergleich bleibt', async ({ page }) => {
  const r = await page.evaluate(() => { setPlanGear('sun', { kb: false, band: false, bw: true }); const names = exList('sun').map(x => x.name), pose = names.map(poseOf);
    return { names, pose: pose.join(''), sorted: pose.join('') === [...pose].sort().join(''), slotsKept: exList('run').map(x => x.slot.id).join(',') === PLANS.run.slots.map(s => s.id).join(','),
      sig: entrySig({ v: 3, plan: 'wed', cfg: currentCfg('wed').slice().reverse() }) === currentSig('wed') }; });
  expect(r.sorted, r.pose).toBe(true);
  expect(r.pose).toBe('0000022222'); // Oberkörper nur Körpergewicht: Unterarmstütz, Y-T-W, Schwimmer, Dead Bug, Seitstütz ans Ende
  expect(r.names.slice(0, 2)).toEqual(['Liegestütze erhöht', 'Pike-Liegestütze erhöht']);
  expect(r.slotsKept).toBe(true); // Läufer (Sätze) unverändert
  expect(r.sig).toBe(true); // alte Einträge in anderer Reihenfolge bleiben vergleichbar
});

test.describe('Wischen in der Anleitung', () => {
  test.use({ hasTouch: true });
  test('nach links: nächste Übung, nach rechts: vorige (außerhalb des Trainings)', async ({ page }) => {
    await page.evaluate(() => { plan = 'wed'; resetState(); renderAll(); document.querySelector('#fold-settings').open = true; });
    await page.locator('#settings [data-sguide="0"]').click();
    const names = await page.evaluate(() => exList().map(x => tr(x.name)));
    const swipe = (from, to) => page.evaluate(([a, b]) => { const g = document.getElementById('guide'), t = x => new Touch({ identifier: 1, target: g, clientX: x, clientY: 300 });
      g.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(a)], changedTouches: [t(a)] })); g.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(b)] })); }, [from, to]);
    await expect(page.locator('#guide-title')).toHaveText(names[0]);
    await swipe(300, 120);
    await expect(page.locator('#guide-title')).toHaveText(names[1]);
    await swipe(120, 300);
    await expect(page.locator('#guide-title')).toHaveText(names[0]);
  });
});

test('Finisher: Rumpf im Grätschsitz als EMOM, 3 Runden = 12 Min., Runden 2–4 wählbar', async ({ page }) => {
  await page.evaluate(() => { setPlan('sitcore'); renderAll(); });
  expect(await page.evaluate(() => [isEmomPlan(), emomCfg().rounds, Math.round(phaseSecs('sitcore', 1) / 60), exList().map(x => x.name)]))
    .toEqual([true, 3, 12, ['V-Chop im Grätschsitz', 'Lenkrad im Grätschsitz', 'Press-up & Press-out im Sitz', 'Iron Arc im Grätschsitz']]);
  await page.evaluate(() => { document.querySelector('#fold-settings').open = true; });
  await expect(page.locator('[data-icfg="rounds"] option')).toHaveText(['2 Runden · 8 Min.', '3 Runden · 12 Min.', '4 Runden · 16 Min.']);
  await page.selectOption('[data-icfg="rounds"]', '2');
  expect(await page.evaluate(() => Math.round(phaseSecs('sitcore', 1) / 60))).toBe(8);
  // andere EMOM-Pläne behalten ihre Runden (Core: 4–6)
  expect(await page.evaluate(() => [emomCfg('core').rounds, emomRounds('core')])).toEqual([5, [4, 5, 6]]);
});
