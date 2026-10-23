// Blasen-Spiele: Klassisch · Blitz · Tages-Challenge · Mathe-Profi.
// Bonbon-Blasen mit Aufplopp-Animation, Schockwellen + Splitter beim Platzen, Combo mit steigenden Tönen,
// Parallax-Sternenhimmel, Power-ups, Countdown, Endbildschirm mit Sternen/XP.
import { fetchModel, gameGroup, lbConfigured, todayKey } from '../core/leaderboard';
import { L, N } from '../core/i18n';
import { buzz } from '../core/native';
import { onHidden } from '../core/nav';
import { VERSION, addScore, settings } from '../core/store';
import { h } from '../ui/dom';
import { sfx } from '../ui/fx';
import { unlock } from './achievements';
import { chunky, countdown, endScreen, note } from './kit';
import { MERSENNE, bigPrime, bigRule, factor, hashStr, isPrime, mulberry, randDigits, rule, short } from './numbers';
import { stats, saveStats } from './progress';
import { PlanetLook, SUN_LOOK, drawPlanet, lookColor, lookFor } from './planets';

export type BubbleMode = 'classic' | 'blitz' | 'daily' | 'profi';
type Power = 'slow' | 'bomb' | 'life' | 'shield';
interface Bubble {
  n: number; label?: string; prime: boolean; x: number; y: number; r: number; vx: number; vy: number;
  wob: number; hue: number; age: number; look: PlanetLook; power?: Power; dead?: boolean; wrongT?: number;
}
interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; c: string; s: number }
interface Ring { x: number; y: number; r: number; life: number; c: string }
interface Float { x: number; y: number; text: string; life: number; c: string; size: number }
interface Mistake { n: number; label?: string; kind: 'wrong' | 'missed' }

const KIND: Record<BubbleMode, 'game' | 'blitz' | 'daily' | 'profi'> = { classic: 'game', blitz: 'blitz', daily: 'daily', profi: 'profi' };
const HUES = [205, 265, 320, 15, 42, 165, 190, 290];
const POWER_ICON: Record<Power, string> = { slow: '◔', bomb: '✸', life: '♥', shield: '⛨' };

