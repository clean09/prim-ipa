// STERNENFALL – Datentypen. Alle Inhalte (Symbole, Module, Gegner, Sektoren, Ereignisse, Schiffe, Freischaltungen)
// sind Daten in src/rogue/data/*.ts. Neuer Inhalt = neuer Eintrag; die Spiellogik muss dafür nicht angefasst werden.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Tx = [string, string];                       // [Deutsch, English]
/** Symbol-Familien: drei gleiche Familien auf einer Linie = Synergie. */
export type Tag = 'waffe' | 'schild' | 'technik' | 'kosmos' | 'fluch';

// ------------------------------------------------------------------------------------------- Symbole (die „Karten“)
export interface SymbolDef {
  id: string;
  name: Tx;
  tag: Tag;
  rarity: Rarity;
  /** Kunstmotiv (art.ts) + zwei Farben → jede Karte hat ihr eigenes Bild */
  art: string; c1: string; c2: string;
  /** Text je Stufe (1…3) */
  text: (lv: number) => Tx;
  /** Wirkung bei jedem Erscheinen im 3×3-Fenster; m = Linienfaktor (1, 2 Synergie, 3 Jackpot) */
  fire?: (g: Ctx, lv: number, m: number, at: Slot) => void;
  /** zählt als jede Familie (Wurmloch) */
  wild?: boolean;
  /** nie im Angebot (Startsymbole, Schrott) */
  noOffer?: boolean;
  /** Freischaltung nötig (Forschungsbaum) */
  pack?: string;
}
export interface SymInst { uid: number; id: string; lv: number }
export interface Slot { reel: number; row: number }

// ------------------------------------------------------------------------------------------- Module (Relikte)
export interface ModuleDef {
  id: string; name: Tx; icon: string; rarity: Rarity | 'start' | 'boss';
  cursed?: boolean; text: Tx; pack?: string;
  onRunStart?: (r: RunCtx) => void;
  onCombatStart?: (c: Ctx) => void;
  onTurnStart?: (c: Ctx) => void;
  onTurnEnd?: (c: Ctx) => void;
  /** nach jedem Dreh (n = wievielter Dreh in diesem Zug) */
  onSpin?: (c: Ctx, n: number) => void;
  onLine?: (c: Ctx, kind: 'synergy' | 'jackpot', tag: Tag) => void;
  onKill?: (c: Ctx) => void;
  onOverheat?: (c: Ctx) => void;
  onCombatEnd?: (r: RunCtx, won: boolean) => void;
  modDamage?: (c: Ctx, dmg: number, sym?: SymbolDef) => number;
  modGold?: (n: number) => number;
}

// ------------------------------------------------------------------------------------------- Gegner
export type Intent =
  | { k: 'atk'; n: number; times?: number }
  | { k: 'block'; n: number }
  | { k: 'buff'; str: number }
  | { k: 'debuff'; weak?: number; vuln?: number; jam?: number }
  | { k: 'rad'; n: number }
  | { k: 'heat'; n: number }
  | { k: 'junk'; id: string }
  | { k: 'summon'; id: string }
  | { k: 'heal'; n: number }
  | { k: 'special'; name: Tx; icon: string };

export type LookKind = 'jaeger' | 'kreatur' | 'kristall' | 'schwarm' | 'mech' | 'auge' | 'qualle' | 'wurm' | 'boss';
export interface EnemyDef {
  id: string; name: Tx;
  /** Aussehen: Archetyp + Seed für den Generator (art.ts); Bosse haben eigene Motive (boss) */
  look: { kind: LookKind; seed: number; hue: number; boss?: string };
  hp: [number, number];
  tier: 'normal' | 'elite' | 'boss' | 'minion' | 'final';
  next: (e: Foe, turn: number, c: Ctx) => Intent;
  passive?: Tx;
  onSpawn?: (e: Foe, c: Ctx) => void;
  modTaken?: (e: Foe, dmg: number, c: Ctx, sym?: SymbolDef) => number;
  onDeath?: (e: Foe, c: Ctx) => void;
  onTurnStart?: (e: Foe, c: Ctx) => void;
  onHurt?: (e: Foe, c: Ctx) => void;
  special?: (e: Foe, c: Ctx) => void;
}
export interface Foe {
  uid: number; id: string; hp: number; max: number; block: number;
  str: number; weak: number; vuln: number; rad: number; stun: number;
  intent: Intent; turn: number; dead: boolean; mem: Record<string, number>;
}

