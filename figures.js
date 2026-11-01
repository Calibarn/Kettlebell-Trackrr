'use strict';
/* Schematische Bewegungsskizzen: zwei Bilder (Start → Bewegung) oder ein Bild bei Halteübungen.
   Koordinaten je Bild in einem 200 × 200-Feld, Boden bei y = 190.
   Gelenke: h Kopf, n Hals, p Becken, k/f Knie/Knöchel, t Zehen, e/w Ellenbogen/Handgelenk,
   s1/s2 Schultern und q1/q2 Hüften (nur Frontansicht). Index 1 = vorne/hell, 2 = hinten/dunkel. */

const figEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = (base, over) => Object.assign({}, base, over || {});

// Grundhaltungen
const SS = { h: [100, 40], n: [100, 60], p: [98, 112], k1: [101, 150], f1: [99, 188], t1: [113, 189], k2: [97, 150], f2: [95, 188], t2: [109, 189], e1: [103, 86], w1: [104, 111], e2: [97, 86], w2: [96, 111] };
const FS = { front: true, h: [100, 40], n: [100, 60], s1: [86, 62], s2: [114, 62], p: [100, 112], q1: [93, 112], q2: [107, 112], k1: [91, 150], f1: [89, 188], k2: [109, 150], f2: [111, 188], e1: [80, 88], w1: [78, 113], e2: [120, 88], w2: [122, 113] };
const LB = { h: [30, 175], n: [48, 178], p: [102, 180], k1: [132, 148], f1: [156, 187], t1: [168, 188], k2: [128, 150], f2: [152, 187], t2: [164, 188], e1: [70, 185], w1: [92, 187], e2: [68, 184], w2: [90, 186] };
const PR = { h: [166, 176], n: [148, 180], p: [92, 182], k1: [56, 184], f1: [20, 185], k2: [56, 182], f2: [20, 183], e1: [124, 186], w1: [102, 187], e2: [122, 184], w2: [100, 185] };
const SQ = { h: [116, 74], n: [106, 92], p: [76, 140], k1: [112, 152], f1: [100, 188], t1: [114, 189], k2: [108, 154], f2: [96, 188], t2: [110, 189] };
const GOBLET = { e1: [104, 96], w1: [118, 80], e2: [100, 96], w2: [114, 80] };
const HIPHANDS = { e1: [86, 86], w1: [100, 108], e2: [88, 86], w2: [102, 108] };
const LG_B = { h: [100, 74], n: [98, 94], p: [96, 146], k1: [130, 148], f1: [128, 188], t1: [142, 189], k2: [84, 182], f2: [52, 178], t2: [44, 189] };
const SP_A = { h: [99, 40], n: [98, 60], p: [96, 112], k1: [116, 150], f1: [124, 188], t1: [138, 189], k2: [80, 150], f2: [56, 180], t2: [48, 190] };
const SP_B = { h: [100, 74], n: [98, 94], p: [96, 146], k1: [128, 150], f1: [124, 188], t1: [138, 189], k2: [84, 182], f2: [56, 180], t2: [48, 190] };
const BG_A = { h: [110, 42], n: [108, 62], p: [104, 112], k1: [126, 150], f1: [134, 188], t1: [148, 189], k2: [88, 148], f2: [54, 150], t2: [42, 146] };
const BG_B = { h: [118, 76], n: [110, 96], p: [100, 146], k1: [136, 150], f1: [134, 188], t1: [148, 189], k2: [80, 176], f2: [54, 150], t2: [42, 146] };
const RW = { h: [152, 82], n: [134, 90], p: [84, 108], k1: [112, 146], f1: [114, 188], t1: [128, 189], k2: [72, 148], f2: [54, 188], t2: [66, 189], e2: [148, 116], w2: [158, 140] };
const PU_A = { h: [132, 88], n: [118, 98], p: [78, 139], k1: [53, 163], f1: [28, 188], k2: [55, 161], f2: [30, 186], e1: [120, 124], w1: [120, 148], e2: [116, 124], w2: [116, 148] };
const PU_B = { h: [148, 116], n: [134, 124], p: [86, 153], k1: [57, 171], f1: [28, 188], k2: [59, 169], f2: [30, 186], e1: [112, 132], w1: [122, 148], e2: [108, 130], w2: [118, 148] };
const SW_A = P(SS, { k2: [95, 148], f2: [86, 176], t2: [98, 180] });
const SW_B = { h: [162, 92], n: [146, 96], p: [96, 112], k1: [102, 150], f1: [100, 188], t1: [114, 189], k2: [60, 108], f2: [24, 104], t2: [20, 94], e1: [146, 122], w1: [146, 148], e2: [142, 122], w2: [142, 148] };
const CA_A = P(SS, { k2: [102, 150], f2: [84, 168], t2: null, e1: [132, 74], w1: [166, 70] });
const CA_B = { h: [100, 30], n: [100, 50], p: [98, 102], k1: [101, 140], f1: [101, 177], t1: [112, 190], k2: [102, 140], f2: [84, 158], e1: [132, 64], w1: [166, 60], e2: [97, 76], w2: [96, 101] };
const DB = P(LB, { e1: [52, 150], w1: [54, 122], e2: [48, 150], w2: [50, 122], k1: [104, 146], f1: [138, 146], t1: [146, 140], k2: [100, 148], f2: [134, 148], t2: [142, 142] });
const HF_A = { h: [102, 74], n: [101, 94], p: [100, 146], k1: [138, 150], f1: [138, 188], t1: [152, 189], k2: [86, 186], f2: [52, 186], e1: [118, 120], w1: [134, 148], e2: [114, 120], w2: [130, 148] };
const HF_B = { h: [112, 78], n: [111, 98], p: [110, 150], k1: [146, 152], f1: [138, 188], t1: [152, 189], k2: [86, 186], f2: [52, 186], e1: [128, 124], w1: [142, 150], e2: [124, 124], w2: [138, 150] };
const F4_A = { h: [87, 66], n: [86, 86], p: [84, 140], k1: [124, 142], f1: [126, 188], t1: [140, 189], k2: [118, 124], f2: [128, 140], e1: [102, 112], w1: [118, 128], e2: [98, 112], w2: [114, 128] };
const PK_A = { h: [130, 146], n: [118, 132], p: [78, 110], k1: [62, 149], f1: [46, 188], k2: [64, 147], f2: [48, 186], e1: [130, 150], w1: [144, 166], e2: [127, 150], w2: [141, 166] };
const PK_B = { h: [138, 160], n: [126, 148], p: [82, 114], k1: [64, 151], f1: [46, 188], k2: [66, 149], f2: [48, 186], e1: [114, 162], w1: [144, 166], e2: [111, 162], w2: [141, 166] };
const HIPS_A = P(FS, { e1: [72, 88], w1: [90, 112], e2: [128, 88], w2: [110, 112] });
const HIPS_B = P(FS, { n: [102, 60], s1: [88, 62], s2: [116, 62], p: [110, 112], q1: [103, 112], q2: [117, 112], k1: [96, 150], k2: [116, 150], e1: [78, 88], w1: [100, 112], e2: [134, 90], w2: [120, 112] });
const MARCH_B = P(FS, { k1: [90, 128], f1: [89, 162], e2: [124, 82], w2: [116, 62], e1: [78, 90], w1: [74, 114] });

const fr = (pose, props) => ({ P: pose, props: props || [] });
const KB = (x, y) => ({ kb: [x, y] });
const BAND = (...pts) => ({ band: pts });

