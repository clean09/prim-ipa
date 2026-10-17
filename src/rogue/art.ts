// Jugendstil-Grafiken für STERNENFALL, komplett als SVG erzeugt (keine Bilddateien, gestochen scharf auf jedem Display):
// Kartenmotive mit Heiligenschein-Halo (à la Mucha), Peitschenhieb-Ornamente, organische Weltraumkreaturen,
// eigene Boss-Kompositionen, Porträts der Figuren und Schiffe. Farben: Mitternachtsblau, Altgold, Rosé, Salbei, Elfenbein.

let uid = 0;
const gid = (p: string) => `${p}${++uid}`;
const GOLD = '#c9a45c', IVORY = '#efe3c8', INK = '#1b1a2a';

function rng(seed: number) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const f1 = (n: number) => n.toFixed(1);

/** Peitschenhieb-Kurve (typisches Jugendstil-Ornament), gespiegelt mit flip. */
function whip(x: number, y: number, s: number, rot = 0, flip = false, col = GOLD, w = 1.2) {
  const k = flip ? -1 : 1;
  return `<path transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${f1(s * k)} ${f1(s)})" d="M0 0 C 6 -9, 18 -8, 19 1 C 20 8, 11 11, 8 5 C 6 1, 11 -1, 12 2" fill="none" stroke="${col}" stroke-width="${f1(w / s)}" stroke-linecap="round"/>`;
}
/** Heiligenschein (Mucha): Kreis, feine Strahlen, Perlenkranz. */
function halo(cx: number, cy: number, r: number, c: string, rays = 24) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity=".22"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD}" stroke-width=".8" opacity=".9"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.86)}" fill="none" stroke="${GOLD}" stroke-width=".4" stroke-dasharray="1 2.2" opacity=".8"/>`;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2, r0 = r * 1.04, r1 = r * (i % 2 ? 1.14 : 1.24);
    s += `<line x1="${f1(cx + Math.cos(a) * r0)}" y1="${f1(cy + Math.sin(a) * r0)}" x2="${f1(cx + Math.cos(a) * r1)}" y2="${f1(cy + Math.sin(a) * r1)}" stroke="${GOLD}" stroke-width=".5" opacity=".7"/>`;
  }
  return s;
}
const CRYSTAL = '#6fe3e0';
/** Erfundene alte Schrift (eckige Glyphen aus 2–4 Strichen) im Kreis – Inschrift wie auf Kristallruinen. */
export function glyphRing(cx: number, cy: number, r: number, seed: number, n = 18, col = CRYSTAL, o = 0.55) {
  const R = rng(seed * 31 + 7);
  const strokes = ['M0 -3 L0 3', 'M-2 -3 L2 -3', 'M-2 3 L2 3', 'M-2 -3 L2 3', 'M2 -3 L-2 3', 'M-2 0 L2 0', 'M-2 -3 L-2 3', 'M2 -3 L2 3', 'M-2 -1 L0 -3 L2 -1', 'M-2 1 L0 3 L2 1'];
  let g = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    let d = ''; const k = 2 + Math.floor(R() * 3);
    for (let j = 0; j < k; j++) d += strokes[Math.floor(R() * strokes.length)] + ' ';
    g += `<path transform="translate(${f1(x)} ${f1(y)}) rotate(${f1((a * 180) / Math.PI + 90)}) scale(.75)" d="${d}" stroke="${col}" stroke-width="1" fill="none" stroke-linecap="square"/>`;
  }
  return `<g opacity="${o}">${g}</g>`;
}
/** Harte Schattenkante (Mignola-Stil): rechte untere Hälfte im Kreis abgedunkelt. */
function inkShade(cx: number, cy: number, r: number) {
  const id = gid('ink'), cl = gid('cl');
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".505" stop-color="#05040c" stop-opacity=".42"/><stop offset="1" stop-color="#05040c" stop-opacity=".6"/></linearGradient><clipPath id="${cl}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><rect x="0" y="0" width="100" height="100" fill="url(#${id})" clip-path="url(#${cl})"/>`;
}

/** Vierzackiger Jugendstil-Stern. */
const star4 = (x: number, y: number, r: number, c = IVORY, o = 1) =>
  `<path d="M${f1(x)} ${f1(y - r)} Q${f1(x + r * 0.18)} ${f1(y - r * 0.18)} ${f1(x + r)} ${f1(y)} Q${f1(x + r * 0.18)} ${f1(y + r * 0.18)} ${f1(x)} ${f1(y + r)} Q${f1(x - r * 0.18)} ${f1(y + r * 0.18)} ${f1(x - r)} ${f1(y)} Q${f1(x - r * 0.18)} ${f1(y - r * 0.18)} ${f1(x)} ${f1(y - r)}Z" fill="${c}" opacity="${o}"/>`;
function lin(id: string, a: string, b: string, x2 = 0, y2 = 1) { return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; }
function rad(id: string, a: string, b: string) { return `<radialGradient id="${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient>`; }
const svg = (vb: string, body: string, cls = '') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="${cls}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

