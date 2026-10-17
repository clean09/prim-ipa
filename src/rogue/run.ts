// Ein Lauf von STERNENFALL: Start (Schiff, Sektoren, Talente, Mutatoren), verzweigte Sternenkarte je Akt,
// Angebote (Seltenheit + Pity), Ereignis-Ergebnisse, Speichern/Laden.
import { loadData, saveData } from '../core/store';
import { SYM, SYMBOLS } from './data/symbols';
import { MOD, MODULES } from './data/modules';
import { SECTORS } from './data/enemies';
import { SHIP } from './data/ships';
import { CONST, CONSTELLATIONS, constCounts } from './data/constellations';
const CONSTELLATIONS_IDX: Record<string, number> = Object.fromEntries(CONSTELLATIONS.map((c, i) => [c.id, i + 1]));
import { level, packUnlocked, track, unlock } from './meta';
import { hashSeed, pick, rngOf, shuffle, weighted } from './rng';
import { MapNode, NodeKind, Outcome, Rarity, Run, RunCtx, SymInst } from './types';

export const ROWS = 11;
export const COLS = 4;
export const REEL_MAX = 9;

export function newRun(ship: string, seed: string, asc = 0, o: { daily?: string; weekly?: string; mutators?: string[]; deck?: string } = {}): Run {
  const sh = SHIP[ship] ?? SHIP.kreuzer;
  const run: Run = {
    seed, ship: sh.id, act: 1, floor: 0, sectors: [], hp: sh.hp, maxHp: sh.hp, gold: sh.gold, reels: [[], [], []], modules: [],
    map: [], at: -1, rng: hashSeed(seed), uid: 1, rerolls: 0, removes: 0, pityRare: 0, pityCasino: 0, luck: 0,
    stats: { kills: 0, elites: 0, bosses: 0, dmg: 0, maxHit: 0, jackpots: 0, synergies: 0, spins: 0, floors: 0, overheats: 0, slotJackpots: 0, goldWon: 0 },
    ascension: asc, daily: o.daily, weekly: o.weekly, mutators: o.mutators ?? [], heatBonus: sh.heatMax - 6, spinBonus: sh.spins - 3, mods: {}, startedAt: Date.now(),
  };
  // Sektoren: je Stufe einer der freigeschalteten; nach dem ersten Sieg zusätzlich „Der Rand“
  const r = rngOf(run);
  for (const tier of [1, 2, 3] as const) run.sectors.push(pick(r, SECTORS.filter(s => s.tier === tier && packUnlocked(s.pack))).id);
  if (packUnlocked('s-rand')) run.sectors.push('rand');
  // Talente
  run.maxHp += 6 * level('t-huelle'); run.hp = run.maxHp;
  run.gold += 25 * level('t-gold');
  run.mods.freeRerolls = level('t-reroll');
  run.luck = 0.02 * level('t-glueck');
  run.heatBonus += level('t-hitze');
  if (level('t-drehung')) run.mods.firstSpin = 1;
  run.mods.restBonus = 0.1 * level('t-rast');
  // Mutatoren (Wochen-Expedition)
  if (run.mutators.includes('heiss')) { run.heatBonus -= 1; run.spinBonus += 1; }
  if (run.mutators.includes('glas')) { run.mods.taken = 0.5; run.mods.dmgMult = 1.5; }
  if (run.mutators.includes('reich')) run.mods.goldMult = 2;
  if (run.mutators.includes('bosse')) run.mods.bossHp = 0.3;
  const rc = runCtx(run);
  // Startdeck: ersetzt das letzte Symbol jeder Walze durch den Kern einer Konstellation
  const deck = o.deck && CONST[o.deck] ? CONST[o.deck].starter : null;
  sh.reels.forEach((reel, i) => reel.forEach((id, k) => rc.addSymbol(deck && k === reel.length - 1 ? deck[i] : id, i)));
  if (deck) run.mods.deck = CONSTELLATIONS_IDX[o.deck!] ?? 0;
  if (run.mutators.includes('schrott')) { rc.addSymbol('schrott', 0); rc.addSymbol('schrott', 1); rc.addSymbol('schrott', 2); }
  addModule(run, sh.module);
  if (level('t-modul')) { const m = moduleOffer(run, 1, 'common')[0]; if (m) addModule(run, m); }
  run.map = genMap(run);
  return run;
}

