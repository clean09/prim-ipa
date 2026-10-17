// Meta-Fortschritt über alle Läufe: Sternenstaub (Dauerwährung), Talente, Klassen, Kartenpakete, Härtegrade,
// Erfolge, Tagesziele, Verlauf. Gespeichert dauerhaft über saveData('rogue') (nativ: Capacitor Preferences).
import { L } from '../core/i18n';
import { loadData, saveData } from '../core/store';
import { todayKey } from '../core/leaderboard';
import { ClassId, Run } from './types';
import { hashSeed, step } from './rng';

export interface RunRecord { date: string; cls: ClassId; won: boolean; act: number; floor: number; score: number; staub: number; seed: string; asc: number; killedBy?: string; maxCombo: number; maxHit: number }
export interface Meta {
  staub: number; totalStaub: number;
  classes: ClassId[]; packs: string[]; talents: Record<string, number>;
  ascMax: number; runs: number; wins: number; bestScore: number; bestFloor: number;
  history: RunRecord[]; achievements: string[];
  daily: { date: string; goals: { id: string; p: number; done: boolean }[]; runDone?: boolean };
  totals: Record<string, number>;
  tutorial: boolean;
}

const DEF: Meta = {
  staub: 0, totalStaub: 0, classes: ['sieber'], packs: [], talents: {}, ascMax: 0, runs: 0, wins: 0, bestScore: 0, bestFloor: 0,
  history: [], achievements: [], daily: { date: '', goals: [] }, totals: {}, tutorial: false,
};

let cache: Meta | null = null;
export function meta(): Meta {
  if (!cache) cache = { ...DEF, ...loadData<Partial<Meta>>('rogue', {}) } as Meta;
  refreshDaily(cache);
  return cache;
}
export function saveMeta() { if (cache) saveData('rogue', cache); }

// ------------------------------------------------------------------------------------------- Talente (datengetrieben)
export interface TalentDef { id: string; name: [string, string]; text: (lv: number) => [string, string]; max: number; cost: (lv: number) => number; icon: string }
export const TALENTS: TalentDef[] = [
  { id: 'vital', icon: '❤️', name: ['Vitalität', 'Vitality'], max: 5, cost: lv => 40 + lv * 30, text: lv => [`+${6 * lv} max. LP zu Laufbeginn`, `+${6 * lv} max HP at run start`] },
  { id: 'reich', icon: '🪙', name: ['Erbschaft', 'Inheritance'], max: 4, cost: lv => 35 + lv * 30, text: lv => [`+${25 * lv} Startgold`, `+${25 * lv} starting gold`] },
  { id: 'glueck', icon: '🍀', name: ['Glück', 'Luck'], max: 4, cost: lv => 60 + lv * 40, text: lv => [`+${3 * lv} % seltene Karten, Proben +${2 * lv} %`, `+${3 * lv} % rare cards, checks +${2 * lv} %`] },
  { id: 'reroll', icon: '🔁', name: ['Zweite Chance', 'Second Chance'], max: 3, cost: lv => 50 + lv * 50, text: lv => [`${lv} kostenlose Rerolls je Lauf`, `${lv} free rerolls per run`] },
  { id: 'relikt', icon: '🏺', name: ['Fundstück', 'Heirloom'], max: 1, cost: () => 150, text: () => ['Start mit einem zufälligen gewöhnlichen Relikt', 'Start with a random common relic'] },
  { id: 'schlank', icon: '✂️', name: ['Schlankes Deck', 'Lean Deck'], max: 1, cost: () => 90, text: () => ['Start ohne einen „Schnitt“', 'Start without one “Slash”'] },
  { id: 'staub', icon: '✨', name: ['Sternensammler', 'Star Collector'], max: 5, cost: lv => 80 + lv * 60, text: lv => [`+${10 * lv} % Sternenstaub`, `+${10 * lv} % stardust`] },
  { id: 'heiler', icon: '⛺', name: ['Lagerfeuer', 'Campfire'], max: 2, cost: lv => 70 + lv * 60, text: lv => [`Rasten heilt +${10 * lv} %`, `Resting heals +${10 * lv} %`] },
];
export const talent = (id: string) => meta().talents[id] ?? 0;

export const CLASS_COST: Record<ClassId, number> = { sieber: 0, modula: 250, wuerfel: 400 };

export function buy(cost: number, apply: (m: Meta) => void) {
  const m = meta();
  if (m.staub < cost) return false;
  m.staub -= cost; apply(m); saveMeta();
  return true;
}