// =========================================================================================== Kartenmotive
type Motif = (g: string, r: string, c1: string, c2: string) => string;
const ST = `stroke="${IVORY}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
const MOTIFS: Record<string, Motif> = {
  laser: (g) => `<path d="M14 72 L66 26" stroke="url(#${g})" stroke-width="7" stroke-linecap="round"/><path d="M14 72 L66 26" stroke="${IVORY}" stroke-width="1.6" stroke-linecap="round"/>${star4(70, 23, 9)}${whip(20, 80, 1.1, -40)}`,
  laser2: (g) => `<path d="M12 64 L62 22 M24 76 L74 34" stroke="url(#${g})" stroke-width="6" stroke-linecap="round"/><path d="M12 64 L62 22 M24 76 L74 34" stroke="${IVORY}" stroke-width="1.3"/>${star4(65, 20, 6)}${star4(77, 32, 6)}`,
  torpedo: (g, r) => `<ellipse cx="50" cy="50" rx="30" ry="11" transform="rotate(-30 50 50)" fill="url(#${r})" ${ST}/><path d="M24 64 l-10 6 l4 -10 M27 70 l-6 10" ${ST} fill="none"/><path d="M56 30 q10 -4 18 2" stroke="${GOLD}" fill="none"/>${whip(66, 66, 1, 10)}`,
  rakete: (g, r) => `<path d="M50 14 C64 26 64 52 58 70 L42 70 C36 52 36 26 50 14Z" fill="url(#${r})" ${ST}/><circle cx="50" cy="38" r="6" fill="${INK}" stroke="${GOLD}"/><path d="M42 62 L32 76 L44 72 M58 62 L68 76 L56 72" fill="url(#${g})" ${ST}/><path d="M46 72 Q50 90 54 72" fill="#f2b06a" opacity=".9"/>`,
  nadel: (g) => `<path d="M50 10 L54 50 L50 90 L46 50Z" fill="url(#${g})" ${ST}/>${star4(50, 50, 16, IVORY, 0.9)}<circle cx="50" cy="50" r="4" fill="${GOLD}"/>`,
  mond: (g, r) => `<path d="M60 16 A34 34 0 1 0 60 84 A26 26 0 1 1 60 16Z" fill="url(#${r})" ${ST}/>${star4(70, 30, 5)}${star4(76, 52, 3)}${whip(30, 82, 1, -10, true)}`,
  komet: (g, r) => `<path d="M70 30 C40 34 20 56 12 84 C30 66 48 56 70 48Z" fill="url(#${g})" opacity=".85"/><circle cx="70" cy="38" r="12" fill="url(#${r})" ${ST}/>${star4(26, 24, 4)}${star4(84, 70, 3)}`,
  flak: (g, r) => [0, 1, 2, 3, 4].map(i => { const a = -1.2 + i * 0.6; return `<circle cx="${f1(50 + Math.cos(a) * 26)}" cy="${f1(56 + Math.sin(a) * 26)}" r="${6 - Math.abs(i - 2)}" fill="url(#${r})" ${ST}/>`; }).join('') + `<circle cx="50" cy="70" r="9" fill="url(#${g})" ${ST}/>`,
  plasma: (g, r) => `<path d="M50 14 C70 30 74 48 62 62 C72 64 70 82 50 86 C30 82 28 64 38 62 C26 48 30 30 50 14Z" fill="url(#${r})" ${ST}/><path d="M50 30 C58 42 56 54 50 62 C44 54 42 42 50 30Z" fill="${IVORY}" opacity=".6"/>${whip(18, 70, 1.1, -60)}${whip(82, 70, 1.1, -120, true)}`,
  blitz: (g) => `<path d="M56 10 L30 54 L48 54 L40 90 L72 42 L54 42 L62 10Z" fill="url(#${g})" ${ST}/>${star4(26, 26, 5)}`,
  lanze: (g) => `<path d="M16 84 L72 28" stroke="${GOLD}" stroke-width="3"/><path d="M70 30 L86 14 L82 34Z M70 30 L66 18 L86 14Z" fill="url(#${g})" ${ST}/><circle cx="40" cy="60" r="10" fill="none" stroke="${IVORY}" stroke-dasharray="2 3"/><circle cx="40" cy="60" r="16" fill="none" stroke="${GOLD}" stroke-width=".6"/>`,
  drohne: (g, r) => `<circle cx="50" cy="50" r="14" fill="url(#${r})" ${ST}/><circle cx="50" cy="50" r="5" fill="${INK}" stroke="${GOLD}"/>` + [0, 1, 2, 3].map(i => `<g transform="rotate(${45 + i * 90} 50 50)"><line x1="50" y1="36" x2="50" y2="20" ${ST}/><ellipse cx="50" cy="18" rx="10" ry="3" fill="url(#${g})" ${ST}/></g>`).join(''),
  asteroid: (g, r) => `<path d="M30 30 L52 18 L74 28 L82 52 L70 76 L44 82 L22 68 L18 46Z" fill="url(#${r})" ${ST}/><circle cx="42" cy="44" r="6" fill="none" stroke="${GOLD}"/><circle cx="62" cy="60" r="4" fill="none" stroke="${GOLD}"/><circle cx="58" cy="34" r="3" fill="none" stroke="${GOLD}"/>`,
  sonne: (g, r) => `${halo(50, 50, 30, '#f0c070', 32)}<circle cx="50" cy="50" r="18" fill="url(#${r})" ${ST}/><path d="M43 48 q3 -3 6 0 M51 48 q3 -3 6 0 M44 57 q6 4 12 0" stroke="${INK}" fill="none" stroke-width="1.2"/>`,
  stern: (g) => `${star4(50, 50, 32, `url(#${g})`)}${star4(50, 50, 32, 'none')}<path d="M50 18 Q54 46 82 50 Q54 54 50 82 Q46 54 18 50 Q46 46 50 18Z" fill="none" ${ST}/>${star4(50, 50, 10, IVORY)}${star4(76, 22, 4)}${star4(24, 78, 4)}`,
  supernova: (g, r) => `${halo(50, 50, 34, '#ffb070', 40)}` + Array.from({ length: 12 }, (_, i) => `<path d="M50 50 L${f1(50 + Math.cos(i * 0.5236) * 40)} ${f1(50 + Math.sin(i * 0.5236) * 40)}" stroke="url(#${g})" stroke-width="${i % 2 ? 2 : 4}"/>`).join('') + `<circle cx="50" cy="50" r="13" fill="url(#${r})" ${ST}/>`,
  schild: (g, r) => `<path d="M50 14 L78 24 C78 52 68 72 50 86 C32 72 22 52 22 24Z" fill="url(#${r})" ${ST}/><path d="M50 24 L68 31 C68 52 61 66 50 76 C39 66 32 52 32 31Z" fill="none" stroke="${GOLD}" stroke-width=".8"/>${whip(50, 52, 0.9, -90)}${whip(50, 52, 0.9, -90, true)}`,
  schild2: (g, r) => `<path d="M50 12 L82 30 L82 66 L50 88 L18 66 L18 30Z" fill="url(#${r})" ${ST}/><path d="M50 26 L70 37 L70 60 L50 74 L30 60 L30 37Z" fill="none" stroke="${GOLD}"/><circle cx="50" cy="50" r="7" fill="${IVORY}" opacity=".8"/>`,
  anker: (g, r) => `<path d="M50 18 L50 80 M34 34 L66 34 M22 62 C26 80 74 80 78 62" ${ST} fill="none" stroke-width="3"/><circle cx="50" cy="16" r="6" fill="url(#${r})" ${ST}/><path d="M22 62 l-4 -8 l10 2 Z M78 62 l4 -8 l-10 2Z" fill="${IVORY}"/>`,
  kuppel: (g, r) => `<path d="M14 70 A36 36 0 0 1 86 70Z" fill="url(#${r})" ${ST} opacity=".9"/><path d="M26 70 A24 24 0 0 1 74 70 M38 70 A12 12 0 0 1 62 70" fill="none" stroke="${GOLD}"/><path d="M10 72 H90" ${ST}/>${star4(50, 30, 6)}`,
  spiegel: (g, r) => `<ellipse cx="50" cy="46" rx="22" ry="30" fill="url(#${r})" ${ST}/><path d="M38 30 Q46 22 56 26" stroke="${IVORY}" fill="none" opacity=".8"/><path d="M50 76 L50 90 M40 90 H60" ${ST}/>${whip(26, 70, 1, 200)}${whip(74, 70, 1, -20, true)}`,
  kristall: (g, r) => `<path d="M50 10 L66 34 L58 88 L42 88 L34 34Z" fill="url(#${r})" ${ST}/><path d="M50 10 L50 88 M34 34 L66 34" stroke="${IVORY}" stroke-width=".6" opacity=".7"/><path d="M30 50 L40 40 L42 82 L30 82Z M70 50 L60 40 L58 82 L70 82Z" fill="url(#${g})" ${ST} opacity=".85"/>`,
  schwarm: (g, r, c1) => Array.from({ length: 9 }, (_, i) => { const a = i * 2.4, d = 8 + i * 3.4; return `<circle cx="${f1(50 + Math.cos(a) * d)}" cy="${f1(50 + Math.sin(a) * d)}" r="${f1(5 - i * 0.35)}" fill="${i % 2 ? `url(#${r})` : c1}" stroke="${IVORY}" stroke-width=".7"/>`; }).join(''),
  sanduhr: (g, r) => `<path d="M30 14 H70 M30 86 H70 M34 14 C34 40 66 40 66 50 C66 60 34 60 34 86 M66 14 C66 40 34 40 34 50 C34 60 66 60 66 86" ${ST} fill="none"/><path d="M38 24 Q50 36 62 24Z M40 82 Q50 66 60 82Z" fill="url(#${g})"/>`,
  krone: (g, r) => `${halo(50, 52, 30, '#f0d080', 20)}<path d="M20 66 L26 32 L38 50 L50 24 L62 50 L74 32 L80 66Z" fill="url(#${r})" ${ST}/><path d="M20 66 H80 V74 H20Z" fill="url(#${g})" ${ST}/>${[26, 50, 74].map(x => `<circle cx="${x}" cy="${x === 50 ? 22 : 30}" r="3.5" fill="${IVORY}"/>`).join('')}`,
  muenze: (g, r) => `<circle cx="50" cy="50" r="30" fill="url(#${r})" ${ST}/><circle cx="50" cy="50" r="23" fill="none" stroke="${INK}" stroke-width=".8" opacity=".5"/>${star4(50, 50, 13, INK, 0.65)}`,
  satellit: (g, r) => `<rect x="42" y="42" width="16" height="16" rx="2" fill="url(#${r})" ${ST}/><rect x="12" y="44" width="24" height="12" fill="url(#${g})" ${ST}/><rect x="64" y="44" width="24" height="12" fill="url(#${g})" ${ST}/><path d="M50 42 L50 26 M42 22 A10 10 0 0 1 58 22" ${ST} fill="none"/>`,
  feder: (g, r) => `<path d="M24 84 C30 50 50 24 78 14 C70 42 52 66 24 84Z" fill="url(#${r})" ${ST}/><path d="M24 84 C40 60 56 40 74 18" stroke="${GOLD}" fill="none"/>` + [0, 1, 2, 3].map(i => `<path d="M${36 + i * 9} ${66 - i * 12} l8 2" stroke="${IVORY}" stroke-width=".7"/>`).join(''),
  nebel: (g, r, c1) => `<path d="M14 60 C14 40 34 34 42 42 C46 24 70 24 72 42 C88 40 92 62 76 66 C70 80 46 82 38 72 C24 78 10 72 14 60Z" fill="url(#${r})" ${ST}/>${whip(34, 56, 1.1, 0)}${whip(64, 52, 1, 180, true)}${star4(56, 40, 4)}`,
  lotus: (g, r) => [-60, -30, 0, 30, 60].map(a => `<path d="M50 74 C40 56 42 36 50 22 C58 36 60 56 50 74Z" transform="rotate(${a} 50 74)" fill="url(#${r})" ${ST}/>`).join('') + `<path d="M24 78 Q50 70 76 78" ${ST} fill="none"/>`,
  auge: (g, r) => Array.from({ length: 12 }, (_, i) => `<path d="M50 50 C46 38 46 26 50 14 C54 26 54 38 50 50Z" transform="rotate(${i * 30} 50 50)" fill="url(#${g})" opacity=".65"/>`).join('') + `<path d="M18 50 Q50 22 82 50 Q50 78 18 50Z" fill="${IVORY}" ${ST}/><circle cx="50" cy="50" r="12" fill="url(#${r})"/><circle cx="50" cy="50" r="5" fill="${INK}"/>`,
  maske: (g, r) => `<path d="M26 26 C40 18 60 18 74 26 C76 52 66 76 50 84 C34 76 24 52 26 26Z" fill="url(#${r})" ${ST}/><path d="M34 44 Q40 38 46 44 Q40 48 34 44Z M54 44 Q60 38 66 44 Q60 48 54 44Z" fill="${INK}"/><path d="M42 66 Q50 70 58 66" stroke="${INK}" fill="none"/>${whip(26, 26, 1, 200)}${whip(74, 26, 1, -20, true)}`,
  planet: (g, r) => `<circle cx="50" cy="50" r="20" fill="url(#${r})" ${ST}/><ellipse cx="50" cy="52" rx="38" ry="9" fill="none" stroke="url(#${g})" stroke-width="4" transform="rotate(-14 50 50)"/><ellipse cx="50" cy="52" rx="38" ry="9" fill="none" stroke="${IVORY}" stroke-width=".8" transform="rotate(-14 50 50)"/>`,
  libelle: (g, r) => `<path d="M50 20 L50 86" ${ST} stroke-width="3"/><circle cx="50" cy="20" r="5" fill="url(#${r})" ${ST}/>` + [[-1, 0], [1, 0], [-1, 1], [1, 1]].map(([s, k]) => `<path d="M50 ${32 + k * 10} C${50 + s * 20} ${20 + k * 14} ${50 + s * 40} ${26 + k * 16} ${50 + s * 38} ${36 + k * 14} C${50 + s * 30} ${44 + k * 12} ${50 + s * 14} ${40 + k * 10} 50 ${36 + k * 10}Z" fill="url(#${g})" ${ST} opacity=".85"/>`).join(''),
  wurmloch: (g, r) => Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="50" rx="${36 - i * 5.5}" ry="${26 - i * 4}" transform="rotate(${i * 18} 50 50)" fill="none" stroke="${i % 2 ? GOLD : IVORY}" stroke-width="${1.4 - i * 0.12}"/>`).join('') + `<circle cx="50" cy="50" r="7" fill="url(#${r})"/>`,
  pulsar: (g, r) => `<path d="M50 50 L20 6 L32 6Z M50 50 L80 94 L68 94Z" fill="url(#${g})" opacity=".8"/><circle cx="50" cy="50" r="12" fill="url(#${r})" ${ST}/><circle cx="50" cy="50" r="22" fill="none" stroke="${GOLD}" stroke-dasharray="2 3"/>`,
  schwarzloch: (g, r) => `<ellipse cx="50" cy="52" rx="40" ry="11" fill="none" stroke="url(#${g})" stroke-width="7"/><circle cx="50" cy="50" r="17" fill="${INK}" stroke="${GOLD}" stroke-width="1.5"/><path d="M33 50 A17 17 0 0 1 67 50" stroke="#f6c58a" stroke-width="2.5" fill="none"/><ellipse cx="50" cy="52" rx="40" ry="11" fill="none" stroke="${IVORY}" stroke-width=".6"/>`,
  sternbild: () => { const p = [[22, 30], [40, 22], [58, 34], [74, 24], [64, 56], [44, 70], [26, 60]]; return `<path d="M${p.map(q => q.join(' ')).join(' L')}" stroke="${GOLD}" stroke-width=".9" fill="none" stroke-dasharray="2 2"/>` + p.map(([x, y], i) => star4(x, y, i % 3 ? 4 : 6)).join(''); },
  pfau: (g, r, c1, c2) => Array.from({ length: 7 }, (_, i) => { const a = -150 + i * 20; return `<g transform="rotate(${a + 90} 50 76)"><path d="M50 76 L50 26" stroke="${GOLD}" stroke-width=".8"/><ellipse cx="50" cy="24" rx="7" ry="10" fill="url(#${r})" ${ST}/><circle cx="50" cy="24" r="3" fill="${c2}"/></g>`; }).join('') + `<path d="M44 82 C44 70 56 70 56 82Z" fill="${c1}" ${ST}/>`,
  harfe: (g, r) => `<path d="M26 84 L30 18 C54 14 78 30 74 56 L26 84" fill="none" ${ST} stroke-width="2.4"/>` + [0, 1, 2, 3, 4, 5].map(i => `<line x1="${34 + i * 6}" y1="${22 + i * 2}" x2="${34 + i * 6}" y2="${78 - i * 4}" stroke="${GOLD}" stroke-width=".7"/>`).join('') + whip(70, 58, 1.1, 90),
  quasar: (g, r) => `${halo(50, 50, 22, '#a0b0ff', 16)}<path d="M50 4 L54 50 L50 96 L46 50Z" fill="url(#${g})" opacity=".9"/><ellipse cx="50" cy="50" rx="34" ry="8" fill="url(#${r})" ${ST}/><circle cx="50" cy="50" r="6" fill="${IVORY}"/>`,
  motte: (g, r) => `<path d="M50 24 L50 78" ${ST} stroke-width="3"/><path d="M50 34 C34 14 10 22 14 44 C16 58 36 58 50 48Z M50 34 C66 14 90 22 86 44 C84 58 64 58 50 48Z" fill="url(#${r})" ${ST}/><path d="M50 50 C38 56 26 70 34 80 C42 84 48 70 50 60Z M50 50 C62 56 74 70 66 80 C58 84 52 70 50 60Z" fill="url(#${g})" ${ST}/><circle cx="32" cy="38" r="5" fill="none" stroke="${IVORY}"/><circle cx="68" cy="38" r="5" fill="none" stroke="${IVORY}"/>${whip(46, 24, 0.7, -110)}${whip(54, 24, 0.7, -70, true)}`,
  schrott: (g, r) => `<path d="M26 30 L58 22 L76 44 L62 74 L30 70 L20 48Z" fill="url(#${r})" stroke="#8a7a6a" stroke-width="1"/><path d="M34 40 L50 56 M58 34 L44 62 M28 58 L66 52" stroke="#3a3030" stroke-width="2"/><circle cx="62" cy="62" r="4" fill="none" stroke="#8a7a6a"/>`,
};