export const sectorOf = (run: Run) => run.sectors[Math.min(run.act, run.sectors.length) - 1];
export const lastAct = (run: Run) => run.sectors.length;

// ------------------------------------------------------------------------------------------- Sternenkarte
export function genMap(run: Run): MapNode[] {
  const r = rngOf(run);
  const rows = run.act === 4 ? 6 : ROWS;
  const grid: (MapNode | null)[][] = Array.from({ length: rows }, () => Array(COLS).fill(null));
  const nodes: MapNode[] = [];
  const get = (row: number, col: number) => {
    if (!grid[row][col]) { const n: MapNode = { id: nodes.length, row, col, kind: 'fight', next: [] }; grid[row][col] = n; nodes.push(n); }
    return grid[row][col]!;
  };
  const starts = shuffle(r, [0, 1, 2, 3]).slice(0, 3).concat([Math.floor(r() * COLS)]);
  for (const s of starts) {
    let col = s, prev = get(0, col);
    for (let row = 1; row < rows - 1; row++) {
      col = Math.max(0, Math.min(COLS - 1, col + (Math.floor(r() * 3) - 1)));
      const n = get(row, col);
      if (!prev.next.includes(n.id)) prev.next.push(n.id);
      prev = n;
    }
  }
  const boss: MapNode = { id: nodes.length, row: rows - 1, col: 1.5, kind: 'boss', next: [] };
  nodes.push(boss);
  for (const n of nodes) if (n.row === rows - 2) n.next = [boss.id];
  const casinoW = run.mutators.includes('casino') ? 18 : 9;
  for (const n of nodes) {
    if (n.kind === 'boss') continue;
    if (n.row === 0) n.kind = 'fight';
    else if (n.row === Math.floor(rows / 2)) n.kind = 'chest';
    else if (n.row === rows - 2) n.kind = 'rest';
    else n.kind = weighted<NodeKind>(r, [['fight', 42], ['event', 20], ['elite', n.row >= 3 ? 12 : 0], ['shop', n.row >= 2 ? 8 : 0], ['casino', n.row >= 2 ? casinoW : 0], ['rest', n.row >= 4 && n.row !== rows - 3 ? 7 : 0]]);
  }
  for (const n of nodes) for (const k of n.next) { const m = nodes[k]; if (m.kind === n.kind && ['shop', 'casino', 'rest', 'elite'].includes(m.kind) && m.row < rows - 2) m.kind = 'fight'; }
  return nodes;
}
export const reachable = (run: Run): number[] => (run.at < 0 ? run.map.filter(n => n.row === 0).map(n => n.id) : run.map[run.at].next);

// ------------------------------------------------------------------------------------------- Lauf-Kontext
export const allSymbols = (run: Run) => run.reels.flat();
export function runCtx(run: Run): RunCtx {
  return {
    run,
    gainGold(n: number) {
      if (n > 0) { for (const id of run.modules) { const f = MOD[id]?.modGold; if (f) n = f(n); } n = Math.round(n * (run.mods.goldMult ?? 1)); }
      run.gold = Math.max(0, run.gold + n);
      if (run.gold >= 400) unlock('rich');
    },
    heal(n: number) { run.hp = Math.min(run.maxHp, run.hp + n); },
    addSymbol(id: string, reel?: number, lv = 1) {
      if (!SYM[id]) return;
      let r = reel ?? -1;
      if (r < 0 || r > 2) { r = 0; for (let i = 1; i < 3; i++) if (run.reels[i].length < run.reels[r].length) r = i; }
      if (run.reels[r].length >= REEL_MAX && SYM[id].tag !== 'fluch') return;
      run.reels[r].push({ uid: run.uid++, id, lv });
      if (allSymbols(run).length >= 30) unlock('reels30');
    },
    rnd: rngOf(run),
  };
}
export function addModule(run: Run, id: string) {
  const d = MOD[id];
  if (!d || run.modules.includes(id)) return;
  run.modules.push(id);
  d.onRunStart?.(runCtx(run));
  if (run.modules.filter(x => MOD[x]?.cursed).length >= 3) unlock('cursed3');
}
export function removeSymbol(run: Run, uid: number) { for (const r of run.reels) { const i = r.findIndex(s => s.uid === uid); if (i >= 0 && r.length > 2) { r.splice(i, 1); return true; } } return false; }
export function findSymbol(run: Run, uid: number): SymInst | undefined { return allSymbols(run).find(s => s.uid === uid); }