// Bildfolgen je Übung; Funktionen erhalten das Gerät (kb/band/bw)
const FIG = {
  'Kettlebell-Swing': { a: fr(P(SS, { h: [146, 70], n: [128, 82], p: [80, 110], k1: [100, 146], f1: [94, 188], t1: [108, 189], k2: [96, 146], f2: [90, 188], t2: [104, 189], e1: [124, 108], w1: [114, 130], e2: [120, 108], w2: [110, 130] }), [KB(112, 142)]), b: fr(P(SS, { e1: [126, 68], w1: [151, 72], e2: [124, 70], w2: [149, 74] }), [KB(164, 72)]), la: 'Hüfte zurück', lb: 'Hüfte kraftvoll strecken' },
  'Hüftheben': { a: fr(LB), b: fr(P(LB, { p: [104, 146], k1: [140, 148], f1: [156, 187], k2: [136, 150], f2: [152, 187] })), la: 'Rückenlage, Knie angestellt', lb: 'Becken heben' },
  'Hüftheben mit Band': { a: fr(P(LB, { e1: [70, 184], w1: [88, 187] }), [BAND([88, 187], [102, 170], [118, 187])]), b: fr(P(LB, { p: [104, 146], k1: [140, 148], f1: [156, 187], k2: [136, 150], f2: [152, 187], e1: [70, 184], w1: [88, 187] }), [BAND([88, 187], [104, 136], [120, 187])]), la: 'Band über der Hüfte', lb: 'Becken gegen das Band heben' },
  'Holzhacker': { a: fr(P(FS, { k1: [90, 150], k2: [112, 148], n: [102, 62], s1: [88, 64], s2: [116, 64], h: [104, 42], e1: [104, 100], w1: [118, 134], e2: [118, 100], w2: [124, 134] })), b: fr(P(FS, { n: [98, 60], s1: [84, 62], s2: [112, 62], h: [96, 40], e1: [76, 44], w1: [62, 22], e2: [86, 42], w2: [68, 20] }), [{ arrow: 'M150 140 Q150 60 90 30' }]), la: 'Hände unten rechts', lb: 'diagonal nach oben links' },
  'Holzhacker mit Band': { a: fr(P(FS, { k1: [90, 150], k2: [112, 148], n: [102, 62], s1: [88, 64], s2: [116, 64], h: [104, 42], e1: [104, 100], w1: [118, 134], e2: [118, 100], w2: [124, 134] }), [BAND([111, 188], [121, 134])]), b: fr(P(FS, { n: [98, 60], s1: [84, 62], s2: [112, 62], h: [96, 40], e1: [76, 44], w1: [62, 22], e2: [86, 42], w2: [68, 20] }), [BAND([111, 188], [65, 21])]), la: 'Band unter dem rechten Fuß', lb: 'diagonal nach oben ziehen' },
  'Halo um den Kopf': { a: fr(P(FS, { e1: [84, 94], w1: [98, 82], e2: [116, 94], w2: [102, 82] }), [KB(100, 74)]), b: fr(P(FS, { e1: [78, 46], w1: [94, 28], e2: [122, 46], w2: [106, 28] }), [{ loop: [100, 40, 32, 16] }, KB(100, 22)]), la: 'vor der Brust', lb: 'dicht um den Kopf führen' },
  'Armkreisen mit Spannung': { a: fr(P(FS, { e1: [72, 64], w1: [46, 66], e2: [128, 64], w2: [154, 66] })), b: fr(P(FS, { e1: [73, 58], w1: [47, 54], e2: [127, 58], w2: [153, 54] }), [{ loop: [47, 58, 10, 10] }, { loop: [153, 58, 10, 10] }]), la: 'Arme seitlich gestreckt', lb: 'kleine Kreise' },
  'Kniebeugen (Goblet)': { a: fr(P(SS, GOBLET), [KB(124, 84)]), b: fr(P(SQ, { e1: [110, 124], w1: [124, 106], e2: [106, 124], w2: [120, 106] }), [KB(130, 110)]), la: 'Kugel vor der Brust', lb: 'tief absenken' },
  'Kniebeugen mit Band': { a: fr(P(SS, { e1: [106, 88], w1: [112, 64], e2: [102, 88], w2: [108, 64] }), [BAND([100, 188], [112, 64])]), b: fr(P(SQ, { e1: [112, 118], w1: [116, 94], e2: [108, 118], w2: [112, 94] }), [BAND([100, 188], [116, 94])]), la: 'Band unter den Füßen', lb: 'absenken, Enden an den Schultern' },
  'Kniebeugen': { a: fr(SS), b: fr(P(SQ, { e1: [130, 96], w1: [155, 98], e2: [128, 98], w2: [153, 100] })), la: 'aufrecht stehen', lb: 'Gesäß nach hinten unten' },
  'Ausfallschritte': g => g === 'kb'
    ? { a: fr(P(SS, GOBLET), [KB(124, 84)]), b: fr(P(LG_B, { e1: [104, 128], w1: [116, 112], e2: [100, 128], w2: [112, 112] }), [KB(122, 114)]), la: 'Kugel vor der Brust', lb: 'Schritt zurück, Knie beugen' }
    : { a: fr(P(SS, HIPHANDS)), b: fr(P(LG_B, { e1: [82, 118], w1: [98, 140], e2: [84, 118], w2: [100, 140] })), la: 'Hände an der Hüfte', lb: 'Schritt zurück, Knie beugen' },
  'Split Squat': g => g === 'kb'
    ? { a: fr(P(SP_A, { e1: [104, 86], w1: [118, 70], e2: [100, 86], w2: [114, 70] }), [KB(124, 74)]), b: fr(P(SP_B, { e1: [104, 128], w1: [116, 112], e2: [100, 128], w2: [112, 112] }), [KB(122, 114)]), la: 'Schrittstellung', lb: 'hinteres Knie absenken' }
    : { a: fr(P(SP_A, { e1: [84, 86], w1: [98, 108], e2: [86, 86], w2: [100, 108] })), b: fr(P(SP_B, { e1: [82, 118], w1: [98, 140], e2: [84, 118], w2: [100, 140] })), la: 'Schrittstellung', lb: 'hinteres Knie absenken' },
  'Bulgarian Split Squat': g => g === 'kb'
    ? { a: fr(P(BG_A, { e1: [114, 88], w1: [128, 72], e2: [110, 88], w2: [124, 72] }), [{ box: [16, 150, 42, 40] }, KB(134, 76)]), b: fr(P(BG_B, { e1: [116, 128], w1: [130, 112], e2: [112, 128], w2: [126, 112] }), [{ box: [16, 150, 42, 40] }, KB(136, 116)]), la: 'hinterer Fuß erhöht', lb: 'gerade nach unten absenken' }
    : { a: fr(P(BG_A, { e1: [94, 88], w1: [106, 108], e2: [96, 88], w2: [108, 108] }), [{ box: [16, 150, 42, 40] }]), b: fr(P(BG_B, { e1: [96, 122], w1: [104, 142], e2: [98, 122], w2: [106, 142] }), [{ box: [16, 150, 42, 40] }]), la: 'hinterer Fuß erhöht', lb: 'gerade nach unten absenken' },
  'Suitcase March': { a: fr(SS, [KB(96, 124)]), b: fr(P(SS, { k1: [128, 118], f1: [127, 156], t1: [140, 158], e1: [112, 84], w1: [118, 106] }), [KB(96, 124)]), la: 'Kugel einseitig, aufrecht', lb: 'Knie heben, nicht kippen' },
  'Suitcase Hold': { a: fr(P(FS, { e2: [121, 88], w2: [124, 114] }), [KB(126, 128)]), la: 'Halten – nicht zur Seite kippen' },
  'Unterarmstütz': { a: fr({ h: [168, 150], n: [150, 158], p: [96, 166], k1: [60, 176], f1: [24, 186], k2: [62, 174], f2: [26, 184], e1: [152, 187], w1: [180, 187], e2: [148, 187], w2: [176, 187] }), la: 'Körper in einer Linie halten' },
  'Seitstütz': { a: fr({ h: [162, 150], n: [144, 158], p: [96, 170], k1: [60, 180], f1: [24, 187], k2: [60, 177], f2: [24, 184], e1: [146, 187], w1: [176, 187], e2: [122, 144], w2: [102, 164] }), la: 'Ellenbogen unter der Schulter, Becken halten' },
  'Einarmiges Rudern': { a: fr(P(RW, { e1: [132, 118], w1: [130, 144] }), [{ box: [150, 140, 42, 50] }, KB(130, 156)]), b: fr(P(RW, { e1: [116, 68], w1: [117, 94] }), [{ box: [150, 140, 42, 50] }, KB(117, 106)]), la: 'Arm lang, Rücken gerade', lb: 'zur Hüfte ziehen' },
  'Rudern mit Band': { a: fr(P(RW, { e2: [128, 116], w2: [114, 128], e1: [132, 118], w1: [130, 144] }), [BAND([114, 188], [130, 144])]), b: fr(P(RW, { e2: [128, 116], w2: [114, 128], e1: [116, 68], w1: [117, 94] }), [BAND([114, 188], [117, 94])]), la: 'Band unter dem vorderen Fuß', lb: 'zur Hüfte ziehen' },
  'Y-T-W in Bauchlage': { a: fr(PR), b: fr(P(PR, { n: [148, 175], h: [168, 168], e1: [170, 162], w1: [192, 152], e2: [168, 164], w2: [190, 154] })), la: 'Bauchlage, Arme am Körper', lb: 'Arme heben (Y), kurz halten' },
  'Brustdrücken mit Band': { a: fr(P(SS, { e1: [84, 86], w1: [110, 78], e2: [82, 88], w2: [108, 80] }), [BAND([110, 78], [94, 72], [86, 70])]), b: fr(P(SS, { e1: [126, 68], w1: [152, 70], e2: [124, 70], w2: [150, 72] }), [BAND([152, 70], [110, 66], [86, 70])]), la: 'Hände an der Brust', lb: 'nach vorne drücken' },
  'Floor Press': { a: fr(P(LB, { e1: [70, 185], w1: [72, 160], e2: [66, 184], w2: [86, 186] }), [KB(74, 150)]), b: fr(P(LB, { e1: [50, 150], w1: [52, 122], e2: [66, 184], w2: [86, 186] }), [KB(54, 112)]), la: 'Oberarm am Boden', lb: 'senkrecht drücken' },
  'Liegestütze erhöht': { a: fr(PU_A, [{ table: [112, 148, 78] }]), b: fr(PU_B, [{ table: [112, 148, 78] }]), la: 'Hände auf der Erhöhung', lb: 'Brust zur Kante' },
  'Trizeps über Kopf': { a: fr(P(SS, { h: [107, 40], e1: [92, 30], w1: [74, 44], e2: [90, 31], w2: [72, 45] }), [KB(68, 54)]), b: fr(P(SS, { h: [107, 40], e1: [92, 34], w1: [91, 8], e2: [90, 35], w2: [89, 9] }), [KB(90, -2)]), la: 'Kugel hinter dem Kopf', lb: 'Arme strecken' },
  'Trizeps mit Band': { a: fr(P(SS, { h: [107, 40], e1: [92, 30], w1: [74, 44], e2: [90, 86], w2: [84, 112] }), [BAND([74, 44], [84, 112])]), b: fr(P(SS, { h: [107, 40], e1: [92, 34], w1: [91, 8], e2: [90, 86], w2: [84, 112] }), [BAND([91, 8], [84, 112])]), la: 'untere Hand hält das Band', lb: 'oberen Arm strecken' },
  'Bizepscurls': { a: fr(P(SS, { e1: [102, 86], w1: [104, 111], e2: [98, 86], w2: [100, 111] }), [KB(106, 123)]), b: fr(P(SS, { e1: [102, 86], w1: [124, 70], e2: [98, 86], w2: [120, 70] }), [KB(128, 64)]), la: 'Arme lang', lb: 'Ellenbogen beugen' },
  'Bizepscurls mit Band': { a: fr(P(SS, { e1: [102, 86], w1: [104, 111], e2: [98, 86], w2: [100, 111] }), [BAND([99, 188], [104, 111])]), b: fr(P(SS, { e1: [102, 86], w1: [124, 70], e2: [98, 86], w2: [120, 70] }), [BAND([99, 188], [124, 70])]), la: 'Band unter den Füßen', lb: 'Ellenbogen beugen' },
  'Handtuch-Curl (halten)': { a: fr(P(SS, { p: [96, 112], k1: [114, 150], f1: [124, 188], t1: [138, 189], k2: [84, 150], f2: [76, 188], t2: [90, 189], e1: [102, 88], w1: [126, 88], e2: [98, 88], w2: [122, 88] }), [{ towel: [[116, 189], [124, 90], [134, 189]] }]), la: 'Gegen das Handtuch ziehen und halten' },
  'Standwaage': { a: fr(SW_A), b: fr(SW_B), la: 'auf einem Bein', lb: 'Hüfte zurück, Bein nach hinten' },
  'Einbeiniges Kreuzheben': { a: fr(SW_A, [KB(96, 124)]), b: fr(SW_B, [KB(142, 160)]), la: 'Kugel gegenüber dem Standbein', lb: 'Hüfte zurück, Bein nach hinten' },
  'Stehende Knie-Ellenbogen-Crunches': { a: fr(P(FS, { e1: [74, 52], w1: [90, 40], e2: [126, 52], w2: [110, 40] })), b: fr(P(FS, { n: [97, 66], s1: [84, 70], s2: [110, 64], h: [94, 46], e1: [92, 92], w1: [84, 48], e2: [124, 56], w2: [106, 40], k2: [96, 104], f2: [112, 134] })), la: 'Hände an den Kopf', lb: 'Knie zum Gegen-Ellenbogen' },
  'Einbeiniges Wadenheben': g => ({ a: fr(CA_A, [{ wall: 168 }].concat(g === 'kb' ? [KB(96, 124)] : [])), b: fr(CA_B, [{ wall: 168 }, { arrow: 'M70 150 V118' }].concat(g === 'kb' ? [KB(96, 114)] : [])), la: 'auf einem Bein, Hand an der Wand', lb: 'auf den Fußballen' }),
  'Schulterdrücken': { a: fr(P(FS, { e1: [78, 92], w1: [90, 112], e2: [120, 96], w2: [118, 70] }), [KB(126, 66)]), b: fr(P(FS, { e1: [78, 92], w1: [90, 112], e2: [116, 36], w2: [117, 10] }), [KB(121, 0)]), la: 'Rack-Position', lb: 'senkrecht über Kopf' },
  'Überkopfdrücken mit Band': { a: fr(P(FS, { e1: [78, 90], w1: [84, 66], e2: [122, 90], w2: [116, 66] }), [BAND([89, 188], [84, 66]), BAND([111, 188], [116, 66])]), b: fr(P(FS, { e1: [84, 36], w1: [86, 10], e2: [116, 36], w2: [114, 10] }), [BAND([89, 188], [86, 10]), BAND([111, 188], [114, 10])]), la: 'Hände auf Schulterhöhe', lb: 'nach oben drücken' },
  'Pike-Liegestütze erhöht': { a: fr(PK_A, [{ box: [130, 166, 54, 24] }]), b: fr(PK_B, [{ box: [130, 166, 54, 24] }]), la: 'Hüfte hoch, umgedrehtes V', lb: 'Kopf Richtung Kante senken' },
  'Seitheben mit Band': { a: fr(FS, [BAND([89, 188], [78, 113]), BAND([111, 188], [122, 113])]), b: fr(P(FS, { e1: [66, 70], w1: [42, 74], e2: [134, 70], w2: [158, 74] }), [BAND([89, 188], [42, 74]), BAND([111, 188], [158, 74])]), la: 'Arme unten', lb: 'seitlich bis Schulterhöhe' },
  'Wand-Seitheben (halten)': { a: fr(P(FS, { e2: [124, 88], w2: [131, 112] }), [{ wall: 137 }, { arrow: 'M118 128 H134' }]), la: 'Handrücken gegen die Wand drücken' },
  'Band Pull-Apart': { a: fr(P(FS, { e1: [78, 82], w1: [88, 76], e2: [122, 82], w2: [112, 76] }), [BAND([88, 76], [112, 76])]), b: fr(P(FS, { e1: [66, 64], w1: [40, 66], e2: [134, 64], w2: [160, 66] }), [BAND([40, 66], [160, 66])]), la: 'Arme vor der Brust', lb: 'Band auseinanderziehen' },
  'Dead Bug': { a: fr(DB), b: fr(P(DB, { e2: [26, 170], w2: [6, 176], k1: [138, 172], f1: [174, 178], t1: [182, 172] })), la: 'Arme hoch, Knie 90 Grad', lb: 'Arm und Gegenbein strecken' },
  'Marschieren auf der Stelle': { a: fr(FS), b: fr(MARCH_B), la: 'aufrecht', lb: 'Knie heben, Arme mitnehmen' },
  'Seitliche Schritte': { a: fr(P(FS, { q1: [96, 112], q2: [104, 112], k1: [95, 150], f1: [95, 188], k2: [105, 150], f2: [105, 188] })), b: fr(P(FS, { k1: [82, 150], f1: [66, 188], k2: [118, 150], f2: [134, 188] }), [{ arrow: 'M118 200 H160' }]), la: 'Füße zusammen', lb: 'Schritt zur Seite' },
  'Schulter- und Armkreisen': { a: fr(FS), b: fr(P(FS, { e1: [80, 36], w1: [76, 10], e2: [120, 36], w2: [124, 10] }), [{ loop: [82, 40, 22, 32] }, { loop: [118, 40, 22, 32] }]), la: 'Arme locker', lb: 'große Kreise' },
  'Hüftkreisen': { a: fr(HIPS_A, [{ loop: [104, 114, 24, 7] }]), b: fr(HIPS_B, [{ loop: [104, 114, 24, 7] }]), la: 'Hände an die Hüfte', lb: 'Becken kreisen' },
  'Hüftbeuger-Dehnung': { a: fr(HF_A), b: fr(HF_B, [{ arrow: 'M150 112 H176' }]), la: 'halber Kniestand', lb: 'Becken nach vorne schieben' },
  'Vorderer Oberschenkel': { a: fr(P(SS, { e1: [132, 74], w1: [166, 70] }), [{ wall: 168 }]), b: fr(P(SS, { e1: [132, 74], w1: [166, 70], k2: [98, 150], f2: [78, 118], t2: null, e2: [86, 92], w2: [80, 116] }), [{ wall: 168 }]), la: 'an der Wand halten', lb: 'Fuß zum Gesäß' },
  'Figure-4 Gesäß': { a: fr(F4_A, [{ chair: [58, 146, 56] }]), b: fr(P(F4_A, { h: [124, 86], n: [110, 96], e1: [122, 122], w1: [126, 138], e2: [118, 122], w2: [122, 138] }), [{ chair: [58, 146, 56] }]), la: 'Knöchel aufs Knie', lb: 'Oberkörper nach vorne' },
  'Adduktoren': { a: fr(P(FS, { k1: [80, 150], f1: [64, 188], k2: [120, 150], f2: [136, 188], e1: [72, 88], w1: [90, 112], e2: [128, 88], w2: [110, 112] })), b: fr(P(FS, { p: [112, 132], q1: [105, 132], q2: [119, 132], n: [110, 80], s1: [96, 82], s2: [124, 82], h: [110, 60], k1: [86, 160], f1: [64, 188], k2: [134, 152], f2: [136, 188], e1: [90, 108], w1: [104, 130], e2: [132, 106], w2: [132, 130] })), la: 'breit stehen', lb: 'zur Seite verlagern' },
  'Wadendehnung': { a: fr(P(SS, { e1: [134, 72], w1: [166, 66], e2: [132, 74], w2: [164, 68] }), [{ wall: 168 }]), b: fr({ h: [138, 56], n: [124, 68], p: [100, 114], k1: [128, 150], f1: [124, 188], t1: [138, 189], k2: [74, 152], f2: [48, 188], t2: [62, 189], e1: [146, 66], w1: [166, 58], e2: [144, 68], w2: [164, 60] }, [{ wall: 168 }]), la: 'Hände an die Wand', lb: 'hinteres Bein lang, Ferse unten' },
  'Brustdehnung am Türrahmen': { a: fr(P(SS, { e1: [124, 62], w1: [124, 36] }), [{ door: 130 }]), b: fr({ h: [148, 40], n: [148, 60], p: [146, 112], k1: [152, 150], f1: [156, 188], t1: [170, 189], k2: [138, 150], f2: [128, 188], t2: [142, 189], e1: [126, 62], w1: [126, 36], e2: [144, 86], w2: [144, 111] }, [{ door: 130 }]), la: 'Unterarm an den Rahmen', lb: 'durchgehen, Brust öffnen' }
};
FIG['Kniebeugen ohne Gewicht'] = FIG['Kniebeugen'];
FIG['Holzhacker mit Kettlebell'] = { a: fr(FIG['Holzhacker'].a.P, [KB(122, 146)]), b: fr(FIG['Holzhacker'].b.P, [{ arrow: 'M150 140 Q150 60 90 30' }, KB(65, 10)]), la: 'Kugel unten rechts', lb: 'diagonal nach oben links' };
FIG['Enge Liegestütze erhöht'] = Object.assign({}, FIG['Liegestütze erhöht'], { lb: 'Ellenbogen nah am Körper' });
FIG['Locker marschieren'] = FIG['Marschieren auf der Stelle'];
FIG['Hüftkreisen und lockeres Marschieren'] = FIG['Marschieren auf der Stelle'];
FIG['Hüftkreisen und Oberkörperrotation'] = FIG['Hüftkreisen'];

