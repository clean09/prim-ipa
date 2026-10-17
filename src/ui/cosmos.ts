// Prozedural gezeichnete Weltraum-Motive für Kacheln (Nebel, Galaxie, Sternhaufen, Planet, Schwarzes Loch …).
// Einmal pro Sitzung als JPEG-Daten-URL gerendert und zwischengespeichert.

export type SpaceKind = 'nebula' | 'galaxy' | 'cluster' | 'planet' | 'ringed' | 'blackhole' | 'pulsar' | 'comet' | 'constellation' | 'sun' | 'moon';

const cache = new Map<string, string>();

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
}

function backdrop(g: CanvasRenderingContext2D, W: number, H: number, hue: number, rnd: () => number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, hsl(hue + 20, 55, 11));
  bg.addColorStop(1, hsl(hue - 20, 60, 4));
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) glow(g, rnd() * W, rnd() * H, (0.3 + rnd() * 0.5) * H, [[0, hsl(hue + (rnd() - 0.5) * 80, 70, 30, 0.18)], [1, hsl(hue, 70, 30, 0)]]);
  stars(g, W, H, rnd, Math.round((W * H) / 700));
  g.globalCompositeOperation = 'source-over';
}

function stars(g: CanvasRenderingContext2D, W: number, H: number, rnd: () => number, n: number, cx?: number, cy?: number, sigma?: number) {
  for (let i = 0; i < n; i++) {
    let x: number, y: number;
    if (cx !== undefined) {
      // Gauß-verteilt um ein Zentrum (Sternhaufen)
      const r = sigma! * Math.sqrt(-2 * Math.log(rnd() + 1e-9)), a = rnd() * 2 * Math.PI;
      x = cx + r * Math.cos(a); y = cy! + r * Math.sin(a);
    } else { x = rnd() * W; y = rnd() * H; }
    const s = rnd() ** 3 * 1.8 + 0.4, warm = rnd();
    g.fillStyle = warm < 0.2 ? `rgba(255,214,170,${0.4 + rnd() * 0.6})` : warm < 0.4 ? `rgba(170,200,255,${0.4 + rnd() * 0.6})` : `rgba(255,255,255,${0.25 + rnd() * 0.75})`;
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    if (s > 1.7) {
      // heller Stern mit Glanzkreuz
      glow(g, x, y, s * 5, [[0, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x - s * 6, y); g.lineTo(x + s * 6, y); g.moveTo(x, y - s * 6); g.lineTo(x, y + s * 6); g.stroke();
    }
  }
}

function sphere(g: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, rnd: () => number, banded: boolean, sat = 60) {
  // Atmosphärenschein
  glow(g, x, y, r * 1.35, [[0.7, hsl(hue, 80, 60, 0.35)], [1, hsl(hue, 80, 60, 0)]]);
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
  const base = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  base.addColorStop(0, hsl(hue + 10, sat, 70));
  base.addColorStop(0.6, hsl(hue, sat, 42));
  base.addColorStop(1, hsl(hue - 10, sat, 18));
  g.fillStyle = base; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  if (banded) {
    for (let i = 0; i < 9; i++) {
      const by = y - r + (i / 9) * 2 * r + rnd() * 6;
      g.fillStyle = hsl(hue + (rnd() - 0.5) * 40, sat, 30 + rnd() * 40, 0.25);
      g.fillRect(x - r, by, 2 * r, r * (0.08 + rnd() * 0.14));
    }
  } else {
    for (let i = 0; i < 14; i++) {
      // Flecken / Krater
      const px = x + (rnd() - 0.5) * 1.8 * r, py = y + (rnd() - 0.5) * 1.8 * r, pr = r * (0.06 + rnd() * 0.2);
      g.fillStyle = hsl(hue + (rnd() - 0.5) * 50, sat, 25 + rnd() * 45, 0.3);
      g.beginPath(); g.ellipse(px, py, pr * 1.4, pr, rnd() * 3, 0, 7); g.fill();
    }
  }
  // Nachtseite
  const sh = g.createRadialGradient(x - r * 0.5, y - r * 0.5, r * 0.6, x - r * 0.2, y - r * 0.2, r * 2.1);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,8,.55)'); sh.addColorStop(1, 'rgba(0,0,8,.95)');
  g.fillStyle = sh; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.restore();
  // Lichtsaum
  g.strokeStyle = hsl(hue, 90, 80, 0.5); g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, r - 0.5, Math.PI * 0.95, Math.PI * 1.75); g.stroke();
}

