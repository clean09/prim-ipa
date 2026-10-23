// Geschichte II (v4.10): ausführlichere Kapitel. Zusatzzeilen für bestehende Kapitel und neue Kapitel für
// Bosse, Elite-Begegnungen, Aktwechsel, die erste Niederlage und die Hintergründe der Figuren.
import { Tx } from '../types';
import type { Chapter } from './story';

const T = (de: string, en: string): Tx => [de, en];
type Line = { who: string; text: Tx };

/** Weitere Zeilen, die an bestehende Kapitel angehängt werden. */
export const EXTRA_LINES: Record<string, Line[]> = {
  prolog: [
    { who: 'herz', text: T('Ich bin nicht dein Motor, Ilya. Ich bin ein Stern. Vergiss das nicht, wenn du an meinen Walzen drehst.', 'I am not your engine, Ilya. I am a star. Do not forget that when you turn my reels.') },
    { who: 'ilya', text: T('Also nannte ich ihn nie wieder „Reaktor“, wenn er zuhörte. Er hörte immer zu.', 'So I never called it “reactor” again when it was listening. It was always listening.') },
  ],
  k1: [
    { who: 'ilya', text: T('Zwischen den Felsbrocken hing ein Summen, tief wie eine Orgel. Je näher ich kam, desto mehr klang es wie ein Wiegenlied.', 'Between the boulders hung a hum, deep as an organ. The closer I came, the more it sounded like a lullaby.') },
    { who: 'ozzo', text: T('Und falls du stirbst: Ich kaufe Wracks. Gute Preise. Für mich.', 'And if you die: I buy wrecks. Good prices. For me.') },
  ],
  k1b: [
    { who: 'ilya', text: T('Lumen. Ein Name aus Licht. Er wiederholte ihn noch die ganze Nacht, als müsste er üben, jemand zu sein.', 'Lumen. A name made of light. It repeated it all night long, as if it had to practise being someone.') },
  ],
  k2: [
    { who: 'herz', text: T('Im Eis ist Licht eingeschlossen, Jahrtausende alt. Es schmeckt nach Sternen, die längst vergessen sind.', 'There is light trapped in the ice, thousands of years old. It tastes of stars long forgotten.') },
  ],
  k3: [
    { who: 'ilya', text: T('Vael fragte nicht, ob sie mitfliegen dürfe. Sie saß einfach eines Morgens auf meinem Navigationspult und putzte ihre Fühler.', 'Vael did not ask whether she could come along. One morning she simply sat on my navigation console, cleaning her antennae.') },
  ],
  k4: [
    { who: 'brakk', text: T('Früher hab ich Kriegsschiffe gebaut. Für ihn. Für den Architekten. Frag nicht weiter. Gib mir den Schraubenschlüssel.', 'I used to build warships. For him. For the Architect. Don’t ask more. Hand me the wrench.') },
  ],
  k5: [
    { who: 'vael', text: T('Hinter dem Horizont vergeht die Zeit anders. Wenn du zurückkommst, sind wir vielleicht alle alt. Oder du.', 'Beyond the horizon time passes differently. When you return we may all be old. Or you will.') },
  ],
  k6: [
    { who: 'herz', text: T('Ich höre sie jetzt alle, Ilya. Tausende Stimmen. Sie singen dasselbe Lied wie der Gürtel damals.', 'I hear them all now, Ilya. Thousands of voices. They sing the same song as the Belt did.') },
  ],
  epilog: [
    { who: 'architekt', text: T('… Und wenn sie wieder verlöschen?', '… And if they go out again?') },
    { who: 'ilya', text: T('Dann sind wir da. Mit einem Lied und einem Reaktor voller Glück.', 'Then we will be there. With a song and a reactor full of luck.') },
  ],
};

