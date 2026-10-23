// Sonnensystem – Ephemeriden (Port von PrimSieb/Solar/SolarSim.cs): Orte aus Bahnelementen (doppelte Genauigkeit),
// Körperachsen nach IAU, Oberflächenpunkte, Meteorstrom-Punkte, Bahnlinien und die Kleinkörper-Wolke.
import { AU, Deg, GMSun, J2000, V, eqToEcl, rng, solveKepler } from './math';
import { BODIES, Body, STREAM_SOURCE, find, idx } from './catalog';

const EqNorth = eqToEcl(new V(0, 0, 1));
let pole: V[] = [], rotW0: number[] = [], rotWd: number[] = [];
let EARTH = 0, MOON = 0;
const MoonFrac = 7.342e22 / (5.972e24 + 7.342e22);

/** Nach dem Aufbau des Katalogs einmal aufrufen. */
export function initEphem() {
  EARTH = idx('Erde'); MOON = idx('Mond');
  pole = []; rotW0 = []; rotWd = [];
  for (const b of BODIES) {
    const r = rng(Math.floor(b.seed * 1000) + 7);
    if (!isNaN(b.poleRa)) { pole[b.index] = eqToEcl(b.poleRa, b.poleDec); rotW0[b.index] = b.W0; rotWd[b.index] = b.Wd; }
    else {
      const th = Math.acos(1 - r() * 1.2), ph = r() * 2 * Math.PI;
      pole[b.index] = new V(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
      rotW0[b.index] = r() * 360; rotWd[b.index] = 360 * 24 / (5 + 20 * r());
    }
  }
}
export const poleOf = (i: number) => pole[i];

type Basis = [V, V, V];
function planeBasisPole(p: V): Basis {
  let q = EqNorth.cross(p);
  q = q.len < 1e-9 ? eqToEcl(90, 0) : q.norm;
  return [q, p.cross(q), p];
}
export const equatorBasis = (i: number) => planeBasisPole(pole[i]);
const apply = ([q, r, p]: Basis, v: V) => q.mul(v.x).add(r.mul(v.y)).add(p.mul(v.z));

function toFrame(b: Body, v: V): V {
  const o = b.orbit!;
  if (!isNaN(o.lapRa)) return apply(planeBasisPole(eqToEcl(o.lapRa, o.lapDec)), v);
  if (o.equatorial && b.parent >= 0) return apply(equatorBasis(b.parent), v);
  return v;
}

function rotate(x: number, y: number, I: number, W: number, om: number): V {
  const cw = Math.cos(om), sw = Math.sin(om), cW = Math.cos(W), sW = Math.sin(W), ci = Math.cos(I), si = Math.sin(I);
  return new V((cw * cW - sw * sW * ci) * x + (-sw * cW - cw * sW * ci) * y,
               (cw * sW + sw * cW * ci) * x + (-sw * sW + cw * cW * ci) * y,
               sw * si * x + cw * si * y);
}
export function kepler(a: number, e: number, I: number, W: number, om: number, M: number): V {
  let x: number, y: number;
  if (e < 1) { const E = solveKepler(M, e); x = a * (Math.cos(E) - e); y = a * Math.sqrt(1 - e * e) * Math.sin(E); }
  else { const H = solveKepler(M, e), aa = Math.abs(a); x = aa * (e - Math.cosh(H)); y = aa * Math.sqrt(e * e - 1) * Math.sinh(H); }
  return rotate(x, y, I, W, om);
}
/** Bahnebene (P → Perizentrum, Q → 90° weiter) in Ekliptik-Koordinaten. */
export const planeBasis = (I: number, W: number, om: number): [V, V] => [rotate(1, 0, I, W, om), rotate(0, 1, I, W, om)];

function meanMotion(b: Body) {
  const gm = b.parent <= 0 ? GMSun : BODIES[b.parent].GM + b.GM;
  const a = Math.abs(b.orbit!.A);
  return Math.sqrt(gm / (a * a * a)) * 86400;            // rad/Tag
}
export function period(b: Body): number {
  const o = b.orbit;
  if (!o) return Infinity;
  if (o.kind === 'Jpl') return 360 / (o.dL / 36525);
  if (o.kind === 'Moon') return 27.321661;
  if (o.kind === 'MeanLon') return 360 / o.N;
  if (o.kind === 'Kepler' && o.E < 1) return 2 * Math.PI / (o.N > 0 ? o.N * Deg : meanMotion(b));
  return Infinity;
}

/** Mond (geozentrisch, km) nach vereinfachter Mondtheorie (P. Schlyter) mit den wichtigsten Störungen. */
export function moonGeo(jd: number): V {
  const d = jd - 2451543.5;
  const N = 125.1228 - 0.0529538083 * d, i = 5.1454, w = 318.0634 + 0.1643573223 * d, e = 0.0549, M = 115.3654 + 13.0649929509 * d;
  const E = solveKepler(M * Deg, e);
  const xv = 60.2666 * (Math.cos(E) - e), yv = 60.2666 * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv); let r = Math.hypot(xv, yv);
  const Nr = N * Deg, ir = i * Deg, vw = v + w * Deg;
  const xh = r * (Math.cos(Nr) * Math.cos(vw) - Math.sin(Nr) * Math.sin(vw) * Math.cos(ir));
  const yh = r * (Math.sin(Nr) * Math.cos(vw) + Math.cos(Nr) * Math.sin(vw) * Math.cos(ir));
  const zh = r * Math.sin(vw) * Math.sin(ir);
  let lon = Math.atan2(yh, xh) / Deg, lat = Math.atan2(zh, Math.hypot(xh, yh)) / Deg;
  const Ms = 356.047 + 0.9856002585 * d, ws = 282.9404 + 4.70935e-5 * d, Ls = Ms + ws, Lm = N + w + M, D = Lm - Ls, F = Lm - N;
  const s = (deg: number) => Math.sin(deg * Deg), c = (deg: number) => Math.cos(deg * Deg);
  lon += -1.274 * s(M - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms) - 0.059 * s(2 * M - 2 * D) - 0.057 * s(M - 2 * D + Ms)
    + 0.053 * s(M + 2 * D) + 0.046 * s(2 * D - Ms) + 0.041 * s(M - Ms) - 0.035 * s(D) - 0.031 * s(M + Ms) - 0.015 * s(2 * F - 2 * D) + 0.011 * s(M - 4 * D);
  lat += -0.173 * s(F - 2 * D) - 0.055 * s(M - F - 2 * D) - 0.046 * s(M + F - 2 * D) + 0.033 * s(F + 2 * D) + 0.017 * s(2 * M + F);
  r += -0.58 * c(M - 2 * D) - 0.46 * c(2 * D);
  r *= 6378.14;
  const lo = lon * Deg, la = lat * Deg;
  return new V(r * Math.cos(lo) * Math.cos(la), r * Math.sin(lo) * Math.cos(la), r * Math.sin(la));
}

