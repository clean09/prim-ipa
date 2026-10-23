// Ereignisse IV (v4.10): allgemeine Begegnungen über alle Akte – Figuren, Deck-Pflege, Risiko.
import { EventDef } from '../types';

export const EVENTS_D: EventDef[] = [
  { id: 'vael-meditation', act: 0, icon: '☾', title: ['Vaels Meditation', 'Vael’s Meditation'],
    text: ['Vael sitzt reglos auf der Hülle, die Flügel um sich gelegt. „Lass etwas los, Kurierin. Dein Reaktor ist zu voll, um zu atmen.“', 'Vael sits motionless on the hull, wings folded around her. “Let something go, courier. Your reactor is too full to breathe.”'],
    options: [
      { label: ['Zwei Symbole loslassen', 'Let go of two symbols'], win: [{ removeCard: true }, { removeCard: true }, { staub: 4 }], winText: ['Der Reaktor summt leichter.', 'The reactor hums more lightly.'] },
      { label: ['Mit ihr schweigen', 'Sit in silence with her'], win: [{ hp: 10 }] },
    ] },
  { id: 'brakk-werkbank', act: 0, icon: '⚒', title: ['Brakks fliegende Werkbank', 'Brakk’s Flying Workbench'],
    text: ['Brakk hat sich an deinen Rumpf gekoppelt. „Hab Zeit für einen Umbau. Einen. Such dir aus, was ich kaputt mache.“', 'Brakk has docked onto your hull. “I have time for one refit. One. Pick what I break.”'],
    options: [
      { label: ['Ein Symbol umschmieden', 'Reforge a symbol'], win: [{ removeCard: true, card: 'rare' }], winText: ['Aus Altem wird Seltenes.', 'Something old becomes something rare.'] },
      { label: ['Zwei Symbole aufwerten (40 ✦)', 'Upgrade two symbols (40 ✦)'], need: { gold: 40 }, win: [{ gold: -40, upgradeCard: true }, { upgradeCard: true }] },
      { label: ['Nur Tee trinken', 'Just drink tea'], win: [{ hp: 6 }] },
    ] },
  { id: 'sola-hinterzimmer', act: 1, icon: '♣', title: ['Solas Privattisch', 'Sola’s Private Table'],
    text: ['Sola-Nn mischt Karten mit drei Tentakeln gleichzeitig. „Eine Runde Sternenpoker, Schätzchen? Verlierst du, behalte ich einen deiner Steine.“', 'Sola-Nn shuffles cards with three tentacles at once. “A round of star poker, darling? If you lose, I keep one of your stones.”'],
    options: [
      { label: ['Spielen', 'Play'], check: { chance: 0.5, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } }, win: [{ gold: 80, relic: 'rare' }], lose: [{ removeCard: true, gold: -15 }],
        winText: ['Royal Flush aus Kometen!', 'A royal flush of comets!'], loseText: ['Sola nimmt sich ein Symbol – sehr höflich.', 'Sola takes a symbol – very politely.'] },
      { label: ['Nur zusehen', 'Just watch'], win: [{ staub: 3 }] },
    ] },
  { id: 'kassik-falle', act: 1, icon: '⌖', title: ['Kassiks Falle', 'Kassik’s Trap'],
    text: ['Ein Notruf – zu perfekt. Kassik-Tor funkt dazwischen: „Klick. Das ist eine Falle für dich. Ich könnte sie für dich auslösen … gegen Beteiligung.“', 'A distress call – too perfect. Kassik-Tor cuts in: “Click. That is a trap for you. I could spring it for you … for a share.”'],
    options: [
      { label: ['Kassik bezahlen (35 ✦)', 'Pay Kassik (35 ✦)'], need: { gold: 35 }, win: [{ gold: -35, relic: 'common', staub: 5 }] },
      { label: ['Selbst hineinfliegen', 'Fly in yourself'], win: [{ fight: 'elite', gold: 30 }] },
      { label: ['Ignorieren', 'Ignore'], win: [] },
    ] },
  { id: 'sternensaat', act: 2, icon: '✶', title: ['Sternensaat', 'Star Seeds'],
    text: ['Ein Feld aus winzigen, kaum geborenen Sternen. Lumen will einen davon mitnehmen. „Nur einen. Ich passe auf ihn auf.“', 'A field of tiny, barely born stars. Lumen wants to take one. “Just one. I will look after it.”'],
    options: [
      { label: ['Einen mitnehmen', 'Take one'], win: [{ card: 'epic' }, { hp: -6 }], winText: ['Der kleine Stern wird zu einem Symbol voller Licht.', 'The little star becomes a symbol full of light.'] },
      { label: ['Sie wachsen lassen', 'Let them grow'], win: [{ maxHp: 6, staub: 8 }], winText: ['Lumen ist stolz auf dich.', 'Lumen is proud of you.'] },
    ] },
  { id: 'spiegelbild', act: 2, icon: '◐', title: ['Dein Spiegelbild', 'Your Reflection'],
    text: ['Eine Spiegelscherbe des Architekten treibt vorbei. Darin: du, aber mit einem Reaktor voller schwarzer Sterne. Sie lächelt.', 'One of the Architect’s mirror shards drifts past. In it: you, but with a reactor full of black stars. She smiles.'],
    options: [
      { label: ['Die Scherbe zerschlagen', 'Shatter the shard'], check: { chance: 0.6 }, win: [{ relic: 'epic' }], lose: [{ curse: 'dunkelnebel', hp: -8 }] },
      { label: ['Wegsehen', 'Look away'], win: [{ upgradeCard: true }] },
    ] },
  { id: 'letzter-kurier', act: 3, icon: '✉', title: ['Der letzte Kurier', 'The Last Courier'],
    text: ['Ein alter Kurier mit einem erloschenen Reaktor bittet um Licht. „Nur ein Funke. Damit ich heimfinde.“', 'An old courier with a dead reactor asks for light. “Just a spark. So I can find my way home.”'],
    options: [
      { label: ['Ihm Licht geben', 'Give him light'], win: [{ hp: -10 }, { maxHp: 8 }, { staub: 10 }], winText: ['Er fliegt davon. Dein Reaktor fühlt sich größer an.', 'He flies off. Your reactor feels bigger.'] },
      { label: ['Seine Ladung kaufen (60 ✦)', 'Buy his cargo (60 ✦)'], need: { gold: 60 }, win: [{ gold: -60, relic: 'legendary' }] },
    ] },
  { id: 'architekten-angebot', act: 3, icon: '◬', title: ['Das Angebot', 'The Offer'],
    text: ['Eine Stimme ohne Luft: „Gib mir den Stern, Kurierin, und du bekommst alles andere. Gold. Macht. Ruhe.“', 'A voice without air: “Give me the star, courier, and you get everything else. Gold. Power. Peace.”'],
    options: [
      { label: ['Zum Schein annehmen', 'Pretend to accept'], win: [{ gold: 150, relic: 'cursed' }], winText: ['Du nimmst das Gold – und ein Stück von ihm kommt mit.', 'You take the gold – and a piece of him comes along.'] },
      { label: ['„Nein.“', '“No.”'], win: [{ hp: 15, staub: 12 }], winText: ['Lumen leuchtet so hell wie nie.', 'Lumen shines brighter than ever.'] },
    ] },
];