const shift = (Q, dx, dy) => Object.fromEntries(Object.entries(Q).map(([k, v]) => [k, Array.isArray(v) ? [v[0] + dx, v[1] + dy] : v]));

// Büro, Rücken, Mobility
const QP = { h: [146, 130], n: [131, 138], p: [80, 150], k1: [82, 188], f1: [44, 188], k2: [78, 187], f2: [40, 186], e1: [132, 163], w1: [133, 188], e2: [128, 163], w2: [129, 188] };
const SL = { h: [28, 170], n: [46, 174], p: [102, 176], k1: [130, 170], f1: [108, 186], k2: [132, 176], f2: [110, 188], e2: [62, 186], w2: [86, 188], e1: [66, 178], w1: [90, 180] };
const WGS = { h: [148, 110], n: [132, 118], p: [90, 140], k1: [126, 150], f1: [132, 188], t1: [146, 189], k2: [60, 166], f2: [26, 186], t2: [20, 178], e1: [128, 152], w1: [126, 186], e2: [132, 152], w2: [130, 186] };
const NN = { h: [90, 104], n: [90, 124], p: [88, 178], k1: [124, 184], f1: [136, 160], k2: [54, 184], f2: [50, 160], e1: [74, 150], w1: [62, 184], e2: [106, 150], w2: [118, 184] };
const PG = { h: [100, 104], n: [98, 124], p: [92, 170], k1: [128, 184], f1: [98, 186], k2: [56, 184], f2: [20, 186], t2: [14, 180], e1: [108, 148], w1: [114, 184], e2: [104, 148], w2: [110, 184] };
const KW_A = { h: [118, 44], n: [114, 64], p: [104, 116], k1: [134, 150], f1: [140, 188], t1: [154, 189], k2: [86, 152], f2: [70, 188], t2: [84, 189], e1: [140, 80], w1: [166, 74], e2: [136, 82], w2: [164, 76] };
const KW_B = { h: [138, 58], n: [132, 76], p: [124, 128], k1: [158, 152], f1: [140, 188], t1: [154, 189], k2: [96, 156], f2: [70, 188], t2: [84, 189], e1: [150, 92], w1: [166, 84], e2: [146, 94], w2: [164, 86] };
// Laufen
const RN_A = { h: [110, 40], n: [105, 60], p: [96, 110], k1: [124, 136], f1: [114, 170], t1: [128, 174], k2: [82, 146], f2: [60, 160], t2: [54, 170], e1: [90, 84], w1: [96, 104], e2: [118, 80], w2: [132, 68] };
const RN_B = { h: [110, 40], n: [105, 60], p: [96, 110], k1: [82, 146], f1: [60, 160], t1: [54, 170], k2: [124, 136], f2: [114, 170], t2: [128, 174], e1: [118, 80], w1: [132, 68], e2: [90, 84], w2: [96, 104] };
const WALK_A = P(SS, { k1: [110, 150], f1: [118, 188], t1: [132, 189], k2: [88, 150], f2: [80, 188], t2: [94, 189], e1: [96, 86], w1: [92, 110], e2: [106, 86], w2: [114, 108] });
const WALK_B = P(SS, { k1: [88, 150], f1: [80, 188], t1: [94, 189], k2: [110, 150], f2: [118, 188], t2: [132, 189], e1: [106, 86], w1: [114, 108], e2: [96, 86], w2: [92, 110] });
const KH_A = { h: [102, 40], n: [101, 60], p: [98, 112], k1: [132, 112], f1: [130, 150], t1: [142, 152], k2: [100, 150], f2: [100, 188], t2: [114, 189], e1: [88, 84], w1: [92, 106], e2: [116, 80], w2: [124, 58] };
const KH_B = P(KH_A, { k1: [100, 150], f1: [100, 188], t1: [114, 189], k2: [132, 112], f2: [130, 150], t2: [142, 152], e1: [116, 80], w1: [124, 58], e2: [88, 84], w2: [92, 106] });
const SK_A = P(KH_A, { k1: [122, 130], f1: [118, 166], t1: [130, 170], f2: [100, 184], t2: [112, 190] });
const SK_B = P(KH_B, { k2: [122, 130], f2: [118, 166], t2: [130, 170], f1: [100, 184], t1: [112, 190] });
const AF_A = { h: [102, 40], n: [101, 60], p: [98, 112], k1: [98, 150], f1: [80, 118], t1: [72, 126], k2: [100, 150], f2: [100, 186], t2: [112, 190], e1: [114, 84], w1: [122, 66], e2: [88, 86], w2: [92, 108] };
const AF_B = P(AF_A, { k1: [100, 150], f1: [100, 186], t1: [112, 190], k2: [98, 150], f2: [80, 118], t2: [72, 126], e1: [88, 86], w1: [92, 108], e2: [114, 84], w2: [122, 66] });

