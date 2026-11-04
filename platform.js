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
