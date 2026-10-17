// Sternentwicklung – Port von PrimSieb/StarLife/StellarModel.cs (Desktop). Innen steuert Außen: R, T, L werden aus
// dem Lebensweg im HR-Diagramm abgeleitet, Farbe/Oberfläche daraus in render.ts.

export enum El { H, He, C, N, O, Ne, Mg, Si, S, Fe }
export type Look = 'Cloud' | 'Proto' | 'Star' | 'Flash' | 'Nebula' | 'WhiteDwarf' | 'BrownDwarf' | 'Supernova'
  | 'NeutronStar' | 'Magnetar' | 'BlackHole' | 'Nothing' | 'Collapse';

export interface Shell { massFrac: number; main: El; label: string; burning: boolean }
const sh = (massFrac: number, main: El, label: string, burning: boolean): Shell => ({ massFrac, main, label, burning });
type P = [number, number, number];

export class Segment {
  name = ''; text = ''; core = ''; shellBurn = '';
  years = 0; t0 = 0;
  path: P[] = [];
  m0 = 0; m1 = 0; tc0 = 0; tc1 = 0; rho0 = 0; rho1 = 0;
  core0 = new Array(10).fill(0); core1 = new Array(10).fill(0);
  reactions: string[] = [];
  onion: Shell[] = [];
  look: Look = 'Star';
  rFixed = -1;
  pulse = 0;
  weight = 1;
  event = false;
  group = 0;
}

export interface StarState {
  age: number; L: number; T: number; R: number; M: number; Tc: number; Rho: number; prog: number;
  core: number[]; onion: Shell[]; pulse: number; seg: number;
}

// ---------------------------------------------------------------------------------------------- Glättung (Smooth.cs)
export const step = (e0: number, e1: number, x: number) => {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  if (x <= e0) return 0; if (x >= e1) return 1;
  const t = (x - e0) / (e1 - e0); return t * t * (3 - 2 * t);
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function slopes(x: number[], y: number[]) {
  const n = x.length, m = new Array(n).fill(0), d: number[] = [], h: number[] = [];
  for (let i = 0; i < n - 1; i++) { h[i] = x[i + 1] - x[i]; d[i] = (y[i + 1] - y[i]) / h[i]; }
  if (n === 2) { m[0] = m[1] = d[0]; return m; }
  const end = (d0: number, d1: number, h0: number, h1: number) => {
    const v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(v) !== Math.sign(d0)) return 0;
    if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > 3 * Math.abs(d0)) return 3 * d0;
    return v;
  };
  m[0] = end(d[0], d[1], h[0], h[1]);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  m[n - 1] = end(d[n - 2], d[n - 3], h[n - 2], h[n - 3]);
  return m;
}

function evalH(x: number[], y: number[], m: number[], q: number) {
  const n = x.length;
  if (q <= x[0]) return y[0]; if (q >= x[n - 1]) return y[n - 1];
  let lo = 0, hi = n - 2, k = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (x[mid] <= q) { k = mid; lo = mid + 1; } else hi = mid - 1; }
  const h = x[k + 1] - x[k], t = (q - x[k]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * y[k + 1] + (t3 - t2) * h * m[k + 1];
}

class Track {
  private pieces: [number[], number[], number[]][] = [];
  private starts: number[] = [];
  constructor(knots: [number, number, boolean][]) {
    let xs: number[] = [], ys: number[] = [];
    const flush = () => {
      if (!xs.length) return;
      if (xs.length === 1) { xs.push(xs[0] + 1e-6); ys.push(ys[0]); }
      this.pieces.push([xs, ys, slopes(xs, ys)]); this.starts.push(xs[0]);
      xs = []; ys = [];
    };
    for (const [u, v, br] of knots) {
      if (br) flush();
      if (xs.length && u <= xs[xs.length - 1] + 1e-9) continue;
      xs.push(u); ys.push(v);
    }
    flush();
  }
  at(u: number) {
    let i = this.starts.length - 1;
    while (i > 0 && u < this.starts[i]) i--;
    const [x, y, m] = this.pieces[i];
    return evalH(x, y, m, u);
  }
}

export function blendOnion(from: Shell[], to: Shell[], t: number): Shell[] {
  t = clamp(t, 0, 1);
  if (!from.length || !to.length || t >= 1) return to;
  if (t <= 0) return from;
  const match = to.map(() => -1), used = from.map(() => false);
  to.forEach((s, j) => { for (let i = 0; i < from.length; i++) if (!used[i] && from[i].main === s.main) { match[j] = i; used[i] = true; break; } });
  const th = (a: Shell[], i: number) => a[i].massFrac - (i === 0 ? 0 : a[i - 1].massFrac);
  type E = { t: number; s: Shell; from: number };
  const ent: E[] = to.map((s, j) => match[j] >= 0
    ? { t: th(from, match[j]) + (th(to, j) - th(from, match[j])) * t, s: sh(0, s.main, s.label, t >= 0.5 ? s.burning : from[match[j]].burning), from: match[j] }
    : { t: th(to, j) * t, s: sh(0, s.main, s.label, s.burning && t > 0.3), from: -1 });
  from.forEach((s, i) => {
    if (used[i]) return;
    const v = { t: th(from, i) * (1 - t), s: sh(0, s.main, s.label, s.burning && t < 0.5), from: i };
    const pos = ent.findIndex(e => e.from > i);
    if (pos < 0) ent.push(v); else ent.splice(pos, 0, v);
  });
  const f = ent.filter(e => e.t >= 1e-6);
  if (!f.length) return to;
  const tot = f.reduce((a, e) => a + e.t, 0);
  const target = from[from.length - 1].massFrac + (to[to.length - 1].massFrac - from[from.length - 1].massFrac) * t;
  const sc = tot > 0 ? target / tot : 1;
  let acc = 0;
  return f.map(e => { acc += e.t; return sh(acc * sc, e.s.main, e.s.label, e.s.burning); });
}

// ---------------------------------------------------------------------------------------------- Zahlen im Text
const g = (x: number, d = 2) => x.toLocaleString('de-DE', { maximumFractionDigits: d, useGrouping: false });
const g0 = (x: number) => g(x, 0);

export const TSun = 5772, RSunKm = 695_700;

export function fmtYears(y: number) {
  if (y >= 1e9) return `${g(y / 1e9)} Mrd. Jahre`;
  if (y >= 1e6) return `${g(y / 1e6)} Mio. Jahre`;
  if (y >= 1e4) return `${g0(y / 1e3)} 000 Jahre`;
  if (y >= 2) return `${g0(y)} Jahre`;
  if (y >= 2 / 365) return `${g0(y * 365)} Tage`;
  if (y >= 2 / 8760) return `${g0(y * 8760)} Stunden`;
  if (y >= 2 / 525600) return `${g0(y * 525600)} Minuten`;
  return `${g(y * 3.156e7, 3)} Sekunden`;
}

export const LZams = (m: number, z: number) => {
  const L = m < 0.43 ? 0.034 * (m / 0.43) ** 3 : m < 2 ? m ** 4 : m < 20 ? 1.4 * m ** 3.5 : 1.4 * 20 ** 3.5 * (m / 20) ** 2;
  return L * (0.014 / Math.max(z, 1e-5)) ** 0.035;
};
export const RZams = (m: number, z: number) =>
  (m < 1 ? m ** (0.8 + 0.25 * clamp((0.8 - m) / 0.5, 0, 1)) : m ** 0.57) * (Math.max(z, 1e-5) / 0.014) ** 0.06;
export const Teff = (L: number, R: number) => TSun * (L / (R * R)) ** 0.25;
export const Rad = (L: number, T: number) => Math.sqrt(L) * (TSun / T) ** 2;
export const Lum = (R: number, T: number) => R * R * (T / TSun) ** 4;

const Comp = (h: number, he: number, c = 0, n = 0, o = 0, ne = 0, mg = 0, si = 0, s = 0, fe = 0) => [h, he, c, n, o, ne, mg, si, s, fe];
const Norm = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0); return a.map(x => x / Math.max(s, 1e-12)); };

export interface ModelOpts { m: number; z?: number; rot?: number; fusion?: number; wind?: number; comp?: number; sep?: number }

export class StellarModel {
  readonly M0: number; readonly Z: number; readonly Rot: number; readonly Fusion: number; readonly Wind: number;
  readonly CompM: number; readonly Sep: number;
  RocheR = Infinity;
  Stripped = false;
  segs: Segment[] = [];
  ending = ''; endingShort = ''; remnant = ''; remnantMass = 0; totalYears = 0;
  init: number[] = new Array(10).fill(0);
  get bipolar() { return this.Rot > 0.35 || (this.CompM > 0 && this.Sep < 30); }

  private lL!: Track; private lT!: Track; private Mt!: Track; private lTc!: Track; private lRho!: Track;

