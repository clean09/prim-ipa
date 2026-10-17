// Ein Lauf: Start, verzweigte Karte je Akt, Belohnungen (Seltenheit + Pity), Ereignis-Ergebnisse, Speichern/Laden.
import { loadData, saveData } from '../core/store';
import { CARD, CARDS, STARTER } from './data/cards';
import { RELIC, RELICS, START_RELIC } from './data/relics';
import { meta, talent, track, unlock } from './meta';
import { pick, rngOf, shuffle, weighted } from './rng';
import { CardInst, ClassId, MapNode, NodeKind, Outcome, Rarity, Run, RunCtx } from './types';

export const ROWS = 11;            // 0 … 9 normale Stationen, 10 = Boss
export const COLS = 4;

export function newRun(cls: ClassId, seed: string, asc = 0, daily?: string): Run {
  const run: Run = {
    seed, cls, act: 1, floor: 0, hp: 72, maxHp: 72, gold: 99, deck: [], relics: [], map: [], at: -1, rng: hashSeedNum(seed), uid: 1,
    rerolls: 0, removes: 0, pityRare: 0, pityCasino: 0, luck: 0,
    stats: { kills: 0, elites: 0, bosses: 0, dmg: 0, maxHit: 0, maxCombo: 0, goldWon: 0, jackpots: 0, cards: 0, floors: 0 },
    ascension: asc, daily, energyBonus: 0, drawBonus: 0, mods: {}, startedAt: Date.now(),
  };
  if (cls === 'modula') { run.hp = run.maxHp = 66; }
  if (cls === 'wuerfel') { run.hp = run.maxHp = 68; run.gold = 140; }
  // Talente
  run.maxHp += 6 * talent('vital'); run.hp = run.maxHp;
  run.gold += 25 * talent('reich');
  run.mods.freeRerolls = talent('reroll');
  run.luck = 0.02 * talent('glueck');
  const deck = [...STARTER[cls]];
  if (talent('schlank')) deck.splice(deck.indexOf('schnitt'), deck.indexOf('schnitt') >= 0 ? 1 : 0);
  const rc = runCtx(run);
  for (const id of deck) rc.addCard(id);
  addRelic(run, START_RELIC[cls]);
  if (talent('relikt')) { const r = relicOffer(run, 1, 'common')[0]; if (r) addRelic(run, r); }
  run.map = genMap(run);
  return run;
}

function hashSeedNum(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h || 1; }
export const rnd = (run: Run) => rngOf(run)();

