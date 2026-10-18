// Meta-Fortschritt über alle Läufe: Sternenstaub, Forschungsbaum, Geschichte (Kapitel), Kodex, Erfolge, Tagesziele,
// Wochen-Expedition, Verlauf. Dauerhaft gespeichert über saveData('rogue') (nativ: Capacitor Preferences).
import { L } from '../core/i18n';
import { loadData, saveData } from '../core/store';
import { todayKey } from '../core/leaderboard';
import { Run } from './types';
import { hashSeed, step } from './rng';
import { RESEARCH, RNODE, SHIPS } from './data/ships';
import { CHAPTERS } from './data/story';

export interface RunRecord { date: string; ship: string; won: boolean; act: number; floor: number; score: number; staub: number; seed: string; asc: number; killedBy?: string; jackpots: number; maxHit: number; weekly?: boolean }
export interface Meta {
  staub: number; totalStaub: number;
  research: Record<string, number>;
  ascMax: number; runs: number; wins: number; finalWins: number; bestScore: number; bestFloor: number;
  history: RunRecord[]; achievements: string[];
  daily: { date: string; goals: { id: string; p: number; done: boolean }[]; runDone?: boolean };
  weekly: { week: string; best: number };
  totals: Record<string, number>;
  chapters: string[]; unread: string[];
  codex: { foes: string[]; syms: string[]; mods: string[] };
  visited: string[]; bossKills: string[];
  tutorial: boolean;
}

const DEF: Meta = {
  staub: 0, totalStaub: 0, research: {}, ascMax: 0, runs: 0, wins: 0, finalWins: 0, bestScore: 0, bestFloor: 0,
  history: [], achievements: [], daily: { date: '', goals: [] }, weekly: { week: '', best: 0 }, totals: {},
  chapters: [], unread: [], codex: { foes: [], syms: [], mods: [] }, visited: [], bossKills: [], tutorial: false,
};

let cache: Meta | null = null;
export function meta(): Meta {
  if (!cache) { const d = loadData<Partial<Meta>>('sternenfall', {}); cache = { ...DEF, ...d, codex: { ...DEF.codex, ...(d.codex ?? {}) } } as Meta; }
  refreshDaily(cache);
  return cache;
}
export function saveMeta() { if (cache) saveData('sternenfall', cache); }

// ------------------------------------------------------------------------------------------- Forschung
export const has = (id: string) => (meta().research[id] ?? 0) > 0;
export const level = (id: string) => meta().research[id] ?? 0;
export function canResearch(id: string) {
  const n = RNODE[id]; if (!n) return false;
  const lv = level(id);
  return lv < n.max && (n.needs ?? []).every(has);
}
export function research(id: string) {
  const n = RNODE[id], m = meta(), lv = level(id);
  if (!canResearch(id) || m.staub < n.cost(lv)) return false;
  m.staub -= n.cost(lv); m.research[id] = lv + 1; saveMeta();
  return true;
}
export const shipUnlocked = (id: string) => { const s = SHIPS.find(x => x.id === id); return !!s && (!s.unlock || has(s.unlock)); };
export const packUnlocked = (p?: string) => !p || has(p) || (p === 's-rand' && meta().wins > 0);

/** Nächstes Forschungsziel (für „nur noch X bis …“). */
export function nextGoal(): { label: string; cost: number } | null {
  const m = meta();
  const opts = RESEARCH.filter(n => canResearch(n.id)).map(n => ({ label: `${L(n.name[0], n.name[1])}${n.max > 1 ? ` ${level(n.id) + 1}` : ''}`, cost: n.cost(level(n.id)) }));
  opts.sort((a, b) => a.cost - b.cost);
  return opts.find(o => o.cost > m.staub) ?? opts[0] ?? null;
}
export function researchProgress() {
  const total = RESEARCH.reduce((s, n) => s + n.max, 0);
  const done = RESEARCH.reduce((s, n) => s + Math.min(n.max, level(n.id)), 0);
  return { done, total };
}