function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, front: boolean) {
  g.save();
  g.translate(x, y); g.rotate(-0.32);
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = hsl(hue + 25 + k * 8, 55, 72 - k * 8, 0.55 - k * 0.08);
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.ellipse(0, 0, r * (1.45 + k * 0.12), r * (0.36 + k * 0.03), 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
    g.stroke();
  }
  g.restore();
}

function draw(kind: SpaceKind, g: CanvasRenderingContext2D, W: number, H: number, hue: number, rnd: () => number) {
  backdrop(g, W, H, hue, rnd);
  const cx = W * 0.7, cy = H * 0.4;
  g.globalCompositeOperation = 'lighter';
  switch (kind) {
    case 'nebula': {
      for (let i = 0; i < 70; i++) {
        const t = rnd(), a = t * 2.6 + 0.6;
        const x = cx + Math.cos(a) * H * 0.32 * (0.6 + rnd()) + (rnd() - 0.5) * H * 0.3;
        const y = cy + Math.sin(a) * H * 0.25 * (0.6 + rnd()) + (rnd() - 0.5) * H * 0.3;
        const c = hue + (t - 0.5) * 80;
        glow(g, x, y, H * (0.08 + rnd() * 0.22), [[0, hsl(c, 80, 55, 0.09 + rnd() * 0.08)], [1, hsl(c, 85, 50, 0)]]);
      }
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 10; i++) glow(g, cx + (rnd() - 0.5) * H * 0.7, cy + (rnd() - 0.5) * H * 0.5, H * (0.05 + rnd() * 0.1), [[0, 'rgba(3,2,10,.45)'], [1, 'rgba(3,2,10,0)']]);
      g.globalCompositeOperation = 'lighter';
      stars(g, W, H, rnd, 40, cx, cy, H * 0.25);
      glow(g, cx, cy, H * 0.12, [[0, 'rgba(255,255,255,.7)'], [0.3, hsl(hue, 90, 70, 0.3)], [1, hsl(hue, 90, 60, 0)]]);
      break;
    }
    case 'galaxy': {
      const R = H * 0.62, tilt = -0.45;
      glow(g, cx, cy, R * 1.1, [[0, hsl(hue, 80, 60, 0.3)], [1, hsl(hue, 80, 50, 0)]]);
      for (let i = 0; i < 6500; i++) {
        const arm = i % 2, f = rnd() ** 0.8, th = f * 3.4 * Math.PI;
        const rr = f * R, ang = th * 0.55 + arm * Math.PI + (rnd() - 0.5) * (0.9 - f * 0.5);
        const px = rr * Math.cos(ang), py = rr * Math.sin(ang) * 0.42;
        const x = cx + px * Math.cos(tilt) - py * Math.sin(tilt), y = cy + px * Math.sin(tilt) + py * Math.cos(tilt);
        g.fillStyle = f < 0.2 ? `rgba(255,236,210,${0.5 * (1 - f)})` : rnd() < 0.15 ? hsl(hue + 160, 90, 75, 0.5) : hsl(hue + f * 40, 80, 60 + rnd() * 20, 0.45);
        const s = rnd() < 0.05 ? 1.8 : 1;
        g.fillRect(x, y, s, s);
      }
      glow(g, cx, cy, R * 0.32, [[0, 'rgba(255,248,230,.95)'], [0.4, 'rgba(255,220,170,.4)'], [1, 'rgba(255,200,150,0)']]);
      break;
    }
    case 'cluster': {
      glow(g, cx, cy, H * 0.5, [[0, hsl(hue, 80, 70, 0.35)], [1, hsl(hue, 80, 60, 0)]]);
      stars(g, W, H, rnd, 900, cx, cy, H * 0.14);
      glow(g, cx, cy, H * 0.16, [[0, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
      break;
    }
    case 'planet':
    case 'ringed': {
      g.globalCompositeOperation = 'source-over';
      const r = H * 0.27;
      if (kind === 'ringed') ring(g, cx, cy, r, hue, false);
      sphere(g, cx, cy, r, hue, rnd, kind === 'ringed');
      if (kind === 'ringed') ring(g, cx, cy, r, hue, true);
      // kleiner Mond
      sphere(g, cx - r * 1.9, cy + r * 0.9, r * 0.17, hue + 180, rnd, false, 15);
      break;
    }
    case 'moon': {
      g.globalCompositeOperation = 'source-over';
      sphere(g, cx, cy, H * 0.3, hue, rnd, false, 12);
      break;
    }
    case 'blackhole': {
      const r = H * 0.16;
      g.save(); g.translate(cx, cy); g.rotate(-0.18);
      const disk = (front: boolean) => {
        for (let k = 0; k < 26; k++) {
          const f = k / 26;
          g.strokeStyle = hsl(hue + 20 - f * 25, 100, 75 - f * 35, 0.22 * (1 - f) + 0.04);
          g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(0, 0, r * (1.5 + f * 2.2), r * (0.32 + f * 0.45), 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI); g.stroke();
        }
      };
      disk(false);
      // gelinster Bogen über dem Loch
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = hsl(hue + 15, 100, 70, 0.2 - k * 0.015); g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 0, r * (1.25 + k * 0.06), r * (1.15 + k * 0.08), 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = hsl(hue + 30, 100, 85, 0.8); g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, r * 1.04, 0, 7); g.stroke();
      disk(true);
      g.restore();
      break;
    }
    case 'pulsar': {
      for (const s of [1, -1]) {
        const ang = -1.05 + (s < 0 ? Math.PI : 0), L = H * 0.9;
        g.save(); g.translate(cx, cy); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, L, 0);
        gr.addColorStop(0, hsl(hue, 100, 85, 0.75)); gr.addColorStop(1, hsl(hue, 100, 60, 0));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(L, -L * 0.13); g.lineTo(L, L * 0.13); g.closePath(); g.fill();
        g.restore();
      }
      g.lineWidth = 1.2;
      for (let k = 1; k <= 4; k++) {
        g.strokeStyle = hsl(hue + 30, 90, 70, 0.32 - k * 0.05);
        g.beginPath(); g.ellipse(cx - k * H * 0.05, cy, k * H * 0.08, k * H * 0.05, -1.05 + Math.PI / 2, 0, 7); g.stroke();
        g.beginPath(); g.ellipse(cx + k * H * 0.05, cy, k * H * 0.08, k * H * 0.05, -1.05 + Math.PI / 2, 0, 7); g.stroke();
      }
      glow(g, cx, cy, H * 0.22, [[0, 'rgba(255,255,255,1)'], [0.12, hsl(hue, 100, 80, 0.8)], [1, hsl(hue, 100, 60, 0)]]);
      break;
    }
    case 'comet': {
      const hx = W * 0.8, hy = H * 0.55, dx = -1, dy = -0.5, len = W * 0.9;
      for (let k = 0; k < 40; k++) {
        // Staubschweif (gebogen, warm) und Ionenschweif (gerade, blau)
        const f = k / 40, spread = f * H * 0.18;
        glow(g, hx + dx * len * f, hy + dy * len * f * 0.85 + spread * 0.6, H * 0.04 + spread, [[0, hsl(hue, 80, 70, 0.12 * (1 - f))], [1, hsl(hue, 80, 60, 0)]]);
        glow(g, hx + dx * len * f, hy + dy * len * f * 1.15, H * 0.02 + spread * 0.4, [[0, hsl(200, 100, 75, 0.12 * (1 - f))], [1, hsl(200, 100, 60, 0)]]);
      }
      glow(g, hx, hy, H * 0.14, [[0, 'rgba(255,255,255,1)'], [0.15, hsl(hue + 20, 100, 80, 0.7)], [1, hsl(hue, 100, 60, 0)]]);
      break;
    }
    case 'constellation': {
      const pts: [number, number][] = [];
      const n = 8;
      for (let i = 0; i < n; i++) pts.push([W * (0.38 + (i / (n - 1)) * 0.56) + (rnd() - 0.5) * W * 0.05, H * (0.25 + rnd() * 0.5)]);
      g.strokeStyle = hsl(hue, 90, 80, 0.45); g.lineWidth = 1.4;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.lineTo(pts[3][0], pts[3][1]); g.stroke();
      for (const [x, y] of pts) {
        glow(g, x, y, H * 0.07, [[0, 'rgba(255,255,255,1)'], [0.15, hsl(hue, 100, 80, 0.6)], [1, hsl(hue, 100, 70, 0)]]);
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke();
      }
      break;
    }
    case 'sun': {
      const sx = W * 0.92, sy = H * 0.28, r = H * 0.42;
      glow(g, sx, sy, r * 2, [[0.4, hsl(hue, 100, 60, 0.5)], [1, hsl(hue, 100, 50, 0)]]);
      g.globalCompositeOperation = 'source-over';
      const b = g.createRadialGradient(sx - r * 0.2, sy + r * 0.2, 0, sx, sy, r);
      b.addColorStop(0, '#fffbe8'); b.addColorStop(0.5, hsl(hue + 10, 100, 65)); b.addColorStop(1, hsl(hue - 10, 100, 45));
      g.fillStyle = b; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(sx, sy, r, 0, 7); g.clip();
      for (let i = 0; i < 260; i++) { g.fillStyle = hsl(hue + rnd() * 20, 100, 50 + rnd() * 30, 0.2); g.beginPath(); g.arc(sx + (rnd() - 0.5) * 2 * r, sy + (rnd() - 0.5) * 2 * r, 2 + rnd() * 5, 0, 7); g.fill(); }
      g.restore();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 18; k++) {
        // Flammenzungen am Sonnenrand
        const a = Math.PI * (0.5 + rnd() * 0.75), d = r * (1 + rnd() * 0.08);
        glow(g, sx + Math.cos(a) * d, sy + Math.sin(a) * d, r * (0.06 + rnd() * 0.1), [[0, hsl(hue - 5, 100, 70, 0.55)], [1, hsl(hue - 10, 100, 50, 0)]]);
      }
      break;
    }
  }
  g.globalCompositeOperation = 'source-over';
}

/** Weltraum-Motiv als Daten-URL (zwischengespeichert). */
export function spaceArt(kind: SpaceKind, hue: number, wide = false, seed = 7): string {
  const key = `${kind}|${hue}|${wide}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = wide ? 720 : 360, H = wide ? 240 : 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  draw(kind, g, W, H, hue, mulberry(seed * 9973 + hue * 31 + kind.length * 7));
  const url = c.toDataURL('image/jpeg', 0.88);
  cache.set(key, url);
  return url;
}

/** Kachel-Hintergrund-Eigenschaften: Motiv + passende Farben für Rand und Glanz. */
export function spaceStyle(kind: SpaceKind, hue: number, wide = false, seed = 7): Record<string, string> {
  return {
    '--art': `url(${spaceArt(kind, hue, wide, seed)})`,
    '--hue': String(hue),
  };
}
