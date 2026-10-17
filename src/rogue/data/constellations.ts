// Konstellationen = Deck-Archetypen. Jedes Symbol gehört zu höchstens einer. Wer 3 / 5 / 7 Symbole einer Konstellation
// auf seinen Walzen hat, schaltet deren Stufen I / II / III frei (Wirkung im Reaktor, Schlüssel = id + Stufe).
// Manche Konstellationen arbeiten gegeneinander (Glut will Hitze, Uhrwerk kühlt) – das ist Absicht.
import { Run, Tx } from '../types';

const T = (de: string, en: string): Tx => [de, en];

export interface ConstDef {
  id: string; name: Tx; icon: string; color: string; idea: Tx;
  tiers: [Tx, Tx, Tx];
  members: string[];
  /** Startdeck: ersetzt das jeweils letzte Symbol jeder Walze. */
  starter: [string, string, string];
  /** Forschungsknoten, der das Startdeck freischaltet (ohne = von Anfang an). */
  unlock?: string;
}

export const THRESH = [3, 5, 7];

export const CONSTELLATIONS: ConstDef[] = [
  { id: 'glut', name: T('Glutkern', 'Ember Core'), icon: '🜂', color: '#e8805a', idea: T('Lebe am Rand der Überladung. Hitze macht deine Waffen stärker.', 'Live at the edge of overload. Heat makes your weapons stronger.'),
    tiers: [T('+2 max. Hitze.', '+2 max heat.'), T('Waffen: +1 Schaden je Hitze.', 'Weapons: +1 damage per heat.'), T('Überladung schadet dir nicht und beendet den Zug nicht – sie trifft ALLE Gegner mit 12 + 2 × Hitze.', 'Overload neither hurts you nor ends your turn – it hits ALL enemies for 12 + 2 × heat.')],
    members: ['torpedo', 'plasma', 'railgun', 'sonnenlanze', 'supernova', 'schwarzloch', 'funke', 'glutherz'], starter: ['funke', 'torpedo', 'funke'] },
  { id: 'bollwerk', name: T('Bollwerk', 'Bulwark'), icon: '⛫', color: '#7fb3b0', idea: T('Schilde sammeln – und am Zugende als Rammstoß zurückgeben.', 'Stack shields – and return them as a ram at the end of your turn.'),
    tiers: [T('20 % deines Schilds bleiben über den Zug.', '20 % of your shield carries over.'), T('Zugende: Rammstoß = 20 % deines Schilds als Schaden.', 'End of turn: ram = 20 % of your shield as damage.'), T('Rammstoß = 40 % des Schilds, 40 % Schild bleiben.', 'Ram = 40 % of shield, 40 % shield carries over.')],
    members: ['deflektor', 'anker', 'kuppel', 'spiegel', 'kristallgitter', 'aegis', 'nanobots', 'rammsporn'], starter: ['deflektor', 'anker', 'deflektor'] },
  { id: 'schwarm', name: T('Schwarm', 'Swarm'), icon: '⁂', color: '#d9a06a', idea: T('Viele kleine Treffer statt eines großen.', 'Many small hits instead of one big one.'),
    tiers: [T('Mehrfach-, Zufalls- und Flächentreffer: +1 Schaden je Treffer.', 'Multi, random and area hits: +1 damage per hit.'), T('Mehrfachtreffer treffen einmal öfter.', 'Multi-hits hit one extra time.'), T('Jeder Schwarm-Treffer gibt dir 1 Schild.', 'Every swarm hit gives you 1 shield.')],
    members: ['doppellaser', 'rakete', 'nadel', 'flak', 'kometen', 'drohnen', 'meteor', 'pulsar', 'phaser'], starter: ['doppellaser', 'rakete', 'nadel'] },
  { id: 'gilde', name: T('Handelsgilde', 'Trade Guild'), icon: '⚖', color: '#d4a94c', idea: T('Gold ist Munition: je reicher, desto härter.', 'Gold is ammunition: the richer, the harder you hit.'),
    tiers: [T('+40 % Gold aus Symbolen.', '+40 % gold from symbols.'), T('Jede Münze aus Symbolen trifft dein Ziel mit 1 Schaden; Schadenssymbole +1 je 30 Gold (max. +6).', 'Every coin from symbols hits your target for 1; damage symbols +1 per 30 gold (max +6).'), T('Nach jedem Sieg 10 % Zinsen (max. 30).', 'After every victory 10 % interest (max 30).')],
    members: ['credit', 'schweif', 'schuerfer', 'lichtfeder', 'bank', 'pfau'], starter: ['schuerfer', 'schweif', 'credit'] },
  { id: 'isotop', name: T('Isotopen', 'Isotopes'), icon: '☢', color: '#a2c46a', idea: T('Langsames Gift, das sich aufschaukelt.', 'Slow poison that builds up.'),
    tiers: [T('Jede Strahlung, die du verteilst, +2.', 'Every radiation you apply +2.'), T('Strahlung auf Gegnern klingt nicht mehr ab.', 'Radiation on enemies no longer decays.'), T('Strahlung wirkt doppelt.', 'Radiation deals double damage.')],
    members: ['strahler', 'isotop', 'nebelschleier', 'halbwert', 'zerfall', 'fallout'], starter: ['strahler', 'zerfall', 'strahler'], unlock: 'd-isotop' },
  { id: 'uhrwerk', name: T('Uhrwerk', 'Clockwork'), icon: '⚙', color: '#c9a45c', idea: T('Kontrolle über die Walzen: halten, schubsen, öfter drehen.', 'Control the reels: hold, nudge, spin more.'),
    tiers: [T('Erste gehaltene/geschubste Walze je Dreh gratis, Reaktor kühlt 1 mehr ab.', 'First held/nudged reel per spin is free, reactor cools 1 more.'), T('+1 Dreh pro Zug.', '+1 spin per turn.'), T('Synergien zählen ×3 statt ×2.', 'Synergies count ×3 instead of ×2.')],
    members: ['sichel', 'kuehler', 'kryo', 'akku', 'radar', 'fabrik', 'sanduhr', 'harfe', 'krone'], starter: ['kuehler', 'sichel', 'akku'], unlock: 'd-uhrwerk' },
  { id: 'leere', name: T('Leerenzeichen', 'Void Sigils'), icon: '◬', color: '#9f8fd0', idea: T('Schwächen, aufbrechen, betäuben – dann zuschlagen.', 'Weaken, breach, stun – then strike.'),
    tiers: [T('Gegner mit Schwäche oder Leck erleiden +4 Schaden je Treffer.', 'Enemies with Weak or Breach take +4 damage per hit.'), T('Schwäche und Leck, die du verteilst, +1; dein Ziel bekommt zu Zugbeginn 1 Leck.', 'Weak and Breach you apply +1; your target gets 1 Breach at turn start.'), T('Gegner mit Schwäche UND Leck erleiden doppelten Schaden.', 'Enemies with Weak AND Breach take double damage.')],
    members: ['satellit', 'ionen', 'gravlanze', 'emp', 'motte', 'hacker', 'sternenauge'], starter: ['ionen', 'motte', 'satellit'], unlock: 'd-leere' },
  { id: 'chor', name: T('Himmelschor', 'Celestial Choir'), icon: '✧', color: '#a58fc9', idea: T('Harmonie der Linien: Synergien heilen, Kosmos wird zum Joker.', 'Harmony of lines: synergies heal, cosmos becomes wild.'),
    tiers: [T('Jede Synergie-Linie repariert 1 Hülle.', 'Every synergy line repairs 1 hull.'), T('Jackpot: +1 Dreh (einmal pro Zug).', 'Jackpot: +1 spin (once per turn).'), T('Kosmos-Symbole zählen in Linien als Joker.', 'Cosmos symbols count as wild in lines.')],
    members: ['stern', 'mond', 'libelle', 'lotus', 'orbit', 'sonnenwind', 'sternbild', 'quasar'], starter: ['libelle', 'stern', 'mond'], unlock: 'd-chor' },
];

export const CONST: Record<string, ConstDef> = Object.fromEntries(CONSTELLATIONS.map(c => [c.id, c]));
export const ARCH_OF: Record<string, string> = Object.fromEntries(CONSTELLATIONS.flatMap(c => c.members.map(m => [m, c.id])));

/** Anzahl Symbole je Konstellation auf allen Walzen. */
export function constCounts(run: Run): Record<string, number> {
  const out: Record<string, number> = {};
  for (const reel of run.reels) for (const s of reel) { const a = ARCH_OF[s.id]; if (a) out[a] = (out[a] ?? 0) + 1; }
  return out;
}
/** Erreichte Stufe (0–3) je Konstellation. */
export function constTiers(run: Run): Record<string, number> {
  const n = constCounts(run), out: Record<string, number> = {};
  for (const c of CONSTELLATIONS) out[c.id] = THRESH.filter(t => (n[c.id] ?? 0) >= t).length;
  return out;
}
/** Nächste Schwelle, oder null wenn Stufe III erreicht. */
export const nextThresh = (n: number) => THRESH.find(t => n < t) ?? null;