export interface SectorDef {
  id: string; name: Tx; text: Tx; tier: 1 | 2 | 3 | 4;
  /** Hintergrund: zwei Farben + Motiv */
  bg: [string, string]; theme: 'asteroiden' | 'eis' | 'nebel' | 'pulsar' | 'horizont' | 'kern' | 'rand';
  easy: string[][]; hard: string[][]; elite: string[][]; bosses: string[];
  pack?: string;
}

// ------------------------------------------------------------------------------------------- Ereignisse
export interface Outcome {
  gold?: number; hp?: number; maxHp?: number; staub?: number;
  card?: 'random' | 'rare' | 'epic' | string;
  relic?: 'common' | 'rare' | 'epic' | 'legendary' | 'cursed' | string;
  curse?: boolean | string;
  removeCard?: boolean; upgradeCard?: boolean;
  fight?: 'normal' | 'elite';
}
export interface EventOption {
  label: Tx;
  need?: { gold?: number; hp?: number };
  check?: { chance: number; raise?: { cost: 'gold' | 'hp'; per: number; add: number; max: number } };
  win: Outcome[]; lose?: Outcome[]; winText?: Tx; loseText?: Tx;
}
export interface EventDef { id: string; act: 0 | 1 | 2 | 3; icon: string; title: Tx; text: Tx; options: EventOption[]; pack?: string }

// ------------------------------------------------------------------------------------------- Schiffe
export interface ShipDef {
  id: string; name: Tx; text: Tx; hp: number; gold: number; heatMax: number; spins: number;
  /** Startbelegung der drei Walzen */
  reels: string[][];
  module: string;
  hue: number; hull: 'kreuzer' | 'forscher' | 'titan' | 'phantom' | 'singular';
  unlock?: string;
}

// ------------------------------------------------------------------------------------------- Laufzustand
export type NodeKind = 'fight' | 'elite' | 'event' | 'shop' | 'casino' | 'rest' | 'chest' | 'boss';
export interface MapNode { id: number; row: number; col: number; kind: NodeKind; next: number[]; done?: boolean }

export interface RunStats {
  kills: number; elites: number; bosses: number; dmg: number; maxHit: number; jackpots: number; synergies: number;
  spins: number; floors: number; overheats: number; slotJackpots: number; goldWon: number;
}
export interface Run {
  seed: string; ship: string; act: number; floor: number; sectors: string[];
  hp: number; maxHp: number; gold: number;
  reels: SymInst[][]; modules: string[];
  map: MapNode[]; at: number; rng: number; uid: number;
  rerolls: number; removes: number; pityRare: number; pityCasino: number; luck: number;
  stats: RunStats;
  ascension: number; daily?: string; weekly?: string; mutators: string[];
  heatBonus: number; spinBonus: number;
  mods: Record<string, number>;
  startedAt: number;
}

export interface RunCtx {
  run: Run;
  gainGold(n: number): void;
  heal(n: number): void;
  /** Symbol hinzufügen (reel ohne Angabe: kürzeste Walze) */
  addSymbol(id: string, reel?: number, lv?: number): void;
  rnd(): number;
}

/** Kampf-Schnittstelle für Symbole, Module und Gegner. */
export interface Ctx extends RunCtx {
  turn: number; spin: number; spinsLeft: number; heat: number; heatMax: number;
  block: number; str: number; weak: number; vuln: number; rad: number; jam: number;
  foes: Foe[]; target: Foe | null;
  /** sichtbares Fenster [Walze][Zeile] */
  grid: SymInst[][];
  held: boolean[];
  powers: Record<string, number>;
  dmg(n: number, o?: { all?: boolean; times?: number; pierce?: boolean; foe?: Foe; random?: boolean }): number;
  gainBlock(n: number): void;
  irradiate(n: number, all?: boolean): void;
  weaken(n: number, all?: boolean): void;
  expose(n: number, all?: boolean): void;
  stun(n: number): void;
  addHeat(n: number): void;
  hurtSelf(n: number): void;
  addSpins(n: number): void;
  neighbors(at: Slot): SymInst[];
  count(pred: (s: SymInst, d: SymbolDef) => boolean): number;
  dice(): number;
  log(t: Tx | string): void;
  fx(kind: string, a?: any): any;
  summon(id: string, hp?: number): Foe | null;
}
