// Sonnensystem – Grundrechnung (Port von PrimSieb/Solar/SolarMath.cs): Vektoren in doppelter Genauigkeit (km, ekliptikale
// Koordinaten J2000: x → Frühlingspunkt, z → ekliptikaler Nordpol), Kepler-Gleichung, Julianisches Datum, Formatierung.
import { isEn } from '../core/i18n';

export class V {
  constructor(readonly x = 0, readonly y = 0, readonly z = 0) {}
  static readonly Zero = new V(0, 0, 0);
  static readonly UnitZ = new V(0, 0, 1);
  add(b: V) { return new V(this.x + b.x, this.y + b.y, this.z + b.z); }
  sub(b: V) { return new V(this.x - b.x, this.y - b.y, this.z - b.z); }
  mul(s: number) { return new V(this.x * s, this.y * s, this.z * s); }
  div(s: number) { return new V(this.x / s, this.y / s, this.z / s); }
  neg() { return new V(-this.x, -this.y, -this.z); }
  dot(b: V) { return this.x * b.x + this.y * b.y + this.z * b.z; }
  cross(b: V) { return new V(this.y * b.z - this.z * b.y, this.z * b.x - this.x * b.z, this.x * b.y - this.y * b.x); }
  get len() { return Math.hypot(this.x, this.y, this.z); }
  get len2() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  get norm() { const l = this.len; return l > 0 ? this.div(l) : new V(1, 0, 0); }
  static lerp(a: V, b: V, t: number) { return a.add(b.sub(a).mul(t)); }
}

export const AU = 149_597_870.7, C = 299_792.458, J2000 = 2451545.0, Deg = Math.PI / 180;
export const GMSun = 1.32712440018e11;          // km³/s²
export const G = 6.674e-20;                     // km³/(kg·s²)
export const Obliquity = 23.43928 * Deg;

/** Richtung aus Rektaszension/Deklination (äquatorial, ICRF) in ekliptikale Koordinaten. */
export function eqToEcl(raDeg: number, decDeg: number): V;
export function eqToEcl(v: V): V;
export function eqToEcl(a: number | V, dec?: number): V {
  if (typeof a === 'number') { const r = a * Deg, d = dec! * Deg; return eqToEcl(new V(Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d))); }
  const c = Math.cos(Obliquity), s = Math.sin(Obliquity);
  return new V(a.x, a.y * c + a.z * s, -a.y * s + a.z * c);
}

export const wrap360 = (a: number) => { a %= 360; return a < 0 ? a + 360 : a; };
const ieeeRem = (x: number, y: number) => x - y * Math.round(x / y);

/** Kepler-Gleichung: exzentrische (e < 1) bzw. hyperbolische Anomalie (e > 1) aus der mittleren Anomalie (rad). */
export function solveKepler(M: number, e: number): number {
  if (e < 1) {
    M = ieeeRem(M, 2 * Math.PI);
    let E = e < 0.8 ? M : Math.PI * Math.sign(M === 0 ? 1 : M);
    for (let i = 0; i < 30; i++) {
      const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return E;
  }
  let H = Math.asinh(M / e);
  for (let i = 0; i < 50; i++) {
    const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return H;
}

/** Julianisches Datum ↔ Zeit (ms seit 1970, UTC). */
export const msToJd = (ms: number) => ms / 86400000 + 2440587.5;
export const jdToMs = (jd: number) => (jd - 2440587.5) * 86400000;
/** „1969-07-16 13:32:00“ (UTC) → JD */
export const T = (s: string) => msToJd(Date.parse(s.replace(' ', 'T') + 'Z'));

export const lambertPhase = (a: number) => (Math.sin(a) + (Math.PI - a) * Math.cos(a)) / Math.PI;

// ------------------------------------------------------------------ Formatierung
const loc = () => (isEn() ? 'en-GB' : 'de-DE');
export const nf = (x: number, max = 3, min = 0) => x.toLocaleString(loc(), { maximumFractionDigits: max, minimumFractionDigits: min });
export function km(v: number): string {
  const a = Math.abs(v), en = isEn();
  if (a >= 0.1 * 63241.08 * AU) return `${nf(v / (63241.08 * AU))} ${en ? 'light years' : 'Lichtjahre'}`;
  if (a >= 0.1 * AU) return `${nf(v / AU)} ${en ? 'AU' : 'AE'}`;
  if (a >= 1e6) return `${nf(v / 1e6, 2)} ${en ? 'million km' : 'Mio. km'}`;
  if (a >= 10) return `${nf(v, 0)} km`;
  if (a >= 1) return `${nf(v, 1)} km`;
  return `${nf(v * 1000, 0)} m`;
}
export function lightTime(v: number): string {
  const s = Math.abs(v) / C, en = isEn();
  if (s < 1) return `${nf(s * 1000, 0)} ms`;
  if (s < 120) return `${nf(s, 1)} s`;
  if (s < 7200) return `${nf(s / 60, 1)} min`;
  if (s < 86400 * 2) return `${nf(s / 3600, 1)} h`;
  if (s < 86400 * 730) return `${nf(s / 86400, 1)} ${en ? 'days' : 'Tage'}`;
  return `${nf(s / (86400 * 365.25), 1)} ${en ? 'years' : 'Jahre'}`;
}
export function duration(days: number): string {
  const a = Math.abs(days), en = isEn();
  if (a < 1 / 24) return `${nf(days * 1440, 1)} min`;
  if (a < 2) return `${nf(days * 24, 2)} h`;
  if (a < 700) return `${nf(days, 2)} ${en ? 'days' : 'Tage'}`;
  return `${nf(days / 365.25, 2)} ${en ? 'years' : 'Jahre'}`;
}
export function sci(x: number): string {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${nf(x / 10 ** e)}·10${sup}`;
}
/** Kleiner deterministischer Zufall (für unbekannte Bahnwinkel aus dem Namen – wie am Desktop, nur anderer Generator). */
export function rng(seed: number) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
