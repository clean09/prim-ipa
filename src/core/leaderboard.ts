// Weltweite Bestenliste: anonyme Ergebnisse an den Cloudflare Worker senden (nach einmaliger Zustimmung),
// Ranglisten je Gerätemodell abrufen. Ohne Verbindung bleiben Ergebnisse in einer Warteschlange.
import { Capacitor } from '@capacitor/core';
import { detectDevice } from './devices';
import { L } from './i18n';
import { ScoreEntry, VERSION, onScoreAdded, saveSettings, settings } from './store';

const BASE = (import.meta.env.VITE_LB_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const KEY = (import.meta.env.VITE_LB_KEY as string | undefined) ?? '';
export const lbConfigured = () => !!BASE && !!KEY;

export type LbKind = 'device' | 'prime' | 'bh' | 'ai' | 'game' | 'blitz' | 'split' | 'daily' | 'profi' | 'pidigits';
export interface ModelRow { model: string; soc: string; n: number; avg: number; best: number }

interface Pending { kind: LbKind; score: number; model: string; soc: string; ts: number }

/** Modellname ohne Hersteller-Modellnummer in Klammern → alle S20 FE landen in einer Gruppe. */
export async function myModel() {
  const d = await detectDevice();
  return { model: d.name.replace(/\s*\([^)]*\)\s*$/, '').trim(), soc: d.soc.name };
}

function installId() {
  let id = settings().installId;
  if (!id) { id = crypto.randomUUID(); saveSettings({ installId: id }); }
  return id;
}

async function sign(body: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function send(p: Pending): Promise<boolean> {
  const body = JSON.stringify({ ...p, platform: Capacitor.getPlatform(), version: VERSION, install: installId() });
  try {
    const r = await fetch(`${BASE}/v1/results`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Signature': await sign(body) } });
    return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);   // 4xx (außer Ratenlimit): nicht erneut versuchen
  } catch { return false; }
}

/** Warteschlange abarbeiten (beim Start und nach jedem Ergebnis). */
export async function flush() {
  if (!lbConfigured() || settings().lbConsent !== 'yes') return;
  const queue = settings().lbQueue ?? [];
  if (!queue.length) return;
  const rest: Pending[] = [];
  for (const p of queue) if (!(await send(p))) rest.push(p);
  saveSettings({ lbQueue: rest.slice(-50) });
}

const KIND_OF: Partial<Record<ScoreEntry['kind'], (e: ScoreEntry) => number | null>> = {
  device: e => e.points ?? null,
  prime: e => (e.durationS ?? 0) >= 170 ? e.points ?? null : null,     // nur der volle 3-Minuten-Lauf
  bh: e => e.points ?? null,
  ai: e => e.score,
  game: e => e.score, blitz: e => e.score, split: e => e.score, daily: e => e.score, profi: e => e.score, pidigits: e => e.score,
};
/** Spielmodi werden nicht nach Gerät gruppiert, sondern nach Modus (bzw. Tag der Challenge). */
export const gameGroup = (kind: string, e?: ScoreEntry) => kind === 'daily' ? (e?.detail ?? todayKey()) : kind === 'pidigits' ? 'Pi' : 'Primzahl-Jagd';
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const GAME_KINDS = new Set(['game', 'blitz', 'split', 'daily', 'profi', 'pidigits']);

let consentHook: ((ok: (yes: boolean) => void) => void) | null = null;
/** Die Oberfläche registriert hier den Zustimmungsdialog. */
export function setConsentDialog(f: (answer: (yes: boolean) => void) => void) { consentHook = f; }

onScoreAdded(async e => {
  if (!lbConfigured() || !e.valid) return;
  const f = KIND_OF[e.kind];
  const score = f?.(e);
  if (score == null) return;
  const dev = await myModel();
  const model = GAME_KINDS.has(e.kind) ? gameGroup(e.kind, e) : dev.model;
  const soc = GAME_KINDS.has(e.kind) ? dev.model : dev.soc;
  const p: Pending = { kind: e.kind as LbKind, score, model, soc, ts: Math.floor(Date.now() / 1000) };
  saveSettings({ lbQueue: [...(settings().lbQueue ?? []), p] });
  const c = settings().lbConsent;
  if (c === 'yes') void flush();
  else if (c === 'ask' && consentHook) consentHook(yes => { saveSettings({ lbConsent: yes ? 'yes' : 'no' }); if (yes) void flush(); else saveSettings({ lbQueue: [] }); });
});

export async function fetchTop(kind: LbKind): Promise<{ devices: ModelRow[]; participants: number }> {
  const r = await fetch(`${BASE}/v1/top?kind=${kind}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(L('Server nicht erreichbar', 'Server not reachable'));
  return r.json();
}

export async function fetchModel(kind: LbKind, model: string, score?: number): Promise<{ stats: ModelRow | null; rank: number | null; below: number | null }> {
  const q = new URLSearchParams({ kind, model });
  if (score != null) q.set('score', String(score));
  const r = await fetch(`${BASE}/v1/model?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(L('Server nicht erreichbar', 'Server not reachable'));
  return r.json();
}
