// Einstellungen von STERNENFALL (lokal gespeichert): Musik/Effekte, Wackeln, Vibration, Tempo, Grafikstufe.
// Grafik „hoch“ = Relief-Filter, Fotohimmel in Bewegung, volle Teilchen; „mittel“ = Walzen ohne Filter;
// „niedrig“ = keine Filter, ruhender Himmel, halbe Teilchen – für ältere Handys.
export interface SfSettings { music: number; sfx: number; shake: boolean; haptics: boolean; fast: boolean; gfx: 'high' | 'mid' | 'low' }

const KEY = 'primsieb.sfSettings';
const DEF: SfSettings = { music: 0.8, sfx: 0.9, shake: true, haptics: true, fast: false, gfx: guessGfx() };
let cache: SfSettings | null = null;
const subs = new Set<(s: SfSettings) => void>();

/** Startwert nach Gerät: wenige Kerne/wenig Speicher → mittel. */
export function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1); }
function guessGfx(): SfSettings['gfx'] {
  if (isIOS()) return 'mid';                       // WebKit rechnet SVG-Filter auf der CPU → „mittel“ ist dort flüssig
  const cores = navigator.hardwareConcurrency || 4, mem = (navigator as any).deviceMemory || 4;
  return cores <= 4 || mem <= 2 ? 'mid' : 'high';
}
export function sfs(): SfSettings {
  if (!cache) {
    try { cache = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { cache = { ...DEF }; }
    // v2: alte Speicherstände auf dem iPhone hatten „hoch“ fest gespeichert – einmalig auf die neue Empfehlung setzen
    if (!(cache as any).v) { (cache as any).v = 2; if (isIOS() && cache!.gfx === 'high') cache!.gfx = 'mid'; }
    document.documentElement.dataset.gfx = cache!.gfx;
  }
  return cache!;
}
export function setSfs(p: Partial<SfSettings>) {
  cache = { ...sfs(), ...p };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* privat */ }
  document.documentElement.dataset.gfx = cache.gfx;
  subs.forEach(f => f(cache!));
}
export function onSfs(f: (s: SfSettings) => void) { subs.add(f); return () => subs.delete(f); }
/** Tempo-Faktor für Pausen und Animationen. */
export const pace = () => (sfs().fast ? 0.55 : 1);