const BR = { h: [146, 74], n: [130, 82], p: [82, 110], k1: [102, 148], f1: [98, 188], t1: [112, 189], k2: [98, 148], f2: [94, 188], t2: [108, 189] };
const RT = { front: true, h: [100, 96], n: [100, 116], s1: [88, 118], s2: [112, 118], p: [100, 170], q1: [93, 170], q2: [107, 170], k1: [82, 148], f1: [78, 186], k2: [118, 148], f2: [122, 186] };
Object.assign(FIG, {
  'Vorgebeugtes Rudern beidarmig': { a: fr(P(BR, { e1: [128, 110], w1: [126, 136], e2: [124, 110], w2: [122, 136] }), [KB(124, 148)]), b: fr(P(BR, { e1: [108, 84], w1: [114, 108], e2: [104, 86], w2: [110, 110] }), [KB(112, 120)]), la: 'vorgebeugt, Arme lang', lb: 'Kugel zum Bauch ziehen' },
  'Überkopfdrücken beidarmig': { a: fr(P(FS, { e1: [84, 94], w1: [96, 80], e2: [116, 94], w2: [104, 80] }), [KB(100, 72)]), b: fr(P(FS, { e1: [88, 36], w1: [96, 12], e2: [112, 36], w2: [104, 12] }), [KB(100, 2)]), la: 'Kugel vor der Brust', lb: 'senkrecht nach oben' },
  'Rudern beidarmig mit Band': { a: fr(P(BR, { e1: [128, 110], w1: [126, 136], e2: [124, 110], w2: [122, 136] }), [BAND([98, 188], [126, 136])]), b: fr(P(BR, { e1: [108, 84], w1: [114, 108], e2: [104, 86], w2: [110, 110] }), [BAND([98, 188], [114, 108])]), la: 'vorgebeugt, Band unter den Füßen', lb: 'zum Bauch ziehen' },
  'Bergsteiger erhöht': { a: fr(PU_A, [{ table: [112, 148, 78] }]), b: fr(P(PU_A, { k1: [108, 148], f1: [84, 168], t1: [78, 176] }), [{ table: [112, 148, 78] }]), la: 'Hände erhöht, Körper gerade', lb: 'Knie zügig zur Brust, Wechsel' },
  'Russian Twist': g => g === 'kb' ? FIG_RT : { a: fr(FIG_RT.a.P), b: fr(FIG_RT.b.P), la: FIG_RT.la.replace('Kugel', 'Hände'), lb: FIG_RT.lb },
  'Russian Twist (Kugel)': { a: fr(P(RT, { e1: [104, 142], w1: [124, 156], e2: [122, 140], w2: [128, 156] }), [KB(130, 168), { loop: [100, 156, 34, 8] }]), b: fr(P(RT, { e1: [78, 140], w1: [72, 156], e2: [96, 142], w2: [76, 156] }), [KB(70, 168), { loop: [100, 156, 34, 8] }]), la: 'Kugel neben der rechten Hüfte', lb: 'zur anderen Seite drehen' },
  'Kettlebell-Kreuzheben': { a: fr({ h: [136, 92], n: [120, 100], p: [74, 132], k1: [104, 152], f1: [98, 188], t1: [112, 189], k2: [100, 154], f2: [94, 188], t2: [108, 189], e1: [118, 130], w1: [116, 160], e2: [114, 130], w2: [112, 160] }, [KB(114, 176)]), b: fr(SS, [KB(104, 124)]), la: 'Hüfte zurück, Rücken lang', lb: 'aufrichten, Gesäß anspannen' },
  'Wand-Engel': { a: fr(P(FS, { e1: [66, 72], w1: [68, 46], e2: [134, 72], w2: [132, 46] })), b: fr(P(FS, { e1: [74, 38], w1: [64, 12], e2: [126, 38], w2: [136, 12] })), la: 'Arme in W-Form an der Wand', lb: 'nach oben schieben' },
  'Bird Dog': { a: fr(QP), b: fr(P(QP, { e1: [158, 132], w1: [184, 128], k2: [46, 148], f2: [10, 146] })), la: 'Vierfüßlerstand', lb: 'Arm und Gegenbein strecken' },
  'Clamshells': { a: fr(P(SL, { k1: [134, 178], f1: [112, 186] })), b: fr(P(SL, { k1: [126, 146], f1: [110, 184] })), la: 'Seitlage, Knie gebeugt', lb: 'oberes Knie öffnen' },
  'Clamshells mit Band': { a: fr(P(SL, { k1: [134, 178], f1: [112, 186] }), [BAND([132, 176], [133, 180])]), b: fr(P(SL, { k1: [126, 146], f1: [110, 184] }), [BAND([126, 150], [132, 178])]), la: 'Band um die Knie', lb: 'oberes Knie gegen das Band öffnen' },
  'Brustwirbel-Rotation im Vierfüßlerstand': { a: fr(P(QP, { e1: [124, 162], w1: [144, 134] })), b: fr(P(QP, { e1: [126, 110], w1: [144, 128] })), la: 'Ellenbogen nach unten', lb: 'zur Decke aufdrehen' },
  'Katze-Kuh': { a: fr(P(QP, { m: [106, 126], h: [146, 148] })), b: fr(P(QP, { m: [106, 160], h: [150, 122] })), la: 'Katze: Rücken rund', lb: 'Kuh: Brust nach vorne' },
  'Kindhaltung': { a: fr({ h: [142, 176], n: [126, 172], m: [100, 156], p: [72, 168], k1: [110, 186], f1: [72, 188], k2: [108, 184], f2: [70, 186], e1: [150, 184], w1: [178, 187], e2: [148, 182], w2: [176, 185] }), la: 'Gesäß zu den Fersen, Arme lang' },
  'Open Book': { a: fr(SL), b: fr(P(SL, { e1: [40, 150], w1: [22, 128] }), [{ arrow: 'M92 168 Q76 118 34 120' }]), la: 'Seitlage, Arme zusammen', lb: 'oberen Arm aufklappen' },
  'Knie zur Brust': { a: fr(P(LB, { k1: [136, 176], f1: [170, 184], t1: [180, 178], k2: [134, 178], f2: [168, 186], t2: null })), b: fr(P(LB, { k1: [86, 146], f1: [110, 138], t1: null, k2: [84, 150], f2: [108, 142], t2: null, e1: [68, 158], w1: [86, 150], e2: [66, 160], w2: [84, 152] })), la: 'Rückenlage', lb: 'Knie zur Brust ziehen' },
  'Schulterkreisen mit Band': { a: fr(P(FS, { e1: [70, 92], w1: [56, 114], e2: [130, 92], w2: [144, 114] }), [BAND([56, 114], [144, 114])]), b: fr(P(FS, { e1: [72, 40], w1: [56, 16], e2: [128, 40], w2: [144, 16] }), [BAND([56, 16], [144, 16])]), la: 'Band breit vor der Hüfte', lb: 'gestreckt über den Kopf' },
  'Kinn-Rückzug': { a: fr(P(SS, { h: [114, 40] })), b: fr(P(SS, { h: [98, 40] }), [{ arrow: 'M132 40 H116' }]), la: 'Kopf vorgeschoben', lb: 'Kinn waagerecht zurück' },
  'Nackendehnung seitlich': { a: fr(FS), b: fr(P(FS, { h: [112, 44], e2: [128, 42], w2: [104, 30] })), la: 'aufrecht', lb: 'Kopf zur Seite neigen' },
  'Knie-zur-Wand': { a: fr(KW_A, [{ wall: 168 }]), b: fr(KW_B, [{ wall: 168 }]), la: 'Fuß eine Handbreit vor der Wand', lb: 'Knie zur Wand, Ferse unten' },
  'Fußgelenkkreisen': { a: fr(P(SS, { k1: [112, 150], f1: [124, 174], t1: [136, 176], e2: [132, 74], w2: [166, 70] }), [{ wall: 168 }, { loop: [130, 176, 14, 9] }]), la: 'Fuß langsam kreisen' },
  'Hintere Oberschenkel': { a: fr(SS), b: fr({ h: [146, 84], n: [130, 90], p: [86, 116], k1: [112, 149], f1: [138, 184], t1: [144, 172], k2: [90, 152], f2: [84, 188], t2: [98, 189], e1: [124, 116], w1: [112, 134], e2: [120, 116], w2: [108, 134] }), la: 'aufrecht', lb: 'Ferse vor, Hüfte zurück' },
  '90/90-Hüftrotation': { a: fr(NN), b: fr(P(NN, { n: [118, 140], h: [130, 126], e1: [130, 166], w1: [146, 184], e2: [126, 166], w2: [140, 184] })), la: 'beide Knie 90 Grad', lb: 'über das vordere Bein neigen' },
  'Tauben-Dehnung': { a: fr(PG), b: fr(P(PG, { n: [136, 166], h: [152, 170], e1: [160, 184], w1: [186, 186], e2: [158, 182], w2: [184, 184] })), la: 'vorderes Bein gebeugt, hinteres lang', lb: 'Oberkörper ablegen' },
  'Tiefe Hocke halten': { a: fr({ h: [112, 96], n: [106, 116], p: [86, 166], k1: [124, 144], f1: [106, 188], t1: [120, 189], k2: [120, 148], f2: [102, 188], t2: [116, 189], e1: [122, 146], w1: [118, 124], e2: [118, 148], w2: [114, 126] }), la: 'tief sitzen, Fersen unten' },
  "World's Greatest Stretch": { a: fr(WGS), b: fr(P(WGS, { e1: [134, 90], w1: [136, 62], h: [146, 104] })), la: 'Hände neben dem Fuß', lb: 'Arm zur Decke drehen' },
  'Einlaufen': { a: fr(RN_A), b: fr(RN_B), la: 'locker traben', lb: 'Gesprächstempo' },
  'Auslaufen': { a: fr(RN_A), b: fr(WALK_A), la: 'locker traben', lb: 'ausgehen' },
  'Locker gehen': { a: fr(WALK_A), b: fr(WALK_B), la: 'zügig gehen', lb: 'Arme locker' },
  'Steigerungsläufe': { a: fr(RN_A), b: fr(P(RN_B, { h: [118, 42], n: [112, 62] }), [{ arrow: 'M14 76 H54' }, { arrow: 'M22 98 H56' }]), la: 'locker beginnen', lb: 'zügig, aber locker' },
  'Kniehebelauf': { a: fr(KH_A), b: fr(KH_B), la: 'Knie bis Hüfthöhe', lb: 'Gegenarm nach vorne' },
  'Skippings': { a: fr(SK_A), b: fr(SK_B), la: 'kleine, schnelle Schritte', lb: 'auf dem Fußballen' },
  'Anfersen': { a: fr(AF_A), b: fr(AF_B), la: 'Ferse zum Gesäß', lb: 'Knie zeigt nach unten' },
  'Hopserlauf': { a: fr(KH_B), b: fr(shift(P(KH_A, { e2: [114, 66], w2: [118, 38] }), 0, -16)), la: 'Absprung', lb: 'Knie und Gegenarm hoch' },
  'Fußgelenksarbeit': { a: fr(P(SS, { k2: [102, 150], f2: [100, 180], t2: [112, 190] })), b: fr(P(SS, { k1: [104, 150], f1: [102, 180], t1: [114, 190] })), la: 'Ferse leicht anheben', lb: 'über den Ballen abrollen' },
  'Seitgalopp': { a: fr(shift(P(FS, { k1: [96, 150], f1: [96, 188], k2: [104, 150], f2: [104, 188], q1: [97, 112], q2: [103, 112], e1: [72, 78], w1: [52, 92], e2: [128, 78], w2: [148, 92] }), 0, -12)), b: fr(P(FS, { k1: [84, 150], f1: [70, 188], k2: [116, 150], f2: [130, 188], e1: [72, 78], w1: [52, 92], e2: [128, 78], w2: [148, 92] }), [{ arrow: 'M140 200 H180' }]), la: 'Füße kurz zusammen', lb: 'seitlich auseinander' },
  'Überkreuzlauf': { a: fr(P(FS, { k1: [104, 150], f1: [116, 188], k2: [106, 150], f2: [98, 188], e1: [72, 80], w1: [54, 96], e2: [128, 80], w2: [146, 96] })), b: fr(P(FS, { k1: [86, 150], f1: [76, 188], k2: [116, 150], f2: [128, 188], e1: [72, 80], w1: [54, 96], e2: [128, 80], w2: [146, 96] }), [{ arrow: 'M140 200 H180' }]), la: 'Bein vorne kreuzen', lb: 'öffnen, dann hinten kreuzen' },
  'Beinpendel vor/zurück': { a: fr(P(SS, { k1: [122, 140], f1: [146, 168], t1: [152, 158], e2: [116, 80], w2: [128, 98] }), [{ door: 130 }]), b: fr(P(SS, { k1: [80, 142], f1: [62, 172], t1: [72, 180], e2: [116, 80], w2: [128, 98] }), [{ door: 130 }]), la: 'Bein nach vorne', lb: 'Bein nach hinten' },
  'Beinpendel seitlich': { a: fr(P(FS, { e1: [84, 80], w1: [90, 72], e2: [116, 80], w2: [110, 72], k2: [98, 148], f2: [82, 178] })), b: fr(P(FS, { e1: [84, 80], w1: [90, 72], e2: [116, 80], w2: [110, 72], k2: [124, 144], f2: [146, 170] })), la: 'vor dem Standbein', lb: 'zur Seite schwingen' },
  'Ausfallschritt mit Rotation': { a: fr(P(SS, { e1: [112, 84], w1: [128, 76], e2: [108, 86], w2: [124, 78] })), b: fr(P(LG_B, { e1: [118, 90], w1: [140, 84], e2: [80, 96], w2: [62, 94] }), [{ loop: [98, 100, 32, 10] }]), la: 'Hände vor der Brust', lb: 'zum vorderen Bein drehen' },
  'Hüftöffner im Gehen': { a: fr(P(FS, { k2: [116, 124], f2: [118, 160], e1: [76, 88], w1: [66, 110] })), b: fr(P(FS, { k2: [132, 118], f2: [124, 152], e1: [76, 88], w1: [66, 110] }), [{ arrow: 'M112 104 Q128 96 140 108' }]), la: 'Knie vor dem Körper', lb: 'nach außen öffnen' },
  'Wadenpumpe': { a: fr(SS), b: fr(P(shift(SS, 0, -10), { f1: [99, 178], t1: [110, 190], f2: [95, 178], t2: [106, 190] }), [{ arrow: 'M70 150 V120' }]), la: 'hüftbreit stehen', lb: 'auf die Ballen' }
});

