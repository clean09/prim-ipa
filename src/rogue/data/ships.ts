// Schiffe (Klassen) und der Forschungsbaum („Sternenkarte“): alles, was über Wochen freigeschaltet wird.
// Kosten sind so gewählt, dass bei 3–4 Läufen am Tag rund vier Wochen lang Neues dazukommt.
import { ShipDef } from '../types';

const T = (de: string, en: string): [string, string] => [de, en];

export const SHIPS: ShipDef[] = [
  { id: 'kreuzer', name: T('Lumen-Kreuzer', 'Lumen Cruiser'), hull: 'kreuzer', hue: 35, hp: 72, gold: 99, heatMax: 6, spins: 3, module: 'lumen',
    text: T('Ilyas Kurierschiff. Ausgewogen, verzeiht Fehler.', 'Ilya’s courier ship. Balanced and forgiving.'),
    reels: [['laser', 'laser', 'schild', 'credit', 'stern'], ['laser', 'schild', 'reparatur', 'laser', 'mond'], ['torpedo', 'schild', 'laser', 'credit', 'stern']] },
  { id: 'astrolab', name: T('Messing-Astrolab', 'Brass Astrolabe'), hull: 'forscher', hue: 45, hp: 64, gold: 160, heatMax: 6, spins: 3, module: 'teleskop', unlock: 'u-astrolab',
    text: T('Forschungsschiff: Gold, Spähsatelliten, Technik-Synergien.', 'Research vessel: gold, scout satellites, tech synergies.'),
    reels: [['credit', 'satellit', 'laser', 'kuehler', 'schild'], ['schuerfer', 'credit', 'schild', 'satellit', 'laser'], ['laser', 'kuehler', 'credit', 'schild', 'lichtfeder']] },
  { id: 'nachtfalter', name: T('Nachtfalter', 'Night Moth'), hull: 'phantom', hue: 285, hp: 62, gold: 99, heatMax: 6, spins: 3, module: 'schleier', unlock: 'u-nachtfalter',
    text: T('Vaels Mottenschiff: Strahlung und Schwäche, leise und tödlich.', 'Vael’s moth ship: radiation and weakness, quiet and deadly.'),
    reels: [['strahler', 'laser', 'schild', 'motte', 'strahler'], ['schild', 'strahler', 'laser', 'mond', 'nebelschleier'], ['laser', 'schild', 'strahler', 'lotus', 'laser']] },
  { id: 'amboss', name: T('Sonnenamboss', 'Sun Anvil'), hull: 'titan', hue: 15, hp: 86, gold: 80, heatMax: 8, spins: 3, module: 'schmiede', unlock: 'u-amboss',
    text: T('Brakks Schlachtschiff: riesige Hitze, schwere Geschütze.', 'Brakk’s battleship: huge heat capacity, heavy guns.'),
    reels: [['torpedo', 'kuppel', 'laser', 'kuehler', 'torpedo'], ['plasma', 'schild', 'kuehler', 'laser', 'schild'], ['torpedo', 'laser', 'kuppel', 'kuehler', 'rakete']] },
  { id: 'spirale', name: T('Die Spirale', 'The Spiral'), hull: 'singular', hue: 265, hp: 66, gold: 99, heatMax: 6, spins: 3, module: 'singular', unlock: 'u-spirale',
    text: T('Experimentalschiff mit einem Wurmloch im Bug. Kosmos-Synergien, Chaos.', 'Experimental ship with a wormhole in its bow. Cosmos synergies, chaos.'),
    reels: [['wurmloch', 'stern', 'libelle', 'mond', 'laser'], ['stern', 'pulsar', 'mond', 'schild', 'libelle'], ['libelle', 'stern', 'schild', 'mond', 'stern']] },
];
export const SHIP: Record<string, ShipDef> = Object.fromEntries(SHIPS.map(s => [s.id, s]));

// ------------------------------------------------------------------------------------------- Forschungsbaum
export type NodeType = 'ship' | 'sector' | 'pack' | 'deck' | 'talent';
export interface ResearchNode {
  id: string; type: NodeType; icon: string; name: [string, string]; text: [string, string];
  cost: (lv: number) => number; max: number; needs?: string[];
}

