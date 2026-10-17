// Kampf-Engine. Kern-Mechanik: Jede Karte addiert ihre Zahl zur Zugsumme. Wird die Summe eine Primzahl, steigt die Kombo
// und die Karte wirkt ×(1 + 0,25·Kombo); sonst bricht die Kombo ab. Die Engine rechnet synchron; die Oberfläche hört über
// emit() mit (Schadenszahlen, Schütteln, Partikel) und wartet beim Gegnerzug über pause().
import { CARD } from './data/cards';
import { RELIC } from './data/relics';
import { ENEMY } from './data/enemies';
import { meta, track, unlock } from './meta';
import { isPrime, rngOf, shuffle } from './rng';
import { runCtx } from './run';
import { CardDef, CardInst, Ctx, Foe, Intent, Run, Tx } from './types';
import { L } from '../core/i18n';

export type CombatEvent =
  | { t: 'hitFoe'; uid: number; n: number; blocked: number; crit: boolean }
  | { t: 'hitHero'; n: number; blocked: number }
  | { t: 'block'; n: number } | { t: 'heal'; n: number }
  | { t: 'prime'; sum: number; combo: number } | { t: 'nonprime'; sum: number }
  | { t: 'kill'; uid: number; boss: boolean } | { t: 'poison'; uid: number; n: number }
  | { t: 'log'; text: string } | { t: 'shake'; n: number } | { t: 'jackpot' } | { t: 'gold'; n: number }
  | { t: 'enemyAct'; uid: number } | { t: 'spawn'; uid: number } | { t: 'played'; uid: number };

export interface CombatUi { emit(e: CombatEvent): void; pause(ms: number): Promise<void> }

const HAND_MAX = 10;

export class Combat implements Ctx {
  run: Run;
  turn = 0; energy = 0; block = 0;
  str = 0; dex = 0; weak = 0; vuln = 0; frail = 0; poisonSelf = 0;
  sum = 0; combo = 0; primeNow = false;
  foes: Foe[] = [];
  target: Foe | null = null;
  hand: CardInst[] = []; draw: CardInst[] = []; discard: CardInst[] = []; exhausted: CardInst[] = [];
  last: CardInst | null = null;
  powers: Record<string, number> = {};
  over: 'win' | 'lose' | null = null;
  killedBy = '';
  boss = false; elite = false;
  rnd: () => number;
  private playing: { inst: CardInst; def: CardDef; mult: number } | null = null;
  private fuid = 1000;
  private rc;

  constructor(run: Run, ids: string[], public ui: CombatUi, kind: 'fight' | 'elite' | 'boss') {
    this.run = run;
    this.rc = runCtx(run);
    this.rnd = rngOf(run);
    this.boss = kind === 'boss'; this.elite = kind === 'elite';
    for (const id of ids) this.summon(id);
    this.draw = shuffle(this.rnd, run.deck.map(c => ({ ...c })));
  }

  // ----------------------------------------------------------------------------------------- RunCtx
  gainGold(n: number) { const before = this.run.gold; this.rc.gainGold(n); this.ui.emit({ t: 'gold', n: this.run.gold - before }); }
  heal(n: number) { const b = this.run.hp; this.rc.heal(n); if (this.run.hp > b) this.ui.emit({ t: 'heal', n: this.run.hp - b }); }
  addCard(id: string, up?: boolean) { this.rc.addCard(id, up); }

  // ----------------------------------------------------------------------------------------- Ablauf
  start() {
    this.relics(r => r.onCombatStart?.(this));
    this.startTurn();
  }

  private relics(f: (r: (typeof RELIC)[string]) => void) { for (const id of this.run.relics) { const r = RELIC[id]; if (r) f(r); } }

