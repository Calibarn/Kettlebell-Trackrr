const fs = require('fs');
const { test, expect, closeRating, openSect } = require('./fixtures');

const OLD_BACKUP = {
  version: 2,
  entries: [
    { id: 'a', date: '2026-10-01', plan: 'wed', total: 25 },
    { id: 'b', date: '2026-10-08', plan: 'wed', total: 30, exerciseCount: 12, equipment: {} },
    { id: 'd', date: '2026-10-12', plan: 'sun', total: 14 }
  ],
  waist: [{ id: 'w1', date: '2026-10-20', cm: 118.5, note: 'morgens' }, { id: 'w2', date: '2026-10-27', cm: 117.2 }]
};

// Datei direkt aus dem Speicher übergeben (Pfade mit Umlauten liest Chromium bei setInputFiles nicht zuverlässig)
async function importJson(page, data, name = 'backup.json') {
  await page.setInputFiles('#importfile', { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

test('altes Backup importieren, Duplikate überspringen, Sicherung enthält alles', async ({ page }) => {
  await importJson(page, OLD_BACKUP);
  await expect.poll(() => page.evaluate(() => saved.length)).toBe(3);
  await importJson(page, OLD_BACKUP, 'nochmal.json');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [saved.length, waist.length])).toEqual([3, 2]);

  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-data');
  await page.click('#savefile');
  const backup = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
  expect([backup.version, backup.entries.length, backup.waist.length]).toEqual([3, 3, 2]);
  expect(Object.keys(backup.settings)).toEqual(['gear', 'choices', 'stages', 'audio', 'profile']);
});

test('Update-Sicherheit: Unbekanntes bleibt, Unlesbares wird aufbewahrt, Sicherung vor Formatwechsel', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('jan-kettlebell-tracker-v1', JSON.stringify([
      { id: 'b', date: '2026-10-08', plan: 'wed', total: 30, exerciseCount: 12, equipment: {} },
      { id: 'zukunft', date: '2027-01-01', plan: 'yoga', total: 5, neu: true }
    ]));
    localStorage.setItem('jan-kb-waist-v1', '{kaputt');
  });
  await page.reload();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(k => k.startsWith('jan-kb-waist-v1-unlesbar-'))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jan-kb-sicherung-vor-update')).json.includes('zukunft'))).toBe(true);
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 20 }));
  await closeRating(page);
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-kettlebell-tracker-v1')));
  expect(raw.map(e => e.id)).toContain('zukunft');
  expect(raw).toHaveLength(3);
  await page.evaluate(() => showArea('mehr'));
  await openSect(page, 'sect-data');
  await expect(page.locator('#preupdate')).toBeVisible();
});

test('CSV enthält Anstrengung und Notiz, Formeln werden entschärft', async ({ page }) => {
  await page.evaluate(() => saveSession(localDay(), { manual: true, total: 20 }));
  await page.click('[data-rpe="8"]');
  await page.fill('#ratenote', '=HYPERLINK("x")');
  await page.click('#rateform button[type=submit]');
  await page.evaluate(() => showArea('mehr'));
  const dl = page.waitForEvent('download');
  await openSect(page, 'sect-data');
  await page.click('#exportcsv');
  const lines = fs.readFileSync(await (await dl).path(), 'utf8').replace(/^﻿/, '').split('\r\n');
  expect(lines[0].split(';').slice(-2)).toEqual(['Anstrengung (1-10)', 'Notiz']);
  expect(lines[1].split(';').slice(-2)).toEqual(['8', `'=HYPERLINK("x")`]);
});

test('Import mit präparierten Namen fügt kein HTML ein', async ({ page }) => {
  const today = await page.evaluate(() => localDay());
  await importJson(page, { version: 3, entries: [{ v: 3, id: 'x', date: today, plan: 'run', mode: 'sets', total: 3, cfg: ['bw'], stages: [''], sets: [[3]], names: ['<img src=x id=boese>'], note: '<b id=fett>x</b>' }] });
  await expect.poll(() => page.evaluate(() => saved.length)).toBe(1);
  await page.click('[data-plan="run"]');
  await page.evaluate(() => { document.querySelector('#fold-history').open = true; });
  await expect(page.locator('#history')).toContainText('<img src=x id=boese>');
  await page.evaluate(() => showArea('mehr'));
  await expect(page.locator('#boese')).toHaveCount(0);
  await expect(page.locator('#fett')).toHaveCount(0);
  await expect(page.locator('#weeklist')).toContainText('<b id=fett>x</b>');
});