export const RESEARCH: ResearchNode[] = [
  // Schiffe
  { id: 'u-astrolab', type: 'ship', icon: '⌕', name: T('Messing-Astrolab', 'Brass Astrolabe'), text: T('Neues Schiff: Gold und Technik.', 'New ship: gold and tech.'), cost: () => 220, max: 1 },
  { id: 'u-nachtfalter', type: 'ship', icon: '❦', name: T('Nachtfalter', 'Night Moth'), text: T('Neues Schiff: Strahlung.', 'New ship: radiation.'), cost: () => 480, max: 1, needs: ['u-astrolab'] },
  { id: 'u-amboss', type: 'ship', icon: '⚒', name: T('Sonnenamboss', 'Sun Anvil'), text: T('Neues Schiff: Hitze und schwere Waffen.', 'New ship: heat and heavy guns.'), cost: () => 760, max: 1, needs: ['u-nachtfalter'] },
  { id: 'u-spirale', type: 'ship', icon: '◎', name: T('Die Spirale', 'The Spiral'), text: T('Neues Schiff: Wurmlöcher und Kosmos.', 'New ship: wormholes and cosmos.'), cost: () => 1300, max: 1, needs: ['u-amboss'] },
  // Sektoren (zweite Varianten je Stufe)
  { id: 's-frost', type: 'sector', icon: '❄', name: T('Frostring von Boreal', 'Frost Ring of Boreal'), text: T('Neuer Sektor (Akt 1) mit 2 neuen Bossen.', 'New sector (act 1) with 2 new bosses.'), cost: () => 300, max: 1 },
  { id: 's-pulsar', type: 'sector', icon: '♜', name: T('Das Leuchtfeuer-Feld', 'The Beacon Field'), text: T('Neuer Sektor (Akt 3) mit 2 neuen Bossen.', 'New sector (act 3) with 2 new bosses.'), cost: () => 650, max: 1, needs: ['s-frost'] },
  { id: 's-kern', type: 'sector', icon: '☀', name: T('Der Galaktische Kern', 'The Galactic Core'), text: T('Neuer Sektor (Akt 5) mit 2 neuen Bossen.', 'New sector (act 5) with 2 new bosses.'), cost: () => 1100, max: 1, needs: ['s-pulsar'] },
  // Symbolpakete
  { id: 'p-arsenal', type: 'pack', icon: '⌖', name: T('Arsenal', 'Arsenal'), text: T('Schienenkanone, Phaserkranz', 'Railgun, Phaser Crown'), cost: () => 260, max: 1 },
  { id: 'p-handel', type: 'pack', icon: '✦', name: T('Handelsgilde', 'Trade Guild'), text: T('Ringplaneten-Bank, Pfauenkomet', 'Ring Planet Bank, Peacock Comet'), cost: () => 320, max: 1 },
  { id: 'p-sonne', type: 'pack', icon: '☼', name: T('Sonnenfeuer', 'Sunfire'), text: T('Sonnenlanze', 'Sun Lance'), cost: () => 340, max: 1, needs: ['p-arsenal'] },
  { id: 'p-zeit', type: 'pack', icon: '⧗', name: T('Zeitkristalle', 'Time Crystals'), text: T('Zeitkristall', 'Time Crystal'), cost: () => 380, max: 1 },
  { id: 'p-geist', type: 'pack', icon: '☽', name: T('Logikgeister', 'Logic Ghosts'), text: T('Logikgeist', 'Logic Ghost'), cost: () => 420, max: 1, needs: ['p-zeit'] },
  { id: 'p-sternbild', type: 'pack', icon: '✧', name: T('Sternbilder', 'Constellations'), text: T('Sternbild, Sphärenharfe', 'Constellation, Harp of Spheres'), cost: () => 560, max: 1, needs: ['p-handel'] },
  { id: 'p-krone', type: 'pack', icon: '♛', name: T('Kaiserliche Schatzkammer', 'Imperial Treasury'), text: T('Kaiserkrone', 'Imperial Crown'), cost: () => 950, max: 1, needs: ['p-sternbild', 'p-geist'] },
  // Startdecks (Konstellationen)
  { id: 'd-isotop', type: 'deck', icon: '☢', name: T('Startdeck Isotopen', 'Starter deck Isotopes'), text: T('Strahlung, die sich aufschaukelt.', 'Radiation that builds up.'), cost: () => 180, max: 1 },
  { id: 'd-uhrwerk', type: 'deck', icon: '⚙', name: T('Startdeck Uhrwerk', 'Starter deck Clockwork'), text: T('Halten, Schubsen, mehr Drehs.', 'Hold, nudge, more spins.'), cost: () => 280, max: 1 },
  { id: 'd-leere', type: 'deck', icon: '◬', name: T('Startdeck Leerenzeichen', 'Starter deck Void Sigils'), text: T('Schwächen und aufbrechen.', 'Weaken and breach.'), cost: () => 380, max: 1, needs: ['d-isotop'] },
  { id: 'd-chor', type: 'deck', icon: '✧', name: T('Startdeck Himmelschor', 'Starter deck Celestial Choir'), text: T('Synergien heilen, Kosmos wird Joker.', 'Synergies heal, cosmos turns wild.'), cost: () => 520, max: 1, needs: ['d-uhrwerk'] },
  // Talente (mehrstufig)
  { id: 't-huelle', type: 'talent', icon: '⛨', name: T('Verstärkte Hülle', 'Reinforced Hull'), text: T('+6 max. Hülle je Stufe', '+6 max hull per level'), cost: lv => 60 + lv * 45, max: 5 },
  { id: 't-gold', type: 'talent', icon: '✦', name: T('Erbschaft', 'Inheritance'), text: T('+25 Startgold je Stufe', '+25 starting gold per level'), cost: lv => 50 + lv * 40, max: 4 },
  { id: 't-glueck', type: 'talent', icon: '♣', name: T('Sternenglück', 'Star Luck'), text: T('Seltenere Angebote, Proben +2 % je Stufe', 'Rarer offers, checks +2 % per level'), cost: lv => 90 + lv * 60, max: 4 },
  { id: 't-reroll', type: 'talent', icon: '↻', name: T('Zweite Chance', 'Second Chance'), text: T('+1 kostenloser Reroll je Stufe', '+1 free reroll per level'), cost: lv => 80 + lv * 70, max: 3 },
  { id: 't-hitze', type: 'talent', icon: '❄', name: T('Kühlkreislauf', 'Coolant Loop'), text: T('+1 max. Hitze', '+1 max heat'), cost: lv => 300 + lv * 300, max: 2 },
  { id: 't-modul', type: 'talent', icon: '◊', name: T('Fundstück', 'Heirloom'), text: T('Start mit zufälligem gewöhnlichem Modul', 'Start with a random common module'), cost: () => 260, max: 1 },
  { id: 't-staub', type: 'talent', icon: '✧', name: T('Sternensammler', 'Star Collector'), text: T('+10 % Sternenstaub je Stufe', '+10 % stardust per level'), cost: lv => 120 + lv * 90, max: 5 },
  { id: 't-rast', type: 'talent', icon: '⚒', name: T('Brakks Werkstatt', 'Brakk’s Workshop'), text: T('Raumstation repariert +10 % je Stufe', 'Station repairs +10 % per level'), cost: lv => 110 + lv * 80, max: 2 },
  { id: 't-drehung', type: 'talent', icon: '♣', name: T('Lockerer Hebel', 'Loose Lever'), text: T('Erster Zug jedes Kampfes: +1 Dreh', 'First turn of each combat: +1 spin'), cost: () => 700, max: 1, needs: ['t-hitze'] },
];
export const RNODE: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map(r => [r.id, r]));

