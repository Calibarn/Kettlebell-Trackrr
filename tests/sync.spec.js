const fs = require('fs');
const { test, expect, openSect } = require('./fixtures');

// Geräte-Sync: zwei getrennte Browser-Profile = zwei Geräte, die Sync-Datei wird von Hand weitergereicht.
async function device(browser) {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true });
  await ctx.addInitScript('window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined;');
  await ctx.addInitScript(`try { if (!localStorage.getItem('jan-kb-notes-v1')) localStorage.setItem('jan-kb-notes-v1', '{"seen":null,"auto":false}'); } catch (e) {}`);
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto('/index.html');
  return page;
}
async function save(page) {
  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-sync');
  await page.click('#syncsave');
  const d = await dl;
  expect(d.suggestedFilename()).toBe('kb-tracker-sync.json');
  return fs.readFileSync(await d.path(), 'utf8');
}
async function load(page, json) {
  const nav = page.waitForEvent('load').catch(() => null);
  await page.setInputFiles('#syncfile', { name: 'kb-tracker-sync.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  return nav;
}
const state = page => page.evaluate(() => ({
  runs: runLog.map(r => [r.date, r.km]).sort(), races: races.map(r => r.name), weights: weights.map(w => w.kg), q: profile.week.quality, dirty: syncMeta.dirty
}));

test('Sync: neue, geänderte und gelöschte Einträge kommen auf dem anderen Gerät an, Neueres wird nicht überschrieben', async ({ page, browser }) => {
  const A = page, B = await device(browser);
  const [d1, d2] = await A.evaluate(() => [addDays(localDay(), -3), addDays(localDay(), -5)]);

  // A legt Daten an und speichert
  await A.evaluate(d => { addRun(d, 10); races = [{ id: 'r1', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces(); profile.week.quality = 4; persistProfile(); }, d1);
  const fileA = await save(A);
  expect(await A.evaluate(() => syncMeta.dirty)).toBe(false);
  await expect(A.locator('#syncstatus')).toContainText('kb-tracker-sync.json');

  // B hatte schon eigene Daten, lädt A's Datei: alles wird zusammengeführt
  await B.evaluate(d => addRun(d, 8), d2);
  await load(B, fileA);
  await expect(B.locator('#toast')).toContainText('Abgeglichen: ');
  let b = await state(B);
  expect(b.runs).toEqual([[d1, 10], [d2, 8]].sort());
  expect(b.races).toEqual(['HM']);
  expect(b.q).toBe(4);
  expect(b.dirty).toBe(true); // B hat einen Lauf, den die Datei nicht kennt

  // B löscht A's Lauf, benennt das Rennen um und speichert
  await B.evaluate(d => { deleteRun(runLog.find(r => r.date === d).id); races[0].name = 'Berliner HM'; persistRaces(); }, d1);
  const fileB = await save(B);

  // A hat inzwischen ein Gewicht eingetragen und lädt B's Datei
  await A.evaluate(() => { weights.push({ date: localDay(), kg: 120.5 }); persistWeight(); });
  await A.waitForTimeout(400);
  await load(A, fileB);
  let a = await state(A);
  expect(a.runs).toEqual([[d2, 8]]);
  expect(a.races).toEqual(['Berliner HM']);
  expect(a.weights).toEqual([120.5]);
  expect(a.dirty).toBe(true);

  // A ändert das Rennen erneut; die alte Datei von B darf das nicht zurückdrehen und den Lauf nicht wiederbeleben
  await A.evaluate(() => { races[0].name = 'Generali Berliner HM'; persistRaces(); });
  await A.waitForTimeout(400);
  await A.evaluate(json => syncApply(json), fileB);
  await A.waitForLoadState();
  a = await state(A);
  expect(a.races).toEqual(['Generali Berliner HM']);
  expect(a.runs).toEqual([[d2, 8]]);

  // Zurück zu B: A's Stand speichern, B lädt → Gewicht und Umbenennung kommen an
  const fileA2 = await save(A);
  await load(B, fileA2);
  b = await state(B);
  expect(b.races).toEqual(['Generali Berliner HM']);
  expect(b.weights).toEqual([120.5]);
  expect(b.runs).toEqual([[d2, 8]]);
  // gleicher Stand erneut geladen: nichts zu tun
  await B.evaluate(json => syncApply(json), fileA2);
  await expect(B.locator('#toast')).toContainText('Schon auf dem gleichen Stand');
  await B.context().close();
});

test('Sync: falsche Datei wird abgelehnt, Speicherort wird je Gerät gemerkt', async ({ page }) => {
  await page.evaluate(() => showArea('mehr'));
  await page.setInputFiles('#syncfile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, entries: [] })) });
  await expect(page.locator('#toast')).toContainText('keine Sync-Datei');
  await openSect(page, 'sect-sync');
  await page.fill('#syncplace', 'iCloud Drive › KB Tracker');
  await page.dispatchEvent('#syncplace', 'change');
  await expect(page.locator('#syncstatus')).toContainText('in iCloud Drive › KB Tracker');
  const file = await save(page);
  expect(JSON.parse(file).kind).toBe('kb-tracker-sync');
  expect(JSON.stringify(JSON.parse(file))).not.toContain('iCloud Drive'); // Speicherort bleibt auf dem Gerät
  await expect(page.locator('#toast')).toContainText('in „iCloud Drive › KB Tracker“');
});