  constructor(o: ModelOpts) {
    const comp = o.comp ?? 0, sep = o.sep ?? 0;
    this.M0 = clamp(o.m, 0.02, 300); this.Z = clamp(o.z ?? 0.014, 1e-5, 0.04); this.Rot = clamp(o.rot ?? 0, 0, 0.95);
    this.Fusion = clamp(o.fusion ?? 1, 0.1, 10); this.Wind = clamp(o.wind ?? 1, 0, 5);
    this.CompM = comp > 0.05 && sep > 0 ? Math.min(comp, this.M0) : 0;
    this.Sep = this.CompM > 0 ? clamp(sep, 0.01, 1e4) : 0;
    if (this.CompM > 0) {
      const q = this.M0 / this.CompM, q3 = Math.cbrt(q);
      this.RocheR = this.Sep * 215 * 0.49 * q3 * q3 / (0.6 * q3 * q3 + Math.log(1 + q3));
    }
    this.build();
    const F = this.Fusion;
    if (Math.abs(F - 1) > 1e-3) {
      for (const s of this.segs) if (s.group >= 1 && s.group <= 3 && s.rFixed < 0 && !s.event) {
        s.path = s.path.map(([f, L, T]) => [f, L * F, T * F ** -0.12]);
        s.years /= F; s.tc0 *= F ** 0.1; s.tc1 *= F ** 0.1;
      }
      if (this.segs[0]?.look === 'Cloud' && this.segs.length > 1) {
        const p = this.segs[1].path, l = p[p.length - 1]; p[p.length - 1] = [1, l[1] * F, l[2] * F ** -0.12];
      }
    }
    let t = 0;
    for (const s of this.segs) { s.t0 = t; t += s.years; s.weight = s.event ? 1.3 : clamp(1 + 0.3 * Math.log10(1 + s.years), 1, 4.5); }
    this.totalYears = t;
    this.buildTracks();
  }

  get snType() {
    const sn = this.segs.find(x => x.look === 'Supernova')?.name ?? '';
    return sn.includes('Ia') ? 'Ia' : sn.includes('Elektroneneinfang') ? 'ECSN' : sn.includes('Paarinstabilit') ? 'PISN'
      : sn.includes('IIb') ? 'IIb' : sn.includes('Ic') ? 'Ic' : sn.includes('Ib') ? 'Ib' : sn.includes('pekuliar') ? 'II-pec' : sn.includes('II') ? 'II-P' : '';
  }

  private brk(k: number) {
    if (k === 0) return true;
    const a = this.segs[k - 1], b = this.segs[k];
    if ((a.rFixed > 0) !== (b.rFixed > 0)) return true;
    if (['Supernova', 'Nothing', 'BlackHole'].includes(b.look) || a.look === 'Supernova' || a.look === 'Cloud') return true;
    const pa = a.path[a.path.length - 1], pb = b.path[0];
    return Math.abs(Math.log10(pa[1] / pb[1])) > 0.02 || Math.abs(Math.log10(pa[2] / pb[2])) > 0.01;
  }

  private buildTracks() {
    const kL: [number, number, boolean][] = [], kT: typeof kL = [], kM: typeof kL = [], kTc: typeof kL = [], kR: typeof kL = [];
    this.segs.forEach((s, k) => {
      const br = this.brk(k);
      s.path.forEach(([f, L, T], j) => {
        kL.push([k + f, Math.log10(Math.max(L, 1e-12)), br && j === 0]);
        kT.push([k + f, Math.log10(Math.max(T, 1)), br && j === 0]);
      });
      const p = this.segs[k - 1];
      const bm = k === 0 || Math.abs(p.m1 - s.m0) > 1e-3 * Math.max(s.m0, 1e-3);
      const bc = k === 0 || Math.abs(Math.log10(p.tc1 / s.tc0)) > 0.01 || Math.abs(Math.log10(p.rho1 / s.rho0)) > 0.01;
      kM.push([k, s.m0, bm], [k + 1, s.m1, false]);
      kTc.push([k, Math.log10(Math.max(s.tc0, 1)), bc], [k + 1, Math.log10(Math.max(s.tc1, 1)), false]);
      kR.push([k, Math.log10(Math.max(s.rho0, 1e-30)), bc], [k + 1, Math.log10(Math.max(s.rho1, 1e-30)), false]);
    });
    this.lL = new Track(kL); this.lT = new Track(kT); this.Mt = new Track(kM); this.lTc = new Track(kTc); this.lRho = new Track(kR);
  }

  get totalWeight() { return this.segs.reduce((a, s) => a + s.weight, 0); }

  /** Zustand an der Stelle u (Phase + Anteil, 0 … segs.length). */
  at(u: number): StarState {
    const k = clamp(Math.floor(u), 0, this.segs.length - 1);
    const f = clamp(u - k, 0, 1), s = this.segs[k], uu = k + f;
    const T = 10 ** this.lT.at(uu);
    const pulse = s.pulse * step(0, 0.15, f) * (1 - step(0.85, 1, f));
    let L: number, R: number;
    if (s.rFixed > 0) { R = s.rFixed; L = R * R * (T / TSun) ** 4; }
    else {
      L = 10 ** this.lL.at(uu);
      if (pulse > 0) L *= 1 + pulse * Math.sin(f * 40 * Math.PI) * Math.sin(f * 7);
      R = Math.sqrt(L) * (TSun / T) ** 2;
    }
    const fc = step(0, 1, f);
    const core = s.core0.map((a, i) => a + (s.core1[i] - a) * fc);
    const prev = k > 0 && !this.brk(k) ? this.segs[k - 1].onion : [];
    const onion = prev.length && s.onion.length ? blendOnion(prev, s.onion, step(0, 0.5, f)) : s.onion;
    return { age: s.t0 + s.years * f, L, T, R, M: Math.max(this.Mt.at(uu), 0), Tc: 10 ** this.lTc.at(uu), Rho: 10 ** this.lRho.at(uu),
      prog: f, core, onion, pulse, seg: k };
  }

  /** Lebenszeit-Regler (0 … 1, gewichtet: lange Phasen bekommen mehr, aber nicht proportional mehr Platz) → u. */
  uFromProgress(p: number) {
    const tot = this.totalWeight; let acc = 0, want = clamp(p, 0, 1) * tot;
    for (let k = 0; k < this.segs.length; k++) {
      const w = this.segs[k].weight;
      if (acc + w >= want) return k + Math.min(0.9999, (want - acc) / w);
      acc += w;
    }
    return this.segs.length - 0.0001;
  }
  progressFromU(u: number) {
    const k = clamp(Math.floor(u), 0, this.segs.length - 1);
    let acc = 0; for (let i = 0; i < k; i++) acc += this.segs[i].weight;
    return (acc + this.segs[k].weight * (u - k)) / this.totalWeight;
  }

  // -------------------------------------------------------------------------------------------- Aufbau
  private metals(b: number[], scale = 1) { const r = b.slice(); for (let i = 2; i < 10; i++) r[i] = this.init[i] * scale; return r; }

  private add(name: string, years: number, look: Look, group: number, ...path: P[]) {
    const s = new Segment();
    s.name = name; s.years = years; s.look = look; s.group = group; s.path = path;
    const p = this.segs[this.segs.length - 1];
    if (p) {
      s.m0 = s.m1 = p.m1; s.tc0 = s.tc1 = p.tc1; s.rho0 = s.rho1 = p.rho1;
      s.core0 = p.core1.slice(); s.core1 = p.core1.slice();
    }
    this.segs.push(s);
    return s;
  }

