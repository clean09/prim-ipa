// Sonnensystem – Katalog (Port von PrimSieb/Solar/SolarBodies.cs). Die Daten selbst stehen in catalog_data.ts
// (aus der Desktop-Datei erzeugt), englische Texte in en.json (aus Loc.Solar.cs / Loc.SolarBodies.cs).
import { isEn } from '../core/i18n';
import { AU, Deg, G, J2000, V, eqToEcl, rng } from './math';
import type { Mission } from './missions';
import EN from './en.json';

export type BodyKind = 'Star' | 'Planet' | 'Dwarf' | 'Moon' | 'Asteroid' | 'Comet' | 'Probe' | 'Stream';

/** Oberflächen-Typen (wie Solar.hlsl am Desktop). */
export const Surf = {
  Sun: 0, Rock: 1, Venus: 2, Earth: 3, Mars: 4, Gas: 5, IceGiant: 6, Icy: 7, Io: 8, Titan: 9, Europa: 10, Pluto: 11,
  Irregular: 12, Nucleus: 13, Enceladus: 14, Iapetus: 15, Triton: 16, Craft: 17, None: 99,
} as const;

export type OrbitKind = 'Jpl' | 'Kepler' | 'Moon' | 'MeanLon' | 'Radial' | 'L2' | 'Fixed' | 'Mission';
export interface Orbit {
  kind: OrbitKind;
  mission?: Mission;
  A: number; E: number; I: number; Node: number; Peri: number; M0: number; Epoch: number; N: number;
  dA: number; dE: number; dI: number; dL: number; dVarpi: number; dNode: number; L0: number; Varpi: number;
  equatorial: boolean; lapRa: number; lapDec: number;
  dir: V; R0: number; vel: number;
}
const blank = (): Orbit => ({ kind: 'Kepler', A: 0, E: 0, I: 0, Node: 0, Peri: 0, M0: 0, Epoch: J2000, N: 0, dA: 0, dE: 0, dI: 0, dL: 0, dVarpi: 0, dNode: 0, L0: 0, Varpi: 0,
  equatorial: false, lapRa: NaN, lapDec: 0, dir: V.Zero, R0: 0, vel: 0 });
export const orbitKind = (k: OrbitKind): Orbit => ({ ...blank(), kind: k });

export const Orbit = {
  /** Planeten nach Standish (JPL): Werte in AE bzw. Grad, je Jahrhundert. */
  Jpl: (a: number, da: number, e: number, de: number, i: number, di: number, L: number, dL: number, varpi: number, dvarpi: number, node: number, dnode: number): Orbit =>
    ({ ...blank(), kind: 'Jpl', A: a, dA: da, E: e, dE: de, I: i, dI: di, L0: L, dL, Varpi: varpi, dVarpi: dvarpi, Node: node, dNode: dnode }),
  /** Mond auf Kepler-Bahn (km, Grad, Umlaufzeit in Tagen; negativ = rückläufig). */
  Sat: (aKm: number, e: number, i: number, periodDays: number, equatorial = true, node = NaN, peri = NaN, m0 = NaN): Orbit =>
    ({ ...blank(), A: aKm, E: e, I: periodDays < 0 ? 180 - i : i, N: 360 / Math.abs(periodDays), equatorial, Node: node, Peri: peri, M0: m0 }),
  /** Mond nach JPL „Planetary Satellite Mean Elements“ mit Pol der Bezugsebene (RA/Dec; NaN = Ekliptik). */
  SatJ: (aKm: number, e: number, w: number, M: number, i: number, node: number, periodDays: number, poleRa: number, poleDec: number, epoch = J2000): Orbit =>
    ({ ...blank(), A: aKm, E: e, Peri: w, M0: M, I: i, Node: node, N: 360 / periodDays, Epoch: epoch, lapRa: poleRa, lapDec: poleDec }),
  Helio: (aAu: number, e: number, i: number, node: number, peri: number, m0: number, epoch: number): Orbit =>
    ({ ...blank(), A: aAu * AU, E: e, I: i, Node: node, Peri: peri, M0: m0, Epoch: epoch }),
  Comet: (q: number, e: number, i: number, node: number, peri: number, tPeri: number): Orbit =>
    ({ ...blank(), A: q / (1 - e) * AU, E: e, I: i, Node: node, Peri: peri, M0: 0, Epoch: tPeri }),
  HelioAt: (aAu: number, e: number, i: number, node: number, peri: number, nuDeg: number, t: number): Orbit => {
    const nu = nuDeg * Deg, E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
    return Orbit.Helio(aAu, e, i, node, peri, (E - e * Math.sin(E)) / Deg, t);
  },
  Radial: (raDeg: number, decDeg: number, rAu: number, auPerYear: number, epochJd: number): Orbit =>
    ({ ...blank(), kind: 'Radial', dir: eqToEcl(raDeg, decDeg), R0: rAu * AU, vel: auPerYear * AU / 365.25, Epoch: epochJd }),
};

