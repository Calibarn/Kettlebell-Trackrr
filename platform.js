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
  var at = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (at) at.setAttribute('content', 'KB Test');
}
