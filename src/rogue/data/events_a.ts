// Ereignisse I (Entwurf gemma4:12b, geprüft)
import { EventDef } from '../types';

export const EVENTS_A: EventDef[] = [
  {
    id: 'schmuggler-kantine-0',
    act: 0,
    icon: '♢',
    title: ['Schmugglerkantine', 'Smuggler Cantina'],
    text: ['Der Geruch von synthetischem Alkohol und verbranntem Öl liegt schwer in der Luft. Ein Gruppe von Kreaturen lacht laut über einen schlechten Witz.', 'The smell of synthetic alcohol and burnt oil hangs heavy in the air. A group of creatures laughs loudly at a bad joke.'],
    options: [
      {
        label: ['Einen Drink mit ihnen teilen', 'Share a drink with them'],
        check: { chance: 0.4, raise: { cost: 'gold', per: 15, add: 0.1, max: 3 } },
        win: [{ gold: 20, staub: 5 }],
        lose: [{ gold: -10, hp: -3 }],
        winText: ['Du gewinnst einen Tipp.', 'You gain a tip.'],
        loseText: ['Sie nehmen dir etwas mit.', 'They take something from you.'],
      },
      {
        label: ['Einfach nur zusehen', 'Just watch'],
        win: [{ gold: 5, staub: 2 }]
      }
    ]
  },
  {
    id: 'schneckenhaendler-0',
    act: 0,
    icon: '@',
    title: ['Schneckenhändler-Auktion', 'Slug Merchant Auction'],
    text: ['Ein flinker Händler präsentiert glitzernde Schnecken aus den Tiefen der Nebel. Er scheint dich mit seinen vielen Augen zu fixieren.', 'A nimble merchant presents glittering slugs from the depths of the nebulae. He seems to fixate on you with his many eyes.'],
    options: [
      {
        label: ['Einem Gebot zustimmen', 'Agree to a bid'],
        need: { gold: 20 },
        check: { chance: 0.5, raise: { cost: 'gold', per: 20, add: 0.12, max: 3 } },
        win: [{ gold: -20, card: 'rare' }],
        lose: [{ gold: -20, hp: -5 }],
        winText: ['Du erhältst ein seltenes Symbol.', 'You receive a rare symbol.'],
        loseText: ['Der Händler lacht dich aus.', 'The merchant laughs at you.'],
      },
      {
        label: ['Den Auktion verlassen', 'Leave the auction'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'generationenschiff-0',
    act: 0,
    icon: '⌂',
    title: ['Treibendes Generationenschiff', 'Drifting Generation Ship'],
    text: ['Ein riesiges, verlassenes Schiff treibt träge durch den Sektor. Die Innenräume sind von dichten Ranken überzogen.', 'A massive, abandoned ship drifts sluggishly through the sector. The interior rooms are overgrown with dense vines.'],
    options: [
      {
        label: ['In die Maschinenräume eindringen', 'Enter the machine rooms'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ gold: 40, relic: 'common' }],
        lose: [{ hp: -8, curse: true }],
        winText: ['Du findest alte Module.', 'You find old modules.'],
        loseText: ['Die Sicherheitsanlagen schlagen zu.', 'The security systems strike back.'],
      },
      {
        label: ['Nur die Hülle inspizieren', 'Only inspect the hull'],
        win: [{ staub: 15 }]
      }
    ]
  },
  {
    id: 'mottenschrein-0',
    act: 0,
    icon: '✧',
    title: ['Mottenschrein', 'Moth Shrine'],
    text: ['Ein kleiner Altar ist mit flüssigem Licht geschmückt. Eine Vael-ähnliche Gestalt flüstert Gebete in den Äther.', 'A small altar is decorated with liquid light. A Vael-like figure whispers prayers into the ether.'],
    options: [
      {
        label: ['Ein Opfer darbringen', 'Make an offering'],
        need: { gold: 10 },
        check: { chance: 0.7, raise: { cost: 'gold', per: 10, add: 0.15, max: 3 } },
        win: [{ hp: 10, maxHp: 2, staub: 20 }],
        lose: [{ gold: -10, curse: true }],
        winText: ['Das Licht umhüllt dich.', 'The light envelops you.'],
        loseText: ['Die Schatten werden dunkler.', 'The shadows grow darker.'],
      },
      {
        label: ['Den Schrein ignorieren', 'Ignore the shrine'],
        win: [{ staub: 5 }]
      }
    ]
  },
  {
    id: 'kopfgeldausschreibung-0',
    act: 0,
    icon: '§',
    title: ['Kopfgeldausschreibung', 'Bounty Notice'],
    text: ['Ein Hologramm flackert vor dir. Es zeigt ein Bild eines gefährlichen Wesens und verspricht eine hohe Belohnung.', 'A hologram flickers before you. It shows a picture of a dangerous creature and promises a high reward.'],
    options: [
      {
        label: ['Die Jagd annehmen', 'Accept the hunt'],
        check: { chance: 0.45, raise: { cost: 'hp', per: 5, add: 0.1, max: 3 } },
        win: [{ gold: 60, fight: 'elite' }],
        lose: [{ hp: -12, curse: true }],
        winText: ['Du nimmst die Herausforderung an.', 'You accept the challenge.'],
        loseText: ['Die Jagd ist gefährlicher als gedacht.', 'The hunt is more dangerous than expected.'],
      },
      {
        label: ['Das Hologramm löschen', 'Delete the hologram'],
        win: [{ gold: 5 }]
      }
    ]
  },
  {
    id: 'asteroidenkloster-1',
    act: 1,
    icon: '✝',
    title: ['Asteroidenkloster', 'Asteroid Monastery'],
    text: ['Zwischen den Trümmern eines zerbrochenen Planeten ruht ein Kloster. Die Mönche hier meditieren über das Ende der Sterne.', 'Amidst the ruins of a broken planet lies a monastery. The monks here meditate on the end of the stars.'],
    options: [
      {
        label: ['Um Segen bitten', 'Ask for a blessing'],
        check: { chance: 0.6, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ hp: 15, maxHp: 3, staub: 25 }],
        lose: [{ gold: -20, curse: true }],
        winText: ['Ein warmer Glanz erfüllt dich.', 'A warm glow fills you.'],
        loseText: ['Die Mönche bleiben stumm.', 'The monks remain silent.'],
      },
      {
        label: ['Einfach vorbeifliegen', 'Just fly by'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'singender-eisplanet-1',
    act: 1,
    icon: '❄',
    title: ['Singender Eisplanet', 'Singing Ice Planet'],
    text: ['Die Oberfläche des Planeten vibriert in einer tiefen, melancholischen Frequenz. Das Eis scheint zu weinen.', 'The surface of the planet vibrates in a deep, melancholy frequency. The ice seems to weep.'],
    options: [
      {
        label: ['Die Melodie aufnehmen', 'Record the melody'],
        check: { chance: 0.5, raise: { cost: 'hp', per: 3, add: 0.1, max: 3 } },
        win: [{ staub: 30, card: 'rare' }],
        lose: [{ hp: -6, curse: true }],
        winText: ['Die Frequenz ist wunderschön.', 'The frequency is beautiful.'],
        loseText: ['Der Ton schmerzt deine Sinne.', 'The tone hurts your senses.'],
      },
      {
        label: ['Die Kälte ignorieren', 'Ignore the cold'],
        win: [{ staub: 5 }]
      }
    ]
  },
  {
    id: 'sporenwolke-1',
    act: 1,
    icon: '♠',
    title: ['Sporenwolke', 'Spore Cloud'],
    text: ['Eine dichte, violette Wolke aus biologischen Sporen umhüllt deinen Sektor. Deine Sensoren warnen vor Toxinen.', 'A dense, violet cloud of biological spores envelops your sector. Your sensors warn of toxins.'],
    options: [
      {
        label: ['Filteranlagen überlasten', 'Overload filters'],
        need: { gold: 15 },
        check: { chance: 0.4, raise: { cost: 'gold', per: 15, add: 0.1, max: 3 } },
        win: [{ hp: 5, staub: 10 }],
        lose: [{ hp: -10, curse: true }],
        winText: ['Die Luft wird klar.', 'The air clears.'],
        loseText: ['Die Sporen dringen ein.', 'The spores penetrate inside.'],
      },
      {
        label: ['Kurz durchfliegen', 'Fly through briefly'],
        win: [{ hp: -5, staub: 5 }]
      }
    ]
  },
  {
    id: 'lilienraumschiff-1',
    act: 1,
    icon: '❀',
    title: ['Lilienraumschiff', 'Lily Spaceship'],
    text: ['Ein Schiff aus weißem Metall und organischen Lilienstrukturen treibt friedlich. Es wirkt fast wie ein Garten im All.', 'A ship of white metal and organic lily structures drifts peacefully. It looks almost like a garden in space.'],
    options: [
      {
        label: ['Die Gärten erkunden', 'Explore the gardens'],
        check: { chance: 0.6, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } },
        win: [{ relic: 'rare', staub: 20 }],
        lose: [{ hp: -7, curse: true }],
        winText: ['Du findest eine seltene Modul.', 'You find a rare module.'],
        loseText: ['Die Pflanzen sind aggressiv.', 'The plants are aggressive.'],
      },
      {
        label: ['Nur von außen betrachten', 'Only observe from outside'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'wuestenplanet-1',
    act: 1,
    icon: '☀',
    title: ['Wüstenplanet mit Doppelsonne', 'Desert Planet with Twin Suns'],
    text: ['Der Sand glüht unter der Hitze von zwei Sonnen. Die Hitze beeinträchtigt deine Systeme.', 'The sand glows under the heat of two suns. The heat affects your systems.'],
    options: [
      {
        label: ['Kühlung maximieren', 'Maximize cooling'],
        need: { gold: 30 },
        check: { chance: 0.5, raise: { cost: 'gold', per: 20, add: 0.1, max: 3 } },
        win: [{ hp: 10, maxHp: 4 }],
        lose: [{ gold: -30, curse: true }],
        winText: ['Die Systeme stabilisieren sich.', 'The systems stabilize.'],
        loseText: ['Die Kühlung versagt.', 'The cooling fails.'],
      },
      {
        label: ['Schnell durchqueren', 'Cross quickly'],
        win: [{ hp: -10, staub: 15 }]
      }
    ]
  },
  {
    id: 'verwunschener-leuchtturm-2',
    act: 2,
    icon: '♜',
    title: ['Verwunschener Leuchtturm', 'Enchanted Lighthouse'],
    text: ['Ein Leuchtturm sendet ein Licht aus, das nicht physikalisch zu erklären ist. Es scheint die Zeit selbst zu krümmen.', 'A lighthouse emits a light that is not physically explainable. It seems to warp time itself.'],
    options: [
      {
        label: ['In den Strahl treten', 'Step into the beam'],
        check: { chance: 0.4, raise: { cost: 'hp', per: 6, add: 0.15, max: 3 } },
        win: [{ card: 'epic', staub: 30 }],
        lose: [{ hp: -15, curse: true }],
        winText: ['Du siehst Visionen.', 'You see visions.'],
        loseText: ['Die Zeit frisst dich.', 'Time consumes you.'],
      },
      {
        label: ['Den Turm meiden', 'Avoid the tower'],
        win: [{ staub: 5 }]
      }
    ]
  },
  {
    id: 'droidenschrottplatz-2',
    act: 2,
    icon: '⚙',
    title: ['Droidenschrottplatz', 'Droid Scrap Yard'],
    text: ['Hunderte von zerbrochenen Droiden liegen hier verstreut. Einige scheinen noch immer schwach zu summen.', 'Hundreds of broken droids lie scattered here. Some still seem to hum weakly.'],
    options: [
      {
        label: ['Schrott einsammeln', 'Collect scrap'],
        check: { chance: 0.7, raise: { cost: 'gold', per: 15, add: 0.1, max: 3 } },
        win: [{ gold: 40, relic: 'rare' }],
        lose: [{ gold: -10, curse: true }],
        winText: ['Du findest wertvolle Teile.', 'You find valuable parts.'],
        loseText: ['Ein Droiden greift an.', 'A droid attacks.'],
      },
      {
        label: ['Einfach durchlaufen', 'Just walk through'],
        win: [{ staub: 10 }]
      }
    ]
  },
  {
    id: 'architekt-begegnung-2',
    act: 2,
    icon: '◉',
    title: ['Die Stimme der Entropie', 'The Voice of Entropy'],
    text: ['Eine Stimme hallt durch dein Schiff. Es ist der Architekt. Er fordert eine Antwort auf deine Existenz.', 'A voice echoes through your ship. It is the Architect. He demands an answer to your existence.'],
    options: [
      {
        label: ['Ihm trotzen', 'Defy him'],
        check: { chance: 0.35, raise: { cost: 'hp', per: 6, add: 0.15, max: 3 } },
        win: [{ staub: 30, card: 'epic' }],
        lose: [{ hp: -15, curse: true }],
        winText: ['Du bleibst standhaft.', 'You remain steadfast.'],
        loseText: ['Seine Stimme erschüttert dich.', 'His voice shakes you.'],
      },
      {
        label: ['Schweigen', 'Remain silent'],
        win: [{ staub: 5 }]
      }
    ]
  },
  {
    id: 'lumen-ruheplatz-2',
    act: 2,
    icon: '✧',
    title: ['Lumen-Ruheplatz', 'Lumen Resting Place'],
    text: ['Das Sternenherz Lumen pulsiert ruhig. Es scheint die Umgebung in ein sanftes Gold zu tauchen.', 'The Star Heart Lumen pulses calmly. It seems to bathe the surroundings in a soft gold.'],
    options: [
      {
        label: ['Energie übertragen', 'Transfer energy'],
        check: { chance: 0.8, raise: { cost: 'hp', per: 3, add: 0.1, max: 3 } },
        win: [{ hp: 20, maxHp: 5, staub: 25 }],
        lose: [{ hp: -5 }],
        winText: ['Lumen nährt dich.', 'Lumen nourishes you.'],
        loseText: ['Die Energie ist instabil.', 'The energy is unstable.'],
      },
      {
        label: ['Ruhen', 'Rest'],
        win: [{ hp: 5 }]
      }
    ]
  },
  {
    id: 'kassik-tor-begegnung-2',
    act: 2,
    icon: '⌖',
    title: ['Kassik-Tor im Schatten', 'Kassik-Tor in the Shadows'],
    text: ['Die insektoide Jägerin erscheint plötzlich. Sie hält ihre Waffe bereit, aber ihr Blick ist nachdenklich.', 'The insectoid hunter appears suddenly. She holds her weapon ready, but her gaze is thoughtful.'],
    options: [
      {
        label: ['Verhandeln', 'Negotiate'],
        need: { gold: 20 },
        check: { chance: 0.6, raise: { cost: 'gold', per: 15, add: 0.1, max: 3 } },
        win: [{ gold: 30, relic: 'rare' }],
        lose: [{ hp: -10, fight: 'normal' }],
        winText: ['Sie lässt dich ziehen.', 'She lets you go.'],
        loseText: ['Sie fordert einen Kampf.', 'She demands a fight.'],
      },
      {
        label: ['Flucht', 'Escape'],
        win: [{ hp: -5 }]
      }
    ]
  }
];