Object.assign(FIG, {
  'Ausfallschritte mit Band': { a: fr(P(SS, { e1: [106, 88], w1: [110, 64], e2: [102, 88], w2: [106, 64] }), [BAND([100, 188], [110, 64])]), b: fr(P(LG_B, { e1: [104, 120], w1: [108, 98], e2: [100, 120], w2: [104, 98] }), [BAND([128, 188], [108, 98])]), la: 'Band unter dem vorderen Fuß', lb: 'Schritt zurück, absenken' },
  'Split Squat mit Band': { a: fr(P(SP_A, { e1: [104, 86], w1: [108, 62], e2: [100, 86], w2: [104, 62] }), [BAND([124, 188], [108, 62])]), b: fr(P(SP_B, { e1: [104, 120], w1: [108, 98], e2: [100, 120], w2: [104, 98] }), [BAND([124, 188], [108, 98])]), la: 'Schrittstellung, Band unter dem Fuß', lb: 'hinteres Knie absenken' },
  'Suitcase March mit Band': { a: fr(SS, [BAND([95, 188], [96, 111])]), b: fr(P(SS, { k1: [128, 118], f1: [127, 156], t1: [140, 158], e1: [112, 84], w1: [118, 106] }), [BAND([95, 188], [96, 111])]), la: 'Band zieht einseitig nach unten', lb: 'Knie heben, nicht kippen' },
  'Suitcase Hold mit Band': { a: fr(P(FS, { e2: [121, 88], w2: [124, 114] }), [BAND([111, 188], [124, 114])]), la: 'Gegen den Zug ruhig halten' },
  'Einbeiniges Kreuzheben mit Band': { a: fr(SW_A, [BAND([99, 188], [96, 111])]), b: fr(SW_B, [BAND([100, 188], [142, 148])]), la: 'Band unter dem Standfuß', lb: 'Hüfte zurück, Bein nach hinten' },
  'Einbeiniges Wadenheben mit Band': { a: fr(P(CA_A, { e2: [98, 86], w2: [104, 64] }), [{ wall: 168 }, BAND([100, 188], [104, 64])]), b: fr(P(CA_B, { e2: [98, 76], w2: [104, 54] }), [{ wall: 168 }, { arrow: 'M70 150 V118' }, BAND([101, 177], [104, 54])]), la: 'Band unter dem Fußballen', lb: 'auf den Fußballen' },
  'Dead Bug mit Kettlebell': { a: fr(DB, [KB(54, 112)]), b: fr(P(DB, { k1: [138, 172], f1: [174, 178], t1: [182, 172] }), [KB(54, 112)]), la: 'Kugel über der Brust', lb: 'Bein strecken, Kugel ruhig' },
  'Dead Bug mit Band': { a: fr(DB, [BAND([54, 122], [138, 146])]), b: fr(P(DB, { e2: [26, 170], w2: [6, 176], k1: [138, 172], f1: [174, 178], t1: [182, 172] }), [BAND([54, 122], [174, 178])]), la: 'Band zwischen Händen und Füßen', lb: 'Arm und Gegenbein strecken' },
  'Squeeze Press am Boden': { a: fr(P(LB, { e1: [70, 185], w1: [72, 160], e2: [66, 184], w2: [68, 160] }), [KB(70, 150)]), b: fr(P(LB, { e1: [50, 150], w1: [52, 122], e2: [46, 151], w2: [48, 123] }), [KB(50, 112)]), la: 'Kugel zwischen den Händen', lb: 'senkrecht nach oben drücken' },
  'Schwimmer in Bauchlage': { a: fr(P(PR, { n: [148, 177], h: [167, 171], e1: [170, 162], w1: [192, 150], e2: [168, 164], w2: [190, 152] })), b: fr(P(PR, { n: [148, 177], h: [167, 171], e1: [128, 166], w1: [106, 160], e2: [126, 168], w2: [104, 162] }), [{ arrow: 'M190 134 Q150 116 114 146' }]), la: 'Arme lang über dem Kopf', lb: 'im Bogen zur Hüfte' },
  'Kettlebell-Pullover': { a: fr(P(shift(LB, 20, 0), { e1: [72, 150], w1: [74, 124], e2: [70, 150], w2: [72, 124] }), [KB(73, 112)]), b: fr(P(shift(LB, 20, 0), { e1: [46, 166], w1: [24, 160], e2: [44, 168], w2: [22, 162] }), [KB(12, 160)]), la: 'Kugel über der Brust', lb: 'über den Kopf führen' },
  'Butterfly mit Band': { a: fr(P(FS, { e1: [66, 70], w1: [42, 74], e2: [134, 70], w2: [158, 74] }), [BAND([42, 74], [100, 66], [158, 74])]), b: fr(P(FS, { e1: [78, 82], w1: [94, 76], e2: [122, 82], w2: [106, 76] }), [BAND([94, 76], [100, 66], [106, 76])]), la: 'Arme seitlich, Band im Rücken', lb: 'vor der Brust schließen' },
  'Seitlicher Ausfallschritt mit Kettlebell': { a: fr(P(FS, { k1: [80, 150], f1: [64, 188], k2: [120, 150], f2: [136, 188], e1: [86, 96], w1: [96, 82], e2: [114, 96], w2: [104, 82] }), [KB(100, 74)]), b: fr(P(FS, { p: [112, 132], q1: [105, 132], q2: [119, 132], n: [110, 80], s1: [96, 82], s2: [124, 82], h: [110, 60], k1: [86, 160], f1: [64, 188], k2: [134, 152], f2: [136, 188], e1: [98, 112], w1: [108, 98], e2: [122, 112], w2: [114, 98] }), [KB(111, 90)]), la: 'breit stehen, Kugel vor der Brust', lb: 'zur Seite absenken' }
});
const FIG_RT = FIG['Russian Twist (Kugel)']; delete FIG['Russian Twist (Kugel)'];

