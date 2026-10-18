// Gegner-Eigenschaften: Stärken (gegen bestimmte Decks) und Schwächen (für bestimmte Decks). Jede Eigenschaft ist das
// Gegenstück einer Konstellation – so muss das Deck zum Sektor passen. Wirkung im Reaktor (has(f, id)).
import { Tx } from '../types';

const T = (de: string, en: string): Tx => [de, en];

export interface TraitDef { id: string; icon: string; good: boolean; name: Tx; text: Tx; counters?: string }

export const TRAITS: TraitDef[] = [
  // ---- Stärken (rot) – kontern eine Konstellation
  { id: 'panzer', icon: '⛊', good: false, counters: 'schwarm', name: T('Gepanzert', 'Armoured'), text: T('Jeder deiner Treffer −3 Schaden. Große Einzeltreffer sind gefragt.', 'Each of your hits −3 damage. Big single hits needed.') },
  { id: 'dornen', icon: '✶', good: false, counters: 'schwarm', name: T('Dornenhaut', 'Thorn Hide'), text: T('Jeder Treffer gegen ihn kostet dich 1 Hülle.', 'Every hit against it costs you 1 hull.') },
  { id: 'ausweichend', icon: '≈', good: false, counters: 'schwarm', name: T('Ausweichend', 'Evasive'), text: T('Zufalls- und Mehrfachtreffer verfehlen ihn zu 35 %.', 'Random and multi-hits miss it 35 % of the time.') },
  { id: 'strahlfest', icon: '⊘', good: false, counters: 'isotop', name: T('Strahlungsfest', 'Rad-Proof'), text: T('Strahlung wirkt nicht.', 'Radiation has no effect.') },
  { id: 'regen', icon: '✚', good: false, counters: 'bollwerk', name: T('Regeneration', 'Regeneration'), text: T('Heilt jeden Zug 6 % seiner Lebenspunkte. Langsame Decks verlieren.', 'Heals 6 % of its HP every turn. Slow decks lose.') },
  { id: 'schildbrecher', icon: '⚡', good: false, counters: 'bollwerk', name: T('Schildbrecher', 'Shield Breaker'), text: T('Deine Schilde halten gegen ihn nur halb.', 'Your shields only work half against it.') },
  { id: 'langfinger', icon: '🪝', good: false, counters: 'gilde', name: T('Langfinger', 'Pickpocket'), text: T('Jeder Treffer gegen dich stiehlt 4 Gold.', 'Every hit on you steals 4 gold.') },
  { id: 'unbeugsam', icon: '◆', good: false, counters: 'leere', name: T('Unbeugsam', 'Unyielding'), text: T('Immun gegen Schwäche, Leck und Stase.', 'Immune to Weak, Breach and stasis.') },
  { id: 'frostaura', icon: '❄', good: false, counters: 'glut', name: T('Frostaura', 'Frost Aura'), text: T('Deine max. Hitze −1, und Hitze-Boni der Waffen wirken nicht.', 'Your max heat −1, and weapon heat bonuses do nothing.') },
  // ---- Schwächen (grün) – belohnen eine Konstellation
  { id: 'sproede', icon: '✕', good: true, counters: 'glut', name: T('Spröde', 'Brittle'), text: T('Treffer ab 15 Schaden wirken ×1,5.', 'Hits of 15+ damage deal ×1.5.') },
  { id: 'aufgeblaeht', icon: '◎', good: true, counters: 'schwarm', name: T('Aufgebläht', 'Bloated'), text: T('Flächenschaden (an allen) wirkt doppelt.', 'Area damage (to all) deals double.') },
  { id: 'instabil', icon: '⌇', good: true, counters: 'bollwerk', name: T('Instabil', 'Unstable'), text: T('Rammstoß und schilddurchschlagende Treffer wirken doppelt.', 'Rams and shield-piercing hits deal double.') },
  { id: 'goldgierig', icon: '⚜', good: true, counters: 'gilde', name: T('Goldgierig', 'Gold-Hungry'), text: T('Für jedes Gold, das du im Kampf erhältst, erleidet er 1 Schaden.', 'Takes 1 damage for every gold you gain in combat.') },
  { id: 'strahlempf', icon: '☣', good: true, counters: 'isotop', name: T('Strahlungsempfindlich', 'Rad-Sensitive'), text: T('Strahlung wirkt doppelt.', 'Radiation deals double.') },
  { id: 'taktgeber', icon: '⧗', good: true, counters: 'uhrwerk', name: T('Taktgeber', 'Metronome'), text: T('Ab dem 3. Dreh eines Zuges erleidet er bei jedem Dreh 6 Schaden.', 'From the 3rd spin of a turn on, it takes 6 damage per spin.') },
  { id: 'leitend', icon: '⌁', good: true, counters: 'leere', name: T('Leitend', 'Conductive'), text: T('Leck wirkt ×2 statt ×1,5, Schwäche halbiert seinen Schaden.', 'Breach is ×2 instead of ×1.5, Weak halves its damage.') },
  { id: 'resonant', icon: '♫', good: true, counters: 'chor', name: T('Resonant', 'Resonant'), text: T('Jede Synergie-Linie: 4 Schaden an ihm, jeder Jackpot: 15.', 'Every synergy line: 4 damage to it, every jackpot: 15.') },
];
export const TRAIT: Record<string, TraitDef> = Object.fromEntries(TRAITS.map(t => [t.id, t]));

