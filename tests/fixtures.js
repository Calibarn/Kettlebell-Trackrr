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
  // Die meisten Tests nutzen Kettlebell 12 kg und Bänder 10/20/30 (neu eingerichtet ist die Ausstattung leer). Nur einmal je Tab, damit Neuladen nichts überschreibt.
  kit: [true, { option: true }],
  start: [false, { option: true }],
  page: async ({ page, allowedErrors, initScripts, kit, start }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => d.accept());
    // Neuigkeiten-Fenster in Tests nicht automatisch öffnen (eigener Test schaltet es wieder ein)
    await page.addInitScript(`try { if (!localStorage.getItem('jan-kb-notes-v1')) localStorage.setItem('jan-kb-notes-v1', '{"seen":null,"auto":false}'); } catch (e) {}`);
    if (kit) await page.addInitScript(`try { if (!sessionStorage.getItem('kbt-test-kit')) { sessionStorage.setItem('kbt-test-kit', '1'); if (!localStorage.getItem('jan-kb-profile-v1')) localStorage.setItem('jan-kb-profile-v1', JSON.stringify({ kit: { kb: [12], kbDefault: 12, bands: [10, 20, 30] } })); } } catch (e) {}`);
    // Die meisten Tests starten wie bisher im zuletzt genutzten Bereich; die Startseite prüft start.spec.js
    if (!start) await page.addInitScript('window.__kbtNoStart = true;');
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

// Aufklappbaren Bereich öffnen (Profil, Mehr, Laufen) – wie ein Tipp auf die Zeile
async function openSect(page, id) { await page.evaluate(i => { const d = document.getElementById(i); if (!d) throw Error('Bereich fehlt: ' + i); d.open = true; try { if (d.classList.contains('sect')) sectState[d.dataset.acc] = d.id; } catch (e) {} }, id); }

module.exports = { test, expect, forward, closeRating, openSect };
