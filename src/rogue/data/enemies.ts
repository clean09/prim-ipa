// Gegner, Elite-Gegner und Bosse. next() bestimmt die Absicht für den kommenden Zug (wird vorher angezeigt).
// Neue Gegner: Eintrag hier + in ENCOUNTERS einer Begegnung zuordnen.
import { EnemyDef, Intent } from '../types';
import { isPrime } from '../rng';

const T = (de: string, en: string): [string, string] => [de, en];
const atk = (n: number, times?: number): Intent => ({ k: 'atk', n, times });
const block = (n: number): Intent => ({ k: 'block', n });
const cyc = <X>(turn: number, a: X[]) => a[(turn - 1) % a.length];

export const ENEMIES: EnemyDef[] = [
  // ======================================================================================= Akt 1
  { id: 'schleim', name: T('Bruchschleim', 'Fraction Slime'), glyph: '½', hue: 140, hp: [28, 32], tier: 'normal', act: 1,
    passive: T('Teilt sich bei halben LP in zwei Hälften.', 'Splits into two halves at half HP.'),
    next: (_e, t) => cyc(t, [atk(7), block(5), atk(5, 2)]),
    onHurt: (e, c) => {
      if (!e.dead && !e.mem.split && e.hp <= e.max / 2) {
        e.mem.split = 1; const h = Math.max(4, Math.floor(e.hp / 2)); e.dead = true; e.hp = 0;
        c.summon('halbschleim', h); c.summon('halbschleim', h); c.log(T('Der Schleim teilt sich!', 'The slime splits!'));
      }
    } },
  { id: 'halbschleim', name: T('Halbschleim', 'Half Slime'), glyph: '¼', hue: 150, hp: [8, 10], tier: 'minion', act: 1,
    next: (_e, t) => cyc(t, [atk(4), atk(3, 2)]) },
  { id: 'kaefer', name: T('Nullkäfer', 'Zero Beetle'), glyph: '0', hue: 30, hp: [22, 26], tier: 'normal', act: 1,
    next: (_e, t) => cyc(t, [block(9), atk(10), { k: 'atk', n: 5 }]) },
  { id: 'wespe', name: T('Teilerwespe', 'Divisor Wasp'), glyph: '÷', hue: 50, hp: [17, 21], tier: 'normal', act: 1,
    next: (_e, t) => cyc(t, [atk(3, 3), { k: 'debuff', weak: 1 }, atk(3, 3)]) },
  { id: 'spinne', name: T('Restspinne', 'Residue Spider'), glyph: '%', hue: 280, hp: [24, 28], tier: 'normal', act: 1,
    next: (_e, t) => cyc(t, [{ k: 'poison', n: 3 }, atk(7), atk(6)]) },
  { id: 'kult', name: T('Kult der Eins', 'Cult of One'), glyph: '1', hue: 0, hp: [40, 44], tier: 'normal', act: 1,
    passive: T('Wird jede Runde stärker.', 'Grows stronger every turn.'),
    next: (_e, t) => (t === 1 ? { k: 'buff', str: 3 } : atk(5)) },

  { id: 'quadrierer', name: T('Der Quadrierer', 'The Squarer'), glyph: 'x²', hue: 200, hp: [72, 78], tier: 'elite', act: 1,
    passive: T('Schlägt mit 2 + Zug² zu – schnell besiegen!', 'Hits for 2 + turn² – defeat it fast!'),
    next: (_e, t) => (t % 3 === 0 ? block(12) : atk(Math.min(40, 2 + t * t))) },
  { id: 'zwilling11', name: T('Zwilling 11', 'Twin 11'), glyph: '11', hue: 330, hp: [34, 36], tier: 'elite', act: 1,
    passive: T('Stirbt ein Zwilling allein, holt der andere ihn zurück.', 'If one twin dies alone, the other revives it.'),
    next: (_e, t) => cyc(t, [atk(8), atk(4, 2), block(8)]),
    onTurnStart: (e, c) => revivePartner(e, c, 'zwilling13') },
  { id: 'zwilling13', name: T('Zwilling 13', 'Twin 13'), glyph: '13', hue: 300, hp: [34, 36], tier: 'elite', act: 1,
    passive: T('Stirbt ein Zwilling allein, holt der andere ihn zurück.', 'If one twin dies alone, the other revives it.'),
    next: (_e, t) => cyc(t, [block(8), atk(9), { k: 'debuff', vuln: 1 }]),
    onTurnStart: (e, c) => revivePartner(e, c, 'zwilling11') },

  { id: 'teiler', name: T('Der Große Teiler', 'The Great Divisor'), glyph: '÷', hue: 20, hp: [135, 135], tier: 'boss', act: 1,
    passive: T('Karten mit NICHT-primer Zahl machen nur halben Schaden. Spaltet Reste ab.', 'Cards with a NON-prime number deal only half damage. Splits off remainders.'),
    modTaken: (_e, d, c, card) => (card && !(c.fx('cardPrime', card)) ? Math.floor(d / 2) : d),
    special: (_e, c) => { c.block = Math.floor(c.block / 2); c.log(T('Dein Block wird geteilt!', 'Your block is divided!')); c.fx('enemyHit', { n: 8, times: 2 }); },
    next: (_e, t) => cyc(t, [atk(12), { k: 'special', name: T('Teilung', 'Division'), icon: '÷' }, { k: 'summon', id: 'rest' }, atk(7, 2), block(16)]) },
  { id: 'rest', name: T('Rest', 'Remainder'), glyph: 'r', hue: 30, hp: [12, 14], tier: 'minion', act: 1,
    next: () => atk(4) },

  // ======================================================================================= Akt 2
  { id: 'waechter', name: T('Primwächter', 'Prime Warden'), glyph: 'P', hue: 190, hp: [36, 42], tier: 'normal', act: 2,
    passive: T('Immun gegen Karten mit nicht-primer Zahl.', 'Immune to cards with a non-prime number.'),
    modTaken: (_e, d, c, card) => (card && !c.fx('cardPrime', card) ? 0 : d),
    next: (_e, t) => cyc(t, [atk(11), block(12), atk(6, 2)]) },
  { id: 'golem', name: T('Wurzelgolem', 'Root Golem'), glyph: '√', hue: 25, hp: [58, 64], tier: 'normal', act: 2,
    passive: T('Lädt auf und schlägt dann gewaltig zu.', 'Charges up, then hits hard.'),
    next: (_e, t) => (t % 2 === 1 ? { k: 'special', name: T('Lädt auf', 'Charging'), icon: '⚡' } : atk(20)),
    special: e => { e.block += 6; } },
  { id: 'hexe', name: T('Modulo-Hexe', 'Modulo Witch'), glyph: 'mod', hue: 290, hp: [36, 40], tier: 'normal', act: 2,
    next: (_e, t) => cyc(t, [{ k: 'curse', card: 'zweifel' }, atk(9), { k: 'debuff', vuln: 2 }, atk(7)]) },
  { id: 'bestie', name: T('Fakultätsbestie', 'Factorial Beast'), glyph: 'n!', hue: 0, hp: [42, 48], tier: 'normal', act: 2,
    passive: T('Schaden = Zug! (1, 2, 6, 24 …)', 'Damage = turn! (1, 2, 6, 24 …)'),
    next: (_e, t) => atk([1, 2, 6, 24, 30][Math.min(4, t - 1)]) },
  { id: 'spiegelzahl', name: T('Spiegelzahl', 'Mirror Number'), glyph: '⇄', hue: 210, hp: [40, 44], tier: 'normal', act: 2,
    passive: T('Wirft 20 % des Schadens auf dich zurück.', 'Reflects 20 % of damage back at you.'),
    modTaken: (_e, d, c) => { const r = Math.floor(d * 0.2); if (r > 0) c.hurtSelf(r); return d; },
    next: (_e, t) => cyc(t, [block(10), atk(9)]) },

  { id: 'goldbach', name: T('Goldbach-Ritter', 'Goldbach Knight'), glyph: 'G', hue: 45, hp: [96, 104], tier: 'elite', act: 2,
    passive: T('Jede gerade Runde: Block = Summe zweier Primzahlen.', 'Every even turn: block = sum of two primes.'),
    next: (_e, t) => (t % 2 === 0 ? { k: 'block', n: 14 + 2 * t } : cyc(Math.ceil(t / 2), [atk(15), atk(8, 2), atk(20)])) },
  { id: 'wurm', name: T('Mersenne-Wurm', 'Mersenne Worm'), glyph: 'M', hue: 150, hp: [185, 185], tier: 'boss', act: 2,
    passive: T('Angriff 2^k − 1: verdoppelt sich jede Runde. Häutet sich einmal bei halben LP.', 'Attack 2^k − 1: doubles every turn. Sheds its skin once at half HP.'),
    next: (_e, t) => (t % 4 === 0 ? block(25) : atk(Math.min(40, 2 ** (Math.ceil(t * 0.75) + 1) - 1))),
    onHurt: (e, c) => { if (!e.dead && !e.mem.shed && e.hp <= e.max / 2) { e.mem.shed = 1; e.hp += 30; e.block += 15; c.log(T('Der Wurm häutet sich!', 'The worm sheds its skin!')); c.fx('shake', 2); } } },

  // ======================================================================================= Akt 3
  { id: 'schlange', name: T('Unendlichkeitsschlange', 'Infinity Serpent'), glyph: '∞', hue: 260, hp: [68, 74], tier: 'normal', act: 3,
    next: (_e, t) => cyc(t, [atk(6, 3), { k: 'buff', str: 2 }, atk(14)]) },
  { id: 'paradox', name: T('Paradoxon', 'Paradox'), glyph: '?', hue: 320, hp: [58, 64], tier: 'normal', act: 3,
    passive: T('Unberechenbar.', 'Unpredictable.'),
    next: (e, t) => [atk(18), block(18), { k: 'debuff', weak: 2, vuln: 2 } as Intent, { k: 'curse', card: 'bruch' } as Intent][(e.uid * 7 + t * 3) % 4] },
  { id: 'attraktor', name: T('Chaos-Attraktor', 'Chaos Attractor'), glyph: '☄', hue: 15, hp: [54, 60], tier: 'normal', act: 3,
    next: (_e, t) => cyc(t, [{ k: 'summon', id: 'funke' }, atk(10), { k: 'poison', n: 4 }]) },
  { id: 'funke', name: T('Funke', 'Spark'), glyph: '✦', hue: 40, hp: [10, 12], tier: 'minion', act: 3, next: () => atk(5) },
  { id: 'tensor', name: T('Tensor', 'Tensor'), glyph: '⊗', hue: 180, hp: [78, 84], tier: 'normal', act: 3,
    passive: T('+1 Stärke jede Runde.', '+1 Strength every turn.'),
    onTurnStart: e => { e.str += 1; },
    next: (_e, t) => cyc(t, [block(14), atk(12)]) },

  { id: 'goedel', name: T('Gödels Wächter', 'Gödel’s Warden'), glyph: '⊢', hue: 240, hp: [140, 150], tier: 'elite', act: 3,
    passive: T('Der erste Treffer jeder Runde ist unbeweisbar (0 Schaden).', 'The first hit each turn is unprovable (0 damage).'),
    modTaken: (e, d, c) => { if (e.mem.lastTurn !== c.turn) { e.mem.lastTurn = c.turn; c.log(T('Unbeweisbar!', 'Unprovable!')); return 0; } return d; },
    next: (_e, t) => cyc(t, [atk(20), atk(8, 3), { k: 'debuff', weak: 2 }]) },
  { id: 'hydra', name: T('Riemann-Hydra', 'Riemann Hydra'), glyph: 'ζ', hue: 275, hp: [300, 300], tier: 'boss', act: 3,
    passive: T('Halber Schaden, solange ein Kopf lebt. Köpfe wachsen nach – außer sie fallen durch einen Primzahl-Treffer.', 'Half damage while a head lives. Heads regrow – unless slain by a prime hit.'),
    onSpawn: (_e, c) => { c.summon('kopf'); c.summon('kopf'); },
    modTaken: (_e, d, c) => (c.foes.some(f => !f.dead && f.id === 'kopf') ? Math.floor(d / 2) : d),
    onTurnStart: (e, c) => {
      const alive = c.foes.filter(f => !f.dead && f.id === 'kopf').length;
      if (alive < 2 && (e.mem.grow ?? 0) > 0) { e.mem.grow -= 1; if (e.mem.grow === 0) { c.summon('kopf'); c.log(T('Ein Kopf wächst nach!', 'A head regrows!')); } }
    },
    next: (_e, t) => cyc(t, [atk(15), atk(6, 4), block(22), { k: 'debuff', weak: 2, vuln: 2 }]) },
  { id: 'kopf', name: T('Hydrakopf', 'Hydra Head'), glyph: 'ζ₀', hue: 290, hp: [38, 42], tier: 'minion', act: 3,
    next: (_e, t) => cyc(t, [atk(8), atk(4, 2)]),
    onDeath: (_e, c) => {
      const body = c.foes.find(f => f.id === 'hydra' && !f.dead);
      if (body && !c.primeNow) { body.mem.grow = 2; c.log(T('Kein Primzahl-Treffer – der Kopf wird nachwachsen.', 'No prime hit – the head will regrow.')); }
    } },
];

