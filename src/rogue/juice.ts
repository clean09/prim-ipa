// „Juice“: Partikel (fester Puffer, keine Allokationen pro Bild), schwebende Zahlen, Bildschirmwackeln, Blitz,
// Zeitlupe bei Boss-Kills, Klänge und eine leise generative Musik, deren Tempo und Dichte im Lauf steigen.
import { buzz } from '../core/native';
import { settings } from '../core/store';
import { onSfs, sfs } from './settings';
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
    if (sfs().gfx === 'low') count = Math.ceil(count / 2);
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
  if (!sfs().shake) return;
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
  vol *= sfs().sfx; if (vol <= 0.0001) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? a.destination); o.start(t); o.stop(t + dur + 0.03);
}
const penta = (step: number) => 392 * 2 ** ((PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);
function noise(dur: number, vol: number) {
  const a = audio(); if (!a) return;
  vol *= sfs().sfx; if (vol <= 0.0001) return;
  const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol; s.buffer = b; s.connect(g).connect(a.destination); s.start();
}

// ------------------------------------------------------------------------------------------- Effekt-Samples (Kenney, CC0)
const SFX = ['hit1', 'hit2', 'hit3', 'crit', 'impact', 'kill', 'hurt', 'bosskill', 'block', 'overheat', 'open', 'spin', 'click', 'hold', 'tick', 'confirm', 'error', 'drop', 'glass', 'reveal', 'bong', 'select', 'event', 'pluck'] as const;
type Sfx = (typeof SFX)[number];
const bufs = new Map<string, AudioBuffer>();
let sfxLoading = false;
function loadSfx() {
  const a = audio(); if (!a || sfxLoading) return; sfxLoading = true;
  for (const n of SFX) fetch(`${import.meta.env.BASE_URL}sf/sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { bufs.set(n, buf); }).catch(() => { /* Synth bleibt */ });
}
const lastPlay = new Map<string, number>();
/** Sample abspielen (Lautstärke × Effekte-Regler, leichte Tonhöhen-Streuung). false = noch nicht geladen → Synth nehmen. */
function sample(n: Sfx, vol = 0.7, spread = 0.06, minGap = 0.03) {
  const a = audio(); if (!a) return true;
  loadSfx();
  const buf = bufs.get(n); if (!buf) return false;
  const v = vol * sfs().sfx; if (v <= 0.001) return true;
  const now = a.currentTime; if (now - (lastPlay.get(n) ?? -1) < minGap) return true; lastPlay.set(n, now);
  const s = a.createBufferSource(), g = a.createGain();
  s.buffer = buf; s.playbackRate.value = 1 + (Math.random() * 2 - 1) * spread; g.gain.value = v;
  s.connect(g).connect(a.destination); s.start();
  return true;
}
const pickHit = (): Sfx => (['hit1', 'hit2', 'hit3'] as const)[Math.floor(Math.random() * 3)];

export const snd = {
  card: () => { if (!sample('click', 0.5, 0.04)) tone(880, 0.06, 0.03); },
  prime: (combo: number) => { tone(penta(combo * 2 + 3), 0.28, 0.06); tone(penta(combo * 2 + 5), 0.32, 0.04, 'sine', 0.06); },
  miss: () => tone(196, 0.12, 0.03, 'square'),
  hit: (big = false) => { const ok = big ? sample('crit', 0.75) && sample('impact', 0.5) : sample(pickHit(), 0.45, 0.12); if (!ok) { noise(big ? 0.18 : 0.08, big ? 0.16 : 0.08); tone(big ? 110 : 160, 0.15, 0.06, 'sawtooth', 0, 60); } },
  hurt: () => { if (!(sample('hurt', 0.7) && sample('impact', 0.45))) { tone(220, 0.22, 0.06, 'square', 0, 110); noise(0.12, 0.08); } },
  block: () => { if (!sample('block', 0.45, 0.08)) tone(520, 0.1, 0.04, 'sine', 0, 700); },
  kill: () => { sample('kill', 0.7, 0.1); [0, 2, 4].forEach((s, i) => tone(penta(s + 5), 0.25, 0.03, 'triangle', i * 0.06)); },
  coin: () => { tone(1568, 0.08, 0.04, 'square'); tone(2093, 0.14, 0.035, 'square', 0.06); },
  reel: () => { if (!sample('tick', 0.18, 0.15, 0.06)) tone(300 + Math.random() * 200, 0.03, 0.02, 'square'); },
  win: () => { sample('confirm', 0.6, 0); [0, 2, 4, 7, 9, 12].forEach((s, i) => tone(penta(s + 3), 0.4, 0.04, 'triangle', i * 0.07)); },
  jackpot: () => { sample('reveal', 0.7, 0); sample('bong', 0.5, 0); for (let i = 0; i < 14; i++) tone(penta(i + 2), 0.3, 0.04, 'square', i * 0.06); },
  lose: () => { sample('error', 0.55, 0); tone(392, 0.3, 0.04, 'triangle', 0, 196); tone(294, 0.5, 0.04, 'triangle', 0.25, 98); },
  open: () => { if (!sample('open', 0.55)) tone(330, 0.4, 0.05, 'sine', 0, 990); },
  /** Nur als Sample (mit Synth-Ersatz): Halten/Schubsen, Drehen, Überladung, Bosstod, Begegnung, Ablegen, Auswahl. */
  hold: () => { if (!sample('hold', 0.55)) tone(660, 0.05, 0.03); },
  spin: () => { sample('spin', 0.4, 0.08); },
  overheat: () => { if (!sample('overheat', 0.75, 0)) { tone(392, 0.3, 0.05, 'triangle', 0, 196); noise(0.3, 0.1); } },
  bosskill: () => { sample('bosskill', 0.9, 0); },
  event: () => { if (!sample('event', 0.5, 0)) tone(523, 0.3, 0.04, 'sine'); },
  drop: () => { if (!sample('drop', 0.5)) tone(440, 0.08, 0.03); },
  select: () => { if (!sample('select', 0.5)) tone(990, 0.05, 0.03); },
};
export const haptic = (k: 'light' | 'success' | 'error' = 'light') => { if (sfs().haptics) void buzz(k); };

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

// ------------------------------------------------------------------------------------------- Musikstücke (CC0, public/sf/music)
// Gestreamt über <audio> (spart Speicher: ein dekodiertes 2,5-min-Stück wären ~50 MB), Lautstärke über Web-Audio-Gain
// (auf iOS ist audio.volume schreibgeschützt). Überblenden beim Wechsel; fehlt eine Datei, spielt die generative Musik.
export type Track = 'hub' | 'map' | 'map_frost' | 'map_orion' | 'map_pulsar' | 'map_horizont' | 'event' | 'fight' | 'fight2' | 'fight3' | 'elite' | 'boss' | 'final' | 'casino';
const BGM_VOL: Record<string, number> = { hub: 0.5, map: 0.5, map_frost: 0.5, map_orion: 0.5, map_pulsar: 0.5, map_horizont: 0.5, event: 0.55, fight: 0.45, fight2: 0.42, fight3: 0.45, elite: 0.45, boss: 0.5, final: 0.55, casino: 0.45, win: 0.7, lose: 0.7 };
let cur: { name: string; el: HTMLAudioElement; g: GainNode } | null = null;
let pendingTrack: Track | null = null;   // gewünschtes Stück, während Musik stumm ist
let bgmLevel = sfs().music;
onSfs(st => { bgmLevel = st.music; if (cur) fadeTo(cur.g, Math.max(0.0001, BGM_VOL[cur.name] * bgmLevel), 0.3); });
const musicUrl = (n: string) => `${import.meta.env.BASE_URL}sf/music/${n}.mp3`;
function voice(name: string, loop: boolean) {
  const a = audio(); if (!a) return null;
  const el = new Audio(musicUrl(name));
  el.loop = loop; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  (el as any).playsInline = true;
  const g = a.createGain(); g.gain.value = 0.0001;
  try { a.createMediaElementSource(el).connect(g).connect(a.destination); } catch { return null; }
  return { el, g };
}
function fadeTo(g: GainNode, v: number, s: number) {
  const a = audio(); if (!a) return;
  const t = a.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + s);
}
/** Hintergrundmusik wechseln (null = Stille). */
export function bgm(name: Track | null) {
  if ((cur?.name ?? null) === name) return;
  if (cur) { const old = cur; fadeTo(old.g, 0.0001, 1.2); setTimeout(() => { old.el.pause(); old.el.src = ''; }, 1300); cur = null; }
  music(false);
  if (!name || bgmLevel <= 0.01) { pendingTrack = name; return; }
  const v = voice(name, true);
  if (!v) return;
  cur = { name, ...v };
  const me = cur;
  v.el.play().then(() => fadeTo(v.g, BGM_VOL[name] * bgmLevel, 1.6)).catch((e: DOMException) => {
    if (cur !== me) return;
    cur = null;
    if (e?.name === 'NotAllowedError') {                      // Autoplay gesperrt: beim nächsten Tippen starten
      const retry = () => { removeEventListener('pointerdown', retry, true); if (!cur) bgm(name); };
      addEventListener('pointerdown', retry, true);
    } else music(true, name === 'boss' ? 4 : name === 'fight' ? 2 : 0);
  });
  v.el.addEventListener('error', () => { if (cur === me) { cur = null; music(true, name === 'boss' ? 4 : 2); } });
}
/** Kurzes Stück (Sieg/Niederlage); die Hintergrundmusik wird so lange leiser. */
export function sting(name: 'win' | 'lose') {
  const v = voice(name, false); if (!v) { name === 'win' ? snd.win() : snd.lose(); return; }
  if (cur) { const c = cur; fadeTo(c.g, BGM_VOL[c.name] * 0.2, 0.3); setTimeout(() => { if (cur === c) fadeTo(c.g, BGM_VOL[c.name] * bgmLevel, 1.5); }, 4500); }
  v.el.play().then(() => fadeTo(v.g, BGM_VOL[name] * Math.max(0.3, sfs().sfx), 0.05)).catch(() => { name === 'win' ? snd.win() : snd.lose(); });
  v.el.addEventListener('ended', () => { v.el.src = ''; });
}
// Im Hintergrund (App gewechselt, Bildschirm aus) pausieren
document.addEventListener('visibilitychange', () => { if (!cur) return; if (document.hidden) cur.el.pause(); else void cur.el.play().catch(() => {}); });
/** Zustand der Hintergrundmusik (für Tests/Anzeige). */
export const bgmNow = () => cur ? { name: cur.name, playing: !cur.el.paused, t: Math.round(cur.el.currentTime * 10) / 10, gain: Math.round(cur.g.gain.value * 100) / 100 } : null;
if (import.meta.env.DEV) (window as any).__bgmNow = bgmNow;

// Musik wieder einschalten, wenn die Lautstärke von 0 hochgezogen wird
onSfs(st => { if (st.music > 0.01 && !cur && pendingTrack) { const t = pendingTrack; pendingTrack = null; bgm(t); } else if (st.music <= 0.01 && cur) { pendingTrack = cur.name as Track; bgm(null); } });