/** Ort relativ zum Mutterkörper (km, Ekliptik J2000). */
export function rel(b: Body, jd: number, earthPos?: V): V {
  const o = b.orbit;
  if (!o) return V.Zero;
  const d = jd - J2000;
  switch (o.kind) {
    case 'Jpl': {
      const T = d / 36525;
      const a = o.A + o.dA * T, e = o.E + o.dE * T, I = (o.I + o.dI * T) * Deg, L = o.L0 + o.dL * T, w = o.Varpi + o.dVarpi * T, W = (o.Node + o.dNode * T) * Deg;
      return kepler(a * AU, e, I, W, w * Deg - W, (L - w) * Deg);
    }
    case 'Kepler': {
      const n = o.N > 0 ? o.N * Deg : meanMotion(b);
      return toFrame(b, kepler(o.A, o.E, o.I * Deg, o.Node * Deg, o.Peri * Deg, o.M0 * Deg + n * (jd - o.Epoch)));
    }
    case 'Moon': return moonGeo(jd);
    case 'Radial': return o.dir.mul(o.R0 + o.vel * (jd - o.Epoch));
    case 'Mission': return o.mission!.at(jd).sub(b.parent > 0 ? abs(BODIES[b.parent], jd) : V.Zero);
    case 'L2': {
      const earth = earthPos ?? abs(BODIES[b.parent], jd);
      const u = earth.norm, side = V.UnitZ.cross(u).norm, ph = 2 * Math.PI * d / 182.6;
      return u.mul(1.5e6).add(side.mul(8e5 * Math.cos(ph))).add(V.UnitZ.mul(4e5 * Math.sin(ph)));
    }
  }
  return V.Zero;
}

