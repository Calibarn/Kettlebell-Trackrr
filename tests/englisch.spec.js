// Englisch: Sprache nach Gerätesprache, Auswahl unter Mehr, keine fehlenden Übersetzungen, englische Ansagen.
const { test, expect, forward } = require('./fixtures');

const UMLAUT = /[äöüÄÖÜß„]/;
// Häufige deutsche Wörter, die in englischen Texten nicht vorkommen
const GERMAN = /[äöüÄÖÜß„]|\b(und|oder|nicht|mit|für|der|die|das|den|dem|ein|eine|ist|wird|bis|noch|je|Runde|Runden|Woche|Wochen|Gespeichert|Jetzt|Gleich|Satz|Sätze|Übung|Sek\.|Wdh\.|Min\.|Std\.|KW|Ziel|Zielzeit|Distanz|Rennen|Lauf|Einheit|Einheiten)\b/;
// Alles sichtbare Textmaterial inkl. Beschriftungen für Screenreader und Platzhalter
const allText = page => page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label],[placeholder],[title]')]
  .map(e => [e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('title')].filter(Boolean).join('\n')).join('\n')
  + '\n' + [...document.querySelectorAll('option')].map(o => o.textContent).join('\n'));
const germanLines = async page => (await allText(page)).split('\n').map(s => s.trim()).filter(s => GERMAN.test(s) && s !== 'Sprache · Language');

