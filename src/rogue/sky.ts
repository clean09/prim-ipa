// Lebender Hintergrund von STERNENFALL: eine Leinwand hinter jeder Ansicht. Thema = Sektor (Asteroiden, Eis, Nebel,
// Pulsar, Ereignishorizont, Kern, Rand), Stimmung = Lage (Karte, Kampf, Boss, Casino, Basar, Rast, Sieg, Niederlage …).
// Canvas 2D, ~30 Bilder/s, pausiert im Hintergrund; bei Bewegung „Aus“ nur ein ruhendes Bild.

import { sfs } from './settings';

export type Mood = 'hub' | 'map' | 'fight' | 'elite' | 'boss' | 'reward' | 'event' | 'shop' | 'casino' | 'rest' | 'chest' | 'won' | 'lost';
type RGB = [number, number, number];

const THEME: Record<string, { neb: RGB[]; star: RGB }> = {
  asteroiden: { neb: [[150, 90, 50], [110, 70, 60], [200, 150, 90]], star: [255, 236, 200] },
  eis: { neb: [[60, 130, 170], [90, 170, 190], [70, 90, 160]], star: [220, 240, 255] },
  nebel: { neb: [[170, 70, 150], [90, 70, 170], [210, 110, 120], [70, 150, 160]], star: [255, 230, 245] },
  pulsar: { neb: [[60, 80, 160], [100, 120, 200], [50, 60, 120]], star: [210, 225, 255] },
  horizont: { neb: [[120, 60, 140], [60, 30, 80], [200, 120, 80]], star: [240, 220, 255] },
  kern: { neb: [[170, 80, 50], [120, 40, 40], [190, 130, 70]], star: [255, 230, 190] },
  rand: { neb: [[40, 60, 90], [60, 50, 90], [30, 90, 100]], star: [200, 230, 240] },
  werft: { neb: [[120, 100, 80], [70, 80, 100], [170, 110, 60]], star: [250, 235, 210] },
  riff: { neb: [[40, 150, 130], [60, 110, 170], [150, 200, 120]], star: [220, 255, 240] },
  tiefsee: { neb: [[30, 70, 140], [40, 120, 150], [20, 40, 90]], star: [200, 230, 255] },
  sturm: { neb: [[110, 60, 170], [60, 50, 130], [170, 90, 160]], star: [235, 220, 255] },
};
/** Getönte NASA-Aufnahme je Thema (public/sf/img, siehe tools/sf_assets.py). */
const PHOTO: Record<string, string> = { asteroiden: 'guertel', eis: 'frost', nebel: 'orion', pulsar: 'pulsar', horizont: 'horizont', kern: 'kern', rand: 'rand', hub: 'hub', werft: 'werft', riff: 'riff', tiefsee: 'tiefsee', sturm: 'sturm' };
const photos = new Map<string, HTMLImageElement>();
function photo(key: string, onload: () => void) {
  let im = photos.get(key);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `${import.meta.env.BASE_URL}sf/img/sky_${key}.jpg`; photos.set(key, im); }
  if (im.complete && im.naturalWidth) return im;
  im.addEventListener('load', onload, { once: true });
  return null;
}
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

let current: { hold(ms: number): void } | null = null;
/** Himmel kurz anhalten (z. B. während die Walzen laufen). */
export const skyHold = (ms: number) => current?.hold(ms);
export class Sky {
  readonly el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private theme = 'rand'; private mood: Mood = 'hub'; private bg: [string, string] = ['#1a2236', '#07060f'];
  private base: HTMLCanvasElement | null = null;              // vorgerenderter Verlauf + Nebel-Sprites
  private blobs: { x: number; y: number; r: number; c: RGB; vx: number; vy: number; a: number; ph: number }[] = [];
  private stars: { x: number; y: number; z: number; tw: number; dead?: number }[] = [];
  private bits: { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; life: number; kind: number; seed: number }[] = [];
  private comets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private raf = 0; private last = 0; private t = 0; private running = false;
  private img: HTMLImageElement | null = null;
  private get still() { return document.documentElement.dataset.motion === 'reduced' || sfs().gfx === 'low'; }