  private build() {
    const m = this.M0, z = this.Z, Rot = this.Rot;
    const Y = 0.248 + 1.4 * z, X = 1 - Y - z;
    const I = this.init = Comp(X, Y, 0.17 * z, 0.05 * z, 0.43 * z, 0.10 * z, 0.06 * z, 0.07 * z, 0.04 * z, 0.08 * z);
    const L0 = LZams(m, z), R0 = RZams(m, z), T0 = Teff(L0, R0);
    const fuel = m < 0.35 ? 8 : m < 0.8 ? 2.5 - 1.5 * (m - 0.35) / 0.45 : 1 + 3 * clamp((Math.log10(m) - 0.15) / 1.9, 0, 1);
    const tMS = 1e10 * m / L0 * fuel * (1 + 0.3 * Rot);
    const cno = m > 1.3;
    const TcMS = 1.57e7 * m ** 0.35, rhoMS = 150 * m ** -1.1;

    const cloud = this.add('Molekülwolke', 5e5 * m ** -0.15, 'Cloud', 0, [0, L0 * 0.01, 20], [1, L0 * 0.05, 40]);
    cloud.m0 = m * 1.6; cloud.m1 = m * 1.2; cloud.tc0 = 10; cloud.tc1 = 3e3; cloud.rho0 = 1e-20; cloud.rho1 = 1e-10;
    cloud.core0 = I.slice(); cloud.core1 = I.slice();
    cloud.text = 'Eine kalte (10 K), dichte Wolke aus Wasserstoff, Helium und Staub zieht sich unter ihrer eigenen Schwerkraft zusammen – ' +
      'oft angestoßen von der Druckwelle einer nahen Supernova. Sie zerfällt in Klumpen; aus einem davon entsteht dieser Stern.';
    cloud.core = 'Keine Fusion – Energie aus der Kontraktion (Gravitation → Wärme)';

    if (m < 0.075) {
      const bd = this.add('Protostern', 2e6, 'Proto', 0, [0, 0.05, 2600], [1, 0.003, 2700]);
      bd.m1 = m; bd.tc1 = m > 0.013 ? 1e6 : 3e5; bd.rho1 = 50;
      bd.text = 'Der Klumpen verdichtet sich und heizt sich auf, doch er ist zu leicht: Der Kern erreicht nie die ≈ 3 Mio. K für Wasserstofffusion.';
      bd.core = 'Kontraktion';
      if (m > 0.013) {
        const d = this.add('Deuteriumbrennen', 3e7 * (m / 0.05) ** -1, 'BrownDwarf', 1, [0, 0.003, 2700], [1, 0.001, 2500]);
        d.reactions = ['²H + ¹H → ³He + γ  (5,5 MeV)'];
        d.core = 'Deuterium-Fusion (nur der geringe Vorrat an schwerem Wasserstoff)';
        d.text = 'Über 13 Jupitermassen kann der Kern wenigstens Deuterium fusionieren – ein kurzes Aufflackern, kein echtes Sternleben.';
        d.rFixed = 0.1;
      }
      const cool = this.add('Brauner Zwerg', 1e10, 'BrownDwarf', 5, [0, 2.3e-4, 2400], [0.3, 3e-5, 1300], [1, 1e-6, 500]);
      cool.rFixed = 0.1; cool.tc1 = 2e5;
      cool.text = 'Ein „gescheiterter Stern“: Er leuchtet nur noch von der Restwärme seiner Entstehung, kühlt über Milliarden Jahre aus und wird ' +
        'immer röter (Spektraltypen M → L → T → Y). Größe etwa wie Jupiter, aber 13–80-mal schwerer.';
      cool.core = 'Keine Fusion – Auskühlen';
      this.ending = m > 0.013 ? 'Brauner Zwerg' : 'Planetenartiges Objekt (frei fliegend)';
      this.endingShort = 'Brauner Zwerg'; this.remnant = this.ending; this.remnantMass = m;
      return;
    }

    const tKH = clamp(3e7 * m ** -2.5, 3e4, 1e9);
    const pro = this.add('Protostern', tKH, 'Proto', 0,
      [0, Math.max(L0 * 8, 2), 3600], [0.6, Math.max(L0 * 1.2, 0.6), Math.min(T0 * 0.85, 4300)], [1, L0, T0]);
    pro.m1 = m; pro.tc1 = TcMS * 0.95; pro.rho1 = rhoMS * 0.8;
    pro.text = 'Im Zentrum der einstürzenden Wolke entsteht ein glühender Protostern, umgeben von einer Gas- und Staubscheibe (daraus können ' +
      'Planeten werden). Er leuchtet nur durch Kontraktion – bis der Kern heiß genug für die Wasserstofffusion wird. Starke Ausflüsse (Jets) ' +
      'fegen die Umgebung frei.';
    pro.core = 'Kontraktion, gegen Ende erste Fusion (Deuterium, dann Wasserstoff)';

    const LTams = L0 * (m < 0.5 ? 1.3 : m < 1.3 ? 1.8 : 1.6), TTams = m < 1.3 ? T0 : T0 * 0.78;
    const ms = this.add('Hauptreihe', tMS, 'Star', 1, [0, L0, T0], [0.5, Math.sqrt(L0 * LTams) * 0.95, (T0 + TTams) / 2 * 1.01], [1, LTams, TTams]);
    ms.tc0 = TcMS; ms.tc1 = TcMS * 1.35; ms.rho0 = rhoMS; ms.rho1 = rhoMS * 1.8;
    const hLeft = m < 0.35 ? 0.05 : 0;
    let tams = Comp(hLeft, X + Y - hLeft);
    if (cno) tams = Comp(hLeft, X + Y - hLeft, I[2] * 0.1, I[2] * 0.9 + I[3] + I[4] * 0.6, I[4] * 0.4, I[5], I[6], I[7], I[8], I[9]);
    else for (let i = 2; i < 10; i++) tams[i] = I[i];
    ms.core1 = Norm(tams);
    ms.reactions = cno
      ? ['CNO-Zyklus: ¹²C + 4 ¹H → ¹²C + ⁴He  (C, N, O nur als Katalysator)', `pp-Kette: ≈ ${g0(100 * Math.max(0.02, 1.3 / m * 0.2))} %`, '4 ¹H → ⁴He + 2 e⁺ + 2 ν + 26,7 MeV']
      : ['pp-Kette: ¹H + ¹H → ²H + e⁺ + ν', '²H + ¹H → ³He + γ', '³He + ³He → ⁴He + 2 ¹H', 'netto: 4 ¹H → ⁴He + 26,7 MeV (0,7 % der Masse wird Energie)'];
    ms.core = cno ? 'Wasserstoffbrennen (CNO-Zyklus) im konvektiven Kern' : 'Wasserstoffbrennen (pp-Kette)';
    const transport = m < 0.35 ? 'Der ganze Stern ist konvektiv – er mischt sich durch und verbrennt fast seinen ganzen Wasserstoff.'
      : m < 1.3 ? 'Innen wird die Energie durch Strahlung transportiert, außen brodelt eine Konvektionszone (wie bei der Sonne).'
        : 'Der Kern ist konvektiv (der CNO-Zyklus ist extrem temperaturempfindlich), die Hülle strahlt.';
    ms.text = `Die längste Phase: Im Kern verschmilzt Wasserstoff zu Helium. Der Strahlungsdruck hält der Schwerkraft genau die Waage – der Stern ist stabil. ` +
      `${transport} Je schwerer der Stern, desto heißer und verschwenderischer: Ein Stern mit ${g(m)} Sonnenmassen strahlt ${g(L0, 3)} L☉ und ` +
      `bleibt ≈ ${fmtYears(tMS)} auf der Hauptreihe.` + (tMS > 1.38e10 ? ' Das ist länger als das heutige Alter des Universums (13,8 Mrd. Jahre) – kein solcher Stern hat sie bisher verlassen.' : '');
    ms.onion = m < 0.35 ? [sh(1, El.H, 'H/He – voll konvektiv', true)]
      : [sh(cno ? 0.2 : 0.1, El.He, 'Kern: H → He', true), sh(1, El.H, 'Hülle: H, He', false)];

    if (m < 0.5) this.lowMass(m, LTams, TTams);
    else if (m < 9.5 - 1.5 * Rot) this.intermediate(m, LTams, TTams, tMS);
    else this.massive(m, LTams, TTams, tMS);
  }

  private lowMass(m: number, L1: number, T1: number) {
    const blue = this.add('Blauer Zwerg', 5e9 * (m / 0.2) ** -1, 'Star', 2, [0, L1, T1], [1, L1 * 8, Math.min(T1 * 2.2, 9000)]);
    blue.core1 = Norm(this.metals(Comp(0, 1 - this.Z), 1)); blue.tc1 = blue.tc0 * 1.5; blue.rho1 = blue.rho0 * 10;
    blue.reactions = ['letzter Wasserstoff: 4 ¹H → ⁴He'];
    blue.core = 'Wasserstoffbrennen bis zum letzten Rest';
    blue.text = 'Rote Zwerge werden nie zu Riesen: Weil sie voll durchmischt sind, verbrennen sie fast ihren gesamten Wasserstoff. Am Ende werden sie ' +
      'heißer und blauer („blauer Zwerg“) – ein rein theoretisches Stadium, denn das Universum ist dafür noch viel zu jung.';
    blue.onion = [sh(0.9, El.He, 'Helium', false), sh(1, El.H, 'Rest-H brennt', true)];
    const wd = this.whiteDwarf(Math.max(0.6 * m, 0.08), 'Helium', 1e5);
    wd.onion = [sh(1, El.He, 'entartetes Helium', false)];
    this.ending = 'Weißer Zwerg aus Helium (ohne Nebel)'; this.endingShort = 'He-Weißer Zwerg';
  }

