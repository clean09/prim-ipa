// „π-Stellen“: die Nachkommastellen von π der Reihe nach eintippen – endlos, bis 3 Fehler.
// Im Hintergrund wächst der π-Spaziergang, Farben wandern mit; Meilensteine alle 10/50/100 Stellen.
import { fetchModel, lbConfigured } from '../core/leaderboard';
import { L, N } from '../core/i18n';
import { buzz } from '../core/native';
import { MathPool } from '../core/pool';
import { VERSION, addScore, settings } from '../core/store';
import { h } from '../ui/dom';
import { sfx } from '../ui/fx';
import { unlock } from './achievements';
import { endScreen, note } from './kit';
import { saveStats, stats } from './progress';

export function runPiGame(stage: HTMLElement, exit: () => void, again: () => void): () => void {
  const pool = new MathPool(1);
  let digits = '';
  let loading: Promise<void> | null = null;
  const ensure = (need: number) => {
    if (digits.length >= need || loading) return loading ?? Promise.resolve();
    loading = pool.run<{ fraction: string }>({ type: 'pi', digits: Math.max(2000, need * 4) }).then(r => { digits = r.fraction; loading = null; });
    return loading;
  };

  let pos = 0, strikes = 0, alive = true, ended = false, practice = false, idleT = 0, hinted = false, streak = 0;
  const best0 = stats().best.pi ?? 0;

  const canvas = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } });
  const counter = h('div', { class: 'g-score', style: { fontSize: '48px' } }, '0');
  const strip = h('div', { class: 'pi-strip' });
  const hintEl = h('div', { style: { color: '#ffd166', fontSize: '13.5px', minHeight: '18px', fontWeight: '700' } });
  const livesEl = h('div', { class: 'g-chip' });
  const keyBtns: HTMLButtonElement[] = [];
  const keys = h('div', { class: 'pi-keys' });
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '']) {
    if (!d) { keys.append(h('div')); continue; }
    const b = h('button', { class: 'pi-key', onpointerdown: (e: Event) => { e.preventDefault(); press(d, b); } }, d);
    keyBtns.push(b); keys.append(b);
  }
  const practiceTg = h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', color: '#b8c0e0', fontSize: '12.5px' } },
    h('input', { type: 'checkbox', onchange: (e: Event) => { practice = (e.target as HTMLInputElement).checked; } }),
    L('Lernhilfe: nächste Ziffer nach 4 s (zählt nicht für die Bestenliste)', 'Learning aid: next digit after 4 s (not counted for the leaderboard)'));
  const overlay = h('div', { style: { position: 'absolute', inset: '0', zIndex: '6', pointerEvents: 'none' } });
  const ui = h('div', { class: 'pi-ui' },
    h('div', { class: 'g-hud', style: { position: 'static', padding: '0' } },
      livesEl, h('div', { style: { flex: '1' } }), h('button', { class: 'g-icon', onclick: () => end(true) }, '✕')),
    h('div', { style: { textAlign: 'center' } }, h('div', { style: { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#9fd8ff', lineHeight: '1' } }, 'π'), counter,
      h('div', { style: { color: '#b8c0e0', fontSize: '12.5px', fontWeight: '700' } }, L(`Nachkommastellen · Rekord ${N(best0)}`, `decimals · best ${N(best0)}`))),
    h('div', { class: 'pi-strip-box' }, strip, hintEl),
    h('div', { style: { flex: '1' } }), practiceTg, keys);
  stage.replaceChildren(h('div', { style: { position: 'absolute', inset: '0', background: '#03050a' } }, canvas, ui, overlay));

  const render = () => {
    counter.textContent = N(pos);
    livesEl.textContent = `${'❤️'.repeat(3 - strikes)}${'🖤'.repeat(strikes)}`;
    const shown = digits.slice(Math.max(0, pos - 28), pos);
    const head = pos <= 28 ? '3,' : '…';
    strip.replaceChildren(h('span', { class: 'pi-done' }, head + shown.replace(/(\d{5})(?=\d)/g, '$1 ')), h('span', { class: 'pi-cursor' }, '_'));
  };

  const burst = () => {
    const el = h('div', { class: 'pi-burst' }, pos % 100 === 0 ? `🎉 ${pos}!` : `✨ ${pos}`);
    overlay.append(el); setTimeout(() => el.remove(), 1200);
  };

  const press = (d: string, btn: HTMLButtonElement) => {
    if (ended || !digits) return;
    idleT = 0; hinted = false; hintEl.textContent = '';
    if (d === digits[pos]) {
      pos++; streak++;
      walk.push(+d);
      btn.classList.remove('ok', 'bad'); void btn.offsetWidth; btn.classList.add('ok');
      note(Math.min(streak - 1, 14), 0.045);
      counter.classList.remove('bump'); void counter.offsetWidth; counter.classList.add('bump');
      if (pos % 10 === 0) { burst(); void buzz('light'); }
      if (pos % 50 === 0) sfx.success();
      if (pos >= 50) unlock('pi50', overlay);
      void ensure(pos + 300);
    } else {
      strikes++; streak = 0;
      btn.classList.remove('ok', 'bad'); void btn.offsetWidth; btn.classList.add('bad');
      const right = keyBtns.find(b => b.textContent === digits[pos]);
      right?.classList.add('hint'); setTimeout(() => right?.classList.remove('hint'), 700);
      hintEl.textContent = L(`Richtig wäre ${digits[pos]} gewesen`, `It would have been ${digits[pos]}`);
      sfx.fail(); void buzz('error');
      ui.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      if (strikes >= 3) setTimeout(() => end(false), 500);
    }
    render();
  };

  function end(quit: boolean) {
    if (ended) return;
    ended = true;
    const s = stats(); s.played++; if (!s.modes.includes('pi')) s.modes.push('pi');
    const record = pos > best0 && !practice;
    if (record) s.best.pi = pos;
    saveStats(s);
    if (s.modes.length >= 6) unlock('all', overlay);
    if (pos >= 1 && !practice)
      addScore({ kind: 'pidigits', time: new Date().toISOString(), device: 'game', score: pos, unit: L('Stellen', 'digits'), points: pos, detail: L(`${pos} Nachkommastellen von π`, `${pos} decimals of π`), version: VERSION, valid: true });
    const world = h('div', { class: 'g-sub', style: { color: '#7fd8ff', minHeight: '18px' } });
    const next = digits.slice(pos, pos + 20).replace(/(\d{5})(?=\d)/g, '$1 ');
    overlay.style.pointerEvents = 'auto';
    endScreen(overlay, {
      game: 'pi', title: L('π-Stellen', 'π digits'), score: practice ? 0 : pos, record,
      scoreLabel: practice ? L(`${pos} Stellen mit Lernhilfe (nicht gewertet)`, `${pos} digits with learning aid (not counted)`) : L('Nachkommastellen', 'decimals'),
      lines: [quit ? null : h('div', { class: 'g-sub', style: { marginTop: '8px' } }, L('So geht es weiter:', 'Here is how it continues:'), h('br'),
        h('span', { style: { fontFamily: 'ui-monospace, monospace', color: '#ffd166', fontWeight: '700' } }, next + ' …')), world],
      onAgain: () => { cleanup(); again(); }, onMenu: () => { cleanup(); exit(); },
    });
    if (lbConfigured() && settings().lbConsent === 'yes' && pos >= 1 && !practice)
      setTimeout(() => fetchModel('pidigits', 'Pi', pos).then(r => {
        world.textContent = !r.stats || r.stats.n < 2 || r.below == null ? L('🌍 Du bist unter den ersten π-Spielern weltweit!', '🌍 You are among the first π players worldwide!')
          : L(`🌍 Besser als ${Math.round(r.below * 100)} % von ${N(r.stats.n)} · Bestwert weltweit ${N(r.stats.best)}`, `🌍 Better than ${Math.round(r.below * 100)} % of ${N(r.stats.n)} · world best ${N(r.stats.best)}`);
      }).catch(() => {}), 1500);
  }

  // π-Spaziergang im Hintergrund
  const walk: number[] = [];
  const g = canvas.getContext('2d')!;
  let last = performance.now();
  const draw = (now: number) => {
    if (!alive) return;
    const dt = (now - last) / 1000; last = now;
    if (!ended && digits) { idleT += dt; if (practice && !hinted && idleT > 4) { hinted = true; hintEl.textContent = L(`Tipp: ${digits[pos]}`, `Hint: ${digits[pos]}`); } }
    const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hue = 220 + walk.length * 0.8;
    const bg = g.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, Math.max(W, H));
    bg.addColorStop(0, `hsl(${hue},50%,14%)`); bg.addColorStop(1, `hsl(${hue + 50},55%,4%)`);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    if (walk.length > 1) {
      let x = 0, y = 0, minX = 0, maxX = 0, minY = 0, maxY = 0;
      const pts: [number, number][] = [[0, 0]];
      for (const d of walk) { const a = (d / 10) * Math.PI * 2 - Math.PI / 2; x += Math.cos(a); y += Math.sin(a); pts.push([x, y]); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const s = Math.min((W - 60) / Math.max(8, maxX - minX), (H * 0.3) / Math.max(8, maxY - minY), 26);
      const ox = W / 2 - ((minX + maxX) / 2) * s, oy = H * 0.5 - ((minY + maxY) / 2) * s;
      g.lineWidth = Math.max(1.5, Math.min(4, s / 5)); g.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const f = i / pts.length;
        g.strokeStyle = `hsla(${hue + f * 140},95%,${55 + 15 * f}%,${0.3 + 0.65 * f})`;
        g.beginPath(); g.moveTo(ox + pts[i - 1][0] * s, oy + pts[i - 1][1] * s); g.lineTo(ox + pts[i][0] * s, oy + pts[i][1] * s); g.stroke();
      }
      const [ex, ey] = pts[pts.length - 1];
      const glow = g.createRadialGradient(ox + ex * s, oy + ey * s, 0, ox + ex * s, oy + ey * s, 22);
      glow.addColorStop(0, 'rgba(255,255,255,.95)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(ox + ex * s, oy + ey * s, 22, 0, 6.28); g.fill();
    }
    requestAnimationFrame(draw);
  };

  hintEl.textContent = L('Berechne π …', 'Computing π …');
  void ensure(2000).then(() => { hintEl.textContent = L('Tippe die erste Nachkommastelle!', 'Tap the first decimal!'); render(); });
  render();
  requestAnimationFrame(draw);
  function cleanup() { alive = false; ended = true; pool.dispose(); }
  return cleanup;
}
