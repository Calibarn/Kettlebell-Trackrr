/* Betriebssystem erkennen, bevor die Seite gezeichnet wird: steuert Apple- bzw. Android-Darstellung. */
(function () {
  var ua = navigator.userAgent || '';
  var os = /Android/i.test(ua) ? 'android' : (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'ios' : 'other';
  document.documentElement.setAttribute('data-os', os);
})();
/* Testversion unter …/dev/: eigener Speicherbereich (Schlüssel mit „dev:“), eigener Cache und Name, sichtbarer Hinweis.
   So kann die Testversion die Daten der echten App nicht verändern – beide liegen unter derselben Adresse (Origin). */
var KEY_NS = /\/dev\/(index\.html)?$/.test(location.pathname) ? 'dev:' : '';
if (KEY_NS) {
  document.documentElement.classList.add('testbuild');
  document.title = 'Tagwerk Test';
  var ml = document.querySelector('link[rel="manifest"]'); if (ml) ml.setAttribute('href', 'manifest-test.webmanifest');
  var at = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (at) at.setAttribute('content', 'Tagwerk Test');
}
/* Startbildschirm mit Name und Icon: nur beim ersten Öffnen der Sitzung (nicht beim Neuladen) und nicht bei laufendem Training.
   Hier entschieden, bevor die Seite gezeichnet wird – sonst blitzt er kurz auf. Tests schalten ihn mit __kbtNoSplash ab. */
(function () {
  var off = true;
  try { off = !!window.__kbtNoSplash || !!sessionStorage.getItem(KEY_NS + 'kbt-splash') || !!localStorage.getItem(KEY_NS + 'jan-kb-session-v1'); sessionStorage.setItem(KEY_NS + 'kbt-splash', '1'); } catch (e) { }
  if (off) document.documentElement.classList.add('nosplash');
})();
/* Fehlerprotokoll: Fehler der App mitschreiben – nur auf diesem Gerät, höchstens 50 Einträge, gleiche Fehler hintereinander zusammengefasst.
   Enthält nur Meldung, Datei/Zeile, Version und Zeitpunkt, keine Trainingsdaten. Export: Start → Mehr → Daten & Datenschutz → Fehlerprotokoll.
   Steht hier (erstes Skript), damit auch Fehler beim Laden der übrigen Skripte erfasst werden. Nicht in Backup oder Sync. */
var ERRLOG_KEY = KEY_NS + 'jan-kb-errlog-v1', ERRLOG_MAX = 50;
function readErrLog() { try { var l = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function logError(msg, where, stack) {
  try {
    var list = readErrLog(), e = { t: new Date().toISOString(), v: typeof APP_VERSION === 'string' ? APP_VERSION : '', msg: String(msg || 'Unbekannter Fehler').slice(0, 300), where: String(where || '').slice(0, 160), stack: String(stack || '').slice(0, 1200) };
    try { e.area = area; e.plan = plan; } catch (_) { } // Bereich und Plan der App (app.js), falls schon geladen
    var last = list[list.length - 1];
    if (last && last.msg === e.msg && last.where === e.where) { last.n = (last.n || 1) + 1; last.t = e.t; } else list.push(e);
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(list.slice(-ERRLOG_MAX)));
  } catch (_) { }
}
window.addEventListener('error', function (ev) {
  if (!ev.message) return; // fehlende Bilder o. ä. (ohne Meldung)
  logError(ev.message, (ev.filename || '').split('/').pop() + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0), ev.error && ev.error.stack);
});
window.addEventListener('unhandledrejection', function (ev) { var r = ev.reason; logError(r && r.message ? r.message : r, 'Promise', r && r.stack); });