/** Neue Kapitel (unlock-Auslöser wie in story.ts, dazu elite:<sektor> und death). */
export const CHAPTERS_B: Chapter[] = [
  // ---------------------------------------------------------------------------------- Bosse ohne eigenes Kapitel
  { id: 'b-frost', title: T('Kapitel II · Das Herz aus Eis', 'Chapter II · The Heart of Ice'), unlock: 'boss:frost', lines: [
    { who: 'ilya', text: T('Als der Frostring brach, regnete es Licht. Jeder Splitter trug das Bild eines Sterns, der einmal hier gebrannt hatte.', 'When the Frost Ring broke, it rained light. Every shard carried the image of a star that once burned here.') },
    { who: 'kassik', text: T('Klick. Der Preis auf deinen Kopf ist gerade gestiegen. Glückwunsch, Kurierin. Du bist jetzt wichtig.', 'Click. The price on your head just went up. Congratulations, courier. You matter now.') },
  ] },
  { id: 'b-pulsar', title: T('Kapitel IV · Das letzte Leuchtfeuer', 'Chapter IV · The Last Beacon'), unlock: 'boss:pulsar', lines: [
    { who: 'brakk', text: T('Diese Leuchtfeuer haben einst Schiffe heimgeführt. Der Architekt hat sie umgebaut – sie locken jetzt Sterne in seine Netze.', 'These beacons once guided ships home. The Architect rebuilt them – now they lure stars into his nets.') },
    { who: 'herz', text: T('Ich habe das letzte Feuer gelöscht und ein neues entzündet. Es zeigt jetzt in die andere Richtung. Fort von ihm.', 'I put out the last fire and lit a new one. It now points the other way. Away from him.') },
  ] },
  { id: 'b-horizont', title: T('Kapitel V · Was die Zeit vergaß', 'Chapter V · What Time Forgot'), unlock: 'boss:horizont', lines: [
    { who: 'ilya', text: T('Am Horizont sah ich mich selbst – tausend Ilyas, jede einen Herzschlag später. Eine von ihnen hatte aufgegeben. Ich nicht.', 'At the horizon I saw myself – a thousand Ilyas, each a heartbeat later. One of them had given up. Not me.') },
    { who: 'vael', text: T('Du hast eine Sekunde Ewigkeit gestohlen, Kurierin. Gib gut auf sie acht.', 'You stole a second of eternity, courier. Take good care of it.') },
  ] },
  { id: 'b-kern', title: T('Kapitel VI · Die Mutter aller Sonnen', 'Chapter VI · Mother of All Suns'), unlock: 'boss:kern', lines: [
    { who: 'herz', text: T('Im Kern war ich nicht mehr klein. Für einen Augenblick war ich so hell wie alle anderen zusammen.', 'In the Core I was no longer small. For a moment I was as bright as all the others together.') },
    { who: 'sola', text: T('Die Bank zahlt aus, Schätzchen. Zum ersten Mal seit Jahrhunderten. Ich habe es mir eingerahmt.', 'The bank pays out, darling. For the first time in centuries. I had it framed.') },
  ] },
  // ---------------------------------------------------------------------------------- Aktwechsel
  { id: 'a3', title: T('Zwischenspiel · Die Hälfte des Weges', 'Interlude · Halfway There'), unlock: 'act:3', lines: [
    { who: 'ilya', text: T('Drei Sektoren noch bis zum Rand. Der Reaktor glühte ruhiger als am Anfang. Vielleicht weil wir uns kannten.', 'Three more sectors to the Edge. The reactor glowed calmer than at the start. Perhaps because we knew each other now.') },
    { who: 'herz', text: T('Darf ich dir etwas gestehen? Ich habe Angst vor dem Rand. Dort ist nichts, was leuchtet.', 'May I confess something? I am afraid of the Edge. There is nothing there that shines.') },
    { who: 'ilya', text: T('Dann bringen wir eben etwas mit.', 'Then we will bring something.') },
  ] },
  { id: 'a5', title: T('Zwischenspiel · Briefe ans Licht', 'Interlude · Letters to the Light'), unlock: 'act:5', lines: [
    { who: 'ilya', text: T('Ich schrieb meiner Schwester einen Brief, den ich nie abschicken würde. „Falls du siehst, dass die Sterne wiederkommen – das war ich. Ein bisschen.“', 'I wrote my sister a letter I would never send. “If you see the stars coming back – that was me. A little.”') },
    { who: 'herz', text: T('Schick ihn ab, wenn wir zurück sind. Ich trage ihn hin. Persönlich.', 'Send it when we are back. I will deliver it. In person.') },
  ] },
  // ---------------------------------------------------------------------------------- Erste Elite je Sektor
  { id: 'e-guertel', title: T('Notiz · Ein singender Wurm', 'Note · A Singing Worm'), unlock: 'elite:guertel', lines: [
    { who: 'ilya', text: T('Selbst die Würmer im Gürtel summen. Brakk meint, sie fressen den Klang der Felsen. Ich glaube, sie vermissen ihn.', 'Even the worms in the Belt hum. Brakk thinks they eat the sound of the rocks. I think they miss it.') },
  ] },
  { id: 'e-frost', title: T('Notiz · Die Seherin im Eis', 'Note · The Seer in the Ice'), unlock: 'elite:frost', lines: [
    { who: 'vael', text: T('Die Eisseherin war eine von uns, bevor die Kälte kam. Sie sah die Zukunft – und erstarrte, damit sie sie nicht erleben musste.', 'The Ice Seer was one of us before the cold came. She saw the future – and froze so she would not have to live it.') },
  ] },
  { id: 'e-werft', title: T('Notiz · Kapitänin Ossa', 'Note · Captain Ossa'), unlock: 'elite:werft', lines: [
    { who: 'kassik', text: T('Ossa war die beste Kurierin ihrer Zeit. Sie fuhr für den Architekten. Klick. Sieh dir an, was davon übrig ist.', 'Ossa was the best courier of her time. She flew for the Architect. Click. Look what is left of her.') },
  ] },
  { id: 'e-riff', title: T('Notiz · Ankh-Tu', 'Note · Ankh-Tu'), unlock: 'elite:riff', lines: [
    { who: 'herz', text: T('Der Wächter hat mich gefragt, warum ich in einem Käfig lebe. Ich wusste keine Antwort, die nicht nach Ausrede klang.', 'The warden asked me why I live in a cage. I had no answer that did not sound like an excuse.') },
  ] },
  { id: 'e-orion', title: T('Notiz · Hal’Mekks Gebet', 'Note · Hal’Mekk’s Prayer'), unlock: 'elite:orion', lines: [
    { who: 'vael', text: T('Der Prior betete zum Architekten wie zu einem Gott. Götter, Kurierin, sind nur Leute, denen niemand widerspricht.', 'The Prior prayed to the Architect as to a god. Gods, courier, are only people nobody contradicts.') },
  ] },
  { id: 'e-pulsar', title: T('Notiz · Zwei Herzen', 'Note · Two Hearts'), unlock: 'elite:pulsar', lines: [
    { who: 'ilya', text: T('Die Zwillingspulsare starben nacheinander, und der zweite wurde wütend. Ich verstehe das besser, als mir lieb ist.', 'The twin pulsars died one after the other, and the second grew furious. I understand that better than I would like.') },
  ] },
  { id: 'e-tiefsee', title: T('Notiz · Die Königswache', 'Note · The Royal Guard'), unlock: 'elite:tiefsee', lines: [
    { who: 'vael', text: T('Die Wachen von Thal’Ora warten noch immer auf eine Königin, die vor Äonen gegangen ist. Treue kann schrecklich sein.', 'The guards of Thal’Ora still wait for a queen who left aeons ago. Loyalty can be terrible.') },
  ] },
  { id: 'e-sturm', title: T('Notiz · Rhaz', 'Note · Rhaz'), unlock: 'elite:sturm', lines: [
    { who: 'brakk', text: T('Rhaz hat bei mir das Schmieden gelernt. Damals hatte er noch zwei Hände weniger und viel mehr Verstand.', 'Rhaz learned smithing from me. Back then he had two hands fewer and a lot more sense.') },
  ] },
  { id: 'e-horizont', title: T('Notiz · Der Zeitwächter', 'Note · The Time Warden'), unlock: 'elite:horizont', lines: [
    { who: 'herz', text: T('Er hat jede Sekunde gezählt, seit das Universum begann. Ich habe ihm eine geschenkt. Er wusste nicht, was er damit tun sollte.', 'He has counted every second since the universe began. I gave him one. He did not know what to do with it.') },
  ] },
  { id: 'e-kern', title: T('Notiz · Vorn der Schmied', 'Note · Vorn the Smith'), unlock: 'elite:kern', lines: [
    { who: 'brakk', text: T('Vorn hat die Käfige geschmiedet, in denen die Sterne hängen. Auch deinen, Kurierin. Er war mein Bruder.', 'Vorn forged the cages the stars hang in. Yours too, courier. He was my brother.') },
  ] },
  // ---------------------------------------------------------------------------------- Niederlage & Hintergründe
  { id: 'death', title: T('Zwischenspiel · Asche', 'Interlude · Ashes'), unlock: 'death', lines: [
    { who: 'herz', text: T('Wir sind gefallen, Ilya. Aber Sterne fallen oft. Und manchmal wird aus einem gefallenen Stern ein neuer Anfang.', 'We fell, Ilya. But stars fall often. And sometimes a fallen star becomes a new beginning.') },
    { who: 'ilya', text: T('Brakk flickte das Schiff, Ozzo stellte die Rechnung, Vael sagte nichts. Und Lumen glomm, leiser als zuvor – aber er glomm.', 'Brakk patched the ship, Ozzo sent the bill, Vael said nothing. And Lumen glowed, quieter than before – but it glowed.') },
  ] },
  { id: 'r3', title: T('Zwischenspiel · Vaels Orden', 'Interlude · Vael’s Order'), unlock: 'runs:3', lines: [
    { who: 'vael', text: T('Wir Motten waren einst Hüter. Wir trugen Licht von Welt zu Welt, damit keine im Dunkeln blieb. Dann kam einer, der es behalten wollte.', 'We moths were once keepers. We carried light from world to world so that none would stay in the dark. Then came one who wanted to keep it.') },
    { who: 'vael', text: T('Der Architekt hieß damals Ysra. Er war mein Lehrer.', 'Back then the Architect was called Ysra. He was my teacher.') },
  ] },
  { id: 'r5', title: T('Zwischenspiel · Brakks vier Hände', 'Interlude · Brakk’s Four Hands'), unlock: 'runs:5', lines: [
    { who: 'brakk', text: T('Zwei Hände bekam ich bei der Geburt. Zwei hat mir der Architekt gegeben, damit ich schneller Käfige baue.', 'Two hands I got at birth. Two the Architect gave me, so I could build cages faster.') },
    { who: 'brakk', text: T('Mit denen repariere ich jetzt dein Schiff. Das ist meine Art, sie zurückzugeben.', 'With those I now repair your ship. That is my way of giving them back.') },
  ] },
  { id: 'r15', title: T('Zwischenspiel · Solas Wette', 'Interlude · Sola’s Wager'), unlock: 'runs:15', lines: [
    { who: 'sola', text: T('Weißt du, warum das Haus fast immer gewinnt, Schätzchen? Weil die Leute aufhören, bevor sie Glück haben.', 'Do you know why the house almost always wins, darling? Because people stop before they get lucky.') },
    { who: 'sola', text: T('Du hörst nie auf. Das macht mich nervös. Und ein bisschen stolz.', 'You never stop. That makes me nervous. And a little proud.') },
  ] },
  { id: 'r40', title: T('Zwischenspiel · Ozzos Geheimnis', 'Interlude · Ozzo’s Secret'), unlock: 'runs:40', lines: [
    { who: 'ozzo', text: T('Hrrm. Du willst wissen, warum ich dir immer Rabatt gebe, obwohl ich so tue, als ob nicht?', 'Hrrm. You want to know why I always give you a discount even though I pretend not to?') },
    { who: 'ozzo', text: T('Mein Heimatstern war der erste, der verlosch. Ich war zu langsam, um ihn zu retten. Du bist schneller. Kauf was.', 'My home star was the first to go out. I was too slow to save it. You are faster. Buy something.') },
  ] },
  { id: 'arch2', title: T('Epilog II · Ysra', 'Epilogue II · Ysra'), unlock: 'final', lines: [
    { who: 'vael', text: T('Er hat keinen Körper mehr, Ilya. Nur noch einen Namen, den keiner mehr sagt. Ysra.', 'He has no body any more, Ilya. Only a name nobody says. Ysra.') },
    { who: 'architekt', text: T('… Ysra. So hat mich lange niemand genannt. Ich hatte vergessen, dass ich einmal jemand war.', '… Ysra. Nobody has called me that in a long time. I had forgotten that I was once someone.') },
    { who: 'herz', text: T('Dann fang heute wieder an. Ich zeige dir, wie man leuchtet, ohne festzuhalten.', 'Then start again today. I will show you how to shine without holding on.') },
  ] },
];
