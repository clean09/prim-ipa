// Kampf-Engine von STERNENFALL: der Reaktor ist ein 3×3-Spielautomat. Die drei Walzen bestehen aus den Symbolen
// des Spielers. Jeder Zug: bis zu N Drehs; Walzen lassen sich halten (Risiko: Hitze). Nach jedem Dreh feuern alle
// sichtbaren Symbole; Linien (3 Zeilen + 2 Diagonalen) mit drei gleichen Familien = Synergie ×2, drei gleiche
// Symbole = Jackpot ×3. Jeder Dreh heizt auf; zu heiß = Überladung (Schaden, Zug vorbei).
import { L } from '../core/i18n';
import { SYM } from './data/symbols';
import { ARCH_OF, constTiers } from './data/constellations';
import { traitsOf } from './data/traits';
import { MOD } from './data/modules';
import { ENEMY, SECTOR } from './data/enemies';
import { track, unlock } from './meta';
import { rngOf } from './rng';
import { runCtx, sectorOf } from './run';
import { Ctx, Foe, Intent, Run, Slot, SymInst, SymbolDef, Tag, Tx } from './types';

export type ReactorEvent =
  | { t: 'hitFoe'; uid: number; n: number; blocked: number; crit: boolean }
  | { t: 'hitHero'; n: number; blocked: number }
  | { t: 'block'; n: number } | { t: 'heal'; n: number }
  | { t: 'fire'; reel: number; row: number; m: number }
  | { t: 'line'; kind: 'synergy' | 'jackpot'; cells: Slot[]; tag: Tag }
  | { t: 'kill'; uid: number; boss: boolean } | { t: 'rad'; uid: number; n: number }
  | { t: 'foeNote'; uid: number; text: string; good: boolean }
  | { t: 'log'; text: string } | { t: 'shake'; n: number } | { t: 'gold'; n: number }
  | { t: 'overheat' } | { t: 'enemyAct'; uid: number } | { t: 'spawn'; uid: number } | { t: 'heat'; n: number };

export interface ReactorUi { emit(e: ReactorEvent): void; pause(ms: number): Promise<void> }

/** Gewinnlinien: 3 Zeilen + 2 Diagonalen (Zellen als [Walze, Zeile]). */
export const LINES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]],
];

/** Zentrale Balance (per tools/sternenfall-sim.ts abgestimmt): Lebenspunkte je Gegnerstufe, Gegnerschaden. */
export const BAL = {
  hp: { normal: 4.65, elite: 3.35, boss: 2.1, minion: 2.4, final: 1.1 } as Record<string, number>,
  dmg: { normal: 2.4, elite: 2.1, boss: 2, minion: 2.2, final: 1.75 } as Record<string, number>,
  foeBlock: 2,
  /** Sanfte Kurve je Sektorstufe 1–4 (Lebenspunkte, Schaden). */
  tierHp: [0.85, 1, 1.12, 1.18, 1.3, 1.22], tierDmg: [1, 1, 1.05, 1, 0.95, 1],
  foeDmg: (id?: string) => (id ? BAL.dmg[ENEMY[id]?.tier] ?? 2 : 2),
};

export class Reactor implements Ctx {
  run: Run; rnd: () => number;
  turn = 0; spin = 0; spinsLeft = 0; heat = 0; heatMax = 6;
  block = 0; str = 0; weak = 0; vuln = 0; rad = 0; jam = 0;
  foes: Foe[] = []; target: Foe | null = null;
  grid: SymInst[][] = [[], [], []];
  offs = [0, 0, 0];                        // Position jeder Walze
  held = [false, false, false];
  /** Geschubste Walzen: bewegen sich beim nächsten Dreh genau um eins (das Vorschau-Symbol rückt ein). */
  nudge = [false, false, false];
  /** Konstellationsstufen 0–3 (aus den Walzen beim Kampfbeginn). */
  cl: Record<string, number> = {};
  powers: Record<string, number> = {};
  over: 'win' | 'lose' | null = null; killedBy = '';
  boss = false;
  tier = 1;
  private groupHp = 1;
  private firing: { sym: SymbolDef; m: number } | null = null;
  private fuid = 1000;
  private rc;