/** Motiv eines Symbols als SVG (quadratisch). */
export function symbolSvg(art: string, c1: string, c2: string) {
  const g = gid('g'), r = gid('r');
  const m = MOTIFS[art] ?? MOTIFS.stern;
  const seed = [...art].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return svg('0 0 100 100', `<defs>${lin(g, c2, c1)}${rad(r, c1, c2)}</defs>${halo(50, 50, 40, c1, 28)}${glyphRing(50, 50, 45, seed, 22, CRYSTAL, 0.35)}${m(g, r, c1, c2)}`, 'sym-art');
}

// =========================================================================================== Gegner (Generator nach Archetyp)
export function enemySvg(look: { kind: string; seed: number; hue: number; boss?: string }): string {
  if (look.boss) return bossSvg(look.boss, look.hue, look.seed);
  const R = rng(look.seed * 7919 + 13), h = look.hue;
  const a = hsl(h, 45, 28), b = hsl(h + 25, 60, 62), c = hsl(h - 30, 55, 45);
  const g = gid('eg'), r = gid('er');
  let body = `<defs>${lin(g, b, a)}${rad(r, a, b)}</defs>`;
  const eye = (x: number, y: number, s: number) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s)}" ry="${f1(s * 0.7)}" fill="${IVORY}" stroke="${GOLD}" stroke-width=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.42)}" fill="${CRYSTAL}"/><circle cx="${f1(x - s * 0.15)}" cy="${f1(y - s * 0.15)}" r="${f1(s * 0.14)}" fill="#fff"/>`;
  switch (look.kind) {
    case 'kreatur': {                                   // Motte / Libelle / Käfer mit Ornamentflügeln
      const wings = 1 + Math.floor(R() * 2), span = 30 + R() * 10;
      for (let k = 0; k < wings; k++) {
        const y = 42 + k * 16, sz = span - k * 8;
        body += `<path d="M50 ${y} C${50 - sz} ${y - 26} ${50 - sz - 14} ${y + 6} ${50 - sz / 2} ${y + 14} C${50 - 12} ${y + 18} 48 ${y + 8} 50 ${y}Z" fill="url(#${r})" stroke="${GOLD}" stroke-width=".9"/>`;
        body += `<path d="M50 ${y} C${50 + sz} ${y - 26} ${50 + sz + 14} ${y + 6} ${50 + sz / 2} ${y + 14} C${50 + 12} ${y + 18} 52 ${y + 8} 50 ${y}Z" fill="url(#${r})" stroke="${GOLD}" stroke-width=".9"/>`;
        body += `<circle cx="${50 - sz * 0.62}" cy="${y}" r="${f1(sz * 0.14)}" fill="none" stroke="${IVORY}" stroke-width=".8"/><circle cx="${50 + sz * 0.62}" cy="${y}" r="${f1(sz * 0.14)}" fill="none" stroke="${IVORY}" stroke-width=".8"/>`;
      }
      body += `<ellipse cx="50" cy="56" rx="7" ry="22" fill="url(#${g})" stroke="${GOLD}"/>` + [0, 1, 2, 3].map(i => `<path d="M43 ${52 + i * 7} Q50 ${55 + i * 7} 57 ${52 + i * 7}" stroke="${IVORY}" fill="none" stroke-width=".6"/>`).join('');
      body += `<circle cx="50" cy="32" r="9" fill="url(#${g})" stroke="${GOLD}"/>${eye(46, 31, 3.2)}${eye(54, 31, 3.2)}`;
      body += whip(46, 24, 0.9, -120) + whip(54, 24, 0.9, -60, true);
      if (R() < 0.5) body += `<path d="M44 40 Q50 46 56 40" stroke="${hsl(h + 180, 60, 60)}" fill="none" stroke-width="1.5"/>`;
      break;
    }
    case 'qualle': {
      const n = 5 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const x = 30 + (i * 40) / (n - 1), w = 6 + R() * 6; body += `<path d="M${f1(x)} 50 C${f1(x - w)} 62 ${f1(x + w)} 72 ${f1(x)} 82 C${f1(x - w)} 90 ${f1(x + w / 2)} 94 ${f1(x)} 98" stroke="${i % 2 ? b : GOLD}" stroke-width="${f1(1 + R())}" fill="none" opacity=".85"/>`; }
      body += `<path d="M18 52 C18 22 82 22 82 52 C72 46 62 56 50 50 C38 56 28 46 18 52Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1"/>`;
      body += `<path d="M26 44 C34 32 66 32 74 44" stroke="${IVORY}" fill="none" stroke-width=".7" stroke-dasharray="2 2"/>${eye(42, 40, 4)}${eye(58, 40, 4)}`;
      break;
    }
    case 'auge': {
      const petals = 8 + Math.floor(R() * 6);
      for (let i = 0; i < petals; i++) body += `<path d="M50 50 C44 36 46 22 50 10 C54 22 56 36 50 50Z" transform="rotate(${f1((i * 360) / petals)} 50 50)" fill="url(#${g})" stroke="${GOLD}" stroke-width=".6"/>`;
      body += `<circle cx="50" cy="50" r="20" fill="${a}" stroke="${GOLD}" stroke-width="1.2"/>${eye(50, 50, 14)}`;
      break;
    }
    case 'kristall': {
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const x = 28 + (i * 44) / Math.max(1, n - 1), hh = 30 + R() * 34; body += `<path d="M${f1(x)} ${f1(86 - hh)} L${f1(x + 9)} ${f1(86 - hh * 0.7)} L${f1(x + 6)} 86 L${f1(x - 6)} 86 L${f1(x - 9)} ${f1(86 - hh * 0.7)}Z" fill="url(#${r})" stroke="${IVORY}" stroke-width=".8"/>`; }
      body += `<path d="M50 14 L64 40 L56 86 L44 86 L36 40Z" fill="url(#${g})" stroke="${GOLD}" stroke-width="1.2"/>${eye(50, 44, 5)}`;
      break;
    }
    case 'schwarm': {
      for (let i = 0; i < 14; i++) { const ang = R() * 6.28, d = 8 + R() * 30, x = 50 + Math.cos(ang) * d, y = 50 + Math.sin(ang) * d; body += `<path d="M${f1(x)} ${f1(y)} c-4 -4 -8 0 -6 3 c2 3 6 1 6 -3 c0 -4 4 -6 6 -3 c2 3 -2 7 -6 3Z" fill="url(#${r})" stroke="${GOLD}" stroke-width=".5"/><circle cx="${f1(x)}" cy="${f1(y + 1)}" r="1" fill="${IVORY}"/>`; }
      break;
    }
    case 'mech': {
      body += `<path d="M30 30 C30 18 70 18 70 30 L76 66 C70 80 30 80 24 66Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.2"/>`;
      body += `<path d="M36 34 C42 28 58 28 64 34 L64 46 L36 46Z" fill="${INK}" stroke="${IVORY}" stroke-width=".7"/>${eye(44, 40, 3.2)}${eye(56, 40, 3.2)}`;
      body += `<path d="M24 50 C10 52 8 70 16 78 M76 50 C90 52 92 70 84 78" stroke="${GOLD}" stroke-width="3" fill="none"/>`;
      if (R() < 0.6) body += `<path d="M24 56 C12 60 12 74 20 82 M76 56 C88 60 88 74 80 82" stroke="${b}" stroke-width="2" fill="none"/>`;
      body += whip(50, 62, 1, 90) + whip(50, 62, 1, 90, true);
      break;
    }
    case 'jaeger': {                                   // verhüllte Händler, Schnecken, Kopfgeldjäger (Kantinen-Aliens)
      const variant = Math.floor(R() * 3);
      if (variant === 0) {                              // Kapuze mit Tentakelbart
        body += `<path d="M22 92 C22 50 30 18 50 14 C70 18 78 50 78 92Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.1"/><ellipse cx="50" cy="44" rx="15" ry="17" fill="${INK}"/>${eye(44, 40, 3)}${eye(56, 40, 3)}`;
        for (let i = 0; i < 6; i++) body += `<path d="M${42 + i * 3.2} 52 C${40 + i * 3} 64 ${46 + i * 2} 70 ${42 + i * 3.5} 80" stroke="${b}" stroke-width="1.6" fill="none"/>`;
      } else if (variant === 1) {                       // Schneckenhändler
        body += `<path d="M14 84 C14 62 30 60 44 64 C44 40 56 26 66 30 C78 34 78 52 70 60 C84 64 90 76 86 84Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.1"/><path d="M62 30 L56 12 M70 32 L74 14" stroke="${GOLD}" stroke-width="1.4"/>${eye(56, 12, 3.4)}${eye(74, 14, 3.4)}<path d="M58 48 Q66 54 72 46" stroke="${INK}" fill="none" stroke-width="1.4"/>`;
        body += `<circle cx="30" cy="70" r="12" fill="none" stroke="${GOLD}" stroke-width="1"/><path d="M30 70 m-8 0 a8 8 0 1 0 8 -8 a5 5 0 1 0 5 5" stroke="${IVORY}" fill="none" stroke-width=".8"/>`;
      } else {                                          // Insektoider Jäger mit Helmzangen
        body += `<path d="M30 90 L36 50 C36 30 64 30 64 50 L70 90Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.1"/><path d="M38 24 C30 6 44 2 46 18 M62 24 C70 6 56 2 54 18" stroke="${b}" stroke-width="2" fill="none"/><path d="M36 38 C36 22 64 22 64 38 C64 46 36 46 36 38Z" fill="${INK}" stroke="${GOLD}"/>${eye(43, 36, 4)}${eye(57, 36, 4)}<path d="M44 46 L40 56 M56 46 L60 56" stroke="${GOLD}" stroke-width="1.6"/>`;
      }
      break;
    }
    case 'wurm': {
      let d = 'M14 80';
      for (let i = 0; i < 4; i++) d += ` C${f1(20 + i * 16)} ${i % 2 ? 90 : 40} ${f1(28 + i * 16)} ${i % 2 ? 40 : 90} ${f1(34 + i * 16)} 64`;
      body += `<path d="${d}" stroke="url(#${g})" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${GOLD}" stroke-width="1" fill="none" stroke-dasharray="3 4"/>`;
      body += `<circle cx="80" cy="54" r="13" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.2"/>${eye(76, 50, 3)}${eye(85, 52, 3)}<path d="M72 60 L88 62 L80 68Z" fill="${IVORY}"/>${whip(80, 42, 1, -80)}`;
      break;
    }
  }
  return svg('0 0 100 100', `${halo(50, 52, 44, c, 30)}${body}${inkShade(50, 52, 46)}`, 'foe-art');
}

