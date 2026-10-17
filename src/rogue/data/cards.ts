// Karten. Jede Karte trägt eine Zahl (val): sie wird zur Zugsumme addiert – ist die neue Summe eine Primzahl, steigt die
// Kombo und die Karte wirkt stärker (×1 + 0,25·Kombo). Neue Karte = neuer Eintrag; u = aufgewertet (+).
import { CardDef } from '../types';

const c = (o: Omit<CardDef, 'cost'> & { cost: number | [number, number] }): CardDef => {
  const k = o.cost;
  return { ...o, cost: Array.isArray(k) ? (u: boolean) => (u ? k[1] : k[0]) : () => k };
};
const T = (de: string, en: string): [string, string] => [de, en];

export const CARDS: CardDef[] = [
  // ======================================================================================= neutral – gewöhnlich
  c({ id: 'schnitt', name: T('Schnitt', 'Slash'), cls: 'any', type: 'atk', rarity: 'common', cost: 1, val: 2, target: true,
    text: u => T(`${u ? 9 : 6} Schaden.`, `Deal ${u ? 9 : 6} damage.`), play: (g, u) => g.dmg(u ? 9 : 6) }),
  c({ id: 'schild', name: T('Teilerschild', 'Divisor Shield'), cls: 'any', type: 'skill', rarity: 'common', cost: 1, val: 3,
    text: u => T(`${u ? 8 : 5} Block.`, `Gain ${u ? 8 : 5} block.`), play: (g, u) => g.gainBlock(u ? 8 : 5) }),
  c({ id: 'primstoss', name: T('Primstoß', 'Prime Thrust'), cls: 'any', type: 'atk', rarity: 'common', cost: 1, val: 5, target: true,
    text: u => T(`${u ? 10 : 7} Schaden. Bei laufender Kombo +4.`, `Deal ${u ? 10 : 7} damage. +4 during a combo.`),
    play: (g, u) => g.dmg((u ? 10 : 7) + (g.combo > 0 ? 4 : 0)) }),
  c({ id: 'doppel', name: T('Doppelschlag', 'Double Strike'), cls: 'any', type: 'atk', rarity: 'common', cost: 1, val: 4, target: true,
    text: u => T(`${u ? 5 : 4} Schaden, zweimal.`, `Deal ${u ? 5 : 4} damage twice.`), play: (g, u) => g.dmg(u ? 5 : 4, { times: 2 }) }),
  c({ id: 'quersumme', name: T('Quersumme', 'Digit Sum'), cls: 'any', type: 'skill', rarity: 'common', cost: 0, val: 1,
    text: u => T(`Ziehe ${u ? 2 : 1} Karte${u ? 'n' : ''}.`, `Draw ${u ? 2 : 1} card${u ? 's' : ''}.`), play: (g, u) => g.drawCards(u ? 2 : 1) }),
  c({ id: 'null', name: T('Die Null', 'Zero'), cls: 'any', type: 'skill', rarity: 'common', cost: 0, val: 0, retain: true,
    text: u => T(`${u ? 5 : 3} Block. Ändert die Summe nicht. Bleibt auf der Hand.`, `Gain ${u ? 5 : 3} block. Does not change the sum. Retained.`), play: (g, u) => g.gainBlock(u ? 5 : 3) }),
  c({ id: 'wirbel', name: T('Zahlenwirbel', 'Number Whirl'), cls: 'any', type: 'atk', rarity: 'common', cost: 1, val: 6,
    text: u => T(`${u ? 7 : 5} Schaden an ALLEN Gegnern.`, `Deal ${u ? 7 : 5} damage to ALL enemies.`), play: (g, u) => g.dmg(u ? 7 : 5, { all: true }) }),
  c({ id: 'bollwerk', name: T('Bollwerk', 'Bulwark'), cls: 'any', type: 'skill', rarity: 'common', cost: 2, val: 4,
    text: u => T(`${u ? 17 : 13} Block.`, `Gain ${u ? 17 : 13} block.`), play: (g, u) => g.gainBlock(u ? 17 : 13) }),
  c({ id: 'feinjustierung', name: T('Feinjustierung', 'Fine Tuning'), cls: 'any', type: 'skill', rarity: 'common', cost: 0, val: 1,
    text: u => T(`${u ? 5 : 3} Block. (+1 zur Summe)`, `Gain ${u ? 5 : 3} block. (+1 to the sum)`), play: (g, u) => g.gainBlock(u ? 5 : 3) }),
  c({ id: 'kerbe', name: T('Kerbe', 'Notch'), cls: 'any', type: 'atk', rarity: 'common', cost: 0, val: 3, target: true,
    text: u => T(`4 Schaden, ${u ? 2 : 1} Schwäche.`, `Deal 4 damage, apply ${u ? 2 : 1} Weak.`), play: (g, u) => { g.dmg(4); g.weaken(u ? 2 : 1); } }),
  c({ id: 'riss', name: T('Riss', 'Rift'), cls: 'any', type: 'atk', rarity: 'common', cost: 2, val: 8, target: true,
    text: u => T(`${u ? 17 : 13} Schaden, 2 Verwundbar.`, `Deal ${u ? 17 : 13} damage, apply 2 Vulnerable.`), play: (g, u) => { g.dmg(u ? 17 : 13); g.expose(2); } }),
  c({ id: 'parade', name: T('Parade', 'Parry'), cls: 'any', type: 'skill', rarity: 'common', cost: 1, val: 2,
    text: u => T(`${u ? 10 : 7} Block. Bei Kombo: ziehe 1.`, `Gain ${u ? 10 : 7} block. During a combo: draw 1.`), play: (g, u) => { g.gainBlock(u ? 10 : 7); if (g.combo > 0) g.drawCards(1); } }),

  // ======================================================================================= neutral – selten/episch/legendär
  c({ id: 'zwilling', name: T('Primzwilling', 'Twin Prime'), cls: 'any', type: 'atk', rarity: 'rare', cost: 1, val: 2, target: true,
    text: u => T(`${u ? 7 : 5} Schaden. Ab Kombo 2 noch einmal.`, `Deal ${u ? 7 : 5} damage. Again at combo 2+.`),
    play: (g, u) => g.dmg(u ? 7 : 5, { times: g.combo >= 2 ? 2 : 1 }) }),
  c({ id: 'siebschlag', name: T('Summenschlag', 'Sum Strike'), cls: 'any', type: 'atk', rarity: 'rare', cost: [2, 1], val: 7, target: true,
    text: () => T('Schaden in Höhe der aktuellen Summe.', 'Deal damage equal to the current sum.'), play: g => g.dmg(Math.max(0, g.sum)) }),
  c({ id: 'fokus', name: T('Fokus', 'Focus'), cls: 'any', type: 'power', rarity: 'rare', cost: 1, val: 2,
    text: u => T(`+${u ? 3 : 2} Stärke.`, `Gain ${u ? 3 : 2} Strength.`), play: (g, u) => { g.str += u ? 3 : 2; } }),
  c({ id: 'mauer', name: T('Primmauer', 'Prime Wall'), cls: 'any', type: 'power', rarity: 'rare', cost: 2, val: 5,
    text: u => T(`Am Zugende ${u ? 6 : 4} Block.`, `At end of turn gain ${u ? 6 : 4} block.`), play: (g, u) => { g.powers.mauer = (g.powers.mauer ?? 0) + (u ? 6 : 4); } }),
  c({ id: 'rueckhalt', name: T('Rückhalt', 'Backing'), cls: 'any', type: 'skill', rarity: 'rare', cost: 1, val: 2,
    text: u => T(`${u ? 6 : 4} Block + 4 je Kombo-Stufe.`, `Gain ${u ? 6 : 4} block + 4 per combo level.`), play: (g, u) => g.gainBlock((u ? 6 : 4) + 4 * g.combo) }),
  c({ id: 'nachladen', name: T('Nachladen', 'Reload'), cls: 'any', type: 'skill', rarity: 'rare', cost: 0, val: 0, exhaust: true,
    text: u => T(`Ziehe ${u ? 3 : 2}. Verbraucht.`, `Draw ${u ? 3 : 2}. Exhaust.`), play: (g, u) => g.drawCards(u ? 3 : 2) }),
  c({ id: 'kopie', name: T('Kopie', 'Copy'), cls: 'any', type: 'skill', rarity: 'rare', cost: [1, 0], val: 0,
    text: () => T('Wiederholt die Wirkung der zuletzt gespielten Karte.', 'Repeat the effect of the last card played.'), play: g => g.fx('replay') }),
  c({ id: 'primzaehler', name: T('Primzähler', 'Prime Counter'), cls: 'any', type: 'power', rarity: 'epic', cost: [2, 1], val: 3,
    text: () => T('Jeder Primzahl-Treffer: ziehe 1 Karte.', 'Every prime hit: draw 1 card.'), play: g => { g.powers.primDraw = (g.powers.primDraw ?? 0) + 1; } }),
  c({ id: 'mersenne', name: T('Mersenne-Strahl', 'Mersenne Beam'), cls: 'any', type: 'atk', rarity: 'epic', cost: 2, val: 7, target: true, locked: true,
    text: u => T(`Schaden 2^k − 1, k = Kombo + ${u ? 3 : 2} (3, 7, 15, 31 …).`, `Deal 2^k − 1 damage, k = combo + ${u ? 3 : 2} (3, 7, 15, 31 …).`),
    play: (g, u) => g.dmg(2 ** Math.min(9, g.combo + (u ? 3 : 2)) - 1) }),
  c({ id: 'gauss', name: T('Gaußsumme', 'Gauss Sum'), cls: 'any', type: 'atk', rarity: 'epic', cost: 2, val: 10, locked: true,
    text: u => T(`${u ? 5 : 4} Schaden an allen je Karte auf der Hand.`, `Deal ${u ? 5 : 4} damage to all per card in hand.`),
    play: (g, u) => g.dmg((u ? 5 : 4) * g.hand.length, { all: true }) }),
  c({ id: 'euklid', name: T('Euklids Beweis', 'Euclid’s Proof'), cls: 'any', type: 'power', rarity: 'legendary', cost: [3, 2], val: 2, locked: true,
    text: () => T('Ab jetzt zählt JEDE ungerade Summe als Primzahl.', 'From now on EVERY odd sum counts as prime.'), play: g => { g.powers.euklid = 1; } }),
  c({ id: 'riemann', name: T('Riemanns Welle', 'Riemann Wave'), cls: 'any', type: 'atk', rarity: 'legendary', cost: 2, val: 1, locked: true,
    text: u => T(`${u ? 3 : 2} Schaden an allen je Primzahl-Treffer in diesem Kampf.`, `Deal ${u ? 3 : 2} damage to all per prime hit this combat.`),
    play: (g, u) => g.dmg((u ? 3 : 2) * (g.powers.primesHit ?? 0), { all: true }) }),

  // ======================================================================================= Sieber
  c({ id: 'primklinge', name: T('Primklinge', 'Prime Blade'), cls: 'sieber', type: 'atk', rarity: 'common', cost: 1, val: 3, target: true,
    text: u => T(`${u ? 8 : 6} Schaden, +3 je Kombo-Stufe.`, `Deal ${u ? 8 : 6} damage, +3 per combo level.`), play: (g, u) => g.dmg((u ? 8 : 6) + 3 * g.combo) }),
  c({ id: 'eratosthenes', name: T('Sieb des Eratosthenes', 'Sieve of Eratosthenes'), cls: 'sieber', type: 'skill', rarity: 'rare', cost: [1, 0], val: 2,
    text: () => T('Wirf alle Handkarten mit nicht-primer Zahl ab und ziehe so viele neu.', 'Discard all hand cards with a non-prime number and draw that many.'), play: g => g.fx('sieve') }),
  c({ id: 'primfeuer', name: T('Primfeuer', 'Prime Fire'), cls: 'sieber', type: 'atk', rarity: 'rare', cost: 2, val: 13, target: true,
    text: u => T(`${u ? 20 : 15} Schaden. Kombo-Treffer: +2 Energie.`, `Deal ${u ? 20 : 15} damage. On a prime hit: +2 energy.`),
    play: (g, u) => { g.dmg(u ? 20 : 15); if (g.fx('wasPrime')) g.gainEnergy(2); } }),
  c({ id: 'kronenzahl', name: T('Kronenzahl', 'Crown Number'), cls: 'sieber', type: 'power', rarity: 'epic', cost: [2, 1], val: 7, locked: true,
    text: () => T('Jeder Zug beginnt mit Summe 2 (statt 0).', 'Every turn starts with sum 2 (instead of 0).'), play: g => { g.powers.crown = 1; } }),
  c({ id: 'siebwall', name: T('Siebwall', 'Sieve Wall'), cls: 'sieber', type: 'skill', rarity: 'common', cost: 1, val: 5,
    text: u => T(`${u ? 8 : 6} Block, bei Primzahl-Treffer verdoppelt.`, `Gain ${u ? 8 : 6} block, doubled on a prime hit.`), play: (g, u) => g.gainBlock((u ? 8 : 6) * (g.fx('wasPrime') ? 2 : 1)) }),
  c({ id: 'kettenbeweis', name: T('Kettenbeweis', 'Chain Proof'), cls: 'sieber', type: 'skill', rarity: 'epic', cost: 1, val: 2,
    text: u => T(`Kombo +${u ? 2 : 1}.`, `Combo +${u ? 2 : 1}.`), play: (g, u) => g.fx('combo', u ? 2 : 1) }),

  // ======================================================================================= Modula (Zerfall = Gift)
  c({ id: 'zerfall', name: T('Zerfall', 'Decay'), cls: 'modula', type: 'skill', rarity: 'common', cost: 1, val: 2, target: true,
    text: u => T(`${u ? 7 : 5} Zerfall.`, `Apply ${u ? 7 : 5} Decay.`), play: (g, u) => g.poison(u ? 7 : 5) }),
  c({ id: 'rueckstand', name: T('Rückstand', 'Residue'), cls: 'modula', type: 'atk', rarity: 'common', cost: 1, val: 3, target: true,
    text: u => T(`${u ? 7 : 5} Schaden, ${u ? 3 : 2} Zerfall.`, `Deal ${u ? 7 : 5} damage, apply ${u ? 3 : 2} Decay.`), play: (g, u) => { g.dmg(u ? 7 : 5); g.poison(u ? 3 : 2); } }),
  c({ id: 'modulo', name: T('Modulo', 'Modulo'), cls: 'modula', type: 'skill', rarity: 'common', cost: 0, val: 0,
    text: u => T(`Summe → Summe mod ${u ? 6 : 10}. ${u ? 4 : 3} Block.`, `Sum → sum mod ${u ? 6 : 10}. Gain ${u ? 4 : 3} block.`), play: (g, u) => { g.setSum(g.sum % (u ? 6 : 10)); g.gainBlock(u ? 4 : 3); } }),
  c({ id: 'negation', name: T('Negation', 'Negation'), cls: 'modula', type: 'skill', rarity: 'common', cost: 0, val: -3,
    text: u => T(`${u ? 6 : 4} Block. Zieht 3 von der Summe ab.`, `Gain ${u ? 6 : 4} block. Subtracts 3 from the sum.`), play: (g, u) => g.gainBlock(u ? 6 : 4) }),
  c({ id: 'giftwolke', name: T('Giftwolke', 'Toxic Cloud'), cls: 'modula', type: 'skill', rarity: 'rare', cost: 2, val: 6,
    text: u => T(`${u ? 6 : 4} Zerfall an allen.`, `Apply ${u ? 6 : 4} Decay to all.`), play: (g, u) => g.poison(u ? 6 : 4, true) }),
  c({ id: 'aufloesung', name: T('Auflösung', 'Dissolve'), cls: 'modula', type: 'atk', rarity: 'rare', cost: 1, val: 9, target: true,
    text: u => T(`Schaden = ${u ? 3 : 2} × Zerfall des Ziels.`, `Deal ${u ? 3 : 2} × target's Decay as damage.`), play: (g, u) => g.dmg((u ? 3 : 2) * (g.target?.poison ?? 0)) }),
  c({ id: 'katalysator', name: T('Katalysator', 'Catalyst'), cls: 'modula', type: 'skill', rarity: 'epic', cost: 1, val: 4, target: true, exhaust: true, locked: true,
    text: u => T(`Zerfall des Ziels ×${u ? 3 : 2}. Verbraucht.`, `Multiply target's Decay by ${u ? 3 : 2}. Exhaust.`), play: (g, u) => { if (g.target) g.target.poison *= u ? 3 : 2; } }),
  c({ id: 'virulenz', name: T('Virulenz', 'Virulence'), cls: 'modula', type: 'power', rarity: 'epic', cost: 1, val: 5,
    text: u => T(`Jeder Zerfall, den du verteilst, +${u ? 3 : 2}.`, `All Decay you apply +${u ? 3 : 2}.`), play: (g, u) => { g.powers.viru = (g.powers.viru ?? 0) + (u ? 3 : 2); } }),
  c({ id: 'restklasse', name: T('Restklasse', 'Residue Class'), cls: 'modula', type: 'power', rarity: 'legendary', cost: 2, val: 1, locked: true,
    text: u => T(`Primzahl-Treffer: Kombo × ${u ? 3 : 2} Zerfall an allen.`, `Prime hit: combo × ${u ? 3 : 2} Decay to all.`), play: (g, u) => { g.powers.restk = u ? 3 : 2; } }),

  // ======================================================================================= Würfelkönig
  c({ id: 'wurf', name: T('Wurf', 'Throw'), cls: 'wuerfel', type: 'atk', rarity: 'common', cost: 1, val: 'rand', target: true,
    text: u => T(`Schaden = Zahl × 2${u ? ' + 3' : ''}. Zahl wird beim Ziehen gewürfelt.`, `Damage = number × 2${u ? ' + 3' : ''}. Number is rolled when drawn.`),
    play: (g, u) => g.dmg(g.fx('val') * 2 + (u ? 3 : 0)) }),
  c({ id: 'glueck', name: T('Glückspilz', 'Lucky Shroom'), cls: 'wuerfel', type: 'skill', rarity: 'common', cost: 1, val: 'rand',
    text: u => T(`Block = Zahl + ${u ? 6 : 3}.`, `Block = number + ${u ? 6 : 3}.`), play: (g, u) => g.gainBlock(g.fx('val') + (u ? 6 : 3)) }),
  c({ id: 'alles', name: T('Alles oder nichts', 'All or Nothing'), cls: 'wuerfel', type: 'atk', rarity: 'rare', cost: 1, val: 7, target: true,
    text: u => T(`Würfle: 4–6 → ${u ? 28 : 22} Schaden, 1–3 → nichts und −3 LP.`, `Roll: 4–6 → ${u ? 28 : 22} damage, 1–3 → nothing and −3 HP.`),
    play: (g, u) => { const d = g.dice(); if (d >= 4) g.dmg(u ? 28 : 22); else { g.hurtSelf(3); g.log(T('Pech gehabt!', 'Unlucky!')); } } }),
  c({ id: 'einsatz', name: T('Einsatz', 'Stake'), cls: 'wuerfel', type: 'skill', rarity: 'rare', cost: 0, val: 1,
    text: u => T(`−5 Gold, +1 Energie, ziehe ${u ? 3 : 2}.`, `−5 gold, +1 energy, draw ${u ? 3 : 2}.`), play: (g, u) => { g.gainGold(-5); g.gainEnergy(1); g.drawCards(u ? 3 : 2); } }),
  c({ id: 'goldregen', name: T('Goldregen', 'Gold Rain'), cls: 'wuerfel', type: 'skill', rarity: 'rare', cost: 1, val: 3, exhaust: true,
    text: u => T(`+${u ? 14 : 9} Gold, 6 Block. Verbraucht.`, `+${u ? 14 : 9} gold, 6 block. Exhaust.`), play: (g, u) => { g.gainGold(u ? 14 : 9); g.gainBlock(6); } }),
  c({ id: 'jackpot', name: T('Jackpot', 'Jackpot'), cls: 'wuerfel', type: 'atk', rarity: 'epic', cost: 2, val: 7, target: true, locked: true,
    text: u => T(`Würfle 3×: Augensumme × ${u ? 3 : 2} Schaden. Pasch ×2, Drilling ×5.`, `Roll 3×: pips × ${u ? 3 : 2} damage. Pair ×2, triple ×5.`),
    play: (g, u) => {
      const a = g.dice(), b = g.dice(), d = g.dice();
      const m = a === b && b === d ? 5 : a === b || b === d || a === d ? 2 : 1;
      g.log(`🎲 ${a} · ${b} · ${d}${m > 1 ? `  ×${m}!` : ''}`);
      if (m === 5) g.fx('jackpot');
      g.dmg((a + b + d) * (u ? 3 : 2) * m);
    } }),
  c({ id: 'hausvorteil', name: T('Hausvorteil', 'House Edge'), cls: 'wuerfel', type: 'power', rarity: 'epic', cost: 1, val: 2, locked: true,
    text: u => T(`Alle Würfe +1${u ? ', +1 Energie jetzt' : ''}.`, `All rolls +1${u ? ', +1 energy now' : ''}.`), play: (g, u) => { g.powers.luck = (g.powers.luck ?? 0) + 1; if (u) g.gainEnergy(1); } }),
  c({ id: 'doppelwette', name: T('Doppelte Wette', 'Double Down'), cls: 'wuerfel', type: 'skill', rarity: 'legendary', cost: [1, 0], val: 2, exhaust: true, locked: true,
    text: () => T('Die nächste Karte wirkt doppelt. Verbraucht.', 'The next card is played twice. Exhaust.'), play: g => { g.powers.double = 1; } }),
  c({ id: 'gezinkt', name: T('Gezinkter Würfel', 'Loaded Die'), cls: 'wuerfel', type: 'skill', rarity: 'common', cost: 0, val: 'rand',
    text: u => T(`Würfle neu: Zahl aller Würfelkarten auf der Hand${u ? ' (2× wählen, beste)' : ''}. 2 Block.`, `Reroll the number of all dice cards in hand${u ? ' (best of 2)' : ''}. 2 block.`),
    play: (g, u) => { g.fx('reroll', u ? 2 : 1); g.gainBlock(2); } }),

  // ======================================================================================= Flüche
  c({ id: 'bruch', name: T('Bruch', 'Fraction'), cls: 'curse', type: 'curse', rarity: 'common', cost: 0, val: 0, unplayable: true,
    text: () => T('Unspielbar. Zugende auf der Hand: −2 LP.', 'Unplayable. End of turn in hand: −2 HP.'), endTurn: g => g.hurtSelf(2) }),
  c({ id: 'zweifel', name: T('Zweifel', 'Doubt'), cls: 'curse', type: 'curse', rarity: 'common', cost: 0, val: 0, unplayable: true,
    text: () => T('Unspielbar. Zugende auf der Hand: 1 Schwäche.', 'Unplayable. End of turn in hand: 1 Weak.'), endTurn: g => { g.weak += 1; } }),
  c({ id: 'nullteiler', name: T('Division durch Null', 'Division by Zero'), cls: 'curse', type: 'curse', rarity: 'common', cost: 1, val: 0, exhaust: true,
    text: () => T('Tut nichts. Verbraucht.', 'Does nothing. Exhaust.'), play: () => {} }),
  c({ id: 'gier', name: T('Gier', 'Greed'), cls: 'curse', type: 'curse', rarity: 'common', cost: 0, val: 0, unplayable: true,
    text: () => T('Unspielbar. Zugende auf der Hand: −6 Gold.', 'Unplayable. End of turn in hand: −6 gold.'), endTurn: g => g.gainGold(-6) }),
];