  startTurn() {
    this.turn++;
    // Restblock: Zerrspiegel behält die Hälfte
    this.block = this.run.relics.includes('spiegel') ? Math.floor(this.block / 2) : 0;
    this.energy = 3 + this.run.energyBonus;
    this.sum = this.powers.crown ? 2 : 0;
    this.combo = 0;
    if (this.poisonSelf > 0) { this.hurtSelf(this.poisonSelf, true); this.poisonSelf--; }
    this.relics(r => r.onTurnStart?.(this));
    this.drawCards(5 + this.run.drawBonus);
    for (const f of this.foes) if (!f.dead) f.intent = this.intentFor(f);
  }

  private intentFor(f: Foe): Intent { return ENEMY[f.id].next(f, f.turn + 1, this); }

  canPlay(i: number) {
    const c = this.hand[i]; if (!c || this.over) return false;
    const d = CARD[c.id];
    if (d.unplayable) return false;
    return this.costOf(c) <= this.energy;
  }
  costOf(c: CardInst) { return this.powers.free ? 0 : Math.max(0, CARD[c.id].cost(c.up)); }
  needsTarget(i: number) { return !!CARD[this.hand[i]?.id]?.target && this.alive().length > 1; }
  alive() { return this.foes.filter(f => !f.dead); }
  isPrimeSum(n: number) { return isPrime(n) || (!!this.powers.euklid && n > 1 && n % 2 === 1); }

  /** Karte spielen. Gibt false zurück, wenn es nicht geht. */
  play(i: number, targetUid?: number) {
    if (!this.canPlay(i)) return false;
    const inst = this.hand[i], def = CARD[inst.id];
    this.target = this.foes.find(f => f.uid === targetUid && !f.dead) ?? this.alive()[0] ?? null;
    this.energy -= this.costOf(inst);
    if (this.powers.free) this.powers.free = 0;
    this.hand.splice(i, 1);
    // Zugsumme + Kombo
    const ns = this.sum + inst.val;
    const prime = this.isPrimeSum(ns);
    if (prime) { this.combo++; this.powers.primesHit = (this.powers.primesHit ?? 0) + 1; }
    else if (!this.run.mods.keepCombo) this.combo = 0;
    this.sum = ns;
    this.primeNow = prime;
    const step = this.run.mods.comboStep ?? 0.25;
    const mult = prime ? 1 + step * this.combo : 1;
    this.ui.emit(prime ? { t: 'prime', sum: ns, combo: this.combo } : { t: 'nonprime', sum: ns });
    this.ui.emit({ t: 'played', uid: inst.uid });
    this.playing = { inst, def, mult };
    const times = this.powers.double ? 2 : 1;
    this.powers.double = 0;
    for (let k = 0; k < times; k++) def.play?.(this, inst.up);
    this.playing = null;
    if (prime) {
      this.relics(r => r.onPrime?.(this, ns, this.combo));
      if (this.powers.primDraw) this.drawCards(this.powers.primDraw);
      if (this.powers.restk) this.poison(this.combo * this.powers.restk, true);
      this.run.stats.maxCombo = Math.max(this.run.stats.maxCombo, this.combo);
      track('primes', 1); track('maxCombo', this.combo, true);
      if (this.combo >= 5) unlock('combo5');
      if (this.combo >= 8) unlock('combo8');
    }
    this.relics(r => r.onCardPlayed?.(this, inst, def));
    this.run.stats.cards++; track('cards', 1);
    if (def.type === 'power' || def.exhaust) this.exhausted.push(inst); else this.discard.push(inst);
    this.last = inst;
    this.primeNow = false;
    this.checkDeaths();
    return true;
  }