// =========================================================================================== Bosse (eigene Kompositionen)
function lady(h: number, crown: string, hair: string, extra = '') {
  // Mucha-Figur: Heiligenschein, ovales Gesicht, fließende Haarsträhnen, Krone
  let s = halo(50, 40, 34, hsl(h, 60, 60), 36);
  for (let i = 0; i < 9; i++) { const sx = i - 4; s += `<path d="M50 30 C${50 + sx * 10} 40 ${50 + sx * 14} 70 ${50 + sx * 9} 96" stroke="${hair}" stroke-width="${5 - Math.abs(sx) * 0.6}" fill="none" stroke-linecap="round"/>`; }
  s += `<path d="M38 40 C38 24 62 24 62 40 C62 54 56 62 50 62 C44 62 38 54 38 40Z" fill="${hsl(h + 10, 30, 82)}" stroke="${GOLD}"/>`;
  s += `<path d="M42 41 Q45 39 47 41 M53 41 Q55 39 58 41" stroke="${INK}" stroke-width="1.1" fill="none"/><path d="M47 53 Q50 55 53 53" stroke="#a04a5a" stroke-width="1.2" fill="none"/>`;
  s += crown + extra;
  return s;
}
export function bossSvg(kind: string, h: number, seed: number): string {
  const g = gid('bg'), r = gid('br');
  const a = hsl(h, 45, 25), b = hsl(h + 20, 60, 62);
  let s = `<defs>${lin(g, b, a)}${rad(r, a, b)}</defs>`;
  const eye = (x: number, y: number, k: number, col = hsl(h + 180, 80, 55)) => `<ellipse cx="${x}" cy="${y}" rx="${k}" ry="${k * 0.65}" fill="${IVORY}" stroke="${GOLD}"/><circle cx="${x}" cy="${y}" r="${k * 0.45}" fill="${col}"/>`;
  switch (kind) {
    case 'koenigin': s += lady(h, `<path d="M34 28 L38 12 L44 24 L50 6 L56 24 L62 12 L66 28Z" fill="url(#${r})" stroke="${GOLD}"/>`, hsl(h, 30, 45), `<path d="M18 96 C24 74 40 66 50 66 C60 66 76 74 82 96Z" fill="url(#${r})" stroke="${GOLD}"/>` + [0, 1, 2, 3].map(i => `<circle cx="${30 + i * 13}" cy="${84 - (i % 2) * 6}" r="${4 + (i % 2)}" fill="${hsl(h, 20, 50)}" stroke="${IVORY}" stroke-width=".6"/>`).join('')); break;
    case 'kaiserin': s += lady(h, `<path d="M32 28 C40 10 60 10 68 28" fill="none" stroke="${GOLD}" stroke-width="2"/>` + Array.from({ length: 7 }, (_, i) => star4(32 + i * 6, 22 - Math.sin(i / 6 * Math.PI) * 10, 3.5, '#fff6d8')).join(''), hsl(h + 30, 55, 55), `<path d="M14 96 C20 72 38 64 50 64 C62 64 80 72 86 96Z" fill="url(#${g})" stroke="${GOLD}"/>`); break;
    case 'sternenmutter': s += lady(h, `<circle cx="50" cy="22" r="10" fill="none" stroke="${GOLD}" stroke-width="1.5"/>${star4(50, 22, 7, '#fff2c0')}`, hsl(h + 10, 70, 60), Array.from({ length: 6 }, (_, i) => `<path d="M50 70 C${20 + i * 12} 74 ${10 + i * 16} 88 ${14 + i * 14} 98" stroke="${b}" stroke-width="2.5" fill="none"/>`).join('') + Array.from({ length: 8 }, (_, i) => star4(16 + i * 10, 84 + (i % 3) * 4, 2.5)).join('')); break;
    case 'korsar': s += halo(50, 46, 40, hsl(h, 50, 50)) + `<path d="M12 90 C12 66 30 62 44 66 C44 42 58 30 68 34 C82 38 82 58 72 64 C88 68 94 82 88 92Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.2"/><path d="M52 34 L48 22 L88 24 L80 34Z" fill="${INK}" stroke="${GOLD}"/>${star4(66, 27, 4, GOLD)}<path d="M60 34 L56 16 M74 36 L80 18" stroke="${GOLD}" stroke-width="1.4"/>${eye(56, 16, 4)}${eye(80, 18, 4)}<path d="M58 52 Q68 60 76 50" stroke="${INK}" stroke-width="1.6" fill="none"/>` + whip(30, 74, 1.4, 0); break;
    case 'frostwyrm': s += halo(50, 50, 42, '#9fd0e0') + `<path d="M10 80 C24 40 44 96 58 60 C66 40 80 50 74 30" stroke="url(#${g})" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M10 80 C24 40 44 96 58 60 C66 40 80 50 74 30" stroke="${IVORY}" stroke-width="1" fill="none" stroke-dasharray="2 4"/><path d="M64 24 C70 8 84 8 88 22 C90 34 78 40 70 34Z" fill="url(#${r})" stroke="${GOLD}"/>${eye(78, 22, 3.5, '#5fd0ff')}` + [0, 1, 2, 3, 4].map(i => `<path d="M${66 + i * 4} 16 L${64 + i * 5} ${4 + i}" stroke="#dff4ff" stroke-width="1.6"/>`).join(''); break;
    case 'kathedrale': s += halo(50, 46, 42, '#a8e0d8') + `<path d="M22 92 L22 40 C22 14 50 4 50 4 C50 4 78 14 78 40 L78 92Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.4"/>` + [0, 1, 2].map(i => `<path d="M${30 + i * 14} 88 L${30 + i * 14} 50 C${30 + i * 14} 40 ${40 + i * 14} 40 ${40 + i * 14} 50 L${40 + i * 14} 88" fill="${hsl(h + i * 40, 60, 60, 0.7)}" stroke="${IVORY}"/>`).join('') + `<circle cx="50" cy="28" r="9" fill="${IVORY}" stroke="${GOLD}"/>` + Array.from({ length: 8 }, (_, i) => `<line x1="50" y1="28" x2="${f1(50 + Math.cos(i * 0.785) * 9)}" y2="${f1(28 + Math.sin(i * 0.785) * 9)}" stroke="${GOLD}" stroke-width=".7"/>`).join('') + eye(50, 28, 4); break;
    case 'orionjaeger': s += halo(50, 44, 40, hsl(h, 60, 55)) + `<path d="M30 94 L36 50 C36 30 64 30 64 50 L70 94Z" fill="url(#${r})" stroke="${GOLD}"/><path d="M40 30 C26 4 18 20 30 26 M60 30 C74 4 82 20 70 26 M36 22 C28 14 22 18 26 24 M64 22 C72 14 78 18 74 24" stroke="${GOLD}" stroke-width="2" fill="none"/><path d="M38 40 C38 26 62 26 62 40 C62 50 38 50 38 40Z" fill="${INK}" stroke="${GOLD}"/>${eye(44, 38, 4)}${eye(56, 38, 4)}<path d="M14 20 C2 50 2 70 14 96 M14 20 L14 96" stroke="${IVORY}" stroke-width="1.6" fill="none"/>`; break;
    case 'leuchtfeuer': s += `<path d="M50 30 L6 0 L0 10Z M50 30 L94 0 L100 10Z" fill="#fff2b0" opacity=".45"/>` + halo(50, 30, 22, '#ffe080') + `<path d="M36 96 L42 40 L58 40 L64 96Z" fill="url(#${r})" stroke="${GOLD}"/>` + [0, 1, 2].map(i => `<path d="M${40 + i} ${54 + i * 14} H${60 - i}" stroke="${IVORY}" stroke-width="2"/>`).join('') + `<circle cx="50" cy="30" r="12" fill="#fff6d0" stroke="${GOLD}" stroke-width="1.5"/>${eye(50, 30, 7, '#e0a020')}`; break;
    case 'magnetar': s += Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="50" rx="${16 + i * 6}" ry="${40 - i * 3}" fill="none" stroke="${i % 2 ? GOLD : b}" stroke-width=".9" transform="rotate(${-20 + i * 8} 50 50)"/>`).join('') + `<path d="M26 60 C20 30 40 18 50 18 C60 18 80 30 74 60 C70 78 30 78 26 60Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.3"/>${eye(40, 46, 6)}${eye(60, 46, 6)}<path d="M36 64 L42 58 L48 66 L54 58 L60 66 L64 60" stroke="${IVORY}" stroke-width="1.5" fill="none"/>`; break;
    case 'gargantua': s += `<ellipse cx="50" cy="54" rx="48" ry="14" fill="none" stroke="url(#${g})" stroke-width="10"/><circle cx="50" cy="50" r="24" fill="#05030a" stroke="${GOLD}" stroke-width="2"/><path d="M26 50 A24 24 0 0 1 74 50" stroke="#f6c58a" stroke-width="4" fill="none"/>` + Array.from({ length: 10 }, (_, i) => { const an = i * 0.628; return eye(50 + Math.cos(an) * 36, 50 + Math.sin(an) * 30, 3, '#ff7a3a'); }).join('') + `<ellipse cx="50" cy="54" rx="48" ry="14" fill="none" stroke="${IVORY}" stroke-width=".7"/>`; break;
    case 'uhrmacher': s += halo(50, 48, 42, '#e0c080', 60) + `<circle cx="50" cy="48" r="28" fill="url(#${r})" stroke="${GOLD}" stroke-width="2"/>` + Array.from({ length: 12 }, (_, i) => `<line x1="${f1(50 + Math.cos(i * 0.5236) * 23)}" y1="${f1(48 + Math.sin(i * 0.5236) * 23)}" x2="${f1(50 + Math.cos(i * 0.5236) * 27)}" y2="${f1(48 + Math.sin(i * 0.5236) * 27)}" stroke="${IVORY}" stroke-width="1.5"/>`).join('') + `<path d="M50 48 L50 30 M50 48 L62 54" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>${eye(50, 48, 5)}` + [-1, 1].map(s2 => `<path d="M${50 + s2 * 28} 40 C${50 + s2 * 44} 30 ${50 + s2 * 46} 60 ${50 + s2 * 40} 74 M${50 + s2 * 28} 58 C${50 + s2 * 40} 66 ${50 + s2 * 36} 84 ${50 + s2 * 30} 92" stroke="${GOLD}" stroke-width="2.4" fill="none"/>`).join(''); break;
    case 'sagittarius': s += Array.from({ length: 5 }, (_, i) => `<path d="M50 50 C${50 + 30} ${50 - 10 - i * 4} ${50 + 10 + i * 6} ${50 - 40} 50 ${8 + i * 3}" stroke="${i % 2 ? GOLD : b}" stroke-width="1.6" fill="none" transform="rotate(${i * 72} 50 50)"/>`).join('') + halo(50, 50, 16, '#ffd0a0') + `<circle cx="50" cy="50" r="12" fill="url(#${r})" stroke="${GOLD}"/>${eye(50, 50, 6, '#ff4060')}`; break;
    case 'architekt': s += `<path d="M50 4 L92 50 L50 96 L8 50Z" fill="none" stroke="${GOLD}" stroke-width="1"/><path d="M50 14 L82 50 L50 86 L18 50Z" fill="none" stroke="${b}" stroke-width=".6"/>` + `<path d="M30 96 L36 46 C36 24 64 24 64 46 L70 96Z" fill="#14101e" stroke="${GOLD}" stroke-width="1.3"/><path d="M38 30 C40 16 60 16 62 30 L62 50 C58 60 42 60 38 50Z" fill="${IVORY}" stroke="${GOLD}" stroke-width="1.2"/><path d="M42 38 L47 38 M53 38 L58 38" stroke="${INK}" stroke-width="2.5"/><path d="M50 42 L50 54" stroke="${GOLD}"/>` + Array.from({ length: 9 }, (_, i) => star4(14 + i * 9, 92 - Math.abs(4 - i) * 8, 2, '#8a80b0')).join(''); break;
    default: return enemySvg({ kind: 'auge', seed, hue: h });
  }
  return svg('0 0 100 100', `${glyphRing(50, 50, 47, seed, 30, CRYSTAL, 0.6)}${s}${inkShade(50, 50, 48)}`, 'foe-art boss-art');
}

// =========================================================================================== Porträts (Figuren der Geschichte)
export function portraitSvg(id: string) {
  const g = gid('pg'), r = gid('pr');
  let s = '';
  const frame = (h: number) => `<defs>${lin(g, hsl(h, 50, 35), hsl(h, 50, 14))}${rad(r, hsl(h, 50, 30), hsl(h + 20, 60, 65))}</defs><rect x="0" y="0" width="100" height="120" fill="url(#${g})"/>${halo(50, 46, 34, hsl(h, 60, 60), 30)}`;
  const eye = (x: number, y: number, k: number, col: string) => `<ellipse cx="${x}" cy="${y}" rx="${k}" ry="${k * 0.7}" fill="${IVORY}"/><circle cx="${x}" cy="${y}" r="${k * 0.5}" fill="${col}"/>`;
  switch (id) {
    case 'ozzo': s = frame(90) + `<path d="M10 120 C10 90 26 84 40 88 C38 60 52 44 64 48 C80 52 80 74 70 82 C88 86 96 100 92 120Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.2"/><path d="M58 48 L50 24 M72 52 L80 28" stroke="${GOLD}" stroke-width="1.8"/>${eye(50, 22, 5, '#6a3')}${eye(80, 26, 5, '#6a3')}<path d="M54 68 Q66 78 76 66" stroke="${INK}" stroke-width="2" fill="none"/><circle cx="40" cy="104" r="6" fill="${GOLD}"/>${whip(20, 110, 1.6, -30)}`; break;
    case 'vael': s = frame(280) + `<path d="M50 52 C26 20 0 34 6 62 C10 82 36 80 50 66Z M50 52 C74 20 100 34 94 62 C90 82 64 80 50 66Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.1"/><circle cx="22" cy="54" r="7" fill="none" stroke="${IVORY}"/><circle cx="78" cy="54" r="7" fill="none" stroke="${IVORY}"/><path d="M40 52 C40 38 60 38 60 52 C60 64 54 70 50 70 C46 70 40 64 40 52Z" fill="#e8dcef" stroke="${GOLD}"/>${eye(45, 52, 3.4, '#9a6ad0')}${eye(55, 52, 3.4, '#9a6ad0')}${whip(44, 38, 1, -110)}${whip(56, 38, 1, -70, true)}<path d="M30 120 C34 92 44 84 50 84 C56 84 66 92 70 120Z" fill="#3a2a50" stroke="${GOLD}"/>`; break;
    case 'kassik': s = frame(150) + `<path d="M28 120 L34 70 C34 44 66 44 66 70 L72 120Z" fill="url(#${r})" stroke="${GOLD}"/><path d="M38 40 C28 16 44 8 46 28 M62 40 C72 16 56 8 54 28" stroke="#9ad0a0" stroke-width="2.2" fill="none"/><path d="M34 54 C34 34 66 34 66 54 C66 66 34 66 34 54Z" fill="${INK}" stroke="${GOLD}"/>${eye(43, 52, 5, '#e05050')}${eye(57, 52, 5, '#e05050')}<path d="M44 64 L38 78 M56 64 L62 78" stroke="${GOLD}" stroke-width="2"/>`; break;
    case 'brakk': s = frame(20) + `<path d="M24 120 C24 88 36 76 50 76 C64 76 76 88 76 120Z" fill="url(#${r})" stroke="${GOLD}"/>` + [[-1, 0], [1, 0], [-1, 1], [1, 1]].map(([sx, k]) => `<path d="M${50 + sx * 20} ${88 + k * 12} C${50 + sx * 38} ${82 + k * 12} ${50 + sx * 44} ${100 + k * 8} ${50 + sx * 40} ${112 + k * 4}" stroke="${hsl(20, 40, 50)}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('') + `<path d="M34 52 C34 34 66 34 66 52 C66 70 58 78 50 78 C42 78 34 70 34 52Z" fill="${hsl(20, 35, 55)}" stroke="${GOLD}"/>${eye(43, 52, 4, '#2a6')}${eye(57, 52, 4, '#2a6')}<path d="M40 66 Q50 72 60 66" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M36 40 L64 40" stroke="${GOLD}" stroke-width="3"/>`; break;
    case 'sola': s = frame(320) + `<path d="M24 120 C24 74 34 44 50 40 C66 44 76 74 76 120Z" fill="url(#${r})" stroke="${GOLD}"/><ellipse cx="50" cy="56" rx="14" ry="16" fill="#e9c8d8" stroke="${GOLD}"/>${eye(45, 52, 3, '#c03070')}${eye(55, 52, 3, '#c03070')}` + Array.from({ length: 7 }, (_, i) => `<path d="M${42 + i * 2.6} 64 C${38 + i * 3} 78 ${46 + i * 2} 86 ${40 + i * 3.4} 98" stroke="#d07aa0" stroke-width="1.8" fill="none"/>`).join('') + star4(50, 30, 6, GOLD); break;
    case 'architekt': return svg('0 0 100 120', frame(260) + bossSvg('architekt', 260, 1).replace(/^<svg[^>]*>|<\/svg>$/g, ''), 'portrait');
    case 'herz': s = frame(40) + halo(50, 56, 26, '#ffd070', 40) + `<circle cx="50" cy="56" r="18" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.5"/>${star4(50, 56, 12, '#fff6d8')}` + [0, 1, 2, 3].map(i => `<path d="M${30 + i * 14} 96 C${32 + i * 12} 84 ${40 + i * 6} 80 50 76" stroke="${GOLD}" stroke-width="1" fill="none"/>`).join(''); break;
    default: s = frame(30) + `<path d="M26 120 C26 86 38 78 50 78 C62 78 74 86 74 120Z" fill="#2a3a5a" stroke="${GOLD}"/><path d="M36 54 C36 36 64 36 64 54 C64 70 56 78 50 78 C44 78 36 70 36 54Z" fill="#e8c8a8" stroke="${GOLD}"/><path d="M34 52 C30 30 70 26 68 52 C64 40 40 38 34 52Z" fill="#5a3020"/>${eye(44, 56, 3, '#3a6a9a')}${eye(56, 56, 3, '#3a6a9a')}<path d="M45 68 Q50 70 55 68" stroke="#a05050" fill="none"/><path d="M30 44 C24 34 32 26 38 34" stroke="${GOLD}" fill="none"/>`; break;
  }
  return svg('0 0 100 120', s, 'portrait');
}