// ------------------------------------------------------------------------------------------- Angebote
const RAR_COL: Record<string, string> = { common: '#bfb39a', rare: '#7fb3b0', epic: '#b48fd0', legendary: '#e0b860', start: '#bfb39a', boss: '#e07a6a' };
export const rarityColor = (r: string) => RAR_COL[r] ?? '#e0b860';

function rollRarity(run: Run, boost = 0): Rarity {
  const r = rngOf(run);
  const p = run.pityRare + boost + run.luck * 100;
  const leg = 1 + p / 12, epic = 6 + p / 3, rare = 30 + p;
  const x = r() * 100;
  const out: Rarity = x < leg ? 'legendary' : x < leg + epic ? 'epic' : x < leg + epic + rare ? 'rare' : 'common';
  run.pityRare = out === 'common' ? Math.min(40, run.pityRare + 3) : 0;
  return out;
}
export const symbolPool = () => SYMBOLS.filter(s => !s.noOffer && packUnlocked(s.pack));
export function symbolOffer(run: Run, n = 3, boost = 0): string[] {
  const r = rngOf(run), pool = symbolPool(), out: string[] = [];
  // Bevorzugt Konstellationen, die man schon sammelt (gewichtet nach Anzahl) – so entstehen Builds
  const cnt = Object.entries(constCounts(run)).filter(([, k]) => k >= 2);
  for (let i = 0; i < n; i++) {
    let rar = rollRarity(run, boost);
    let c = pool.filter(s => s.rarity === rar && !out.includes(s.id));
    if (cnt.length && r() < 0.45) {
      const arch = weighted(r, cnt.map(([a, k]) => [a, k] as [string, number]));
      const m = new Set(CONST[arch].members);
      const f = pool.filter(s => m.has(s.id) && !out.includes(s.id) && (s.rarity === rar || r() < 0.5));
      if (f.length) c = f;
    }
    while (!c.length && rar !== 'common') { rar = rar === 'legendary' ? 'epic' : rar === 'epic' ? 'rare' : 'common'; c = pool.filter(s => s.rarity === rar && !out.includes(s.id)); }
    if (!c.length) c = pool.filter(s => !out.includes(s.id));
    out.push(pick(r, c).id);
  }
  return out;
}
export function moduleOffer(run: Run, n = 1, force?: Rarity | 'cursed', boost = 0): string[] {
  const r = rngOf(run);
  const pool = MODULES.filter(x => !run.modules.includes(x.id) && x.rarity !== 'start' && x.rarity !== 'boss' && packUnlocked(x.pack));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let c = force === 'cursed' ? pool.filter(x => x.cursed) : pool.filter(x => !x.cursed);
    const rar = force && force !== 'cursed' ? force : weighted<Rarity>(r, [['common', 50 - boost], ['rare', 33], ['epic', 13 + boost / 2], ['legendary', 4 + boost / 2]]);
    if (force !== 'cursed') { const f = c.filter(x => x.rarity === rar); if (f.length) c = f; }
    c = c.filter(x => !out.includes(x.id));
    if (!c.length) c = pool.filter(x => !out.includes(x.id));
    if (!c.length) break;
    out.push(pick(r, c).id);
  }
  return out;
}
export function rerollCost(run: Run) { if ((run.mods.freeRerolls ?? 0) > 0) return 0; return [15, 25, 40, 60, 90, 130][Math.min(5, run.rerolls)]; }
export function payReroll(run: Run) { const c = rerollCost(run); if (run.gold < c) return false; if (c === 0) run.mods.freeRerolls -= 1; else { run.gold -= c; run.rerolls++; } return true; }
const priceMult = (run: Run) => (run.mods.goldMult ? 2 : 1) * (1 - Math.min(0.15, 0.05 * Math.floor((loadData<{ runs?: number }>('sternenfall', {}).runs ?? 0) / 10)));
export const symbolPrice = (run: Run, rar: Rarity, r: () => number) => Math.round(({ common: 45, rare: 75, epic: 125, legendary: 190 }[rar]) * (0.9 + r() * 0.25) * priceMult(run));
export const modulePrice = (run: Run, rar: string, r: () => number) => Math.round((({ common: 140, rare: 200, epic: 280, legendary: 380 } as Record<string, number>)[rar] ?? 220) * (0.9 + r() * 0.2) * priceMult(run));
export const removeCost = (run: Run) => Math.round((70 + 25 * run.removes) * priceMult(run));
export const upgradeCost = (run: Run, lv: number) => Math.round((40 + lv * 30) * priceMult(run));

