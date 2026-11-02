const { test, expect } = require('./fixtures');

// Jede Datenart muss nach dem Neuladen vollständig da sein (Schutz vor Fehlern in der Lade-Reihenfolge)
test('alle gespeicherten Daten überstehen das Neuladen', async ({ page }) => {
  await page.evaluate(() => {
    const t = localDay();
    saveSession(t, { manual: true, total: 20 });
    waist.push({ id: 'w', date: t, cm: 110 }); persistWaist();
    setWeekKm(addDays(weekStart(t), -7), 'km', 25);
    addRun(addDays(t, -2), 10);
    races = [{ id: 'r', name: 'HM', date: '2027-04-04', dist: 'hm', prio: 'A', goal: 7140, km: null }]; persistRaces();
    weights.push({ date: t, kg: 120 }); persistWeight();
    profile.hr = { max: 184, rest: 60, z: [122, 134, 147, 159, 172] }; profile.kit.kb = [12, 16]; profile.week.quality = 5; persistProfile();
    toggleSkip(weekStart(t), 'group');
    results.push({ id: 'x', date: t, km: 10, time: 3300, dist: '10k' }); persistResults();
  });
  const before = await page.evaluate(() => JSON.stringify([saved.length, waist.length, runWeeks.length, runLog.length, races, weights, profile, weekSkip, results]));
  await page.reload();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => loadIssues)).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify([saved.length, waist.length, runWeeks.length, runLog.length, races, weights, profile, weekSkip, results]))).toBe(before);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('unlesbar')))).toEqual([]);
});