// =========================================================================================== Schiffe
export function shipSvg(hull: string, hue: number) {
  const g = gid('sg'), r = gid('sr');
  const a = hsl(hue, 45, 30), b = hsl(hue + 20, 55, 64);
  let s = `<defs>${lin(g, b, a, 1, 0)}${rad(r, a, b)}</defs>`;
  const glow = `<ellipse cx="18" cy="50" rx="12" ry="5" fill="#ffd27a" opacity=".7"/>`;
  switch (hull) {
    case 'forscher': s += glow + `<path d="M20 50 C30 30 70 26 90 50 C70 74 30 70 20 50Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.3"/><circle cx="62" cy="50" r="12" fill="none" stroke="${GOLD}" stroke-width="1.2"/><circle cx="62" cy="50" r="7" fill="none" stroke="${IVORY}" stroke-dasharray="2 2"/><path d="M62 38 L62 22 M62 62 L62 78" stroke="${GOLD}"/>`; break;
    case 'phantom': s += glow + `<path d="M24 50 C40 18 76 14 92 50 C76 86 40 82 24 50Z" fill="url(#${r})" stroke="${GOLD}"/><path d="M50 50 C36 20 14 26 18 44 M50 50 C36 80 14 74 18 56" fill="${b}" opacity=".5" stroke="${GOLD}"/><circle cx="74" cy="50" r="5" fill="${IVORY}"/>`; break;
    case 'titan': s += glow + `<path d="M16 38 L80 34 L94 50 L80 66 L16 62Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.4"/><path d="M30 34 L36 18 L56 18 L60 34 M30 66 L36 82 L56 82 L60 66" fill="${a}" stroke="${GOLD}"/><circle cx="70" cy="50" r="6" fill="${IVORY}"/>`; break;
    case 'singular': s += glow + `<path d="M22 50 C34 26 76 26 88 50 C76 74 34 74 22 50Z" fill="url(#${r})" stroke="${GOLD}"/>` + [0, 1, 2].map(i => `<ellipse cx="66" cy="50" rx="${12 - i * 3.5}" ry="${8 - i * 2.4}" fill="none" stroke="${i % 2 ? IVORY : GOLD}"/>`).join(''); break;
    default: s += glow + `<path d="M18 50 C28 36 60 30 92 50 C60 70 28 64 18 50Z" fill="url(#${r})" stroke="${GOLD}" stroke-width="1.3"/><path d="M40 42 C34 22 52 18 58 38 M40 58 C34 78 52 82 58 62" fill="${a}" stroke="${GOLD}"/><circle cx="72" cy="50" r="6" fill="#fff2c0" stroke="${GOLD}"/>${whip(50, 50, 0.8, 0)}`; break;
  }
  return svg('0 0 100 100', s, 'ship-art');
}

/** Ornamentale Trennlinie (Jugendstil). */
export function ornament(w = 200) {
  return svg(`0 0 ${w} 20`, `<path d="M0 10 H${w / 2 - 22} M${w / 2 + 22} 10 H${w}" stroke="${GOLD}" stroke-width=".8"/>${whip(w / 2 - 8, 10, 0.8, 180)}${whip(w / 2 + 8, 10, 0.8, 0, true)}${star4(w / 2, 10, 5, GOLD)}`, 'ornament');
}

/** Dekorativer Hintergrund je Sektor-Thema (Kacheln aus Sternblüten, als Daten-URL für CSS). */
export function sectorPattern(theme: string, c1: string) {
  const R = rng(theme.length * 977);
  let s = '';
  for (let i = 0; i < 14; i++) s += star4(R() * 200, R() * 200, 1 + R() * 3, i % 4 ? IVORY : GOLD, 0.25 + R() * 0.4);
  s += whip(30, 170, 2.2, -30, false, c1, 0.8) + whip(170, 40, 2, 150, true, c1, 0.8);
  return `url("data:image/svg+xml,${encodeURIComponent(svg('0 0 200 200', s))}")`;
}