/** Wöchentliche Expedition: fester Seed je Kalenderwoche + Mutatoren. */
export const MUTATORS: { id: string; name: [string, string]; text: [string, string]; staub: number }[] = [
  { id: 'glas', name: T('Glaskanonen', 'Glass Cannons'), text: T('Alle verursachen 50 % mehr Schaden – auch die Gegner.', 'Everyone deals 50 % more damage – enemies too.'), staub: 0.3 },
  { id: 'heiss', name: T('Hitzewelle', 'Heat Wave'), text: T('−1 max. Hitze, aber +1 Dreh.', '−1 max heat, but +1 spin.'), staub: 0.2 },
  { id: 'reich', name: T('Goldrausch', 'Gold Rush'), text: T('Doppeltes Gold, Händler doppelt so teuer.', 'Double gold, merchants twice as expensive.'), staub: 0.1 },
  { id: 'schrott', name: T('Schrottplatz', 'Junkyard'), text: T('Start mit 3 Schrott auf den Walzen.', 'Start with 3 junk on your reels.'), staub: 0.3 },
  { id: 'bosse', name: T('Riesen', 'Giants'), text: T('Bosse +30 % Hülle.', 'Bosses +30 % hull.'), staub: 0.4 },
  { id: 'casino', name: T('Hausvorteil', 'House Edge'), text: T('Mehr Casinos auf der Karte, Jackpots doppelt so oft.', 'More casinos on the map, jackpots twice as likely.'), staub: 0.1 },
];
