// Sonnensystem – „Mathematik“ (Port von PrimSieb/Solar/MathPanel.cs): Bahnelemente aus dem Zustandsvektor und die Gesetze dazu,
// jeweils mit den aktuellen Zahlen eingesetzt; Bahndiagramm mit Flächenstücken gleicher Zeit (2. Keplersches Gesetz).
import { L } from '../core/i18n';
import { h } from '../ui/dom';
import { BODIES, Body, find, nameOf, tr } from './catalog';
import { AU, GMSun, duration, km, lightTime, nf, sci, solveKepler } from './math';
import { abs, vel } from './ephem';

export interface El { body: Body; parent: Body; mu: number; R: number; V: number; A: number; E: number; H: number; Nu: number; Q: number; Qa: number; T: number; Vp: number; Va: number; jd: number; open: boolean }

export function elements(b: Body, jd: number): El | null {
  if (b.index === 0 || b.kind === 'Stream' || !b.orbit) return null;
  const pi = Math.max(b.parent, 0), par = BODIES[pi];
  const r = abs(b, jd).sub(abs(par, jd));
  const v = vel(b, jd, 0.002).sub(vel(par, jd, 0.002)).div(86400);
  const mu = (pi === 0 ? GMSun : par.GM) + b.GM;
  const hv = r.cross(v), ev = v.cross(hv).div(mu).sub(r.div(r.len));
  const e = ev.len, a = -mu / (2 * (v.len2 / 2 - mu / r.len));
  const p = e > 1e-9 ? ev.div(e) : r.norm, q = hv.norm.cross(p);
  const el: El = { body: b, parent: par, mu, R: r.len, V: v.len, A: a, E: e, H: hv.len, Nu: Math.atan2(r.dot(q), r.dot(p)), jd, open: e >= 1, Q: 0, Qa: 0, T: 0, Vp: 0, Va: 0 };
  el.Q = Math.abs(a) * Math.abs(1 - e);
  el.Qa = e < 1 ? a * (1 + e) : Infinity;
  el.T = e < 1 ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity;
  el.Vp = Math.sqrt(mu * (2 / el.Q - 1 / a));
  el.Va = e < 1 ? Math.sqrt(mu * (2 / el.Qa - 1 / a)) : NaN;
  return el;
}

const kms = (v: number) => `${nf(v, 2, 2)} km/s`;
const days = (s: number) => duration(s / 86400);

export class MathPanel {
  readonly el = h('div', { class: 'sol-math' });
  private canvas = h('canvas', { class: 'sol-diag' });
  private cards = h('div');
  private body = -1;
  private up: ((e: El | null) => void)[] = [];
  private cur: El | null = null;
  private t0 = performance.now();
  constructor() { this.el.append(this.canvas, this.cards); }

  private card(title: string, formula: string | null, values: (e: El | null) => string, text: string | null) {
    const val = h('div', { class: 'sol-mval' });
    this.cards.append(h('div', { class: 'sol-mcard' }, h('b', null, title), formula ? h('div', { class: 'sol-formula' }, formula) : '', val, text ? h('p', null, text) : ''));
    this.up.push(e => { val.textContent = values(e); });
  }

  update(i: number, jd: number) {
    const b = BODIES[i];
    const el = elements(b, jd);
    if (i !== this.body) { this.body = i; this.cards.innerHTML = ''; this.up = []; this.build(b, el); }
    this.cur = el;
    this.canvas.style.display = el ? '' : 'none';
    for (const u of this.up) u(el);
    this.drawDiagram();
  }

