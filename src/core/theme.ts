// Design-System: 5 Designs wie in der Windows-Version (Nebel, Studio, Observatorium, Labor, Papier), live umschaltbar
// (kreisförmiger Übergang per View Transition). Jedes Design bringt Farben, Schriften, Rundungen und Hintergrund mit.
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { settings } from './store';

export type Design = 'nebel' | 'studio' | 'observatorium' | 'labor' | 'papier';
export type Accent = 'system' | 'blue' | 'violet' | 'orange' | 'green' | 'pink';
export type Motion = 'system' | 'full' | 'calm' | 'off';

export interface DesignInfo {
  id: Design; de: string; en: string; light: boolean; bg: string; ink: string; accent: string; accent2: string;
  tagDe: string; tagEn: string;
}
export const DESIGNS: DesignInfo[] = [
  { id: 'nebel', de: 'Nebel', en: 'Nebula', light: false, bg: '#07070d', ink: '#eef0ff', accent: '#8f7bff', accent2: '#3de0d0', tagDe: 'Tiefraum, Leuchtfarben', tagEn: 'Deep space, glow' },
  { id: 'studio', de: 'Studio', en: 'Studio', light: true, bg: '#efede8', ink: '#111111', accent: '#ff4d00', accent2: '#111111', tagDe: 'Groteske, viel Weißraum', tagEn: 'Grotesque, lots of space' },
  { id: 'observatorium', de: 'Observatorium', en: 'Observatory', light: false, bg: '#0a1222', ink: '#efe6d2', accent: '#d9b46c', accent2: '#7fa8d9', tagDe: 'Messing, Serifen, Nacht', tagEn: 'Brass, serifs, night' },
  { id: 'labor', de: 'Labor', en: 'Lab', light: false, bg: '#050605', ink: '#d8ffd0', accent: '#c6ff3d', accent2: '#3dffb0', tagDe: 'Terminal, Monospace', tagEn: 'Terminal, monospace' },
  { id: 'papier', de: 'Papier', en: 'Paper', light: true, bg: '#efe7d6', ink: '#1d1a16', accent: '#d23c2a', accent2: '#1f4e8c', tagDe: 'Druck, Tinte, Raster', tagEn: 'Print, ink, grid' },
];

export const ACCENTS: Record<Exclude<Accent, 'system'>, [string, string]> = {
  blue: ['#2f9bff', '#0068b5'], violet: ['#b07cff', '#6a3de8'], orange: ['#ff7a1a', '#d0500a'],
  green: ['#34c77b', '#138a52'], pink: ['#ff5fa2', '#c22a6e'],
};

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set<() => void>();

export const design = (): DesignInfo => DESIGNS.find(d => d.id === settings().design) ?? DESIGNS[0];
/** Für ältere Bausteine (Hintergrund, Diagramme): hell / dunkel. */
export const resolvedTheme = (): 'dark' | 'light' | 'amoled' => (design().light ? 'light' : 'dark');
export const isLight = () => design().light;
export const motionLevel = (): 'full' | 'calm' | 'off' => {
  const m = settings().motion as string;
  if (m === 'reduced' || m === 'off') return 'off';
  if (m === 'calm') return 'calm';
  if (m === 'system') return motionQuery.matches ? 'off' : 'full';
  return 'full';
};
export const reducedMotion = () => motionLevel() === 'off';
export const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8f7bff';

export function applyTheme() {
  const s = settings();
  const d = design();
  const root = document.documentElement;
  root.dataset.design = d.id;
  root.dataset.theme = d.light ? 'light' : 'dark';
  root.dataset.motion = motionLevel() === 'off' ? 'reduced' : motionLevel();
  let [a, b] = s.accent === 'system' ? [d.accent, d.accent2] : ACCENTS[s.accent];
  root.style.setProperty('--accent', a);
  root.style.setProperty('--accent2', b);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', d.bg);
  root.style.colorScheme = d.light ? 'light' : 'dark';
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: d.light ? Style.Light : Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: d.bg }).catch(() => {});
  }
  listeners.forEach(f => f());
}

/** Designwechsel mit kreisförmigem Übergang ab dem Tippunkt (View Transitions, sonst sofort). */
export function switchDesign(apply: () => void, x = innerWidth / 2, y = innerHeight / 2) {
  const doc = document as any;
  if (!doc.startViewTransition || reducedMotion()) { apply(); return; }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = doc.startViewTransition(() => apply());
  vt.ready.then(() => {
    document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
}

export function onThemeChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); }
motionQuery.addEventListener('change', () => applyTheme());