// ------------------------------------------------------------------------------------------- Karte (Verzweigungen)
export function genMap(run: Run): MapNode[] {
  const r = rngOf(run);
  const grid: (MapNode | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const nodes: MapNode[] = [];
  const get = (row: number, col: number) => {
    if (!grid[row][col]) { const n: MapNode = { id: nodes.length, row, col, kind: 'fight', next: [] }; grid[row][col] = n; nodes.push(n); }
    return grid[row][col]!;
  };
  // 4 Pfade von unten nach oben; jeder Schritt geht gerade oder diagonal
  const starts = shuffle(r, [0, 1, 2, 3]).slice(0, 3).concat([Math.floor(r() * COLS)]);
  for (const s of starts) {
    let col = s;
    let prev = get(0, col);
    for (let row = 1; row < ROWS - 1; row++) {
      col = Math.max(0, Math.min(COLS - 1, col + (Math.floor(r() * 3) - 1)));
      const n = get(row, col);
      if (!prev.next.includes(n.id)) prev.next.push(n.id);
      prev = n;
    }
  }
  const boss: MapNode = { id: nodes.length, row: ROWS - 1, col: 1.5, kind: 'boss', next: [] };
  nodes.push(boss);
  for (const n of nodes) if (n.row === ROWS - 2) n.next = [boss.id];
  // Stationstypen
  for (const n of nodes) {
    if (n.kind === 'boss') continue;
    if (n.row === 0) n.kind = 'fight';
    else if (n.row === 5) n.kind = 'chest';
    else if (n.row === ROWS - 2) n.kind = 'rest';
    else n.kind = weighted<NodeKind>(r, [['fight', 44], ['event', 20], ['elite', n.row >= 3 ? 12 : 0], ['shop', n.row >= 2 ? 8 : 0], ['casino', n.row >= 2 ? 9 : 0], ['rest', n.row >= 4 && n.row !== ROWS - 3 ? 7 : 0]]);
  }
  // keine zwei gleichen Sonderstationen direkt hintereinander
  for (const n of nodes) for (const k of n.next) { const m = nodes[k]; if (m.kind === n.kind && ['shop', 'casino', 'rest', 'elite'].includes(m.kind) && m.row < ROWS - 2) m.kind = 'fight'; }
  return nodes;
}

export const reachable = (run: Run): number[] =>
  run.at < 0 ? run.map.filter(n => n.row === 0).map(n => n.id) : run.map[run.at].next;

// ------------------------------------------------------------------------------------------- Lauf-Kontext (außerhalb des Kampfes)
export function runCtx(run: Run): RunCtx {
  return {
    run,
    gainGold(n: number) {
      if (n > 0) for (const id of run.relics) { const f = RELIC[id]?.modGold; if (f) n = f(n); }
      run.gold = Math.max(0, run.gold + n);
      if (run.gold >= 500) unlock('rich');
    },
    heal(n: number) { run.hp = Math.min(run.maxHp, run.hp + n); },
    addCard(id: string, up = false) {
      const d = CARD[id];
      if (!d) return;
      run.deck.push({ uid: run.uid++, id, up, val: d.val === 'rand' ? 5 : d.val });
      if (run.deck.length >= 35) unlock('deck35');
    },
    rnd: rngOf(run),
  };
}

export function addRelic(run: Run, id: string) {
  const d = RELIC[id];
  if (!d || run.relics.includes(id)) return;
  run.relics.push(id);
  d.onRunStart?.(runCtx(run));
  if (run.relics.filter(x => RELIC[x]?.cursed).length >= 3) unlock('cursed3');
}

// ------------------------------------------------------------------------------------------- Angebote
const RAR_COL: Record<Rarity, string> = { common: '#a3a8b3', rare: '#4cb3ff', epic: '#c07cff', legendary: '#ffc84a' };
export const rarityColor = (r: string) => RAR_COL[r as Rarity] ?? '#ffc84a';

function rollRarity(run: Run, boost = 0): Rarity {
  const r = rngOf(run);
  const p = run.pityRare + boost + run.luck * 100;
  const leg = 0.8 + p / 12, epic = 5 + p / 3, rare = 28 + p;
  const x = r() * 100;
  const out: Rarity = x < leg ? 'legendary' : x < leg + epic ? 'epic' : x < leg + epic + rare ? 'rare' : 'common';
  // Pity: jedes „gewöhnlich“ macht die nächste Seltene wahrscheinlicher, Treffer setzt zurück
  run.pityRare = out === 'common' ? Math.min(40, run.pityRare + 3) : 0;
  return out;
}

export function cardPool(run: Run) {
  const packs = meta().packs;
  const unlocked = new Set(packs.flatMap(p => (p === 'p1' ? ['euklid', 'mersenne', 'gauss'] : p === 'p2' ? ['katalysator', 'restklasse', 'kronenzahl'] : ['jackpot', 'hausvorteil', 'doppelwette', 'riemann'])));
  return CARDS.filter(c => (c.cls === 'any' || c.cls === run.cls) && c.type !== 'curse' && c.id !== 'schnitt' && c.id !== 'schild' && (!c.locked || unlocked.has(c.id)));
}

export function cardOffer(run: Run, n = 3, boost = 0): string[] {
  const r = rngOf(run);
  const pool = cardPool(run);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let rar = rollRarity(run, boost);
    let cands = pool.filter(c => c.rarity === rar && !out.includes(c.id));
    while (!cands.length && rar !== 'common') { rar = rar === 'legendary' ? 'epic' : rar === 'epic' ? 'rare' : 'common'; cands = pool.filter(c => c.rarity === rar && !out.includes(c.id)); }
    if (!cands.length) cands = pool.filter(c => !out.includes(c.id));
    out.push(pick(r, cands).id);
  }
  return out;
}

export function relicOffer(run: Run, n = 1, force?: Rarity | 'cursed', boost = 0): string[] {
  const r = rngOf(run);
  const pool = RELICS.filter(x => !run.relics.includes(x.id) && x.rarity !== 'start' && x.rarity !== 'boss' && !x.locked);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let cands = force === 'cursed' ? pool.filter(x => x.cursed) : pool.filter(x => !x.cursed);
    const rar = force && force !== 'cursed' ? force : weighted<Rarity>(r, [['common', 50 - boost], ['rare', 33], ['epic', 13 + boost / 2], ['legendary', 4 + boost / 2]]);
    if (force !== 'cursed') { const f = cands.filter(x => x.rarity === rar); if (f.length) cands = f; }
    cands = cands.filter(x => !out.includes(x.id));
    if (!cands.length) cands = pool.filter(x => !out.includes(x.id));
    if (!cands.length) break;
    out.push(pick(r, cands).id);
  }
  return out;
}