  async endTurn() {
    if (this.over) return;
    // Flüche auf der Hand
    for (const c of this.hand) CARD[c.id].endTurn?.(this);
    if (this.powers.mauer) this.gainBlock(this.powers.mauer);
    this.relics(r => r.onTurnEnd?.(this));
    const keep = this.hand.filter(c => CARD[c.id].retain);
    this.discard.push(...this.hand.filter(c => !CARD[c.id].retain));
    this.hand = keep;
    this.weak = Math.max(0, this.weak - 1); this.vuln = Math.max(0, this.vuln - 1); this.frail = Math.max(0, this.frail - 1);
    if (this.checkDeaths()) return;
    // Gegnerzug
    for (const f of [...this.foes]) {
      if (f.dead || this.over) continue;
      if (f.poison > 0) {
        f.hp -= f.poison; this.ui.emit({ t: 'poison', uid: f.uid, n: f.poison }); f.poison--;
        if (f.hp <= 0) { this.checkDeaths(); await this.ui.pause(260); continue; }
      }
      ENEMY[f.id].onTurnStart?.(f, this);
      f.block = 0;
      f.turn++;
      this.ui.emit({ t: 'enemyAct', uid: f.uid });
      await this.ui.pause(220);
      this.doIntent(f, f.intent);
      f.weak = Math.max(0, f.weak - 1); f.vuln = Math.max(0, f.vuln - 1);
      await this.ui.pause(380);
      if (this.over) return;
    }
    this.checkDeaths();
    if (!this.over) this.startTurn();
  }

  private doIntent(f: Foe, it: Intent) {
    const def = ENEMY[f.id];
    switch (it.k) {
      case 'atk': for (let k = 0; k < (it.times ?? 1) && !this.over; k++) this.foeHits(f, it.n); break;
      case 'block': f.block += it.n; break;
      case 'buff': f.str += it.str; break;
      case 'debuff': this.weak += it.weak ?? 0; this.vuln += it.vuln ?? 0; this.frail += it.frail ?? 0; break;
      case 'poison': this.poisonSelf += it.n; break;
      case 'curse': this.discard.push({ uid: this.run.uid++, id: it.card, up: false, val: 0 }); this.log(L(`${CARD[it.card].name[0]} landet in deinem Ablagestapel.`, `${CARD[it.card].name[1]} lands in your discard pile.`)); break;
      case 'summon': if (this.alive().length < 5) this.summon(it.id); break;
      case 'heal': f.hp = Math.min(f.max, f.hp + it.n); break;
      case 'special': def.special?.(f, this); break;
    }
  }

  /** Gegner trifft den Spieler. */
  foeHits(f: Foe | null, base: number) {
    let n = base + (f?.str ?? 0);
    if (f && f.weak > 0) n *= 0.75;
    if (this.vuln > 0) n *= 1.5;
    n *= 1 + (this.run.mods.taken ?? 0) + this.run.ascension * 0.05;
    n = Math.max(0, Math.floor(n));
    const blocked = Math.min(this.block, n);
    this.block -= blocked;
    const dmg = n - blocked;
    this.run.hp -= dmg;
    this.ui.emit({ t: 'hitHero', n: dmg, blocked });
    if (dmg > 0 && f && this.run.relics.includes('dorn')) this.hitFoe(f, 3, true);
    if (this.run.hp <= 0) this.die(f ? L(ENEMY[f.id].name[0], ENEMY[f.id].name[1]) : '');
  }

  private die(by: string) {
    if (this.run.mods.phoenix) {
      this.run.mods.phoenix = 0; this.run.hp = Math.round(this.run.maxHp / 2);
      this.log(L('🔥 Die Phönixzahl erhebt dich!', '🔥 The Phoenix Number revives you!')); this.ui.emit({ t: 'heal', n: this.run.hp });
      return;
    }
    this.run.hp = 0; this.over = 'lose'; this.killedBy = by;
  }

  // ----------------------------------------------------------------------------------------- Ctx – Wirkungen
  dmg(n: number, o: { all?: boolean; times?: number; pierce?: boolean; foe?: Foe } = {}) {
    const p = this.playing;
    let base = n;
    if (p) {
      if (p.def.type === 'atk') base += this.str;
      base *= p.mult;
    }
    for (const id of this.run.relics) { const f = RELIC[id]?.modDamage; if (f && p) base = f(this, base, p.def); }
    if (this.weak > 0 && p) base *= 0.75;
    let total = 0;
    const targets = o.all ? this.alive() : [o.foe ?? (this.target && !this.target.dead ? this.target : this.alive()[0])].filter(Boolean) as Foe[];
    for (let k = 0; k < (o.times ?? 1); k++)
      for (const f of targets) if (!f.dead) total += this.hitFoe(f, base, o.pierce, p?.mult ? p.mult > 1 : false);
    return total;
  }

