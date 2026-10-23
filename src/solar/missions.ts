// Sonnensystem – Missionen (Port von PrimSieb/Solar/Missions.cs): Lambert-Problem, Kepler-Bahn aus Zustandsvektor und die
// Missionen mit echten Zeitpunkten (UTC), Startplätzen, Landestellen und Vorbeiflug-Abständen. Bahnen schließen lückenlos an;
// Geschwindigkeitssprünge zwischen den Abschnitten sind die Triebwerkszündungen.
import { AU, Deg, GMSun, T, V, eqToEcl } from './math';
import { BODIES, Body, find, idx, orbitKind, Surf } from './catalog';
import { abs, frame, rel, surfacePoint, vel } from './ephem';

type F = (t: number) => V;

// ------------------------------------------------------------------ Bahnmechanik
const Cs = (z: number) => Math.abs(z) < 1e-3 ? 0.5 - z / 24 + z * z / 720 : z > 0 ? (1 - Math.cos(Math.sqrt(z))) / z : (Math.cosh(Math.sqrt(-z)) - 1) / -z;
function Ss(z: number) {
  if (Math.abs(z) < 1e-3) return 1 / 6 - z / 120 + z * z / 5040;
  if (z > 0) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
  const t = Math.sqrt(-z); return (Math.sinh(t) - t) / (t * t * t);
}
/** Lambert-Problem (universelle Variablen, nach Curtis), Bisektion – robust auch hyperbolisch. nref legt den Umlaufsinn fest. */
export function lambert(r1: V, r2: V, dt: number, mu: number, nref: V): V {
  const R1 = r1.len, R2 = r2.len;
  const cos = Math.min(1, Math.max(-1, r1.dot(r2) / (R1 * R2)));
  let th = Math.acos(cos);
  if (r1.cross(r2).dot(nref) < 0) th = 2 * Math.PI - th;
  const A = Math.sin(th) * Math.sqrt(R1 * R2 / Math.max(1 - cos, 1e-12));
  const Y = (z: number) => R1 + R2 + A * (z * Ss(z) - 1) / Math.sqrt(Cs(z));
  const Fz = (z: number) => { const y = Y(z); if (y < 0 || isNaN(y)) return -Infinity; return Math.pow(y / Cs(z), 1.5) * Ss(z) + A * Math.sqrt(y) - Math.sqrt(mu) * dt; };
  let lo = -4e4, hi = 4 * Math.PI * Math.PI - 1e-9;
  for (let k = 0; k < 200; k++) { const m = 0.5 * (lo + hi), f = Fz(m); if (isNaN(f) || f > 0) hi = m; else lo = m; }
  const yv = Y(0.5 * (lo + hi));
  const fl = 1 - yv / R1, g = A * Math.sqrt(yv / mu);
  return r2.sub(r1.mul(fl)).div(g);
}

/** Kepler-Bahn (Ellipse oder Hyperbel) aus Ort (km) und Geschwindigkeit (km/s) zur Zeit t0 (JD). */
export class Conic {
  private p: V; private q: V; private a: number; private e: number; private n: number; private m0: number;
  constructor(r: V, v: V, mu: number, private t0: number) {
    const h = r.cross(v);
    const ev = v.cross(h).div(mu).sub(r.div(r.len));
    this.e = ev.len;
    this.a = -mu / (2 * (v.len2 / 2 - mu / r.len));
    if (this.e < 1e-9) { this.p = r.norm; this.e = 0; } else this.p = ev.div(this.e);
    this.q = h.norm.cross(this.p);
    const nu = Math.atan2(r.dot(this.q), r.dot(this.p)), e = this.e;
    if (e < 1) { const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)); this.m0 = E - e * Math.sin(E); }
    else { const H = 2 * Math.atanh(Math.min(0.999999999, Math.max(-0.999999999, Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)))); this.m0 = e * Math.sinh(H) - H; }
    this.n = Math.sqrt(mu / Math.pow(Math.abs(this.a), 3));
  }
  at(jd: number): V {
    const M = this.m0 + this.n * (jd - this.t0) * 86400, e = this.e;
    let x: number, y: number;
    if (e < 1) { const E = solveK(M, e); x = this.a * (Math.cos(E) - e); y = this.a * Math.sqrt(1 - e * e) * Math.sin(E); }
    else { const H = solveK(M, e), aa = Math.abs(this.a); x = aa * (e - Math.cosh(H)); y = aa * Math.sqrt(e * e - 1) * Math.sinh(H); }
    return this.p.mul(x).add(this.q.mul(y));
  }
}
import { solveKepler as solveK } from './math';
/** Vektor v (senkrecht zu n) um die Achse n drehen. */
export const rot = (v: V, n: V, ang: number) => v.mul(Math.cos(ang)).add(n.cross(v).mul(Math.sin(ang)));

// ------------------------------------------------------------------ Mission
export interface MissionPhase { jd: number; title: string; text: string; look: string; rate: number; dist: number }
export class Mission {
  seg: [number, number, F][] = [];
  phases: MissionPhase[] = [];
  /** Bild je Ablaufzeile (vom Desktop gerendert, Ordner public/solar/missions). */
  imageBase = '';
  constructor(public name: string, public info: string, public trail: string, public craft: number, public route?: string) {}
  get start() { return this.seg[0][0]; }
  get end() { return this.seg[this.seg.length - 1][1]; }
  at(jd: number): V {
    if (jd <= this.seg[0][0]) return this.seg[0][2](jd);
    for (const s of this.seg) if (jd <= s[1]) return s[2](jd);
    return this.seg[this.seg.length - 1][2](jd);
  }
  phaseAt(jd: number) { let k = -1; this.phases.forEach((p, i) => { if (p.jd <= jd) k = i; }); return k; }
}