  constructor(run: Run, ids: string[], public ui: ReactorUi, kind: 'fight' | 'elite' | 'boss') {
    this.run = run; this.rnd = rngOf(run); this.rc = runCtx(run);
    this.boss = kind === 'boss';
    this.tier = Math.min(6, Math.max(1, SECTOR[sectorOf(run)]?.tier ?? 1));
    this.groupHp = ids.length >= 3 ? 0.62 : ids.length === 2 ? 0.75 : 1;   // Gruppen: weniger Leben je Mitglied
    for (const id of ids) this.summon(id);
    this.groupHp = 1;
    this.cl = constTiers(run);
    this.heatMax = 6 + run.heatBonus + (this.cl.glut >= 1 ? 2 : 0) - (this.anyTrait('frostaura') ? 1 : 0);
    this.target = this.alive()[0] ?? null;
  }

  // ----------------------------------------------------------------------------------------- RunCtx
  gainGold(n: number) {
    if (n > 0 && this.firing && this.cl.gilde >= 1) {
      n = Math.round(n * 1.4);
      const t = this.target && !this.target.dead ? this.target : this.alive()[0];
      if (t && this.cl.gilde >= 2) this.pure(t, n);   // Gilde II: Gold wird zu Geschossen
    }
    const b = this.run.gold; if (n > 0) for (const f of this.alive()) if (this.has(f, 'goldgierig')) this.pure(f, n); this.rc.gainGold(n); this.ui.emit({ t: 'gold', n: this.run.gold - b }); }
  heal(n: number) { const b = this.run.hp; this.rc.heal(Math.round(n)); if (this.run.hp > b) this.ui.emit({ t: 'heal', n: this.run.hp - b }); }
  addSymbol(id: string, reel?: number, lv?: number) { this.rc.addSymbol(id, reel, lv); }

  /** Hat der Gegner diese Eigenschaft? */
  has(f: Foe, t: string) { return traitsOf(f.id).includes(t); }
  private anyTrait(t: string) { return this.alive().some(f => this.has(f, t)); }
  /** Schaden ohne Zuschläge (Eigenschaften wie Goldgierig, Resonant, Taktgeber). */
  pure(f: Foe, n: number) { if (f.dead || n <= 0) return; f.hp -= n; this.ui.emit({ t: 'hitFoe', uid: f.uid, n, blocked: 0, crit: n >= 15 }); if (f.hp <= 0) this.kill(f); }
  private ramming = false;
  private hitFlags = { all: false, multi: false };

  private mods(f: (m: (typeof MOD)[string]) => void) { for (const id of this.run.modules) { const m = MOD[id]; if (m) f(m); } }
  alive() { return this.foes.filter(f => !f.dead); }

  // ----------------------------------------------------------------------------------------- Ablauf
  start() { this.mods(m => m.onCombatStart?.(this)); this.startTurn(); this.fill(); }

  /** Sichtbares Fenster aus den Walzen füllen (ohne zu feuern). */
  private fill() {
    for (let r = 0; r < 3; r++) {
      const strip = this.run.reels[r];
      this.grid[r] = [0, 1, 2].map(k => strip[(this.offs[r] + k) % strip.length]);
    }
  }

  startTurn() {
    this.turn++; this.spin = 0;
    const keep = Math.max(this.powers.keepBlock ? 0.5 : 0, this.cl.bollwerk >= 3 ? 0.4 : this.cl.bollwerk >= 1 ? 0.2 : 0);
    this.block = Math.floor(this.block * keep);
    this.spinsLeft = 3 + this.run.spinBonus + (this.turn === 1 && this.run.mods.firstSpin ? 1 : 0) + (this.cl.uhrwerk >= 2 ? 1 : 0);
    this.powers._chorJack = 0;
    this.heat = Math.max(0, this.heat - 3 - (this.powers.cool ?? 0) - (this.cl.uhrwerk >= 1 ? 1 : 0));
    if (this.cl.leere >= 2) { const t = this.target && !this.target.dead ? this.target : this.alive()[0]; if (t && !this.has(t, 'unbeugsam')) t.vuln += 1; }
    this.held = [false, false, false]; this.nudge = [false, false, false];
    if (this.rad > 0) { this.hurtSelf(this.rad, true); this.rad--; }
    this.mods(m => m.onTurnStart?.(this));
    for (const f of this.foes) if (!f.dead) f.intent = ENEMY[f.id].next(f, f.turn + 1, this);
    if (this.jam > 0) { this.held[Math.floor(this.rnd() * 3)] = true; this.jam--; this.log(L('Störung: eine Walze klemmt!', 'Jam: one reel is stuck!')); }
  }