  private hitFoe(f: Foe, n: number, pierce = false, crit = false) {
    let d = n;
    if (f.vuln > 0) d *= 1.5;
    const def = ENEMY[f.id];
    if (def.modTaken) d = def.modTaken(f, d, this, this.playing?.def);
    d = Math.max(0, Math.floor(d));
    const blocked = pierce ? 0 : Math.min(f.block, d);
    f.block -= blocked;
    const real = d - blocked;
    f.hp -= real;
    this.run.stats.dmg += real;
    if (real > this.run.stats.maxHit) { this.run.stats.maxHit = real; track('maxHit', real, true); }
    if (real >= 100) unlock('hit100');
    this.ui.emit({ t: 'hitFoe', uid: f.uid, n: real, blocked, crit: crit || real >= 30 });
    def.onHurt?.(f, this);
    if (f.hp <= 0 && !f.dead) this.kill(f);
    return real;
  }

  private kill(f: Foe) {
    f.dead = true; f.hp = 0;
    const def = ENEMY[f.id];
    def.onDeath?.(f, this);
    if (def.tier !== 'minion') { this.run.stats.kills++; track('kills', 1); }
    this.relics(r => r.onKill?.(this));
    this.ui.emit({ t: 'kill', uid: f.uid, boss: def.tier === 'boss' });
  }

  /** Gibt true zurück, wenn der Kampf vorbei ist. */
  checkDeaths() {
    for (const f of this.foes) if (!f.dead && f.hp <= 0) this.kill(f);
    if (this.over) return true;
    if (!this.alive().length) { this.over = 'win'; return true; }
    return false;
  }

  gainBlock(n: number) {
    let b = n + this.dex;
    if (this.playing) b *= this.playing.mult;
    if (this.frail > 0) b *= 0.75;
    b = Math.max(0, Math.floor(b));
    this.block += b;
    this.ui.emit({ t: 'block', n: b });
  }

  drawCards(n: number) {
    for (let k = 0; k < n; k++) {
      if (this.hand.length >= HAND_MAX) break;
      if (!this.draw.length) { if (!this.discard.length) break; this.draw = shuffle(this.rnd, this.discard); this.discard = []; }
      const c = this.draw.pop()!;
      if (CARD[c.id].val === 'rand') c.val = this.rollVal();
      this.hand.push(c);
    }
  }

  private rollVal() {
    let v = 1 + Math.floor(this.rnd() * 9);
    if (v < 3 && this.run.relics.includes('wuerfelbecher')) v = 1 + Math.floor(this.rnd() * 9);
    return Math.min(9, v + (this.powers.luck ?? 0));
  }

  gainEnergy(n: number) { this.energy = Math.max(0, this.energy + n); }

  poison(n: number, all = false) {
    const add = n + (this.powers.viru ?? 0);
    const ts = all ? this.alive() : [this.target && !this.target.dead ? this.target : this.alive()[0]].filter(Boolean) as Foe[];
    for (const f of ts) { f.poison += add; this.ui.emit({ t: 'poison', uid: f.uid, n: -add }); }
  }
  weaken(n: number, all = false) { for (const f of all ? this.alive() : [this.target ?? this.alive()[0]].filter(Boolean) as Foe[]) f.weak += n; }
  expose(n: number, all = false) { for (const f of all ? this.alive() : [this.target ?? this.alive()[0]].filter(Boolean) as Foe[]) f.vuln += n; }

