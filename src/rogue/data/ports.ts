// Häfen zwischen den Akten (nach Akt 2 und 4): eine Atempause mit fünf Stationen, von denen man drei besuchen kann.
// Großer Basar (mehr Ware, günstiger), Werkstatt, Kantine (eigene Begegnungen), Kopfgeld (Elite) und je Hafen eine Besonderheit.
import { Tx } from '../types';

const T = (de: string, en: string): Tx => [de, en];

export interface PortStop { id: 'shop' | 'rest' | 'casino' | 'cantina' | 'bounty' | 'archive' | 'forge'; icon: string; who?: string; name: Tx; text: Tx }
export interface PortDef { name: Tx; text: Tx; icon: string; bg: [string, string]; theme: string; stops: PortStop[] }

export const PORT_VISITS = 3;

export const PORTS: PortDef[] = [
  {
    name: T('Freihafen Mirr-Anvaal', 'Free Port Mirr-Anvaal'), icon: '⚓', bg: ['#2a2016', '#0a0810'], theme: 'werft',
    text: T('Eine Stadt aus vertäuten Schiffsrümpfen, zusammengehalten von Seilen, Schulden und Musik. Hier fragt niemand, warum dein Reaktor spricht.',
      'A city of moored hulls, held together by ropes, debts and music. Nobody here asks why your reactor talks.'),
    stops: [
      { id: 'shop', icon: '⚖', who: 'ozzo', name: T('Ozzos Großkontor', 'Ozzo’s Grand Counter'), text: T('Doppelt so viel Ware, 15 % Hafenrabatt.', 'Twice the wares, 15 % port discount.') },
      { id: 'rest', icon: '⚙', who: 'brakk', name: T('Brakks Trockendock', 'Brakk’s Dry Dock'), text: T('Reparieren, aufwerten oder ein Experiment.', 'Repair, upgrade or an experiment.') },
      { id: 'cantina', icon: '🍷', name: T('Kantine „Zur Toten Sonne“', 'Cantina “The Dead Sun”'), text: T('Gerüchte, Glücksspiel, Fremde mit Angeboten.', 'Rumours, gambling, strangers with offers.') },
      { id: 'bounty', icon: '🎯', who: 'kassik', name: T('Kassiks Kopfgeldbrett', 'Kassik’s Bounty Board'), text: T('Ein Elite-Kampf – Modul und 50 Taler Prämie.', 'An elite fight – module and a 50-coin bounty.') },
      { id: 'casino', icon: '♛', who: 'sola', name: T('Solas Ewiger Orbit', 'Sola’s Eternal Orbit'), text: T('Automat, Würfel und Hüllenwette.', 'Slots, dice and the hull bet.') },
    ],
  },
  {
    name: T('Abtei der Lichtsammler', 'Abbey of the Light-Gatherers'), icon: '☾', bg: ['#1c1430', '#07060f'], theme: 'nebel',
    text: T('Auf einem Mond aus Glas meditieren die Motten von Vaels Orden. In ihren Archiven liegen Sternkarten, älter als der Architekt.',
      'On a moon of glass the moths of Vael’s order meditate. Their archives hold star charts older than the Architect.'),
    stops: [
      { id: 'shop', icon: '⚖', who: 'ozzo', name: T('Ozzos Pilgerstand', 'Ozzo’s Pilgrim Stall'), text: T('Doppelt so viel Ware, 15 % Rabatt („für Pilger“).', 'Twice the wares, 15 % off (“for pilgrims”).') },
      { id: 'forge', icon: '✧', who: 'vael', name: T('Vaels Lichtschmiede', 'Vael’s Light Forge'), text: T('Zwei Symbole kostenlos um eine Stufe aufwerten.', 'Upgrade two symbols by one level, free.') },
      { id: 'archive', icon: '📜', name: T('Archiv der Motten', 'Archive of the Moths'), text: T('Ein Symbol für immer aus deinem Reaktor entfernen.', 'Remove a symbol from your reactor for good.') },
      { id: 'cantina', icon: '🕯', name: T('Refektorium', 'Refectory'), text: T('Pilger, Schmuggler und eine seltsame Prophezeiung.', 'Pilgrims, smugglers and a strange prophecy.') },
      { id: 'bounty', icon: '🎯', who: 'kassik', name: T('Kassik wartet am Tor', 'Kassik waits at the gate'), text: T('Ein Elite-Kampf – Modul und 50 Taler Prämie.', 'An elite fight – module and a 50-coin bounty.') },
    ],
  },
];