/** Eigenschaften je Gegner (Bosse 2–3, Elite 2, normale 1). */
export const TRAITS_OF: Record<string, string[]> = {
  // Singender Gürtel
  steinmotte: ['sproede'], schuerfdroide: ['panzer'], felsenkrabbe: ['panzer', 'sproede'], splitter: ['aufgeblaeht'], freibeuter: ['langfinger'],
  guertelwurm: ['regen', 'strahlempf'], rrekk: ['langfinger', 'leitend'], koenigin: ['panzer', 'resonant'], felsbrocken: ['sproede'],
  mahlstrom: ['langfinger', 'schildbrecher', 'goldgierig'],
  // Frostring
  eislibelle: ['ausweichend'], frostqualle: ['frostaura'], kristallspinne: ['dornen'], gletscherauge: ['sproede'], schneeschwarm: ['aufgeblaeht'],
  kristallkoloss: ['panzer', 'sproede'], eisseherin: ['frostaura', 'leitend'], boreas: ['frostaura', 'regen', 'strahlempf'],
  kathedrale: ['dornen', 'unbeugsam', 'resonant'], glasscherbe: ['sproede'],
  // Orion
  nebelqualle: ['strahlfest'], gasmotte: ['strahlempf'], pfauenwaechter: ['goldgierig'], tsoon: ['langfinger'], sporenschwarm: ['aufgeblaeht', 'regen'],
  liliengarde: ['unbeugsam', 'instabil'], tentakelprior: ['regen', 'leitend'], kaiserin: ['schildbrecher', 'resonant', 'leitend'],
  orionjaeger: ['ausweichend', 'regen', 'taktgeber'],
  // Leuchtfeuer-Feld
  pulsarwespe: ['ausweichend'], magnetauge: ['schildbrecher'], strahlenlibelle: ['strahlfest'], neutronenmech: ['panzer'], funkenschwarm: ['dornen', 'aufgeblaeht'],
  leuchtturm: ['regen', 'instabil'], zwillingspulsar: ['taktgeber', 'schildbrecher'], leuchtfeuer: ['strahlfest', 'sproede'], magnetar: ['schildbrecher', 'panzer', 'leitend'],
  // Ereignishorizont
  schattenmotte: ['leitend'], spaghettiwurm: ['regen'], horizontauge: ['unbeugsam'], gravqualle: ['instabil'], leerenjaeger: ['ausweichend'],
  akkretion: ['panzer', 'strahlfest'], zeitwaechter: ['panzer', 'taktgeber'], gargantua: ['regen', 'sproede', 'schildbrecher'], uhrmacher: ['regen', 'taktgeber', 'dornen'],
  // Kern
  sternenfresser: ['regen'], kernkristall: ['panzer'], quasarwaechter: ['strahlfest'], plasmaschwarm: ['dornen'], materiegolem: ['panzer', 'instabil'],
  sternenschmied: ['dornen', 'frostaura'], zwillingssonne: ['strahlfest', 'leitend'], sagittarius: ['regen', 'panzer', 'resonant'], sternenmutter: ['strahlfest', 'unbeugsam', 'goldgierig'],
  // Schiffsgrab von Kesh – Schrott & Diebe: Gilde wird bestohlen, Glut und Rammstöße knacken die Wracks
  wrackgeier: ['langfinger'], bergedrohne: ['panzer', 'instabil'], rostkrake: ['sproede'], geisterlotse: ['ausweichend', 'leitend'], nietenschwarm: ['aufgeblaeht'],
  abwrackkoloss: ['panzer', 'instabil'], ossa: ['unbeugsam', 'goldgierig'], werftmutter: ['panzer', 'instabil', 'resonant'], reparaturdrohne: ['sproede'],
  flaggschiff: ['schildbrecher', 'taktgeber', 'sproede'],
  // Lebendes Riff – heilt sich: langsame Decks verlieren, Isotope und Schwärme glänzen
  glutpolyp: ['regen', 'aufgeblaeht'], sternhai: ['dornen'], leuchtmuraene: ['strahlempf'], sporenqualle: ['strahlfest'], putzerschwarm: ['aufgeblaeht', 'strahlempf'],
  riffwaechter: ['regen', 'frostaura'], sternangler: ['langfinger', 'taktgeber'], riffmutter: ['regen', 'aufgeblaeht', 'strahlempf'], schlund: ['schildbrecher', 'sproede', 'taktgeber'],
  // Thal’Ora – Kristall und Glyphen: Panzer gegen Schwärme, aber spröde für Glut, resonant für den Chor
  kristallwaechter: ['panzer', 'sproede'], lichtrochen: ['ausweichend'], herzhueterin: ['strahlfest', 'resonant'], glyphenwurm: ['unbeugsam'], laternenschwarm: ['dornen', 'aufgeblaeht'],
  koenigswache: ['panzer', 'instabil'], nauile: ['frostaura', 'resonant'], leviathan: ['panzer', 'sproede', 'taktgeber'], herzstein: ['strahlfest', 'resonant', 'leitend'],
  // Sturm von Vhar – Hitze und Tempo: Uhrwerk und Leere im Vorteil
  blitzrochen: ['ausweichend', 'taktgeber'], sturmauge: ['leitend'], gewitterqualle: ['strahlempf'], wolkenwal: ['regen', 'instabil'], ionenschwarm: ['dornen', 'aufgeblaeht'],
  rhaz: ['schildbrecher', 'taktgeber'], ixa: ['frostaura', 'leitend'], sturmkoenig: ['schildbrecher', 'taktgeber', 'leitend'], hydra: ['regen', 'aufgeblaeht'], hydrakopf: ['sproede'],
  // Der Rand
  architekt: ['schildbrecher', 'goldgierig', 'strahlfest', 'taktgeber'], spiegel: ['dornen'],
};
export const traitsOf = (id: string) => TRAITS_OF[id] ?? [];