  canSpin() { return !this.over && this.spinsLeft > 0; }
  /** Hitze, die der nächste Dreh kostet (Anzeige). */
  spinHeat() {
    const extra = this.held.filter(Boolean).length + this.nudge.filter(Boolean).length;
    return (this.run.mods.noSpinHeat ? 0 : 1) + Math.max(0, extra - (this.cl.uhrwerk >= 1 ? 1 : 0));
  }
  /** Symbol, das beim Schubsen unten einrückt (Vorschau). */
  peek(r: number) { const strip = this.run.reels[r]; return strip[(this.offs[r] + 3) % strip.length]; }

  /** Ein Dreh: nicht gehaltene Walzen bewegen, Hitze, dann feuern. Gibt die neuen Positionen zurück (für die Animation). */
  spinOnce(): number[] {
    if (!this.canSpin()) return this.offs;
    this.spinsLeft--; this.spin++;
    this.run.stats.spins++;
    const heat = this.spinHeat();
    for (let r = 0; r < 3; r++) {
      if (this.nudge[r]) this.offs[r] = (this.offs[r] + 1) % this.run.reels[r].length;
      else if (!this.held[r]) this.offs[r] = Math.floor(this.rnd() * this.run.reels[r].length);
    }
    this.fill();
    this.addHeat(heat);
    if (this.spin >= 3) for (const f of this.alive()) if (this.has(f, 'taktgeber')) this.pure(f, 6);
    if (this.spin >= 3 && this.cl.uhrwerk >= 2) for (const f of this.alive()) this.pure(f, 3 + this.spin);   // Uhrwerk II: der Takt schlägt zu
    return [...this.offs];
  }

  /** Alles im Fenster feuern lassen (nach der Walzen-Animation aufgerufen). */
  async resolve() {
    if (this.over) return;
    if (this.heat > this.heatMax) { this.overheat(); return; }
    // Linien bestimmen → Faktor je Zelle
    const mult = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    for (const line of LINES) {
      const syms = line.map(([r, k]) => this.grid[r][k]);
      const defs = syms.map(s => SYM[s.id]);
      const wild = (d: SymbolDef) => !!d.wild || (this.cl.chor >= 3 && d.tag === 'kosmos');
      const sameId = syms.every(s => s.id === syms[0].id) || (defs.some(d => !d.wild) && syms.every((s, i) => defs[i].wild || s.id === syms[defs.findIndex(d => !d.wild)].id));
      const base = defs.find(d => !wild(d))?.tag ?? 'kosmos';
      const sameTag = defs.every(d => wild(d) || d.tag === base) && base !== 'fluch';
      const cells = line.map(([r, k]) => ({ reel: r, row: k }));
      if (sameId && base !== 'fluch') {
        for (const [r, k] of line) mult[r][k] = Math.max(mult[r][k], 3 + (this.run.mods.lineBonus ?? 0));
        this.ui.emit({ t: 'line', kind: 'jackpot', cells, tag: base });
        this.run.stats.jackpots++; track('jackpots', 1);
        this.mods(m => m.onLine?.(this, 'jackpot', base));
        for (const f of this.alive()) if (this.has(f, 'resonant')) this.pure(f, 15);
        if (this.cl.chor >= 2 && !this.powers._chorJack) { this.powers._chorJack = 1; this.addSpins(1); this.log(L('Himmelschor: +1 Dreh!', 'Celestial Choir: +1 spin!')); }
        if (this.run.stats.jackpots >= 1) unlock('jackpot1');
        await this.ui.pause(450);
      } else if (sameTag) {
        for (const [r, k] of line) mult[r][k] = Math.max(mult[r][k], (this.cl.uhrwerk >= 3 ? 3 : 2) + (this.run.mods.lineBonus ?? 0));
        if (this.cl.chor >= 1) this.heal(1);
        for (const f of this.alive()) if (this.has(f, 'resonant')) this.pure(f, 4);
        this.ui.emit({ t: 'line', kind: 'synergy', cells, tag: base });
        this.run.stats.synergies++; track('synergies', 1);
        this.mods(m => m.onLine?.(this, 'synergy', base));
        await this.ui.pause(250);
      }
    }
    // Symbole feuern: Walze für Walze, oben nach unten
    for (let r = 0; r < 3 && !this.over; r++) for (let k = 0; k < 3 && !this.over; k++) {
      const s = this.grid[r][k], d = SYM[s.id];
      const m = mult[r][k] * (this.powers.boostNext ? 2 : 1);
      if (this.powers.boostNext) this.powers.boostNext = 0;
      this.ui.emit({ t: 'fire', reel: r, row: k, m });
      this.firing = { sym: d, m };
      d.fire?.(this, s.lv, m, { reel: r, row: k });
      this.firing = null;
      this.checkDeaths();
      await this.ui.pause(110);
    }
    this.mods(m => m.onSpin?.(this, this.spin));
    this.held = this.held.map(() => false); this.nudge = this.nudge.map(() => false);
    this.checkDeaths();
  }

