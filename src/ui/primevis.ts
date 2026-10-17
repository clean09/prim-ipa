// Live-Bild zum Primzahlsieb: Sacks-Spirale der Primzahlen rund um die gerade geprüfte Stelle (leuchtende Punkte,
// langsam drehend) und darunter eine Reihe Kerne, die nach ihrem Durchsatz glühen.
import { BasePrimes, Siever } from '../core/sieve';
import { L, N } from '../core/i18n';
import { accentColor, reducedMotion } from '../core/theme';
import { fitCanvas } from './dom';

const WINDOW = 24_000;

export class PrimeVis {
  private sv = new Siever(WINDOW);
  private bp = new BasePrimes();
  private pts: { x: number; y: number; a: number }[] = [];
  private center = 0;
  private alive = true;
  private rot = 0;
  private last = performance.now();
  private load: number[] = [];
  private prevWorker: number[] = [];
  private lastSample = 0;
  running = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.setPosition(1e9);
    const loop = (now: number) => {
      if (!this.alive) return;
      this.draw(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Primzahlen um die Stelle n neu berechnen (kleines Sieb im Hauptthread, < 1 ms). */
  setPosition(n: number) {
    const lo = Math.max(0, Math.floor(n));
    const r = this.sv.sieve(lo, lo + WINDOW, this.bp.ensure(lo + WINDOW));
    const fresh: { x: number; y: number; a: number }[] = [];
    this.sv.emit(lo, lo + WINDOW, r.nbits, p => {
      const k = p - lo;
      const rr = Math.sqrt(k), th = rr * Math.PI * 2;
      fresh.push({ x: rr * Math.cos(th), y: rr * Math.sin(th), a: 0 });
    });
    // alte Punkte verblassen, neue blenden ein
    this.pts = fresh;
    this.center = lo;
  }

  /** Durchsatz je Worker (geprüfte Zahlen, kumulativ). */
  setWorkers(per: number[]) {
    const now = performance.now();
    if (now - this.lastSample < 250) return;
    const dt = (now - this.lastSample) / 1000;
    this.lastSample = now;
    if (this.prevWorker.length !== per.length) { this.prevWorker = per.slice(); this.load = per.map(() => 0); return; }
    const rates = per.map((v, i) => (v - this.prevWorker[i]) / dt);
    const max = Math.max(...rates, 1);
    this.load = rates.map((r, i) => 0.6 * (this.load[i] ?? 0) + 0.4 * (r / max));
    this.prevWorker = per.slice();
  }

  private draw(now: number) {
    const [g, w, hh] = fitCanvas(this.canvas);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!reducedMotion()) this.rot += dt * (this.running ? 0.35 : 0.08);
    g.fillStyle = 'rgba(5,6,10,1)';
    g.fillRect(0, 0, w, hh);
    const coreH = this.load.length ? 26 : 0;
    const cx = w / 2, cy = (hh - coreH) / 2, R = Math.min(w, hh - coreH) / 2 - 8;
    const s = R / Math.sqrt(WINDOW);
    const acc = accentColor();
    // Spiralarme (schwach)
    const cr = Math.cos(this.rot), sr = Math.sin(this.rot);
    g.globalCompositeOperation = 'lighter';
    for (const p of this.pts) {
      p.a = Math.min(1, p.a + dt * 2.5);
      const x = cx + (p.x * cr - p.y * sr) * s, y = cy + (p.x * sr + p.y * cr) * s;
      const d = Math.hypot(x - cx, y - cy) / R;
      g.globalAlpha = p.a * (0.45 + 0.55 * (1 - d));
      g.fillStyle = d < 0.22 ? '#ffffff' : acc;
      const sz = 2.6 - 1.2 * d;
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (d < 0.5) { g.globalAlpha *= 0.18; g.fillRect(x - sz * 1.6, y - sz * 1.6, sz * 3.2, sz * 3.2); }
    }
    // Kern-Glühen in der Mitte
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
    gr.addColorStop(0, this.running ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(200,210,230,.75)'; g.font = '12px system-ui';
    g.fillText(L(`Primzahlen ab ${N(this.center)}`, `Primes from ${N(this.center)}`), 10, 18);
    g.fillStyle = 'rgba(200,210,230,.45)';
    g.fillText(L(`${N(this.pts.length)} unter ${N(WINDOW)} Zahlen`, `${N(this.pts.length)} in ${N(WINDOW)} numbers`), 10, 34);
    // Kerne
    if (this.load.length) {
      const n = this.load.length, gap = 4, cw = Math.min(30, (w - 20 - gap * (n - 1)) / n);
      const x0 = (w - (cw * n + gap * (n - 1))) / 2;
      this.load.forEach((l, i) => {
        const x = x0 + i * (cw + gap), y = hh - 20;
        g.fillStyle = `rgba(255,${Math.round(200 - 120 * l)},${Math.round(80 - 60 * l)},${0.25 + 0.75 * l})`;
        g.shadowColor = '#ff9f43'; g.shadowBlur = 12 * l;
        g.fillRect(x, y, cw, 12);
      });
      g.shadowBlur = 0;
    }
  }

  dispose() { this.alive = false; }
}