/** Nächstes erschwingliches Ziel (für „nur noch X bis …“). */
export function nextGoal(): { label: string; cost: number } | null {
  const m = meta();
  const opts: { label: string; cost: number }[] = [];
  for (const [c, cost] of Object.entries(CLASS_COST)) if (!m.classes.includes(c as ClassId) && cost) opts.push({ label: L(`Klasse ${c === 'modula' ? 'Modula' : 'Würfelkönig'}`, `Class ${c === 'modula' ? 'Modula' : 'Dice King'}`), cost });
  for (const t of TALENTS) { const lv = m.talents[t.id] ?? 0; if (lv < t.max) opts.push({ label: `${L(t.name[0], t.name[1])} ${lv + 1}`, cost: t.cost(lv) }); }
  opts.sort((a, b) => a.cost - b.cost);
  return opts.find(o => o.cost > m.staub) ?? opts[0] ?? null;
}

// ------------------------------------------------------------------------------------------- Erfolge
export interface AchDef { id: string; icon: string; name: [string, string]; text: [string, string]; staub: number }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first', icon: '🚀', name: ['Erster Fall', 'First Fall'], text: ['Einen Lauf beenden', 'Finish a run'], staub: 10 },
  { id: 'boss1', icon: '÷', name: ['Teilerbezwinger', 'Divisor Slayer'], text: ['Den Großen Teiler besiegen', 'Defeat the Great Divisor'], staub: 30 },
  { id: 'boss2', icon: '🐛', name: ['Wurmfänger', 'Worm Catcher'], text: ['Den Mersenne-Wurm besiegen', 'Defeat the Mersenne Worm'], staub: 50 },
  { id: 'win', icon: '🏆', name: ['Riemann gelöst', 'Riemann Solved'], text: ['Die Riemann-Hydra besiegen', 'Defeat the Riemann Hydra'], staub: 100 },
  { id: 'combo5', icon: '🔥', name: ['Primkette', 'Prime Chain'], text: ['Kombo 5 in einem Zug', 'Combo 5 in one turn'], staub: 20 },
  { id: 'combo8', icon: '☄️', name: ['Primlawine', 'Prime Avalanche'], text: ['Kombo 8 in einem Zug', 'Combo 8 in one turn'], staub: 60 },
  { id: 'hit100', icon: '💥', name: ['Hundert!', 'Hundred!'], text: ['100 Schaden mit einem Treffer', '100 damage in one hit'], staub: 40 },
  { id: 'jackpot', icon: '🎰', name: ['Jackpot!', 'Jackpot!'], text: ['Den Jackpot am Automaten knacken', 'Hit the slot jackpot'], staub: 50 },
  { id: 'rich', icon: '💰', name: ['Dagobert', 'Scrooge'], text: ['500 Gold gleichzeitig besitzen', 'Hold 500 gold at once'], staub: 30 },
  { id: 'cursed3', icon: '☠️', name: ['Fluchsammler', 'Curse Collector'], text: ['3 verfluchte Relikte in einem Lauf', '3 cursed relics in one run'], staub: 40 },
  { id: 'deck35', icon: '🗂️', name: ['Kartenhai', 'Card Shark'], text: ['35 Karten im Deck', '35 cards in your deck'], staub: 20 },
  { id: 'lean', icon: '✂️', name: ['Minimalist', 'Minimalist'], text: ['Akt 2 mit höchstens 8 Karten erreichen', 'Reach act 2 with at most 8 cards'], staub: 40 },
  { id: 'modula', icon: '🧪', name: ['Alchemie', 'Alchemy'], text: ['Mit Modula einen Boss besiegen', 'Defeat a boss as Modula'], staub: 30 },
  { id: 'wuerfel', icon: '🎲', name: ['Glücksritter', 'Fortune’s Knight'], text: ['Mit dem Würfelkönig einen Boss besiegen', 'Defeat a boss as the Dice King'], staub: 30 },
  { id: 'asc3', icon: '⛰️', name: ['Härte III', 'Hardship III'], text: ['Auf Härte 3 gewinnen', 'Win on Hardship 3'], staub: 150 },
  { id: 'daily', icon: '📅', name: ['Tagesheld', 'Daily Hero'], text: ['Alle 3 Tagesziele an einem Tag', 'All 3 daily goals in a day'], staub: 25 },
];

/** Erfolg freischalten – gibt die Definition zurück, wenn er neu ist (für die Einblendung). */
export function unlock(id: string): AchDef | null {
  const m = meta();
  if (m.achievements.includes(id)) return null;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return null;
  m.achievements.push(id); m.staub += a.staub; m.totalStaub += a.staub; saveMeta();
  achListeners.forEach(f => f(a));
  return a;
}
const achListeners = new Set<(a: AchDef) => void>();
export function onAchievement(f: (a: AchDef) => void) { achListeners.add(f); return () => achListeners.delete(f); }

