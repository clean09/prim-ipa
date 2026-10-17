// Relikte: dauerhafte Boni für den ganzen Lauf. Neue Relikte = neuer Eintrag mit passenden Haken (siehe types.ts).
import { RelicDef } from '../types';
import { isPrime } from '../rng';

const T = (de: string, en: string): [string, string] => [de, en];

export const RELICS: RelicDef[] = [
  // ======================================================================================= Startrelikte
  { id: 'sieb', name: T('Altes Sieb', 'Old Sieve'), icon: '⚱️', rarity: 'start', cls: 'sieber',
    text: T('Erster Primzahl-Treffer jedes Zuges: ziehe 1 Karte.', 'First prime hit each turn: draw 1 card.'),
    onTurnStart: c => { c.powers._siebUsed = 0; },
    onPrime: c => { if (!c.powers._siebUsed) { c.powers._siebUsed = 1; c.drawCards(1); } } },
  { id: 'phiole', name: T('Restphiole', 'Residue Vial'), icon: '🧪', rarity: 'start', cls: 'modula',
    text: T('Kampfbeginn: 3 Zerfall an allen Gegnern.', 'Combat start: apply 3 Decay to all enemies.'),
    onCombatStart: c => c.poison(3, true) },
  { id: 'wuerfelbecher', name: T('Würfelbecher', 'Dice Cup'), icon: '🎲', rarity: 'start', cls: 'wuerfel',
    text: T('Würfe unter 3 werden einmal neu gewürfelt. +10 % Gold.', 'Rolls below 3 are rerolled once. +10 % gold.'),
    modGold: n => (n > 0 ? Math.round(n * 1.1) : n) },

  // ======================================================================================= gewöhnlich
  { id: 'kompass', name: T('Primkompass', 'Prime Compass'), icon: '🧭', rarity: 'common',
    text: T('Kampfbeginn: 6 Block.', 'Combat start: gain 6 block.'), onCombatStart: c => c.gainBlock(6) },
  { id: 'abakus', name: T('Abakus', 'Abacus'), icon: '🧮', rarity: 'common',
    text: T('Jeder 3. gespielte Angriff: +1 Energie.', 'Every 3rd attack played: +1 energy.'),
    onCardPlayed: (c, _k, d) => { if (d.type === 'atk') { c.powers._abk = (c.powers._abk ?? 0) + 1; if (c.powers._abk % 3 === 0) c.gainEnergy(1); } } },
  { id: 'goldzahn', name: T('Goldzahn', 'Gold Tooth'), icon: '🦷', rarity: 'common',
    text: T('+1 Gold je Primzahl-Treffer.', '+1 gold per prime hit.'), onPrime: c => c.gainGold(1) },
  { id: 'kreide', name: T('Kreide', 'Chalk'), icon: '🖍️', rarity: 'common',
    text: T('+1 Stärke zu Kampfbeginn.', '+1 Strength at combat start.'), onCombatStart: c => { c.str += 1; } },
  { id: 'apfel', name: T('Newtons Apfel', 'Newton’s Apple'), icon: '🍎', rarity: 'common',
    text: T('+7 max. LP.', '+7 max HP.'), onRunStart: r => { r.run.maxHp += 7; r.run.hp += 7; } },
  { id: 'lineal', name: T('Lineal', 'Ruler'), icon: '📏', rarity: 'common',
    text: T('Nach jedem gewonnenen Kampf 4 LP heilen.', 'Heal 4 HP after every won combat.'), onCombatEnd: (r, won) => { if (won) r.heal(4); } },
  { id: 'eins', name: T('Die Eins', 'The One'), icon: '1️⃣', rarity: 'common',
    text: T('Zugbeginn: Summe startet bei 1.', 'Turn start: sum starts at 1.'), onTurnStart: c => { if (!c.powers.crown) c.setSum(1); } },
  { id: 'stoppuhr', name: T('Stoppuhr', 'Stopwatch'), icon: '⏱️', rarity: 'common',
    text: T('Zug 1: +1 Energie.', 'Turn 1: +1 energy.'), onTurnStart: c => { if (c.turn === 1) c.gainEnergy(1); } },

  // ======================================================================================= selten
  { id: 'zwillingsstern', name: T('Zwillingsstern', 'Twin Star'), icon: '✨', rarity: 'rare',
    text: T('Primzahl-Treffer ab Kombo 2: 3 Schaden an allen.', 'Prime hits at combo 2+: 3 damage to all.'), onPrime: (c, _s, k) => { if (k >= 2) c.dmg(3, { all: true, pierce: false }); } },
  { id: 'spirale', name: T('Ulam-Spirale', 'Ulam Spiral'), icon: '🌀', rarity: 'rare',
    text: T('Primzahl-Treffer: 2 Block.', 'Prime hit: 2 block.'), onPrime: c => c.gainBlock(2) },
  { id: 'brille', name: T('Gauß’ Brille', 'Gauss’ Glasses'), icon: '👓', rarity: 'rare',
    text: T('+1 Karte pro Zug.', '+1 card drawn per turn.'), onRunStart: r => { r.run.drawBonus += 1; } },
  { id: 'feder', name: T('Fermats Feder', 'Fermat’s Quill'), icon: '🪶', rarity: 'rare',
    text: T('Erste Karte jedes Kampfes wird kostenlos zweimal gespielt.', 'The first card of each combat is played twice.'),
    onCombatStart: c => { c.powers.double = 1; } },
  { id: 'magnet', name: T('Goldmagnet', 'Gold Magnet'), icon: '🧲', rarity: 'rare',
    text: T('+25 % Gold.', '+25 % gold.'), modGold: n => (n > 0 ? Math.round(n * 1.25) : n) },
  { id: 'dorn', name: T('Teilerdorn', 'Divisor Thorn'), icon: '🌵', rarity: 'rare',
    text: T('Treffer ohne Block gegen dich: Angreifer erleidet 3 Schaden.', 'When hit while unblocked: attacker takes 3 damage.') },
  { id: 'kristall', name: T('Primkristall', 'Prime Crystal'), icon: '💎', rarity: 'rare',
    text: T('Angriffe mit primer Kartenzahl: +3 Schaden.', 'Attacks with a prime card number: +3 damage.'),
    modDamage: (_c, d, card) => (card && typeof card.val === 'number' && isPrime(card.val) ? d + 3 : d) },
  { id: 'sanduhr', name: T('Sanduhr', 'Hourglass'), icon: '⌛', rarity: 'rare',
    text: T('Ungenutzte Energie bleibt (max. 2).', 'Unused energy carries over (max 2).'),
    onTurnEnd: c => { c.powers._carry = Math.min(2, c.energy); }, onTurnStart: c => { if (c.powers._carry) c.gainEnergy(c.powers._carry); c.powers._carry = 0; } },

  // ======================================================================================= episch
  { id: 'krone', name: T('Primzahlkrone', 'Prime Crown'), icon: '👑', rarity: 'epic',
    text: T('Kombo-Bonus +50 % statt +25 % je Stufe.', 'Combo bonus +50 % instead of +25 % per level.'), onRunStart: r => { r.run.mods.comboStep = 0.5; } },
  { id: 'reaktor', name: T('Zahlenreaktor', 'Number Reactor'), icon: '⚛️', rarity: 'epic',
    text: T('+1 Energie pro Zug.', '+1 energy per turn.'), onRunStart: r => { r.run.energyBonus += 1; } },
  { id: 'fraktal', name: T('Fraktal', 'Fractal'), icon: '❄️', rarity: 'epic',
    text: T('Kombo 3 erreicht: nächste Karte kostet 0.', 'Reaching combo 3: next card costs 0.'), onPrime: (c, _s, k) => { if (k === 3) c.powers.free = 1; } },
  { id: 'hydrakopf', name: T('Hydrakopf', 'Hydra Head'), icon: '🐉', rarity: 'epic',
    text: T('Gegner getötet: +1 Energie, ziehe 1.', 'Enemy killed: +1 energy, draw 1.'), onKill: c => { c.gainEnergy(1); c.drawCards(1); } },
  { id: 'spiegel', name: T('Zerrspiegel', 'Warped Mirror'), icon: '🪞', rarity: 'epic',
    text: T('Zugende: Restblock bleibt zur Hälfte.', 'End of turn: keep half of your block.') },

  // ======================================================================================= legendär
  { id: 'unendlich', name: T('Lemniskate', 'Lemniscate'), icon: '♾️', rarity: 'legendary',
    text: T('Kombo bricht nicht mehr ab – nur das Zugende setzt sie zurück.', 'Combo no longer breaks – only the end of turn resets it.'), onRunStart: r => { r.run.mods.keepCombo = 1; } },
  { id: 'zeta', name: T('Zeta-Kern', 'Zeta Core'), icon: '🌌', rarity: 'legendary',
    text: T('Jeder Primzahl-Treffer verursacht Summe ÷ 2 Schaden an allen.', 'Every prime hit deals sum ÷ 2 damage to all.'), onPrime: (c, s) => c.dmg(Math.floor(s / 2), { all: true }) },
  { id: 'phoenix', name: T('Phönixzahl', 'Phoenix Number'), icon: '🔥', rarity: 'legendary',
    text: T('Einmal pro Lauf: Statt zu sterben mit 50 % LP weiter.', 'Once per run: instead of dying, revive at 50 % HP.'), onRunStart: r => { r.run.mods.phoenix = 1; } },

  // ======================================================================================= verflucht (stark mit Nachteil)
  { id: 'blutpakt', name: T('Blutpakt', 'Blood Pact'), icon: '🩸', rarity: 'epic', cursed: true,
    text: T('+1 Energie pro Zug. FLUCH: −2 LP zu jedem Zugbeginn.', '+1 energy per turn. CURSE: −2 HP at every turn start.'),
    onRunStart: r => { r.run.energyBonus += 1; }, onTurnStart: c => c.hurtSelf(2) },
  { id: 'gierkrone', name: T('Krone der Gier', 'Crown of Greed'), icon: '💰', rarity: 'rare', cursed: true,
    text: T('+60 % Gold. FLUCH: Gegner haben +20 % LP.', '+60 % gold. CURSE: enemies have +20 % HP.'),
    modGold: n => (n > 0 ? Math.round(n * 1.6) : n), onRunStart: r => { r.run.mods.foeHp = (r.run.mods.foeHp ?? 0) + 0.2; } },
  { id: 'glaswaage', name: T('Gläserne Waage', 'Glass Scales'), icon: '⚖️', rarity: 'epic', cursed: true,
    text: T('Dein Schaden ×1,5. FLUCH: Du erhältst 25 % mehr Schaden.', 'Your damage ×1.5. CURSE: you take 25 % more damage.'),
    modDamage: (_c, d) => Math.round(d * 1.5), onRunStart: r => { r.run.mods.taken = (r.run.mods.taken ?? 0) + 0.25; } },
  { id: 'nebelkarte', name: T('Nebelkarte', 'Fog Map'), icon: '🌫️', rarity: 'rare', cursed: true,
    text: T('+2 Karten pro Zug. FLUCH: Ein Fluch kommt ins Deck.', '+2 cards per turn. CURSE: a curse joins your deck.'),
    onRunStart: r => { r.run.drawBonus += 2; r.addCard('zweifel'); } },
  { id: 'chaoswuerfel', name: T('Chaoswürfel', 'Chaos Die'), icon: '🎰', rarity: 'legendary', cursed: true,
    text: T('Zugbeginn: würfle – 6: +3 Energie, 1: −1 Energie.', 'Turn start: roll – 6: +3 energy, 1: −1 energy.'),
    onTurnStart: c => { const d = c.dice(); if (d === 6) { c.gainEnergy(3); c.log('🎰 6!'); } else if (d === 1) { c.gainEnergy(-1); c.log('🎰 1 …'); } } },
];

export const RELIC: Record<string, RelicDef> = Object.fromEntries(RELICS.map(r => [r.id, r]));
export const START_RELIC: Record<string, string> = { sieber: 'sieb', modula: 'phiole', wuerfel: 'wuerfelbecher' };