// ------------------------------------------------------------------------------------------- Geschichte
const chapterListeners = new Set<(id: string) => void>();
export function onChapter(f: (id: string) => void) { chapterListeners.add(f); return () => chapterListeners.delete(f); }
/** Auslöser melden (start, visit:<sektor>, boss:<sektor>, win, final, runs:<n>) → neue Kapitel. */
export function story(trigger: string) {
  const m = meta();
  for (const c of CHAPTERS) {
    if (m.chapters.includes(c.id)) continue;
    let ok = c.unlock === trigger;
    if (c.unlock.startsWith('runs:')) ok = m.runs >= Number(c.unlock.slice(5));
    if (ok) { m.chapters.push(c.id); m.unread.push(c.id); chapterListeners.forEach(f => f(c.id)); }
  }
  saveMeta();
}
export function discover(kind: 'foes' | 'syms' | 'mods', id: string) {
  const m = meta();
  if (!m.codex[kind].includes(id)) { m.codex[kind].push(id); saveMeta(); }
}

// ------------------------------------------------------------------------------------------- Erfolge
export interface AchDef { id: string; icon: string; name: [string, string]; text: [string, string]; staub: number }
const A = (id: string, icon: string, de: string, en: string, tde: string, ten: string, staub: number): AchDef => ({ id, icon, name: [de, en], text: [tde, ten], staub });
export const ACHIEVEMENTS: AchDef[] = [
  A('first', '🚀', 'Erster Sprung', 'First Jump', 'Einen Lauf beenden', 'Finish a run', 10),
  A('jackpot1', '🎰', 'Drei in einer Reihe', 'Three in a Row', 'Ersten Jackpot am Reaktor', 'First reactor jackpot', 15),
  A('synergy20', '🌀', 'Resonanz', 'Resonance', '20 Synergien in einem Lauf', '20 synergies in one run', 30),
  A('hit80', '💥', 'Sternenbrecher', 'Star Breaker', '80 Schaden mit einem Treffer', '80 damage in one hit', 40),
  A('boss1', '👑', 'Erster Boss', 'First Boss', 'Einen Boss in Akt 1 oder 2 besiegen', 'Defeat a boss in act 1 or 2', 25),
  A('boss2', '🌸', 'Lilienbrecher', 'Lily Breaker', 'Einen Boss in Akt 3 oder 4 besiegen', 'Defeat a boss in act 3 or 4', 40),
  A('boss3', '🕳️', 'Horizontläufer', 'Horizon Runner', 'Einen Boss in Akt 5 besiegen', 'Defeat a boss in act 5', 60),
  A('win', '✨', 'Licht für die Sterne', 'Light for the Stars', 'Den Architekten am Rand besiegen', 'Defeat the Architect at the Edge', 120),
  A('final', '🌌', 'Am Rand', 'At the Edge', 'Den Architekten besiegen', 'Defeat the Architect', 250),
  A('overheat0', '❄️', 'Kühler Kopf', 'Cool Head', 'Einen Boss ohne Überladung besiegen', 'Beat a boss without overloading', 30),
  A('overheat3', '🔥', 'Glühende Leidenschaft', 'Burning Passion', '3 Überladungen in einem Kampf überleben', 'Survive 3 overloads in one combat', 25),
  A('slotjackpot', '💰', 'Ewiger Orbit', 'Eternal Orbit', 'Den Casino-Jackpot knacken', 'Hit the casino jackpot', 50),
  A('rich', '🪙', 'Ozzos Albtraum', 'Ozzo’s Nightmare', '400 Gold gleichzeitig besitzen', 'Hold 400 gold at once', 30),
  A('cursed3', '☠️', 'Verfluchte Ladung', 'Cursed Cargo', '3 verfluchte Module in einem Lauf', '3 cursed modules in one run', 40),
  A('reels30', '🗂️', 'Volle Walzen', 'Full Reels', '30 Symbole auf den Walzen', '30 symbols on your reels', 25),
  A('lean', '✂️', 'Schlanker Reaktor', 'Lean Reactor', 'Akt 2 mit höchstens 13 Symbolen erreichen', 'Reach act 2 with at most 13 symbols', 40),
  A('ship-astrolab', '🔭', 'Messingträume', 'Brass Dreams', 'Mit dem Astrolab einen Boss besiegen', 'Defeat a boss with the Astrolabe', 30),
  A('ship-nachtfalter', '🦋', 'Nachtflug', 'Night Flight', 'Mit dem Nachtfalter einen Boss besiegen', 'Defeat a boss with the Night Moth', 30),
  A('ship-amboss', '⚒️', 'Schmiedefeuer', 'Forge Fire', 'Mit dem Sonnenamboss einen Boss besiegen', 'Defeat a boss with the Sun Anvil', 30),
  A('ship-spirale', '🌀', 'Durch das Wurmloch', 'Through the Wormhole', 'Mit der Spirale einen Boss besiegen', 'Defeat a boss with the Spiral', 30),
  A('asc3', '⛰️', 'Gefahrenstufe III', 'Danger III', 'Auf Gefahrenstufe 3 gewinnen', 'Win on danger level 3', 150),
  A('asc6', '🗻', 'Gefahrenstufe VI', 'Danger VI', 'Auf Gefahrenstufe 6 gewinnen', 'Win on danger level 6', 300),
  A('daily', '📅', 'Tagesheld', 'Daily Hero', 'Alle 3 Tagesziele an einem Tag', 'All 3 daily goals in one day', 25),
  A('weekly', '🗓️', 'Expedition', 'Expedition', 'Die Wochen-Expedition gewinnen', 'Win the weekly expedition', 80),
  A('codex50', '📖', 'Xenobiologin', 'Xenobiologist', '50 % des Kodex entdeckt', 'Discover 50 % of the codex', 60),
  A('runs50', '⏳', 'Unermüdlich', 'Relentless', '50 Läufe', '50 runs', 100),
];
const achListeners = new Set<(a: AchDef) => void>();
export function onAchievement(f: (a: AchDef) => void) { achListeners.add(f); return () => achListeners.delete(f); }
export function unlock(id: string): AchDef | null {
  const m = meta();
  if (m.achievements.includes(id)) return null;
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return null;
  m.achievements.push(id); m.staub += a.staub; m.totalStaub += a.staub; saveMeta();
  achListeners.forEach(f => f(a));
  return a;
}

