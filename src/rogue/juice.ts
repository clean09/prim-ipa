// „Juice“: Partikel (fester Puffer, keine Allokationen pro Bild), schwebende Zahlen, Bildschirmwackeln, Blitz,
// Zeitlupe bei Boss-Kills, Klänge und eine leise generative Musik, deren Tempo und Dichte im Lauf steigen.
import { buzz } from '../core/native';
import { settings } from '../core/store';
import { reducedMotion } from '../core/theme';

// ------------------------------------------------------------------------------------------- Partikel
const MAX = 900;
export class Particles {
  private x = new Float32Array(MAX); private y = new Float32Array(MAX); private vx = new Float32Array(MAX); private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX); private max = new Float32Array(MAX); private size = new Float32Array(MAX); private col = new Uint32Array(MAX);
  private n = 0; private raf = 0; private last = 0; private g: CanvasRenderingContext2D;
  timeScale = 1;
  constructor(readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; this.g.setTransform(d, 0, 0, d, 0, 0); };
    fit(); new ResizeObserver(fit).observe(canvas);
  }
  /** Explosion an (x, y) in Bildschirmpunkten relativ zur Leinwand. */
  burst(x: number, y: number, count: number, hex: number, speed = 220, size = 3) {
    if (reducedMotion()) count = Math.ceil(count / 4);
    for (let k = 0; k < count; k++) {
      const i = this.n < MAX ? this.n++ : Math.floor(Math.random() * MAX);
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      this.x[i] = x; this.y[i] = y; this.vx[i] = Math.cos(a) * s; this.vy[i] = Math.sin(a) * s - speed * 0.3;
      this.max[i] = this.life[i] = 0.5 + Math.random() * 0.7; this.size[i] = size * (0.5 + Math.random()); this.col[i] = hex;
    }
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000) * this.timeScale; this.last = now;
    const g = this.g, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; this.vy[i] += 420 * dt; this.vx[i] *= 1 - 1.5 * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      const a = Math.max(0, this.life[i] / this.max[i]);
      const c = this.col[i];
      g.fillStyle = `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`;
      const s = this.size[i] * (0.4 + a);
      g.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
      alive++;
    }
    g.globalCompositeOperation = 'source-over';
    if (!alive) { this.n = 0; this.raf = 0; g.clearRect(0, 0, w, h); return; }
    this.raf = requestAnimationFrame(this.tick);
  };
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
}

// ------------------------------------------------------------------------------------------- Bildschirmeffekte
export function floatText(host: HTMLElement, x: number, y: number, text: string, cls = '') {
  const el = document.createElement('div');
  el.className = 'rg-float ' + cls;
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  host.append(el);
  setTimeout(() => el.remove(), 1100);
}
export function shake(el: HTMLElement, strength = 1) {
  if (reducedMotion()) return;
  el.style.setProperty('--sk', `${Math.min(3, strength) * 5}px`);
  el.classList.remove('rg-shake'); void el.offsetWidth; el.classList.add('rg-shake');
}
export function flash(host: HTMLElement, color = '#fff', ms = 260) {
  const f = document.createElement('div');
  f.className = 'rg-flash'; f.style.background = color; f.style.animationDuration = `${ms}ms`;
  host.append(f); setTimeout(() => f.remove(), ms + 40);
}
/** Zeitlupe: CSS-Animationen und Partikel langsamer (Boss-Kill). */
export function slowmo(host: HTMLElement, p: Particles | null, ms = 1400) {
  host.classList.add('rg-slow'); if (p) p.timeScale = 0.25;
  setTimeout(() => { host.classList.remove('rg-slow'); if (p) p.timeScale = 1; }, ms);
}
export function countUp(el: HTMLElement, to: number, ms = 900, fmt = (v: number) => String(Math.round(v))) {
  const t0 = performance.now();
  const f = (now: number) => { const k = Math.min(1, (now - t0) / ms); el.textContent = fmt(to * (1 - (1 - k) ** 3)); if (k < 1 && el.isConnected) requestAnimationFrame(f); else el.textContent = fmt(to); };
  requestAnimationFrame(f);
}