  private build(b: Body, el: El | null) {
    const N = (x: Body) => nameOf(x);
    const par = el ? N(el.parent) : '';
    if (b.index === 0) {
      this.card(L('Leuchtkraft und Strahlung', 'Luminosity and radiation'), 'L = 4π R² σ T⁴', () => L('L = 4π·(695 700 km)²·σ·(5 772 K)⁴ ≈ 3,83·10²⁶ W', 'L = 4π·(695,700 km)²·σ·(5,772 K)⁴ ≈ 3.83·10²⁶ W'),
        L('Stefan-Boltzmann: Jeder Quadratmeter der Oberfläche strahlt σT⁴ ab (σ = 5,67·10⁻⁸ W/m²K⁴).', 'Stefan–Boltzmann: every square metre of the surface radiates σT⁴ (σ = 5.67·10⁻⁸ W/m²K⁴).'));
      this.card(L('Solarkonstante', 'Solar constant'), 'S = L / (4π d²)', () => L('S(1 AE) ≈ 1 361 W/m²', 'S(1 AU) ≈ 1,361 W/m²'),
        L('Die Leistung verteilt sich auf eine Kugel mit Radius d – doppelter Abstand, ein Viertel des Lichts. Darum ist es bei Neptun 900-mal dunkler als bei uns.',
          'The power spreads over a sphere of radius d – twice the distance, a quarter of the light. That is why it is 900 times darker at Neptune than here.'));
      this.card(L('Fluchtgeschwindigkeit', 'Escape velocity'), 'v = √(2GM / R)', () => L('v = √(2 · 1,327·10¹¹ km³/s² / 695 700 km) ≈ 617,7 km/s', 'v = √(2 · 1.327·10¹¹ km³/s² / 695,700 km) ≈ 617.7 km/s'), null);
      return;
    }
    if (!el) return;
    this.card(L('1. Keplersches Gesetz – Kegelschnitt', "Kepler's 1st law – conic section"), 'r(ν) = a (1 − e²) / (1 + e · cos ν)',
      e => !e ? '' : e.open
        ? L(`e = ${nf(e.E, 5)} ≥ 1 → offene Bahn (Hyperbel): ${N(e.body)} kommt nur einmal vorbei.\nkleinster Abstand q = ${km(e.Q)}`, `e = ${nf(e.E, 5)} ≥ 1 → open orbit (hyperbola): ${N(e.body)} passes only once.\nclosest distance q = ${km(e.Q)}`)
        : L(`a = ${km(e.A)}   e = ${nf(e.E, 5)}\nPerizentrum q = a(1−e) = ${km(e.Q)}\nApozentrum Q = a(1+e) = ${km(e.Qa)}\njetzt: ν = ${nf(e.Nu * 180 / Math.PI, 1, 1)}°, r = ${km(e.R)}`,
          `a = ${km(e.A)}   e = ${nf(e.E, 5)}\nperiapsis q = a(1−e) = ${km(e.Q)}\napoapsis Q = a(1+e) = ${km(e.Qa)}\nnow: ν = ${nf(e.Nu * 180 / Math.PI, 1, 1)}°, r = ${km(e.R)}`),
      L(`Jede Bahn um ${par} ist ein Kegelschnitt mit ${par} in einem Brennpunkt: Kreis (e = 0), Ellipse (e < 1), Parabel (e = 1) oder Hyperbel (e > 1). Die wahre Anomalie ν ist der Winkel seit dem nächsten Punkt.`,
        `Every orbit around ${par} is a conic section with ${par} at one focus: circle (e = 0), ellipse (e < 1), parabola (e = 1) or hyperbola (e > 1). The true anomaly ν is the angle since the closest point.`));
    this.card(L('2. Keplersches Gesetz – Flächensatz', "Kepler's 2nd law – equal areas"), L('dA/dt = h / 2 = ½ · |r × v| = konstant', 'dA/dt = h / 2 = ½ · |r × v| = constant'),
      e => !e ? '' : L(`h = |r × v| = ${sci(e.H)} km²/s\n→ in jeder Sekunde überstreicht der Fahrstrahl ${sci(e.H / 2)} km²`, `h = |r × v| = ${sci(e.H)} km²/s\n→ every second the radius vector sweeps ${sci(e.H / 2)} km²`),
      L('Der Drehimpuls bleibt erhalten. Darum ist ein Körper nah am Zentralkörper schnell und weit weg langsam – die farbigen Flächen oben sind alle gleich groß und werden in gleichen Zeiten überstrichen.',
        'Angular momentum is conserved. That is why a body is fast close to the central body and slow far away – the coloured areas above are all equal and are swept in equal times.'));
    this.card(L('3. Keplersches Gesetz – Umlaufzeit', "Kepler's 3rd law – orbital period"), 'T = 2π · √(a³ / G(M + m))',
      e => !e ? '' : e.open ? L('offene Bahn – keine Umlaufzeit', 'open orbit – no period')
        : `T = 2π · √((${km(e.A)})³ / ${sci(e.mu)} km³/s²)\n  = ${days(e.T)}` + (e.parent.index === 0
          ? L(`\nT²/a³ = ${nf(Math.pow(e.T / 86400 / 365.25, 2) / Math.pow(e.A / AU, 3), 4, 4)} Jahr²/AE³ (für alle Planeten ≈ 1)`, `\nT²/a³ = ${nf(Math.pow(e.T / 86400 / 365.25, 2) / Math.pow(e.A / AU, 3), 4, 4)} yr²/AU³ (≈ 1 for every planet)`) : ''),
      L('Kepler fand T² ∝ a³ an den Planeten; Newton zeigte, warum: Schwerkraft ∝ 1/r². Mit der Formel wiegt man Himmelskörper – aus der Umlaufzeit eines Mondes folgt die Masse des Planeten.',
        "Kepler found T² ∝ a³ from the planets; Newton showed why: gravity ∝ 1/r². The formula weighs celestial bodies – a moon's period gives the mass of its planet."));
    this.card(L('Vis-viva-Gleichung – die Geschwindigkeit', 'Vis-viva equation – the speed'), 'v² = GM · (2/r − 1/a)',
      e => !e ? '' : L(`jetzt: r = ${km(e.R)} → v = ${kms(Math.sqrt(e.mu * (2 / e.R - 1 / e.A)))} (gemessen ${kms(e.V)})\nim Perizentrum: ${kms(e.Vp)}` + (e.open ? '' : `   im Apozentrum: ${kms(e.Va)}`),
        `now: r = ${km(e.R)} → v = ${kms(Math.sqrt(e.mu * (2 / e.R - 1 / e.A)))} (measured ${kms(e.V)})\nat periapsis: ${kms(e.Vp)}` + (e.open ? '' : `   at apoapsis: ${kms(e.Va)}`)),
      L('Energieerhaltung: Bewegungsenergie + Lageenergie = konstant. Je näher am Zentralkörper, desto schneller.', 'Conservation of energy: kinetic + potential energy = constant. The closer to the central body, the faster.'));
    if (b.rendered && b.mass > 1e10 && b.R > 0.5)
      this.card(L(`Schwerkraft auf ${N(b)}`, `Gravity on ${N(b)}`), L('g = GM / R²     v_Flucht = √(2GM / R)', 'g = GM / R²     v_escape = √(2GM / R)'),
        () => { const gm = b.GM, R = b.R, g = gm / (R * R) * 1000;
          return L(`g = ${nf(g)} m/s² (${nf(g / 9.81)} g)\nKreisbahn dicht über dem Boden: ${kms(Math.sqrt(gm / R))}\nFluchtgeschwindigkeit: ${kms(Math.sqrt(2 * gm / R))}`,
            `g = ${nf(g)} m/s² (${nf(g / 9.81)} g)\ncircular orbit just above the ground: ${kms(Math.sqrt(gm / R))}\nescape velocity: ${kms(Math.sqrt(2 * gm / R))}`); },
        L(`Wie schwer man auf ${N(b)} wäre und wie schnell eine Rakete sein muss, um ihn zu verlassen. Auf der Erde: 9,81 m/s², 11,2 km/s.`, `How heavy you would be on ${N(b)} and how fast a rocket must be to leave it. On Earth: 9.81 m/s², 11.2 km/s.`));
    if (el.parent.index === 0 && b.name !== 'Erde' && !el.open) {
      this.card(L('Hohmann-Transfer von der Erde', 'Hohmann transfer from Earth'), 'a_t = (r₁ + r₂)/2     t = π · √(a_t³ / GM☉)',
        e => { if (!e) return ''; const r1 = AU, r2 = e.A, mu = GMSun, at = (r1 + r2) / 2, t = Math.PI * Math.sqrt(at * at * at / mu);
          const dv1 = Math.sqrt(mu / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1), dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
          return L(`a_t = ${km(at)} → Flugzeit ${days(t)}\nΔv₁ = ${kms(Math.abs(dv1))} beim Abflug, Δv₂ = ${kms(Math.abs(dv2))} bei Ankunft`, `a_t = ${km(at)} → flight time ${days(t)}\nΔv₁ = ${kms(Math.abs(dv1))} at departure, Δv₂ = ${kms(Math.abs(dv2))} at arrival`); },
        L('Die sparsamste Bahn zwischen zwei Kreisbahnen: eine halbe Ellipse, die beide berührt. So (oder fast so) fliegen Sonden zu Mars oder Venus – darum öffnet sich ein Startfenster nur alle paar Jahre.',
          'The most economical path between two circular orbits: half an ellipse touching both. Probes fly (almost) like this to Mars or Venus – which is why a launch window opens only every few years.'));
      this.card(L('Synodische Periode', 'Synodic period'), L('1/S = |1/T_Erde − 1/T|', '1/S = |1/T_Earth − 1/T|'),
        e => { if (!e) return ''; const te = 365.256, tp = e.T / 86400; return `S = 1 / |1/${nf(te, 1)} − 1/${nf(tp, 1)}| = ${duration(1 / Math.abs(1 / te - 1 / tp))}`; },
        L('So lange dauert es, bis Erde, Sonne und der Körper wieder gleich zueinander stehen – z. B. von einer Mars-Opposition zur nächsten oder von Startfenster zu Startfenster.',
          'The time until Earth, Sun and the body line up the same way again – e.g. from one Mars opposition to the next, or from launch window to launch window.'));
    }
    if ((b.kind === 'Planet' || b.kind === 'Moon' || b.kind === 'Dwarf') && b.mass > 1e15 && !el.open)
      this.card(L('Hill-Sphäre – Reich der Schwerkraft', 'Hill sphere – realm of gravity'), 'r_H ≈ a(1−e) · ∛(m / 3M)',
        e => !e ? '' : `r_H ≈ ${km(e.A * (1 - e.E) * Math.cbrt(b.mass / (3 * (e.parent.index === 0 ? 1.989e30 : e.parent.mass))))}`,
        L(`Innerhalb dieses Abstands kann ${N(b)} eigene Monde halten; weiter draußen zieht ${par} sie fort.`, `Within this distance ${N(b)} can keep moons of its own; farther out, ${par} pulls them away.`));
    this.card(L('Lichtlaufzeit', 'Light travel time'), L('t = d / c     c = 299 792,458 km/s', 't = d / c     c = 299,792.458 km/s'),
      e => { const jd = e?.jd ?? 0, d = abs(b, jd).sub(abs(find('Erde')!, jd)).len; return L(`Erde → ${N(b)}: t = ${km(d)} / c = ${lightTime(d)}`, `Earth → ${N(b)}: t = ${km(d)} / c = ${lightTime(d)}`); },
      L('Was wir sehen, ist immer Vergangenheit. Funkbefehle an Sonden brauchen genauso lange – darum landen Marsrover vollautomatisch.', 'What we see is always the past. Radio commands to probes take just as long – which is why Mars rovers land fully automatically.'));
  }

