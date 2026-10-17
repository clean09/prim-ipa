// Effekte: synthetische Klänge (WebAudio), Ergebnis-Show (Hochzählen, Partikel, Rang-Abzeichen), Ergebnis als Bild teilen.
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { L, N, dateStr } from '../core/i18n';
import { buzz, isNative } from '../core/native';
import { settings } from '../core/store';
import { accentColor, reducedMotion } from '../core/theme';
import { h } from './dom';

// ------------------------------------------------------------------------------------------- Klänge
let ctx: AudioContext | null = null;
function ac() {
  if (!settings().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.08, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap: () => tone(1200, 0.05, { type: 'triangle', vol: 0.03 }),
  start: () => { tone(220, 0.35, { type: 'sawtooth', vol: 0.025, slide: 880 }); tone(440, 0.4, { vol: 0.04, slide: 1320, delay: 0.05 }); },
  check: () => { tone(1318, 0.12, { vol: 0.05 }); tone(1760, 0.18, { vol: 0.045, delay: 0.08 }); },
  module: () => tone(660, 0.18, { type: 'triangle', vol: 0.04, slide: 990 }),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.05, delay: i * 0.09 })),
  fail: () => { tone(330, 0.3, { type: 'square', vol: 0.03, slide: 220 }); tone(247, 0.4, { type: 'square', vol: 0.025, delay: 0.2, slide: 165 }); },
  count: () => tone(2000 + Math.random() * 400, 0.025, { type: 'square', vol: 0.012 }),
};

// ------------------------------------------------------------------------------------------- Ränge
export interface Rank { name: string; color: string; tier: number }
const RANKS = () => [
  { name: L('Bronze', 'Bronze'), color: '#cd7f32' }, { name: L('Silber', 'Silver'), color: '#c0c7d4' },
  { name: L('Gold', 'Gold'), color: '#ffcc33' }, { name: L('Platin', 'Platinum'), color: '#7fe3e0' },
  { name: L('Diamant', 'Diamond'), color: '#8fb8ff' }, { name: L('Legende', 'Legend'), color: '#ff6bd6' },
];
/** Schwellen je Test (Handy Mittelklasse ≈ Gold) */
const THRESHOLDS: Record<string, number[]> = {
  prime: [150, 350, 600, 900, 1300], 'prime-short': [25, 58, 100, 150, 217], bh: [300, 800, 1600, 3000, 6000], ai: [50, 150, 400, 800, 1500], device: [600, 1000, 1600, 2500, 4000],
};
export function rankFor(kind: string, value: number): Rank {
  const th = THRESHOLDS[kind] ?? THRESHOLDS.device;
  let tier = 0;
  while (tier < th.length && value >= th[tier]) tier++;
  const r = RANKS()[tier];
  return { ...r, tier };
}

// ------------------------------------------------------------------------------------------- Ergebnis-Show
export interface ShowOpts {
  title: string; value: number; unit: string; kind: string; device: string;
  lines?: [string, string][];          // Zusatzwerte (Bezeichnung, Wert)
  decimals?: number;
}

export function resultShow(o: ShowOpts) {
  const rank = rankFor(o.kind, o.value);
  const acc = accentColor();
  const canvas = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' } });
  const num = h('div', { class: 'rs-num' }, '0');
  const badge = h('div', { class: 'rs-badge', style: { '--rc': rank.color } as any },
    h('div', { class: 'rs-ring' }), h('div', { class: 'rs-tier' }, '★'.repeat(rank.tier + 1)), h('div', { class: 'rs-rank' }, rank.name));
  const lines = h('div', { class: 'rs-lines' }, (o.lines ?? []).map(([k, v]) => h('div', null, h('span', null, k), h('b', null, v))));
  const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 250); };
  const wrap = h('div', { class: 'rs-wrap', onclick: (e: Event) => { if (e.target === wrap) close(); } },
    canvas,
    h('div', { class: 'rs-card', style: { '--rc': rank.color, '--acc': acc } as any },
      h('div', { class: 'rs-title' }, o.title),
      num, h('div', { class: 'rs-unit' }, o.unit),
      badge, lines,
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => void shareImage(o, rank) }, L('Als Bild teilen', 'Share as image')),
        h('button', { class: 'btn primary', onclick: close }, L('Weiter', 'Continue')))));
  document.body.append(wrap);

  // Hochzählen
  const dec = o.decimals ?? 0;
  const dur = reducedMotion() ? 1 : 1800;
  const t0 = performance.now();
  let lastTick = 0;
  const step = (now: number) => {
    const f = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - f, 4);
    num.textContent = dec ? (o.value * e).toFixed(dec).replace('.', L(',', '.')) : N(o.value * e);
    if (now - lastTick > 55 && f < 1) { lastTick = now; sfx.count(); }
    if (f < 1) requestAnimationFrame(step);
    else { badge.classList.add('on'); sfx.success(); void buzz('success'); burst(canvas, rank.color, acc); }
  };
  requestAnimationFrame(step);
}

