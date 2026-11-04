/* Tagwerk – Sprache (Deutsch/Englisch)
   Automatisch: Gerätesprache Deutsch → Deutsch, alles andere → Englisch. Unter Mehr → Sprache fest einstellbar.
   Die Daten bleiben intern deutsch (Übungsnamen sind Schlüssel, Angaben wie „45 Sek. je Seite“ werden ausgewertet).
   Übersetzt wird nur, was angezeigt oder angesagt wird:
   - T('deutsch', 'english') für Texte im Code,
   - tr(text) für Inhalte aus data.js (Wörterbuch EN_TEXT in lang-en.js),
   - localizeContent() ersetzt reine Anzeige-Texte in data.js beim Start,
   - localizeHtml() die festen Texte in index.html (Wörterbuch EN_HTML in lang-en.js). */
const LANG_KEY = KEY_NS + 'jan-kb-lang-v1';
const LANG_PREF = (() => { try { const v = JSON.parse(localStorage.getItem(LANG_KEY)); return v === 'de' || v === 'en' ? v : 'auto'; } catch (e) { return 'auto'; } })();
const deviceLang = () => { const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'de'; return /^de\b/i.test(l) ? 'de' : 'en'; };
const LANG = LANG_PREF === 'auto' ? deviceLang() : LANG_PREF, EN = LANG === 'en', LOCALE = EN ? 'en-GB' : 'de-DE';
document.documentElement.lang = LANG;
const T = (de, en) => EN ? en : de;

// Fehlende Übersetzungen sammeln (für Tests: im Englisch-Modus muss die Menge leer bleiben)
const i18nMissing = new Set();
const EN_VALUES = new Set(typeof EN_TEXT === 'object' ? Object.values(EN_TEXT) : []);
// Kurzangaben wie „10 je Seite“ oder „2 × 20 m“ werden regelbasiert übersetzt
const UNIT_RULES = [[/\bje Seite\b/g, 'per side'], [/\bje Bein\b/g, 'per leg'], [/\bje Richtung\b/g, 'each direction'], [/\bje Position\b/g, 'per position'],
  [/\bje Runde\b/g, 'per round'], [/\bje Seite (\d+) ×/g, 'per side $1 ×'], [/\bpro Minute\b/g, 'per minute'], [/\babwechselnd\b/g, 'alternating'],
  [/\bSek\./g, 'sec'], [/\bMin\./g, 'min'], [/\bStd\./g, 'h'], [/\bWdh\./g, 'reps'], [/\bRunden\b/g, 'rounds'], [/\bRunde\b/g, 'round'],
  [/\bSätze\b/g, 'sets'], [/\bSatz\b/g, 'set'], [/(\d),(\d)/g, '$1.$2']];
const trUnits = s => UNIT_RULES.reduce((a, [re, to]) => a.replace(re, to), s);
const looksGerman = s => /[äöüÄÖÜß]|\b(je|und|oder|bis|Seite|mit|ohne|links|rechts)\b/.test(s);
function tr(s) {
  if (!EN || typeof s !== 'string' || !s.trim()) return s;
  if (typeof EN_TEXT === 'object' && Object.prototype.hasOwnProperty.call(EN_TEXT, s)) return EN_TEXT[s];
  if (EN_VALUES.has(s)) return s; // bereits übersetzt
  if (/\d/.test(s) && s.length <= 48) { const u = trUnits(s); if (!looksGerman(u)) return u; }
  i18nMissing.add(s);
  return s;
}

