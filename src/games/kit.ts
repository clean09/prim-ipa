// Spiele-Baukasten: Countdown, Endbildschirm (Sterne, XP-Leiste, Level-Aufstieg), musikalische Töne, Knöpfe.
import { L, N } from '../core/i18n';
import { buzz } from '../core/native';
import { settings } from '../core/store';
import { h } from '../ui/dom';
import { sfx } from '../ui/fx';
import { GameId, finishRun, levelTitle } from './progress';

// ------------------------------------------------------------------------------------------- Töne
let ac: AudioContext | null = null;
const PENTA = [0, 2, 4, 7, 9];
/** Ton der Pentatonik – steigt mit der Combo, klingt immer „richtig“. */
export function note(step: number, vol = 0.06) {
  if (!settings().sound) return;
  try {
    ac ??= new AudioContext();
    const oct = Math.floor(step / 5), semi = PENTA[((step % 5) + 5) % 5] + 12 * Math.min(oct, 3);
    const f = 523.25 * Math.pow(2, semi / 12);
    const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = f; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); o2.connect(g); g.connect(ac.destination);
    o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
  } catch { /* egal */ }
}

// ------------------------------------------------------------------------------------------- Countdown
export function countdown(host: HTMLElement): Promise<void> {
  return new Promise(res => {
    const el = h('div', { class: 'g-count' });
    host.append(el);
    const seq = ['3', '2', '1', L('Los!', 'Go!')];
    let i = 0;
    const next = () => {
      if (i >= seq.length) { el.remove(); res(); return; }
      el.textContent = seq[i];
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      note(i === 3 ? 7 : i * 2, 0.05);
      i++;
      setTimeout(next, i === 4 ? 450 : 620);
    };
    next();
  });
}

// ------------------------------------------------------------------------------------------- Knöpfe
export const chunky = (label: string | Node, onclick: () => void, kind: 'go' | 'plain' | 'gold' = 'go') =>
  h('button', { class: `g-btn ${kind}`, onclick: () => { sfx.tap(); onclick(); } }, label);

// ------------------------------------------------------------------------------------------- Endbildschirm
export interface EndOpts {
  game: GameId;
  title: string;
  score: number;
  scoreLabel?: string;           // z. B. „Stufe 12“
  record: boolean;
  lines?: (Node | string | null)[];
  onAgain: () => void;
  onMenu: () => void;
}

export function endScreen(host: HTMLElement, o: EndOpts): HTMLElement {
  const r = finishRun(o.game, o.score);
  const big = h('div', { class: 'g-score' }, '0');
  const starEls = [0, 1, 2].map(i => h('span', { class: 'g-star' + (i === 1 ? ' mid' : '') }, '★'));
  const xpFill = h('div', { class: 'g-xpfill', style: { width: `${r.before.frac * 100}%` } });
  const xpLabel = h('div', { class: 'g-xplabel' }, `Lv ${r.before.level}`);
  const card = h('div', { class: 'g-end' },
    h('div', { class: 'g-endtitle' }, o.title),
    h('div', { class: 'g-stars' }, starEls),
    big,
    o.scoreLabel ? h('div', { class: 'g-sub' }, o.scoreLabel) : null,
    o.record ? h('div', { class: 'g-record' }, L('🏆 Neuer Rekord!', '🏆 New record!')) : null,
    h('div', { class: 'g-xp' }, xpLabel, h('div', { class: 'g-xpbar' }, xpFill), h('div', { class: 'g-xpgain' }, `+${r.xp} XP`)),
    r.streak > 1 ? h('div', { class: 'g-sub' }, `🔥 ${L(`${r.streak} Tage in Folge`, `${r.streak}-day streak`)}`) : null,
    ...(o.lines ?? []).filter(Boolean) as Node[],
    h('div', { class: 'g-row' }, chunky(L('Menü', 'Menu'), o.onMenu, 'plain'), chunky(L('Nochmal', 'Again'), o.onAgain, 'go')));
  const wrap = h('div', { class: 'g-endwrap' }, card);
  host.append(wrap);

  // Animation: Punkte hochzählen → Sterne → XP-Leiste → ggf. Level-Aufstieg
  const t0 = performance.now(), dur = 1100;
  const tick = (now: number) => {
    const f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 3);
    big.textContent = N(Math.round(o.score * e));
    if (f < 1) requestAnimationFrame(tick);
    else {
      starEls.forEach((s, i) => setTimeout(() => {
        if (i < r.stars) { s.classList.add('on'); note(4 + i * 2, 0.07); void buzz('light'); }
      }, 250 + i * 280));
      setTimeout(() => {
        if (r.levelUp) {
          xpFill.style.width = '100%';
          setTimeout(() => {
            xpFill.style.transition = 'none'; xpFill.style.width = '0'; void xpFill.offsetWidth;
            xpFill.style.transition = ''; xpFill.style.width = `${r.after.frac * 100}%`;
            xpLabel.textContent = `Lv ${r.after.level}`;
            card.append(h('div', { class: 'g-levelup' }, L(`Level ${r.after.level}! · ${levelTitle(r.after.level)}`, `Level ${r.after.level}! · ${levelTitle(r.after.level)}`)));
            sfx.success(); void buzz('success');
          }, 700);
        } else xpFill.style.width = `${r.after.frac * 100}%`;
      }, 250 + 3 * 280);
    }
  };
  requestAnimationFrame(tick);
  if (o.record) setTimeout(() => sfx.success(), 400);
  return wrap;
}

/** Einmalige Anleitung je Spiel (Overlay mit Schritten). */
export function tutorial(host: HTMLElement, key: string, steps: [string, string][]): Promise<void> {
  const seen = (settings() as any).tutSeen ?? [];
  if (seen.includes(key)) return Promise.resolve();
  return new Promise(res => {
    let i = 0;
    const icon = h('div', { class: 'g-tut-icon' }), text = h('p', { class: 'g-tut-text' });
    const btn = chunky(L('Weiter', 'Next'), () => show(++i), 'go');
    const box = h('div', { class: 'g-endwrap' }, h('div', { class: 'g-end' }, icon, text, h('div', { class: 'g-row' }, btn)));
    const show = (k: number) => {
      if (k >= steps.length) {
        box.remove();
        import('../core/store').then(m => m.saveSettings({ tutSeen: [...seen, key] } as any));
        res(); return;
      }
      icon.textContent = steps[k][0]; text.textContent = steps[k][1];
      btn.textContent = k === steps.length - 1 ? L('Los geht’s', 'Let’s go') : L('Weiter', 'Next');
    };
    host.append(box);
    show(0);
  });
}
