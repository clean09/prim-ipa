// Haptik der Oberfläche: Tipp-Welle mit Funken, 3D-Neigung der Karten zum Zeiger, Lichtreflex, Hover-Zustände.
// Ein Ereignis-Delegat für den ganzen Spielbereich – neue Elemente bekommen das automatisch über ihre Klassen.
import { Particles } from '../juice';

const TAPPABLE = '.sf-btn, .sf-go, .sf-spin, .sf-endturn, .sf-hold, .sf-loadrow, .sf-mission, .sf-opt, .sf-modopt, .sf-node, .sf-foe, .sc, .sf-continue, .sf-tabs2 button, .sf-ib, .sf-mod, .sf-buy, .sf-chapter, .sf-cx, .sf-pickrow, .sf-subseg button, .sf-staub, .sf-crest';
const TILT = '.sc, .sf-shipcard, .sf-mission, .sf-continue';

export function attachFeel(host: HTMLElement, particles: Particles) {
  const reduced = () => document.documentElement.dataset.motion === 'reduced';
  let tilted: HTMLElement | null = null;

  const setTilt = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 16}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.classList.add('tilt');
  };
  const clearTilt = () => { if (tilted) { tilted.classList.remove('tilt'); tilted.style.removeProperty('--rx'); tilted.style.removeProperty('--ry'); tilted = null; } };

  const down = (e: PointerEvent) => {
    const t = (e.target as HTMLElement).closest?.(TAPPABLE) as HTMLElement | null;
    if (!t || reduced()) return;
    // Welle an der Fingerposition
    const hr = host.getBoundingClientRect(), x = e.clientX - hr.left, y = e.clientY - hr.top;
    const ring = document.createElement('i');
    ring.className = 'sf-ripple' + (t.matches('.sf-spin, .sf-go') ? ' big' : '');
    ring.style.left = `${x}px`; ring.style.top = `${y}px`;
    host.append(ring); setTimeout(() => ring.remove(), 650);
    particles.burst(x, y, t.matches('.sf-spin, .sf-go') ? 14 : 6, 0xe8c070, 120, 2);
    t.classList.remove('pressed'); void t.offsetWidth; t.classList.add('pressed');
    setTimeout(() => t.classList.remove('pressed'), 260);
    // Karten auch bei Berührung zum Finger neigen
    const tl = (e.target as HTMLElement).closest?.(TILT) as HTMLElement | null;
    if (tl && e.pointerType !== 'mouse') { clearTilt(); tilted = tl; setTilt(tl, e.clientX, e.clientY); }
  };
  const move = (e: PointerEvent) => {
    if (reduced()) return;
    const tl = (e.target as HTMLElement).closest?.(TILT) as HTMLElement | null;
    if (e.pointerType !== 'mouse' && !e.buttons) return;
    if (tl !== tilted) clearTilt();
    if (tl) { tilted = tl; setTilt(tl, e.clientX, e.clientY); }
  };
  const up = (e: PointerEvent) => { if (e.pointerType !== 'mouse') setTimeout(clearTilt, 120); };

  host.addEventListener('pointerdown', down, { passive: true });
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('pointerup', up, { passive: true });
  host.addEventListener('pointercancel', up, { passive: true });
  host.addEventListener('pointerleave', clearTilt, { passive: true });
  return () => { host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('pointerleave', clearTilt); };
}
