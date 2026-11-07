#!/usr/bin/env node
/* Englische Texte pflegen, direkt in lang-en.js (ohne Zwischendateien).
   Aufruf:  node tools/i18n.js set neu.json
   neu.json: { "text": { "Deutsch": "English" }, "html": { "Deutsch": "English" }, "remove": ["alter deutscher Text"] }
   - text: Texte aus data.js und app.js, die über tr() übersetzt werden (Schlüssel = deutscher Originaltext)
   - html: Texte aus index.html (Schlüssel = Text der Einheit, wie i18n.js ihn bildet)
   - remove: Schlüssel, die es nicht mehr gibt (aus beiden Listen)
   Was noch fehlt, zeigen die Tests: tests/englisch.spec.js, tests/start.spec.js (englisch), tests/stufen.spec.js. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILE = path.join(__dirname, '..', 'lang-en.js');

function load() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8') + '\n;this.out = { EN_TEXT, EN_HTML, EN_HTML_KEEP };', ctx);
  return ctx.out;
}
const dict = o => '{\n' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}';
function save(d) {
  const out = '/* Englische Texte für Tagwerk. Schlüssel = deutscher Originaltext (siehe i18n.js). */\n'
    + 'const EN_TEXT = ' + dict(d.EN_TEXT) + ';\n'
    + 'const EN_HTML = ' + dict(d.EN_HTML) + ';\n'
    + 'const EN_HTML_KEEP = [' + d.EN_HTML_KEEP.map(x => JSON.stringify(x)).join(', ') + '];\n';
  fs.writeFileSync(FILE, out);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'set' && arg) {
  const add = JSON.parse(fs.readFileSync(arg, 'utf8')), d = load();
  for (const k of add.remove || []) { delete d.EN_TEXT[k]; delete d.EN_HTML[k]; }
  Object.assign(d.EN_TEXT, add.text || {}); Object.assign(d.EN_HTML, add.html || {});
  save(d);
  console.log(`lang-en.js: ${Object.keys(d.EN_TEXT).length} Texte, ${Object.keys(d.EN_HTML).length} HTML-Texte`);
} else if (cmd === 'check') {
  const d = load(); save(d); console.log('lang-en.js neu geschrieben (Format geprüft)');
} else {
  console.log('node tools/i18n.js set neu.json   |   node tools/i18n.js check');
  process.exit(1);
}
