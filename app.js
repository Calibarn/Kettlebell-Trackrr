'use strict';
/* Tagwerk (bis 1.0: KB Tracker) – Logik. Alle Daten bleiben in localStorage auf dem Gerät. */

const $ = id => document.getElementById(id);
const KEYS = {
  entries: 'jan-kettlebell-tracker-v1', waist: 'jan-kb-waist-v1', sound: 'jan-kb-sound-v1', gear: 'jan-kb-gear-v1',
  choice: 'jan-kb-choice-v1', stage: 'jan-kb-stage-v1', plan: 'jan-kb-plan-v1', session: 'jan-kb-session-v1',
  backup: 'jan-kb-lastbackup-v1', hint: 'jan-kb-installhint-v1', area: 'jan-kb-area-v1', run: 'jan-kb-runview-v1', audio: 'jan-kb-audio-v1', mob: 'jan-kb-mobview-v1', runweeks: 'jan-kb-runweeks-v1', runlog: 'jan-kb-runlog-v1', races: 'jan-kb-races-v1', profile: 'jan-kb-profile-v1', weight: 'jan-kb-weight-v1', skip: 'jan-kb-weekskip-v1', results: 'jan-kb-results-v1', bestview: 'jan-kb-bestview-v1', notes: 'jan-kb-notes-v1', weekplan: 'jan-kb-weekplan-v1', icsremind: 'jan-kb-icsremind-v1', sections: 'jan-kb-sections-v1', starter: 'jan-kb-starter-v1', moblog: 'jan-kb-moblog-v1', runask: 'jan-kb-runask-v1', gymlog: 'jan-kb-gymlog-v1', setup: 'jan-kb-setup-v1'
};
/* Datensicherheit bei Updates:
   - Einträge, die diese Version nicht versteht, werden nie verworfen, sondern unverändert mitgespeichert.
   - Unlesbare Daten werden vor dem Überschreiben unter einem eigenen Schlüssel aufbewahrt.
   - Vor einer Formatänderung (SCHEMA) wird eine Sicherung im Backup-Format angelegt. */
// Testversion (…/dev/): alle Schlüssel mit eigenem Präfix, siehe platform.js
for (const k of Object.keys(KEYS)) KEYS[k] = KEY_NS + KEYS[k];
const SCHEMA = 3, SCHEMA_KEY = KEY_NS + 'jan-kb-schema-v1', PRE_UPDATE_KEY = KEY_NS + 'jan-kb-sicherung-vor-update';
const loadIssues = [];
function loadList(key, valid) {
  let raw = null; try { raw = localStorage.getItem(key); } catch (e) { }
  if (raw === null) return { ok: [], keep: [] };
  try { const v = JSON.parse(raw); if (!Array.isArray(v)) throw Error('kein Array'); return { ok: v.filter(valid), keep: v.filter(x => !valid(x)) }; }
  catch (e) { try { localStorage.setItem(key + '-unlesbar-' + Date.now(), raw); } catch (_) { } loadIssues.push(key); return { ok: [], keep: [] }; }
}
function load(k, def) { try { const raw = localStorage.getItem(k); if (raw === null) return def; const v = JSON.parse(raw); return v === null || v === undefined ? def : v; } catch (e) { return def; } }
let syncHook = null; // wird vom Geräte-Sync gesetzt und erfährt so jede Änderung
let wiping = false;  // Werkseinstellung läuft: nichts mehr speichern (auch nicht beim Schließen der Seite)
function store(k, v) { if (wiping) return false; try { localStorage.setItem(k, JSON.stringify(v)); if (syncHook) syncHook(k); return true; } catch (e) { return false; } }
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
// Nur echte Kalendertage (kein 2026-02-31): Rundlauf über Date
const isDay = d => { if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const t = new Date(d + 'T12:00:00Z'); return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d; };
function localDay(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dateGerman(day) { const [y, m, d] = String(day).split('-'); return EN ? `${d}/${m}/${y}` : `${d}.${m}.${y}`; }
// Tag und Monat ohne Jahr: 02.11. bzw. 02/11
const dateShort = day => dateGerman(day).slice(0, EN ? 5 : 6);
function clock(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
// Zahlenformate einmal anlegen: toLocaleString mit Optionen baut bei jedem Aufruf einen neuen Formatierer (beim Start spürbar)
const NUM1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }), NUM1F = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const kgText = v => NUM1.format(Number(v));
const cmString = v => NUM1F.format(Number(v));

/* ---------- Einstellungen: Geräte, Varianten, Gewichte ---------- */
let gear = load(KEYS.gear, null);
if (!isObj(gear)) gear = { kb: true, db: true, band: true, bw: true };
gear = { kb: gear.kb !== false, db: gear.db !== false, band: gear.band !== false, bw: gear.bw !== false };
// Ohne Auswahl wird mit Körpergewicht trainiert
const ensureGear = () => { if (!gear.kb && !gear.db && !gear.band && !gear.bw) gear.bw = true; };
/* Geräte je Plan (z. B. Ganzkörper: Kettlebell + Körpergewicht, Tabata: Kettlebell, Läufer: Band): in den Übungs-Einstellungen
   des Plans gespeichert und damit mit den anderen Geräten abgeglichen. Ohne eigene Auswahl gilt die bisherige Auswahl dieses Geräts. */
const vacation = () => { const v = typeof profile === 'object' && profile && profile.kit && profile.kit.vacation, d = localDay(); return v && v.from <= d && d <= v.to ? v : null; };
function planGear(pk = plan) {
  const vac = vacation(); if (vac) { const g = Object.assign({}, vac.gear); if (!g.kb && !g.db && !g.band) g.bw = true; return g; }
  const c = typeof choices === 'object' && choices && choices[pk + '.gear'];
  if (!c || typeof c !== 'object') return gear;
  const g = { kb: c.kb === true, db: c.db === true, band: c.band === true, bw: c.bw === true };
  if (!g.kb && !g.db && !g.band && !g.bw) g.bw = true;
  return g;
}
function setPlanGear(pk, g) {
  const v = { kb: !!g.kb, db: !!g.db, band: !!g.band, bw: !!g.bw };
  if (vacation()) { profile.kit.vacation.gear = v; persistProfile(); return; } // im Urlaub: nur für den Urlaub
  choices[pk + '.gear'] = v; store(KEYS.choice, choices);
}
ensureGear();
let choices = load(KEYS.choice, {}); if (!isObj(choices)) choices = {};
let stages = load(KEYS.stage, {}); if (!isObj(stages)) stages = {};

/* ---------- Profil: Herzfrequenz, Geräte & Gewichte, Trainingswoche ---------- */
// Wochentage wie Date.getDay(): 0 = Sonntag. Angezeigt wird Montag bis Sonntag.
const WD = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WD_LONG = EN ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Neu eingerichtet: keine Kettlebell und keine Bänder – was du besitzt, trägst du im Profil ein
const PROFILE_DEFAULT = { hr: { max: null, rest: null, z: null }, kit: { kb: [], kbDefault: KB_DEFAULT, db: [], dbDefault: DB_DEFAULT, bands: [] },
  week: { group: 3, quality: 2, long: 0, strength: [4, 6], extras: [] } };
const HR_PCT = [0.5, 0.6, 0.7, 0.8, 0.9]; // Karvonen: Anteil der Herzfrequenzreserve, ab dem Zone 1–5 beginnt
const isWd = v => Number.isInteger(v) && v >= 0 && v <= 6;
const okNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const okZones = z => Array.isArray(z) && z.length === 5 && z.every((v, i) => okNum(v, 30, 230) && (i === 0 || v > z[i - 1]));
const EXTRA_TYPES = ['easy', 'recovery', 'quality', 'other'];
// Weitere Einheiten: Name aus dem Profil, sonst nach der Art; Regenerationslauf = locker laufen, nur kürzer und noch ruhiger
const EXTRA_NAME = { easy: ['Lockerer Lauf', 'Easy run'], recovery: ['Regenerationslauf', 'Recovery run'], quality: ['Qualität 2', 'Quality 2'], other: ['Weitere Einheit', 'Other session'] };
const extraTitle = e => e.name || T(...EXTRA_NAME[e.type]);
const extraKind = e => e.type === 'easy' || e.type === 'recovery' ? 'easy' : e.type === 'quality' ? 'quality2' : 'extra';
const recoveryDetail = () => hrize(T('sehr locker, 20–40 Min., Zone 1', 'very easy, 20–40 min, Zone 1'));
function normExtras(wk) {
  const raw = Array.isArray(wk.extras) ? wk.extras : isWd(wk.extraDay) ? [{ d: wk.extraDay, type: 'other', name: wk.extraName }] : [];
  return raw.filter(e => isObj(e) && isWd(e.d)).slice(0, 4).map(e => ({ d: e.d, type: EXTRA_TYPES.includes(e.type) ? e.type : 'other', name: typeof e.name === 'string' ? e.name.slice(0, 30) : '' }));
}
function normProfile(p) {
  p = isObj(p) ? p : {}; const d = PROFILE_DEFAULT;
  const hr = isObj(p.hr) ? p.hr : {}, kit = isObj(p.kit) ? p.kit : {}, wk = isObj(p.week) ? p.week : {};
  // Gewichte in 0,5-kg-Schritten (Kettlebells; Kurzhanteln je Hantel)
  const weights = (a, def) => Array.isArray(a) ? [...new Set(a.filter(v => okNum(v, 0.5, 60)).map(v => Math.round(v * 2) / 2))].sort((x, y) => x - y) : def.slice();
  const kb = weights(kit.kb, d.kit.kb), db = weights(kit.db, d.kit.db);
  const bands = Array.isArray(kit.bands) ? [...new Set(kit.bands.filter(v => okNum(v, 1, 200)).map(Math.round))].sort((a, b) => a - b).slice(0, 6) : d.kit.bands.slice();
  const strength = Array.isArray(wk.strength) ? [...new Set(wk.strength.filter(isWd))] : d.week.strength.slice();
  const mods = isObj(p.modules) ? { kraft: p.modules.kraft !== false, laufen: p.modules.laufen !== false, mobility: p.modules.mobility !== false } : { kraft: true, laufen: true, mobility: true };
  if (!mods.kraft && !mods.laufen && !mods.mobility) mods.kraft = true; // mindestens ein Bereich
  const mobDays = Array.isArray(wk.mobility) ? [...new Set(wk.mobility.filter(isWd))] : [];
  return {
    // Was du machst: Kraft, Laufen, Mobility – Abgewähltes verschwindet aus Leiste, Startseite und Profil
    modules: mods,
    // Jahresziel in km je Jahr ({ "2027": 1200 })
    yearKm: isObj(p.yearKm) ? Object.fromEntries(Object.entries(p.yearKm).filter(([y, v]) => /^\d{4}$/.test(y) && Number.isInteger(v) && v >= 50 && v <= 20000)) : {},
    hr: { max: okNum(hr.max, 100, 230) ? Math.round(hr.max) : null, rest: okNum(hr.rest, 30, 120) ? Math.round(hr.rest) : null, z: okZones(hr.z) ? hr.z.map(Math.round) : null },
    kit: { kb, kbDefault: kb.includes(kit.kbDefault) ? kit.kbDefault : kb.includes(KB_DEFAULT) ? KB_DEFAULT : (kb.length ? kb[0] : KB_DEFAULT),
      db, dbDefault: db.includes(kit.dbDefault) ? kit.dbDefault : db.includes(DB_DEFAULT) ? DB_DEFAULT : (db.length ? db[0] : DB_DEFAULT), bands,
      // Urlaub von–bis: alle Pläne nur mit Körpergewicht vorgewählt (im Urlaub dazugeschaltete Geräte gelten nur für den Urlaub)
      vacation: isObj(kit.vacation) && isDay(kit.vacation.from) && isDay(kit.vacation.to) && kit.vacation.from <= kit.vacation.to
        ? { from: kit.vacation.from, to: kit.vacation.to, gear: isObj(kit.vacation.gear) ? { kb: kit.vacation.gear.kb === true, db: kit.vacation.gear.db === true, band: kit.vacation.gear.band === true, bw: kit.vacation.gear.bw !== false } : { kb: false, db: false, band: false, bw: true } } : null },
    week: { group: wk.group === null ? null : isWd(wk.group) ? wk.group : d.week.group, quality: wk.quality === null ? null : isWd(wk.quality) ? wk.quality : d.week.quality, long: wk.long === null ? null : isWd(wk.long) ? wk.long : d.week.long,
      strength,
      // Weitere Einheiten (bis 4): Tag, Art (easy = lockerer Lauf, quality = zweite Qualität, other = anderes wie Rad oder Kurs), Name; bis 1.0 ein Feld extraDay/extraName
      extras: normExtras(wk),
      track: wk.track === true, runner: wk.runner === 'beginner' || wk.runner === 'runner' ? wk.runner : null,
      strengthFixed: Array.isArray(wk.strengthFixed) ? [...new Set(wk.strengthFixed.filter(d => isWd(d) && strength.includes(d)))] : [],
      // fester Kraft-Plan je Krafttag (Wochentag → Plan); fehlt er, gilt der zuletzt genutzte Plan
      strengthPlan: isObj(wk.strengthPlan) ? Object.fromEntries(Object.entries(wk.strengthPlan).filter(([d, pk]) => strength.includes(Number(d)) && typeof pk === 'string' && (PLANS[pk] || pk === 'gym'))) : {},
      // „Gym/Kurs“ je Krafttag mit eigenem Namen (z. B. Blaze)
      // Mobility-Tage mit Routine je Tag (sonst die zuletzt genutzte)
      mobility: mobDays,
      mobilityPlan: isObj(wk.mobilityPlan) ? Object.fromEntries(Object.entries(wk.mobilityPlan).filter(([d, id]) => mobDays.includes(Number(d)) && typeof id === 'string' && MOBILITY.routines.some(r => r.id === id))) : {},
      gymNames: isObj(wk.gymNames) ? Object.fromEntries(Object.entries(wk.gymNames).filter(([d, n]) => isObj(wk.strengthPlan) && wk.strengthPlan[d] === 'gym' && strength.includes(Number(d)) && typeof n === 'string' && n.trim()).map(([d, n]) => [d, n.trim().slice(0, 30)])) : {} }
  };
}
// Unbekannte Felder (z. B. aus einer neueren Version) bleiben beim Speichern erhalten
const profileRaw = load(KEYS.profile, null);
const profileExtra = isObj(profileRaw) ? Object.fromEntries(Object.entries(profileRaw).filter(([k]) => !['hr', 'kit', 'week', 'yearKm', 'modules'].includes(k))) : {};
// Bis v35 galten ohne gespeicherte Geräte 12 kg und Bänder 10/20/30. Wer schon Daten hat, behält diesen Stand.
const LEGACY_KIT = { kb: [KB_DEFAULT], kbDefault: KB_DEFAULT, bands: [10, 20, 30] };
const kitMissing = !(isObj(profileRaw) && isObj(profileRaw.kit)), hadData = (() => { try { return [KEYS.entries, KEYS.gear, KEYS.choice, KEYS.plan, KEYS.session].some(k => localStorage.getItem(k) !== null); } catch (e) { return false; } })();
let profile = normProfile(kitMissing && hadData ? Object.assign({}, profileRaw, { kit: LEGACY_KIT }) : profileRaw);
function persistProfile() { profile = normProfile(profile); if (!store(KEYS.profile, Object.assign({}, profileExtra, profile))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); }
if (kitMissing && hadData) persistProfile();
// Bänder: einzeln und je zwei kombiniert (z. B. „10+30“)
function bandOptions() {
  const b = profile.kit.bands.map(String), out = b.slice();
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) out.push(b[i] + '+' + b[j]);
  return out.length ? out : BANDS;
}
const hrZonesFrom = (max, rest) => HR_PCT.map(p => Math.round(rest + p * (max - rest)));
function zoneRange(n) {
  const z = profile.hr.z; if (!z || n < 1 || n > 5) return null;
  return n < 5 ? `${z[n - 1]}–${z[n] - 1} bpm` : T(`ab ${z[4]} bpm`, `from ${z[4]} bpm`);
}
// „Zone 2“ im Text um die eigenen bpm ergänzen
const hrize = t => String(t).replace(/[Zz]one ([1-5])(?! \()/g, (m, n) => { const r = zoneRange(Number(n)); return r ? `${m} (${r})` : m; });

const slotKey = (pk, sl) => pk + '.' + sl.id;
function validKg(v) { const n = Number(v); return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= 0 && n <= 60 ? n : KB_DEFAULT; }
// Gewählte Geräte in der Rangfolge der Wirksamkeit; gibt es keine passende Variante, bleibt Körpergewicht (geht immer)
// Nur Geräte, die im Profil eingetragen sind (Körpergewicht geht immer)
const owns = g => g === 'bw' || (g === 'kb' ? profile.kit.kb.length > 0 : g === 'db' ? profile.kit.db.length > 0 : g === 'band' ? profile.kit.bands.length > 0 : false);
// Reine Kettlebell-Pläne nur mit Kettlebell im Profil – und im Urlaub nur, wenn sie dort dazugeschaltet ist
// Hotel nur im Urlaub; Kettlebell-Pläne nur mit Kettlebell (im Urlaub nur, wenn sie für den Urlaub dazugeschaltet ist)
const planOwned = pk => PLANS[pk].vacationOnly ? !!vacation() : !PLANS[pk].kbOnly || (owns('kb') && (!vacation() || vacation().gear.kb));
function availableGears(sl, pk) {
  if (pk && PLANS[pk].kbOnly) return ['kb'];
  const pg = planGear(pk || plan), act = ['kb', 'db', 'band', 'bw'].filter(g => pg[g] && owns(g)); if (!act.length) act.push('bw');
  return (sl.order || ['kb', 'db', 'band', 'bw']).filter(g => sl.v[g] && act.includes(g));
}
const LVL_LABEL = { leicht: T('leicht', 'easy'), mittel: T('mittel', 'medium'), schwer: T('schwer', 'hard') };
function resolve(pk, sl) {
  const avail = availableGears(sl, pk), c = isObj(choices[slotKey(pk, sl)]) ? choices[slotKey(pk, sl)] : {};
  // Ersatz nur, wenn es die Übung mit Geräten gäbe, aber nicht mit den gewählten; reine Körpergewicht-Übungen gehen immer
  const bwOnly = Object.keys(sl.v).every(k => k === 'bw'), fallback = !avail.length && !bwOnly, auto = !avail.includes(c.pref);
  const g = !auto ? c.pref : (avail[0] || (sl.v.bw ? 'bw' : Object.keys(sl.v)[0]));
  if (!avail.length) avail.push(g);
  const [name, reps, baseNote] = sl.v[g];
  // Körpergewicht in drei Stufen (nicht bei Übungen mit eigenen Stufen); mittel = wie beschrieben
  const lvls = g === 'bw' && !sl.stages && BW_LEVELS[name] ? BW_LEVELS[name] : null, lvl = lvls && ['leicht', 'schwer'].includes(c.lvl) ? c.lvl : 'mittel';
  const note = lvls && lvl !== 'mittel' ? tr(lvls[lvl === 'leicht' ? 0 : 1]) : baseNote;
  // Gewicht je Übung: Kettlebell (kg) und Kurzhantel (dbkg, je Hantel) getrennt gespeichert
  const kk = g === 'db' ? 'dbkg' : 'kg', bo = bandOptions(), kg = c[kk] === undefined || c[kk] === null ? (g === 'db' ? profile.kit.dbDefault : profile.kit.kbDefault) : validKg(c[kk]);
  const band = bo.includes(String(c.band)) ? String(c.band) : bo.includes(sl.band || '20') ? (sl.band || '20') : bo[0];
  const gearText = (g === 'kb' ? (kg > 0 ? `Kettlebell ${kgText(kg)} kg` : T('Kettlebell ohne Gewicht', 'Kettlebell without weight')) : g === 'db' ? dbText(kg, dbPair(name)) : g === 'band' ? bandLabel(band) : T('Körpergewicht', 'Body weight') + (lvls && lvl !== 'mittel' ? ' · ' + LVL_LABEL[lvl] : '')) + (fallback ? T(' (Ersatz)', ' (substitute)') : '');
  const cfg = g === 'kb' || g === 'db' ? g + ':' + kg : g === 'band' ? 'band:' + band : 'bw' + (lvl !== 'mittel' ? ':' + lvl : '');
  return { slot: sl, g, name, reps, note, kg, band, gearText, cfg, avail, auto, fallback, lvls, lvl };
}
function stageOf(pk, sl) { if (!sl.stages) return null; const s = stages[slotKey(pk, sl)]; return sl.stages.includes(s) ? s : sl.stages[0]; }
/* Reihenfolge nach Position: erst alles im Stehen, dann Knien/Sitzen/Vierfüßler, zum Schluss liegend – nicht ständig hinlegen und aufstehen.
   Innerhalb einer Position bleibt die geplante Reihenfolge (Muskelgruppen wechseln weiter ab). Hängt von der gewählten Variante ab.
   Nicht im Sätze-Plan (Läufer): dort gelten Blöcke und „Zuletzt“ je Platz. */
const POSE_KNEEL = ['Bird Dog', 'Brustwirbel-Rotation im Vierfüßlerstand', 'Clean & Press im halben Kniestand', 'Pullover im Kniestand', 'Übergabe im Grätschsitz', 'Wrestler-Halo'];
const POSE_LIE = ['Clamshells', 'Clamshells mit Band', 'Dead Bug', 'Dead Bug mit Band', 'Dead Bug mit Kettlebell', 'Dead Bug mit Kurzhantel', 'Floor Press', 'Floor Press mit Kurzhanteln', 'Pullover mit Kurzhantel', 'Squeeze Press mit Kurzhanteln', 'Hüftheben', 'Hüftheben mit Band', 'Kettlebell-Pullover',
  'Schwimmer in Bauchlage', 'Seitstütz', 'Squeeze Press am Boden', 'Unterarmstütz', 'Y-T-W in Bauchlage'];
const poseOf = name => POSE_LIE.includes(name) ? 2 : POSE_KNEEL.includes(name) ? 1 : 0;
const exList = (pk = plan) => {
  const l = PLANS[pk].slots.map(sl => resolve(pk, sl));
  return isSets(pk) ? l : l.map((x, i) => [x, i]).sort((a, b) => poseOf(a[0].name) - poseOf(b[0].name) || a[1] - b[1]).map(a => a[0]);
};
const isSets = (pk = plan) => PLANS[pk].mode === 'sets';
const isTabata = (pk = plan) => PLANS[pk].mode === 'tabata';
const isEmomPlan = (pk = plan) => PLANS[pk].mode === 'emom';
const isInterval = (pk = plan) => isTabata(pk) || isEmomPlan(pk);
function tabataCfg() { const c = isObj(choices['tabata.cfg']) ? choices['tabata.cfg'] : {}; return { rounds: TABATA_ROUNDS.includes(c.rounds) ? c.rounds : TABATA_DEFAULT.rounds, blockRest: TABATA_RESTS.includes(c.blockRest) ? c.blockRest : TABATA_DEFAULT.blockRest, work: 20, rest: 10 }; }
let tbCache = { key: '', seg: [] };
function tabataSegments() {
  const c = tabataCfg(), n = PLANS.tabata.slots.length, key = c.rounds + '/' + c.blockRest;
  if (tbCache.key === key) return tbCache.seg;
  // Zirkel: Runde für Runde alle Übungen (20″ Arbeit, 10″ Pause), nach der letzten Übung einer Runde die Rundenpause
  const seg = []; let t = 0;
  for (let r = 0; r < c.rounds; r++) {
    for (let b = 0; b < n; b++) {
      seg.push({ type: 'work', block: b, round: r, start: t, end: t + c.work }); t += c.work;
      if (b < n - 1) { seg.push({ type: 'rest', block: b, round: r, start: t, end: t + c.rest }); t += c.rest; }
    }
    if (r < c.rounds - 1) { seg.push({ type: 'blockrest', block: n - 1, round: r, start: t, end: t + c.blockRest }); t += c.blockRest; }
  }
  tbCache = { key, seg }; return seg;
}
function emomCfg(pk = plan) { const c = isObj(choices[pk + '.cfg']) ? choices[pk + '.cfg'] : {}; return { rounds: EMOM_ROUNDS.includes(c.rounds) ? c.rounds : EMOM_DEFAULT.rounds, work: 60 }; }
const intervalCfg = (pk = plan) => isTabata(pk) ? tabataCfg() : emomCfg(pk);
// EMOM: jede Minute die nächste Übung, Runde für Runde (Übung 1, 2, 3, 1, 2, 3, …)
let emCache = { key: '', seg: [] };
function emomSegments(pk) {
  const c = emomCfg(pk), n = PLANS[pk].slots.length, key = pk + '/' + c.rounds;
  if (emCache.key === key) return emCache.seg;
  const seg = []; let t = 0;
  for (let r = 0; r < c.rounds; r++) for (let b = 0; b < n; b++) { seg.push({ type: 'work', block: b, round: r, start: t, end: t + c.work }); t += c.work; }
  emCache = { key, seg }; return seg;
}
const segments = (pk = plan) => isTabata(pk) ? tabataSegments() : emomSegments(pk);
const workTotal = (pk = plan) => segments(pk).filter(x => x.type === 'work').length;
function phaseSecs(pk, i) { return isInterval(pk) && i === 1 ? segments(pk).at(-1).end : PLANS[pk].durations[i] * 60; }
// Kurzhanteln: Übungen „… mit Kurzhanteln“ (Mehrzahl) brauchen zwei gleiche Hanteln, „… mit Kurzhantel“/„Kurzhantel-Swing“ eine
const dbPair = name => /Kurzhanteln$/.test(name);
const dbText = (kg, pair) => pair ? T(`Kurzhanteln 2 × ${kgText(kg)} kg`, `Dumbbells 2 × ${kgText(kg)} kg`) : T(`Kurzhantel ${kgText(kg)} kg`, `Dumbbell ${kgText(kg)} kg`);
const cfgText = c => !c ? '' : c === 'bw' ? T('Körpergewicht', 'Body weight') : /^bw:(leicht|schwer)$/.test(c) ? T('Körpergewicht', 'Body weight') + ' · ' + LVL_LABEL[c.slice(3)] : c.startsWith('kb:') || c.startsWith('db:') ? kgText(c.slice(3)) + ' kg' : c.startsWith('band:') ? bandLabel(c.slice(5)) : c;

/* ---------- Einträge & Vergleichbarkeit ---------- */
function validEntry(e) {
  if (!isObj(e) || !Object.prototype.hasOwnProperty.call(PLANS, e.plan) || typeof e.date !== 'string' || !Number.isInteger(e.total) || e.total < 0 || e.total >= 10000) return false;
  if (e.mode === 'sets') return e.v >= 3 ? Array.isArray(e.sets) && e.sets.every(Array.isArray) : isObj(e.sets);
  return true;
}
const entriesLoaded = loadList(KEYS.entries, validEntry);
let saved = entriesLoaded.ok; const savedKeep = entriesLoaded.keep;
function persistEntries() { if (!store(KEYS.entries, saved.concat(savedKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
function entryCount(e) { if (e.v >= 3 && Array.isArray(e.cfg)) return e.cfg.length; return Number.isInteger(e.exerciseCount) && e.exerciseCount > 0 ? e.exerciseCount : (e.plan === 'wed' ? 11 : e.plan === 'sun' ? 6 : 7); }
function legacyCfg(e) {
  const w = n => { const v = e.weights && e.weights[n], x = Number(v); return v !== undefined && v !== null && Number.isFinite(x) ? x : KB_DEFAULT; };
  return PLANS.wed.slots.map(sl => {
    const m = LEGACY_WED[sl.id];
    if (m[0] === 'bw') return 'bw';
    if (m[0] === 'kb') return 'kb:' + w(m[1]);
    const v = (e.equipment && e.equipment[m[1]]) || m[2];
    if (v === 'kb') return 'kb:' + w(m[1]);
    const b = String(v).replace('band', '');
    return BANDS.includes(b) ? 'band:' + b : 'kb:' + w(m[1]);
  });
}
// Vergleichbar unabhängig von der Reihenfolge (Zirkel werden nach Position sortiert); Sätze-Plan bleibt je Platz
const sigCfg = (pk, c) => (PLANS[pk] && isSets(pk) ? c : c.slice().sort()).join(',');
function entrySig(e) {
  if (e.v >= 3 && Array.isArray(e.cfg)) return e.plan + '|' + e.cfg.length + '|' + sigCfg(e.plan, e.cfg) + (Array.isArray(e.stages) ? '|' + e.stages.join(',') : '');
  const n = entryCount(e);
  if (e.plan === 'wed' && n === PLANS.wed.slots.length) return 'wed|' + n + '|' + sigCfg('wed', legacyCfg(e));
  return e.plan + '|' + n + '|legacy';
}
function currentCfg(pk = plan) {
  const c = exList(pk).map(x => x.cfg);
  if (isTabata(pk)) { const t = tabataCfg(); c.push('rounds:' + t.rounds, 'pause:' + t.blockRest, 'zirkel'); }
  else if (isEmomPlan(pk)) c.push('rounds:' + emomCfg(pk).rounds);
  return c;
}
function currentSig(pk = plan) {
  const c = currentCfg(pk);
  return pk + '|' + c.length + '|' + sigCfg(pk, c) + (isSets(pk) ? '|' + PLANS[pk].slots.map(sl => stageOf(pk, sl) || '').join(',') : '');
}
const comparable = e => entrySig(e) === currentSig(e.plan);
const SHORT = EN ? { 'Split Squat': 'Split', 'Einarmiges Rudern': 'Row', 'Rudern mit Band': 'Row', 'Y-T-W in Bauchlage': 'Y-T-W', 'Brustdrücken mit Band': 'Press', 'Liegestütze erhöht': 'Push-ups', 'Einbeiniges Wadenheben': 'Calves', 'Einbeiniges Kreuzheben': 'SL deadlift', 'Suitcase March': 'March', 'Kettlebell-Swing': 'Swing', 'Kettlebell-Swing (beidarmig)': 'Swing', 'Hüftheben mit Band': 'Bridge', 'Split Squat mit Kurzhanteln': 'Split', 'Einarmiges Rudern mit Kurzhantel': 'Row', 'Floor Press mit Kurzhanteln': 'Floor press', 'Einbeiniges Wadenheben mit Kurzhantel': 'Calves', 'Einbeiniges Kreuzheben mit Kurzhantel': 'SL deadlift', 'Suitcase March mit Kurzhantel': 'March', 'Kurzhantel-Swing': 'Swing' } : { 'Split Squat': 'Split', 'Einarmiges Rudern': 'Rudern', 'Rudern mit Band': 'Rudern', 'Y-T-W in Bauchlage': 'Y-T-W', 'Brustdrücken mit Band': 'Drücken', 'Liegestütze erhöht': 'Liegest.', 'Einbeiniges Wadenheben': 'Waden', 'Einbeiniges Kreuzheben': 'EB-Kreuzh.', 'Suitcase March': 'March', 'Kettlebell-Swing': 'Swing', 'Kettlebell-Swing (beidarmig)': 'Swing', 'Hüftheben mit Band': 'Hüftheben', 'Split Squat mit Kurzhanteln': 'Split', 'Einarmiges Rudern mit Kurzhantel': 'Rudern', 'Floor Press mit Kurzhanteln': 'Floor Press', 'Einbeiniges Wadenheben mit Kurzhantel': 'Waden', 'Einbeiniges Kreuzheben mit Kurzhantel': 'EB-Kreuzh.', 'Suitcase March mit Kurzhantel': 'March', 'Kurzhantel-Swing': 'Swing' };
const shortName = n => SHORT[n] || tr(n);
function resultText(e) {
  if (e.mode === 'sets') {
    const parts = e.v >= 3 ? e.sets.map((r, i) => `${shortName((e.names && e.names[i]) || '?')} ${r.map(x => x ?? '–').join('/')}`)
      : Object.entries(e.sets).map(([n, x]) => `${shortName(n)} ${(x.reps || []).map(r => r ?? '–').join('/')}`);
    return parts.join(' · ') + ` · Σ ${e.total} ${T('Wdh.', 'reps')}`;
  }
  if (e.mode === 'tabata' || e.mode === 'emom') { const r = (e.cfg || []).find(c => String(c).startsWith('rounds:')); return T(`${e.total} von ${e.of} ${e.mode === 'emom' ? 'Minuten' : 'Intervallen'}${e.total >= e.of ? ' · komplett' : ''}${r ? ' · ' + r.slice(7) + ' Runden' : ''}`, `${e.total} of ${e.of} ${e.mode === 'emom' ? 'minutes' : 'intervals'}${e.total >= e.of ? ' · complete' : ''}${r ? ' · ' + r.slice(7) + ' rounds' : ''}`); }
  const n = entryCount(e);
  return T(`${Math.floor(e.total / n)} Runden + ${e.total % n} Übungen`, `${Math.floor(e.total / n)} rounds + ${e.total % n} exercises`);
}

/* ---------- Ton, Sprachansagen & Wake Lock ---------- */
let soundEnabled = load(KEYS.sound, true) !== false;
let audioOpt = load(KEYS.audio, {}); if (!isObj(audioOpt)) audioOpt = {};
audioOpt = { voice: audioOpt.voice !== false, loud: audioOpt.loud === true };
// iPhone (Audio Session API): „playback“ klingt auch bei Stummschalter, kann aber laufende Musik unterbrechen – daher nur auf Wunsch
const hasAudioSession = () => 'audioSession' in navigator;
function applyAudioSession() { try { if (hasAudioSession()) navigator.audioSession.type = audioOpt.loud ? 'playback' : 'auto'; } catch (e) { } }
applyAudioSession();
let audioCtx = null;
function audioReady() { if (!soundEnabled) return; applyAudioSession(); try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { }); } catch (e) { } primeSpeech(); }
// Sprachansagen nur mit Stimmen, die auf dem Gerät laufen (localService) – Online-Stimmen würden Text an fremde Server schicken
let voice = null, speechPrimed = false, sayTimer = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => v.localService), lang = v => String(v.lang).replace('_', '-').toLowerCase();
    voice = EN ? vs.find(v => lang(v) === 'en-gb' && v.default) || vs.find(v => lang(v).startsWith('en') && v.default) || vs.find(v => lang(v) === 'en-gb') || vs.find(v => lang(v) === 'en-us') || vs.find(v => lang(v).startsWith('en')) || null
      : vs.find(v => lang(v) === 'de-de' && v.default) || vs.find(v => lang(v) === 'de-de') || vs.find(v => lang(v).startsWith('de')) || null;
  } catch (e) { voice = null; }
  if (typeof renderAudioRows === 'function') renderAudioRows();
}
const speechOk = () => 'speechSynthesis' in window && !!voice;
const speakable = t => EN ? String(t)
  .replace(/(\d+):(\d{2})\s*min\b/g, (_, m, s) => `${m} ${m === '1' ? 'minute' : 'minutes'}${s === '00' ? '' : ' ' + Number(s)}`)
  .replace(/(\d)\s*[–-]\s*(\d)/g, '$1 to $2').replace(/\bsec\b/g, 'seconds').replace(/\bmin\b/g, 'minutes').replace(/\breps\b/g, 'reps')
  .replace(/(\d)\s*m\b/g, '$1 metres').replace(/(\d)\s*kg\b/g, '$1 kilos').replace(/\s*×\s*/g, ' times ').replace(/\s*·\s*/g, ', ').replace(/\s&\s/g, ' and ').replace(/([a-z])\/([a-z])/gi, '$1 and $2')
  : String(t)
  .replace(/(\d+):(\d{2})\s*Min\./g, (_, m, s) => `${m} ${m === '1' ? 'Minute' : 'Minuten'}${s === '00' ? '' : ' ' + Number(s)}`)
  .replace(/(\d)\s*[–-]\s*(\d)/g, '$1 bis $2').replace(/\bSek\./g, 'Sekunden').replace(/\bMin\./g, 'Minuten').replace(/\bWdh\./g, 'Wiederholungen')
  .replace(/(\d)\s*m\b/g, '$1 Meter').replace(/(\d)\s*kg\b/g, '$1 Kilo').replace(/\s*×\s*/g, ' mal ').replace(/\s*·\s*/g, ', ').replace(/\s&\s/g, ' und ').replace(/([a-zäöü])\/([a-zäöü])/gi, '$1 und $2');
// iOS spricht erst, nachdem die erste Ansage durch ein Antippen ausgelöst wurde
function primeSpeech() { if (speechPrimed || !audioOpt.voice || !speechOk()) return; try { const u = new SpeechSynthesisUtterance(' '); u.voice = voice; u.volume = 0; speechSynthesis.speak(u); speechPrimed = true; } catch (e) { } }
function say(text, delay = 350) {
  if (!soundEnabled || !audioOpt.voice || !speechOk() || !text) return;
  const go = () => { try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(speakable(text)); u.voice = voice; u.lang = voice.lang; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { } };
  clearTimeout(sayTimer);
  if (delay > 0) sayTimer = setTimeout(go, delay); else go();
}
if ('speechSynthesis' in window) { pickVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { } }
function tone(freq, dur = 0.11, delay = 0, vol = 0.2) {
  if (!soundEnabled || !audioCtx) return;
  const t = audioCtx.currentTime + delay, o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.01);
}
function cue(kind) {
  if (!soundEnabled) return;
  if (kind === 'count') tone(760, 0.085);
  else if (kind === 'step') { tone(900, 0.11); tone(1120, 0.15, 0.13); }
  else if (kind === 'phase') { tone(760, 0.13); tone(980, 0.13, 0.18); tone(1180, 0.2, 0.36); }
  else if (kind === 'work') { tone(880, 0.12); tone(1320, 0.22, 0.14); }
  else if (kind === 'rest') tone(520, 0.3);
  else if (kind === 'finish') { tone(740, 0.15); tone(930, 0.15, 0.2); tone(1175, 0.4, 0.42); }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on) { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
    else if (wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) { wakeLock = null; }
}

/* ---------- Trainingszustand ---------- */
let plan = PLANS[load(KEYS.plan, 'wed')] ? load(KEYS.plan, 'wed') : 'wed';
let phase = 0, elapsed = 0, running = false, startedAt = 0, completions = 0, sessionSaved = false, timed = null, emom = null, runReps = {}, tabataDone = 0, tbBlock = -1;
let lastScene = null, lastSecond = null, phaseCueSecond = null, timedPick = {};

function parseStep(label) { const m = label.match(/^(\d+):(\d+)(?:\s*×\s*(\d+))?/); return { seconds: Number(m[1]) * 60 + Number(m[2]), times: Number(m[3] || 1) }; }
function buildSteps(items) {
  let at = 0; const out = [];
  items.forEach(([d, name], group) => { const p = parseStep(d); for (let part = 0; part < p.times; part++) { out.push({ name: tr(name) + (p.times === 2 ? (part === 0 ? T(' · links', ' · left') : T(' · rechts', ' · right')) : ''), base: name, group, part, parts: p.times, start: at, end: at + p.seconds }); at += p.seconds; } });
  return out;
}
const STEPS = Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { warmup: buildSteps(p.warmup), cooldown: buildSteps(p.cooldown) }]));
const durationSecs = () => phaseSecs(plan, phase);
// Welche Übung das Intervall gerade zeigt: Arbeit = diese, Pause = die nächste (Tabata-Zirkel), Rundenpause = die erste
const segShown = sg => sg.type === 'work' ? sg.block : sg.type === 'blockrest' ? (isTabata() ? 0 : sg.block + 1) : isTabata() ? sg.block + 1 : sg.block;
function currentSeg() { const t = secNow(), sg = segments(); return sg.find(x => t < x.end) || sg.at(-1); }
const workDoneAt = t => segments().filter(x => x.type === 'work' && x.end <= t + 0.01).length;
const secNow = () => running ? elapsed + (Date.now() - startedAt) / 1000 : elapsed;
const isFinished = () => phase === 2 && !running && elapsed >= durationSecs();
function currentStep() { const st = phase === 0 ? STEPS[plan].warmup : STEPS[plan].cooldown, t = secNow(); return st.find(s => t < s.end) || st[st.length - 1]; }
function emptyReps(pk) { return isSets(pk) ? Object.fromEntries(PLANS[pk].slots.map(sl => [sl.id, Array(sl.sets).fill('')])) : {}; }
const hasReps = () => Object.values(runReps).some(a => a.some(v => v !== ''));
const sessionActive = () => !sessionSaved && (running || elapsed > 0 || phase > 0 || completions > 0 || hasReps());
const mainName = () => isTabata() ? 'Tabata' : isEmomPlan() ? 'EMOM' : isSets() ? T('Kraftteil', 'Strength part') : T('Zirkel', 'Circuit');
function resetCues() { lastScene = null; lastSecond = null; phaseCueSecond = null; }
function resetState() { tabataDone = 0; tbBlock = -1; phase = 0; elapsed = 0; running = false; startedAt = 0; completions = 0; sessionSaved = false; timed = null; emom = null; runReps = emptyReps(plan); resetCues(); keepAwake(false); }
runReps = emptyReps(plan);

// Laufende Einheit sichern, damit ein Neuladen oder Schließen der App nichts verliert
function persistSession() {
  if (!sessionActive()) { try { localStorage.removeItem(KEYS.session); } catch (e) { } return; }
  store(KEYS.session, { plan, phase, elapsed, running, startedAt, completions, timed, emom, runReps, tabataDone, at: Date.now() });
}
function restoreSession() {
  const s = load(KEYS.session, null);
  if (!isObj(s) || !PLANS[s.plan] || Date.now() - Number(s.at || 0) > 6 * 3600e3) return false;
  plan = s.plan; phase = [0, 1, 2].includes(s.phase) ? s.phase : 0; elapsed = Number(s.elapsed) || 0; running = !!s.running; startedAt = Number(s.startedAt) || Date.now();
  completions = Number.isInteger(s.completions) ? s.completions : 0; timed = isObj(s.timed) ? s.timed : null; emom = isObj(s.emom) ? s.emom : null;
  tabataDone = Number.isInteger(s.tabataDone) ? s.tabataDone : 0;
  runReps = emptyReps(plan);
  if (isObj(s.runReps)) for (const k of Object.keys(runReps)) if (Array.isArray(s.runReps[k])) runReps[k] = runReps[k].map((_, i) => String(s.runReps[k][i] ?? ''));
  return sessionActive();
}

/* ---------- Ablauf ---------- */
// Ansagen: Phase mit erster Übung, jeder Schritt, Seitenwechsel, Rundenende
const stepSpeech = s => s.part === 1 ? T('Seitenwechsel', 'Switch sides') : tr(s.base) + (s.parts === 2 ? T(', links beginnen', ', start left') : '');
function phaseSpeech() {
  if (phase === 1) {
    const x = exList()[0];
    if (isTabata()) return T(`Tabata. ${x.name}. Los!`, `Tabata. ${tr(x.name)}. Go!`);
    if (isEmomPlan()) return T(`EMOM, ${Math.round(durationSecs() / 60)} Minuten. Erste Übung: ${x.name}, ${x.reps}.`, `EMOM, ${Math.round(durationSecs() / 60)} minutes. First exercise: ${tr(x.name)}, ${tr(x.reps)}.`);
    if (isSets()) return T(`Kraftteil. Erste Übung: ${x.name}, ${x.reps}.`, `Strength part. First exercise: ${tr(x.name)}, ${tr(x.reps)}.`);
    return T(`Zirkel, ${Math.round(durationSecs() / 60)} Minuten. Erste Übung: ${x.name}, ${x.reps}.`, `Circuit, ${Math.round(durationSecs() / 60)} minutes. First exercise: ${tr(x.name)}, ${tr(x.reps)}.`);
  }
  return (phase === 0 ? T('Aufwärmen. ', 'Warm-up. ') : 'Cooldown. ') + stepSpeech(currentStep());
}
function signalCountdown(id, remaining, speech) {
  if (lastScene !== id) { if (lastScene !== null) { cue('step'); if (speech) say(speech); } lastScene = id; lastSecond = null; }
  const sec = Math.ceil(remaining);
  if (sec !== lastSecond) { lastSecond = sec; if (running && sec >= 1 && sec <= 3) cue('count'); }
}
function tick() {
  if (!running) return;
  let guard = 0;
  while (running && secNow() >= durationSecs() && guard++ < 4) {
    const over = secNow() - durationSecs();
    if (phase === 2) { elapsed = durationSecs(); running = false; timed = null; emom = null; cue('finish'); keepAwake(false); persistSession(); renderPhase(); if (isInterval()) { say(T('Training geschafft.', 'Workout done.'), 900); saveSession(localDay()); } else { say(T('Training geschafft. Jetzt speichern.', 'Workout done. Save it now.'), 900); toast(T('Training geschafft – jetzt speichern.', 'Workout done – save it now.')); } return; }
    if (phase === 1 && isInterval()) tabataDone = workTotal();
    phase++; timed = null; emom = null; elapsed = Math.max(0, over); startedAt = Date.now(); resetCues(); cue('phase'); say(phaseSpeech(), 650);
    toast(phase === 1 ? T(mainName() + ' läuft.', mainName() + ' running.') : T('Jetzt Cooldown.', 'Cooldown now.'));
    persistSession(); renderPhase(); renderList();
  }
  if (phase !== 1) { const s = currentStep(); signalCountdown(phase + '-' + s.group + '-' + s.start, s.end - secNow(), stepSpeech(s)); }
  else if (isInterval()) {
    const sg = currentSeg(), id = 'tb-' + sg.start;
    if (lastScene !== id) {
      if (lastScene !== null) {
        cue(sg.type === 'work' ? 'work' : 'rest');
        const ex = exList(), last = intervalCfg().rounds - 1;
        if (isEmomPlan()) say((sg.block === 0 ? (sg.round === last ? T('Letzte Runde. ', 'Last round. ') : T(`Runde ${sg.round + 1}. `, `Round ${sg.round + 1}. `)) : '') + `${tr(ex[sg.block].name)}, ${tr(ex[sg.block].reps)}`);
        else if (sg.type === 'blockrest') say((sg.round + 1 === last ? T('Pause. Letzte Runde. ', 'Rest. Last round. ') : T(`Pause. Runde ${sg.round + 2}. `, `Rest. Round ${sg.round + 2}. `)) + T('Als Nächstes: ', 'Next: ') + tr(ex[0].name));
        else if (sg.type === 'rest') say(T('Als Nächstes: ', 'Next: ') + tr(ex[sg.block + 1].name));
        else if (sg.type === 'work') say(T('Los!', 'Go!'));
      }
      lastScene = id; lastSecond = null; if (sg.block !== tbBlock) { tbBlock = sg.block; renderList(); }
    }
    const sec = Math.ceil(sg.end - secNow());
    if (sec !== lastSecond) { lastSecond = sec; if (sec >= 1 && sec <= 3) cue('count'); }
  }
  else {
    const rem = Math.ceil(durationSecs() - secNow());
    if (rem !== phaseCueSecond) { phaseCueSecond = rem; if (rem >= 1 && rem <= 3) cue('count'); if (rem === 60) say(T('Noch eine Minute.', 'One minute left.'), 0); }
    if (timed) {
      const pr = Math.max(0, secNow() - timed.start), seg = Math.min(timed.sides - 1, Math.floor(pr / timed.seconds));
      if (pr >= timed.seconds * timed.sides) { cue('step'); timed = null; finishExercise(true); toast(T('✓ Zeitübung geschafft und gezählt.', '✓ Timed exercise done and counted.')); }
      else signalCountdown('t-' + timed.index + '-' + seg, (seg + 1) * timed.seconds - pr, T('Seitenwechsel', 'Switch sides'));
    }
    if (emom) {
      const pr = Math.max(0, secNow() - emom.start);
      if (pr >= emom.minutes * 60) { emom = null; cue('finish'); say(T('EMOM fertig. Wiederholungen eintragen.', 'EMOM done. Enter your reps.'), 900); toast(T('✓ EMOM fertig – Wiederholungen eintragen.', '✓ EMOM done – enter your reps.')); persistSession(); renderEmom(); }
      else { const m = Math.floor(pr / 60); signalCountdown('e-' + m, (m + 1) * 60 - pr, T('Minute ', 'Minute ') + (m + 1)); }
    }
  }
  updateClock(); guideSync();
}
function play() {
  if (sessionSaved) return;
  if (isFinished()) { saveSession(localDay()); return; }
  if (running) { elapsed = secNow(); running = false; keepAwake(false); toast(T('Pausiert.', 'Paused.')); }
  else { audioReady(); startedAt = Date.now(); running = true; if (elapsed === 0 && phase === 0) { cue('phase'); say(phaseSpeech(), 650); } keepAwake(true); }
  persistSession(); renderControls(); renderCurrent(); renderEmom(); tick();
}
function skip() {
  if (sessionSaved || isFinished()) return;
  audioReady();
  if (phase === 2) { elapsed = durationSecs(); running = false; timed = null; emom = null; cue('finish'); keepAwake(false); persistSession(); renderPhase(); toast(T('Training beendet – jetzt speichern.', 'Workout finished – save it now.')); return; }
  if (phase === 1 && isInterval()) tabataDone = workDoneAt(secNow());
  phase++; elapsed = 0; startedAt = Date.now(); timed = null; emom = null; resetCues(); cue('phase'); if (running) say(phaseSpeech(), 650);
  toast(phase === 1 ? T(mainName() + ' gestartet.', mainName() + ' started.') : T('Jetzt kommt das Cooldown.', 'Cooldown is next.'));
  persistSession(); renderPhase(); renderList();
}
function resetTraining() {
  if (sessionActive() && !confirm(T('Aktuelles Training zurücksetzen? Nicht gespeicherte Fortschritte gehen verloren.', 'Reset the current workout? Unsaved progress will be lost.'))) return;
  resetState(); persistSession(); renderAll();
}
function setPlan(p) {
  if (p === plan || !PLANS[p]) return;
  if (sessionActive() && !confirm(T('Zum anderen Plan wechseln? Der aktuelle, nicht gespeicherte Durchgang geht verloren.', 'Switch to the other plan? The current unsaved session will be lost.'))) return;
  plan = p; store(KEYS.plan, p); resetState(); persistSession(); renderAll(); window.scrollTo({ top: 0 });
}
function finishExercise(fromTimer) {
  if (isSets() || isInterval() || phase !== 1 || sessionSaved || (timed && !fromTimer)) return;
  completions++; resetCues();
  const ex = exList(), n = ex.length, nx = ex[completions % n];
  if (!fromTimer) toast(completions % n === 0 ? T('🎉 Runde ' + completions / n + ' geschafft!', '🎉 Round ' + completions / n + ' done!') : '✓ ' + tr(ex[(completions - 1) % n].name));
  say((completions % n === 0 ? T(`Runde ${completions / n} geschafft. `, `Round ${completions / n} done. `) : '') + `${tr(nx.name)}, ${tr(nx.reps)}`, fromTimer ? 350 : 0);
  persistSession(); renderList(); renderCurrent(); renderControls(); renderStats();
}
function undo() {
  if (isSets() || isInterval() || completions < 1 || sessionSaved || timed) return;
  completions--; persistSession(); renderList(); renderCurrent(); renderControls(); renderStats(); toast(T('Letzte Übung zurückgenommen.', 'Last exercise undone.'));
}
function timedParams(reps) { const m = String(reps).match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*Sek\./); return m ? { min: Number(m[1]), max: Number(m[2] || m[1]), sides: /je Seite/.test(reps) ? 2 : 1 } : null; }
function startTimed() {
  if (phase !== 1 || !running || timed || isSets()) return;
  const ex = exList(), off = completions % ex.length, tp = timedParams(ex[off].reps); if (!tp) return;
  audioReady();
  const secs = tp.min === tp.max ? tp.min : Number($('timedlength').value) || tp.max;
  timed = { index: completions, seconds: secs, sides: tp.sides, start: secNow() }; resetCues(); cue('step'); say(tp.sides === 2 ? T('Los, links beginnen', 'Go, start left') : T('Los', 'Go'));
  persistSession(); renderCurrent(); renderControls();
}
function startEmom() { if (!isSets() || phase !== 1 || !running || emom) return; audioReady(); emom = { start: secNow(), minutes: 3 }; resetCues(); cue('step'); say(T('Minute 1', 'Minute 1')); persistSession(); renderEmom(); }
function buildSetsEntry(date) {
  const ex = exList();
  const sets = ex.map(x => runReps[x.slot.id].map(v => v === '' ? null : Math.max(0, Math.round(Number(String(v).replace(',', '.'))) || 0)));
  const units = ex.map(x => /Sek\./.test(x.reps) ? 'Sek.' : 'Wdh.');
  const total = sets.reduce((sum, r, i) => units[i] === 'Sek.' ? sum : sum + r.reduce((a, b) => a + (b || 0), 0), 0);
  return { v: 3, id: uid(), date, plan, mode: 'sets', total: Math.min(total, 9999), cfg: ex.map(x => x.cfg), names: ex.map(x => x.name), stages: PLANS[plan].slots.map(sl => stageOf(plan, sl) || ''), units, sets, at: new Date().toISOString() };
}
function saveSession(date, opts = {}) {
  const manual = !!opts.manual;
  let entry;
  if (isSets()) {
    if (!hasReps() && !confirm(T('Du hast noch keine Sätze eingetragen. Trotzdem speichern?', "You haven't entered any sets yet. Save anyway?"))) return false;
    entry = buildSetsEntry(date);
  } else if (isInterval()) {
    const of = workTotal(), total = manual ? of : (phase === 1 ? workDoneAt(secNow()) : tabataDone);
    entry = { v: 3, id: uid(), date, plan, mode: PLANS[plan].mode, total, of, cfg: currentCfg(), names: exList().map(x => x.name), at: new Date().toISOString() };
  } else {
    const total = manual ? opts.total : completions;
    if (total === 0 && !confirm(T('Du hast noch keine Übung erfasst. Trotzdem speichern?', "You haven't logged any exercise yet. Save anyway?"))) return false;
    const ex = exList();
    entry = { v: 3, id: uid(), date, plan, total, cfg: currentCfg(), names: ex.map(x => x.name), at: new Date().toISOString() };
  }
  if (manual) entry.manual = true;
  const sig = entrySig(entry), prev = saved.filter(e => e.plan === entry.plan && entrySig(e) === sig);
  saved.push(entry); persistEntries();
  if (!manual) { sessionSaved = true; running = false; timed = null; emom = null; keepAwake(false); }
  if (isSets()) runReps = emptyReps(plan);
  persistSession(); renderAll();
  toast(isInterval() && !manual ? T(`✓ ${mainName()} geschafft und gespeichert.`, `✓ ${mainName()} done and saved.`) : T('✓ Gespeichert. Du findest die Einheit im Verlauf.', '✓ Saved. You will find the session in the history.'));
  openRate(entry.id, progressNotes(entry, prev));
  return true;
}

/* ---------- Fortschritt: Bestwerte und Hinweise zur Steigerung ---------- */
const byNewest = (a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || ''));
const rpeOf = e => Number.isInteger(e.rpe) && e.rpe >= 1 && e.rpe <= 10 ? e.rpe : null;
const repTop = reps => { const m = String(reps).match(/(\d+)\s*[–-]\s*(\d+)/) || String(reps).match(/(\d+)/); return m ? Number(m[2] || m[1]) : null; };
const totalText = e => e.mode === 'sets' ? e.total + T(' Wdh.', ' reps') : T(`${Math.floor(e.total / entryCount(e))} Runden + ${e.total % entryCount(e)}`, `${Math.floor(e.total / entryCount(e))} rounds + ${e.total % entryCount(e)}`);
// Doppelte Progression: Erst wenn alle Sätze die Obergrenze erreichen, wird es schwerer (Stufe, Gewicht, Band)
function setsAdvice(e, i) {
  const ex = exList(), x = ex[i];
  if (!x || !e || e.mode !== 'sets' || e.plan !== plan || !Array.isArray(e.sets) || (e.cfg || []).length !== ex.length) return null;
  const st = stageOf(plan, x.slot) || '';
  if (e.cfg[i] !== x.cfg || ((e.stages || [])[i] || '') !== st) return null;
  const top = repTop(x.reps), r = e.sets[i];
  if (!top || !Array.isArray(r) || r.length < x.slot.sets || !r.every(v => typeof v === 'number' && v >= top)) return null;
  const sl = x.slot, k = sl.stages ? sl.stages.indexOf(st) : -1;
  if (sl.stages && k >= 0 && k < sl.stages.length - 1) return { text: T('Nächste Stufe: ', 'Next stage: ') + tr(sl.stages[k + 1]), stage: sl.stages[k + 1] };
  if (x.lvls && x.lvl !== 'schwer') { const to = x.lvl === 'leicht' ? 'mittel' : 'schwer'; return { text: T('Nächste Stufe: ', 'Next level: ') + LVL_LABEL[to], lvl: to }; }
  const heavier = x.g === 'kb' ? T('Schwerere Kugel', 'Heavier bell') : T('Schwerere Hantel', 'Heavier dumbbell'), weighted = x.g === 'kb' || x.g === 'db';
  if (sl.emom) return { text: weighted ? heavier : x.g === 'band' ? T('Stärkeres Band', 'Stronger band') : T('Oben 2 Sek. halten', 'Hold 2 sec at the top') };
  if (/Sek\./.test(x.reps)) return { text: weighted ? heavier + T(' oder länger halten', ' or hold longer') : T('Länger halten', 'Hold longer') };
  return { text: weighted ? T('Mehr Gewicht', 'More weight') + (sl.stages ? '' : T(' oder 3 Sek. absenken', ' or lower over 3 sec')) : x.g === 'band' ? T('Stärkeres Band', 'Stronger band') : T('Schwerere Variante oder 3 Sek. absenken', 'Harder variant or lower over 3 sec') };
}
function intervalAdvice() {
  if (!isInterval()) return null;
  const sig = currentSig(plan), rows = saved.filter(e => e.plan === plan && entrySig(e) === sig).sort(byNewest).slice(0, 3);
  const ready = rows.length >= 3 && rows.every(e => e.total >= e.of && !(rpeOf(e) >= 9));
  if (isEmomPlan()) {
    const c = emomCfg(), nx = EMOM_ROUNDS.find(v => v > c.rounds), n = PLANS[plan].slots.length;
    return ready && nx ? { text: T(`3 × in Folge komplett mit ${c.rounds} Runden – bereit für ${nx} Runden (${nx * n} Min.).`, `3 × in a row complete with ${c.rounds} rounds – ready for ${nx} rounds (${nx * n} min).`), patch: { rounds: nx }, btn: T(`Auf ${nx} Runden`, `Go to ${nx} rounds`) } : null;
  }
  const c = tabataCfg(), nx = TABATA_ROUNDS.find(v => v > c.rounds); if (!nx && c.blockRest <= 60) return null;
  if (!ready) return null;
  return nx ? { text: T(`3 × in Folge komplett mit ${c.rounds} Runden – bereit für ${nx} Runden.`, `3 × in a row complete with ${c.rounds} rounds – ready for ${nx} rounds.`), patch: { rounds: nx }, btn: T(`Auf ${nx} Runden`, `Go to ${nx} rounds`) }
    : { text: T(`3 × in Folge komplett mit ${c.rounds} Runden – bereit für 60 Sek. Pause zwischen den Runden.`, `3 × in a row complete with ${c.rounds} rounds – ready for 60 sec rest between rounds.`), patch: { blockRest: 60 }, btn: T('Auf 60 Sek.', 'Go to 60 sec') };
}
function progressNotes(e, prev) {
  const out = [];
  if (e.mode === 'tabata' || e.mode === 'emom') { if (e.total >= e.of) out.push(T(`✓ Alle ${e.of} ${e.mode === 'emom' ? 'Minuten' : 'Intervalle'} geschafft.`, `✓ All ${e.of} ${e.mode === 'emom' ? 'minutes' : 'intervals'} done.`)); }
  else if (!prev.length) out.push(T('Erste Einheit mit diesem Aufbau – ab jetzt wird verglichen.', 'First session with this setup – from now on it will be compared.'));
  else { const best = prev.reduce((a, b) => b.total > a.total ? b : a); if (e.total > best.total) out.push(T(`🏆 Neuer Bestwert: ${totalText(e)} (vorher ${totalText(best)}).`, `🏆 New best: ${totalText(e)} (before ${totalText(best)}).`)); }
  if (e.mode === 'sets') exList().forEach((x, i) => { const a = setsAdvice(e, i); if (a) out.push(`↑ ${tr(x.name)}: ${a.text}`); });
  const t = intervalAdvice(); if (t) out.push('↑ ' + t.text);
  return out;
}
function renderPlanHint() {
  const a = sessionActive() ? null : intervalAdvice(), el = $('planhint');
  el.classList.toggle('hide', !a);
  el.innerHTML = a ? `<span>↑ ${esc(a.text)}</span><button class="btn small primary" type="button" id="planhintbtn">${esc(a.btn)}</button>` : '';
}

/* ---------- Darstellung ---------- */
let toastTimer = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('act'); undoFn = null; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
// Löschen ohne Rückfrage, dafür ein paar Sekunden „Rückgängig“ im Hinweis (wie in Mail-Apps)
let undoFn = null;
function toastUndo(t, undo) {
  const el = $('toast'); el.innerHTML = `<span>${esc(t)}</span><button type="button" class="tundo" id="toastundo">${T('Rückgängig', 'Undo')}</button>`;
  el.classList.add('show', 'act'); undoFn = undo; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('show', 'act'); undoFn = null; }, 6000);
}
$('toast').addEventListener('click', e => { if (e.target.id !== 'toastundo' || !undoFn) return; const f = undoFn; undoFn = null; f(); toast(T('Wiederhergestellt.', 'Restored.')); });

function renderTabs() {
  const t = $('tabs');
  const list = PLAN_ORDER.filter(planOwned), cols = Math.ceil(list.length / 2);
  t.style.setProperty('--cols', cols);
  t.innerHTML = list.map((k, i) => `<button role="tab" type="button" data-plan="${k}" aria-selected="${k === plan}" class="${(i + 1) % cols === 0 || i === list.length - 1 ? 'rowend' : ''}${i >= cols ? ' row2' : ''}">${esc(PLANS[k].tab)}</button>`).join('');
  fitTabs();
}
// Passen alle Pläne in eine Zeile (iPad, Rechner, ohne Kettlebell weniger Pläne), bleibt es einzeilig; sonst zwei Zeilen statt Wischen
function fitTabs() {
  const t = $('tabs'); if (!t.offsetParent) return; // Bereich nicht sichtbar: beim Öffnen von Kraft erneut prüfen
  t.classList.remove('wrap');
  if (t.scrollWidth > t.clientWidth + 1) t.classList.add('wrap');
}
// Was für den Plan bereitliegen sollte – aus den Übungen, die er gerade nutzt (Gewichte, Bänder, Matte usw.)
function planNeeds(pk = plan) {
  const ex = exList(pk), kgsOf = g => [...new Set(ex.filter(x => x.g === g).map(x => x.kg))].sort((a, b) => a - b), kgs = kgsOf('kb'), dbs = kgsOf('db');
  // Kurzhanteln: je Gewicht ein Paar, sobald eine Übung damit zwei Hanteln braucht
  const dbNeed = dbs.map(k => (ex.some(x => x.g === 'db' && x.kg === k && dbPair(x.name)) ? '2 × ' : '') + kgText(k) + ' kg').join(' + ');
  const bands = [...new Set(ex.filter(x => x.g === 'band').map(x => x.band))];
  const names = ex.map(x => x.name).concat((PLANS[pk].warmup || []).concat(PLANS[pk].cooldown || []).map(w => w[1]));
  const has = list => names.some(n => list.includes(n)), bulg = ex.some(x => x.slot.stages && /^Bulgarian/.test(stageOf(pk, x.slot) || ''));
  return [kgs.length ? `Kettlebell ${kgs.map(k => kgText(k)).join(' + ')} kg` : '', dbs.length ? T('Kurzhanteln ', 'Dumbbells ') + dbNeed : '', bands.length ? bands.map(b => bandLabel(b)).join(', ') : '',
    has(PREP.mat) ? T('Matte', 'Mat') : '', has(PREP.support) || bulg ? T('Stuhl, Bank oder Sofa', 'Chair, bench or sofa') : '', has(PREP.towel) ? T('Handtuch', 'Towel') : ''].filter(Boolean);
}
const needsLine = () => { const n = planNeeds(); return n.length ? `<p class="needs"><b>${T('Du brauchst', 'You need')}:</b> ${esc(n.join(' · '))}</p>` : ''; };
function renderGear() {
  if (PLANS[plan].kbOnly) { $('gearbar').innerHTML = `<span class="lbl">${T(`${esc(PLANS[plan].tab)} ist fest mit Kettlebell – die Geräte-Auswahl gilt hier nicht.`, `${esc(tr(PLANS[plan].tab))} is kettlebell only – the equipment choice does not apply here.`)}</span>` + needsLine(); return; }
  const pg = planGear();
  const vac = vacation();
  $('gearbar').innerHTML = `<span class="lbl">${vac ? T(`🏖 Urlaub bis ${dateShort(vac.to)} – Geräte für alle Pläne`, `🏖 Holiday until ${dateShort(vac.to)} – equipment for all plans`) : T(`Geräte für ${esc(PLANS[plan].tab)}`, `Equipment for ${esc(tr(PLANS[plan].tab))}`)}</span>` +
    (owns('kb') ? `<button class="chip" type="button" data-gear="kb" aria-pressed="${pg.kb}">Kettlebell</button>` : '') +
    (owns('db') ? `<button class="chip" type="button" data-gear="db" aria-pressed="${pg.db}">${T('Kurzhanteln', 'Dumbbells')}</button>` : '') +
    (owns('band') ? `<button class="chip" type="button" data-gear="band" aria-pressed="${pg.band}">${T('Bänder', 'Bands')}</button>` : '') +
    `<button class="chip" type="button" data-gear="bw" aria-pressed="${pg.bw || !['kb', 'db', 'band'].some(g => pg[g] && owns(g))}">${T('Körpergewicht', 'Body weight')}</button>` +
    (owns('kb') && owns('db') && owns('band') ? '' : `<span class="lbl">${T('Weitere Geräte: Profil → Geräte & Gewichte', 'More equipment: Profile → Equipment & weights')}</span>`) + needsLine();
}
function renderHeader() {
  const p = PLANS[plan], ex = exList();
  $('plan-title').textContent = p.label;
  $('listkicker').textContent = isTabata() ? T('Tabata-Zirkel · ' + tabataCfg().rounds + ' Runden', 'Tabata circuit · ' + tabataCfg().rounds + ' rounds') : isEmomPlan() ? T(`EMOM · ${emomCfg().rounds} Runden · jede Minute eine Übung`, `EMOM · ${emomCfg().rounds} rounds · one exercise per minute`) : isSets() ? T('Sätze', 'Sets') : T('Zirkel', 'Circuit');
  $('workoutname').textContent = T(`${ex.length} Übungen · ${Math.round(phaseSecs(plan, 1) / 60)} Min.`, `${ex.length} exercises · ${Math.round(phaseSecs(plan, 1) / 60)} min`);
  $('intro').textContent = tr(p.intro) + T(' Übung antippen für Anleitung und Skizze.', ' Tap an exercise for instructions and sketch.');
  $('sound').textContent = soundEnabled ? '🔊' : '🔇'; $('sound').setAttribute('aria-pressed', String(soundEnabled)); $('sound').setAttribute('aria-label', soundEnabled ? T('Ton ausschalten', 'Mute sound') : T('Ton einschalten', 'Unmute sound'));
  renderAudioRows();
}
function renderPhase() {
  const p = PLANS[plan];
  const names = [T('Aufwärmen', 'Warm-up'), isInterval() ? mainName() : isSets() ? T('Kraft', 'Strength') : T('Zirkel', 'Circuit'), 'Cooldown'];
  $('phase-badge').textContent = sessionSaved ? T('Gespeichert', 'Saved') : isFinished() ? T('Geschafft', 'Done') : names[phase];
  $('timeline').innerHTML = names.map((n, i) => `<span class="${i === phase && !sessionSaved ? 'on' : ''}">${n} ${Math.round(phaseSecs(plan, i) / 60)}′</span>`).join('');
  $('timehint').textContent = sessionSaved ? T('Diese Einheit ist gespeichert. „Training zurücksetzen“ startet eine neue.', 'This session is saved. “Reset workout” starts a new one.')
    : phase === 0 ? T('Die Aufwärmübungen laufen automatisch mit Countdown und Seitenwechsel.', 'The warm-up runs automatically with countdown and side changes.')
      : phase === 1 ? (isTabata() ? T('Läuft automatisch: 20 Sek. Arbeit, 10 Sek. Pause, Ton bei jedem Wechsel und 3-2-1 vorher. Einfach mitmachen.', 'Runs automatically: 20 sec work, 10 sec rest, a sound at every change and 3-2-1 beforehand. Just follow along.') : isEmomPlan() ? T('Läuft automatisch: Jede Minute beginnt die nächste Übung – Wiederholungen machen, im Rest der Minute Pause. Ton und Ansage bei jedem Wechsel, 3-2-1 vorher.', 'Runs automatically: every minute the next exercise starts – do the reps, rest for the rest of the minute. Sound and voice at every change, 3-2-1 beforehand.') : isSets() ? T('Wiederholungen je Satz eintragen: Kraft, Läufer-Block, dann Swing-EMOM. Die Zeit ist ein Richtwert.', 'Enter reps per set: strength, runner block, then swing EMOM. The time is a guide.') : T('Übungen der Reihe nach abhaken. Bei Zeitübungen den Übungs-Timer starten.', 'Tick off the exercises in order. For timed exercises start the exercise timer.'))
        : T('Die Dehnungen und Seitenwechsel werden automatisch per Ton angesagt.', 'Stretches and side changes are announced automatically with a sound.');
  renderStepsList(); renderCurrent(); renderControls(); renderStats(); updateClock();
}
function updateClock() {
  const done = sessionSaved || isFinished(), tb = isInterval() && phase === 1 && !done, sg = tb ? currentSeg() : null;
  const frac = done ? 1 : tb ? Math.min(1, (secNow() - sg.start) / (sg.end - sg.start)) : Math.min(1, secNow() / durationSecs());
  $('timer').textContent = done ? '00:00' : tb ? clock(sg.end - secNow()) : clock(durationSecs() - secNow());
  $('ringprog').classList.toggle('rest', !!sg && sg.type !== 'work');
  $('ringprog').style.strokeDashoffset = String(552.9 * (1 - frac)); $('ringprog').style.opacity = frac > 0.002 ? '1' : '0';
  if (tb && isEmomPlan()) { const ex = exList(); $('phase-badge').textContent = `${T('Minute', 'Minute')} ${sg.round * ex.length + sg.block + 1}/${workTotal()}`; $('ringsub').textContent = T(`Runde ${sg.round + 1}/${emomCfg().rounds} · ${ex[sg.block].reps}`, `Round ${sg.round + 1}/${emomCfg().rounds} · ${tr(ex[sg.block].reps)}`); }
  else if (tb) { const ex = exList(), c = tabataCfg(); $('phase-badge').textContent = sg.type === 'work' ? T('Arbeit', 'Work') : sg.type === 'rest' ? T('Pause', 'Rest') : T('Rundenpause', 'Round rest'); $('ringsub').textContent = sg.type === 'blockrest' ? T(`Runde ${sg.round + 2}/${c.rounds} · gleich: `, `Round ${sg.round + 2}/${c.rounds} · next: `) + tr(ex[0].name) : sg.type === 'rest' ? T('gleich: ', 'next: ') + tr(ex[sg.block + 1].name) : T(`Übung ${sg.block + 1}/${ex.length} · Runde ${sg.round + 1}/${c.rounds}`, `Exercise ${sg.block + 1}/${ex.length} · Round ${sg.round + 1}/${c.rounds}`); }
  else $('ringsub').textContent = done ? (sessionSaved ? T('Einheit gespeichert', 'Session saved') : T('Jetzt speichern', 'Save now')) : running ? T('verbleibend', 'remaining') : (elapsed > 0 || phase > 0 ? T('pausiert', 'paused') : T('bereit', 'ready'));
  const showStep = (phase !== 1 || tb) && !done;
  $('stepstatus').classList.toggle('hide', !showStep);
  if (tb) {
    const ex = exList(), nx = sg.type === 'work' ? null : ex[segShown(sg)];
    $('steplabel').textContent = sg.type === 'work' ? T('Jetzt', 'Now') : T('Gleich', 'Up next');
    $('stepname').textContent = tr(sg.type === 'work' ? ex[sg.block].name : nx.name);
    $('stepdesc').textContent = isEmomPlan() ? T(`${ex[sg.block].reps} · danach ${sg.end >= durationSecs() ? 'Cooldown' : ex[(sg.block + 1) % ex.length].name} · antippen für Anleitung`, `${tr(ex[sg.block].reps)} · then ${sg.end >= durationSecs() ? 'cooldown' : tr(ex[(sg.block + 1) % ex.length].name)} · tap for instructions`) : T('Tabata gesamt noch ', 'Tabata total ') + clock(durationSecs() - secNow()) + T(' · antippen für Anleitung', ' left · tap for instructions');
    $('stepclock').textContent = clock(sg.end - secNow());
  } else if (showStep) {
    const s = currentStep(), list = phase === 0 ? PLANS[plan].warmup : PLANS[plan].cooldown;
    $('steplabel').textContent = (phase === 0 ? T('Aufwärmen', 'Warm-up') : 'Cooldown') + T(` · ${s.group + 1} von ${list.length}`, ` · ${s.group + 1} of ${list.length}`);
    $('stepname').textContent = s.name; $('stepdesc').textContent = T('Antippen für Anleitung', 'Tap for instructions');
    $('stepclock').textContent = clock(s.end - secNow());
    for (const type of ['warmup', 'cooldown']) for (const item of $(type).children) {
      const active = (phase === 0 && type === 'warmup') || (phase === 2 && type === 'cooldown'), i = Number(item.dataset.group);
      item.classList.toggle('focus', active && i === s.group); item.classList.toggle('done', active && i < s.group);
    }
  }
  if (timed) {
    const pr = Math.max(0, secNow() - timed.start), part = Math.min(timed.sides - 1, Math.floor(pr / timed.seconds));
    $('timedclock').textContent = clock((part + 1) * timed.seconds - pr);
    $('timedinfo').textContent = timed.sides === 2 ? T(`${part === 0 ? 'Linke' : 'Rechte'} Seite · ${part + 1} von 2`, `${part === 0 ? 'Left' : 'Right'} side · ${part + 1} of 2`) : T('Position halten bis zum Signal.', 'Hold the position until the signal.');
  }
  if (emom) renderEmomClock();
  renderLivePill();
}
function renderStepsList() {
  for (const type of ['warmup', 'cooldown']) $(type).innerHTML = PLANS[plan][type].map((s, i) => `<button type="button" class="row" data-group="${i}" data-guide-name="${esc(s[1])}"><span class="dur">${esc(tr(s[0]))}</span><span class="txt"><b>${esc(tr(s[1]))}</b>${parseStep(s[0]).times > 1 ? `<small>${T('links und rechts, Wechsel per Ton', 'left and right, change on the sound')}</small>` : ''}</span><span class="chev"></span></button>`).join('');
}
function renderCurrent() {
  const ex = exList(), cur = $('current'), tw = $('timerwork');
  if (isSets() || isInterval() || sessionSaved || isFinished()) { cur.classList.add('hide'); tw.classList.add('hide'); return; }
  const n = ex.length, off = completions % n, x = ex[off];
  cur.classList.remove('hide');
  $('currentlabel').textContent = phase === 1 ? T('Jetzt', 'Now') : T('Erste Übung', 'First exercise');
  $('currentname').textContent = tr(x.name); $('currentrep').textContent = `${tr(x.reps)} · ${x.gearText}`;
  $('roundbadge').textContent = T('Runde ', 'Round ') + (Math.floor(completions / n) + 1);
  cur.dataset.index = off;
  const tp = timedParams(x.reps), show = phase === 1 && !!tp;
  tw.classList.toggle('hide', !show);
  if (!show) return;
  const sel = $('timedlength'), key = plan + '-' + off;
  sel.classList.toggle('hide', tp.min === tp.max);
  if (tp.min !== tp.max) {
    sel.innerHTML = [tp.min, tp.max].map(v => `<option value="${v}">${v} ${T('Sek.', 'sec')}${tp.sides === 2 ? T(' je Seite', ' per side') : ''}</option>`).join('');
    sel.value = String(timedPick[key] || tp.max);
  }
  const btn = $('timedstart');
  btn.disabled = !!timed || !running; btn.textContent = timed ? T('● Timer läuft', '● Timer running') : T('▶ Übungs-Timer', '▶ Exercise timer');
  if (!timed) {
    $('timedclock').textContent = clock(tp.min === tp.max ? tp.min : Number(sel.value));
    $('timedinfo').textContent = (running ? '' : T('Erst den Haupt-Timer starten. ', 'Start the main timer first. ')) + (tp.sides === 2 ? T('Links und rechts nacheinander, ', 'Left and right one after the other, ') : '') + T('nach Ablauf automatisch gezählt.', 'counted automatically when it ends.');
  }
}
function renderControls() {
  const busy = sessionActive(); $('banners').classList.toggle('hide', busy); $('installbar').classList.toggle('hide', busy); $('gearbar').classList.toggle('hide', busy);
  const main = $('btnMain'), done = $('btnDone'), undoB = $('btnUndo'), next = $('btnNext'), circuit = !isSets() && !isInterval();
  if (sessionSaved) { main.textContent = T('✓ Gespeichert', '✓ Saved'); main.disabled = true; }
  else if (isFinished()) { main.textContent = T('💾 Speichern', '💾 Save'); main.disabled = false; }
  else { main.textContent = running ? 'Ⅱ Pause' : (elapsed > 0 || phase > 0 ? T('▶ Weiter', '▶ Resume') : T('▶ Starten', '▶ Start')); main.disabled = false; }
  const showDone = circuit && phase === 1 && !sessionSaved && !isFinished();
  main.setAttribute('aria-label', main.textContent.replace(/^[^A-Za-zÄÖÜ]+/, ''));
  if (showDone && !sessionSaved && !isFinished()) main.textContent = running ? 'Ⅱ' : '▶';
  main.classList.toggle('compact', showDone);
  next.classList.toggle('compact', showDone);
  done.classList.toggle('hide', !showDone);
  done.disabled = !running || !!timed;
  done.textContent = timed ? T('● Zeitübung läuft', '● Timed exercise running') : T('✓ Erledigt', '✓ Done');
  undoB.classList.toggle('hide', !(circuit && phase >= 1 && completions > 0 && !sessionSaved && !isFinished()));
  undoB.disabled = !!timed;
  next.classList.toggle('hide', sessionSaved || isFinished());
  next.textContent = phase === 2 ? T('Beenden ✓', 'Finish ✓') : phase === 0 ? T('Zum ' + mainName() + ' →', mainName() + ' →') : 'Cooldown →';
  next.setAttribute('aria-label', next.textContent.replace(/[→✓]/g, '').trim());
  if (showDone) next.textContent = '⏭';
  renderPlanHint();
}
function renderStats() {
  const ex = exList(), n = ex.length, all = saved.filter(e => e.plan === plan), comp = all.filter(comparable);
  const parts = [], week = `<span>${T('Diese Woche', 'This week')} <b>${saved.filter(e => weekStart(e.date) === weekStart(localDay())).length}</b></span>`;
  renderPlanHint();
  if (isInterval()) {
    parts.push(`<span>${T('Einheiten', 'Sessions')} <b>${comp.length}</b>${comp.length !== all.length ? T(' von ' + all.length + ' vergleichbar', ' of ' + all.length + ' comparable') : ''}</span>`);
    parts.push(`<span>Komplett <b>${comp.filter(e => e.total >= e.of).length}</b></span>`);
    parts.push(isTabata() ? `<span>${T('Arbeit', 'Work')} <b>${Math.round(workTotal() * 20 / 60)} ${T('Min.', 'min')}</b></span>` : `<span>${T('Dauer', 'Duration')} <b>${workTotal()} ${T('Min.', 'min')}</b></span>`);
    $('statsline').innerHTML = parts.join('') + week; return;
  }
  let best = null; if (comp.length) best = Math.max(...comp.map(e => e.total));
  if (!isSets()) parts.push(`<span>${T('Runden', 'Rounds')} <b>${Math.floor(completions / n)}</b> + <b>${completions % n}</b></span>`);
  parts.push(`<span>${T('Bestwert', 'Best')} <b>${best === null ? '–' : isSets() ? best + T(' Wdh.', ' reps') : Math.floor(best / n) + 'R +' + best % n}</b></span>`);
  parts.push(`<span>${T('Einheiten', 'Sessions')} <b>${comp.length}</b>${comp.length !== all.length ? T(' von ' + all.length + ' vergleichbar', ' of ' + all.length + ' comparable') : ''}</span>`);
  $('statsline').innerHTML = parts.join('') + week;
}
function lastSetsEntry() { return saved.filter(e => e.plan === plan && e.mode === 'sets' && e.v >= 3).sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')))[0]; }
function renderList() {
  const ex = exList(), wl = $('worklist');
  if (isInterval()) {
    wl.className = 'group';
    const c = intervalCfg(), em = isEmomPlan(), cur = phase === 1 && !sessionSaved && !isFinished() ? currentSeg().block : phase === 0 && !sessionSaved ? 0 : -1;
    wl.innerHTML = ex.map((x, i) => { const d = (phase === 1 && !em && i < cur) || (phase === 2 && !sessionSaved); return `<button type="button" class="row ${i === cur ? 'focus' : ''} ${d ? 'done' : ''}" data-ex="${i}"><span class="num">${d ? '✓' : i + 1}</span><span class="txt"><b>${esc(tr(x.name))}</b><small>${esc(x.gearText)} · ${esc(x.note)}</small></span><span class="val">${em ? esc(tr(x.reps)) : c.rounds + ' × 20″'}</span><span class="chev"></span></button>`; }).join('');
    return;
  }
  if (!isSets()) {
    wl.className = 'group';
    const n = ex.length, off = completions % n, active = phase <= 1 && !sessionSaved;
    wl.innerHTML = ex.map((x, i) => { const d = active && phase === 1 && i < off; return `<button type="button" class="row ${active && i === off ? 'focus' : ''} ${d ? 'done' : ''}" data-ex="${i}"><span class="num">${d ? '✓' : i + 1}</span><span class="txt"><b>${esc(tr(x.name))}</b><small>${esc(x.gearText)} · ${esc(x.note)}</small></span><span class="val">${esc(tr(x.reps))}</span><span class="chev"></span></button>`; }).join('');
    return;
  }
  wl.className = '';
  const last = lastSetsEntry(); let html = '', blk = null;
  ex.forEach((x, i) => {
    const sl = x.slot;
    if (sl.block !== blk) { html += (blk === null ? '' : '</div>') + `<div class="header" style="margin-top:${blk === null ? 4 : 22}px">${esc(sl.block)}</div><div class="group">`; blk = sl.block; }
    const st = stageOf(plan, sl);
    const stageSel = sl.stages ? `<select class="stagesel" data-stage="${sl.id}" aria-label="${T('Stufe', 'Stage')} ${esc(tr(x.name))}">${sl.stages.map(s => `<option value="${esc(s)}" ${s === st ? 'selected' : ''}>${esc(tr(s))}</option>`).join('')}</select>` : '';
    const inputs = runReps[sl.id].map((v, k) => `<label class="setin"><span>${sl.setLabel ? tr(sl.setLabel) : T('Satz', 'Set')} ${k + 1}</span><input type="number" inputmode="numeric" min="0" max="${/Sek\./.test(x.reps) ? 600 : 200}" step="1" data-slot="${sl.id}" data-idx="${k}" value="${esc(v)}" placeholder="${/Sek\./.test(x.reps) ? T('Sek.', 'sec') : T('Wdh.', 'reps')}"></label>`).join('');
    let lastTxt = T('Noch kein Eintrag', 'No entry yet');
    if (last && (last.cfg || []).length === ex.length && last.sets[i]) lastTxt = `${T('Zuletzt', 'Last')} (${dateGerman(last.date)}): ${last.sets[i].map(r => r ?? '–').join(' / ')}${last.stages && last.stages[i] ? ' · ' + esc(tr(last.stages[i])) : ''} · ${esc(cfgText(last.cfg[i]))}${last.names && last.names[i] !== x.name ? ' · ' + esc(tr(last.names[i])) : ''}`;
    const adv = setsAdvice(last, i);
    const advHtml = adv ? `<div class="advice"><span>${T('↑ Alle Sätze an der Obergrenze – bereit für mehr:', '↑ All sets at the upper limit – ready for more:')} <b>${esc(adv.text)}</b></span>${adv.stage ? `<button type="button" class="btn small" data-advance="${sl.id}" data-to="${esc(adv.stage)}">${T('Übernehmen', 'Apply')}</button>` : adv.lvl ? `<button type="button" class="btn small" data-lvlup="${sl.id}" data-to="${adv.lvl}">${T('Übernehmen', 'Apply')}</button>` : ''}</div>` : '';
    const em = sl.emom ? '<div class="timedctl" style="padding:8px 0 0"><button type="button" class="btn small primary" id="emomstart">' + T('▶ EMOM starten', '▶ Start EMOM') + '</button><strong class="stepclock" id="emomclock">03:00</strong></div><p class="tiny" id="emominfo"></p>' : '';
    html += `<div class="setcard"><div class="sethead"><button type="button" class="setname" data-ex="${i}">${esc(tr(sl.stages && /^Bulgarian/.test(st) ? 'Bulgarian Split Squat' : x.name))} <span class="info">ⓘ</span></button><span class="setmeta">${esc(tr(x.reps))}</span></div><div class="setmeta">${esc(x.gearText)} · ${esc(x.note)}</div>${stageSel}<div class="setrow">${inputs}</div><div class="setmeta">${lastTxt}</div>${advHtml}${em}</div>`;
  });
  wl.innerHTML = html + '</div>';
  renderEmom();
}
function renderEmom() {
  const b = document.getElementById('emomstart'); if (!b) return;
  b.disabled = !!emom || !running || phase !== 1; b.textContent = emom ? T('● EMOM läuft', '● EMOM running') : T('▶ EMOM starten', '▶ Start EMOM');
  renderEmomClock();
}
function renderEmomClock() {
  const c = document.getElementById('emomclock'), info = document.getElementById('emominfo'); if (!c) return;
  if (emom) { const pr = Math.max(0, secNow() - emom.start), m = Math.min(emom.minutes - 1, Math.floor(pr / 60)); c.textContent = clock((m + 1) * 60 - pr); info.textContent = T(`Minute ${m + 1} von ${emom.minutes} · danach bei Min. ${m + 1} eintragen.`, `Minute ${m + 1} of ${emom.minutes} · then enter it under min ${m + 1}.`); }
  else { c.textContent = '03:00'; info.textContent = phase === 1 && running ? T('Zu Beginn jeder Minute die Wiederholungen, dann Pause. Ton bei jedem Minutenwechsel.', 'At the start of every minute do the reps, then rest. Sound at every minute change.') : T('Startbar in der Kraftphase bei laufendem Timer.', 'Can be started in the strength phase while the timer runs.'); }
}
// Kettlebell- bzw. Kurzhantel-Gewicht: Auswahl aus den eigenen Gewichten (Profil), sonst freie Eingabe
function kgParam(attr, cur, label, own = profile.kit.kb) {
  if (!own.length) return `<label class="param"><input type="number" min="0" max="60" step="0.5" inputmode="decimal" value="${cur}" ${attr} aria-label="${esc(label)}"> kg</label>`;
  const opts = own.includes(cur) ? own : own.concat(cur).sort((a, b) => a - b);
  return `<select ${attr} aria-label="${esc(label)}">${opts.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${kgText(v)} kg${own.includes(v) ? '' : T(' (nicht im Profil)', ' (not in profile)')}</option>`).join('')}</select>`;
}
function renderSettings() {
  const pk = plan;
  // gleiche Reihenfolge wie im Training (nach Position), damit Index und Anleitung zusammenpassen
  const rows = exList(pk).map((r, i) => {
    const sl = r.slot;
    const best = r.avail[0];
    const opts = `<option value="auto" ${r.auto ? 'selected' : ''}>${T('Automatisch', 'Automatic')}: ${esc(tr(sl.v[best][0]))}</option>` + (r.avail.length > 1 ? r.avail.map(g => `<option value="${g}" ${!r.auto && g === r.g ? 'selected' : ''}>${esc(GEAR_LABEL[g])}: ${esc(tr(sl.v[g][0]))}</option>`).join('') : '');
    const param = r.g === 'kb' ? kgParam(`data-kg="${sl.id}"`, r.kg, T(`Gewicht für ${r.name}`, `Weight for ${tr(r.name)}`))
      : r.g === 'db' ? kgParam(`data-dbkg="${sl.id}"`, r.kg, T(`Gewicht je Hantel für ${r.name}`, `Weight per dumbbell for ${tr(r.name)}`), profile.kit.db)
      : r.lvls ? `<select data-lvl="${sl.id}" aria-label="${esc(T(`Stufe für ${r.name}`, `Level for ${tr(r.name)}`))}">${['leicht', 'mittel', 'schwer'].map(v => `<option value="${v}"${v === r.lvl ? ' selected' : ''}>${T('Stufe', 'Level')}: ${esc(LVL_LABEL[v])}</option>`).join('')}</select>`
      : r.g === 'band' ? `<select data-band="${sl.id}" aria-label="${esc(T(`Band für ${r.name}`, `Band for ${tr(r.name)}`))}">${bandOptions().map(b => `<option value="${b}" ${b === r.band ? 'selected' : ''}>${esc(bandLabel(b).replace(/^Band /, ''))}</option>`).join('')}</select>` : '<span class="param">–</span>';
    const why = sl.why && r.auto && !r.fallback && r.avail.length > 1 ? tr(r.g === 'db' ? DB_WHY : sl.why) : r.fallback ? T('Mit deinen Geräten gibt es hier keine Variante – Körpergewicht als Ersatz.', 'There is no variant for your equipment here – body weight as a substitute.') : !r.auto ? T('Manuell gewählt.', 'Chosen manually.') : '';
    // Name antippen: dieselbe Anleitung mit Skizze und Stufen wie in der Übungsliste – ohne hochzuscrollen
    return `<div class="srow"><div class="sname"><button type="button" class="sguide" data-sguide="${i}" aria-label="${esc(T(`Anleitung: ${r.name}`, `Instructions: ${tr(r.name)}`))}"><b>${esc(tr(r.name))}</b><span class="infoi" aria-hidden="true">i</span></button>${why ? `<small>${esc(why)}</small>` : ''}</div>${r.avail.length < 2 && r.auto ? '' : `<select data-pref="${sl.id}" aria-label="${T('Variante', 'Variant')}">${opts}</select>`}${param}</div>`;
  }).join('');
  const tbRows = isTabata() ? (() => { const c = tabataCfg(); return `<div class="srow"><div class="sname"><b>${T('Runden (Zirkel)', 'Rounds (circuit)')}</b><small>${T('alle Übungen hintereinander · Empfehlung: 3', 'all exercises in a row · recommended: 3')}</small></div><select data-tabata="rounds" aria-label="${T('Runden', 'Rounds')}">${TABATA_ROUNDS.map(v => `<option value="${v}" ${v === c.rounds ? 'selected' : ''}>${v} ${T('Runden', 'rounds')}</option>`).join('')}</select><span class="param">20″ / 10″</span></div><div class="srow"><div class="sname"><b>${T('Pause zwischen Runden', 'Rest between rounds')}</b><small>${T('Empfehlung: 60 Sek.', 'Recommended: 60 sec')}</small></div><select data-tabata="blockRest" aria-label="${T('Pause zwischen Runden', 'Rest between rounds')}">${TABATA_RESTS.map(v => `<option value="${v}" ${v === c.blockRest ? 'selected' : ''}>${v} ${T('Sek.', 'sec')}</option>`).join('')}</select><span class="param">${Math.round(phaseSecs('tabata', 1) / 60)} ${T('Min.', 'min')}</span></div>`; })() : '';
  const emRows = isEmomPlan() ? (() => { const c = emomCfg(), n = PLANS[pk].slots.length; return `<div class="srow"><div class="sname"><b>${T('Runden', 'Rounds')}</b><small>${T(`Empfehlung zum Einstieg: 5 (${5 * n} Min.)`, `Recommended to start: 5 (${5 * n} min)`)}</small></div><select data-icfg="rounds" aria-label="${T('Runden', 'Rounds')}">${EMOM_ROUNDS.map(v => `<option value="${v}" ${v === c.rounds ? 'selected' : ''}>${T(`${v} Runden · ${v * n} Min.`, `${v} rounds · ${v * n} min`)}</option>`).join('')}</select><span class="param">${T('1 Übung je Min.', '1 exercise per min')}</span></div>`; })() : '';
  const info = PLANS[pk].kbOnly ? T('Dieser Plan ist fest auf Kettlebell – die Geräte-Auswahl gilt hier nicht. Das Gewicht stellst du je Übung ein.', 'This plan is kettlebell only – the equipment choice does not apply here. You set the weight per exercise.') : T('Die App wählt je Übung automatisch die wirksamste Variante aus den Geräten, die oben für diesen Plan gewählt sind; du kannst sie hier je Übung überschreiben.', 'For each exercise the app automatically picks the most effective variant for the equipment chosen above for this plan; you can override it here per exercise.');
  $('settings').innerHTML = tbRows + emRows + `<p class="tiny">${T(`Gilt für „${esc(PLANS[pk].tab)}“.`, `Applies to “${esc(tr(PLANS[pk].tab))}”.`)} ${info} ${T('Einheiten mit anderen Varianten oder Gewichten zählen nicht in den Bestwert.', 'Sessions with other variants or weights do not count towards the best.')} ${T('Übungsnamen antippen für Anleitung, Skizze und Stufen.', 'Tap an exercise name for instructions, sketch and levels.')}</p>${rows}
  ${owns('kb') ? `<div class="srow"><div class="sname"><b>${T('Alle Kettlebell-Übungen', 'All kettlebell exercises')}</b><small>${T('dieses Plans auf ein Gewicht setzen', 'of this plan set to one weight')}</small></div>${kgParam('id="allkg"', profile.kit.kbDefault, T('Gewicht für alle Kettlebell-Übungen', 'Weight for all kettlebell exercises'))}<button class="btn small" type="button" id="allkgbtn">${T('Übernehmen', 'Apply')}</button></div>` : ''}
  ${owns('db') && !PLANS[pk].kbOnly && PLANS[pk].slots.some(sl => sl.v.db) ? `<div class="srow"><div class="sname"><b>${T('Alle Kurzhantel-Übungen', 'All dumbbell exercises')}</b><small>${T('dieses Plans auf ein Gewicht je Hantel setzen', 'of this plan set to one weight per dumbbell')}</small></div>${kgParam('id="alldbkg"', profile.kit.dbDefault, T('Gewicht für alle Kurzhantel-Übungen', 'Weight for all dumbbell exercises'), profile.kit.db)}<button class="btn small" type="button" id="alldbkgbtn">${T('Übernehmen', 'Apply')}</button></div>` : ''}
  ${planGear(pk).band && owns('band') && !PLANS[pk].kbOnly ? `<p class="tiny">${esc(tr(BAND_TEXT))}</p>` : ''}`;
}
function settingsLocked() { return isInterval() ? sessionActive() : !isSets() && !sessionSaved && (running || completions > 0); }
function updateChoice(slotId, patch) {
  const k = plan + '.' + slotId; choices[k] = Object.assign({}, isObj(choices[k]) ? choices[k] : {}, patch); store(KEYS.choice, choices);
}

/* ---------- Verlauf ---------- */
function renderHistory() {
  const rows = saved.filter(e => e.plan === plan).sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')));
  const comp = rows.filter(comparable);
  $('sessioncount').textContent = comp.length === rows.length ? String(rows.length) : `${comp.length}/${rows.length}`;
  $('historyhint').textContent = isInterval() ? T(`Balken: geschaffte ${isEmomPlan() ? 'Minuten' : 'Intervalle'}. Blass: anderer Aufbau (Runden, Varianten oder Gewichte).`, `Bars: completed ${isEmomPlan() ? 'minutes' : 'intervals'}. Faded: different setup (rounds, variants or weights).`) : isSets() ? T('Balken: Summe der Wiederholungen. Blass: anderer Aufbau (Variante, Stufe oder Gewicht).', 'Bars: total reps. Faded: different setup (variant, stage or weight).') : T('Balken: abgeschlossene Übungen in der festen Zirkelzeit. Blass: anderer Aufbau (Übungen, Geräte oder Gewichte).', 'Bars: exercises completed in the fixed circuit time. Faded: different setup (exercises, equipment or weights).');
  const best = comp.length && !isInterval() ? Math.max(...comp.map(e => e.total)) : null;
  $('history').innerHTML = rows.length ? rows.map(e => {
    const r = rpeOf(e), note = typeof e.note === 'string' ? e.note.trim() : '';
    return `<tr><td>${esc(dateGerman(e.date))}</td><td><button type="button" class="cellbtn" data-rate="${esc(e.id)}" aria-label="${esc(T(`Anstrengung und Notiz für ${dateGerman(e.date)} bearbeiten`, `Edit effort and note for ${dateGerman(e.date)}`))}">${esc(resultText(e))}${best !== null && comparable(e) && e.total === best ? ' 🏆' : ''}${comparable(e) ? '' : ` <span class="tag">${T('· anderer Aufbau', '· different setup')}</span>`}${e.manual ? ` <span class="tag">${T('· nachgetragen', '· logged later')}</span>` : ''}<small>${r ? T(`Anstrengung ${r}/10`, `Effort ${r}/10`) : `<span class="ratehint">${T('Anstrengung eintragen ›', 'Add effort ›')}</span>`}${note ? ' · ' + esc(note) : ''}</small></button></td><td><button class="btn small danger" type="button" data-delete="${esc(e.id)}" aria-label="${esc(T(`Eintrag vom ${dateGerman(e.date)} löschen`, `Delete entry of ${dateGerman(e.date)}`))}">${T('Löschen', 'Delete')}</button></td></tr>`;
  }).join('') : `<tr><td colspan="3" class="tag">${T('Noch keine Einheit gespeichert.', 'No session saved yet.')}</td></tr>`;
  const box = $('chartbox');
  if (!rows.length) { box.innerHTML = `<div class="empty">${T('Nach der ersten gespeicherten Einheit erscheint hier dein Fortschritt.', 'Your progress appears here after the first saved session.')}</div>`; return; }
  const data = rows.slice(0, 12).reverse(), max = Math.max(1, ...data.map(x => x.total)), w = 380, base = 120, l = 6, plotW = w - l * 2, plotH = base - 20, step = plotW / data.length, barW = Math.min(30, step * 0.62);
  const bars = data.map((x, i) => { const xx = l + step * i + (step - barW) / 2, hh = Math.max(1, x.total / max * plotH), yy = base - hh, c = comparable(x); return `<rect class="bar" x="${xx}" y="${yy}" width="${barW}" height="${hh}" rx="6" opacity="${c ? 1 : 0.3}"><title>${esc(dateGerman(x.date))}: ${esc(resultText(x))}${c ? '' : ' (anderer Aufbau)'}</title></rect><text class="val" x="${xx + barW / 2}" y="${Math.max(yy - 5, 10)}" text-anchor="middle" font-size="12">${x.total}</text><text class="lbl" x="${xx + barW / 2}" y="137" text-anchor="middle" font-size="11">${x.date.slice(5).split('-').reverse().join('.')}</text>`; }).join('');
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${w} 142" role="img" aria-label="${T(`Balkendiagramm der letzten ${data.length} Einheiten`, `Bar chart of the last ${data.length} sessions`)}"><line class="axis" x1="${l}" y1="${base}" x2="${w - 4}" y2="${base}"/>${bars}</svg>`;
}
function renderManual() {
  const sets = isSets(), tb = isInterval(), n = exList().length;
  $('manualroundfield').classList.toggle('hide', sets || tb); $('manualextrafield').classList.toggle('hide', sets || tb);
  $('manualextra').max = String(n - 1);
  $('manualhint').textContent = tb ? mainName() + T(': speichert eine vollständige Einheit mit den aktuellen Einstellungen und dem gewählten Datum.', ': saves a complete session with the current settings and the chosen date.') : sets ? T('Lauftraining: Sätze oben im Plan eintragen und hier mit dem gewählten Datum speichern.', 'Runner training: enter sets in the plan above and save them here with the chosen date.') : T(`Für „${PLANS[plan].tab}“ mit den aktuell eingestellten Varianten und Gewichten.`, `For “${tr(PLANS[plan].tab)}” with the currently set variants and weights.`);
}
/* ---------- Bauchumfang ---------- */
function validWaist(e) { return isObj(e) && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.cm === 'number' && Number.isFinite(e.cm) && e.cm >= 40 && e.cm <= 250; }
const waistLoaded = loadList(KEYS.waist, validWaist);
let waist = waistLoaded.ok; const waistKeep = waistLoaded.keep;
function persistWaist() { if (!store(KEYS.waist, waist.concat(waistKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
const waistSorted = () => [...waist].sort((a, b) => a.date.localeCompare(b.date));
// Körpermaße: Gewicht und Bauchumfang werden getrennt gespeichert, aber gemeinsam angezeigt und eingetragen
function renderWaist() { renderMeasures(); }
// Liniendiagramm für Messwerte (Bauchumfang, Körpergewicht)
function measureChart(data, val, fmt, name, unit) {
  const w = 380, h = 184, left = 40, right = 14, top = 16, bottom = 156, pw = w - left - right;
  let lo = Math.min(...data.map(val)), hi = Math.max(...data.map(val)); const m = Math.max(1, (hi - lo) * 0.25);
  lo = Math.floor((lo - m) * 2) / 2; hi = Math.ceil((hi + m) * 2) / 2; if (hi <= lo) hi = lo + 2;
  const y = v => bottom - ((v - lo) / (hi - lo)) * (bottom - top), x = i => left + (data.length === 1 ? pw / 2 : i * pw / (data.length - 1));
  const grid = [0, .25, .5, .75, 1].map(f => { const yy = top + (bottom - top) * f, v = hi - (hi - lo) * f; return `<line class="axis" x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}" stroke-dasharray="4 5"/><text class="lbl" x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="10.5">${fmt(v)}</text>`; }).join('');
  const path = data.map((e, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(val(e)).toFixed(1)}`).join(' ');
  const dots = data.map((e, i) => `<circle class="dot" cx="${x(i)}" cy="${y(val(e))}" r="4.5" stroke-width="2"><title>${dateGerman(e.date)}: ${fmt(val(e))} ${unit}</title></circle>`).join('');
  const labels = data.map((e, i) => i === 0 || i === data.length - 1 || data.length <= 5 ? `<text class="lbl" x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10.5">${e.date.slice(5).split('-').reverse().join('.')}</text>` : '').join('');
  return `<svg class="chart" role="img" aria-label="${T(`${name} der letzten ${data.length} Messungen, von ${fmt(val(data[0]))} bis ${fmt(val(data.at(-1)))} ${unit}`, `${name} of the last ${data.length} measurements, from ${fmt(val(data[0]))} to ${fmt(val(data.at(-1)))} ${unit}`)}" viewBox="0 0 ${w} ${h}">${grid}<path class="line" d="${path}" fill="none" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

/* ---------- Körpergewicht ---------- */
const validWeight = e => isObj(e) && isDay(e.date) && typeof e.kg === 'number' && Number.isFinite(e.kg) && e.kg >= 30 && e.kg <= 350;
const weightLoaded = loadList(KEYS.weight, validWeight);
let weights = weightLoaded.ok; const weightKeep = weightLoaded.keep;
// Version kbt-v23 bis v27 hielt gespeicherte Gewichte beim Laden fälschlich für unlesbar und legte sie unter
// „…-unlesbar-…“ ab. Diese Kopien zurückholen (vorhandene Tage bleiben) und danach entfernen.
(() => {
  let keys = []; try { keys = Object.keys(localStorage).filter(k => k.startsWith(KEYS.weight + '-unlesbar-')); } catch (e) { return; }
  if (!keys.length) return;
  const have = new Set(weights.map(e => e.date)); let n = 0;
  for (const k of keys) { let v = null; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
    if (Array.isArray(v)) for (const e of v) if (validWeight(e) && !have.has(e.date)) { weights.push({ date: e.date, kg: e.kg }); have.add(e.date); n++; } }
  weights.sort((a, b) => a.date.localeCompare(b.date));
  if (store(KEYS.weight, weights.concat(weightKeep))) for (const k of keys) try { localStorage.removeItem(k); } catch (e) { }
  const i = loadIssues.indexOf(KEYS.weight); if (i >= 0 && n) loadIssues.splice(i, 1);
})();
function persistWeight() { weights.sort((a, b) => a.date.localeCompare(b.date)); if (!store(KEYS.weight, weights.concat(weightKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
weights.sort((a, b) => a.date.localeCompare(b.date));
const kgOne = v => NUM1F.format(Number(v));
// Ø Veränderung pro Woche: erster und letzter Wert der letzten 28 Tage, mindestens 7 Tage auseinander
function weightRate(today = localDay()) {
  const win = weights.filter(e => e.date >= addDays(today, -28) && e.date <= today);
  if (win.length < 2) return null;
  const a = win[0], b = win.at(-1), days = Math.round((new Date(b.date + 'T12:00:00') - new Date(a.date + 'T12:00:00')) / 864e5);
  return days >= 7 ? (b.kg - a.kg) / days * 7 : null;
}
let measureView = null;
function renderWeight() { renderMeasures(); }
function renderMeasures() {
  const W = weights, B = waistSorted(), nw = W.at(-1), nb = B.at(-1);
  const delta = (rows, f, fmt, unit) => rows.length < 2 ? '–' : ((rows.at(-1)[f] - rows[0][f]) > 0 ? '+' : '') + fmt(rows.at(-1)[f] - rows[0][f]) + ' ' + unit;
  const tint = (el, rows, f) => { const d = rows.length < 2 ? 0 : rows.at(-1)[f] - rows[0][f]; el.style.color = d < 0 ? 'var(--accent-ink)' : d > 0 ? 'var(--orange)' : ''; };
  $('weightlatest').textContent = nw ? kgOne(nw.kg) + ' kg' : '–'; $('weightlastdate').textContent = nw ? dateGerman(nw.date) : T('Noch keine Messung', 'No measurement yet');
  $('waistlatest').textContent = nb ? cmString(nb.cm) + ' cm' : '–'; $('waistlastdate').textContent = nb ? dateGerman(nb.date) : T('Noch keine Messung', 'No measurement yet');
  // Kurzfassung in der zugeklappten Zeile: letzte Werte
  { const last = [nw, nb].filter(Boolean).map(x => x.date).sort().at(-1); $('sum-measure').textContent = nw || nb ? [nw ? kgOne(nw.kg) + ' kg' : '', nb ? cmString(nb.cm) + ' cm' : ''].filter(Boolean).join(' · ') + ` (${dateShort(last)})` : T('Noch keine Messung', 'No measurement yet'); }
  $('weightdelta').textContent = delta(W, 'kg', kgOne, 'kg'); tint($('weightdelta'), W, 'kg');
  $('waistdelta').textContent = delta(B, 'cm', cmString, 'cm'); tint($('waistdelta'), B, 'cm');
  const rate = weightRate(); $('weightrate').textContent = rate === null ? '–' : (rate > 0 ? '+' : '') + kgOne(rate) + ' kg';
  const days = [...new Set(W.map(e => e.date).concat(B.map(e => e.date)))].sort();
  const last = days.at(-1), r = $('waistreminder'); r.classList.remove('due');
  if (!last) r.textContent = T('Noch keine Messung: morgens vor dem Frühstück wiegen und messen und den ersten Wert eintragen.', 'No measurement yet: weigh and measure in the morning before breakfast and enter the first value.');
  else { const nd = addDays(last, 7), due = localDay() >= nd; r.classList.toggle('due', due); r.textContent = due ? T(`📏 Zeit für die nächste Messung – die letzte war am ${dateGerman(last)}.`, `📏 Time for the next measurement – the last one was on ${dateGerman(last)}.`) : T(`✓ Letzte Messung am ${dateGerman(last)}. Nächste ab ${dateGerman(nd)}.`, `✓ Last measurement on ${dateGerman(last)}. Next from ${dateGerman(nd)}.`); }
  $('measurehistory').innerHTML = days.length ? days.slice().reverse().map(d => {
    const w = W.find(e => e.date === d), b = B.find(e => e.date === d), note = (b && b.note) || (w && w.note) || '';
    return `<tr><td>${dateGerman(d)}</td><td>${w ? `<b>${kgOne(w.kg)} kg</b>` : '–'}</td><td>${b ? `<b>${cmString(b.cm)} cm</b>` : '–'}</td><td>${esc(note || '–')}</td><td><button class="btn small danger" type="button" data-measure-delete="${esc(d)}" aria-label="${T(`Messung vom ${dateGerman(d)} löschen`, `Delete measurement of ${dateGerman(d)}`)}">${T('Löschen', 'Delete')}</button></td></tr>`;
  }).join('') : `<tr><td colspan="5" class="tag">${T('Noch keine Messung gespeichert.', 'No measurement saved yet.')}</td></tr>`;
  const view = measureView || (W.length || !B.length ? 'weight' : 'waist');
  for (const t of $('measuretabs').children) t.setAttribute('aria-selected', String(t.dataset.measure === view));
  const rows = view === 'weight' ? W : B;
  $('measurechart').innerHTML = rows.length ? (view === 'weight' ? measureChart(W.slice(-12), e => e.kg, kgOne, T('Körpergewicht', 'Body weight'), 'kg') : measureChart(B.slice(-12), e => e.cm, cmString, T('Bauchumfang', 'Waist'), 'cm'))
    : `<div class="empty">${T(`Nach der ersten ${view === 'weight' ? 'Gewichts' : 'Bauchumfang'}-Messung erscheint hier der Verlauf.`, `The history appears here after the first ${view === 'weight' ? 'weight' : 'waist'} measurement.`)}</div>`;
}
function saveMeasureFromForm() {
  const date = $('measuredate').value, kg = kmNum($('measurekg').value), cm = kmNum($('measurecm').value), note = $('measurenote').value.trim().slice(0, 120);
  for (const id of ['measurekg', 'measurecm']) $(id).removeAttribute('aria-invalid');
  if (!isDay(date) || date > localDay()) { toast(T('Bitte ein Datum bis heute wählen.', 'Please choose a date up to today.')); return; }
  const badKg = kg !== null && (Number.isNaN(kg) || kg < 30 || kg > 350), badCm = cm !== null && (Number.isNaN(cm) || cm < 40 || cm > 250);
  if (badKg) $('measurekg').setAttribute('aria-invalid', 'true'); if (badCm) $('measurecm').setAttribute('aria-invalid', 'true');
  if (badKg || badCm) { toast(badKg ? T('Gewicht bitte in kg, z. B. 98,4.', 'Weight in kg please, e.g. 98.4.') : T('Bauchumfang bitte in cm zwischen 40 und 250.', 'Waist in cm please, between 40 and 250.')); return; }
  if (kg === null && cm === null) { toast(T('Bitte Gewicht oder Bauchumfang eintragen.', 'Please enter weight or waist.')); return; }
  if (kg !== null) { const o = { date, kg }; if (note && cm === null) o.note = note; weights = weights.filter(e => e.date !== date).concat(o); persistWeight(); }
  if (cm !== null) { const v = { id: uid(), date, cm, note, at: new Date().toISOString() }, i = waist.findIndex(x => x.date === date); if (i >= 0) { v.id = waist[i].id; waist[i] = v; } else waist.push(v); persistWaist(); }
  if (kg !== null && cm === null) measureView = 'weight'; else if (cm !== null && kg === null) measureView = 'waist';
  renderMeasures(); for (const id of ['measurekg', 'measurecm', 'measurenote']) $(id).value = '';
  toast(T(`✓ ${[kg !== null ? kgOne(kg) + ' kg' : '', cm !== null ? cmString(cm) + ' cm' : ''].filter(Boolean).join(' · ')} am ${dateGerman(date)} gespeichert.`, `✓ ${[kg !== null ? kgOne(kg) + ' kg' : '', cm !== null ? cmString(cm) + ' cm' : ''].filter(Boolean).join(' · ')} saved for ${dateGerman(date)}.`));
}

/* ---------- Profil-Oberfläche ---------- */
const wdSelect = (id, cur, none) => `<select id="${id}">${none ? `<option value=""${cur === null ? ' selected' : ''}>${esc(none)}</option>` : ''}${WEEK_ORDER.map(d => `<option value="${d}"${d === cur ? ' selected' : ''}>${WD_LONG[d]}</option>`).join('')}</select>`;
// Hinweise zur Woche: gleiche Tage, harte Tage direkt hintereinander
function weekWarnings(w = profile.week) {
  const out = [], next = d => d === null ? null : (d + 1) % 7;
  if (w.long === null) out.push(T('Ohne Longrun fehlt die wichtigste Einheit für Halbmarathon und Marathon. Fällt er nur einmal aus, besser in der Plan-Übersicht „Entfällt“ tippen.', 'Without a long run the most important session for half marathon and marathon is missing. If it is only skipped once, better tap “Skip” in the plan overview.'));
  if (w.quality === null) out.push(T('Ohne Qualitätseinheit läuft der Plan nur locker – für 5 und 10 km fehlt dann das Tempo.', 'Without a quality session the plan is easy running only – for 5 and 10 km the speed is then missing.'));
  if (w.quality !== null && w.quality === w.long) out.push(T('Qualität und Longrun liegen am selben Tag.', 'Quality session and long run are on the same day.'));
  if (w.group !== null && w.quality !== null && w.group === w.quality) out.push(T('Laufgruppe und Qualitätseinheit liegen am selben Tag – die Laufgruppe ist als lockerer Lauf gedacht.', 'Running group and quality session are on the same day – the running group is meant as an easy run.'));
  if (w.quality !== null && w.long !== null && next(w.quality) === w.long) out.push(T(`Qualität am ${WD_LONG[w.quality]} direkt vor dem Longrun: zwei harte Tage hintereinander. Besser mindestens einen Tag Abstand.`, `Quality on ${WD_LONG[w.quality]} right before the long run: two hard days in a row. Better leave at least one day in between.`));
  if (w.quality !== null && w.long !== null && next(w.long) === w.quality) out.push(T(`Qualität am ${WD_LONG[w.quality]} direkt nach dem Longrun – die Beine sind dann selten frisch.`, `Quality on ${WD_LONG[w.quality]} right after the long run – the legs are rarely fresh then.`));
  // zweite Qualität: nicht direkt neben Qualität oder Longrun; zwei Läufe am selben Tag vermeiden
  const hard = [[w.quality, T('Qualität', 'Quality')], [w.long, T('Longrun', 'Long run')]].concat(w.extras.filter(e => e.type === 'quality').map(e => [e.d, e.name || T('2. Qualität', '2nd quality')])).filter(([d]) => d !== null);
  for (const e of w.extras.filter(e => e.type === 'quality')) for (const [d, n] of hard) if (d !== e.d && (next(d) === e.d || next(e.d) === d)) { out.push(T(`${e.name || '2. Qualität'} am ${WD_LONG[e.d]} liegt direkt neben ${n} (${WD_LONG[d]}) – zwei harte Tage hintereinander. Besser einen lockeren Tag dazwischen.`, `${e.name || '2nd quality'} on ${WD_LONG[e.d]} is right next to ${n} (${WD_LONG[d]}) – two hard days in a row. Better an easy day in between.`)); break; }
  const runDays = [w.quality, w.long, w.group, ...w.extras.filter(e => e.type !== 'other').map(e => e.d)].filter(d => d !== null);
  if (new Set(runDays).size < runDays.length) out.push(T('Zwei Läufe am selben Tag – gemeint ist meist ein Lauf. Sonst plant die App beide ein.', 'Two runs on the same day – usually one run is meant. Otherwise the app plans both.'));
  if (w.long !== null && w.strength.includes(w.long)) out.push(T('Kraft am Longrun-Tag: nur Oberkörper oder nach dem Lauf leicht.', 'Strength on long-run day: upper body only or light after the run.'));
  return out;
}
const mod = k => !profile.modules || profile.modules[k] !== false;
const strengthDays = () => mod('kraft') ? profile.week.strength : [];
const MOD_LABEL = () => ({ kraft: T('Kraft', 'Strength'), laufen: T('Laufen', 'Running'), mobility: 'Mobility' });
const modChips = () => `<p class="tiny">${T('Was machst du? Abgewähltes verschwindet aus Leiste, Startseite und Profil.', 'What do you do? Deselected parts disappear from the bar, home screen and profile.')}</p><div class="chips" role="group" aria-label="${T('Bereiche', 'Areas')}">${['kraft', 'laufen', 'mobility'].map(k => `<button type="button" class="chip" data-modtoggle="${k}" aria-pressed="${mod(k)}">${MOD_LABEL()[k]}</button>`).join('')}</div>`;
// Routine für einen Mobility-Tag: festgelegt, sonst die zuletzt genutzte, sonst die erste
function mobRoutineOn(wd) { const id = profile.week.mobilityPlan[wd], last = getMobLog().at(-1); return MOBILITY.routines.find(r => r.id === id) || (last && MOBILITY.routines.find(r => r.title === last.t)) || MOBILITY.routines[0]; }
// Leiste und Profil-Bereiche nach dem, was du machst
function applyModules() {
  for (const b of $('tabbar').children) if (['kraft', 'laufen', 'mobility'].includes(b.dataset.area)) b.classList.toggle('hide', !mod(b.dataset.area));
  $('sect-hr').classList.toggle('hide', !mod('laufen')); $('sect-kit').classList.toggle('hide', !mod('kraft'));
  if (['kraft', 'laufen', 'mobility'].includes(area) && !mod(area)) showArea('start');
}
function renderProfile() {
  const w = profile.week, h = profile.hr, k = profile.kit;
  // Kurzfassungen in den zugeklappten Zeilen
  const days = a => a.length ? WEEK_ORDER.filter(d => a.includes(d)).map(d => WD[d]).join(', ') : T('keine', 'none');
  $('sum-week').textContent = [w.runner === 'beginner' ? T('Lauf-Einstieg', 'Running starter') : '', w.quality !== null ? `${T('Qualität', 'Quality')} ${WD[w.quality]}` : '', w.long !== null ? `${T('Longrun', 'Long run')} ${WD[w.long]}` : '', `${T('Kraft', 'Strength')} ${days(w.strength)}`].filter(Boolean).join(' · ');
  $('sum-hr').textContent = h.z ? `Zone 2: ${zoneRange(2)}` : T('Noch keine Zonen', 'No zones yet');
  $('sum-kit').textContent = (k.kb.length || k.db.length || k.bands.length ? [k.kb.length ? `Kettlebell ${k.kb.map(kgText).join(' · ')} kg` : '', k.db.length ? T(`Kurzhanteln ${k.db.map(kgText).join(' · ')} kg`, `Dumbbells ${k.db.map(kgText).join(' · ')} kg`) : '', k.bands.length ? T(`${k.bands.length} ${k.bands.length === 1 ? 'Band' : 'Bänder'}`, `${k.bands.length} ${k.bands.length === 1 ? 'band' : 'bands'}`) : ''].filter(Boolean).join(' · ') : T('Noch keine Geräte – nur Körpergewicht', 'No equipment yet – body weight only')) + (k.vacation && localDay() <= k.vacation.to ? ' · 🏖 ' + T('Urlaub ', 'holiday ') + vacStatus() : '');
  $('weekpanel').innerHTML = `${modChips()}${mod('laufen') ? `<div class="raceform" style="padding:0">
      <div class="field wide"><label for="wklevel">${T('Laufniveau', 'Running level')}</label><select id="wklevel">${w.runner === null ? `<option value="" selected>${T('Noch nicht festgelegt', 'Not set yet')}</option>` : ''}<option value="beginner"${w.runner === 'beginner' ? ' selected' : ''}>${T('Einsteiger – Lauf-Einstieg (9 Wochen)', 'Beginner – running starter (9 weeks)')}</option><option value="runner"${w.runner === 'runner' ? ' selected' : ''}>${T('Läufer – Saisonplan', 'Runner – season plan')}</option></select></div>
      <div class="field"><label for="wkquality">${T('Qualität (Intervall/Tempo)', 'Quality (intervals/tempo)')}</label>${wdSelect('wkquality', w.quality, T('keine', 'none'))}</div>
      <div class="field"><label for="wklong">${T('Longrun', 'Long run')}</label>${wdSelect('wklong', w.long, T('keine', 'none'))}</div>
      <div class="field"><label for="wkgroup">${T('Laufgruppe (locker)', 'Running group (easy)')}</label>${wdSelect('wkgroup', w.group, T('keine', 'none'))}</div>
    </div>
    <p class="tiny">${T('Weitere Einheiten – z. B. ein zweiter lockerer Lauf, eine zweite Qualität oder Rad, Kurs, Regeneration', 'Other sessions – e.g. a second easy run, a second quality session or cycling, a class, recovery')}</p>
    <div id="wkextras">${w.extras.map((e, i) => `<div class="raceform extrarow" style="padding:0">
      <div class="field"><label for="wkxd${i}">${T('Tag', 'Day')}</label>${wdSelect('wkxd' + i, e.d, null).replace('<select ', `<select data-xday="${i}" `)}</div>
      <div class="field"><label for="wkxt${i}">${T('Art', 'Type')}</label><select id="wkxt${i}" data-xtype="${i}">${[['easy', T('Lockerer Lauf', 'Easy run')], ['recovery', T('Regeneration', 'Recovery run')], ['quality', T('Intervall/Tempo (2. Qualität)', 'Intervals/tempo (2nd quality)')], ['other', T('Anderes (Rad, Kurs …)', 'Other (cycling, class …)')]].map(([v, l]) => `<option value="${v}"${e.type === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field wide"><label for="wkxn${i}">${T('Name (optional)', 'Name (optional)')}</label><div class="kitadd" style="margin:0"><input id="wkxn${i}" data-xname="${i}" type="text" maxlength="30" autocomplete="off" placeholder="${e.type === 'other' ? T('z. B. Radfahren, Blaze', 'e.g. cycling, class') : T('z. B. Feierabendrunde', 'e.g. after-work run')}" value="${esc(e.name)}"><button type="button" class="btn small danger" data-xdel="${i}" aria-label="${T('Einheit entfernen', 'Remove session')}">${T('Entfernen', 'Remove')}</button></div></div>
    </div>`).join('')}</div>
    ${w.extras.length < 4 ? `<div class="chips"><button type="button" class="chip" id="wkxadd">＋ ${T('Weitere Einheit', 'Other session')}</button></div>` : ''}
` : ''}${mod('kraft') ? `    <p class="tiny">${T('Kraft-Tage', 'Strength days')}</p><div class="chips days" role="group" aria-label="${T('Kraft-Tage', 'Strength days')}">${WEEK_ORDER.map(d => `<button type="button" class="chip" data-strength="${d}" aria-pressed="${w.strength.includes(d)}">${WD[d]}</button>`).join('')}</div>
    ${w.strength.length ? `<p class="tiny">${T('Plan je Krafttag – „frei“ nimmt den zuletzt genutzten', 'Plan per strength day – “free” uses the last one you used')}</p><div class="dayplans">${WEEK_ORDER.filter(d => w.strength.includes(d)).map(d => `<label class="dayplan"><span>${WD[d]}</span><select data-wkplan="${d}" aria-label="${T(`Kraft-Plan am ${WD_LONG[d]}`, `Strength plan on ${WD_LONG[d]}`)}"><option value="">${T('frei', 'free')}</option>${PLAN_ORDER.filter(pk => planOwned(pk) && !PLANS[pk].vacationOnly).map(pk => `<option value="${pk}"${w.strengthPlan[d] === pk ? ' selected' : ''}>${esc(tr(PLANS[pk].tab))}</option>`).join('')}<option value="gym"${w.strengthPlan[d] === 'gym' ? ' selected' : ''}>${T('Gym/Kurs', 'Gym/class')}</option></select>${w.strengthPlan[d] === 'gym' ? `<input type="text" data-wkgym="${d}" maxlength="30" autocomplete="off" value="${esc(w.gymNames[d] || '')}" placeholder="${T('z. B. Blaze', 'e.g. Blaze')}" aria-label="${T(`Name des Kurses am ${WD_LONG[d]}`, `Name of the class on ${WD_LONG[d]}`)}">` : ''}</label>`).join('')}</div>` : ''}
    ${w.strength.length ? `<p class="tiny">${T('Feste Krafttage – beim Nachholen kommt dort kein Lauf dazu', 'Fixed strength days – no run is added there when catching up')}</p><div class="chips days" role="group" aria-label="${T('Feste Krafttage', 'Fixed strength days')}">${WEEK_ORDER.filter(d => w.strength.includes(d)).map(d => `<button type="button" class="chip" data-strengthfix="${d}" aria-pressed="${w.strengthFixed.includes(d)}">${WD[d]}</button>`).join('')}</div>` : ''}
` : ''}${mod('mobility') ? `    <p class="tiny">${T('Mobility-Tage', 'Mobility days')}</p><div class="chips days" role="group" aria-label="${T('Mobility-Tage', 'Mobility days')}">${WEEK_ORDER.map(d => `<button type="button" class="chip" data-mobday="${d}" aria-pressed="${w.mobility.includes(d)}">${WD[d]}</button>`).join('')}</div>
    ${w.mobility.length ? `<p class="tiny">${T('Routine je Mobility-Tag – „frei“ nimmt die zuletzt genutzte', 'Routine per mobility day – “free” uses the last one you used')}</p><div class="dayplans">${WEEK_ORDER.filter(d => w.mobility.includes(d)).map(d => `<label class="dayplan"><span>${WD[d]}</span><select data-wkmob="${d}" aria-label="${T(`Mobility-Routine am ${WD_LONG[d]}`, `Mobility routine on ${WD_LONG[d]}`)}"><option value="">${T('frei', 'free')}</option>${MOBILITY.routines.map(r => `<option value="${r.id}"${w.mobilityPlan[d] === r.id ? ' selected' : ''}>${esc(tr(r.label))}</option>`).join('')}</select></label>`).join('')}</div>` : ''}
` : ''}    ${weekWarnings().map(t => `<div class="alert due">${esc(t)}</div>`).join('')}
    <p class="tiny">${T('Optional: im Plan abhaken, was erledigt ist, und Verpasstes in derselben Woche auf einen freien Tag verschieben.', 'Optional: tick off in the plan what is done and move missed sessions to a free day in the same week.')}</p><div class="chips"><button type="button" class="chip" data-wktrack aria-pressed="${w.track}">${T('Abhaken & nachholen', 'Tick off & catch up')}</button></div>`;
  const zr = n => zoneRange(n);
  $('hrpanel').innerHTML = `<div class="raceform" style="padding:0">
      <div class="field"><label for="hrmax">${T('Maximale HF', 'Max HR')}</label><input id="hrmax" type="text" inputmode="numeric" autocomplete="off" placeholder="${T('z. B. 184', 'e.g. 184')}" value="${h.max ?? ''}"></div>
      <div class="field"><label for="hrrest">${T('Ruhe-HF', 'Resting HR')}</label><input id="hrrest" type="text" inputmode="numeric" autocomplete="off" placeholder="${T('z. B. 60', 'e.g. 60')}" value="${h.rest ?? ''}"></div>
      <div class="raceactions"><button type="button" class="btn small" id="hrcalc">${T('Zonen berechnen', 'Calculate zones')}</button></div>
    </div>
    <details class="hrest" id="hrestimate"><summary class="tiny">${T('Kein Testwert? Maximale HF schätzen', 'No test value? Estimate max HR')}</summary>
      <div class="raceform" style="padding:8px 0 0"><div class="field"><label for="hrage">${T('Alter', 'Age')}</label><input id="hrage" type="text" inputmode="numeric" autocomplete="off" placeholder="${T('z. B. 43', 'e.g. 43')}"></div>
        <div class="raceactions"><button type="button" class="btn small" id="hrestbtn">${T('Schätzen', 'Estimate')}</button></div></div>
      <div id="hrestout"></div>
      <p class="tiny">${T('Am genauesten ist ein gemessener Wert: der höchste Puls am Ende eines harten Rennens über 5–10 km mit Endspurt, oder ein Feldtest – nach gutem Aufwärmen 3 × 3 Min. bergauf so hart wie möglich mit 2 Min. Pause, der höchste Wert im letzten Abschnitt. Formeln liegen bei Einzelnen oft ±10 Schläge daneben, „220 − Alter“ noch mehr. Maximal belasten nur, wenn es gesundheitlich passt – im Zweifel vorher ärztlich abklären.', 'Most accurate is a measured value: the highest heart rate at the end of a hard 5–10 km race with a finishing sprint, or a field test – after a good warm-up 3 × 3 min uphill as hard as possible with 2 min rest, the highest value in the last section. Formulas are often ±10 beats off for individuals, “220 − age” even more. Only go all-out if your health allows it – if in doubt, check with a doctor first.')}</p>
    </details>
    <p class="tiny">${T('Berechnet nach Karvonen aus der Herzfrequenzreserve (Zone 1 ab 50 %, Zone 2 ab 60 %, Zone 3 ab 70 %, Zone 4 ab 80 %, Zone 5 ab 90 %). Hat deine Uhr andere Grenzen, trag sie unten direkt ein.', 'Calculated with Karvonen from the heart rate reserve (zone 1 from 50 %, zone 2 from 60 %, zone 3 from 70 %, zone 4 from 80 %, zone 5 from 90 %). If your watch uses other limits, enter them directly below.')}</p>
    <div class="zonegrid">${[1, 2, 3, 4, 5].map(n => `<label class="kmin"><span>${T(`Zone ${n} ab`, `Zone ${n} from`)}</span><input type="text" inputmode="numeric" autocomplete="off" data-zone="${n}" value="${h.z ? h.z[n - 1] : ''}" aria-label="${T(`Zone ${n} ab bpm`, `Zone ${n} from bpm`)}"></label>`).join('')}</div>
    ${h.z ? `<div class="zonelist">${[1, 2, 3, 4, 5].map(n => `<span class="ph-z${n}"><b>Zone ${n}</b>${zr(n)}</span>`).join('')}</div>` : `<p class="tiny">${T('Noch keine Zonen gespeichert.', 'No zones saved yet.')}</p>`}`;
  const kbChips = k.kb.map(v => `<span class="chip on">${kgText(v)} kg<button type="button" class="chipx" data-kbdel="${v}" aria-label="${T(`${kgText(v)} kg entfernen`, `Remove ${kgText(v)} kg`)}">×</button></span>`).join('') || `<span class="tiny">${T('keine', 'none')}</span>`;
  const dbChips = k.db.map(v => `<span class="chip on">${kgText(v)} kg<button type="button" class="chipx" data-dbdel="${v}" aria-label="${T(`Kurzhantel ${kgText(v)} kg entfernen`, `Remove dumbbell ${kgText(v)} kg`)}">×</button></span>`).join('') || `<span class="tiny">${T('keine', 'none')}</span>`;
  const bandChips = k.bands.map(v => `<span class="chip on">${v} kg<button type="button" class="chipx" data-banddel="${v}" aria-label="${T(`Band ${v} kg entfernen`, `Remove band ${v} kg`)}">×</button></span>`).join('') || `<span class="tiny">${T('keine', 'none')}</span>`;
  $('kitpanel').innerHTML = `<p class="tiny" style="margin-top:0">Kettlebells</p><div class="chips">${kbChips}</div>
    <div class="kitadd"><input type="text" inputmode="decimal" autocomplete="off" id="kbnew" placeholder="${T('Gewicht in kg, z. B. 16', 'Weight in kg, e.g. 16')}" aria-label="${T('Kettlebell-Gewicht hinzufügen', 'Add kettlebell weight')}"><button type="button" class="btn small" id="kbadd">${T('Hinzufügen', 'Add')}</button></div>
    ${k.kb.length ? `<div class="field"><label for="kbdefault">${T('Standardgewicht für Kettlebell-Übungen', 'Default weight for kettlebell exercises')}</label><select id="kbdefault">${k.kb.map(v => `<option value="${v}"${v === k.kbDefault ? ' selected' : ''}>${kgText(v)} kg</option>`).join('')}</select></div>` : ''}
    <p class="tiny">${T('Verstellbare Kettlebell: jede Stufe einzeln eintragen.', 'Adjustable kettlebell: enter each setting separately.')}</p>
    <p class="tiny">${T('Kurzhanteln (Gewicht je Hantel)', 'Dumbbells (weight per dumbbell)')}</p><div class="chips">${dbChips}</div>
    <div class="kitadd"><input type="text" inputmode="decimal" autocomplete="off" id="dbnew" placeholder="${T('Gewicht in kg, z. B. 8', 'Weight in kg, e.g. 8')}" aria-label="${T('Kurzhantel-Gewicht hinzufügen', 'Add dumbbell weight')}"><button type="button" class="btn small" id="dbadd">${T('Hinzufügen', 'Add')}</button></div>
    ${k.db.length ? `<div class="field"><label for="dbdefault">${T('Standardgewicht für Kurzhantel-Übungen', 'Default weight for dumbbell exercises')}</label><select id="dbdefault">${k.db.map(v => `<option value="${v}"${v === k.dbDefault ? ' selected' : ''}>${kgText(v)} kg</option>`).join('')}</select></div>` : ''}
    <p class="tiny">${T('Verstellbare Kurzhanteln: jede Stufe einzeln eintragen. Übungen mit zwei Hanteln nehmen zwei gleich schwere.', 'Adjustable dumbbells: enter each setting separately. Exercises with two dumbbells use two of the same weight.')}</p>
    <p class="tiny">${T('Widerstandsbänder (Zugkraft)', 'Resistance bands (pull force)')}</p><div class="chips">${bandChips}</div>
    <div class="kitadd"><input type="text" inputmode="numeric" autocomplete="off" id="bandnew" placeholder="${T('Stärke in kg, z. B. 40', 'Strength in kg, e.g. 40')}" aria-label="${T('Band hinzufügen', 'Add band')}"><button type="button" class="btn small" id="bandadd">${T('Hinzufügen', 'Add')}</button></div>
    <p class="tiny">${T('In den Übungen stehen die Bänder einzeln und je zwei kombiniert zur Auswahl.', 'In the exercises the bands are available singly and combined in pairs.')}</p>
    <p class="tiny">${T('Kraft bietet nur an, was hier eingetragen ist: ohne Kettlebell keine Kettlebell-Übungen und keine reinen Kettlebell-Pläne (AMRAP, Core), ohne Kurzhanteln keine Hantel-Übungen, ohne Bänder keine Band-Übungen.', 'Strength only offers what is entered here: without a kettlebell no kettlebell exercises and no kettlebell-only plans (AMRAP, Core), without dumbbells no dumbbell exercises, without bands no band exercises.')}</p>
    <p class="tiny" style="margin-top:14px"><b>${T('Urlaub', 'Holiday')}</b> – ${vacStatus()}</p>
    <div class="raceform" style="padding:0"><div class="field"><label for="vacfrom">${T('Von', 'From')}</label><input id="vacfrom" type="date" value="${k.vacation ? k.vacation.from : ''}"></div><div class="field"><label for="vacto">${T('Bis', 'Until')}</label><input id="vacto" type="date" value="${k.vacation ? k.vacation.to : ''}"></div>
      ${k.vacation ? `<div class="raceactions"><button type="button" class="btn small danger" id="vacclear">${T('Urlaub löschen', 'Delete holiday')}</button></div>` : ''}</div>
    <p class="tiny">${T('In dieser Zeit ist in allen Plänen nur Körpergewicht vorgewählt, AMRAP und Core sind ausgeblendet. Nimmst du doch Bänder mit, schalte sie in Kraft dazu – das gilt nur für den Urlaub. Danach gelten wieder deine Geräte je Plan.', 'During this time all plans are preset to body weight only, AMRAP and Core are hidden. If you do take bands, switch them on in Strength – that only applies to the holiday. Afterwards your equipment per plan applies again.')}</p>`;
}
const intNum = v => { const t = String(v ?? '').trim(); if (t === '') return null; return /^\d{2,3}$/.test(t) ? Number(t) : NaN; };
function vacStatus() {
  const v = profile.kit.vacation, d = localDay();
  return !v ? T('nur Körpergewicht für einen Zeitraum', 'body weight only for a period') : vacation() ? T(`läuft bis ${dateGerman(v.to)}`, `on until ${dateGerman(v.to)}`) : v.from > d ? T(`geplant ${dateGerman(v.from)} bis ${dateGerman(v.to)}`, `planned ${dateGerman(v.from)} to ${dateGerman(v.to)}`) : T(`vorbei (${dateGerman(v.to)})`, `over (${dateGerman(v.to)})`);
}
function profileChanged(what) {
  persistProfile(); renderProfile();
  if (what === 'kit') renderAll();
  renderRun();
}
function onProfileClick(e) {
  const t = e.target;
  const sf = t.closest('[data-strengthfix]'); if (sf) { const d = Number(sf.dataset.strengthfix), f = profile.week.strengthFixed; profile.week.strengthFixed = f.includes(d) ? f.filter(x => x !== d) : f.concat(d); persistProfile(); renderProfile(); renderRun(); return; }
  const xd = t.closest('[data-xdel]'); if (xd) { profile.week.extras.splice(Number(xd.dataset.xdel), 1); persistProfile(); renderProfile(); renderRun(); return; }
  if (t.id === 'wkxadd') { const used = [profile.week.quality, profile.week.long, profile.week.group, ...profile.week.extras.map(e => e.d)], d = WEEK_ORDER.find(x => !used.includes(x)); profile.week.extras.push({ d: d ?? 6, type: 'easy', name: '' }); persistProfile(); renderProfile(); renderRun(); return; }
  if (t.closest('[data-wktrack]')) { profile.week.track = !profile.week.track; persistProfile(); renderProfile(); renderRun(); return; }
  const mt = t.closest('[data-modtoggle]');
  if (mt) { const k = mt.dataset.modtoggle, on = !mod(k); if (!on && ['kraft', 'laufen', 'mobility'].filter(mod).length === 1) { toast(T('Mindestens ein Bereich bleibt an.', 'At least one area stays on.')); return; } profile.modules[k] = on; profileChanged('week'); applyModules(); renderStart(); return; }
  const mdy = t.closest('[data-mobday]');
  if (mdy) { const d = Number(mdy.dataset.mobday), m = profile.week.mobility; profile.week.mobility = m.includes(d) ? m.filter(x => x !== d) : m.concat(d); profileChanged('week'); return; }
  const sd = t.closest('[data-strength]');
  if (sd) { const d = Number(sd.dataset.strength), s = profile.week.strength; profile.week.strength = s.includes(d) ? s.filter(x => x !== d) : s.concat(d); profileChanged('week'); return; }
  // Max. HF schätzen: Tanaka (2001, Metaanalyse) und Nes (2013, HUNT-Studie, trainierte Erwachsene) statt „220 − Alter“; das Alter wird nicht gespeichert
  if (t.id === 'hrestbtn') {
    const a = intNum($('hrage').value);
    if (!okNum(a, 15, 99)) { $('hrage').setAttribute('aria-invalid', 'true'); toast(T('Bitte das Alter eingeben (15–99).', 'Please enter your age (15–99).')); return; }
    $('hrage').removeAttribute('aria-invalid');
    const tan = Math.round(208 - 0.7 * a), nes = Math.round(211 - 0.64 * a), old = 220 - a;
    $('hrestout').innerHTML = `<div class="group" style="margin:8px 0"><div class="row"><span class="txt"><b>Tanaka · ${tan} bpm</b><small>208 − 0,7 × ${a}</small></span><button type="button" class="btn small" data-hrset="${tan}">${T('Übernehmen', 'Use')}</button></div>
      <div class="row"><span class="txt"><b>Nes (HUNT) · ${nes} bpm</b><small>211 − 0,64 × ${a}${T(' · aus einer Studie mit trainierten Erwachsenen', ' · from a study with trained adults')}</small></span><button type="button" class="btn small" data-hrset="${nes}">${T('Übernehmen', 'Use')}</button></div>
      <div class="row"><span class="txt"><small>${T(`Zum Vergleich „220 − Alter“: ${old} bpm – die ungenaueste Formel`, `For comparison “220 − age”: ${old} bpm – the least accurate formula`)}</small></span></div></div>`;
    return;
  }
  const hs = t.closest('[data-hrset]');
  // nur die max. HF setzen – eigene Zonen (z. B. von der Uhr) bleiben, bis „Zonen berechnen“ getippt wird
  if (hs) { const v = Number(hs.dataset.hrset); profile.hr.max = v; profileChanged('hr'); toast(T(`Max. HF ${v} übernommen – jetzt ${profile.hr.rest ? '' : 'Ruhe-HF eintragen und '}„Zonen berechnen“ tippen.`, `Max HR ${v} applied – now ${profile.hr.rest ? '' : 'enter your resting HR and '}tap “Calculate zones”.`)); return; }
  if (t.id === 'hrcalc') {
    const max = intNum($('hrmax').value), rest = intNum($('hrrest').value);
    if (!okNum(max, 100, 230) || !okNum(rest, 30, 120) || rest >= max) { toast(T('Bitte maximale HF (100–230) und Ruhe-HF (30–120) eingeben.', 'Please enter max HR (100–230) and resting HR (30–120).')); return; }
    profile.hr = { max, rest, z: hrZonesFrom(max, rest) }; profileChanged('hr'); toast(T('Zonen berechnet.', 'Zones calculated.')); return;
  }
  if (t.id === 'kbadd' || t.id === 'dbadd') { // Kettlebell bzw. Kurzhantel (Gewicht je Hantel)
    const g = t.id.slice(0, 2), v = kmNum($(g + 'new').value);
    if (v === null || Number.isNaN(v) || v < 0.5 || v > 60) { toast(T('Bitte ein Gewicht zwischen 0,5 und 60 kg eingeben.', 'Please enter a weight between 0.5 and 60 kg.')); return; }
    profile.kit[g] = profile.kit[g].concat(Math.round(v * 2) / 2); if (profile.kit[g].length === 1) profile.kit[g + 'Default'] = profile.kit[g][0]; profileChanged('kit'); return;
  }
  if (t.id === 'bandadd') {
    const v = kmNum($('bandnew').value);
    if (v === null || Number.isNaN(v) || v < 1 || v > 200) { toast(T('Bitte die Bandstärke in kg eingeben.', 'Please enter the band strength in kg.')); return; }
    if (profile.kit.bands.length >= 6 && !profile.kit.bands.includes(Math.round(v))) { toast(T('Höchstens 6 Bänder.', 'At most 6 bands.')); return; }
    profile.kit.bands = profile.kit.bands.concat(Math.round(v)); profileChanged('kit'); return;
  }
  if (t.id === 'vacclear') { profile.kit.vacation = null; profileChanged('kit'); toast(T('Urlaub gelöscht – wieder deine Geräte je Plan.', 'Holiday deleted – your equipment per plan again.')); return; }
  const kd = t.closest('[data-kbdel]'); if (kd) { profile.kit.kb = profile.kit.kb.filter(v => v !== Number(kd.dataset.kbdel)); profileChanged('kit'); return; }
  const dd = t.closest('[data-dbdel]'); if (dd) { profile.kit.db = profile.kit.db.filter(v => v !== Number(dd.dataset.dbdel)); profileChanged('kit'); return; }
  const bd = t.closest('[data-banddel]'); if (bd) { profile.kit.bands = profile.kit.bands.filter(v => v !== Number(bd.dataset.banddel)); profileChanged('kit'); return; }
  const ms = t.closest('[data-measure]'); if (ms && ms.dataset.measure) { measureView = ms.dataset.measure; renderMeasures(); return; }
  const md = t.closest('[data-measure-delete]');
  if (md) { const d = md.dataset.measureDelete, ow = weights.filter(x => x.date === d), oa = waist.filter(x => x.date === d); weights = weights.filter(x => x.date !== d); waist = waist.filter(x => x.date !== d); persistWeight(); persistWaist(); renderMeasures();
    toastUndo(T(`Messung vom ${dateGerman(d)} gelöscht.`, `Measurement of ${dateGerman(d)} deleted.`), () => { weights = weights.concat(ow); waist = waist.concat(oa).sort((a, b) => a.date.localeCompare(b.date)); persistWeight(); persistWaist(); renderMeasures(); }); return; }
}
function onProfileChange(e) {
  const t = e.target, wk = profile.week, val = t.value === '' ? null : Number(t.value);
  if (t.id === 'wkquality') wk.quality = val; else if (t.id === 'wklong') wk.long = val; else if (t.id === 'wkgroup') wk.group = val;
  else if (t.dataset.xday !== undefined) wk.extras[Number(t.dataset.xday)].d = val;
  else if (t.dataset.xtype !== undefined) wk.extras[Number(t.dataset.xtype)].type = t.value;
  else if (t.dataset.xname !== undefined) wk.extras[Number(t.dataset.xname)].name = t.value.trim().slice(0, 30);
  else if (t.id === 'wklevel') wk.runner = t.value === 'beginner' || t.value === 'runner' ? t.value : null;
  else if (t.dataset.wkplan !== undefined) { const d = t.dataset.wkplan; if (PLANS[t.value] || t.value === 'gym') wk.strengthPlan[d] = t.value; else delete wk.strengthPlan[d]; if (t.value !== 'gym') delete wk.gymNames[d]; }
  else if (t.dataset.wkmob !== undefined) { const d = t.dataset.wkmob; if (MOBILITY.routines.some(r => r.id === t.value)) wk.mobilityPlan[d] = t.value; else delete wk.mobilityPlan[d]; }
  else if (t.dataset.wkgym !== undefined) { const d = t.dataset.wkgym, n = t.value.trim().slice(0, 30); if (n) wk.gymNames[d] = n; else delete wk.gymNames[d]; }
  else if (t.id === 'kbdefault' || t.id === 'dbdefault') { profile.kit[t.id.slice(0, 2) + 'Default'] = Number(t.value); profileChanged('kit'); return; }
  else if (t.id === 'vacfrom' || t.id === 'vacto') {
    const f = $('vacfrom').value, u = $('vacto').value; if (!isDay(f) || !isDay(u)) return; // erst speichern, wenn beide Daten stehen
    if (f > u) { $('vacto').setAttribute('aria-invalid', 'true'); toast(T('„Bis“ liegt vor „Von“.', '“Until” is before “From”.')); return; }
    const old = profile.kit.vacation; profile.kit.vacation = { from: f, to: u, gear: old ? old.gear : { kb: false, db: false, band: false, bw: true } };
    profileChanged('kit'); toast(T(`🏖 Urlaub ${dateGerman(f)} bis ${dateGerman(u)}: nur Körpergewicht.`, `🏖 Holiday ${dateGerman(f)} to ${dateGerman(u)}: body weight only.`)); return;
  }
  else if (t.id === 'hrmax' || t.id === 'hrrest') {
    const v = intNum(t.value), ok = v === null || (t.id === 'hrmax' ? okNum(v, 100, 230) : okNum(v, 30, 120));
    t.setAttribute('aria-invalid', String(!ok)); if (!ok) return;
    profile.hr[t.id === 'hrmax' ? 'max' : 'rest'] = v; persistProfile(); return;
  } else if (t.dataset.zone) {
    const z = [1, 2, 3, 4, 5].map(n => intNum(document.querySelector(`[data-zone="${n}"]`).value));
    if (z.every(v => v === null)) { profile.hr.z = null; profileChanged('hr'); return; }
    if (!okZones(z)) { t.setAttribute('aria-invalid', 'true'); toast(T('Zonen bitte aufsteigend in bpm eintragen (30–230).', 'Please enter zones in ascending bpm (30–230).')); return; }
    profile.hr.z = z; profileChanged('hr'); return;
  } else return;
  profileChanged('week');
}

/* ---------- Laufumfang: einzelne Läufe, Wochensummen, langer Lauf und Zielbereich der Woche ---------- */
// Eingaben mit Komma oder Punkt; leer = nicht eingetragen (nicht 0)
const kmNum = v => { const t = String(v ?? '').trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 10) / 10 : NaN; };
const kmText = n => NUM1.format(Number(n));
const rd1 = x => Math.round(x * 10) / 10;
const okKm = v => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000);
const validRunWeek = e => isObj(e) && isDay(e.week) && okKm(e.km) && okKm(e.long);
const validRun = e => isObj(e) && typeof e.id === 'string' && isDay(e.date) && typeof e.km === 'number' && Number.isFinite(e.km) && e.km > 0 && e.km <= 300;
const runWeeksLoaded = loadList(KEYS.runweeks, validRunWeek), runLogLoaded = loadList(KEYS.runlog, validRun);
let runWeeks = runWeeksLoaded.ok, runLog = runLogLoaded.ok; const runWeeksKeep = runWeeksLoaded.keep, runLogKeep = runLogLoaded.keep;
function persistRunWeeks() { if (!store(KEYS.runweeks, runWeeks.concat(runWeeksKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
function persistRunLog() { if (!store(KEYS.runlog, runLog.concat(runLogKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
/* Rennen füllen Lücken im Umfang: ein Ergebnis (Bestzeiten, Wings for Life, Pace-Race-Level) zählt als Lauf an Tagen ohne eingetragenen Lauf.
   Nur ab dem ersten eingetragenen Lauf bzw. der ersten Wochensumme (davor wäre die Woche unvollständig) und nicht in Wochen, die über ihre
   Wochensumme zählen (die enthält das Rennen schon). Nichts wird gespeichert: ein später eingetragener Lauf am selben Tag ersetzt das Rennen. */
function raceRuns() {
  const today = localDay(), days = new Set(runLog.map(r => r.date)), runWk = new Set(runLog.map(r => weekStart(r.date)));
  const sumWk = new Set(runWeeks.filter(e => !runWk.has(e.week)).map(e => e.week)), first = [runLog[0] && runLog[0].date, runWeeks[0] && runWeeks[0].week].filter(Boolean).sort()[0];
  if (!first) return [];
  const by = new Map(), put = (date, km, name, id) => {
    if (!(km >= 0.5) || date < first || date > today || days.has(date) || sumWk.has(weekStart(date))) return;
    const o = by.get(date); if (!o || km > o.km) by.set(date, { id: 'race-' + id, date, km: rd1(km), race: true, name: name || '' });
  };
  results.forEach(r => put(r.date, r.km, r.name, r.id));
  races.forEach(r => { if (r.fmt === 'pace' && typeof r.level === 'number') put(r.date, r.level, r.name, r.id); });
  return [...by.values()];
}
const allRuns = () => runLog.concat(raceRuns()).sort((a, b) => a.date.localeCompare(b.date));
const ranOn = d => allRuns().some(r => r.date === d);
const weekRuns = w => { const e = addDays(w, 6); return allRuns().filter(r => r.date >= w && r.date <= e); };
const manualKm = (w, f = 'km') => { const e = runWeeks.find(x => x.week === w); return e && typeof e[f] === 'number' ? e[f] : null; };
// Wochenwert: aus den einzelnen Läufen, sonst die eingetragene Wochensumme (bleibt gespeichert, falls Läufe gelöscht werden)
const weekKm = (w, f = 'km') => { const rs = weekRuns(w); if (!rs.length) return manualKm(w, f); return f === 'km' ? rd1(rs.reduce((a, r) => a + r.km, 0)) : Math.max(...rs.map(r => r.km)); };
function setWeekKm(w, f, v) {
  let e = runWeeks.find(x => x.week === w);
  if (!e) { if (v === null) return; e = { week: w, km: null, long: null }; runWeeks.push(e); }
  e[f] = v;
  if (e.km === null && e.long === null) runWeeks = runWeeks.filter(x => x !== e);
  runWeeks.sort((a, b) => a.week.localeCompare(b.week)); persistRunWeeks();
}
// Optional zum Lauf: Zeit (s), Ø-Puls und Art der geplanten Einheit (für die Auswertung) – nur gültige Werte
const RUN_KIND_SET = ['easy', 'recovery', 'long', 'group', 'quality'];
const runExtra = e => Object.assign({}, Number.isInteger(e.sec) && e.sec >= 60 && e.sec <= 86400 ? { sec: e.sec } : {}, Number.isInteger(e.hr) && e.hr >= 40 && e.hr <= 230 ? { hr: e.hr } : {}, RUN_KIND_SET.includes(e.kind) ? { kind: e.kind } : {});
function addRun(date, km, extra = {}) { const r = Object.assign({ id: uid(), date, km }, runExtra(extra)); runLog.push(r); runLog.sort((a, b) => a.date.localeCompare(b.date)); persistRunLog(); return r; }
function deleteRun(id) { runLog = runLog.filter(r => r.id !== id); persistRunLog(); }
// Längster Lauf der 30 Tage bis „day“ (before: nur die Tage davor – zum Prüfen eines Laufs).
// Einzelne Läufe zählen taggenau; Wochen ohne Einzelläufe über ihren „längsten Lauf“, wenn die ganze Woche im Zeitraum liegt.
function longestIn(day, before = false, skip = null) {
  const from = addDays(day, -30), cand = allRuns().filter(r => r.id !== (skip && skip.id) && r.date >= from && (before ? r.date < day : r.date <= day)).map(r => ({ km: r.km, date: r.date }));
  for (let w = weekStart(day); w >= from; w = addDays(w, -7)) {
    if (before && addDays(w, 6) >= day) continue;
    const v = weekRuns(w).length ? null : manualKm(w, 'long');
    if (v !== null) cand.push({ km: v, week: w });
  }
  if (!cand.length) return null;
  const best = cand.reduce((a, b) => b.km > a.km ? b : a);
  return Object.assign({ max: rd1(best.km * (1 + LOAD.longPlus)) }, best);
}
// Sprung: wie viel % ein Lauf über dem längsten der 30 Tage davor lag (nur über 10 %)
const runSpike = r => { const ref = longestIn(r.date, true, r); if (!ref || !ref.km) return null; const p = r.km / ref.km - 1; return p > LOAD.longPlus + 1e-9 ? Math.round(p * 100) : null; };
// Für die Woche w: Schnitt der 4 Wochen davor und Zielbereich
function loadFor(w) {
  const prev = [1, 2, 3, 4].map(i => weekKm(addDays(w, -7 * i))).filter(v => v !== null);
  const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
  return { n: prev.length, avg: avg === null ? null : rd1(avg), cur: weekKm(w),
    keep: avg ? rd1(avg * LOAD.keep) : null, build: avg ? rd1(avg * LOAD.build) : null, cap: avg ? rd1(avg * LOAD.cap) : null };
}
function loadStatus(L) {
  if (L.n === 0) return T('Trag zuerst deine km der letzten Wochen ein. Nach einer längeren Pause: klein anfangen und 3–4 Wochen auf gleichem Niveau laufen, bevor du steigerst.', 'First enter your km of the last weeks. After a longer break: start small and run 3–4 weeks at the same level before increasing.');
  if (!L.avg) return T('Die letzten Wochen stehen auf 0 km. Nach einer Pause klein anfangen und 3–4 Wochen auf gleichem Niveau laufen, bevor du steigerst.', 'The last weeks show 0 km. After a break start small and run 3–4 weeks at the same level before increasing.');
  const cur = L.cur || 0;
  if (cur < L.keep) return T(`Bisher ${kmText(cur)} km. Noch ${kmText(L.keep - cur)} km bis zum Erhalt (${kmText(L.keep)}–${kmText(L.build)} km), Aufbau bis ${kmText(L.cap)} km.`, `${kmText(cur)} km so far. ${kmText(L.keep - cur)} km more to maintain (${kmText(L.keep)}–${kmText(L.build)} km), build up to ${kmText(L.cap)} km.`);
  if (cur < L.build) return T(`Im Erhalt. Für Aufbau ${kmText(L.build)}–${kmText(L.cap)} km – noch bis zu ${kmText(L.cap - cur)} km diese Woche.`, `Maintaining. To build ${kmText(L.build)}–${kmText(L.cap)} km – up to ${kmText(L.cap - cur)} km more this week.`);
  if (cur <= L.cap) return T(`Im Aufbau. Obergrenze ${kmText(L.cap)} km – noch ${kmText(L.cap - cur)} km diese Woche.`, `Building. Upper limit ${kmText(L.cap)} km – ${kmText(L.cap - cur)} km more this week.`);
  return T(`Über der Obergrenze von ${kmText(L.cap)} km (${kmText(cur / L.avg)} × Schnitt). Den Rest der Woche locker oder Pause.`, `Above the upper limit of ${kmText(L.cap)} km (${kmText(cur / L.avg)} × average). Easy or rest for the rest of the week.`);
}
// Zielbereich als Balken: unter Erhalt · Erhalt · Aufbau · zu viel, mit Markierung „bisher“
function loadBar(L) {
  if (!L.avg) return '';
  const cur = L.cur || 0, W = 360, l = 8, rgt = 8, max = Math.max(L.cap * 1.25, Math.min(cur * 1.08, L.cap * 1.6)), x = v => l + Math.min(v, max) / max * (W - l - rgt), y0 = 34, h = 20;
  const zone = (a, b, cls) => `<rect class="${cls}" x="${x(a)}" y="${y0}" width="${Math.max(0, x(b) - x(a))}" height="${h}"/>`;
  const tick = v => `<line class="axis" x1="${x(v)}" y1="${y0 + h}" x2="${x(v)}" y2="${y0 + h + 5}"/><text class="lbl" x="${x(v)}" y="${y0 + h + 18}" text-anchor="middle" font-size="12">${kmText(v)}</text>`;
  const mid = (a, b, t) => `<text class="lbl" x="${(x(a) + x(b)) / 2}" y="${y0 - 6}" text-anchor="middle" font-size="12" font-weight="600">${t}</text>`;
  const mx = x(cur), anchor = mx < 50 ? 'start' : mx > W - 50 ? 'end' : 'middle';
  return `<svg class="chart" viewBox="0 0 ${W} 96" role="img" aria-label="${T(`Zielbereich diese Woche: Erhalt ${kmText(L.keep)} bis ${kmText(L.build)} km, Aufbau bis ${kmText(L.cap)} km, bisher ${kmText(cur)} km`, `Target range this week: maintain ${kmText(L.keep)} to ${kmText(L.build)} km, build up to ${kmText(L.cap)} km, so far ${kmText(cur)} km`)}">
    <clipPath id="loadclip"><rect x="${l}" y="${y0}" width="${W - l - rgt}" height="${h}" rx="7"/></clipPath>
    <g clip-path="url(#loadclip)">${zone(0, L.keep, 'zlow')}${zone(L.keep, L.build, 'zkeep')}${zone(L.build, L.cap, 'zbuild')}${zone(L.cap, max, 'zover')}</g>
    ${mid(L.keep, L.build, T('Erhalt', 'Maintain'))}${mid(L.build, L.cap, T('Aufbau', 'Build'))}${tick(L.keep)}${tick(L.build)}${tick(L.cap)}
    <line class="zmark" x1="${mx}" y1="${y0 - 4}" x2="${mx}" y2="${y0 + h + 4}" stroke-width="3" stroke-linecap="round"/>
    <text class="val" x="${mx}" y="${y0 + h + 36}" text-anchor="${anchor}" font-size="13" font-weight="600">${T('bisher', 'so far')} ${kmText(cur)} km</text></svg>`;
}
// Verlauf: Wochen-km der letzten 8 Wochen, dahinter der Zielbereich jeder Woche (sofern 4 Wochen davor eingetragen sind)
function loadChart() {
  const cur = weekStart(localDay()), weeks = Array.from({ length: 8 }, (_, i) => addDays(cur, (i - 7) * 7)), info = weeks.map(w => ({ w, km: weekKm(w), L: loadFor(w) }));
  if (!info.some(d => d.km !== null)) return `<div class="empty">${T('Sobald Wochen eingetragen sind, erscheint hier der Verlauf.', 'The history appears here once weeks are entered.')}</div>`;
  const W = 360, base = 118, l = 4, step = (W - l * 2) / 8, bw = Math.min(26, step * 0.5), top = 22;
  const max = Math.max(1, ...info.map(d => Math.max(d.km || 0, d.L.n === 4 && d.L.avg ? d.L.cap : 0))), y = v => base - v / max * (base - top);
  const bars = info.map((d, i) => {
    const cx = l + step * i + step / 2, band = d.L.n === 4 && d.L.avg ? `<rect class="zkeep" x="${cx - step * 0.43}" y="${y(d.L.build)}" width="${step * 0.86}" height="${y(d.L.keep) - y(d.L.build)}" rx="3"/><rect class="zbuild band" x="${cx - step * 0.43}" y="${y(d.L.cap)}" width="${step * 0.86}" height="${y(d.L.build) - y(d.L.cap)}" rx="3"/>` : '';
    const hh = d.km ? Math.max(3, base - y(d.km)) : 0, over = d.L.n === 4 && d.L.avg && d.km > d.L.cap;
    return `${band}${hh ? `<rect class="bar${over ? ' over' : ''}" x="${cx - bw / 2}" y="${base - hh}" width="${bw}" height="${hh}" rx="5" opacity="${d.w === cur ? 0.6 : 1}"><title>${T('KW', 'Wk')} ${isoWeek(d.w)}: ${kmText(d.km)} km</title></rect>` : ''}<text class="val" x="${cx}" y="${base - hh - 5}" text-anchor="middle" font-size="11.5">${d.km === null ? '' : kmText(d.km)}</text><text class="lbl" x="${cx}" y="134" text-anchor="middle" font-size="10.5"${d.w === cur ? ' font-weight="700"' : ''}>KW${isoWeek(d.w)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} 140" role="img" aria-label="${T('Wochen-km der letzten 8 Wochen: ', 'Weekly km of the last 8 weeks: ')}${info.map(d => d.km === null ? T('keine Angabe', 'no entry') : kmText(d.km)).join(', ')}"><line class="axis" x1="${l}" y1="${base}" x2="${W - l}" y2="${base}"/>${bars}</svg>
    <p class="tiny">${T('Balken: km je Woche, die laufende Woche heller. Fläche: Zielbereich der Woche (hell Erhalt, kräftig Aufbau). Orange: über der Obergrenze.', 'Bars: km per week, the current week lighter. Area: target range of the week (light maintain, strong build). Orange: above the upper limit.')}</p>`;
}
const dayLabel = d => `${WEEKDAY[new Date(d + 'T12:00:00').getDay()]} ${dateShort(d)}`;
function renderUmfang() {
  const today = localDay(), cur = weekStart(today);
  return `<div class="intro">${esc(tr(LOAD_INTRO))}</div>
    <div class="header">${T('Nächster langer Lauf', 'Next long run')}</div><div class="group"><div class="panel" style="border:0;padding-top:12px" id="longresult"></div></div>
    <div class="header">${T('Lauf eintragen', 'Add a run')}</div><div class="group"><div class="runadd"><input type="date" id="rundate" value="${today}" max="${today}" aria-label="${T('Datum des Laufs', 'Date of the run')}"><input type="text" inputmode="decimal" autocomplete="off" id="runkm" placeholder="km" aria-label="${T('Kilometer des Laufs', 'Kilometres of the run')}"><button type="button" class="btn small primary" id="runaddbtn">${T('Hinzufügen', 'Add')}</button></div>
      <div class="runadd2"><span class="ra-time"><label>${T('Zeit (optional)', 'Time (optional)')}</label>${timeFields('runtime', null, T('Zeit', 'Time'))}</span><span><label for="runhr">${T('Ø Puls', 'Avg HR')}</label><input type="text" inputmode="numeric" maxlength="3" autocomplete="off" id="runhr" placeholder="${T('optional', 'optional')}"></span>
      <span><label for="runkind">${T('Art', 'Type')}</label><select id="runkind">${[['', T('nach Plan', 'from plan')], ['easy', T('Locker', 'Easy')], ['recovery', T('Regeneration', 'Recovery')], ['long', T('Longrun', 'Long run')], ['group', T('Laufgruppe', 'Running group')], ['quality', T('Intervall/Tempo', 'Intervals/tempo')]].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></span></div>
      <div id="runfb"></div><div id="runlist"></div></div>
    <div class="group sectgroup">${sectHtml('umfang', 'sect-csv', '⇅', 'var(--accent)', T('Läufe aus CSV', 'Runs from CSV'), T('Import aus Uhr oder Tabelle, Vorlage zum Ausfüllen', 'import from a watch or spreadsheet, template to fill in'), `
      <button type="button" class="row" id="runcsvbtn"><span class="icon" style="background:var(--accent)">⇧</span><span class="txt"><b>${T('Läufe aus CSV importieren', 'Import runs from CSV')}</b><small>${T('Spalten Datum und km, z. B. aus Strava oder deiner Uhr', 'Columns date and km, e.g. from Strava or your watch')}</small></span><span class="chev"></span></button>
      <button type="button" class="row" id="runcsvtpl"><span class="icon" style="background:var(--blue)">⇩</span><span class="txt"><b>${T('CSV-Vorlage herunterladen', 'Download CSV template')}</b><small>${T('Zum Ausfüllen in Numbers, Excel oder Google Tabellen', 'To fill in with Numbers, Excel or Google Sheets')}</small></span><span class="chev"></span></button>
      <input type="file" accept=".csv,text/csv,text/plain" id="runcsvfile" class="hide">
    <div id="runcsvresult"></div>
    <p class="footer">${T('Eine Zeile pro Lauf. Datum als 26.10.2026 oder 2026-10-26, km mit Komma oder Punkt. Läufe mit gleichem Datum und gleichen km werden übersprungen.', 'One line per run. Date as 26.10.2026 or 2026-10-26, km with comma or point. Runs with the same date and km are skipped.')}</p>
    <p class="footer">${T('Mit Datum rechnet die App die 30 Tage exakt und markiert Läufe, die mehr als 10 % über dem längsten der 30 Tage davor lagen. Wochen mit eingetragenen Läufen werden automatisch zusammengezählt.', 'With dates the app calculates the 30 days exactly and marks runs that were more than 10 % above the longest of the 30 days before. Weeks with entered runs are added up automatically.')}</p>`)}</div>
    <div class="header">${T('Diese Woche · KW ', 'This week · wk ')}${isoWeek(cur)}</div><div class="group"><div class="panel" style="border:0;padding-top:12px" id="loadresult"></div></div>
    <div class="group sectgroup">${sectHtml('umfang', 'sect-weeks', '∑', '#5e5ce6', T('Wochensummen', 'Weekly totals'), T('für Wochen ohne einzelne Läufe', 'for weeks without single runs'), `<div style="padding:0 16px" id="kmweeks"></div><p class="footer">${T('Für Wochen ohne einzelne Läufe: km von Montag bis Sonntag und den längsten Lauf, z. B. aus deiner Uhr. Pausenwoche: 0. Alles bleibt nur auf diesem Gerät und ist im Backup enthalten.', 'For weeks without single runs: km from Monday to Sunday and the longest run, e.g. from your watch. Rest week: 0. Everything stays on this device only and is included in the backup.')}</p>`)}</div>
    <div class="header">${T('Verlauf · 8 Wochen', 'History · 8 weeks')}</div><div class="group"><div class="panel" style="border:0;padding-top:4px" id="loadchart"></div></div>
    <p class="footer">${esc(tr(LOAD_NOTE))}</p>`;
}
// Wochenzeilen nur nach Hinzufügen/Löschen neu zeichnen – beim Tippen bleibt der Fokus im Feld
function renderWeekRows() {
  const box = $('kmweeks'); if (!box) return;
  const cur = weekStart(localDay());
  const inp = (w, f, label, n) => { const v = weekKm(w, f); return `<label class="kmin"><span>${label}</span><input type="text" inputmode="decimal" autocomplete="off" data-wk="${w}" data-f="${f}" value="${v === null ? '' : esc(kmText(v))}" placeholder="${f === 'km' && w !== cur ? T('fehlt', 'missing') : '–'}" ${n ? 'disabled' : ''} aria-label="${label} ${T('KW', 'wk')} ${isoWeek(w)}"></label>`; };
  box.innerHTML = [0, 1, 2, 3, 4].map(i => addDays(cur, -7 * i)).map((w, i) => { const n = weekRuns(w).length; return `<div class="kmrow"><div class="sname"><b>${T('KW ', 'Wk ')}${isoWeek(w)}${i === 0 ? T(' · diese Woche', ' · this week') : ''}</b><small>${dateShort(w)}–${dateShort(addDays(w, 6))}${n ? T(` · aus ${n} ${n === 1 ? 'Lauf' : 'Läufen'}`, ` · from ${n} ${n === 1 ? 'run' : 'runs'}`) : ''}</small></div>${inp(w, 'km', T('km gesamt', 'km total'), n)}${inp(w, 'long', T('längster Lauf', 'longest run'), n)}</div>`; }).join('');
}
function renderLoad() {
  const box = $('loadresult'); if (!box) return;
  const today = localDay(), L = loadFor(weekStart(today)), R = longestIn(today);
  $('longresult').innerHTML = R ? `<div class="longnext"><b>${T(`höchstens ${kmText(R.max)} km`, `at most ${kmText(R.max)} km`)}</b><span>${T(`Längster Lauf der letzten 30 Tage: ${kmText(R.km)} km ${R.date ? 'am ' + dayLabel(R.date) : `(KW ${isoWeek(R.week)}, aus der Wochensumme)`} – plus 10 %.`, `Longest run of the last 30 days: ${kmText(R.km)} km ${R.date ? 'on ' + dayLabel(R.date) : `(wk ${isoWeek(R.week)}, from the weekly total)`} – plus 10 %.`)}</span></div>`
    : `<p class="loadstatus">${T('Trag Läufe mit Datum ein (oder bei den Wochensummen den längsten Lauf) – dann steht hier, wie lang dein nächster langer Lauf höchstens sein sollte.', 'Enter runs with a date (or the longest run in the weekly totals) – then this shows the maximum length of your next long run.')}</p>`;
  const recent = allRuns().filter(r => r.date >= addDays(today, -30) && r.date <= today).reverse();
  // Rennen aus dem Ergebnis: ohne Löschen – ein eingetragener Lauf am selben Tag ersetzt es
  if ($('runfb')) $('runfb').innerHTML = runFeedback ? feedbackCard(runFeedback) : '';
  $('runlist').innerHTML = recent.length ? recent.map(r => { const sp = runSpike(r); return `<div class="row${r.race ? ' racerun' : ''}"><span class="dur">${dayLabel(r.date)}</span><span class="txt"><b>${kmText(r.km)} km</b>${r.race ? `<small>🏁 ${esc(r.name || T('Rennen', 'Race'))} · ${T('aus dem Ergebnis', 'from the result')}</small>` : ''}${r.sec || r.hr ? (() => { const v = runVerdict(runCheck(r)); return `<small>${esc(runStats(r).split(' · ').slice(1).join(' · '))}${v.short ? ` · <span class="${v.ok ? 'chkok' : 'chkwarn'}">${esc(v.short)}</span>` : ''}</small>`; })() : ''}${sp ? `<small class="spike">${T(`+${sp} % gegenüber dem längsten der 30 Tage davor`, `+${sp} % over the longest of the 30 days before`)}</small>` : ''}</span>${r.race ? '' : `<button type="button" class="btn small danger" data-rundel="${esc(r.id)}" aria-label="${T(`Lauf vom ${dateGerman(r.date)} löschen`, `Delete run of ${dateGerman(r.date)}`)}">${T('Löschen', 'Delete')}</button>`}</div>`; }).join('')
      + (recent.some(r => r.race) ? `<p class="footer">${T('Rennen zählen automatisch an Tagen ohne eingetragenen Lauf – trägst du für den Tag einen Lauf ein (z. B. mit den km deiner Uhr), zählt nur der.', 'Races count automatically on days without an entered run – if you enter a run for that day (e.g. with your watch’s km), only that one counts.')}</p>` : '')
    : `<div class="row"><span class="txt"><small>${T('Noch keine einzelnen Läufe in den letzten 30 Tagen.', 'No single runs in the last 30 days yet.')}</small></span></div>`;
  box.innerHTML = (L.n ? `<div class="metrics two">
      <div class="metric"><span>${T('Schnitt 4 Wochen', 'Average 4 weeks')}</span><b>${L.avg === null ? '–' : kmText(L.avg) + ' km'}</b><small>${L.n < 4 ? T(`vorläufig: ${L.n} von 4 Wochen`, `provisional: ${L.n} of 4 weeks`) : T('Basis für diese Woche', 'basis for this week')}</small></div>
      <div class="metric"><span>${T('Diese Woche', 'This week')}</span><b>${kmText(L.cur || 0)} km</b><small>${L.avg ? kmText((L.cur || 0) / L.avg) + T(' × Schnitt', ' × average') : '–'}</small></div>
    </div>` : '') + loadBar(L) + `<p class="loadstatus">${esc(loadStatus(L))}</p>`;
  $('loadchart').innerHTML = loadChart();
}
/* ---------- Läufe als CSV: Vorlage und Import ---------- */
const RUN_CSV_TEMPLATE = T('\ufeffDatum;km\r\n# Beispiele – diese Zeilen mit # werden beim Import ignoriert:\r\n# 26.10.2026;10,5\r\n# 2026-10-28;6\r\n', '\ufeffdate,km\r\n# Examples – lines starting with # are ignored on import:\r\n# 2026-10-26,10.5\r\n# 2026-10-28,6\r\n');
// Eine CSV-Zeile mit Anführungszeichen aufteilen
function csvSplit(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out.map(x => x.trim());
}
function csvDay(t) {
  t = String(t || '').trim().split(/[ T]/)[0];
  let y, m, d, x;
  if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) [, y, m, d] = x;
  else if ((x = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t))) { [, d, m, y] = x; if (y.length === 2) y = '20' + y; }
  else return null;
  const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dt = new Date(day + 'T12:00:00');
  return !Number.isNaN(dt.getTime()) && localDay(dt) === day ? day : null;
}
// Ergebnis: { added, dup, bad: [Zeilennummern] }
function parseRunCsv(text, today = localDay()) {
  const lines = String(text).replace(/^\ufeff/, '').split(/\r\n|\n|\r/);
  const first = lines.find(l => l.trim() && !l.trim().startsWith('#')) || '';
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  let di = 0, ki = 1, start = 0;
  const head = csvSplit(first, sep).map(h => h.toLowerCase());
  if (!csvDay(head[0])) {
    const fd = head.findIndex(h => /datum|date/.test(h)), fk = head.findIndex(h => /^km$|kilometer|distanz|distance|strecke/.test(h));
    if (fd >= 0) di = fd; if (fk >= 0) ki = fk;
    start = lines.indexOf(first) + 1;
  }
  const have = new Set(runLog.map(r => r.date + '|' + r.km)), add = [], bad = []; let dup = 0;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i].trim(); if (!l || l.startsWith('#')) continue;
    const c = csvSplit(l, sep), day = csvDay(c[di]), km = kmNum(String(c[ki] ?? '').replace(/\s*km$/i, ''));
    if (!day || day > today || km === null || Number.isNaN(km) || km <= 0 || km > 300) { bad.push(i + 1); continue; }
    const key = day + '|' + km; if (have.has(key)) { dup++; continue; }
    have.add(key); add.push({ id: uid(), date: day, km });
  }
  return { add, dup, bad };
}
function importRunCsv(file) {
  const r = new FileReader();
  r.onload = () => {
    const res = parseRunCsv(r.result);
    if (res.add.length) { runLog = runLog.concat(res.add).sort((a, b) => a.date.localeCompare(b.date)); persistRunLog(); }
    renderWeekRows(); renderLoad();
    const box = $('runcsvresult'), b = res.bad;
    if (box) box.innerHTML = `<div class="alert${b.length || !res.add.length ? ' due' : ''}" id="runcsvmsg">${T(`${res.add.length} ${res.add.length === 1 ? 'Lauf' : 'Läufe'} importiert${res.dup ? `, ${res.dup} doppelt übersprungen` : ''}.${b.length ? ` ${b.length} ${b.length === 1 ? 'Zeile' : 'Zeilen'} nicht lesbar (Zeile ${b.slice(0, 8).join(', ')}${b.length > 8 ? ' …' : ''}) – Datum bis heute und km größer 0 prüfen.` : ''}`, `${res.add.length} ${res.add.length === 1 ? 'run' : 'runs'} imported${res.dup ? `, ${res.dup} duplicates skipped` : ''}.${b.length ? ` ${b.length} ${b.length === 1 ? 'line' : 'lines'} not readable (line ${b.slice(0, 8).join(', ')}${b.length > 8 ? ' …' : ''}) – check date up to today and km above 0.` : ''}`)}</div>`;
    toast(T(`✓ ${res.add.length} ${res.add.length === 1 ? 'Lauf' : 'Läufe'} importiert.`, `✓ ${res.add.length} ${res.add.length === 1 ? 'run' : 'runs'} imported.`));
  };
  r.onerror = () => toast(T('Die Datei konnte nicht gelesen werden.', 'The file could not be read.'));
  r.readAsText(file);
}
// Zeit und Ø-Puls lesen (beides optional); NaN = ungültig, null = leer
function readRunExtras(timeId, hrId) {
  const sec = readTime(timeId), hrT = String($(hrId).value).trim(), hr = hrT === '' ? null : /^\d{2,3}$/.test(hrT) ? Number(hrT) : NaN;
  if (Number.isNaN(sec)) { markTime(timeId, true); toast(T('Bitte die Zeit prüfen (Minuten und Sekunden höchstens 59) – oder leer lassen.', 'Please check the time (minutes and seconds at most 59) – or leave it empty.')); return null; }
  if (hr !== null && !(hr >= 40 && hr <= 230)) { $(hrId).setAttribute('aria-invalid', 'true'); toast(T('Bitte den Ø-Puls zwischen 40 und 230 eintragen – oder leer lassen.', 'Please enter an average HR between 40 and 230 – or leave it empty.')); return null; }
  return { sec: sec || undefined, hr: hr || undefined };
}
const RUN_KIND_LABEL = () => ({ easy: T('Lockerer Lauf', 'Easy run'), recovery: T('Regenerationslauf', 'Recovery run'), long: T('Longrun', 'Long run'), group: T('Laufgruppe', 'Running group'), quality: T('Intervall/Tempo', 'Intervals/tempo') });
let runFeedback = null;
function addRunFromForm() {
  const d = $('rundate').value, today = localDay(), km = kmNum($('runkm').value);
  if (!isDay(d) || d > today) { toast(T('Bitte ein Datum bis heute wählen.', 'Please choose a date up to today.')); return; }
  if (km === null || Number.isNaN(km) || km <= 0 || km > 300) { $('runkm').setAttribute('aria-invalid', 'true'); toast(T('Bitte die Kilometer des Laufs eingeben.', 'Please enter the kilometres of the run.')); return; }
  const ex = readRunExtras('runtime', 'runhr'); if (!ex) return;
  // Art: gewählt, sonst die geplante Einheit des Tages, sonst locker
  const planned = plannedRunsOn(d)[0], kind = $('runkind').value || (planned ? runKindOf(planned) : 'easy');
  const run = addRun(d, km, Object.assign(ex, { kind }));
  if (planned) { const wp = curWeekPlan(weekStart(d)); if (wp && !wp.done.includes(planned.key)) { wp.done.push(planned.key); storeWeekPlan(); } }
  runFeedback = run.sec || run.hr ? { id: run.id, title: `${dayLabel(d)} · ${planned && !$('runkind').value ? planned.title : RUN_KIND_LABEL()[kind]}`, box: 'runfb' } : null;
  $('runkm').value = ''; $('runhr').value = ''; document.querySelectorAll('#runtime input').forEach(i => { i.value = ''; }); $('runkm').removeAttribute('aria-invalid');
  renderWeekRows(); renderLoad(); toast(T(`✓ ${kmText(km)} km am ${dayLabel(d)} gespeichert.`, `✓ ${kmText(km)} km saved for ${dayLabel(d)}.`));
}

/* ---------- Laufen → Plan: Rennen und Saisonplan ---------- */
const validRace = e => isObj(e) && typeof e.id === 'string' && typeof e.name === 'string' && e.name.length <= 60 && isDay(e.date)
  && Object.prototype.hasOwnProperty.call(SEASON.dist, e.dist) && (e.prio === 'A' || e.prio === 'B')
  && (e.goal === null || e.goal === undefined || (Number.isInteger(e.goal) && e.goal >= 60 && e.goal <= 86400))
  && (e.km === null || e.km === undefined || okNum(e.km, 1, 100))
  && (e.fmt === undefined || (e.fmt === 'wfl' && okNum(e.km, 1, 100)) || (e.fmt === 'pace' && Number.isInteger(e.km) && e.km >= 1 && e.km <= PACE_RACE.levels))
  && (e.dns === undefined || e.dns === true) && (e.level === undefined || (e.fmt === 'pace' && okNum(e.level, 0, PACE_RACE.levels)));
// Eigene Distanz (z. B. 20 km): geplant wird nach der nächstliegenden Kategorie, angezeigt und gerechnet mit den echten km
const distForKm = km => km <= 7.5 ? '5k' : km <= 15 ? '10k' : km <= 30 ? 'hm' : 'marathon';
const raceKm = r => r.km || SEASON.dist[r.dist].km;
/* Rennformate ohne feste Distanz: km ist das Ziel (Wings for Life: Strecke, Pace Race: Level = Runden à 1 km).
   Die Zielzeit wird daraus gerechnet, nicht gespeichert. */
// Wings for Life: Sekunden ab Start, bis das Catcher Car bei km d ist
function carTime(d) {
  let t = WFL.head, pos = 0;
  for (let i = 0; ; i++) {
    const v = WFL.kmh[Math.min(i, WFL.kmh.length - 1)], seg = i < WFL.kmh.length - 1 ? v * WFL.every / 3600 : Infinity;
    if (pos + seg >= d) return t + (d - pos) / v * 3600;
    pos += seg; t += WFL.every;
  }
}
// Pace Race: Zeitlimit von Level n in Sekunden je 1.000 m, und die Zeit bis zum Ende von Runde n (Zeitlimits plus 60 Sek. Pause)
const paceCut = n => n <= PACE_RACE.cut.length ? PACE_RACE.cut[n - 1] : PACE_RACE.cut.at(-1) - PACE_RACE.step * (n - PACE_RACE.cut.length);
const paceTotal = n => { let t = 0; for (let i = 1; i <= n; i++) t += paceCut(i); return t + PACE_RACE.rest * (n - 1); };
// Zielzeit für Plan-Stufe und Notlösung beim Renntempo. Pace Race: das 5-km-Tempo, das zum Level-Tempo passt (grobe Schätzung), per Riegel auf n km
const raceGoal = r => r.fmt === 'wfl' ? Math.round(carTime(r.km)) : r.fmt === 'pace' ? Math.round(riegel(5 * paceCut(r.km), 5, r.km)) : r.goal;
const raceLabel = r => r.fmt === 'wfl' ? T(`Wings for Life, Ziel ${kmText(r.km)} km`, `Wings for Life, goal ${kmText(r.km)} km`)
  : r.fmt === 'pace' ? T(`Pace Race, Ziel Level ${r.km}`, `Pace Race, goal level ${r.km}`)
  : r.km ? kmText(r.km) + ' km' : SEASON.dist[r.dist].label;
// Plan-Einheiten: Pace Race hat eigene (1-km-Wiederholungen), sonst die der Distanz
const planKey = r => r.fmt === 'pace' ? 'pace' : r.dist;
const racesLoaded = loadList(KEYS.races, validRace);
let races = racesLoaded.ok; const racesKeep = racesLoaded.keep;
const sortRaces = () => races.sort((a, b) => a.date.localeCompare(b.date) || a.prio.localeCompare(b.prio));
function persistRaces() { sortRaces(); if (!store(KEYS.races, races.concat(racesKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
sortRaces();
// Zeit in drei Feldern (Std/Min/Sek): auf dem iPhone reicht der Ziffernblock, der hat keinen Doppelpunkt
function timeFields(id, sec, label) {
  const v = sec ? [Math.floor(sec / 3600), Math.floor(sec % 3600 / 60), sec % 60] : null;
  return `<div class="timein" id="${id}" role="group" aria-label="${esc(label)}">${(EN ? ['h', 'min', 'sec'] : ['Std.', 'Min.', 'Sek.']).map((l, i) => `<label><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="2" data-tpart="${i}" placeholder="${i ? '00' : '0'}" value="${v ? (i ? String(v[i]).padStart(2, '0') : (v[0] || '')) : ''}" aria-label="${esc(label)} ${l}"><span>${l}</span></label>`).join('<b aria-hidden="true">:</b>')}</div>`;
}
// leer → null, ungültig → NaN, sonst Sekunden
function readTime(id) {
  const box = $(id), p = [...box.querySelectorAll('[data-tpart]')].map(i => i.value.trim());
  if (p.every(x => x === '')) return null;
  if (!p.every(x => x === '' || /^\d{1,2}$/.test(x))) return NaN;
  const [h, m, x] = p.map(v => v === '' ? 0 : Number(v));
  if (m > 59 || x > 59) return NaN;
  const t = h * 3600 + m * 60 + x; return t >= 60 && t <= 86400 ? t : NaN;
}
const markTime = (id, bad) => { for (const i of $(id).querySelectorAll('[data-tpart]')) bad ? i.setAttribute('aria-invalid', 'true') : i.removeAttribute('aria-invalid'); };
const hms = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0'); };
const paceText = (sec, km) => hms(sec / km) + ' /km';
// Ziel-Longrun und Wochenspitze: aus der Zielzeit, sonst die Standardwerte der Distanz
// Im gemeinsamen Block zählt das jeweils höhere Ziel beider Rennen
const bothPeaks = x => { const a = peaks(x.target); if (!x.with) return a; const b = peaks(x.with); return { long: Math.max(a.long, b.long), week: Math.max(a.week, b.week), fromGoal: a.fromGoal || b.fromGoal }; };
function peaks(r) {
  const d = SEASON.dist[r.dist], goal = raceGoal(r);
  if (!goal) return { long: d.longPeak, week: d.weekPeak, fromGoal: false };
  const g = r.km ? goal * Math.pow(d.km / r.km, 1.06) : goal; // Riegel: Zeit auf die Kategorie-Distanz umrechnen
  const l = SEASON.levels[r.dist].find(x => g <= x.upTo);
  return { long: l.long, week: l.week, fromGoal: true };
}
const weeksBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 6048e5);

// Saisonplan ab der laufenden Woche bis zum letzten A-Rennen.
// start/L0/W0 nur für Tests überschreibbar; sonst aus Umfang: längster Lauf der 30 Tage und Schnitt der 4 Wochen.
function seasonPlan(today = localDay(), opt = {}) {
  const start = weekStart(today), D = k => SEASON.dist[k];
  const A = races.filter(r => r.prio === 'A');
  const prev = A.filter(r => weekStart(r.date) < start).at(-1) || null, next = A.filter(r => weekStart(r.date) >= start);
  const warn = [], note = [], mix = [];
  if (!next.length) return { weeks: [], warn, note, races: next };
  const end = weekStart(next.at(-1).date), n = weeksBetween(start, end) + 1;
  const weeks = Array.from({ length: n }, (_, i) => ({ week: addDays(start, 7 * i), phase: 'basis', target: null, b: [], a: null }));
  const idx = w => weeksBetween(start, w);
  const setW = (w, patch) => { const i = idx(w); if (i >= 0 && i < n) Object.assign(weeks[i], patch); };
  let last = prev;
  for (const r of next) {
    const d = D(r.dist), rw = weekStart(r.date), ph = d.phases, total = ph.base + ph.build + ph.spec + ph.taper;
    if (last) { const ld = D(last.dist), lw = weekStart(last.date); ld.recover.forEach((_, k) => { const w = addDays(lw, 7 * (k + 1)); if (w < rw) setW(w, { phase: 'recover', k, target: last }); }); }
    const earliest = last ? addDays(weekStart(last.date), 7 * (D(last.dist).recover.length + 1)) : null;
    let from = addDays(rw, -7 * (total - 1));
    if (earliest && from < earliest) from = earliest > rw ? rw : earliest;
    const avail = weeksBetween(from, rw) + 1;
    // Zwei A-Rennen zu dicht: das zweite liegt in der Erholung des ersten oder das erste im Tapering des zweiten
    const gap = last ? weeksBetween(weekStart(last.date), rw) : null;
    if (last && (gap <= D(last.dist).recover.length || gap < ph.taper)) warn.push(T(`${r.name} liegt nur ${gap} ${gap === 1 ? 'Woche' : 'Wochen'} nach ${last.name} – zwei A-Rennen so dicht sind zu viel: Erholung und Tapering überschneiden sich. Eines davon als B-Rennen eintragen, das läuft dann locker mit.`, `${r.name} is only ${gap} ${gap === 1 ? 'week' : 'weeks'} after ${last.name} – two A races this close are too much: recovery and taper overlap. Enter one of them as a B race, it then runs along easily.`));
    // Nah beieinander, aber machbar: gemeinsamer Block – vorher wechseln sich die Qualitätseinheiten für beide ab
    else if (earliest && avail < d.minWeeks) mix.push({ r, last, gap, avail });
    else if (earliest && avail < total) warn.push(T(`${r.name}: Block auf ${avail} statt ${total} Wochen gekürzt, weil ${last.name} davor liegt – die Grundlage fällt kürzer aus.`, `${r.name}: block shortened to ${avail} instead of ${total} weeks because ${last.name} comes before it – the foundation is shorter.`));
    const fromStart = weeksBetween(start, rw) + 1;
    if (!earliest && fromStart < d.minWeeks) warn.push(T(`${r.name}: nur noch ${fromStart} ${fromStart === 1 ? 'Woche' : 'Wochen'} – für ${raceLabel(r)} sind mindestens ${d.minWeeks} sinnvoll. Ziel eher locker angehen.`, `${r.name}: only ${fromStart} ${fromStart === 1 ? 'week' : 'weeks'} left – for ${raceLabel(r)} at least ${d.minWeeks} make sense. Approach the goal rather easily.`));
    // rückwärts ab der Rennwoche: Tapering, spezifisch, Aufbau, Grundlage
    const seq = [].concat(Array(ph.base).fill('base'), Array(ph.build).fill('build'), Array(ph.spec).fill('spec'), Array(ph.taper).fill('taper'));
    for (let i = 0; i < avail; i++) {
      const w = addDays(rw, -7 * i), p = seq[seq.length - 1 - i];
      setW(w, { phase: p, target: r, k: p === 'taper' ? ph.taper - 1 - i : undefined });
    }
    setW(rw, { a: r });
    last = r;
  }
  // Basis-Wochen: Ziel ist das nächste A-Rennen
  for (const x of weeks) if (!x.target) x.target = next.find(r => weekStart(r.date) >= x.week) || next.at(-1);
  // Gemeinsamer Block: Wochen im eigentlichen Vorbereitungsfenster des späteren Rennens, die noch dem früheren gehören
  // (Grundlage, Aufbau, spezifisch – nicht Tapering oder Erholung), bereiten das spätere mit vor
  // Nicht in Wochen eines Rennens, das selbst nur einen gekürzten Block hat – dessen wenige Wochen gehören ihm
  const mixed = new Set(mix.map(m => m.r));
  for (const { r } of mix) {
    const ph = D(r.dist).phases, rw = weekStart(r.date), from = addDays(rw, -7 * (ph.base + ph.build + ph.spec + ph.taper - 1));
    for (const x of weeks) if (!x.with && x.week >= from && x.week < rw && x.target !== r && !mixed.has(x.target) && ['base', 'build', 'spec'].includes(x.phase)) x.with = r;
  }
  for (const { r, last, gap, avail } of mix) {
    const wk = n => n === 1 ? T('1 Woche', '1 week') : T(`${n} Wochen`, `${n} weeks`), n = weeks.filter(x => x.with === r && mixFor(x)).length;
    if (planKey(r) === planKey(last)) note.push(T(`${r.name} kommt ${gap} Wochen nach ${last.name}: Die Vorbereitung auf ${last.name} zählt auch für ${r.name}. Danach Erholung und ${wk(avail)} gezielt für ${r.name}.`, `${r.name} comes ${gap} weeks after ${last.name}: the preparation for ${last.name} also counts for ${r.name}. Then recovery and ${wk(avail)} targeted at ${r.name}.`));
    else if (n) note.push(T(`${r.name} kommt ${gap} Wochen nach ${last.name}: Der Plan bereitet beide zusammen vor. Vorher gilt jede zweite Qualitätseinheit schon ${r.name} (${n} × ⇄ im Saisonplan), Longrun und Wochen-km richten sich nach dem längeren Rennen. Nach der Erholung bleiben ${wk(avail)} gezielt für ${r.name}.`, `${r.name} comes ${gap} weeks after ${last.name}: the plan prepares both together. Before that every second quality session is already for ${r.name} (${n} × ⇄ in the season plan), long run and weekly km follow the longer race. After recovery ${wk(avail)} remain targeted at ${r.name}.`));
    else warn.push(T(`${r.name} kommt ${gap} Wochen nach ${last.name}: Nach der Erholung bleiben nur ${wk(avail)} für ${r.name}, davor ist kein Platz für eigene Einheiten. Besser eines der Rennen als B-Rennen eintragen – dann bekommt das andere einen richtigen Block.`, `${r.name} comes ${gap} weeks after ${last.name}: after recovery only ${wk(avail)} remain for ${r.name}, before that there is no room for its own sessions. Better enter one of the races as a B race – then the other gets a proper block.`));
  }
  for (const r of races.filter(x => x.prio === 'B')) { const i = idx(weekStart(r.date)); if (i >= 0 && i < n) weeks[i].b.push(r); }

  // Vorwärts: Longrun (L) und Wochen-km (W) mit höchstens +10 % pro Woche und Entlastung nach drei Aufbauwochen
  const R = longestIn(today), Ld = loadFor(start);
  let L = opt.L0 !== undefined ? opt.L0 : R ? R.km : null, W = opt.W0 !== undefined ? opt.W0 : Ld.avg;
  let streak = 0, peakL = L, peakW = W;
  const grow = (v, cap) => v === null ? null : v >= cap ? v : Math.min(cap, v * (1 + SEASON.grow));
  weeks.forEach((x, i) => {
    const d = D(x.target.dist), p = x.phase, nextPh = weeks[i + 1] && weeks[i + 1].phase;
    if (p === 'recover') {
      const f = D(x.target.dist).recover[x.k];
      x.long = peakL === null || !f.long ? null : peakL * f.long; x.km = peakW === null ? null : peakW * f.wk;
      x.noLong = !f.long; if (x.long !== null) L = x.long; if (x.km !== null) W = x.km; streak = 0; return;
    }
    if (p === 'taper') {
      if (x.k === 0 || peakL === null) { peakL = L; peakW = W; }
      const f = d.taper[x.k];
      x.long = L === null || !f.long ? null : peakL * f.long; x.km = W === null ? null : peakW * f.wk; streak = 0; return;
    }
    const pk = bothPeaks(x), share = SEASON.cap[p], capL = Math.max(8, pk.long * share), capW = Math.max(15, pk.week * share);
    if (streak >= SEASON.cutEvery && nextPh !== 'taper') {
      x.cut = true; streak = 0;
      x.long = L === null ? null : L * SEASON.cutLong; x.km = W === null ? null : W * SEASON.cutWeek; return;
    }
    L = grow(L, capL); W = grow(W, capW); x.long = L; x.km = W; streak++; peakL = L; peakW = W;
  });
  // B-Rennen: ersetzt die Qualitätseinheit, ab Halbmarathon bzw. ab 80 % des geplanten Longruns auch den Longrun, und zählt in die Wochen-km
  for (const x of weeks) for (const b of x.b) {
    if (x.a) continue;
    const bk = raceKm(b), planned = x.long;
    x.bRace = b;
    x.bLong = b.dist === 'hm' || b.dist === 'marathon' || (planned !== null && planned !== undefined && bk >= planned * 0.8);
    // ersetzt das Rennen den Longrun: Rennen + übrige Läufe; sonst ersetzt es nur die Qualität: mindestens Rennen + Longrun
    if (x.km !== null && x.km !== undefined) x.km = Math.max(x.km, x.bLong ? bk + Math.max(0, x.km - (planned || 0)) : bk + (planned || 0));
    if (planned && bk > planned * (1 + SEASON.grow)) {
      x.bSpike = Math.round(planned);
      warn.push(T(`${b.name} (${raceLabel(b)}): deutlich länger als dein Longrun zu der Zeit (ca. ${Math.round(planned)} km). Locker laufen, nicht auf Zeit – und die Longruns davor möglichst heranführen.`, `${b.name} (${raceLabel(b)}): clearly longer than your long run at that time (about ${Math.round(planned)} km). Run it easy, not for time – and build the long runs up to it if possible.`));
    }
  }
  // Machbarkeit: erreicht der Longrun vor dem Tapering das Ziel?
  for (const r of next) {
    const pk = peaks(r), i0 = weeks.findIndex(x => x.target === r && x.phase === 'taper');
    // Rennen dicht nach einem anderen: dessen Block und das Rennen selbst zählen mit – die Ausdauer ist ja schon da
    const m = mix.find(c => c.r === r), mine = x => x.target === r || x.with === r || (m && x.target === m.last);
    const longs = weeks.slice(0, i0 < 0 ? 0 : i0).filter(x => mine(x) && x.long !== null && x.long !== undefined).map(x => x.long);
    const pre = longs.length ? { long: Math.max(...longs, m ? raceKm(m.last) : 0) } : null;
    if (pre && pre.long < pk.long * 0.9) warn.push(T(`${r.name}: Mit +10 % pro Woche schaffst du bis zum Tapering einen Longrun von etwa ${Math.round(pre.long)} km – das Ziel sind ${pk.long} km. Mehr Vorlauf einplanen oder das Ziel locker angehen.`, `${r.name}: with +10 % per week you reach a long run of about ${Math.round(pre.long)} km by the taper – the target is ${pk.long} km. Plan more lead time or approach the goal easily.`));
  }
  markTests(weeks, today);
  return { weeks, warn, note, races: next, hasData: L !== null || W !== null, start };
}
const phaseKey = x => x.cut ? 'cut' : x.phase;
/* Aufklappbare Bereiche (Akkordeon): je Gruppe (data-acc) ist höchstens einer offen; welcher, merkt sich das Gerät.
   Zugeklappt wird nur Nachschlagewissen und selten Genutztes – was man jedes Mal braucht, bleibt sichtbar. */
let sectState = load(KEYS.sections, {}); if (!isObj(sectState)) sectState = {};
const sectOpen = (acc, id, def = false) => Object.prototype.hasOwnProperty.call(sectState, acc) ? sectState[acc] === id : def;
const sectHtml = (acc, id, icon, color, title, sub, body, def = false) => `<details class="sect" data-acc="${acc}" id="${id}"${sectOpen(acc, id, def) ? ' open' : ''}><summary class="row"><span class="icon" style="background:${color}">${icon}</span><span class="txt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev"></span></summary><div class="sectbody">${body}</div></details>`;
function applySections() { document.querySelectorAll('details.sect[data-acc]').forEach(d => { const o = sectOpen(d.dataset.acc, d.id, d.hasAttribute('data-default-open')); if (d.open !== o) d.open = o; }); }
/* Trainingstempos aus der besten Leistung der letzten 12 Monate (Bestzeiten): per Riegel auf 10 km umgerechnet.
   Locker = 10-km-Pace + 60–90 s, Schwelle = Renntempo 15 km bis HM, Intervall ≈ 5-km-Renntempo, Marathontempo per Riegel. */
// Aktuelle Form: das neueste Ergebnis, solange es höchstens 3 % langsamer ist als das beste der letzten 12 Monate – sonst das beste
const FORM_TOLERANCE = 0.03, TEST_EVERY_DAYS = 56;
function fitnessRef(today = localDay()) {
  const from = addDays(today, -365), list = [];
  for (const r of results) {
    if (r.date < from || r.date > today) continue;
    const km = groupKm(resultGroup(r)); if (!(km >= 3 && km <= 43)) continue;
    list.push({ t10: riegel(r.time, km, 10), r, km });
  }
  if (!list.length) return null;
  const best = list.reduce((a, b) => b.t10 < a.t10 ? b : a), newest = list.reduce((a, b) => b.r.date > a.r.date ? b : a);
  const ref = newest.t10 <= best.t10 * (1 + FORM_TOLERANCE) ? newest : best;
  return Object.assign({}, ref, { newest: newest.r.date, stale: newest.r.date < addDays(today, -TEST_EVERY_DAYS) });
}
/* Testläufe: Ist das letzte Ergebnis oder Rennen 8 Wochen her (oder gibt es noch keins), wird in der nächsten passenden Woche
   (Basis, Grundlage, Aufbau; keine Entlastungs- oder Rennwoche) die Qualitätseinheit zum 5-km-Testlauf. Danach wieder 8 Wochen. */
// Einen Testlauf gibt es nur, wenn 5 km schon machbar sind: in der laufenden Woche, wenn der längste Lauf der letzten 30 Tage
// mindestens 5 km war, danach, wenn der geplante Longrun der Woche mindestens 5 km lang ist. Im Lauf-Einstieg nie.
const TEST_MIN_KM = 5;
function markTests(weeks, today = localDay()) {
  if (runnerLevel() === 'beginner') return;
  // Nur eingetragene Ergebnisse zählen; ein vergangenes Rennen ohne Ergebnis ändert die Tempos nicht. Geplante Rennen zählen als künftiger Wert.
  let last = results.map(r => r.date).filter(d => d <= today).sort().at(-1) || null;
  const R = longestIn(today), ready = (x, i) => i === 0 ? !!R && R.km >= TEST_MIN_KM : typeof x.long === 'number' && x.long >= TEST_MIN_KM - 1e-9;
  weeks.forEach((x, i) => {
    if (x.a || x.b.length) { last = x.week; return; }
    const due = !last || x.week >= weekStart(addDays(last, TEST_EVERY_DAYS));
    if (due && ['basis', 'base', 'build'].includes(x.phase) && !x.cut && ready(x, i)) { x.test = true; last = x.week; }
  });
}
function trainingPaces(today) {
  const ref = fitnessRef(today); if (!ref) return null;
  const at = d => riegel(ref.t10, 10, d) / d, p10 = ref.t10 / 10, r5 = v => Math.round(v / 5) * 5;
  return { ref, easy: [r5(p10 + 60), r5(p10 + 90)], marathon: at(42.195), threshold: [r5(at(15)), r5(at(21.0975))], interval: at(5) };
}
const paceRange = ([a, b]) => `${hms(a)}–${hms(b)} /km`;
// Renntempo aus der aktuellen Form; nur ohne jedes Ergebnis als Notlösung aus der Zielzeit
// Pace Race: das Level-Tempo (Zeitlimit der Zielrunde), aber nie schneller als das aktuelle 5-km-Tempo – wie sonst: Tempo aus der Form
const racePace = r => {
  const tp = trainingPaces(), g = raceGoal(r);
  if (r.fmt === 'pace') return tp ? Math.max(paceCut(r.km), riegel(tp.ref.t10, 10, 5) / 5) : paceCut(r.km);
  return tp ? riegel(tp.ref.t10, 10, raceKm(r)) / raceKm(r) : g ? g / raceKm(r) : null;
};
// Wie weit bzw. bis zu welchem Level die aktuelle Form etwa reicht (null ohne Ergebnis)
function formReach(fmt) {
  const tp = trainingPaces(); if (!tp) return null;
  if (fmt === 'pace') { const p5 = riegel(tp.ref.t10, 10, 5) / 5; let n = 0; while (n < PACE_RACE.levels && paceCut(n + 1) >= p5) n++; return { level: n, p5, ref: tp.ref }; }
  // Strecke, auf der die Riegel-Prognose so lang dauert wie das Catcher Car bis dorthin (Halbierung, vorne ist man schneller als das Auto)
  let lo = 0.5, hi = 150;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (riegel(tp.ref.t10, 10, m) <= carTime(m)) lo = m; else hi = m; }
  return { km: lo, ref: tp.ref };
}
// Bei Tempo-Abschnitten das Renntempo dahinterschreiben, bei Schwelle den Schwellenbereich aus der Bestzeit
const withPace = (txt, r) => {
  const p = /tempo|pace/i.test(txt) ? racePace(r) : null, tp = /Schwelle|threshold/i.test(txt) ? trainingPaces() : null;
  return txt + (p ? ` (${hms(p)} /km)` : '') + (tp ? ` (${paceRange(tp.threshold)})` : '');
};
// Lockere Einheiten: Bereich aus der Bestzeit anhängen
const easyPace = () => { const tp = trainingPaces(); return tp ? ` · ${paceRange(tp.easy)}` : ''; };
// Rennen der letzten 3 Wochen ohne eingetragenes Ergebnis: daran erinnern, damit die Tempos aktuell werden
function missingResultHint() {
  const today = localDay(), r = races.filter(x => x.date <= today && x.date >= addDays(today, -21) && x.fmt !== 'pace' && !x.dns && !results.some(e => e.race === x.id || (e.date === x.date && Math.abs((e.km || 0) - raceKm(x)) < 0.5))).at(-1);
  return r ? `<div class="alert">${T(`Wie lief <b>${esc(r.name)}</b>? Ergebnis unter <b>Bestzeiten</b> eintragen („Aus deinen Rennen übernehmen“) – dann passen die Tempos.`, `How did <b>${esc(r.name)}</b> go? Enter the result under <b>Best times</b> (“Take from your races”) – then the paces fit.`)}</div>` : '';
}
function renderPaces() {
  const tp = trainingPaces();
  if (!tp) return `<div class="header">${T('Trainingstempos', 'Training paces')}</div>${missingResultHint()}<div class="group"><div class="row"><span class="txt"><small>${T('Unter <b>Bestzeiten</b> ein Ergebnis der letzten 12 Monate eintragen (3 bis 42 km) – dann stehen hier deine Tempos für locker, Schwelle, Intervall und Marathon.', 'Enter a result from the last 12 months under <b>Best times</b> (3 to 42 km) – then your paces for easy, threshold, intervals and marathon appear here.')}</small></span></div></div>`;
  const r = tp.ref.r, stale = missingResultHint() || (tp.ref.stale ? `<div class="alert due">${T(`Letztes Ergebnis vom ${dateGerman(tp.ref.newest)} – Zeit für einen Testlauf (5 km) oder ein B-Rennen. Danach unter <b>Bestzeiten</b> eintragen, dann passen die Tempos wieder.`, `Last result from ${dateGerman(tp.ref.newest)} – time for a time trial (5 km) or a B race. Then enter it under <b>Best times</b> so the paces fit again.`)}</div>` : ''), rows = [[T('Locker & Longrun', 'Easy & long run'), paceRange(tp.easy), T('Gesprächstempo, Zone 2', 'conversational, zone 2')],
    [T('Marathontempo', 'Marathon pace'), hms(tp.marathon) + ' /km', T('lange Abschnitte im Marathonblock', 'long segments in a marathon block')],
    [T('Schwelle', 'Threshold'), paceRange(tp.threshold), T('kontrolliert hart, etwa eine Stunde haltbar', 'controlled hard, sustainable for about an hour')],
    [T('Intervall', 'Intervals'), '≈ ' + hms(tp.interval) + ' /km', T('etwa 5-km-Renntempo, 400–1000 m', 'about 5 km race pace, 400–1000 m')]];
  const mmss = v => hms(v), sum = `${T('locker', 'easy')} ${mmss(tp.easy[0])}–${mmss(tp.easy[1])} · ${T('Schwelle', 'threshold')} ${mmss(tp.threshold[0])}–${mmss(tp.threshold[1])} /km`;
  return `${stale}<div class="group sectgroup">${sectHtml('runplan', 'sect-paces', '⏱', 'var(--accent)', T('Trainingstempos', 'Training paces'), sum, `<div id="planpaces">${rows.map(([n, v, d]) => `<div class="row"><span class="txt"><b>${esc(n)}</b><small>${esc(d)}</small></span><span class="val">${esc(v)}</span></div>`).join('')}</div>
    <p class="footer">${T(`Aus deinem Ergebnis ${esc(groupLabel(resultGroup(r)))} in ${hms(r.time)} am ${dateGerman(r.date)}, mit Riegel umgerechnet. Es zählt das neueste Ergebnis, solange es höchstens 3 % langsamer ist als dein bestes der letzten 12 Monate – so werden die Tempos mit jedem Testlauf oder Rennen aktuell, nicht aus der Zielzeit. Richtwerte – bei Hitze, Wind, Hügeln oder müden Beinen langsamer.`, `From your result ${esc(groupLabel(resultGroup(r)))} in ${hms(r.time)} on ${dateGerman(r.date)}, converted with Riegel. Your newest result counts as long as it is at most 3 % slower than your best of the last 12 months – so the paces follow every time trial or race, not the goal time. Guidelines – slower in heat, wind, hills or with tired legs.`)}</p>`)}</div>`;
}
// Gemeinsamer Block: in geraden Kalenderwochen gilt die Qualitätseinheit dem späteren Rennen – nur, wenn es andere Einheiten hat
const mixFor = x => x.with && planKey(x.with) !== planKey(x.target) && !(isoWeek(x.week) % 2) ? x.with : null;
function weekKey(x, alt = false) {
  const odd = isoWeek(x.week) % 2, mix = mixFor(x), r = mix || x.target;
  const t = SEASON.key[x.phase] || SEASON.key.basis, list = t[planKey(r)] || t[r.dist] || t.all;
  // im gemeinsamen Block: ungerade KW die erste Einheit fürs aktuelle Ziel, gerade KW die erste fürs spätere Rennen
  // alt: zweite Qualität der Woche – die jeweils andere Einheit des Paars
  const txt = mix ? list[alt ? 1 : 0] : list[(odd ? 0 : 1) ^ (alt ? 1 : 0)], tp = /^(Intervall|Intervals):/.test(txt) ? trainingPaces() : null;
  return (x.cut ? T('kürzer: ', 'shorter: ') : '') + withPace(txt, r) + (tp ? ` (≈ ${hms(tp.interval)} /km)` : '') + (x.phase === 'recover' ? easyPace() : '') + (mix ? T(` · für ${mix.name}`, ` · for ${mix.name}`) : '');
}
function weekLongNote(x) {
  if (x.a) return T('kein Longrun – Rennwoche', 'no long run – race week');
  if (x.bLong) return T(`${x.bRace.name} ersetzt den Longrun`, `${x.bRace.name} replaces the long run`);
  if (x.noLong) return T('kein Longrun', 'no long run');
  const t = SEASON.long[x.phase]; return hrize(withPace(typeof t === 'string' ? t : t[planKey(x.target)] || t[x.target.dist], x.target)) + easyPace();
}
// Fester Kraft-Plan eines Wochentags (nur, wenn die Geräte dafür eingetragen sind), sonst null
// Im Urlaub ist jeder Krafttag ein Hotel-Tag (auch ein Kurs-Tag); „Gym/Kurs“ hat keinen App-Plan
const dayPlan = d => { if (vacation()) return 'hotel'; const pk = profile.week.strengthPlan[d]; return pk && PLANS[pk] && planOwned(pk) ? pk : null; };
const gymOn = d => !vacation() && profile.week.strengthPlan[d] === 'gym' ? (profile.week.gymNames[d] || T('Gym/Kurs', 'Gym/class')) : null;
const strengthTitle = d => { const g = gymOn(d); if (g) return `${T('Kurs', 'Class')} · ${g}`; const pk = dayPlan(d); return pk ? `${T('Kraft', 'Strength')} · ${tr(PLANS[pk].tab)}` : T('Kraft', 'Strength'); };
// Einheiten der Woche auf die Tage aus dem Profil verteilt, Montag bis Sonntag
const dayIdx = d => WEEK_ORDER.indexOf(d);
/* Was ein B-Rennen in der Woche ersetzt und wie man es läuft – gemessen am A-Rennen des Blocks:
   deutlich kürzer (5/10 km im HM- oder Marathonblock) = Tempoeinheit, ab HM bzw. Longrun-Länge = Longrun, sonst Formtest.
   Erholung, Tapering oder deutlich länger als der Longrun: locker, nicht auf Zeit. */
function bRole(x) {
  const b = x.bRace, a = x.target;
  if (x.bSpike || x.phase === 'recover' || x.phase === 'taper') return T(' · locker, nicht auf Zeit', ' · easy, not for time');
  const bk = raceKm(b), ak = a ? raceKm(a) : null, an = a ? a.name : '';
  if (b.fmt === 'pace') return T(' · ersetzt die Qualität – zählt wie eine Intervalleinheit', ' · replaces the quality session – counts like an interval session');
  const CAT = ['5k', '10k', 'hm', 'marathon'], cb = CAT.indexOf(distForKm(bk)), short = ak && cb <= 1 && cb < CAT.indexOf(distForKm(ak)); // 5/10 km vor einem längeren A-Rennen
  if (x.bLong) return short ? T(' · ersetzt Qualität und Longrun – als Tempoeinheit voll laufen', ' · replaces quality session and long run – race it as your speed session')
    : ak && bk < ak * 0.9 ? T(` · ersetzt Qualität und Longrun – als Formtest voll laufen oder im Renntempo für ${an}`, ` · replaces quality session and long run – race it as a fitness test or run it at race pace for ${an}`) : T(' · ersetzt Qualität und Longrun – voll laufen', ' · replaces quality session and long run – race it');
  if (short) return T(' · ersetzt die Qualität: deine Tempoeinheit der Woche – voll laufen', ' · replaces the quality session: your speed session of the week – race it');
  return T(' · ersetzt die Qualität – als Formtest voll laufen, danach passen deine Tempos', ' · replaces the quality session – race it as a fitness test, then your paces update');
}
function weekSchedule(x) {
  const w = profile.week, out = [], rd = x.a ? dayIdx(new Date(x.a.date + 'T12:00:00').getDay()) : 9;
  const add = (d, kind, title, detail, extra = {}) => out.push(Object.assign({ d, kind, title, detail, plan: kind === 'strength' ? dayPlan(d) : null }, extra));
  const before = (d, gap = 1) => dayIdx(d) <= rd - gap;
  if (x.a) add(new Date(x.a.date + 'T12:00:00').getDay(), 'race', T(`Rennen: ${x.a.name}`, `Race: ${x.a.name}`), raceLabel(x.a) + goalLine(x.a));
  if (x.bRace) add(new Date(x.bRace.date + 'T12:00:00').getDay(), 'brace', T(`B-Rennen: ${x.bRace.name}`, `B race: ${x.bRace.name}`), raceLabel(x.bRace) + goalLine(x.bRace) + bRole(x));
  if (w.quality !== null && (!x.a || before(w.quality, 2)) && !x.bRace) add(w.quality, 'quality', x.phase === 'recover' ? T('Locker laufen', 'Easy run') : x.test ? T('Testlauf 5 km', 'Time trial 5 km') : T('Qualität', 'Quality'), x.test ? T('nach 15 Min. Einlaufen 5 km so schnell, wie du gleichmäßig durchhalten kannst – danach unter Bestzeiten eintragen, dann passen die Tempos', 'after a 15 min warm-up run 5 km as fast as you can hold evenly – then enter it under Best times so the paces update') : weekKey(x), { easy: x.phase === 'recover' });
  if (w.group !== null && (!x.a || before(w.group))) add(w.group, 'group', T('Laufgruppe', 'Running group'), hrize(x.a ? T('ganz locker, Zone 2', 'very easy, Zone 2') : T('locker, Zone 2', 'easy, Zone 2')) + easyPace());
  if (!x.a && !x.bLong && w.long !== null) { const lv = kmRound(x.long); add(w.long, 'long', x.noLong ? T('Locker oder frei', 'Easy or rest') : lv ? T(`Longrun ca. ${lv} km`, `Long run approx. ${lv} km`) : T('Longrun', 'Long run'), weekLongNote(x), x.noLong ? {} : { km: lv || null }); }
  for (const d of strengthDays()) if (!x.a || before(d, 2)) add(d, 'strength', strengthTitle(d), x.a ? T('leicht, keine schweren Beinübungen', 'light, no heavy leg exercises') : x.phase === 'taper' ? T('ohne schwere Beinübungen', 'without heavy leg exercises') : x.phase === 'recover' ? T('leicht', 'light') : '');
  // Weitere Einheiten: lockerer Lauf, zweite Qualität (die andere Einheit der Woche; in Erholung, Tapering und B-Rennwoche locker) oder anderes
  w.extras.forEach((e, i) => {
    const key = 'x' + i;
    if (x.a && !before(e.d, e.type === 'quality' ? 2 : 1)) return;
    if (e.type === 'easy') add(e.d, 'easy', extraTitle(e), hrize(T('locker, Zone 2', 'easy, Zone 2')) + easyPace(), { key });
    else if (e.type === 'recovery') add(e.d, 'easy', extraTitle(e), recoveryDetail(), { key, recovery: true });
    else if (e.type === 'quality') { if (['recover', 'taper'].includes(x.phase) || x.bRace || x.test) add(e.d, 'quality2', e.name || T('Lockerer Lauf', 'Easy run'), hrize(T('locker statt Tempo, Zone 2', 'easy instead of speed, Zone 2')) + easyPace(), { key, easy: true }); else add(e.d, 'quality2', e.name || T('Qualität 2', 'Quality 2'), weekKey(x, true), { key }); }
    else add(e.d, 'extra', extraTitle(e), '', { key });
  });
  const skip = weekSkip[x.week] || [], wp = curWeekPlan(x.week);
  for (const it of out) {
    it.key = it.key || (it.kind === 'strength' ? 'strength-' + it.d : it.kind); it.skip = skip.includes(it.key);
    if (wp) {
      it.done = wp.done.includes(it.key); if (isWd(wp.moved[it.key])) { it.from = it.d; it.d = wp.moved[it.key]; }
    }
  }
  // Kraft und Laufen am selben Tag gehen parallel: Kraft nach dem Lauf, nach Qualität oder Longrun ohne schwere Beinübungen
  for (const it of out) if (it.kind === 'strength' && !it.skip) {
    const runs = out.filter(o => o !== it && !o.skip && o.d === it.d && RUN(o)); if (!runs.length) continue;
    it.sameDay = runs.some(HARD) ? 'hard' : 'easy'; it.base = it.detail;
    const tip = it.sameDay === 'hard' ? T('am selben Tag wie ein harter Lauf: danach, ohne schwere Beinübungen', 'same day as a hard run: afterwards, no heavy leg exercises') : T('am selben Tag wie ein Lauf: danach oder mit ein paar Stunden Abstand', 'same day as a run: afterwards or a few hours apart');
    it.detail = it.detail ? `${it.detail} · ${tip}` : tip;
  }
  return out.sort((a, b) => dayIdx(a.d) - dayIdx(b.d));
}
/* Abhaken & nachholen (optional, Profil → Trainingswoche): gilt nur für die laufende Woche.
   Gespeichert wird { week, done: [Schlüssel], moved: { Schlüssel: Wochentag } }; in der nächsten Woche ist alles wieder frei. */
let weekPlan = load(KEYS.weekplan, null);
function curWeekPlan(week) {
  if (!profile.week.track || week !== weekStart(localDay())) return null;
  if (!isObj(weekPlan) || weekPlan.week !== week) weekPlan = { week, done: [], moved: {} };
  if (!Array.isArray(weekPlan.done)) weekPlan.done = []; if (!isObj(weekPlan.moved)) weekPlan.moved = {};
  delete weekPlan.autoSkip; // bis v52: Kraft fiel für einen nachgeholten Lauf aus – jetzt laufen beide parallel
  return weekPlan;
}
const storeWeekPlan = () => store(KEYS.weekplan, weekPlan);
// Nächster passender Tag ab morgen (bzw. ab heute für Einheiten von gestern und früher), höchstens bis Sonntag:
// harte Einheiten (Qualität, Longrun) nicht neben einer anderen harten Einheit oder einem Rennen, nichts am Renntag;
// bevorzugt ein Tag ohne andere Einheit, sonst ein Tag ohne weiteren Lauf.
// Kraft und Laufen gehen parallel: Ein Lauf darf auf einen Krafttag rücken (die Kraft bleibt, außer an festen Krafttagen kommt dort kein Lauf dazu),
// verpasste Kraft auf einen freien Tag oder zu einem lockeren Lauf – nicht zu Qualität, Longrun oder Rennen.
const HARD = it => ['quality', 'quality2', 'long', 'race', 'brace'].includes(it.kind) && !(['quality', 'quality2'].includes(it.kind) && it.easy);
const RUN = it => ['quality', 'quality2', 'long', 'group', 'easy', 'race', 'brace'].includes(it.kind);
// Feste Krafttage (Profil): beim Nachholen kommt dort kein Lauf dazu
const fixedStrength = o => o.kind === 'strength' && profile.week.strengthFixed.includes(o.from !== undefined ? o.from : o.d);
function catchUpDay(it, items) {
  const today = dayIdx(new Date(localDay() + 'T12:00:00').getDay()), start = dayIdx(it.d) < today ? today : today + 1;
  const others = items.filter(o => o !== it && !o.skip), race = others.find(o => o.kind === 'race');
  const ok = (i, strict) => {
    if (race && i >= dayIdx(race.d) - (HARD(it) ? 1 : 0)) return false;
    const same = others.filter(o => dayIdx(o.d) === i);
    if (strict && same.length) return false; // zuerst ganz freie Tage
    if (!RUN(it) && same.some(o => !(it.kind === 'strength' && RUN(o) && !HARD(o)))) return false; // Kraft: frei oder zu einem lockeren Lauf; Weiteres nur auf freie Tage
    if (RUN(it) && same.some(o => RUN(o) || fixedStrength(o))) return false; // Lauf: kein zweiter Lauf, kein fester Krafttag
    if (HARD(it) && others.some(o => HARD(o) && Math.abs(dayIdx(o.d) - i) <= 1)) return false;
    return true;
  };
  for (const strict of [true, false]) for (let i = start; i <= 6; i++) if (ok(i, strict)) return WEEK_ORDER[i];
  return null;
}
// „Entfällt“ je Woche, z. B. wenn die Laufgruppe ausfällt; alte Wochen werden aufgeräumt
let weekSkip = load(KEYS.skip, {});
weekSkip = isObj(weekSkip) ? Object.fromEntries(Object.entries(weekSkip).filter(([k, v]) => isDay(k) && Array.isArray(v)).map(([k, v]) => [k, v.filter(x => typeof x === 'string')])) : {};
function toggleSkip(week, key) {
  const cur = weekSkip[week] || [];
  weekSkip[week] = cur.includes(key) ? cur.filter(k => k !== key) : cur.concat(key);
  const limit = addDays(weekStart(localDay()), -7 * 8);
  for (const k of Object.keys(weekSkip)) if (!weekSkip[k].length || k < limit) delete weekSkip[k];
  store(KEYS.skip, weekSkip);
}
const peakText = r => { const p = peaks(r); return T(`Longrun bis ${p.long} km, Woche bis ${p.week} km${p.fromGoal ? '' : ' (Standard)'}`, `long run up to ${p.long} km, week up to ${p.week} km${p.fromGoal ? '' : ' (default)'}`); };
const kmRound = v => v === null || v === undefined ? null : Math.round(v);
// Ziel in Worten; bei Wings for Life und Pace Race aus dem Ziel gerechnet
function goalInfo(r) {
  if (r.fmt === 'wfl') { const t = carTime(r.km); return T(`Catcher Car bei km ${kmText(r.km)} nach ${hms(t)} → mind. ${paceText(t, r.km)}`, `Catcher Car at km ${kmText(r.km)} after ${hms(t)} → at least ${paceText(t, r.km)}`); }
  if (r.fmt === 'pace') return T(`Runde ${r.km} in höchstens ${hms(paceCut(r.km))} Min.`, `lap ${r.km} in at most ${hms(paceCut(r.km))} min`);
  return r.goal ? T(`Ziel ${hms(r.goal)} = ${paceText(r.goal, raceKm(r))}`, `goal ${hms(r.goal)} = ${paceText(r.goal, raceKm(r))}`) : '';
}
function goalLine(r) { const g = goalInfo(r); return g ? ' · ' + g : ''; }
const hoursText = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h` : T(`${m} Min.`, `${m} min`); };
// Rechnung im Formular, sobald Format und Ziel stehen
function raceFmtInfo(fmt, v) {
  if (fmt === 'wfl') {
    if (!(v >= 1 && v <= 100)) return T('Ziel in km eintragen (1–100) – die App rechnet, wann dich das Catcher Car dort einholt.', 'Enter the goal in km (1–100) – the app calculates when the Catcher Car catches you there.');
    const t = carTime(v), f = formReach('wfl');
    return T(`Das Catcher Car ist bei km ${kmText(v)} nach <b>${hms(t)}</b> – du brauchst im Schnitt mindestens <b>${paceText(t, v)}</b>.`, `The Catcher Car reaches km ${kmText(v)} after <b>${hms(t)}</b> – you need at least <b>${paceText(t, v)}</b> on average.`)
      + (f ? T(` Deine Form (${esc(groupLabel(resultGroup(f.ref.r)))} in ${hms(f.ref.r.time)}) reicht für etwa <b>${kmText(Math.floor(f.km * 2) / 2)} km</b>.`, ` Your form (${esc(groupLabel(resultGroup(f.ref.r)))} in ${hms(f.ref.r.time)}) is good for about <b>${kmText(Math.floor(f.km * 2) / 2)} km</b>.`) : '');
  }
  if (!(Number.isInteger(v) && v >= 1 && v <= PACE_RACE.levels)) return T(`Ziel-Level eintragen (1–${PACE_RACE.levels}) – Level 1 hat 8:00 Min. für 1.000 m, Level ${PACE_RACE.levels} nur noch ${hms(paceCut(PACE_RACE.levels))}.`, `Enter the goal level (1–${PACE_RACE.levels}) – level 1 allows 8:00 min for 1,000 m, level ${PACE_RACE.levels} only ${hms(paceCut(PACE_RACE.levels))}.`);
  const f = formReach('pace');
  return T(`Level ${v} = ${v} km, die ${v}. Runde in höchstens <b>${hms(paceCut(v))}</b>, mit Pausen etwa ${hoursText(paceTotal(v))}.`, `Level ${v} = ${v} km, lap ${v} in at most <b>${hms(paceCut(v))}</b>, with breaks about ${hoursText(paceTotal(v))}.`)
    + (f ? (f.level ? T(` Deine Form (5-km-Tempo ${hms(f.p5)}) reicht grob für <b>Level ${f.level}</b>`, ` Your form (5 km pace ${hms(f.p5)}) is roughly good for <b>level ${f.level}</b>`) : T(` Mit deiner Form (5-km-Tempo ${hms(f.p5)}) ist schon Level 1 knapp`, ` With your form (5 km pace ${hms(f.p5)}) even level 1 is tight`))
      + (paceCut(v) < f.p5 ? T(` – die Wiederholungen im Plan laufen erst mal in ${hms(f.p5)} /km.`, ` – the repeats in the plan start at ${hms(f.p5)} /km.`) : '.') : '');
}
// Zeilen der Wochenplanung; mit „Abhaken & nachholen“ zusätzlich Haken, Nachholen-Vorschlag und Rückgängig
function schedRows(x) {
  const items = weekSchedule(x), track = !!curWeekPlan(x.week), today = dayIdx(new Date(localDay() + 'T12:00:00').getDay());
  return items.map(it => {
    const race = it.kind === 'race' || it.kind === 'brace', open = track && !race && !it.done && !it.skip;
    const to = open && dayIdx(it.d) <= today ? catchUpDay(it, items) : null;
    const none = open && to === null && dayIdx(it.d) < today ? `<small class="moved">${T('kein passender Tag mehr frei – diese Woche einfach ausfallen lassen', 'no suitable day left – just skip it this week')}</small>` : '';
    const note = it.skip ? `<small>${T('entfällt diese Woche', 'skipped this week')}</small>` : none + (it.from !== undefined ? `<small class="moved">${T(`verschoben von ${WD[it.from]}`, `moved from ${WD[it.from]}`)} · <button type="button" class="linkbtn" data-unmove="${it.key}">${T('rückgängig', 'undo')}</button></small>` : '') + (it.detail ? `<small>${esc(it.detail)}</small>` : '');
    const check = track && !race ? `<button type="button" class="schedcheck" data-done="${it.key}" aria-pressed="${!!it.done}" aria-label="${esc(it.title)} ${T('erledigt', 'done')}">${it.done ? '✓' : ''}</button>` : '';
    const btns = race ? '' : (to !== null ? `<button type="button" class="btn small" data-move="${it.key}" data-to="${to}">${T(`→ ${WD[to]}`, `→ ${WD[to]}`)}</button>` : '') + (it.done ? '' : `<button type="button" class="btn small" data-skip="${it.key}" data-week="${x.week}">${it.skip ? T('Wieder rein', 'Restore') : T('Entfällt', 'Skip')}</button>`);
    return `<div class="row sched-${it.kind}${it.skip ? ' skipped' : ''}${it.done ? ' done' : ''}">${check}<span class="dur">${WD[it.d]}</span><span class="txt"><b>${esc(it.title)}</b>${note}${btns ? `<span class="schedbtns">${btns}</span>` : ''}</span></div>`;
  }).join('');
}
function renderPlanWeek(S) {
  const x = S.weeks[0], [pl, pt] = SEASON.phase[phaseKey(x)];
  const nxt = S.races[0], wk = weeksBetween(x.week, weekStart(nxt.date));
  const R = longestIn(localDay()), longVal = kmRound(x.long === null || x.long === undefined ? null : (R ? Math.min(x.long, R.max) : x.long));
  const kmVal = kmRound(x.km);
  // Rennwoche und Erholungswochen: wie lange die Erholung nach dieser Distanz etwa dauert
  const rec = x.a || (x.phase === 'recover' ? x.target : null), recNote = rec && SEASON.recoverNote[rec.dist] ? `<div class="alert">${esc(SEASON.recoverNote[rec.dist])}</div>` : '';
  const bs = x.b.map(b => `<div class="alert"><b>${esc(b.name)}</b> (${esc(raceLabel(b))}, ${dayLabel(b.date)}): ${esc(x.phase === 'taper' ? SEASON.bInTaper : x.phase === 'recover' ? SEASON.bInRecover : SEASON.bRace)}</div>`).join('');
  return `<div class="header">${T('Diese Woche · KW ', 'This week · wk ')}${isoWeek(x.week)}</div><div class="group"><div class="panel" style="border:0;padding-top:12px" id="planweek">
    <div class="phasebadge ph-${phaseKey(x)}">${esc(pl)}</div>
    <p class="loadstatus">${wk === 0 ? T(`Rennwoche: <b>${esc(nxt.name)}</b> am ${dayLabel(nxt.date)}`, `Race week: <b>${esc(nxt.name)}</b> on ${dayLabel(nxt.date)}`) : T(`Noch ${wk} ${wk === 1 ? 'Woche' : 'Wochen'} bis <b>${esc(nxt.name)}</b> (${esc(raceLabel(nxt))}, ${dateGerman(nxt.date)})`, `${wk} ${wk === 1 ? 'week' : 'weeks'} to <b>${esc(nxt.name)}</b> (${esc(raceLabel(nxt))}, ${dateGerman(nxt.date)})`)}${esc(goalLine(nxt))}</p>
    <p class="tiny" style="margin-top:2px">${esc(pt)}</p>
    <p class="tiny" style="margin-top:2px" id="planpeaks">${T(`Ziel für ${esc(nxt.name)}: `, `Target for ${esc(nxt.name)}: `)}${esc(peakText(nxt))}${nxt.fmt === 'wfl' ? T(` – aus dem Ziel ${kmText(nxt.km)} km`, ` – from the goal of ${kmText(nxt.km)} km`) : nxt.fmt === 'pace' ? T(` – aus dem Ziel Level ${nxt.km}`, ` – from the goal level ${nxt.km}`) : nxt.goal ? T(` – aus der Zielzeit ${hms(nxt.goal)}`, ` – from the goal time ${hms(nxt.goal)}`) : T(' – Zielzeit eintragen für passende Werte', ' – enter a goal time for matching values')}.</p>
    <div class="metrics two">
      <div class="metric"><span>${T('Longrun', 'Long run')}</span><b>${x.a || x.noLong || x.bLong ? '–' : longVal === null ? '?' : T('ca. ', 'approx. ') + longVal + ' km'}</b><small>${esc(weekLongNote(x))}</small></div>
      <div class="metric"><span>${T('Woche', 'Week')}</span><b>${kmVal === null ? '?' : T('ca. ', 'approx. ') + kmVal + ' km'}</b><small>${x.cut ? T('Entlastungswoche', 'deload week') : x.phase === 'taper' ? T('reduziert', 'reduced') : T('höchstens +10 %', 'at most +10 %')}</small></div>
    </div>
    <div class="planrows" id="planschedule">${schedRows(x)}</div>
    <p class="tiny">${T('Tage stellst du unter <b>Profil → Trainingswoche</b> ein. „Entfällt“ gilt nur für diese Woche.', 'Set the days under <b>Profile → Training week</b>. “Skip” applies to this week only.')}</p>
    ${recNote}${bs}
    ${S.hasData ? '' : `<p class="tiny">${T('Für Longrun und Wochen-km: unter <b>Umfang</b> deine Läufe oder Wochensummen der letzten Wochen eintragen.', 'For long run and weekly km: enter your runs or weekly totals of the last weeks under <b>Volume</b>.')}</p>`}
    ${!x.a && !x.bLong && x.long && x.km && x.long > 0.6 * x.km ? `<div class="alert due" id="planratio">${T(`Der Longrun ist ${Math.round(x.long / x.km * 100)} % deiner Wochen-km – für Qualität und lockere Läufe bleibt kaum etwas. Fehlen unter <b>Umfang</b> Läufe? Dann dort nachtragen, der Plan rechnet sofort neu.`, `The long run is ${Math.round(x.long / x.km * 100)} % of your weekly km – hardly anything is left for quality and easy runs. Are runs missing under <b>Volume</b>? Add them there, the plan recalculates immediately.`)}</div>` : ''}
    ${R && !x.a && !x.noLong && !x.bLong && x.long > R.max ? `<p class="tiny">${T(`Longrun auf ${kmText(R.max)} km begrenzt: längster Lauf der letzten 30 Tage plus 10 %.`, `Long run capped at ${kmText(R.max)} km: longest run of the last 30 days plus 10 %.`)}</p>` : ''}
  </div></div>`;
}
function renderPlanSeason(S) {
  const SHOW = 8, row = (x, i) => {
    const [pl] = SEASON.phase[phaseKey(x)], lv = kmRound(x.long), kv = kmRound(x.km);
    const marks = (x.a ? [`🏁 ${esc(x.a.name)} · A`] : []).concat(x.b.map(b => `${esc(b.name)} · B`), x.test ? [`⏱ ${T('Testlauf', 'Time trial')}`] : [], mixFor(x) ? [`⇄ ${esc(x.with.name)}`] : []).join(' · ');
    const nums = [x.a ? T('Rennen', 'Race') : x.bLong ? T(`Rennen ${raceLabel(x.bRace)} statt Longrun`, `race ${raceLabel(x.bRace)} instead of long run`) : x.noLong ? T('kein Longrun', 'no long run') : lv === null || lv === undefined ? '' : T(`Longrun ${lv} km`, `long run ${lv} km`), kv === null || kv === undefined ? '' : T(`Woche ${kv} km`, `week ${kv} km`)].filter(Boolean).join(' · ');
    return `<div class="row planweek${i === 0 ? ' now' : ''}${x.a ? ' race' : ''}"><span class="dur">${T('KW', 'Wk')} ${isoWeek(x.week)}<small>${dateShort(x.week)}</small></span><span class="txt"><b><span class="phasedot ph-${phaseKey(x)}"></span>${esc(pl)}${marks ? ` · ${marks}` : ''}</b>${nums ? `<small>${nums}</small>` : ''}</span></div>`;
  };
  const rest = S.weeks.length - SHOW;
  const nx = S.weeks[1], seasonSum = nx ? T(`nächste Woche: ${esc(SEASON.phase[phaseKey(nx)][0])}`, `next week: ${esc(SEASON.phase[phaseKey(nx)][0])}`) + (nx.test ? T(' · Testlauf', ' · time trial') : '') + (nx.b.length ? ' · ' + T('B-Rennen', 'B race') : '') : '';
  return `<div class="group sectgroup">${sectHtml('runplan', 'sect-season', '📆', '#5e5ce6', T(`Saison · ${S.weeks.length} Wochen`, `Season · ${S.weeks.length} weeks`), seasonSum, `<div id="planseason">${S.weeks.slice(0, SHOW).map(row).join('')}${rest > 0 ? `<details id="planmore"><summary class="row"><span class="txt"><b>${T(`Weitere ${rest} Wochen`, `${rest} more weeks`)}</b><small>${T(`bis ${esc(S.races.at(-1).name)} am ${dateGerman(S.races.at(-1).date)}`, `until ${esc(S.races.at(-1).name)} on ${dateGerman(S.races.at(-1).date)}`)}</small></span><span class="chev"></span></summary>${S.weeks.slice(SHOW).map((x, i) => row(x, i + SHOW)).join('')}</details>` : ''}</div><p class="footer">${T('Spätere Wochen sind eine Vorschau: Jede Woche rechnet der Plan mit deinem echten Umfang neu.', 'Later weeks are a preview: every week the plan recalculates with your real volume.')}</p>`)}</div>
  <div class="group" style="margin-top:12px"><button type="button" class="row" id="planics"><span class="icon" style="background:var(--red)">▦</span><span class="txt"><b>${T('In Kalender exportieren', 'Export to calendar')}</b><small>${T('Wochen, Longruns und Rennen als Kalenderdatei', 'Weeks, long runs and races as a calendar file')}</small></span><span class="chev"></span></button>
    <div class="row" id="icsremindrow"><span class="txt"><b>${T('Erinnerung', 'Reminder')}</b><small>${T('am Trainingstag, vom Kalender', 'on training days, from your calendar')}</small></span><input type="time" id="icstime" value="${esc(icsRemind.time)}" ${icsRemind.on ? '' : 'disabled'} aria-label="${T('Uhrzeit der Erinnerung', 'Reminder time')}"><button type="button" class="chip" id="icsremind" aria-pressed="${icsRemind.on}">${icsRemind.on ? T('An', 'On') : T('Aus', 'Off')}</button></div></div>
  <p class="footer">${T('Am besten in einen eigenen Kalender „Laufplan“ importieren. Bei einem späteren Export diesen Kalender leeren und neu importieren – der Plan rechnet jede Woche mit deinem echten Umfang neu.', 'Best import into a separate “Running plan” calendar. For a later export empty this calendar and import again – the plan recalculates every week with your real volume.')}</p>`;
}
let raceEdit = null;
// Vergangene Rennen: Ergebnis, Level oder „nicht gelaufen“ statt nur „vorbei“
const pastText = r => { const x = raceResult(r); return r.dns ? T(' · nicht gelaufen', ' · not run') : r.level !== undefined ? T(` · geschafft: Level ${levelText(r.level)}`, ` · reached: level ${levelText(r.level)}`) : x ? T(` · gelaufen: ${r.fmt === 'wfl' ? kmText(x.km) + ' km in ' : ''}${hms(x.time)}`, ` · ran: ${r.fmt === 'wfl' ? kmText(x.km) + ' km in ' : ''}${hms(x.time)}`) : T(' · vorbei', ' · past'); };
const raceKmLabel = sel => sel === 'wfl' ? T('Ziel in km', 'Goal in km') : sel === 'pace' ? T(`Ziel-Level (1–${PACE_RACE.levels})`, `Goal level (1–${PACE_RACE.levels})`) : T('Distanz in km', 'Distance in km');
const fmtVal = (fmt, s) => { const v = kmNum(s); return v === null || Number.isNaN(v) ? null : v; };
// Erholung und Tapering: Liegt ein Rennen in der Erholung nach einem A-Rennen oder dieses im Tapering davor, ist es zu dicht dran
function raceClash(c) {
  if (!isDay(c.date) || !SEASON.dist[c.dist]) return null;
  const cw = weekStart(c.date);
  for (const o of races) {
    if (o.id === c.id || o.prio !== 'A' || !SEASON.dist[o.dist]) continue;
    const ow = weekStart(o.date), gap = weeksBetween(ow, cw), rec = SEASON.dist[o.dist].recover.length, tap = SEASON.dist[c.dist].phases.taper;
    if (gap >= 0 && gap <= rec) return { o, kind: 'recover', n: rec };
    const g2 = -gap, tapO = SEASON.dist[o.dist].phases.taper, recC = SEASON.dist[c.dist].recover.length;
    if (c.prio === 'A' && gap > 0 && gap < tap) return { o, kind: 'taper', n: tap }; // das andere liegt im Tapering dieses Rennens
    if (g2 > 0 && g2 < tapO) return { o, kind: 'before', n: tapO }; // dieses Rennen liegt im Tapering des anderen
    if (c.prio === 'A' && g2 > 0 && g2 <= recC) return { o, kind: 'after', n: recC }; // das andere liegt in der Erholung nach diesem
  }
  return null;
}
function raceClashText(c, k) {
  const wk = n => n === 1 ? T('1 Woche', '1 week') : T(`${n} Wochen`, `${n} weeks`), on = `${k.o.name} (${dateGerman(k.o.date)})`;
  const why = k.kind === 'recover' ? T(`Es fällt in die Erholung nach ${on}, die dauert etwa ${wk(k.n)}.`, `It falls into the recovery after ${on}, which takes about ${wk(k.n)}.`)
    : k.kind === 'after' ? T(`${on} fällt in die Erholung danach, die dauert etwa ${wk(k.n)}.`, `${on} falls into the recovery afterwards, which takes about ${wk(k.n)}.`)
    : k.kind === 'before' ? T(`Es fällt ins Tapering vor ${on} (${wk(k.n)}).`, `It falls into the taper before ${on} (${wk(k.n)}).`)
    : T(`${on} fällt ins Tapering davor (${wk(k.n)}).`, `${on} falls into the taper before it (${wk(k.n)}).`);
  return c.prio === 'A' ? T(`Zu dicht für zwei A-Rennen: ${why} Eines davon besser als B-Rennen eintragen.`, `Too close for two A races: ${why} Better enter one of them as a B race.`)
    : T(`${why} Als B-Rennen nur locker mitlaufen, nicht auf Zeit.`, `${why} As a B race just run along easily, not for time.`);
}
// Formular an die Auswahl anpassen: Feld für km bzw. Level, Zielzeit nur bei fester Distanz, Rechnung bei Wings for Life und Pace Race
function syncRaceForm(focus) {
  const sel = $('racedist').value, fmt = sel === 'wfl' || sel === 'pace' ? sel : null, showKm = sel === 'custom' || !!fmt, km = $('racekm');
  $('racekmfield').classList.toggle('hide', !showKm); $('racekmlabel').textContent = raceKmLabel(sel);
  km.inputMode = sel === 'pace' ? 'numeric' : 'decimal'; km.placeholder = sel === 'pace' ? T('z. B. 12', 'e.g. 12') : T('z. B. 20', 'e.g. 20');
  $('racegoalfield').classList.toggle('hide', !!fmt);
  const info = $('racefmtinfo'); info.classList.toggle('hide', !fmt); info.innerHTML = fmt ? raceFmtInfo(fmt, fmtVal(fmt, km.value)) : '';
  const kv = fmtVal(fmt, km.value), c = { id: raceEdit, date: $('racedate').value, prio: $('raceprio').value, dist: sel === 'custom' || fmt ? (kv >= 1 ? distForKm(kv) : null) : sel };
  const k = raceClash(c), w = $('racewarn'); w.classList.toggle('hide', !k); w.textContent = k ? raceClashText(c, k) : '';
  if (focus && showKm) km.focus();
}
function renderRaces() {
  const today = localDay(), e = races.find(r => r.id === raceEdit) || null;
  const opt = (v, l, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
  const cur = e ? e.fmt || (e.km ? 'custom' : e.dist) : 'hm', fmt = cur === 'wfl' || cur === 'pace' ? cur : null;
  const list = races.length ? races.map(r => `<button type="button" class="row${r.date < today ? ' past' : ''}" data-raceedit="${esc(r.id)}"><span class="dur">${dateGerman(r.date)}</span><span class="txt"><b>${esc(r.name)} <span class="prio prio-${r.prio}">${r.prio}</span></b><small>${esc(raceLabel(r))}${r.km ? T(` (geplant wie ${esc(SEASON.dist[r.dist].label)})`, ` (planned like ${esc(SEASON.dist[r.dist].label)})`) : ''}${esc(goalLine(r))}${r.date < today ? esc(pastText(r)) : r.prio === 'A' ? '<br>' + esc(peakText(r)) : ''}</small></span><span class="chev"></span></button>`).join('')
    : `<div class="row"><span class="txt"><small>${T('Noch keine Rennen eingetragen.', 'No races entered yet.')}</small></span></div>`;
  return `<div class="intro">${esc(SEASON.intro)}</div>
    <div class="header">${e ? T('Rennen bearbeiten', 'Edit race') : T('Rennen eintragen', 'Add race')}</div><div class="group"><div class="raceform">
      <div class="field wide"><label for="racename">${T('Name', 'Name')}</label><input id="racename" type="text" maxlength="60" autocomplete="off" placeholder="${T('z. B. Berliner Halbmarathon', 'e.g. Berlin Half Marathon')}" value="${e ? esc(e.name) : ''}"></div>
      <div class="field"><label for="racedate">${T('Datum', 'Date')}</label><input id="racedate" type="date" value="${e ? e.date : ''}"></div>
      <div class="field"><label for="racedist">${T('Distanz', 'Distance')}</label><select id="racedist">${Object.entries(SEASON.dist).map(([k, d]) => opt(k, d.label, cur)).join('')}${opt('custom', T('Andere Distanz', 'Other distance'), cur)}${opt('wfl', 'Wings for Life World Run', cur)}${opt('pace', 'Pace Race', cur)}</select></div>
      <div class="field${e && e.km ? '' : ' hide'}" id="racekmfield"><label for="racekm" id="racekmlabel">${raceKmLabel(cur)}</label><input id="racekm" type="text" inputmode="${cur === 'pace' ? 'numeric' : 'decimal'}" autocomplete="off" placeholder="${cur === 'pace' ? T('z. B. 12', 'e.g. 12') : T('z. B. 20', 'e.g. 20')}" value="${e && e.km ? esc(kmText(e.km)) : ''}"></div>
      <div class="field"><label for="raceprio">${T('Priorität', 'Priority')}</label><select id="raceprio">${opt('A', T('A-Rennen', 'A race'), e ? e.prio : 'A')}${opt('B', T('B-Rennen', 'B race'), e ? e.prio : 'A')}</select></div>
      <p class="tiny racefmtinfo${fmt ? '' : ' hide'}" id="racefmtinfo">${fmt ? raceFmtInfo(fmt, fmtVal(fmt, e && e.km ? kmText(e.km) : '')) : ''}</p>
      <p class="alert due racewarn hide" id="racewarn"></p>
      <div class="field wide${fmt ? ' hide' : ''}" id="racegoalfield"><label>${T('Zielzeit (optional)', 'Goal time (optional)')}</label>${timeFields('racegoal', e && !e.fmt && e.goal, T('Zielzeit', 'Goal time'))}</div>
      <div class="raceactions">${e ? `<button type="button" class="btn small danger" id="racedel">${T('Löschen', 'Delete')}</button><button type="button" class="btn small" id="racecancel">${T('Abbrechen', 'Cancel')}</button>` : ''}<button type="button" class="btn small primary" id="racesave">${e ? T('Speichern', 'Save') : T('Hinzufügen', 'Add')}</button></div>
    </div></div>
    <p class="footer">${T('A-Rennen bekommen einen eigenen Vorbereitungsblock, B-Rennen laufen als harte Einheit mit. Antippen zum Bearbeiten.', 'A races get their own preparation block, B races run along as a hard session. Tap to edit.')}</p>
    <div class="header">${T('Deine Rennen', 'Your races')}</div><div class="group" id="racelist">${list}</div>`;
}
function saveRaceFromForm() {
  const name = $('racename').value.trim(), date = $('racedate').value, sel = $('racedist').value, prio = $('raceprio').value, goal = readTime('racegoal');
  for (const id of ['racename', 'racedate', 'racekm']) $(id).removeAttribute('aria-invalid'); markTime('racegoal', false);
  const fmt = sel === 'wfl' || sel === 'pace' ? sel : null, km = sel === 'custom' || fmt ? kmNum($('racekm').value) : null;
  if (sel === 'pace' && !(Number.isInteger(km) && km >= 1 && km <= PACE_RACE.levels)) { $('racekm').setAttribute('aria-invalid', 'true'); toast(T(`Bitte das Ziel-Level eingeben (1–${PACE_RACE.levels}).`, `Please enter the goal level (1–${PACE_RACE.levels}).`)); return; }
  if ((sel === 'custom' || sel === 'wfl') && (km === null || Number.isNaN(km) || km < 1 || km > 100)) { $('racekm').setAttribute('aria-invalid', 'true'); toast(sel === 'wfl' ? T('Bitte das Ziel in km eingeben (1–100).', 'Please enter the goal in km (1–100).') : T('Bitte die Distanz in km eingeben (1–100).', 'Please enter the distance in km (1–100).')); return; }
  const dist = sel === 'custom' || fmt ? distForKm(km) : sel;
  if (!name) { $('racename').setAttribute('aria-invalid', 'true'); toast(T('Bitte einen Namen eingeben.', 'Please enter a name.')); return; }
  if (!isDay(date)) { $('racedate').setAttribute('aria-invalid', 'true'); toast(T('Bitte ein Datum wählen.', 'Please choose a date.')); return; }
  if (!fmt && Number.isNaN(goal)) { markTime('racegoal', true); toast(T('Zielzeit prüfen: Minuten und Sekunden höchstens 59, z. B. 1 : 59 : 00.', 'Check the goal time: minutes and seconds at most 59, e.g. 1 : 59 : 00.')); return; }
  const r = { id: raceEdit || uid(), name: name.slice(0, 60), date, dist, prio, goal: fmt ? null : goal, km };
  if (fmt) r.fmt = fmt;
  races = races.filter(x => x.id !== r.id).concat(r); persistRaces();
  toast(raceEdit ? T('✓ Rennen gespeichert.', '✓ Race saved.') : T(`✓ ${name} eingetragen.`, `✓ ${name} added.`)); raceEdit = null; renderRun();
}
function renderPlanGuide() {
  const dists = Object.entries(SEASON.dist);
  return `<div class="header">${T('Renntempo-Rechner', 'Race pace calculator')}</div><div class="group"><div class="raceform">
      <div class="field"><label for="pcdist">${T('Distanz', 'Distance')}</label><select id="pcdist">${dists.map(([k, d]) => `<option value="${k}"${k === 'hm' ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}<option value="custom">${T('Andere Distanz', 'Other distance')}</option></select></div>
      <div class="field hide" id="pckmfield"><label for="pckm">${T('Distanz in km', 'Distance in km')}</label><input id="pckm" type="text" inputmode="decimal" autocomplete="off" placeholder="${T('z. B. 20', 'e.g. 20')}"></div>
      <div class="field wide"><label>${T('Zielzeit', 'Goal time')}</label>${timeFields('pctime', null, T('Zielzeit', 'Goal time'))}</div>
    </div><div class="panel" id="pcout"></div></div>
    <div class="header">${T('Wissen', 'Knowledge')}</div><div class="group manual">${SEASON_GUIDE.map(g => `<details data-acc="wissen"><summary class="row"><span class="txt"><b>${esc(g.title)}</b><small>${esc(g.sub)}</small></span><span class="chev"></span></summary><div class="panel"><ul>${g.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></details>`).join('')}</div>
    <p class="footer">${esc(SEASON.note)}</p>`;
}
function renderPace() {
  const out = $('pcout'); if (!out) return;
  const dist = $('pcdist').value, s = readTime('pctime'), ckm = dist === 'custom' ? kmNum($('pckm').value) : null;
  $('pckmfield').classList.toggle('hide', dist !== 'custom');
  markTime('pctime', Number.isNaN(s));
  if (dist === 'custom' && (ckm === null || Number.isNaN(ckm) || ckm < 1 || ckm > 100)) { out.innerHTML = `<p class="tiny">${T('Distanz in km eingeben, z. B. 20.', 'Enter the distance in km, e.g. 20.')}</p>`; return; }
  const d = dist === 'custom' ? { km: ckm, label: kmText(ckm) + ' km' } : SEASON.dist[dist];
  if (s === null || Number.isNaN(s)) { out.innerHTML = `<p class="tiny">${Number.isNaN(s) ? T('Minuten und Sekunden höchstens 59.', 'Minutes and seconds at most 59.') : T('Zielzeit eingeben, z. B. 1 : 59 : 00 oder 0 : 24 : 30.', 'Enter a goal time, e.g. 1 : 59 : 00 or 0 : 24 : 30.')}</p>`; return; }
  const marks = { '5k': [1, 2, 3, 4, 5], '10k': [2, 4, 5, 6, 8, 10], hm: [5, 10, 15, 20, d.km], marathon: [5, 10, 15, 20, 21.0975, 25, 30, 35, 40, d.km] }[dist]
    || [...Array.from({ length: Math.floor((d.km - 0.01) / 5) }, (_, i) => 5 * (i + 1)), d.km];
  out.innerHTML = `<div class="longnext"><b>${paceText(s, d.km)}</b><span>${esc(d.label)} in ${hms(s)} · ${kmText(Math.round(d.km / (s / 3600) * 10) / 10)} km/h · ${T('erste 2–3 km etwa', 'first 2–3 km about')} ${hms(s / d.km + 7)} /km</span></div>
    <div class="splits">${marks.map(k => `<span><small>${k === d.km ? T('Ziel', 'Finish') : k === 21.0975 ? T('Halbzeit', 'Halfway') : kmText(k) + ' km'}</small>${hms(s / d.km * k)}</span>`).join('')}</div>`;
}

/* ---------- Laufen → Plan → Bestzeiten: Ergebnisse je Distanz, Verlauf und Prognose ---------- */
const validResult = e => isObj(e) && typeof e.id === 'string' && isDay(e.date) && okNum(e.km, 0.4, 100)
  && Number.isInteger(e.time) && e.time >= 60 && e.time <= 86400 && (e.dist === null || e.dist === undefined || Object.prototype.hasOwnProperty.call(SEASON.dist, e.dist))
  && (e.name === undefined || (typeof e.name === 'string' && e.name.length <= 60));
const resultsLoaded = loadList(KEYS.results, validResult);
let results = resultsLoaded.ok; const resultsKeep = resultsLoaded.keep;
function persistResults() { results.sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time); if (!store(KEYS.results, results.concat(resultsKeep))) toast(T('Speichern im Browser nicht möglich – bitte Backup exportieren.', 'Saving in the browser failed – please export a backup.')); renderBackupBanner(); }
results.sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time);
// Gruppe: Standarddistanz oder eigene km (auf 0,1 km)
const resultGroup = r => r.dist || 'km' + Math.round(r.km * 10) / 10;
const groupLabel = g => g === 'wfl' ? 'Wings for Life' : g === 'pace' ? 'Pace Race' : SEASON.dist[g] ? SEASON.dist[g].label : kmText(Number(g.slice(2))) + ' km';
// Wings for Life und Pace Race: eigene Reiter unter Bestzeiten (weiteste Strecke bzw. bestes Level), nicht als Zeit über eine Distanz
const wflResult = r => !!r.race && races.some(x => x.id === r.race && x.fmt === 'wfl');
const paceLevels = () => races.filter(r => r.fmt === 'pace' && r.level !== undefined).sort((a, b) => a.date.localeCompare(b.date));
const groupKm = g => SEASON.dist[g] ? SEASON.dist[g].km : Number(g.slice(2));
const riegel = (t, from, to) => t * Math.pow(to / from, 1.06);
let bestView = load(KEYS.bestview, null); if (!isObj(bestView)) bestView = {};
function bestGroups() {
  const order = Object.keys(SEASON.dist), gs = [...new Set(results.filter(r => !wflResult(r)).map(resultGroup))];
  return gs.sort((a, b) => groupKm(a) - groupKm(b) || order.indexOf(a) - order.indexOf(b)).concat(results.some(wflResult) ? ['wfl'] : [], paceLevels().length ? ['pace'] : []);
}
function fmtBestCard(g) {
  const wfl = g === 'wfl', list = wfl ? results.filter(wflResult).sort((a, b) => a.date.localeCompare(b.date)) : paceLevels();
  const val = x => wfl ? x.km : x.level, best = list.reduce((a, b) => val(b) > val(a) ? b : a), first = list[0], gain = val(best) - val(first);
  const show = x => wfl ? `${kmText(x.km)} km` : `Level ${levelText(x.level)}`;
  return `<div class="group"><div class="panel" style="border:0;padding-top:12px" id="bestcard">
      <div class="longnext"><b>${esc(show(best))}</b><span>${wfl ? T('Weiteste Strecke', 'Furthest distance') + ` · ${hms(best.time)}` : T('Bestes Level', 'Best level')} · ${dateGerman(best.date)}${best.name ? ' · ' + esc(best.name) : ''}</span></div>
      <div class="metrics two">
        <div class="metric"><span>${T('Verbesserung', 'Improvement')}</span><b>${gain > 0 ? '+' + (wfl ? kmText(Math.round(gain * 10) / 10) + ' km' : levelText(Math.round(gain * 1000) / 1000)) : '–'}</b><small>${gain > 0 ? T(`seit ${dateGerman(first.date)}`, `since ${dateGerman(first.date)}`) : T('erstes Ergebnis', 'first result')}</small></div>
        <div class="metric"><span>${T('Ergebnisse', 'Results')}</span><b>${list.length}</b><small>${T('gesamt', 'total')}</small></div>
      </div>
      <p class="tiny">${wfl ? T('Die Zeit ist die des Catcher Cars bis dorthin. Wings for Life zählt für deine Trainingstempos mit (Riegel).', 'The time is the Catcher Car’s time to that point. Wings for Life counts for your training paces (Riegel).') : T('Level = geschaffte Runden, die Nachkommastellen zeigen die Meter der letzten Runde. Zählt wegen der Pausen nicht für die Trainingstempos.', 'Level = completed laps, the decimals show the metres of the last lap. Does not count for the training paces because of the breaks.')}</p>
    </div></div>
    <div class="header">${T('Ergebnisse', 'Results')} · ${esc(groupLabel(g))}</div><div class="group" id="bestlist">${list.slice().reverse().map(x => `<div class="row"><span class="dur">${dateGerman(x.date)}</span><span class="txt"><b>${esc(show(x))}${x === best ? ' 🏆' : ''}</b><small>${esc([wfl ? hms(x.time) : '', x.name || ''].filter(Boolean).join(' · '))}</small></span><button type="button" class="btn small danger" ${wfl ? `data-bestdel="${esc(x.id)}"` : `data-leveldel="${esc(x.id)}"`} aria-label="${T(`Ergebnis vom ${dateGerman(x.date)} löschen`, `Delete result of ${dateGerman(x.date)}`)}">${T('Löschen', 'Delete')}</button></div>`).join('')}</div>`;
}
// Bestzeiten im Zeitverlauf: jedes Ergebnis, das schneller war als alle davor
function pbSteps(list) { let best = Infinity; return list.filter(r => r.time < best ? (best = r.time, true) : false); }
function bestChart(list) {
  if (!list.length) return '';
  const W = 380, H = 200, l = 54, r = 14, top = 14, bottom = 166, pw = W - l - r;
  const t0 = new Date(list[0].date + 'T12:00:00').getTime(), t1 = new Date(list.at(-1).date + 'T12:00:00').getTime(), span = Math.max(1, t1 - t0);
  const x = e => list.length === 1 || t1 === t0 ? l + pw / 2 : l + (new Date(e.date + 'T12:00:00').getTime() - t0) / span * pw;
  let lo = Math.min(...list.map(e => e.time)), hi = Math.max(...list.map(e => e.time)); const pad = Math.max(30, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const y = t => top + (t - lo) / (hi - lo) * (bottom - top); // schneller = oben
  const ticks = [0, 1 / 3, 2 / 3, 1].map(f => lo + (hi - lo) * f);
  const grid = ticks.map(t => `<line class="axis" x1="${l}" y1="${y(t)}" x2="${W - r}" y2="${y(t)}" stroke-dasharray="4 5"/><text class="lbl" x="${l - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10.5">${hms(t)}</text>`).join('');
  const pb = pbSteps(list);
  let path = ''; pb.forEach((e, i) => { path += i ? ` H ${x(e).toFixed(1)} V ${y(e.time).toFixed(1)}` : `M ${x(e).toFixed(1)} ${y(e.time).toFixed(1)}`; });
  if (pb.length) path += ` H ${(list.length > 1 ? W - r : x(pb.at(-1)) ).toFixed(1)}`;
  const isPb = new Set(pb.map(e => e.id));
  const dots = list.map(e => `<circle class="dot${isPb.has(e.id) ? '' : ' other'}" cx="${x(e).toFixed(1)}" cy="${y(e.time).toFixed(1)}" r="${isPb.has(e.id) ? 5 : 4}" stroke-width="2"><title>${dateGerman(e.date)}: ${hms(e.time)}${e.name ? ' · ' + esc(e.name) : ''}</title></circle>`).join('');
  const first = list[0], last = list.at(-1);
  const labels = `<text class="lbl" x="${x(first)}" y="${H - 8}" text-anchor="${list.length > 1 ? 'start' : 'middle'}" font-size="10.5">${dateGerman(first.date)}</text>${list.length > 1 ? `<text class="lbl" x="${x(last)}" y="${H - 8}" text-anchor="end" font-size="10.5">${dateGerman(last.date)}</text>` : ''}`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T(`Zeiten über ${esc(groupLabel(resultGroup(first)))} von ${dateGerman(first.date)} bis ${dateGerman(last.date)}, Bestzeit ${hms(Math.min(...list.map(e => e.time)))}`, `Times over ${esc(groupLabel(resultGroup(first)))} from ${dateGerman(first.date)} to ${dateGerman(last.date)}, best ${hms(Math.min(...list.map(e => e.time)))}`)}">${grid}<path class="line" d="${path}" fill="none" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}<text class="lbl" x="${W - r}" y="${top - 2}" text-anchor="end" font-size="10.5">${T('schneller ↑', 'faster ↑')}</text></svg>`;
}
function renderBests() {
  const today = localDay(), gs = bestGroups(), g = gs.includes(bestView.group) ? bestView.group : gs[0];
  const own = !!g && /^km/.test(g); // eigene km vorbelegen – nicht bei Wings for Life / Pace Race
  const past = races.filter(r => r.date <= today && r.fmt !== 'pace' && !results.some(x => x.race === r.id)).slice(-12).reverse(); // Pace Race: Pausen verfälschen die Tempos
  const opt = (v, t, sel) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
  let html = `<div class="header">${T('Ergebnis eintragen', 'Add result')}</div><div class="group"><div class="raceform">
      ${past.length ? `<div class="field wide"><label for="bestfrom">${T('Aus deinen Rennen übernehmen', 'Take from your races')}</label><select id="bestfrom"><option value="">${T('– auswählen –', '– choose –')}</option>${past.map(r => `<option value="${esc(r.id)}">${esc(dateGerman(r.date) + ' · ' + r.name + ' (' + raceLabel(r) + ')')}</option>`).join('')}</select></div>` : ''}
      <div class="field wide"><label for="bestname">${T('Name (optional)', 'Name (optional)')}</label><input id="bestname" type="text" maxlength="60" autocomplete="off" placeholder="${T('z. B. Berliner Halbmarathon oder Testlauf', 'e.g. Berlin Half Marathon or time trial')}"></div>
      <div class="field"><label for="bestdate">${T('Datum', 'Date')}</label><input id="bestdate" type="date" value="${today}" max="${today}"></div>
      <div class="field"><label for="bestdist">${T('Distanz', 'Distance')}</label><select id="bestdist">${Object.entries(SEASON.dist).map(([k, d]) => opt(k, d.label, SEASON.dist[g] ? g : '10k')).join('')}${opt('custom', T('Andere Distanz', 'Other distance'), own ? 'custom' : '')}</select></div>
      <div class="field${own ? '' : ' hide'}" id="bestkmfield"><label for="bestkm">${T('Distanz in km', 'Distance in km')}</label><input id="bestkm" type="text" inputmode="decimal" autocomplete="off" placeholder="${T('z. B. 20', 'e.g. 20')}" value="${own ? esc(kmText(groupKm(g))) : ''}"></div>
      <div class="field wide"><label>${T('Zeit', 'Time')}</label>${timeFields('besttime', null, T('Zeit', 'Time'))}</div>
      <div class="raceactions"><button type="button" class="btn small primary" id="bestsave">${T('Hinzufügen', 'Add')}</button></div>
    </div></div>
    <p class="footer">${T('Alle Ergebnisse eintragen, nicht nur Bestzeiten – die App erkennt neue Bestzeiten selbst und zeigt den Verlauf.', 'Enter all results, not only best times – the app detects new best times itself and shows the history.')}</p>`;
  if (!gs.length) return html + `<div class="group" style="margin-top:12px"><div class="row"><span class="txt"><b>${T('Noch keine Ergebnisse', 'No results yet')}</b><small>${T('Trag oben dein erstes Ergebnis ein.', 'Enter your first result above.')}</small></span></div></div>`;
  const tabs = `<div class="header">${T('Deine Bestzeiten', 'Your best times')}</div><div class="segmented" role="tablist" id="bestgroups" style="flex-wrap:wrap">${gs.map(x => `<button role="tab" type="button" data-bestgroup="${esc(x)}" aria-selected="${x === g}">${esc(groupLabel(x))}</button>`).join('')}</div>`;
  if (g === 'wfl' || g === 'pace') return html + tabs + fmtBestCard(g);
  const list = results.filter(r => resultGroup(r) === g && !wflResult(r)), pb = list.reduce((a, b) => b.time < a.time ? b : a), first = list[0], km = groupKm(g);
  const steps = pbSteps(list), gain = first.time - pb.time, isPb = new Set(steps.map(e => e.id));
  html += `${tabs}
    <div class="group"><div class="panel" style="border:0;padding-top:12px" id="bestcard">
      <div class="longnext"><b>${hms(pb.time)}</b><span>${T('Bestzeit', 'Best time')} ${esc(groupLabel(g))} · ${paceText(pb.time, km)} · ${dateGerman(pb.date)}${pb.name ? ' · ' + esc(pb.name) : ''}</span></div>
      <div class="metrics">
        <div class="metric"><span>${T('Verbesserung', 'Improvement')}</span><b>${gain > 0 ? '−' + hms(gain) : '–'}</b><small>${gain > 0 ? T(`seit ${dateGerman(first.date)}`, `since ${dateGerman(first.date)}`) : T('erste Bestzeit', 'first best time')}</small></div>
        <div class="metric"><span>${T('Bestzeiten', 'Best times')}</span><b>${steps.length}</b><small>${T('neue Bestwerte', 'new bests')}</small></div>
        <div class="metric"><span>${T('Ergebnisse', 'Results')}</span><b>${list.length}</b><small>${T('gesamt', 'total')}</small></div>
      </div>
      <div style="margin-top:10px" id="bestchart">${bestChart(list)}</div>
      <p class="tiny">${T('Punkte: alle Ergebnisse, kräftig = neue Bestzeit. Linie: Verlauf deiner Bestzeit.', 'Dots: all results, solid = new best time. Line: history of your best time.')}</p>
    </div></div>
    <div class="header">${T('Prognose aus dieser Bestzeit', 'Prediction from this best time')}</div><div class="group"><div class="splits" style="padding:12px 16px" id="bestpred">${Object.entries(SEASON.dist).filter(([k]) => k !== g).map(([k, d]) => `<span><small>${esc(d.label)}</small>${hms(riegel(pb.time, km, d.km))}</span>`).join('')}</div></div>
    <div class="group" style="margin-top:12px"><details id="bestcalc"><summary class="row"><span class="txt"><b>${T('So wird gerechnet', 'How it is calculated')}</b><small>${T('Riegel-Formel mit deiner Bestzeit', 'Riegel formula with your best time')}</small></span><span class="chev"></span></summary><div class="panel">
      <p class="tiny">${T('Zeit₂ = Zeit₁ × (Distanz₂ ÷ Distanz₁)<sup>1,06</sup>', 'time₂ = time₁ × (distance₂ ÷ distance₁)<sup>1.06</sup>')}</p>
      <ul class="notes">${Object.entries(SEASON.dist).filter(([k]) => k !== g).map(([k, d]) => `<li>${esc(d.label)}: ${hms(pb.time)} × (${kmText(Math.round(d.km * 10000) / 10000)} ÷ ${kmText(km)})<sup>1,06</sup> = ${hms(pb.time)} × ${kmText(Math.round(Math.pow(d.km / km, 1.06) * 1000) / 1000)} ≈ <b>${hms(riegel(pb.time, km, d.km))}</b> (${paceText(riegel(pb.time, km, d.km), d.km)})</li>`).join('')}</ul>
      <p class="tiny">${T('Für längere Distanzen meist zu optimistisch, wenn der Umfang dafür noch fehlt – beim Marathon eher 5–10 % Puffer. Mehr unter <b>Plan → Wissen → Zeiten &amp; Prognosen</b>.', 'Usually too optimistic for longer distances if the volume is still missing – for the marathon better 5–10 % buffer. More under <b>Plan → Knowledge → Times &amp; predictions</b>.')}</p>
    </div></details></div>
    <div class="header">${T('Ergebnisse', 'Results')} · ${esc(groupLabel(g))}</div><div class="group" id="bestlist">${list.slice().reverse().map(r => `<div class="row"><span class="dur">${dateGerman(r.date)}</span><span class="txt"><b>${hms(r.time)}${isPb.has(r.id) ? ' 🏆' : ''}</b><small>${paceText(r.time, r.km)}${r.name ? ' · ' + esc(r.name) : ''}</small></span><button type="button" class="btn small danger" data-bestdel="${esc(r.id)}" aria-label="${T(`Ergebnis vom ${dateGerman(r.date)} löschen`, `Delete result of ${dateGerman(r.date)}`)}">${T('Löschen', 'Delete')}</button></div>`).join('')}</div>`;
  return html;
}
function saveBestFromForm() {
  const date = $('bestdate').value, sel = $('bestdist').value, time = readTime('besttime'), name = $('bestname').value.trim().slice(0, 60);
  $('bestkm').removeAttribute('aria-invalid'); markTime('besttime', false);
  if (!isDay(date) || date > localDay()) { toast(T('Bitte ein Datum bis heute wählen.', 'Please choose a date up to today.')); return; }
  const km = sel === 'custom' ? kmNum($('bestkm').value) : SEASON.dist[sel].km;
  if (sel === 'custom' && (km === null || Number.isNaN(km) || km < 0.4 || km > 100)) { $('bestkm').setAttribute('aria-invalid', 'true'); toast(T('Bitte die Distanz in km eingeben.', 'Please enter the distance in km.')); return; }
  if (time === null || Number.isNaN(time)) { markTime('besttime', true); toast(T('Bitte die Zeit eintragen (Minuten und Sekunden höchstens 59).', 'Please enter the time (minutes and seconds at most 59).')); return; }
  const r = { id: uid(), date, km, time, dist: sel === 'custom' ? null : sel };
  if (name) r.name = name;
  const from = $('bestfrom') && $('bestfrom').value; if (from) r.race = from;
  storeResult(r); renderRun();
}
// Ergebnis speichern (Bestzeiten oder Startseite): neue Bestzeit erkennen, Ansicht auf die Distanz stellen
function storeResult(r) {
  const g = resultGroup(r), before = results.filter(x => resultGroup(x) === g), wasPb = before.length && before.every(x => r.time < x.time);
  results.push(r); persistResults(); const after = raceVolNote(r.date); bestView.group = wflResult(r) ? 'wfl' : g; store(KEYS.bestview, bestView);
  if (wflResult(r)) { toast(T(`✓ ${r.name}: ${kmText(r.km)} km gespeichert (${hms(r.time)})`, `✓ ${r.name}: ${kmText(r.km)} km saved (${hms(r.time)})`) + after); return; }
  toast((wasPb ? T(`🏆 Neue Bestzeit über ${groupLabel(g)}: ${hms(r.time)} (−${hms(Math.min(...before.map(x => x.time)) - r.time)})`, `🏆 New best time over ${groupLabel(g)}: ${hms(r.time)} (−${hms(Math.min(...before.map(x => x.time)) - r.time)})`) : T(`✓ ${hms(r.time)} über ${groupLabel(g)} gespeichert`, `✓ ${hms(r.time)} over ${groupLabel(g)} saved`)) + after);
}
function bestPrefill(id) {
  const r = races.find(x => x.id === id); if (!r) return;
  $('bestname').value = r.name; $('bestdate').value = r.date;
  $('bestdist').value = r.km ? 'custom' : r.dist; $('bestkmfield').classList.toggle('hide', !r.km); $('bestkm').value = r.km ? kmText(r.km) : '';
  const f = $('besttime').querySelector('[data-tpart="0"]'); if (f) f.focus();
}

/* ---------- Startseite „Heute“: beim Öffnen der App, ohne untere Leiste ----------
   Oben, was heute dran ist (mit Start), darunter die Woche und je Bereich eine Kachel mit dem aktuellen Stand. */
// Mobility: bis zum Ende geführte Routinen zählen für die Woche (nur Datum und Titel)
const normMobLog = v => Array.isArray(v) ? v.filter(e => isObj(e) && isDay(e.d) && typeof e.t === 'string').map(e => ({ d: e.d, t: e.t.slice(0, 60) })).slice(-120) : [];
const getMobLog = () => normMobLog(load(KEYS.moblog, []));
const putMobLog = v => store(KEYS.moblog, normMobLog(v));
// Kurs-/Gym-Tage abhaken (z. B. Blaze): Tag + Name, zählt in der Woche als Kraft-Einheit
const normGymLog = v => Array.isArray(v) ? v.filter(e => isObj(e) && isDay(e.d) && typeof e.n === 'string').map(e => ({ d: e.d, n: e.n.slice(0, 30) })).slice(-200) : [];
const getGymLog = () => normGymLog(load(KEYS.gymlog, []));
const putGymLog = v => store(KEYS.gymlog, normGymLog(v));
const gymDone = d => getGymLog().some(e => e.d === d);
function logMobility(title) { putMobLog(getMobLog().concat({ d: localDay(), t: String(title) })); if (area === 'start') renderStart(); }
const daysAgo = d => { const n = Math.round((new Date(localDay() + 'T12:00:00') - new Date(d + 'T12:00:00')) / 864e5); return n <= 0 ? T('heute', 'today') : n === 1 ? T('gestern', 'yesterday') : T(`vor ${n} Tagen`, `${n} days ago`); };
const daysTo = d => Math.round((new Date(d + 'T12:00:00') - new Date(localDay() + 'T12:00:00')) / 864e5);
const START_ICON = {
  kraft: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  laufen: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2v5M11 15l1.5-5L9 11 7 14M12.5 10l3 2.5 3-1"/>',
  mobility: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 9l7 1.5L19 9M12 10.5V15l-4 6M12 15l4 6"/>',
  profil: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c1.2-4 4.1-6 7.5-6s6.3 2 7.5 6"/>',
  mehr: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/>'
};
const startIcon = (k, cls = '') => `<span class="sicon si-${k}${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${START_ICON[k]}</svg></span>`;
// Was heute dran ist: aus dem Saisonplan (mit Abhaken/Verschieben), sonst aus den Tagen im Profil; dazu der Lauf-Einstieg
function todayItems() {
  const today = localDay(), wd = new Date(today + 'T12:00:00').getDay(), w = profile.week, out = [];
  const kraft = (pk = plan) => { const ex = exList(pk); return { kind: 'strength', title: `${T('Kraft', 'Strength')} · ${tr(PLANS[pk].tab)}`, detail: `${ex.length} ${T("Übungen", "exercises")} · ${Math.round(phaseSecs(pk, 1) / 60)} ${T("Min.", "min")}`, act: 'kraft', plan: pk, need: planNeeds(pk) }; };
  // Mobility-Tag: Routine des Tages
  const mobItem = () => { if (!mod('mobility') || !w.mobility.includes(wd)) return null; const r = mobRoutineOn(wd); return { kind: 'mobility', title: `Mobility · ${tr(r.title)}`, detail: tr(r.time), act: 'mob', mob: MOBILITY.routines.indexOf(r), done: getMobLog().some(e => e.d === today) }; };
  if (runnerLevel() === 'beginner' || !mod('laufen')) {
    const s = getStarter(), doneToday = s.log.some(x => x.d === today);
    if (mod('laufen') && (doneToday || s.done < STARTER_N)) out.push({ kind: 'starter', title: T(`Lauf-Einstieg · Woche ${s.week + 1}`, `Running starter · week ${s.week + 1}`), detail: starterSummary(s.week), act: 'starter', done: doneToday });
    const mi = mobItem(); if (mi) out.push(mi);
    if (strengthDays().includes(wd)) out.push(gymOn(wd) ? { kind: 'strength', gym: gymOn(wd), title: `${T('Kurs', 'Class')} · ${gymOn(wd)}`, detail: T('im Studio', 'at the gym'), act: 'gym', done: gymDone(today) } : kraft(dayPlan(wd) || plan));
    return out;
  }
  const S = seasonPlan(), x = S.weeks[0];
  const items = x ? weekSchedule(x).filter(o => o.d === wd && !o.skip) : [
    w.quality === wd && { kind: 'quality', key: 'quality', title: T('Qualität', 'Quality'), detail: T('Intervall oder Tempo', 'Intervals or tempo') },
    w.long === wd && { kind: 'long', key: 'long', title: T('Longrun', 'Long run'), detail: hrize(T('locker, Zone 2', 'easy, Zone 2')) },
    w.group === wd && { kind: 'group', key: 'group', title: T('Laufgruppe', 'Running group'), detail: hrize(T('locker, Zone 2', 'easy, Zone 2')) },
    strengthDays().includes(wd) && { kind: 'strength', plan: dayPlan(wd), base: '', sameDay: [w.quality, w.long].includes(wd) ? 'hard' : w.group === wd ? 'easy' : null },
    ...w.extras.map((e, i) => ({ e, i })).filter(({ e }) => e.d === wd).map(({ e, i }) => ({ kind: extraKind(e), key: 'x' + i, recovery: e.type === 'recovery', title: extraTitle(e), detail: e.type === 'easy' ? hrize(T('locker, Zone 2', 'easy, Zone 2')) : e.type === 'recovery' ? recoveryDetail() : e.type === 'quality' ? T('Intervall oder Tempo', 'Intervals or tempo') : '' }))].filter(Boolean);
  // Kraft am Lauftag: der Hinweis steht kurz in einer eigenen Zeile (im Wochenplan ausführlicher)
  const tip = it => !it.sameDay ? '' : it.base && /Beinübungen|leg exercises/.test(it.base) ? T('Nach dem Lauf', 'After the run') : it.sameDay === 'hard' ? T('Nach dem Lauf, ohne schwere Beinübungen', 'After the run, no heavy leg exercises') : T('Nach dem Lauf oder mit ein paar Stunden Abstand', 'After the run or a few hours apart');
  // ein heute eingetragener Lauf hakt den geplanten Lauf ab (auch ohne Saisonplan)
  const ranToday = ranOn(today);
  const gymItem = it => ({ kind: 'strength', gym: gymOn(wd), key: it.key || 'strength-' + wd, title: `${T('Kurs', 'Class')} · ${gymOn(wd)}`, detail: it.sameDay ? it.base : it.detail || T('im Studio', 'at the gym'), act: 'gym', done: it.done || gymDone(today), tip: tip(it) });
  for (const it of items) out.push(it.kind === 'strength' && gymOn(wd) ? gymItem(it) : it.kind === 'strength' ? Object.assign(kraft(it.plan || plan), { done: it.done, note: it.sameDay ? it.base : it.detail, tip: tip(it) }) : Object.assign({}, it, { act: RUN(it) ? 'plan' : null, done: it.done || (RUN(it) && ranToday) }));
  const mi = mobItem(); if (mi) out.push(mi);
  return out;
}
/* Jahresziel: gelaufene km im Jahr (einzelne Läufe und Rennen nach Datum, Wochensummen nach dem Donnerstag ihrer Woche),
   Soll bis heute linear, Hochrechnung aus dem bisherigen Schnitt. Vorschlag: Vorjahr (bei Lücken aus den Wochen mit Einträgen
   hochgerechnet) + 5 %, höchstens + 10 %; plant der Saisonplan für die A-Rennen mehr, gilt der höhere Wert. */
function yearKm(y) {
  const runs = allRuns().filter(r => r.date.startsWith(y + '-')), runWk = new Set(runLog.map(r => weekStart(r.date)));
  const sums = runWeeks.filter(e => !runWk.has(e.week) && addDays(e.week, 3).startsWith(y + '-') && typeof e.km === 'number');
  const weeks = new Set(runs.map(r => weekStart(r.date)).concat(sums.map(e => e.week)));
  return { km: rd1(runs.reduce((a, r) => a + r.km, 0) + sums.reduce((a, e) => a + e.km, 0)), weeks: weeks.size };
}
const yearDays = y => (new Date(`${Number(y) + 1}-01-01T12:00:00`) - new Date(`${y}-01-01T12:00:00`)) / 864e5;
function yearSuggest(y) {
  const prev = yearKm(Number(y) - 1), r50 = v => Math.max(50, Math.round(v / 50) * 50);
  const base = prev.weeks >= 8 ? (prev.weeks < 50 ? prev.km / prev.weeks * 52 : prev.km) : null;
  const S = seasonPlan(), today = localDay(), done = yearKm(y).km;
  const planned = S.weeks.filter(x => x.week >= weekStart(today) && addDays(x.week, 3).startsWith(y + '-') && typeof x.km === 'number');
  const rest = Math.max(0, Math.round((new Date(`${Number(y) + 1}-01-01T12:00:00`) - new Date(today + 'T12:00:00')) / 6048e5) - planned.length);
  const avg = loadFor(weekStart(today)).avg || 0, plan = planned.length ? done + planned.reduce((a, x) => a + x.km, 0) + rest * avg : null;
  if (base === null && plan === null) return avg ? { km: r50(avg * 52), why: T('aus deinem Schnitt der letzten 4 Wochen', 'from your average of the last 4 weeks') } : null;
  const up = base === null ? null : Math.min(base * 1.05, base * 1.1);
  if (plan !== null && (up === null || plan > up)) return { km: r50(plan), why: T('aus dem Saisonplan für deine Rennen', 'from the season plan for your races') };
  return { km: r50(up), why: prev.weeks < 50 ? T(`Vorjahr ${kmText(prev.km)} km, hochgerechnet aus ${prev.weeks} Wochen, + 5 %`, `last year ${kmText(prev.km)} km, projected from ${prev.weeks} weeks, + 5 %`) : T(`Vorjahr ${kmText(prev.km)} km + 5 %`, `last year ${kmText(prev.km)} km + 5 %`) };
}
/* Wochenleiste Mo–So: Punkt gefüllt = trainiert (Lauf, Kraft, Kurs, Mobility), Ring = geplant, gedämpft = geplant und vorbei ohne Eintrag */
function weekStrip() {
  const today = localDay(), wk = weekStart(today), w = profile.week, x = runnerLevel() === 'beginner' ? null : seasonPlan().weeks[0];
  const items = x ? weekSchedule(x).filter(o => !o.skip) : null, mob = getMobLog();
  const planned = wd => (mod('mobility') && w.mobility.includes(wd)) || (items ? items.some(o => o.d === wd && (RUN(o) ? mod('laufen') : o.kind !== 'strength' || mod('kraft'))) : strengthDays().includes(wd) || (mod('laufen') && ([w.quality, w.long, w.group].includes(wd) || w.extras.some(e => e.d === wd))));
  return `<div class="sstrip" role="list" aria-label="${T('Woche', 'Week')}">${[0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = addDays(wk, i), wd = new Date(d + 'T12:00:00').getDay(), done = d <= today && (ranOn(d) || saved.some(e => e.date === d) || gymDone(d) || mob.some(e => e.d === d)), pl = planned(wd);
    const cls = done ? 'done' : pl ? (d < today ? 'miss' : 'plan') : 'rest', st = done ? T('trainiert', 'trained') : pl ? (d < today ? T('geplant, nichts eingetragen', 'planned, nothing logged') : T('geplant', 'planned')) : T('frei', 'rest');
    return `<button type="button" class="sday ${cls}${d === today ? ' today' : ''}${d === stripDay ? ' sel' : ''}" data-stripday="${d}" aria-pressed="${d === stripDay}" aria-label="${esc(`${WD_LONG[wd]} ${dateGerman(d)}: ${st}`)}"><small>${WD[wd]}</small><b>${Number(d.slice(8))}</b><i></i></button>`;
  }).join('')}</div>${stripDay ? stripInfo(stripDay) : ''}`;
}
// Angetippter Tag: was geplant war bzw. ist, was erledigt ist – und bei einem offenen Lauf „Eintragen“ für genau diesen Tag
let stripDay = null, logPick = null;
function stripInfo(d) {
  const today = localDay(), wd = new Date(d + 'T12:00:00').getDay(), runs = mod('laufen') ? plannedRunsOn(d) : [], ran = ranOn(d), rows = [];
  if (mod('mobility') && profile.week.mobility.includes(wd)) { const done = getMobLog().some(e => e.d === d); rows.push(`<li>${esc('Mobility · ' + tr(mobRoutineOn(wd).title))}${done ? ' <span class="chkok">✓</span>' : ''}</li>`); }
  if (strengthDays().includes(wd)) { const done = saved.some(e => e.date === d) || gymDone(d); rows.push(`<li>${esc(strengthTitle(wd))}${done ? ' <span class="chkok">✓</span>' : ''}</li>`); }
  for (const it of runs) rows.push(`<li>${esc(it.title)}${ran ? ' <span class="chkok">✓</span>' : d <= today ? ` <button type="button" class="btn small primary" data-logpick="${d}|${esc(it.key)}">${T('Eintragen', 'Log')}</button>` : ''}</li>`);
  if (ran && !runs.length) rows.push(`<li>${T('Lauf', 'Run')} <span class="chkok">✓</span></li>`);
  return `<div class="sstripinfo"><b>${esc(dayLabel(d))}</b>${rows.length ? `<ul>${rows.join('')}</ul>` : `<p>${T('Nichts geplant – Ruhetag.', 'Nothing planned – rest day.')}</p>`}</div>`;
}
let yearEdit = false;
function yearCard() {
  if (runnerLevel() === 'beginner' || !mod('laufen')) return '';
  const today = localDay(), y = today.slice(0, 4), goal = profile.yearKm[y], cur = yearKm(y), sug = goal && !yearEdit ? null : yearSuggest(y);
  if (!goal && !sug && !cur.km) return '';
  const form = `<div class="syear"><input type="text" inputmode="numeric" id="yeargoal" maxlength="5" autocomplete="off" value="${goal || (sug ? sug.km : '')}" aria-label="${T(`Jahresziel ${y} in km`, `Year goal ${y} in km`)}"><span>km</span><button type="button" class="btn small primary" id="yearsave">${T('Übernehmen', 'Apply')}</button></div>${sug ? `<small class="tiny">${T('Vorschlag', 'Suggestion')}: ${esc(kmText(sug.km))} km – ${esc(sug.why)}</small>` : ''}`;
  if (!goal || yearEdit) return `<div class="scard" id="yearcard"><p class="skicker">${T(`Jahresziel ${y}`, `Year goal ${y}`)}</p><p class="sline">${T(`Wie viele km willst du ${y} laufen?`, `How many km do you want to run in ${y}?`)}${cur.km ? T(` Bisher ${kmText(cur.km)} km.`, ` So far ${kmText(cur.km)} km.`) : ''}</p>${form}</div>`;
  const day = Math.round((new Date(today + 'T12:00:00') - new Date(`${y}-01-01T12:00:00`)) / 864e5) + 1, n = yearDays(y);
  const soll = Math.round(goal * day / n), proj = day >= 14 ? Math.round(cur.km / day * n) : null, ahead = Math.round(cur.km - soll);
  const pct = Math.min(100, Math.round(cur.km / goal * 100)), sp = Math.min(100, Math.round(soll / goal * 100));
  return `<div class="scard" id="yearcard"><p class="skicker">${T(`Jahresziel ${y}`, `Year goal ${y}`)}<button type="button" class="slink" id="yearedit">${T('Ändern', 'Change')}</button></p>
    <p class="syearnum"><b>${esc(kmText(Math.round(cur.km)))}</b> ${T('von', 'of')} ${esc(kmText(goal))} km</p>
    <div class="ybar" role="img" aria-label="${esc(T(`${pct} % geschafft, Soll bis heute ${sp} %`, `${pct} % done, target to date ${sp} %`))}"><span class="yfill" style="width:${pct}%"></span><span class="ysoll" style="left:${sp}%"></span></div>
    <small class="tiny">${T(`Soll bis heute ${kmText(soll)} km`, `Target to date ${kmText(soll)} km`)} · <span class="${ahead >= 0 ? 'chkok' : 'chkwarn'}">${ahead >= 0 ? T(`${kmText(ahead)} km voraus`, `${kmText(ahead)} km ahead`) : T(`${kmText(-ahead)} km zurück`, `${kmText(-ahead)} km behind`)}</span>${proj ? T(` · Hochrechnung ca. ${kmText(proj)} km`, ` · projection about ${kmText(proj)} km`) : ''}</small></div>`;
}
/* Startseite: nach einem A- oder B-Rennen nach dem Ergebnis fragen – ab dem Tag danach, bis es eingetragen ist –, damit es nicht vergessen wird.
   Normal: Zeit → Bestzeiten. Wings for Life: geschaffte km, die Zeit ist die des Catcher Cars. Pace Race: Level – nur beim Rennen,
   nicht unter Bestzeiten (Pausen). „Nicht gelaufen“ merkt sich das Rennen, dann fragt die App nicht mehr. */
const raceResult = r => results.find(e => e.race === r.id) || (r.fmt ? null : results.find(e => e.date === r.date && Math.abs((e.km || 0) - raceKm(r)) < 0.5)) || null;
const raceAnswered = r => !!r.dns || (r.fmt === 'pace' ? r.level !== undefined : !!raceResult(r));
const levelText = v => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(v);
function pendingResults() {
  const today = localDay(); if (!mod('laufen')) return [];
  return races.filter(r => r.date < today && !raceAnswered(r)).sort((a, b) => a.date.localeCompare(b.date));
}
// Mehrere offene Einträge: der erste behält die festen IDs, die weiteren bekommen eine Nummer
const sfx = i => i ? '-' + i : '';
function resultCard(r, i = 0) {
  const s = sfx(i);
  const field = r.fmt === 'wfl' ? `<label for="sreskm${s}">${T('Geschafft bis km', 'Reached km')}</label><input id="sreskm${s}" data-wflkm="${s}" type="text" inputmode="decimal" autocomplete="off" placeholder="${T('z. B. 18,4', 'e.g. 18.4')}"><small class="tiny" id="sresinfo${s}">${T('Die Zeit rechnet die App aus dem Catcher Car.', 'The app takes the time from the Catcher Car.')}</small>`
    : r.fmt === 'pace' ? `<label for="sreslevel${s}">${T('Geschafftes Level', 'Level reached')}</label><input id="sreslevel${s}" type="text" inputmode="decimal" autocomplete="off" placeholder="${T('z. B. 11,753', 'e.g. 11.753')}">`
    : `<label>${T('Deine Zeit', 'Your time')}</label>${timeFields('srestime' + s, null, T('Zeit', 'Time'))}`;
  return `<div class="scard sres" id="startresult${s}"><p class="skicker">${T('Ergebnis eintragen', 'Enter result')} · <b class="sago">${agoText(r.date)}</b></p>
    <div class="srowt">${startIcon('laufen')}<span class="txt"><b>${T(`Wie lief ${esc(r.name)}?`, `How did ${esc(r.name)} go?`)}</b><small>${esc(dateGerman(r.date) + ' · ' + raceLabel(r))}</small></span></div>
    <div class="sresin">${field}</div>
    <div class="sresact"><button type="button" class="btn small" data-resdns="${esc(r.id)}">${T('Nicht gelaufen', 'Did not run')}</button><button type="button" class="btn small primary" data-ressave="${esc(r.id)}" data-i="${i}">${T('Speichern', 'Save')}</button></div></div>`;
}
// Hinweis im Toast, ob das Rennen in die Wochen-km zählt (siehe raceRuns)
const raceVolNote = date => { const x = raceRuns().find(r => r.date === date); return x ? T(` – ${kmText(x.km)} km im Umfang.`, ` – ${kmText(x.km)} km in volume.`) : '.'; };
function saveStartResult(id, i = 0) {
  const r = races.find(x => x.id === id), s = sfx(i); if (!r) return;
  if (r.fmt === 'pace') {
    const t = String($('sreslevel' + s).value).trim().replace(',', '.'), v = t === '' ? NaN : Number(t);
    if (!(Number.isFinite(v) && v > 0 && v <= PACE_RACE.levels)) { $('sreslevel' + s).setAttribute('aria-invalid', 'true'); toast(T(`Bitte das Level eintragen (bis ${PACE_RACE.levels}), z. B. 11,753.`, `Please enter the level (up to ${PACE_RACE.levels}), e.g. 11.753.`)); return; }
    r.level = Math.round(v * 1000) / 1000; persistRaces(); bestView.group = 'pace'; store(KEYS.bestview, bestView); renderStart();
    toast(T(`✓ ${r.name}: Level ${levelText(r.level)} gespeichert`, `✓ ${r.name}: level ${levelText(r.level)} saved`) + raceVolNote(r.date)); return;
  }
  let km = raceKm(r), time;
  if (r.fmt === 'wfl') {
    km = kmNum($('sreskm' + s).value);
    if (km === null || Number.isNaN(km) || km < 1 || km > 100) { $('sreskm' + s).setAttribute('aria-invalid', 'true'); toast(T('Bitte die geschafften km eintragen, z. B. 18,4.', 'Please enter the km you reached, e.g. 18.4.')); return; }
    time = Math.round(carTime(km));
  } else {
    time = readTime('srestime' + s);
    if (time === null || Number.isNaN(time)) { markTime('srestime' + s, true); toast(T('Bitte die Zeit eintragen (Minuten und Sekunden höchstens 59).', 'Please enter the time (minutes and seconds at most 59).')); return; }
  }
  storeResult({ id: uid(), date: r.date, km, time, dist: r.km || r.fmt ? null : r.dist, name: r.name, race: r.id });
  renderStart();
}
/* Startseite: ab dem Tag nach einem geplanten Lauf nach den km fragen, bis er eingetragen ist, damit die Wochen-km stimmen.
   Erledigt, sobald an dem Tag ein Lauf (oder ein Rennen) eingetragen ist, die Woche eine eigene Wochensumme hat oder die Einheit „entfällt“.
   Damit nicht jedes Mal die ganze Vergangenheit geprüft wird, merkt sich die App den ersten noch offenen Tag. */
const RUN_ASK_DAYS = 7, RUN_KINDS = ['quality', 'quality2', 'long', 'group', 'easy'];
function plannedRunsOn(day, cache = {}) {
  const w = profile.week, wd = new Date(day + 'T12:00:00').getDay(), wk = weekStart(day), skip = weekSkip[wk] || [];
  if (!(wk in cache)) { const S = seasonPlan(wk === weekStart(localDay()) ? localDay() : wk); cache[wk] = S.weeks[0] && S.weeks[0].week === wk ? weekSchedule(S.weeks[0]) : null; }
  const items = cache[wk] ? cache[wk].filter(o => o.d === wd && RUN_KINDS.includes(o.kind))
    : [w.quality === wd && { kind: 'quality', key: 'quality', title: T('Qualität', 'Quality'), detail: '' }, w.long === wd && { kind: 'long', key: 'long', title: T('Longrun', 'Long run'), detail: '' },
      w.group === wd && { kind: 'group', key: 'group', title: T('Laufgruppe', 'Running group'), detail: '' },
      ...w.extras.map((e, i) => ({ e, i })).filter(({ e }) => e.d === wd && e.type !== 'other').map(({ e, i }) => ({ kind: extraKind(e), key: 'x' + i, title: extraTitle(e), detail: '', recovery: e.type === 'recovery' }))].filter(Boolean);
  return items.filter(o => !o.skip && !skip.includes(o.key));
}
// Ohne gemerkten Tag (neues Gerät, erste Nutzung) wird eine Woche zurück gefragt
function pendingRuns() {
  if (runnerLevel() === 'beginner' || !mod('laufen')) return [];
  const today = localDay(), cache = {}, out = [], done = new Set(allRuns().map(r => r.date));
  let from = load(KEYS.runask, null); if (!isDay(from) || from > today) from = addDays(today, -RUN_ASK_DAYS);
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (done.has(d) || manualKm(weekStart(d)) !== null) continue;
    const it = plannedRunsOn(d, cache)[0]; if (it) out.push({ day: d, item: it });
  }
  const next = out.length ? out[0].day : today; if (next !== from) store(KEYS.runask, next);
  return out;
}
// Art der geplanten Einheit für die Auswertung: locker (Zone 2), Regeneration (Zone 1), Longrun, Laufgruppe oder Qualität (ohne Wertung)
const runKindOf = it => it.recovery ? 'recovery' : it.kind === 'quality' || it.kind === 'quality2' ? (it.easy ? 'easy' : 'quality') : it.kind;
// „heute“, „gestern“, „vor 3 Tagen“ – damit klar ist, für welchen Tag die Karte fragt
const agoText = d => { const n = Math.round((new Date(localDay() + 'T12:00:00') - new Date(d + 'T12:00:00')) / 864e5); return n <= 0 ? T('heute', 'today') : n === 1 ? T('gestern', 'yesterday') : T(`vor ${n} Tagen`, `${n} days ago`); };
function runSuggest(p) {
  if (p.item.km) return { km: p.item.km, why: T('wie geplant', 'as planned') };
  const k = runKindOf(p.item), last = runLog.filter(r => r.kind === k && r.date < p.day).at(-1);
  return last ? { km: last.km, why: T('wie letztes Mal', 'like last time') } : null;
}
function runCard(p, i = 0) {
  const it = p.item, s = sfx(i), today = p.day === localDay(), when = dayLabel(p.day), ref = `${p.day}|${it.key}`;
  return `<div class="scard sres" id="startrun${s}"><p class="skicker">${today ? T('Lauf eintragen · heute', 'Log run · today') : `${T('Lauf nachtragen', 'Log run')} · <b class="sago">${agoText(p.day)}</b>`}</p>
    <div class="srowt">${startIcon('laufen')}<span class="txt"><b>${esc(`${when} · ${it.title}`)}</b>${it.detail ? `<small>${esc(it.detail)}</small>` : ''}</span></div>
    <div class="sresin"><div class="sres2"><span><label for="srunkm${s}">${T('Gelaufen (km)', 'Ran (km)')}</label><input id="srunkm${s}" type="text" inputmode="decimal" autocomplete="off" placeholder="${T('z. B. 8,5', 'e.g. 8.5')}"></span>
      <span><label for="srunhr${s}">${T('Ø Puls (optional)', 'Avg HR (optional)')}</label><input id="srunhr${s}" type="text" inputmode="numeric" autocomplete="off" maxlength="3" placeholder="${T('z. B. 142', 'e.g. 142')}"></span></div>
      <label>${T('Zeit (optional)', 'Time (optional)')}</label>${timeFields('sruntime' + s, null, T('Zeit', 'Time'))}</div>
    ${(sg => sg ? `<button type="button" class="btn primary squick" data-runquick="${esc(kmText(sg.km))}">✓ ${esc(kmText(sg.km))} km · ${esc(sg.why)}</button>` : '')(runSuggest(p))}
    <div class="sresact">${today || i === 91 ? `<button type="button" class="btn small" data-logcancel>${T('Abbrechen', 'Cancel')}</button>` : `<button type="button" class="btn small" data-runskip="${esc(ref)}">${T('Nicht gelaufen', 'Did not run')}</button>`}<button type="button" class="btn small${runSuggest(p) ? '' : ' primary'}" data-runsave="${esc(ref)}" data-i="${i}" data-kind="${runKindOf(it)}" data-title="${esc(`${when} · ${it.title}`)}">${T('Speichern', 'Save')}</button></div></div>`;
}
/* Auswertung eines Laufs gegen den Zielbereich der Einheit: lockere Läufe nach Puls (Zone 2, Regeneration Zone 1) und Tempo.
   Langsamer bzw. niedriger ist bei lockeren Läufen kein Fehler. Intervall/Tempo: keine Wertung – der Schnitt mischt schnelle Abschnitte, Pausen und Ein-/Auslaufen. */
const RUN_ZONE = { easy: 2, long: 2, group: 2, recovery: 1 };
function runCheck(r) {
  const zone = RUN_ZONE[r.kind] || null, z = profile.hr.z, tp = trainingPaces(), pace = r.sec ? r.sec / r.km : null, out = { zone, pace, hr: r.hr || null, p: null, h: null };
  if (!zone) return out;
  if (pace && tp) out.p = { lo: tp.easy[0], hi: tp.easy[1], st: pace < tp.easy[0] - 5 ? 'fast' : pace > tp.easy[1] ? 'slow' : 'ok' };
  if (r.hr && z) out.h = { lo: z[zone - 1], hi: z[zone] - 1, st: r.hr > z[zone] + 1 ? 'high' : r.hr < z[zone - 1] ? 'low' : 'ok' };
  return out;
}
function runVerdict(c) {
  if (!c.zone) return { ok: null, short: '', text: c.pace || c.hr ? T('Bei Intervall- und Tempoeinheiten sagt der Durchschnitt wenig – entscheidend sind die schnellen Abschnitte.', 'For interval and tempo sessions the average says little – what counts are the fast parts.') : '' };
  const zn = `Zone ${c.zone}`, H = c.h && c.h.st === 'high', P = c.p && c.p.st === 'fast';
  if (!c.p && !c.h) return { ok: null, short: '', text: c.hr && !profile.hr.z ? T('Für die Puls-Auswertung unter Profil → Herzfrequenz deine max. HF eintragen.', 'For the heart rate check enter your max HR under Profile → Heart rate.') : c.pace ? T('Für die Tempo-Auswertung unter Bestzeiten ein Ergebnis eintragen.', 'For the pace check enter a result under Best times.') : '' };
  if (H && P) return { ok: false, short: T('Puls und Tempo zu hoch', 'HR and pace too high'), text: T('Puls und Tempo lagen über dem lockeren Bereich – beim nächsten Mal langsamer starten und mehr auf den Puls achten.', 'Heart rate and pace were above the easy range – next time start slower and watch your heart rate more.') };
  if (H) return { ok: false, short: T(`Puls über ${zn}`, `HR above ${zn}`), text: c.p ? T(`Das Tempo passte, der Puls lag trotzdem über ${zn} – Hitze, Hügel oder Müdigkeit? Beim nächsten Mal mehr auf den Puls achten und dafür langsamer laufen.`, `The pace was fine, but your heart rate was above ${zn} – heat, hills or fatigue? Next time watch your heart rate more and run slower for it.`) : T(`Puls über ${zn} – beim nächsten Mal mehr auf den Puls achten und etwas ruhiger laufen.`, `Heart rate above ${zn} – next time watch your heart rate more and run a bit easier.`) };
  if (P && c.h) return { ok: true, short: T('✓ Puls im Bereich', '✓ HR in range'), text: T('Puls im Bereich, das Tempo war schneller als geplant – passt. Ist das öfter so, unter Bestzeiten ein neues Ergebnis eintragen, dann werden deine Tempos schneller.', 'Heart rate in range, the pace was faster than planned – fine. If that happens often, enter a new result under Best times so your paces get faster.') };
  if (P) return { ok: false, short: T('schneller als locker', 'faster than easy'), text: T('Schneller als das lockere Tempo – beim nächsten Mal mehr auf die Zeit achten. Mit Ø-Puls sieht die App auch, ob es trotzdem locker war.', 'Faster than the easy pace – next time watch the time more. With the average heart rate the app also sees whether it was still easy.') };
  return { ok: true, short: T('✓ im Bereich', '✓ in range'), text: T('Super – alles im empfohlenen Bereich.', 'Great – everything in the recommended range.') };
}
// Balken: Zielbereich in der Mitte, Markierung für deinen Wert. Tempo: rechts schneller (zu schnell = orange), Puls: rechts höher
function checkBar(v, lo, hi, fmt, pace, label) {
  const W = 320, l = 6, r = 6, y0 = 22, h = 12, span = Math.max(hi - lo, 4), a = Math.min(lo - span, v - span * 0.2), b = Math.max(hi + span, v + span * 0.2);
  const x = t => { const f = (Math.min(Math.max(t, a), b) - a) / (b - a); return l + (pace ? 1 - f : f) * (W - l - r); };
  const seg = (p, q, cls) => { const x1 = Math.min(x(p), x(q)), x2 = Math.max(x(p), x(q)); return `<rect class="${cls}" x="${x1}" y="${y0}" width="${x2 - x1}" height="${h}"/>`; };
  const mx = x(v), anchor = mx < 40 ? 'start' : mx > W - 40 ? 'end' : 'middle', tick = t => `<text class="lbl" x="${x(t)}" y="${y0 + h + 15}" text-anchor="middle" font-size="11.5">${fmt(t)}</text>`;
  return `<svg class="chart chk" viewBox="0 0 ${W} 54" role="img" aria-label="${esc(`${label}: ${fmt(v)}, ${T('Zielbereich', 'target range')} ${fmt(pace ? hi : lo)}–${fmt(pace ? lo : hi)}`)}">
    <clipPath id="chk${label.length}${Math.round(v)}"><rect x="${l}" y="${y0}" width="${W - l - r}" height="${h}" rx="6"/></clipPath>
    <g clip-path="url(#chk${label.length}${Math.round(v)})">${seg(a, lo, pace ? 'zover' : 'zlow')}${seg(lo, hi, 'zbuild band')}${seg(hi, b, pace ? 'zlow' : 'zover')}</g>
    ${tick(lo)}${tick(hi)}<line class="zmark" x1="${mx}" y1="${y0 - 4}" x2="${mx}" y2="${y0 + h + 4}" stroke-width="3" stroke-linecap="round"/>
    <text class="val" x="${mx}" y="${y0 - 8}" text-anchor="${anchor}" font-size="12.5" font-weight="600">${fmt(v)}</text></svg>`;
}
const runStats = r => [`${kmText(r.km)}\u00a0km`, r.sec ? hms(r.sec) : '', r.sec ? `${hms(Math.round(r.sec / r.km))}\u00a0/km` : '', r.hr ? T(`Ø\u00a0${r.hr}\u00a0bpm`, `avg\u00a0${r.hr}\u00a0bpm`) : ''].filter(Boolean).join(' · ');
// Startseite: Auswertung direkt nach dem Nachtragen (bis „OK“ oder zum nächsten Öffnen)
let startFeedback = null;
function feedbackCard(f) {
  const r = runLog.find(x => x.id === f.id); if (!r) return '';
  const c = runCheck(r), v = runVerdict(c), bpm = t => `${Math.round(t)}`, zn = `Zone ${c.zone}`;
  return `<div class="scard sfb" id="${f.box ? f.box + 'card' : 'startfb'}"><p class="skicker">${T('Auswertung', 'Review')}</p>
    <div class="srowt">${startIcon('laufen')}<span class="txt"><b>${esc(f.title)}</b><small>${esc(runStats(r))}</small></span></div>
    ${c.p ? `<div class="chkrow"><span>${T('Tempo', 'Pace')} <small>${T('locker', 'easy')}</small></span>${checkBar(c.pace, c.p.lo, c.p.hi, t => hms(Math.round(t)), true, 'Tempo')}</div>` : ''}
    ${c.h ? `<div class="chkrow"><span>${T('Puls', 'HR')} <small>${zn}</small></span>${checkBar(c.hr, c.h.lo, c.h.hi, bpm, false, 'Puls')}</div>` : ''}
    ${v.text ? `<p class="sfbtext${v.ok === true ? ' good' : v.ok === false ? ' warn' : ''}">${v.ok === true ? '✓ ' : ''}${esc(v.text)}</p>` : ''}
    <div class="sresact"><button type="button" class="btn small" data-fbclose>OK</button></div></div>`;
}
/* Offene Einträge: Rennen zuerst, dann Läufe, jeweils das älteste zuerst. Der erste steht offen da, weitere sind eingeklappt
   (bleiben nach dem Speichern aufgeklappt, wenn sie es waren). */
let startMoreOpen = false, logToday = null;
function pendingHtml() {
  // neueste zuerst; am selben Tag das Rennen vor dem Lauf
  const list = pendingResults().map(r => ({ r, day: r.date })).concat(pendingRuns()).sort((a, b) => b.day.localeCompare(a.day) || (b.r ? 1 : 0) - (a.r ? 1 : 0)), card = (p, i) => p.r ? resultCard(p.r, i) : runCard(p, i);
  if (!list.length) return '';
  const runs = list.filter(p => !p.r).length;
  return card(list[0], 0) + (list.length > 1 ? `<details class="smore" id="startmore"${startMoreOpen ? ' open' : ''}><summary class="scard"><span>${T(`${list.length - 1} weitere offen`, `${list.length - 1} more open`)}</span><span class="chev"></span></summary>
    ${list.slice(1).map((p, i) => card(p, i + 1)).join('')}${runs > 1 ? `<div class="smoreact"><button type="button" class="btn small" data-runskipall>${T(`Alle ${runs} offenen Läufe: nicht gelaufen`, `All ${runs} open runs: did not run`)}</button></div>` : ''}</details>` : '');
}
function renderStart() {
  const today = localDay(), wk = weekStart(today), items = todayItems();
  $('startdate').textContent = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(today + 'T12:00:00'));
  const logBtn = it => RUN(it) && it.key && !ranOn(today) ? `<button type="button" class="btn small primary sgo" data-logtoday="${esc(it.key)}">${T('Eintragen', 'Log')}</button>` : '';
  const btn = it => it.done ? `<span class="sdone">✓ ${T('erledigt', 'done')}</span>` : it.act === 'mob' ? `<button type="button" class="btn small primary sgo" data-startmob="${it.mob}">▶ ${T('Starten', 'Start')}</button>` : it.act === 'gym' ? `<button type="button" class="btn small primary sgo" data-gymdone="${esc(it.gym)}">✓ ${T('Abhaken', 'Check off')}</button>` : it.act === 'kraft' || it.act === 'starter' ? `<button type="button" class="btn small primary sgo" data-startact="${it.act}"${it.plan ? ` data-startplan="${it.plan}"` : ''}>▶ ${T('Starten', 'Start')}</button>` : it.act ? `<span class="sbtns"><button type="button" class="btn small sgo" data-startact="${it.act}">${T('Details', 'Details')}</button>${logBtn(it)}</span>` : '';
  const ico = it => startIcon(it.kind === 'strength' ? 'kraft' : it.kind === 'mobility' ? 'mobility' : it.kind === 'extra' ? 'mehr' : 'laufen');
  const rows = items.length ? items.map(it => `<div class="srowt${it.done ? ' isdone' : ''}">${ico(it)}<span class="txt"><b>${esc(it.title)}</b>${it.detail || it.note ? `<small>${esc([it.detail, it.note].filter(Boolean).join(' · '))}</small>` : ''}${it.need && it.need.length && !it.done ? `<small class="sneed"><b>${T('Du brauchst', 'You need')}:</b> ${esc(it.need.join(' · '))}</small>` : ''}${it.tip ? `<small class="stip">${esc(it.tip)}</small>` : ''}</span>${btn(it)}</div>`).join('')
    : `<div class="srowt">${startIcon('mobility')}<span class="txt"><b>${T('Heute ist nichts geplant', 'Nothing planned today')}</b><small>${T('Ruhetag – oder eine kurze Mobility-Routine', 'Rest day – or a short mobility routine')}</small></span><button type="button" class="btn small sgo" data-go="mobility">Mobility</button></div>`;
  // Diese Woche: Kraft gegen die Krafttage im Profil, Laufen gegen den Plan bzw. den Schnitt der letzten 4 Wochen, Mobility als Anzahl
  const nK = saved.filter(e => e.date >= wk && e.date <= today).length + getGymLog().filter(e => e.d >= wk && e.d <= today).length, pK = strengthDays().length;
  const bar = (v, max, cls) => max > 0 ? `<span class="sbar"><span class="${cls}" style="width:${Math.min(100, Math.round(v / max * 100))}%"></span></span>` : '';
  let run;
  if (runnerLevel() === 'beginner') { const s = getStarter(); run = [`${s.done} ${T('von', 'of')} ${STARTER_N}`, bar(s.done, STARTER_N, 'b-run'), T('Einstieg', 'Starter')]; }
  else { const S = seasonPlan(), x = S.weeks[0], cur = weekKm(wk) || 0, tgt = x && typeof x.km === 'number' ? x.km : loadFor(wk).avg; run = [tgt ? `${kmText(cur)} / ${Math.round(tgt)} km` : `${kmText(cur)} km`, tgt ? bar(cur, tgt, 'b-run') : '', T('Laufen', 'Running')]; }
  const nM = getMobLog().filter(e => e.d >= wk && e.d <= today).length;
  const pM = mod('mobility') ? profile.week.mobility.length : 0;
  const week = [mod('kraft') && [T('Kraft', 'Strength'), pK ? `${nK} ${T('von', 'of')} ${pK}` : `${nK} ×`, bar(nK, pK, 'b-kraft')], mod('laufen') && [run[2], run[0], run[1]], mod('mobility') && ['Mobility', pM ? `${nM} ${T('von', 'of')} ${pM}` : `${nM} ×`, bar(nM, pM, 'b-mob')]].filter(Boolean);
  // Kacheln mit Stand
  const lastK = saved.slice().sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || ''))).at(-1);
  const nextRace = races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0], lastRun = allRuns().at(-1);
  const s = getStarter(), lastM = getMobLog().at(-1), lastW = weights.at(-1), lastB = load(KEYS.backup, null);
  const kTxt = lastK ? T(`Zuletzt ${WD[new Date(lastK.date + 'T12:00:00').getDay()]} · ${PLANS[lastK.plan] ? PLANS[lastK.plan].tab : ''}`, `Last ${WD[new Date(lastK.date + 'T12:00:00').getDay()]} · ${PLANS[lastK.plan] ? tr(PLANS[lastK.plan].tab) : ''}`) : T('Noch keine Einheit', 'No session yet');
  const rTxt = runnerLevel() === 'beginner' ? T(`Einstieg · Woche ${s.week + 1} von ${STARTER.weeks.length}`, `Starter · week ${s.week + 1} of ${STARTER.weeks.length}`)
    : nextRace ? (daysTo(nextRace.date) === 0 ? T(`${nextRace.name} ist heute`, `${nextRace.name} is today`) : T(`${nextRace.name} in ${daysTo(nextRace.date)} ${daysTo(nextRace.date) === 1 ? 'Tag' : 'Tagen'}`, `${nextRace.name} in ${daysTo(nextRace.date)} ${daysTo(nextRace.date) === 1 ? 'day' : 'days'}`))
      : lastRun ? T(`Zuletzt ${kmText(lastRun.km)} km · ${daysAgo(lastRun.date)}`, `Last ${kmText(lastRun.km)} km · ${daysAgo(lastRun.date)}`) : T('Plan, Warm-up, Umfang', 'Plan, warm-up, volume');
  const mTxt = lastM ? T(`Zuletzt ${lastM.t} · ${daysAgo(lastM.d)}`, `Last ${tr(lastM.t)} · ${daysAgo(lastM.d)}`) : T('Dehnen & Routinen', 'Stretching & routines');
  const pTxt = lastW ? T(`Gewicht ${kgOne(lastW.kg)} kg`, `Weight ${kgOne(lastW.kg)} kg`) : T('Woche, Geräte, Maße', 'Week, equipment, measurements');
  const bTxt = `Version ${APP_VERSION} · ` + (lastB ? T(`Sicherung ${daysAgo(lastB)}`, `backup ${daysAgo(lastB)}`) : T('noch keine Sicherung', 'no backup yet'));
  const tile = (k, name, sub, wide) => `<button type="button" class="stile${wide ? ' wide' : ''}" data-go="${k}"><span class="sthead">${startIcon(k)}<b>${name}</b></span><small>${esc(sub)}</small></button>`;
  const lt = logToday && items.find(it => it.key === logToday && RUN(it));
  const lp = logPick && plannedRunsOn(logPick.day).find(it => it.key === logPick.key);
  $('startcontent').innerHTML = `${startFeedback ? feedbackCard(startFeedback) : ''}${lt ? runCard({ day: today, item: lt }, 90) : lp ? runCard({ day: logPick.day, item: lp }, 91) : ''}${pendingHtml()}<div class="scard"><p class="skicker">${T('Heute dran', 'On today')}</p>${rows}</div>
    <div class="scard"><p class="skicker">${T('Diese Woche', 'This week')}</p>${weekStrip()}<div class="sweek">${week.map(([l, v, b]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b>${b}</div>`).join('')}</div></div>${yearCard()}
    <div class="stiles">${mod('kraft') ? tile('kraft', T('Kraft', 'Strength'), kTxt) : ''}${mod('laufen') ? tile('laufen', T('Laufen', 'Running'), rTxt) : ''}${mod('mobility') ? tile('mobility', 'Mobility', mTxt) : ''}${tile('profil', T('Profil', 'Profile'), pTxt)}${tile('mehr', T('Mehr', 'More'), bTxt, true)}</div>`;
}
$('startcontent').addEventListener('input', e => {
  const t = e.target; tpartJump(t); t.removeAttribute('aria-invalid'); if (t.closest && t.closest('.timein')) markTime(t.closest('.timein').id, false);
  if (t.dataset.wflkm !== undefined) { const km = kmNum(t.value); $('sresinfo' + t.dataset.wflkm).textContent = km >= 1 && km <= 100 ? T(`Catcher Car bei km ${kmText(km)} nach ${hms(carTime(km))} – das wird deine Zeit.`, `Catcher Car at km ${kmText(km)} after ${hms(carTime(km))} – that will be your time.`) : T('Die Zeit rechnet die App aus dem Catcher Car.', 'The app takes the time from the Catcher Car.'); }
});
$('startcontent').addEventListener('toggle', e => { if (e.target.id === 'startmore') startMoreOpen = e.target.open; }, true);
$('startcontent').addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { showArea(g.dataset.go); return; }
  if (e.target.closest('[data-fbclose]')) { startFeedback = null; renderStart(); return; }
  const lg = e.target.closest('[data-logtoday]'); if (lg) { logToday = lg.dataset.logtoday; renderStart(); window.scrollTo(0, 0); const f = $('srunkm-90'); if (f) f.focus(); return; }
  if (e.target.closest('[data-logcancel]')) { logToday = null; logPick = null; renderStart(); return; }
  const sm = e.target.closest('[data-startmob]'); if (sm) { const x = MOBILITY.routines[Number(sm.dataset.startmob)]; if (x) startRoutine('Mobility · ' + x.title, x.steps, () => { logMobility(x.title); renderStart(); }); return; }
  const sd = e.target.closest('[data-stripday]'); if (sd) { stripDay = stripDay === sd.dataset.stripday ? null : sd.dataset.stripday; renderStart(); return; }
  const lk = e.target.closest('[data-logpick]'); if (lk) { const [day, key] = lk.dataset.logpick.split('|'); if (day === localDay()) logToday = key; else logPick = { day, key }; renderStart(); window.scrollTo(0, 0); return; }
  if (e.target.closest('#yearedit')) { yearEdit = true; renderStart(); const f = $('yeargoal'); if (f) f.focus(); return; }
  if (e.target.closest('#yearsave')) { const v = Number(String($('yeargoal').value).replace(/\D/g, '')), y = localDay().slice(0, 4);
    if (!(Number.isInteger(v) && v >= 50 && v <= 20000)) { $('yeargoal').setAttribute('aria-invalid', 'true'); toast(T('Bitte ein Ziel zwischen 50 und 20.000 km eintragen.', 'Please enter a goal between 50 and 20,000 km.')); return; }
    profile.yearKm[y] = v; yearEdit = false; persistProfile(); renderStart(); toast(T(`✓ Jahresziel ${y}: ${kmText(v)} km`, `✓ Year goal ${y}: ${kmText(v)} km`)); return; }
  const gd = e.target.closest('[data-gymdone]'); if (gd) { const d = localDay(); if (!gymDone(d)) putGymLog(getGymLog().concat({ d, n: gd.dataset.gymdone })); renderStart(); toast(T(`✓ ${gd.dataset.gymdone} abgehakt.`, `✓ ${gd.dataset.gymdone} checked off.`)); return; }
  const rs = e.target.closest('[data-ressave]'); if (rs) { saveStartResult(rs.dataset.ressave, Number(rs.dataset.i) || 0); return; }
  const skipRun = (day, key) => { const wk = weekStart(day); weekSkip[wk] = [...new Set((weekSkip[wk] || []).concat(key))]; };
  if (e.target.closest('[data-runskipall]')) { const l = pendingRuns(); l.forEach(p => skipRun(p.day, p.item.key)); store(KEYS.skip, weekSkip); renderStart(); toast(T(`Notiert: ${l.length} Läufe nicht gelaufen.`, `Noted: ${l.length} runs not run.`)); return; }
  // „✓ 12 km wie geplant“: km eintragen und wie „Speichern“ (Zeit und Puls, falls schon eingetippt, kommen mit)
  const rq = e.target.closest('[data-runquick]'); if (rq) { const card = rq.closest('.sres'), inp = card.querySelector('input[id^="srunkm"]'); if (!inp.value.trim()) inp.value = rq.dataset.runquick; card.querySelector('[data-runsave]').click(); return; }
  const ru = e.target.closest('[data-runsave]'), rk = e.target.closest('[data-runskip]');
  if (ru || rk) {
    const [day, key] = (ru || rk).dataset[ru ? 'runsave' : 'runskip'].split('|'), wk = weekStart(day), s = sfx(Number(ru && ru.dataset.i) || 0), f = 'srunkm' + s;
    if (rk) { skipRun(day, key); store(KEYS.skip, weekSkip); renderStart(); toast(T(`Notiert: ${dayLabel(day)} nicht gelaufen.`, `Noted: ${dayLabel(day)} not run.`)); return; }
    const km = kmNum($(f).value);
    if (km === null || Number.isNaN(km) || km < 0.5 || km > 100) { $(f).setAttribute('aria-invalid', 'true'); toast(T('Bitte die km eintragen, z. B. 8,5.', 'Please enter the km, e.g. 8.5.')); return; }
    const sec = readTime('sruntime' + s), hrT = String($('srunhr' + s).value).trim(), hr = hrT === '' ? null : /^\d{2,3}$/.test(hrT) ? Number(hrT) : NaN;
    if (Number.isNaN(sec)) { markTime('sruntime' + s, true); toast(T('Bitte die Zeit prüfen (Minuten und Sekunden höchstens 59) – oder leer lassen.', 'Please check the time (minutes and seconds at most 59) – or leave it empty.')); return; }
    if (hr !== null && !(hr >= 40 && hr <= 230)) { $('srunhr' + s).setAttribute('aria-invalid', 'true'); toast(T('Bitte den Ø-Puls zwischen 40 und 230 eintragen – oder leer lassen.', 'Please enter an average HR between 40 and 230 – or leave it empty.')); return; }
    const run = addRun(day, km, { sec: sec || undefined, hr: hr || undefined, kind: ru.dataset.kind }); const wp = curWeekPlan(wk); if (wp && !wp.done.includes(key)) { wp.done.push(key); storeWeekPlan(); }
    if (run.sec || run.hr) startFeedback = { id: run.id, title: ru.dataset.title };
    if (day === localDay()) logToday = null; if (logPick && logPick.day === day) logPick = null;
    renderStart(); toast(T(`✓ ${kmText(km)} km am ${dayLabel(day)} eingetragen.`, `✓ ${kmText(km)} km on ${dayLabel(day)} logged.`)); if (startFeedback) window.scrollTo(0, 0); return;
  }
  const rd = e.target.closest('[data-resdns]'); if (rd) { const r = races.find(x => x.id === rd.dataset.resdns); if (r) { r.dns = true; persistRaces(); renderStart(); toast(T(`Notiert: ${r.name} nicht gelaufen.`, `Noted: ${r.name} not run.`)); } return; }
  const a = e.target.closest('[data-startact]'); if (!a) return;
  const k = a.dataset.startact;
  if (k === 'kraft') { if (!sessionActive() && a.dataset.startplan && a.dataset.startplan !== plan) setPlan(a.dataset.startplan); showArea('kraft'); if (!sessionActive()) $('btnMain').click(); return; }
  if (k === 'starter') { onStarter('go'); return; }
  if (k === 'plan') { runView.tab = 'plan'; runView.plan = 'woche'; store(KEYS.run, runView); showArea('laufen'); renderRun(); }
});

/* ---------- Lauf-Einstieg: für alle, die mit dem Laufen beginnen ----------
   Laufniveau im Profil: „beginner“ zeigt statt des Saisonplans den Einstieg (9 Wochen × 3 Einheiten), „runner“ den Saisonplan.
   Nicht festgelegt: wer schon Läufe, Ergebnisse oder Rennen eingetragen hat, gilt als Läufer, sonst fragt die Übersicht einmal. */
const STARTER_N = 3;
const runnerLevel = () => profile.week.runner || (runLog.length || runWeeks.length || results.length || races.length ? 'runner' : null);
const normStarter = v => {
  v = isObj(v) ? v : {}; const n = STARTER.weeks.length;
  return { week: Number.isInteger(v.week) && v.week >= 0 && v.week < n ? v.week : 0, done: Number.isInteger(v.done) && v.done >= 0 && v.done <= STARTER_N ? v.done : 0,
    log: Array.isArray(v.log) ? v.log.filter(x => isObj(x) && isDay(x.d) && Number.isInteger(x.w)).slice(-60) : [] };
};
// Immer frisch aus dem Speicher – so kommt auch ein per Sync übernommener Stand sofort an
const getStarter = () => normStarter(load(KEYS.starter, null));
const putStarter = v => store(KEYS.starter, normStarter(v));
const mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const minTxt = n => (n % 60 ? mmss(n) : String(n / 60)) + T(' Min.', ' min');
// Ablauf einer Einheit für den geführten Timer: 5 Min. gehen, die Wechsel der Woche, 5 Min. gehen
function starterItems(w) {
  const x = STARTER.weeks[w], out = [['5:00 Min.', 'Locker gehen', T('zügig gehen zum Aufwärmen', 'brisk walk to warm up')]];
  for (let i = 0; i < x.reps; i++) {
    out.push([mmss(x.run) + ' Min.', 'Locker laufen', (x.reps > 1 ? T(`Lauf ${i + 1} von ${x.reps} · `, `run ${i + 1} of ${x.reps} · `) : '') + T('Gesprächstempo', 'conversational pace')]);
    if (x.walk && (i < x.reps - 1 || x.tail)) out.push([mmss(x.walk) + ' Min.', 'Locker gehen', T('Gehpause', 'walking break')]);
  }
  if (x.tail) out.push([mmss(x.tail) + ' Min.', 'Locker laufen', T('letzter Abschnitt', 'last stretch')]);
  out.push(['5:00 Min.', 'Locker gehen', T('ausklingen lassen, nicht abrupt stehen bleiben', 'cool down, don’t stop abruptly')]);
  return out;
}
function starterSummary(w) {
  const x = STARTER.weeks[w];
  if (x.reps === 1 && !x.tail) return T(`${minTxt(x.run)} am Stück laufen`, `run ${minTxt(x.run)} non-stop`);
  const core = x.reps === 1 ? T(`${minTxt(x.run)} laufen · ${minTxt(x.walk)} gehen`, `run ${minTxt(x.run)} · walk ${minTxt(x.walk)}`)
    : T(`${x.reps} × (${minTxt(x.run)} laufen · ${minTxt(x.walk)} gehen)`, `${x.reps} × (run ${minTxt(x.run)} · walk ${minTxt(x.walk)})`);
  return core + (x.tail ? T(` · ${minTxt(x.tail)} laufen`, ` · run ${minTxt(x.tail)}`) : '');
}
const starterMinutes = w => Math.round(starterItems(w).reduce((a, it) => a + (routineStep(it).secs || 0), 0) / 60);
function starterLog() {
  const s = getStarter(); if (s.done >= STARTER_N) return;
  s.done++; s.log.push({ d: localDay(), w: s.week }); putStarter(s); if (area === 'start') renderStart();
  toast(s.done >= STARTER_N ? T(`Woche ${s.week + 1} geschafft!`, `Week ${s.week + 1} done!`) : T(`Einheit ${s.done} von ${STARTER_N} geschafft.`, `Session ${s.done} of ${STARTER_N} done.`));
  renderRun();
}
function setRunnerLevel(v) { profile.week.runner = v; persistProfile(); renderProfile(); renderRun(); }
// Einmalige Frage in der Übersicht, solange das Laufniveau offen ist und noch nichts eingetragen wurde
const renderLevelAsk = () => `<div class="group" id="levelask"><div class="row"><span class="txt"><b>${T('Neu beim Laufen?', 'New to running?')}</b><small>${T('Der Lauf-Einstieg bringt dich in 9 Wochen mit Wechseln aus Laufen und Gehen zu 30 Minuten am Stück – ohne Testlauf und ohne Tempovorgaben.', 'The running starter takes you to 30 minutes non-stop in 9 weeks by alternating running and walking – no time trial and no pace targets.')}</small></span></div>
  <div class="row"><span class="txt"></span><button type="button" class="btn small" data-level="runner">${T('Ich laufe schon', 'I already run')}</button><button type="button" class="btn small primary" data-level="beginner">${T('Einstieg starten', 'Start the starter')}</button></div></div>`;
// Rennen schon geplant: erst der Einstieg, dann der Rennblock – reicht die Zeit danach noch?
function starterRaceNote(s) {
  const today = localDay(), r = races.filter(x => x.prio === 'A' && x.date >= today && SEASON.dist[x.dist]).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!r) return '';
  const left = STARTER.weeks.length - s.week - (s.done >= STARTER_N ? 1 : 0), after = weeksBetween(weekStart(today), weekStart(r.date)) + 1 - left, need = SEASON.dist[r.dist].minWeeks;
  const base = T(`Dein Rennen <b>${esc(r.name)}</b> (${esc(raceLabel(r))}) am ${dayLabel(r.date)}: Erst der Einstieg (noch ${left} ${left === 1 ? 'Woche' : 'Wochen'}), danach plant die App den Rennblock`, `Your race <b>${esc(r.name)}</b> (${esc(raceLabel(r))}) on ${dayLabel(r.date)}: first the starter (${left} ${left === 1 ? 'week' : 'weeks'} left), then the app plans the race block`);
  if (after >= need) return `<div class="alert">${base}${T(` – dafür bleiben ${after} Wochen.`, ` – ${after} weeks remain for it.`)}</div>`;
  return `<div class="alert due">${base}${after > 0 ? T(` – dafür bleiben nur ${after} ${after === 1 ? 'Woche' : 'Wochen'}, sinnvoll sind mindestens ${need}.`, ` – only ${after} ${after === 1 ? 'week' : 'weeks'} remain, at least ${need} make sense.`) : T(' – das Rennen liegt aber noch vor dem Ende des Einstiegs.', ' – but the race comes before the starter ends.')} ${T('Besser eine kürzere Distanz wählen oder das Rennen mit Gehpausen locker angehen.', 'Better pick a shorter distance or run the race easily with walking breaks.')}</div>`;
}
function renderStarter() {
  const s = getStarter(), n = STARTER.weeks.length, w = s.week, full = s.done >= STARTER_N, last = full && w === n - 1;
  const dots = Array.from({ length: STARTER_N }, (_, i) => `<span class="sdot${i < s.done ? ' on' : ''}"></span>`).join('');
  const act = last
    ? `<div class="alert" id="starterdone">${esc(STARTER.done)}</div><div class="starteract"><button type="button" class="btn small" data-starter="repeat">${T('Woche wiederholen', 'Repeat week')}</button><button type="button" class="btn small primary" data-starter="graduate">${T('Als Läufer weiterplanen', 'Continue as a runner')}</button></div>`
    : full
      ? `<div class="alert" id="starterweekdone">${T(`Woche ${w + 1} geschafft! Fühlte sich die letzte Einheit machbar an, geht es weiter – sonst die Woche einfach wiederholen.`, `Week ${w + 1} done! If the last session felt manageable, move on – otherwise simply repeat the week.`)}</div><div class="starteract"><button type="button" class="btn small" data-starter="repeat">${T('Woche wiederholen', 'Repeat week')}</button><button type="button" class="btn small primary" data-starter="next">${T(`Weiter mit Woche ${w + 2}`, `Go to week ${w + 2}`)}</button></div>`
      : `<button type="button" class="btn primary wide" data-starter="go">${T('▶ Einheit geführt starten', '▶ Start guided session')}</button><p class="tiny">${esc(STARTER.screen)}</p><div class="starteract"><button type="button" class="btn small" data-starter="done">${T('✓ Ohne Führung erledigt', '✓ Done without guidance')}</button></div>`;
  return `<div class="intro">${esc(STARTER.intro)}</div>${starterRaceNote(s)}
    <div class="header">${T('Lauf-Einstieg', 'Running starter')}</div><div class="group"><div class="panel" id="starter" style="border:0;padding-top:12px">
      <div class="phasebadge ph-base">${T(`Woche ${w + 1} von ${n}`, `Week ${w + 1} of ${n}`)}</div>
      <p class="loadstatus" id="startersum"><b>${esc(starterSummary(w))}</b></p>
      <p class="tiny" style="margin-top:2px">${T(`Vorher und nachher je 5 Min. gehen · insgesamt etwa ${starterMinutes(w)} Min.`, `Walk 5 min before and after · about ${starterMinutes(w)} min in total`)}</p>
      <div class="sdots" role="img" aria-label="${T(`${s.done} von ${STARTER_N} Einheiten dieser Woche erledigt`, `${s.done} of ${STARTER_N} sessions this week done`)}">${dots}<span class="tiny">${full ? T('Woche erledigt', 'Week done') : T(`Einheit ${s.done + 1} von ${STARTER_N}`, `Session ${s.done + 1} of ${STARTER_N}`)}</span>${s.done ? `<button type="button" class="linkbtn" data-starter="undo">${T('zurücknehmen', 'undo')}</button>` : ''}</div>
      ${act}
    </div></div>
    <div class="group"><div class="row"><span class="txt"><b>${T('Tempo & Sicherheit', 'Pace & safety')}</b><small>${esc(hrize(STARTER.pace + (profile.hr.z ? ' ' + T('Richtwert: Zone 2.', 'Guide: zone 2.') : '')))} ${esc(STARTER.health)}</small></span></div>
      <div class="row"><label class="txt" for="starterweek"><b>${T('Woche wählen', 'Choose week')}</b><small>${T('Schon fitter oder lieber zurück? Die Einheiten der Woche beginnen dann von vorn.', 'Already fitter or rather step back? The week’s sessions then start over.')}</small></label><select id="starterweek">${STARTER.weeks.map((x, i) => `<option value="${i}"${i === w ? ' selected' : ''}>${T(`Woche ${i + 1}`, `Week ${i + 1}`)}</option>`).join('')}</select></div>
      <div class="row"><span class="txt"><b>${T('Ich laufe schon regelmäßig', 'I already run regularly')}</b><small>${T('Zum Saisonplan mit Umfang, Rennen und Tempos. Umstellbar im Profil unter Trainingswoche.', 'Switch to the season plan with volume, races and paces. Changeable in Profile under Training week.')}</small></span><button type="button" class="btn small" data-starter="runner">${T('Wechseln', 'Switch')}</button></div></div>`;
}
function renderPlan() {
  const sub = $('runsub');
  sub.classList.remove('hide');
  sub.innerHTML = [['woche', T('Übersicht', 'Overview')], ['rennen', T('Rennen', 'Races')], ['bestzeiten', T('Bestzeiten', 'Best times')], ['wissen', T('Wissen', 'Knowledge')]].map(([k, l]) => `<button role="tab" type="button" data-runsub="${k}" aria-selected="${runView.plan === k}">${l}</button>`).join('');
  if (runView.plan === 'rennen') { $('runcontent').innerHTML = renderRaces(); if (raceEdit) syncRaceForm(false); return; }
  if (runView.plan === 'bestzeiten') { $('runcontent').innerHTML = renderBests(); return; }
  if (runView.plan === 'wissen') { $('runcontent').innerHTML = renderPlanGuide(); renderPace(); return; }
  if (runnerLevel() === 'beginner') { $('runcontent').innerHTML = renderStarter(); return; }
  const ask = runnerLevel() === null ? renderLevelAsk() : '';
  const S = seasonPlan();
  if (!S.weeks.length) {
    // Kein A-Rennen mehr geplant, aber eines liegt kurz zurück: Erholung trotzdem anzeigen (Rennwoche + Erholungswochen der Distanz)
    const today = localDay(), lastA = races.filter(r => r.prio === 'A' && r.date <= today && SEASON.dist[r.dist]).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const sinceW = lastA ? weeksBetween(weekStart(lastA.date), weekStart(today)) : 99;
    const recBox = lastA && sinceW <= SEASON.dist[lastA.dist].recover.length && SEASON.recoverNote[lastA.dist]
      ? `<div class="header">${T('Erholung', 'Recovery')}</div><div class="group"><div class="panel" style="border:0;padding-top:12px" id="planrecover"><div class="phasebadge ph-recover">${esc(SEASON.phase.recover[0])}</div><p class="loadstatus">${T(`<b>${esc(lastA.name)}</b> am ${dayLabel(lastA.date)}`, `<b>${esc(lastA.name)}</b> on ${dayLabel(lastA.date)}`)}</p><p class="tiny" style="margin-top:2px">${esc(SEASON.phase.recover[1])}</p><div class="alert">${esc(SEASON.recoverNote[lastA.dist])}</div></div></div>` : '';
    $('runcontent').innerHTML = `${ask}<div class="intro">${esc(SEASON.intro)}</div>${recBox}<div class="group"><div class="row"><span class="txt"><b>${T('Noch kein A-Rennen geplant', 'No A race planned yet')}</b><small>${T('Unter „Rennen“ ein Hauptrennen mit Datum und Distanz eintragen.', 'Enter a main race with date and distance under “Races”.')}</small></span><button type="button" class="btn small primary" data-runsub-go="rennen">${T('Rennen eintragen', 'Add race')}</button></div></div>`;
    $('runcontent').insertAdjacentHTML('beforeend', renderPaces());
    return;
  }
  $('runcontent').innerHTML = ask + (S.warn.length ? S.warn.map(w => `<div class="alert due">${esc(w)}</div>`).join('') : '') + (S.note.length ? S.note.map(w => `<div class="alert planmix">${esc(w)}</div>`).join('') : '') + renderPlanWeek(S) + renderPaces() + renderPlanSeason(S) + `<p class="footer">${esc(SEASON.note)}</p>`;
}

/* ---------- Sync zwischen Geräten über eine Datei (iCloud Drive, Google Drive, OneDrive, Dropbox …) ----------
   Jeder Eintrag hat einen Änderungszeitpunkt, gelöschte Einträge eine Löschmarke. Beim Laden gewinnt je Eintrag der neuere
   Stand; nichts wird blind überschrieben. Änderungen erkennt die App beim Speichern im Browser (store) über einen Prüfwert. */
const SYNC_META = KEY_NS + 'jan-kb-sync-v1', SYNC_FILE = KEY_NS ? 'kb-tracker-test-sync.json' : 'kb-tracker-sync.json', SYNC_MSG = KEY_NS + 'jan-kb-sync-msg';
const SYNC_COLLS = {
  entries: { key: KEYS.entries, id: e => isObj(e) && e.plan && e.date ? String(e.id || `legacy-${e.plan}-${e.date}-${e.total}-${e.at || ''}`) : null },
  waist: { key: KEYS.waist, id: e => isObj(e) && isDay(e.date) ? e.date : null },
  runweeks: { key: KEYS.runweeks, id: e => isObj(e) && isDay(e.week) ? e.week : null },
  runlog: { key: KEYS.runlog, id: e => isObj(e) && typeof e.id === 'string' ? e.id : null },
  races: { key: KEYS.races, id: e => isObj(e) && typeof e.id === 'string' ? e.id : null },
  weight: { key: KEYS.weight, id: e => isObj(e) && isDay(e.date) ? e.date : null },
  results: { key: KEYS.results, id: e => isObj(e) && typeof e.id === 'string' ? e.id : null }
};
// Einstellungen, die zwischen Geräten gleich sein sollen (Ton und Stimme bleiben je Gerät; die Geräte je Plan stecken in den Übungs-Einstellungen)
const SYNC_SETTINGS = { choices: KEYS.choice, stages: KEYS.stage, profile: KEYS.profile, weekSkip: KEYS.skip, weekPlan: KEYS.weekplan, starter: KEYS.starter, mobLog: KEYS.moblog, gymLog: KEYS.gymlog };
const SYNC_TRACKED = new Set(Object.values(SYNC_COLLS).map(c => c.key).concat(Object.values(SYNC_SETTINGS)));
const syncHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length.toString(36); };
const rawGet = k => { try { const r = localStorage.getItem(k); return r === null ? null : JSON.parse(r); } catch (e) { return null; } };
const rawSet = (k, v) => { if (wiping) return false; try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
function syncMetaLoad() {
  const m = rawGet(SYNC_META);
  return isObj(m) && isObj(m.mod) && isObj(m.del) && isObj(m.h) ? m : { device: uid(), init: false, mod: {}, del: {}, h: {}, lastSave: null, lastLoad: null, dirty: false };
}
let syncMeta = syncMetaLoad();
const syncSaveMeta = () => rawSet(SYNC_META, syncMeta);
// Vergleicht den Stand im Browser mit den Prüfwerten: neu/geändert → Zeitstempel, verschwunden → Löschmarke.
// Beim allerersten Lauf bekommen vorhandene Daten den Zeitstempel 0, damit sie fremde, neuere Änderungen nicht überstimmen.
function syncTrack() {
  if (wiping) return false;
  // Zeitstempel nie kleiner als der größte bekannte: geht die Uhr eines anderen Geräts vor, gewinnt eine spätere Änderung hier trotzdem
  const m = syncMeta, now = Math.max(Date.now(), ...Object.values(m.mod).concat(Object.values(m.del)).filter(Number.isFinite).map(t => t + 1)), first = !m.init; let changed = false;
  const mark = (k, h) => { if (m.h[k] === h) return; m.h[k] = h; m.mod[k] = first ? 0 : now; delete m.del[k]; if (!first) changed = true; };
  for (const [c, d] of Object.entries(SYNC_COLLS)) {
    const arr = rawGet(d.key), seen = new Set();
    for (const e of Array.isArray(arr) ? arr : []) { const id = d.id(e); if (id === null) continue; const k = c + ':' + id; seen.add(k); mark(k, syncHash(JSON.stringify(e))); }
    for (const k of Object.keys(m.h)) if (k.startsWith(c + ':') && !seen.has(k)) { delete m.h[k]; delete m.mod[k]; m.del[k] = now; changed = true; }
  }
  for (const [n, key] of Object.entries(SYNC_SETTINGS)) { const v = rawGet(key); if (v !== null) mark('set:' + n, syncHash(JSON.stringify(v))); }
  m.init = true; if (changed) m.dirty = true;
  syncSaveMeta();
  return changed;
}
let syncTimer = null;
syncHook = k => { if (SYNC_TRACKED.has(k)) { clearTimeout(syncTimer); syncTimer = setTimeout(() => { syncTrack(); renderSyncStatus(); }, 250); } };
function syncPayload() {
  syncTrack();
  const m = syncMeta, colls = {}, settings = {};
  for (const [c, d] of Object.entries(SYNC_COLLS)) {
    const arr = rawGet(d.key);
    colls[c] = (Array.isArray(arr) ? arr : []).map(e => { const id = d.id(e); return id === null ? null : { k: id, ts: m.mod[c + ':' + id] || 0, v: e }; }).filter(Boolean);
  }
  for (const [n, key] of Object.entries(SYNC_SETTINGS)) { const v = rawGet(key); if (v !== null) settings[n] = { ts: m.mod['set:' + n] || 0, v }; }
  return { kind: 'kb-tracker-sync', version: 1, savedAt: new Date().toISOString(), device: m.device, colls, del: m.del, settings };
}
// Abgleich: Rückgabe { changed, added, updated, removed }
function syncMerge(remote) {
  if (!isObj(remote) || remote.kind !== 'kb-tracker-sync' || !isObj(remote.colls)) throw Error(T('Das ist keine Sync-Datei von Tagwerk.', 'This is not a Tagwerk sync file.'));
  syncTrack();
  const m = syncMeta, rdel = isObj(remote.del) ? remote.del : {}, res = { added: 0, updated: 0, removed: 0 };
  const okTs = t => typeof t === 'number' && Number.isFinite(t) && t >= 0;
  for (const [c, d] of Object.entries(SYNC_COLLS)) {
    let arr = rawGet(d.key); arr = Array.isArray(arr) ? arr : [];
    let touched = false;
    const idx = new Map(arr.map((e, i) => [d.id(e), i]));
    for (const r of Array.isArray(remote.colls[c]) ? remote.colls[c] : []) {
      if (!isObj(r) || !okTs(r.ts) || !isObj(r.v) || d.id(r.v) !== String(r.k)) continue;
      const k = c + ':' + r.k, h = syncHash(JSON.stringify(r.v));
      if (idx.has(String(r.k))) {
        const lts = m.mod[k] || 0;
        if (m.h[k] === h) { if (r.ts > lts) m.mod[k] = r.ts; continue; }
        if (r.ts > lts || (r.ts === lts && h > (m.h[k] || ''))) { arr[idx.get(String(r.k))] = r.v; m.h[k] = h; m.mod[k] = r.ts; res.updated++; touched = true; }
      } else if (!(m.del[k] >= r.ts)) { idx.set(String(r.k), arr.length); arr.push(r.v); m.h[k] = h; m.mod[k] = r.ts; delete m.del[k]; res.added++; touched = true; }
    }
    for (const [k, ts] of Object.entries(rdel)) {
      if (!k.startsWith(c + ':') || !okTs(ts)) continue;
      const id = k.slice(c.length + 1);
      if (idx.has(id) && ts > (m.mod[k] || 0)) { arr = arr.filter(e => d.id(e) !== id); idx.clear(); arr.forEach((e, i) => idx.set(d.id(e), i)); delete m.h[k]; delete m.mod[k]; res.removed++; touched = true; }
      if (!idx.has(id)) m.del[k] = Math.max(m.del[k] || 0, ts);
    }
    if (touched) { if (d.key === KEYS.runlog || d.key === KEYS.weight || d.key === KEYS.races || d.key === KEYS.results) arr.sort((a, b) => String(a.date).localeCompare(String(b.date))); rawSet(d.key, arr); }
  }
  for (const [n, key] of Object.entries(SYNC_SETTINGS)) {
    const r = isObj(remote.settings) ? remote.settings[n] : null, k = 'set:' + n;
    if (!isObj(r) || !okTs(r.ts) || !isObj(r.v)) continue;
    const h = syncHash(JSON.stringify(r.v));
    if (m.h[k] !== h && (r.ts > (m.mod[k] || 0) || (r.ts === (m.mod[k] || 0) && h > (m.h[k] || '')))) { rawSet(key, r.v); m.h[k] = h; m.mod[k] = r.ts; res.updated++; }
  }
  // Hat dieses Gerät Neueres als die Datei? Dann bleibt „Änderungen seit dem letzten Speichern“ stehen
  const rts = {}; for (const [c, list] of Object.entries(remote.colls)) if (Array.isArray(list)) for (const r of list) if (isObj(r)) rts[c + ':' + r.k] = r.ts;
  if (isObj(remote.settings)) for (const [n, r] of Object.entries(remote.settings)) if (isObj(r)) rts['set:' + n] = r.ts;
  m.dirty = Object.keys(m.h).some(k => !(k in rts) || (m.mod[k] || 0) > rts[k]) || Object.keys(m.del).some(k => !(k in rdel));
  m.lastLoad = new Date().toISOString(); syncSaveMeta();
  res.changed = res.added + res.updated + res.removed > 0;
  return res;
}
// Datei-Zugriff: Chrome/Edge am Mac/PC merken sich die Datei (z. B. im Google-Drive-Ordner), sonst Teilen bzw. Dateiauswahl
const canHandle = () => !!(window.showSaveFilePicker && window.showOpenFilePicker && window.indexedDB);
// IndexedDB für den gemerkten Sync-Datei-Griff: Testversion und echte App getrennt (auch beim Zurücksetzen)
const IDB_NAME = KEY_NS ? 'kb-tracker-test' : 'kb-tracker';
function idb(mode, fn) {
  return new Promise((ok, fail) => {
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => fail(rq.error);
    rq.onsuccess = () => { const tx = rq.result.transaction('kv', mode), st = tx.objectStore('kv'), r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => fail(tx.error); };
  });
}
const handleGet = () => canHandle() ? idb('readonly', st => st.get('syncHandle')).catch(() => null) : Promise.resolve(null);
const handleSet = h => idb('readwrite', st => h ? st.put(h, 'syncHandle') : st.delete('syncHandle')).catch(() => null);
async function handleReady(h, write) {
  const o = { mode: write ? 'readwrite' : 'read' };
  if (await h.queryPermission(o) === 'granted') return true;
  return await h.requestPermission(o) === 'granted';
}
// Sync-Datei einmal festlegen (Chrome/Edge am Mac/PC): vorhandene Datei wählen oder neu anlegen
async function syncPick() {
  const types = [{ description: 'Tagwerk Sync', accept: { 'application/json': ['.json'] } }], prev = await handleGet();
  try {
    let h;
    if (confirm(T('Gibt es die Sync-Datei schon (z. B. von einem anderen Gerät)?\n\nOK = vorhandene Datei auswählen\nAbbrechen = neue Datei anlegen', 'Does the sync file already exist (e.g. from another device)?\n\nOK = choose the existing file\nCancel = create a new file'))) [h] = await window.showOpenFilePicker(Object.assign({ types }, prev ? { startIn: prev } : {}));
    else h = await window.showSaveFilePicker(Object.assign({ suggestedName: SYNC_FILE, types }, prev ? { startIn: prev } : {}));
    if (!(await handleReady(h, true))) { toast(T('Ohne Schreibrecht kann die App die Datei nicht aktualisieren.', 'Without write permission the app cannot update the file.')); return null; }
    await handleSet(h); renderSyncStatus(); toast(T(`Sync-Datei festgelegt: „${h.name}“.`, `Sync file set: “${h.name}”.`)); return h;
  } catch (e) { if (e && e.name !== 'AbortError') toast(T('Die Datei konnte nicht festgelegt werden.', 'The file could not be set.')); return null; }
}
// Sync-Datei enthält alle Daten → zählt auch als Sicherung (Backup-Erinnerung wird zurückgesetzt)
function syncDone(how) {
  syncMeta.lastSave = new Date().toISOString(); syncMeta.dirty = false; syncSaveMeta(); markBackup(); renderSyncStatus(); renderBackupBanner();
  // noch kein Ort gemerkt: einmal fragen, dann steht er in jeder Erinnerung
  if (!syncMeta.place) { toast(how + ' ' + T('Wohin hast du sie gelegt? Unter „Speicherort“ einmal eintragen, dann steht es in der Erinnerung.', 'Where did you put it? Enter it once under “Location” and it shows in the reminder.'));
    const f = $('syncplace'); if (f && f.offsetParent) { f.setAttribute('aria-invalid', 'false'); f.classList.add('ask'); f.focus({ preventScroll: true }); } return; }
  toast(how);
}
async function syncSave() {
  const json = JSON.stringify(syncPayload());
  try {
    if (canHandle()) {
      let h = await handleGet();
      if (h && !(await handleReady(h, true))) h = null;
      if (!h) { h = await syncPick(); if (!h) return; }
      // Erst den Stand in der Datei übernehmen (falls ein anderes Gerät gespeichert hat), dann den gemeinsamen Stand zurückschreiben
      const old = (await (await h.getFile()).text()).trim();
      let res = null;
      if (old) { let x; try { x = JSON.parse(old); } catch (e) { throw Error(T('Die gewählte Datei ist keine Sync-Datei.', 'The chosen file is not a sync file.')); } res = syncMerge(x); }
      const w = await h.createWritable(); await w.write(JSON.stringify(syncPayload())); await w.close();
      syncDone(T(`Sync gespeichert in „${h.name}“.`, `Sync saved to “${h.name}”.`));
      if (res && res.changed) { sessionStorage.setItem(SYNC_MSG, syncText(res) + T(' Sync-Datei aktualisiert.', ' Sync file updated.')); location.reload(); }
      return;
    }
    const file = new File([json], SYNC_FILE, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && document.documentElement.dataset.os !== 'other') {
      await navigator.share({ files: [file], title: 'Tagwerk Sync' }); syncDone(T(`Sync übergeben – ${syncPlaceText()} sichern und die alte Datei ersetzen.`, `Sync handed over – save it ${syncPlaceText()} and replace the old file.`)); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; if (e && e.message) { toast(e.message); return; } }
  download(SYNC_FILE, json, 'application/json'); syncDone(T(`Sync-Datei heruntergeladen – ${syncPlaceText()} legen und die alte ersetzen.`, `Sync file downloaded – put it ${syncPlaceText()} and replace the old one.`));
}
const syncText = r => r.changed ? T(`Abgeglichen: ${r.added} neu, ${r.updated} geändert, ${r.removed} gelöscht.`, `Merged: ${r.added} new, ${r.updated} changed, ${r.removed} deleted.`) : T('Schon auf dem gleichen Stand.', 'Already up to date.');
function syncApply(text) {
  let remote; try { remote = JSON.parse(text); } catch (e) { toast(T('Die Datei ist keine Sync-Datei.', 'The file is not a sync file.')); return; }
  let res; try { res = syncMerge(remote); } catch (e) { toast(e.message); return; }
  if (res.changed) { sessionStorage.setItem(SYNC_MSG, syncText(res)); location.reload(); return; }
  renderSyncStatus(); toast(syncText(res));
}
async function syncLoad() {
  if (canHandle()) {
    try {
      let h = await handleGet();
      if (h && !(await handleReady(h, false))) h = null;
      if (!h) { h = await syncPick(); if (!h) return; }
      syncApply(await (await h.getFile()).text()); return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (syncMeta.place) toast(T(`Datei aus „${syncMeta.place}“ wählen.`, `Choose the file from “${syncMeta.place}”.`));
  $('syncfile').click();
}
const syncPlaceText = () => syncMeta.place ? T(`in „${syncMeta.place}“`, `in “${syncMeta.place}”`) : T('in deinen Cloud-Ordner', 'in your cloud folder');
async function renderSyncStatus() {
  const el = $('syncstatus'); if (!el) return;
  const m = syncMeta, t = iso => iso ? `${dateGerman(localDay(new Date(iso)))} ${new Date(iso).toTimeString().slice(0, 5)}` : T('noch nie', 'never');
  const h = await handleGet();
  $('syncpick').classList.toggle('hide', !canHandle());
  const pl = $('syncplace'); if (pl && document.activeElement !== pl) pl.value = m.place || '';
  el.innerHTML = `${T('Datei', 'File')}: <b>${esc(h ? h.name : SYNC_FILE)}</b>${m.place ? ` ${T('in', 'in')} <b>${esc(m.place)}</b>` : ''}<br>${T('Zuletzt geladen', 'Last loaded')}: <b>${t(m.lastLoad)}</b> · ${T('gespeichert', 'saved')}: <b>${t(m.lastSave)}</b>${m.dirty ? `<br><span class="spike">${T('Änderungen seit dem letzten Speichern', 'Changes since the last save')}</span>` : ''}${h ? `<br>${T('Fest verbunden – Laden und Speichern ohne Auswahl.', 'Connected – load and save without choosing.')} <button type="button" class="linkbtn" id="syncforget">${T('Verbindung lösen', 'Disconnect')}</button>` : ''}`;
}

/* ---------- Einstellungen zurücksetzen: Daten bleiben ---------- */
const SETTING_KEYS = ['sound', 'gear', 'choice', 'stage', 'plan', 'area', 'run', 'audio', 'mob', 'profile', 'skip', 'hint', 'bestview', 'notes', 'weekplan', 'icsremind', 'sections'].map(k => KEYS[k]).concat(LANG_KEY);
function settingsReset() {
  if (sessionActive()) { alert(T('Bitte das laufende Training zuerst beenden oder zurücksetzen.', 'Please finish or reset the current workout first.')); return; }
  if (!confirm(T('Einstellungen zurücksetzen?\n\nZurück auf den Ausgangszustand: Profil (Trainingswoche, Herzfrequenz, Geräte & Gewichte), Übungs-Varianten und Gewichte, Stufen, „Entfällt“, Ton und Ansichten.\n\nTrainings, Läufe, Wochensummen, Rennen, Gewicht und Bauchumfang bleiben erhalten. Gilt nur für dieses Gerät.', 'Reset settings?\n\nBack to the defaults: profile (training week, heart rate, equipment & weights), exercise variants and weights, stages, “Skip”, sound and views.\n\nWorkouts, runs, weekly totals, races, weight and waist are kept. Applies to this device only.'))) return;
  wiping = true; clearTimeout(syncTimer);
  try { for (const k of SETTING_KEYS) localStorage.removeItem(k); localStorage.setItem(KEYS.profile, JSON.stringify(normProfile(null))); } catch (e) { }
  // Sync: Prüfwerte der Einstellungen vergessen – „Sync laden“ holt sie bei Bedarf aus der Datei zurück
  for (const k of Object.keys(syncMeta.h)) if (k.startsWith('set:')) { delete syncMeta.h[k]; delete syncMeta.mod[k]; }
  try { localStorage.setItem(SYNC_META, JSON.stringify(syncMeta)); sessionStorage.setItem(SYNC_MSG, T('Einstellungen zurückgesetzt – deine Daten sind unverändert.', 'Settings reset – your data is unchanged.')); } catch (e) { }
  location.reload();
}

/* ---------- Werkseinstellung: alle Daten dieses Geräts löschen ---------- */
const APP_KEY = k => k.startsWith(KEY_NS + 'jan-kb') || k.startsWith(KEY_NS + 'jan-kettlebell');
async function factoryReset() {
  if (sessionActive() && !confirm(T('Es läuft gerade ein Training. Trotzdem fortfahren?', 'A workout is running. Continue anyway?'))) return;
  if (!confirm(T('Werkseinstellung: Alle Daten auf diesem Gerät werden gelöscht – Trainings, Läufe, Wochensummen, Rennen, Gewicht, Bauchumfang, Profil und Einstellungen.\n\nDie Sync-Datei in deiner Cloud und andere Geräte bleiben unberührt.\n\nFortfahren?', 'Factory reset: all data on this device will be deleted – workouts, runs, weekly totals, races, weight, waist, profile and settings.\n\nThe sync file in your cloud and other devices are not affected.\n\nContinue?'))) return;
  const has = saved.length + waist.length + runWeeks.length + runLog.length + races.length + weights.length + results.length > 0;
  if (has && confirm(T('Vorher ein Backup speichern?\n\nOK = Backup speichern\nAbbrechen = ohne Backup weiter', 'Save a backup first?\n\nOK = save backup\nCancel = continue without backup'))) await exportBackup();
  const word = prompt(T('Zum Bestätigen LÖSCHEN eingeben:', 'Type DELETE to confirm:'));
  if (word === null) return;
  if (!['LÖSCHEN', 'DELETE'].includes(word.trim().toUpperCase())) { toast(T('Nicht bestätigt – es wurde nichts gelöscht.', 'Not confirmed – nothing was deleted.')); return; }
  wiping = true; clearTimeout(syncTimer);
  try { for (const k of Object.keys(localStorage)) if (APP_KEY(k)) localStorage.removeItem(k); } catch (e) { }
  try { sessionStorage.removeItem(SYNC_MSG); } catch (e) { }
  try { indexedDB.deleteDatabase(IDB_NAME); } catch (e) { }
  try { sessionStorage.setItem(SYNC_MSG, T('Auf Werkseinstellung zurückgesetzt – alle Daten auf diesem Gerät wurden gelöscht.', 'Factory reset done – all data on this device was deleted.')); } catch (e) { }
  location.reload();
}

/* ---------- Overlays: Hintergrund scrollt nicht mit ---------- */
// Gilt für alle <dialog>: sobald eines offen ist, wird die Seite an ihrer Position festgehalten; beim Schließen geht es dort weiter.
let scrollLockY = null;
function syncScrollLock() {
  const open = !!document.querySelector('dialog[open]'), b = document.body;
  if (open && scrollLockY === null) { scrollLockY = window.scrollY; b.style.top = `-${scrollLockY}px`; document.documentElement.classList.add('locked'); }
  else if (!open && scrollLockY !== null) { const y = scrollLockY; scrollLockY = null; document.documentElement.classList.remove('locked'); b.style.top = ''; window.scrollTo(0, y); }
}
new MutationObserver(syncScrollLock).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

/* ---------- Neuigkeiten: beim ersten Start nach einem Update, danach unter Mehr ---------- */
const notesDlg = $('notes');
let notesOpt = load(KEYS.notes, null); if (!isObj(notesOpt)) notesOpt = { seen: null, auto: true };
// Ein Eintrag pro Tag, der im Lauf des Tages wachsen kann: „gesehen“ merkt sich id und Anzahl der Punkte (z. B. „2026-11-03@5“)
const noteStamp = c => c.id + '@' + c.items.length;
function seenIndex() {
  const [sid, n] = String(notesOpt.seen || '').split('@'), i = CHANGELOG.findIndex(c => c.id === sid || (c.aka || []).includes(sid));
  if (i < 0) return -1;
  const c = CHANGELOG[i], full = c.id === sid && (n === undefined ? !c.aka : Number(n) === c.items.length);
  return full ? i : i + 1; // derselbe Tag mit neuen Punkten (oder nur ein früherer Teil davon gesehen) zählt als neu
}
function renderNotesRows() {
  $('noteshint').textContent = CHANGELOG.length ? `${T('Stand', 'As of')} ${dateGerman(CHANGELOG[0].date)}: ${CHANGELOG[0].title}` : '';
  $('appversion').textContent = `Tagwerk · Version ${APP_VERSION}` + (KEY_NS ? T(' · Testversion', ' · test version') : '');
  $('notesautoval').textContent = notesOpt.auto !== false ? T('An', 'On') : T('Aus', 'Off');
}
// Steht das Thema schon am Textanfang („Android: …“, „„Heute dabei“: …“), wird es nicht doppelt gezeigt.
const noteText = (t, d) => { const m = d.match(/^[„“”"]?([^:„“”"]{1,40})[“”"]?:\s+/); return m && m[1] === t ? d.slice(m[0].length) : d; };
const notesEntry = c => `<h3>${esc(c.title)}</h3><p class="tiny" style="margin-top:0">${c.version ? `Version ${esc(c.version)} · ` : ''}${dateGerman(c.date)}</p>` + NOTE_KINDS.map(([k, de, en]) => {
  const items = c.items.filter(it => it[2] === k);
  return items.length ? `<p class="noteskind">${T(de, en)}</p><ul class="notes">${items.map(([t, d]) => `<li><b>${esc(t)}:</b> ${esc(noteText(t, d))}</li>`).join('')}</ul>` : '';
}).join('');
function openNotes(all) {
  // Gesehenen Eintrag kennt die App: alles Neuere. Noch nie etwas gesehen (oder unbekannt): die letzten Updates plus Grundstand (ältester Eintrag).
  const NEW_FOR_NEWCOMERS = 3, i = seenIndex(), base = CHANGELOG.at(-1);
  const updates = CHANGELOG.slice(0, -1), skipped = i < 0 && updates.length > NEW_FOR_NEWCOMERS;
  const fresh = all ? CHANGELOG : i >= 0 ? CHANGELOG.slice(0, Math.max(1, i)) : updates.slice(0, NEW_FOR_NEWCOMERS).concat(base);
  $('notes-title').textContent = all ? T('Neuigkeiten', 'News') : T('Neu in der App', 'New in the app');
  $('notes-body').innerHTML = fresh.map((c, k) => (skipped && c === base ? `<p class="tiny">${T(`… ${updates.length - NEW_FOR_NEWCOMERS} ältere Updates unter <b>Mehr → Was ist neu?</b>`, `… ${updates.length - NEW_FOR_NEWCOMERS} older updates under <b>More → What's new?</b>`)}</p>` : '') + notesEntry(c)).join('')
    + (all ? '' : `<p class="tiny">${T('Alle Neuigkeiten findest du jederzeit unter <b>Mehr → Was ist neu?</b>', 'You can find all news any time under <b>More → What\'s new?</b>')}</p>`);
  if (!notesDlg.open) notesDlg.showModal();
}
notesDlg.addEventListener('close', () => { if (CHANGELOG.length) { notesOpt.seen = noteStamp(CHANGELOG[0]); store(KEYS.notes, notesOpt); } });
$('notes-close').addEventListener('click', () => notesDlg.close());
$('notesbtn').addEventListener('click', () => openNotes(true));
// Sprache: Automatisch nach Gerätesprache (Deutsch → Deutsch, sonst Englisch) oder fest. Wechsel lädt die App neu.
function renderLang() {
  const dev = deviceLang() === 'de' ? 'Deutsch' : 'English';
  $('langsel').innerHTML = [['auto', `Auto (${dev})`], ['de', 'Deutsch'], ['en', 'English']].map(([v, l]) => `<option value="${v}"${v === LANG_PREF ? ' selected' : ''}>${esc(l)}</option>`).join('');
  $('langhint').textContent = T('Auto: nach Gerätesprache', 'Auto: by device language');
}
renderLang();
$('langsel').addEventListener('change', e => {
  const v = e.target.value;
  if (sessionActive() && !confirm(T('Das laufende Training bleibt erhalten. Jetzt neu laden?', 'The current workout is kept. Reload now?'))) { renderLang(); return; }
  persistSession();
  try { if (v === 'auto') localStorage.removeItem(LANG_KEY); else localStorage.setItem(LANG_KEY, JSON.stringify(v)); } catch (err) { }
  location.reload();
});
$('notesauto').addEventListener('click', () => { notesOpt.auto = notesOpt.auto === false; store(KEYS.notes, notesOpt); renderNotesRows(); toast(notesOpt.auto ? T('Neuigkeiten werden nach Updates angezeigt.', 'News will be shown after updates.') : T('Neuigkeiten nur noch unter Mehr.', 'News only under More.')); });

/* ---------- Dateien: Backup, CSV, Kalender ---------- */
function download(name, content, type) { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function backupJson() { return JSON.stringify({ version: 3, entries: saved.concat(savedKeep), waist: waist.concat(waistKeep), runWeeks: runWeeks.concat(runWeeksKeep), runLog: runLog.concat(runLogKeep), races: races.concat(racesKeep), weights: weights.concat(weightKeep), results: results.concat(resultsKeep), weekSkip, starter: getStarter(), mobLog: getMobLog(), gymLog: getGymLog(), settings: { gear, choices, stages, audio: audioOpt, profile: Object.assign({}, profileExtra, profile) }, exportedAt: new Date().toISOString() }, null, 2); }
function schemaCheck() {
  const prev = load(SCHEMA_KEY, null);
  if (prev === SCHEMA || (typeof prev === 'number' && prev > SCHEMA)) return; // neuere Daten mit älterer App: nichts verändern
  if (saved.length + savedKeep.length + waist.length + waistKeep.length + runWeeks.length + runWeeksKeep.length + runLog.length + runLogKeep.length + races.length + racesKeep.length + weights.length + weightKeep.length + results.length + resultsKeep.length > 0) store(PRE_UPDATE_KEY, { savedAt: new Date().toISOString(), fromSchema: prev, json: backupJson() });
  store(SCHEMA_KEY, SCHEMA);
}
function renderPreUpdate() {
  const b = load(PRE_UPDATE_KEY, null), row = $('preupdate');
  row.classList.toggle('hide', !isObj(b) || typeof b.json !== 'string');
  if (isObj(b) && b.savedAt) $('preupdatehint').textContent = T('Automatisch angelegt am ', 'Created automatically on ') + dateGerman(localDay(new Date(b.savedAt)));
}
function markBackup() { store(KEYS.backup, localDay()); renderBackupBanner(); }
// Sicherung als lokale Datei: Teilen-Menü (iPhone: „In Dateien sichern“), Dateidialog oder Download – nie ein Server.
// Android lädt direkt herunter (Ordner „Downloads“): im Teilen-Menü fehlt dort je nach Gerät ein „Auf dem Gerät speichern“.
async function exportBackup() {
  const name = `tagwerk-backup-${localDay()}.json`, json = backupJson();
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && document.documentElement.dataset.os === 'ios') {
      await navigator.share({ files: [file], title: 'Tagwerk Backup' }); markBackup(); toast(T('Sicherung übergeben.', 'Backup handed over.')); return;
    }
    if (window.showSaveFilePicker) {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      const w = await h.createWritable(); await w.write(json); await w.close(); markBackup(); toast(T('In Datei gesichert.', 'Saved to file.')); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  download(name, json, 'application/json'); markBackup(); toast(T('Download gestartet – die Sicherung liegt gleich im Ordner „Downloads“.', 'Download started – the backup will be in your “Downloads” folder.'));
}
// Felder, die diese Version nicht kennt (z. B. aus einer neueren Sicherung), beim Import mitnehmen
const extraKeys = (e, known) => Object.fromEntries(Object.entries(e).filter(([k]) => !known.includes(k) && !['__proto__', 'constructor', 'prototype'].includes(k)));
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      // Sync-Datei gewählt: richtig abgleichen (inkl. Änderungen und Löschungen) statt nur Fehlendes zu ergänzen
      if (isObj(x) && x.kind === 'kb-tracker-sync') { syncApply(r.result); return; }
      let entries = Array.isArray(x) ? x : isObj(x) && Array.isArray(x.entries) ? x.entries : [];
      let wl = isObj(x) && Array.isArray(x.waist) ? x.waist : [];
      entries = entries.filter(validEntry).map(e => Object.assign({}, e, { id: String(e.id || `legacy-${e.plan}-${e.date}-${e.total}-${e.at || ''}`) }));
      wl = wl.filter(validWaist).map(e => Object.assign({}, e, { note: String(e.note || '').slice(0, 120) }));
      const rw = isObj(x) && Array.isArray(x.runWeeks) ? x.runWeeks.filter(validRunWeek) : [];
      const rl = isObj(x) && Array.isArray(x.runLog) ? x.runLog.filter(validRun) : [];
      const rc = isObj(x) && Array.isArray(x.races) ? x.races.filter(validRace) : [];
      const wg = isObj(x) && Array.isArray(x.weights) ? x.weights.filter(validWeight) : [];
      const rs = isObj(x) && Array.isArray(x.results) ? x.results.filter(validResult) : [];
      if (isObj(x) && isObj(x.weekSkip)) { for (const [k, v] of Object.entries(x.weekSkip)) if (isDay(k) && Array.isArray(v)) weekSkip[k] = [...new Set((weekSkip[k] || []).concat(v.filter(y => typeof y === 'string')))]; store(KEYS.skip, weekSkip); }
      // Lauf-Einstieg: der Stand mit mehr erledigten Einheiten gewinnt
      if (isObj(x) && isObj(x.starter)) { const a = normStarter(x.starter); if (a.log.length > getStarter().log.length) putStarter(a); }
      if (isObj(x) && Array.isArray(x.gymLog)) { const a = normGymLog(x.gymLog), have = new Set(getGymLog().map(e => e.d)); putGymLog(getGymLog().concat(a.filter(e => !have.has(e.d)))); }
      if (isObj(x) && Array.isArray(x.mobLog)) { const a = normMobLog(x.mobLog), have = new Set(getMobLog().map(e => e.d + '|' + e.t)); putMobLog(getMobLog().concat(a.filter(e => !have.has(e.d + '|' + e.t)))); }
      const settings = isObj(x) && isObj(x.settings) ? x.settings : null;
      if (!entries.length && !wl.length && !rw.length && !rl.length && !rc.length && !wg.length && !rs.length && !settings) throw Error(T('Keine gültigen Daten gefunden', 'No valid data found'));
      const ids = new Set(saved.map(e => String(e.id))); let added = 0, addedW = 0;
      for (const e of entries) if (!ids.has(e.id)) { saved.push(e); ids.add(e.id); added++; }
      const days = new Set(waist.map(e => e.date));
      for (const e of wl) if (!days.has(e.date)) { waist.push(e); days.add(e.date); addedW++; }
      // Laufwochen: vorhandene Wochen behalten, fehlende ergänzen
      const have = new Set(runWeeks.map(e => e.week)); let addedR = 0;
      for (const e of rw) if (!have.has(e.week)) { runWeeks.push(Object.assign(extraKeys(e, ['week', 'km', 'long']), { week: e.week, km: e.km ?? null, long: e.long ?? null })); have.add(e.week); addedR++; }
      runWeeks.sort((a, b) => a.week.localeCompare(b.week));
      const runIds = new Set(runLog.map(e => e.id)); let addedL = 0;
      for (const e of rl) if (!runIds.has(e.id)) { runLog.push(Object.assign(extraKeys(e, ['id', 'date', 'km', 'sec', 'hr', 'kind']), { id: e.id, date: e.date, km: e.km }, runExtra(e))); runIds.add(e.id); addedL++; }
      runLog.sort((a, b) => a.date.localeCompare(b.date));
      const raceIds = new Set(races.map(e => e.id)); let addedC = 0;
      for (const e of rc) if (!raceIds.has(e.id)) { races.push(Object.assign(extraKeys(e, ['id', 'name', 'date', 'dist', 'prio', 'goal', 'km', 'fmt', 'dns', 'level']), { id: e.id, name: e.name, date: e.date, dist: e.dist, prio: e.prio, goal: e.goal ?? null, km: e.km ?? null }, ...['fmt', 'dns', 'level'].filter(k => e[k] !== undefined).map(k => ({ [k]: e[k] })))); raceIds.add(e.id); addedC++; }
      const wdays = new Set(weights.map(e => e.date)); let addedG = 0;
      for (const e of wg) if (!wdays.has(e.date)) { weights.push(Object.assign(extraKeys(e, ['date', 'kg']), { date: e.date, kg: e.kg })); wdays.add(e.date); addedG++; }
      persistEntries(); persistWaist(); if (addedR) persistRunWeeks(); if (addedL) persistRunLog(); if (addedC) persistRaces(); if (addedG) persistWeight();
      const resIds = new Set(results.map(e => e.id)); let addedS = 0;
      for (const e of rs) if (!resIds.has(e.id)) { const o = Object.assign(extraKeys(e, ['id', 'date', 'km', 'time', 'dist', 'name', 'race']), { id: e.id, date: e.date, km: e.km, time: e.time, dist: e.dist ?? null }); if (e.name) o.name = e.name; if (typeof e.race === 'string') o.race = e.race; results.push(o); resIds.add(e.id); addedS++; }
      if (addedS) persistResults();
      if (settings && confirm(T('Das Backup enthält auch Einstellungen (Geräte, Varianten, Gewichte). Übernehmen?', 'The backup also contains settings (equipment, variants, weights). Apply them?'))) {
        if (isObj(settings.gear)) { gear = { kb: settings.gear.kb !== false, db: settings.gear.db !== false, band: settings.gear.band !== false, bw: settings.gear.bw !== false }; ensureGear(); store(KEYS.gear, gear); }
        if (isObj(settings.choices)) { choices = settings.choices; store(KEYS.choice, choices); }
        if (isObj(settings.stages)) { stages = settings.stages; store(KEYS.stage, stages); }
        if (isObj(settings.profile)) { Object.assign(profileExtra, extraKeys(settings.profile, ['hr', 'kit', 'week', 'yearKm', 'modules'])); profile = normProfile(settings.profile); persistProfile(); }
        if (isObj(settings.audio)) { audioOpt = { voice: settings.audio.voice !== false, loud: settings.audio.loud === true }; store(KEYS.audio, audioOpt); applyAudioSession(); }
        if (!sessionActive()) runReps = emptyReps(plan);
      }
      renderAll(); renderWaist(); renderWeight(); renderProfile(); renderRun();
      const skippedAny = entries.length - added + wl.length - addedW + rw.length - addedR + rl.length - addedL + rc.length - addedC + wg.length - addedG + rs.length - addedS > 0;
      alert(T(`${added} Trainings-, ${addedW} Bauchumfang-, ${addedR} Laufwochen- und ${addedL} Lauf-Einträge${addedC ? ` sowie ${addedC} Rennen` : ''}${addedG ? `, ${addedG} Gewichtswerte` : ''}${addedS ? `, ${addedS} Laufergebnisse` : ''} importiert.${skippedAny ? ' Bereits vorhandene Einträge wurden übersprungen.' : ''}`, `Imported ${added} workout, ${addedW} waist, ${addedR} run-week and ${addedL} run entries${addedC ? ` plus ${addedC} races` : ''}${addedG ? `, ${addedG} weight values` : ''}${addedS ? `, ${addedS} run results` : ''}.${skippedAny ? ' Existing entries were skipped.' : ''}`));
    } catch (e) { alert('Import fehlgeschlagen: ' + e.message); }
  };
  r.onerror = () => alert(T('Die Datei konnte nicht gelesen werden.', 'The file could not be read.'));
  r.readAsText(file);
}
function exportCsv() {
  const head = EN ? ['Date', 'Plan', 'Rounds', 'Extra exercises', 'Exercises or reps total', 'Comparable with current setup', 'Details', 'Effort (1-10)', 'Note'] : ['Datum', 'Plan', 'Runden', 'Weitere Übungen', 'Übungen bzw. Wdh. gesamt', 'Vergleichbar mit aktuellem Aufbau', 'Details', 'Anstrengung (1-10)', 'Notiz'];
  const rows = saved.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
    const cmp = comparable(e) ? T('ja', 'yes') : T('nein', 'no'), tail = [rpeOf(e) ?? '', typeof e.note === 'string' ? e.note : ''];
    if (e.mode === 'sets') {
      const det = e.v >= 3 ? e.sets.map((r, i) => `${e.names[i]}${e.stages && e.stages[i] ? ' (' + e.stages[i] + ')' : ''} ${cfgText(e.cfg[i])}: ${r.map(v => v ?? '-').join('/')}`).join(' | ') : resultText(e);
      return [e.date, PLANS[e.plan].short, '', '', e.total, cmp, det, ...tail];
    }
    if (e.mode === 'tabata' || e.mode === 'emom') return [e.date, PLANS[e.plan].short, '', '', e.total, cmp, resultText(e) + ' | ' + (e.names || []).join(' | '), ...tail];
    const n = entryCount(e), det = e.v >= 3 ? e.names.map((nm, i) => `${nm} ${cfgText(e.cfg[i])}`).join(' | ') : '';
    return [e.date, PLANS[e.plan].short, Math.floor(e.total / n), e.total % n, e.total, cmp, det, ...tail];
  });
  // Freitext nie als Formel interpretieren lassen (Tabellenprogramme)
  const cell = c => { const s = String(c).replace(/;/g, ',').replace(/\r?\n/g, ' '); return typeof c === 'string' && /^[=+\-@]/.test(s) ? "'" + s : s; };
  download(T('trainingstagebuch.csv', 'workout-log.csv'), '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportWaistCsv() {
  const days = [...new Set(weights.map(e => e.date).concat(waist.map(e => e.date)))].sort(), clean = t => String(t || '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
  const rows = [EN ? ['Date', 'Weight (kg)', 'Waist (cm)', 'Note'] : ['Datum', 'Gewicht (kg)', 'Bauchumfang (cm)', 'Notiz'], ...days.map(d => { const w = weights.find(e => e.date === d), b = waist.find(e => e.date === d); return [d, w ? kgOne(w.kg) : '', b ? cmString(b.cm) : '', clean((b && b.note) || (w && w.note))]; })];
  download(T('koerpermasse.csv', 'body-measurements.csv'), '﻿' + rows.map(r => r.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportWaistReminder() {
  const now = new Date(), next = new Date(now); next.setHours(8, 0, 0, 0); next.setDate(next.getDate() + (8 - next.getDay()) % 7); if (next <= now) next.setDate(next.getDate() + 7);
  const stamp = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  const until = new Date(next); until.setMinutes(until.getMinutes() + 5);
  const utc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tagwerk//Koerpermasse//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', 'UID:jan-bauchumfang-montag-0800@kb-tracker.local', 'DTSTAMP:' + utc, 'DTSTART;TZID=Europe/Berlin:' + stamp(next), 'DTEND;TZID=Europe/Berlin:' + stamp(until),
    'RRULE:FREQ=WEEKLY;BYDAY=MO', 'SUMMARY:' + T('Körpermaße messen', 'Measure body'), 'DESCRIPTION:' + T('Morgens vor dem Frühstück wiegen\\, Bauchumfang auf Nabelhöhe messen und in Tagwerk unter Profil eintragen.', 'Weigh yourself before breakfast\\, measure the waist at navel height and enter it in Tagwerk under Profile.'),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:' + T('Körpermaße messen', 'Measure body'), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  download('koerpermasse-erinnerung.ics', lines.map(icsFold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
}
// iCalendar: Zeilen nach 75 Bytes umbrechen, Text escapen
function icsFold(line) { const enc = new TextEncoder(); let out = '', cur = '', limit = 75; for (const ch of line) { if (enc.encode(cur + ch).length > limit) { out += cur + '\r\n '; cur = ''; limit = 74; } cur += ch; } return out + cur; }
const icsText = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDay = d => d.replace(/-/g, '');
// Saisonplan als Kalender: Woche ganztägig Mo–So, Longrun am Sonntag, Rennen am Renntag (A und B)
// Erinnerung für den Kalender-Export (je Gerät): aus oder Uhrzeit am Trainingstag; ganztägige Termine → Alarm relativ zu 0:00
let icsRemind = load(KEYS.icsremind, null);
icsRemind = { on: isObj(icsRemind) && icsRemind.on === true, time: isObj(icsRemind) && /^([01]\d|2[0-3]):[0-5]\d$/.test(icsRemind.time) ? icsRemind.time : '17:00' };
const icsAlarm = text => { if (!icsRemind.on) return []; const [h, m] = icsRemind.time.split(':').map(Number); return ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:PT${h}H${m}M`, 'DESCRIPTION:' + icsText(text), 'END:VALARM']; };
function planIcs(S = seasonPlan()) {
  const utc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), ev = [], today = localDay();
  const add = (uid, from, to, summary, desc, alarm = false) => ev.push('BEGIN:VEVENT', `UID:${uid}@kb-tracker.local`, 'DTSTAMP:' + utc, 'DTSTART;VALUE=DATE:' + icsDay(from), 'DTEND;VALUE=DATE:' + icsDay(to),
    'SUMMARY:' + icsText(summary), 'DESCRIPTION:' + icsText(desc), 'TRANSP:TRANSPARENT', ...(alarm ? icsAlarm(summary) : []), 'END:VEVENT');
  for (const x of S.weeks) {
    const [pl, pt] = SEASON.phase[phaseKey(x)], kv = kmRound(x.km), lv = kmRound(x.long);
    const sched = weekSchedule(x);
    add(`kb-plan-${x.week}`, x.week, addDays(x.week, 7), T(`Laufplan: ${pl}${kv ? ` · ca. ${kv} km` : ''}`, `Running plan: ${pl}${kv ? ` · approx. ${kv} km` : ''}`),
      [`${pl} – ${pt}`, ...sched.map(it => `${WD[it.d]}: ${it.title}${it.skip ? T(' (entfällt)', ' (skipped)') : it.detail ? ' – ' + it.detail : ''}`), T(`Ziel: ${x.target.name} am ${dateGerman(x.target.date)}`, `Goal: ${x.target.name} on ${dateGerman(x.target.date)}`)].join('\n'));
    for (const it of sched) {
      const day = addDays(x.week, dayIdx(it.d));
      if (it.kind === 'race' || it.kind === 'brace' || it.skip || day < today) continue;
      add(`kb-${/^x[1-9]/.test(it.key) ? it.kind + '-' + it.key : it.kind}-${day}`, day, addDays(day, 1), (it.kind === 'quality' || it.kind === 'quality2') && !it.easy && !x.test ? T(`Qualität: ${it.detail}`, `Quality: ${it.detail}`) : it.title, it.detail, true);
    }
  }
  for (const r of races.filter(r => r.date >= today)) add(`kb-race-${r.id}`, r.date, addDays(r.date, 1), `🏁 ${r.name} (${raceLabel(r)})`,
    [T(`${r.prio}-Rennen`, `${r.prio} race`), r.fmt ? goalInfo(r) : r.goal ? T(`Zielzeit ${hms(r.goal)} = ${paceText(r.goal, raceKm(r))}`, `Goal time ${hms(r.goal)} = ${paceText(r.goal, raceKm(r))}`) : '', T('Warm-up: Tagwerk → Laufen → Warm-up', 'Warm-up: Tagwerk → Running → Warm-up')].filter(Boolean).join('\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tagwerk//Laufplan//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + T('Laufplan', 'Running plan'), ...ev, 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}
function exportPlanIcs() {
  const S = seasonPlan(); if (!S.weeks.length) { toast(T('Zuerst ein A-Rennen eintragen.', 'Enter an A race first.')); return; }
  download(`laufplan-${localDay()}.ics`, planIcs(S), 'text/calendar;charset=utf-8'); toast(T('Kalenderdatei erstellt – in den Kalender „Laufplan“ importieren.', 'Calendar file created – import it into the “Running plan” calendar.'));
}

/* ---------- Hinweise: Backup & Home-Bildschirm ---------- */
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function renderBackupBanner() {
  const last = load(KEYS.backup, null), limit = new Date(); limit.setDate(limit.getDate() - 14);
  const due = saved.length + waist.length > 0 && (!last || last < localDay(limit));
  let html = '';
  // Wer den Sync nutzt, bekommt die Sync-Datei angeboten – mit dem gemerkten Ort, wohin sie gehört
  let sync = false; try { sync = !!(syncMeta.lastSave || syncMeta.place); } catch (e) { } // syncMeta gibt es erst nach dem Laden
  if (due) html += `<div class="banner"><span class="bicon">💾</span><span>${last ? T(`Letzte Sicherung am ${dateGerman(last)}.`, `Last backup on ${dateGerman(last)}.`) : T('Noch keine Sicherung.', 'No backup yet.')} ${sync ? (syncMeta.place ? T(`Sync-Datei speichern nach „${esc(syncMeta.place)}“.`, `Save the sync file to “${esc(syncMeta.place)}”.`) : T('Sync-Datei speichern.', 'Save the sync file.')) : T('Die Daten liegen nur auf diesem Gerät.', 'The data is only on this device.')}</span><button class="btn small primary" type="button" id="${sync ? 'syncnow' : 'backupnow'}">${sync ? T('Sync', 'Sync') : T('Sichern', 'Back up')}</button></div>`;
  $('banners').innerHTML = html;
}
// Im Handy-Browser (nicht als App geöffnet) dauerhaft ganz oben in jedem Bereich: Hinweis zum Installieren mit Link zur Anleitung.
// Nicht wegklickbar – im Browser drohen getrennte bzw. gelöschte Daten. Während eines laufenden Trainings ausgeblendet.
function renderInstallBar() {
  const os = document.documentElement.dataset.os, el = $('installbar');
  if ((os !== 'ios' && os !== 'android') || standalone()) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="banner installbanner" role="note"><span class="bicon">📲</span><span class="itxt"><b>${T('Als App installieren', 'Install as an app')}</b> <small>${os === 'ios'
    ? T('„Teilen“ → „Zum Home-Bildschirm“', '“Share” → “Add to Home Screen”')
    : T('Chrome-Menü ⋮ → „App installieren“', 'Chrome menu ⋮ → “Install app”')} · <button type="button" class="linkbtn" id="installguide">${T('Anleitung', 'Guide')}</button></small></span></div>`;
}
function openInstallGuide() {
  showArea('mehr');
  const s = $('sect-guide'), d = $('guide-install');
  sectState.mehr = 'sect-guide'; store(KEYS.sections, sectState);
  s.open = true; d.open = true;
  requestAnimationFrame(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
async function renderStorageInfo() {
  let txt = standalone() ? T('Läuft als Home-Bildschirm-App.', 'Running as a home screen app.') : T('Läuft im Browser.', 'Running in the browser.');
  try { if (navigator.storage && navigator.storage.persisted) txt += (await navigator.storage.persisted()) ? T(' Speicher ist als dauerhaft markiert.', ' Storage is marked as persistent.') : T(' Speicher ist nicht als dauerhaft markiert – regelmäßig Backups exportieren.', ' Storage is not marked as persistent – export backups regularly.'); } catch (e) { }
  $('storageinfo').textContent = txt;
}

/* ---------- Anleitung ---------- */
const guide = $('guide'); let guideOrigin = null;
/* Anleitung während des Trainings: folgt der aktuellen Übung (auch wenn die Zeit weiterschaltet – Aufwärmen, Cooldown,
   Halteübungen, Intervalle) und hat unten „Erledigt – weiter“ bzw. „Nächste Übung“, ohne die Anleitung erst zu schließen. */
let guideFollow = false, guideKey = '', guideIdx = null;
function guideTarget() {
  if (!sessionActive() || sessionSaved || isFinished()) return null;
  if (phase === 1 && isInterval()) { const sg = currentSeg(); return { kind: 'ex', i: segShown(sg), auto: true }; }
  if (phase === 1) return isSets() ? null : { kind: 'ex', i: Number($('current').dataset.index || 0) };
  const s = currentStep(); return s ? { kind: 'step', s } : null;
}
const guideKeyOf = t => !t ? '' : t.kind === 'ex' ? `ex${t.i}:${(exList()[t.i] || {}).name}` : `st${phase}:${t.s.group}:${t.s.base}`;
function guideFootHtml(t) {
  if (!t) return '';
  if (t.kind === 'ex' && t.auto) return `<p class="guideauto">${T('Läuft automatisch weiter – die Anleitung zeigt immer die aktuelle Übung.', 'Moves on automatically – the guide always shows the current exercise.')}</p>`;
  if (t.kind === 'ex' && timed) return `<p class="guideauto">${T('● Zeitübung läuft – geht automatisch zur nächsten Übung.', '● Timed exercise running – moves to the next exercise automatically.')}</p>`;
  if (t.kind === 'ex') return `<button type="button" class="btn primary" data-gact="done"${running ? '' : ' disabled'}>${T('✓ Erledigt – nächste Übung', '✓ Done – next exercise')}</button>${running ? '' : `<p class="guideauto">${T('Erst das Training starten (▶).', 'Start the workout first (▶).')}</p>`}`;
  return `<button type="button" class="btn" data-gact="step">${T('Nächste Übung →', 'Next exercise →')}</button>`;
}
function guideSync() {
  if (!guideFollow || !guide.open) return;
  const t = guideTarget(); if (!t) { $('guide-foot').innerHTML = ''; return; }
  const k = guideKeyOf(t);
  if (k !== guideKey) { if (t.kind === 'ex') openExerciseGuide(t.i, guideOrigin); else openGuide(t.s.base, 'bw', { origin: guideOrigin }); return; }
  const f = guideFootHtml(t); if ($('guide-foot').dataset.html !== f) { $('guide-foot').innerHTML = f; $('guide-foot').dataset.html = f; }
}
// Aufwärmen/Cooldown: zum Ende des aktuellen Schritts springen (Schritt-Anleitung hat keinen Übungs-Index)
function skipStep() { const s = currentStep(); if (!s) return; const left = Math.max(0, s.end - secNow()); if (running) startedAt -= left * 1000; else elapsed += left; tick(); }
function openGuide(name, g, opts = {}) {
  const info = GUIDES[name]; if (!info) return;
  guideOrigin = opts.origin || guideOrigin || null;
  $('guide-title').textContent = tr(name);
  let extra = '';
  const sl = opts.slot;
  if (opts.lvls) extra += `<h3>${T('Leichter oder schwerer', 'Easier or harder')}</h3><ol class="stagelist">${[['leicht', tr(opts.lvls[0])], ['mittel', T('Ausführung wie oben beschrieben', 'As described above')], ['schwer', tr(opts.lvls[1])]].map(([v, t]) => `<li class="${v === opts.lvl ? 'cur' : ''}"><b>${esc(LVL_LABEL[v])}${v === opts.lvl ? T(' (gewählt)', ' (selected)') : ''}</b> – ${esc(t)}</li>`).join('')}</ol><p>${T('Die Stufe stellst du unter <b>Übungen &amp; Varianten</b> ein. Schaffst du die Wiederholungen sauber und locker, eine Stufe hoch; klappt die Übung nicht sauber, eine runter.', 'Set the level under <b>Exercises &amp; variants</b>. If the reps feel clean and easy, go up a level; if the exercise does not work cleanly, go down one.')}</p>`;
  if (sl && sl.stages) extra += `<h3>${T('Stufen &amp; Progression', 'Stages &amp; progression')}</h3><ol class="stagelist">` + sl.stages.map(s => `<li class="${s === opts.stage ? 'cur' : ''}"><b>${esc(tr(s))}${s === opts.stage ? T(' (gewählt)', ' (selected)') : ''}</b> – ${esc(STAGE_INFO[s] || '')}</li>`).join('') + `</ol><p>${T('Erst eine Stufe weiter, wenn alle Sätze mit 15 sauberen Wiederholungen klappen. Auf der neuen Stufe wieder bei etwa 8 Wiederholungen beginnen.', 'Only move up a stage when all sets work with 15 clean reps. On the new stage start again at about 8 reps.')}</p>`;
  if (sl && sl.stages && sl.stages.some(s => /Tempo/.test(s))) extra += `<h3>${T('Was heißt Tempo 3-1-1?', 'What does tempo 3-1-1 mean?')}</h3><p class="guidecue">${esc(tr(TEMPO_TEXT))}</p>`;
  if (sl && sl.emom) extra += `<h3>${T('Was heißt EMOM?', 'What does EMOM mean?')}</h3><p>${esc(tr(EMOM_TEXT))}</p>`;
  if (g === 'band') extra += `<h3>${T('Bänder', 'Bands')}</h3><p>${esc(tr(BAND_TEXT))}</p>`;
  if (opts.emomPlan) extra += `<h3>${T('So läuft EMOM', 'How EMOM works')}</h3><p>${esc(tr(EMOM_PLAN_TEXT))}</p>`;
  if (opts.tabata) extra += `<h3>${T('So läuft Tabata', 'How Tabata works')}</h3><p>${esc(tr(TABATA_TEXT))}</p><p class="guidecue">${T('In 20 Sekunden zählt Qualität: lieber eine Wiederholung weniger als eine unsaubere.', 'In 20 seconds quality counts: better one rep less than a sloppy one.')}</p>`;
  $('guide-body').innerHTML = (opts.gearText ? `<span class="guidegear">${esc(opts.gearText)}${opts.reps ? ' · ' + esc(tr(opts.reps)) : ''}</span>` : '') + renderFigure(name, g || 'kb') +
    `<p class="guidecaption">${T('Schematische Skizze. Maßgeblich sind die Hinweise unten.', 'Schematic sketch. The notes below are what counts.')}</p><h3>${T('So geht’s', 'How to')}</h3><ol>` + info.steps.map(t => `<li>${esc(t)}</li>`).join('') +
    `</ol><h3>${T('Das trainierst du', 'What it trains')}</h3><p>${esc(info.effect)}</p><h3>${T('Darauf achten', 'Watch out for')}</h3><p class="guidecue">${esc(info.cue)}</p>${extra}<p class="guidecaption">${T('Ruhig weiteratmen. Kontrolliert und im angenehmen Umfang ausführen; bei Schmerzen abbrechen.', 'Keep breathing calmly. Move under control and within a comfortable range; stop if it hurts.')}</p>`;
  const t = guideFollow ? guideTarget() : null; guideKey = guideKeyOf(t);
  const f = guideFootHtml(t); $('guide-foot').innerHTML = f; $('guide-foot').dataset.html = f;
  if (!guide.open) { guide.showModal(); $('guide-title').focus(); }
  guide.scrollTop = 0; $('guide-body').scrollTop = 0;
}
function openExerciseGuide(i, origin) {
  const x = exList()[i]; if (!x) return; guideIdx = i;
  const st = stageOf(plan, x.slot), name = x.slot.stages && /^Bulgarian/.test(st || '') ? 'Bulgarian Split Squat' : x.name;
  openGuide(name, x.g, { origin, slot: x.slot, stage: st, lvls: x.lvls, lvl: x.lvl, gearText: x.gearText, reps: isTabata() ? tabataCfg().rounds + T(' × 20 Sek.', ' × 20 sec') : x.reps, tabata: isTabata(), emomPlan: isEmomPlan() });
}

// Plan ohne passende Geräte (z. B. Kettlebell entfernt): zurück zum Ganzkörper-Plan, sofern gerade nichts läuft
function ensurePlanOwned() { if (!planOwned(plan) && !sessionActive()) { plan = 'wed'; store(KEYS.plan, plan); resetState(); } }
function renderAll() {
  ensurePlanOwned(); applyModules(); renderTabs(); renderGear(); renderHeader(); renderPhase(); renderList(); renderSettings(); renderHistory(); renderManual(); renderBackupBanner(); renderInstallBar(); renderWeek(); if (area === 'start') renderStart();
}

/* ---------- Bereiche: Kraft, Laufen, Mobility, Mehr ---------- */
const AREAS = ['start', 'kraft', 'laufen', 'mobility', 'profil', 'mehr'];
let area = AREAS.includes(load(KEYS.area, 'kraft')) ? load(KEYS.area, 'kraft') : 'kraft';
// Warm-up: Renntag (5 km bis Marathon) und Training (Intervall, Speed, Longrun) in einem Reiter; frühere Auswahl „Wettkampf“/„Training“ wird übernommen
const WARMUPS = RUN_GUIDE.race.concat(RUN_GUIDE.training);
let runView = load(KEYS.run, null); if (!isObj(runView)) runView = {};
{ const old = runView.tab === 'training' ? runView.training : runView.tab === 'race' ? runView.race : null, tab = ['race', 'training'].includes(runView.tab) ? 'warmup' : runView.tab;
  runView = { tab: ['warmup', 'abc', 'umfang', 'plan'].includes(tab) ? tab : 'plan', warmup: WARMUPS.some(w => w.id === (old || runView.warmup)) ? (old || runView.warmup) : '5k', plan: ['woche', 'rennen', 'bestzeiten', 'wissen'].includes(runView.plan) ? runView.plan : 'woche' }; }
function showArea(a, scroll = true) {
  area = a; store(KEYS.area, a);
  for (const x of AREAS) $('area-' + x).classList.toggle('hide', x !== a);
  // Mehr hat keinen eigenen Reiter mehr (Kachel auf der Startseite) – dort ist „Start“ markiert
  for (const b of $('tabbar').children) b.setAttribute('aria-selected', String(b.dataset.area === (a === 'mehr' ? 'start' : a)));
  document.body.classList.toggle('onstart', a === 'start');
  if (a === 'start') renderStart();
  const bar = a === 'kraft';
  $('actionbar').classList.toggle('hide', !bar);
  document.body.style.setProperty('--actbar', bar ? '66px' : '0px');
  renderLivePill();
  if (scroll) window.scrollTo({ top: 0 });
  if (a === 'kraft') fitTabs();
}
function renderLivePill() {
  const pill = $('livepill'), show = area !== 'kraft' && sessionActive();
  pill.classList.toggle('hide', !show);
  document.body.style.setProperty('--actbar', area === 'kraft' ? '66px' : show ? '52px' : '0px');
  if (show) pill.textContent = (running ? '● ' : 'Ⅱ ') + PLANS[plan].tab + ' · ' + (isFinished() ? T('speichern', 'save') : clock(durationSecs() - secNow()));
}
const stepRow = (dur, name, detail) => {
  const has = !!GUIDES[name];
  return `<${has ? 'button type="button"' : 'div'} class="row" ${has ? `data-guide-name="${esc(name)}"` : ''}><span class="dur">${esc(tr(dur))}</span><span class="txt"><b>${esc(tr(name))}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</span>${has ? '<span class="chev"></span>' : ''}</${has ? 'button' : 'div'}>`;
};
function renderRun() {
  const tabs = [['plan', 'Plan'], ['warmup', 'Warm-up'], ['abc', T('Lauf-ABC', 'Drills')], ['umfang', T('Umfang', 'Volume')]];
  $('runtabs').innerHTML = tabs.map(([k, l]) => `<button role="tab" type="button" data-runtab="${k}" aria-selected="${runView.tab === k}">${l}</button>`).join('');
  const sub = $('runsub');
  $('runsub').classList.remove('warmupsub');
  if (runView.tab === 'plan') { renderPlan(); return; }
  if (runView.tab === 'umfang') { sub.classList.add('hide'); $('runcontent').innerHTML = renderUmfang(); renderWeekRows(); renderLoad(); return; }
  if (runView.tab === 'abc') {
    sub.classList.add('hide');
    $('runcontent').innerHTML = `<div class="intro">${esc(RUN_GUIDE.abc.intro)}</div><div class="header">${T('Übungen', 'Exercises')}<button type="button" class="hdrbtn" data-routine="abc">${T('▶ Geführt', '▶ Guided')}</button></div><div class="group">${RUN_GUIDE.abc.drills.map(d => stepRow(...d)).join('')}</div><p class="footer">${T('Bei Beschwerden in Fuß oder Wade Sprungübungen (Hopserlauf, Seitgalopp) auslassen.', 'With foot or calf complaints skip the jumping drills (bounding skips, side gallop).')}</p>`;
    return;
  }
  const cur = runCurrent(), btn = r => `<button role="tab" type="button" data-runsub="${r.id}" aria-selected="${r.id === cur.id}">${esc(r.label)}</button>`;
  sub.classList.remove('hide');
  sub.innerHTML = `<span class="sublabel">${T('Renntag', 'Race day')}</span>${RUN_GUIDE.race.map(btn).join('')}<span class="sublabel">Training</span>${RUN_GUIDE.training.map(btn).join('')}`;
  sub.classList.add('warmupsub');
  $('runcontent').innerHTML = `<div class="intro">${esc(cur.intro)}</div>
    <div class="header">Warm-up<button type="button" class="hdrbtn" data-routine="warmup">${T('▶ Geführt', '▶ Guided')}</button></div><div class="group">${cur.warmup.map(x => stepRow(...x)).join('')}</div>
    <div class="header">Cooldown<button type="button" class="hdrbtn" data-routine="cooldown">${T('▶ Geführt', '▶ Guided')}</button></div><div class="group">${cur.cooldown.map(x => stepRow(...x)).join('')}</div>
    <p class="footer">${T('Zeiten sind Richtwerte. „Geführt“ startet einen Ablauf mit Countdown und Ansage; Strecken und Wiederholungen hakst du selbst ab. Am Wettkampftag nichts Neues ausprobieren – den Ablauf vorher im Training testen.', 'Times are guidelines. “Guided” starts a sequence with countdown and voice; you tick off distances and reps yourself. Try nothing new on race day – test the sequence in training first.')}</p>`;
}
// Reiter wie bei Laufen: oben Läufer / Alltag / Übungen, darunter das Programm bzw. der Körperbereich
const mobOptions = tab => tab === 'uebungen' ? MOBILITY.regions.map(([id, label]) => ({ id, label })) : MOBILITY.routines.filter(r => r.tab === tab);
let mobView = load(KEYS.mob, null); if (!isObj(mobView)) mobView = {};
mobView.tab = MOBILITY.tabs.some(t => t[0] === mobView.tab) ? mobView.tab : MOBILITY.tabs[0][0];
for (const [t] of MOBILITY.tabs) if (!mobOptions(t).some(o => o.id === mobView[t])) mobView[t] = mobOptions(t)[0].id;
function renderMobility() {
  const tab = mobView.tab, opts = mobOptions(tab), cur = opts.find(o => o.id === mobView[tab]) || opts[0];
  $('mobtabs').innerHTML = MOBILITY.tabs.map(([k, l]) => `<button role="tab" type="button" data-mobtab="${k}" aria-selected="${tab === k}">${l}</button>`).join('');
  $('mobsub').innerHTML = opts.map(o => `<button role="tab" type="button" data-mobsub="${o.id}" aria-selected="${o.id === cur.id}">${esc(o.label)}</button>`).join('');
  let h;
  if (tab === 'uebungen') {
    h = MOBILITY.groups.filter(g => g.region === cur.id).map((g, i) => `<div class="header"${i ? '' : ' style="margin-top:6px"'}>${esc(g.title)}</div><div class="group">${g.items.map(s => stepRow(s[0], s[1], '')).join('')}</div>`).join('');
    h += `<p class="footer">${T('Dehnen und mobilisieren im angenehmen Bereich – ziehen ja, Schmerz nein. Ruhig weiteratmen.', 'Stretch and mobilise within a comfortable range – pulling yes, pain no. Keep breathing calmly.')}</p>`;
  } else {
    const i = MOBILITY.routines.indexOf(cur);
    h = `<div class="intro">${esc(cur.intro)}</div><div class="group" style="margin-top:12px"><div class="row"><span class="txt"><b style="font-weight:600">${esc(cur.title)}</b><small>${esc(tr(cur.time))} · ${T('Countdown, Seitenwechsel und Ansage', 'countdown, side changes and voice')}</small></span><button type="button" class="btn small primary" data-mob="${i}">${T('▶ Starten', '▶ Start')}</button></div>${cur.steps.map(s => stepRow(s[0], s[1], '')).join('')}</div>`;
    h += `<p class="footer">${T('Zeiten laufen automatisch weiter, Wiederholungen hakst du mit „Erledigt“ ab. Ziehen ja, Schmerz nein – ruhig weiteratmen.', 'Timed steps continue automatically, you tick off reps with “Done”. Pulling yes, pain no – keep breathing calmly.')}</p>`;
  }
  $('mobcontent').innerHTML = h;
}

/* ---------- Routine-Timer für Laufen und Mobility (ohne Tracking) ---------- */
const routineDlg = $('routine'); let rt = null;
// Zeitangaben laufen automatisch (bei Bereichen die kürzere Zeit), Strecken und Wiederholungen werden abgehakt
function routineStep([label, name, detail = '']) {
  const L = String(label || ''), perSide = /je Seite/.test(L), guide = !!GUIDES[name]; let secs = null, m;
  if ((m = L.match(/^(\d+):(\d{2})\s*Min\./))) secs = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = L.match(/^(\d+)(?:\s*[–-]\s*\d+)?\s*Min\./))) secs = Number(m[1]) * 60;
  else if ((m = L.match(/^(\d+)(?:\s*[–-]\s*\d+)?\s*Sek\./))) secs = Number(m[1]);
  if (secs && !guide && secs > 300) secs = null; // z. B. Essen oder Beine hochlegen: nur abhaken
  const sides = perSide || (secs && SIDED.has(name) && secs >= 40) ? 2 : 1;
  return { label: L, name, detail, guide, sides, secs: secs && !perSide && sides === 2 ? Math.round(secs / 2) : secs };
}
const rtStep = () => rt.steps[rt.i];
const rtElapsed = () => rt.acc + (rt.running ? (Date.now() - rt.since) / 1000 : 0);
const rtPart = () => { const s = rtStep(); return Math.min(s.sides - 1, Math.floor(rtElapsed() / s.secs)); };
const rtRemaining = () => { const s = rtStep(), p = rtPart(); return (p === s.sides - 1 ? s.secs * s.sides + rt.extra : (p + 1) * s.secs) - rtElapsed(); };
const durWords = n => { const m = Math.floor(n / 60), s = n % 60; return (m ? (EN ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : `${m} ${m === 1 ? 'Minute' : 'Minuten'}`) : '') + (m && s ? ' ' : '') + (s ? T(`${s} Sekunden`, `${s} seconds`) : ''); };
const rtSpeech = s => tr(s.name) + (s.secs ? ', ' + durWords(s.secs) + (s.sides === 2 ? T(' je Seite, links beginnen', ' per side, start left') : '') : s.label ? ', ' + tr(s.label) : '');
function startRoutine(title, items, onDone = null) {
  if (rt || !items.length) return;
  if (running) { if (!confirm(T('Das Kraft-Training läuft gerade. Pausieren und die Routine starten?', 'The strength workout is running. Pause it and start the routine?'))) return; play(); }
  audioReady();
  rt = { title, steps: items.map(routineStep), i: 0, acc: 0, since: Date.now(), running: true, extra: 0, lastSec: null, lastPart: 0, done: false, onDone };
  keepAwake(true); cue('phase'); say(title + '. ' + rtSpeech(rt.steps[0]), 650);
  routineDlg.showModal(); renderRoutine(); $('rt-title').focus();
}
function rtGo(i) {
  if (!rt) return;
  if (i >= rt.steps.length) { rt.done = true; rt.running = false; cue('finish'); say(T('Geschafft. Gut gemacht!', 'Done. Well done!'), 900); keepAwake(false); renderRoutine(); const f = rt.onDone; rt.onDone = null; if (f) f(); return; }
  Object.assign(rt, { i: Math.max(0, i), acc: 0, since: Date.now(), running: true, extra: 0, lastSec: null, lastPart: 0, done: false });
  keepAwake(true); say(rtSpeech(rtStep())); renderRoutine();
}
function routineTick() {
  if (!rt || rt.done || !rt.running || !rtStep().secs) return;
  const s = rtStep();
  if (rtElapsed() >= s.secs * s.sides + rt.extra) { cue('step'); rtGo(rt.i + 1); return; }
  const p = rtPart();
  if (p !== rt.lastPart) { rt.lastPart = p; cue('step'); say(T('Seitenwechsel', 'Switch sides')); renderRoutine(); }
  const sec = Math.ceil(rtRemaining());
  if (sec !== rt.lastSec) { rt.lastSec = sec; if (sec >= 1 && sec <= 3) cue('count'); }
  renderRoutineClock();
}
function renderRoutineClock() {
  if (!rt || rt.done) return;
  const s = rtStep(); if (!s.secs) return;
  $('rt-clock').textContent = clock(rtRemaining());
  $('rt-side').textContent = s.sides === 2 ? (rtPart() === 0 ? T('Linke Seite', 'Left side') : T('Rechte Seite', 'Right side')) : '';
}
function renderRoutine() {
  if (!rt) return;
  const n = rt.steps.length, s = rtStep(), nx = rt.steps[rt.i + 1], timedStep = !rt.done && !!s.secs;
  $('rt-title').textContent = rt.title;
  $('rt-count').textContent = rt.done ? T(`${n} von ${n} geschafft`, `${n} of ${n} done`) : T(`Schritt ${rt.i + 1} von ${n}`, `Step ${rt.i + 1} of ${n}`);
  $('rt-bar').style.width = (rt.done ? 100 : rt.i / n * 100) + '%';
  $('rt-name').textContent = rt.done ? T('Geschafft!', 'Done!') : tr(s.name);
  $('rt-detail').textContent = rt.done ? T('Routine beendet. Gut gemacht.', 'Routine finished. Well done.') : [tr(s.label), s.detail].filter(Boolean).join(' · ') || ' ';
  $('rt-clock').classList.toggle('hide', !timedStep);
  $('rt-side').classList.toggle('hide', !timedStep || s.sides !== 2);
  $('rt-manual').classList.toggle('hide', rt.done || timedStep);
  $('rt-manual').textContent = T('Im eigenen Tempo – danach „Erledigt“ tippen.', 'At your own pace – then tap “Done”.');
  const main = $('rt-main');
  main.textContent = rt.done ? T('Schließen', 'Close') : !timedStep ? T('✓ Erledigt', '✓ Done') : rt.running ? T('Ⅱ Pause', 'Ⅱ Pause') : T('▶ Weiter', '▶ Resume');
  $('rt-prev').disabled = rt.done || rt.i === 0;
  $('rt-next').disabled = rt.done;
  $('rt-plus').classList.toggle('hide', !timedStep || s.secs * s.sides < 180);
  $('rt-guide').classList.toggle('hide', rt.done || !s.guide);
  $('rt-fig').innerHTML = !rt.done && s.guide ? renderFigure(s.name, 'bw') : '';
  $('rt-next-info').textContent = rt.done ? '' : nx ? T(`Danach: ${nx.name}${nx.label ? ' · ' + nx.label : ''}`, `Next: ${tr(nx.name)}${nx.label ? ' · ' + tr(nx.label) : ''}`) : T('Danach: fertig', 'Next: finished');
  renderRoutineClock();
}
function stopRoutine() { rt = null; if (!running) keepAwake(false); }
const runCurrent = () => runView.tab === 'warmup' ? WARMUPS.find(r => r.id === runView.warmup) || WARMUPS[0] : null;

/* ---------- Anstrengung (1–10) & Notiz je Einheit ---------- */
const RPE_TEXT = EN ? ['', 'very easy', 'very easy', 'easy', 'easy', 'moderate', 'challenging', 'hard', 'hard', 'very hard', 'maximal'] : ['', 'sehr leicht', 'sehr leicht', 'leicht', 'leicht', 'mittel', 'fordernd', 'hart', 'hart', 'sehr hart', 'maximal'];
const rateDlg = $('rate'); let rateId = null, rateVal = null;
function openRate(id, notes = null) {
  const e = saved.find(x => String(x.id) === String(id)); if (!e) return;
  rateId = String(e.id); rateVal = rpeOf(e);
  $('rate-title').textContent = notes ? T('Einheit gespeichert', 'Session saved') : T('Einheit bewerten', 'Rate session');
  $('rate-summary').textContent = `${PLANS[e.plan].label} · ${dateGerman(e.date)} · ${resultText(e)}`;
  $('rate-progress').innerHTML = notes && notes.length ? `<ul class="progresslist">${notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  $('ratenote').value = typeof e.note === 'string' ? e.note : '';
  renderRpe();
  if (!rateDlg.open) rateDlg.showModal();
}
function renderRpe() {
  $('rpe').innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(v => `<button type="button" role="radio" aria-checked="${v === rateVal}" aria-label="${v} – ${RPE_TEXT[v]}" data-rpe="${v}">${v}</button>`).join('');
  $('rpe-text').textContent = rateVal ? `${rateVal} = ${RPE_TEXT[rateVal]}` : T('1 = sehr leicht · 5 = mittel · 8 = hart · 10 = maximal', '1 = very easy · 5 = moderate · 8 = hard · 10 = maximal');
}
function saveRate() {
  const e = saved.find(x => String(x.id) === rateId);
  if (e) {
    if (rateVal) e.rpe = rateVal; else delete e.rpe;
    const n = $('ratenote').value.trim().slice(0, 200); if (n) e.note = n; else delete e.note;
    persistEntries(); renderHistory(); renderStats(); renderWeek();
  }
  rateDlg.close();
}

/* ---------- Wochenübersicht ---------- */
function weekStart(day) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return localDay(d); }
function isoWeek(day) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return localDay(d); };
const WEEKDAY = WD;
function renderWeek() {
  const cur = weekStart(localDay()), byWeek = new Map();
  for (const e of saved) { const w = weekStart(e.date); byWeek.set(w, (byWeek.get(w) || []).concat(e)); }
  const now = (byWeek.get(cur) || []).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.at || '').localeCompare(String(b.at || '')));
  const rated = now.map(rpeOf).filter(Boolean);
  let streak = 0, w = byWeek.has(cur) ? cur : addDays(cur, -7);
  while (byWeek.has(w)) { streak++; w = addDays(w, -7); }
  $('weekcount').textContent = String(now.length);
  $('weekrange').textContent = `${T('KW', 'Wk')} ${isoWeek(cur)} · ${dateShort(cur)}–${dateShort(addDays(cur, 6))}`;
  $('weekrpe').textContent = rated.length ? NUM1.format(rated.reduce((a, b) => a + b, 0) / rated.length) : '–';
  $('weekstreak').textContent = String(streak);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(cur, (i - 7) * 7)), counts = weeks.map(x => (byWeek.get(x) || []).length);
  // Kompaktes Diagramm: schmale viewBox, damit die Beschriftung auf dem Handy lesbar bleibt
  const max = Math.max(2, ...counts), wd = 360, base = 112, l = 4, step = (wd - l * 2) / 8, bw = Math.min(30, step * 0.62);
  $('weekchart').innerHTML = `<svg class="chart" viewBox="0 0 ${wd} 134" role="img" aria-label="${T('Einheiten pro Woche, letzte 8 Wochen: ', 'Sessions per week, last 8 weeks: ')}${counts.join(', ')}"><line class="axis" x1="${l}" y1="${base}" x2="${wd - l}" y2="${base}"/>${weeks.map((x, i) => {
    const xx = l + step * i + (step - bw) / 2, hh = counts[i] ? Math.max(4, counts[i] / max * (base - 22)) : 0;
    return `${hh ? `<rect class="bar" x="${xx}" y="${base - hh}" width="${bw}" height="${hh}" rx="5" opacity="${x === cur ? 1 : 0.55}"><title>${T('KW', 'Wk')} ${isoWeek(x)}: ${counts[i]} ${T('Einheiten', 'sessions')}</title></rect>` : ''}<text class="val" x="${xx + bw / 2}" y="${base - hh - 5}" text-anchor="middle" font-size="12">${counts[i] || ''}</text><text class="lbl" x="${xx + bw / 2}" y="129" text-anchor="middle" font-size="10.5"${x === cur ? ' font-weight="700"' : ''}>${T('KW', 'Wk')}${isoWeek(x)}</text>`;
  }).join('')}</svg>`;
  $('weeklist').innerHTML = now.length ? now.map(e => { const d = new Date(e.date + 'T12:00:00'), r = rpeOf(e), note = typeof e.note === 'string' ? e.note.trim() : ''; return `<div class="row"><span class="dur">${WEEKDAY[d.getDay()]} ${dateShort(e.date)}</span><span class="txt"><b>${esc(PLANS[e.plan].label)}</b><small>${esc(resultText(e))}${r ? T(` · Anstrengung ${r}/10`, ` · effort ${r}/10`) : ''}${note ? ' · ' + esc(note) : ''}</small></span></div>`; }).join('')
    : `<div class="row"><span class="txt"><small>${T('Diese Woche noch keine Kraft-Einheit gespeichert.', 'No strength session saved this week yet.')}</small></span></div>`;
}

/* ---------- Einstellungen: Ton & Ansagen ---------- */
function renderAudioRows() {
  const vOk = speechOk();
  $('soundval').textContent = soundEnabled ? T('An', 'On') : T('Aus', 'Off');
  $('voiceval').textContent = vOk ? (audioOpt.voice ? T('An', 'On') : T('Aus', 'Off')) : T('Nicht verfügbar', 'Not available');
  $('voicehint').textContent = vOk ? T(`Übung, Seitenwechsel, Runden · Stimme: ${voice.name}`, `Exercise, side changes, rounds · voice: ${voice.name}`) : T('Keine deutsche Stimme auf dem Gerät gefunden. Online-Stimmen werden aus Datenschutzgründen nicht genutzt.', 'No English voice found on the device. Online voices are not used for privacy reasons.');
  $('voicerow').disabled = !vOk;
  $('sum-tone').textContent = `${T('Ton', 'Sound')} ${soundEnabled ? T('an', 'on') : T('aus', 'off')} · ${T('Ansagen', 'Voice')} ${vOk && audioOpt.voice ? T('an', 'on') : T('aus', 'off')}`;
  $('loudrow').classList.toggle('hide', !hasAudioSession());
  $('loudval').textContent = audioOpt.loud ? T('An', 'On') : T('Aus', 'Off');
}
/* ---------- Ereignisse ---------- */
window.addEventListener('resize', () => fitTabs());
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (b) setPlan(b.dataset.plan); });
$('gearbar').addEventListener('click', e => {
  const b = e.target.closest('[data-gear]'); if (!b) return;
  if (settingsLocked()) { alert(T('Bitte das laufende Training zuerst beenden oder zurücksetzen – sonst passt das Ergebnis nicht mehr zu den Übungen.', 'Please finish or reset the current workout first – otherwise the result no longer matches the exercises.')); return; }
  const k = b.dataset.gear, label = { kb: 'Kettlebell', db: T('Kurzhanteln', 'Dumbbells'), band: T('Bänder', 'Bands'), bw: T('Körpergewicht', 'Body weight') }[k];
  // nur Geräte zählen, die man besitzt; ist danach nichts mehr an, bleibt Körpergewicht
  const pg = Object.assign({}, planGear()), on = x => pg[x] && owns(x);
  pg[k] = !on(k); const forced = !on('kb') && !on('db') && !on('band') && !pg.bw; if (forced) pg.bw = true; setPlanGear(plan, pg);
  const tab = vacation() ? T('Urlaub', 'Holiday') : T(PLANS[plan].tab, tr(PLANS[plan].tab));
  renderAll(); toast(forced ? T(`${tab}: ohne Auswahl mit Körpergewicht.`, `${tab}: without a selection, body weight.`) : T(`${tab}: ${label} ${pg[k] ? 'an' : 'aus'} – beste Übungen gewählt.`, `${tab}: ${label} ${pg[k] ? 'on' : 'off'} – best exercises chosen.`));
});
$('btnMain').addEventListener('click', play);
$('btnNext').addEventListener('click', skip);
$('btnDone').addEventListener('click', () => finishExercise(false));
$('btnUndo').addEventListener('click', undo);
$('reset').addEventListener('click', resetTraining);
$('timedstart').addEventListener('click', startTimed);
$('timedlength').addEventListener('change', e => { timedPick[plan + '-' + (completions % exList().length)] = Number(e.target.value); renderCurrent(); });
const toggleSound = () => { soundEnabled = !soundEnabled; store(KEYS.sound, soundEnabled); renderHeader(); if (soundEnabled) { audioReady(); cue('step'); } toast(soundEnabled ? T('Ton an.', 'Sound on.') : T('Ton aus.', 'Sound off.')); };
$('sound').addEventListener('click', toggleSound);
$('soundrow').addEventListener('click', toggleSound);
$('testsound').addEventListener('click', () => { audioReady(); cue('finish'); say(T('Ton und Ansagen funktionieren.', 'Sound and voice are working.'), 900); });
$('current').addEventListener('click', e => { if (phase === 1 && sessionActive()) guideFollow = true; openExerciseGuide(Number(e.currentTarget.dataset.index || 0), e.currentTarget); });
$('stepstatus').addEventListener('click', e => { guideIdx = null; if (isInterval() && phase === 1) { const sg = currentSeg(); guideFollow = true; openExerciseGuide(segShown(sg), e.currentTarget); return; } if (phase !== 1 && sessionActive()) guideFollow = true; const s = currentStep(); openGuide(s.base, 'bw', { origin: e.currentTarget }); });
for (const id of ['warmup', 'cooldown']) $(id).addEventListener('click', e => { const b = e.target.closest('[data-guide-name]'); if (b) openGuide(b.dataset.guideName, 'bw', { origin: b }); });
$('worklist').addEventListener('click', e => {
  if (e.target.closest('#emomstart')) { startEmom(); return; }
  const lu = e.target.closest('[data-lvlup]');
  if (lu) { updateChoice(lu.dataset.lvlup, { lvl: lu.dataset.to === 'mittel' ? null : lu.dataset.to }); renderAll(); toast(T('Stufe umgestellt: ', 'Level changed: ') + LVL_LABEL[lu.dataset.to]); return; }
  const a = e.target.closest('[data-advance]');
  if (a) { stages[plan + '.' + a.dataset.advance] = a.dataset.to; store(KEYS.stage, stages); renderGear(); renderList(); renderStats(); renderHistory(); toast(T('Stufe umgestellt: ', 'Stage changed: ') + tr(a.dataset.to)); return; }
  const b = e.target.closest('[data-ex]'); if (b) openExerciseGuide(Number(b.dataset.ex), b);
});
$('worklist').addEventListener('input', e => { const t = e.target; if (t.dataset.slot && runReps[t.dataset.slot]) { runReps[t.dataset.slot][Number(t.dataset.idx)] = t.value.trim(); persistSession(); } });
$('worklist').addEventListener('change', e => {
  const t = e.target; if (!t.dataset.stage) return;
  stages[plan + '.' + t.dataset.stage] = t.value; store(KEYS.stage, stages); renderGear(); renderList(); renderStats(); renderHistory();
});
$('settings').addEventListener('change', e => {
  const t = e.target;
  const ck = t.dataset.tabata || t.dataset.icfg;
  if (ck) {
    if (settingsLocked()) { alert(T('Bitte das laufende Training zuerst beenden oder zurücksetzen.', 'Please finish or reset the current workout first.')); renderSettings(); return; }
    const k = plan + '.cfg'; choices[k] = Object.assign({}, isObj(choices[k]) ? choices[k] : {}, { [ck]: Number(t.value) }); store(KEYS.choice, choices);
    renderAll(); toast(T('Gespeichert.', 'Saved.')); return;
  }
  const id = t.dataset.pref || t.dataset.kg || t.dataset.dbkg || t.dataset.band || t.dataset.lvl; if (!id) return;
  if (settingsLocked()) { alert(T('Bitte das laufende Training zuerst beenden oder zurücksetzen.', 'Please finish or reset the current workout first.')); renderSettings(); return; }
  if (t.dataset.pref) updateChoice(id, { pref: t.value === 'auto' ? null : t.value });
  else if (t.dataset.kg || t.dataset.dbkg) { const v = Number(String(t.value).replace(',', '.')); if (t.value === '' || !Number.isFinite(v) || v < 0 || v > 60) { alert(T('Bitte ein Gewicht zwischen 0 und 60 kg eingeben.', 'Please enter a weight between 0 and 60 kg.')); renderSettings(); return; } updateChoice(id, { [t.dataset.kg ? 'kg' : 'dbkg']: v }); }
  else if (t.dataset.lvl) updateChoice(id, { lvl: t.value === 'mittel' ? null : t.value });
  else updateChoice(id, { band: t.value });
  renderAll(); toast(T('Gespeichert.', 'Saved.'));
});
$('settings').addEventListener('click', e => {
  const sg = e.target.closest('[data-sguide]'); if (sg) { openExerciseGuide(Number(sg.dataset.sguide), sg); return; }
  const id = e.target.id; if (id !== 'allkgbtn' && id !== 'alldbkgbtn') return;
  if (settingsLocked()) { alert(T('Bitte das laufende Training zuerst beenden oder zurücksetzen.', 'Please finish or reset the current workout first.')); return; }
  const g = id === 'allkgbtn' ? 'kb' : 'db', v = Number(String($(g === 'kb' ? 'allkg' : 'alldbkg').value).replace(',', '.')); if (!Number.isFinite(v) || v < 0 || v > 60) { alert(T('Bitte ein Gewicht zwischen 0 und 60 kg eingeben.', 'Please enter a weight between 0 and 60 kg.')); return; }
  for (const sl of PLANS[plan].slots) if (sl.v[g]) updateChoice(sl.id, { [g === 'kb' ? 'kg' : 'dbkg']: v });
  renderAll(); toast(g === 'kb' ? T(`Alle Kettlebell-Übungen: ${kgText(v)} kg.`, `All kettlebell exercises: ${kgText(v)} kg.`) : T(`Alle Kurzhantel-Übungen: ${kgText(v)} kg je Hantel.`, `All dumbbell exercises: ${kgText(v)} kg per dumbbell.`));
});
$('history').addEventListener('click', e => { const rb = e.target.closest('[data-rate]'); if (rb) { openRate(rb.dataset.rate); return; } const b = e.target.closest('[data-delete]'); if (!b) return; const old = saved.find(x => String(x.id) === b.dataset.delete); if (!old) return;
  const redraw = () => { persistEntries(); renderHistory(); renderStats(); renderWeek(); if (isSets()) renderList(); };
  saved = saved.filter(x => x !== old); redraw(); toastUndo(T('Trainingseintrag gelöscht.', 'Workout entry deleted.'), () => { saved.push(old); redraw(); }); });
$('manualdate').value = localDay();
$('manual').addEventListener('submit', e => {
  e.preventDefault(); const date = $('manualdate').value; if (!date) { alert(T('Bitte ein Datum wählen.', 'Please choose a date.')); return; }
  if (isInterval()) { saveSession(date, { manual: true }); return; }
  if (isSets()) { if (!hasReps()) { alert(T('Bitte zuerst oben im Plan die Wiederholungen eintragen.', 'Please enter the reps in the plan above first.')); return; } saveSession(date, { manual: true }); return; }
  const r = Number($('manualround').value), x = Number($('manualextra').value), n = exList().length;
  if (!Number.isInteger(r) || r < 0 || !Number.isInteger(x) || x < 0 || x >= n) { alert(T(`Bitte gültige Werte eingeben. Weitere Übungen: 0 bis ${n - 1}.`, `Please enter valid values. Extra exercises: 0 to ${n - 1}.`)); return; }
  saveSession(date, { manual: true, total: r * n + x }); $('manualround').value = '1'; $('manualextra').value = '0';
});
$('savefile').addEventListener('click', exportBackup);
$('importbtn').addEventListener('click', () => $('importfile').click());
$('importfile').addEventListener('change', e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });
$('exportcsv').addEventListener('click', exportCsv);
$('banners').addEventListener('click', e => { if (e.target.id === 'kbon') { setPlanGear(plan, Object.assign({}, planGear(), { kb: true })); renderAll(); return; } if (e.target.id === 'backupnow') exportBackup(); if (e.target.id === 'syncnow') syncSave(); });
$('installbar').addEventListener('click', e => { if (e.target.id === 'installguide') openInstallGuide(); });
$('measuredate').value = localDay();
$('measureform').addEventListener('submit', e => { e.preventDefault(); saveMeasureFromForm(); });
$('area-profil').addEventListener('click', onProfileClick);
$('area-profil').addEventListener('change', onProfileChange);
$('measurecsv').addEventListener('click', exportWaistCsv);
$('waistcalendar').addEventListener('click', exportWaistReminder);
$('guide-close').addEventListener('click', () => guide.close());
/* Wischen: nach links = wie „Weiter“ unten (im Training) bzw. nächste Übung des Plans, nach rechts = vorige Übung (nur außerhalb des Trainings) */
let swipe0 = null;
guide.addEventListener('touchstart', e => { const t = e.touches[0]; swipe0 = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
guide.addEventListener('touchend', e => {
  if (!swipe0) return; const t = e.changedTouches[0], dx = t.clientX - swipe0.x, dy = t.clientY - swipe0.y; swipe0 = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  if (guideFollow) { const b = $('guide-foot').querySelector('[data-gact]'); if (dx < 0 && b && !b.disabled) b.click(); return; }
  if (guideIdx === null) return; const n = exList().length, i = guideIdx + (dx < 0 ? 1 : -1); if (i >= 0 && i < n) openExerciseGuide(i, guideOrigin);
}, { passive: true });
guide.addEventListener('close', () => { guideFollow = false; guideKey = ''; guideIdx = null; $('guide-foot').innerHTML = ''; $('guide-foot').dataset.html = ''; });
$('guide-foot').addEventListener('click', e => {
  const b = e.target.closest('[data-gact]'); if (!b) return;
  if (b.dataset.gact === 'done') finishExercise(false); else skipStep();
  guideSync();
});
guide.addEventListener('click', e => { if (e.target === guide) { const r = guide.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) guide.close(); } });
guide.addEventListener('close', () => { if (guideOrigin && document.contains(guideOrigin)) guideOrigin.focus(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); routineTick(); if (running || (rt && rt.running)) keepAwake(true); renderWeek(); } else persistSession(); });
window.addEventListener('pagehide', persistSession);

// nach zwei Ziffern ins nächste Zeitfeld springen
function tpartJump(t) { if (t.dataset && t.dataset.tpart && t.value.length === 2 && t.dataset.tpart !== '2') { const n = t.closest('.timein').querySelector(`[data-tpart="${Number(t.dataset.tpart) + 1}"]`); if (n) { n.focus(); n.select(); } } }
$('tabbar').addEventListener('click', e => { const b = e.target.closest('[data-area]'); if (b) showArea(b.dataset.area); });
$('livepill').addEventListener('click', () => showArea('kraft'));
$('runtabs').addEventListener('click', e => { const b = e.target.closest('[data-runtab]'); if (!b) return; runView.tab = b.dataset.runtab; store(KEYS.run, runView); renderRun(); });
$('runsub').addEventListener('click', e => { const b = e.target.closest('[data-runsub]'); if (!b) return; runView[runView.tab] = b.dataset.runsub; store(KEYS.run, runView); renderRun(); });
$('mobtabs').addEventListener('click', e => { const b = e.target.closest('[data-mobtab]'); if (!b) return; mobView.tab = b.dataset.mobtab; store(KEYS.mob, mobView); renderMobility(); });
$('mobsub').addEventListener('click', e => { const b = e.target.closest('[data-mobsub]'); if (!b) return; mobView[mobView.tab] = b.dataset.mobsub; store(KEYS.mob, mobView); renderMobility(); });
// Laufwochen: bei jeder Eingabe speichern und nur Ergebnis und Diagramm neu zeichnen (Fokus bleibt im Feld)
$('runcontent').addEventListener('input', e => {
  const t = e.target;
  tpartJump(t);
  if (t.id === 'bestdist') { $('bestkmfield').classList.toggle('hide', t.value !== 'custom'); return; }
  if (t.id === 'bestfrom') { bestPrefill(t.value); return; }
  if (t.id === 'racedist') { syncRaceForm(true); return; }
  if (t.id === 'racekm' || t.id === 'racedate' || t.id === 'raceprio') { syncRaceForm(false); return; }
  if (t.closest && t.closest('#pctime') || t.id === 'pcdist' || t.id === 'pckm') { renderPace(); return; }
  if (!t.dataset || !t.dataset.wk) return;
  const v = kmNum(t.value), bad = Number.isNaN(v);
  t.setAttribute('aria-invalid', String(bad)); if (bad) return;
  setWeekKm(t.dataset.wk, t.dataset.f, v); renderLoad();
});
$('runcontent').addEventListener('click', e => {
  if (e.target.closest('#runaddbtn')) { addRunFromForm(); return; }
  if (e.target.closest('[data-fbclose]')) { runFeedback = null; renderLoad(); return; }
  if (e.target.closest('#runcsvbtn')) { $('runcsvfile').click(); return; }
  if (e.target.closest('#runcsvtpl')) { download(T('laeufe-vorlage.csv', 'runs-template.csv'), RUN_CSV_TEMPLATE, 'text/csv;charset=utf-8'); return; }
  const lv = e.target.closest('[data-level]'); if (lv) { setRunnerLevel(lv.dataset.level); toast(lv.dataset.level === 'beginner' ? T('Lauf-Einstieg gestartet – viel Spaß!', 'Running starter started – enjoy!') : T('Saisonplan aktiv.', 'Season plan active.')); return; }
  const st = e.target.closest('[data-starter]'); if (st) { onStarter(st.dataset.starter); return; }
  const go = e.target.closest('[data-runsub-go]'); if (go) { runView.plan = go.dataset.runsubGo; store(KEYS.run, runView); renderRun(); return; }
  if (e.target.closest('#racesave')) { saveRaceFromForm(); return; }
  if (e.target.closest('#planics')) { exportPlanIcs(); return; }
  if (e.target.closest('#icsremind')) { icsRemind.on = !icsRemind.on; store(KEYS.icsremind, icsRemind); renderRun(); toast(icsRemind.on ? T(`Erinnerung um ${icsRemind.time} – gilt für den nächsten Export.`, `Reminder at ${icsRemind.time} – applies to the next export.`) : T('Erinnerung aus – gilt für den nächsten Export.', 'Reminder off – applies to the next export.')); return; }
  if (e.target.closest('#bestsave')) { saveBestFromForm(); return; }
  const bg = e.target.closest('[data-bestgroup]'); if (bg) { bestView.group = bg.dataset.bestgroup; store(KEYS.bestview, bestView); renderRun(); return; }
  const ld = e.target.closest('[data-leveldel]'); if (ld) { const r = races.find(x => x.id === ld.dataset.leveldel); if (r && r.level !== undefined) { const v = r.level; delete r.level; persistRaces(); renderRun(); toastUndo(T('Ergebnis gelöscht.', 'Result deleted.'), () => { r.level = v; persistRaces(); renderRun(); }); } return; }
  const bd = e.target.closest('[data-bestdel]'); if (bd) { const old = results.find(r => r.id === bd.dataset.bestdel); if (old) { results = results.filter(r => r !== old); persistResults(); renderRun(); toastUndo(T('Ergebnis gelöscht.', 'Result deleted.'), () => { results.push(old); persistResults(); renderRun(); }); } return; }
  const sk = e.target.closest('[data-skip]'); if (sk) { toggleSkip(sk.dataset.week, sk.dataset.skip); renderRun(); return; }
  const dn = e.target.closest('[data-done]'), wp = curWeekPlan(weekStart(localDay()));
  if (dn && wp) { const k = dn.dataset.done; wp.done = wp.done.includes(k) ? wp.done.filter(x => x !== k) : wp.done.concat(k); storeWeekPlan(); renderRun(); return; }
  const mv = e.target.closest('[data-move]');
  if (mv && wp) {
    const to = Number(mv.dataset.to);
    wp.moved[mv.dataset.move] = to; storeWeekPlan(); renderRun();
    toast(T(`Auf ${WD_LONG[to]} verschoben.`, `Moved to ${WD_LONG[to]}.`));
    return;
  }
  const um = e.target.closest('[data-unmove]');
  if (um && wp) {
    const k = um.dataset.unmove;
    delete wp.moved[k];
    storeWeekPlan(); renderRun(); return;
  }
  if (e.target.closest('#racecancel')) { raceEdit = null; renderRun(); return; }
  if (e.target.closest('#racedel')) { const old = raceEdit && races.find(r => r.id === raceEdit); if (old) { races = races.filter(r => r !== old); persistRaces(); raceEdit = null; renderRun(); toastUndo(T('Rennen gelöscht.', 'Race deleted.'), () => { races.push(old); persistRaces(); renderRun(); }); } return; }
  const re = e.target.closest('[data-raceedit]'); if (re) { raceEdit = re.dataset.raceedit; renderRun(); $('racename').focus(); window.scrollTo({ top: 0 }); return; }
  const d = e.target.closest('[data-rundel]');
  if (d) { const old = runLog.find(r => r.id === d.dataset.rundel); if (!old) return; deleteRun(old.id); renderWeekRows(); renderLoad();
    toastUndo(T('Lauf gelöscht.', 'Run deleted.'), () => { runLog.push(old); runLog.sort((a, b) => a.date.localeCompare(b.date)); persistRunLog(); renderWeekRows(); renderLoad(); }); }
});
$('runcontent').addEventListener('keydown', e => { if (e.target.id === 'runkm' && e.key === 'Enter') { e.preventDefault(); addRunFromForm(); } if ((e.target.id === 'racename' || e.target.closest('#racegoal')) && e.key === 'Enter') { e.preventDefault(); saveRaceFromForm(); } });
function onStarter(a) {
  const s = getStarter();
  if (a === 'go') { startRoutine(T(`Lauf-Einstieg · Woche ${s.week + 1}`, `Running starter · week ${s.week + 1}`), starterItems(s.week), starterLog); return; }
  if (a === 'done') { starterLog(); return; }
  if (a === 'undo') { if (s.done > 0) { s.done--; const i = s.log.map(x => x.w).lastIndexOf(s.week); if (i >= 0) s.log.splice(i, 1); putStarter(s); toast(T('Einheit zurückgenommen.', 'Session undone.')); } }
  else if (a === 'next') { if (s.week < STARTER.weeks.length - 1) { s.week++; s.done = 0; putStarter(s); } }
  else if (a === 'repeat') { s.done = 0; putStarter(s); toast(T(`Woche ${s.week + 1} noch einmal.`, `Week ${s.week + 1} once more.`)); }
  else if (a === 'graduate' || a === 'runner') { setRunnerLevel('runner'); toast(a === 'graduate' ? T('Glückwunsch! Ab jetzt plant die App wie für Läufer.', 'Congratulations! From now on the app plans like for runners.') : T('Saisonplan aktiv.', 'Season plan active.')); return; }
  renderRun();
}
$('runcontent').addEventListener('change', e => { const t = e.target; if (t.id === 'starterweek') { const s = getStarter(), v = Number(t.value); if (v !== s.week) { s.week = v; s.done = 0; putStarter(s); renderRun(); } return; } if (t.id === 'icstime') { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t.value)) { icsRemind.time = t.value; store(KEYS.icsremind, icsRemind); toast(T(`Erinnerung um ${t.value}.`, `Reminder at ${t.value}.`)); } return; } if (t.id === 'runcsvfile') { if (t.files[0]) importRunCsv(t.files[0]); t.value = ''; return; } if (t.dataset && t.dataset.wk && t.getAttribute('aria-invalid') !== 'true') { const v = weekKm(t.dataset.wk, t.dataset.f); t.value = v === null ? '' : kmText(v); } });
for (const id of ['runcontent', 'mobcontent']) $(id).addEventListener('click', e => {
  const r = e.target.closest('[data-routine]'), m = e.target.closest('[data-mob]');
  if (r) { const k = r.dataset.routine, cur = runCurrent(); if (k === 'abc') startRoutine(T('Lauf-ABC', 'Running drills'), RUN_GUIDE.abc.drills); else if (cur) startRoutine(`${cur.label} · ${k === 'warmup' ? 'Warm-up' : 'Cooldown'}`, cur[k]); return; }
  if (m) { const x = MOBILITY.routines[Number(m.dataset.mob)]; if (x) startRoutine('Mobility · ' + x.title, x.steps, () => logMobility(x.title)); return; }
  const b = e.target.closest('[data-guide-name]'); if (b) openGuide(b.dataset.guideName, 'bw', { origin: b });
});
$('rt-main').addEventListener('click', () => {
  if (!rt) return;
  if (rt.done) { routineDlg.close(); return; }
  if (!rtStep().secs) { cue('step'); rtGo(rt.i + 1); return; }
  audioReady();
  if (rt.running) { rt.acc = rtElapsed(); rt.running = false; keepAwake(false); } else { rt.since = Date.now(); rt.running = true; keepAwake(true); }
  renderRoutine();
});
$('rt-next').addEventListener('click', () => { if (rt) { audioReady(); rtGo(rt.i + 1); } });
$('rt-prev').addEventListener('click', () => { if (rt && rt.i > 0) { audioReady(); rtGo(rt.i - 1); } });
$('rt-plus').addEventListener('click', () => { if (rt && !rt.done) { rt.extra += 60; rt.lastSec = null; renderRoutine(); toast(T('+1 Minute', '+1 minute')); } });
$('rt-guide').addEventListener('click', e => { if (rt && !rt.done) openGuide(rtStep().name, 'bw', { origin: e.currentTarget }); });
$('rt-close').addEventListener('click', () => routineDlg.close());
routineDlg.addEventListener('close', stopRoutine);
// Ein Tipp auf die Zahl speichert die Bewertung (eine Notiz vorher eintippen, sie kommt mit)
$('rpe').addEventListener('click', e => { const b = e.target.closest('[data-rpe]'); if (!b) return; rateVal = Number(b.dataset.rpe); renderRpe(); saveRate(); });
$('rateform').addEventListener('submit', e => { e.preventDefault(); saveRate(); });
$('rate-skip').addEventListener('click', () => rateDlg.close());
$('planhint').addEventListener('click', e => {
  if (e.target.id !== 'planhintbtn') return;
  const a = intervalAdvice(); if (!a || settingsLocked()) return;
  const k = plan + '.cfg'; choices[k] = Object.assign({}, isObj(choices[k]) ? choices[k] : {}, a.patch); store(KEYS.choice, choices);
  renderAll(); toast(T('Umgestellt – viel Erfolg!', 'Switched – good luck!'));
});
$('voicerow').addEventListener('click', () => { audioOpt.voice = !audioOpt.voice; store(KEYS.audio, audioOpt); renderAudioRows(); if (audioOpt.voice) { audioReady(); say(T('Sprachansagen an.', 'Voice prompts on.'), 0); } toast(audioOpt.voice ? T('Sprachansagen an.', 'Voice prompts on.') : T('Sprachansagen aus.', 'Voice prompts off.')); });
$('loudrow').addEventListener('click', () => { audioOpt.loud = !audioOpt.loud; store(KEYS.audio, audioOpt); applyAudioSession(); renderAudioRows(); audioReady(); cue('step'); toast(audioOpt.loud ? T('Ton auch bei Stummschalter.', 'Sound even in silent mode.') : T('Stummschalter wird wieder beachtet.', 'Silent switch is respected again.')); });

// Aufklappen mit data-acc: öffnet sich ein Eintrag, klappen die anderen derselben Gruppe zu (weniger scrollen).
// toggle blubbert nicht hoch, daher in der Capture-Phase am Dokument; der geöffnete Eintrag bleibt im Blick.
document.addEventListener('toggle', e => {
  const d = e.target; if (!(d instanceof HTMLDetailsElement) || !d.dataset.acc) return;
  const acc = d.dataset.acc;
  if (d.classList.contains('sect') && d.id) {
    if (d.open) sectState[acc] = d.id; else if (sectState[acc] === d.id || !Object.prototype.hasOwnProperty.call(sectState, acc)) sectState[acc] = null;
    store(KEYS.sections, sectState);
  }
  if (!d.open) return;
  let moved = false;
  for (const o of document.querySelectorAll(`details[data-acc="${acc}"][open]`)) if (o !== d) { o.open = false; moved = true; }
  const sum = d.querySelector(':scope > summary');
  if (moved && sum && sum.getBoundingClientRect().top < 0) sum.scrollIntoView({ block: 'start' });
}, true);
applySections();

/* ---------- Start ---------- */
schemaCheck();
const restored = restoreSession();
if (!restored) runReps = emptyReps(plan);
syncTrack();
{ const msg = sessionStorage.getItem(SYNC_MSG); if (msg) { sessionStorage.removeItem(SYNC_MSG); setTimeout(() => toast(msg), 300); } }
$('syncsave').addEventListener('click', syncSave);
$('syncpick').addEventListener('click', syncPick);
$('factoryreset').addEventListener('click', factoryReset);
$('settingsreset').addEventListener('click', settingsReset);
$('syncplace').addEventListener('change', e => { syncMeta.place = e.target.value.trim().slice(0, 120); e.target.classList.remove('ask'); syncSaveMeta(); renderSyncStatus(); renderBackupBanner(); toast(T('Speicherort gemerkt – er steht jetzt auch in der Erinnerung.', 'Location saved – it now also shows in the reminder.')); });
$('syncload').addEventListener('click', syncLoad);
$('syncfile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => syncApply(r.result); r.readAsText(f); });
$('syncstatus').addEventListener('click', e => { if (e.target.id === 'syncforget') handleSet(null).then(renderSyncStatus); });
window.addEventListener('pagehide', () => { clearTimeout(syncTimer); syncTrack(); });
renderAll(); renderWaist(); renderWeight(); renderProfile(); renderStorageInfo(); renderRun(); renderSyncStatus(); renderNotesRows();
// Startbildschirm: keine Ladeanzeige – weg, sobald die App bereit ist, aber mindestens SPLASH_MS ab Start, damit er nicht nur flackert. Antippen blendet sofort aus.
const SPLASH_MS = 600, splashLeft = (() => {
  const s = $('splash'); if (!s) return () => 0;
  if (document.documentElement.classList.contains('nosplash')) { s.remove(); return () => 0; }
  $('splashver').textContent = `Version ${APP_VERSION}` + (KEY_NS ? T(' · Testversion', ' · test version') : '');
  const until = Math.max(performance.now(), SPLASH_MS), done = () => { if (!s.isConnected || s.classList.contains('out')) return; s.classList.add('out'); setTimeout(() => s.remove(), 260); };
  s.addEventListener('click', done); setTimeout(done, until - performance.now());
  return () => Math.max(0, until - performance.now());
})();
// Neuigkeiten erst nach dem Startbildschirm (ein Dialog läge sonst darüber)
/* ---------- Einrichtung beim ersten Start: ein paar Fragen statt Profil durchklicken (alles überspringbar, später im Profil änderbar) ---------- */
const SETUP_KB = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32], SETUP_DB = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
let setupStep = 'mods', setupAns = {};
const setupDlg = (() => { const d = document.createElement('dialog'); d.className = 'sheet'; d.id = 'setup'; d.setAttribute('aria-labelledby', 'setup-title'); document.body.appendChild(d); return d; })();
const setupWanted = () => !window.__kbtNoSetup && !load(KEYS.setup, null) && profileRaw === null && saved.length + runLog.length + runWeeks.length + races.length + results.length === 0;
function setupOrder() {
  const L = mod('laufen'), K = mod('kraft'), M = mod('mobility'), run = L && setupAns.run === 'runner', kit = setupAns.kit || [], age = !!setupAns.age;
  return ['mods', ...(L ? ['run'] : []), ...(run ? ['long', 'quality', 'group'] : []), ...(K ? ['strength', 'kit', ...['kb', 'db'].filter(g => kit.includes(g))] : []), ...(M ? ['mobility'] : []),
    ...(L ? ['age', ...(age ? ['rest'] : []), 'race'] : []), 'done'];
}
function setupNext() { const o = setupOrder(); setupStep = o[Math.min(o.indexOf(setupStep) + 1, o.length - 1)]; renderSetup(); }
function setupBack() { const o = setupOrder(), i = o.indexOf(setupStep); if (i > 0) { setupStep = o[i - 1]; renderSetup(); } }
function renderSetup() {
  const o = setupOrder(), n = o.length - 1, i = o.indexOf(setupStep), w = profile.week;
  const dayChips = (key, cur, none) => `<div class="setchips">${WEEK_ORDER.map(d => `<button type="button" class="chip" data-setday="${key}" data-v="${d}" aria-pressed="${cur === d}">${WD[d]}</button>`).join('')}${none ? `<button type="button" class="chip" data-setday="${key}" data-v="" aria-pressed="${cur === null}">${esc(none)}</button>` : ''}</div>`;
  const opt = (k, v, label, small) => `<button type="button" class="row setopt" data-setopt="${k}" data-v="${v}"><span class="txt"><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span><span class="chev"></span></button>`;
  const multi = (k, list, cur) => `<div class="setchips">${list.map(([v, l]) => `<button type="button" class="chip" data-setmulti="${k}" data-v="${v}" aria-pressed="${cur.includes(v)}">${esc(l)}</button>`).join('')}</div>`;
  const nextBtn = (label = T('Weiter', 'Next')) => `<button type="button" class="btn primary setnext" data-setnext>${esc(label)}</button>`;
  let q = '', body = '';
  if (setupStep === 'mods') { q = T('Was möchtest du machen?', 'What do you want to do?'); body = multi('mods', [['kraft', T('Kraft', 'Strength')], ['laufen', T('Laufen', 'Running')], ['mobility', 'Mobility']], ['kraft', 'laufen', 'mobility'].filter(mod)) + `<p class="tiny">${T('Mehrere möglich. Den Rest blendet die App aus.', 'Several possible. The app hides the rest.')}</p>` + nextBtn(); }
  else if (setupStep === 'run') { q = T('Wie läufst du?', 'How do you run?'); body = `<div class="group">${opt('run', 'runner', T('Regelmäßig', 'Regularly'), T('mit Plan für deine Rennen', 'with a plan for your races'))}${opt('run', 'beginner', T('Ich fange gerade an', 'I am just starting'), T('Lauf-Einstieg in kleinen Schritten', 'running starter in small steps'))}</div>`; }
  else if (setupStep === 'mobility') { q = T('An welchen Tagen machst du Mobility?', 'Which days do you do mobility?'); body = multi('mobility', WEEK_ORDER.map(d => [String(d), WD[d]]), w.mobility.map(String)) + nextBtn(); }
  else if (setupStep === 'long') { q = T('An welchem Tag ist dein langer Lauf?', 'Which day is your long run?'); body = dayChips('long', w.long, T('keiner', 'none')); }
  else if (setupStep === 'quality') { q = T('An welchem Tag läufst du Intervall oder Tempo?', 'Which day do you run intervals or tempo?'); body = dayChips('quality', w.quality, T('keiner', 'none')); }
  else if (setupStep === 'group') { q = T('Läufst du in einer Gruppe? An welchem Tag?', 'Do you run with a group? Which day?'); body = dayChips('group', w.group, T('nein', 'no')); }
  else if (setupStep === 'strength') { q = T('An welchen Tagen machst du Kraft?', 'Which days do you do strength?'); body = multi('strength', WEEK_ORDER.map(d => [String(d), WD[d]]), w.strength.map(String)) + nextBtn(); }
  else if (setupStep === 'kit') { q = T('Was hast du zu Hause?', 'What do you have at home?'); body = multi('kit', [['kb', T('Kettlebell', 'Kettlebell')], ['db', T('Kurzhanteln', 'Dumbbells')], ['band', T('Widerstandsbänder', 'Resistance bands')]], setupAns.kit || []) + `<p class="tiny">${T('Nichts gewählt = nur Körpergewicht.', 'Nothing selected = body weight only.')}</p>` + nextBtn(); }
  else if (setupStep === 'kb') { q = T('Welche Kettlebell-Gewichte hast du?', 'Which kettlebell weights do you have?'); body = multi('kb', SETUP_KB.map(v => [String(v), `${v} kg`]), profile.kit.kb.map(String)) + nextBtn(); }
  else if (setupStep === 'db') { q = T('Welche Kurzhanteln hast du?', 'Which dumbbells do you have?'); body = multi('db', SETUP_DB.map(v => [String(v), `${v} kg`]), profile.kit.db.map(String)) + `<p class="tiny">${T('Gewicht je Hantel. Andere Gewichte trägst du im Profil ein.', 'Weight per dumbbell. Other weights go in the profile.')}</p>` + nextBtn(); }
  else if (setupStep === 'age') { q = T('Wie alt bist du?', 'How old are you?'); body = `<p class="tiny">${T('Für deine Pulszonen (max. HF nach Tanaka). Wird nicht gespeichert – nur die max. HF.', 'For your heart rate zones (max HR by Tanaka). Not stored – only the max HR.')}</p><input type="text" inputmode="numeric" maxlength="2" id="setage" autocomplete="off" placeholder="${T('z. B. 43', 'e.g. 43')}">${nextBtn()}<button type="button" class="btn setskip" data-setskip>${T('Überspringen', 'Skip')}</button>`; }
  else if (setupStep === 'rest') { q = T('Wie hoch ist dein Ruhepuls?', 'What is your resting heart rate?'); body = `<p class="tiny">${T('Morgens im Liegen gemessen, z. B. von der Uhr. Damit rechnet die App die Zonen.', 'Measured in the morning lying down, e.g. from your watch. The app uses it for the zones.')}</p><input type="text" inputmode="numeric" maxlength="3" id="setrest" autocomplete="off" placeholder="${T('z. B. 55', 'e.g. 55')}">${nextBtn()}<button type="button" class="btn setskip" data-setskip>${T('Weiß ich nicht', 'I don’t know')}</button>`; }
  else if (setupStep === 'race') { q = T('Hast du ein Rennen geplant?', 'Do you have a race planned?'); body = `<div class="setrace"><input type="text" id="setrname" maxlength="60" autocomplete="off" placeholder="${T('Name, z. B. Berliner Halbmarathon', 'Name, e.g. Berlin Half Marathon')}"><input type="date" id="setrdate" min="${localDay()}"><select id="setrdist">${Object.entries(SEASON.dist).filter(([k]) => ['5k', '10k', 'hm', 'marathon'].includes(k)).map(([k, d]) => `<option value="${k}"${k === 'hm' ? ' selected' : ''}>${esc(tr(d.label))}</option>`).join('')}</select></div>${nextBtn(T('Rennen speichern', 'Save race'))}<button type="button" class="btn setskip" data-setskip>${T('Kein Rennen', 'No race')}</button>`; }
  else { q = T('Fertig – los geht’s!', 'Done – let’s go!'); body = `<p>${T('Alles eingerichtet. Ändern kannst du alles unter Profil.', 'All set. You can change everything under Profile.')}</p>${nextBtn(T('Zur Startseite', 'To the home screen'))}`; }
  setupDlg.innerHTML = `<div class="sheethead"><div class="grabber"></div><div class="rowx"><h2 id="setup-title" tabindex="-1" style="outline:none">${T('Einrichtung', 'Setup')}</h2><button class="btn small" type="button" data-setclose>${setupStep === 'done' ? T('Schließen', 'Close') : T('Später', 'Later')}</button></div></div>
    <div class="sheetbody"><p class="setprog">${i < n ? T(`Frage ${i + 1} von ${n}`, `Question ${i + 1} of ${n}`) : ''}${i > 0 && i < n ? ` · <button type="button" class="slink" data-setback>${T('zurück', 'back')}</button>` : ''}</p><h3 class="setq">${esc(q)}</h3>${body}</div>`;
  if (!setupDlg.open) setupDlg.showModal();
  const f = setupDlg.querySelector('input'); if (f) f.focus(); else $('setup-title').focus();
}
function setupFinish(markOnly) {
  store(KEYS.setup, localDay()); notesOpt.seen = noteStamp(CHANGELOG[0]); store(KEYS.notes, notesOpt);
  if (setupDlg.open) setupDlg.close(); renderAll(); renderProfile(); if (!markOnly) showArea('start');
}
function openSetup() { setupStep = 'mods'; setupAns = {}; renderSetup(); }
setupDlg.addEventListener('cancel', () => setupFinish(true));
setupDlg.addEventListener('click', e => {
  const w = profile.week, b = e.target.closest('button'); if (!b) return;
  if (b.dataset.setclose !== undefined) { setupFinish(setupStep !== 'done' ? true : false); return; }
  if (b.dataset.setback !== undefined) { setupBack(); return; }
  if (b.dataset.setopt === 'run') { const v = b.dataset.v; setupAns.run = v; w.runner = v; if (v !== 'runner') { w.quality = null; w.long = null; w.group = null; } persistProfile(); setupNext(); return; }
  if (b.dataset.setday) { const k = b.dataset.setday, v = b.dataset.v === '' ? null : Number(b.dataset.v); w[k] = v; persistProfile(); setupNext(); return; }
  if (b.dataset.setmulti) {
    const k = b.dataset.setmulti, v = b.dataset.v, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
    if (k === 'strength') { w.strength = WEEK_ORDER.filter(d => (String(d) === v ? on : w.strength.includes(d))); persistProfile(); }
    else if (k === 'mobility') { w.mobility = WEEK_ORDER.filter(d => (String(d) === v ? on : w.mobility.includes(d))); persistProfile(); }
    else if (k === 'mods') { if (!on && ['kraft', 'laufen', 'mobility'].filter(mod).length === 1) { b.setAttribute('aria-pressed', 'true'); toast(T('Mindestens ein Bereich bleibt an.', 'At least one area stays on.')); return; } profile.modules[v] = on; if (v === 'laufen' && !on) { w.quality = null; w.long = null; w.group = null; } persistProfile(); }
    else if (k === 'kit') { const s = new Set(setupAns.kit || []); if (on) s.add(v); else s.delete(v); setupAns.kit = [...s]; }
    else if (k === 'kb' || k === 'db') { const s = new Set(profile.kit[k]); if (on) s.add(Number(v)); else s.delete(Number(v)); profile.kit[k] = [...s].sort((a, c) => a - c); persistProfile(); } // Standardgewicht ergänzt normProfile
    return;
  }
  if (b.dataset.setskip !== undefined) { if (setupStep === 'age') setupAns.age = null; setupNext(); return; }
  if (b.dataset.setnext !== undefined) {
    if (setupStep === 'kit') { const k = setupAns.kit || []; if (!k.includes('kb')) profile.kit.kb = []; if (!k.includes('db')) profile.kit.db = []; profile.kit.bands = k.includes('band') ? (profile.kit.bands.length ? profile.kit.bands : [10, 20, 30]) : []; persistProfile(); }
    if (setupStep === 'age') { const a = intNum($('setage').value); if (!okNum(a, 10, 99)) { $('setage').setAttribute('aria-invalid', 'true'); toast(T('Bitte ein Alter zwischen 10 und 99 eintragen – oder überspringen.', 'Please enter an age between 10 and 99 – or skip.')); return; } setupAns.age = a; profile.hr.max = Math.round(208 - 0.7 * a); persistProfile(); }
    if (setupStep === 'rest') { const r = intNum($('setrest').value); if (!okNum(r, 30, 120) || r >= profile.hr.max) { $('setrest').setAttribute('aria-invalid', 'true'); toast(T('Bitte einen Ruhepuls zwischen 30 und 120 eintragen.', 'Please enter a resting HR between 30 and 120.')); return; } profile.hr = { max: profile.hr.max, rest: r, z: hrZonesFrom(profile.hr.max, r) }; persistProfile(); }
    if (setupStep === 'race') {
      const r = { id: uid(), name: $('setrname').value.trim().slice(0, 60), date: $('setrdate').value, dist: $('setrdist').value, prio: 'A', goal: null, km: null };
      if (!r.name || !isDay(r.date) || r.date < localDay()) { toast(T('Bitte Name und ein Datum ab heute eintragen – oder „Kein Rennen“.', 'Please enter a name and a date from today – or “No race”.')); return; }
      if (validRace(r)) { races.push(r); persistRaces(); }
    }
    if (setupStep === 'done') { setupFinish(false); return; }
    setupNext();
  }
});
(() => { const sub = document.querySelector('#area-profil .subtitle'); if (sub) sub.insertAdjacentHTML('afterend', `<button type="button" class="btn small" id="setupstart" style="margin:0 0 12px">${T('Einrichtung: Fragen von vorn', 'Setup: questions from the start')}</button>`); })();
$('setupstart').addEventListener('click', openSetup);
if (setupWanted()) setTimeout(() => { if (!document.querySelector('dialog[open]')) openSetup(); }, splashLeft() + 200);
else if (CHANGELOG.length && notesOpt.auto !== false && notesOpt.seen !== noteStamp(CHANGELOG[0])) setTimeout(() => { if (!document.querySelector('dialog[open]')) openNotes(false); }, splashLeft() + 300); renderMobility();
// Beim Öffnen immer die Startseite – außer ein Training läuft (dann direkt zum Timer). Tests können das abschalten.
if (sessionActive()) area = 'kraft'; else if (!window.__kbtNoStart) area = 'start';
showArea(area, false);
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || document.documentElement.dataset.os === 'ios') $('savefilehint').textContent = T('Öffnet „Teilen“ → „In Dateien sichern“', 'Opens “Share” → “Save to Files”');
else if (document.documentElement.dataset.os === 'android') $('savefilehint').textContent = T('Landet im Ordner „Downloads“', 'Goes to the “Downloads” folder');
if (restored) { toast(running ? T('Laufendes Training wiederhergestellt.', 'Running workout restored.') : T('Unterbrochenes Training wiederhergestellt.', 'Interrupted workout restored.')); if (running) keepAwake(true); }
setInterval(() => { tick(); routineTick(); }, 200);
try { navigator.storage?.persist?.().then(renderStorageInfo).catch(() => { }); } catch (e) { }
renderPreUpdate();
if (loadIssues.length) toast(T('Ein Teil der gespeicherten Daten war unlesbar und wurde separat aufbewahrt. Bitte Backup prüfen.', 'Some of the stored data was unreadable and has been kept separately. Please check your backup.'));
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) toast(T('App aktualisiert – deine Daten sind unverändert.', 'App updated – your data is unchanged.')); });
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}
$('preupdate').addEventListener('click', () => { const b = load(PRE_UPDATE_KEY, null); if (isObj(b) && typeof b.json === 'string') download(`tagwerk-sicherung-vor-update-${localDay(new Date(b.savedAt || Date.now()))}.json`, b.json, 'application/json'); });