  constructor() {
    current = this;
    this.el = document.createElement('canvas');
    this.el.className = 'sf-sky';
    this.ctx = this.el.getContext('2d')!;
    addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.vis);
  }
  private resize = () => {
    this.dpr = Math.min(sfs().gfx === 'high' ? 1.5 : 1, devicePixelRatio || 1);
    this.w = Math.max(1, this.el.clientWidth || innerWidth); this.h = Math.max(1, this.el.clientHeight || innerHeight);
    this.el.width = Math.round(this.w * this.dpr); this.el.height = Math.round(this.h * this.dpr);
    this.build();
  };
  private vis = () => { if (document.hidden) this.stop(); else this.start(); };

  /** Thema/Stimmung setzen (bei jedem Ansichtswechsel). */
  set(theme: string, mood: Mood, bg?: [string, string]) {
    const photoChanged = (mood === 'hub') !== (this.mood === 'hub');   // Brücke hat ein eigenes Bild
    const changed = photoChanged || theme !== this.theme || (bg && (bg[0] !== this.bg[0] || bg[1] !== this.bg[1]));
    this.theme = THEME[theme] ? theme : 'rand'; this.mood = mood; if (bg) this.bg = bg;
    if (!this.w) this.resize(); else if (changed) this.build();
    else this.seedBits();
    this.start();
  }
  start() { if (this.running || document.hidden) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  private holdUntil = 0; private bolt = 0;
  /** Himmel für ms anhalten (Walzenlauf): die Drift ist so langsam, dass man es nicht sieht – spart aber viel Rechenzeit. */
  hold(ms: number) { this.holdUntil = performance.now() + ms; }
  dispose() { this.stop(); removeEventListener('resize', this.resize); document.removeEventListener('visibilitychange', this.vis); this.el.remove(); }

  // ------------------------------------------------------------------------------------------- Aufbau
  private build() {
    const { w, h } = this, th = THEME[this.theme];
    const key = this.mood === 'hub' ? 'hub' : PHOTO[this.theme];
    this.img = key ? photo(key, () => { if (PHOTO[this.theme] === key || (this.mood === 'hub' && key === 'hub')) { this.img = photos.get(key)!; if (this.still) this.start(); } }) : null;
    // Grundverlauf einmal vorrendern
    const b = document.createElement('canvas'); b.width = this.el.width; b.height = this.el.height;
    const g = b.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const lin = g.createLinearGradient(0, 0, 0, h); lin.addColorStop(0, this.bg[0]); lin.addColorStop(0.55, this.bg[1]); lin.addColorStop(1, this.bg[1]);
    g.fillStyle = lin; g.fillRect(0, 0, w, h);
    const rad = g.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, h * 0.9); rad.addColorStop(0, this.bg[0]); rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad; g.fillRect(0, 0, w, h);
    this.base = b;
    // Nebelwolken
    const n = this.theme === 'nebel' ? 9 : this.theme === 'rand' ? 4 : 6;
    this.blobs = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h * 0.9, r: (0.35 + Math.random() * 0.5) * Math.max(w, h), c: th.neb[i % th.neb.length],
      vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 2, a: 0.13 + Math.random() * 0.14, ph: Math.random() * 6.28 }));
    // Sterne in drei Tiefen
    const count = this.theme === 'kern' ? 260 : this.theme === 'rand' ? 90 : 170;
    this.stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random(), tw: Math.random() * 6.28 }));
    this.seedBits();
  }
  /** Themen-Objekte (Asteroiden, Flocken, Funken …) + Stimmungs-Teilchen. */
  private seedBits() {
    const { w, h } = this;
    this.bits = [];
    const add = (k: number, n: number, f: () => Partial<Sky['bits'][number]>) => { for (let i = 0; i < n; i++) this.bits.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, r: 2, rot: Math.random() * 6.28, vr: 0, life: Math.random(), kind: k, seed: Math.random(), ...f() }); };
    switch (this.theme) {
      case 'asteroiden': add(1, 11, () => ({ vx: 4 + Math.random() * 10, vy: (Math.random() - 0.5) * 3, r: 6 + Math.random() * 22, vr: (Math.random() - 0.5) * 0.6 })); break;
      case 'eis': add(2, 55, () => ({ vx: (Math.random() - 0.5) * 6, vy: 8 + Math.random() * 16, r: 1 + Math.random() * 2.5, vr: (Math.random() - 0.5) * 1.5 })); break;
      case 'nebel': add(3, 30, () => ({ vy: -(4 + Math.random() * 8), vx: (Math.random() - 0.5) * 3, r: 1.5 + Math.random() * 3 })); break;
      case 'kern': add(4, 60, () => ({ y: h * (0.5 + Math.random() * 0.6), vy: -(10 + Math.random() * 30), vx: (Math.random() - 0.5) * 6, r: 1 + Math.random() * 2.2 })); break;
      case 'werft': add(1, 8, () => ({ vx: 2 + Math.random() * 6, vy: (Math.random() - 0.5) * 2, r: 10 + Math.random() * 26, vr: (Math.random() - 0.5) * 0.3 })); add(4, 20, () => ({ y: h * Math.random(), vy: -(6 + Math.random() * 12), vx: (Math.random() - 0.5) * 4, r: 0.8 + Math.random() * 1.4 })); break;
      case 'riff': add(7, 40, () => ({ vy: -(3 + Math.random() * 7), vx: (Math.random() - 0.5) * 4, r: 1.5 + Math.random() * 3.5 })); break;
      case 'tiefsee': add(6, 34, () => ({ vy: -(8 + Math.random() * 18), vx: (Math.random() - 0.5) * 3, r: 1.5 + Math.random() * 5 })); break;
      case 'sturm': add(8, 70, () => ({ vy: 140 + Math.random() * 120, vx: -40 - Math.random() * 30, r: 6 + Math.random() * 10 })); break;
      case 'rand': add(5, 5, () => ({ vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, r: 30 + Math.random() * 70, vr: (Math.random() - 0.5) * 0.08 })); break;
    }
    const m = this.mood;
    if (m === 'casino') add(10, 70, () => ({ vy: 20 + Math.random() * 40, r: 1 + Math.random() * 2.5, vr: (Math.random() - 0.5) * 4 }));
    if (m === 'shop') add(11, 14, () => ({ vy: -(2 + Math.random() * 5), r: 20 + Math.random() * 40 }));
    if (m === 'event') add(12, 26, () => ({ vy: -(3 + Math.random() * 6), vx: (Math.random() - 0.5) * 4, r: 1.5 + Math.random() * 2 }));
    if (m === 'won' || m === 'reward') add(13, m === 'won' ? 80 : 30, () => ({ y: h * Math.random(), vy: -(15 + Math.random() * 40), vx: (Math.random() - 0.5) * 8, r: 1 + Math.random() * 2.4 }));
    if (m === 'lost') add(14, 70, () => ({ vy: 6 + Math.random() * 12, vx: 2 + Math.random() * 4, r: 0.8 + Math.random() * 1.8 }));
    if (m === 'rest') add(15, 18, () => ({ vy: -(2 + Math.random() * 3), r: 1 + Math.random() * 1.6 }));
  }

  // ------------------------------------------------------------------------------------------- Bild
  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    if (now - this.last < (sfs().gfx === 'high' ? 31 : 41)) return;   // ~30 (mittel ~24) Bilder/s reichen für Hintergründe
    if (now < this.holdUntil) { this.last = now; return; }      // während teurer Momente (Walzen) kurz anhalten
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const pace = this.mood === 'boss' ? 2.2 : this.mood === 'elite' ? 1.6 : this.mood === 'fight' ? 1.3 : this.mood === 'rest' || this.mood === 'lost' ? 0.6 : 1;
    this.t += dt * pace;
    this.draw(dt * pace);
    if (this.still) this.stop();
  };

  private draw(dt: number) {
    const { ctx, w, h, t } = this, th = THEME[this.theme];
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.base) ctx.drawImage(this.base, 0, 0, w, h); else { ctx.fillStyle = '#07060f'; ctx.fillRect(0, 0, w, h); }
    // Getönte Aufnahme, langsame Kamerafahrt (Ken Burns)
    if (this.img) {
      const im = this.img, z = 1.08 + 0.04 * Math.sin(t * 0.045);
      const sc = Math.max(w / im.naturalWidth, h / im.naturalHeight) * z;
      const iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
      const ox = (w - iw) / 2 + Math.sin(t * 0.031) * w * 0.03, oy = (h - ih) / 2 + Math.cos(t * 0.027) * h * 0.02;
      ctx.globalAlpha = this.mood === 'lost' ? 0.3 : this.mood === 'fight' || this.mood === 'boss' || this.mood === 'elite' ? 0.5 : this.mood === 'map' || this.mood === 'hub' || this.mood === 'won' ? 0.62 : 0.34;
      ctx.drawImage(im, ox, oy, iw, ih);
      ctx.globalAlpha = 1;
    }

    // Nebel (additiv)
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.blobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -b.r) b.x = w + b.r; if (b.x > w + b.r) b.x = -b.r; if (b.y < -b.r) b.y = h + b.r; if (b.y > h + b.r) b.y = -b.r;
      const a = b.a * (0.75 + 0.25 * Math.sin(t * 0.3 + b.ph)) * (this.mood === 'lost' ? 0.4 : 1);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(b.c, a)); g.addColorStop(0.5, rgba(b.c, a * 0.35)); g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    // Themenbühne hinter den Sternen
    if (this.theme === 'eis') this.aurora();
    if (this.theme === 'pulsar') this.pulsar();
    if (this.theme === 'sturm') { if (Math.random() < dt * 0.25) this.bolt = 1; if (this.bolt > 0) { ctx.fillStyle = `rgba(210,190,255,${0.18 * this.bolt})`; ctx.fillRect(0, 0, w, h); this.bolt -= dt * 3; } }
    if (this.theme === 'tiefsee') { for (let k = 0; k < 4; k++) { const x = w * (0.15 + k * 0.24) + Math.sin(t * 0.2 + k) * 30, g = ctx.createLinearGradient(x, 0, x + 60, h); g.addColorStop(0, `rgba(140,200,255,${0.07 + 0.03 * Math.sin(t * 0.5 + k * 2)})`); g.addColorStop(1, 'rgba(140,200,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 120, h); ctx.lineTo(x + 40, h); ctx.fill(); } }
    if (this.theme === 'horizont' && !this.img) this.blackHole();
    if (this.theme === 'kern') { const g = ctx.createRadialGradient(w / 2, h * 1.15, 0, w / 2, h * 1.15, h * 0.9); g.addColorStop(0, `rgba(255,160,80,${0.2 + 0.06 * Math.sin(t * 1.7)})`); g.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

    // Sterne (Parallaxe-Drift, Funkeln; am Rand verlöschen sie)
    const drift = this.mood === 'map' ? 3 : 6;
    for (const s of this.stars) {
      s.x -= drift * (0.2 + s.z) * dt;
      if (this.theme === 'horizont') { const dx = s.x - w * (this.img ? 0.5 : 0.7), dy = s.y - h * (this.img ? 0.5 : 0.4); const d = Math.hypot(dx, dy) || 1; s.x -= (dx / d) * 6 * dt + (dy / d) * 10 * dt; s.y -= (dy / d) * 6 * dt - (dx / d) * 10 * dt; if (d < 30) { s.x = Math.random() * w; s.y = Math.random() * h; } }
      if (s.x < 0) s.x += w;
      let a = (0.25 + s.z * 0.75) * (0.6 + 0.4 * Math.sin(t * (1 + s.z * 2) + s.tw));
      if (this.theme === 'rand') { if (s.dead == null && Math.random() < 0.0008) s.dead = 1; if (s.dead != null) { s.dead -= dt * 0.5; a *= Math.max(0, s.dead); if (s.dead <= -2) { s.dead = undefined; s.x = Math.random() * w; } } }
      const r = 0.4 + s.z * 1.3;
      ctx.fillStyle = rgba(th.star, a);
      ctx.fillRect(s.x - r / 2, s.y - r / 2, r, r);
      if (s.z > 0.93) { ctx.fillStyle = rgba(th.star, a * 0.25); ctx.fillRect(s.x - r * 2.5, s.y - 0.4, r * 5, 0.8); ctx.fillRect(s.x - 0.4, s.y - r * 2.5, 0.8, r * 5); }
    }

    // Sternschnuppen (selten)
    if (Math.random() < dt * (this.mood === 'won' ? 1.5 : 0.12)) this.comets.push({ x: Math.random() * w, y: Math.random() * h * 0.5, vx: -(220 + Math.random() * 200), vy: 80 + Math.random() * 80, life: 1 });
    ctx.lineCap = 'round';
    for (const c of this.comets) {
      c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt * 1.2;
      const g = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 0.18, c.y - c.vy * 0.18); g.addColorStop(0, `rgba(255,246,220,${c.life})`); g.addColorStop(1, 'rgba(255,246,220,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - c.vx * 0.18, c.y - c.vy * 0.18); ctx.stroke();
    }
    this.comets = this.comets.filter(c => c.life > 0);

    // Objekte und Stimmungsteilchen
    ctx.globalCompositeOperation = 'source-over';
    for (const b of this.bits) this.bit(b, dt);

    // Stimmung: Vignette / Tönung
    ctx.globalCompositeOperation = 'source-over';
    const vign = (c: RGB, a: number) => { const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, a)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    if (this.mood === 'boss') vign([140, 20, 20], 0.38 + 0.14 * Math.sin(t * 2.4));
    else if (this.mood === 'elite') vign([150, 70, 20], 0.3);
    else if (this.mood === 'casino') vign([90, 20, 70], 0.4);
    else if (this.mood === 'lost') { vign([0, 0, 0], 0.6); ctx.fillStyle = 'rgba(20,16,24,.25)'; ctx.fillRect(0, 0, w, h); }
    else if (this.mood === 'won') vign([200, 150, 60], 0.25);
    else vign([0, 0, 0], this.mood === 'map' || this.mood === 'hub' ? 0.45 : 0.62);
  }

  private aurora() {
    const { ctx, w, h, t } = this;
    for (let k = 0; k < 3; k++) {
      const yb = h * (0.12 + k * 0.08);
      const g = ctx.createLinearGradient(0, yb - 70, 0, yb + 110);
      const c: RGB = k === 1 ? [140, 120, 230] : [90, 230, 190];
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, 0.3 + 0.1 * Math.sin(t * 0.7 + k))); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, yb + 110);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, yb - 40 + Math.sin(x * 0.012 + t * 0.6 + k * 2) * 26 + Math.sin(x * 0.031 - t * 0.9) * 10);
      ctx.lineTo(w, yb + 110); ctx.closePath(); ctx.fill();
    }
  }
  private pulsar() {
    const { ctx, w, h, t } = this;
    const px = w * 0.82, py = h * 0.16, ang = t * 0.9;
    for (const off of [0, Math.PI]) {
      const a = ang + off, len = Math.max(w, h) * 1.4;
      const g = ctx.createRadialGradient(px, py, 0, px, py, len); g.addColorStop(0, 'rgba(200,220,255,.28)'); g.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, len, a - 0.09, a + 0.09); ctx.closePath(); ctx.fill();
    }
    const pulse = (t * 0.9) % 1;
    ctx.strokeStyle = `rgba(190,215,255,${0.35 * (1 - pulse)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 10 + pulse * 120, 0, 6.283); ctx.stroke();
    const core = ctx.createRadialGradient(px, py, 0, px, py, 26); core.addColorStop(0, 'rgba(255,255,255,.95)'); core.addColorStop(0.3, 'rgba(170,200,255,.6)'); core.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = core; ctx.fillRect(px - 26, py - 26, 52, 52);
  }
  private blackHole() {
    const { ctx, w, h, t } = this;
    const cx = w * 0.7, cy = h * 0.4, R = Math.min(w, h) * 0.12;
    const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 3.4); glow.addColorStop(0, 'rgba(255,170,90,.32)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - R * 3.4, cy - R * 3.4, R * 6.8, R * 6.8);
    const disk = (back: boolean) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.18); ctx.scale(1, 0.26);
      for (let k = 0; k < 6; k++) {
        const rr = R * (1.35 + k * 0.22);
        // Doppler: die auf uns zukommende Seite (links) ist heller
        const g = ctx.createLinearGradient(-rr, 0, rr, 0);
        const a = (back ? 0.35 : 0.8) * (1 - k * 0.12);
        g.addColorStop(0, `rgba(255,236,190,${a})`); g.addColorStop(0.5, `rgba(255,170,90,${a * 0.6})`); g.addColorStop(1, `rgba(200,90,50,${a * 0.35})`);
        ctx.strokeStyle = g; ctx.lineWidth = R * 0.16;
        ctx.beginPath(); ctx.arc(0, 0, rr, back ? Math.PI : 0, back ? 2 * Math.PI : Math.PI); ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {                          // Klumpen, die kreisen
        const a = i / 40 * 6.283 + t * (0.6 + (i % 4) * 0.12), rr = R * (1.4 + (i % 6) * 0.2);
        if ((Math.sin(a) < 0) !== back) continue;
        ctx.fillStyle = `rgba(255,${230 - (i % 6) * 18},${170 - (i % 6) * 15},.8)`;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.05, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    };
    disk(true);                                                // hintere Hälfte
    ctx.globalCompositeOperation = 'source-over';             // Schwarz muss decken (im additiven Modus wäre es unsichtbar)
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,225,180,.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, 6.283); ctx.stroke();   // Photonenring
    // gebogenes Licht der Scheibe über dem Loch
    ctx.strokeStyle = 'rgba(255,200,130,.35)'; ctx.lineWidth = R * 0.18; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.3, R * 1.18, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    disk(false);                                               // vordere Hälfte
  }
  private bit(b: Sky['bits'][number], dt: number) {
    const { ctx, w, h, t } = this;
    b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
    const wrap = (m: number) => { if (b.x < -m) b.x = w + m; if (b.x > w + m) b.x = -m; if (b.y < -m) b.y = h + m; if (b.y > h + m) b.y = -m; };
    switch (b.kind) {
      case 1: { // Asteroid: dunkle Kartoffel mit goldenem Streiflicht; „singt“ = pulsierender Schein
        wrap(b.r * 2);
        const sing = Math.max(0, Math.sin(t * 0.8 + b.seed * 20)) ** 6;
        if (sing > 0.05) { const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3); g.addColorStop(0, `rgba(240,200,120,${0.35 * sing})`); g.addColorStop(1, 'rgba(240,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - b.r * 3, b.y - b.r * 3, b.r * 6, b.r * 6); }
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const a = i / 14 * 6.283, rr = b.r * (0.86 + 0.1 * Math.sin(i * 1.9 + b.seed * 9) + 0.05 * Math.sin(i * 4.3 + b.seed * 3)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath();
        ctx.rotate(-b.rot);                                    // Licht kommt immer von oben links
        const lit = ctx.createRadialGradient(-b.r * 0.4, -b.r * 0.45, b.r * 0.1, 0, 0, b.r * 1.1);
        lit.addColorStop(0, '#6a5034'); lit.addColorStop(0.55, '#2a1e14'); lit.addColorStop(1, '#0e0a08');
        ctx.fillStyle = lit; ctx.fill(); ctx.strokeStyle = `rgba(201,164,92,${0.35 + sing * 0.5})`; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore(); break;
      }
      case 2: { wrap(10); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.strokeStyle = 'rgba(220,240,255,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * 1.047; ctx.moveTo(-Math.cos(a) * b.r * 2, -Math.sin(a) * b.r * 2); ctx.lineTo(Math.cos(a) * b.r * 2, Math.sin(a) * b.r * 2); } ctx.stroke(); ctx.restore(); break; }
      case 3: case 12: case 15: { wrap(10); const a = 0.4 + 0.4 * Math.sin(t * 2 + b.seed * 30); const c = b.kind === 3 ? '255,190,230' : b.kind === 12 ? '200,170,255' : '160,230,220'; ctx.fillStyle = `rgba(${c},${a})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); break; }
      case 4: case 13: { if (b.y < -10) { b.y = h + 10; b.x = Math.random() * w; } const hot = b.kind === 4 ? '255,180,90' : '255,226,150'; ctx.fillStyle = `rgba(${hot},${0.5 + 0.4 * Math.sin(t * 6 + b.seed * 40)})`; ctx.fillRect(b.x, b.y, b.r, b.r * 2.2); break; }
      case 6: { wrap(12); const wob = Math.sin(t * 2 + b.seed * 20) * 0.8; b.x += wob * dt * 8;   // Blasen (Tiefsee)
        ctx.strokeStyle = `rgba(190,230,255,${0.35 + 0.2 * Math.sin(t + b.seed * 9)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.stroke();
        ctx.fillStyle = 'rgba(230,250,255,.5)'; ctx.fillRect(b.x - b.r * 0.45, b.y - b.r * 0.55, b.r * 0.35, b.r * 0.35); break; }
      case 7: { wrap(14); const a = 0.25 + 0.35 * Math.sin(t * 1.5 + b.seed * 30) ** 2;   // leuchtende Sporen (Riff)
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3); g.addColorStop(0, `rgba(170,255,210,${a})`); g.addColorStop(1, 'rgba(120,230,200,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - b.r * 3, b.y - b.r * 3, b.r * 6, b.r * 6); break; }
      case 8: { if (b.y > h + 10) { b.y = -20; b.x = Math.random() * (w + 80); } if (b.x < -20) b.x = w + 20;   // Sturmregen
        ctx.strokeStyle = 'rgba(200,190,255,.22)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.05, b.y - b.r); ctx.stroke(); break; }
      case 5: { wrap(b.r); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.strokeStyle = `rgba(111,227,224,${0.08 + 0.06 * Math.sin(t + b.seed * 10)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.283); ctx.stroke();
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ctx.beginPath(); ctx.moveTo(Math.cos(a) * b.r * 0.86, Math.sin(a) * b.r * 0.86); ctx.lineTo(Math.cos(a + 0.12) * b.r * 0.94, Math.sin(a + 0.12) * b.r * 0.94); ctx.stroke(); } ctx.restore(); break; }
      case 10: { if (b.y > h + 10) { b.y = -10; b.x = Math.random() * w; } ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = `rgba(240,200,110,${0.55 + 0.4 * Math.sin(t * 5 + b.seed * 30)})`; ctx.fillRect(-b.r, -b.r * 0.4, b.r * 2, b.r * 0.8); ctx.restore(); break; }
      case 11: { wrap(b.r); const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); g.addColorStop(0, `rgba(255,170,80,${0.12 + 0.05 * Math.sin(t + b.seed * 9)})`); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); break; }
      case 14: { if (b.y > h + 10) { b.y = -10; b.x = Math.random() * w; } ctx.fillStyle = 'rgba(150,140,140,.45)'; ctx.fillRect(b.x, b.y, b.r, b.r); break; }
    }
  }
}
