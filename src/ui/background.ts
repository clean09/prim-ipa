// Animierter Hintergrund je Design (wie Ui/HomeBackdrop.cs am Desktop): Nebel = Sterne + Nebelschwaden,
// Studio = Punktraster, Observatorium = drehendes Astrolabium, Labor = Ulam-Spirale (Primzahlen leuchten),
// Papier = Millimeterpapier. ~30 Bilder/s, hält an, solange eine Messung läuft oder Bewegung aus ist.
import { busyChanged, busy, fullscreen } from '../core/nav';
import { accentColor, design, motionLevel, onThemeChange, reducedMotion } from '../core/theme';

interface Star { x: number; y: number; z: number; tw: number; c: string }

export function startBackground() {
  const c = document.createElement('canvas');
  c.id = 'bg';
  document.body.prepend(c);
  const g = c.getContext('2d')!;
  let w = 0, h = 0, dpr = 1;
  let stars: Star[] = [];
  let layer: HTMLCanvasElement | null = null;
  let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  let t = 0, last = 0, raf = 0;
  let ulam: Uint8Array | null = null;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 2600);
    const cols = ['#ffffff', '#cfe0ff', '#ffe9c9', '#bcd2ff', '#ffd2b0'];
    stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random() ** 2, tw: Math.random() * 6.28, c: cols[(Math.random() * cols.length) | 0] }));
    build();
  };

  // statische Ebene einmal vorab malen (teure Verläufe/Raster nicht in jedem Bild)
  const build = () => {
    const d = design();
    layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(w * (d.id === 'nebel' || d.id === 'observatorium' ? 0.5 : dpr)));
    layer.height = Math.max(1, Math.round(h * (d.id === 'nebel' || d.id === 'observatorium' ? 0.5 : dpr)));
    const n = layer.getContext('2d')!;
    const sx = layer.width / w;
    n.scale(sx, sx);
    const acc = accentColor();
    if (d.id === 'nebel' || d.id === 'observatorium') {
      const blobs: [number, number, number, string, number][] = d.id === 'nebel'
        ? [[0.9, 0.05, 0.7, acc, 0.2], [0.05, 0.5, 0.6, '#3de0d0', 0.08], [0.7, 0.9, 0.6, '#ff4f8b', 0.07]]
        : [[0.85, 0.1, 0.8, '#d9b46c', 0.07], [0.1, 0.8, 0.7, '#355a99', 0.16]];
      for (const [x, y, r, col, a] of blobs) {
        const gr = n.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
        gr.addColorStop(0, hexA(col, a)); gr.addColorStop(1, hexA(col, 0));
        n.fillStyle = gr; n.fillRect(0, 0, w, h);
      }
    } else if (d.id === 'papier') {
      // Millimeterpapier: 2-mm-Linien, jede 5. kräftiger
      for (let i = 0, x = 0; x < w; x += 8, i++) { n.fillStyle = i % 5 ? 'rgba(160,60,40,.07)' : 'rgba(160,60,40,.16)'; n.fillRect(x, 0, 1, h); }
      for (let i = 0, y = 0; y < h; y += 8, i++) { n.fillStyle = i % 5 ? 'rgba(160,60,40,.07)' : 'rgba(160,60,40,.16)'; n.fillRect(0, y, w, 1); }
    } else if (d.id === 'studio') {
      n.fillStyle = 'rgba(17,17,17,.10)';
      for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) n.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      // senkrechte Spaltenlinien wie ein Satzspiegel
      n.fillStyle = 'rgba(17,17,17,.06)';
      for (let i = 1; i < 4; i++) n.fillRect(Math.round((w * i) / 4), 0, 1, h);
    } else if (d.id === 'labor') {
      ulam = sieve(160 * 160);
    }
  };

  const draw = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now; t += dt;
    const d = design();
    g.fillStyle = d.bg;
    g.fillRect(0, 0, w, h);
    if (layer) {
      if (d.id === 'nebel') {
        g.save(); g.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.2);
        g.drawImage(layer, Math.sin(t * 0.03) * 20 - 20, Math.cos(t * 0.025) * 16 - 16, w + 40, h + 32); g.restore();
      } else g.drawImage(layer, 0, 0, w, h);
    }
    if (d.id === 'nebel' || d.id === 'observatorium') {
      const few = d.id === 'observatorium';
      for (let i = 0; i < stars.length; i += few ? 2 : 1) {
        const s = stars[i];
        s.y += dt * (2 + s.z * 10);
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        const a = (0.25 + 0.75 * s.z) * (0.65 + 0.35 * Math.sin(t * (1 + s.z * 2) + s.tw));
        g.globalAlpha = a;
        g.fillStyle = few ? '#f3e2bd' : s.c;
        const r = 0.4 + s.z * 1.3;
        g.fillRect(s.x - r / 2, s.y - r / 2, r, r);
      }
      g.globalAlpha = 1;
    }
    if (d.id === 'nebel') {
      if (!shoot && Math.random() < dt * 0.08) shoot = { x: Math.random() * w, y: Math.random() * h * 0.5, vx: -(300 + Math.random() * 300), vy: 120 + Math.random() * 120, life: 1 };
      if (shoot) {
        shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life -= dt * 1.4;
        const gr = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15);
        gr.addColorStop(0, `rgba(255,255,255,${Math.max(0, shoot.life)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = gr; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15); g.stroke();
        if (shoot.life <= 0) shoot = null;
      }
    }
    if (d.id === 'observatorium') astrolabe(g, w * 0.82, h * 0.16, Math.min(w, h) * 0.62, t);
    if (d.id === 'labor' && ulam) ulamSpiral(g, w, h, ulam, t);
  };

  const loop = (now: number) => {
    raf = 0;
    if (busy.running || fullscreen.on || reducedMotion() || document.hidden) return;
    if (now - last >= (motionLevel() === 'calm' ? 66 : 33)) draw(now);
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (raf) return;
    draw(performance.now());
    if (fullscreen.on) return;
    if (!busy.running && !reducedMotion()) raf = requestAnimationFrame(loop);
  };

  resize();
  addEventListener('resize', () => { resize(); kick(); });
  document.addEventListener('visibilitychange', kick);
  onThemeChange(() => { build(); kick(); });
  busyChanged(kick);
  kick();
}

/** Astrolabium: Ringe mit Skalen, langsam gegeneinander drehend (Messingfarbe). */
function astrolabe(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number) {
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = 'rgba(217,180,108,.16)'; g.fillStyle = 'rgba(217,180,108,.22)'; g.lineWidth = 1;
  const rings = [1, 0.82, 0.6, 0.38];
  rings.forEach((r, i) => {
    g.save();
    g.rotate(t * (i % 2 ? -0.02 : 0.015) * (i + 1));
    g.beginPath(); g.arc(0, 0, R * r, 0, Math.PI * 2); g.stroke();
    const ticks = i === 0 ? 120 : i === 1 ? 72 : 36;
    for (let k = 0; k < ticks; k++) {
      const a = (k / ticks) * Math.PI * 2, long = k % (ticks / 12) === 0;
      const r0 = R * r, r1 = r0 - (long ? 12 : 5);
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
    g.restore();
  });
  // Ekliptik (schräge Ellipse) und Zeiger
  g.rotate(t * 0.01);
  g.beginPath(); g.ellipse(R * 0.12, 0, R * 0.6, R * 0.5, 0.4, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 0.95, 0); g.stroke();
  g.beginPath(); g.arc(0, 0, 3, 0, 7); g.fill();
  g.restore();
}

/** Ulam-Spirale: Zahlen spiralförmig, Primzahlen leuchten – baut sich langsam auf und läuft durch. */
function ulamSpiral(g: CanvasRenderingContext2D, w: number, h: number, isP: Uint8Array, t: number) {
  const cell = 7, cx = w * 0.5, cy = h * 0.42;
  const nMax = Math.min(isP.length - 1, Math.floor(400 + t * 900));
  let x = 0, y = 0, dx = 1, dy = 0, seg = 1, k = 0, turns = 0;
  const wave = (t * 140) % nMax;
  for (let n = 1; n <= nMax; n++) {
    if (isP[n]) {
      const px = cx + x * cell, py = cy + y * cell;
      if (px > -cell && px < w + cell && py > -cell && py < h + cell) {
        const glow = Math.max(0, 1 - Math.abs(n - wave) / 120);
        g.fillStyle = glow > 0 ? `rgba(198,255,61,${0.25 + glow * 0.7})` : 'rgba(198,255,61,.16)';
        g.fillRect(px - 1.4, py - 1.4, 2.8, 2.8);
      }
    }
    x += dx; y += dy;
    if (++k === seg) { k = 0; [dx, dy] = [-dy, dx]; if (++turns % 2 === 0) seg++; }
  }
}

function sieve(n: number) {
  const a = new Uint8Array(n + 1).fill(1);
  a[0] = a[1] = 0;
  for (let i = 2; i * i <= n; i++) if (a[i]) for (let j = i * i; j <= n; j += i) a[j] = 0;
  return a;
}

function hexA(col: string, a: number) {
  if (col.startsWith('rgb')) return col.replace(/rgba?\(([^)]+)\)/, (_, v) => `rgba(${v.split(',').slice(0, 3).join(',')},${a})`);
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
