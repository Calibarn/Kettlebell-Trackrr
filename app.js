'use strict';
/* KB Tracker – Logik. Alle Daten bleiben in localStorage auf dem Gerät. */

const $ = id => document.getElementById(id);
const KEYS = {
  entries: 'jan-kettlebell-tracker-v1', waist: 'jan-kb-waist-v1', sound: 'jan-kb-sound-v1', gear: 'jan-kb-gear-v1',
  choice: 'jan-kb-choice-v1', stage: 'jan-kb-stage-v1', plan: 'jan-kb-plan-v1', session: 'jan-kb-session-v1',
  backup: 'jan-kb-lastbackup-v1', hint: 'jan-kb-installhint-v1', area: 'jan-kb-area-v1', run: 'jan-kb-runview-v1'
};
/* Datensicherheit bei Updates:
   - Einträge, die diese Version nicht versteht, werden nie verworfen, sondern unverändert mitgespeichert.
   - Unlesbare Daten werden vor dem Überschreiben unter einem eigenen Schlüssel aufbewahrt.
   - Vor einer Formatänderung (SCHEMA) wird eine Sicherung im Backup-Format angelegt. */
const SCHEMA = 3, SCHEMA_KEY = 'jan-kb-schema-v1', PRE_UPDATE_KEY = 'jan-kb-sicherung-vor-update';
const loadIssues = [];
function loadList(key, valid) {
  let raw = null; try { raw = localStorage.getItem(key); } catch (e) { }
  if (raw === null) return { ok: [], keep: [] };
  try { const v = JSON.parse(raw); if (!Array.isArray(v)) throw Error('kein Array'); return { ok: v.filter(valid), keep: v.filter(x => !valid(x)) }; }
  catch (e) { try { localStorage.setItem(key + '-unlesbar-' + Date.now(), raw); } catch (_) { } loadIssues.push(key); return { ok: [], keep: [] }; }
}
function load(k, def) { try { const raw = localStorage.getItem(k); if (raw === null) return def; const v = JSON.parse(raw); return v === null || v === undefined ? def : v; } catch (e) { return def; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
function localDay(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dateGerman(day) { const [y, m, d] = String(day).split('-'); return `${d}.${m}.${y}`; }
function clock(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
const kgText = v => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const cmString = v => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ---------- Einstellungen: Geräte, Varianten, Gewichte ---------- */
let gear = load(KEYS.gear, null);
if (!isObj(gear)) gear = { kb: true, band: true };
gear = { kb: gear.kb !== false, band: gear.band !== false };
let choices = load(KEYS.choice, {}); if (!isObj(choices)) choices = {};
let stages = load(KEYS.stage, {}); if (!isObj(stages)) stages = {};

const slotKey = (pk, sl) => pk + '.' + sl.id;
function validKg(v) { const n = Number(v); return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= 0 && n <= 60 ? n : KB_DEFAULT; }
function availableGears(sl) { return (sl.order || ['kb', 'band', 'bw']).filter(g => sl.v[g] && (g === 'bw' || gear[g])); }
function resolve(pk, sl) {
  const avail = availableGears(sl), c = isObj(choices[slotKey(pk, sl)]) ? choices[slotKey(pk, sl)] : {};
  const g = avail.includes(c.pref) ? c.pref : (avail[0] || Object.keys(sl.v)[0]);
  if (!avail.length) avail.push(g);
  const [name, reps, note] = sl.v[g];
  const kg = validKg(c.kg), band = BANDS.includes(String(c.band)) ? String(c.band) : (sl.band || '20');
  const gearText = g === 'kb' ? (kg > 0 ? `Kettlebell ${kgText(kg)} kg` : 'Kettlebell ohne Gewicht') : g === 'band' ? bandLabel(band) : 'Körpergewicht';
  const cfg = g === 'kb' ? 'kb:' + kg : g === 'band' ? 'band:' + band : 'bw';
  return { slot: sl, g, name, reps, note, kg, band, gearText, cfg, avail };
}
function stageOf(pk, sl) { if (!sl.stages) return null; const s = stages[slotKey(pk, sl)]; return sl.stages.includes(s) ? s : sl.stages[0]; }
const exList = (pk = plan) => PLANS[pk].slots.map(sl => resolve(pk, sl));
const isSets = (pk = plan) => PLANS[pk].mode === 'sets';
const isTabata = (pk = plan) => PLANS[pk].mode === 'tabata';
function tabataCfg() { const c = isObj(choices['tabata.cfg']) ? choices['tabata.cfg'] : {}; return { rounds: TABATA_ROUNDS.includes(c.rounds) ? c.rounds : TABATA_DEFAULT.rounds, blockRest: TABATA_RESTS.includes(c.blockRest) ? c.blockRest : TABATA_DEFAULT.blockRest, work: 20, rest: 10 }; }
let tbCache = { key: '', seg: [] };
function tabataSegments() {
  const c = tabataCfg(), n = PLANS.tabata.slots.length, key = c.rounds + '/' + c.blockRest;
  if (tbCache.key === key) return tbCache.seg;
  const seg = []; let t = 0;
  for (let b = 0; b < n; b++) {
    for (let r = 0; r < c.rounds; r++) {
      seg.push({ type: 'work', block: b, round: r, start: t, end: t + c.work }); t += c.work;
      if (r < c.rounds - 1) { seg.push({ type: 'rest', block: b, round: r, start: t, end: t + c.rest }); t += c.rest; }
    }
    if (b < n - 1) { seg.push({ type: 'blockrest', block: b, start: t, end: t + c.blockRest }); t += c.blockRest; }
  }
  tbCache = { key, seg }; return seg;
}
const tabataWorkTotal = () => tabataSegments().filter(x => x.type === 'work').length;
function phaseSecs(pk, i) { return isTabata(pk) && i === 1 ? tabataSegments().at(-1).end : PLANS[pk].durations[i] * 60; }
const cfgText = c => !c ? '' : c === 'bw' ? 'Körpergewicht' : c.startsWith('kb:') ? kgText(c.slice(3)) + ' kg' : c.startsWith('band:') ? bandLabel(c.slice(5)) : c;

/* ---------- Einträge & Vergleichbarkeit ---------- */
function validEntry(e) {
  if (!isObj(e) || !Object.prototype.hasOwnProperty.call(PLANS, e.plan) || typeof e.date !== 'string' || !Number.isInteger(e.total) || e.total < 0 || e.total >= 10000) return false;
  if (e.mode === 'sets') return e.v >= 3 ? Array.isArray(e.sets) && e.sets.every(Array.isArray) : isObj(e.sets);
  return true;
}
const entriesLoaded = loadList(KEYS.entries, validEntry);
let saved = entriesLoaded.ok; const savedKeep = entriesLoaded.keep;
function persistEntries() { if (!store(KEYS.entries, saved.concat(savedKeep))) toast('Speichern im Browser nicht möglich – bitte Backup exportieren.'); renderBackupBanner(); }
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
function entrySig(e) {
  if (e.v >= 3 && Array.isArray(e.cfg)) return e.plan + '|' + e.cfg.length + '|' + e.cfg.join(',') + (Array.isArray(e.stages) ? '|' + e.stages.join(',') : '');
  const n = entryCount(e);
  if (e.plan === 'wed' && n === PLANS.wed.slots.length) return 'wed|' + n + '|' + legacyCfg(e).join(',');
  return e.plan + '|' + n + '|legacy';
}
function currentCfg(pk = plan) {
  const c = exList(pk).map(x => x.cfg);
  if (isTabata(pk)) { const t = tabataCfg(); c.push('rounds:' + t.rounds, 'pause:' + t.blockRest); }
  return c;
}
function currentSig(pk = plan) {
  const c = currentCfg(pk);
  return pk + '|' + c.length + '|' + c.join(',') + (isSets(pk) ? '|' + PLANS[pk].slots.map(sl => stageOf(pk, sl) || '').join(',') : '');
}
const comparable = e => entrySig(e) === currentSig(e.plan);
const SHORT = { 'Split Squat': 'Split', 'Einarmiges Rudern': 'Rudern', 'Rudern mit Band': 'Rudern', 'Y-T-W in Bauchlage': 'Y-T-W', 'Brustdrücken mit Band': 'Drücken', 'Liegestütze erhöht': 'Liegest.', 'Einbeiniges Wadenheben': 'Waden', 'Einbeiniges Kreuzheben': 'EB-Kreuzh.', 'Suitcase March': 'March', 'Kettlebell-Swing': 'Swing', 'Kettlebell-Swing (beidarmig)': 'Swing', 'Hüftheben mit Band': 'Hüftheben' };
const shortName = n => SHORT[n] || n;
function resultText(e) {
  if (e.mode === 'sets') {
    const parts = e.v >= 3 ? e.sets.map((r, i) => `${shortName((e.names && e.names[i]) || '?')} ${r.map(x => x ?? '–').join('/')}`)
      : Object.entries(e.sets).map(([n, x]) => `${shortName(n)} ${(x.reps || []).map(r => r ?? '–').join('/')}`);
    return parts.join(' · ') + ` · Σ ${e.total} Wdh.`;
  }
  if (e.mode === 'tabata') { const r = (e.cfg || []).find(c => String(c).startsWith('rounds:')); return `${e.total} von ${e.of} Intervallen${e.total >= e.of ? ' · komplett' : ''}${r ? ' · ' + r.slice(7) + ' Runden' : ''}`; }
  const n = entryCount(e);
  return `${Math.floor(e.total / n)} Runden + ${e.total % n} Übungen`;
}

/* ---------- Ton & Wake Lock ---------- */
let soundEnabled = load(KEYS.sound, true) !== false;
let audioCtx = null;
function audioReady() { if (!soundEnabled) return; try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { }); } catch (e) { } }
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
  items.forEach(([d, name], group) => { const p = parseStep(d); for (let part = 0; part < p.times; part++) { out.push({ name: name + (p.times === 2 ? (part === 0 ? ' · links' : ' · rechts') : ''), base: name, group, start: at, end: at + p.seconds }); at += p.seconds; } });
  return out;
}
const STEPS = Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { warmup: buildSteps(p.warmup), cooldown: buildSteps(p.cooldown) }]));
const durationSecs = () => phaseSecs(plan, phase);
function currentSeg() { const t = secNow(), sg = tabataSegments(); return sg.find(x => t < x.end) || sg.at(-1); }
const workDoneAt = t => tabataSegments().filter(x => x.type === 'work' && x.end <= t + 0.01).length;
const secNow = () => running ? elapsed + (Date.now() - startedAt) / 1000 : elapsed;
const isFinished = () => phase === 2 && !running && elapsed >= durationSecs();
function currentStep() { const st = phase === 0 ? STEPS[plan].warmup : STEPS[plan].cooldown, t = secNow(); return st.find(s => t < s.end) || st[st.length - 1]; }
function emptyReps(pk) { return isSets(pk) ? Object.fromEntries(PLANS[pk].slots.map(sl => [sl.id, Array(sl.sets).fill('')])) : {}; }
const hasReps = () => Object.values(runReps).some(a => a.some(v => v !== ''));
const sessionActive = () => !sessionSaved && (running || elapsed > 0 || phase > 0 || completions > 0 || hasReps());
const mainName = () => isTabata() ? 'Tabata' : isSets() ? 'Kraftteil' : 'Zirkel';
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
function signalCountdown(id, remaining) {
  if (lastScene !== id) { if (lastScene !== null) cue('step'); lastScene = id; lastSecond = null; }
  const sec = Math.ceil(remaining);
  if (sec !== lastSecond) { lastSecond = sec; if (running && sec >= 1 && sec <= 3) cue('count'); }
}
function tick() {
  if (!running) return;
  let guard = 0;
  while (running && secNow() >= durationSecs() && guard++ < 4) {
    const over = secNow() - durationSecs();
    if (phase === 2) { elapsed = durationSecs(); running = false; timed = null; emom = null; cue('finish'); keepAwake(false); persistSession(); renderPhase(); if (isTabata()) saveSession(localDay()); else toast('Training geschafft – jetzt speichern.'); return; }
    if (phase === 1 && isTabata()) tabataDone = tabataWorkTotal();
    phase++; timed = null; emom = null; elapsed = Math.max(0, over); startedAt = Date.now(); resetCues(); cue('phase');
    toast(phase === 1 ? mainName() + ' läuft.' : 'Jetzt Cooldown.');
    persistSession(); renderPhase(); renderList();
  }
  if (phase !== 1) { const s = currentStep(); signalCountdown(phase + '-' + s.group + '-' + s.start, s.end - secNow()); }
  else if (isTabata()) {
    const sg = currentSeg(), id = 'tb-' + sg.start;
    if (lastScene !== id) { if (lastScene !== null) cue(sg.type === 'work' ? 'work' : 'rest'); lastScene = id; lastSecond = null; if (sg.block !== tbBlock) { tbBlock = sg.block; renderList(); } }
    const sec = Math.ceil(sg.end - secNow());
    if (sec !== lastSecond) { lastSecond = sec; if (sec >= 1 && sec <= 3) cue('count'); }
  }
  else {
    const rem = Math.ceil(durationSecs() - secNow());
    if (rem !== phaseCueSecond) { phaseCueSecond = rem; if (rem >= 1 && rem <= 3) cue('count'); }
    if (timed) {
      const pr = Math.max(0, secNow() - timed.start), seg = Math.min(timed.sides - 1, Math.floor(pr / timed.seconds));
      if (pr >= timed.seconds * timed.sides) { cue('step'); timed = null; finishExercise(true); toast('✓ Zeitübung geschafft und gezählt.'); }
      else signalCountdown('t-' + timed.index + '-' + seg, (seg + 1) * timed.seconds - pr);
    }
    if (emom) {
      const pr = Math.max(0, secNow() - emom.start);
      if (pr >= emom.minutes * 60) { emom = null; cue('finish'); toast('✓ EMOM fertig – Wiederholungen eintragen.'); persistSession(); renderEmom(); }
      else { const m = Math.floor(pr / 60); signalCountdown('e-' + m, (m + 1) * 60 - pr); }
    }
  }
  updateClock();
}
function play() {
  if (sessionSaved) return;
  if (isFinished()) { saveSession(localDay()); return; }
  if (running) { elapsed = secNow(); running = false; keepAwake(false); toast('Pausiert.'); }
  else { audioReady(); startedAt = Date.now(); running = true; if (elapsed === 0 && phase === 0) cue('phase'); keepAwake(true); }
  persistSession(); renderControls(); renderCurrent(); renderEmom(); tick();
}
function skip() {
  if (sessionSaved || isFinished()) return;
  audioReady();
  if (phase === 2) { elapsed = durationSecs(); running = false; timed = null; emom = null; cue('finish'); keepAwake(false); persistSession(); renderPhase(); toast('Training beendet – jetzt speichern.'); return; }
  if (phase === 1 && isTabata()) tabataDone = workDoneAt(secNow());
  phase++; elapsed = 0; startedAt = Date.now(); timed = null; emom = null; resetCues(); cue('phase');
  toast(phase === 1 ? mainName() + ' gestartet.' : 'Jetzt kommt das Cooldown.');
  persistSession(); renderPhase(); renderList();
}
function resetTraining() {
  if (sessionActive() && !confirm('Aktuelles Training zurücksetzen? Nicht gespeicherte Fortschritte gehen verloren.')) return;
  resetState(); persistSession(); renderAll();
}
function setPlan(p) {
  if (p === plan || !PLANS[p]) return;
  if (sessionActive() && !confirm('Zum anderen Plan wechseln? Der aktuelle, nicht gespeicherte Durchgang geht verloren.')) return;
  plan = p; store(KEYS.plan, p); resetState(); persistSession(); renderAll(); window.scrollTo({ top: 0 });
}
function finishExercise(fromTimer) {
  if (isSets() || isTabata() || phase !== 1 || sessionSaved || (timed && !fromTimer)) return;
  completions++; resetCues();
  const n = exList().length;
  if (!fromTimer) toast(completions % n === 0 ? '🎉 Runde ' + completions / n + ' geschafft!' : '✓ ' + exList()[(completions - 1) % n].name);
  persistSession(); renderList(); renderCurrent(); renderControls(); renderStats();
}
function undo() {
  if (isSets() || isTabata() || completions < 1 || sessionSaved || timed) return;
  completions--; persistSession(); renderList(); renderCurrent(); renderControls(); renderStats(); toast('Letzte Übung zurückgenommen.');
}
function timedParams(reps) { const m = String(reps).match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*Sek\./); return m ? { min: Number(m[1]), max: Number(m[2] || m[1]), sides: /je Seite/.test(reps) ? 2 : 1 } : null; }
function startTimed() {
  if (phase !== 1 || !running || timed || isSets()) return;
  const ex = exList(), off = completions % ex.length, tp = timedParams(ex[off].reps); if (!tp) return;
  audioReady();
  const secs = tp.min === tp.max ? tp.min : Number($('timedlength').value) || tp.max;
  timed = { index: completions, seconds: secs, sides: tp.sides, start: secNow() }; resetCues(); cue('step');
  persistSession(); renderCurrent(); renderControls();
}
function startEmom() { if (!isSets() || phase !== 1 || !running || emom) return; audioReady(); emom = { start: secNow(), minutes: 3 }; resetCues(); cue('step'); persistSession(); renderEmom(); }
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
    if (!hasReps() && !confirm('Du hast noch keine Sätze eingetragen. Trotzdem speichern?')) return false;
    entry = buildSetsEntry(date);
  } else if (isTabata()) {
    const of = tabataWorkTotal(), total = manual ? of : (phase === 1 ? workDoneAt(secNow()) : tabataDone);
    entry = { v: 3, id: uid(), date, plan, mode: 'tabata', total, of, cfg: currentCfg(), names: exList().map(x => x.name), at: new Date().toISOString() };
  } else {
    const total = manual ? opts.total : completions;
    if (total === 0 && !confirm('Du hast noch keine Übung erfasst. Trotzdem speichern?')) return false;
    const ex = exList();
    entry = { v: 3, id: uid(), date, plan, total, cfg: currentCfg(), names: ex.map(x => x.name), at: new Date().toISOString() };
  }
  if (manual) entry.manual = true;
  saved.push(entry); persistEntries();
  if (!manual) { sessionSaved = true; running = false; timed = null; emom = null; keepAwake(false); }
  if (isSets()) runReps = emptyReps(plan);
  persistSession(); renderAll();
  toast(isTabata() && !manual ? '✓ Tabata geschafft und gespeichert.' : '✓ Gespeichert. Du findest die Einheit im Verlauf.');
  return true;
}

