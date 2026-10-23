// Navigation + „Messung läuft“-Status, von main.ts eingerichtet und von den Seiten benutzt.
export const busy = { running: false, label: '' };
const busyListeners = new Set<() => void>();
export function setBusy(on: boolean, label = '') {
  const changed = busy.running !== on;
  busy.running = on; busy.label = label;
  if (changed) busyListeners.forEach(f => f());
}
/** Benachrichtigt bei Beginn/Ende einer Messung (z. B. Hintergrund-Animation anhalten). */
export function busyChanged(f: () => void) { busyListeners.add(f); return () => busyListeners.delete(f); }

let navigate: (id: string) => void = () => {};
let rebuildFn: () => void = () => {};
export const go = (id: string) => navigate(id);
export const rebuild = () => rebuildFn();
export function initNav(nav: (id: string) => void, rb: () => void) { navigate = nav; rebuildFn = rb; }

let immersiveFn: (on: boolean) => void = () => {};
/** Kopf- und Tab-Leiste ausblenden (Vollbild-Grafik). */
/** Vollbildseiten (Spiele) verdecken den App-Hintergrund – der darf dann ruhen (sonst rechnet er unsichtbar mit). */
export const fullscreen = { on: false };
export const immersive = (on: boolean) => { const ch = fullscreen.on !== on; fullscreen.on = on; immersiveFn(on); if (ch) busyListeners.forEach(f => f()); };
export function initImmersive(fn: (on: boolean) => void) { immersiveFn = fn; }

/** Wird aufgerufen, wenn die App in den Hintergrund geht. Gibt Abmeldefunktion zurück. */
export function onHidden(fn: () => void): () => void {
  window.addEventListener('app-hidden', fn);
  return () => window.removeEventListener('app-hidden', fn);
}
