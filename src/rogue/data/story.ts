// Die Geschichte von STERNENFALL. Kapitel werden über viele Läufe hinweg freigeschaltet (erster Besuch eines Sektors,
// erster Bosssieg, erster Gesamtsieg …) und im Logbuch gesammelt. Figuren tauchen an Stationen und in Ereignissen auf.
import { Tx } from '../types';

const T = (de: string, en: string): Tx => [de, en];

/** Wiederkehrende Figuren (Porträts in art.ts → portrait(id)). */
export const CAST: Record<string, { name: Tx; role: Tx; portrait: string; hue: number }> = {
  ilya: { name: T('Ilya Vantis', 'Ilya Vantis'), role: T('Kurierin, du', 'Courier, you'), portrait: 'ilya', hue: 30 },
  herz: { name: T('Das Sternenherz', 'The Star Heart'), role: T('Dein Reaktor – ein gefangener, sterbender Stern', 'Your reactor – a captured, dying star'), portrait: 'herz', hue: 40 },
  ozzo: { name: T('Ozzo Gulmarrak', 'Ozzo Gulmarrak'), role: T('Schneckenkaufmann, Händler und Halsabschneider', 'Slug merchant, trader and cutthroat'), portrait: 'ozzo', hue: 90 },
  vael: { name: T('Vael', 'Vael'), role: T('Mottenseherin vom Orden der Lichtsammler', 'Moth seer of the Order of Light-Gatherers'), portrait: 'vael', hue: 280 },
  kassik: { name: T('Kassik-Tor', 'Kassik-Tor'), role: T('Insektoide Kopfgeldjägerin', 'Insectoid bounty hunter'), portrait: 'kassik', hue: 150 },
  brakk: { name: T('Brakk', 'Brakk'), role: T('Vierarmiger Mechaniker der Raumstationen', 'Four-armed station mechanic'), portrait: 'brakk', hue: 20 },
  sola: { name: T('Croupière Sola-Nn', 'Croupier Sola-Nn'), role: T('Tentakelbärtige Hüterin des Casinos „Ewiger Orbit“', 'Tentacle-bearded keeper of the casino “Eternal Orbit”'), portrait: 'sola', hue: 320 },
  architekt: { name: T('Der Architekt', 'The Architect'), role: T('Stimme der Entropie, löscht die Sterne', 'Voice of Entropy, puts out the stars'), portrait: 'architekt', hue: 260 },
};

export interface Chapter { id: string; title: Tx; unlock: string; lines: { who: string; text: Tx }[] }

