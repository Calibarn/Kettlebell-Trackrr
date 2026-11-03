// Abhaken & nachholen: optional, nur laufende Woche; im Zweifel fällt Kraft aus, feste Krafttage bleiben
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

test('verpasste Qualität rückt auf den Krafttag, die Kraft entfällt dafür; rückgängig möglich', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#planschedule .schedcheck')).toHaveCount(6);
  // Di vorbei: Vorschlag Mi (Kraft dort ist nicht fest)
  await expect(page.locator('[data-move="quality"]')).toHaveText('→ Mi');
  await page.click('[data-move="quality"]');
  await expect(page.locator('#toast')).toContainText('Kraft entfällt dafür');
  await expect(row(page, 'quality', 'Mi')).toContainText('verschoben von Di');
  await expect(row(page, 'strength', 'Mi')).toHaveClass(/skipped/);
  await page.click('[data-unmove="quality"]');
  await expect(row(page, 'quality', 'Di')).toBeVisible();
  await expect(row(page, 'strength', 'Mi')).not.toHaveClass(/skipped/);
});

test('feste Krafttage werden nicht getauscht; verpasste Kraft nur auf einen freien Tag', async ({ page }) => {
  await setup(page, { fixed: [3] });
  // Mi ist fest, Do hat schon einen Lauf → Fr (Kraft dort ist nicht fest)
  await expect(page.locator('[data-move="quality"]')).toHaveText('→ Fr');
  // Kraft vom Montag: nur ein ganz freier Tag kommt infrage → Sa
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
