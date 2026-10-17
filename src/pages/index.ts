import { L } from '../core/i18n';
import { mountAi } from './ai';
import { mountBh } from './bh';
import { mountBoard } from './board';
import { mountCheck } from './check';
import { mountDevice } from './device';
import { mountGames } from './games';
import { mountPlay } from './play';
import { mountHome } from './home';
import { mountInfo } from './info';
import { mountLab } from './lab';
import { mountMore } from './more';
import { mountPrime } from './prime';
import { mountRam } from './ram';
import { mountStar } from './star';

export interface Page {
  id: string;
  title: () => string;
  parent?: string;
  help?: string;
  full?: boolean;
  /** Rubrik über dem großen Seitentitel (Register, Kopf) */
  kicker?: () => string;
  /** Suchbegriffe fürs Register */
  keys?: string;
  /** kein großer Seitenkopf (Seite gestaltet ihn selbst) */
  noHead?: boolean;
  mount: (root: HTMLElement) => void | (() => void);
}

const B = () => L('Benchmark', 'Benchmark'), S = () => L('Simulation', 'Simulation'), Y = () => L('System', 'System');
const list: Page[] = [
  { id: 'home', title: () => 'PrimSieb', noHead: true, mount: mountHome },
  { id: 'star', title: () => L('Sternenleben', 'Star life'), kicker: S, full: true, help: 'star', keys: 'stern star sonne supernova nebel hr', mount: mountStar },
  { id: 'games', title: () => L('Spiele', 'Games'), kicker: () => L('Spielen', 'Play'), keys: 'spiel game jagd blitz pi', mount: mountGames },
  { id: 'play', title: () => L('Spiel', 'Game'), parent: 'games', full: true, mount: mountPlay },
  { id: 'device', title: () => L('Geräte-Check', 'Device check'), kicker: Y, keys: 'gerät handy akku kamera sensor', mount: mountDevice },
  { id: 'more', title: () => L('Alles', 'Everything'), kicker: () => L('Register', 'Index'), mount: mountMore },
  { id: 'prime', title: () => L('Primzahlen', 'Primes'), kicker: B, parent: 'more', help: 'prime', keys: 'prim sieb cpu kerne', mount: mountPrime },
  { id: 'ai', title: () => L('KI-Leistung', 'AI performance'), kicker: B, parent: 'more', help: 'ai', keys: 'ki ai gpu matrix fp16', mount: mountAi },
  { id: 'ram', title: () => L('Neutronenstern', 'Neutron star'), kicker: B, parent: 'more', help: 'ram', keys: 'ram speicher memory', mount: mountRam },
  { id: 'bh', title: () => L('Singularität', 'Singularity'), kicker: S, parent: 'more', full: true, keys: 'schwarzes loch black hole gpu', mount: mountBh },
  { id: 'lab', title: () => L('Mathe-Labor', 'Math lab'), kicker: S, parent: 'more', keys: 'pi fibonacci n-körper collatz', mount: mountLab },
  { id: 'board', title: () => L('Bestenliste', 'Leaderboard'), kicker: Y, parent: 'more', help: 'board', keys: 'rang punkte weltweit', mount: mountBoard },
  { id: 'check', title: () => L('Zahl prüfen', 'Check a number'), kicker: Y, parent: 'more', help: 'check', keys: 'miller rabin mersenne', mount: mountCheck },
  { id: 'info', title: () => L('Einstellungen', 'Settings'), kicker: () => L('Einstellungen', 'Settings'), parent: 'more', keys: 'design sprache ton bewegung info datenschutz', mount: mountInfo },
];

export const PAGES: Record<string, Page> = Object.fromEntries(list.map(p => [p.id, p]));