// Core im Knien: halber Kniestand (HF_A) und aufrechter Kniestand (TK)
const TK = { h: [100, 74], n: [99, 94], p: [98, 146], k1: [102, 186], f1: [64, 188], k2: [98, 186], f2: [60, 188] };
Object.assign(FIG, {
  'Clean & Press im halben Kniestand': { a: fr(P(HF_A, { e1: [104, 120], w1: [108, 144], e2: [108, 118], w2: [112, 96] }), [KB(118, 90)]), b: fr(P(HF_A, { e1: [104, 120], w1: [108, 144], e2: [103, 68], w2: [104, 42] }), [KB(106, 30)]), la: 'Kugel in der Rack-Position', lb: 'senkrecht über Kopf drücken' },
  'Pullover im Kniestand': { a: fr(P(TK, { e1: [110, 118], w1: [118, 100], e2: [106, 118], w2: [114, 100] }), [KB(124, 94)]), b: fr(P(TK, { e1: [106, 68], w1: [88, 56], e2: [102, 68], w2: [84, 56] }), [KB(78, 62), { arrow: 'M136 96 Q138 42 96 36' }]), la: 'Kugel vor der Brust', lb: 'über den Kopf nach hinten' },
  'Wrestler-Halo': { a: fr(P(TK, { e1: [106, 118], w1: [112, 140], e2: [102, 118], w2: [108, 140] }), [KB(116, 150)]), b: fr(P(TK, { e1: [110, 70], w1: [98, 50], e2: [106, 70], w2: [94, 50] }), [{ loop: [100, 70, 30, 13] }, KB(96, 40), { arrow: 'M136 84 Q144 122 124 146' }]), la: 'Kugel an der Hüfte', lb: 'um den Kopf zur anderen Hüfte' }
});

