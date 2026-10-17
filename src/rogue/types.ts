// PRIMFALL – Datentypen. Alle Inhalte (Karten, Relikte, Gegner, Ereignisse) sind Daten in src/rogue/data/*.ts;
// neue Inhalte = neuer Eintrag in der jeweiligen Liste, die Spiellogik muss dafür nicht angefasst werden.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ClassId = 'sieber' | 'modula' | 'wuerfel';
export type Tx = [string, string];                       // [Deutsch, English]

// ------------------------------------------------------------------------------------------- Karten
export interface CardDef {
  id: string;
  name: Tx;
  cls: ClassId | 'any' | 'curse';
  type: 'atk' | 'skill' | 'power' | 'curse';
  rarity: Rarity;
  /** Energiekosten (u = aufgewertet) */
  cost: (u: boolean) => number;
  /** Zahlwert der Karte – zählt zur Zugsumme (Primzahl → Kombo). 'rand' = beim Ziehen gewürfelt (1–9). */
  val: number | 'rand';
  /** braucht ein Ziel (Einzelgegner) */
  target?: boolean;
  exhaust?: boolean;
  /** bleibt am Zugende auf der Hand */
  retain?: boolean;
  /** unspielbar (Flüche) */
  unplayable?: boolean;
  text: (u: boolean) => Tx;
  play?: (c: Ctx, u: boolean) => void;
  /** Flüche: Wirkung am Zugende, solange auf der Hand */
  endTurn?: (c: Ctx) => void;
  /** nur nach Freischaltung im Pool (Meta) */
  locked?: boolean;
}

export interface CardInst { uid: number; id: string; up: boolean; val: number }

// ------------------------------------------------------------------------------------------- Relikte
export interface RelicDef {
  id: string;
  name: Tx;
  icon: string;
  rarity: Rarity | 'start' | 'boss';
  cls?: ClassId;
  /** verflucht: starker Vorteil mit Nachteil (im Text sichtbar) */
  cursed?: boolean;
  text: Tx;
  locked?: boolean;
  /** Ereignis-Haken – alle optional */
  onRunStart?: (r: RunCtx) => void;
  onCombatStart?: (c: Ctx) => void;
  onTurnStart?: (c: Ctx) => void;
  onTurnEnd?: (c: Ctx) => void;
  onPrime?: (c: Ctx, sum: number, combo: number) => void;
  onCardPlayed?: (c: Ctx, card: CardInst, def: CardDef) => void;
  onKill?: (c: Ctx) => void;
  onCombatEnd?: (r: RunCtx, won: boolean) => void;
  /** Schaden des Spielers verändern (vor Schwäche/Verwundbar) */
  modDamage?: (c: Ctx, dmg: number, card?: CardDef) => number;
  /** Gold-Gewinne verändern */
  modGold?: (n: number) => number;
}

// ------------------------------------------------------------------------------------------- Gegner
export type Intent =
  | { k: 'atk'; n: number; times?: number }
  | { k: 'block'; n: number }
  | { k: 'buff'; str: number }
  | { k: 'debuff'; weak?: number; vuln?: number; frail?: number }
  | { k: 'poison'; n: number }
  | { k: 'curse'; card: string }
  | { k: 'summon'; id: string }
  | { k: 'heal'; n: number }
  | { k: 'special'; name: Tx; icon: string };

export interface EnemyDef {
  id: string;
  name: Tx;
  glyph: string;                  // großes Symbol/Zahl im Kampf
  hue: number;
  hp: [number, number];
  tier: 'normal' | 'elite' | 'boss' | 'minion';
  act: 1 | 2 | 3;
  /** nächster Zug (rundenweise); n = wievielter Zug, e = Gegnerzustand */
  next: (e: Foe, turn: number, c: Ctx) => Intent;
  /** Sonderregeln (im Kampfbildschirm als Text) */
  passive?: Tx;
  onSpawn?: (e: Foe, c: Ctx) => void;
  /** Schaden an diesem Gegner verändern (z. B. nur Primzahlen treffen) */
  modTaken?: (e: Foe, dmg: number, c: Ctx, card?: CardDef) => number;
  onDeath?: (e: Foe, c: Ctx) => void;
  /** Sonderzug (Absicht k: 'special') */
  special?: (e: Foe, c: Ctx) => void;
  /** nach jedem erlittenen Treffer */
  onHurt?: (e: Foe, c: Ctx) => void;
  onTurnStart?: (e: Foe, c: Ctx) => void;
}

