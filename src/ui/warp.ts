// Sternen-Warp: Sterne strecken sich zu Lichtstreifen, beschleunigen, weißer Blitz – dann Seitenwechsel und Ausblenden.
// Eigene Leinwand über allem; bei Bewegung „Aus“ sofort weiter.
export function warp(onDone: () => void, o: { ms?: number; tint?: [number, number, number][] } = {}) {
  if (document.documentElement.dataset.motion === 'reduced') { onDone(); return; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'warp-layer';
  document.body.append(cv);
  const ctx = cv.getContext('2d')!;
  const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
  const cx = W / 2, cy = H * 0.46, F = Math.max(W, H) * 0.55;
  const tints = o.tint ?? [[255, 255, 255], [240, 208, 138], [111, 227, 224], [200, 180, 255]];
  const N = 650;
  const st = Array.from({ length: N }, () => ({ x: (Math.random() * 2 - 1) * 1.2, y: (Math.random() * 2 - 1) * 1.2, z: 0.15 + Math.random() * 0.85, c: tints[Math.floor(Math.random() * tints.length)] }));
  const dur = o.ms ?? 1250;
  const t0 = performance.now();
  let done = false, raf = 0;
  const proj = (x: number, y: number, z: number) => [cx + (x / z) * F, cy + (y / z) * F] as const;
  const frame = (now: number) => {
    const t = Math.min(1, (now - t0) / dur);
    const speed = 0.002 + Math.pow(t, 2.6) * 0.09;              // erst Gleiten, dann Sprung
    ctx.fillStyle = `rgba(7,6,15,${0.25 + t * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const s of st) {
      s.z -= speed * (1.2 - s.z * 0.4);
      const [px, py] = proj(s.x, s.y, Math.min(1.2, s.z + 0.012 + speed * 7));   // Schweif: wird mit dem Tempo länger
      if (s.z <= 0.02) { s.x = (Math.random() * 2 - 1) * 1.2; s.y = (Math.random() * 2 - 1) * 1.2; s.z = 1; continue; }
      const [qx, qy] = proj(s.x, s.y, s.z);
      const a = Math.min(1, (1 - s.z) * 1.6);
      ctx.strokeStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a})`;
      ctx.lineWidth = Math.max(1, (1.4 - s.z) * 2.2 * dpr);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
    }
    // Zielstern wächst im Zentrum, am Ende weißer Blitz
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, F * (0.05 + t * t * 1.4));
    g.addColorStop(0, `rgba(255,248,225,${0.2 + t * 0.8})`); g.addColorStop(0.4, `rgba(240,208,138,${t * 0.35})`); g.addColorStop(1, 'rgba(111,227,224,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (t > 0.86) { ctx.fillStyle = `rgba(255,250,235,${(t - 0.86) / 0.14})`; ctx.fillRect(0, 0, W, H); }
    if (t < 1) raf = requestAnimationFrame(frame);
    else finish();
  };
  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    onDone();
    cv.classList.add('out');
    setTimeout(() => cv.remove(), 700);
  };
  raf = requestAnimationFrame(frame);
  setTimeout(finish, dur + 600);                                   // Sicherheitsnetz (gedrosselte Tabs)
  try { navigator.vibrate?.([10, 60, 25]); } catch { /* egal */ }
}
