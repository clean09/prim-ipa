// Ereignisse II (Entwurf gemma4:12b, geprüft)
import { EventDef } from '../types';

export const EVENTS_B: EventDef[] = [
  {
    id: 'gravitationsbrunnen-0',
    act: 0,
    icon: '◎',
    title: ['Gravitationsbrunnen', 'Gravity Well'],
    text: ['Ein instabiler Gravitationsbruch zieht an deiner Hülle. Die Struktur des Raums beginnt zu flimmern.', 'An unstable gravity well pulls at your hull. The fabric of space begins to shimmer.'],
    options: [
      {
        label: ['Stabilisatoren forcieren', 'Force Stabilizers'],
        check: { chance: 0.4, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ hp: 5, staub: 10 }],
        lose: [{ hp: -10 }],
        winText: ['Stabilisiert!', 'Stabilized!'],
        loseText: ['Strukturverlust...', 'Structural loss...']
      },
      {
        label: ['Passiv ausweichen', 'Passive Evasion'],
        win: [{ gold: -5, staub: 5 }]
      }
    ]
  },
  {
    id: 'zeitschleife-0',
    act: 0,
    icon: '⧗',
    title: ['Zeitschleife', 'Time Loop'],
    text: ['Die Zeit scheint hier zu stocken. Du siehst Fragmente deiner eigenen Reise in der Ferne.', 'Time seems to stall here. You see fragments of your own journey in the distance.'],
    options: [
      {
        label: ['Chrononen einsammeln', 'Collect Chronons'],
        check: { chance: 0.5, raise: { cost: 'gold', per: 15, add: 0.12, max: 3 } },
        win: [{ staub: 20, card: 'random' }],
        lose: [{ gold: -20 }],
        winText: ['Zeitfluss stabilisiert.', 'Time flow stabilized.'],
        loseText: ['Chronologische Instabilität.', 'Chronological instability.']
      },
      {
        label: ['Ignorieren', 'Ignore'],
        win: [{ gold: 5 }]
      }
    ]
  },
  {
    id: 'spiegelflotte-0',
    act: 0,
    icon: '⊙',
    title: ['Spiegelflotte', 'Mirror Fleet'],
    text: ['Geisterhafte Schiffe gleiten lautlos vorbei. Sie spiegeln deine eigene Signatur wider.', 'Ghostly ships glide silently past. They mirror your own signature.'],
    options: [
      {
        label: ['Signatur tarnen', 'Mask Signature'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 3, add: 0.1, max: 3 } },
        win: [{ relic: 'common' }],
        lose: [{ hp: -5 }],
        winText: ['Tarnung erfolgreich.', 'Camouflage successful.'],
        loseText: ['Erkannt!', 'Detected!']
      },
      {
        label: ['Beobachten', 'Observe'],
        win: [{ staub: 8 }]
      }
    ]
  },
  {
    id: 'sternenfriedhof-0',
    act: 0,
    icon: '⚰',
    title: ['Sternenfriedhof', 'Star Graveyard'],
    text: ['Überreste toter Zivilisationen treiben im Vakuum. Ein Ort der stillen Melancholie.', 'Remnants of dead civilizations drift in the vacuum. A place of silent melancholy.'],
    options: [
      {
        label: ['Schrott bergen', 'Salvage Scrap'],
        check: { chance: 0.45, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ gold: 30, relic: 'common' }],
        lose: [{ hp: -8 }],
        winText: ['Wertvoller Schrott.', 'Valuable scrap.'],
        loseText: ['Instabiler Kern.', 'Unstable core.']
      },
      {
        label: ['Ehrfurcht zeigen', 'Show Reverence'],
        win: [{ staub: 12 }]
      }
    ]
  },
  {
    id: 'waisen-protostern-0',
    act: 0,
    icon: '◒',
    title: ['Waisen-Protostern', 'Orphan Protostar'],
    text: ['Ein kleiner, instabiler Stern sucht nach einem Heimathafen. Er flüstert in deiner Sprache.', 'A small, unstable star seeks a home. It whispers in your language.'],
    options: [
      {
        label: ['Schutz bieten', 'Offer Protection'],
        check: { chance: 0.7, raise: { cost: 'hp', per: 5, add: 0.15, max: 3 } },
        win: [{ maxHp: 4, staub: 15 }],
        lose: [{ hp: -12 }],
        winText: ['Er strahlt heller.', 'It shines brighter.'],
        loseText: ['Zu schwach.', 'Too weak.']
      },
      {
        label: ['Ignorieren', 'Ignore'],
        win: [{ gold: -5 }]
      }
    ]
  },
  {
    id: 'schwarzer-markt-3',
    act: 3,
    icon: '⚖',
    title: ['Schwarzer Markt', 'Black Market'],
    text: ['Am Ereignishorizont tummeln sich Händler des Verbotenen. Ozzo scheint hier einen Stand zu haben.', 'At the event horizon, traders of the forbidden gather. Ozzo seems to have a stall here.'],
    options: [
      {
        label: ['Gefährliche Ware', 'Dangerous Goods'],
        need: { gold: 50 },
        check: { chance: 0.35, raise: { cost: 'gold', per: 25, add: 0.1, max: 3 } },
        win: [{ card: 'epic', gold: 40 }],
        lose: [{ gold: -60, curse: true }],
        winText: ['Ein wahres Juwel.', 'A true gem.'],
        loseText: ['Betrug!', 'Scam!']
      },
      {
        label: ['Handeln', 'Trade'],
        win: [{ gold: 20, staub: 15 }]
      }
    ]
  },
  {
    id: 'verlorene-lichtsammler-3',
    act: 3,
    icon: '☼',
    title: ['Verlorene Lichtsammler', 'Lost Light-Gatherers'],
    text: ['Eine Gruppe von Motten ist in einem Nebelstrudel gefangen. Sie brauchen Hilfe.', 'A group of moths is trapped in a nebula swirl. They need help.'],
    options: [
      {
        label: ['Rettungsmission', 'Rescue Mission'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 6, add: 0.12, max: 3 } },
        win: [{ relic: 'rare', staub: 25 }],
        lose: [{ hp: -15, fight: 'normal' }],
        winText: ['Sie sind gerettet.', 'They are saved.'],
        loseText: ['Der Nebel war zu dicht.', 'The nebula was too thick.']
      },
      {
        label: ['Beobachten', 'Observe'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'pulsar-orakel-3',
    act: 3,
    icon: '◍',
    title: ['Pulsar-Orakel', 'Pulsar Oracle'],
    text: ['Ein Pulsar sendet rhythmische Signale aus, die wie Prophezeiungen klingen.', 'A pulsar emits rhythmic signals that sound like prophecies.'],
    options: [
      {
        label: ['Vision suchen', 'Seek Vision'],
        check: { chance: 0.5, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ card: 'rare', staub: 20 }],
        lose: [{ hp: -10 }],
        winText: ['Die Zukunft ist klar.', 'The future is clear.'],
        loseText: ['Nur Rauschen.', 'Only static.']
      },
      {
        label: ['Signale ignorieren', 'Ignore Signals'],
        win: [{ gold: 10 }]
      }
    ]
  },
  {
    id: 'wurmloch-zoll-3',
    act: 3,
    icon: '▧',
    title: ['Wurmloch-Zoll', 'Wormhole Toll'],
    text: ['Ein interdimensionaler Wärter verlangt Tribut für den sicheren Durchgang.', 'An interdimensional warden demands tribute for safe passage.'],
    options: [
      {
        label: ['Bestechung', 'Bribe'],
        need: { gold: 40 },
        check: { chance: 0.65, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ gold: 60, staub: 20 }],
        lose: [{ gold: -40, curse: true }],
        winText: ['Er nimmt das Gold.', 'He takes the gold.'],
        loseText: ['Er will mehr.', 'He wants more.']
      },
      {
        label: ['Verhandeln', 'Negotiate'],
        win: [{ gold: -10, staub: 5 }]
      }
    ]
  },
  {
    id: 'kassiks-falle-3',
    act: 3,
    icon: '⌘',
    title: ['Kassiks Falle', 'Kassik\'s Trap'],
    text: ['Ein Netz aus Fallen und Sensoren blockiert den Weg. Kassik-Tor hat hier ihre Spuren hinterlassen.', 'A web of traps and sensors blocks the way. Kassik-Tor left her traces here.'],
    options: [
      {
        label: ['Netz entschärfen', 'Defuse Web'],
        check: { chance: 0.4, raise: { cost: 'hp', per: 5, add: 0.1, max: 3 } },
        win: [{ relic: 'rare' }],
        lose: [{ hp: -12, fight: 'elite' }],
        winText: ['Sicher durch.', 'Safe through.'],
        loseText: ['Die Falle schnappt zu.', 'The trap snaps shut.']
      },
      {
        label: ['Umgehen', 'Bypass'],
        win: [{ gold: -15 }]
      }
    ]
  },
  {
    id: 'ozzos-bankrott-3',
    act: 3,
    icon: '↘',
    title: ['Ozzos Bankrott', 'Ozzo\'s Bankruptcy'],
    text: ['Ozzo wirkt nervös. Er hat einen Deal verloren und sucht nach einem schnellen Ausweg.', 'Ozzo looks nervous. He lost a deal and is looking for a quick way out.'],
    options: [
      {
        label: ['Investieren', 'Invest'],
        need: { gold: 30 },
        check: { chance: 0.5, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ gold: 80, card: 'rare' }],
        lose: [{ gold: -50 }],
        winText: ['Ein genialer Schachzug.', 'A brilliant move.'],
        loseText: ['Alles weg.', 'Everything gone.']
      },
      {
        label: ['Beobachten', 'Observe'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'sola-nn-hinterzimmerspiel-3',
    act: 3,
    icon: '♠',
    title: ['Sola-Nns Hinterzimmerspiel', 'Sola-Nn\'s Backroom Game'],
    text: ['Sola-Nn lädt dich zu einem privaten Spiel ein. Die Einsätze sind... ungewöhnlich.', 'Sola-Nn invites you to a private game. The stakes are... unusual.'],
    options: [
      {
        label: ['Alles setzen', 'Go All In'],
        need: { gold: 20 },
        check: { chance: 0.4, raise: { cost: 'gold', per: 15, add: 0.1, max: 3 } },
        win: [{ gold: 100, relic: 'epic' }],
        lose: [{ gold: -40, curse: true }],
        winText: ['Der Jackpot!', 'Jackpot!'],
        loseText: ['Das Haus gewinnt.', 'The house wins.']
      },
      {
        label: ['Zuschauen', 'Watch'],
        win: [{ staub: 15 }]
      }
    ]
  },
  {
    id: 'brakks-prototyp-3',
    act: 3,
    icon: '⚒',
    title: ['Brakks Prototyp', 'Brakk\'s Prototype'],
    text: ['Brakk hat ein neues Modul entwickelt, aber es ist noch instabil. Er braucht deine Hilfe.', 'Brakk has developed a new module, but it is still unstable. He needs your help.'],
    options: [
      {
        label: ['Testen', 'Test'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 5, add: 0.1, max: 3 } },
        win: [{ relic: 'rare' }],
        lose: [{ hp: -10, curse: true }],
        winText: ['Es funktioniert!', 'It works!'],
        loseText: ['Überhitzung!', 'Overheat!']
      },
      {
        label: ['Ablehnen', 'Decline'],
        win: [{ gold: 5 }]
      }
    ]
  },
  {
    id: 'kometenhochzeit-3',
    act: 3,
    icon: '○',
    title: ['Kometenhochzeit', 'Comet Wedding'],
    text: ['Zwei Kometen kollidieren in einer rituellen Vereinigung. Die Energie ist fast greifbar.', 'Two comets collide in a ritual union. The energy is almost tangible.'],
    options: [
      {
        label: ['Energie absorbieren', 'Absorb Energy'],
        check: { chance: 0.5, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ staub: 30, maxHp: 5 }],
        lose: [{ hp: -12 }],
        winText: ['Du bist geladen.', 'You are charged.'],
        loseText: ['Zu viel Energie.', 'Too much energy.']
      },
      {
        label: ['Beobachten', 'Observe'],
        win: [{ staub: 10 }]
      }
    ]
  }
];
