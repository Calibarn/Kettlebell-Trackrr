const { test, expect } = require('./fixtures');

test('jede Kraftübung hat für jede Geräte-Auswahl eine Anleitung mit Skizze', async ({ page }) => {
  const problems = await page.evaluate(() => {
    const out = [], combos = [{ kb: true, band: true, bw: true }, { kb: true, band: false, bw: false }, { kb: false, band: true, bw: false }, { kb: false, band: false, bw: true }, { kb: true, band: false, bw: true }];
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

test('geführte Mobility-Routine: Countdown, Seitenwechsel, Pause, Ende', async ({ page }) => {
  await page.evaluate(() => showArea('mobility'));
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

test('geführtes Lauf-Warm-up: Zeitschritte automatisch, Strecken zum Abhaken, +1 Min.', async ({ page }) => {
  await page.evaluate(() => showArea('laufen'));
  await page.click('[data-runtab="race"]');
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
  await page.click('[data-runtab="training"]');
  await page.click('[data-runsub="long"]');
  await page.click('[data-routine="cooldown"]');
  const steps = await page.evaluate(() => rt.steps.map(s => [s.name, s.secs, s.sides]));
  expect(steps).toEqual([['Locker gehen', 300, 1], ['Trinken & Essen', null, 1], ['Wadendehnung', 45, 2], ['Hüftbeuger-Dehnung', 45, 2], ['Vorderer Oberschenkel', 30, 2], ['Figure-4 Gesäß', 30, 2]]);
  await page.click('#rt-close');
});

test('Routine pausiert ein laufendes Kraft-Training', async ({ page }) => {
  await page.click('#btnMain');
  expect(await page.evaluate(() => running)).toBe(true);
  await page.evaluate(() => showArea('mobility'));
  await page.click('[data-mob="0"]');
  expect(await page.evaluate(() => [running, !!rt])).toEqual([false, true]);
  await page.click('#rt-close');
});