// Mobility: Hüfte aktiv & stark, Sprunggelenk & Fuß
const SEAT = { h: [62, 108], n: [66, 128], p: [80, 176], k1: [120, 180], f1: [158, 182], t1: [162, 170], k2: [118, 182], f2: [156, 184], t2: [160, 172], e1: [64, 154], w1: [58, 180], e2: [62, 154], w2: [56, 180] };
const HANDS_HIP = { e1: [72, 88], w1: [90, 112], e2: [128, 88], w2: [110, 112] };
const CP_A = { h: [162, 154], n: [144, 160], p: [94, 164], k1: [58, 140], f1: [22, 138], k2: [60, 178], f2: [30, 186], e1: [146, 187], w1: [176, 187], e2: [126, 152], w2: [106, 160] };
const CP_B = P(CP_A, { p: [101, 136], k2: [66, 154], f2: [36, 170], e2: [124, 140], w2: [106, 138] });
const WD_B = FIG['Wadendehnung'].b.P;
const TR_A = { h: [46, 42], n: [44, 62], p: [46, 114], k1: [64, 150], f1: [80, 186], t1: [94, 188], k2: [62, 150], f2: [78, 187], t2: [92, 189], e1: [48, 88], w1: [54, 112], e2: [44, 88], w2: [50, 112] };
Object.assign(FIG, {
  'Hüft-CARs': { a: fr(P(QP, { k1: [116, 170], f1: [80, 180] })), b: fr(P(QP, { k1: [42, 146], f1: [28, 112] }), [{ loop: [78, 156, 40, 16] }]), la: 'Knie nach vorne zur Brust', lb: 'außen herum nach hinten' },
  'Beinheben im Sitzen': { a: fr(SEAT), b: fr(P(SEAT, { k1: [118, 162], f1: [153, 149], t1: [151, 137] }), [{ arrow: 'M174 178 V152' }]), la: 'aufrecht sitzen, Beine lang', lb: 'gestrecktes Bein anheben' },
  'Beinüberheben im Sitzen': { a: fr(SEAT, [KB(140, 174)]), b: fr(P(SEAT, { k1: [114, 156], f1: [148, 136], t1: [142, 126] }), [KB(140, 174), { arrow: 'M180 172 Q176 130 158 118' }]), la: 'Kugel zwischen den Beinen', lb: 'Bein im Bogen darüber' },
  'Knieheben im Stand': { a: fr(P(FS, HANDS_HIP), [KB(128, 178)]), b: fr(P(FS, Object.assign({ k2: [128, 118], f2: [140, 150] }, HANDS_HIP)), [KB(128, 178), { arrow: 'M112 172 Q130 132 150 166' }]), la: 'Kugel außen neben dem Fuß', lb: 'Knie hoch, Fuß über die Kugel' },
  '90/90 mit Aufrichten': { a: fr(NN), b: fr({ h: [90, 78], n: [88, 98], p: [86, 150], k1: [116, 182], f1: [128, 158], k2: [62, 182], f2: [58, 158], e1: [100, 122], w1: [112, 104], e2: [96, 122], w2: [108, 104] }), la: '90/90-Sitz', lb: 'Hüfte hoch auf die Knie' },
  'Copenhagen Hip Dips': { a: fr(CP_A, [{ box: [6, 144, 58, 46] }]), b: fr(CP_B, [{ box: [6, 144, 58, 46] }, { arrow: 'M112 176 V150' }]), la: 'oberes Knie aufgelegt', lb: 'Becken hochdrücken' },
  'Soleus-Dehnung': { a: fr(WD_B, [{ wall: 168 }]), b: fr({ h: [134, 66], n: [122, 80], p: [98, 128], k1: [128, 158], f1: [124, 188], t1: [138, 189], k2: [92, 160], f2: [66, 188], t2: [80, 189], e1: [144, 76], w1: [166, 70], e2: [142, 78], w2: [164, 72] }, [{ wall: 168 }, { arrow: 'M76 136 L86 154' }]), la: 'Schrittstellung an der Wand', lb: 'Knie beugen, Ferse unten' },
  'Sprunggelenk mit Kettlebell': { a: fr(P(HF_A, { e1: [110, 116], w1: [124, 132], e2: [106, 116], w2: [120, 132] }), [KB(130, 136)]), b: fr(P(HF_A, { h: [118, 76], n: [117, 96], p: [116, 150], k1: [156, 156], k2: [96, 186], f2: [62, 186], e1: [128, 118], w1: [142, 138], e2: [124, 118], w2: [138, 138] }), [KB(148, 142), { arrow: 'M164 128 H186' }]), la: 'Kugel auf dem vorderen Knie', lb: 'Knie vor, Ferse bleibt unten' },
  'Schienbeinheben': { a: fr(TR_A, [{ wall: 26 }]), b: fr(P(TR_A, { t1: [90, 174], t2: [88, 175] }), [{ wall: 26 }, { arrow: 'M108 186 V162' }]), la: 'Rücken an der Wand, Füße vor', lb: 'Zehen zum Schienbein ziehen' },
  'Einbeinstand': { a: fr(P(FS, Object.assign({ k2: [114, 132], f2: [120, 162] }, HANDS_HIP))), la: 'auf einem Bein, Knie leicht gebeugt' }
});