/** unlock: 'start' | 'visit:<sektor>' | 'boss:<sektor>' | 'win' | 'final' | 'runs:<n>' */
export const CHAPTERS: Chapter[] = [
  { id: 'prolog', title: T('Prolog · Die Verlöschung', 'Prologue · The Dimming'), unlock: 'start', lines: [
    { who: 'ilya', text: T('Vor drei Zyklen gingen die ersten Sterne aus. Nicht wie Sterne sterben – sie wurden einfach still, wie Kerzen, die jemand zwischen zwei Fingern erstickt.', 'Three cycles ago the first stars went out. Not the way stars die – they simply fell silent, like candles snuffed between two fingers.') },
    { who: 'herz', text: T('… Kurierin. Ich höre die anderen. Sie rufen aus dem Kern. Bring mich zu ihnen, bevor auch mein Licht vergeht.', '… Courier. I hear the others. They call from the Core. Take me to them before my light fades too.') },
    { who: 'ilya', text: T('Mein Reaktor spricht. Er ist ein gefangener Stern, und er stirbt. Also fliege ich – durch Gürtel, Nebel und Horizonte, bis zum Kern der Galaxis. Jeder Dreh am Reaktor kostet ihn Kraft. Jeder Sieg gibt ihm welche zurück.', 'My reactor speaks. It is a captured star, and it is dying. So I fly – through belts, nebulae and horizons, to the galactic Core. Every spin of the reactor costs it strength. Every victory gives some back.') },
  ] },
  { id: 'k1', title: T('Kapitel I · Steine, die singen', 'Chapter I · Stones that Sing'), unlock: 'visit:guertel', lines: [
    { who: 'ozzo', text: T('Hrrm. Eine Kurierin mit einem lebenden Stern im Bauch. Weißt du, was so etwas wert ist? Mehr als dieser ganze Gürtel. Kauf bei Ozzo, solange du noch kannst.', 'Hrrm. A courier with a living star in her belly. Do you know what that is worth? More than this whole belt. Buy from Ozzo while you still can.') },
    { who: 'herz', text: T('Die Felsen hier waren einst ein Planet. Er hat zu laut gesungen, sagen sie. Der Architekt mag keine Lieder.', 'These rocks were once a planet. It sang too loudly, they say. The Architect does not like songs.') },
  ] },
  { id: 'k1b', title: T('Kapitel I · Die Steinerne Königin', 'Chapter I · The Stone Queen'), unlock: 'boss:guertel', lines: [
    { who: 'ilya', text: T('Die Königin zerfiel zu Staub, und im Staub lag ein Lichtsplitter – ein Stück eines erloschenen Sterns. Das Herz trank ihn wie Wasser.', 'The Queen crumbled to dust, and in the dust lay a shard of light – a piece of a dead star. The Heart drank it like water.') },
    { who: 'herz', text: T('Ich erinnere mich … an einen Namen. Lumen. So hieß ich, bevor sie mich einfingen.', 'I remember … a name. Lumen. That was my name before they caught me.') },
  ] },
  { id: 'k2', title: T('Kapitel II · Der Frostring', 'Chapter II · The Frost Ring'), unlock: 'visit:frost', lines: [
    { who: 'kassik', text: T('Klick. Klick. Auf deinen Stern ist ein Preis ausgesetzt, Kurierin. Ein hoher. Aber ich jage nicht für Leute, die Sterne auslöschen. Noch nicht.', 'Click. Click. There is a price on your star, courier. A high one. But I do not hunt for people who put out stars. Not yet.') },
    { who: 'ilya', text: T('Kassik-Tor folgt mir seitdem. Immer drei Sprünge hinter mir. Ich weiß nicht, ob sie mich beschützt oder auf den richtigen Moment wartet.', 'Kassik-Tor has followed me since. Always three jumps behind. I do not know whether she protects me or waits for the right moment.') },
  ] },
  { id: 'k3', title: T('Kapitel III · Die Lilien von Orion', 'Chapter III · The Lilies of Orion'), unlock: 'visit:orion', lines: [
    { who: 'vael', text: T('Du trägst Lumen. Ich sehe es an den Rändern deines Schattens. Wir Motten folgen dem Licht seit Anbeginn – aber nun folgt das Dunkel uns.', 'You carry Lumen. I see it at the edges of your shadow. We moths have followed the light since the beginning – but now the dark follows us.') },
    { who: 'vael', text: T('Der Architekt war einst einer von uns. Ein Lichtsammler, der zu viel sammelte. Er will die Sterne nicht zerstören. Er will sie besitzen.', 'The Architect was once one of us. A gatherer of light who gathered too much. He does not want to destroy the stars. He wants to own them.') },
  ] },
  { id: 'k3b', title: T('Kapitel III · Die Nebelkaiserin', 'Chapter III · The Nebula Empress'), unlock: 'boss:orion', lines: [
    { who: 'ilya', text: T('Die Kaiserin trug eine Krone aus gefangenen Sternen. Als sie fiel, flogen sie heim – Hunderte kleine Lichter, zurück an den Himmel.', 'The Empress wore a crown of captured stars. When she fell, they flew home – hundreds of little lights, back into the sky.') },
    { who: 'herz', text: T('Siehst du? Man kann es rückgängig machen. Man kann ihn aufhalten.', 'Do you see? It can be undone. He can be stopped.') },
  ] },
  { id: 'k4', title: T('Kapitel IV · Das Leuchtfeuer', 'Chapter IV · The Beacon'), unlock: 'visit:pulsar', lines: [
    { who: 'brakk', text: T('Vier Hände, zwei Schraubenschlüssel, ein Problem: dein Reaktor glüht wie ein Grillrost. Setz dich. Ich mach das. Und bezahl Ozzo nicht im Voraus, egal was er sagt.', 'Four hands, two wrenches, one problem: your reactor glows like a grill. Sit down. I will fix it. And never pay Ozzo up front, whatever he says.') },
  ] },
  { id: 'k5', title: T('Kapitel V · Am Ereignishorizont', 'Chapter V · At the Event Horizon'), unlock: 'visit:horizont', lines: [
    { who: 'architekt', text: T('Kleine Kurierin. Du hältst einen Stern in einem Käfig und nennst mich den Dieb?', 'Little courier. You hold a star in a cage and call me the thief?') },
    { who: 'ilya', text: T('Zum ersten Mal hat er mit mir gesprochen. Seine Stimme klang wie ein Raum, aus dem jemand die Luft gesaugt hat.', 'For the first time he spoke to me. His voice sounded like a room someone had drained of air.') },
    { who: 'herz', text: T('Er hat nicht ganz unrecht, Ilya. Wenn wir den Kern erreichen … musst du mich freilassen.', 'He is not entirely wrong, Ilya. When we reach the Core … you must set me free.') },
  ] },
  { id: 'k6', title: T('Kapitel VI · Das Herz der Galaxis', 'Chapter VI · The Heart of the Galaxy'), unlock: 'visit:kern', lines: [
    { who: 'kassik', text: T('Klick. Der Architekt hat mir das Doppelte geboten. Ich habe abgelehnt. Flieg, Kurierin. Ich halte dir den Rücken frei.', 'Click. The Architect offered me double. I declined. Fly, courier. I will cover your back.') },
    { who: 'sola', text: T('Selbst die Bank des Ewigen Orbits setzt diesmal auf dich, Schätzchen. Enttäusch die Quoten nicht.', 'Even the bank of the Eternal Orbit is betting on you this time, darling. Do not disappoint the odds.') },
  ] },
  { id: 'k7', title: T('Kapitel VII · Licht', 'Chapter VII · Light'), unlock: 'win', lines: [
    { who: 'ilya', text: T('Im Kern hingen sie: Tausende erloschene Sterne, aufgefädelt wie Perlen. Ich öffnete den Reaktor. Lumen zögerte – dann sprang das Licht von Stern zu Stern.', 'In the Core they hung: thousands of dead stars, strung like pearls. I opened the reactor. Lumen hesitated – then the light leapt from star to star.') },
    { who: 'herz', text: T('Danke, Ilya. Aber er ist nicht hier. Der Architekt wartet am Rand – dort, wo das Universum aufhört.', 'Thank you, Ilya. But he is not here. The Architect waits at the Edge – where the universe ends.') },
  ] },
  { id: 'epilog', title: T('Epilog · Der Rand', 'Epilogue · The Edge'), unlock: 'final', lines: [
    { who: 'architekt', text: T('Ohne mich verbrennt alles, Kurierin. Sterne sterben. Ich wollte sie nur … aufbewahren.', 'Without me everything burns out, courier. Stars die. I only wanted to … keep them.') },
    { who: 'ilya', text: T('Sterne sterben. Und aus ihrem Staub entstehen neue. Das ist kein Diebstahl – das ist ein Lied.', 'Stars die. And from their dust new ones are born. That is no theft – that is a song.') },
    { who: 'herz', text: T('Am Rand begann es zu schneien. Sternenstaub. Überall dort, wo er fiel, wurde es hell.', 'At the Edge it began to snow. Stardust. Wherever it fell, it grew bright.') },
  ] },
  { id: 'k-runs10', title: T('Zwischenspiel · Ozzos Angebot', 'Interlude · Ozzo’s Offer'), unlock: 'runs:10', lines: [
    { who: 'ozzo', text: T('Zehn Mal ausgezogen, zehn Mal zurückgekrochen. Hrrm. Ich mag Kunden, die nicht aufgeben. Ab jetzt gibt’s Stammkundenrabatt. Ein kleiner. Sehr klein.', 'Ten times out, ten times crawled back. Hrrm. I like customers who never give up. From now on: regulars’ discount. A small one. Very small.') },
  ] },
  { id: 'k-runs25', title: T('Zwischenspiel · Kassiks Geständnis', 'Interlude · Kassik’s Confession'), unlock: 'runs:25', lines: [
    { who: 'kassik', text: T('Mein Volk lebte auf einem Planeten, der um einen roten Stern kreiste. Eines Morgens ging er nicht mehr auf. Klick. Deshalb jage ich nicht für ihn.', 'My people lived on a world around a red star. One morning it did not rise. Click. That is why I do not hunt for him.') },
  ] },
];