// ------------------------------------------------------------------------------------------- Tagesziele
export interface GoalDef { id: string; stat: string; n: number; text: [string, string]; staub: number }
export const GOALS: GoalDef[] = [
  { id: 'g-jack', stat: 'jackpots', n: 3, text: ['Lande 3 Jackpots', 'Land 3 jackpots'], staub: 25 },
  { id: 'g-syn', stat: 'synergies', n: 12, text: ['Löse 12 Synergien aus', 'Trigger 12 synergies'], staub: 20 },
  { id: 'g-elite', stat: 'elites', n: 2, text: ['Besiege 2 Elite-Gegner', 'Defeat 2 elites'], staub: 25 },
  { id: 'g-boss', stat: 'bosses', n: 1, text: ['Besiege einen Boss', 'Defeat a boss'], staub: 30 },
  { id: 'g-kills', stat: 'kills', n: 15, text: ['Besiege 15 Gegner', 'Defeat 15 enemies'], staub: 15 },
  { id: 'g-hit', stat: 'maxHit', n: 35, text: ['Triff mit 35+ Schaden', 'Hit for 35+ damage'], staub: 20 },
  { id: 'g-casino', stat: 'casinoWon', n: 80, text: ['Gewinne 80 Gold im Casino', 'Win 80 gold in the casino'], staub: 25 },
  { id: 'g-act', stat: 'act', n: 2, text: ['Erreiche Akt 2', 'Reach act 2'], staub: 20 },
  { id: 'g-checks', stat: 'checks', n: 3, text: ['Gewinne 3 Proben', 'Win 3 checks'], staub: 15 },
  { id: 'g-overheat', stat: 'overheats', n: 2, text: ['Überlebe 2 Überladungen', 'Survive 2 overloads'], staub: 15 },
];
function refreshDaily(m: Meta) {
  const day = todayKey();
  if (m.daily.date === day) return;
  let s = hashSeed(day);
  const ids: string[] = [];
  while (ids.length < 3) { const [r, n] = step(s); s = n; const g = GOALS[Math.floor(r * GOALS.length)]; if (!ids.includes(g.id)) ids.push(g.id); }
  m.daily = { date: day, goals: ids.map(id => ({ id, p: 0, done: false })) };
}
const goalListeners = new Set<(g: GoalDef) => void>();
export function onGoal(f: (g: GoalDef) => void) { goalListeners.add(f); return () => goalListeners.delete(f); }
export function track(stat: string, v: number, max = false) {
  const m = meta();
  for (const g of m.daily.goals) {
    const d = GOALS.find(x => x.id === g.id);
    if (!d || d.stat !== stat || g.done) continue;
    g.p = max ? Math.max(g.p, v) : g.p + v;
    if (g.p >= d.n) {
      g.done = true; m.staub += d.staub; m.totalStaub += d.staub;
      goalListeners.forEach(f => f(d));
      if (m.daily.goals.every(x => x.done)) unlock('daily');
    }
  }
  m.totals[stat] = max ? Math.max(m.totals[stat] ?? 0, v) : (m.totals[stat] ?? 0) + v;
}

