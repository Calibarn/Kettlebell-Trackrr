const { test, expect } = require('./fixtures');

// Neuigkeiten: einmal nach einem Update, danach nur noch unter Mehr
test.describe('Neuigkeiten', () => {
  test.use({ initScripts: [`if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('jan-kb-notes-v1', '{"seen":"alt","auto":true}'); }`] });

  test('erscheinen beim ersten Start nach einem Update, danach nicht mehr; unter Mehr jederzeit', async ({ page }) => {
    await expect(page.locator('#notes')).toBeVisible();
    await expect(page.locator('#notes-title')).toHaveText('Neu in der App');
    await expect(page.locator('#notes-body h3').first()).toHaveText(await page.evaluate(() => CHANGELOG[0].title));
    await page.click('#notes-close');
    await expect(page.locator('#notes')).toBeHidden();
    // das close-Ereignis des Dialogs kommt asynchron – darauf warten statt sofort zu lesen
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem(KEYS.notes)).seen)).toBe(await page.evaluate(() => noteStamp(CHANGELOG[0])));

    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator('#notes')).toBeHidden();

    await page.evaluate(() => showArea('mehr'));
    await expect(page.locator('#noteshint')).toContainText(await page.evaluate(() => CHANGELOG[0].title));
    await page.click('#notesbtn');
    await expect(page.locator('#notes-title')).toHaveText('Neuigkeiten');
    await expect(page.locator('#notes-body h3')).toHaveCount(await page.evaluate(() => CHANGELOG.length));
    await page.click('#notes-close');

    // abschalten: auch eine neue Version öffnet nichts mehr automatisch
    await page.click('#notesauto');
    await expect(page.locator('#notesautoval')).toHaveText('Aus');
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem(KEYS.notes)); o.seen = 'alt'; localStorage.setItem(KEYS.notes, JSON.stringify(o)); });
    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator('#notes')).toBeHidden();
  });
});

test('jeder Neuigkeiten-Eintrag hat eine eindeutige id, ein gültiges Datum und Punkte', async ({ page }) => {
  const c = await page.evaluate(() => CHANGELOG);
  expect(new Set(c.map(x => x.id)).size).toBe(c.length);
  for (const x of c) { expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(x.items.length).toBeGreaterThan(0); }
  expect(c.map(x => x.date)).toEqual(c.map(x => x.date).slice().sort().reverse());
});

test('Neuigkeiten: wer nichts gesehen hat, bekommt alle; wer den Grundstand kennt, nur Neueres', async ({ page }) => {
  const shown = seen => page.evaluate(sv => {
    const real = CHANGELOG.slice();
    CHANGELOG.splice(0, CHANGELOG.length, { id: 'neu2', date: '2026-12-01', title: 'Zweites Update', items: [['A', 'b']] }, { id: 'neu1', date: '2026-11-20', title: 'Erstes Update', items: [['A', 'b']] }, real.at(-1));
    notesOpt.seen = sv; openNotes(false);
    const t = [...document.querySelectorAll('#notes-body h3')].map(h => h.textContent);
    $('notes').close(); CHANGELOG.splice(0, CHANGELOG.length, ...real); return t;
  }, seen);
  expect(await shown(null)).toEqual(['Zweites Update', 'Erstes Update', 'Grundstand: alle Funktionen']);
  expect(await shown('gibtsnicht')).toEqual(['Zweites Update', 'Erstes Update', 'Grundstand: alle Funktionen']);
  expect(await shown(await page.evaluate(() => CHANGELOG.at(-1).id))).toEqual(['Zweites Update', 'Erstes Update']);
  expect(await shown('neu1')).toEqual(['Zweites Update']);
  expect(await shown('neu2')).toEqual(['Zweites Update']);
  // ein Tag, an dem neue Punkte dazugekommen sind, erscheint wieder; frühere ids des Tages (aka) zählen als derselbe Tag
  expect(await shown('neu2@1')).toEqual(['Zweites Update']);
});

test('Neuigkeiten für Neulinge: höchstens die 3 neuesten Updates plus Grundstand', async ({ page }) => {
  const r = await page.evaluate(() => {
    const real = CHANGELOG.slice(), up = [5, 4, 3, 2, 1].map(n => ({ id: 'u' + n, date: `2027-0${n}-01`, title: 'Update ' + n, items: [['A', 'b']] }));
    CHANGELOG.splice(0, CHANGELOG.length, ...up, real.at(-1));
    notesOpt.seen = null; openNotes(false);
    const t = [...document.querySelectorAll('#notes-body h3')].map(h => h.textContent), txt = $('notes-body').textContent;
    notesOpt.seen = 'u2'; openNotes(false);
    const t2 = [...document.querySelectorAll('#notes-body h3')].map(h => h.textContent);
    $('notes').close(); CHANGELOG.splice(0, CHANGELOG.length, ...real);
    return { t, t2, hint: txt.includes('2 ältere Updates') };
  });
  expect(r.t).toEqual(['Update 5', 'Update 4', 'Update 3', 'Grundstand: alle Funktionen']);
  expect(r.hint).toBe(true);
  expect(r.t2).toEqual(['Update 5', 'Update 4', 'Update 3']); // wer u2 kennt, bekommt alles Neuere
});