  private intermediate(m: number, L1: number, T1: number, tMS: number) {
    const { Z, Rot, Wind } = this;
    const I = this.init;
    const flash = m < 2.1;
    let mWD = clamp((0.109 * m + 0.394) * Math.max(Wind, 0.05) ** -0.08, 0.45, 1.39);
    const oNe = m > 7.0 - Rot;
    const zT = clamp(Z / 0.014, 1e-3, 3) ** -0.04;
    const Lsg = flash ? L1 * 1.6 : L1 * 1.05, Tsg = flash ? 5000 : 4600;
    const sg = this.add('Unterriese', (flash ? 0.08 : 0.01) * tMS, 'Star', 2, [0, L1, T1], [1, Lsg, Tsg]);
    sg.core1 = sg.core0.slice(); sg.tc1 = sg.tc0 * 1.4; sg.rho1 = flash ? 1e4 : sg.rho0 * 20;
    sg.reactions = ['Schalenbrennen: 4 ¹H → ⁴He um den Heliumkern'];
    sg.core = 'Heliumkern ohne Fusion, zieht sich zusammen'; sg.shellBurn = 'Wasserstoff-Schalenbrennen';
    sg.text = 'Der Wasserstoff im Kern ist verbraucht. Der Heliumkern zieht sich zusammen und heizt sich auf, Wasserstoff brennt nun in einer Schale ' +
      'darum herum. Die Hülle bläht sich auf und kühlt ab.' + (flash ? '' : ' Bei schweren Sternen geht das so schnell, dass man kaum welche in diesem Zustand sieht (Hertzsprung-Lücke).');
    sg.onion = [sh(0.12, El.He, 'He-Kern (inaktiv)', false), sh(0.16, El.H, 'H-Schale', true), sh(1, El.H, 'Hülle', false)];

    const Ltip = flash ? 2400 * m ** 0.3 : L1 * 1.5, Ttip = (flash ? 3300 : 4300 - 350 * Math.log10(m / 3)) * zT;
    const mRgb = m - (flash ? 0.2 * m * (Z / 0.014) ** 0.2 : 0.05 * m);
    const rg = flash
      ? this.add('Roter Riese', 0.08 * tMS, 'Star', 2, [0, Lsg, Tsg], [0.4, Lsg * 6, Tsg * 0.87], [1, Ltip, Ttip])
      : this.add('Roter Riese', 0.02 * tMS, 'Star', 2, [0, Lsg, Tsg], [0.35, Lsg * 0.85, Ttip * 1.03], [1, Ltip, Ttip]);
    rg.m1 = mRgb; rg.tc1 = flash ? 9e7 : 1.0e8; rg.rho1 = flash ? 1e6 : 2e4;
    rg.reactions = ['H-Schale: 4 ¹H → ⁴He (CNO-Zyklus)', 'Kern: noch keine Fusion'];
    rg.core = flash ? 'entarteter Heliumkern (Elektronendruck hält ihn)' : 'Heliumkern heizt sich auf'; rg.shellBurn = 'Wasserstoff-Schalenbrennen';
    rg.text = `Der Stern bläht sich auf das ${g0(Rad(Ltip, Ttip))}-Fache des Sonnenradius auf – die Sonne wird dabei Merkur und Venus ` +
      'verschlucken. Die Oberfläche kühlt auf ≈ 3500 K ab (rot), die Leuchtkraft steigt auf das Tausendfache. Konvektion holt Fusionsprodukte an die Oberfläche ' +
      '(erste Ausbaggerung), ein starker Wind trägt Masse ab.';
    rg.onion = [sh(0.25, El.He, flash ? 'He-Kern (entartet)' : 'He-Kern', false), sh(0.28, El.H, 'H-Schale', true), sh(1, El.H, 'riesige konvektive Hülle', false)];
    if (!flash) rg.text = `Die Hülle bläht sich auf ≈ ${g0(Rad(Ltip, Ttip))} Sonnenradien auf und kühlt ab – ein orangeroter Riese. Lange bleibt er nicht: ` +
      'Der Heliumkern ist nicht entartet und zündet ruhig, sobald er heiß genug ist.';

    const Rtip = flash ? Rad(Ltip, Ttip) : Math.max(Rad(Ltip, Ttip), Rad(L1 * 2.1, 3800 * zT));
    if (this.RocheR < Rtip) { this.stripGiant(m, flash, rg, Lsg, Tsg, Ltip, Ttip, tMS); return; }

    const cFrac = 0.3;
    const heEnd = Norm(Comp(0, 0, cFrac, 0, 1 - cFrac - Z, I[3] + I[2], I[6], I[7], I[8], I[9]));
    if (flash) {
      const hf = this.add('Helium-Blitz', 1e4, 'Flash', 2, [0, Ltip, Ttip], [1, Ltip * 0.6, Ttip * 1.03]);
      hf.event = true; hf.tc1 = 1.1e8; hf.rho1 = 5e4;
      hf.reactions = ['3 ⁴He → ¹²C + 7,3 MeV (Drei-Alpha-Prozess, zündet schlagartig)'];
      hf.core = 'Helium zündet explosionsartig im entarteten Kern';
      hf.text = 'Bei 100 Mio. K zündet das Helium – in einem entarteten Kern explosionsartig: Für Sekunden setzt der Kern so viel Energie frei wie eine ' +
        'ganze Galaxie. Nach außen dringt davon nichts; die Energie hebt die Entartung auf, der Kern dehnt sich aus. Danach schrumpft der Stern.';
      hf.onion = rg.onion;
    }
    const fHe = clamp(0.01 * m ** 1.3, 0.01, 0.12);
    const Lhb = flash ? 50 * m ** 0.4 : L1 * 1.4, Thb = flash ? (Z < 0.002 ? 12000 : Z < 0.006 ? 7000 : 4900) : 4500;
    const loop = !flash && m > 3;
    const hb = loop
      ? this.add('Heliumbrennen (Blaue Schleife)', fHe * tMS, 'Star', 2, [0, Lhb, 4200], [0.3, Lhb * 1.1, 4600], [0.55, Lhb * 1.25, Math.min(T1 * 0.5, 9000)], [0.8, Lhb * 1.3, 4800], [1, Lhb * 1.4, 4000])
      : this.add(flash ? (Thb > 6000 ? 'Horizontalast' : 'Roter Klumpen') : 'Heliumbrennen', fHe * tMS, 'Star', 2, [0, Ltip * 0.6, Ttip], [0.15, Lhb, Thb], [0.9, Lhb * 1.2, Thb * 0.97], [1, Lhb * 1.5, Thb * 0.9]);
    hb.tc0 = 1.1e8; hb.tc1 = 2e8; hb.rho0 = 2e4; hb.rho1 = 1e5; hb.core1 = heEnd;
    hb.reactions = ['3 ⁴He → ¹²C + 7,3 MeV (Drei-Alpha-Prozess)', '¹²C + ⁴He → ¹⁶O + γ', 'Schale: 4 ¹H → ⁴He'];
    hb.core = 'Heliumbrennen zu Kohlenstoff und Sauerstoff'; hb.shellBurn = 'Wasserstoff-Schalenbrennen';
    hb.text = flash
      ? 'Ruhiges Heliumbrennen im Kern, Wasserstoff in einer Schale darum. Der Stern ist kleiner und heißer als zuvor. ' + (Thb > 6000 ? 'Metallarme Sterne sind dabei bläulich (Horizontalast in Kugelsternhaufen).' : 'Mit vielen schweren Elementen sammeln sie sich als „roter Klumpen“ im HR-Diagramm.')
      : 'Helium brennt im Kern zu Kohlenstoff und Sauerstoff. ' + (loop ? 'Der Stern läuft dabei eine „Blaue Schleife“: Er wird kurz heißer und kreuzt den Instabilitätsstreifen – dort pulsiert er als Cepheide, deren Periode seine Leuchtkraft verrät (Entfernungsmessung im Universum!).' : '');
    if (loop) hb.pulse = 0.08;
    hb.onion = [sh(0.08, El.C, 'Kern: He → C, O', true), sh(0.14, El.He, 'Helium', false), sh(0.17, El.H, 'H-Schale', true), sh(1, El.H, 'Hülle', false)];

    let Lagb = Math.min(3000 + 4000 * m, 6e4), Tagb = 3000 * zT;
    const Lagb0 = Lhb * 1.5, Ragb = Rad(Lagb, Tagb);
    const agbCut = this.RocheR < Ragb;
    if (agbCut) {
      const T2 = Tagb * (Ragb / this.RocheR) ** 0.1, L2 = Math.max(Lum(this.RocheR, T2), Lagb0 * 1.05);
      const share = Math.log(L2 / Lagb0) / Math.log(Lagb / Lagb0);
      mWD = Math.max(0.5, mWD * (0.85 + 0.15 * share));
      Lagb = L2; Tagb = Teff(L2, Math.max(this.RocheR, Rad(L2, 4500)));
      this.Stripped = true;
    }
    const hbEndT = hb.path[hb.path.length - 1][2];
    const agb = this.add('Asymptotischer Riesenast', 0.15 * fHe * tMS, 'Star', 2, [0, Lhb * 1.5, hbEndT],
      [0.5, Math.max(Lagb * 0.4, Math.sqrt(Lagb * Lagb0)), Math.max(3300 * zT, Tagb)], [1, Lagb, Tagb]);
    agb.m1 = mWD * 1.05; agb.tc1 = 3e8; agb.rho1 = 1e6; agb.pulse = 0.25; agb.core1 = heEnd;
    agb.reactions = ['He-Schale: 3 ⁴He → ¹²C (in Blitzen, „thermische Pulse“)', 'H-Schale: 4 ¹H → ⁴He', 's-Prozess: langsamer Neutroneneinfang erzeugt Barium, Blei, …'];
    agb.core = oNe ? 'entarteter Kern aus Sauerstoff, Neon, Magnesium' : 'entarteter Kohlenstoff-Sauerstoff-Kern'; agb.shellBurn = 'Helium- und Wasserstoffschale (abwechselnd)';
    agb.text = 'Zwei Schalen brennen abwechselnd um den toten Kern – das Heliumbrennen setzt in Pulsen ein, der Stern pulsiert stark (Mira-Veränderliche). ' +
      'Hier entsteht etwa die Hälfte aller Elemente schwerer als Eisen (s-Prozess). Kohlenstoff wird nach oben gebaggert (Kohlenstoffsterne), und ein ' +
      'dichter, staubiger Wind bläst die Hülle davon – bis zu einer Zehntausendstel Sonnenmasse pro Jahr.';
    if (agbCut) {
      agb.years *= 0.5;
      agb.text += ` Hier wird er aber schon bei ≈ ${g0(this.RocheR)} Sonnenradien gebremst: Der Begleitstern (${g(this.CompM)} M☉, ${g(this.Sep)} AE entfernt) ` +
        'zieht die Hülle über den inneren Lagrange-Punkt ab – sie sammelt sich in der Bahnebene.';
    }
    if (oNe) agb.core1 = Norm(Comp(0, 0, 0.02, 0, 0.6, 0.3, 0.08));
    agb.onion = [sh(mWD / Math.max(m, 1e-3) * 0.9, oNe ? El.Ne : El.C, oNe ? 'O-Ne-Mg-Kern' : 'C-O-Kern (entartet)', false), sh(0.6, El.He, 'He-Schale', true), sh(0.62, El.H, 'H-Schale', true), sh(1, El.H, 'Hülle (wird abgeblasen)', false)];

    if (m > 8.6 - Rot) {
      const c = this.add('Kernkollaps (Elektroneneinfang)', 1e-7, 'Collapse', 4, [0, Lagb, Tagb], [1, Lagb, Tagb]);
      c.event = true; c.tc1 = 1e10; c.rho1 = 1e10;
      c.reactions = ['²⁴Mg + e⁻ → ²⁴Na + ν, ²⁰Ne + e⁻ → ²⁰F + ν (Elektronen werden eingefangen)'];
      c.core = 'Der O-Ne-Mg-Kern verliert seinen Elektronendruck und stürzt ein';
      c.text = 'Im O-Ne-Mg-Kern fangen Atomkerne Elektronen ein – der Druck, der den Kern trägt, bricht weg. Der Kern stürzt in Millisekunden zu einem Neutronenstern zusammen.';
      this.supernova('Elektroneneinfang-Supernova', 'schwache Supernova (wie SN 1054 → Krebsnebel)', m - 1.35);
      this.neutronStar(1.35, false);
      this.ending = 'Elektroneneinfang-Supernova → Neutronenstern'; this.endingShort = 'ECSN → Neutronenstern';
      return;
    }

    const pagb = this.add('Planetarischer Nebel', 3e4, 'Nebula', 4, [0, Lagb, Tagb], [0.25, Lagb * 0.9, 10000], [0.7, Lagb * 0.8, 80000], [1, Lagb * 0.4, 130000]);
    pagb.m1 = mWD; pagb.tc1 = 2e8; pagb.rho1 = 1e6;
    pagb.reactions = ['letztes Schalenbrennen erlischt', 'UV-Licht ionisiert den Nebel: O III (grün), H-α (rot), N II'];
    pagb.core = 'Nackter Kern wird sichtbar'; pagb.shellBurn = 'erlischt';
    pagb.text = `Die abgestoßene Hülle (${g(m - mWD, 1)} Sonnenmassen) dehnt sich mit ≈ 20 km/s aus. Der freigelegte, über 100 000 K heiße Kern bringt sie mit seinem UV-Licht ` +
      'zum Leuchten – ein planetarischer Nebel (mit Planeten hat er nichts zu tun, der Name stammt von alten Teleskopen). Nach ≈ 20 000 Jahren verblasst er. ' +
      'Das ausgestoßene Gas, angereichert mit Kohlenstoff, Stickstoff und s-Elementen, wird zum Baumaterial neuer Sterne und Planeten.';
    pagb.onion = [sh(1, oNe ? El.Ne : El.C, oNe ? 'O-Ne-Mg' : 'C-O', false)];
    const wd = this.whiteDwarf(mWD, oNe ? 'Sauerstoff-Neon' : 'Kohlenstoff-Sauerstoff', 1.3e5);
    wd.onion = [sh(0.98, oNe ? El.Ne : El.C, oNe ? 'O-Ne-Mg (entartet)' : 'C-O (entartet, kristallisiert)', false), sh(1, El.He, 'dünne He/H-Haut', false)];
    if (this.bipolar) pagb.text += ' Weil ' + (this.CompM > 0 ? 'ein Begleiter das Gas in der Bahnebene staut' : 'der Stern schnell rotierte') +
      ', kann es nur entlang der Pole entweichen – der Nebel wird zweilappig (bipolar), wie der Schmetterlingsnebel.';
    this.ending = `Planetarischer Nebel → ${oNe ? 'O-Ne' : 'C-O'}-Weißer Zwerg (${g(mWD)} M☉)`;
    this.endingShort = 'Nebel → Weißer Zwerg';
    if (!oNe) this.maybeIa(wd, mWD);
  }

