// Abhaken & nachholen: optional, nur laufende Woche; Kraft und Laufen parallel, an festen Krafttagen kommt kein Lauf dazu
const { test, expect } = require('./fixtures');

// Mittwoch, 4.11.2026: Mo Kraft, Di Qualität, Mi Kraft, Do Laufgruppe, Fr Kraft, So Longrun
async function setup(page, opt = {}) {
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(o => {
    races = [{ id: 'h', name: 'HM', date: '2027-03-21', dist: 'hm', prio: 'A', goal: null, km: null }]; persistRaces();
    Object.assign(profile.week, { quality: 2, long: 0, group: 4, strength: [1, 3, 5], extraDay: null, track: o.track !== false, strengthFixed: o.fixed || [] }); persistProfile();
    showArea('laufen'); runView.tab = 'plan'; runView.plan = 'woche'; renderRun();
  }, opt);
}
const row = (page, kind, day) => page.locator(`#planschedule .row.sched-${kind}`, { hasText: day });

test('ohne Abhaken: keine Haken, nichts zu verschieben', async ({ page }) => {
  await setup(page, { track: false });
  await expect(page.locator('#planschedule .schedcheck')).toHaveCount(0);
  await expect(page.locator('#planschedule [data-move]')).toHaveCount(0);
});

test('verpasste Qualität rückt auf den Krafttag, die Kraft bleibt parallel (mit Hinweis); rückgängig möglich', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#planschedule .schedcheck')).toHaveCount(6);
  // Di vorbei: Vorschlag Mi (Kraft dort ist nicht fest)
  await expect(page.locator('[data-move="quality"]')).toHaveText('→ Mi');
  await page.click('[data-move="quality"]');
  await expect(page.locator('#toast')).toHaveText('Auf Mittwoch verschoben.');
  await expect(row(page, 'quality', 'Mi')).toContainText('verschoben von Di');
  await expect(row(page, 'strength', 'Mi')).not.toHaveClass(/skipped/);
  await expect(row(page, 'strength', 'Mi')).toContainText('am selben Tag wie ein harter Lauf: danach, ohne schwere Beinübungen');
  await page.click('[data-unmove="quality"]');
  await expect(row(page, 'quality', 'Di')).toBeVisible();
  await expect(row(page, 'strength', 'Mi')).not.toContainText('am selben Tag');
});

test('Kraft am Tag der Laufgruppe: parallel geplant, Hinweis „danach oder mit Abstand“', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { profile.week.strength = [1, 4]; persistProfile(); renderRun(); });
  await expect(row(page, 'strength', 'Do')).toContainText('am selben Tag wie ein Lauf: danach oder mit ein paar Stunden Abstand');
  await expect(row(page, 'group', 'Do')).toBeVisible();
});

test('an festen Krafttagen kommt kein Lauf dazu; verpasste Kraft zuerst auf einen freien Tag', async ({ page }) => {
  await setup(page, { fixed: [3] });
  // Mi ist fest, Do hat schon einen Lauf → Fr (Kraft dort ist nicht fest)
  await expect(page.locator('[data-move="quality"]')).toHaveText('→ Fr');
  // Kraft vom Montag: zuerst ein ganz freier Tag → Sa
  await expect(page.locator('[data-move="strength-1"]')).toHaveText('→ Sa');
  // abgehakt: kein Vorschlag mehr
  await page.click('[data-done="strength-1"]');
  await expect(page.locator('[data-move="strength-1"]')).toHaveCount(0);
  await expect(page.locator('[data-done="strength-1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('nur die laufende Woche: in der nächsten Woche ist alles wieder frei', async ({ page }) => {
  await setup(page);
  await page.click('[data-move="quality"]');
  await page.click('[data-done="strength-1"]');
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+01:00'));
  await page.reload();
  await page.evaluate(() => { showArea('laufen'); runView.tab = 'plan'; runView.plan = 'woche'; renderRun(); });
  await expect(page.locator('#planschedule [data-unmove]')).toHaveCount(0);
  await expect(page.locator('[data-done="strength-1"]')).toHaveAttribute('aria-pressed', 'false');
});

test('Plan je Krafttag: im Profil wählbar, im Plan und auf der Startseite; „Starten“ stellt ihn ein', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { renderProfile(); showArea('profil'); document.getElementById('sect-week').open = true; });
  await expect(page.locator('#weekpanel [data-wkplan]')).toHaveCount(3);
  await page.selectOption('#weekpanel [data-wkplan="3"]', 'run');
  expect(await page.evaluate(() => [profile.week.strengthPlan, JSON.parse(localStorage.getItem(KEYS.profile)).week.strengthPlan])).toEqual([{ 3: 'run' }, { 3: 'run' }]);
  await page.evaluate(() => { showArea('laufen'); renderRun(); });
  await expect(row(page, 'strength', 'Mi')).toContainText('Kraft · Läufer');
  await expect(row(page, 'strength', 'Mo')).toContainText('Kraft');
  await expect(row(page, 'strength', 'Mo')).not.toContainText('Läufer');
  expect(await page.evaluate(() => planIcs(seasonPlan()))).toContain('SUMMARY:Kraft · Läufer');
  // Startseite (Mittwoch): Kraft · Läufer, Starten wählt den Plan und startet
  await page.evaluate(() => { plan = 'wed'; store(KEYS.plan, 'wed'); showArea('start'); });
  await expect(page.locator('#startcontent .srowt', { hasText: 'Kraft' })).toContainText('Kraft · Läufer');
  await page.click('[data-startact="kraft"]');
  expect(await page.evaluate(() => [plan, area, sessionActive()])).toEqual(['run', 'kraft', true]);
  // Tag abgewählt: Plan-Zuordnung verschwindet
  await page.evaluate(() => { profile.week.strength = [1, 5]; persistProfile(); });
  expect(await page.evaluate(() => profile.week.strengthPlan)).toEqual({});
});