// ------------------------------------------------------------------------------------------- Ergebnisse (Ereignisse, Wracks)
export function applyOutcomes(run: Run, list: Outcome[]): { lines: string[]; pickSymbol?: string[]; remove?: boolean; upgrade?: boolean; fight?: 'normal' | 'elite' } {
  const rc = runCtx(run);
  const lines: string[] = [];
  const res: ReturnType<typeof applyOutcomes> = { lines };
  for (const o of list) {
    if (o.gold) { rc.gainGold(o.gold); lines.push(`${o.gold > 0 ? '+' : ''}${o.gold} ✦`); if (o.gold > 0) run.stats.goldWon += o.gold; }
    if (o.hp) { if (o.hp > 0) rc.heal(o.hp); else run.hp = Math.max(1, run.hp + o.hp); lines.push(`${o.hp > 0 ? '+' : ''}${o.hp} ⛨`); }
    if (o.maxHp) { run.maxHp = Math.max(10, run.maxHp + o.maxHp); run.hp = Math.min(run.maxHp, run.hp + Math.max(0, o.maxHp)); lines.push(`${o.maxHp > 0 ? '+' : ''}${o.maxHp} max ⛨`); }
    if (o.staub) { const m = loadData<any>('sternenfall', {}); void m; lines.push(`+${o.staub} ✧`); run.mods.bonusStaub = (run.mods.bonusStaub ?? 0) + o.staub; }
    if (o.card) res.pickSymbol = o.card === 'random' ? symbolOffer(run) : o.card === 'rare' ? symbolOffer(run, 3, 30) : o.card === 'epic' ? symbolOffer(run, 3, 70) : [o.card];
    if (o.relic) {
      const id = MOD[o.relic] ? o.relic : moduleOffer(run, 1, o.relic as any)[0];
      if (id) { addModule(run, id); lines.push(`${MOD[id].icon} ${MOD[id].name[0]}`); }
    }
    if (o.curse) { const id = typeof o.curse === 'string' && SYM[o.curse] ? o.curse : pick(rc.rnd, ['schrott', 'leck', 'parasit', 'dunkelnebel', 'falschgeld']); rc.addSymbol(id); lines.push(`☠ ${SYM[id].name[0]}`); }
    if (o.removeCard) res.remove = true;
    if (o.upgradeCard) res.upgrade = true;
    if (o.fight) res.fight = o.fight;
  }
  return res;
}

// ------------------------------------------------------------------------------------------- Speichern
export const saveRun = (run: Run | null) => saveData('sternenfallRun', run);
export const loadRun = (): Run | null => { const r = loadData<Run | null>('sternenfallRun', null); return r && Array.isArray(r.reels) ? r : null; };

export function enterAct(run: Run, act: number) {
  run.act = act; run.at = -1; run.map = genMap(run);
  run.hp = Math.min(run.maxHp, run.hp + Math.round((run.maxHp - run.hp) * 0.5));
  track('act', act, true);
}
