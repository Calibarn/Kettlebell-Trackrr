#!/usr/bin/env node
/* Datenprüfung vor dem Release: Gehen beim Wechsel von der Live-Version (main) zur neuen Version (dev) Nutzerdaten verloren?
   Aufruf:  node tools/upgrade-check.js [--base origin/main] [--head origin/dev] [--report bericht.md]
   Prüft mit echten Daten, angelegt mit den Funktionen der Live-Version:
     1. Update an Ort und Stelle – die neue Version liest den Speicher der alten (so passiert es beim Release)
     2. Sicherung Live → Testversion (unter /dev/, eigener Speicherbereich „dev:“)
     3. Sicherung Testversion → Testversion (exportieren und in eine leere Testversion zurückspielen)
     4. Sync-Datei Live → Testversion („Sync laden“)
   Exit-Code 0 = alles erhalten, 1 = Daten fehlen oder sind verändert, 2 = Skript-Fehler. */
const { execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('@playwright/test')); }

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'origin/main'), HEAD = arg('head', 'origin/dev'), REPORT = arg('report', null);
const repo = path.resolve(__dirname, '..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-check-'));
const extract = (ref, dir) => { fs.mkdirSync(dir); execSync(`git -C "${repo}" archive ${ref} | tar -x -C "${dir}"`); };
const mainDir = path.join(tmp, 'main'), devDir = path.join(tmp, 'dev');
extract(BASE, mainDir); extract(HEAD, devDir);
const sha = ref => execSync(`git -C "${repo}" rev-parse --short ${ref}`).toString().trim();

// Webserver wie GitHub Pages: „/“ = Live-Version (umschaltbar für das Update), „/dev/“ = Testversion
let rootDir = mainDir;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]), dir = rootDir;
  if (p.startsWith('/dev/')) { dir = devDir; p = p.slice(4); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dir, path.normalize(p));
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(s);
});