test('Neuigkeiten: ein Eintrag pro Tag; neue Punkte am selben Tag zeigen den Tag erneut', async ({ page }) => {
  const r = await page.evaluate(() => {
    const real = CHANGELOG.slice(), base = real.at(-1);
    const day = { id: 'd1', aka: ['d1b'], date: '2026-12-01', title: 'Tag 1', items: [['A', 'b']] };
    CHANGELOG.splice(0, CHANGELOG.length, day, base);
    const out = [];
    for (const seen of ['d1@1', 'd1b', 'd1']) { notesOpt.seen = seen; out.push(seenIndex()); }
    day.items.push(['C', 'd']); notesOpt.seen = 'd1@1'; out.push(seenIndex());
    CHANGELOG.splice(0, CHANGELOG.length, ...real);
    return out;
  });
  expect(r).toEqual([0, 1, 1, 1]);
  const dates = await page.evaluate(() => CHANGELOG.slice(0, -1).map(c => c.date));
  expect(new Set(dates).size).toBe(dates.length);
});

test('Neuigkeiten: je Tag erst Neuerungen, dann Optimierungen, zuletzt Fehlerbehebungen', async ({ page }) => {
  const order = await page.evaluate(() => CHANGELOG.map(c => c.items.map(([k]) => k === 'Behoben' ? 2 : ['Schneller', 'Übersichtlicher'].includes(k) ? 1 : 0)));
  for (const o of order) expect(o).toEqual(o.slice().sort((a, b) => a - b));
});

test('Neuigkeiten gruppiert nach Neu, Usability und Bugs; Thema steht nicht doppelt', async ({ page }) => {
  await page.evaluate(() => openNotes(true));
  const first = page.locator('#notes-body');
  const kinds = await page.evaluate(() => { const c = CHANGELOG.find(x => x.id === '2026-11-03'); return NOTE_KINDS.filter(k => c.items.some(it => it[2] === k[0])).map(k => k[1]); });
  expect(kinds).toEqual(['Neu', 'Usability', 'Bugs']);
  await expect(first.locator('.noteskind').first()).toHaveText('Neu');
  expect(await page.evaluate(() => CHANGELOG.every(c => c.items.every(it => ['neu', 'ux', 'bug'].includes(it[2]))))).toBe(true);
  expect(await page.evaluate(() => CHANGELOG[0].items.some(it => ['Übersichtlicher', 'Behoben', 'Schneller'].includes(it[0])))).toBe(false);
  await expect(first).toContainText('Android: Die Tab-Leiste');
  await expect(first).not.toContainText('Android: Android:');
});

test('Versionsnummer unter Mehr und beim Neuigkeiten-Eintrag', async ({ page }) => {
  await page.evaluate(() => showArea('mehr'));
  const v = await page.evaluate(() => APP_VERSION);
  expect(v).toMatch(/^\d+\.\d+$/);
  await expect(page.locator('#appversion')).toHaveText(`Tagwerk · Version ${v}`);
  await page.click('#notesbtn');
  await expect(page.locator('#notes-body')).toContainText('Version ' + v);
});

test('Name Tagwerk: Titel, Manifest, Version – auch auf Englisch nicht übersetzt; Sync-Datei behält ihren Namen', async ({ page }) => {
  expect(await page.title()).toBe('Tagwerk');
  expect(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content')).toBe('Tagwerk');
  const m = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
  expect([m.name, m.short_name]).toEqual(['Tagwerk', 'Tagwerk']);
  expect(await page.evaluate(() => SYNC_FILE)).toBe('kb-tracker-sync.json');
  await page.evaluate(() => { localStorage.setItem(LANG_KEY, '"en"'); });
  await page.reload();
  expect(await page.evaluate(() => EN)).toBe(true);
  await expect(page.locator('#appversion')).toHaveText(/^Tagwerk · Version /);
  expect(await page.evaluate(() => $('syncplace').getAttribute('placeholder'))).toBe('e.g. iCloud Drive › Tagwerk');
});
