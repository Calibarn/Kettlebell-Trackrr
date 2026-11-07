const { test, expect } = require('./fixtures');

async function openMob(page, tab, sub) {
  await page.evaluate(() => showArea('mobility'));
  await page.click(`[data-mobtab="${tab}"]`);
  await page.click(`[data-mobsub="${sub}"]`);
}

test('jede Kraftübung hat für jede Geräte-Auswahl eine Anleitung mit Skizze', async ({ page }) => {
  const problems = await page.evaluate(() => {
    // mit Kurzhanteln im Profil; dazu der Split Squat als Bulgarian (eigene Skizze je Gerät)
    profile.kit.db = [8]; stages['run.split'] = 'Bulgarian Split Squat';
    const out = [], combos = [{ kb: true, band: true, bw: true }, { kb: true, band: false, bw: false }, { kb: false, band: true, bw: false }, { kb: false, band: false, bw: true }, { kb: true, band: false, bw: true },
      { kb: false, db: true, band: false, bw: false }, { kb: true, db: true, band: true, bw: true }];
    for (const pk of PLAN_ORDER) for (const g of combos) {
      gear = g; plan = pk; runReps = emptyReps(pk); renderAll();
      exList().forEach((x, i) => {
        openExerciseGuide(i);
        if (!$('guide-title').textContent || document.querySelectorAll('#guide-body svg').length !== 1) out.push(`${pk} ${JSON.stringify(g)} ${x.name}`);
        guide.close();
      });
      for (const type of ['warmup', 'cooldown']) for (const [, name] of PLANS[pk][type]) {
        openGuide(name, 'bw');
        if (document.querySelectorAll('#guide-body svg').length !== 1) out.push(`${pk} ${type} ${name}`);
        guide.close();
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test('Aufwärmen und Cooldown brauchen kein Gerät (außer im reinen Kettlebell-Plan) und füllen die Phasen genau aus', async ({ page }) => {
  const problems = await page.evaluate(() => {
    const out = [], sec = l => { const m = l.match(/^(\d+):(\d+)(?:\s*×\s*(\d+))?/); return (Number(m[1]) * 60 + Number(m[2])) * Number(m[3] || 1); };
    for (const pk of PLAN_ORDER) {
      const p = PLANS[pk];
      for (const [type, i] of [['warmup', 0], ['cooldown', 2]]) {
        if (p[type].reduce((a, x) => a + sec(x[0]), 0) !== p.durations[i] * 60) out.push(`${pk} ${type}: Dauer passt nicht`);
        if (!p.kbOnly) for (const [, n] of p[type]) if (/Kettlebell|Kugel|mit Band|Halo/.test(n)) out.push(`${pk} ${type}: ${n} braucht ein Gerät`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test('Laufen und Mobility: jede antippbare Übung hat Anleitung und Skizze', async ({ page }) => {
  const problems = await page.evaluate(() => {
    const out = [], names = new Set();
    for (const t of ['race', 'training']) for (const r of RUN_GUIDE[t]) for (const s of [...r.warmup, ...r.cooldown]) names.add(s[1]);
    for (const s of RUN_GUIDE.abc.drills) names.add(s[1]);
    for (const r of MOBILITY.routines) for (const s of r.steps) names.add(s[1]);
    for (const g of MOBILITY.groups) for (const s of g.items) names.add(s[1]);
    for (const n of names) {
      if (!GUIDES[n]) continue; // z. B. „Trinken & Essen“ ist bewusst keine Übung
      openGuide(n, 'bw');
      if (document.querySelectorAll('#guide-body svg').length !== 1) out.push(n);
      guide.close();
    }
    for (const r of MOBILITY.routines) for (const s of r.steps) if (!GUIDES[s[1]]) out.push('Mobility ohne Anleitung: ' + s[1]);
    return out;
  });
  expect(problems).toEqual([]);
});

test('Mobility-Reiter: jedes Programm und jeder Körperbereich erreichbar, Auswahl wird gemerkt', async ({ page }) => {
  await page.evaluate(() => showArea('mobility'));
  await expect(page.locator('#mobtabs button')).toHaveText(['Läufer', 'Alltag', 'Übungen']);
  await expect(page.locator('#mobsub button')).toHaveText(['Nach dem Lauf', 'Hüfte', 'Sprunggelenk']);
  const all = await page.evaluate(() => [MOBILITY.routines.map(r => [r.tab, r.id, r.steps.length]), MOBILITY.regions.map(([id]) => [id, MOBILITY.groups.filter(g => g.region === id).reduce((n, g) => n + g.items.length, 0)])]);
  for (const [tab, id, n] of all[0]) {
    await openMob(page, tab, id);
    await expect(page.locator('#mobcontent [data-mob]')).toHaveCount(1);
    await expect(page.locator('#mobcontent .row[data-guide-name]')).toHaveCount(n);
  }
  for (const [id, n] of all[1]) {
    await openMob(page, 'uebungen', id);
    await expect(page.locator('#mobcontent [data-mob]')).toHaveCount(0);
    await expect(page.locator('#mobcontent .row[data-guide-name]')).toHaveCount(n);
  }
  await openMob(page, 'uebungen', 'huefte');
  await expect(page.locator('#mobcontent .header')).toHaveText(['Dehnen & mobilisieren', 'Aktiv & stark']);
  await page.reload();
  await page.evaluate(() => showArea('mobility'));
  await expect(page.locator('#mobtabs [aria-selected="true"]')).toHaveText('Übungen');
  await expect(page.locator('#mobsub [aria-selected="true"]')).toHaveText('Hüfte');
  await page.locator('#mobcontent [data-guide-name="Copenhagen Hip Dips"]').click();
  await expect(page.locator('#guide-title')).toHaveText('Copenhagen Hip Dips');
});

test('geführte Mobility-Routine: Countdown, Seitenwechsel, Pause, Ende', async ({ page }) => {
  await openMob(page, 'laeufer', 'nachlauf');
  await page.click('[data-mob="2"]');
  await expect(page.locator('#routine')).toBeVisible();
  await expect(page.locator('#rt-count')).toHaveText('Schritt 1 von 6');
  await expect(page.locator('#rt-name')).toHaveText('Wadendehnung');
  await expect(page.locator('#rt-side')).toHaveText('Linke Seite');
  await expect(page.locator('#rt-fig svg')).toHaveCount(1);
  const spoken = () => page.evaluate(() => __spoken.map(s => s.text));
  await expect.poll(spoken).toEqual(['Mobility, Nach dem Laufen. Wadendehnung, 45 Sekunden je Seite, links beginnen']);
  await page.evaluate(() => { rt.since -= 45.5 * 1000; routineTick(); });
  await expect(page.locator('#rt-side')).toHaveText('Rechte Seite');
  await expect.poll(spoken).toContain('Seitenwechsel');
  await page.evaluate(() => { rt.since -= 45 * 1000; routineTick(); });
  await expect(page.locator('#rt-name')).toHaveText('Hüftbeuger-Dehnung');
  await page.click('#rt-main');
  await expect(page.locator('#rt-main')).toHaveText('▶ Weiter');
  await page.click('#rt-main');
  await page.click('#rt-prev');
  await expect(page.locator('#rt-name')).toHaveText('Wadendehnung');
  for (let i = 0; i < 6; i++) await page.click('#rt-next');
  await expect(page.locator('#rt-name')).toHaveText('Geschafft!');
  await page.click('#rt-main');
  await expect(page.locator('#routine')).toBeHidden();
  await expect.poll(() => page.evaluate(() => rt)).toBeNull(); // „close“ kommt asynchron
});

test('Hüfte für Läufer und Sprunggelenk: Seiten, Zeiten und Abhaken', async ({ page }) => {
  const idx = await page.evaluate(() => ['Hüfte für Läufer', 'Sprunggelenk'].map(t => MOBILITY.routines.findIndex(r => r.title === t)));
  await openMob(page, 'laeufer', 'huefte');
  await page.click(`[data-mob="${idx[0]}"]`);
  expect(await page.evaluate(() => rt.steps.map(s => [s.name, s.secs, s.sides]))).toEqual([
    ['Hüft-CARs', 60, 2], ['Beinheben im Sitzen', 30, 2], ['Beinüberheben im Sitzen', 30, 2], ['Knieheben im Stand', 30, 2], ['90/90 mit Aufrichten', 90, 1], ['Copenhagen Hip Dips', null, 2]]);
  await expect(page.locator('#rt-fig svg')).toHaveCount(1);
  for (let i = 0; i < 5; i++) await page.click('#rt-next');
  await expect(page.locator('#rt-name')).toHaveText('Copenhagen Hip Dips');
  await expect(page.locator('#rt-main')).toHaveText('✓ Erledigt');
  await page.click('#rt-close');
  await expect.poll(() => page.evaluate(() => rt)).toBeNull();
  await openMob(page, 'laeufer', 'sprung');
  await page.click(`[data-mob="${idx[1]}"]`);
  expect(await page.evaluate(() => rt.steps.map(s => [s.name, s.secs, s.sides]))).toEqual([
    ['Fußgelenkkreisen', 30, 2], ['Sprunggelenk mit Kettlebell', 45, 2], ['Soleus-Dehnung', 45, 2], ['Schienbeinheben', 60, 1], ['Einbeinstand', 30, 2]]);
  await page.click('#rt-close');
});

test('geführtes Lauf-Warm-up: Zeitschritte automatisch, Strecken zum Abhaken, +1 Min.', async ({ page }) => {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="warmup"]');
  await page.click('[data-runsub="5k"]');
  await page.click('[data-routine="warmup"]');
  const steps = await page.evaluate(() => rt.steps.map(s => [s.name, s.secs, s.sides]));
  expect(steps[0]).toEqual(['Einlaufen', 600, 1]);
  expect(steps.find(s => s[0] === 'Skippings')[1]).toBeNull();
  expect(steps.find(s => s[0] === 'Warm halten')[1]).toBeNull();
  await expect(page.locator('#rt-plus')).toBeVisible();
  await page.click('#rt-plus');
  expect(await page.evaluate(() => Math.round(rtRemaining()))).toBeGreaterThan(655);
  for (let i = 0; i < 4; i++) await page.click('#rt-next');
  await expect(page.locator('#rt-name')).toHaveText('Skippings');
  await expect(page.locator('#rt-main')).toHaveText('✓ Erledigt');
  await expect(page.locator('#rt-clock')).toBeHidden();
  await page.click('#rt-main');
  await expect(page.locator('#rt-name')).toHaveText('Kniehebelauf');
  await page.click('#rt-close');
  await expect(page.locator('#routine')).toBeHidden();
});

test('Cooldown mit Essen: nicht-Übungen werden abgehakt, Dehnungen je Seite', async ({ page }) => {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="warmup"]');
  await page.click('[data-runsub="long"]');
  await page.click('[data-routine="cooldown"]');
  const steps = await page.evaluate(() => rt.steps.map(s => [s.name, s.secs, s.sides]));
  expect(steps).toEqual([['Locker gehen', 300, 1], ['Trinken & Essen', null, 1], ['Wadendehnung', 45, 2], ['Hüftbeuger-Dehnung', 45, 2], ['Vorderer Oberschenkel', 30, 2], ['Figure-4 Gesäß', 30, 2]]);
  await page.click('#rt-close');
});

test('Routine pausiert ein laufendes Kraft-Training', async ({ page }) => {
  await page.click('#btnMain');
  expect(await page.evaluate(() => running)).toBe(true);
  await openMob(page, 'alltag', 'morgens');
  await page.click('[data-mob="0"]');
  expect(await page.evaluate(() => [running, !!rt])).toEqual([false, true]);
  await page.click('#rt-close');
});
