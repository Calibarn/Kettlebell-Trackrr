const fs = require('fs');
const { test, expect, openSect } = require('./fixtures');

// Geräte-Sync: zwei getrennte Browser-Profile = zwei Geräte, die Sync-Datei wird von Hand weitergereicht.
async function device(browser) {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true });
  await ctx.addInitScript('window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; window.__kbtNoSetup = true;');
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

test('Sync: geht die Uhr eines Geräts vor, gewinnt eine spätere Änderung auf dem anderen Gerät trotzdem', async ({ browser }) => {
  const a = await device(browser), b = await device(browser);
  await b.evaluate(() => { const n = Date.now; Date.now = () => n() + 86400000; }); // Gerät B: Uhr einen Tag vor
  await b.evaluate(() => { profile.week.quality = 3; persistProfile(); });
  await load(a, await save(b));
  expect(await a.evaluate(() => profile.week.quality)).toBe(3);
  await a.evaluate(() => { profile.week.quality = 5; persistProfile(); }); // später, aber mit richtiger Uhr
  await load(b, await save(a));
  expect(await b.evaluate(() => profile.week.quality)).toBe(5);
  await a.context().close(); await b.context().close();
});

test('Sync-Ort: nach dem ersten Speichern fragt die App danach, die Sicherungs-Erinnerung nennt ihn und speichert die Sync-Datei', async ({ browser }) => {
  const page = await device(browser);
  await page.evaluate(() => { saveSession(localDay(), { manual: true, total: 10 }); document.querySelectorAll('dialog[open]').forEach(d => d.close()); });
  await page.evaluate(() => showArea('mehr'));
  await openSect(page, 'sect-sync');
  const dl = page.waitForEvent('download');
  await page.click('#syncsave'); await dl;
  await expect(page.locator('#toast')).toContainText('Wohin hast du sie gelegt?');
  await expect(page.locator('#syncplace')).toBeFocused();
  await page.fill('#syncplace', 'iCloud Drive/Tagwerk'); await page.dispatchEvent('#syncplace', 'change');
  // Erinnerung fällig (letzte Sicherung vor 3 Wochen)
  await page.evaluate(() => { store(KEYS.backup, addDays(localDay(), -21)); renderBackupBanner(); showArea('kraft'); });
  await expect(page.locator('#banners')).toContainText('Sync-Datei speichern nach „iCloud Drive/Tagwerk“');
  const dl2 = page.waitForEvent('download');
  await page.click('#syncnow');
  expect((await dl2).suggestedFilename()).toBe('kb-tracker-sync.json');
  await expect(page.locator('#banners')).not.toContainText('Sync-Datei speichern');
  await page.context().close();
});

test('Sync-Datei enthält alles: Mobility, Kurs-Tage, Geräte-Auswahl, Erfolge (je Strecke das früheste Datum)', async ({ browser }) => {
  const A = await device(browser), B = await device(browser);
  await A.evaluate(() => {
    putMobLog([{ d: addDays(localDay(), -2), t: 'Hüfte für Läufer' }]); putGymLog([{ d: addDays(localDay(), -1), n: 'Blaze' }]);
    gear = { kb: true, db: false, band: false, bw: true }; store(KEYS.gear, gear);
    store(KEYS.badges, { '5k': '2026-10-01', '10k': '2026-11-01' });
  });
  await A.waitForTimeout(400);
  const file = await save(A), j = JSON.parse(file);
  expect(Object.keys(j.colls)).toEqual(expect.arrayContaining(['moblog', 'gymlog']));
  expect(Object.keys(j.settings)).toEqual(expect.arrayContaining(['gear', 'badges']));
  // B hat 10 km später erreicht und HM schon: zusammengeführt mit dem jeweils früheren Datum
  await B.evaluate(() => { putMobLog([{ d: addDays(localDay(), -3), t: 'Mobility am Schreibtisch' }]); store(KEYS.badges, { '10k': '2026-11-05', hm: '2026-11-06' }); });
  await B.waitForTimeout(400);
  await load(B, file);
  expect(await B.evaluate(() => [getMobLog().map(e => e.t), getGymLog().map(e => e.n), gear.band, load(KEYS.badges, {})])).toEqual([
    ['Mobility am Schreibtisch', 'Hüfte für Läufer'], ['Blaze'], false, { '5k': '2026-10-01', '10k': '2026-11-01', hm: '2026-11-06' }]);
  await A.context().close(); await B.context().close();
});