  private stripGiant(m: number, flash: boolean, rg: Segment, Lsg: number, Tsg: number, Ltip: number, Ttip: number, tMS: number) {
    this.Stripped = true;
    const I = this.init;
    const Rs = Math.max(this.RocheR, Rad(Lsg, Tsg) * 1.02);
    let Ls: number, Mc: number;
    if (flash) {
      const Rc = (mc: number) => 3.7e3 * mc ** 4 / (1 + mc ** 3 + 1.75 * mc ** 4);
      let lo = 0.1, hi = 0.47;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (Rc(mid) < Rs) lo = mid; else hi = mid; }
      Mc = Math.max(0.12 + 0.05 * (m - 0.8), lo);
      Ls = clamp(2.3e5 * Mc ** 6, Lsg, Ltip);
    } else {
      Mc = 0.11 * m ** 1.2;
      Ls = Math.max(Lsg * 0.85, Ltip * (Rs / Rad(Ltip, Ttip)) ** 0.5);
    }
    const Ts = Teff(Ls, Rs);
    const share = clamp(Math.log(Ls / Lsg) / Math.log(Ltip / Lsg), 0.1, 1);
    rg.years *= share;
    rg.path = flash ? [[0, Lsg, Tsg], [0.4, Math.min(Lsg * 6, Ls), Tsg * 0.9], [1, Ls, Ts]] : [[0, Lsg, Tsg], [1, Ls, Ts]];
    rg.m1 = m * 0.98;