  private overheat() {
    this.run.stats.overheats++;
    this.ui.emit({ t: 'overheat' });
    const dmg = 4 + this.heat - this.heatMax + (this.powers.overheatDmg ?? 0);
    this.mods(m => m.onOverheat?.(this));
    if (this.cl.glut >= 3) {
      const n = 12 + 2 * this.heat;
      for (const f of this.alive()) this.hit(f, n);
      this.log(L(`Glutkern: Die Überladung trifft alle Gegner (${n}) – weiter geht’s!`, `Ember Core: the overload hits all enemies (${n}) – keep going!`));
      this.heat = Math.max(0, this.heatMax - 3);
      track('overheats', 1);
      this.checkDeaths();
      return;
    }
    if (!this.powers.overheatImmune) this.hurtSelf(dmg);
    this.log(L(`Überladung! −${dmg} Hülle, der Zug ist vorbei.`, `Overload! −${dmg} hull, your turn ends.`));
    this.heat = this.heatMax;
    this.spinsLeft = 0;
    track('overheats', 1);
  }

  toggleHold(r: number) {
    if (this.spin === 0 || this.over) return false;           // erst nach dem ersten Dreh
    // Frei → Halten → Schubsen → Frei
    if (this.held[r]) { this.held[r] = false; this.nudge[r] = true; }
    else if (this.nudge[r]) this.nudge[r] = false;
    else this.held[r] = true;
    return true;
  }

  async endTurn() {
    if (this.over) return;
    this.mods(m => m.onTurnEnd?.(this));
    if (this.powers.endBlock) this.gainBlock(this.powers.endBlock);
    if (this.cl.bollwerk >= 2 && this.block > 0) {
      const t = this.target && !this.target.dead ? this.target : this.alive()[0];
      const n = Math.floor(this.block * (this.cl.bollwerk >= 3 ? 0.4 : 0.2));
      if (t && n > 0) { this.log(L(`Bollwerk-Rammstoß: ${n}`, `Bulwark ram: ${n}`)); this.ramming = true; this.hit(t, n, true); this.ramming = false; await this.ui.pause(300); }
    }
    this.weak = Math.max(0, this.weak - 1); this.vuln = Math.max(0, this.vuln - 1);
    if (this.checkDeaths()) return;
    for (const f of [...this.foes]) {
      if (f.dead || this.over) continue;
      if (this.has(f, 'regen') && f.hp < f.max) { const g = Math.max(1, Math.round(f.max * 0.06)); f.hp = Math.min(f.max, f.hp + g); this.ui.emit({ t: 'foeNote', uid: f.uid, text: `+${g}`, good: false }); }
      if (f.rad > 0) { const rd = f.rad * (this.cl.isotop >= 3 ? 2 : 1) * (this.has(f, 'strahlempf') ? 2 : 1); f.hp -= rd; this.ui.emit({ t: 'rad', uid: f.uid, n: rd }); if (this.cl.isotop < 2) f.rad--; if (f.hp <= 0) { this.checkDeaths(); await this.ui.pause(220); continue; } }
      f.block = 0; f.turn++;                                   // alter Schild verfällt – Boni aus onTurnStart bleiben
      ENEMY[f.id].onTurnStart?.(f, this);
      if (f.stun > 0) { f.stun--; this.log(L(`${ENEMY[f.id].name[0]} ist in Stase.`, `${ENEMY[f.id].name[1]} is in stasis.`)); await this.ui.pause(300); continue; }
      this.ui.emit({ t: 'enemyAct', uid: f.uid });
      await this.ui.pause(240);
      this.doIntent(f, f.intent);
      f.weak = Math.max(0, f.weak - 1); f.vuln = Math.max(0, f.vuln - 1);
      await this.ui.pause(360);
      if (this.over) return;
    }
    this.checkDeaths();
    if (!this.over) this.startTurn();
  }