function revivePartner(e: { dead: boolean; mem: Record<string, number> }, c: Parameters<NonNullable<EnemyDef['onTurnStart']>>[1], partner: string) {
  const p = c.foes.find(f => f.id === partner);
  if (p && p.dead && !e.dead && !(e.mem.revived > 0)) {
    e.mem.revived = 1; p.dead = false; p.hp = Math.ceil(p.max / 2); c.log(T('Der Zwilling kehrt zurück!', 'The twin returns!')); c.fx('revive', p);
  }
}

export const ENEMY: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

/** Begegnungen je Akt: normale (früh/spät), Elite, Boss. */
export const ENCOUNTERS: Record<number, { easy: string[][]; hard: string[][]; elite: string[][]; boss: string[] }> = {
  1: {
    easy: [['schleim'], ['kaefer', 'wespe'], ['spinne', 'wespe'], ['kult']],
    hard: [['schleim', 'spinne'], ['kult', 'wespe'], ['kaefer', 'kaefer', 'wespe'], ['spinne', 'spinne']],
    elite: [['quadrierer'], ['zwilling11', 'zwilling13']], boss: ['teiler'],
  },
  2: {
    easy: [['waechter'], ['golem'], ['hexe', 'spiegelzahl']],
    hard: [['bestie', 'hexe'], ['waechter', 'spiegelzahl'], ['golem', 'hexe'], ['waechter', 'hexe']],
    elite: [['goldbach'], ['quadrierer', 'hexe']], boss: ['wurm'],
  },
  3: {
    easy: [['schlange'], ['paradox', 'funke'], ['tensor']],
    hard: [['attraktor', 'paradox'], ['schlange', 'tensor'], ['attraktor', 'schlange'], ['paradox', 'paradox']],
    elite: [['goedel'], ['goldbach', 'tensor']], boss: ['hydra'],
  },
};

export { isPrime };