const rgb = (c: number): [number, number, number] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

export class Body {
  index = 0; name = ''; type = ''; kind: BodyKind = 'Planet';
  parent = -1; parentName: string | null = null;
  R = 0; flat = 0; ax = 1; ay = 1; az = 1; bilobed = false;
  mass = 0; albedo = 0; surf = 0; variant = 0;
  col1: [number, number, number] = [1, 1, 1]; col2: [number, number, number] = [1, 1, 1];
  atmoH = 0; atmoCol: [number, number, number] = [0, 0, 0]; atmoDen = 0;
  ringIn = 0; ringOut = 0; ringKind = 0;
  poleRa = NaN; poleDec = 0; W0 = 0; Wd = 0;
  locked = false;
  orbit: Orbit | null = null;
  info = ''; facts: [string, string][] = [];
  activity = 1; seed = 0; approx = false;
  get GM() { return this.mass * G; }
  get rendered() { return this.surf !== Surf.None; }
  get bound() { return this.R * Math.max(1, this.ax, this.ay, this.az); }
  Pole(ra: number, dec: number, w0: number, wd: number) { this.poleRa = ra; this.poleDec = dec; this.W0 = w0; this.Wd = wd; return this; }
  Lock() { this.locked = true; return this; }
  Atmo(h: number, col: number, den: number) { this.atmoH = h; this.atmoCol = rgb(col); this.atmoDen = den; return this; }
  Rings(rin: number, rout: number, kind: number) { this.ringIn = rin; this.ringOut = rout; this.ringKind = kind; return this; }
  Shape(a: number, b: number, c: number, bilobed = false) { this.R = Math.max(a, b, c); this.ax = a / this.R; this.ay = b / this.R; this.az = c / this.R; this.bilobed = bilobed; return this; }
  Oblate(f: number) { this.flat = f; return this; }
  V(v: number) { this.variant = v; return this; }
  Act(a: number) { this.activity = a; return this; }
  Rough() { this.approx = true; return this; }
}

export const BODIES: Body[] = [];
const byName = new Map<string, number>();
/** Meteorstrom → Index des Mutterkörpers. */
export const STREAM_SOURCE = new Map<number, number>();

export function find(name: string) { const i = byName.get(name); return i == null ? undefined : BODIES[i]; }
export const idx = (name: string) => byName.get(name)!;

export function add(name: string, kind: BodyKind, parent: string | null, r: number, mass: number, albedo: number, surf: number, c1: number, c2: number,
  orbit: Orbit | null, type: string, info: string, ...facts: string[]): Body {
  const b = new Body();
  Object.assign(b, { index: BODIES.length, name, kind, parentName: parent, R: r, mass, albedo, surf, col1: rgb(c1), col2: rgb(c2), orbit, type, info });
  b.facts = facts.map(f => { const k = f.indexOf('|'); return [f.slice(0, k), f.slice(k + 1)] as [string, string]; });
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  b.seed = (h % 10000) / 10000 * 97.3;
  if (parent != null) b.parent = byName.get(parent)!;
  if (orbit && orbit.kind === 'Kepler') {
    const r = rng(h);
    if (isNaN(orbit.Node)) { orbit.Node = r() * 360; b.approx = true; }
    if (isNaN(orbit.Peri)) orbit.Peri = r() * 360;
    if (isNaN(orbit.M0)) { orbit.M0 = r() * 360; b.approx = true; }
  }
  byName.set(name, b.index);
  BODIES.push(b);
  return b;
}

export function stream(name: string, parent: string, type: string, info: string, ...facts: string[]) {
  const b = add(name, 'Stream', 'Sonne', 0.001, 0, 0, Surf.None, 0xffffff, 0xffffff, null, type, info, ...facts);
  b.orbit = orbitKind('Fixed');
  b.parentName = parent;
  b.parent = 0;
  STREAM_SOURCE.set(b.index, idx(parent));
}

// ------------------------------------------------------------------ Englisch
const en = EN as Record<string, string>;
/** Text übersetzen (Deutsch ist die Quelle; fehlt eine Übersetzung, bleibt Deutsch stehen). */
export const tr = (de: string) => (isEn() ? en[de] ?? de : de);
export const nameOf = (b: Body) => tr(b.name);

export const KIND_NAME: Record<BodyKind, [string, string]> = {
  Star: ['Stern', 'Star'], Planet: ['Planeten', 'Planets'], Dwarf: ['Zwergplaneten', 'Dwarf planets'], Moon: ['Monde', 'Moons'],
  Asteroid: ['Asteroiden', 'Asteroids'], Comet: ['Kometen', 'Comets'], Probe: ['Raumfahrt', 'Spaceflight'], Stream: ['Meteorströme', 'Meteor showers'],
};