  hurtSelf(n: number, poison = false) {
    if (n <= 0) return;
    this.run.hp -= n;
    this.ui.emit({ t: 'hitHero', n, blocked: 0 });
    if (this.run.hp <= 0) this.die(poison ? L('Zerfall', 'Decay') : L('eigene Hand', 'your own hand'));
  }

  addToHand(id: string, up = false) { if (this.hand.length < HAND_MAX) this.hand.push({ uid: this.run.uid++, id, up, val: CARD[id].val === 'rand' ? this.rollVal() : (CARD[id].val as number) }); }
  setSum(n: number) { this.sum = n; }
  addSum(n: number) { this.sum += n; }

  dice() {
    let d = 1 + Math.floor(this.rnd() * 6);
    if (d < 3 && this.run.relics.includes('wuerfelbecher')) d = 1 + Math.floor(this.rnd() * 6);
    return Math.min(6, d + (this.powers.luck ?? 0));
  }

  log(t: Tx | string) { this.ui.emit({ t: 'log', text: typeof t === 'string' ? t : L(t[0], t[1]) }); }

  summon(id: string, hp?: number): Foe | null {
    const d = ENEMY[id];
    if (!d) return null;
    const asc = 1 + this.run.ascension * 0.1 + (this.run.mods.foeHp ?? 0);
    const base = d.hp[0] + Math.floor(this.rnd() * (d.hp[1] - d.hp[0] + 1));
    const max = hp ?? Math.round(base * asc * (1 + (this.run.act - d.act) * 0.25));
    const f: Foe = { uid: this.fuid++, id, hp: max, max, block: 0, str: 0, weak: 0, vuln: 0, poison: 0, intent: { k: 'block', n: 0 }, turn: 0, dead: false, mem: {} };
    this.foes.push(f);
    f.intent = this.intentFor(f);
    d.onSpawn?.(f, this);
    this.ui.emit({ t: 'spawn', uid: f.uid });
    return f;
  }

  fx(kind: string, a?: any): any {
    switch (kind) {
      case 'wasPrime': return this.primeNow;
      case 'val': return this.playing?.inst.val ?? 0;
      case 'cardPrime': return this.playing ? isPrime(this.playing.inst.val) : true;
      case 'combo': this.combo += a ?? 1; this.run.stats.maxCombo = Math.max(this.run.stats.maxCombo, this.combo); return;
      case 'replay': {
        const l = this.last; if (!l) return;
        const d = CARD[l.id]; if (!d.play || l.id === 'kopie') return;
        const keep = this.playing; this.playing = { inst: l, def: d, mult: keep?.mult ?? 1 };
        d.play(this, l.up); this.playing = keep; return;
      }
      case 'sieve': {
        const bad = this.hand.filter(c => !isPrime(c.val) && !CARD[c.id].retain);
        this.hand = this.hand.filter(c => !bad.includes(c)); this.discard.push(...bad);
        this.drawCards(bad.length); return;
      }
      case 'reroll': for (const c of this.hand) if (CARD[c.id].val === 'rand') { c.val = this.rollVal(); if (a === 2) c.val = Math.max(c.val, this.rollVal()); } return;
      case 'jackpot': this.ui.emit({ t: 'jackpot' }); return;
      case 'shake': this.ui.emit({ t: 'shake', n: a ?? 1 }); return;
      case 'enemyHit': { const boss = this.alive()[0] ?? null; for (let k = 0; k < (a?.times ?? 1); k++) this.foeHits(boss, a?.n ?? 5); return; }
      case 'revive': this.ui.emit({ t: 'spawn', uid: a?.uid ?? 0 }); return;
    }
  }
}

/** Belohnungsgold je Kampfart. */
export function goldFor(kind: 'fight' | 'elite' | 'boss', r: () => number) {
  return kind === 'boss' ? 70 + Math.floor(r() * 20) : kind === 'elite' ? 28 + Math.floor(r() * 12) : 12 + Math.floor(r() * 10);
}
export { meta };