    const mt = this.add('Massenübertragung', 1e6 * m ** -0.5, 'Star', 2, [0, Ls, Ts], [0.5, Ls * 0.8, Ts * 1.3], [1, Ls * 0.5, 20000]);
    mt.m1 = Mc * 1.02;
    mt.reactions = ['H-Schale: 4 ¹H → ⁴He (erlischt, wenn die Hülle weg ist)'];
    mt.core = flash ? 'entarteter Heliumkern' : 'Heliumkern'; mt.shellBurn = 'Wasserstoffschale erlischt';
    mt.text = `Bei ≈ ${g0(Rs)} Sonnenradien füllt der Stern seine Roche-Grenze: Der Begleiter (${g(this.CompM)} M☉, ${g(this.Sep)} AE entfernt) zieht die Hülle über den inneren ` +
      `Lagrange-Punkt zu sich herüber – ${g(m - Mc)} Sonnenmassen wechseln in nur ≈ einer Million Jahren den Besitzer. Übrig bleibt der nackte, heiße Kern.`;
    mt.onion = [sh(0.9, El.He, 'He-Kern', false), sh(1, El.H, 'Resthülle fließt ab', true)];
    if (flash) {
      const wd = this.whiteDwarf(Mc, 'Helium', 3e4);
      wd.onion = [sh(1, El.He, 'entartetes Helium', false)];
      this.ending = `Hülle an den Begleiter verloren → Helium-Weißer Zwerg (${g(Mc)} M☉)`; this.endingShort = 'Begleiter → He-Weißer Zwerg';
      return;
    }
    const Lhe = Ltip * 0.4;
    const hs = this.add('Nackter Heliumstern', clamp(0.01 * m ** 1.3, 0.01, 0.12) * tMS, 'Star', 2, [0, Ls * 0.5, 20000], [0.15, Lhe, 32000], [1, Lhe * 1.3, 45000]);
    hs.m1 = Mc; hs.tc0 = 1.1e8; hs.tc1 = 2e8; hs.rho0 = 2e4; hs.rho1 = 1e5;
    hs.core1 = Norm(Comp(0, 0, 0.3, 0, 0.7 - this.Z, I[2] + I[3], I[6], I[7], I[8], I[9]));
    hs.reactions = ['3 ⁴He → ¹²C + 7,3 MeV', '¹²C + ⁴He → ¹⁶O + γ'];
    hs.core = 'Heliumbrennen'; hs.shellBurn = 'keine – die Wasserstoffhülle fehlt';
    hs.text = 'Ohne Hülle ist der Stern klein und blauweiß-heiß: ein nackter Heliumstern (Unterzwerg vom Typ sdO/sdB). Er brennt Helium zu Kohlenstoff und Sauerstoff ' +
      'und wird nie zum roten Riesen.';
    hs.onion = [sh(0.4, El.C, 'Kern: He → C, O', true), sh(1, El.He, 'Helium', false)];
    const mWD = clamp(0.5 + 0.25 * (Mc - 0.4), 0.5, 1.2);
    const w = this.whiteDwarf(mWD, 'Kohlenstoff-Sauerstoff', 8e4);
    w.onion = [sh(0.99, El.C, 'C-O (entartet)', false), sh(1, El.He, 'He-Haut', false)];
    this.ending = `Hülle an den Begleiter verloren → Heliumstern → C-O-Weißer Zwerg (${g(mWD)} M☉)`; this.endingShort = 'Begleiter → Weißer Zwerg';
    this.maybeIa(w, mWD);
  }

  private maybeIa(wd: Segment, mWD: number) {
    if (this.CompM < 0.8 || this.Sep > 5 || mWD < 0.7) return;
    const age = this.segs.reduce((a, s) => a + s.years, 0) - wd.years;
    const tComp = 1e10 * this.CompM ** -2.5;
    wd.years = Math.max(tComp - age, 5e7);
    const acc = this.add('Akkretion vom Begleiter', 1e6, 'WhiteDwarf', 4, [0, 1, 25000], [1, 1, 60000]);
    acc.rFixed = wd.rFixed * 0.7; acc.m0 = mWD; acc.m1 = 1.38; acc.tc0 = 3e7; acc.tc1 = 7e8; acc.rho1 = 2e9;
    acc.reactions = ['Wasserstoff vom Begleiter brennt auf der Oberfläche zu Helium', 'im Kern: ¹²C + ¹²C glimmt (Simmern)'];
    acc.core = 'Kohlenstoff-Sauerstoff-Kern nähert sich 1,38 M☉';
    acc.text = `Jetzt ist der Begleiter (${g(this.CompM)} M☉) zum Riesen geworden und schiebt Gas auf den weißen Zwerg. Der wird schwerer – und, weil Entartung so funktioniert, kleiner. ` +
      'Nahe der Chandrasekhar-Grenze zündet tief im Kern der Kohlenstoff.';
    acc.onion = [sh(0.97, El.C, 'C-O (entartet)', false), sh(1, El.H, 'aufgesammeltes Gas', true)];
    this.supernova('Supernova Typ Ia', 'thermonukleare Explosion – der weiße Zwerg zerreißt vollständig', 1.38);
    const sn = this.segs[this.segs.length - 1];
    sn.core1 = Norm(Comp(0, 0, 0.02, 0, 0.1, 0, 0.02, 0.2, 0.06, 0.6));
    sn.text = 'Eine Brennfront rast durch den weißen Zwerg und verwandelt in einer Sekunde etwa 0,6 Sonnenmassen in radioaktives Nickel. Weil alle Typ-Ia-Supernovae fast ' +
      'gleich hell sind, dienen sie als „Standardkerzen“ – mit ihnen wurde die beschleunigte Ausdehnung des Universums entdeckt (Nobelpreis 2011). Kein Wasserstoff im Spektrum, ' +
      'dafür Silizium. Der Begleiter fliegt mit Bahngeschwindigkeit davon.';
    this.nothing('Übrig bleibt kein Sternrest – nur die sich ausdehnende Trümmerwolke voller Eisen und der fortgeschleuderte Begleitstern.');
    this.ending = 'Weißer Zwerg + Begleiter → Supernova Typ Ia – kein Überrest'; this.endingShort = 'Typ-Ia-Supernova';
  }

  private nothing(text: string) {
    const n = this.add('Kein Überrest', 1e6, 'Nothing', 5, [0, 1e-3, 3000], [1, 1e-3, 3000]);
    n.rFixed = 1e-9; n.m0 = n.m1 = 0; n.text = text;
    this.remnant = 'kein Überrest'; this.remnantMass = 0;
  }

  private whiteDwarf(mWD: number, kind: string, T0: number) {
    const R = 0.0126 * mWD ** (-1 / 3) * Math.sqrt(Math.max(1 - (mWD / 1.44) ** (4 / 3), 0.02));
    const last = this.segs[this.segs.length - 1];
    if (last && last.rFixed < 0) {
      const p = last.path.slice(), e = p.pop()!;
      if (!p.length || p[p.length - 1][0] < 0.85) p.push([0.85, e[1], e[2]]);
      p.push([1, Lum(R, T0), T0]);
      last.path = p;
    }
    const wd = this.add('Weißer Zwerg', 1e10, 'WhiteDwarf', 5, [0, 1, T0], [0.1, 1, 30000], [0.5, 1, 9000], [1, 1, 4000]);
    wd.rFixed = R; wd.m1 = wd.m0 = mWD; wd.tc0 = 1e8; wd.tc1 = 3e6; wd.rho0 = wd.rho1 = 1e6 * (mWD / 0.6) ** 2;
    wd.reactions = ['keine Fusion mehr – nur Auskühlen'];
    wd.core = `entarteter Kern aus ${kind}, getragen vom Druck der Elektronen`;
    const earth = R * RSunKm / 6371;
    wd.text = `Übrig bleibt ein weißer Zwerg: ${g(mWD)} Sonnenmassen in einer Kugel von ${g0(R * RSunKm)} km – nur ${g(earth, 1)}-mal so groß wie die Erde. Ein Teelöffel davon ` +
      'wöge Tonnen. Ihn trägt allein der Quantendruck der Elektronen (Pauli-Prinzip), deshalb kann er höchstens 1,44 Sonnenmassen haben (Chandrasekhar-Grenze). ' +
      'Er kühlt über Milliarden Jahre aus, sein Kern kristallisiert zu einem „Diamanten“ – nach > 10¹⁵ Jahren wäre er ein schwarzer Zwerg.';
    wd.core1 = wd.core0;
    this.remnantMass = mWD; this.remnant = `Weißer Zwerg (${kind}, ${g(mWD)} M☉)`;
    return wd;
  }

  private massive(m: number, L1: number, T1: number, tMS: number) {
    const { Z, Rot, Wind } = this;
    const I = this.init;
    const zf = (Z / 0.014) ** 0.85;
    const lm = Math.log10(m);
    let loss = (m < 15 ? 0.05 + 0.012 * (m - 9)
      : 0.12 + 0.62 * clamp((lm - 1.1761) / 0.6021, 0, 1) ** 0.8 + 0.06 * clamp((lm - 1.7782) / 0.3979, 0, 1)) * zf + Rot * 0.08;
    loss = clamp(loss * Wind, 0, 0.95);
    let mf = m * (1 - loss);
    let mHe = 0.1077 * m ** 1.35 * (1 + 0.25 * Rot);
    if (mHe > mf) mHe = mf;
    if (Rot > 0.5 && Z < 0.004 && m > 20) mHe = mf;
    let env = mf - mHe;
    const mCO = 0.62 * mHe ** 1.05;
    const Lp = L1 * 1.3;
    const Rsg = Rad(Lp * 1.4, 3600);
    if (this.RocheR < Rsg && env > 0.3) {
      this.Stripped = true;
      env = this.RocheR < 0.3 * Rsg ? 0 : Math.min(env, 0.5);
      mf = mHe + env;
    }
    const Stripped = this.Stripped;
    const wr = env < 0.3, lbv = m > 40 && Z > 0.004 && !Stripped, blueEnd = Z < 0.004 && m > 12 && !wr;
    const yellow = Stripped && !wr;
    const Tend = wr ? 90000 : yellow ? 8000 : blueEnd ? 16000 : 3600 * clamp(Z / 0.014, 0.3, 3) ** -0.04;

    const cr = this.add('Übergang zum Überriesen', 0.012 * tMS, 'Star', 2, [0, L1, T1], [1, Lp, blueEnd ? 20000 : wr && Stripped ? 30000 : 5000]);
    cr.tc1 = 9e7; cr.rho1 = 500; cr.m1 = m - (m - mf) * 0.2;
    cr.reactions = ['H-Schale: 4 ¹H → ⁴He (CNO)'];
    cr.core = 'Heliumkern zieht sich zusammen'; cr.shellBurn = 'Wasserstoff-Schalenbrennen';
    cr.text = 'Der Wasserstoff im Kern ist nach nur ' + fmtYears(tMS) + ' verbraucht. Der Stern kreuzt das HR-Diagramm in wenigen zehntausend Jahren – ' +
      'er bleibt fast gleich hell, bläht sich aber gewaltig auf.';
    cr.onion = [sh(mHe / mf * 0.7, El.He, 'He-Kern', false), sh(mHe / mf, El.H, 'H-Schale', true), sh(1, El.H, 'Hülle', false)];

    const sgName = wr ? (Stripped && mHe < 8 ? 'Nackter Heliumstern' : 'Wolf-Rayet-Stern') : yellow ? 'Gelber Überriese' : blueEnd ? 'Blauer Überriese' : 'Roter Überriese';
    const crT = cr.path[cr.path.length - 1][2];
    const pts: P[] = [[0, Lp, crT]];
    if (lbv && !blueEnd) { pts.push([0.3, Lp * 1.2, 8000], [0.4, Lp * 1.6, 20000], [0.5, Lp * 1.3, 9000]); }
    else if (wr && !Stripped) { pts.push([0.08, Lp * 1.05, 3900], [0.45, Lp * 1.15, 3800], [0.7, Lp * 1.25, 20000]); }
    else if (Stripped) pts.push([0.15, Lp * 1.05, wr ? 12000 : 6000]);
    else if (!blueEnd) pts.push([0.08, Lp * 1.05, Tend * 1.05]);
    pts.push([1, Lp * 1.4, Tend]);
    const he = this.add(lbv && !blueEnd ? 'Leuchtkräftiger Blauer Veränderlicher → ' + sgName : wr && !Stripped ? 'Roter Überriese → ' + sgName : sgName, 0.1 * tMS, 'Star', 2, ...pts);
    he.m1 = mf; he.tc0 = 1.2e8; he.tc1 = 3e8; he.rho0 = 700; he.rho1 = 3000;
    he.core1 = Norm(Comp(0, 0, 0.2, 0, 0.75, I[2] + I[3] + I[4] * 0.3, I[6], I[7], I[8], I[9]));
    he.reactions = ['3 ⁴He → ¹²C + 7,3 MeV', '¹²C + ⁴He → ¹⁶O + γ', 'Schale: 4 ¹H → ⁴He'];
    he.core = 'Heliumbrennen'; he.shellBurn = 'Wasserstoff-Schalenbrennen';
    const why = Stripped ? `Der Begleitstern (${g(this.CompM)} M☉, ${g(this.Sep)} AE entfernt) hat die Hülle über den inneren Lagrange-Punkt abgezogen, als der Stern über ` +
      `≈ ${g0(this.RocheR)} Sonnenradien wuchs. ` : '';
    he.text = wr
      ? why + (Stripped ? 'Übrig ist ein nackter, über 50 000 K heißer Heliumkern' + (mHe < 8 ? ' – zu leicht für die dichten Winde eines echten Wolf-Rayet-Sterns.' : ', der als Wolf-Rayet-Stern weiter Masse abbläst.')
        : 'Erst ein roter Überriese, dann haben starke Winde' + (Rot > 0.3 ? ' (und die schnelle Rotation)' : '') + ' die ganze Wasserstoffhülle fortgeblasen: ' +
        'Ein Wolf-Rayet-Stern – ein nackter, über 50 000 K heißer Heliumkern, der pro Jahr fast eine Hunderttausendstel Sonnenmasse verliert.')
      : yellow ? why + 'Mit nur noch einem dünnen Rest Wasserstoff bleibt er ein gelber Überriese – genau so ein Stern explodierte als SN 1993J (Typ IIb).'
        : blueEnd
          ? 'Metallarm (wie in jungen Galaxien) bleibt der Stern kompakt und blau – auch der Vorgänger der Supernova 1987A war ein blauer Überriese.'
          : `Ein roter Überriese wie Beteigeuze oder Antares: ≈ ${g0(Math.sqrt(Lp * 1.4) * (TSun / 3600) ** 2)} Sonnenradien – an die Stelle der Sonne gesetzt, ` +
          'reichte er bis über die Bahn von Mars oder sogar Jupiter. Riesige Konvektionszellen brodeln an der Oberfläche.' +
          (lbv ? ' Zuvor schleudert er als leuchtkräftiger Blauer Veränderlicher (wie η Carinae) in gewaltigen Ausbrüchen Hülle ab.' : '');
    const shf = mHe / mf;
    he.onion = [sh(mCO / mf * 0.7, El.C, 'Kern: He → C, O', true), sh(shf, El.He, 'Helium', false), sh(Math.min(1, shf * 1.03), El.H, 'H-Schale', true), sh(1, El.H, wr ? '–' : 'Hülle', false)];

    const s25 = 25 / m, Lb = Lp * 1.4;
    const burn = (name: string, yrs: number, tc: number, rho: number, coreEnd: number[], rx: string[], core: string, text: string, onion: Shell[]) => {
      const b = this.add(name, yrs, 'Star', 3, [0, Lb, Tend], [1, Lb * 1.05, Tend]);
      b.tc1 = tc; b.rho1 = rho; b.core1 = coreEnd; b.reactions = rx; b.core = core; b.text = text; b.onion = onion; b.shellBurn = 'mehrere Schalen gleichzeitig';
    };
    const f = 1 / mf;
    const onion = (depth: number) => {
      const l: Shell[] = [];
      const fe = 1.4 * f, si = 1.8 * f, o = mCO * 0.35 * f, ne = mCO * 0.6 * f, c = mCO * f;
      if (depth >= 5) l.push(sh(fe, El.Fe, 'Eisenkern', false));
      if (depth >= 4) l.push(sh(si, El.Si, 'Si, S', depth === 4));
      if (depth >= 3) l.push(sh(o, El.O, 'O', depth === 3));
      if (depth >= 2) l.push(sh(ne, El.Ne, 'O, Ne, Mg', depth === 2));
      l.push(sh(c, El.C, 'C, O', depth === 1));
      l.push(sh(shf, El.He, 'He', true));
      if (!wr) l.push(sh(Math.min(1, shf * 1.02), El.H, 'H-Schale', true), sh(1, El.H, 'Hülle', false));
      return l;
    };
    burn('Kohlenstoffbrennen', 600 * s25 * s25, 8e8, 2e5, Norm(Comp(0, 0, 0.02, 0, 0.6, 0.3, 0.08)),
      ['¹²C + ¹²C → ²⁰Ne + ⁴He', '¹²C + ¹²C → ²³Na + ¹H', 'ab hier tragen Neutrinos die meiste Energie davon'],
      'Kohlenstoffbrennen', 'Ab jetzt rast die Uhr: Der Kern verliert mehr Energie durch Neutrinos als durch Licht. Kohlenstoff brennt in wenigen hundert bis tausend Jahren zu Neon, Natrium und Magnesium – außen merkt man davon nichts.',
      onion(1));
    burn('Neonbrennen', 1.0 * s25 ** 1.5, 1.5e9, 4e6, Norm(Comp(0, 0, 0, 0, 0.75, 0.02, 0.2, 0.03)),
      ['²⁰Ne + γ → ¹⁶O + ⁴He (Photodesintegration)', '²⁰Ne + ⁴He → ²⁴Mg + γ'],
      'Neonbrennen', 'Bei 1,5 Milliarden K zerschlagen energiereiche Gammastrahlen Neonkerne; die frei werdenden Heliumkerne lagern sich an andere an. Dauer: etwa ein Jahr.',
      onion(2));
    burn('Sauerstoffbrennen', 0.5 * s25 ** 1.5, 2.1e9, 1e7, Norm(Comp(0, 0, 0, 0, 0.02, 0, 0.03, 0.6, 0.35)),
      ['¹⁶O + ¹⁶O → ²⁸Si + ⁴He', '¹⁶O + ¹⁶O → ³¹P + ¹H, ³²S + γ'],
      'Sauerstoffbrennen', 'Sauerstoff verschmilzt zu Silizium und Schwefel – in wenigen Monaten.',
      onion(3));
    burn('Siliziumbrennen', 1.0 / 365 * s25, 3.5e9, 1e8, Norm(Comp(0, 0, 0, 0, 0, 0, 0, 0.05, 0.03, 0.92)),
      ['²⁸Si + 7 ⁴He → ⁵⁶Ni (Kette von Alpha-Einfängen)', '⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe', 'Eisen: höchste Bindungsenergie – Fusion liefert keine Energie mehr'],
      'Siliziumbrennen → Eisenkern', 'In nur einem Tag wird Silizium zu Nickel und Eisen. Eisen ist das Ende der Kette: Seine Kerne sind am festesten gebunden, ' +
      'aus ihrer Fusion lässt sich keine Energie mehr gewinnen. Der Eisenkern wächst – ohne Energiequelle.',
      onion(4));

    const col = this.add('Kernkollaps', 1e-8, 'Collapse', 4, [0, Lb, Tend], [1, Lb, Tend]);
    col.event = true; col.tc1 = 1e11; col.rho1 = 3e14; col.onion = onion(5);
    col.reactions = ['⁵⁶Fe + γ → 13 ⁴He + 4 n (Photodesintegration)', 'p + e⁻ → n + ν (Neutronisierung)', '10⁵⁸ Neutrinos tragen 99 % der Energie'];
    col.core = 'Eisenkern stürzt mit ¼ Lichtgeschwindigkeit ein';
    col.text = 'Hat der Eisenkern ≈ 1,4 Sonnenmassen, trägt ihn der Elektronendruck nicht mehr: Er stürzt in einer Zehntelsekunde von Erdgröße auf 20 km zusammen. ' +
      'Protonen und Elektronen verschmelzen zu Neutronen, bis die Kernmaterie hart wird und das einstürzende Material abprallt.';

    let rem: number, bh: boolean;
    const snType = env > 1 ? (blueEnd ? 'Typ II (pekuliar, wie SN 1987A)' : 'Typ II-P') : env > 0.1 ? 'Typ IIb' : (m > 35 || Rot > 0.5 || (Stripped && m > 20) ? 'Typ Ic' : 'Typ Ib');
    if (mHe >= 133) {
      const d = this.add('Direkter Kollaps', 1e-5, 'Collapse', 4, [0, Lb, Tend], [1, Lb, Tend]);
      d.text = 'Ein so gewaltiger Kern lässt sich durch nichts mehr aufhalten: Er stürzt direkt in ein Schwarzes Loch – ohne Explosion. Der Stern verschwindet einfach vom Himmel.';
      d.event = true;
      this.blackHole(mf, false);
      this.ending = `Direkter Kollaps → Schwarzes Loch (${g0(mf)} M☉)`; this.endingShort = 'Direkter Kollaps → Schwarzes Loch';
      return;
    }
    if (mHe >= 64) {
      col.name = 'Paarinstabilität';
      col.reactions = ['γ + γ → e⁺ + e⁻ (Photonen werden zu Materie)', 'explosives Sauerstoffbrennen: ¹⁶O + ¹⁶O → ²⁸Si …', 'bis zu 50 M☉ radioaktives ⁵⁶Ni'];
      col.text = 'Im über einer Milliarde Grad heißen Kern werden Gammaphotonen so energiereich, dass sie sich in Elektron-Positron-Paare verwandeln. Dem Kern fehlt plötzlich Strahlungsdruck – ' +
        'er sackt zusammen, und der Sauerstoff zündet explosiv.';
      this.supernova('Paarinstabilitäts-Supernova', 'hellste Art von Supernova – zerreißt den Stern vollständig', mf);
      this.nothing('Nichts bleibt übrig – kein Neutronenstern, kein Schwarzes Loch. Alles Material, darunter Unmengen Eisen, fliegt ins All. Solche Riesensterne gab es vermutlich ' +
        'vor allem im frühen, metallarmen Universum (Population III).');
      this.ending = 'Paarinstabilitäts-Supernova – kein Überrest'; this.endingShort = 'Paarinstabilität – nichts bleibt';
      return;
    }
    if (mHe >= 32) {
      rem = Math.min(mf, 45); bh = true;
      this.supernova('Pulsierende Paarinstabilität + Kollaps', 'mehrere Ausbrüche schleudern Hülle ab, dann stürzt der Kern ein', mf - rem);
    } else if (mCO < 6.5) {
      rem = Math.min(1.22 + 0.07 * mCO, 2.0); bh = false;
      this.supernova(`Supernova ${snType}`, 'Kernkollaps-Supernova', mf - rem);
    } else if (mCO < 14) {
      const fb = ((mCO - 6.5) / 7.5) ** 2;
      rem = 1.6 + (mf - 1.6) * fb; bh = rem > 2.3;
      this.supernova(`Supernova ${snType}` + (bh ? ' (mit Rückfall)' : ''), bh ? 'ein Teil des Materials fällt zurück' : 'Kernkollaps-Supernova', mf - rem);
    } else {
      rem = mf; bh = true;
      const fs = this.add('Gescheiterte Supernova', 1e-3, 'Collapse', 4, [0, Lb, Tend], [1, Lb * 0.5, Tend]);
      fs.event = true;
      fs.text = 'Die Stoßwelle bleibt stecken: Der Kern ist zu schwer, die Neutrinos schaffen es nicht, sie wiederzubeleben. Der Stern fällt fast vollständig in sich zusammen ' +
        '– nur ein schwaches Aufleuchten, dann ist er verschwunden. (Astronomen haben solche „verschwindenden Sterne“ tatsächlich beobachtet.)';
    }
    const grb = bh && Rot > 0.5 && Z < 0.008 && env < 0.5;
    const magnetar = !bh && Rot > 0.6;
    if (bh) this.blackHole(rem, grb); else this.neutronStar(rem, magnetar);
    const endKind = bh ? `Schwarzes Loch (${g(rem, 1)} M☉)` : magnetar ? `Magnetar (${g(rem)} M☉)` : `Neutronenstern/Pulsar (${g(rem)} M☉)`;
    const sn = this.segs.find(s => s.look === 'Supernova')?.name ?? 'Gescheiterte Supernova';
    this.ending = (grb ? 'Kollapsar mit Gammablitz, ' : '') + sn + ' → ' + endKind;
    this.endingShort = bh ? 'Supernova → Schwarzes Loch' : magnetar ? 'Supernova → Magnetar' : 'Supernova → Neutronenstern';
    if (sn === 'Gescheiterte Supernova') this.endingShort = 'Kollaps → Schwarzes Loch';
  }

  private supernova(name: string, sub: string, ejecta: number) {
    const sn = this.add(name, 1.0, 'Supernova', 4, [0, 1e8, 30000], [0.08, 1e9, 15000], [0.4, 1e8, 7000], [1, 1e7, 5000]);
    sn.event = true; sn.tc1 = 1e9; sn.rho1 = 1;
    sn.reactions = ['explosive Fusion in der Stoßwelle: ²⁸Si → ⁵⁶Ni', 'r-Prozess? schneller Neutroneneinfang (Gold, Uran …)', '⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe lässt das Licht monatelang nachglühen'];
    sn.core = sub;
    sn.text = `Die Stoßwelle – von Neutrinos aus dem Kern neu angefacht – zerreißt den Stern: ${g(ejecta, 1)} Sonnenmassen fliegen mit 10 000 km/s ins All. ` +
      'Für Wochen leuchtet die Supernova heller als ihre ganze Galaxie. In der Stoßwelle entstehen neue Elemente; Eisen, Calcium, Sauerstoff in deinem Körper ' +
      'stammen aus solchen Explosionen. Die Überreste bleiben Zehntausende Jahre als leuchtender Nebel sichtbar (wie der Krebsnebel).';
    sn.m1 = Math.max(sn.m0 - ejecta, 0);
    sn.onion = [];
    sn.core1 = Norm(Comp(0, 0.3, 0.05, 0, 0.3, 0.05, 0.05, 0.1, 0.05, 0.1));
  }

  private neutronStar(mNS: number, magnetar: boolean) {
    const ns = this.add(magnetar ? 'Magnetar' : 'Neutronenstern / Pulsar', 1e7, magnetar ? 'Magnetar' : 'NeutronStar', 5, [0, 1, 1e6], [0.3, 1, 3e5], [1, 1, 8e4]);
    ns.rFixed = 12.0 / RSunKm; ns.m0 = ns.m1 = mNS; ns.tc0 = 1e11; ns.tc1 = 1e8; ns.rho0 = ns.rho1 = 5e14;
    ns.core0 = Comp(0, 0, 0, 0, 0, 0, 0, 0, 0, 1); ns.core1 = ns.core0;
    ns.reactions = ['keine Fusion – Materie aus Neutronen', 'Kruste: Eisenkerne, Kern: Neutronenflüssigkeit (Suprafluid)'];
    ns.core = 'Neutronenmaterie, so dicht wie ein Atomkern';
    ns.text = magnetar
      ? `Ein Magnetar: ${g(mNS)} Sonnenmassen in 24 km Durchmesser mit einem Magnetfeld von 10¹¹ Tesla – dem stärksten im Universum. Sternbeben auf seiner Kruste lösen Gammablitze aus.`
      : `Ein Neutronenstern: ${g(mNS)} Sonnenmassen in einer Kugel von nur 24 km – eine Stadt voller Atomkernmaterie, ein Teelöffel wöge eine Milliarde Tonnen. ` +
      'Er dreht sich (Drehimpulserhaltung!) viele Male pro Sekunde; seine Strahlkegel streichen wie ein Leuchtturm über die Erde – ein Pulsar. Den Neutronenstern hält der ' +
      'Quantendruck der Neutronen; über ≈ 2,3 Sonnenmassen (Tolman-Oppenheimer-Volkoff-Grenze) würde er zum Schwarzen Loch.';
    this.remnant = (magnetar ? 'Magnetar' : 'Neutronenstern') + ` (${g(mNS)} M☉)`; this.remnantMass = mNS;
  }

  private blackHole(mBH: number, grb: boolean) {
    const rs = 2.95 * mBH;
    const bh = this.add(grb ? 'Schwarzes Loch (Kollapsar)' : 'Schwarzes Loch', 1e10, 'BlackHole', 5, [0, 1e-3, 3000], [1, 1e-3, 3000]);
    bh.rFixed = rs / RSunKm; bh.m0 = bh.m1 = mBH; bh.tc0 = bh.tc1 = 1; bh.rho0 = bh.rho1 = 1e16;
    bh.core0 = new Array(10).fill(0); bh.core1 = bh.core0;
    bh.reactions = ['keine – alle Materie ist hinter dem Ereignishorizont verschwunden'];
    bh.core = 'Singularität (nach der Allgemeinen Relativitätstheorie)';
    bh.text = `Nichts kann den Kollaps mehr aufhalten: Ein Schwarzes Loch mit ${g(mBH, 1)} Sonnenmassen und einem Ereignishorizont von ${g0(2 * rs)} km Durchmesser. Selbst Licht entkommt ihm nicht. ` +
      (grb ? 'Weil der Stern schnell rotierte, bildete sich um das junge Loch eine Scheibe, die zwei Jets mit fast Lichtgeschwindigkeit durch den Stern schoss – ein Gammablitz, ' +
        'für Sekunden das hellste Ereignis im Universum.' : 'Es verrät sich nur durch seine Schwerkraft – etwa an einem Begleitstern, oder wenn es Gas verschlingt. (Siehe Seite „Singularität“.)');
    this.remnant = `Schwarzes Loch (${g(mBH, 1)} M☉)`; this.remnantMass = mBH;
  }
}

export const EL_NAMES = ['H', 'He', 'C', 'N', 'O', 'Ne', 'Mg', 'Si', 'S', 'Fe'];
/** Elementfarben wie im Desktop (Innenansicht). */
export const EL_COLORS = ['#ff6b5a', '#ffc94a', '#7d7d86', '#5aa8ff', '#4ad0ff', '#c07cff', '#9ae36a', '#e0a060', '#f3e34a', '#c85a3a'];

/** Schwarzkörperfarbe (sRGB 0..1) für Temperatur T in K – Näherung nach Tanner Helland, für die Anzeige gesättigt. */
export function blackbody(T: number): [number, number, number] {
  const t = clamp(T, 1000, 40000) / 100;
  let r: number, g2: number, b: number;
  if (t <= 66) { r = 255; g2 = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * (t - 60) ** -0.1332; g2 = 288.12 * (t - 60) ** -0.0755; b = 255; }
  return [clamp(r, 0, 255) / 255, clamp(g2, 0, 255) / 255, clamp(b, 0, 255) / 255];
}
