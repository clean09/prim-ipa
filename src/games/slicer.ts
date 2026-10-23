// Planetenspalter (Wisch-Spiel): Zahlen fliegen im Bogen hoch. Zusammengesetzte Zahlen durchwischen → sie zerfallen in zwei
// Faktoren (die wieder zerschnitten werden können). Primzahlen sind unzerbrechlich: anschneiden kostet ein Leben,
// fallen lassen bringt Punkte. Eine zusammengesetzte Zahl, die unzerteilt herunterfällt, kostet ebenfalls ein Leben.
import { fetchModel, gameGroup, lbConfigured } from '../core/leaderboard';
import { L, N } from '../core/i18n';
import { buzz } from '../core/native';
import { onHidden } from '../core/nav';
import { VERSION, addScore, settings } from '../core/store';
import { h } from '../ui/dom';
import { sfx } from '../ui/fx';
import { unlock } from './achievements';
import { chunky, countdown, endScreen, note, tutorial } from './kit';
import { isPrime, simplePrimes, smallestFactor } from './numbers';
import { saveStats, stats } from './progress';
import { PlanetLook, drawPlanet, lookColor, lookFor } from './planets';

interface Obj { n: number; prime: boolean; x: number; y: number; vx: number; vy: number; r: number; hue: number; look: PlanetLook; rot: number; vr: number; safeT: number; floatT: number; dead?: boolean; bounce?: number }
interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; c: string; s: number }
interface Float { x: number; y: number; text: string; life: number; c: string; size: number }
const HUES = [205, 265, 320, 15, 42, 165, 190, 290];

