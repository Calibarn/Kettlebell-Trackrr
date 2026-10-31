// Gemeinsame Test-Umgebung: frische App ohne Daten, Sprachausgabe als Attrappe, Konsolenfehler lassen den Test scheitern.
const base = require('@playwright/test');

// Eine Gerätestimme und eine Online-Stimme; die App darf nur die Gerätestimme nutzen.
const SPEECH_STUB = `
  window.__spoken = [];
  const voices = window.__voices || [
    { name: 'Google Deutsch', lang: 'de-DE', localService: false, default: false, voiceURI: 'online' },
    { name: 'Anna', lang: 'de-DE', localService: true, default: true, voiceURI: 'anna' }
  ];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices,
    speak: u => { if (String(u.text).trim()) window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name }); },
    cancel: () => {}, addEventListener: () => {}
  } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.showSaveFilePicker = undefined;
`;

const test = base.test.extend({
  allowedErrors: [[], { option: true }],
  initScripts: [[], { option: true }],
  page: async ({ page, allowedErrors, initScripts }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => d.accept());
    for (const s of initScripts) await page.addInitScript(s);
    await page.addInitScript(SPEECH_STUB);
    await page.goto('/index.html');
    await use(page);
    expect(errors.filter(e => !allowedErrors.some(r => r.test(e))), 'Fehler in der Browser-Konsole').toEqual([]);
  }
});
const expect = base.expect;

// Zeit vorspulen: verschiebt den Startzeitpunkt der laufenden Phase, statt real zu warten.
async function forward(page, seconds) { await page.evaluate(s => { startedAt -= s * 1000; tick(); }, seconds); }
async function closeRating(page) { await expect(page.locator('#rate')).toBeVisible(); await page.click('#rate-skip'); await expect(page.locator('#rate')).toBeHidden(); }

module.exports = { test, expect, forward, closeRating };
