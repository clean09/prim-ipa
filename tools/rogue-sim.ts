// Prüfwerkzeug: simuliert komplette PRIMFALL-Läufe ohne Oberfläche (Bot spielt gierig auf Primzahlen).
// Aufruf im Dev-Server (Browser-Konsole): const m = await import('/tools/rogue-sim.ts'); await m.simulate(200)
import { Combat } from '../src/rogue/combat';
import { CARD } from '../src/rogue/data/cards';
import { ENCOUNTERS } from '../src/rogue/data/enemies';
import { EVENTS } from '../src/rogue/data/events';
import { addRelic, applyOutcomes, cardOffer, enterAct, newRun, reachable, relicOffer, runCtx } from '../src/rogue/run';
import { pick, rngOf } from '../src/rogue/rng';
import { ClassId, Run } from '../src/rogue/types';

const ui = { emit() {}, pause: () => Promise.resolve() };

async function fight(run: Run, kind: 'fight' | 'elite' | 'boss') {
  const r = rngOf(run);
  const enc = ENCOUNTERS[run.act];
  const ids = kind === 'boss' ? enc.boss : kind === 'elite' ? pick(r, enc.elite) : pick(r, run.floor <= 3 ? enc.easy : enc.hard);
  const c = new Combat(run, ids, ui, kind);
  c.start();
  let guard = 0;
  while (!c.over && guard++ < 60) {
    // gierig: zuerst Karten, die eine Primzahl treffen, dann die übrigen
    for (let k = 0; k < 12 && !c.over; k++) {
      const idx = c.hand.map((_, i) => i).filter(i => c.canPlay(i));
      if (!idx.length) break;
      idx.sort((a, b) => Number(c.isPrimeSum(c.sum + c.hand[b].val)) - Number(c.isPrimeSum(c.sum + c.hand[a].val)));
      const tgt = c.alive().sort((a, b) => a.hp - b.hp)[0];
      c.play(idx[0], tgt?.uid);
    }
    if (!c.over) await c.endTurn();
  }
  if (guard >= 60) throw new Error('Kampf endet nicht: ' + ids.join(','));
  return { won: c.over === 'win', turns: c.turn, ids };
}

export async function simulate(n = 100, cls: ClassId | 'all' = 'all') {
  const res: Record<string, { runs: number; wins: number; floors: number; deaths: Record<string, number>; acts: number[] }> = {};
  const errors: string[] = [];
  for (let i = 0; i < n; i++) {
    const c: ClassId = cls === 'all' ? (['sieber', 'modula', 'wuerfel'] as ClassId[])[i % 3] : cls;
    const run = newRun(c, `SIM-${i}`, 0);
    const rec = (res[c] ??= { runs: 0, wins: 0, floors: 0, deaths: {}, acts: [0, 0, 0, 0] });
    rec.runs++;
    try {
      let alive = true;
      outer: while (alive) {
        const opts = reachable(run);
        const node = run.map[pick(rngOf(run), opts)];
        run.at = node.id; run.floor++; run.stats.floors++;
        const kind = node.kind;
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          const f = await fight(run, kind);
          if (!f.won) { rec.deaths[f.ids.join('+')] = (rec.deaths[f.ids.join('+')] ?? 0) + 1; alive = false; break; }
          runCtx(run).gainGold(15);
          const offer = cardOffer(run, 3);
          // nimmt die erste Nicht-Fluch-Karte in 70 % der Fälle
          if (rngOf(run)() < 0.7) runCtx(run).addCard(offer[0]);
          if (kind === 'elite') { const id = relicOffer(run, 1)[0]; if (id) addRelic(run, id); }
          if (kind === 'boss') {
            rec.acts[run.act]++;
            if (run.act >= 3) { rec.wins++; break outer; }
            const id = relicOffer(run, 1, 'rare')[0]; if (id) addRelic(run, id);
            enterAct(run, run.act + 1);
            continue;
          }
        } else if (kind === 'event') {
          const ev = pick(rngOf(run), EVENTS.filter(e => e.act === 0 || e.act === run.act));
          const o = ev.options[0];
          const win = !o.check || rngOf(run)() < o.check.chance;
          const out = applyOutcomes(run, win ? o.win : o.lose ?? []);
          if (out.pickCard) runCtx(run).addCard(out.pickCard[0]);
          if (out.fight) { const f = await fight(run, out.fight === 'elite' ? 'elite' : 'fight'); if (!f.won) { alive = false; break; } }
        } else if (kind === 'rest') {
          if (run.hp < run.maxHp * 0.6) runCtx(run).heal(Math.round(run.maxHp * 0.3));
          else { const c2 = run.deck.find(x => !x.up && CARD[x.id].type !== 'curse'); if (c2) c2.up = true; }
        } else if (kind === 'chest') {
          const id = relicOffer(run, 1)[0]; if (id) addRelic(run, id);
        } else if (kind === 'shop') {
          const id = cardOffer(run, 1, 10)[0]; if (run.gold >= 70) { run.gold -= 70; runCtx(run).addCard(id); }
        }
        run.map[run.at].done = true;
      }
      rec.floors += run.stats.floors + (run.act - 1) * 11;
    } catch (e: any) {
      errors.push(`${c} ${run.seed} Akt ${run.act} Etage ${run.floor}: ${e?.stack ?? e}`);
    }
  }
  const summary = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, {
    runs: v.runs, winRate: `${Math.round((v.wins / v.runs) * 100)} %`, avgFloor: +(v.floors / v.runs).toFixed(1),
    bossKills: v.acts.slice(1), topDeaths: Object.entries(v.deaths).sort((a, b) => b[1] - a[1]).slice(0, 5),
  }]));
  return { summary, errors: errors.slice(0, 8), errorCount: errors.length };
}