export interface Foe {
  uid: number; id: string; hp: number; max: number; block: number;
  str: number; weak: number; vuln: number; poison: number;
  intent: Intent; turn: number; dead: boolean;
  mem: Record<string, number>;                     // freier Speicher für Sonderregeln
}

// ------------------------------------------------------------------------------------------- Ereignisse
export interface Outcome {
  gold?: number; hp?: number; maxHp?: number; staub?: number;
  card?: 'random' | 'rare' | 'epic' | string;
  relic?: 'common' | 'rare' | 'epic' | 'legendary' | 'cursed' | string;
  curse?: boolean | string;
  removeCard?: boolean;
  upgradeCard?: boolean;
  fight?: 'normal' | 'elite';
}
export interface EventOption {
  label: Tx;
  /** Bedingung, damit die Option wählbar ist */
  need?: { gold?: number; hp?: number };
  /** Fähigkeitsprobe mit sichtbarer Chance; Einsatz erhöhen = höhere Chance */
  check?: { chance: number; raise?: { cost: 'gold' | 'hp'; per: number; add: number; max: number } };
  win: Outcome[];
  lose?: Outcome[];
  winText?: Tx;
  loseText?: Tx;
}
export interface EventDef {
  id: string;
  act: 0 | 1 | 2 | 3;             // 0 = in jedem Akt
  icon: string;
  title: Tx;
  text: Tx;
  options: EventOption[];
}

// ------------------------------------------------------------------------------------------- Laufzustand
export type NodeKind = 'fight' | 'elite' | 'event' | 'shop' | 'casino' | 'rest' | 'chest' | 'boss';
export interface MapNode { id: number; row: number; col: number; kind: NodeKind; next: number[]; done?: boolean }

export interface Run {
  seed: string; cls: ClassId; act: number; floor: number;
  hp: number; maxHp: number; gold: number;
  deck: CardInst[]; relics: string[];
  map: MapNode[]; at: number;                       // aktueller Knoten (−1 = Start des Akts)
  rng: number;                                      // Zustand des Zufallsgenerators
  uid: number;
  rerolls: number;                                  // Zähler für steigende Reroll-Kosten
  removes: number;
  pityRare: number; pityCasino: number; luck: number;
  stats: { kills: number; elites: number; bosses: number; dmg: number; maxHit: number; maxCombo: number; goldWon: number; jackpots: number; cards: number; floors: number };
  ascension: number;
  daily?: string;
  energyBonus: number; drawBonus: number;           // aus Relikten/Talenten
  mods: Record<string, number>;                     // frei für Relikte (Zähler)
  startedAt: number;
  pendingFight?: string;                            // Ereignis hat einen Kampf ausgelöst
}

/** Zugriff außerhalb des Kampfes (Relikte bei Laufbeginn, Belohnungen). */
export interface RunCtx {
  run: Run;
  gainGold(n: number): void;
  heal(n: number): void;
  addCard(id: string, up?: boolean): void;
  rnd(): number;
}

/** Zugriff im Kampf – Karten, Relikte und Gegner benutzen nur diese Schnittstelle. */
export interface Ctx extends RunCtx {
  turn: number;
  energy: number;
  block: number;
  str: number; dex: number; weak: number; vuln: number; frail: number; poisonSelf: number;
  /** Zugsumme und Kombo (Primzahl-Treffer in Folge diesen Zug) */
  sum: number; combo: number;
  foes: Foe[];
  target: Foe | null;
  hand: CardInst[]; draw: CardInst[]; discard: CardInst[]; exhausted: CardInst[];
  /** zuletzt gespielte Karte (für Kopier-Effekte) */
  last: CardInst | null;
  /** Kraft-Ansammlungen aus Kräften (powers) */
  powers: Record<string, number>;
  dmg(n: number, opts?: { all?: boolean; times?: number; pierce?: boolean; foe?: Foe }): number;
  gainBlock(n: number): void;
  drawCards(n: number): void;
  gainEnergy(n: number): void;
  poison(n: number, all?: boolean): void;
  weaken(n: number, all?: boolean): void;
  expose(n: number, all?: boolean): void;   // Verwundbar
  hurtSelf(n: number): void;
  addToHand(id: string, up?: boolean): void;
  setSum(n: number): void;
  addSum(n: number): void;
  /** Würfel 1–6 (mit Glück/Pity) */
  dice(): number;
  log(t: Tx | string): void;
  fx(kind: string, a?: any): any;
  /** Gegner herbeirufen (Bosse, Teilung) */
  summon(id: string, hp?: number): Foe | null;
  /** gerade wirkender Kombo-Treffer (Karte hat die Summe prim gemacht) */
  primeNow: boolean;
}