test.describe('Datenschutz', () => {
  test.use({ allowedErrors: [/Content Security Policy|Refused to connect|Failed to fetch/] });
  test('Content-Security-Policy blockiert Verbindungen zu fremden Servern', async ({ page }) => {
    const res = await page.evaluate(() => fetch('https://example.com/').then(() => 'erreicht', e => 'blockiert: ' + e.name));
    expect(res).toBe('blockiert: TypeError');
  });
});

test('Wochenübersicht: Einheiten dieser Woche, Ø Anstrengung und Serie', async ({ page }) => {
  await page.evaluate(() => {
    const thisWeek = weekStart(localDay());
    const mk = (date, rpe) => ({ v: 3, id: uid(), date, plan: 'wed', total: 20, cfg: currentCfg('wed'), names: exList('wed').map(x => x.name), at: date + 'T10:00:00Z', ...(rpe ? { rpe } : {}) });
    saved.push(mk(thisWeek, 6), mk(thisWeek, 8), mk(addDays(thisWeek, -7)), mk(addDays(thisWeek, -14)), mk(addDays(thisWeek, -28)));
    persistEntries(); renderAll(); showArea('mehr');
  });
  await expect(page.locator('#weekcount')).toHaveText('2');
  await expect(page.locator('#weekrpe')).toHaveText('7');
  await expect(page.locator('#weekstreak')).toHaveText('3');
  await expect(page.locator('#weeklist .row')).toHaveCount(2);
  await expect(page.locator('#weekchart rect')).toHaveCount(4);
});

test('Kalenderwoche nach ISO 8601', async ({ page }) => {
  const r = await page.evaluate(() => [isoWeek('2026-01-01'), isoWeek('2026-12-31'), isoWeek('2027-01-04'), weekStart('2026-11-01'), isoWeek('2026-10-31')]);
  expect(r).toEqual([1, 53, 1, '2026-10-26', 44]);
});

test.describe('Sicherung auf Android', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    initScripts: ['window.__shared = 0; navigator.canShare = () => true; navigator.share = async () => { window.__shared++; };'] });
  test('lädt direkt herunter statt über das Teilen-Menü', async ({ page }) => {
    await page.evaluate(() => showArea('mehr'));
    await openSect(page, 'sect-data');
    await expect(page.locator('#savefilehint')).toHaveText('Landet im Ordner „Downloads“');
    const dl = page.waitForEvent('download');
    await page.click('#savefile');
    expect((await dl).suggestedFilename()).toMatch(/^tagwerk-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(await page.evaluate(() => window.__shared)).toBe(0);
  });
});

test('Kalendertage: unmögliche Daten werden abgelehnt, auch beim Import', async ({ page }) => {
  expect(await page.evaluate(() => ['2026-02-31', '2026-13-01', '2026-02-29', '2028-02-29', '2026-12-31', '2026-1-05'].map(isDay))).toEqual([false, false, false, true, true, false]);
  await importJson(page, { version: 3, entries: [], runLog: [{ id: 'a', date: '2026-02-31', km: 5 }, { id: 'b', date: '2026-03-01', km: 6 }] });
  await expect.poll(() => page.evaluate(() => runLog.map(r => r.id))).toEqual(['b']);
});

test('Import behält Felder, die diese Version nicht kennt (Sicherung aus einer neueren Version)', async ({ page }) => {
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await importJson(page, { version: 3, entries: [],
    runLog: [{ id: 'r', date: '2026-10-20', km: 8, neu: 'x' }],
    races: [{ id: 'c', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: null, km: null, zukunft: { a: 1 } }],
    results: [{ id: 's', date: '2026-09-01', km: 10, time: 3000, dist: '10k', quelle: 'uhr' }],
    weights: [{ date: '2026-10-01', kg: 118, fett: 30 }],
    settings: { profile: { hr: { max: 185 }, neuesFeld: [1, 2], __proto__: { boese: true } } } });
  await expect.poll(() => page.evaluate(() => runLog.length)).toBe(1);
  const r = await page.evaluate(() => [runLog[0].neu, races[0].zukunft, results[0].quelle, weights[0].fett, JSON.parse(localStorage.getItem(KEYS.profile)).neuesFeld, ({}).boese]);
  expect(r).toEqual(['x', { a: 1 }, 'uhr', 30, [1, 2], undefined]);
});