  private doIntent(f: Foe, it: Intent) {
    switch (it.k) {
      case 'atk': for (let k = 0; k < (it.times ?? 1) && !this.over; k++) this.foeHits(f, it.n); break;
      case 'block': f.block += Math.round(it.n * BAL.foeBlock); break;
      case 'buff': f.str += it.str; break;
      case 'debuff': this.weak += it.weak ?? 0; this.vuln += it.vuln ?? 0; this.jam += it.jam ?? 0; break;
      case 'rad': this.rad += it.n; break;
      case 'heat': this.addHeat(it.n); this.log(L(`Dein Reaktor heizt sich um ${it.n} auf!`, `Your reactor heats up by ${it.n}!`)); break;
      case 'junk': {
        const r = Math.floor(this.rnd() * 3);
        this.run.reels[r].push({ uid: this.run.uid++, id: it.id, lv: 1 });
        this.log(L(`${SYM[it.id].name[0]} verirrt sich in Walze ${r + 1}.`, `${SYM[it.id].name[1]} lands on reel ${r + 1}.`));
        break;
      }
      case 'summon': if (this.alive().length < 4) this.summon(it.id); break;
      case 'heal': f.hp = Math.min(f.max, f.hp + it.n); break;
      case 'special': ENEMY[f.id].special?.(f, this); break;
    }
  }

  foeHits(f: Foe | null, base: number) {
    let n = (base + (f?.str ?? 0)) * BAL.foeDmg(f?.id) * BAL.tierDmg[this.tier - 1];
    if (f && f.weak > 0) n *= this.has(f, 'leitend') ? 0.5 : 0.75;
    if (this.vuln > 0) n *= 1.5;
    n *= 1 + (this.run.mods.taken ?? 0) + this.run.ascension * 0.04;
    n = Math.max(0, Math.floor(n));
    const breaker = !!f && this.has(f, 'schildbrecher');
    const blocked = Math.min(breaker ? Math.floor(this.block / 2) : this.block, n);
    this.block = Math.max(0, this.block - (breaker ? blocked * 2 : blocked));
    const dmg = n - blocked;
    this.run.hp -= dmg;
    if (dmg > 0 && f && this.has(f, 'langfinger') && this.run.gold > 0) { this.rc.gainGold(-4); this.ui.emit({ t: 'gold', n: -4 }); }
    this.ui.emit({ t: 'hitHero', n: dmg, blocked });
    if (dmg > 0 && f && this.powers.thorns) this.hit(f, this.powers.thorns, true);
    if (this.run.hp <= 0) this.die(f ? L(ENEMY[f.id].name[0], ENEMY[f.id].name[1]) : '');
  }

  private die(by: string) {
    if (this.run.mods.phoenix) {
      this.run.mods.phoenix = 0; this.run.hp = Math.round(this.run.maxHp / 2);
      this.log(L('Die Rettungskapsel zündet – du lebst!', 'The escape pod fires – you live!')); this.ui.emit({ t: 'heal', n: this.run.hp });
      return;
    }
    this.run.hp = 0; this.over = 'lose'; this.killedBy = by;
  }

