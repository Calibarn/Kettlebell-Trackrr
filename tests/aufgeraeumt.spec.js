const { test, expect, openSect } = require('./fixtures');

// Aufräum-Update: Warm-up-Reiter, Overlays, Sync als Sicherung, Skizzenfarben, Struktur
test('Laufen: ein Reiter „Warm-up“ mit Renntag und Training; alte Auswahl wird übernommen', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem(KEYS.run, JSON.stringify({ tab: 'training', race: '10k', training: 'long' })));
  await page.reload();
  await page.evaluate(() => showArea('laufen'));
  await expect(page.locator('#runtabs button')).toHaveText(['Plan', 'Warm-up', 'Lauf-ABC', 'Umfang']);
  await expect(page.locator('#runtabs [aria-selected="true"]')).toHaveText('Warm-up');
  await expect(page.locator('#runsub button')).toHaveText(['5 km', '10 km', 'HM', 'Marathon', 'Intervall', 'Speed', 'Longrun']);
  await expect(page.locator('#runsub [aria-selected="true"]')).toHaveText('Longrun');
  await page.click('[data-runsub="hm"]');
  await expect(page.locator('#runcontent .intro')).toContainText('Halbmarathon');
  await page.reload();
  expect(await page.evaluate(() => runView)).toMatchObject({ tab: 'warmup', warmup: 'hm' });
});

test('Overlay offen: Seite dahinter scrollt nicht, beim Schließen geht es an derselben Stelle weiter', async ({ page }) => {
  await page.evaluate(() => showArea('mehr', false));
  await openSect(page, 'sect-guide'); // aufgeklappte Anleitung macht die Seite lang genug
  await page.evaluate(() => window.scrollTo(0, 600));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(300);
  await page.evaluate(() => openNotes(true)); // ohne Klick, damit nichts zum Knopf scrollt
  await expect(page.locator('#notes')).toBeVisible();
  expect(await page.evaluate(() => [document.documentElement.classList.contains('locked'), document.body.style.top])).toEqual([true, `-${y}px`]);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe('fixed');
  await page.click('#notes-close');
  await expect(page.locator('#notes')).toBeHidden();
  expect(await page.evaluate(() => [document.documentElement.classList.contains('locked'), window.scrollY])).toEqual([false, y]);
});

test('Sync speichern zählt als Sicherung; Wiederherstellen erkennt eine Sync-Datei und gleicht ab', async ({ page }) => {
  await page.evaluate(() => { addRun(addDays(localDay(), -2), 10); });
  await page.waitForTimeout(300);
  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-sync');
  await page.click('#syncsave');
  await dl;
  expect(await page.evaluate(() => load(KEYS.backup, null))).toBe(await page.evaluate(() => localDay()));
  const file = await page.evaluate(() => { const p = syncPayload(); p.colls.runlog[0].v = Object.assign({}, p.colls.runlog[0].v, { km: 12.5 }); p.colls.runlog[0].ts = Date.now() + 1000; return JSON.stringify(p); });
  const nav = page.waitForEvent('load');
  await page.setInputFiles('#importfile', { name: 'kb-tracker-sync.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await nav;
  expect(await page.evaluate(() => runLog.map(r => r.km))).toEqual([12.5]); // geändert, nicht doppelt ergänzt
});

test('Skizzen: Frontansicht und Seitenansicht in unterschiedlichen Farben, mit Beschriftung', async ({ page }) => {
  const r = await page.evaluate(() => {
    const box = document.createElement('div'); document.body.append(box);
    box.innerHTML = renderFigure('Armkreisen mit Spannung', 'bw') + renderFigure('Suitcase March', 'kb');
    const [f, sd] = box.querySelectorAll('svg');
    const col = (svg, sel) => getComputedStyle(svg.querySelector(sel)).stroke;
    const out = { front: [...f.querySelectorAll('.fview')].map(t => t.textContent), side: [...sd.querySelectorAll('.fview')].map(t => t.textContent), cf: col(f, '.fn'), cs: col(sd, '.fn') };
    box.remove(); return out;
  });
  expect(r.front.every(t => t === 'vorne')).toBe(true);
  expect(r.side.every(t => t === 'seitlich')).toBe(true);
  expect(r.cf).not.toBe(r.cs);
});

test('Struktur: Wochenübersicht bei Kraft, Hinweise in der Anleitung, Rechenweg bei den Bestzeiten', async ({ page }) => {
  expect(await page.evaluate(() => !!document.querySelector('#area-kraft #weeklist'))).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('#area-mehr .header')].map(h => h.textContent.trim()))).not.toContain('Hinweise');
  await expect(page.locator('#manualguide')).toContainText('Belastung & Technik');
  await expect(page.locator('#manualguide')).toContainText('Laufen & Beschwerden');
  await expect(page.locator('#fold-settings summary')).toContainText('Übungen & Varianten');
  await page.evaluate(() => { results = [{ id: 'x', date: '2026-06-01', km: 10, time: 3305, dist: '10k' }]; persistResults(); showArea('laufen'); runView.tab = 'plan'; runView.plan = 'bestzeiten'; renderRun(); });
  await page.evaluate(() => { document.querySelector('#bestcalc').open = true; });
  await expect(page.locator('#bestcalc')).toContainText('≈ 2:01:32');
  await expect(page.locator('#bestcalc')).toContainText('≈ 4:13:24');
});

test('Neu eingerichtet: Laufen startet auf „Plan“, Körpermaße ist zugeklappt', async ({ page }) => {
  await page.evaluate(() => showArea('laufen'));
  await expect(page.locator('#runtabs [aria-selected="true"]')).toHaveText('Plan');
  await page.evaluate(() => showArea('profil'));
  await expect(page.locator('#sect-measure')).not.toHaveAttribute('open', '');
});
