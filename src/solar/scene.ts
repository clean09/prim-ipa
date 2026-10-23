// Sonnensystem – Szene: Zeit, Kamera (Ziel + Abstand, Kamerafahrt logarithmisch), sichtbare Körper, Verdecker für Finsternisse,
// Bahnlinien, Missionen mit Autopilot. Ohne DOM (die Seite pages/solar.ts baut die Oberfläche).
import { BODIES, Body, Surf, find, idx } from './catalog';
import { AU, Deg, V, msToJd } from './math';
import { Dots, buildDots, computeAll, orbitPath, period, updateDots } from './ephem';
import { MISSIONS, Mission } from './missions';
import { Camera, DrawBody, LineSet, SolarRender, UNIT } from './render';

export interface Label { b: Body; x: number; y: number; major: boolean }

export class SolarScene {
  jd = msToJd(Date.now());
  rate = 1 / 86400;                 // Tage je Sekunde (1/86400 = Echtzeit)
  paused = false;
  target = 0;
  selected = 0;
  yaw = 0.6; pitch = 0.35; dist = 60000;
  fovY = 50 * Deg;
  showOrbits = true; showLabels = true; showDots = false; showMinor = false;
  mission: Mission | null = null;
  missionPhase = -1;
  autopilot = true;
  pos: V[] = [];
  cam: Camera = { pos: V.Zero, right: new V(1, 0, 0), up: new V(0, 0, 1), fwd: new V(0, 1, 0), fovY: this.fovY };
  labels: Label[] = [];
  private pickable: Body[] = [];
  private fly: { from: number; to: number; d0: number; d1: number; t0: number; ms: number; look0: V } | null = null;
  private dots: Dots | null = null; private dotBuf: Float32Array | null = null; private dotJd = NaN; private dotRef = V.Zero;
  private paths = new Map<number, { jd: number; pts: V[] }>();
  private trail: { jd: number; pts: V[] } | null = null;
  onPhase: (k: number) => void = () => {};

  constructor(readonly r: SolarRender) {
    this.target = this.selected = idx('Erde');
    computeAll(this.jd, this.pos);
    const e = this.pos[this.target];
    this.yaw = Math.atan2(-e.y, -e.x) + 0.7;
  }

