// STERNENFALL-Simulator: spielt viele Läufe ohne Oberfläche durch (Absturzsuche + Balance).
// Start im Entwicklungsbrowser (npm run dev), Konsole:
//   const S = await import('/tools/sternenfall-sim.ts'); console.table((await S.sim(200)).acts)
// Speicherstände werden vorher gesichert und danach wiederhergestellt.
import { Reactor } from '../src/rogue/reactor';
import { ENEMY, SECTOR } from '../src/rogue/data/enemies';
import { SYM } from '../src/rogue/data/symbols';
import { MOD } from '../src/rogue/data/modules';
import { enterAct, lastAct, moduleOffer, newRun, runCtx, sectorOf, symbolOffer, addModule } from '../src/rogue/run';
import { pick, rngOf } from '../src/rogue/rng';
import { Run } from '../src/rogue/types';

const RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
type FightLog = { sector: string; kind: string; ids: string; won: boolean; turns: number; hpLost: number; dpt: number; spins: number };

/** Einfache Strategie: drehen, solange es nicht überhitzt; gute Walzen halten, wenn Hitze reicht. */
async function playFight(run: Run, ids: string[], kind: 'fight' | 'elite' | 'boss', smart: boolean) {
  const ui = { emit() {}, pause: () => Promise.resolve() };
  const c = new Reactor(run, ids, ui, kind);
  const hp0 = run.hp;
  c.start();
  // Ziel wie ein Mensch wählen: Schergen (z. B. Spiegelscherben) zuerst, sonst wenigste Lebenspunkte
  const aim = () => { const a = c.alive().sort((x, y) => +(ENEMY[y.id].tier === 'minion') - +(ENEMY[x.id].tier === 'minion') || x.hp - y.hp); if (a[0]) c.target = a[0]; };
  while (!c.over && c.turn < 60) {
    aim();
    if (c.canSpin()) { c.spinOnce(); await c.resolve(); }
    while (!c.over && c.canSpin()) {
      if (smart) {
        c.held = [false, false, false];
        // Walze halten, deren Mitte zur Familie einer anderen passt (Synergie-Jagd)
        const tags = c.grid.map(col => SYM[col[1].id]?.tag);
        for (let r = 0; r < 3; r++) if (tags.filter(t => t === tags[r]).length >= 2 && c.held.filter(Boolean).length < 1) c.held[r] = true;
      }
      if (c.heat + c.spinHeat() > c.heatMax) { c.held = [false, false, false]; if (c.heat + c.spinHeat() > c.heatMax) break; }
      aim(); c.spinOnce(); await c.resolve();
    }
    if (!c.over) await c.endTurn();
  }
  for (const id of run.modules) MOD[id]?.onCombatEnd?.(runCtx(run), c.over === 'win');
  const dealt = c.foes.reduce((s, f) => s + f.max - Math.max(0, f.hp), 0);
  return { won: c.over === 'win', turns: c.turn, hpLost: hp0 - Math.max(0, run.hp), dpt: dealt / c.turn, spins: run.stats.spins };
}

function reward(run: Run, kind: string) {
  const ctx = runCtx(run);
  const offer = symbolOffer(run, 3, kind === 'boss' ? 60 : kind === 'elite' ? 15 : 0);
  const best = [...offer].sort((a, b) => RANK[SYM[b].rarity] - RANK[SYM[a].rarity])[0];
  if (best) ctx.addSymbol(best);
  if (kind !== 'fight') { const m = moduleOffer(run, 1)[0]; if (m && !MOD[m].cursed) addModule(run, m); }
  ctx.gainGold(kind === 'boss' ? 75 : kind === 'elite' ? 35 : 18);
}

export async function sim(n = 100, o: { ship?: string; asc?: number; smart?: boolean; fights?: number; rand?: boolean } = {}) {
  const backup = { ...localStorage };
  const logs: FightLog[] = [];
  const deaths: Record<string, number> = {};
  const reached: number[] = [];
  let wins = 0, errors = 0;
  const errs: string[] = [];
  try {
    for (let i = 0; i < n; i++) {
      const run = newRun(o.ship ?? 'kreuzer', `SIM${i}`, o.asc ?? 0);
      if (o.rand && !run.sectors.includes('rand')) run.sectors.push('rand');   // Endsektor erzwingen
      const r = rngOf(run);
      let dead = false;
      try {
        for (let act = 1; act <= lastAct(run) && !dead; act++) {
          if (act > 1) enterAct(run, act);
          const sec = SECTOR[sectorOf(run)];
          const plan: ('fight' | 'elite' | 'boss')[] = [...Array(o.fights ?? 5).fill('fight'), 'elite', 'fight', 'boss'];
          for (const kind of plan) {
            run.floor++;
            if (kind === 'boss') run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.3)); // Rast vor dem Boss
            const ids = kind === 'boss' ? [pick(r, sec.bosses)] : kind === 'elite' ? pick(r, sec.elite) : pick(r, run.floor <= 3 ? sec.easy : sec.hard);
            const res = await playFight(run, ids, kind, o.smart ?? true);
            logs.push({ sector: sec.id, kind, ids: ids.join('+'), ...res });
            if (!res.won) { dead = true; deaths[ids.join('+')] = (deaths[ids.join('+')] ?? 0) + 1; break; }
            reward(run, kind);
          }
          if (!dead) reached.push(act);
        }
        if (!dead) wins++;
      } catch (e) { errors++; if (errs.length < 8) errs.push(String((e as Error).stack ?? e).slice(0, 400)); }
    }
  } finally {
    localStorage.clear(); for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v);
  }
  const group = (key: (l: FightLog) => string) => {
    const m: Record<string, { n: number; won: number; turns: number; hpLost: number; dpt: number }> = {};
    for (const l of logs) { const g = (m[key(l)] ??= { n: 0, won: 0, turns: 0, hpLost: 0, dpt: 0 }); g.n++; g.dpt += l.dpt; g.won += +l.won; g.turns += l.turns; g.hpLost += l.hpLost; }
    return Object.fromEntries(Object.entries(m).map(([k, g]) => [k, { n: g.n, win: +(g.won / g.n).toFixed(2), turns: +(g.turns / g.n).toFixed(1), hpLost: +(g.hpLost / g.n).toFixed(1), dpt: Math.round(g.dpt / g.n) }]));
  };
  return {
    runs: n, wins, winRate: wins / n, errors, errs,
    actsCleared: [1, 2, 3, 4].map(a => reached.filter(x => x === a).length / n),
    acts: group(l => `${l.sector}/${l.kind}`),
    foes: group(l => l.ids),
    deaths: Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 12),
    unknownFoes: logs.flatMap(l => l.ids.split('+')).filter(id => !ENEMY[id]),
  };
}