function burst(c: HTMLCanvasElement, col: string, acc: string) {
  if (reducedMotion()) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const W = c.clientWidth, H = c.clientHeight;
  const cols = [col, acc, '#ffffff', '#ffd166'];
  const ps = Array.from({ length: 160 }, () => {
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 520;
    return { x: W / 2, y: H * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 1, s: 1.5 + Math.random() * 3.5, c: cols[(Math.random() * cols.length) | 0] };
  });
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive++;
      p.vy += 420 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.6;
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.28); g.fill();
    }
    g.globalAlpha = 1;
    if (alive && c.isConnected) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------------------------------- Teilen als Bild
async function shareImage(o: ShowOpts, rank: Rank) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1222'); bg.addColorStop(1, '#05060a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const neb = g.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, W * 0.8);
  neb.addColorStop(0, rank.color + '55'); neb.addColorStop(1, 'transparent');
  g.fillStyle = neb; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { g.globalAlpha = Math.random() * 0.8; g.fillStyle = '#fff'; const r = Math.random() * 2.2; g.fillRect(Math.random() * W, Math.random() * H, r, r); }
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.fillStyle = '#a3a8b3'; g.font = '600 44px system-ui, sans-serif';
  g.fillText('PrimSieb', W / 2, 130);
  g.fillStyle = '#ffffff'; g.font = '700 56px system-ui, sans-serif';
  g.fillText(o.title, W / 2, 230);
  g.font = '800 200px system-ui, sans-serif';
  g.shadowColor = rank.color; g.shadowBlur = 50;
  g.fillText(o.decimals ? o.value.toFixed(o.decimals) : N(o.value), W / 2, 500);
  g.shadowBlur = 0;
  g.fillStyle = '#c9cdd6'; g.font = '500 44px system-ui, sans-serif';
  g.fillText(o.unit, W / 2, 575);
  // Abzeichen
  g.strokeStyle = rank.color; g.lineWidth = 10; g.shadowColor = rank.color; g.shadowBlur = 40;
  g.beginPath(); g.arc(W / 2, 760, 120, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = rank.color; g.font = '800 64px system-ui, sans-serif';
  g.fillText(rank.name, W / 2, 785);
  g.font = '40px system-ui'; g.fillText('★'.repeat(rank.tier + 1), W / 2, 840);
  g.fillStyle = '#d6d9df'; g.font = '500 38px system-ui, sans-serif';
  let y = 960;
  for (const [k, v] of (o.lines ?? []).slice(0, 5)) { g.textAlign = 'left'; g.fillText(k, 120, y); g.textAlign = 'right'; g.fillText(v, W - 120, y); y += 62; }
  g.textAlign = 'center'; g.fillStyle = '#8b909b'; g.font = '36px system-ui, sans-serif';
  g.fillText(`${o.device} · ${dateStr(new Date().toISOString())}`, W / 2, H - 70);
  const dataUrl = c.toDataURL('image/png');
  const name = `primsieb-${o.kind}-${Date.now()}.png`;
  try {
    if (isNative) {
      const r = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: Directory.Cache });
      await Share.share({ title: 'PrimSieb', files: [r.uri], dialogTitle: L('Ergebnis teilen', 'Share result') });
    } else {
      const a = document.createElement('a'); a.href = dataUrl; a.download = name; a.click();
    }
  } catch { /* abgebrochen */ }
}