/** Reroll-Kosten steigen: 15, 25, 40, 60 … (Talent: erste n gratis) */
export function rerollCost(run: Run) {
  if ((run.mods.freeRerolls ?? 0) > 0) return 0;
  return [15, 25, 40, 60, 90, 130][Math.min(5, run.rerolls)];
}
export function payReroll(run: Run) {
  const c = rerollCost(run);
  if (run.gold < c) return false;
  if (c === 0) run.mods.freeRerolls -= 1; else { run.gold -= c; run.rerolls++; }
  return true;
}

export const cardPrice = (rar: Rarity, r: () => number) => Math.round(({ common: 50, rare: 80, epic: 130, legendary: 200 }[rar]) * (0.9 + r() * 0.25));
export const relicPrice = (rar: string, r: () => number) => Math.round(({ common: 140, rare: 200, epic: 280, legendary: 380 } as Record<string, number>)[rar] * (0.9 + r() * 0.2) || 220);
export const removeCost = (run: Run) => 75 + 25 * run.removes;

// ------------------------------------------------------------------------------------------- Ergebnisse (Ereignisse, Truhen)
/** Wendet Ergebnisse an und liefert lesbare Zeilen + ggf. Auswahl, die der Bildschirm noch abfragen muss. */
export function applyOutcomes(run: Run, list: Outcome[]): { lines: string[]; pickCard?: string[]; remove?: boolean; upgrade?: boolean; fight?: 'normal' | 'elite' } {
  const rc = runCtx(run);
  const lines: string[] = [];
  const res: ReturnType<typeof applyOutcomes> = { lines };
  for (const o of list) {
    if (o.gold) { rc.gainGold(o.gold); lines.push(`${o.gold > 0 ? '+' : ''}${o.gold} 🪙`); if (o.gold > 0) run.stats.goldWon += o.gold; }
    if (o.hp) { if (o.hp > 0) rc.heal(o.hp); else run.hp = Math.max(1, run.hp + o.hp); lines.push(`${o.hp > 0 ? '+' : ''}${o.hp} ❤`); }
    if (o.maxHp) { run.maxHp = Math.max(10, run.maxHp + o.maxHp); run.hp = Math.min(run.maxHp, run.hp + Math.max(0, o.maxHp)); lines.push(`${o.maxHp > 0 ? '+' : ''}${o.maxHp} max ❤`); }
    if (o.staub) { const m = meta(); m.staub += o.staub; m.totalStaub += o.staub; lines.push(`+${o.staub} ✨`); }
    if (o.card) res.pickCard = o.card === 'random' ? cardOffer(run) : o.card === 'rare' ? cardOffer(run, 3, 30) : o.card === 'epic' ? cardOffer(run, 3, 70) : [o.card];
    if (o.relic) {
      const id = RELIC[o.relic] ? o.relic : relicOffer(run, 1, o.relic as any)[0];
      if (id) { addRelic(run, id); lines.push(`${RELIC[id].icon} ${RELIC[id].name[0]}`); }
    }
    if (o.curse) { const id = typeof o.curse === 'string' ? o.curse : pick(rc.rnd, ['bruch', 'zweifel', 'nullteiler', 'gier']); rc.addCard(id); lines.push(`☠ ${CARD[id].name[0]}`); }
    if (o.removeCard) res.remove = true;
    if (o.upgradeCard) res.upgrade = true;
    if (o.fight) res.fight = o.fight;
  }
  return res;
}

// ------------------------------------------------------------------------------------------- Speichern
export const saveRun = (run: Run | null) => saveData('rogueRun', run);
export const loadRun = (): Run | null => loadData<Run | null>('rogueRun', null);

export function enterAct(run: Run, act: number) {
  run.act = act; run.at = -1; run.map = genMap(run);
  run.hp = Math.min(run.maxHp, run.hp + Math.round((run.maxHp - run.hp) * 0.6));   // Erholung zwischen den Akten
  track('act', act, true);
}

export const cardName = (c: CardInst) => CARD[c.id]?.name ?? ['?', '?'];
export { CARD, RELIC };