// Reine Anzeige-Texte in data.js direkt übersetzen. Namen, Wiederholungs- und Zeitangaben bleiben deutsch (siehe oben).
function localizeContent() {
  if (!EN) return;
  const each = (o, f) => { if (o) Object.values(o).forEach(f); };
  const set = (o, k) => { if (o && typeof o[k] === 'string') o[k] = tr(o[k]); };
  each(PLANS, p => {
    ['tab', 'label', 'short', 'intro'].forEach(k => set(p, k));
    (p.slots || []).forEach(sl => { set(sl, 'block'); set(sl, 'setLabel'); set(sl, 'why'); each(sl.v, v => { if (v[2]) v[2] = tr(v[2]); }); });
  });
  each(EXTRA, pl => each(pl, sl => { if (sl.band && sl.band[2]) sl.band[2] = tr(sl.band[2]); }));
  each(BEST, pl => each(pl, b => { if (typeof b[1] === 'string') b[1] = tr(b[1]); }));
  for (const k of Object.keys(GEAR_LABEL)) GEAR_LABEL[k] = tr(GEAR_LABEL[k]);
  each(GUIDES, g => { g.steps = (g.steps || []).map(tr); set(g, 'effect'); set(g, 'cue'); });
  for (const k of Object.keys(STAGE_INFO)) STAGE_INFO[k] = tr(STAGE_INFO[k]);
  [...RUN_GUIDE.race, ...RUN_GUIDE.training].forEach(r => { set(r, 'label'); set(r, 'intro'); [...r.warmup, ...r.cooldown].forEach(it => { if (it[2]) it[2] = tr(it[2]); }); });
  set(RUN_GUIDE.abc, 'intro'); RUN_GUIDE.abc.drills.forEach(it => { if (it[2]) it[2] = tr(it[2]); });
  MOBILITY.tabs.forEach(t => { t[1] = tr(t[1]); }); MOBILITY.regions.forEach(t => { t[1] = tr(t[1]); });
  MOBILITY.routines.forEach(r => ['label', 'title', 'intro'].forEach(k => set(r, k)));
  MOBILITY.groups.forEach(g => set(g, 'title'));
  each(SEASON.dist, d => set(d, 'label'));
  each(SEASON.phase, p => { p[0] = tr(p[0]); p[1] = tr(p[1]); });
  each(SEASON.key, ph => each(ph, l => { l[0] = tr(l[0]); l[1] = tr(l[1]); }));
  for (const k of Object.keys(SEASON.long)) { const v = SEASON.long[k]; if (typeof v === 'string') SEASON.long[k] = tr(v); else for (const d of Object.keys(v)) v[d] = tr(v[d]); }
  ['bRace', 'bInTaper', 'intro', 'note'].forEach(k => set(SEASON, k));
  for (const k of Object.keys(SEASON.recoverNote || {})) SEASON.recoverNote[k] = tr(SEASON.recoverNote[k]);
  ['intro', 'pace', 'health', 'screen', 'done'].forEach(k => set(STARTER, k));
  SEASON_GUIDE.forEach(s => { set(s, 'title'); set(s, 'sub'); s.items = (s.items || []).map(tr); });
  CHANGELOG.forEach(c => { set(c, 'title'); (c.items || []).forEach(it => { it[0] = tr(it[0]); it[1] = tr(it[1]); }); });
}

/* Feste Texte in index.html. Eine Einheit ist ein Element mit Text, das nur Inline-Markup enthält (b, i, a, br …);
   sie wird als Ganzes über ihr innerHTML übersetzt. Übrige Textknoten und die Attribute einzeln. */
const I18N_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'CODE', 'BR', 'KBD', 'SUP', 'SUB']);
const I18N_ATTRS = ['aria-label', 'placeholder', 'title'];
const i18nNorm = s => s.replace(/\s+/g, ' ').trim();
function i18nHtmlUnits(root) {
  const out = [];
  const isUnit = el => !['SCRIPT', 'STYLE', 'svg'].includes(el.tagName) && !el.closest('svg') && el.textContent.trim() && [...el.querySelectorAll('*')].every(c => I18N_INLINE.has(c.tagName));
  const walk = el => {
    for (const a of I18N_ATTRS) if (el.hasAttribute && el.hasAttribute(a) && el.getAttribute(a).trim()) out.push({ kind: 'attr', el, attr: a, key: i18nNorm(el.getAttribute(a)) });
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'svg') return;
    if (el !== root && isUnit(el) && el.children.length) { out.push({ kind: 'html', el, key: i18nNorm(el.innerHTML) }); el.querySelectorAll('*').forEach(c => { for (const a of I18N_ATTRS) if (c.hasAttribute(a)) out.push({ kind: 'attr', el: c, attr: a, key: i18nNorm(c.getAttribute(a)) }); }); return; }
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && /[A-Za-zÄÖÜäöü]/.test(n.nodeValue)) out.push({ kind: 'text', node: n, key: i18nNorm(n.nodeValue) });
      else if (n.nodeType === 1) walk(n);
    }
  };
  walk(root);
  return out;
}
function localizeHtml(root = document.body) {
  if (!EN || typeof EN_HTML !== 'object') return;
  for (const u of i18nHtmlUnits(root)) {
    const v = Object.prototype.hasOwnProperty.call(EN_HTML, u.key) ? EN_HTML[u.key] : null;
    if (v === null) { if (looksGerman(u.key) || !EN_HTML_SAME.has(u.key)) i18nMissing.add('html: ' + u.key); continue; }
    if (u.kind === 'attr') u.el.setAttribute(u.attr, v);
    else if (u.kind === 'html') u.el.innerHTML = v;
    else { const raw = u.node.nodeValue; u.node.nodeValue = raw.match(/^\s*/)[0] + v + raw.match(/\s*$/)[0]; }
  }
}
// Texte, die in beiden Sprachen gleich sind (Tagwerk, Mobility, Cooldown …)
const EN_HTML_SAME = new Set(typeof EN_HTML_KEEP === 'object' ? EN_HTML_KEEP : []);

localizeContent();
localizeHtml();