// Automatisch abgleichen: nachgebauter Datei-Griff (Chrome/Edge bzw. Chrome auf Android), die „Cloud-Datei“ liegt im sessionStorage
// und wird zwischen den Geräten von Hand weitergereicht – wie es der Cloud-Dienst täte.
async function autoDevice(browser) {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await ctx.addInitScript(`window.__kbtNoSetup = true;
    try { if (!localStorage.getItem('jan-kb-notes-v1')) localStorage.setItem('jan-kb-notes-v1', '{"seen":null,"auto":false}'); } catch (e) {}
    window.__kbtHandle = { name: 'kb-tracker-sync.json',
      queryPermission: async () => sessionStorage.getItem('perm') || 'granted', requestPermission: async () => { sessionStorage.setItem('perm', 'granted'); return 'granted'; },
      getFile: async () => ({ text: async () => sessionStorage.getItem('cloud') || '' }),
      createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => { sessionStorage.setItem('cloud', buf); } }; } };
    window.showSaveFilePicker = async () => window.__kbtHandle; window.showOpenFilePicker = async () => [window.__kbtHandle];`);
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto('/index.html');
  return page;
}
const cloud = p => p.evaluate(() => sessionStorage.getItem('cloud') || '');
const toCloud = (p, text) => p.evaluate(t => sessionStorage.setItem('cloud', t), text);

test('Sync automatisch: Haken setzen, Änderungen landen von selbst in der Datei und kommen beim anderen Gerät an; pausiert ohne Zugriff', async ({ browser }) => {
  const A = await autoDevice(browser), B = await autoDevice(browser);
  const d = await A.evaluate(() => addDays(localDay(), -2));
  // A: Haken setzen → Datei wird sofort geschrieben
  await A.evaluate(() => showArea('mehr')); await openSect(A, 'sect-sync');
  await expect(A.locator('#syncauto')).toBeVisible();
  await A.click('#syncauto');
  await expect(A.locator('#syncautoval')).toHaveText('An');
  await expect.poll(() => cloud(A)).toContain('kb-tracker-sync');
  // A trägt einen Lauf ein → landet ohne Knopfdruck in der Datei
  await A.evaluate(day => addRun(day, 11), d);
  await expect.poll(() => cloud(A), { timeout: 10000 }).toContain('"km":11');
  // B: Datei aus der „Cloud“, Haken setzen → Lauf kommt an (Seite lädt neu)
  await toCloud(B, await cloud(A));
  await B.evaluate(() => showArea('mehr')); await openSect(B, 'sect-sync');
  const nav = B.waitForEvent('load');
  await B.click('#syncauto');
  await nav;
  expect(await B.evaluate(() => runLog.map(r => r.km))).toEqual([11]);
  // B macht eine Mobility-Routine → in B's Datei; A kehrt in die App zurück (Fokus) → übernimmt sie
  await B.evaluate(() => logMobility('Hüfte für Läufer'));
  await expect.poll(() => cloud(B), { timeout: 10000 }).toContain('Hüfte für Läufer');
  await toCloud(A, await cloud(B));
  const navA = A.waitForEvent('load');
  await A.evaluate(() => window.dispatchEvent(new Event('focus')));
  await navA;
  expect(await A.evaluate(() => getMobLog().map(e => e.t))).toEqual(['Hüfte für Läufer']);
  // Zugriff weg (z. B. nach Browser-Neustart): pausiert, Karte auf der Startseite, „Fortsetzen“ holt ihn zurück
  await A.evaluate(() => { sessionStorage.setItem('perm', 'prompt'); showArea('start'); window.dispatchEvent(new Event('focus')); });
  await expect(A.locator('#syncresume')).toBeVisible();
  await A.click('[data-syncresume]');
  await expect(A.locator('#syncresume')).toHaveCount(0);
  // Haken weg: nichts mehr automatisch
  await A.evaluate(() => showArea('mehr')); await openSect(A, 'sect-sync');
  await A.click('#syncauto');
  await expect(A.locator('#syncautoval')).toHaveText('Aus');
  const before = await cloud(A);
  await A.evaluate(day => addRun(day, 5), d);
  await A.waitForTimeout(3800);
  expect(await cloud(A)).toBe(before);
  await A.context().close(); await B.context().close();
});