// ------------------------------------------------------------------------------------------- Klang
let ac: AudioContext | null = null;
function audio() {
  if (!settings().sound) return null;
  try { ac ??= new AudioContext(); if (ac.state === 'suspended') void ac.resume(); return ac; } catch { return null; }
}
const PENTA = [0, 2, 4, 7, 9];
function tone(f: number, dur: number, vol: number, type: OscillatorType = 'triangle', delay = 0, slide = 0, dest?: AudioNode) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? a.destination); o.start(t); o.stop(t + dur + 0.03);
}
const penta = (step: number) => 392 * 2 ** ((PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);
function noise(dur: number, vol: number) {
  const a = audio(); if (!a) return;
  const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol; s.buffer = b; s.connect(g).connect(a.destination); s.start();
}

export const snd = {
  card: () => tone(880, 0.06, 0.03),
  prime: (combo: number) => { tone(penta(combo * 2 + 3), 0.28, 0.06); tone(penta(combo * 2 + 5), 0.32, 0.04, 'sine', 0.06); },
  miss: () => tone(196, 0.12, 0.03, 'square'),
  hit: (big = false) => { noise(big ? 0.18 : 0.08, big ? 0.16 : 0.08); tone(big ? 110 : 160, 0.15, 0.06, 'sawtooth', 0, 60); },
  hurt: () => { tone(220, 0.22, 0.06, 'square', 0, 110); noise(0.12, 0.08); },
  block: () => tone(520, 0.1, 0.04, 'sine', 0, 700),
  kill: () => [0, 2, 4].forEach((s, i) => tone(penta(s + 5), 0.25, 0.05, 'triangle', i * 0.06)),
  coin: () => { tone(1568, 0.08, 0.04, 'square'); tone(2093, 0.14, 0.035, 'square', 0.06); },
  reel: () => tone(300 + Math.random() * 200, 0.03, 0.02, 'square'),
  win: () => [0, 2, 4, 7, 9, 12].forEach((s, i) => tone(penta(s + 3), 0.4, 0.05, 'triangle', i * 0.07)),
  jackpot: () => { for (let i = 0; i < 14; i++) tone(penta(i + 2), 0.3, 0.05, 'square', i * 0.06); },
  lose: () => { tone(392, 0.3, 0.05, 'triangle', 0, 196); tone(294, 0.5, 0.05, 'triangle', 0.25, 98); },
  open: () => tone(330, 0.4, 0.05, 'sine', 0, 990),
};
export const haptic = (k: 'light' | 'success' | 'error' = 'light') => { void buzz(k); };

// ------------------------------------------------------------------------------------------- Musik (generativ, steigt mit dem Lauf)
let musicT = 0, beat = 0, intensity = 0, musicOn = false;
export function music(on: boolean, level = 0) {
  intensity = level;
  if (on === musicOn) return;
  musicOn = on;
  clearTimeout(musicT);
  if (on) loop();
}
function loop() {
  if (!musicOn) return;
  const a = audio();
  const bpm = 84 + intensity * 6;
  if (a && !document.hidden) {
    const chord = [0, 3, 5, 2][Math.floor(beat / 8) % 4];
    if (beat % 4 === 0) tone(penta(chord) / 4, 0.9, 0.035, 'sine');
    const pat = [0, 2, 4, 2, 5, 4, 2, 4];
    if (intensity >= 1 || beat % 2 === 0) tone(penta(chord + pat[beat % 8]), 0.22, 0.012 + intensity * 0.002, 'triangle');
    if (intensity >= 3 && beat % 2 === 1) noise(0.03, 0.025);
  }
  beat++;
  musicT = window.setTimeout(loop, 60000 / bpm / 2);
}
