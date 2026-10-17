import { EventDef } from '../types';

// Ereignisse mit Fähigkeitsproben (Entwurf: gemma4:12b, geprüft und überarbeitet). Neue Ereignisse einfach anhängen.
export const EVENTS: EventDef[] = [
  {
    id: 'euklids-bibliothek',
    act: 0,
    icon: '📚',
    title: ['Euklids Bibliothek', 'Euclid\'s Library'],
    text: ['In den staubigen Regalen findest du antike Pergamente über die Grundlagen der Zahlentheorie.', 'Dusty shelves hold ancient scrolls detailing the foundations of geometry.'],
    options: [
      {
        label: ['Wissen extrahieren', 'Extract Knowledge'],
        check: { chance: 0.6, raise: { cost: 'gold', per: 15, add: 0.1, max: 2 } },
        win: [{ staub: 20, gold: 30 }],
        lose: [{ hp: -5 }],
        winText: ['Du findest wertvolle Formeln.', 'You find valuable formulas.'],
        loseText: ['Die alten Pergamente zerbröseln in deinen Händen.', 'The ancient scrolls crumble in your hands.'],
      },
      {
        label: ['Einfach weitergehen', 'Just keep walking'],
        win: [{ gold: 5 }]
      }
    ]
  },
  {
    id: 'der-wuerfelgeist',
    act: 0,
    icon: '🎲',
    title: ['Der Würfelgeist', 'The Dice Spirit'],
    text: ['Ein schwebender Würfel aus reinem Licht erscheint vor dir und bietet einen Handel an.', 'A floating cube of pure light appears before you, offering a trade.'],
    options: [
      {
        label: ['Einen Wurf riskieren', 'Risk a roll'],
        check: { chance: 0.5, raise: { cost: 'hp', per: 4, add: 0.12, max: 3 } },
        win: [{ gold: 80, card: 'random' }],
        lose: [{ hp: -10 }],
        winText: ['Der Geist ist gnädig.', 'The spirit is merciful.'],
        loseText: ['Der Geist ist unerbittlich.', 'The spirit is ruthless.'],
      },
      {
        label: ['Den Geist ignorieren', 'Ignore the spirit'],
        win: []
      }
    ]
  },
  {
    id: 'verfluchter-taschenrechner',
    act: 0,
    icon: '📟',
    title: ['Verfluchter Taschenrechner', 'Cursed Calculator'],
    text: ['Ein alter Taschenrechner flackert unregelmäßig. Er scheint die Realität zu verzerren.', 'An old calculator flickers irregularly, seemingly warping reality.'],
    options: [
      {
        label: ['Eingabe erzwingen', 'Force an input'],
        check: { chance: 0.4, raise: { cost: 'gold', per: 20, add: 0.1, max: 2 } },
        win: [{ card: 'rare', gold: 40 }],
        lose: [{ curse: true, hp: -5 }],
        winText: ['Die Zahlen stimmen endlich.', 'The numbers finally align.'],
        loseText: ['Ein logischer Fehler führt zum Chaos.', 'A logical error leads to chaos.'],
      },
      {
        label: ['Den Rechner wegwerfen', 'Discard the calculator'],
        win: [{ gold: 10 }]
      }
    ]
  },
  {
    id: 'primzahl-schrein',
    act: 0,
    icon: '⛩️',
    title: ['Primzahl-Schrein', 'Prime Shrine'],
    text: ['Ein Schrein, der nur auf Primzahlen reagiert, steht vor dir.', 'A shrine that only reacts to prime numbers stands before you.'],
    options: [
      {
        label: ['Blut opfern', 'Offer blood'],
        check: { chance: 0.7, raise: { cost: 'hp', per: 5, add: 0.15, max: 3 } },
        win: [{ relic: 'common', gold: 20 }],
        lose: [{ hp: -8 }],
        winText: ['Der Schrein leuchtet hell auf.', 'The shrine glows brightly.'],
        loseText: ['Die Opferung war unzureichend.', 'The offering was insufficient.'],
      },
      {
        label: ['Den Schrein meiden', 'Avoid the shrine'],
        win: []
      }
    ]
  },
  {
    id: 'fermat-rand',
    act: 1,
    icon: '🌌',
    title: ['Fermats Rand', 'Fermat\'s Edge'],
    text: ['Du erreichst die Grenze des bekannten Kosmos. Hier wird Mathematik zur Physik.', 'You reach the edge of known space. Here, math becomes physics.'],
    options: [
      {
        label: ['Über den Rand treten', 'Step beyond the edge'],
        check: { chance: 0.55, raise: { cost: 'gold', per: 25, add: 0.1, max: 3 } },
        win: [{ relic: 'rare', staub: 15 }],
        lose: [{ hp: -12 }],
        winText: ['Du entdeckst neue Dimensionen.', 'You discover new dimensions.'],
        loseText: ['Der Abgrund ist tiefer als gedacht.', 'The abyss is deeper than expected.'],
      },
      {
        label: ['Sicher bleiben', 'Stay safe'],
        win: [{ gold: 20 }]
      }
    ]
  },
  {
    id: 'gauss-schulklasse',
    act: 1,
    icon: '🏫',
    title: ['Gauß’ Schulklasse', 'Gauss’ Classroom'],
    text: ['Ein Geist von Carl Friedrich Gauß unterrichtet eine Klasse von Schatten.', 'The ghost of Carl Friedrich Gauss teaches a class of shadows.'],
    options: [
      {
        label: ['An der Lektion teilnehmen', 'Join the lesson'],
        check: { chance: 0.65, raise: { cost: 'hp', per: 3, add: 0.1, max: 3 } },
        win: [{ card: 'rare', staub: 10 }],
        lose: [{ hp: -7 }],
        winText: ['Du verstehst die Summen der Unendlichkeit.', 'You understand the sums of infinity.'],
        loseText: ['Die Komplexität überfordert dich.', 'The complexity overwhelms you.'],
      },
      {
        label: ['Den Raum verlassen', 'Leave the room'],
        win: [{ gold: 15 }]
      }
    ]
  },
  {
    id: 'mobius-haendler',
    act: 1,
    icon: '♾️',
    title: ['Möbius-Händler', 'Möbius Merchant'],
    text: ['Ein Händler erscheint in einer Schleife. Er verkauft Dinge, die gleichzeitig existieren und nicht.', 'A merchant appears in a loop, selling things that both exist and don\'t.'],
    options: [
      {
        label: ['Handeln (40 Gold)', 'Trade (40 gold)'],
        need: { gold: 40 },
        check: { chance: 0.45, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ relic: 'rare', gold: -40 }],
        lose: [{ curse: true, gold: -20 }],
        winText: ['Ein Paradoxon gehört jetzt dir.', 'A paradox becomes your possession.'],
        loseText: ['Der Handel ist eine Sackgasse.', 'The trade is a dead end.'],
      },
      {
        label: ['Ignorieren', 'Ignore'],
        win: [{ gold: 5 }]
      }
    ]
  },
  {
    id: 'zeta-orakel',
    act: 1,
    icon: '🔮',
    title: ['Zeta-Orakel', 'Zeta Oracle'],
    text: ['Das Orakel flüstert die Werte der Riemannschen Zeta-Funktion in dein Ohr.', 'The oracle whispers the values of the Riemann Zeta function into your ear.'],
    options: [
      {
        label: ['Die Wahrheit suchen', 'Seek the truth'],
        check: { chance: 0.35, raise: { cost: 'hp', per: 6, add: 0.15, max: 3 } },
        win: [{ relic: 'epic', staub: 25 }],
        lose: [{ hp: -15 }],
        winText: ['Die Nullstellen offenbaren sich.', 'The zeros reveal themselves.'],
        loseText: ['Die Wahrheit ist zu schmerzhaft.', 'The truth is too painful.'],
      },
      {
        label: ['Wegschauen', 'Look away'],
        win: [{ gold: 10 }]
      }
    ]
  },
  {
    id: 'kollatz-spirale',
    act: 2,
    icon: '🌀',
    title: ['Kollatz-Spirale', 'Collatz Spiral'],
    text: ['Du gerätst in eine endlose Spirale aus Divisionen und Multiplikationen.', 'You fall into an endless spiral of divisions and multiplications.'],
    options: [
      {
        label: ['Der Spirale folgen', 'Follow the spiral'],
        check: { chance: 0.5, raise: { cost: 'gold', per: 25, add: 0.1, max: 3 } },
        win: [{ card: 'epic', gold: 60 }],
        lose: [{ hp: -12, gold: -20 }],
        winText: ['Du erreichst die Eins.', 'You reach one.'],
        loseText: ['Du bleibst in der Schleife gefangen.', 'You remain trapped in the loop.'],
      },
      {
        label: ['Ausbrechen', 'Break out'],
        win: [{ gold: 30 }]
      }
    ]
  },
  {
    id: 'fraktaler-wald',
    act: 2,
    icon: '🌲',
    title: ['Fraktaler Wald', 'Fractal Forest'],
    text: ['Bäume wachsen in sich selbst ähnlichen Mustern. Jeder Ast ist ein ganzer Wald.', 'Trees grow in self-similar patterns. Every branch is an entire forest.'],
    options: [
      {
        label: ['Tiefer eintauchen', 'Dive deeper'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ relic: 'rare', staub: 20 }],
        lose: [{ hp: -9 }],
        winText: ['Du findest das Muster.', 'You find the pattern.'],
        loseText: ['Die Wiederholung erschöpft dich.', 'The repetition exhausts you.'],
      },
      {
        label: ['Oberfläche bleiben', 'Stay on the surface'],
        win: [{ gold: 20 }]
      }
    ]
  },
  {
    id: 'euklids-wache',
    act: 2,
    icon: '🛡️',
    title: ['Euklids Wache', 'Euclid\'s Guard'],
    text: ['Wächter der Geometrie versperren deinen Weg.', 'Guards of geometry block your path.'],
    options: [
      {
        label: ['Konfrontation', 'Confrontation'],
        win: [{ fight: 'elite' }],
      },
      {
        label: ['Diplomatie', 'Diplomacy'],
        check: { chance: 0.5, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ gold: 50 }],
        lose: [{ fight: 'normal' }],
        winText: ['Du überzeugst sie mit Logik.', 'You convince them with logic.'],
        loseText: ['Du musst kämpfen.', 'You must fight.'],
      }
    ]
  },
  {
    id: 'das-sieb-der-wahrheit',
    act: 2,
    icon: '🕸️',
    title: ['Das Sieb der Wahrheit', 'The Sieve of Truth'],
    text: ['Ein riesiges Sieb filtert die Realität. Nur Primzahlen dürfen passieren.', 'A giant sieve filters reality. Only primes are allowed to pass.'],
    options: [
      {
        label: ['Durch das Sieb treten', 'Pass through the sieve'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 5, add: 0.1, max: 3 } },
        win: [{ relic: 'epic', staub: 30 }],
        lose: [{ hp: -10 }],
        winText: ['Du bist rein.', 'You are pure.'],
        loseText: ['Du bleibst hängen.', 'You are left behind.'],
      },
      {
        label: ['Umgehen', 'Bypass'],
        win: [{ gold: 40 }]
      }
    ]
  },
  {
    id: 'singularitaet-null',
    act: 3,
    icon: '🕳️',
    title: ['Singularität Null', 'Singularity Zero'],
    text: ['Alles strebt zur Null. Die Mathematik bricht zusammen.', 'Everything tends toward zero. Mathematics is collapsing.'],
    options: [
      {
        label: ['In die Null springen', 'Leap into Zero'],
        check: { chance: 0.4, raise: { cost: 'hp', per: 6, add: 0.15, max: 3 } },
        win: [{ relic: 'legendary', gold: 100 }],
        lose: [{ hp: -20, curse: true }],
        winText: ['Du wirst eins mit dem Nichts.', 'You become one with nothingness.'],
        loseText: ['Die Null verschlingt dich.', 'Zero consumes you.'],
      },
      {
        label: ['Widerstand leisten', 'Resist'],
        win: [{ fight: 'elite' }]
      }
    ]
  },
  {
    id: 'gottes-gleichung',
    act: 3,
    icon: '📜',
    title: ['Gottes Gleichung', 'God\'s Equation'],
    text: ['Eine Gleichung, die das Universum beschreibt, liegt vor dir.', 'An equation describing the universe lies before you.'],
    options: [
      {
        label: ['Lösen', 'Solve'],
        check: { chance: 0.35, raise: { cost: 'gold', per: 30, add: 0.15, max: 3 } },
        win: [{ relic: 'legendary', card: 'epic' }],
        lose: [{ hp: -15, gold: -50 }],
        winText: ['Die Welt erschafft sich neu.', 'The world recreates itself.'],
        loseText: ['Die Lösung ist zu komplex.', 'The solution is too complex.'],
      },
      {
        label: ['Verlernen', 'Unlearn'],
        win: [{ gold: 60 }]
      }
    ]
  },
  {
    id: 'das-letzte-theorem',
    act: 3,
    icon: '🏆',
    title: ['Das letzte Theorem', 'The Last Theorem'],
    text: ['Die finale Hürde. Ein Beweis, der alles verändert.', 'The final hurdle. A proof that changes everything.'],
    options: [
      {
        label: ['Den Beweis führen', 'Complete the proof'],
        check: { chance: 0.5, raise: { cost: 'hp', per: 6, add: 0.1, max: 3 } },
        win: [{ relic: 'legendary', staub: 50 }],
        lose: [{ hp: -18 }],
        winText: ['Du bist der größte Mathematiker.', 'You are the greatest mathematician.'],
        loseText: ['Der Beweis scheitert.', 'The proof fails.'],
      },
      {
        label: ['Aufgeben', 'Give up'],
        win: [{ fight: 'elite' }]
      }
    ]
  },
  {
    id: 'chaos-der-fraktale',
    act: 3,
    icon: '🌪️',
    title: ['Chaos der Fraktale', 'Fractal Chaos'],
    text: ['Die Ordnung bricht zusammen. Die Zahlen beginnen zu tanzen.', 'Order collapses. The numbers begin to dance.'],
    options: [
      {
        label: ['Ordnung erzwingen', 'Enforce Order'],
        check: { chance: 0.45, raise: { cost: 'gold', per: 25, add: 0.1, max: 3 } },
        win: [{ relic: 'epic', gold: 80 }],
        lose: [{ hp: -15, curse: true }],
        winText: ['Die Zahlen gehorchen.', 'The numbers obey.'],
        loseText: ['Das Chaos siegt.', 'Chaos prevails.'],
      },
      {
        label: ['Sich dem Chaos hingeben', 'Surrender to Chaos'],
        win: [{ fight: 'elite' }]
      }
    ]
  }
];