// ------------------------------------------------------------------------------------------- Tagesziele
export interface GoalDef { id: string; stat: string; n: number; text: [string, string]; staub: number }
export const GOALS: GoalDef[] = [
  { id: 'g-combo4', stat: 'maxCombo', n: 4, text: ['Erreiche Kombo 4', 'Reach combo 4'], staub: 20 },
  { id: 'g-elite2', stat: 'elites', n: 2, text: ['Besiege 2 Elite-Gegner', 'Defeat 2 elites'], staub: 25 },
  { id: 'g-casino', stat: 'casinoWon', n: 100, text: ['Gewinne 100 Gold im Casino', 'Win 100 gold in the casino'], staub: 25 },
  { id: 'g-cards', stat: 'cards', n: 60, text: ['Spiele 60 Karten', 'Play 60 cards'], staub: 15 },
  { id: 'g-act2', stat: 'act', n: 2, text: ['Erreiche Akt 2', 'Reach act 2'], staub: 20 },
  { id: 'g-boss', stat: 'bosses', n: 1, text: ['Besiege einen Boss', 'Defeat a boss'], staub: 30 },
  { id: 'g-primes', stat: 'primes', n: 40, text: ['Triff 40 Primzahlen', 'Hit 40 primes'], staub: 20 },
  { id: 'g-kills', stat: 'kills', n: 15, text: ['Besiege 15 Gegner', 'Defeat 15 enemies'], staub: 15 },
  { id: 'g-hit', stat: 'maxHit', n: 40, text: ['Triff mit 40+ Schaden', 'Hit for 40+ damage'], staub: 20 },
  { id: 'g-events', stat: 'checks', n: 3, text: ['Gewinne 3 Proben', 'Win 3 checks'], staub: 15 },
];

function refreshDaily(m: Meta) {
  const day = todayKey();
  if (m.daily.date === day) return;
  let s = hashSeed(day);
  const ids: string[] = [];
  while (ids.length < 3) { const [r, n] = step(s); s = n; const g = GOALS[Math.floor(r * GOALS.length)]; if (!ids.includes(g.id)) ids.push(g.id); }
  m.daily = { date: day, goals: ids.map(id => ({ id, p: 0, done: false })) };
}

/** Fortschritt melden (Statistik-Name, neuer Wert oder Zuwachs). max = Höchstwert statt Summe. */
export function track(stat: string, v: number, max = false) {
  const m = meta();
  let changed = false;
  for (const g of m.daily.goals) {
    const d = GOALS.find(x => x.id === g.id);
    if (!d || d.stat !== stat || g.done) continue;
    g.p = max ? Math.max(g.p, v) : g.p + v;
    changed = true;
    if (g.p >= d.n) {
      g.done = true; m.staub += d.staub; m.totalStaub += d.staub;
      goalListeners.forEach(f => f(d));
      if (m.daily.goals.every(x => x.done)) unlock('daily');
    }
  }
  m.totals[stat] = max ? Math.max(m.totals[stat] ?? 0, v) : (m.totals[stat] ?? 0) + v;
  if (changed) saveMeta();
}
const goalListeners = new Set<(g: GoalDef) => void>();
export function onGoal(f: (g: GoalDef) => void) { goalListeners.add(f); return () => goalListeners.delete(f); }

// ------------------------------------------------------------------------------------------- Laufende
export function scoreOf(r: Run, won: boolean) {
  const s = r.stats;
  return Math.round(s.floors * 12 + s.kills * 6 + s.elites * 30 + s.bosses * 120 + r.gold / 4 + s.maxCombo * 15 + (won ? 600 : 0)) * (1 + r.ascension * 0.25);
}

export function finishRun(r: Run, won: boolean, killedBy?: string) {
  const m = meta();
  const score = Math.round(scoreOf(r, won));
  const staub = Math.round(Math.max(8, score / 6) * (1 + 0.1 * talent('staub')) * (r.daily ? 1.5 : 1));
  const prevBest = m.bestScore;
  m.staub += staub; m.totalStaub += staub; m.runs++;
  if (won) { m.wins++; m.ascMax = Math.max(m.ascMax, Math.min(5, r.ascension + 1)); }
  m.bestScore = Math.max(m.bestScore, score); m.bestFloor = Math.max(m.bestFloor, r.stats.floors);
  m.history.unshift({ date: new Date().toISOString(), cls: r.cls, won, act: r.act, floor: r.floor, score, staub, seed: r.seed, asc: r.ascension, killedBy, maxCombo: r.stats.maxCombo, maxHit: r.stats.maxHit });
  m.history = m.history.slice(0, 30);
  if (r.daily) m.daily.runDone = true;
  saveMeta();
  saveData('rogueRun', null);
  const ach: AchDef[] = [];
  const u = (id: string) => { const a = unlock(id); if (a) ach.push(a); };
  u('first');
  if (won) u('win');
  if (won && r.ascension >= 3) u('asc3');
  return { score, staub, newBest: score > prevBest, ach };
}