test.describe('Gerät auf Englisch', () => {
  test.use({ locale: 'en-US', initScripts: [`window.__voices = [{ name: 'Daniel', lang: 'en-GB', localService: true, default: true, voiceURI: 'daniel' }, { name: 'Anna', lang: 'de-DE', localService: true, default: false, voiceURI: 'anna' }];`] });

  test('App ist englisch, alle Bereiche ohne fehlende Übersetzung', async ({ page }) => {
    expect(await page.evaluate(() => [LANG, document.documentElement.lang])).toEqual(['en', 'en']);
    await expect(page.locator('#t-kraft')).toHaveText('Strength');
    // Daten anlegen, damit auch Verlauf, Rennen, Bestzeiten und Saisonplan gefüllt sind
    await page.evaluate(() => {
      const t = localDay();
      races = [{ id: 'a', name: 'Spring Half', date: addDays(t, 120), dist: 'hm', prio: 'A', goal: 7140, km: null }, { id: 'b', name: 'Test 20', date: addDays(t, 60), dist: 'hm', prio: 'B', goal: null, km: 20 }]; persistRaces();
      results = [{ id: 'x', date: addDays(t, -40), km: 10, time: 3305, dist: '10k' }, { id: 'y', date: addDays(t, -5), km: 10, time: 3250, dist: '10k', name: 'Park run' }]; persistResults();
      runLog = [{ id: 'l1', date: addDays(t, -3), km: 12 }, { id: 'l2', date: addDays(t, -10), km: 18 }]; persistRunLog();
      renderAll();
    });
    for (const pk of await page.evaluate(() => PLAN_ORDER)) {
      await page.evaluate(k => { showArea('kraft'); plan = k; resetState(); renderAll(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }, pk);
      for (const g of ['kb', 'band', 'bw']) await page.evaluate(([k, gg]) => { for (let i = 0; i < exList().length; i++) openExerciseGuide(i); document.querySelectorAll('dialog[open]').forEach(d => d.close()); }, [pk, g]);
      expect(await germanLines(page), pk).toEqual([]);
    }
    // Ein Zirkel mit gespeicherter Einheit: Zusammenfassung, Verlauf, Woche
    await page.evaluate(() => { plan = 'wed'; resetState(); renderAll(); });
    await page.click('#btnMain'); await page.click('#btnNext');
    for (let i = 0; i < 3; i++) await page.click('#btnDone');
    expect(await germanLines(page)).toEqual([]);
    await page.click('#btnNext'); expect(await germanLines(page)).toEqual([]);
    await page.click('#btnNext');
    await expect(page.locator('#btnMain')).toHaveText('💾 Save');
    await page.click('#btnMain');
    await expect(page.locator('#rate-title')).toHaveText('Session saved');
    expect(await germanLines(page)).toEqual([]);
    await page.click('[data-rpe="7"]'); await page.click('#rateform button[type=submit]');
    await page.evaluate(() => { showArea('kraft'); document.querySelectorAll('details').forEach(d => { d.open = true; }); });
    expect(await germanLines(page)).toEqual([]);
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    const views = await page.evaluate(() => {
      const out = [];
      for (const tab of ['plan', 'warmup', 'abc', 'umfang']) out.push(['laufen', tab]);
      return out;
    });
    for (const [a, tab] of views) {
      await page.evaluate(([aa, t]) => { showArea(aa); runView.tab = t; renderRun(); }, [a, tab]);
      for (let i = 0; i < await page.locator('#runsub button:visible').count(); i++) {
        await page.locator('#runsub button:visible').nth(i).click();
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
        expect(await germanLines(page), tab + ' ' + i).toEqual([]);
      }
    }
    await page.evaluate(() => showArea('mobility'));
    for (let t = 0; t < await page.locator('#mobtabs button:visible').count(); t++) {
      await page.locator('#mobtabs button:visible').nth(t).click();
      for (let i = 0; i < await page.locator('#mobsub button:visible').count(); i++) { await page.locator('#mobsub button:visible').nth(i).click(); expect(await germanLines(page)).toEqual([]); }
    }
    for (const a of ['profil', 'mehr']) { await page.evaluate(x => { showArea(x); document.querySelectorAll('details').forEach(d => { d.open = true; }); }, a); expect(await germanLines(page), a).toEqual([]); }
    await page.evaluate(() => { for (const n of Object.keys(GUIDES)) openGuide(n, 'bw'); openNotes(true); });
    expect(await germanLines(page)).toEqual([]);
    expect(await page.evaluate(() => [...i18nMissing])).toEqual([]);
  });

  test('Ansagen auf Englisch mit englischer Stimme', async ({ page }) => {
    await page.click('#btnMain');
    await page.waitForFunction(() => window.__spoken.length > 0);
    const s = await page.evaluate(() => window.__spoken);
    expect(s[0].voice).toBe('Daniel');
    expect(s[0].text).toMatch(/^Warm-up\. /);
    expect(s.map(x => x.text).join(' ')).not.toMatch(UMLAUT);
    // Geführte Routine: Zeit, Seiten und Name auf Englisch
    await page.evaluate(() => startRoutine('Test', [['45 Sek. je Seite', 'Wadendehnung', '']]));
    await page.waitForFunction(() => window.__spoken.some(x => /Calf stretch|calf/i.test(x.text)));
    expect((await page.evaluate(() => window.__spoken.at(-1).text))).toMatch(/45 seconds per side, start left/);
  });

  test('Sprache unter Mehr umstellen und zurück auf Automatisch', async ({ page }) => {
    await page.evaluate(() => showArea('mehr'));
    await expect(page.locator('#langsel option').first()).toHaveText('Auto (English)');
    await page.selectOption('#langsel', 'de');
    await expect(page.locator('#t-kraft')).toHaveText('Kraft');
    expect(await page.evaluate(() => [LANG, localStorage.getItem(LANG_KEY)])).toEqual(['de', '"de"']);
    await page.evaluate(() => showArea('mehr'));
    await page.selectOption('#langsel', 'auto');
    await expect(page.locator('#t-kraft')).toHaveText('Strength');
    expect(await page.evaluate(() => localStorage.getItem(LANG_KEY))).toBeNull();
  });
});

test.describe('Andere Gerätesprache', () => {
  test.use({ locale: 'fr-FR' });
  test('Französisch → Englisch', async ({ page }) => {
    expect(await page.evaluate(() => LANG)).toBe('en');
  });
});

test.describe('Deutsch als Gerätesprache', () => {
  test.use({ locale: 'de-AT' });
  test('Österreich → Deutsch, Daten bleiben deutsch gespeichert', async ({ page }) => {
    expect(await page.evaluate(() => LANG)).toBe('de');
    await expect(page.locator('#t-kraft')).toHaveText('Kraft');
  });
});