  // ----------------------------------------------------------------------------------------- Wirkungen
  dmg(n: number, o: { all?: boolean; times?: number; pierce?: boolean; foe?: Foe; random?: boolean } = {}) {
    const f = this.firing;
    const arch = f ? ARCH_OF[f.sym.id] : undefined;
    if (f && f.sym.tag === 'waffe' && this.cl.glut >= 2 && !this.anyTrait('frostaura')) n += this.heat;
    if (f && this.cl.gilde >= 2) n += Math.min(8, Math.floor(this.run.gold / 25));
    const swarm = arch === 'schwarm' && ((o.times ?? 1) > 1 || o.random || o.all);
    if (swarm && this.cl.schwarm >= 1) n += 1;
    if (swarm && this.cl.schwarm >= 2 && (o.times ?? 1) > 1) o = { ...o, times: (o.times ?? 1) + 1 };
    let base = n + (f && f.sym.tag === 'waffe' ? this.str : 0);
    if (f) base *= f.m;
    for (const id of this.run.modules) { const md = MOD[id]?.modDamage; if (md) base = md(this, base, f?.sym); }
    if (this.weak > 0) base *= 0.75;
    base *= this.run.mods.dmgMult ?? 1;
    let total = 0;
    this.hitFlags = { all: !!o.all, multi: !!o.random || (o.times ?? 1) > 1 };
    for (let k = 0; k < (o.times ?? 1); k++) {
      const alive = this.alive();
      if (!alive.length) break;
      const ts = o.all ? alive : [o.foe && !o.foe.dead ? o.foe : o.random ? alive[Math.floor(this.rnd() * alive.length)] : this.target && !this.target.dead ? this.target : alive[0]];
      for (const t of ts) { total += this.hit(t, base, o.pierce); if (arch === 'schwarm' && this.cl.schwarm >= 3) this.block += 1; }
    }
    this.hitFlags = { all: false, multi: false };
    return total;
  }

  private hit(f: Foe, n: number, pierce = false) {
    let d = n;
    const mine = !!this.firing || this.ramming;
    if (mine && this.hitFlags.multi && this.has(f, 'ausweichend') && this.rnd() < 0.35) { this.ui.emit({ t: 'foeNote', uid: f.uid, text: L('verfehlt', 'miss'), good: false }); return 0; }
    if (this.firing && (f.weak > 0 || f.vuln > 0) && this.cl.leere >= 1) d += 4;
    if (f.vuln > 0) d *= this.has(f, 'leitend') ? 2 : 1.5;
    if (mine && this.hitFlags.all && this.has(f, 'aufgeblaeht')) d *= 2;
    if (mine && pierce && this.has(f, 'instabil')) d *= 2;
    if (mine && d >= 15 && this.has(f, 'sproede')) d *= 1.5;
    if (mine && this.has(f, 'panzer')) d = Math.max(0, d - 3);
    if (this.firing && f.weak > 0 && f.vuln > 0 && this.cl.leere >= 3) d *= 2;
    const def = ENEMY[f.id];
    if (def.modTaken) d = def.modTaken(f, d, this, this.firing?.sym);
    d = Math.max(0, Math.floor(d));
    const blocked = pierce ? 0 : Math.min(f.block, d);
    f.block -= blocked;
    const real = d - blocked;
    f.hp -= real;
    if (mine && real > 0 && this.has(f, 'dornen')) this.hurtSelf(1);
    this.run.stats.dmg += real;
    if (real > this.run.stats.maxHit) { this.run.stats.maxHit = real; track('maxHit', real, true); }
    if (real >= 80) unlock('hit80');
    this.ui.emit({ t: 'hitFoe', uid: f.uid, n: real, blocked, crit: (this.firing?.m ?? 1) >= 3 || real >= 25 });
    def.onHurt?.(f, this);
    if (f.hp <= 0 && !f.dead) this.kill(f);
    return real;
  }

  private kill(f: Foe) {
    f.dead = true; f.hp = 0;
    const def = ENEMY[f.id];
    def.onDeath?.(f, this);
    if (def.tier !== 'minion') { this.run.stats.kills++; track('kills', 1); }
    this.mods(m => m.onKill?.(this));
    this.ui.emit({ t: 'kill', uid: f.uid, boss: def.tier === 'boss' || def.tier === 'final' });
    if (this.target === f) this.target = this.alive()[0] ?? null;
  }

  checkDeaths() {
    for (const f of this.foes) if (!f.dead && f.hp <= 0) this.kill(f);
    if (this.over) return true;
    if (!this.alive().length) {
      this.over = 'win';
      if (this.cl.gilde >= 3) { const z = Math.min(40, Math.floor(this.run.gold * 0.1)); if (z > 0) { this.gainGold(z); this.log(L(`Gildenzinsen: +${z}`, `Guild interest: +${z}`)); } }
      return true;
    }
    return false;
  }

