// Service Worker ohne Browser prüfen: beim Aktivieren nur eigene alte Caches löschen
const fs = require('fs'), path = require('path'), vm = require('vm');
const { test, expect } = require('@playwright/test');

async function activate(pathname, names) {
  const caches = new Set(names), handlers = {};
  const self = { location: { pathname }, addEventListener: (t, f) => { handlers[t] = f; }, clients: { claim: async () => { } }, skipWaiting: async () => { } };
  const ctx = { self, caches: { keys: async () => [...caches], delete: async k => caches.delete(k), open: async () => ({ addAll: async () => { }, put: async () => { } }) }, URL, fetch: async () => { } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), ctx);
  let done; handlers.activate({ waitUntil: p => { done = p; } }); await done;
  return { left: [...caches].sort(), version: vm.runInNewContext('VERSION', ctx) };
}

test('Service Worker der echten App löscht nur eigene alte Caches, nicht die der Testversion oder fremder Apps', async () => {
  const r = await activate('/Kettlebell-Trackrr/sw.js', ['kbt-v1', 'kbt-v66', 'dev-kbt-v66', 'andere-app-v3', 'workbox-precache']);
  expect(r.left).toEqual(['andere-app-v3', 'dev-kbt-v66', 'workbox-precache'].concat(r.version === 'kbt-v66' ? ['kbt-v66'] : []).sort());
});

test('Service Worker der Testversion löscht nur alte Caches der Testversion', async () => {
  const r = await activate('/Kettlebell-Trackrr/dev/sw.js', ['kbt-v66', 'dev-kbt-v1', 'andere-app-v3']);
  expect(r.left).toEqual(['andere-app-v3', 'kbt-v66']);
  expect(r.version.startsWith('dev-kbt-')).toBe(true);
});
