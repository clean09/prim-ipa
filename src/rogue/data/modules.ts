// Schiffsmodule (dauerhafte Boni für einen Lauf). Neue Module: Eintrag mit passenden Haken (types.ts → ModuleDef).
import { ModuleDef } from '../types';
import { SYM } from './symbols';

const T = (de: string, en: string): [string, string] => [de, en];

export const MODULES: ModuleDef[] = [
  // ======================================================================================= Startmodule (je Schiff)
  { id: 'lumen', name: T('Lumens Glut', 'Lumen’s Ember'), icon: '☼', rarity: 'start', text: T('Erster Jackpot jedes Kampfes: 6 Hülle.', 'First jackpot each combat: 6 hull.'),
    onCombatStart: c => { c.powers._lumen = 0; }, onLine: (c, k) => { if (k === 'jackpot' && !c.powers._lumen) { c.powers._lumen = 1; c.heal(6); } } },
  { id: 'teleskop', name: T('Messingteleskop', 'Brass Telescope'), icon: '⌕', rarity: 'start', text: T('+15 % Gold. Kampfbeginn: 1 Leck auf alle.', '+15 % gold. Combat start: 1 Breach on all.'),
    modGold: n => (n > 0 ? Math.round(n * 1.15) : n), onCombatStart: c => c.expose(1, true) },
  { id: 'schmiede', name: T('Sonnenschmiede', 'Sun Forge'), icon: '⚒', rarity: 'start', text: T('Überladung kostet nur 2 Hülle und gibt 8 Schild.', 'Overload costs only 2 hull and grants 8 shield.'),
    onOverheat: c => { c.powers.overheatImmune = 1; c.hurtSelf(2); c.gainBlock(8); } },
  { id: 'schleier', name: T('Phantomschleier', 'Phantom Veil'), icon: '⌘', rarity: 'start', text: T('Kampfbeginn: 3 Strahlung auf alle. Strahlung +1.', 'Combat start: 3 radiation on all. Radiation +1.'),
    onCombatStart: c => { c.powers.radPlus = 1; c.irradiate(3, true); } },
  { id: 'singular', name: T('Singularitätskern', 'Singularity Core'), icon: '◎', rarity: 'start', text: T('Synergien mit Kosmos zählen als Jackpot-Hälfte: +4 Schaden an allen.', 'Cosmos synergies: +4 damage to all.'),
    onLine: (c, k, tag) => { if (tag === 'kosmos' || k === 'jackpot') c.dmg(4, { all: true }); } },

  // ======================================================================================= gewöhnlich
  { id: 'kuehlmantel', name: T('Kühlmantel', 'Cooling Jacket'), icon: '❄', rarity: 'common', text: T('Max. Hitze +1.', 'Max heat +1.'), onRunStart: r => { r.run.heatBonus += 1; } },
  { id: 'panzerplatten', name: T('Ornamentpanzer', 'Ornate Plating'), icon: '⛨', rarity: 'common', text: T('+8 max. Hülle.', '+8 max hull.'), onRunStart: r => { r.run.maxHp += 8; r.run.hp += 8; } },
  { id: 'zielhilfe', name: T('Zielhilfe', 'Targeting Aid'), icon: '⌖', rarity: 'common', text: T('Kampfbeginn: +1 Stärke (Waffen).', 'Combat start: +1 strength (weapons).'), onCombatStart: c => { c.str += 1; } },
  { id: 'schildbatterie', name: T('Schildbatterie', 'Shield Battery'), icon: '▮', rarity: 'common', text: T('Kampfbeginn: 8 Schild.', 'Combat start: 8 shield.'), onCombatStart: c => c.gainBlock(8) },
  { id: 'sparschwein', name: T('Goldener Skarabäus', 'Golden Scarab'), icon: '⁂', rarity: 'common', text: T('Nach jedem Sieg +8 Gold.', '+8 gold after every win.'), onCombatEnd: (r, w) => { if (w) r.gainGold(8); } },
  { id: 'notreparatur', name: T('Notreparatur', 'Field Repair'), icon: '⚒', rarity: 'common', text: T('Nach jedem Sieg 4 Hülle.', 'Heal 4 hull after every win.'), onCombatEnd: (r, w) => { if (w) r.heal(4); } },
  { id: 'erstschlag', name: T('Erstschlag-Kondensator', 'First Strike Capacitor'), icon: '↯', rarity: 'common', text: T('Erster Dreh jedes Kampfes: 6 Schaden an allen.', 'First spin each combat: 6 damage to all.'),
    onCombatStart: c => { c.powers._first = 1; }, onSpin: c => { if (c.powers._first) { c.powers._first = 0; c.dmg(6, { all: true }); } } },
  { id: 'glueckskaefer', name: T('Glückskäfer', 'Lucky Beetle'), icon: '⁂', rarity: 'common', text: T('Jede Synergie: +2 Gold.', 'Every synergy: +2 gold.'), onLine: c => c.gainGold(2) },
  { id: 'abwehrdorn', name: T('Dornenkranz', 'Thorn Wreath'), icon: '❧', rarity: 'common', text: T('Angreifer erleiden 2 Schaden.', 'Attackers take 2 damage.'), onCombatStart: c => { c.powers.thorns = Math.max(c.powers.thorns ?? 0, 2); } },
  { id: 'spaetzuender', name: T('Spätzünder', 'Late Igniter'), icon: '☉', rarity: 'common', text: T('Letzter Dreh im Zug: 5 Schaden.', 'Last spin of the turn: 5 damage.'), onSpin: c => { if (c.spinsLeft === 0) c.dmg(5); } },

  // ======================================================================================= selten
  { id: 'dritterdreh', name: T('Vierter Hebel', 'Fourth Lever'), icon: '♣', rarity: 'rare', text: T('+1 Dreh pro Zug.', '+1 spin per turn.'), onRunStart: r => { r.run.spinBonus += 1; } },
  { id: 'lilienfilter', name: T('Lilienfilter', 'Lily Filter'), icon: '⚜', rarity: 'rare', text: T('Zugbeginn: −1 Hitze extra.', 'Turn start: −1 extra heat.'), onCombatStart: c => { c.powers.cool = (c.powers.cool ?? 0) + 1; } },
  { id: 'jackpotkranz', name: T('Jackpot-Kranz', 'Jackpot Wreath'), icon: '✺', rarity: 'rare', text: T('Jeder Jackpot: 10 Schaden an allen.', 'Every jackpot: 10 damage to all.'), onLine: (c, k) => { if (k === 'jackpot') c.dmg(10, { all: true }); } },
  { id: 'synergiespule', name: T('Resonanzspule', 'Resonance Coil'), icon: '◎', rarity: 'rare', text: T('Jede Synergie: 3 Schild.', 'Every synergy: 3 shield.'), onLine: (c, k) => { if (k === 'synergy') c.gainBlock(3); } },
  { id: 'kopfgeld', name: T('Kassiks Kopfgeldmarke', 'Kassik’s Bounty Tag'), icon: '⌗', rarity: 'rare', text: T('Jeder Abschuss: +5 Gold.', 'Every kill: +5 gold.'), onKill: c => c.gainGold(5) },
  { id: 'hitzetauscher', name: T('Hitzetauscher', 'Heat Exchanger'), icon: '♨', rarity: 'rare', text: T('Zugende: Restschild = Hitze × 2.', 'End of turn: gain heat × 2 shield.'), onTurnEnd: c => c.gainBlock(c.heat * 2) },
  { id: 'brakkszange', name: T('Brakks Zange', 'Brakk’s Pliers'), icon: '⚒', rarity: 'rare', text: T('Rasten repariert +15 % mehr; Aufwerten kostet nichts extra.', 'Resting heals +15 %.'), onRunStart: r => { r.run.mods.restBonus = (r.run.mods.restBonus ?? 0) + 0.15; } },
  { id: 'mottenlampe', name: T('Mottenlampe', 'Moth Lamp'), icon: '☉', rarity: 'rare', text: T('Kampfbeginn: Gegner 2 Schwäche.', 'Combat start: enemies 2 Weak.'), onCombatStart: c => c.weaken(2, true) },
  { id: 'magnetfalle', name: T('Magnetfalle', 'Magnet Trap'), icon: '∩', rarity: 'rare', text: T('+30 % Gold.', '+30 % gold.'), modGold: n => (n > 0 ? Math.round(n * 1.3) : n) },
  { id: 'kristalllinse', name: T('Kristalllinse', 'Crystal Lens'), icon: '◍', rarity: 'rare', text: T('Waffen-Symbole +2 Schaden.', 'Weapon symbols +2 damage.'), modDamage: (_c, d, s) => (s?.tag === 'waffe' ? d + 2 : d) },
  { id: 'reaktorgitter', name: T('Jugendstil-Gitter', 'Art Nouveau Grille'), icon: '▦', rarity: 'rare', text: T('Überladung: Reaktor kühlt sofort auf 0.', 'Overload: reactor instantly cools to 0.'), onOverheat: c => { c.addHeat(-99); } },
  { id: 'nachbrenner', name: T('Nachbrenner', 'Afterburner'), icon: '♨', rarity: 'rare', text: T('Zugbeginn: 4 Schaden an zufälligem Gegner.', 'Turn start: 4 damage to a random enemy.'), onTurnStart: c => c.dmg(4, { random: true }) },

  // ======================================================================================= episch
  { id: 'doppelreaktor', name: T('Zwillingsreaktor', 'Twin Reactor'), icon: '☯', rarity: 'epic', text: T('+2 max. Hitze, +1 Dreh.', '+2 max heat, +1 spin.'), onRunStart: r => { r.run.heatBonus += 2; r.run.spinBonus += 1; } },
  { id: 'sternensaite', name: T('Sternensaite', 'Star String'), icon: '♪', rarity: 'epic', text: T('Jede Synergie: 4 Schaden an allen.', 'Every synergy: 4 damage to all.'), onLine: (c, k) => { if (k === 'synergy') c.dmg(4, { all: true }); } },
  { id: 'phoenixkapsel', name: T('Phönixkapsel', 'Phoenix Pod'), icon: '❦', rarity: 'epic', text: T('Einmal pro Lauf: statt zu sterben mit 50 % Hülle weiter.', 'Once per run: instead of dying, continue with 50 % hull.'), onRunStart: r => { r.run.mods.phoenix = 1; } },
  { id: 'vaelsauge', name: T('Vaels drittes Auge', 'Vael’s Third Eye'), icon: '◉', rarity: 'epic', text: T('Kampfbeginn: alle Gegner 2 Leck + 2 Schwäche.', 'Combat start: all enemies 2 Breach + 2 Weak.'), onCombatStart: c => { c.expose(2, true); c.weaken(2, true); } },
  { id: 'strahlenkrone', name: T('Strahlenkrone', 'Radiant Crown'), icon: '♛', rarity: 'epic', text: T('Strahlung, die du verteilst: +2.', 'Radiation you apply: +2.'), onCombatStart: c => { c.powers.radPlus = (c.powers.radPlus ?? 0) + 2; } },
  { id: 'schildspiegel', name: T('Facettenspiegel', 'Facet Mirror'), icon: '◐', rarity: 'epic', text: T('Die Hälfte des Schilds bleibt über den Zug.', 'Half your shield carries over.'), onCombatStart: c => { c.powers.keepBlock = 1; } },
  { id: 'goldader', name: T('Goldader', 'Gold Vein'), icon: '⛏', rarity: 'epic', text: T('Technik-Symbole: +1 Gold beim Feuern.', 'Tech symbols: +1 gold when firing.'),
    onSpin: c => { const n = c.count((_s, d) => d.tag === 'technik'); if (n) c.gainGold(n); } },

  // ======================================================================================= legendär
  { id: 'lumensherz', name: T('Lumens zweites Herz', 'Lumen’s Second Heart'), icon: '♡', rarity: 'legendary', text: T('Jeder Jackpot: +12 Hülle und +1 Dreh.', 'Every jackpot: +12 hull and +1 spin.'), onLine: (c, k) => { if (k === 'jackpot') { c.heal(12); c.addSpins(1); } } },
  { id: 'kaiserwalze', name: T('Kaiserwalze', 'Imperial Reel'), icon: '⌂', rarity: 'legendary', text: T('Alle Linienfaktoren +1 (Synergie ×3, Jackpot ×4).', 'All line multipliers +1 (synergy ×3, jackpot ×4).'), onRunStart: r => { r.run.mods.lineBonus = 1; } },
  { id: 'ewigerorbit', name: T('Ewiger Orbit', 'Eternal Orbit'), icon: '♾', rarity: 'legendary', text: T('Drehs heizen nicht mehr auf – nur gehaltene Walzen.', 'Spins no longer heat up – only held reels do.'), onRunStart: r => { r.run.mods.noSpinHeat = 1; } },

  // ======================================================================================= verflucht (starker Vorteil mit Nachteil)
  { id: 'blutreaktor', name: T('Blutreaktor', 'Blood Reactor'), icon: '♦', rarity: 'epic', cursed: true, text: T('+1 Dreh. FLUCH: Zugbeginn −2 Hülle.', '+1 spin. CURSE: −2 hull at turn start.'),
    onRunStart: r => { r.run.spinBonus += 1; }, onTurnStart: c => c.hurtSelf(2) },
  { id: 'ozzosvertrag', name: T('Ozzos Vertrag', 'Ozzo’s Contract'), icon: '§', rarity: 'rare', cursed: true, text: T('+60 % Gold. FLUCH: Gegner +20 % Hülle.', '+60 % gold. CURSE: enemies +20 % hull.'),
    modGold: n => (n > 0 ? Math.round(n * 1.6) : n), onRunStart: r => { r.run.mods.foeHp = (r.run.mods.foeHp ?? 0) + 0.2; } },
  { id: 'glasreaktor', name: T('Gläserner Reaktor', 'Glass Reactor'), icon: '♢', rarity: 'epic', cursed: true, text: T('Schaden ×1,5. FLUCH: du erleidest 25 % mehr.', 'Damage ×1.5. CURSE: you take 25 % more.'),
    modDamage: (_c, d) => Math.round(d * 1.5), onRunStart: r => { r.run.mods.taken = (r.run.mods.taken ?? 0) + 0.25; } },
  { id: 'schrottmagnet', name: T('Schrottmagnet', 'Junk Magnet'), icon: '✕', rarity: 'rare', cursed: true, text: T('+2 max. Hitze, +10 max. Hülle. FLUCH: 2 Schrott auf den Walzen.', '+2 max heat, +10 max hull. CURSE: 2 junk on your reels.'),
    onRunStart: r => { r.run.heatBonus += 2; r.run.maxHp += 10; r.run.hp += 10; r.addSymbol('schrott', 0); r.addSymbol('schrott', 2); } },
  { id: 'architektenmuenze', name: T('Münze des Architekten', 'Architect’s Coin'), icon: '✦', rarity: 'legendary', cursed: true, text: T('Zugbeginn: Münzwurf – Kopf +2 Drehs, Zahl +3 Hitze.', 'Turn start: coin flip – heads +2 spins, tails +3 heat.'),
    onTurnStart: c => { if (c.rnd() < 0.5) { c.addSpins(2); c.log(T('✦ Kopf! +2 Drehs', '✦ Heads! +2 spins')); } else { c.addHeat(3); c.log(T('✦ Zahl … +3 Hitze', '✦ Tails … +3 heat')); } } },
  // ======================================================================================= v4.10
  { id: 'minimalist', name: T('Linse des Einsiedlers', 'Hermit’s Lens'), icon: '◌', rarity: 'rare', text: T('Höchstens 13 Symbole im Reaktor: alle Schadenssymbole +3.', 'At most 13 symbols in your reactor: all damage symbols +3.'),
    modDamage: (c, d, sym) => (sym && c.run.reels.flat().length <= 13 ? d + 3 : d) },
  { id: 'ankerkette', name: T('Ankerkette', 'Anchor Chain'), icon: '⊥', rarity: 'common', text: T('Kampfbeginn: 8 Schild.', 'Combat start: 8 shield.'), onCombatStart: c => c.gainBlock(8) },
  { id: 'sternkompass', name: T('Sternkompass', 'Star Compass'), icon: '✣', rarity: 'common', text: T('Sofort: 3 kostenlose Neuwürfe.', 'Now: 3 free rerolls.'), onRunStart: r => { r.run.mods.freeRerolls = (r.run.mods.freeRerolls ?? 0) + 3; } },
  { id: 'gezeitenuhr', name: T('Gezeitenuhr', 'Tide Clock'), icon: '⧗', rarity: 'rare', text: T('Jede 3. Runde: +1 Dreh.', 'Every 3rd turn: +1 spin.'), onTurnStart: c => { if (c.turn % 3 === 0) c.addSpins(1); } },
  { id: 'perlenkette', name: T('Perlenkette von Kesh', 'Pearls of Kesh'), icon: '○', rarity: 'rare', text: T('Nach jedem Sieg: 5 Hülle.', 'After every victory: 5 hull.'), onCombatEnd: (r, won) => { if (won) r.heal(5); } },
  { id: 'kristallherz', name: T('Kristallherz', 'Crystal Heart'), icon: '◈', rarity: 'epic', text: T('Jede Synergie-Linie: 3 Schaden an allen.', 'Every synergy line: 3 damage to all.'), onLine: (c, k) => { if (k === 'synergy') c.dmg(3, { all: true }); } },
  { id: 'sturmglas', name: T('Sturmglas', 'Storm Glass'), icon: '↯', rarity: 'epic', text: T('Überladung: 12 Schaden an allen Gegnern.', 'Overload: 12 damage to all enemies.'), onOverheat: c => { c.dmg(12, { all: true }); } },
  { id: 'schuldschein', name: T('Ozzos Schuldschein', 'Ozzo’s IOU'), icon: '¤', rarity: 'rare', cursed: true, text: T('Sofort +120 Gold. FLUCH: du erleidest 10 % mehr Schaden.', 'Now +120 gold. CURSE: you take 10 % more damage.'),
    onRunStart: r => { r.gainGold(120); r.run.mods.taken = (r.run.mods.taken ?? 0) + 0.1; } },
];

export const MOD: Record<string, ModuleDef> = Object.fromEntries(MODULES.map(m => [m.id, m]));
export { SYM };
