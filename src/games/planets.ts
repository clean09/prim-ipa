// Himmelskörper für die Spiele: prozedural gezeichnete Planeten, Monde, Asteroiden und Sonnen.
// Jedes Objekt bekommt ein eigenes Aussehen (Art, Farbe, Muster, Ringe, Begleitmonde). Die Art richtet sich nach der
// GRÖSSE der Zahl (kleine Zahlen = Asteroiden/Monde, große = Gas- und Ringriesen) – nie danach, ob sie prim ist.
// Jede Variante wird einmal als Sprite vorgerendert und danach nur noch skaliert/gedreht gezeichnet.

export type PlanetKind = 'asteroid' | 'moon' | 'rocky' | 'desert' | 'ice' | 'lava' | 'earth' | 'ocean' | 'toxic' | 'crystal' | 'gas' | 'ringed' | 'sun';
export interface PlanetLook { kind: PlanetKind; seed: number; hue: number; tilt: number; spin: number; rings: boolean; moons: number; ringHue: number }

const S = 128;                                  // Sprite-Radius in Pixeln
const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 160;

/** Arten je Zahlengröße (Stellen). */
function kindsFor(digits: number): PlanetKind[] {
  if (digits <= 1) return ['asteroid', 'moon', 'asteroid'];
  if (digits === 2) return ['moon', 'rocky', 'ice', 'asteroid', 'desert'];
  if (digits === 3) return ['rocky', 'desert', 'earth', 'lava', 'ice', 'ocean'];
  if (digits === 4) return ['earth', 'ocean', 'toxic', 'gas', 'lava', 'crystal'];
  if (digits === 5) return ['gas', 'ringed', 'toxic', 'crystal', 'ocean'];
  return ['ringed', 'gas', 'crystal', 'ringed'];
}

/** Grundfarbtöne je Art (Hue-Bereich, Sättigung, Helligkeit). */
const PALETTE: Record<PlanetKind, [number, number, number, number]> = {
  asteroid: [20, 40, 18, 42], moon: [200, 60, 6, 70], rocky: [5, 35, 55, 50], desert: [28, 45, 60, 62], ice: [180, 215, 70, 82],
  lava: [8, 25, 90, 50], earth: [195, 215, 70, 55], ocean: [185, 230, 75, 50], toxic: [70, 120, 70, 50], crystal: [260, 320, 70, 62],
  gas: [15, 45, 55, 62], ringed: [30, 60, 50, 70], sun: [40, 45, 100, 60],
};

let counter = 1;
/** Aussehen für eine neue Zahl. */
export function lookFor(label: string, rnd: () => number = Math.random): PlanetLook {
  const ks = kindsFor(label.length);
  const kind = ks[Math.floor(rnd() * ks.length)];
  const [h0, h1] = PALETTE[kind];
  const hue = h0 + rnd() * (h1 - h0) + (kind === 'gas' && rnd() < 0.35 ? 180 : 0);   // manche Gasriesen bläulich (wie Neptun)
  const big = label.length >= 4;
  return {
    kind, seed: (counter++ * 2654435761) >>> 0, hue: Math.round(hue / 6) * 6, tilt: (rnd() - 0.5) * 1.1, spin: (rnd() - 0.5) * 0.3,
    rings: kind === 'ringed' || (big && kind !== 'earth' && rnd() < 0.18), moons: big ? (rnd() < 0.45 ? 1 + Math.floor(rnd() * 2) : 0) : 0, ringHue: Math.round(rnd() * 360),
  };
}
export const SUN_LOOK: PlanetLook = { kind: 'sun', seed: 1, hue: 42, tilt: 0, spin: 0.2, rings: false, moons: 0, ringHue: 0 };
/** Abwärtskompatibel: zufälliges Aussehen mittlerer Größe. */
export const randomLook = (rnd: () => number = Math.random) => lookFor('123', rnd);