/** Heliozentrischer Ort eines einzelnen Körpers (rekursiv über die Mutterkörper). */
export function abs(b: Body, jd: number): V {
  if (b.index === 0) return V.Zero;
  if (b.kind === 'Stream') return streamPoint(b.index);
  const p = b.parent >= 0 ? abs(BODIES[b.parent], jd) : V.Zero;
  let r = rel(b, jd);
  if (b.index === EARTH) r = r.sub(moonGeo(jd).mul(MoonFrac));        // Tabelle gilt für den Schwerpunkt Erde–Mond
  return p.add(r);
}
/** Heliozentrische Geschwindigkeit (km/Tag), numerisch. */
export const vel = (b: Body, jd: number, h = 0.01) => abs(b, jd + h).sub(abs(b, jd - h)).div(2 * h);

/** Alle Orte zum Zeitpunkt jd (in Katalog-Reihenfolge: Mutterkörper stehen immer vor ihren Monden). */
export function computeAll(jd: number, out: V[]) {
  const mg = moonGeo(jd);
  for (let i = 0; i < BODIES.length; i++) {
    const b = BODIES[i];
    if (i === 0) { out[0] = V.Zero; continue; }
    if (b.kind === 'Stream') { out[i] = streamPoint(i); continue; }
    let r = i === MOON ? mg : rel(b, jd, b.orbit?.kind === 'L2' ? out[b.parent] : undefined);
    if (i === EARTH) r = r.sub(mg.mul(MoonFrac));
    out[i] = b.orbit?.kind === 'Mission' ? b.orbit.mission!.at(jd) : out[b.parent].add(r);
  }
}

/** Körperachsen (Nullmeridian, Nordpol, Osten) zur Zeit jd – drehen sich mit dem Körper. */
export function frame(i: number, jd: number): Basis {
  const b = BODIES[i];
  let P: V, M: V;
  if (b.locked && b.parent >= 0 && b.orbit) {
    const r = rel(b, jd), rn = rel(b, jd + 0.001).sub(r);
    P = r.cross(rn).norm;
    const toParent = r.neg();
    M = toParent.sub(P.mul(toParent.dot(P))).norm;
  } else {
    P = pole[i];
    let q = EqNorth.cross(P); q = q.len < 1e-9 ? eqToEcl(90, 0) : q.norm;
    const W = ((rotW0[i] + rotWd[i] * (jd - J2000)) % 360) * Deg;
    M = q.mul(Math.cos(W)).add(P.cross(q).mul(Math.sin(W)));
  }
  return [M, P, P.cross(M)];
}

/** Punkt auf/über der Oberfläche (Breite, Länge Ost in Grad, Höhe km), heliozentrisch zur Zeit jd. */
export function surfacePoint(i: number, latDeg: number, lonDeg: number, altKm: number, jd: number): V {
  const [ex, ey, ez] = frame(i, jd), la = latDeg * Deg, lo = lonDeg * Deg;
  const n = ex.mul(Math.cos(la) * Math.cos(lo)).add(ey.mul(Math.sin(la))).add(ez.mul(Math.cos(la) * Math.sin(lo)));
  return abs(BODIES[i], jd).add(n.mul(BODIES[i].R + altKm));
}

/** Meteorstrom: Punkt der Mutterbahn, an dem sie der Erdbahn (1 AE) am nächsten kommt. */
const streamPts = new Map<number, V>();
function streamPoint(i: number): V {
  const hit = streamPts.get(i); if (hit) return hit;
  const src = BODIES[STREAM_SOURCE.get(i)!].orbit!;
  const [P, Q] = planeBasis(src.I * Deg, src.Node * Deg, src.Peri * Deg);
  const p = src.A * (1 - src.E * src.E);
  let best = Infinity, v = V.Zero;
  for (const nu0 of [-src.Peri, 180 - src.Peri]) {
    const nu = nu0 * Deg, r = p / (1 + src.E * Math.cos(nu));
    if (r <= 0) continue;
    const dd = Math.abs(r - AU);
    if (dd < best) { best = dd; v = P.mul(Math.cos(nu)).add(Q.mul(Math.sin(nu))).mul(r); }
  }
  streamPts.set(i, v);
  return v;
}

