// Ereignisse III (v4.6): Begegnungen der neuen Sektoren (Schiffsgrab, Riff, Thal’Ora, Sturm) und der Hafen-Kantinen.
import { EventDef } from '../types';

export const EVENTS_C: EventDef[] = [
  // ------------------------------------------------------------------------------------- Schiffsgrab von Kesh
  { id: 'kesh-funkspruch', act: 1, sector: 'werft', icon: '📡', title: ['Ein Funkspruch aus dem Wrack', 'A transmission from the wreck'],
    text: ['Aus einem ausgebrannten Kurierschiff dringt eine Endlosschleife: „… Ladung intakt … wer das hört …“ Die Frachtluke steht halb offen.', 'From a burnt-out courier ship comes an endless loop: “… cargo intact … whoever hears this …” The cargo hatch stands half open.'],
    options: [
      { label: ['Hineinklettern', 'Climb inside'], check: { chance: 0.55, raise: { cost: 'hp', per: 4, add: 0.1, max: 3 } }, win: [{ relic: 'rare' }], lose: [{ hp: -8, curse: 'leck' }],
        winText: ['Die Ladung ist ein Modul – und es funktioniert noch.', 'The cargo is a module – and it still works.'], loseText: ['Die Falle schnappt zu. Ein Leck bleibt.', 'The trap snaps shut. A breach remains.'] },
      { label: ['Den Spruch an die Toten weitersenden', 'Relay the message for the dead'], win: [{ staub: 12, hp: 4 }], winText: ['Irgendwo antwortet ein leises Licht.', 'Somewhere a faint light answers.'] },
    ] },
  { id: 'kesh-schrotthaendler', act: 1, sector: 'werft', icon: '🔧', title: ['Schrotthändlerin Nim-Vey', 'Scrap Dealer Nim-Vey'],
    text: ['Eine Krabbenfrau mit sechs Lupen sortiert Wrackteile. „Ich nehme deinen Müll. Ich gebe dir … anderen Müll. Besseren Müll.“', 'A crab woman with six loupes sorts wreckage. “I take your junk. I give you … other junk. Better junk.”'],
    options: [
      { label: ['Ein Symbol eintauschen', 'Trade in a symbol'], win: [{ removeCard: true, card: 'random' }], winText: ['Getauscht. Hoffentlich gegen Besseres.', 'Traded. Hopefully for something better.'] },
      { label: ['Ein Ersatzteil kaufen (60 ✦)', 'Buy a spare part (60 ✦)'], need: { gold: 60 }, win: [{ gold: -60, relic: 'common' }, { maxHp: 4 }] },
      { label: ['Weiterfliegen', 'Fly on'], win: [] },
    ] },
  { id: 'kesh-geisterflotte', act: 1, sector: 'werft', icon: '👻', title: ['Die Geisterflotte', 'The Ghost Fleet'],
    text: ['Zwischen den Wracks gleiten Schiffe ohne Besatzung in perfekter Formation. Ihre Kanonen folgen dir – aber sie feuern nicht. Noch nicht.', 'Between the wrecks, crewless ships glide in perfect formation. Their cannons follow you – but they do not fire. Not yet.'],
    options: [
      { label: ['Den Flaggschiff-Tresor plündern', 'Loot the flagship vault'], win: [{ gold: 90 }, { fight: 'elite' }], winText: ['Die Kanonen erwachen!', 'The cannons awaken!'] },
      { label: ['Mit gelöschten Lichtern durchschleichen', 'Sneak through, lights out'], check: { chance: 0.6 }, win: [{ gold: 30, staub: 6 }], lose: [{ hp: -12 }], loseText: ['Eine Salve streift die Hülle.', 'A volley grazes the hull.'] },
    ] },
  // ------------------------------------------------------------------------------------- Lebendes Riff
  { id: 'riff-perle', act: 1, sector: 'riff', icon: '🦪', title: ['Die Sternperle', 'The Star Pearl'],
    text: ['Eine Riesenmuschel öffnet sich träge. In ihr glüht eine Perle aus verdichtetem Sternenlicht. Der Schließmuskel zittert.', 'A giant clam opens lazily. Inside glows a pearl of condensed starlight. The muscle quivers.'],
    options: [
      { label: ['Schnell zugreifen', 'Grab it fast'], check: { chance: 0.5, raise: { cost: 'hp', per: 5, add: 0.12, max: 3 } }, win: [{ card: 'epic' }], lose: [{ hp: -10 }],
        winText: ['Die Perle formt sich zu einem Symbol.', 'The pearl shapes itself into a symbol.'], loseText: ['Die Muschel schnappt zu!', 'The clam snaps shut!'] },
      { label: ['Ihr ein Lied vorsummen', 'Hum it a song'], win: [{ hp: 12, staub: 4 }], winText: ['Das Riff summt zurück. Deine Hülle heilt im Leuchten.', 'The reef hums back. Your hull heals in the glow.'] },
    ] },
  { id: 'riff-symbiont', act: 1, sector: 'riff', icon: '🪸', title: ['Ein Symbiont', 'A Symbiont'],
    text: ['Ein leuchtender Polyp möchte sich an deinen Reaktor heften. Er verspricht Wachstum – und frisst ein wenig Hülle.', 'A glowing polyp wants to attach itself to your reactor. It promises growth – and eats a little hull.'],
    options: [
      { label: ['Annehmen', 'Accept'], win: [{ maxHp: -6 }, { upgradeCard: true }, { upgradeCard: true }], winText: ['Zwei Symbole wachsen über sich hinaus.', 'Two symbols grow beyond themselves.'] },
      { label: ['Vorsichtig ablehnen', 'Decline carefully'], win: [{ staub: 5 }] },
    ] },
  { id: 'riff-schwarmruf', act: 1, sector: 'riff', icon: '🐟', title: ['Der Schwarmruf', 'The Swarm Call'],
    text: ['Tausende Lichtfische umkreisen dein Schiff, bis es selbst zu leuchten beginnt. Ein Fischer-Mönch bietet an, ihr Lied in deinen Reaktor zu weben.', 'Thousands of light-fish circle your ship until it begins to glow. A fisher-monk offers to weave their song into your reactor.'],
    options: [
      { label: ['Lied weben (40 ✦)', 'Weave the song (40 ✦)'], need: { gold: 40 }, win: [{ gold: -40, card: 'rare' }] },
      { label: ['Mit dem Schwarm fliegen', 'Fly with the swarm'], win: [{ hp: 8 }] },
    ] },
  // ------------------------------------------------------------------------------------- Thal’Ora
  { id: 'thal-glyphentor', act: 2, sector: 'tiefsee', icon: '𓂀', title: ['Das Glyphentor', 'The Glyph Gate'],
    text: ['Ein Tor aus blauem Kristall, bedeckt mit Zeichen, die sich bewegen, wenn man sie ansieht. Dein Reaktor beginnt, sie zu übersetzen.', 'A gate of blue crystal covered in signs that move when you look at them. Your reactor begins to translate them.'],
    options: [
      { label: ['Die Inschrift ganz lesen', 'Read the whole inscription'], check: { chance: 0.55, raise: { cost: 'gold', per: 25, add: 0.1, max: 3 } }, win: [{ relic: 'epic' }], lose: [{ curse: 'dunkelnebel', hp: -6 }],
        winText: ['Das Tor öffnet sich zu einer Schatzkammer der Alten.', 'The gate opens onto a treasury of the ancients.'], loseText: ['Die Glyphen brennen sich in deine Walzen.', 'The glyphs burn into your reels.'] },
      { label: ['Nur den ersten Satz', 'Only the first sentence'], win: [{ staub: 10, upgradeCard: true }] },
    ] },
  { id: 'thal-herzkammer', act: 2, sector: 'tiefsee', icon: '💠', title: ['Die Herzkammer', 'The Heart Chamber'],
    text: ['Ein leerer Sockel, auf dem einst ein Stern ruhte. Lumen zieht dich dorthin. „Lass mich nur kurz … ausruhen.“', 'An empty pedestal where a star once rested. Lumen pulls you there. “Let me just … rest for a moment.”'],
    options: [
      { label: ['Lumen rasten lassen', 'Let Lumen rest'], win: [{ hp: 30 }], winText: ['Der Reaktor glüht warm und ruhig.', 'The reactor glows warm and calm.'] },
      { label: ['Den Sockel abbauen und verkaufen', 'Dismantle and sell the pedestal'], win: [{ gold: 110 }, { maxHp: -4 }], winText: ['Lumen schweigt lange.', 'Lumen stays silent for a long time.'] },
    ] },
  { id: 'thal-leviathan-schuppe', act: 2, sector: 'tiefsee', icon: '🐚', title: ['Eine Leviathan-Schuppe', 'A Leviathan Scale'],
    text: ['Eine abgeworfene Panzerplatte des Wächters, so groß wie dein Schiff. Sie summt noch vor Energie.', 'A shed armour plate of the guardian, as large as your ship. It still hums with energy.'],
    options: [
      { label: ['Als Panzer anschweißen', 'Weld it on as armour'], win: [{ maxHp: 10 }], winText: ['+10 maximale Hülle.', '+10 max hull.'] },
      { label: ['Den Energiekern anzapfen', 'Tap its energy core'], check: { chance: 0.5 }, win: [{ relic: 'rare' }, { gold: 40 }], lose: [{ hp: -14 }] },
    ] },
  // ------------------------------------------------------------------------------------- Sturm von Vhar
  { id: 'vhar-blitzfaenger', act: 2, sector: 'sturm', icon: '⚡', title: ['Der Blitzfänger', 'The Lightning Catcher'],
    text: ['Ein verlassener Turm im Sturm, gebaut, um Blitze einzufangen. Seine Batterien sind voll – und instabil.', 'An abandoned tower in the storm, built to catch lightning. Its batteries are full – and unstable.'],
    options: [
      { label: ['Batterien plündern', 'Loot the batteries'], check: { chance: 0.55, raise: { cost: 'hp', per: 5, add: 0.1, max: 3 } }, win: [{ gold: 70, card: 'rare' }], lose: [{ hp: -16 }] },
      { label: ['Den Reaktor kurz aufladen', 'Briefly charge the reactor'], win: [{ upgradeCard: true }, { hp: -6 }] },
    ] },
  { id: 'vhar-wolkenhirten', act: 2, sector: 'sturm', icon: '☁', title: ['Die Wolkenhirten', 'The Cloud Herders'],
    text: ['Nomaden auf Flößen aus Gas treiben Herden von Wolkenwalen. Sie bieten Schutz im Windschatten – gegen eine Geschichte.', 'Nomads on rafts of gas drive herds of cloud whales. They offer shelter in the lee – for a story.'],
    options: [
      { label: ['Von Lumen erzählen', 'Tell them about Lumen'], win: [{ hp: 15, staub: 6 }] },
      { label: ['Ihre Wale kaufen (lieber nicht)', 'Buy their whales (better not)'], need: { gold: 80 }, win: [{ gold: -80, relic: 'epic' }] },
    ] },
  { id: 'vhar-auge', act: 2, sector: 'sturm', icon: '🌀', title: ['Im Auge des Sturms', 'In the Eye of the Storm'],
    text: ['Plötzlich Stille. Über dir ein Kreis aus Sternen, unter dir ein Abgrund aus Blitzen. Etwas Glitzerndes treibt in der Mitte.', 'Sudden silence. Above you a circle of stars, below you an abyss of lightning. Something glittering drifts in the middle.'],
    options: [
      { label: ['Hinfliegen, bevor sich der Sturm schließt', 'Fly in before the storm closes'], check: { chance: 0.45 }, win: [{ relic: 'legendary' }], lose: [{ hp: -18, curse: 'parasit' }],
        winText: ['Gerade noch! Ein legendäres Modul.', 'Just in time! A legendary module.'], loseText: ['Der Sturm schließt sich um dich.', 'The storm closes around you.'] },
      { label: ['Die Stille genießen', 'Enjoy the silence'], win: [{ hp: 10, removeCard: true }] },
    ] },
  // ------------------------------------------------------------------------------------- Hafen-Kantinen
  { id: 'port-armdruecken', act: 0, port: true, icon: '💪', title: ['Armdrücken mit einem Vierarmigen', 'Arm-wrestling a four-armed giant'],
    text: ['Brakks Cousin fordert jeden heraus. Er hat vier Arme. Du hast zwei. Die Wetten stehen 5 zu 1.', 'Brakk’s cousin challenges everyone. He has four arms. You have two. The odds are 5 to 1.'],
    options: [
      { label: ['Antreten (30 ✦ Einsatz)', 'Compete (30 ✦ stake)'], need: { gold: 30 }, check: { chance: 0.3, raise: { cost: 'gold', per: 20, add: 0.12, max: 3 } }, win: [{ gold: 150 }], lose: [{ gold: -30, hp: -4 }] },
      { label: ['Zuschauen und mitwetten', 'Watch and bet along'], win: [{ gold: 20 }] },
    ] },
  { id: 'port-kartenleser', act: 0, port: true, icon: '🗺', title: ['Der Kartenleser', 'The Chart Reader'],
    text: ['Ein blinder Navigator liest Sternkarten mit den Fingerspitzen. Für ein paar Taler verrät er, was dich erwartet.', 'A blind navigator reads star charts with his fingertips. For a few coins he tells you what awaits.'],
    options: [
      { label: ['Zuhören (25 ✦)', 'Listen (25 ✦)'], need: { gold: 25 }, win: [{ gold: -25, card: 'rare', staub: 8 }] },
      { label: ['Ihm eine Karte schenken', 'Give him a chart'], win: [{ staub: 10 }] },
    ] },
  { id: 'port-schwarzmarkt', act: 0, port: true, icon: '🕶', title: ['Hinterzimmer', 'Back Room'],
    text: ['Eine Tür ohne Schild. Dahinter: Module, die es offiziell nicht gibt. Der Verkäufer trägt eine Maske aus Schneckenschleim.', 'A door with no sign. Behind it: modules that officially do not exist. The seller wears a mask of slug slime.'],
    options: [
      { label: ['Ein verbotenes Modul (120 ✦)', 'A forbidden module (120 ✦)'], need: { gold: 120 }, win: [{ gold: -120, relic: 'legendary' }] },
      { label: ['Ein verfluchtes Modul mitnehmen – gratis', 'Take a cursed module – free'], win: [{ relic: 'cursed', gold: 40 }] },
      { label: ['Leise wieder gehen', 'Quietly leave'], win: [] },
    ] },
  { id: 'port-saengerin', act: 0, port: true, icon: '🎶', title: ['Die Sängerin der Kantine', 'The Cantina Singer'],
    text: ['Ihre Stimme klingt wie ein Stern, der aufgeht. Lumen pulsiert im Takt. Für einen Moment ist alles gut.', 'Her voice sounds like a rising star. Lumen pulses in time. For a moment, everything is fine.'],
    options: [
      { label: ['Bis zum Schluss bleiben', 'Stay to the end'], win: [{ hp: 20, staub: 4 }] },
      { label: ['Ein Lied für Lumen erbitten (30 ✦)', 'Request a song for Lumen (30 ✦)'], need: { gold: 30 }, win: [{ gold: -30, upgradeCard: true, maxHp: 4 }] },
    ] },
  { id: 'port-kopfgeldjaeger', act: 0, port: true, icon: '🗡', title: ['Rivalen', 'Rivals'],
    text: ['Zwei Kopfgeldjäger mustern deinen Reaktor zu lange. „Netter Stern. Wäre schade, wenn er … den Besitzer wechselt.“', 'Two bounty hunters stare at your reactor too long. “Nice star. Shame if it … changed owners.”'],
    options: [
      { label: ['Sie draußen erwarten', 'Wait for them outside'], win: [{ fight: 'normal', gold: 45 }] },
      { label: ['Kassik dazuholen (20 ✦)', 'Call Kassik over (20 ✦)'], need: { gold: 20 }, win: [{ gold: -20, staub: 6 }], winText: ['Klick. Die beiden gehen plötzlich sehr schnell.', 'Click. The two suddenly leave very quickly.'] },
    ] },
  { id: 'port-erbstueck', act: 0, port: true, icon: '🧭', title: ['Ein Erbstück', 'An Heirloom'],
    text: ['Eine alte Kurierin erkennt dein Schiffsmodell. „Mein Kompass. Er hat mich immer heimgebracht. Ich fliege nicht mehr.“', 'An old courier recognises your ship model. “My compass. It always brought me home. I don’t fly anymore.”'],
    options: [
      { label: ['Dankend annehmen', 'Accept with thanks'], win: [{ relic: 'rare' }] },
      { label: ['Ihr stattdessen zuhören', 'Listen to her instead'], win: [{ staub: 14 }] },
    ] },
];