/* ---------- Darstellung ---------- */
let toastTimer = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }

function renderTabs() {
  $('tabs').innerHTML = PLAN_ORDER.map(k => `<button role="tab" type="button" data-plan="${k}" aria-selected="${k === plan}">${esc(PLANS[k].tab)}</button>`).join('');
}
function renderGear() {
  $('gearbar').innerHTML = '<span class="lbl">Heute dabei:</span>' +
    `<button class="chip" type="button" data-gear="kb" aria-pressed="${gear.kb}">Kettlebell</button>` +
    `<button class="chip" type="button" data-gear="band" aria-pressed="${gear.band}">Bänder</button>` +
    '<span class="lbl">+ Körpergewicht</span>';
}
function renderHeader() {
  const p = PLANS[plan], ex = exList();
  $('plan-title').textContent = p.label;
  $('listkicker').textContent = isTabata() ? 'Tabata · ' + tabataCfg().rounds + ' Runden je Übung' : isSets() ? 'Sätze' : 'Zirkel';
  $('workoutname').textContent = `${ex.length} Übungen · ${Math.round(phaseSecs(plan, 1) / 60)} Min.`;
  $('intro').textContent = p.intro + ' Übung antippen für Anleitung und Skizze.';
  $('sound').textContent = soundEnabled ? '🔊' : '🔇'; $('sound').setAttribute('aria-pressed', String(soundEnabled)); $('sound').setAttribute('aria-label', soundEnabled ? 'Ton ausschalten' : 'Ton einschalten');
  $('soundval').textContent = soundEnabled ? 'An' : 'Aus';
}
function renderPhase() {
  const p = PLANS[plan];
  const names = ['Aufwärmen', isTabata() ? 'Tabata' : isSets() ? 'Kraft' : 'Zirkel', 'Cooldown'];
  $('phase-badge').textContent = sessionSaved ? 'Gespeichert' : isFinished() ? 'Geschafft' : names[phase];
  $('timeline').innerHTML = names.map((n, i) => `<span class="${i === phase && !sessionSaved ? 'on' : ''}">${n} ${Math.round(phaseSecs(plan, i) / 60)}′</span>`).join('');
  $('timehint').textContent = sessionSaved ? 'Diese Einheit ist gespeichert. „Training zurücksetzen“ startet eine neue.'
    : phase === 0 ? 'Die Aufwärmübungen laufen automatisch mit Countdown und Seitenwechsel.'
      : phase === 1 ? (isTabata() ? 'Läuft automatisch: 20 Sek. Arbeit, 10 Sek. Pause, Ton bei jedem Wechsel und 3-2-1 vorher. Einfach mitmachen.' : isSets() ? 'Wiederholungen je Satz eintragen: Kraft, Läufer-Block, dann Swing-EMOM. Die Zeit ist ein Richtwert.' : 'Übungen der Reihe nach abhaken. Bei Zeitübungen den Übungs-Timer starten.')
        : 'Die Dehnungen und Seitenwechsel werden automatisch per Ton angesagt.';
  renderStepsList(); renderCurrent(); renderControls(); renderStats(); updateClock();
}
function updateClock() {
  const done = sessionSaved || isFinished(), tb = isTabata() && phase === 1 && !done, sg = tb ? currentSeg() : null;
  const frac = done ? 1 : tb ? Math.min(1, (secNow() - sg.start) / (sg.end - sg.start)) : Math.min(1, secNow() / durationSecs());
  $('timer').textContent = done ? '00:00' : tb ? clock(sg.end - secNow()) : clock(durationSecs() - secNow());
  $('ringprog').classList.toggle('rest', !!sg && sg.type !== 'work');
  $('ringprog').style.strokeDashoffset = String(552.9 * (1 - frac)); $('ringprog').style.opacity = frac > 0.002 ? '1' : '0';
  if (tb) { const ex = exList(), c = tabataCfg(); $('phase-badge').textContent = sg.type === 'work' ? 'Arbeit' : sg.type === 'rest' ? 'Pause' : 'Übungswechsel'; $('ringsub').textContent = sg.type === 'blockrest' ? 'gleich: ' + ex[sg.block + 1].name : `Übung ${sg.block + 1}/${ex.length} · Runde ${sg.round + 1}/${c.rounds}`; }
  else $('ringsub').textContent = done ? (sessionSaved ? 'Einheit gespeichert' : 'Jetzt speichern') : running ? 'verbleibend' : (elapsed > 0 || phase > 0 ? 'pausiert' : 'bereit');
  const showStep = (phase !== 1 || tb) && !done;
  $('stepstatus').classList.toggle('hide', !showStep);
  if (tb) {
    const ex = exList(), nx = sg.type === 'work' ? null : sg.type === 'rest' ? ex[sg.block] : ex[sg.block + 1];
    $('steplabel').textContent = sg.type === 'work' ? 'Jetzt' : 'Gleich';
    $('stepname').textContent = sg.type === 'work' ? ex[sg.block].name : nx.name;
    $('stepdesc').textContent = 'Tabata gesamt noch ' + clock(durationSecs() - secNow()) + ' · antippen für Anleitung';
    $('stepclock').textContent = clock(sg.end - secNow());
  } else if (showStep) {
    const s = currentStep(), list = phase === 0 ? PLANS[plan].warmup : PLANS[plan].cooldown;
    $('steplabel').textContent = (phase === 0 ? 'Aufwärmen' : 'Cooldown') + ` · ${s.group + 1} von ${list.length}`;
    $('stepname').textContent = s.name; $('stepdesc').textContent = 'Antippen für Anleitung';
    $('stepclock').textContent = clock(s.end - secNow());
    for (const type of ['warmup', 'cooldown']) for (const item of $(type).children) {
      const active = (phase === 0 && type === 'warmup') || (phase === 2 && type === 'cooldown'), i = Number(item.dataset.group);
      item.classList.toggle('focus', active && i === s.group); item.classList.toggle('done', active && i < s.group);
    }
  }
  if (timed) {
    const pr = Math.max(0, secNow() - timed.start), part = Math.min(timed.sides - 1, Math.floor(pr / timed.seconds));
    $('timedclock').textContent = clock((part + 1) * timed.seconds - pr);
    $('timedinfo').textContent = timed.sides === 2 ? `${part === 0 ? 'Linke' : 'Rechte'} Seite · ${part + 1} von 2` : 'Position halten bis zum Signal.';
  }
  if (emom) renderEmomClock();
  renderLivePill();
}
function renderStepsList() {
  for (const type of ['warmup', 'cooldown']) $(type).innerHTML = PLANS[plan][type].map((s, i) => `<button type="button" class="row" data-group="${i}" data-guide-name="${esc(s[1])}"><span class="dur">${esc(s[0])}</span><span class="txt"><b>${esc(s[1])}</b>${parseStep(s[0]).times > 1 ? '<small>links und rechts, Wechsel per Ton</small>' : ''}</span><span class="chev"></span></button>`).join('');
}
function renderCurrent() {
  const ex = exList(), cur = $('current'), tw = $('timerwork');
  if (isSets() || isTabata() || sessionSaved || isFinished()) { cur.classList.add('hide'); tw.classList.add('hide'); return; }
  const n = ex.length, off = completions % n, x = ex[off];
  cur.classList.remove('hide');
  $('currentlabel').textContent = phase === 1 ? 'Jetzt' : 'Erste Übung';
  $('currentname').textContent = x.name; $('currentrep').textContent = `${x.reps} · ${x.gearText}`;
  $('roundbadge').textContent = 'Runde ' + (Math.floor(completions / n) + 1);
  cur.dataset.index = off;
  const tp = timedParams(x.reps), show = phase === 1 && !!tp;
  tw.classList.toggle('hide', !show);
  if (!show) return;
  const sel = $('timedlength'), key = plan + '-' + off;
  sel.classList.toggle('hide', tp.min === tp.max);
  if (tp.min !== tp.max) {
    sel.innerHTML = [tp.min, tp.max].map(v => `<option value="${v}">${v} Sek.${tp.sides === 2 ? ' je Seite' : ''}</option>`).join('');
    sel.value = String(timedPick[key] || tp.max);
  }
  const btn = $('timedstart');
  btn.disabled = !!timed || !running; btn.textContent = timed ? '● Timer läuft' : '▶ Übungs-Timer';
  if (!timed) {
    $('timedclock').textContent = clock(tp.min === tp.max ? tp.min : Number(sel.value));
    $('timedinfo').textContent = (running ? '' : 'Erst den Haupt-Timer starten. ') + (tp.sides === 2 ? 'Links und rechts nacheinander, ' : '') + 'nach Ablauf automatisch gezählt.';
  }
}
function renderControls() {
  const main = $('btnMain'), done = $('btnDone'), undoB = $('btnUndo'), next = $('btnNext'), circuit = !isSets() && !isTabata();
  if (sessionSaved) { main.textContent = '✓ Gespeichert'; main.disabled = true; }
  else if (isFinished()) { main.textContent = '💾 Speichern'; main.disabled = false; }
  else { main.textContent = running ? 'Ⅱ Pause' : (elapsed > 0 || phase > 0 ? '▶ Weiter' : '▶ Starten'); main.disabled = isTabata() && !gear.kb && !sessionActive(); }
  const showDone = circuit && phase === 1 && !sessionSaved && !isFinished();
  main.setAttribute('aria-label', main.textContent.replace(/^[^A-Za-zÄÖÜ]+/, ''));
  if (showDone && !sessionSaved && !isFinished()) main.textContent = running ? 'Ⅱ' : '▶';
  main.classList.toggle('compact', showDone);
  next.classList.toggle('compact', showDone);
  done.classList.toggle('hide', !showDone);
  done.disabled = !running || !!timed;
  done.textContent = timed ? '● Zeitübung läuft' : '✓ Erledigt';
  undoB.classList.toggle('hide', !(circuit && phase >= 1 && completions > 0 && !sessionSaved && !isFinished()));
  undoB.disabled = !!timed;
  next.classList.toggle('hide', sessionSaved || isFinished());
  next.textContent = phase === 2 ? 'Beenden ✓' : phase === 0 ? 'Zum ' + mainName() + ' →' : 'Cooldown →';
  next.setAttribute('aria-label', next.textContent.replace(/[→✓]/g, '').trim());
  if (showDone) next.textContent = '⏭';
}
function renderStats() {
  const ex = exList(), n = ex.length, all = saved.filter(e => e.plan === plan), comp = all.filter(comparable);
  const parts = [];
  if (isTabata()) {
    parts.push(`<span>Einheiten <b>${comp.length}</b>${comp.length !== all.length ? ' von ' + all.length + ' vergleichbar' : ''}</span>`);
    parts.push(`<span>Komplett <b>${comp.filter(e => e.total >= e.of).length}</b></span>`);
    parts.push(`<span>Arbeit <b>${Math.round(tabataWorkTotal() * 20 / 60)} Min.</b></span>`);
    $('statsline').innerHTML = parts.join(''); return;
  }
  let best = null; if (comp.length) best = Math.max(...comp.map(e => e.total));
  if (!isSets()) parts.push(`<span>Runden <b>${Math.floor(completions / n)}</b> + <b>${completions % n}</b></span>`);
  parts.push(`<span>Bestwert <b>${best === null ? '–' : isSets() ? best + ' Wdh.' : Math.floor(best / n) + 'R +' + best % n}</b></span>`);
  parts.push(`<span>Einheiten <b>${comp.length}</b>${comp.length !== all.length ? ' von ' + all.length + ' vergleichbar' : ''}</span>`);
  $('statsline').innerHTML = parts.join('');
}
function lastSetsEntry() { return saved.filter(e => e.plan === plan && e.mode === 'sets' && e.v >= 3).sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')))[0]; }
function renderList() {
  const ex = exList(), wl = $('worklist');
  if (isTabata()) {
    wl.className = 'group';
    const c = tabataCfg(), cur = phase === 1 && !sessionSaved && !isFinished() ? currentSeg().block : phase === 0 && !sessionSaved ? 0 : -1;
    wl.innerHTML = ex.map((x, i) => { const d = (phase === 1 && i < cur) || (phase === 2 && !sessionSaved); return `<button type="button" class="row ${i === cur ? 'focus' : ''} ${d ? 'done' : ''}" data-ex="${i}"><span class="num">${d ? '✓' : i + 1}</span><span class="txt"><b>${esc(x.name)}</b><small>${esc(x.gearText)} · ${esc(x.note)}</small></span><span class="val">${c.rounds} × 20″</span><span class="chev"></span></button>`; }).join('');
    return;
  }
  if (!isSets()) {
    wl.className = 'group';
    const n = ex.length, off = completions % n, active = phase <= 1 && !sessionSaved;
    wl.innerHTML = ex.map((x, i) => { const d = active && phase === 1 && i < off; return `<button type="button" class="row ${active && i === off ? 'focus' : ''} ${d ? 'done' : ''}" data-ex="${i}"><span class="num">${d ? '✓' : i + 1}</span><span class="txt"><b>${esc(x.name)}</b><small>${esc(x.gearText)} · ${esc(x.note)}</small></span><span class="val">${esc(x.reps)}</span><span class="chev"></span></button>`; }).join('');
    return;
  }
  wl.className = '';
  const last = lastSetsEntry(); let html = '', blk = null;
  ex.forEach((x, i) => {
    const sl = x.slot;
    if (sl.block !== blk) { html += (blk === null ? '' : '</div>') + `<div class="header" style="margin-top:${blk === null ? 4 : 22}px">${esc(sl.block)}</div><div class="group">`; blk = sl.block; }
    const st = stageOf(plan, sl);
    const stageSel = sl.stages ? `<select class="stagesel" data-stage="${sl.id}" aria-label="Stufe ${esc(x.name)}">${sl.stages.map(s => `<option ${s === st ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : '';
    const inputs = runReps[sl.id].map((v, k) => `<label class="setin"><span>${sl.setLabel || 'Satz'} ${k + 1}</span><input type="number" inputmode="numeric" min="0" max="${/Sek\./.test(x.reps) ? 600 : 200}" step="1" data-slot="${sl.id}" data-idx="${k}" value="${esc(v)}" placeholder="${/Sek\./.test(x.reps) ? 'Sek.' : 'Wdh.'}"></label>`).join('');
    let lastTxt = 'Noch kein Eintrag';
    if (last && (last.cfg || []).length === ex.length && last.sets[i]) lastTxt = `Zuletzt (${dateGerman(last.date)}): ${last.sets[i].map(r => r ?? '–').join(' / ')}${last.stages && last.stages[i] ? ' · ' + esc(last.stages[i]) : ''} · ${esc(cfgText(last.cfg[i]))}${last.names && last.names[i] !== x.name ? ' · ' + esc(last.names[i]) : ''}`;
    const em = sl.emom ? '<div class="timedctl" style="padding:8px 0 0"><button type="button" class="btn small primary" id="emomstart">▶ EMOM starten</button><strong class="stepclock" id="emomclock">03:00</strong></div><p class="tiny" id="emominfo"></p>' : '';
    html += `<div class="setcard"><div class="sethead"><button type="button" class="setname" data-ex="${i}">${esc(sl.stages && /^Bulgarian/.test(st) ? 'Bulgarian Split Squat' : x.name)} <span class="info">ⓘ</span></button><span class="setmeta">${esc(x.reps)}</span></div><div class="setmeta">${esc(x.gearText)} · ${esc(x.note)}</div>${stageSel}<div class="setrow">${inputs}</div><div class="setmeta">${lastTxt}</div>${em}</div>`;
  });
  wl.innerHTML = html + '</div>';
  renderEmom();
}
function renderEmom() {
  const b = document.getElementById('emomstart'); if (!b) return;
  b.disabled = !!emom || !running || phase !== 1; b.textContent = emom ? '● EMOM läuft' : '▶ EMOM starten';
  renderEmomClock();
}
function renderEmomClock() {
  const c = document.getElementById('emomclock'), info = document.getElementById('emominfo'); if (!c) return;
  if (emom) { const pr = Math.max(0, secNow() - emom.start), m = Math.min(emom.minutes - 1, Math.floor(pr / 60)); c.textContent = clock((m + 1) * 60 - pr); info.textContent = `Minute ${m + 1} von ${emom.minutes} · danach bei Min. ${m + 1} eintragen.`; }
  else { c.textContent = '03:00'; info.textContent = phase === 1 && running ? 'Zu Beginn jeder Minute die Wiederholungen, dann Pause. Ton bei jedem Minutenwechsel.' : 'Startbar in der Kraftphase bei laufendem Timer.'; }
}
function renderSettings() {
  const pk = plan;
  const rows = PLANS[pk].slots.map(sl => {
    const r = resolve(pk, sl);
    const opts = r.avail.map(g => `<option value="${g}" ${g === r.g ? 'selected' : ''}>${esc(GEAR_LABEL[g])}: ${esc(sl.v[g][0])}</option>`).join('');
    const param = r.g === 'kb' ? `<label class="param"><input type="number" min="0" max="60" step="0.5" inputmode="decimal" value="${r.kg}" data-kg="${sl.id}" aria-label="Gewicht für ${esc(r.name)}"> kg</label>`
      : r.g === 'band' ? `<select data-band="${sl.id}" aria-label="Band für ${esc(r.name)}">${BANDS.map(b => `<option value="${b}" ${b === r.band ? 'selected' : ''}>${esc(bandLabel(b).replace('Band ', ''))}</option>`).join('')}</select>` : '<span class="param">–</span>';
    const missing = Object.keys(sl.v).filter(g => g !== 'bw' && !gear[g]).map(g => GEAR_LABEL[g]);
    return `<div class="srow"><div class="sname"><b>${esc(r.name)}</b><small>${r.avail.length > 1 ? r.avail.length + ' Varianten verfügbar' : 'nur diese Variante'}${missing.length ? ' · ohne ' + esc(missing.join(', ')) : ''}</small></div><select data-pref="${sl.id}" ${r.avail.length < 2 ? 'disabled' : ''} aria-label="Variante">${opts}</select>${param}</div>`;
  }).join('');
  const tbRows = isTabata() ? (() => { const c = tabataCfg(); return `<div class="srow"><div class="sname"><b>Runden je Übung</b><small>Empfehlung zum Einstieg: 6</small></div><select data-tabata="rounds" aria-label="Runden je Übung">${TABATA_ROUNDS.map(v => `<option value="${v}" ${v === c.rounds ? 'selected' : ''}>${v} Runden</option>`).join('')}</select><span class="param">20″ / 10″</span></div><div class="srow"><div class="sname"><b>Pause zwischen Übungen</b><small>Empfehlung zum Einstieg: 90 Sek.</small></div><select data-tabata="blockRest" aria-label="Pause zwischen Übungen">${TABATA_RESTS.map(v => `<option value="${v}" ${v === c.blockRest ? 'selected' : ''}>${v} Sek.</option>`).join('')}</select><span class="param">${Math.round(phaseSecs('tabata', 1) / 60)} Min.</span></div>`; })() : '';
  $('settings').innerHTML = tbRows + `<p class="tiny">Gilt für „${esc(PLANS[pk].tab)}“. Welche Varianten erscheinen, steuerst du oben mit „Heute dabei“. Einheiten mit anderen Varianten oder Gewichten zählen nicht in den Bestwert.</p>${rows}
  <div class="srow"><div class="sname"><b>Alle Kettlebell-Übungen</b><small>dieses Plans auf ein Gewicht setzen</small></div><label class="param"><input type="number" min="0" max="60" step="0.5" inputmode="decimal" id="allkg" value="${KB_DEFAULT}" aria-label="Gewicht für alle Kettlebell-Übungen"> kg</label><button class="btn small" type="button" id="allkgbtn">Übernehmen</button></div>
  ${gear.band ? `<p class="tiny">${esc(BAND_TEXT)}</p>` : ''}`;
}
function settingsLocked() { return isTabata() ? sessionActive() : !isSets() && !sessionSaved && (running || completions > 0); }
function updateChoice(slotId, patch) {
  const k = plan + '.' + slotId; choices[k] = Object.assign({}, isObj(choices[k]) ? choices[k] : {}, patch); store(KEYS.choice, choices);
}

/* ---------- Verlauf ---------- */
function renderHistory() {
  const rows = saved.filter(e => e.plan === plan).sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')));
  const comp = rows.filter(comparable);
  $('sessioncount').textContent = comp.length === rows.length ? String(rows.length) : `${comp.length}/${rows.length}`;
  $('historyhint').textContent = isSets() ? 'Balken: Summe der Wiederholungen. Blass: anderer Aufbau (Variante, Stufe oder Gewicht).' : 'Balken: abgeschlossene Übungen in der festen Zirkelzeit. Blass: anderer Aufbau (Übungen, Geräte oder Gewichte).';
  $('history').innerHTML = rows.length ? rows.map(e => `<tr><td>${esc(dateGerman(e.date))}</td><td>${resultText(e)}${comparable(e) ? '' : ' <span class="tag">· anderer Aufbau</span>'}${e.manual ? ' <span class="tag">· nachgetragen</span>' : ''}</td><td><button class="btn small danger" type="button" data-delete="${esc(e.id)}" aria-label="Eintrag vom ${esc(dateGerman(e.date))} löschen">Löschen</button></td></tr>`).join('') : '<tr><td colspan="3" class="tag">Noch keine Einheit gespeichert.</td></tr>';
  const box = $('chartbox');
  if (!rows.length) { box.innerHTML = '<div class="empty">Nach der ersten gespeicherten Einheit erscheint hier dein Fortschritt.</div>'; return; }
  const data = rows.slice(0, 12).reverse(), max = Math.max(1, ...data.map(x => x.total)), w = 740, base = 158, l = 30, plotW = w - l - 14, plotH = base - 18, step = plotW / data.length, barW = Math.min(48, step * 0.56);
  const bars = data.map((x, i) => { const xx = l + step * i + (step - barW) / 2, hh = Math.max(1, x.total / max * plotH), yy = base - hh, c = comparable(x); return `<rect class="bar" x="${xx}" y="${yy}" width="${barW}" height="${hh}" rx="6" opacity="${c ? 1 : 0.3}"><title>${esc(dateGerman(x.date))}: ${resultText(x)}${c ? '' : ' (anderer Aufbau)'}</title></rect><text class="val" x="${xx + barW / 2}" y="${Math.max(yy - 6, 10)}" text-anchor="middle" font-size="12">${x.total}</text><text class="lbl" x="${xx + barW / 2}" y="178" text-anchor="middle" font-size="11">${x.date.slice(5).split('-').reverse().join('.')}</text>`; }).join('');
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${w} 190" role="img" aria-label="Balkendiagramm der letzten ${data.length} Einheiten"><line class="axis" x1="${l}" y1="${base}" x2="${w - 4}" y2="${base}"/>${bars}</svg>`;
}
function renderManual() {
  const sets = isSets(), tb = isTabata(), n = exList().length;
  $('manualroundfield').classList.toggle('hide', sets || tb); $('manualextrafield').classList.toggle('hide', sets || tb);
  $('manualextra').max = String(n - 1);
  $('manualhint').textContent = tb ? 'Tabata: speichert eine vollständige Einheit mit den aktuellen Einstellungen und dem gewählten Datum.' : sets ? 'Lauftraining: Sätze oben im Plan eintragen und hier mit dem gewählten Datum speichern.' : `Für „${PLANS[plan].tab}“ mit den aktuell eingestellten Varianten und Gewichten.`;
}
/* ---------- Bauchumfang ---------- */
function validWaist(e) { return isObj(e) && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.cm === 'number' && Number.isFinite(e.cm) && e.cm >= 40 && e.cm <= 250; }
const waistLoaded = loadList(KEYS.waist, validWaist);
let waist = waistLoaded.ok; const waistKeep = waistLoaded.keep;
function persistWaist() { if (!store(KEYS.waist, waist.concat(waistKeep))) toast('Speichern im Browser nicht möglich – bitte Backup exportieren.'); renderBackupBanner(); }
const waistSorted = () => [...waist].sort((a, b) => a.date.localeCompare(b.date));
function renderWaist() {
  const rows = waistSorted(), newest = rows.at(-1), oldest = rows[0];
  $('waistlatest').textContent = newest ? cmString(newest.cm) + ' cm' : '–';
  $('waistlastdate').textContent = newest ? dateGerman(newest.date) : 'Noch keine Messung';
  $('waistcount').textContent = String(rows.length);
  const delta = rows.length > 1 ? newest.cm - oldest.cm : 0, d = $('waistdelta');
  d.textContent = rows.length < 2 ? '–' : (delta > 0 ? '+' : '') + cmString(delta) + ' cm';
  d.style.color = rows.length < 2 ? '' : delta < 0 ? 'var(--accent-ink)' : delta > 0 ? 'var(--orange)' : '';
  const b = $('waistreminder'); b.classList.remove('due');
  if (!newest) b.textContent = 'Noch keine Messung: morgens vor dem Frühstück messen und den ersten Wert eintragen.';
  else { const next = new Date(newest.date + 'T12:00:00'); next.setDate(next.getDate() + 7); const nd = localDay(next), due = localDay() >= nd; b.classList.toggle('due', due); b.textContent = due ? `📏 Zeit für die nächste Messung – die letzte war am ${dateGerman(newest.date)}.` : `✓ Letzte Messung am ${dateGerman(newest.date)}. Nächste ab ${dateGerman(nd)}.`; }
  $('waisthistory').innerHTML = rows.length ? rows.slice().reverse().map(e => `<tr><td>${dateGerman(e.date)}</td><td><b>${cmString(e.cm)} cm</b></td><td>${esc(e.note || '–')}</td><td><button class="btn small danger" type="button" data-waist-delete="${esc(e.date)}" aria-label="Messung vom ${dateGerman(e.date)} löschen">Löschen</button></td></tr>`).join('') : '<tr><td colspan="4" class="tag">Noch keine Messung gespeichert.</td></tr>';
  const t = $('waistchart');
  if (!rows.length) { t.innerHTML = '<div class="empty">Nach der ersten Messung erscheint hier der Verlauf.</div>'; return; }
  const data = rows.slice(-12), w = 730, h = 226, left = 48, right = 29, top = 28, bottom = 190, pw = w - left - right;
  let lo = Math.min(...data.map(e => e.cm)), hi = Math.max(...data.map(e => e.cm)); const m = Math.max(1, (hi - lo) * 0.25);
  lo = Math.floor((lo - m) * 2) / 2; hi = Math.ceil((hi + m) * 2) / 2; if (hi <= lo) hi = lo + 2;
  const y = v => bottom - ((v - lo) / (hi - lo)) * (bottom - top), x = i => left + (data.length === 1 ? pw / 2 : i * pw / (data.length - 1));
  const grid = [0, .25, .5, .75, 1].map(f => { const yy = top + (bottom - top) * f, v = hi - (hi - lo) * f; return `<line class="axis" x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}" stroke-dasharray="4 5"/><text class="lbl" x="${left - 9}" y="${yy + 4}" text-anchor="end" font-size="12">${cmString(v)}</text>`; }).join('');
  const path = data.map((e, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(e.cm).toFixed(1)}`).join(' ');
  const dots = data.map((e, i) => `<circle class="dot" cx="${x(i)}" cy="${y(e.cm)}" r="5.5" stroke-width="2"><title>${dateGerman(e.date)}: ${cmString(e.cm)} cm</title></circle>`).join('');
  const labels = data.map((e, i) => i === 0 || i === data.length - 1 || data.length <= 5 ? `<text class="lbl" x="${x(i)}" y="${h - 12}" text-anchor="middle" font-size="12">${e.date.slice(5).split('-').reverse().join('.')}</text>` : '').join('');
  t.innerHTML = `<svg class="chart" role="img" aria-label="Bauchumfang der letzten ${data.length} Messungen, von ${cmString(data[0].cm)} bis ${cmString(data.at(-1).cm)} cm" viewBox="0 0 ${w} ${h}">${grid}<path class="line" d="${path}" fill="none" stroke-width="3" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

/* ---------- Dateien: Backup, CSV, Kalender ---------- */
function download(name, content, type) { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function backupJson() { return JSON.stringify({ version: 3, entries: saved.concat(savedKeep), waist: waist.concat(waistKeep), settings: { gear, choices, stages }, exportedAt: new Date().toISOString() }, null, 2); }
function schemaCheck() {
  const prev = load(SCHEMA_KEY, null);
  if (prev === SCHEMA || (typeof prev === 'number' && prev > SCHEMA)) return; // neuere Daten mit älterer App: nichts verändern
  if (saved.length + savedKeep.length + waist.length + waistKeep.length > 0) store(PRE_UPDATE_KEY, { savedAt: new Date().toISOString(), fromSchema: prev, json: backupJson() });
  store(SCHEMA_KEY, SCHEMA);
}
function renderPreUpdate() {
  const b = load(PRE_UPDATE_KEY, null), row = $('preupdate');
  row.classList.toggle('hide', !isObj(b) || typeof b.json !== 'string');
  if (isObj(b) && b.savedAt) $('preupdatehint').textContent = 'Automatisch angelegt am ' + dateGerman(localDay(new Date(b.savedAt)));
}
function markBackup() { store(KEYS.backup, localDay()); renderBackupBanner(); }
// Sicherung als lokale Datei: Teilen-Menü (iPhone: „In Dateien sichern“), Dateidialog oder Download – nie ein Server
async function exportBackup() {
  const name = `kb-tracker-backup-${localDay()}.json`, json = backupJson();
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && document.documentElement.dataset.os !== 'other') {
      await navigator.share({ files: [file], title: 'KB Tracker Backup' }); markBackup(); toast('Sicherung übergeben.'); return;
    }
    if (window.showSaveFilePicker) {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      const w = await h.createWritable(); await w.write(json); await w.close(); markBackup(); toast('In Datei gesichert.'); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  download(name, json, 'application/json'); markBackup(); toast('Sicherung heruntergeladen.');
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      let entries = Array.isArray(x) ? x : isObj(x) && Array.isArray(x.entries) ? x.entries : [];
      let wl = isObj(x) && Array.isArray(x.waist) ? x.waist : [];
      entries = entries.filter(validEntry).map(e => Object.assign({}, e, { id: String(e.id || `legacy-${e.plan}-${e.date}-${e.total}-${e.at || ''}`) }));
      wl = wl.filter(validWaist).map(e => Object.assign({}, e, { note: String(e.note || '').slice(0, 120) }));
      const settings = isObj(x) && isObj(x.settings) ? x.settings : null;
      if (!entries.length && !wl.length && !settings) throw Error('Keine gültigen Daten gefunden');
      const ids = new Set(saved.map(e => String(e.id))); let added = 0, addedW = 0;
      for (const e of entries) if (!ids.has(e.id)) { saved.push(e); ids.add(e.id); added++; }
      const days = new Set(waist.map(e => e.date));
      for (const e of wl) if (!days.has(e.date)) { waist.push(e); days.add(e.date); addedW++; }
      persistEntries(); persistWaist();
      if (settings && confirm('Das Backup enthält auch Einstellungen (Geräte, Varianten, Gewichte). Übernehmen?')) {
        if (isObj(settings.gear)) { gear = { kb: settings.gear.kb !== false, band: settings.gear.band !== false }; store(KEYS.gear, gear); }
        if (isObj(settings.choices)) { choices = settings.choices; store(KEYS.choice, choices); }
        if (isObj(settings.stages)) { stages = settings.stages; store(KEYS.stage, stages); }
        if (!sessionActive()) runReps = emptyReps(plan);
      }
      renderAll(); renderWaist();
      alert(`${added} Trainings- und ${addedW} Bauchumfang-Einträge importiert.${entries.length - added + wl.length - addedW > 0 ? ' Bereits vorhandene Einträge wurden übersprungen.' : ''}`);
    } catch (e) { alert('Import fehlgeschlagen: ' + e.message); }
  };
  r.readAsText(file);
}
function exportCsv() {
  const head = ['Datum', 'Plan', 'Runden', 'Weitere Übungen', 'Übungen bzw. Wdh. gesamt', 'Vergleichbar mit aktuellem Aufbau', 'Details'];
  const rows = saved.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
    const cmp = comparable(e) ? 'ja' : 'nein';
    if (e.mode === 'sets') {
      const det = e.v >= 3 ? e.sets.map((r, i) => `${e.names[i]}${e.stages && e.stages[i] ? ' (' + e.stages[i] + ')' : ''} ${cfgText(e.cfg[i])}: ${r.map(v => v ?? '-').join('/')}`).join(' | ') : resultText(e);
      return [e.date, PLANS[e.plan].short, '', '', e.total, cmp, det];
    }
    const n = entryCount(e), det = e.v >= 3 ? e.names.map((nm, i) => `${nm} ${cfgText(e.cfg[i])}`).join(' | ') : '';
    return [e.date, PLANS[e.plan].short, Math.floor(e.total / n), e.total % n, e.total, cmp, det];
  });
  download('trainingstagebuch.csv', '﻿' + [head, ...rows].map(r => r.map(c => String(c).replace(/;/g, ',').replace(/\r?\n/g, ' ')).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportWaistCsv() {
  const rows = [['Datum', 'Bauchumfang (cm)', 'Notiz'], ...waistSorted().map(e => [e.date, cmString(e.cm), (e.note || '').replace(/;/g, ',').replace(/\r?\n/g, ' ')])];
  download('bauchumfang-verlauf.csv', '﻿' + rows.map(r => r.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportWaistReminder() {
  const now = new Date(), next = new Date(now); next.setHours(8, 0, 0, 0); next.setDate(next.getDate() + (8 - next.getDay()) % 7); if (next <= now) next.setDate(next.getDate() + 7);
  const stamp = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  const until = new Date(next); until.setMinutes(until.getMinutes() + 5);
  const utc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KB Tracker//Koerpermasse//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', 'UID:jan-bauchumfang-montag-0800@kb-tracker.local', 'DTSTAMP:' + utc, 'DTSTART;TZID=Europe/Berlin:' + stamp(next), 'DTEND;TZID=Europe/Berlin:' + stamp(until),
    'RRULE:FREQ=WEEKLY;BYDAY=MO', 'SUMMARY:Bauchumfang messen', 'DESCRIPTION:Morgens vor dem Fruehstueck auf Nabelhoehe messen und im KB Tracker eintragen.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:Bauchumfang messen', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  const fold = line => { const enc = new TextEncoder(); let out = '', cur = '', limit = 75; for (const ch of line) { if (enc.encode(cur + ch).length > limit) { out += cur + '\r\n '; cur = ''; limit = 74; } cur += ch; } return out + cur; };
  download('bauchumfang-erinnerung.ics', lines.map(fold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
}

/* ---------- Hinweise: Backup & Home-Bildschirm ---------- */
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function renderBackupBanner() {
  const last = load(KEYS.backup, null), limit = new Date(); limit.setDate(limit.getDate() - 14);
  const due = saved.length + waist.length > 0 && (!last || last < localDay(limit));
  let html = '';
  if (area === 'kraft' && isTabata() && !gear.kb) html += `<div class="banner"><span class="bicon">🏋️</span><span>Tabata braucht die Kettlebell.</span><button class="btn small primary" type="button" id="kbon">Kettlebell aktivieren</button></div>`;
  if (due) html += `<div class="banner"><span class="bicon">💾</span><span>${last ? `Letzte Sicherung am ${dateGerman(last)}.` : 'Noch keine Sicherung.'} Die Daten liegen nur auf diesem Gerät.</span><button class="btn small primary" type="button" id="backupnow">Sichern</button></div>`;
  if (document.documentElement.dataset.os === 'ios' && !standalone() && !load(KEYS.hint, false)) html += `<div class="banner"><span class="bicon">📲</span><span>Für zuverlässige Speicherung: „Teilen“ → „Zum Home-Bildschirm“ und die App nur noch über das Symbol öffnen. Safari und die App haben getrennte Daten.</span><button class="btn small" type="button" id="hintclose">OK</button></div>`;
  $('banners').innerHTML = html;
}
async function renderStorageInfo() {
  let txt = standalone() ? 'Läuft als Home-Bildschirm-App.' : 'Läuft im Browser.';
  try { if (navigator.storage && navigator.storage.persisted) txt += (await navigator.storage.persisted()) ? ' Speicher ist als dauerhaft markiert.' : ' Speicher ist nicht als dauerhaft markiert – regelmäßig Backups exportieren.'; } catch (e) { }
  $('storageinfo').textContent = txt;
}

/* ---------- Anleitung ---------- */
const guide = $('guide'); let guideOrigin = null;
function openGuide(name, g, opts = {}) {
  const info = GUIDES[name]; if (!info) return;
  guideOrigin = opts.origin || null;
  $('guide-title').textContent = name;
  let extra = '';
  const sl = opts.slot;
  if (sl && sl.stages) extra += '<h3>Stufen &amp; Progression</h3><ol class="stagelist">' + sl.stages.map(s => `<li class="${s === opts.stage ? 'cur' : ''}"><b>${esc(s)}${s === opts.stage ? ' (gewählt)' : ''}</b> – ${esc(STAGE_INFO[s] || '')}</li>`).join('') + '</ol><p>Erst eine Stufe weiter, wenn alle Sätze mit 15 sauberen Wiederholungen klappen. Auf der neuen Stufe wieder bei etwa 8 Wiederholungen beginnen.</p>';
  if (sl && sl.stages && sl.stages.some(s => /Tempo/.test(s))) extra += `<h3>Was heißt Tempo 3-1-1?</h3><p class="guidecue">${esc(TEMPO_TEXT)}</p>`;
  if (sl && sl.emom) extra += `<h3>Was heißt EMOM?</h3><p>${esc(EMOM_TEXT)}</p>`;
  if (g === 'band') extra += `<h3>Bänder</h3><p>${esc(BAND_TEXT)}</p>`;
  if (opts.tabata) extra += `<h3>So läuft Tabata</h3><p>${esc(TABATA_TEXT)}</p><p class="guidecue">In 20 Sekunden zählt Qualität: lieber eine Wiederholung weniger als eine unsaubere.</p>`;
  $('guide-body').innerHTML = (opts.gearText ? `<span class="guidegear">${esc(opts.gearText)}${opts.reps ? ' · ' + esc(opts.reps) : ''}</span>` : '') + renderFigure(name, g || 'kb') +
    '<p class="guidecaption">Schematische Skizze. Maßgeblich sind die Hinweise unten.</p><h3>So geht’s</h3><ol>' + info.steps.map(t => `<li>${esc(t)}</li>`).join('') +
    `</ol><h3>Das trainierst du</h3><p>${esc(info.effect)}</p><h3>Darauf achten</h3><p class="guidecue">${esc(info.cue)}</p>${extra}<p class="guidecaption">Ruhig weiteratmen. Kontrolliert und im angenehmen Umfang ausführen; bei Schmerzen abbrechen.</p>`;
  guide.showModal(); guide.scrollTop = 0; $('guide-title').focus();
}
function openExerciseGuide(i, origin) {
  const x = exList()[i]; if (!x) return;
  const st = stageOf(plan, x.slot), name = x.slot.stages && /^Bulgarian/.test(st || '') ? 'Bulgarian Split Squat' : x.name;
  openGuide(name, x.g, { origin, slot: x.slot, stage: st, gearText: x.gearText, reps: isTabata() ? tabataCfg().rounds + ' × 20 Sek.' : x.reps, tabata: isTabata() });
}

function renderAll() {
  renderTabs(); renderGear(); renderHeader(); renderPhase(); renderList(); renderSettings(); renderHistory(); renderManual(); renderBackupBanner();
}

/* ---------- Bereiche: Kraft, Laufen, Mobility, Mehr ---------- */
let area = ['kraft', 'laufen', 'mobility', 'mehr'].includes(load(KEYS.area, 'kraft')) ? load(KEYS.area, 'kraft') : 'kraft';
let runView = load(KEYS.run, null); if (!isObj(runView)) runView = {}; runView = { tab: ['race', 'training', 'abc'].includes(runView.tab) ? runView.tab : 'race', race: runView.race || '5k', training: runView.training || 'interval' };
function showArea(a, scroll = true) {
  area = a; store(KEYS.area, a);
  for (const x of ['kraft', 'laufen', 'mobility', 'mehr']) $('area-' + x).classList.toggle('hide', x !== a);
  for (const b of $('tabbar').children) b.setAttribute('aria-selected', String(b.dataset.area === a));
  const bar = a === 'kraft';
  $('actionbar').classList.toggle('hide', !bar);
  document.body.style.setProperty('--actbar', bar ? '66px' : '0px');
  renderLivePill();
  if (scroll) window.scrollTo({ top: 0 });
}
function renderLivePill() {
  const pill = $('livepill'), show = area !== 'kraft' && sessionActive();
  pill.classList.toggle('hide', !show);
  document.body.style.setProperty('--actbar', area === 'kraft' ? '66px' : show ? '52px' : '0px');
  if (show) pill.textContent = (running ? '● ' : 'Ⅱ ') + PLANS[plan].tab + ' · ' + (isFinished() ? 'speichern' : clock(durationSecs() - secNow()));
}
const stepRow = (dur, name, detail) => {
  const has = !!GUIDES[name];
  return `<${has ? 'button type="button"' : 'div'} class="row" ${has ? `data-guide-name="${esc(name)}"` : ''}><span class="dur">${esc(dur)}</span><span class="txt"><b>${esc(name)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</span>${has ? '<span class="chev"></span>' : ''}</${has ? 'button' : 'div'}>`;
};
function renderRun() {
  const tabs = [['race', 'Wettkampf'], ['training', 'Training'], ['abc', 'Lauf-ABC']];
  $('runtabs').innerHTML = tabs.map(([k, l]) => `<button role="tab" type="button" data-runtab="${k}" aria-selected="${runView.tab === k}">${l}</button>`).join('');
  const sub = $('runsub');
  if (runView.tab === 'abc') {
    sub.classList.add('hide');
    $('runcontent').innerHTML = `<div class="intro">${esc(RUN_GUIDE.abc.intro)}</div><div class="header">Übungen</div><div class="group">${RUN_GUIDE.abc.drills.map(d => stepRow(...d)).join('')}</div><p class="footer">Bei Beschwerden in Fuß oder Wade Sprungübungen (Hopserlauf, Seitgalopp) auslassen.</p>`;
    return;
  }
  const list = RUN_GUIDE[runView.tab], cur = list.find(r => r.id === runView[runView.tab]) || list[0];
  sub.classList.remove('hide');
  sub.innerHTML = list.map(r => `<button role="tab" type="button" data-runsub="${r.id}" aria-selected="${r.id === cur.id}">${esc(r.label)}</button>`).join('');
  $('runcontent').innerHTML = `<div class="intro">${esc(cur.intro)}</div>
    <div class="header">Warm-up</div><div class="group">${cur.warmup.map(x => stepRow(...x)).join('')}</div>
    <div class="header">Cooldown</div><div class="group">${cur.cooldown.map(x => stepRow(...x)).join('')}</div>
    <p class="footer">Zeiten sind Richtwerte. Am Wettkampftag nichts Neues ausprobieren – den Ablauf vorher im Training testen.</p>`;
}
function renderMobility() {
  let h = '<div class="header">Kurzprogramme</div>';
  h += MOBILITY.routines.map((r, i) => `<div class="group" style="margin-top:${i ? 12 : 0}px"><div class="row" style="font-weight:600"><span class="txt"><b style="font-weight:600">${esc(r.title)}</b></span><span class="val">${esc(r.time)}</span></div>${r.steps.map(s => stepRow(s[0], s[1], '')).join('')}</div>`).join('');
  h += MOBILITY.groups.map(g => `<div class="header">${esc(g.title)}</div><div class="group">${g.items.map(s => stepRow(s[0], s[1], '')).join('')}</div>`).join('');
  h += '<p class="footer">Dehnen und mobilisieren im angenehmen Bereich – ziehen ja, Schmerz nein. Ruhig weiteratmen.</p>';
  $('mobcontent').innerHTML = h;
}
/* ---------- Ereignisse ---------- */
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (b) setPlan(b.dataset.plan); });
$('gearbar').addEventListener('click', e => {
  const b = e.target.closest('[data-gear]'); if (!b) return;
  if (settingsLocked()) { alert('Bitte das laufende Training zuerst beenden oder zurücksetzen – sonst passt das Ergebnis nicht mehr zu den Übungen.'); return; }
  gear[b.dataset.gear] = !gear[b.dataset.gear]; store(KEYS.gear, gear);
  renderAll(); toast(`${b.dataset.gear === 'kb' ? 'Kettlebell' : 'Bänder'} ${gear[b.dataset.gear] ? 'aktiviert' : 'deaktiviert'} – Übungen angepasst.`);
});
$('btnMain').addEventListener('click', play);
$('btnNext').addEventListener('click', skip);
$('btnDone').addEventListener('click', () => finishExercise(false));
$('btnUndo').addEventListener('click', undo);
$('reset').addEventListener('click', resetTraining);
$('timedstart').addEventListener('click', startTimed);
$('timedlength').addEventListener('change', e => { timedPick[plan + '-' + (completions % exList().length)] = Number(e.target.value); renderCurrent(); });
const toggleSound = () => { soundEnabled = !soundEnabled; store(KEYS.sound, soundEnabled); renderHeader(); if (soundEnabled) { audioReady(); cue('step'); } toast(soundEnabled ? 'Ton an.' : 'Ton aus.'); };
$('sound').addEventListener('click', toggleSound);
$('soundrow').addEventListener('click', toggleSound);
$('testsound').addEventListener('click', () => { audioReady(); cue('finish'); });
$('current').addEventListener('click', e => openExerciseGuide(Number(e.currentTarget.dataset.index || 0), e.currentTarget));
$('stepstatus').addEventListener('click', e => { if (isTabata() && phase === 1) { const sg = currentSeg(); openExerciseGuide(sg.type === 'blockrest' ? sg.block + 1 : sg.block, e.currentTarget); return; } const s = currentStep(); openGuide(s.base, 'bw', { origin: e.currentTarget }); });
for (const id of ['warmup', 'cooldown']) $(id).addEventListener('click', e => { const b = e.target.closest('[data-guide-name]'); if (b) openGuide(b.dataset.guideName, 'bw', { origin: b }); });
$('worklist').addEventListener('click', e => {
  if (e.target.closest('#emomstart')) { startEmom(); return; }
  const b = e.target.closest('[data-ex]'); if (b) openExerciseGuide(Number(b.dataset.ex), b);
});
$('worklist').addEventListener('input', e => { const t = e.target; if (t.dataset.slot && runReps[t.dataset.slot]) { runReps[t.dataset.slot][Number(t.dataset.idx)] = t.value.trim(); persistSession(); } });
$('worklist').addEventListener('change', e => {
  const t = e.target; if (!t.dataset.stage) return;
  stages[plan + '.' + t.dataset.stage] = t.value; store(KEYS.stage, stages); renderList(); renderStats(); renderHistory();
});
$('settings').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.tabata) {
    if (settingsLocked()) { alert('Bitte das laufende Training zuerst beenden oder zurücksetzen.'); renderSettings(); return; }
    const c = Object.assign({}, isObj(choices['tabata.cfg']) ? choices['tabata.cfg'] : {}, { [t.dataset.tabata]: Number(t.value) }); choices['tabata.cfg'] = c; store(KEYS.choice, choices);
    renderAll(); toast('Gespeichert.'); return;
  }
  const id = t.dataset.pref || t.dataset.kg || t.dataset.band; if (!id) return;
  if (settingsLocked()) { alert('Bitte das laufende Training zuerst beenden oder zurücksetzen.'); renderSettings(); return; }
  if (t.dataset.pref) updateChoice(id, { pref: t.value });
  else if (t.dataset.kg) { const v = Number(String(t.value).replace(',', '.')); if (t.value === '' || !Number.isFinite(v) || v < 0 || v > 60) { alert('Bitte ein Gewicht zwischen 0 und 60 kg eingeben.'); renderSettings(); return; } updateChoice(id, { kg: v }); }
  else updateChoice(id, { band: t.value });
  renderAll(); toast('Gespeichert.');
});
$('settings').addEventListener('click', e => {
  if (e.target.id !== 'allkgbtn') return;
  if (settingsLocked()) { alert('Bitte das laufende Training zuerst beenden oder zurücksetzen.'); return; }
  const v = Number(String($('allkg').value).replace(',', '.')); if (!Number.isFinite(v) || v < 0 || v > 60) { alert('Bitte ein Gewicht zwischen 0 und 60 kg eingeben.'); return; }
  for (const sl of PLANS[plan].slots) if (sl.v.kb) updateChoice(sl.id, { kg: v });
  renderAll(); toast(`Alle Kettlebell-Übungen: ${kgText(v)} kg.`);
});
$('history').addEventListener('click', e => { const b = e.target.closest('[data-delete]'); if (!b || !confirm('Diesen Trainingseintrag wirklich löschen?')) return; saved = saved.filter(x => String(x.id) !== b.dataset.delete); persistEntries(); renderHistory(); renderStats(); if (isSets()) renderList(); });
$('manualdate').value = localDay();
$('manual').addEventListener('submit', e => {
  e.preventDefault(); const date = $('manualdate').value; if (!date) { alert('Bitte ein Datum wählen.'); return; }
  if (isTabata()) { saveSession(date, { manual: true }); return; }
  if (isSets()) { if (!hasReps()) { alert('Bitte zuerst oben im Plan die Wiederholungen eintragen.'); return; } saveSession(date, { manual: true }); return; }
  const r = Number($('manualround').value), x = Number($('manualextra').value), n = exList().length;
  if (!Number.isInteger(r) || r < 0 || !Number.isInteger(x) || x < 0 || x >= n) { alert(`Bitte gültige Werte eingeben. Weitere Übungen: 0 bis ${n - 1}.`); return; }
  saveSession(date, { manual: true, total: r * n + x }); $('manualround').value = '1'; $('manualextra').value = '0';
});
$('savefile').addEventListener('click', exportBackup);
$('importbtn').addEventListener('click', () => $('importfile').click());
$('importfile').addEventListener('change', e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });
$('exportcsv').addEventListener('click', exportCsv);
$('banners').addEventListener('click', e => { if (e.target.id === 'kbon') { gear.kb = true; store(KEYS.gear, gear); renderAll(); return; } if (e.target.id === 'backupnow') exportBackup(); if (e.target.id === 'hintclose') { store(KEYS.hint, true); renderBackupBanner(); } });
$('waistdate').value = localDay();
$('waistform').addEventListener('submit', e => {
  e.preventDefault();
  const date = $('waistdate').value, cm = Number($('waistcm').value.replace(',', '.')), note = $('waistnote').value.trim().slice(0, 120);
  const value = { id: uid(), date, cm, note, at: new Date().toISOString() };
  if (!validWaist(value)) { alert('Bitte ein gültiges Datum und einen Wert zwischen 40 und 250 cm eingeben.'); return; }
  const old = waist.findIndex(x => x.date === date); if (old >= 0) { value.id = waist[old].id; waist[old] = value; } else waist.push(value);
  persistWaist(); renderWaist(); $('waistcm').value = ''; $('waistnote').value = ''; $('waistdate').value = localDay(); toast('Messung gespeichert.');
});
$('waisthistory').addEventListener('click', e => { const b = e.target.closest('[data-waist-delete]'); if (!b || !confirm('Diese Messung wirklich löschen?')) return; waist = waist.filter(x => x.date !== b.dataset.waistDelete); persistWaist(); renderWaist(); });
$('waistcsv').addEventListener('click', exportWaistCsv);
$('waistcalendar').addEventListener('click', exportWaistReminder);
$('guide-close').addEventListener('click', () => guide.close());
guide.addEventListener('click', e => { if (e.target === guide) { const r = guide.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) guide.close(); } });
guide.addEventListener('close', () => { if (guideOrigin && document.contains(guideOrigin)) guideOrigin.focus(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (running) keepAwake(true); } else persistSession(); });
window.addEventListener('pagehide', persistSession);

$('tabbar').addEventListener('click', e => { const b = e.target.closest('[data-area]'); if (b) showArea(b.dataset.area); });
$('livepill').addEventListener('click', () => showArea('kraft'));
$('runtabs').addEventListener('click', e => { const b = e.target.closest('[data-runtab]'); if (!b) return; runView.tab = b.dataset.runtab; store(KEYS.run, runView); renderRun(); });
$('runsub').addEventListener('click', e => { const b = e.target.closest('[data-runsub]'); if (!b) return; runView[runView.tab] = b.dataset.runsub; store(KEYS.run, runView); renderRun(); });
for (const id of ['runcontent', 'mobcontent']) $(id).addEventListener('click', e => { const b = e.target.closest('[data-guide-name]'); if (b) openGuide(b.dataset.guideName, 'bw', { origin: b }); });

/* ---------- Start ---------- */
schemaCheck();
const restored = restoreSession();
if (!restored) runReps = emptyReps(plan);
renderAll(); renderWaist(); renderStorageInfo(); renderRun(); renderMobility(); showArea(area, false);
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || document.documentElement.dataset.os === 'ios') $('savefilehint').textContent = 'Öffnet „Teilen“ → „In Dateien sichern“';
if (restored) { toast(running ? 'Laufendes Training wiederhergestellt.' : 'Unterbrochenes Training wiederhergestellt.'); if (running) keepAwake(true); }
setInterval(tick, 200);
try { navigator.storage?.persist?.().then(renderStorageInfo).catch(() => { }); } catch (e) { }
renderPreUpdate();
if (loadIssues.length) toast('Ein Teil der gespeicherten Daten war unlesbar und wurde separat aufbewahrt. Bitte Backup prüfen.');
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) toast('App aktualisiert – deine Daten sind unverändert.'); });
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}
$('preupdate').addEventListener('click', () => { const b = load(PRE_UPDATE_KEY, null); if (isObj(b) && typeof b.json === 'string') download(`kb-tracker-sicherung-vor-update-${localDay(new Date(b.savedAt || Date.now()))}.json`, b.json, 'application/json'); });