/** Punkte der Bahn relativ zum Mutterkörper (km): n Stück über einen Umlauf bzw. einen Bogen der offenen Bahn. */
export function orbitPath(b: Body, jd: number, n: number): V[] {
  const o = b.orbit;
  if (!o || o.kind === 'Radial' || o.kind === 'Fixed' || o.kind === 'L2' || o.kind === 'Mission') return [];
  const per = period(b), pts: V[] = [];
  if (o.kind === 'Kepler' && o.E >= 0.6) {
    for (let k = 0; k < n; k++) {
      let M: number;
      if (o.E < 1) { const E = (k / (n - 1)) * 2 * Math.PI - Math.PI; M = E - o.E * Math.sin(E); }
      else { const H = (k / (n - 1) * 2 - 1) * Math.acosh(Math.max(1.0001, (1 + 60 * AU / Math.abs(o.A)) / o.E)); M = o.E * Math.sinh(H) - H; }
      pts.push(toFrame(b, kepler(o.A, o.E, o.I * Deg, o.Node * Deg, o.Peri * Deg, M)));
    }
    return pts;
  }
  if (!isFinite(per)) return [];
  for (let k = 0; k < n; k++) pts.push(rel(b, jd + per * k / (n - 1)));
  return pts;
}

// ------------------------------------------------------------------ Kleinkörper (fürs Handy etwa ein Fünftel des Desktops)
export interface Dots { count: number; A: Float64Array; E: Float64Array; N: Float64Array; M0: Float64Array; B: Float64Array; P: Float64Array; Q: Float64Array; col: Float32Array; size: Float32Array; group: Uint8Array }