export const CARD: Record<string, CardDef> = Object.fromEntries(CARDS.map(x => [x.id, x]));

export const STARTER: Record<string, string[]> = {
  sieber: ['schnitt', 'schnitt', 'schnitt', 'schnitt', 'schild', 'schild', 'schild', 'schild', 'primstoss', 'primklinge'],
  modula: ['schnitt', 'schnitt', 'schnitt', 'schild', 'schild', 'schild', 'schild', 'zerfall', 'zerfall', 'negation'],
  wuerfel: ['wurf', 'wurf', 'wurf', 'wurf', 'schild', 'schild', 'schild', 'schild', 'glueck', 'einsatz'],
};

/** Kartenpakete (Meta-Freischaltung). */
export const PACKS: { id: string; name: [string, string]; cost: number; cards: string[] }[] = [
  { id: 'p1', name: ['Paket I · Unendlichkeit', 'Pack I · Infinity'], cost: 120, cards: ['euklid', 'mersenne', 'gauss'] },
  { id: 'p2', name: ['Paket II · Zerfallsreihe', 'Pack II · Decay Chain'], cost: 160, cards: ['katalysator', 'restklasse', 'kronenzahl'] },
  { id: 'p3', name: ['Paket III · Casino Royal', 'Pack III · Casino Royale'], cost: 200, cards: ['jackpot', 'hausvorteil', 'doppelwette', 'riemann'] },
];