export const MISSIONS: Mission[] = [];

// ------------------------------------------------------------------ Bausteine (Ortsfunktionen)
const B = () => BODIES;
const pos = (n: string, jd: number) => abs(find(n)!, jd);
const mu = (n: string) => (n === 'Sonne' ? GMSun : find(n)!.GM);
const S = 1 / 86400, Min = 1 / 1440, Hr = 1 / 24;
const site = (body: string, lat: number, lon: number, alt = 0): F => { const i = idx(body); return t => surfacePoint(i, lat, lon, alt, t); };

/** Kreisbahn, die zur Zeit tref über refDir steht; Normale ≈ nHint; Umlauf = period (Tage, 0 = Kepler). */
function circ(body: string, altKm: number, tref: number, refDir: () => V, nHint: () => V, periodD = 0): F {
  const bi = idx(body), r = B()[bi].R + altKm, w = periodD > 0 ? 2 * Math.PI / (periodD * 86400) : Math.sqrt(B()[bi].GM / (r * r * r));
  let d0: V | null = null, n = V.Zero;
  return t => {
    if (!d0) { d0 = refDir().norm; const nh = nHint(); n = nh.sub(d0.mul(nh.dot(d0))).norm; }
    return abs(B()[bi], t).add(rot(d0, n, w * (t - tref) * 86400).mul(r));
  };
}
/** Parkbahn nach dem Start: Ebene aus Startort und Startazimut, steht zur Zeit tref um downrange (Grad) hinter dem Startort. */
function parking(body: string, altKm: number, tref: number, lat: number, lon: number, azDeg: number, downrangeDeg: number): F {
  const bi = idx(body);
  let N: V | null = null, start = V.Zero;
  const init = () => {
    if (N) return;
    const [ex, ey, ez] = frame(bi, tref), la = lat * Deg, lo = lon * Deg;
    const s = ex.mul(Math.cos(la) * Math.cos(lo)).add(ey.mul(Math.sin(la))).add(ez.mul(Math.cos(la) * Math.sin(lo))).norm;
    const east = ey.cross(s).norm, north = s.cross(east);
    const v = east.mul(Math.sin(azDeg * Deg)).add(north.mul(Math.cos(azDeg * Deg)));
    N = s.cross(v).norm;
    start = rot(s, N, downrangeDeg * Deg);
  };
  const r = B()[bi].R + altKm, w = Math.sqrt(B()[bi].GM / (r * r * r));
  return t => { init(); return abs(B()[bi], t).add(rot(start, N!, w * (t - tref) * 86400).mul(r)); };
}
/** Transferbahn um den Zentralkörper: von a(ta) nach b(tb), Kepler-Bahn aus der Lambert-Lösung. */
function transfer(center: string, a: F, ta: number, b: F, tb: number, nref?: () => V): F {
  const ci = idx(center), m = mu(center);
  let conic: Conic | null = null;
  return t => {
    if (!conic) {
      const r1 = a(ta).sub(abs(B()[ci], ta)), r2 = b(tb).sub(abs(B()[ci], tb));
      const v1 = lambert(r1, r2, (tb - ta) * 86400, m, nref?.() ?? V.UnitZ);
      conic = new Conic(r1, v1, m, ta);
    }
    return abs(B()[ci], t).add(conic.at(t));
  };
}
const blend = (a: F, b: F, t0: number, t1: number): F => t => { let u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); u = u * u * (3 - 2 * u); return V.lerp(a(t), b(t), u); };
/** Vorbeiflugpunkt: neben dem Körper im Abstand dist (km), seitlich zur Bahnbewegung. */
const flyby = (body: string, dist: number, side = 1): F => { const bb = find(body)!; return t => abs(bb, t).add(vel(bb, t).cross(V.UnitZ).norm.mul(dist * side)); };
const follow = (body: string, off: V): F => { const bb = find(body)!; return t => abs(bb, t).add(off); };
const radial = (b: Body): F => { const o = b.orbit!; return t => o.dir.mul(o.R0 + o.vel * (t - o.Epoch)); };

function mk(name: string, craft: string, info: string, trail: string, route?: string) {
  const m = new Mission(name, info, trail, idx(craft), route);
  m.imageBase = `mission_${String(MISSIONS.length).padStart(2, '0')}_`;
  MISSIONS.push(m);
  return m;
}
function attach(m: Mission) {
  const b = B()[m.craft];
  b.orbit = { ...orbitKind('Mission'), mission: m };
  b.parent = 0; b.approx = false; b.surf = Surf.Craft; b.albedo = 0.6;
}
const ph = (m: Mission, jd: number, title: string, text: string, look: string, rate: number, dist: number) => m.phases.push({ jd, title, text, look, rate, dist });