  // ------------------------------------------------------------------ Kamera
  dirOf(yaw = this.yaw, pitch = this.pitch) { return new V(Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)); }
  minDist(i = this.target) { const b = BODIES[i]; return b.rendered || b.index === 0 ? b.bound * 1.12 + 0.02 : 0.05; }
  /** Sinnvoller Betrachtungsabstand für einen Körper. */
  niceDist(i: number) {
    const b = BODIES[i];
    if (b.kind === 'Stream') return 0.4 * AU;
    if (!b.rendered && b.index !== 0) return b.kind === 'Probe' ? 20000 : 1e6;
    return Math.max(b.ringOut * 2.6, b.bound * 3.6, 0.2);
  }
  flyTo(i: number, dist = this.niceDist(i), ms = 2400) {
    if (i === this.target && !this.fly) { this.dist = dist; return; }
    this.fly = { from: this.target, to: i, d0: this.dist, d1: Math.max(dist, this.minDist(i)), t0: performance.now(), ms: document.documentElement.dataset.motion === 'reduced' ? 1 : ms, look0: this.lookAt() };
    this.target = i; this.selected = i;
  }
  jump(i: number, dist?: number) { this.fly = null; this.target = this.selected = i; this.dist = Math.max(dist ?? this.niceDist(i), this.minDist(i)); }
  get flying() { return !!this.fly; }
  lookAt() { return this.pos[this.target] ?? V.Zero; }
  zoom(f: number) { this.dist = Math.min(4e11, Math.max(this.minDist(), this.dist * f)); if (this.fly) this.fly.d1 = Math.max(this.minDist(), this.fly.d1 * f); }
  orbit(dx: number, dy: number) { this.yaw -= dx; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy)); }

  // ------------------------------------------------------------------ Missionen
  startMission(m: Mission | null, phase = 0) {
    this.mission = m;
    if (!m) { this.missionPhase = -1; this.trail = null; return; }
    const p = m.phases[Math.max(0, phase)];
    this.jd = p.jd; this.paused = false; this.autopilot = true; this.missionPhase = -1;
    this.applyPhase(Math.max(0, phase), true);
  }
  private applyPhase(k: number, jumpNow = false) {
    const m = this.mission!; const p = m.phases[k];
    this.missionPhase = k;
    this.rate = p.rate;
    const look = find(p.look);
    if (look) { if (jumpNow) this.jump(look.index, p.dist); else this.flyTo(look.index, p.dist, 1600); this.aim = true; }
    this.onPhase(k);
  }

  private aim = false;
  /** Ziel dicht über einer Oberfläche (Start, Landung): Kamera schräg von oben statt womöglich unter den Boden. */
  private aimFromAbove() {
    const t = this.pos[this.target]; if (!t) return;
    const tb = BODIES[this.target];
    if (tb.rendered && tb.surf !== Surf.Craft && tb.index !== 0) {
      // Himmelskörper als Ziel: von der Tagseite her; liegt das Raumschiff gerade darauf, über dessen Ort
      const sun = t.neg().norm, cr = this.mission ? this.pos[this.mission.craft] : null;
      let dir = sun.add(sun.cross(V.UnitZ).norm.mul(0.55));
      if (cr && cr.sub(t).len < tb.bound * 1.3) dir = cr.sub(t).norm.mul(0.9).add(sun.mul(0.6));
      dir = dir.norm;
      this.yaw = Math.atan2(dir.y, dir.x); this.pitch = Math.max(-1.45, Math.min(1.45, Math.asin(dir.z)));
      return;
    }
    let best: Body | null = null, bd = Infinity;
    for (const b of BODIES) {
      if (!b.rendered || b.index === this.target || b.surf === Surf.Craft || b.bound < 5) continue;
      const d = t.sub(this.pos[b.index]).len / b.bound;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best || bd > 1 + (this.fly ? this.fly.d1 : this.dist) / best.bound * 0.8 + 0.3) return;
    const up = t.sub(this.pos[best.index]).norm;
    let side = up.cross(V.UnitZ); side = side.len < 1e-6 ? new V(1, 0, 0) : side.norm;
    const dir = up.mul(0.75).add(side.mul(0.66)).norm;
    this.yaw = Math.atan2(dir.y, dir.x); this.pitch = Math.max(-1.45, Math.min(1.45, Math.asin(dir.z)));
  }

  // ------------------------------------------------------------------ Bild
  step(dtSec: number, now: number) {
    if (!this.paused) this.jd += this.rate * dtSec;
    this.jd = Math.min(2816787.5, Math.max(2305447.5, this.jd));     // 1600 … 3000 (Gültigkeit der Bahnen ohnehin begrenzt)
    computeAll(this.jd, this.pos);
    if (this.mission && this.autopilot) {
      const k = this.mission.phaseAt(this.jd);
      if (k >= 0 && k !== this.missionPhase) this.applyPhase(k);
    }
    if (this.aim) { this.aim = false; this.aimFromAbove(); }
    // Kamera
    let look = this.lookAt(), dist = this.dist;
    if (this.fly) {
      const f = this.fly, u = Math.min(1, (now - f.t0) / f.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const a = f.look0, b = this.pos[f.to];
      look = V.lerp(a, b, e);
      const sep = b.sub(a).len;
      const bump = 4 * e * (1 - e) * Math.max(0, Math.log(sep / (f.d0 + f.d1) + 1)) * 0.9;
      dist = Math.exp(Math.log(f.d0) * (1 - e) + Math.log(f.d1) * e + bump);
      if (u >= 1) { this.fly = null; this.dist = f.d1; dist = f.d1; }
    }
    let camPos = look.add(this.dirOf().mul(dist));
    // Nie im Inneren eines Körpers stehen (z. B. Raumschiff auf der Startrampe, Kamera „unter“ dem Boden):
    // auf die Oberfläche (+ etwas Luft) hinausschieben und weiter auf das Ziel blicken.
    for (const b of BODIES) {
      if (!b.rendered || b.index === this.target || b.bound < 5) continue;
      const c = this.pos[b.index], off = camPos.sub(c), lim = b.bound * 1.04 + 0.05;
      if (off.len2 < lim * lim) camPos = c.add((off.len > 1e-9 ? off.norm : V.UnitZ).mul(lim));
    }
    let fwd = look.sub(camPos); fwd = fwd.len > 1e-9 ? fwd.norm : this.dirOf().neg();
    let right = fwd.cross(V.UnitZ); right = right.len < 1e-6 ? new V(1, 0, 0) : right.norm;
    this.cam = { pos: camPos, fwd, right, up: right.cross(fwd), fovY: this.fovY };
  }

  /** Was gezeichnet wird: Kugeln, Leuchtpunkte, Linien, Beschriftungen. */
  build(now: number) {
    const cam = this.cam, r = this.r;
    const bodies: DrawBody[] = [], points: { pos: V; col: [number, number, number]; size: number }[] = [], lines: LineSet[] = [];
    const labels: Label[] = [], pickable: Body[] = [];
    const tgt = BODIES[this.target], sys = tgt.kind === 'Moon' ? tgt.parent : this.target;
    // Große Scheiben im Bild verdecken, was dahinter liegt (Beschriftungen, Leuchtpunkte)
    const blockers: { c: V; R: number; d: number }[] = [];
    for (const b of BODIES) {
      if (!b.rendered || b.bound < 5) continue;
      const q = this.pos[b.index].sub(cam.pos), dl = q.len;
      if (r.pxRadius(cam, dl, b.R) > 6) blockers.push({ c: q, R: b.R, d: dl });
    }
    const hidden = (rel: V, dist: number) => {
      const u = rel.div(dist);
      for (const k of blockers) {
        if (k.d >= dist - k.R * 0.5) continue;
        const t = k.c.dot(u); if (t <= 0) continue;
        if (k.c.len2 - t * t < k.R * k.R * 0.98) return true;
      }
      return false;
    };
    for (const b of BODIES) {
      const p = this.pos[b.index], rel = p.sub(cam.pos), dist = rel.len;
      const pr0 = r.project(cam, p);
      const pr = pr0 && !hidden(rel, dist) ? pr0 : null;
      const px = r.pxRadius(cam, dist, b.bound);
      const near = b.index === this.target || b.index === this.selected || b.parent === sys || b.index === sys;
      const isMajor = b.kind === 'Planet' || b.kind === 'Dwarf' || b.index === 0;
      const minorOn = this.showMinor || near || (this.mission && b.index === this.mission.craft);
      if (b.kind === 'Stream' && !(this.showMinor || near)) continue;
      if ((b.kind === 'Asteroid' || b.kind === 'Comet' || b.kind === 'Probe') && !minorOn) continue;
      if (b.kind === 'Moon' && !near && px < 0.6) continue;
      if ((b.rendered || b.index === 0) && px >= 1.2 && b.surf !== Surf.Craft) {
        bodies.push({ b, pos: p, occ: this.occluders(b), sunVis: 1 }); pickable.push(b);
      } else if (pr) {
        const col: [number, number, number] = b.index === 0 ? [1, 0.85, 0.6] : b.kind === 'Probe' || b.surf === Surf.Craft ? [0.4, 0.9, 1] : b.kind === 'Stream' ? [0.6, 0.7, 1] : [b.col1[0] * 0.8 + 0.2, b.col1[1] * 0.8 + 0.2, b.col1[2] * 0.8 + 0.2];
        const size = b.index === 0 ? 14 : isMajor ? 9 : b.kind === 'Moon' ? 6 : 6;
        points.push({ pos: p, col: col.map(c => c * (isMajor ? 0.9 : 0.6)) as [number, number, number], size }); pickable.push(b);
      }
      if (b.index === 0 && pr) {
        const sunPx = r.pxRadius(cam, dist, b.R);
        points.push({ pos: p, col: sunPx > 25 ? [0.5, 0.36, 0.2] : [1, 0.78, 0.5], size: sunPx > 25 ? sunPx * 2.6 : Math.max(40, sunPx * 5) });
      }
      // Beschriftung
      if (pr && this.showLabels && (isMajor || near || b.index === this.selected || (this.mission && b.index === this.mission.craft) || (minorOn && b.kind !== 'Moon'))) {
        if (pr[0] > -40 && pr[1] > -20 && pr[0] < r.w / r.dpr + 40 && pr[1] < r.h / r.dpr + 20)
          labels.push({ b, x: pr[0], y: pr[1] + Math.max(px, 4) + 6, major: isMajor || b.index === this.selected });
      }
      // Bahn
      if (this.showOrbits && b.orbit && (b.kind === 'Planet' || b.kind === 'Dwarf' || (b.kind === 'Moon' && (near || b.parent === sys)) || ((b.kind === 'Asteroid' || b.kind === 'Comet') && (this.showMinor || near)) || b.index === this.selected)) {
        const path = this.path(b);
        // Ganz nah an einem Körper wären fremde Planetenbahnen nur gerade Striche quer durchs Bild → ausblenden
        const parentP = b.parent >= 0 ? this.pos[b.parent] : V.Zero, orbR = p.sub(parentP).len;
        const fade = near || b.index === this.selected ? 1 : Math.min(1, Math.max(0, Math.log10(this.dist / Math.max(orbR, 1)) + 3.3));
        if (path.length > 2 && fade > 0.02) {
          const parent = b.parent >= 0 ? this.pos[b.parent] : V.Zero;
          const pts = path.map(q => q.add(parent));
          const sel = b.index === this.selected;
          const col: [number, number, number, number] = sel ? [1, 0.82, 0.45, 0.85] : b.kind === 'Planet' ? [0.55, 0.7, 1, 0.32] : b.kind === 'Moon' ? [0.6, 0.75, 0.95, 0.28] : b.kind === 'Comet' ? [0.6, 0.95, 0.9, 0.3] : [0.75, 0.7, 0.62, 0.28];
          col[3] *= fade;
          lines.push(SolarRender.line(pts, cam.pos, col));
        }
      }
    }
    // Missionsbahn (im Bezugssystem des „Trail“-Körpers)
    if (this.mission) lines.push(SolarRender.line(this.missionTrail(), cam.pos, [0.35, 0.95, 1, 0.9], true));
    this.labels = labels; this.pickable = pickable;
    // Kleinkörper-Wolke
    if (this.showDots) this.updateDotCloud(now);
    return { bodies, points, lines };
  }

  /** Bis zu zwei Verdecker (Finsternisse): Mutterkörper und Monde, die der Sonnenlinie am nächsten stehen. */
  private occluders(b: Body) {
    if (b.index === 0) return [];
    const p = this.pos[b.index], sun = p.neg().norm;
    const cand: { pos: V; R: number; s: number }[] = [];
    const consider = (o: Body) => {
      if (!o.rendered || o.index === b.index || o.index === 0) return;
      const q = this.pos[o.index], dq = q.sub(p), dl = dq.len;
      if (dq.dot(sun) <= 0) return;
      const ang = Math.acos(Math.min(1, dq.dot(sun) / dl)), size = Math.asin(Math.min(1, o.R / dl)) + 0.0047 + Math.asin(Math.min(1, b.R / dl));
      if (ang < size * 3) cand.push({ pos: q, R: o.R, s: ang - size });
    };
    if (b.parent > 0) consider(BODIES[b.parent]);
    for (const o of BODIES) if (o.parent === b.index || (b.parent > 0 && o.parent === b.parent && o.kind === 'Moon')) consider(o);
    return cand.sort((x, y) => x.s - y.s).slice(0, 2);
  }

  private path(b: Body) {
    const per = period(b), c = this.paths.get(b.index);
    const tol = isFinite(per) ? Math.max(per * 0.02, 0.5) : 3650;
    if (c && Math.abs(c.jd - this.jd) < tol) return c.pts;
    const n = b.kind === 'Comet' || (b.orbit?.E ?? 0) > 0.5 ? 240 : 160;
    const pts = orbitPath(b, this.jd, n);
    this.paths.set(b.index, { jd: this.jd, pts });
    return pts;
  }

  private missionTrail(): V[] {
    const m = this.mission!, tb = find(m.trail)!;
    if (this.trail && Math.abs(this.trail.jd - this.jd) < (m.end - m.start) / 600) return this.trail.pts.map(q => q.add(this.pos[tb.index]));
    const t1 = Math.min(this.jd, m.end), t0 = m.start, n = 360, rel: V[] = [];
    if (t1 > t0) {
      // dichter nahe der aktuellen Zeit (log. Rückblick), damit Manöver sichtbar bleiben
      for (let k = 0; k <= n; k++) {
        const u = k / n, t = t1 - (t1 - t0) * Math.pow(1 - u, 2.2);
        const tbp = tb.index === 0 ? V.Zero : absAt(tb, t);
        rel.push(m.at(t).sub(tbp));
      }
    }
    this.trail = { jd: this.jd, pts: rel };
    return rel.map(q => q.add(this.pos[tb.index]));
  }

  private updateDotCloud(now: number) {
    if (!this.dots) { this.dots = buildDots(0.2); this.dotBuf = new Float32Array(this.dots.count * 3); this.r.setDots(this.dots.col, this.dots.size, this.dots.count); }
    const ref = this.cam.pos;
    if (Math.abs(this.jd - this.dotJd) > Math.max(0.05, Math.abs(this.rate) * 0.1) || ref.sub(this.dotRef).len > this.dist * 0.02 || !isFinite(this.dotJd)) {
      updateDots(this.dots, this.jd, ref, UNIT, this.dotBuf!);
      this.r.updateDots(this.dotBuf!);
      this.dotJd = this.jd; this.dotRef = ref;
    }
    void now;
  }

  /** Körper unter dem Finger (CSS-Pixel): nächster Treffer innerhalb von 28 px. */
  pick(x: number, y: number): number {
    let best = -1, bd = 28 * 28;
    for (const b of this.pickable) {
      const l = { b };
      const pr = this.r.project(this.cam, this.pos[l.b.index]); if (!pr) continue;
      const rad = this.r.pxRadius(this.cam, this.pos[l.b.index].sub(this.cam.pos).len, l.b.bound);
      const d2 = Math.max(0, Math.hypot(pr[0] - x, pr[1] - y) - rad) ** 2;
      if (d2 < bd) { bd = d2; best = l.b.index; }
    }
    return best;
  }
}

import { abs } from './ephem';
const absAt = (b: Body, t: number) => abs(b, t);
void MISSIONS;