  /** Bahn in ihrer Ebene: Ellipse/Hyperbel, Brennpunkt, Peri-/Apozentrum, Ort, Flächenstücke gleicher Zeit (wandern mit). */
  drawDiagram() {
    const el = this.cur, c = this.canvas;
    if (!el || !c.isConnected) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
    if (W < 20) return;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const e = el.E, acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffb347';
    const P = (nu: number) => { const p = Math.abs(el.A) * Math.abs(1 - e * e), r = p / (1 + e * Math.cos(nu)); return [r * Math.cos(nu), r * Math.sin(nu)]; };
    const nuMax = e < 1 ? Math.PI : Math.acos(-1 / e) * 0.92;
    const pts: number[][] = []; for (let k = 0; k <= 200; k++) pts.push(P(-nuMax + 2 * nuMax * k / 200));
    let minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    if (e >= 1) { maxX = Math.max(maxX, el.Q * 3); minX = Math.min(minX, -el.Q * 6); maxY = Math.min(maxY, el.Q * 8); minY = Math.max(minY, -el.Q * 8); }
    const s = Math.min((W - 30) / (maxX - minX), (H - 30) / (maxY - minY));
    const ox = W / 2 - (minX + maxX) / 2 * s, oy = H / 2 + (minY + maxY) / 2 * s;
    const M = (p: number[]) => [ox + p[0] * s, oy - p[1] * s];
    if (e < 1) {
      const t0 = (performance.now() - this.t0) / 1000 * 0.05;
      g.fillStyle = acc; g.globalAlpha = 0.22;
      for (let k = 0; k < 8; k++) {
        const Ma = (k / 8 + t0) * 2 * Math.PI, Mb = ((k + 0.5) / 8 + t0) * 2 * Math.PI;
        g.beginPath(); g.moveTo(...(M([0, 0]) as [number, number]));
        for (let j = 0; j <= 16; j++) { const Mm = Ma + (Mb - Ma) * j / 16, E = solveKepler(Mm, e); const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); g.lineTo(...(M(P(nu)) as [number, number])); }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
    }
    g.strokeStyle = 'rgba(220,228,240,.6)'; g.lineWidth = 1.2; g.beginPath();
    pts.forEach((p, i) => { const [x, y] = M(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (e < 1) g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(220,228,240,.25)'; g.beginPath(); g.moveTo(...(M(P(0)) as [number, number])); g.lineTo(...(M(e < 1 ? P(Math.PI) : [minX, 0]) as [number, number])); g.stroke();
    const [cx, cy] = M([0, 0]); g.fillStyle = '#fff0c8'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
    g.font = '500 10.5px system-ui'; g.fillStyle = 'rgba(220,228,240,.75)';
    g.fillText(nameOf(el.parent), cx + 7, cy + 14);
    const [px, py] = M(P(0)); g.fillText(tr('Perizentrum') === 'Perizentrum' ? L('Perizentrum', 'Periapsis') : tr('Perizentrum'), px - 30, py - 8);
    if (e < 1) { const [ax, ay] = M(P(Math.PI)); g.fillText(L('Apozentrum', 'Apoapsis'), ax + 2, ay - 8); }
    const [ux, uy] = M(P(el.Nu));
    g.strokeStyle = acc; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ux, uy); g.stroke();
    g.fillStyle = acc; g.beginPath(); g.arc(ux, uy, 5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = 'rgba(240,244,250,.9)'; g.fillText(nameOf(el.body), ux + 8, uy - 8);
  }
}
