// Dauerhafte Daten: Einstellungen, Bestenliste, Checkpoint. Nativ über Capacitor Preferences (überlebt
// Speicherbereinigung des WebViews), im Browser über localStorage. Beim Start komplett in den Speicher geladen.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface ScoreEntry {
  kind: 'prime' | 'pi' | 'fib' | 'fibprime' | 'nbody' | 'collatz' | 'ai' | 'bh' | 'ram' | 'device' | 'game' | 'blitz' | 'split' | 'daily' | 'profi' | 'pidigits';
  time: string;
  device: string;           // cpu | gpu | …
  threads?: number;
  score: number;            // Hauptwert (Einheit in unit)
  unit: string;
  points?: number;          // Punkte (Primzahlen: Mrd. geprüfte Zahlen; Singularität: FPS × 100)
  detail?: string;
  durationS?: number;
  numbers?: number;
  peak?: number;
  precision?: string;
  model?: string;           // Gerät / GPU
  version: string;
  valid: boolean;
}

export interface Settings {
  language: 'auto' | 'de' | 'en';
  threads: number;
  segment: number;
  primeMode: 'benchmark' | 'unendlich' | 'bereich';
  shortTest: boolean;
  rangeFrom: number;
  rangeTo: number;
  bhQuality: number;
  bhScale: number;
  keepAwake: boolean;
  haptics: boolean;
  sound: boolean;
  theme?: string;            // alt (vor 4.0), nur noch zum Übernehmen
  design: 'nebel' | 'studio' | 'observatorium' | 'labor' | 'papier';
  accent: 'system' | 'blue' | 'violet' | 'orange' | 'green' | 'pink';
  motion: 'system' | 'full' | 'calm' | 'off' | 'reduced';
  intro: boolean;
  /** Sternenleben: zuletzt gewählte Werte */
  star?: { m: number; z: number; rot: number; comp: number; sep: number; cut: boolean };
  /** weltweite Bestenliste: ask = beim ersten Ergebnis fragen */
  lbConsent: 'ask' | 'yes' | 'no';
  lbQueue?: { kind: 'device' | 'prime' | 'bh' | 'ai' | 'game' | 'blitz' | 'split' | 'daily' | 'profi' | 'pidigits'; score: number; model: string; soc: string; ts: number }[];
  installId?: string;
  gameBest?: number;
  game?: GameStats;
}

export interface GameStats {
  played: number; primes: number; splits: number;
  best: Record<string, number>;          // je Modus
  achievements: string[];
  daily?: { date: string; score: number };
  modes: string[];                       // gespielte Modi
}

export interface Checkpoint { nextStart: number; count: number; lastPrime: number; updated: string }

export const VERSION = '4.2';

const DEFAULTS: Settings = {
  language: 'auto', threads: Math.max(1, navigator.hardwareConcurrency || 4), segment: 4_000_000,
  primeMode: 'benchmark', shortTest: false, rangeFrom: 0, rangeTo: 1_000_000_000,
  bhQuality: 1, bhScale: 0.5, keepAwake: true, haptics: true,
  sound: true, design: 'nebel', accent: 'system', motion: 'system', intro: true, lbConsent: 'ask',
};

const native = Capacitor.isNativePlatform();
const cache = new Map<string, string>();

async function get(key: string): Promise<string | null> {
  if (native) return (await Preferences.get({ key })).value;
  try { return localStorage.getItem(key); } catch { return null; }
}
function put(key: string, value: string) {
  cache.set(key, value);
  if (native) void Preferences.set({ key, value });
  else try { localStorage.setItem(key, value); } catch { /* privater Modus */ }
}

export async function loadStore() {
  for (const k of ['settings', 'scores', 'checkpoint', 'sternenfall', 'sternenfallRun']) {
    const v = await get('primsieb.' + k);
    if (v != null) cache.set('primsieb.' + k, v);
  }
}

function read<T>(k: string, def: T): T {
  const v = cache.get('primsieb.' + k);
  if (v == null) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}

export const settings = (): Settings => {
  const s = { ...DEFAULTS, ...read<Partial<Settings>>('settings', {}) };
  // 3.x → 4.0: altes Hell/Dunkel in ein Design übersetzen, alte Akzentwahl auf „Design“ zurück
  if (s.theme && !read<Partial<Settings>>('settings', {}).design) { s.design = s.theme === 'light' ? 'studio' : 'nebel'; s.accent = 'system'; }
  return s;
};
export const saveSettings = (s: Partial<Settings>) => put('primsieb.settings', JSON.stringify({ ...settings(), ...s }));

export const scores = (): ScoreEntry[] => read<ScoreEntry[]>('scores', []);
const scoreListeners = new Set<(e: ScoreEntry) => void>();
/** Benachrichtigt bei jedem neuen Ergebnis (z. B. weltweite Bestenliste). */
export function onScoreAdded(f: (e: ScoreEntry) => void) { scoreListeners.add(f); }
export function addScore(e: ScoreEntry) {
  const list = scores();
  list.push(e);
  put('primsieb.scores', JSON.stringify(list.slice(-500)));
  scoreListeners.forEach(f => { try { f(e); } catch { /* egal */ } });
}
export function deleteScores() { put('primsieb.scores', '[]'); }

export const checkpoint = (): Checkpoint | null => read<Checkpoint | null>('checkpoint', null);
export const saveCheckpoint = (c: Checkpoint | null) => put('primsieb.checkpoint', JSON.stringify(c));

/** Freie Datenablage (z. B. Roguelike-Fortschritt), dauerhaft wie die Einstellungen. */
export const loadData = <T>(key: string, def: T): T => read<T>(key, def);
export const saveData = (key: string, v: unknown) => put('primsieb.' + key, JSON.stringify(v));
