// Startseite „Heute“: beim Öffnen, ohne untere Leiste; Kacheln führen in die Bereiche, in den Bereichen „Start“ statt „Mehr“.
const { test, expect } = require('./fixtures');

test.describe('mit Startseite', () => {
  test.use({ start: true });

  test('öffnet auf der Startseite, ohne Leiste; Kachel führt in den Bereich, „Start“ zurück', async ({ page }) => {
    await expect(page.locator('#area-start')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeHidden();
    await expect(page.locator('#t-start')).toHaveText('Heute');
    await expect(page.locator('#startcontent .stile')).toHaveCount(5);
    await page.click('#startcontent [data-go="laufen"]');
    await expect(page.locator('#area-laufen')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('#tabbar [data-area]')).toHaveCount(5);
    await expect(page.locator('#tabbar [data-area="mehr"]')).toHaveCount(0);
    await page.click('#tabbar [data-area="start"]');
    await expect(page.locator('#area-start')).toBeVisible();
    await page.click('#startcontent [data-go="mehr"]');
    await expect(page.locator('#area-mehr')).toBeVisible();
    await expect(page.locator('#tabbar [data-area="start"]')).toHaveAttribute('aria-selected', 'true');
    // Neu laden: wieder die Startseite, auch wenn zuletzt ein anderer Bereich offen war
    await page.reload();
    await expect(page.locator('#area-start')).toBeVisible();
  });

  test('Heute dran: Kraft am Krafttag startet direkt; Woche zählt Kraft, Mobility-Routinen und km', async ({ page }) => {
    await page.evaluate(() => {
      const wd = new Date(localDay() + 'T12:00:00').getDay();
      Object.assign(profile.week, { strength: [wd], quality: null, long: null, group: null, extraDay: null, runner: 'runner' }); persistProfile();
      runLog = [{ id: 'r', date: localDay(), km: 6.5 }]; persistRunLog();
      logMobility('Nach dem Lauf');
      showArea('start');
    });
    await expect(page.locator('#startcontent .srowt')).toHaveCount(1);
    await expect(page.locator('#startcontent .srowt')).toContainText('Kraft · Ganzkörper');
    await expect(page.locator('#startcontent .sweek')).toContainText('0 von 1');
    await expect(page.locator('#startcontent .sweek')).toContainText('6,5 km');
    await expect(page.locator('#startcontent .sweek')).toContainText('1 ×');
    await expect(page.locator('#startcontent [data-go="mobility"]')).toContainText('Nach dem Lauf · heute');
    await page.click('[data-startact="kraft"]');
    await expect(page.locator('#area-kraft')).toBeVisible();
    expect(await page.evaluate(() => sessionActive())).toBe(true);
    // läuft ein Training, öffnet die App direkt beim Timer
    await page.reload();
    await expect(page.locator('#area-kraft')).toBeVisible();
  });

  test('Kraft am Lauftag: Hinweis vollständig in eigener Zeile', async ({ page }) => {
    await page.evaluate(() => {
      const wd = new Date(localDay() + 'T12:00:00').getDay();
      Object.assign(profile.week, { strength: [wd], group: wd, quality: null, long: null, extraDay: null, runner: 'runner' }); persistProfile();
      showArea('start');
    });
    const tip = page.locator('#startcontent .srowt .stip');
    await expect(tip).toHaveText('Nach dem Lauf oder mit ein paar Stunden Abstand');
    expect(await tip.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.evaluate(() => { const wd = new Date(localDay() + 'T12:00:00').getDay(); Object.assign(profile.week, { group: null, quality: wd }); persistProfile(); renderStart(); });
    await expect(tip).toHaveText('Nach dem Lauf, ohne schwere Beinübungen');
  });

  test('Lauf-Einstieg und Ruhetag', async ({ page }) => {
    await page.evaluate(() => { Object.assign(profile.week, { strength: [], quality: null, long: null, group: null, extraDay: null, runner: 'beginner' }); persistProfile(); showArea('start'); });
    await expect(page.locator('#startcontent .srowt')).toContainText('Lauf-Einstieg · Woche 1');
    await page.click('[data-startact="starter"]');
    await expect(page.locator('#routine')).toBeVisible();
    await page.evaluate(() => rtGo(rt.steps.length)); await page.click('#rt-main');
    await expect(page.locator('#startcontent .srowt')).toContainText('erledigt');
    await page.evaluate(() => { profile.week.runner = 'runner'; persistProfile(); showArea('start'); });
    await expect(page.locator('#startcontent .srowt')).toContainText('Heute ist nichts geplant');
  });

  test.describe('englisch', () => {
    test.use({ locale: 'en-US' });
    test('Startseite auf Englisch ohne fehlende Übersetzung', async ({ page }) => {
      await expect(page.locator('#t-start')).toHaveText('Today');
      await expect(page.locator('#tabbar [data-area="start"]')).toContainText('Home');
      expect(await page.evaluate(() => [...i18nMissing])).toEqual([]);
    });
  });
});
