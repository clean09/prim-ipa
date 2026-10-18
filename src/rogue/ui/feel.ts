// Haptik der Oberfläche: Tipp-Welle mit Funken, 3D-Neigung der Karten zum Zeiger, Lichtreflex, Hover-Zustände.
// Ein Ereignis-Delegat für den ganzen Spielbereich – neue Elemente bekommen das automatisch über ihre Klassen.
import { Particles } from '../juice';

const TAPPABLE = '.sf-btn, .sf-go, .sf-spin, .sf-endturn, .sf-hold, .sf-loadrow, .sf-mission, .sf-opt, .sf-modopt, .sf-node, .sf-foe, .sc, .sf-continue, .sf-tabs2 button, .sf-ib, .sf-mod, .sf-buy, .sf-chapter, .sf-cx, .sf-pickrow, .sf-subseg button, .sf-staub, .sf-crest';
const TILT = '.sc, .sf-shipcard, .sf-mission, .sf-continue';

/** Ersetzt „15 ✦“ / „+60✦“ / „120 ✧“ in Texten durch Münze bzw. Kristall (nur hinter Zahlen – Zierstern bleibt). */
const NUM_ICON = /(\d[\d.,]*\s?)([✦✧])/;
function iconize(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (NUM_ICON.test(n.nodeValue ?? '') && !(n.parentElement?.closest('svg, .sfc, .sfd, input, textarea'))) hits.push(n as Text);
  for (const t of hits) {
    const frag = document.createDocumentFragment();
    let rest = t.nodeValue ?? '';
    for (let m = rest.match(NUM_ICON); m && m.index != null; m = rest.match(NUM_ICON)) {
      frag.append(rest.slice(0, m.index) + m[1]);
      const i = document.createElement('i'); i.className = m[2] === '✦' ? 'sfc' : 'sfd'; frag.append(i);
      rest = rest.slice(m.index + m[0].length);
    }
    frag.append(rest);
    t.replaceWith(frag);
  }
}
export function attachIcons(...roots: HTMLElement[]) {
  // Nur geänderte Teile prüfen (Kampf ändert ständig Zahlen – ein Vollscan je Bild wäre teuer)
  const pending = new Set<Node>();
  let queued = false;
  const flush = () => { queued = false; pending.forEach(n => { if (n.isConnected) iconize(n); }); pending.clear(); };
  const mo = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'characterData') { if (r.target.parentNode) pending.add(r.target.parentNode); }
      else r.addedNodes.forEach(n => pending.add(n));
    }
    if (!queued && pending.size) { queued = true; requestAnimationFrame(flush); }
  });
  roots.forEach(r => { mo.observe(r, { childList: true, subtree: true, characterData: true }); iconize(r); });
  mo.observe(document.body, { childList: true, subtree: false });
  return () => mo.disconnect();
}

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
