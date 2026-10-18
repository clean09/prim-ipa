// Quellen der eingebauten Musik, Fotos und Texturen. Alles CC0 bzw. gemeinfrei (NASA); Bilder mit ESA-Anteil stehen
// unter CC BY 4.0 und brauchen diese Nennung. Für die App wurden Bilder getönt (tools/sf_assets.py) und Musik in
// Lautstärke und Klang angeglichen. Neue Assets: hier eintragen.
import { Tx } from '../types';

const T = (de: string, en: string): Tx => [de, en];

export interface Credit { what: Tx; title: string; by: string; license: string; url: string }

export const CREDITS: { group: Tx; items: Credit[] }[] = [
  { group: T('Musik', 'Music'), items: [
    { what: T('Brücke', 'Bridge'), title: 'Cathedral in the forest (ambient loop)', by: 'congusbongus', license: 'CC0', url: 'https://opengameart.org/content/cathedral-in-the-forest-ambient-loop' },
    { what: T('Sternenkarte', 'Star map'), title: 'Cosmic Navigation', by: 'Synth-thetic', license: 'CC0', url: 'https://opengameart.org/content/cosmic-navigation' },
    { what: T('Begegnungen, Rast', 'Encounters, rest'), title: 'Space Echo', by: 'Centurion_of_war', license: 'CC0', url: 'https://opengameart.org/content/space-echo' },
    { what: T('Kampf', 'Combat'), title: 'Battle Theme', by: 'Wolfgang_', license: 'CC0', url: 'https://opengameart.org/content/battle-theme-0' },
    { what: T('Boss', 'Boss'), title: 'Epic Boss Battle', by: 'Juhani Junkala (SubspaceAudio)', license: 'CC0', url: 'https://opengameart.org/node/55649' },
    { what: T('Casino, Basar', 'Casino, bazaar'), title: "Jazz n' brass loop", by: 'Emma_MA', license: 'CC0', url: 'https://opengameart.org/content/jazz-n-brass-loop' },
    { what: T('Frostring', 'Frost Ring'), title: 'Outer Space Loop', by: 'wipics', license: 'CC0', url: 'https://opengameart.org/content/outer-space-loop' },
    { what: T('Orion', 'Orion'), title: 'Space Music: Out There', by: 'yd', license: 'CC0', url: 'https://opengameart.org/content/space-music-out-there' },
    { what: T('Leuchtfeuer-Feld, Kern', 'Beacon Field, Core'), title: 'Space Flight', by: 'wipics', license: 'CC0', url: 'https://opengameart.org/node/114436' },
    { what: T('Ereignishorizont', 'Event Horizon'), title: 'Exploration Theme', by: 'CleytonKauffman', license: 'CC0', url: 'https://opengameart.org/content/exploration-theme' },
    { what: T('Kampf II', 'Combat II'), title: 'Fast fight / battle music', by: 'Ville Nousiainen (Xythe, mutkanto)', license: 'CC0', url: 'https://opengameart.org/content/fast-fight-battle-music' },
    { what: T('Kampf III', 'Combat III'), title: 'Friendly Talk On a Robotic Battlefield', by: 'illin', license: 'CC0', url: 'https://opengameart.org/content/friendly-talk-on-a-robotic-battlefield-looped' },
    { what: T('Elite', 'Elite'), title: 'Determined Pursuit (epic orchestra loop)', by: 'Emma_MA', license: 'CC0', url: 'https://opengameart.org/content/determined-pursuit-epic-orchestra-loop' },
    { what: T('Der Architekt', 'The Architect'), title: 'Heartfelt Battle', by: 'request', license: 'CC0', url: 'https://opengameart.org/content/heartfelt-battle-loopable-fantasy-stringspianohorn' },
    { what: T('Sieg', 'Victory'), title: 'Win Jingle', by: 'Fupi', license: 'CC0', url: 'https://opengameart.org/content/win-jingle' },
    { what: T('Niederlage', 'Defeat'), title: 'Game over short jingle', by: 'Kosmo The Cat', license: 'CC0', url: 'https://opengameart.org/content/game-over-short-jingle' },
  ] },
  { group: T('Geräusche', 'Sound effects'), items: [
    { what: T('Laser, Explosionen, Schilde, Triebwerk', 'Lasers, explosions, shields, thrusters'), title: 'Sci-Fi Sounds', by: 'Kenney', license: 'CC0', url: 'https://opengameart.org/content/sci-fi-sounds' },
    { what: T('Klicks, Bestätigung, Auswahl', 'Clicks, confirmation, selection'), title: 'Interface Sounds', by: 'Kenney', license: 'CC0', url: 'https://opengameart.org/content/interface-sounds' },
  ] },
  { group: T('Weltraumaufnahmen (getönt)', 'Space imagery (tinted)'), items: [
    { what: T('Brücke', 'Bridge'), title: 'The Eagle Nebula Observed by WISE', by: 'NASA/JPL-Caltech', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA25433' },
    { what: T('Singender Gürtel', 'Singing Belt'), title: 'The Greatest Saturn Portrait …Yet', by: 'NASA/JPL/Space Science Institute', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA06193' },
    { what: T('Frostring', 'Frost Ring'), title: 'Witch Head Brews Baby Stars', by: 'NASA/JPL-Caltech', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA17553' },
    { what: T('Orion', 'Orion'), title: 'Chaos at the Heart of Orion', by: 'NASA/JPL-Caltech/STScI', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA01322' },
    { what: T('Leuchtfeuer-Feld', 'Beacon Field'), title: 'Most Detailed Image of the Crab Nebula', by: 'NASA/ESA/JPL/Arizona State Univ.', license: 'CC BY 4.0 (ESA)', url: 'https://images.nasa.gov/details/PIA03606' },
    { what: T('Ereignishorizont', 'Event Horizon'), title: 'Black Holes: Monsters in Space (Artist Concept)', by: 'NASA/JPL-Caltech', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA16695' },
    { what: T('Galaktischer Kern', 'Galactic Core'), title: 'Great Observatories Unique Views of the Milky Way', by: 'NASA/JPL-Caltech/ESA/CXC/STScI', license: 'CC BY 4.0 (ESA)', url: 'https://images.nasa.gov/details/PIA12348' },
    { what: T('Der Rand', 'The Rim'), title: 'NGC 7293, the Helix Nebula', by: 'NASA/JPL-Caltech', license: 'gemeinfrei', url: 'https://images.nasa.gov/details/PIA15658' },
  ] },
  { group: T('Texturen (getönt)', 'Textures (tinted)'), items: [
    { what: T('Messing des Reaktors', 'Reactor brass'), title: 'Rusty Metal 02', by: 'Rob Tuytel · Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/rusty_metal_02' },
    { what: T('Pergament', 'Parchment'), title: 'Beige Wall 001', by: 'Dimitrios Savva, Rico Cilliers · Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/beige_wall_001' },
    { what: T('Ornament der Karten', 'Card ornament'), title: 'Quatrefoil Jacquard Fabric', by: 'colormass, Rico Cilliers · Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/quatrefoil_jacquard_fabric' },
  ] },
];