const issues = [], log = [];
const note = t => { log.push(t); console.log(t); };
const fail = (phase, t) => { issues.push(`${phase}: ${t}`); console.log(`  ✗ ${t}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Jedes Blatt in a muss in b gleich vorhanden sein (b darf mehr haben, z. B. neue Felder der neuen Version)
function subset(a, b, at = '') {
  if (a === null || typeof a !== 'object') return eq(a, b) ? [] : [`${at || 'Wert'}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
  if (b === null || typeof b !== 'object') return [`${at}: fehlt`];
  if (Array.isArray(a)) return eq(a, b) ? [] : [`${at}: ${JSON.stringify(a).slice(0, 120)} → ${JSON.stringify(b).slice(0, 120)}`];
  return Object.keys(a).flatMap(k => subset(a[k], b[k], at ? `${at}.${k}` : k));
}
// Sammlungen: je Eintrag über einen Schlüssel vergleichen; die Felder, die beim Import übernommen werden
const COLL = {
  entries: { key: e => e.id },
  waist: { key: e => e.date, pick: e => ({ date: e.date, cm: e.cm, note: e.note || '' }) },
  runWeeks: { key: e => e.week, pick: e => ({ week: e.week, km: e.km ?? null, long: e.long ?? null }) },
  runLog: { key: e => e.id, pick: e => ({ id: e.id, date: e.date, km: e.km, sec: e.sec, hr: e.hr, kind: e.kind }) }, // Zeit, Puls, Art ab 1.1
  races: { key: e => e.id },
  weights: { key: e => e.date, pick: e => ({ date: e.date, kg: e.kg }) },
  results: { key: e => e.id }
};
// Bewusste Umstellungen zwischen den Versionen: so muss der alte Wert in der neuen Version aussehen
function migrated(k, v) {
  if (k !== 'profile' || !v || !v.week || !('extraDay' in v.week)) return v;
  const p = JSON.parse(JSON.stringify(v)), { extraDay, extraName } = p.week; delete p.week.extraDay; delete p.week.extraName;
  p.week.extras = Number.isInteger(extraDay) ? [{ d: extraDay, type: 'other', name: extraName || '' }] : []; // bis 1.0 eine „weitere Einheit“, ab 1.1 eine Liste
  return p;
}
function compare(phase, a, b, { importLike = false, settings = true, keys = null } = {}) {
  let n = 0;
  for (const [c, d] of Object.entries(COLL)) {
    const pick = importLike && d.pick ? d.pick : x => x;
    const list = (a[c] || []).filter(x => !(importLike && x && x.__unknown));
    const bm = new Map((b[c] || []).map(x => [String(d.key(x)), x]));
    for (const x of list) {
      n++;
      const y = bm.get(String(d.key(x)));
      if (!y) { fail(phase, `${c}: Eintrag ${d.key(x)} fehlt`); continue; }
      const diff = subset(pick(x), pick(y), `${c}[${d.key(x)}]`);
      if (diff.length) diff.forEach(t => fail(phase, t));
    }
  }
  for (const k of ['weekSkip', 'starter']) if (a[k] !== undefined) { const diff = subset(a[k], b[k], k); diff.forEach(t => fail(phase, t)); n++; }
  if (settings && a.settings) for (const k of keys || ['choices', 'stages', 'profile', 'audio'].concat(importLike ? [] : ['gear'])) { if (a.settings[k] === undefined) continue; subset(migrated(k, a.settings[k]), b.settings && b.settings[k], `settings.${k}`).forEach(t => fail(phase, t)); n++; }
  return n;
}
const counts = d => Object.keys(COLL).map(c => `${c} ${(d[c] || []).length}`).join(', ');

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, url = p => `http://127.0.0.1:${port}${p}`;
  const browser = await chromium.launch();
  const newCtx = async () => {
    const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true, viewport: { width: 390, height: 844 } });
    // keine Dateidialoge/Teilen-Menüs: Sicherungen kommen als Download; kein Startbildschirm, keine Neuigkeiten
    await ctx.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; window.__kbtNoSplash = true;
      try { for (const ns of ['', 'dev:']) if (!localStorage.getItem(ns + 'jan-kb-notes-v1')) localStorage.setItem(ns + 'jan-kb-notes-v1', '{"seen":null,"auto":false}'); } catch (e) {} });
    return ctx;
  };
  const open = async (ctx, p) => {
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e))); page.on('dialog', d => d.accept());
    await page.goto(url(p)); await page.waitForFunction(() => typeof backupJson === 'function');
    page.errs = errs; return page;
  };
  const snapshot = page => page.evaluate(() => JSON.parse(backupJson()));
  const download = async (page, fn) => { const dl = page.waitForEvent('download'); await page.evaluate(fn); return fs.readFileSync(await (await dl).path(), 'utf8'); };
  const importFile = async (page, name, text) => {
    await page.setInputFiles('#importfile', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
    await page.waitForTimeout(800);
  };

  note(`# Datenprüfung Live → neue Version\n\nLive (base): ${BASE} @ ${sha(BASE)} · neu (head): ${HEAD} @ ${sha(HEAD)} · ${new Date().toISOString()}\n`);

  // ---------- Daten in der Live-Version anlegen ----------
  const ctxA = await newCtx();
  let page = await open(ctxA, '/index.html');
  const mainVersion = await page.evaluate(() => typeof APP_VERSION === 'string' ? APP_VERSION : '?');
  await page.evaluate(() => {
    const d = n => addDays(localDay(), n);
    // Krafteinheiten über die App selbst (wie „Training nachtragen“)
    for (const [pk, n, total] of [['wed', -20, 25], ['sun', -13, 18], ['office', -6, 14], ['wed', -1, 27]]) { if (!PLANS[pk]) continue; setPlan(pk); saveSession(d(n), { manual: true, total }); const r = document.getElementById('rate'); if (r && r.open) r.close(); }
    waist.push({ id: uid(), date: d(-14), cm: 118.5, note: 'morgens' }, { id: uid(), date: d(-7), cm: 117.2, note: '' }); persistWaist();
    weights.push({ id: uid(), date: d(-14), kg: 123.4 }, { id: uid(), date: d(-7), kg: 122.8 }); persistWeight();
    for (const [n, km] of [[-12, 8], [-10, 6.5], [-7, 16], [-5, 8], [-3, 7.2], [-1, 18.5]]) addRun(d(n), km);
    setWeekKm(addDays(weekStart(localDay()), -42), 'km', 31); setWeekKm(addDays(weekStart(localDay()), -42), 'long', 17);
    races.push({ id: 'race-hm', name: 'Generali Berliner Halbmarathon', date: '2027-04-04', dist: 'hm', prio: 'A', goal: 7140, km: null },
      { id: 'race-10', name: 'Stadtlauf', date: d(-2), dist: '10k', prio: 'B', goal: 3300, km: null },
      { id: 'race-20', name: 'Lauf in die Tropen', date: d(-30), dist: 'hm', prio: 'B', goal: null, km: 20 }); persistRaces();
    results.push({ id: 'res-1', date: d(-30), km: 20, time: 6900, dist: null, name: 'Lauf in die Tropen', race: 'race-20' }, { id: 'res-2', date: '2026-09-06', km: 21.0975, time: 7302, dist: 'hm', name: 'BORSIG Halbmarathon' }); persistResults();
    weekSkip[weekStart(localDay())] = ['group']; store(KEYS.skip, weekSkip);
    profile.hr.max = 184; profile.hr.rest = 60; profile.week.strength = [1, 4]; profile.week.track = true; profile.week.extraDay = 4; profile.week.extraName = 'Regeneration'; persistProfile();
    if (PLANS.wed) updateChoice(PLANS.wed.slots[0].id, { kg: 12 });
    gear.band = false; store(KEYS.gear, gear);
  });
  // ein Eintrag aus einer „zukünftigen“ Version muss erhalten bleiben (darf beim Import fehlen, nicht beim Update)
  await page.evaluate(() => { const r = JSON.parse(localStorage.getItem(KEYS.races)); r.push({ id: 'zukunft', dist: 'ultra', __unknown: true }); localStorage.setItem(KEYS.races, JSON.stringify(r)); });
  await page.reload(); await page.waitForFunction(() => typeof backupJson === 'function');
  const S = await snapshot(page);
  const rawMain = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  note(`Live-Version ${mainVersion}: ${counts(S)}`);
  if (page.errs.length) fail('Live', 'Fehler in der Konsole: ' + page.errs.join(' | '));
  const backupMain = await download(page, () => exportBackup());
  const syncMain = await download(page, () => syncSave());
  note(`Sicherung der Live-Version: ${backupMain.length} Zeichen, Sync-Datei: ${syncMain.length} Zeichen\n`);

  // ---------- 1. Update an Ort und Stelle ----------
  note('## 1. Update an Ort und Stelle (neue Version liest den Speicher der Live-Version)');
  rootDir = devDir;
  await page.reload(); await page.waitForFunction(() => typeof backupJson === 'function');
  const devVersion = await page.evaluate(() => APP_VERSION);
  const U = await snapshot(page);
  note(`Neue Version ${devVersion}: ${counts(U)}`);
  let n = compare('Update', S, U);
  const rawDev = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  for (const k of Object.keys(rawMain)) if (!(k in rawDev)) fail('Update', `Speicherschlüssel ${k} ist weg`);
  if (!U.races.some(r => r.id === 'zukunft')) fail('Update', 'Eintrag einer neueren Version (races „zukunft“) ging verloren');
  if (page.errs.length) fail('Update', 'Fehler in der Konsole: ' + page.errs.join(' | '));
  note(`${n} Einträge/Einstellungen verglichen\n`);
  await ctxA.close();

  // ---------- 2. Sicherung Live → Testversion ----------
  note('## 2. Sicherung Live → Testversion (/dev/, leerer Speicher)');
  const ctxB = await newCtx(); page = await open(ctxB, '/dev/index.html');
  await importFile(page, 'kb-tracker-backup.json', backupMain);
  await page.reload(); await page.waitForFunction(() => typeof backupJson === 'function');
  const I = await snapshot(page);
  note(`Testversion nach Import: ${counts(I)}`);
  n = compare('Live → Test', S, I, { importLike: true });
  if (!(await page.evaluate(() => KEY_NS === 'dev:'))) fail('Live → Test', 'Testversion nutzt nicht den eigenen Speicherbereich');
  if (page.errs.length) fail('Live → Test', 'Fehler in der Konsole: ' + page.errs.join(' | '));
  note(`${n} Einträge/Einstellungen verglichen\n`);

  // ---------- 3. Sicherung Testversion → Testversion ----------
  note('## 3. Sicherung Testversion → Testversion');
  // Felder, die es erst in der Testversion gibt, mit durch den Rück-Import schicken (Lauf mit Zeit, Puls und Art)
  await page.evaluate(() => { if (typeof runExtra === 'function') addRun(addDays(localDay(), -2), 9.5, { sec: 3300, hr: 141, kind: 'easy' }); });
  const I2 = await snapshot(page);
  const backupDev = await download(page, () => exportBackup());
  await ctxB.close();
  const ctxC = await newCtx(); page = await open(ctxC, '/dev/index.html');
  await importFile(page, 'tagwerk-backup.json', backupDev);
  await page.reload(); await page.waitForFunction(() => typeof backupJson === 'function');
  const R = await snapshot(page);
  note(`Testversion nach Rück-Import: ${counts(R)}`);
  n = compare('Test → Test', I2, R, { importLike: true });
  if (page.errs.length) fail('Test → Test', 'Fehler in der Konsole: ' + page.errs.join(' | '));
  note(`${n} Einträge/Einstellungen verglichen\n`);
  await ctxC.close();

  // ---------- 4. Sync-Datei Live → Testversion ----------
  note('## 4. Sync-Datei Live → Testversion („Sync laden“)');
  const ctxD = await newCtx(); page = await open(ctxD, '/dev/index.html');
  const nav = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
  await page.evaluate(t => syncApply(t), syncMain); await nav;
  await page.waitForFunction(() => typeof backupJson === 'function');
  const Y = await snapshot(page);
  note(`Testversion nach Sync: ${counts(Y)}`);
  // Sync gleicht Übungs-Einstellungen, Stufen und Profil ab; Ton und die alte Geräte-Auswahl („Heute dabei“) bleiben bewusst je Gerät
  n = compare('Sync', S, Y, { keys: ['choices', 'stages', 'profile'] });
  if (page.errs.length) fail('Sync', 'Fehler in der Konsole: ' + page.errs.join(' | '));
  note(`${n} Einträge/Einstellungen verglichen\n`);
  await ctxD.close();

  await browser.close(); server.close();
  note(issues.length ? `## Ergebnis: ✗ ${issues.length} Abweichung(en)\n\n${issues.map(t => '- ' + t).join('\n')}` : '## Ergebnis: ✓ Keine Daten verloren oder verändert');
  if (REPORT) fs.writeFileSync(REPORT, log.join('\n') + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(issues.length ? 1 : 0);
})().catch(e => { console.error('Skript-Fehler:', e); try { server.close(); } catch (x) {} process.exit(2); });