/** Kalenderwoche als Schlüssel (für die Wochen-Expedition). */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

// ------------------------------------------------------------------------------------------- Laufende
export function scoreOf(r: Run, won: boolean) {
  const s = r.stats;
  return Math.round((s.floors * 12 + s.kills * 6 + s.elites * 30 + s.bosses * 120 + r.gold / 4 + s.jackpots * 10 + s.synergies * 2 + (won ? 600 : 0)) * (1 + r.ascension * 0.2));
}

export function finishRun(r: Run, won: boolean, killedBy?: string) {
  const m = meta();
  const score = scoreOf(r, won);
  let mult = (1 + 0.1 * level('t-staub')) * (r.daily ? 1.5 : 1) * (r.weekly ? 1.3 : 1);
  if (r.weekly) mult *= 1 + r.mutators.length * 0.1;
  const staub = Math.round(Math.max(10, score / 6) * mult);
  const prevBest = m.bestScore;
  m.staub += staub; m.totalStaub += staub; m.runs++;
  if (won) { m.wins++; m.ascMax = Math.max(m.ascMax, Math.min(10, r.ascension + 1)); }
  m.bestScore = Math.max(m.bestScore, score); m.bestFloor = Math.max(m.bestFloor, r.stats.floors);
  if (r.weekly) m.weekly = { week: r.weekly, best: Math.max(m.weekly.week === r.weekly ? m.weekly.best : 0, score) };
  m.history.unshift({ date: new Date().toISOString(), ship: r.ship, won, act: r.act, floor: r.floor, score, staub, seed: r.seed, asc: r.ascension, killedBy, jackpots: r.stats.jackpots, maxHit: r.stats.maxHit, weekly: !!r.weekly });
  m.history = m.history.slice(0, 40);
  if (r.daily) m.daily.runDone = true;
  saveMeta();
  saveData('sternenfallRun', null);
  const ach: AchDef[] = [];
  const u = (id: string) => { const a = unlock(id); if (a) ach.push(a); };
  u('first');
  if (won) { u('win'); if (r.ascension >= 3) u('asc3'); if (r.ascension >= 6) u('asc6'); if (r.weekly) u('weekly'); story('win'); }
  if (r.stats.synergies >= 20) u('synergy20');
  if (m.runs >= 50) u('runs50');
  story(`runs:${m.runs}`);
  return { score, staub, newBest: score > prevBest, ach };
}