function getFigure(name, gear) { const f = FIG[name]; return typeof f === 'function' ? f(gear) : f || null; }

function figLine(a, b, cls, w) { return `<path class="${cls}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke-width="${w || 8}" stroke-linecap="round" fill="none"/>`; }
function figPerson(Q) {
  const far = Q.front ? 'fn' : 'ff', a1 = Q.s1 || Q.n, a2 = Q.s2 || Q.n, l1 = Q.q1 || Q.p, l2 = Q.q2 || Q.p;
  let o = figLine(l2, Q.k2, far) + figLine(Q.k2, Q.f2, far) + (Q.t2 ? figLine(Q.f2, Q.t2, far, 6) : '');
  o += figLine(a2, Q.e2, far) + figLine(Q.e2, Q.w2, far);
  if (Q.s1) o += figLine(Q.s1, Q.s2, 'fn');
  if (Q.q1) o += figLine(Q.q1, Q.q2, 'fn');
  o += Q.m ? `<path class="fn" d="M${Q.n[0]} ${Q.n[1]}Q${2 * Q.m[0] - (Q.n[0] + Q.p[0]) / 2} ${2 * Q.m[1] - (Q.n[1] + Q.p[1]) / 2} ${Q.p[0]} ${Q.p[1]}" stroke-width="8" stroke-linecap="round" fill="none"/>` : figLine(Q.n, Q.p, 'fn');
  o += figLine(l1, Q.k1, 'fn') + figLine(Q.k1, Q.f1, 'fn') + (Q.t1 ? figLine(Q.f1, Q.t1, 'fn', 6) : '');
  o += `<circle class="fhead" cx="${Q.h[0]}" cy="${Q.h[1]}" r="12" stroke-width="5"/>`;
  return o + figLine(a1, Q.e1, 'fn') + figLine(Q.e1, Q.w1, 'fn');
}
function figProps(props, behind, mk) {
  return props.map(p => {
    if (behind) {
      if (p.box) return `<rect class="fprop" x="${p.box[0]}" y="${p.box[1]}" width="${p.box[2]}" height="${p.box[3]}" rx="4" stroke-width="3"/>`;
      if (p.table) { const [x, y, w] = p.table; return `<path class="fpropline" d="M${x} ${y}H${x + w}M${x + 6} ${y}V190M${x + w - 6} ${y}V190" stroke-width="5" fill="none"/>`; }
      if (p.chair) { const [x, y, w] = p.chair; return `<path class="fpropline" d="M${x} ${y}H${x + w}M${x + 4} ${y}V190M${x + w - 4} ${y}V190M${x} ${y}V${y - 52}" stroke-width="5" fill="none"/>`; }
      if (p.wall) return `<rect class="fprop" x="${p.wall}" y="14" width="10" height="176" stroke-width="2"/>`;
      if (p.door) return `<path class="fpropline" d="M${p.door} 8V190" stroke-width="8" stroke-linecap="round"/>`;
      return '';
    }
    if (p.kb) { const [x, y] = p.kb; return `<circle class="fkb" cx="${x}" cy="${y}" r="10"/><path class="fkbh" d="M${x - 7} ${y - 6}q7 -14 14 0" fill="none" stroke-width="3.5"/>`; }
    if (p.band) return `<polyline class="fband" points="${p.band.map(q => q.join(',')).join(' ')}" fill="none" stroke-width="3" stroke-linejoin="round"/>`;
    if (p.towel) return `<polyline class="ftowel" points="${p.towel.map(q => q.join(',')).join(' ')}" fill="none" stroke-width="5" stroke-linejoin="round"/>`;
    if (p.loop) { const [cx, cy, rx, ry] = p.loop; return `<ellipse class="farrow" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke-width="2.5" stroke-dasharray="6 5"/>`; }
    if (p.arrow) return `<path class="farrow" d="${p.arrow}" fill="none" stroke-width="3" marker-end="url(#${mk})"/>`;
    return '';
  }).join('');
}
let figCounter = 0;
function renderFigure(name, gear) {
  const f = getFigure(name, gear);
  if (!f) return '';
  const mk = 'kbt-ah' + (++figCounter);
  const defs = `<defs><marker id="${mk}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path class="farrowhead" d="M0 0L10 5L0 10z"/></marker></defs>`;
  const frame = (x, part, label) => `<g transform="translate(${x},14)"><path class="fground" d="M4 190H196" stroke-width="2"/>${figProps(part.props, true, mk)}${figPerson(part.P)}${figProps(part.props, false, mk)}<text class="ftext" x="100" y="220" text-anchor="middle" font-size="13">${figEsc(label)}</text></g>`;
  const label = f.b ? `${f.la} → ${f.lb}` : f.la;
  if (!f.b) return `<svg class="guideart" viewBox="0 0 440 250" role="img" aria-label="Skizze ${figEsc(name)}: ${figEsc(label)}">${defs}${frame(120, f.a, f.la)}</svg>`;
  return `<svg class="guideart" viewBox="0 0 440 250" role="img" aria-label="Skizze ${figEsc(name)}: ${figEsc(label)}">${defs}${frame(10, f.a, f.la)}<path class="farrow" d="M209 118H229" stroke-width="3" marker-end="url(#${mk})"/>${frame(232, f.b, f.lb)}</svg>`;
}