export function runBubbles(stage: HTMLElement, mode: BubbleMode, exit: () => void, again: (m: BubbleMode) => void): () => void {
  const timed = mode === 'blitz' || mode === 'daily';
  const canvas = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } });
  const leftChip = h('div', { class: 'g-chip' });
  const scoreChip = h('div', { class: 'g-chip score' }, '0');
  const pauseBtn = h('button', { class: 'g-icon', onclick: () => pause() }, '❚❚');
  const hud = h('div', { class: 'g-hud' }, leftChip, scoreChip, pauseBtn);
  const comboEl = h('div', { class: 'g-combo' });
  const layer = h('div', { style: { position: 'absolute', inset: '0' } }, canvas, hud, comboEl);
  stage.replaceChildren(layer);
  const g = canvas.getContext('2d')!;

  let W = 0, H = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const rnd = mode === 'daily' ? mulberry(hashStr('primsieb-' + todayKey())) : Math.random;
  let bubbles: Bubble[] = [], shards: Shard[] = [], rings: Ring[] = [], floats: Float[] = [], mistakes: Mistake[] = [];
  let score = 0, shownScore = 0, lives = 3, level = 1, found = 0, combo = 0, maxCombo = 0, errors = 0;
  let spawnT = 0.2, powerT = mode === 'profi' ? 25 : 12, timeLeft = 60, elapsed = 0, slowT = 0, shield = false, lastPrime = 0;
  let running = false, paused = false, alive = true, over = false, shake = 0, flashRed = 0, flashGood = 0, bestLabel = '';
  const st0 = stats();
  const best0 = st0.best[mode] ?? 0;

  // ------------------------------------------------------------------ Zahlen
  const maxN = () => Math.min(99_999, Math.round(30 * Math.pow(2.0, (timed ? 1 + Math.floor(elapsed / 10) : level) - 1)));
  const pick = (): number => {
    const hi = maxN(), lo = Math.max(2, Math.floor(hi / 6));
    const want = rnd() < 0.45;
    for (let k = 0; k < 400; k++) {
      const n = lo + Math.floor(rnd() * (hi - lo));
      const p = isPrime(n);
      if (want) { if (p) return n; continue; }
      if (p) continue;
      const tricky = level >= 2 || elapsed > 12;
      if (!tricky || (n % 2 && n % 5)) return n;
    }
    return 2 + Math.floor(rnd() * hi);
  };
  const profiDigits = () => 2 + Math.floor(found / 3);
  const avoid = (d: number) => (d <= 2 ? [2n, 5n] : d <= 4 ? [2n, 3n, 5n] : [2n, 3n, 5n, 7n]);
  const profiPick = (): { label: string; prime: boolean } => {
    const d = profiDigits();
    if (Math.random() < 0.45) {
      let n = randDigits(d) | 1n;
      while (!bigPrime(n)) n += 2n;
      if (String(n).length > d) { n = 10n ** BigInt(d - 1) + 1n; while (!bigPrime(n)) n += 2n; }
      return { label: String(n), prime: true };
    }
    for (let k = 0; k < 500; k++) {
      const n = randDigits(d) | 1n;
      if (avoid(d).some(q => n % q === 0n)) continue;
      if (!bigPrime(n)) return { label: String(n), prime: false };
    }
    return { label: String(randDigits(d) * 2n), prime: false };
  };
  const REGIONS = (): [string, number][] => [
    [L('Sonnensystem', 'Solar system'), 220], [L('Blauer Nebel', 'Blue nebula'), 200], [L('Sternhaufen', 'Star cluster'), 260],
    [L('Rote Riesen', 'Red giants'), 350], [L('Pulsar-Feld', 'Pulsar field'), 170], [L('Galaxienkern', 'Galactic core'), 40],
    [L('Quasar', 'Quasar'), 290], [L('Dunkle Materie', 'Dark matter'), 250], [L('Rand des Universums', 'Edge of the universe'), 0],
  ];
  const region = () => REGIONS()[Math.min(REGIONS().length - 1, Math.floor(found / 20))];
  const bgHue = () => {
    if (mode !== 'profi') return 228 + (timed ? elapsed * 1.5 : (level - 1) * 22) + Math.min(combo, 20) * 2;
    const r = REGIONS(), i = Math.min(r.length - 1, Math.floor(found / 20)), j = Math.min(r.length - 1, i + 1), f = (found % 20) / 20;
    return r[i][1] + ((((r[j][1] - r[i][1]) % 360) + 540) % 360 - 180) * f;
  };

  const radiusFor = (t: string) => (t.length <= 5 ? 28 + t.length * 5 : Math.min(68, 42 + Math.ceil(t.length / 2) * 3.4));

  const spawn = (power?: Power) => {
    let n = 0, label: string | undefined, prime = false;
    if (power) { /* Power-up */ }
    else if (mode === 'profi') { if (bubbles.filter(b => !b.power).length >= 7) return; const q = profiPick(); label = q.label; prime = q.prime; }
    else { n = pick(); prime = isPrime(n); }
    const r = power ? 32 : radiusFor(label ?? String(n));
    let x = r + rnd() * Math.max(1, W - 2 * r);
    for (let k = 0; k < 12; k++) {
      if (!bubbles.some(b => b.y > H - 3 * r && Math.abs(b.x - x) < b.r + r + 8)) break;
      x = r + rnd() * Math.max(1, W - 2 * r);
    }
    const speed = mode === 'profi' ? 26 + Math.min(30, found * 0.3) : timed ? 46 + elapsed * 1.6 : 38 + level * 8;
    bubbles.push({ n, label, prime, x, y: H + r, r, vx: 0, vy: speed + rnd() * 16, wob: rnd() * 6.28, hue: HUES[Math.floor(rnd() * HUES.length)], age: 0, power, look: power ? SUN_LOOK : lookFor(label ?? String(n), rnd) });
  };

  // ------------------------------------------------------------------ Effekte
  const pop = (b: Bubble, good: boolean) => {
    const c = good ? lookColor(b.look) : '#ff5a52';
    rings.push({ x: b.x, y: b.y, r: b.r, life: 1, c });
    const k = good ? 16 : 10;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + Math.random() * 0.4, v = 140 + Math.random() * 260;
      shards.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, life: 1, c, s: 5 + Math.random() * 7 });
    }
  };
  const floatText = (x: number, y: number, text: string, c: string, size = 22) => floats.push({ x, y, text, life: 1.2, c, size });
  const bumpScore = () => { scoreChip.classList.remove('bump'); void scoreChip.offsetWidth; scoreChip.classList.add('bump'); };
  const showCombo = () => {
    if (combo < 3) { comboEl.classList.remove('on'); return; }
    const mult = Math.min(5, 1 + Math.floor(combo / 5));
    comboEl.textContent = combo >= 15 ? `♨ ${combo} ×${mult}` : `COMBO ${combo} ×${mult}`;
    comboEl.style.setProperty('--cc', ['#ffb84a', '#ff7a3d', '#ff4d7a', '#b46bff', '#4ad6ff'][mult - 1]);
    comboEl.classList.add('on');
    comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump');
  };

  const mistake = (why: string, x: number, y: number, m: Mistake) => {
    mistakes.push(m); errors++;
    combo = 0; showCombo(); shake = 0.4; flashRed = 1;
    floatText(x, y, why, '#ff8a80', 18);
    sfx.fail(); void buzz('error');
    if (shield) { shield = false; floatText(x, y - 28, L('Schild!', 'Shield!'), '#5fd2ff'); return; }
    if (timed) { score = Math.max(0, score - 50); timeLeft = Math.max(0, timeLeft - 3); return; }
    if (mode === 'profi' && m.kind === 'missed') return;
    lives--;
    if (lives <= 0) setTimeout(gameOver, 450);
  };

  const scorePrime = (b: Bubble) => {
    combo++; maxCombo = Math.max(maxCombo, combo); found++;
    const s = stats(); s.primes++; saveStats(s);
    pop(b, true); flashGood = 0.6;
    note(Math.min(combo - 1, 14));
    void buzz('light');
    if (mode === 'profi') {
      const before = region()[0];
      score = found;
      if (!bestLabel || b.label!.length > bestLabel.length || (b.label!.length === bestLabel.length && b.label! > bestLabel)) bestLabel = b.label!;
      floatText(b.x, b.y, L(`Stufe ${found}`, `Stage ${found}`), '#ffd166');
      if (found % 3 === 0) floatText(W / 2, H * 0.45, L(`${profiDigits()} Stellen`, `${profiDigits()} digits`), '#5fd2ff', 30);
      if (region()[0] !== before) { floatText(W / 2, H * 0.32, `✦ ${region()[0]}`, `hsl(${bgHue()},90%,75%)`, 30); sfx.success(); }
      if (found >= 20) unlock('profi20', layer);
      if (b.label!.length > 5) unlock('big', layer);
    } else {
      const mult = Math.min(5, 1 + Math.floor(combo / 5));
      let pts = (10 + String(b.n).length * 10) * mult, label = `+${pts}`;
      if (lastPrime && Math.abs(lastPrime - b.n) === 2) { pts += 50 * mult; label = L(`Zwilling! +${pts}`, `Twins! +${pts}`); unlock('twin', layer); }
      if (MERSENNE.has(b.n)) { pts *= 2; label = `Mersenne! +${pts}`; unlock('mersenne', layer); }
      lastPrime = b.n;
      score += pts;
      floatText(b.x, b.y, label, '#ffe27a', label.length > 6 ? 22 : 26);
      if (b.n > 10_000) unlock('big', layer);
      if (mode === 'classic' && found % 10 === 0) { level++; floatText(W / 2, H * 0.45, `Level ${level}!`, '#5fd2ff', 38); sfx.success(); if (level >= 10) unlock('lvl10', layer); }
    }
    bumpScore(); showCombo();
    unlock('first', layer);
    if (combo >= 20) unlock('combo20', layer);
    if (stats().primes >= 100) unlock('p100', layer);
    if (stats().primes >= 1000) unlock('p1000', layer);
  };

  const usePower = (b: Bubble) => {
    pop(b, true);
    sfx.success(); void buzz('success');
    const name: Record<Power, string> = { slow: L('Zeitlupe!', 'Slow motion!'), bomb: L('Primzahl-Bombe!', 'Prime bomb!'), life: L('Extra-Leben!', 'Extra life!'), shield: L('Schild!', 'Shield!') };
    floatText(b.x, b.y, name[b.power!], '#ffd166', 26);
    switch (b.power) {
      case 'slow': slowT = 6; break;
      case 'shield': shield = true; break;
      case 'life': if (timed) timeLeft += 5; else lives = Math.min(mode === 'profi' ? 3 : 5, lives + 1); break;
      case 'bomb': for (const o of bubbles) if (!o.dead && o.prime) { o.dead = true; scorePrime(o); } break;
    }
  };

  const tap = (px: number, py: number) => {
    if (!running || paused) return;
    let best: Bubble | null = null, bd = Infinity;
    for (const b of bubbles) {
      if (b.dead || b.wrongT) continue;
      const d = Math.hypot(px - b.x, py - b.y);
      if (d < b.r + 12 && d / b.r < bd) { bd = d / b.r; best = b; }
    }
    if (!best) return;
    const b = best;
    if (b.power) { b.dead = true; return usePower(b); }
    if (b.prime) { b.dead = true; return scorePrime(b); }
    // falsch: Blase wird rot, wackelt kurz und platzt
    b.wrongT = 0.3;
    const why = b.label ? L(`${short(b.label)} ist nicht prim`, `${short(b.label)} is not prime`) : `${b.n} = ${factor(b.n).join(' × ')}`;
    mistake(why, b.x, b.y, { n: b.n, label: b.label, kind: 'wrong' });
  };
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); });

  // ------------------------------------------------------------------ Simulation
  const step = (dtReal: number) => {
    const dt = dtReal * (slowT > 0 ? 0.45 : 1);
    slowT = Math.max(0, slowT - dtReal);
    elapsed += dtReal;
    if (timed) { timeLeft -= dtReal; if (timeLeft <= 0) { timeLeft = 0; gameOver(); return; } }
    spawnT -= dt;
    if (spawnT <= 0) {
      spawn();
      const base = mode === 'profi' ? 1.7 : timed ? Math.max(0.32, 0.85 - elapsed * 0.008) : Math.max(0.38, 1.25 - level * 0.08);
      spawnT = base * (0.75 + rnd() * 0.5);
    }
    powerT -= dtReal;
    if (powerT <= 0) {
      const p: Power[] = mode === 'profi' ? ['slow', 'life', 'shield'] : ['slow', 'bomb', 'life', 'shield'];
      spawn(p[Math.floor(rnd() * p.length)]);
      powerT = 18 + rnd() * 14;
    }
    for (const b of bubbles) {
      b.age += dtReal;
      if (b.wrongT !== undefined) { b.wrongT -= dtReal; if (b.wrongT <= 0) { b.dead = true; pop(b, false); } continue; }
      b.y -= b.vy * dt; b.x += b.vx * dt; b.vx *= 0.94; b.wob += dt * 2.2;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    }
    for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i], c = bubbles[j];
      if (a.dead || c.dead) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + c.r + 6;
      if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * push; c.x += ux * push; a.y -= uy * push * 0.5; c.y += uy * push * 0.5; }
    }
    for (const b of bubbles) {
      if (b.dead || b.y > -b.r) continue;
      b.dead = true;
      if (b.power) continue;
      if (mode === 'profi') { if (b.prime) { combo = 0; showCombo(); } continue; }
      if (b.prime) mistake(L(`${b.n} war prim!`, `${b.n} was prime!`), b.x, 70, { n: b.n, kind: 'missed' });
    }
    bubbles = bubbles.filter(b => !b.dead);
  };

  // ------------------------------------------------------------------ Zeichnen
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: [0.3, 0.6, 1][i % 3] }));
  const drawBubble = (b: Bubble, now: number) => {
    const appear = Math.min(1, b.age / 0.35);
    const back = appear < 1 ? 1 + 2.7 * Math.pow(appear - 1, 3) + 1.7 * Math.pow(appear - 1, 2) : 1;  // easeOutBack
    let x = b.x + Math.sin(b.wob) * 4;
    if (b.wrongT !== undefined) x += Math.sin(now / 18) * 5;
    const label = b.power ? POWER_ICON[b.power] : b.label ?? String(b.n);
    drawPlanet(g, x, b.y, b.r, b.look, label, { now: now + b.wob * 1000, scale: back, wrong: b.wrongT !== undefined });
  };

  const draw = (now: number, dt: number) => {
    const sx = shake > 0 ? (Math.random() - 0.5) * 16 * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    shake = Math.max(0, shake - dt * 1.5);
    g.save(); g.translate(sx, sy);
    const hue = bgHue();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `hsl(${hue},55%,14%)`); bg.addColorStop(0.6, `hsl(${hue + 25},55%,8%)`); bg.addColorStop(1, `hsl(${hue + 50},60%,5%)`);
    g.fillStyle = bg; g.fillRect(-20, -20, W + 40, H + 40);
    for (let k = 0; k < 2; k++) {
      const cx = W * (0.25 + 0.5 * k) + Math.sin(now / 7000 + k * 2) * 50, cy = H * (0.35 + 0.3 * k) + Math.cos(now / 9000 + k) * 40;
      const ng = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.8);
      ng.addColorStop(0, `hsla(${hue + 60 * k + 30},90%,60%,.16)`); ng.addColorStop(1, 'hsla(0,0%,0%,0)');
      g.fillStyle = ng; g.fillRect(-20, -20, W + 40, H + 40);
    }
    // Parallax-Sterne (schneller bei hoher Combo)
    const speed = 12 + Math.min(combo, 20) * 4;
    for (const s of stars) {
      s.y -= (dt * speed * s.z) / H; if (s.y < 0) { s.y += 1; s.x = Math.random(); }
      g.globalAlpha = 0.3 + 0.6 * s.z; g.fillStyle = '#fff';
      g.fillRect(s.x * W, s.y * H, 1 + s.z * 1.4, 1 + s.z * 1.4 + (combo >= 10 ? s.z * 6 : 0));
    }
    g.globalAlpha = 1;
    // Gefahrenzone oben
    if (running && bubbles.some(b => b.y < 150 && b.prime && !b.power) && mode !== 'profi') {
      const gr = g.createLinearGradient(0, 0, 0, 90);
      gr.addColorStop(0, `rgba(255,70,70,${0.22 + 0.12 * Math.sin(now / 110)})`); gr.addColorStop(1, 'rgba(255,70,70,0)');
      g.fillStyle = gr; g.fillRect(-20, -20, W + 40, 110);
    }
    for (const b of bubbles) drawBubble(b, now);
    for (const r of rings) {
      r.r += dt * 260; r.life -= dt * 2.4;
      g.globalAlpha = Math.max(0, r.life); g.strokeStyle = r.c; g.lineWidth = 4 * r.life + 1;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, 6.28); g.stroke();
    }
    rings = rings.filter(r => r.life > 0);
    for (const s of shards) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 520 * dt; s.rot += s.vr * dt; s.life -= dt * 1.6;
      g.globalAlpha = Math.max(0, s.life); g.fillStyle = s.c;
      g.save(); g.translate(s.x, s.y); g.rotate(s.rot);
      g.beginPath(); g.moveTo(0, -s.s); g.lineTo(s.s * 0.8, s.s * 0.6); g.lineTo(-s.s * 0.8, s.s * 0.6); g.closePath(); g.fill();
      g.restore();
    }
    shards = shards.filter(s => s.life > 0);
    for (const f of floats) {
      f.y -= 46 * dt; f.life -= dt;
      const a = Math.max(0, Math.min(1, f.life * 1.5)), sc = 1 + Math.max(0, f.life - 1) * 2;
      g.globalAlpha = a; g.font = `900 ${f.size * sc}px system-ui`; g.textAlign = 'center';
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(f.text, Math.max(100, Math.min(W - 100, f.x)), f.y);
      g.fillStyle = f.c; g.fillText(f.text, Math.max(100, Math.min(W - 100, f.x)), f.y);
    }
    floats = floats.filter(f => f.life > 0);
    g.globalAlpha = 1;
    g.restore();
    // Bildschirmrand: rot bei Fehler, Zeitlupe blau
    if (flashRed > 0 || slowT > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, flashRed > 0 ? `rgba(255,40,40,${0.45 * flashRed})` : 'rgba(80,160,255,.3)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      flashRed = Math.max(0, flashRed - dt * 2);
    }
    flashGood = Math.max(0, flashGood - dt * 3);
  };

  const updateHud = () => {
    if (timed) leftChip.textContent = `◷ ${Math.ceil(timeLeft)}`;
    else if (mode === 'profi') leftChip.textContent = `${'○'.repeat(Math.max(0, lives))}${'✕'.repeat(3 - lives)}`;
    else leftChip.textContent = `${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(Math.max(0, 3 - lives))}${shield ? ' ⛨' : ''}`;
    if (mode === 'profi') scoreChip.textContent = L(`Stufe ${found} · ${profiDigits()} St.`, `Stage ${found} · ${profiDigits()} dig.`);
    else { shownScore += (score - shownScore) * 0.25; if (Math.abs(score - shownScore) < 1) shownScore = score; scoreChip.textContent = N(Math.round(shownScore)); }
  };

  let last = performance.now();
  const frame = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running && !paused) step(dt);
    draw(now, dt);
    updateHud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ------------------------------------------------------------------ Ablauf
  const overlay = h('div', { style: { position: 'absolute', inset: '0', zIndex: '6', pointerEvents: 'none' } });
  layer.append(overlay);

  async function begin() {
    overlay.style.pointerEvents = 'none';
    if (mode === 'profi') floatText(W / 2, H * 0.3, `✦ ${region()[0]}`, '#9fd8ff', 30);
    await countdown(overlay);
    if (!alive) return;
    running = true;
    sfx.start();
  }

  function pause() {
    if (!running || paused || over) return;
    paused = true;
    const box = h('div', { class: 'g-endwrap' }, h('div', { class: 'g-end' },
      h('div', { class: 'g-endtitle' }, L('Pause', 'Paused')),
      h('div', { class: 'g-score', style: { fontSize: '40px' } }, mode === 'profi' ? L(`Stufe ${found}`, `Stage ${found}`) : N(score)),
      h('div', { class: 'g-row' }, chunky(L('Beenden', 'Quit'), () => { box.remove(); gameOver(); }, 'plain'), chunky(L('Weiter', 'Resume'), () => { box.remove(); paused = false; last = performance.now(); }, 'go'))));
    overlay.style.pointerEvents = 'auto';
    overlay.append(box);
  }

  function gameOver() {
    if (over) return;
    over = true; running = false;
    const s = stats();
    s.played++;
    if (!s.modes.includes(mode)) s.modes.push(mode);
    const record = score > best0;
    if (record) s.best[mode] = score;
    if (mode === 'daily' && (s.daily?.date !== todayKey() || score > (s.daily?.score ?? 0))) s.daily = { date: todayKey(), score };
    saveStats(s);
    if (timed && errors === 0 && found >= 15) unlock('flawless', layer);
    if (mode === 'daily') unlock('daily', layer);
    if (s.modes.length >= 6) unlock('all', layer);
    if (score >= (mode === 'profi' ? 1 : 10))
      addScore({
        kind: KIND[mode], time: new Date().toISOString(), device: 'game', score, unit: mode === 'profi' ? L('Stufe', 'stage') : L('Punkte', 'points'), points: score,
        detail: mode === 'daily' ? todayKey() : mode === 'profi' ? L(`Stufe ${found}, größte Primzahl ${bestLabel.length} Stellen`, `stage ${found}, largest prime ${bestLabel.length} digits`) : L(`${found} Primzahlen, max. Combo ${maxCombo}`, `${found} primes, max combo ${maxCombo}`),
        version: VERSION, valid: true,
      });
    const world = h('div', { class: 'g-sub', style: { color: '#7fd8ff', minHeight: '18px' } });
    const review = mistakes.slice(0, 4).map(m => h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '7px 10px', marginTop: '6px', borderRadius: '12px', background: 'rgba(255,255,255,.06)', fontSize: '13px', textAlign: 'left' } },
      h('b', { style: { color: m.kind === 'missed' ? '#ffd166' : '#ff8a80', whiteSpace: 'nowrap' } }, m.label ? short(m.label) : String(m.n)),
      h('span', { style: { color: '#c9cdd6' } }, m.label ? bigRule(m.label) : m.kind === 'missed' ? L('war prim – entwischt', 'was prime – escaped') : rule(m.n))));
    const title = { classic: L('Klassisch', 'Classic'), blitz: 'Blitz', daily: L('Tages-Challenge', 'Daily challenge'), profi: L('Mathe-Profi', 'Math pro') }[mode];
    overlay.style.pointerEvents = 'auto';
    setTimeout(() => {
      endScreen(overlay, {
        game: mode, title, score, record,
        scoreLabel: mode === 'profi' ? (bestLabel ? L(`Stufe · größte Primzahl: ${short(bestLabel)}`, `stage · largest prime: ${short(bestLabel)}`) : L('Stufe', 'stage'))
          : L(`${found} Primzahlen · max. Combo ${maxCombo}${mode === 'classic' ? ` · Level ${level}` : ''}`, `${found} primes · max combo ${maxCombo}${mode === 'classic' ? ` · level ${level}` : ''}`),
        lines: [world, ...(review.length ? [h('div', { class: 'g-sub', style: { marginTop: '10px', textAlign: 'left' } }, L('So erkennst du es:', 'How to spot it:')), ...review] : [])],
        onAgain: () => { cleanup(); again(mode === 'daily' ? 'blitz' : mode); },
        onMenu: () => { cleanup(); exit(); },
      });
      if (stats().streak >= 7) unlock('streak7', layer);
    }, 350);
    if (lbConfigured() && settings().lbConsent === 'yes' && score >= (mode === 'profi' ? 1 : 10)) {
      const kind = KIND[mode];
      setTimeout(() => fetchModel(kind, gameGroup(kind), score).then(r => {
        world.textContent = !r.stats || r.stats.n < 2 || r.below == null ? L('⊕ Du bist unter den ersten Spielern weltweit!', '⊕ You are among the first players worldwide!')
          : L(`⊕ Besser als ${Math.round(r.below * 100)} % von ${N(r.stats.n)} Spielern${mode === 'daily' ? ' heute' : ''}`, `⊕ Better than ${Math.round(r.below * 100)} % of ${N(r.stats.n)} players${mode === 'daily' ? ' today' : ''}`);
      }).catch(() => {}), 1600);
    }
  }

  const offHidden = onHidden(() => { if (running && !paused) pause(); });
  function cleanup() { alive = false; running = false; offHidden(); removeEventListener('resize', resize); }
  void begin();
  return cleanup;
}
