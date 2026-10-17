// Spielerfortschritt über alle Spiele: Erfahrungspunkte (XP) und Level, Tages-Serie, Sterne je Modus.
import { L } from '../core/i18n';
import { GameStats, saveSettings, settings } from '../core/store';
import { todayKey } from '../core/leaderboard';

export type GameId = 'classic' | 'blitz' | 'split' | 'daily' | 'profi' | 'pi';

export const stats = (): GameStats & { xp: number; streak: number; lastDay?: string; stars: Record<string, number> } => {
  const g = settings().game as any ?? {};
  const best = { ...(settings().gameBest && !g.best ? { classic: settings().gameBest } : {}), ...(g.best ?? {}) };
  return { played: 0, primes: 0, splits: 0, achievements: [], modes: [], xp: 0, streak: 0, stars: {}, ...g, best };
};
export const saveStats = (s: ReturnType<typeof stats>) => saveSettings({ game: s as any });

/** Level aus XP: Level n braucht 100·n·(n−1)/2 XP insgesamt (100, 300, 600, …). */
export function levelOf(xp: number) {
  let lv = 1;
  while (xp >= (100 * lv * (lv + 1)) / 2) lv++;
  const from = (100 * (lv - 1) * lv) / 2, to = (100 * lv * (lv + 1)) / 2;
  return { level: lv, into: xp - from, need: to - from, frac: (xp - from) / (to - from) };
}

export const levelTitle = (lv: number) => {
  const t = [L('Zahlen-Neuling', 'Number rookie'), L('Rechenlehrling', 'Apprentice'), L('Teiler-Jäger', 'Divisor hunter'), L('Primzahl-Späher', 'Prime scout'),
    L('Sieb-Meister', 'Sieve master'), L('Euklids Erbe', 'Euclid’s heir'), L('Gauß-Schüler', 'Gauss pupil'), L('Riemann-Forscher', 'Riemann explorer'), L('Primzahl-Legende', 'Prime legend')];
  return t[Math.min(t.length - 1, Math.floor((lv - 1) / 3))];
};

/** Sterne-Schwellen je Spiel (1, 2, 3 Sterne). */
export const STAR_TH: Record<GameId, [number, number, number]> = {
  classic: [300, 900, 2000], blitz: [400, 1100, 2200], daily: [400, 1100, 2200], split: [150, 500, 1200], profi: [5, 15, 35], pi: [10, 30, 100],
};
export const starsFor = (id: GameId, score: number) => STAR_TH[id].filter(t => score >= t).length;

/** Nach einem Spiel: XP gutschreiben, Tages-Serie, Sterne. Gibt die Veränderung zurück (für die Anzeige). */
export function finishRun(id: GameId, score: number) {
  const s = stats();
  const before = levelOf(s.xp);
  const stars = starsFor(id, score);
  const base = id === 'profi' ? score * 20 : id === 'pi' ? score * 6 : Math.round(score / 10);
  const xp = Math.max(5, Math.min(600, base)) + stars * 15;
  s.xp += xp;
  const today = todayKey();
  if (s.lastDay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    s.streak = s.lastDay === yKey ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  s.stars[id] = Math.max(s.stars[id] ?? 0, stars);
  saveStats(s);
  const after = levelOf(s.xp);
  return { xp, stars, before, after, levelUp: after.level > before.level, streak: s.streak };
}