export function lookColor(l: PlanetLook): string {
  const [, , s, li] = PALETTE[l.kind];
  return `hsl(${l.hue},${s}%,${Math.min(70, li + 8)}%)`;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function sprite(l: PlanetLook): HTMLCanvasElement {
  // nur ein paar Dutzend Muster je Art (Seed modulo), Farbe in 6°-Schritten → begrenzter Speicher
  const variant = l.seed % 6;
  const key = `${l.kind}|${variant}|${l.hue}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  const c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d')!;
  const r = rng(l.seed % 6 * 7919 + l.kind.length * 131);
  const [, , sat, lig] = PALETTE[l.kind];
  const H = l.hue;
  g.translate(S, S);

  // unregelmäßige Form für Asteroiden
  g.save();
  g.beginPath();
  if (l.kind === 'asteroid') {
    const pts = 14;
    for (let i = 0; i <= pts; i++) { const a = (i / pts) * 6.28, d = S * (0.78 + r() * 0.22); i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
  } else g.arc(0, 0, S, 0, Math.PI * 2);
  g.clip();

  const blobs = (n: number, col: () => string, min: number, max: number) => {
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * S, rr = min + r() * (max - min);
      g.fillStyle = col(); g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rr, rr * (0.55 + r() * 0.45), r() * 3, 0, 6.28); g.fill();
    }
  };
  const craters = (n: number, min: number, max: number) => {
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * S * 0.92, rr = min + r() * (max - min), x = Math.cos(a) * d, y = Math.sin(a) * d;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x, y, rr, 0, 6.28); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = rr * 0.18; g.beginPath(); g.arc(x - rr * 0.08, y - rr * 0.08, rr, Math.PI * 0.9, Math.PI * 1.8); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + rr * 0.06, y + rr * 0.06, rr, -0.2, Math.PI * 0.75); g.stroke();
    }
  };
  const bands = (count: number, wav: number) => {
    for (let i = 0; i < count; i++) {
      const y = -S + (i / count) * 2 * S, hgt = ((2 * S) / count) * (0.6 + r() * 0.9);
      g.fillStyle = r() < 0.5 ? hsl(H + (r() - 0.5) * 30, sat, lig + 12 + r() * 10, 0.5) : hsl(H + (r() - 0.5) * 30, sat, lig - 15 - r() * 10, 0.45);
      g.beginPath(); g.moveTo(-S, y);
      const f = 10 + r() * 14, ph = r() * 6;
      for (let x = -S; x <= S; x += 6) g.lineTo(x, y + Math.sin(x / f + ph) * wav);
      g.lineTo(S, y + hgt); g.lineTo(-S, y + hgt); g.closePath(); g.fill();
    }
  };

  g.fillStyle = hsl(H, sat, lig); g.fillRect(-S, -S, 2 * S, 2 * S);
  switch (l.kind) {
    case 'asteroid': blobs(20, () => hsl(H, sat, lig + (r() - 0.5) * 20, 0.6), S * 0.1, S * 0.35); craters(9, S * 0.06, S * 0.2); break;
    case 'moon': blobs(14, () => hsl(H, sat, lig - 8 - r() * 12, 0.5), S * 0.15, S * 0.45); craters(16 + Math.floor(r() * 10), S * 0.04, S * 0.2); break;
    case 'rocky': blobs(26, () => (r() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)'), S * 0.15, S * 0.5); craters(6 + Math.floor(r() * 10), S * 0.05, S * 0.16); break;
    case 'desert': bands(7, 6); blobs(18, () => hsl(H - 8, sat, lig - 12, 0.35), S * 0.12, S * 0.4); craters(4, S * 0.05, S * 0.12); break;
    case 'ice': {
      blobs(18, () => `rgba(255,255,255,${0.15 + r() * 0.25})`, S * 0.15, S * 0.45);
      g.strokeStyle = hsl(H + 10, 60, 40, 0.4); g.lineWidth = 2.5;
      for (let i = 0; i < 9; i++) { g.beginPath(); let x = (r() - 0.5) * 2 * S, y = (r() - 0.5) * 2 * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * S * 0.5; y += (r() - 0.5) * S * 0.5; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(0, -S * 0.95, S * (0.5 + r() * 0.4), S * 0.28, 0, 0, 6.28); g.fill();
      break;
    }
    case 'lava': {
      g.fillStyle = '#2a1410'; g.fillRect(-S, -S, 2 * S, 2 * S);
      blobs(20, () => `rgba(${70 + r() * 40},${30 + r() * 20},20,.7)`, S * 0.15, S * 0.5);
      g.lineCap = 'round';
      for (let i = 0; i < 10 + r() * 8; i++) {
        g.strokeStyle = r() < 0.5 ? hsl(H + 10, 100, 58) : hsl(H + 30, 100, 65); g.lineWidth = 2 + r() * 4; g.shadowColor = hsl(H, 100, 50); g.shadowBlur = 12;
        g.beginPath(); let x = (r() - 0.5) * 2 * S, y = (r() - 0.5) * 2 * S; g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (r() - 0.5) * S * 0.6; y += (r() - 0.5) * S * 0.6; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
      break;
    }
    case 'earth': case 'ocean': {
      const land = l.kind === 'earth' ? 8 + Math.floor(r() * 4) : 3 + Math.floor(r() * 3);
      blobs(land, () => (r() < 0.7 ? `rgba(${60 + r() * 40},${130 + r() * 60},${60 + r() * 30},.95)` : 'rgba(176,146,96,.9)'), S * 0.15, S * (l.kind === 'earth' ? 0.55 : 0.28));
      blobs(10 + Math.floor(r() * 10), () => `rgba(255,255,255,${0.3 + r() * 0.4})`, S * 0.06, S * 0.28);
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(0, -S * 0.97, S * 0.6, S * 0.2, 0, 0, 6.28); g.fill();
      break;
    }
    case 'toxic': bands(10, 8); blobs(10, () => hsl(H + 40, 90, 60, 0.35), S * 0.1, S * 0.35); break;
    case 'crystal': {
      for (let i = 0; i < 26; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * S, rr = S * (0.08 + r() * 0.2), x = Math.cos(a) * d, y = Math.sin(a) * d;
        g.fillStyle = hsl(H + (r() - 0.5) * 50, 80, 55 + r() * 30, 0.55);
        g.beginPath(); for (let k = 0; k < 6; k++) { const b = (k / 6) * 6.28 + r() * 0.4; k ? g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr) : g.moveTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); } g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
      }
      break;
    }
    case 'gas': case 'ringed': {
      bands(9 + Math.floor(r() * 7), 3 + r() * 4);
      if (r() < 0.7) { g.fillStyle = hsl(H + 15, sat + 20, lig - 20, 0.55); g.beginPath(); g.ellipse(S * (r() - 0.5), S * (r() - 0.3), S * (0.15 + r() * 0.15), S * (0.08 + r() * 0.06), 0, 0, 6.28); g.fill(); g.strokeStyle = 'rgba(255,240,220,.35)'; g.lineWidth = 3; g.stroke(); }
      break;
    }
    case 'sun': {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, S);
      gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.5, '#ffd25a'); gr.addColorStop(1, '#ff8a1f');
      g.fillStyle = gr; g.fillRect(-S, -S, 2 * S, 2 * S);
      blobs(40, () => `rgba(255,${120 + r() * 80},0,${0.15 + r() * 0.2})`, S * 0.05, S * 0.15);
      break;
    }
  }
  // Licht von oben links: Tag-/Nachtseite + Glanz
  if (l.kind !== 'sun') {
    const sh = g.createRadialGradient(-S * 0.45, -S * 0.45, S * 0.1, -S * 0.1, -S * 0.1, S * 1.55);
    sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, 'rgba(0,0,10,.55)'); sh.addColorStop(1, 'rgba(0,0,10,.8)');
    g.fillStyle = sh; g.fillRect(-S, -S, 2 * S, 2 * S);
  }
  g.restore();
  cache.set(key, c);
  return c;
}

/** Ringe: hintere Hälfte vor dem Planeten, vordere danach zeichnen. */
function drawRings(g: CanvasRenderingContext2D, r: number, l: PlanetLook, front: boolean) {
  g.save();
  g.rotate(l.tilt);
  g.beginPath();
  if (front) g.rect(-r * 3, 0, r * 6, r * 3); else g.rect(-r * 3, -r * 3, r * 6, r * 3);
  g.clip();
  const h = l.kind === 'ringed' ? l.hue + 10 : l.ringHue;
  for (const [k, a, li] of [[1.35, 0.55, 75], [1.5, 0.35, 62], [1.66, 0.6, 80], [1.8, 0.25, 68]] as [number, number, number][]) {
    g.strokeStyle = hsl(h, 35, li); g.globalAlpha = a; g.lineWidth = r * 0.13;
    g.beginPath(); g.ellipse(0, 0, r * k, r * k * 0.26, 0, 0, 6.28); g.stroke();
  }
  g.restore();
}

export interface DrawOpts { now: number; scale?: number; wrong?: boolean }

/** Himmelskörper mit Zahl zeichnen. */
export function drawPlanet(g: CanvasRenderingContext2D, x: number, y: number, r: number, look: PlanetLook, label: string, o: DrawOpts) {
  const R = r * (o.scale ?? 1);
  g.save();
  g.translate(x, y);
  const sun = look.kind === 'sun';
  // Atmosphäre / Korona
  const aura = g.createRadialGradient(0, 0, R * 0.85, 0, 0, R * (sun ? 1.8 : 1.3));
  const ac = sun ? 'rgba(255,200,80,' : o.wrong ? 'rgba(255,60,60,' : look.kind === 'lava' ? 'rgba(255,110,40,' : look.kind === 'toxic' ? 'rgba(150,255,90,' : look.kind === 'crystal' ? 'rgba(200,140,255,' : ['earth', 'ocean', 'ice'].includes(look.kind) ? 'rgba(120,200,255,' : 'rgba(255,255,255,';
  aura.addColorStop(0, ac + (sun ? '.7)' : o.wrong ? '.6)' : look.kind === 'asteroid' ? '.05)' : '.22)')); aura.addColorStop(1, ac + '0)');
  g.fillStyle = aura; g.beginPath(); g.arc(0, 0, R * (sun ? 1.8 : 1.3), 0, 6.28); g.fill();
  // Begleitmonde (hinter dem Planeten, wenn sie „hinten“ sind)
  const moonPos = (i: number) => { const a = o.now / (1400 + i * 700) + i * 2.4; return [Math.cos(a) * R * (1.45 + i * 0.25), Math.sin(a) * R * 0.35, Math.sin(a)] as const; };
  const drawMoon = (i: number) => { const [mx, my] = moonPos(i); const mr = R * (0.16 - i * 0.03); const gr = g.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(1, '#6b6f7a'); g.fillStyle = gr; g.beginPath(); g.arc(mx, my, mr, 0, 6.28); g.fill(); };
  for (let i = 0; i < look.moons; i++) if (moonPos(i)[2] < 0) drawMoon(i);
  if (look.rings) drawRings(g, R, look, false);
  g.save();
  g.rotate(look.spin * o.now / 1000);
  g.drawImage(sprite(look), -R, -R, 2 * R, 2 * R);
  g.restore();
  if (sun) { g.strokeStyle = `rgba(255,230,140,${0.5 + 0.4 * Math.sin(o.now / 140)})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R + 4 + 3 * Math.sin(o.now / 200), 0, 6.28); g.stroke(); }
  if (look.rings) drawRings(g, R, look, true);
  for (let i = 0; i < look.moons; i++) if (moonPos(i)[2] >= 0) drawMoon(i);
  if (o.wrong) { g.fillStyle = 'rgba(255,40,40,.35)'; g.beginPath(); g.arc(0, 0, R, 0, 6.28); g.fill(); }
  // Zahl: weiß mit dunkler Kontur – auf jedem Untergrund lesbar
  if (label) {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const draw = (t: string, dy: number, fs: number) => {
      g.font = `900 ${fs}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, fs * 0.22); g.strokeStyle = 'rgba(5,8,20,.85)'; g.strokeText(t, 0, dy);
      g.fillStyle = '#fff'; g.fillText(t, 0, dy);
    };
    const s = o.scale ?? 1;
    if (label.length <= 9) draw(label, 2, Math.max(14, Math.min(R * 0.62, 28 - label.length * 1.2) * s));
    else { const half = Math.ceil(label.length / 2), fs = Math.max(11, 17 - Math.floor(label.length / 6)); draw(label.slice(0, half), -fs * 0.55, fs); draw(label.slice(half), fs * 0.6, fs); }
  }
  g.restore();
}
