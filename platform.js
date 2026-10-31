/* Betriebssystem erkennen, bevor die Seite gezeichnet wird: steuert Apple- bzw. Android-Darstellung. */
(function () {
  var ua = navigator.userAgent || '';
  var os = /Android/i.test(ua) ? 'android' : (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'ios' : 'other';
  document.documentElement.setAttribute('data-os', os);
})();
