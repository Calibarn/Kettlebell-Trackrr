'use strict';
/* Offline-Fähigkeit: zuerst Netz (damit Updates sofort ankommen), sonst Cache.
   Bei Änderungen an den Dateien VERSION erhöhen. */
// Testversion (…/dev/) hat einen eigenen Cache; jede Version räumt nur ihre eigenen alten Caches auf
const NS = self.location.pathname.includes('/dev/') ? 'dev-' : '';
const VERSION = NS + 'kbt-v53';
const ASSETS = ['./', './index.html', './platform.js', './lang-en.js', './i18n.js', './styles.css', './data.js', './figures.js', './app.js', './manifest.webmanifest', './manifest-test.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && (NS ? k.startsWith(NS) : !k.startsWith('dev-'))).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