export function buildMissions() {
  if (MISSIONS.length) return;
  const earthPole = () => eqToEcl(new V(0, 0, 1));

  // ============================================================== Apollo 11
  {
    const m = mk('Apollo 11', 'Apollo 11', 'Die erste bemannte Mondlandung: Neil Armstrong und Buzz Aldrin landeten mit der Mondfähre Eagle im Meer der Ruhe, ' +
      'Michael Collins blieb in der Kommandokapsel Columbia im Mondorbit. Die Bahn hier folgt der Besatzung.', 'Erde', 'Erde → Mondumlauf → Landung im Meer der Ruhe → Erde');
    const launch = T('1969-07-16 13:32:00'), ins = T('1969-07-16 13:43:49'), tli = T('1969-07-16 16:22:13'), loi = T('1969-07-19 17:21:50'),
      pdi = T('1969-07-20 20:05:00'), land = T('1969-07-20 20:17:40'), step = T('1969-07-21 02:56:15'), lift = T('1969-07-21 17:54:00'),
      orb2 = lift + 7 * Min, tei = T('1969-07-22 04:55:42'), entry = T('1969-07-24 16:35:05'), splash = T('1969-07-24 16:50:35');
    const ksc = site('Erde', 28.6082, -80.6041, 0.05);
    const park = parking('Erde', 190, ins, 28.6082, -80.6041, 72, 18);
    const tb = site('Mond', 0.67408, 23.47297, 0.005);
    const moon = idx('Mond');
    const lo1 = circ('Mond', 110, land, () => tb(land).sub(pos('Mond', land)), () => frame(moon, land)[1].neg());
    const lo2 = circ('Mond', 110, orb2, () => rot(tb(lift).sub(pos('Mond', lift)).norm, frame(moon, lift)[1].neg(), 3 * Deg), () => frame(moon, lift)[1].neg());
    const splashSite = site('Erde', 13.32, -169.15, 0), entryPt = site('Erde', 2.5, -175.5, 122);
    const outb = transfer('Erde', park, tli + 6 * Min, lo1, loi, earthPole), back = transfer('Erde', lo2, tei + 3 * Min, entryPt, entry, earthPole);
    m.seg.push([launch - 1, launch, ksc], [launch, ins, blend(ksc, park, launch, ins)], [ins, tli + 6 * Min, park], [tli + 6 * Min, loi, outb], [loi, pdi, lo1],
      [pdi, land, blend(lo1, tb, pdi, land)], [land, lift, tb], [lift, orb2, blend(tb, lo2, lift, orb2)], [orb2, tei + 3 * Min, lo2], [tei + 3 * Min, entry, back],
      [entry, splash, blend(back, splashSite, entry, splash)], [splash, splash + 1, splashSite]);
    ph(m, launch - 3 * Min, 'Countdown in Florida', 'Die 110 m hohe Saturn V steht auf Startrampe 39A im Kennedy Space Center. Sie ist bis heute eine der stärksten Raketen, die je geflogen sind.', 'Apollo 11', 10 * S, 900);
    ph(m, launch, 'Abheben', '13:32 UTC: Die fünf F-1-Triebwerke der ersten Stufe verbrennen 13 Tonnen Treibstoff pro Sekunde. Nach 12 Minuten ist Apollo 11 in der Umlaufbahn.', 'Apollo 11', 10 * S, 1500);
    ph(m, ins, 'Parkbahn um die Erde', 'In 190 km Höhe umkreist das Raumschiff die Erde in 88 Minuten. Die Besatzung prüft alle Systeme, bevor es zum Mond geht.', 'Apollo 11', 2 * Min, 9000);
    ph(m, tli, 'Einschuss in die Mondbahn (TLI)', 'Die dritte Stufe zündet ein zweites Mal für 6 Minuten: von 7,8 auf 10,8 km/s. Das reicht fast zum Verlassen der Erde – die Bahn ist eine lange Ellipse, deren fernes Ende der Mond kreuzt.', 'Apollo 11', 30 * Min, 60000);
    ph(m, tli + 0.3, 'Flug zum Mond', 'Drei Tage Freiflug. Die Erdanziehung bremst das Raumschiff ab – auf halbem Weg ist es nur noch gut 1 km/s schnell. Erst nahe am Mond zieht dessen Schwerkraft wieder an.', 'Apollo 11', 2 * Hr, 480000);
    ph(m, loi, 'Einschwenken in die Mondumlaufbahn', 'Hinter dem Mond, ohne Funkkontakt zur Erde, bremst das Haupttriebwerk 6 Minuten lang. Apollo 11 wird vom Mond eingefangen und umkreist ihn alle 2 Stunden.', 'Apollo 11', 10 * Min, 6000);
    ph(m, pdi, 'Landeanflug', 'Eagle senkt sich aus 15 km Höhe. Armstrong übernimmt von Hand, weil der Computer auf ein Geröllfeld zusteuert – bei der Landung sind nur noch Sekunden Treibstoff übrig.', 'Apollo 11', 10 * S, 400);
    ph(m, land, '„The Eagle has landed“', '20:17:40 UTC: Landung im Meer der Ruhe (0,67° N, 23,47° O). Die Erde steht hoch über dem Horizont – vom Landeplatz aus bewegt sie sich am Himmel kaum.', 'Mond', 1 * Min, 2500);
    ph(m, step, 'Der erste Schritt', "02:56 UTC: „That's one small step for man, one giant leap for mankind.“ 600 Millionen Menschen sehen live zu. Armstrong und Aldrin sammeln 21,5 kg Mondgestein.", 'Mond', 1 * Min, 2500);
    ph(m, lift, 'Rückstart vom Mond', 'Die Aufstiegsstufe startet, die Abstiegsstufe bleibt als Startrampe zurück. Nach 7 Minuten ist Eagle im Orbit und koppelt später an Columbia an.', 'Apollo 11', 20 * S, 600);
    ph(m, tei, 'Einschuss in die Rückflugbahn (TEI)', 'Wieder hinter dem Mond zündet das Triebwerk: Apollo 11 verlässt den Mond und fällt zweieinhalb Tage lang zur Erde zurück.', 'Apollo 11', 2 * Hr, 480000);
    ph(m, entry, 'Wiedereintritt', 'Mit 11 km/s trifft die Kapsel auf die Atmosphäre. Der Hitzeschild glüht bei 2 700 °C, die Besatzung erfährt 6,5 g.', 'Apollo 11', 10 * S, 3000);
    ph(m, splash, 'Wasserung im Pazifik', '16:50 UTC: Fallschirme bremsen die Kapsel, sie landet südwestlich von Hawaii. Die USS Hornet nimmt die Besatzung auf – nach 8 Tagen, 3 Stunden und 18 Minuten.', 'Apollo 11', 1 * Min, 3000);
    attach(m);
  }
  // ============================================================== Apollo 13
  {
    const m = mk('Apollo 13', 'Apollo 13', "„Houston, we've had a problem.“ Auf dem Weg zum Mond explodierte ein Sauerstofftank. Die Landung fiel aus; die Besatzung überlebte in der Mondfähre " +
      'und kehrte auf einer freien Rückkehrbahn um den Mond herum zur Erde zurück.', 'Erde', 'Erde → um den Mond herum → Erde');
    const launch = T('1970-04-11 19:13:00'), ins = T('1970-04-11 19:25:39'), tli = T('1970-04-11 21:48:47'), boom = T('1970-04-14 03:07:53'),
      peri = T('1970-04-15 00:21:00'), entry = T('1970-04-17 17:53:00'), splash = T('1970-04-17 18:07:41');
    const ksc = site('Erde', 28.6082, -80.6041, 0.05), park = parking('Erde', 190, ins, 28.6082, -80.6041, 72, 18);
    const far: F = t => { const mp = pos('Mond', t), e = pos('Erde', t); return mp.add(mp.sub(e).norm.mul(1737.4 + 254)); };
    const splashSite = site('Erde', -21.63, -165.37, 0), entryPt = site('Erde', -30, -172, 122);
    const outb = transfer('Erde', park, tli + 6 * Min, far, peri, earthPole), back = transfer('Erde', far, peri, entryPt, entry, earthPole);
    m.seg.push([launch - 1, launch, ksc], [launch, ins, blend(ksc, park, launch, ins)], [ins, tli + 6 * Min, park], [tli + 6 * Min, peri, outb], [peri, entry, back],
      [entry, splash, blend(back, splashSite, entry, splash)], [splash, splash + 1, splashSite]);
    ph(m, launch, 'Abheben', 'Jim Lovell, Jack Swigert und Fred Haise starten zur dritten Mondlandung – Ziel ist das Hochland Fra Mauro.', 'Apollo 13', 10 * S, 1500);
    ph(m, tli, 'Auf dem Weg zum Mond', 'Der Flug verläuft ruhig – so ruhig, dass die Fernsehsender die Live-Übertragungen nicht mehr senden.', 'Apollo 13', 2 * Hr, 480000);
    ph(m, boom, "„Houston, we've had a problem“", '55 Stunden nach dem Start explodiert Sauerstofftank 2. Strom, Wasser und Atemluft der Kommandokapsel schwinden. Die drei ziehen in die Mondfähre Aquarius um – gebaut für 2 Personen und 2 Tage.', 'Apollo 13', 1 * Hr, 150000);
    ph(m, peri, 'Um den Mond herum', 'In 254 km Höhe über der Rückseite – 400 171 km von der Erde: Rekord für die größte Entfernung, die Menschen je von der Erde hatten. Die Schwerkraft des Mondes lenkt das Raumschiff zur Erde um.', 'Apollo 13', 20 * Min, 20000);
    ph(m, entry, 'Heimkehr', 'Mit improvisierten CO₂-Filtern aus Pappe und Klebeband überleben sie. Die Kapsel wird gerade rechtzeitig wieder hochgefahren.', 'Apollo 13', 10 * S, 3000);
    ph(m, splash, 'Wasserung', 'Alle drei Astronauten kehren unversehrt zurück – „ein erfolgreicher Fehlschlag“.', 'Apollo 13', 1 * Min, 3000);
    attach(m);
  }
  // ============================================================== Artemis I
  {
    const m = mk('Artemis I', 'Artemis I', 'Der unbemannte Testflug des Orion-Raumschiffs auf der SLS-Rakete – Vorbereitung für die Rückkehr von Menschen zum Mond. ' +
      'Orion flog in eine weite, „rückläufige“ Bahn um den Mond (DRO) und kam nach 25 Tagen zurück.', 'Erde', 'Erde → weite Mondbahn → Erde');
    const launch = T('2022-11-16 06:47:44'), ins = launch + 9 * Min, tli = T('2022-11-16 08:14:00'), fb1 = T('2022-11-21 12:44:00'), dri = T('2022-11-25 21:52:00'),
      dro = T('2022-12-01 21:53:00'), fb2 = T('2022-12-05 16:43:00'), entry = T('2022-12-11 17:20:00'), splash = T('2022-12-11 17:40:00');
    const ksc = site('Erde', 28.627, -80.621, 0.05), park = parking('Erde', 185, ins, 28.627, -80.621, 70, 18);
    const moonOrbN = () => { const r = pos('Mond', fb1).sub(pos('Erde', fb1)), r2 = pos('Mond', fb1 + 0.01).sub(pos('Erde', fb1 + 0.01)); return r.cross(r2).norm; };
    const near1: F = t => { const mp = pos('Mond', t), e = pos('Erde', t); return mp.add(mp.sub(e).norm.mul(1737.4 + 130)); };
    const near2: F = t => { const mp = pos('Mond', t), e = pos('Erde', t); return mp.add(mp.sub(e).norm.mul(1737.4 + 127)); };
    const droOrb = circ('Mond', 68000, dri, () => pos('Mond', dri).sub(pos('Erde', dri)), () => moonOrbN().neg(), 12.5);
    const splashSite = site('Erde', 28.6, -117.6, 0), entryPt = site('Erde', 20, -150, 122);
    m.seg.push([launch - 1, launch, ksc], [launch, ins, blend(ksc, park, launch, ins)], [ins, tli + 18 * Min, park],
      [tli + 18 * Min, fb1, transfer('Erde', park, tli + 18 * Min, near1, fb1, earthPole)],
      [fb1, dri, transfer('Mond', near1, fb1, droOrb, dri, () => moonOrbN().neg())], [dri, dro, droOrb],
      [dro, fb2, transfer('Mond', droOrb, dro, near2, fb2, () => moonOrbN().neg())], [fb2, entry, transfer('Erde', near2, fb2, entryPt, entry, earthPole)],
      [entry, splash, blend(entryPt, splashSite, entry, splash)], [splash, splash + 1, splashSite]);
    ph(m, launch, 'Start der SLS', '06:47 UTC: Die stärkste Rakete seit der Saturn V hebt nachts in Florida ab – 8,8 Millionen Pfund Schub.', 'Artemis I', 10 * S, 1500);
    ph(m, tli, 'Einschuss in die Mondbahn', 'Die Oberstufe ICPS schickt Orion zum Mond. An Bord: drei Puppen mit Strahlungsmessgeräten.', 'Artemis I', 2 * Hr, 480000);
    ph(m, fb1, 'Dicht am Mond vorbei', '130 km über der Rückseite holt Orion Schwung für die weite Mondbahn.', 'Artemis I', 10 * Min, 8000);
    ph(m, dri, 'Weite rückläufige Mondbahn (DRO)', 'Rund 70 000 km über dem Mond, entgegen seiner Bahnrichtung – eine sehr stabile Bahn, die kaum Treibstoff kostet. Am 28.11. erreicht Orion 432 210 km Abstand zur Erde: Rekord für ein Raumschiff für Menschen.', 'Artemis I', 4 * Hr, 400000);
    ph(m, fb2, 'Rückflug-Vorbeiflug', '127 km über dem Mond – dann geht es zurück zur Erde.', 'Artemis I', 10 * Min, 8000);
    ph(m, entry, 'Wiedereintritt mit 40 000 km/h', 'Erstmals ein „Hüpf-Eintritt“: Orion taucht in die Atmosphäre ein, steigt wieder auf und taucht erneut ein. Der Hitzeschild erreicht 2 800 °C.', 'Artemis I', 10 * S, 3000);
    ph(m, splash, 'Wasserung vor Baja California', 'Nach 25,5 Tagen und 2,25 Millionen km landet Orion im Pazifik.', 'Artemis I', 1 * Min, 3000);
    attach(m);
  }
  // ============================================================== Voyager 1
  {
    const v = find('Voyager 1')!;
    const m = mk('Voyager 1', 'Voyager 1', 'Gestartet 16 Tage nach Voyager 2, aber auf einer schnelleren Bahn: Sie erreichte Jupiter und Saturn zuerst. Nach Saturns Mond Titan ' +
      'verließ sie die Planetenebene nach Norden – heute ist sie das fernste Objekt, das Menschen gebaut haben.', 'Sonne');
    const launch = T('1977-09-05 12:56:00'), dep = launch + 0.3, jup = T('1979-03-05 12:05:00'), sat = T('1980-11-12 23:46:00'), late = 2460676.5;
    const pad = site('Erde', 28.53, -80.57, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.cross(V.UnitZ).mul(-12000));
    const j = flyby('Jupiter', 348_890), s = flyby('Saturn', 184_300, -1), rad = radial(v);
    const a1 = transfer('Sonne', depPt, dep, j, jup), a2 = transfer('Sonne', j, jup, s, sat), a3 = transfer('Sonne', s, sat, rad, late);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, jup, a1], [jup, sat, a2], [sat, late, a3], [late, late + 365 * 200, rad]);
    ph(m, launch, 'Abheben', 'Eine Titan-IIIE/Centaur bringt die 722 kg schwere Sonde auf den Weg. Die Planeten stehen günstig wie nur alle 175 Jahre.', 'Voyager 1', 1 * Hr, 60000);
    ph(m, launch + 13, 'Das erste Bild von Erde und Mond zusammen', 'Aus 11,7 Mio. km nimmt Voyager 1 das erste Foto auf, das Erde und Mond gemeinsam als Sicheln zeigt.', 'Voyager 1', 1, 2e7);
    ph(m, jup - 20, 'Jupiter', 'Am 5. März 1979 fliegt Voyager 1 in 349 000 km Abstand vorbei. Entdeckt: aktive Vulkane auf Io – der erste Nachweis von Vulkanismus außerhalb der Erde – und ein dünner Ring um Jupiter.', 'Jupiter', 2 * Hr, 4e6);
    ph(m, sat - 15, 'Saturn und Titan', 'Voyager 1 fliegt dicht an Titan vorbei und sieht nur orangefarbenen Dunst. Die Bahn zum Titan schleudert sie aus der Ebene der Planeten – Pluto ist so nicht mehr erreichbar.', 'Saturn', 2 * Hr, 3e6);
    ph(m, T('1990-02-14 04:48:00'), 'Pale Blue Dot', 'Aus 6 Mrd. km dreht sich die Kamera ein letztes Mal um: Die Erde ist ein blasser blauer Punkt, kleiner als ein Pixel. Carl Sagan: „Das ist hier. Das ist unser Zuhause. Das sind wir.“', 'Voyager 1', 30, 5e8);
    ph(m, T('2012-08-25 00:00:00'), 'Im interstellaren Raum', 'In 121 AE überquert Voyager 1 die Heliopause: Der Sonnenwind endet, die Sonde misst das dichtere Plasma zwischen den Sternen.', 'Voyager 1', 30, 5e8);
    attach(m);
  }
  // ============================================================== Voyager 2
  {
    const v = find('Voyager 2')!;
    const m = mk('Voyager 2', 'Voyager 2', 'Die „Grand Tour“: als einzige Sonde an allen vier Riesenplaneten vorbei. Jeder Vorbeiflug lenkte sie mit der Schwerkraft des Planeten ' +
      'zum nächsten um (Swing-by) – so dauerte der Weg zu Neptun 12 statt 30 Jahre.', 'Sonne');
    const launch = T('1977-08-20 14:29:00'), dep = launch + 0.3, jup = T('1979-07-09 22:29:00'), sat = T('1981-08-26 03:24:00'), ura = T('1986-01-24 17:59:00'),
      nep = T('1989-08-25 03:56:00'), late = 2460676.5;
    const pad = site('Erde', 28.53, -80.57, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.cross(V.UnitZ).mul(-12000));
    const j = flyby('Jupiter', 721_670), s = flyby('Saturn', 161_000), u = flyby('Uranus', 107_000), n = flyby('Neptun', 29_240, -1), rad = radial(v);
    const a1 = transfer('Sonne', depPt, dep, j, jup), a2 = transfer('Sonne', j, jup, s, sat), a3 = transfer('Sonne', s, sat, u, ura), a4 = transfer('Sonne', u, ura, n, nep), a5 = transfer('Sonne', n, nep, rad, late);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, jup, a1], [jup, sat, a2], [sat, ura, a3], [ura, nep, a4], [nep, late, a5], [late, late + 365 * 200, rad]);
    ph(m, launch, 'Abheben', 'Voyager 2 startet zuerst – auf der langsameren Bahn, die den Weg zu Uranus und Neptun offenhält.', 'Voyager 2', 1 * Hr, 60000);
    ph(m, jup - 20, 'Jupiter', 'Juli 1979: Bilder von Europas Rissen und Ganymeds Furchen. Jupiters Schwerkraft beschleunigt Voyager 2 Richtung Saturn.', 'Jupiter', 2 * Hr, 5e6);
    ph(m, sat - 15, 'Saturn', 'August 1981: Speichen in den Ringen, Stürme und die Monde Enceladus und Tethys.', 'Saturn', 2 * Hr, 3e6);
    ph(m, ura - 10, 'Uranus', 'Januar 1986: der einzige Besuch bei Uranus. Zehn neue Monde, zwei neue Ringe und Mirandas verrückte Landschaft.', 'Uranus', 2 * Hr, 1.5e6);
    ph(m, nep - 10, 'Neptun und Triton', 'August 1989: 4 950 km über Neptuns Nordpol – der dichteste Vorbeiflug der Mission. Der Große Dunkle Fleck und die Stickstoff-Geysire auf Triton.', 'Neptun', 1 * Hr, 1e6);
    ph(m, T('2018-11-05 00:00:00'), 'Im interstellaren Raum', 'In 119 AE überquert auch Voyager 2 die Heliopause.', 'Voyager 2', 30, 5e8);
    attach(m);
  }
  // ============================================================== New Horizons
  {
    const v = find('New Horizons')!;
    const m = mk('New Horizons', 'New Horizons', 'Die schnellste Sonde beim Start (16,3 km/s): in 9 Stunden am Mond vorbei, nach 13 Monaten bei Jupiter, nach 9,5 Jahren bei Pluto.', 'Sonne');
    const launch = T('2006-01-19 19:00:00'), dep = launch + 0.2, jup = T('2007-02-28 05:43:40'), plu = T('2015-07-14 11:49:57'), arr = T('2019-01-01 05:33:00'), late = 2460676.5;
    const pad = site('Erde', 28.5, -80.57, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.mul(9000));
    const j = flyby('Jupiter', 2_300_000), p = flyby('Pluto', 13_691), a = flyby('Arrokoth', 3_538), rad = radial(v);
    const a1 = transfer('Sonne', depPt, dep, j, jup), a2 = transfer('Sonne', j, jup, p, plu), a3 = transfer('Sonne', p, plu, a, arr), a4 = transfer('Sonne', a, arr, rad, late);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, jup, a1], [jup, plu, a2], [plu, arr, a3], [arr, late, a4], [late, late + 365 * 200, rad]);
    ph(m, launch, 'Abheben', 'Eine Atlas V mit fünf Zusatzraketen und einer dritten Stufe gibt New Horizons die höchste Startgeschwindigkeit aller Zeiten.', 'New Horizons', 1 * Hr, 60000);
    ph(m, jup - 10, 'Jupiter-Schwung', 'Der Vorbeiflug an Jupiter spart 3 Jahre Flugzeit – und liefert Filme vom Vulkanausbruch Tvashtar auf Io.', 'Jupiter', 2 * Hr, 8e6);
    ph(m, plu - 2, 'Pluto', '14. Juli 2015, 12 500 km über der Oberfläche: das Herz aus Stickstoffeis, Eisberge, blaue Dunstschichten. Die Daten brauchen 16 Monate bis zur Erde.', 'Pluto', 10 * Min, 60000);
    ph(m, arr - 1, 'Arrokoth', 'Neujahr 2019: der fernste je besuchte Körper, ein unberührter „Schneemann“ aus der Entstehungszeit des Sonnensystems.', 'Arrokoth', 5 * Min, 400);
    attach(m);
  }
  // ============================================================== Cassini-Huygens
  {
    const m = mk('Cassini-Huygens', 'Cassini', 'Sieben Jahre Anflug mit vier Schwung-Manövern (Venus, Venus, Erde, Jupiter), dann 13 Jahre im Saturnsystem. Die Landesonde Huygens ' +
      'landete auf Titan. Am Ende stürzte Cassini absichtlich in Saturn, um die Monde Enceladus und Titan nicht zu verschmutzen.', 'Sonne');
    const launch = T('1997-10-15 08:43:00'), dep = launch + 0.2, v1 = T('1998-04-26 13:44:43'), v2 = T('1999-06-24 20:29:55'), ef = T('1999-08-18 03:28:00'),
      jup = T('2000-12-30 10:05:00'), soi = T('2004-07-01 02:48:00'), huy = T('2005-01-14 10:13:00'), end = T('2017-09-15 10:31:00');
    const pad = site('Erde', 28.47, -80.56, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.mul(-9000));
    const fv1 = flyby('Venus', 6_336), fv2 = flyby('Venus', 6_675, -1), fe = flyby('Erde', 7_542), fj = flyby('Jupiter', 9_723_000);
    const sat = idx('Saturn');
    let loop: Conic | null = null;
    const sOrb: F = t => {
      if (!loop) {
        const [, ey] = frame(sat, soi);
        const sunDir = pos('Sonne', soi).sub(pos('Saturn', soi)).norm;
        const r0 = sunDir.sub(ey.mul(sunDir.dot(ey))).norm.mul(80_000);
        const nrm = rot(ey, r0.norm, -10 * Deg);
        const rp = 80_000, a = 2.6e6, mm = mu('Saturn'), vp = Math.sqrt(mm * (2 / rp - 1 / a));
        loop = new Conic(r0, nrm.cross(r0.norm).mul(vp), mm, soi);
      }
      return pos('Saturn', t).add(loop.at(t));
    };
    const a1 = transfer('Sonne', depPt, dep, fv1, v1), a2 = transfer('Sonne', fv1, v1, fv2, v2), a3 = transfer('Sonne', fv2, v2, fe, ef),
      a4 = transfer('Sonne', fe, ef, fj, jup), a5 = transfer('Sonne', fj, jup, sOrb, soi), plunge = follow('Saturn', V.Zero);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, v1, a1], [v1, v2, a2], [v2, ef, a3], [ef, jup, a4], [jup, soi, a5],
      [soi, end - 0.5, sOrb], [end - 0.5, end, blend(sOrb, plunge, end - 0.5, end)], [end, end + 1, plunge]);
    ph(m, launch, 'Abheben', 'Mit 5,6 Tonnen eine der schwersten Planetensonden. Für den direkten Weg zu Saturn reichte keine Rakete – also Schwung holen.', 'Cassini', 1 * Hr, 60000);
    ph(m, v1 - 3, 'Zweimal Venus, einmal Erde', 'Jeder Vorbeiflug „stiehlt“ dem Planeten ein wenig Bahnenergie. Beim Erdvorbeiflug 1999 rast Cassini mit 19 km/s 1 171 km über den Südpazifik.', 'Cassini', 1, 2e7);
    ph(m, jup - 10, 'Jupiter', 'Gemeinsame Beobachtungen mit der Sonde Galileo, die gerade Jupiter umkreist.', 'Jupiter', 2 * Hr, 2e7);
    ph(m, soi - 1, 'Ankunft bei Saturn', 'Durch eine Lücke in den Ringen hindurch zündet das Triebwerk 96 Minuten: Cassini wird von Saturn eingefangen.', 'Saturn', 30 * Min, 2e6);
    ph(m, huy, 'Huygens landet auf Titan', 'Die europäische Kapsel schwebt 2,5 Stunden am Fallschirm durch den Dunst und landet auf gefrorenem Boden mit Kieseln aus Wassereis – die fernste Landung aller Zeiten.', 'Titan', 10 * Min, 15000);
    ph(m, end - 5, 'Grand Finale', 'Nach 22 Tauchgängen zwischen Saturn und seinen Ringen stürzt Cassini am 15.09.2017 in die Atmosphäre und funkt bis zuletzt Messwerte.', 'Saturn', 1 * Hr, 400000);
    attach(m);
  }
  // ============================================================== Rosetta
  {
    const m = mk('Rosetta', 'Rosetta', 'Zehn Jahre Anflug mit drei Erd- und einem Marsvorbeiflug, dann über zwei Jahre Begleitung des Kometen 67P/Tschurjumow-Gerassimenko. ' +
      'Der Lander Philae setzte als erstes Gerät auf einem Kometen auf.', 'Sonne');
    const launch = T('2004-03-02 07:17:44'), dep = launch + 0.2, e1 = T('2005-03-04 22:09:00'), ma = T('2007-02-25 01:58:00'), e2 = T('2007-11-13 20:57:00'),
      e3 = T('2009-11-13 07:45:00'), arr = T('2014-08-06 09:00:00'), phi = T('2014-11-12 15:34:00'), end = T('2016-09-30 10:39:00');
    const pad = site('Erde', 5.236, -52.769, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.mul(9000));
    const f1 = flyby('Erde', 8_325), fm = flyby('Mars', 3_640), f2 = flyby('Erde', 11_666, -1), f3 = flyby('Erde', 8_852);
    const comet = follow('Tschurjumow-Gerassimenko', new V(30, 20, 10));
    const a1 = transfer('Sonne', depPt, dep, f1, e1), a2 = transfer('Sonne', f1, e1, fm, ma), a3 = transfer('Sonne', fm, ma, f2, e2);
    const st = T('2008-09-05 18:38:00');
    const steins: F = () => rot(pos('Erde', e2).norm, V.UnitZ, 170 * Deg).mul(2.14 * AU);
    const a4a = transfer('Sonne', f2, e2, steins, st), a4b = transfer('Sonne', steins, st, f3, e3), a5 = transfer('Sonne', f3, e3, comet, arr);
    const crash = follow('Tschurjumow-Gerassimenko', V.Zero);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, e1, a1], [e1, ma, a2], [ma, e2, a3], [e2, st, a4a], [st, e3, a4b], [e3, arr, a5],
      [arr, end - 0.6, comet], [end - 0.6, end, blend(comet, crash, end - 0.6, end)], [end, end + 1, crash]);
    ph(m, launch, 'Start in Kourou', 'Eine Ariane 5 startet in Französisch-Guayana. Rosetta ist benannt nach dem Stein von Rosette – sie soll helfen, die Entstehung des Sonnensystems zu entschlüsseln.', 'Rosetta', 1 * Hr, 60000);
    ph(m, ma - 2, 'Vorbeiflug am Mars', 'Nur 250 km über der Oberfläche, 24 Minuten im Marsschatten ohne Sonnenstrom – ein riskantes Manöver.', 'Mars', 20 * Min, 40000);
    ph(m, arr - 2, 'Ankunft am Kometen', 'Nach 6,4 Milliarden km erreicht Rosetta den 4 km großen Kometen – geformt wie eine Quietscheente.', 'Tschurjumow-Gerassimenko', 30 * Min, 150);
    ph(m, phi, 'Philae landet', 'Die Harpunen zünden nicht, Philae hüpft zweimal über die Oberfläche und bleibt im Schatten einer Klippe liegen – misst aber 57 Stunden lang.', 'Tschurjumow-Gerassimenko', 5 * Min, 60);
    ph(m, T('2015-08-13 02:03:00'), 'Perihel', 'Der Komet ist der Sonne am nächsten (1,24 AE) und am aktivsten: Gas- und Staubfontänen schießen aus der Oberfläche.', 'Tschurjumow-Gerassimenko', 2 * Hr, 300);
    ph(m, end - 0.5, 'Kontrollierte Landung', 'Am Ende sinkt Rosetta langsam auf den Kometen und funkt Bilder bis zum Aufsetzen.', 'Tschurjumow-Gerassimenko', 5 * Min, 40);
    attach(m);
  }
  // ============================================================== Perseverance
  {
    const m = mk('Perseverance (Mars 2020)', 'Perseverance', 'Der Rover sucht im Jezero-Krater, einem ehemaligen Flussdelta, nach Spuren früheren Lebens und sammelt Gesteinsproben ' +
      'für eine spätere Rückholung. Mit an Bord: der Hubschrauber Ingenuity – der erste Motorflug auf einem anderen Planeten.', 'Sonne');
    const launch = T('2020-07-30 11:50:00'), dep = launch + 0.15, entry = T('2021-02-18 20:48:00'), land = T('2021-02-18 20:55:00');
    const pad = site('Erde', 28.5618, -80.577, 0.05);
    const depPt: F = t => pos('Erde', t).add(pos('Erde', t).sub(pos('Sonne', t)).norm.cross(V.UnitZ).mul(9000));
    const jez = site('Mars', 18.4447, 77.4508, 0.002), ent = site('Mars', 18.0, 70.0, 125);
    const a1 = transfer('Sonne', depPt, dep, ent, entry);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, a1, launch, dep)], [dep, entry, a1], [entry, land, blend(a1, jez, entry, land)], [land, land + 365 * 200, jez]);
    ph(m, launch, 'Abheben', 'Eine Atlas V schickt den 1 Tonne schweren Rover auf eine 7 Monate lange Hohmann-ähnliche Bahn zum Mars.', 'Perseverance', 1 * Hr, 60000);
    ph(m, launch + 3, 'Flug zum Mars', 'Auf einer Halb-Ellipse um die Sonne: Abflug, wenn die Erde der Bahn voraus ist, Ankunft, wenn der Mars genau dort steht.', 'Perseverance', 2, 4e7);
    ph(m, entry - 0.2, 'Sieben Minuten Terror', 'Mit 20 000 km/h in die Marsatmosphäre, Hitzeschild, Überschall-Fallschirm, Radar und schließlich der Himmelskran, der den Rover an Seilen absetzt – alles automatisch, denn Funk braucht 11 Minuten zur Erde.', 'Mars', 20 * S, 3000);
    ph(m, land, 'Landung im Jezero-Krater', '18.02.2021, 20:55 UTC. Am 19.04.2021 fliegt Ingenuity 39 Sekunden lang – der Wright-Brothers-Moment auf dem Mars.', 'Mars', 1 * Min, 3000);
    attach(m);
  }
  // ============================================================== James Webb
  {
    const jw = find('James Webb')!, earth = idx('Erde');
    const m = mk('James-Webb-Weltraumteleskop', 'James Webb', 'Start am ersten Weihnachtstag 2021, dann ein Monat Flug zum Lagrange-Punkt L2 – und unterwegs das schwierigste Entfaltungsmanöver der Raumfahrt.', 'Erde', 'Erde → Lagrange-Punkt L2');
    const launch = T('2021-12-25 12:20:00'), dep = launch + 0.02, arr = T('2022-01-24 19:00:00');
    const pad = site('Erde', 5.236, -52.769, 0.05);
    const l2 = new Body(); Object.assign(l2, { index: jw.index, parent: earth, orbit: orbitKind('L2') });
    const l2f: F = t => pos('Erde', t).add(rel(l2, t));
    const depPt = site('Erde', 0, -20, 800);
    const a1 = transfer('Erde', depPt, dep, l2f, arr, earthPole);
    m.seg.push([launch - 1, launch, pad], [launch, dep, blend(pad, depPt, launch, dep)], [dep, arr, a1], [arr, arr + 365 * 200, l2f]);
    ph(m, launch, 'Start mit Ariane 5', 'So präzise, dass Webb Treibstoff für weit über 10 statt 5 Jahre übrig hat.', 'James Webb', 1 * Min, 9000);
    ph(m, launch + 1, 'Entfalten', 'Sonnenschild (Tennisplatz-groß, 5 Lagen dünner als ein Haar) und der 6,5-m-Spiegel aus 18 vergoldeten Segmenten falten sich auf – 344 Einzelschritte, die alle klappen mussten.', 'James Webb', 2 * Hr, 600000);
    ph(m, arr, 'Ankunft an L2', '1,5 Mio. km hinter der Erde kreist Webb auf einer Halo-Bahn um L2. Sonne, Erde und Mond liegen immer auf derselben Seite – der Spiegel kühlt auf −233 °C ab.', 'Erde', 4 * Hr, 4e6);
    attach(m);
  }
}
