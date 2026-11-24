// ⌚ Für die Uhr (ab 1.10): die Einheit von heute als eigenes Training der Fitness-App; wie man es anlegt, steht unter Mehr → Apple Watch.
const { test, expect } = require('./fixtures');

test('Schritte für die Uhr: Intervalle mit Tempo-Ziel und Erholung, kurze Stücke ohne Ziel, lockere Läufe mit Puls-Ziel', async ({ page }) => {
  const r = await page.evaluate(() => {
    profile.hr = Object.assign({}, profile.hr, { max: 184, rest: 60, z: hrZonesFrom(184, 60) }); const z = profile.hr.z;
    const q = detail => watchSteps({ kind: 'quality', title: 'Qualität', detail });
    return {
      z2: `${z[1]}–${z[2] - 1} bpm`, z1: `${z[0]}–${z[1] - 1} bpm`,
      thr: q('4 × 6 Min. Schwelle, 90 Sek. Trabpause (5:40–5:45 /km)'),
      cut: q('kürzer: 3 × 1 km Schwelle, 1 Min. Trabpause (5:40–5:45 /km) – statt 5 ×'),
      billat: q('Intervall: Billat 30/30 – 12 × 30 Sek. zügig, je 30 Sek. traben (≈ 5:17 /km)'),
      nor: q('Intervall: Norweger 4 × 4 Min. hart, 3 Min. Trabpause (≈ 5:17 /km)'),
      strides: q('3 × 10 Min. Schwelle, 2 Min. Trabpause, danach 6 × 100 m Steigerung (5:40–5:45 /km)'),
      hm: q('2 × 5 km im HM-Tempo, 3 Min. Trabpause (5:45 /km)'),
      long: watchSteps({ kind: 'long', title: 'Longrun ca. 13 km', km: 13, detail: 'locker, Zone 2' }),
      group: watchSteps({ kind: 'group', title: 'Laufgruppe', detail: 'locker, Zone 2' }),
      rec: watchSteps({ kind: 'easy', title: 'Regeneration', detail: 'sehr locker, Zone 1' }),
      test: watchSteps({ kind: 'quality', title: 'Testlauf 5 km', test: true, detail: 'nach 15 Min. Einlaufen 5 km' }),
      race: watchSteps({ kind: 'race', title: 'HM', detail: '' })
    };
  });
  expect(r.thr).toEqual(['Aufwärmen: Offen – mit Doppeltippen weiter', '4 × wiederholen: Training Zeit 6:00 Min., Ziel Tempo 5:40–5:45 /km · Erholung Zeit 1:30 Min.', 'Cool-down: Offen']);
  expect(r.cut[1]).toBe('3 × wiederholen: Training Strecke 1 km, Ziel Tempo 5:40–5:45 /km · Erholung Zeit 1:00 Min.');
  expect(r.billat[1]).toBe('12 × wiederholen: Training Zeit 30 Sek., ohne Ziel (zu kurz fürs GPS) · Erholung Zeit 30 Sek.');
  expect(r.nor[1]).toBe('4 × wiederholen: Training Zeit 4:00 Min., Ziel Tempo 5:12–5:22 /km · Erholung Zeit 3:00 Min.');
  expect(r.strides[2]).toBe('Cool-down: Offen – darin 6 × 100 m Steigerung');
  expect(r.hm[1]).toBe('2 × wiederholen: Training Strecke 5 km, Ziel Tempo 5:40–5:50 /km · Erholung Zeit 3:00 Min.');
  expect(r.long).toEqual([`Training: Strecke 13 km, Ziel Herzfrequenz ${r.z2}`]);
  expect(r.group).toEqual([`Training: Offen, Ziel Herzfrequenz ${r.z2}`]);
  expect(r.rec).toEqual([`Training: Offen, Ziel Herzfrequenz ${r.z1}`]);
  expect(r.test).toEqual(['Aufwärmen: Zeit 15:00 Min.', 'Training: Strecke 5 km, ohne Ziel – so schnell, wie du gleichmäßig durchhältst', 'Cool-down: Offen']);
  expect(r.race).toBeNull();
});

test.describe('mit Startseite', () => {
  test.use({ start: true });
  test('„⌚ Für die Uhr“ an der Einheit von heute, Verweis öffnet Mehr → Apple Watch', async ({ page }) => {
    await page.evaluate(() => { const wd = new Date(localDay() + 'T12:00:00').getDay();
      results = [{ id: 'a', date: addDays(localDay(), -20), km: 10, time: 3300, dist: '10k' }]; persistResults();
      races = [{ id: 'h', name: 'HM', date: addDays(localDay(), 120), dist: 'hm', prio: 'A' }]; persistRaces();
      Object.assign(profile.week, { runner: 'runner', quality: wd, long: (wd + 4) % 7, group: null, extras: [], strength: [], mobility: [], sauna: [] }); persistProfile();
      runLog = []; persistRunLog(); showArea('start'); });
    const w = page.locator('#startcontent .srowt', { hasText: 'Qualität' }).locator('.swatch');
    await expect(w.locator('summary')).toHaveText('⌚ Für die Uhr');
    await w.locator('summary').click();
    await expect(w.locator('li')).toHaveCount(3);
    await expect(w.locator('li').first()).toHaveText('Aufwärmen: Offen – mit Doppeltippen weiter');
    await w.locator('[data-watchhelp]').click();
    await expect(page.locator('#area-mehr')).toBeVisible();
    await expect(page.locator('#sect-watch')).toHaveAttribute('open', '');
    await expect(page.locator('#sect-watch')).toContainText('Wiederholung hinzufügen');
    // auf Android nicht
    await page.evaluate(() => { document.documentElement.dataset.os = 'android'; showArea('start'); });
    await expect(page.locator('#startcontent .swatch')).toHaveCount(0);
    await expect(page.locator('#sect-watch')).toBeHidden();
  });
});