export function runSlicer(stage: HTMLElement, exit: () => void, again: () => void): () => void {
  const canvas = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } });
  const leftChip = h('div', { class: 'g-chip' });
  const scoreChip = h('div', { class: 'g-chip score' }, '0');
  const pauseBtn = h('button', { class: 'g-icon', onclick: () => pause() }, '❚❚');
  const comboEl = h('div', { class: 'g-combo' });
  const overlay = h('div', { style: { position: 'absolute', inset: '0', zIndex: '6', pointerEvents: 'none' } });
  const layer = h('div', { style: { position: 'absolute', inset: '0' } }, canvas, h('div', { class: 'g-hud' }, leftChip, scoreChip, pauseBtn), comboEl, overlay);
  stage.replaceChildren(layer);
  const g = canvas.getContext('2d')!;
  let W = 0, H = 0;
  const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener('resize', resize);

  let objs: Obj[] = [], shards: Shard[] = [], floats: Float[] = [];
  let slowT = 0;
  let score = 0, lives = 3, elapsed = 0, waveT = 0.6, splits = 0, collected = 0, running = false, paused = false, over = false, alive = true, shake = 0, flashRed = 0;
  const best0 = stats().best.split ?? 0;
  const GRAV = () => H * 1.25;

  // ------------------------------------------------------------------ Zahlen
  const PR = simplePrimes(200);
  const makeNumber = (): number => {
    const t = elapsed;
    if (Math.random() < 0.22) {                              // Primzahl als Falle
      const pool = PR.filter(p => p <= 30 + t * 4);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const k = 2 + (Math.random() < Math.min(0.6, t / 90) ? 1 : 0) + (Math.random() < Math.min(0.35, t / 160) ? 1 : 0);
    const maxP = Math.min(97, 7 + Math.floor(t / 4));
    let n = 1;
    for (let i = 0; i < k; i++) { const pool = PR.filter(p => p <= maxP); n *= pool[Math.floor(Math.random() * pool.length)]; }
    return n > 99999 ? 6 : n;
  };
  const radius = (n: number) => 26 + String(n).length * 5;
  const launch = () => {
    const n = makeNumber();
    const r = radius(n);
    const x = r + Math.random() * (W - 2 * r);
    const apex = H * (0.18 + Math.random() * 0.3);               // Gipfelhöhe
    const vy = -Math.sqrt(2 * GRAV() * (H + r - apex));
    const vx = (W / 2 - x) * (0.25 + Math.random() * 0.35);
    objs.push({ n, prime: isPrime(n), x, y: H + r, vx, vy, r, hue: HUES[Math.floor(Math.random() * HUES.length)], look: lookFor(String(n)), rot: 0, vr: (Math.random() - 0.5) * 2, safeT: 0, floatT: 0 });
  };

  // ------------------------------------------------------------------ Wischen
  let trail: { x: number; y: number; t: number }[] = [];
  let down = false, sliceCount = 0, swipeCombo = 0;
  const segHit = (ax: number, ay: number, bx: number, by: number, o: Obj) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / l2));
    return Math.hypot(ax + t * dx - o.x, ay + t * dy - o.y) < o.r + 18;
  };
  canvas.addEventListener('pointerdown', e => {
    down = true; sliceCount = 0; trail = [{ x: e.offsetX, y: e.offsetY, t: performance.now() }];
    if (!running || paused) return;
    // Antippen zählt auch: die nächste Zahl unter dem Finger wird gespalten (Primzahlen ignoriert ein Tippen)
    let best: Obj | null = null, bd = Infinity;
    for (const o of objs) { if (o.dead || o.safeT > 0) continue; const d = Math.hypot(e.offsetX - o.x, e.offsetY - o.y); if (d < o.r + 14 && d < bd) { bd = d; best = o; } }
    if (best && !best.prime) slice(best, 1, 0);
  });
  canvas.addEventListener('pointermove', e => {
    if (!down || !running || paused) return;
    const p = { x: e.offsetX, y: e.offsetY, t: performance.now() };
    const q = trail[trail.length - 1];
    trail.push(p);
    if (!q) return;
    const dx = p.x - q.x, dy = p.y - q.y, len = Math.hypot(dx, dy);
    if (len < 4) return;
    for (const o of objs) {
      if (o.dead || o.safeT > 0 || !segHit(q.x, q.y, p.x, p.y, o)) continue;
      if (o.prime) {
        if (o.bounce && o.bounce > 0) continue;
        o.bounce = 0.6; o.vx += (dx / len) * 160; o.vy += (dy / len) * 160 - 120;
        lose(L(`${o.n} ist unteilbar!`, `${o.n} can't be split!`), o.x, o.y);
        continue;
      }
      slice(o, dx / len, dy / len);
    }
  });
  const endSwipe = () => {
    down = false;
    if (sliceCount >= 2) {
      const bonus = sliceCount * 25;
      score += bonus;
      floatText(W / 2, H * 0.4, sliceCount >= 3 ? L(`Ninja-Schnitt ×${sliceCount}! +${bonus}`, `Ninja slice ×${sliceCount}! +${bonus}`) : L(`Doppelschnitt! +${bonus}`, `Double slice! +${bonus}`), '#ffd166', 28);
      if (sliceCount >= 3) unlock('ninja', layer);
      sfx.success();
    }
    sliceCount = 0;
  };
  canvas.addEventListener('pointerup', endSwipe); canvas.addEventListener('pointercancel', endSwipe); canvas.addEventListener('pointerleave', endSwipe);

  const slice = (o: Obj, nx: number, ny: number) => {
    o.dead = true;
    slowT = 0.35;
    const a = smallestFactor(o.n), b = o.n / a;
    splits++; sliceCount++; swipeCombo++;
    const s = stats(); s.splits++; saveStats(s);
    if (s.splits >= 100) unlock('splitter', layer);
    score += 10 * String(o.n).length;
    bump();
    note(Math.min(sliceCount + 2, 12));
    void buzz('light');
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * 6.28, v = 120 + Math.random() * 220;
      shards.push({ x: o.x, y: o.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 1, c: lookColor(o.look), s: 4 + Math.random() * 6 });
    }
    floatText(o.x, o.y - o.r, `${o.n} = ${a} × ${b}`, '#fff', 20);
    // zwei Hälften fliegen senkrecht zur Wischrichtung auseinander
    const px = -ny, py = nx;
    [a, b].forEach((m, i) => {
      const sgn = i === 0 ? -1 : 1, r = radius(m);
      const rise = -Math.sqrt(2 * GRAV() * 0.3 * Math.max(0.15 * H, Math.min(o.y - 60, 0.3 * H)));
      objs.push({ n: m, prime: isPrime(m), x: o.x + px * sgn * (r * 0.7), y: o.y + py * sgn * (r * 0.4), vx: o.vx * 0.25 + px * sgn * 85, vy: rise,
        r, hue: (o.hue + (i ? 40 : -40) + 360) % 360, look: lookFor(String(m)), rot: 0, vr: sgn * 2, safeT: 0.22, floatT: 1.1 });
    });
  };

  const lose = (why: string, x: number, y: number) => {
    lives--; shake = 0.45; flashRed = 1; swipeCombo = 0;
    floatText(x, y, why, '#ff8a80', 20);
    sfx.fail(); void buzz('error');
    if (lives <= 0) setTimeout(gameOver, 400);
  };

  const floatText = (x: number, y: number, text: string, c: string, size = 22) => floats.push({ x, y, text, life: 1.2, c, size });
  const bump = () => { scoreChip.classList.remove('bump'); void scoreChip.offsetWidth; scoreChip.classList.add('bump'); };

  // ------------------------------------------------------------------ Simulation + Zeichnen
  const step = (dtReal: number) => {
    const dt = dtReal * (slowT > 0 ? 0.4 : 1);
    slowT = Math.max(0, slowT - dtReal);
    elapsed += dtReal;
    waveT -= dt;
    if (waveT <= 0) {
      const count = 1 + Math.floor(Math.random() * Math.min(4, 1 + elapsed / 25));
      for (let i = 0; i < count; i++) setTimeout(() => running && launch(), i * 180);
      waveT = Math.max(0.9, 2.3 - elapsed * 0.012);
    }
    for (const o of objs) {
      o.vy += GRAV() * dt * (o.floatT > 0 ? 0.3 : 1); o.floatT = Math.max(0, o.floatT - dt); o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      o.safeT = Math.max(0, o.safeT - dt); if (o.bounce) o.bounce -= dt;
      if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * 0.6; }
      if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) * 0.6; }
      if (!o.dead && o.vy > 0 && o.y > H + o.r) {
        o.dead = true;
        if (o.prime) { score += 5 + o.n % 50; collected++; floatText(o.x, H - 30, L(`${o.n} ✓ prim`, `${o.n} ✓ prime`), '#7dffb0', 18); note(7); bump(); }
        else lose(L(`${o.n} nicht zerlegt!`, `${o.n} not split!`), o.x, H - 40);
      }
    }
    objs = objs.filter(o => !o.dead);
  };

  const drawObj = (o: Obj) => {
    drawPlanet(g, o.x, o.y, o.r, o.look, String(o.n), { now: performance.now() + o.rot * 400, wrong: !!(o.bounce && o.bounce > 0) });
  };

  let last = performance.now();
  const frame = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running && !paused) step(dt);
    const sx = shake > 0 ? (Math.random() - 0.5) * 16 * shake : 0;
    shake = Math.max(0, shake - dt * 1.5);
    g.save(); g.translate(sx, 0);
    const hue = 280 + elapsed * 0.8;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `hsl(${hue},50%,15%)`); bg.addColorStop(1, `hsl(${hue + 40},55%,6%)`);
    g.fillStyle = bg; g.fillRect(-20, 0, W + 40, H);
    // Holzbrett-artige Streifen als Untergrund (dezent)
    g.globalAlpha = 0.05; g.fillStyle = '#fff';
    for (let y = 40; y < H; y += 80) g.fillRect(0, y, W, 2);
    g.globalAlpha = 1;
    for (const o of objs) drawObj(o);
    for (const s of shards) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; s.rot += s.vr * dt; s.life -= dt * 1.5;
      g.globalAlpha = Math.max(0, s.life); g.fillStyle = s.c; g.save(); g.translate(s.x, s.y); g.rotate(s.rot);
      g.fillRect(-s.s / 2, -s.s / 2, s.s, s.s * 0.6); g.restore();
    }
    shards = shards.filter(s => s.life > 0); g.globalAlpha = 1;
    // Wischspur
    const tNow = performance.now();
    trail = trail.filter(p => tNow - p.t < 140);
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const f = i / trail.length;
        g.strokeStyle = `rgba(255,255,255,${0.9 * f})`; g.lineWidth = 2 + 9 * f; g.lineCap = 'round';
        g.shadowColor = '#7fd8ff'; g.shadowBlur = 16;
        g.beginPath(); g.moveTo(trail[i - 1].x, trail[i - 1].y); g.lineTo(trail[i].x, trail[i].y); g.stroke();
      }
      g.shadowBlur = 0;
    }
    for (const f of floats) {
      f.y -= 40 * dt; f.life -= dt;
      g.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5)); g.font = `900 ${f.size}px system-ui`; g.textAlign = 'center';
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(f.text, Math.max(100, Math.min(W - 100, f.x)), f.y);
      g.fillStyle = f.c; g.fillText(f.text, Math.max(100, Math.min(W - 100, f.x)), f.y);
    }
    floats = floats.filter(f => f.life > 0); g.globalAlpha = 1;
    g.restore();
    if (flashRed > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(255,40,40,${0.45 * flashRed})`);
      g.fillStyle = v; g.fillRect(0, 0, W, H); flashRed = Math.max(0, flashRed - dt * 2);
    }
    leftChip.textContent = `${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(Math.max(0, 3 - lives))}`;
    scoreChip.textContent = N(score);
    if (swipeCombo >= 5) { comboEl.textContent = `† ${swipeCombo}`; comboEl.classList.add('on'); } else comboEl.classList.remove('on');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  async function begin() {
    overlay.style.pointerEvents = 'auto';
    await tutorial(overlay, 'slicer', [
      ['♄', L('Wische durch Planeten mit zusammengesetzten Zahlen (oder tippe sie an) – sie zerbrechen in zwei Faktoren: 12 → 2 und 6, dann 6 → 2 und 3. Die Bruchstücke schweben kurz, damit du sie erwischst.', 'Swipe through planets with composite numbers (or tap them) – they break into two factors: 12 → 2 and 6, then 6 → 2 and 3. The pieces float for a moment so you can catch them.')],
      ['◆', L('Primzahlen sind unzerbrechlich! Schneidest du eine an, kostet das ein Leben. Lass sie einfach fallen – das bringt Punkte.', 'Primes are unbreakable! Slicing one costs a life. Just let them fall – that scores points.')],
      ['⚠', L('Fällt eine zusammengesetzte Zahl unzerteilt herunter, kostet das ebenfalls ein Leben. Mehrere Zahlen mit einem Wisch geben Bonus!', 'If a composite number falls unsplit, that costs a life too. Several numbers in one swipe give a bonus!')],
    ]);
    overlay.style.pointerEvents = 'none';
    await countdown(overlay);
    if (!alive) return;
    running = true; sfx.start();
  }

  function pause() {
    if (!running || paused || over) return;
    paused = true;
    const box = h('div', { class: 'g-endwrap' }, h('div', { class: 'g-end' }, h('div', { class: 'g-endtitle' }, L('Pause', 'Paused')),
      h('div', { class: 'g-score', style: { fontSize: '40px' } }, N(score)),
      h('div', { class: 'g-row' }, chunky(L('Beenden', 'Quit'), () => { box.remove(); gameOver(); }, 'plain'), chunky(L('Weiter', 'Resume'), () => { box.remove(); paused = false; overlay.style.pointerEvents = 'none'; last = performance.now(); }, 'go'))));
    overlay.style.pointerEvents = 'auto'; overlay.append(box);
  }

  function gameOver() {
    if (over) return;
    over = true; running = false;
    const s = stats(); s.played++; if (!s.modes.includes('split')) s.modes.push('split');
    const record = score > best0; if (record) s.best.split = score; saveStats(s);
    if (s.modes.length >= 6) unlock('all', layer);
    if (score >= 10) addScore({ kind: 'split', time: new Date().toISOString(), device: 'game', score, unit: L('Punkte', 'points'), points: score, detail: L(`${splits} Schnitte, ${collected} Primzahlen gesammelt`, `${splits} slices, ${collected} primes collected`), version: VERSION, valid: true });
    const world = h('div', { class: 'g-sub', style: { color: '#7fd8ff', minHeight: '18px' } });
    overlay.style.pointerEvents = 'auto';
    setTimeout(() => endScreen(overlay, {
      game: 'split', title: L('Planetenspalter', 'Planet Splitter'), score, record,
      scoreLabel: L(`${splits} Schnitte · ${collected} Primzahlen gesammelt`, `${splits} slices · ${collected} primes collected`), lines: [world],
      onAgain: () => { cleanup(); again(); }, onMenu: () => { cleanup(); exit(); },
    }), 350);
    if (lbConfigured() && settings().lbConsent === 'yes' && score >= 10)
      setTimeout(() => fetchModel('split', gameGroup('split'), score).then(r => {
        world.textContent = !r.stats || r.stats.n < 2 || r.below == null ? L('⊕ Du bist unter den ersten Spielern weltweit!', '⊕ You are among the first players worldwide!')
          : L(`⊕ Besser als ${Math.round(r.below * 100)} % von ${N(r.stats.n)} Spielern`, `⊕ Better than ${Math.round(r.below * 100)} % of ${N(r.stats.n)} players`);
      }).catch(() => {}), 1600);
  }

  const offHidden = onHidden(() => { if (running && !paused) pause(); });
  function cleanup() { alive = false; running = false; offHidden(); removeEventListener('resize', resize); }
  void begin();
  return cleanup;
}
