// Testversion unter …/dev/: eigener Speicherbereich, eigener Name, sichtbar markiert
const { test, expect } = require('./fixtures');

test('Testversion speichert getrennt von der echten App', async ({ page }) => {
  // /dev/… auf dieselben Dateien abbilden (auf GitHub Pages liegt dort der Branch dev)
  await page.route('**/dev/**', async route => {
    const url = new URL(route.request().url()); url.pathname = url.pathname.replace('/dev/', '/');
    const res = await route.fetch({ url: url.toString() }); await route.fulfill({ response: res });
  });
  await page.goto('/dev/index.html');
  const r = await page.evaluate(() => {
    saveSession(localDay(), { manual: true, total: 12 }); document.querySelectorAll('dialog[open]').forEach(d => d.close());
    return { ns: KEY_NS, entries: KEYS.entries, lang: LANG_KEY, cls: document.documentElement.classList.contains('testbuild'), manifest: document.querySelector('link[rel=manifest]').getAttribute('href'), title: document.title,
      stored: Object.keys(localStorage).filter(k => k.includes('tracker-v1')) };
  });
  expect(r).toEqual({ ns: 'dev:', entries: 'dev:jan-kettlebell-tracker-v1', lang: 'dev:jan-kb-lang-v1', cls: true, manifest: 'manifest-test.webmanifest', title: 'Tagwerk Test', stored: ['dev:jan-kettlebell-tracker-v1'] });
  expect(await page.evaluate(() => $('appversion').textContent)).toBe(`Tagwerk · Version ${await page.evaluate(() => APP_VERSION)} · Testversion`);
  // die echte App sieht davon nichts
  await page.goto('/index.html');
  expect(await page.evaluate(() => [KEY_NS, saved.length, document.documentElement.classList.contains('testbuild')])).toEqual(['', 0, false]);
});