  gainBlock(n: number) {
    let b = n;
    if (this.firing) b *= this.firing.m;
    b = Math.max(0, Math.floor(b));
    this.block += b;
    this.ui.emit({ t: 'block', n: b });
  }
  irradiate(n: number, all = false) {
    const add = Math.floor(n * (this.firing?.m ?? 1)) + (this.powers.radPlus ?? 0) + (this.cl.isotop >= 1 ? 2 : 0);
    const ts = all ? this.alive() : [this.target && !this.target.dead ? this.target : this.alive()[0]].filter(Boolean) as Foe[];
    for (const f of ts) { if (this.has(f, 'strahlfest')) { this.ui.emit({ t: 'foeNote', uid: f.uid, text: L('immun', 'immune'), good: false }); continue; } f.rad += add; this.ui.emit({ t: 'rad', uid: f.uid, n: -add }); }
  }
  weaken(n: number, all = false) { n += this.cl.leere >= 2 ? 1 : 0; for (const f of all ? this.alive() : [this.target ?? this.alive()[0]].filter(Boolean) as Foe[]) if (!this.has(f, 'unbeugsam')) f.weak += n; }
  expose(n: number, all = false) { n += this.cl.leere >= 2 ? 1 : 0; for (const f of all ? this.alive() : [this.target ?? this.alive()[0]].filter(Boolean) as Foe[]) if (!this.has(f, 'unbeugsam')) f.vuln += n; }
  stun(n: number) { const f = this.target && !this.target.dead ? this.target : this.alive()[0]; if (f && ENEMY[f.id].tier !== 'boss' && ENEMY[f.id].tier !== 'final' && !this.has(f, 'unbeugsam')) f.stun += n; }
  addHeat(n: number) { this.heat = Math.max(0, this.heat + n); this.ui.emit({ t: 'heat', n }); }
  hurtSelf(n: number, rad = false) {
    if (n <= 0) return;
    this.run.hp -= n;
    this.ui.emit({ t: 'hitHero', n, blocked: 0 });
    if (this.run.hp <= 0) this.die(rad ? L('Strahlung', 'Radiation') : L('Reaktor', 'Reactor'));
  }
  addSpins(n: number) { this.spinsLeft += n; }
  neighbors(at: Slot) {
    const out: SymInst[] = [];
    for (const [dr, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const r = at.reel + dr, k = at.row + dk; if (r >= 0 && r < 3 && k >= 0 && k < 3) out.push(this.grid[r][k]); }
    return out;
  }
  count(pred: (s: SymInst, d: SymbolDef) => boolean) { let n = 0; for (const col of this.grid) for (const s of col) if (pred(s, SYM[s.id])) n++; return n; }
  dice() { return Math.min(6, 1 + Math.floor(this.rnd() * 6) + (this.powers.luck ?? 0)); }
  log(t: Tx | string) { this.ui.emit({ t: 'log', text: typeof t === 'string' ? t : L(t[0], t[1]) }); }
  summon(id: string, hp?: number): Foe | null {
    const d = ENEMY[id]; if (!d) return null;
    const big = (d.tier === 'boss' || d.tier === 'final') ? 1 + (this.run.mods.bossHp ?? 0) : 1;
    const scale = (1 + this.run.ascension * 0.08 + (this.run.mods.foeHp ?? 0)) * big * (BAL.hp[d.tier] ?? 1) * BAL.tierHp[this.tier - 1] * this.groupHp;
    const base = d.hp[0] + Math.floor(this.rnd() * (d.hp[1] - d.hp[0] + 1));
    const max = hp ?? Math.round(base * scale);
    const f: Foe = { uid: this.fuid++, id, hp: max, max, block: 0, str: 0, weak: 0, vuln: 0, rad: 0, stun: 0, intent: { k: 'block', n: 0 }, turn: 0, dead: false, mem: {} };
    this.foes.push(f);
    f.intent = d.next(f, 1, this);
    d.onSpawn?.(f, this);
    this.ui.emit({ t: 'spawn', uid: f.uid });
    return f;
  }
  fx(kind: string, a?: any): any {
    switch (kind) {
      case 'mult': return this.firing?.m ?? 1;
      case 'shake': this.ui.emit({ t: 'shake', n: a ?? 1 }); return;
      case 'enemyHit': { const b = this.alive()[0] ?? null; for (let k = 0; k < (a?.times ?? 1); k++) this.foeHits(b, a?.n ?? 5); return; }
    }
  }
}

export function goldFor(kind: 'fight' | 'elite' | 'boss', r: () => number) {
  return kind === 'boss' ? 70 + Math.floor(r() * 20) : kind === 'elite' ? 30 + Math.floor(r() * 12) : 14 + Math.floor(r() * 10);
}