export function buildDots(scale = 0.2): Dots {
  const C = (n: number) => Math.max(50, Math.round(n * scale));
  const nMain = C(22000), nTroj = C(4000), nHilda = C(1500), nNeo = C(900), nKuiper = C(9000), nPlut = C(2500), nScat = C(2500), nOort = C(7000), nStream = C(2400);
  const total = nMain + nTroj + nHilda + nNeo + nKuiper + nPlut + nScat + nOort + nStream * 5;
  const d: Dots = { count: 0, A: new Float64Array(total), E: new Float64Array(total), N: new Float64Array(total), M0: new Float64Array(total), B: new Float64Array(total),
    P: new Float64Array(total * 3), Q: new Float64Array(total * 3), col: new Float32Array(total * 3), size: new Float32Array(total), group: new Uint8Array(total) };
  const rnd = rng(1234);
  const G = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const Ray = (s: number) => s * Math.sqrt(-2 * Math.log(1 - rnd()));
  const PowR = (rmin: number, rmax: number, q: number) => Math.min(rmax, rmin * Math.pow(1 - rnd(), -1 / q));
  const jup = find('Jupiter')!.orbit!, nep = find('Neptun')!.orbit!;
  const lamJ = jup.L0, lamN = nep.L0, nJ = jup.dL / 36525 * Deg, nN = nep.dL / 36525 * Deg;
  let k = 0;
  const put = (g: number, aAu: number, e: number, iDeg: number, node: number, peri: number, M: number, size: number, col: number[], nOverride = 0) => {
    const a = aAu * AU;
    d.A[k] = a; d.E[k] = e; d.B[k] = a * Math.sqrt(Math.max(1 - e * e, 0));
    d.N[k] = nOverride > 0 ? nOverride : Math.sqrt(GMSun / (a * a * a)) * 86400;
    const [P, Q] = planeBasis(iDeg * Deg, node * Deg, peri * Deg);
    d.P.set([P.x, P.y, P.z], k * 3); d.Q.set([Q.x, Q.y, Q.z], k * 3);
    d.M0[k] = M * Deg; d.size[k] = size; d.col.set(col, k * 3); d.group[k] = g;
    k++;
  };
  const sType = [0.62, 0.55, 0.47], cType = [0.45, 0.44, 0.43], kbo = [0.7, 0.5, 0.38], ice = [0.75, 0.8, 0.9];
  const gaps = [2.06, 2.5, 2.82, 2.95, 3.27];
  for (let i = 0; i < nMain; i++) {
    let a: number;
    do { a = 2.15 + Math.pow(rnd(), 0.85) * 1.2; } while (gaps.some(g => Math.abs(a - g) < 0.025 * (1 - Math.abs(a - g) / 0.025 * rnd())));
    const outer = a > 2.7;
    put(0, a, Math.min(Ray(0.09), 0.35), Ray(7), rnd() * 360, rnd() * 360, rnd() * 360, PowR(1.5, 150, 2.3), outer ? cType : sType);
  }
  for (let i = 0; i < nHilda; i++) {
    const e = 0.08 + rnd() * 0.22, varpi = rnd() * 360, node = rnd() * 360;
    const lam = (3 * lamJ - varpi) / 2 + Math.floor(rnd() * 2) * 180 + G() * 12;
    put(1, 3.97, e, Ray(6), node, varpi - node, lam - varpi, PowR(2, 80, 2.3), cType, nJ * 1.5);
  }
  for (let i = 0; i < nTroj; i++) {
    const node = rnd() * 360, varpi = rnd() * 360, lam = lamJ + (rnd() < 0.5 ? 60 : -60) + G() * 13;
    put(2, 5.2026, Ray(0.06), Ray(12), node, varpi - node, lam - varpi, PowR(2, 120, 2.2), cType, nJ);
  }
  for (let i = 0; i < nNeo; i++) {
    const a = 0.8 + rnd() * 1.8, q = 0.6 + rnd() * 0.7, e = Math.min(0.85, Math.max(0.02, 1 - q / a));
    put(3, a, e, Ray(10), rnd() * 360, rnd() * 360, rnd() * 360, PowR(0.3, 20, 2), sType);
  }
  for (let i = 0; i < nKuiper; i++) {
    const cold = rnd() < 0.55;
    put(4, 42 + rnd() * 5.5, cold ? Ray(0.03) : Ray(0.07), cold ? Ray(2) : Ray(14), rnd() * 360, rnd() * 360, rnd() * 360, PowR(20, 600, 2.5), cold ? kbo : [0.6, 0.55, 0.5]);
  }
  for (let i = 0; i < nPlut; i++) {
    const varpi = rnd() * 360, node = rnd() * 360, lam = (2 * lamN + varpi + 180) / 3 + Math.floor(rnd() * 3) * 120 + G() * 20;
    put(5, 39.4, 0.1 + rnd() * 0.2, Ray(10), node, varpi - node, lam - varpi, PowR(20, 500, 2.5), kbo, nN * 2 / 3);
  }
  for (let i = 0; i < nScat; i++) {
    const a = 50 + Math.pow(rnd(), 2) * 250, q = 32 + rnd() * 12;
    put(6, a, 1 - q / a, Ray(18), rnd() * 360, rnd() * 360, rnd() * 360, PowR(30, 600, 2.5), kbo);
  }
  for (let i = 0; i < nOort; i++) {
    const a = Math.exp(Math.log(2000) + rnd() * Math.log(50)), e = Math.sqrt(rnd()) * 0.9;
    put(7, a, e, Math.acos(1 - 2 * rnd()) / Deg, rnd() * 360, rnd() * 360, rnd() * 360, PowR(1, 50, 2), ice);
  }
  for (const srcName of ['Swift-Tuttle', 'Tempel-Tuttle', 'Phaethon', 'Halley', 'Encke']) {
    const o = find(srcName)!.orbit!, aAu = o.A / AU;
    for (let i = 0; i < nStream; i++) {
      const a = aAu * (1 + G() * 0.015), e = Math.min(0.995, Math.max(0, o.E + G() * 0.004));
      const nuMax = Math.acos(Math.min(1, Math.max(-1, (a * (1 - e * e) / 8 - 1) / e)));
      const nu = (rnd() * 2 - 1) * Math.min(nuMax, Math.PI);
      const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)), M = (E - e * Math.sin(E)) / Deg;
      const nNow = Math.sqrt(GMSun / Math.pow(a * AU, 3)) * 86400;
      put(8, a, e, o.I + G() * 0.8, o.Node + G() * 1.5, o.Peri + G(), M - nNow / Deg * (2460600 - J2000), PowR(0.0005, 0.01, 3), [0.8, 0.82, 0.9]);
    }
  }
  d.count = k;
  return d;
}

/** Orte der Wolke (heliozentrisch, km) relativ zum Bezugspunkt ref → Float32 (Kamera-relativ, Einheit unit km). */
export function updateDots(d: Dots, jd: number, ref: V, unit: number, out: Float32Array) {
  const t = jd - J2000;
  for (let i = 0; i < d.count; i++) {
    const e = d.E[i], E = solveKepler(d.M0[i] + d.N[i] * t, e);
    const x = d.A[i] * (Math.cos(E) - e), y = d.B[i] * Math.sin(E), j = i * 3;
    out[j] = (d.P[j] * x + d.Q[j] * y - ref.x) / unit;
    out[j + 1] = (d.P[j + 1] * x + d.Q[j + 1] * y - ref.y) / unit;
    out[j + 2] = (d.P[j + 2] * x + d.Q[j + 2] * y - ref.z) / unit;
  }
}
