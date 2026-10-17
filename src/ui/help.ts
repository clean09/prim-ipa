// Einfache Erklärungen für die „?“-Knöpfe (aus Help.cs, an das Handy angepasst).
import { L } from '../core/i18n';
import { h, sheet } from './dom';

type Topic = () => [string, string[]];

const TOPICS: Record<string, Topic> = {
  star: () => [L('Sternenleben', 'Star life'), [
    L('Wähle eine Anfangsmasse und spule das Leben des Sterns vor: Gaswolke, Protostern, Hauptreihe, Riese, spätes Brennen – und das Ende als weißer Zwerg mit planetarischem Nebel, Supernova mit Neutronenstern oder Schwarzes Loch.',
      "Pick an initial mass and scrub through the star's life: gas cloud, protostar, main sequence, giant, late burning – and the end as a white dwarf with a planetary nebula, a supernova with a neutron star, or a black hole."),
    L('Innen steuert Außen: Radius, Temperatur, Farbe (Schwarzkörper), Granulation und Wind werden aus dem Zustand im Inneren berechnet – genau wie in der Windows-Version.',
      'The inside drives the outside: radius, temperature, colour (black body), granulation and wind are computed from the internal state – exactly as in the Windows version.'),
    L('Schnitt-Knopf: schneidet ein Viertel aus dem Stern und zeigt die Schalen (Zwiebelschalen-Modell). Brennende Schalen glühen.',
      'Cut button: removes a quarter of the star and shows its shells (onion-skin model). Burning shells glow.'),
    L('Größe: Die Darstellung ist logarithmisch, sonst wären Überriese und weißer Zwerg nicht gleichzeitig zu sehen. Der gestrichelte Kreis zeigt zum Vergleich die Sonne.',
      'Size: the view is logarithmic, otherwise a supergiant and a white dwarf could never be seen at the same time. The dashed circle shows the Sun for comparison.'),
    L('„Was wäre wenn“: Metallizität, Rotation und ein Begleitstern ändern den ganzen Lebensweg – ein naher Begleiter kann die Hülle abziehen.',
      '"What if": metallicity, rotation and a companion change the entire life path – a close companion can strip the envelope.'),
  ]],
  prime: () => [L('Primzahl-Benchmark', 'Prime benchmark'), [
    L('Primzahlen sind Zahlen, die nur durch 1 und sich selbst teilbar sind: 2, 3, 5, 7, 11, 13, …',
      'Primes are numbers divisible only by 1 and themselves: 2, 3, 5, 7, 11, 13, …'),
    L('Das „Sieb des Eratosthenes“ (über 2.000 Jahre alt) streicht alle Vielfachen von 2, 3, 5, … durch – übrig bleiben die Primzahlen. Hier siebt dein Handy mit allen Prozessorkernen gleichzeitig Milliarden Zahlen.',
      'The "Sieve of Eratosthenes" (over 2,000 years old) crosses out all multiples of 2, 3, 5, … – what remains are the primes. Your phone sieves billions of numbers using all CPU cores at once.'),
    L('Punkte: 1 Punkt = 1 Milliarde geprüfte Zahlen in 3 Minuten – dieselbe Wertung wie in PrimSieb für Windows. Zur Kontrolle muss die Anzahl der Primzahlen bis 100 Millionen, 1 Milliarde usw. exakt stimmen.',
      'Points: 1 point = 1 billion numbers checked in 3 minutes – the same scoring as PrimSieb for Windows. As a check, the number of primes up to 100 million, 1 billion etc. must be exactly right.'),
    L('Tipp: Handys drosseln bei Wärme. Für vergleichbare Werte das Handy abkühlen lassen, nicht laden und die App im Vordergrund lassen – wechselt die App in den Hintergrund, wird der Lauf nicht gewertet.',
      'Tip: phones throttle when hot. For comparable results let the phone cool down, unplug it and keep the app in the foreground – if the app goes to the background, the run is not counted.'),
  ]],
  check: () => [L('Zahl prüfen', 'Check a number'), [
    L('Gib eine beliebig große Zahl oder einen Ausdruck ein, z. B. 2^127-1, 10^18+3 oder (2^61-1)*(2^31-1).',
      'Enter any number or expression, e.g. 2^127-1, 10^18+3 or (2^61-1)*(2^31-1).'),
    L('Geprüft wird mit dem Miller-Rabin-Test. Bis etwa 3·10²⁴ ist das Ergebnis mathematisch sicher, darüber liegt die Irrtumswahrscheinlichkeit unter 4⁻¹⁶.',
      'The Miller-Rabin test is used. Up to about 3·10²⁴ the answer is mathematically certain; above that the error probability is below 4⁻¹⁶.'),
    L('Mersenne-Zahlen 2^p − 1: „M127“ eingeben – dann rechnet der Lucas-Lehmer-Test, mit dem auch die größten bekannten Primzahlen gefunden werden.',
      'Mersenne numbers 2^p − 1: enter "M127" – this runs the Lucas-Lehmer test, which is also used to find the largest known primes.'),
  ]],
  pi: () => [L('π – die Kreiszahl', 'π – pi'), [
    L('π ist das Verhältnis von Umfang zu Durchmesser eines Kreises: 3,14159… Die Nachkommastellen hören nie auf und wiederholen sich nie.',
      'π is the ratio of a circle\'s circumference to its diameter: 3.14159… The digits never end and never repeat.'),
    L('Viele Stellen sind ein Härtetest: Schon ein einziger Rechenfehler macht alle folgenden Stellen falsch. Gerechnet wird mit der Chudnovsky-Formel (jeder Summand bringt ~14 Stellen), geprüft gegen eine unabhängige Machin-Rechnung.',
      'Many digits are a stress test: a single error ruins every following digit. The Chudnovsky formula is used (~14 digits per term), checked against an independent Machin computation.'),
    L('Das Bild „π-Spaziergang“: Jede Ziffer gibt eine Richtung vor. Weil die Ziffern wie zufällig verteilt sind, entsteht ein Zufallsweg.',
      'The "π walk": every digit sets a direction. Because the digits look random, you get a random walk.'),
  ]],
  fib: () => [L('Fibonacci-Folge', 'Fibonacci sequence'), [
    L('0, 1, 1, 2, 3, 5, 8, 13, 21, … – jede Zahl ist die Summe der beiden vorigen. Jede ist etwa 1,618-mal so groß wie die vorige (der goldene Schnitt φ).',
      '0, 1, 1, 2, 3, 5, 8, 13, 21, … – each number is the sum of the two before. Each is about 1.618 times the previous (the golden ratio φ).'),
    L('F(10 Millionen) hat über 2 Millionen Stellen. Mit „Fast Doubling“ (aus F(k) direkt F(2k)) reichen dafür 24 Schritte.',
      'F(10 million) has over 2 million digits. With "fast doubling" (F(k) → F(2k) directly) that takes 24 steps.'),
    L('Fibonacci-Primzahlen: Manche Fibonacci-Zahlen sind Primzahlen (2, 3, 5, 13, 89, 233, …). Man kennt nur gut 50 davon.',
      'Fibonacci primes: some Fibonacci numbers are prime (2, 3, 5, 13, 89, 233, …). Only about 50 are known.'),
    L('Die Sonnenblume: Samen im goldenen Winkel von 137,5° bilden Spiralen, deren Anzahl Fibonacci-Zahlen sind.',
      'The sunflower: seeds at the golden angle of 137.5° form spirals whose counts are Fibonacci numbers.'),
  ]],
  nbody: () => [L('N-Körper-Simulation', 'N-body simulation'), [
    L('Jeder Stern zieht jeden anderen an – nach Newtons Gravitationsgesetz. Bei 16.384 Sternen sind das 268 Millionen Kräfte pro Zeitschritt.',
      'Every star attracts every other star – Newton\'s law of gravity. With 16,384 stars that is 268 million forces per time step.'),
    L('Die Grafikeinheit (GPU) des Handys rechnet das mit Hunderten Kernen gleichzeitig. Leistung in GFLOPS = Milliarden Rechenoperationen pro Sekunde.',
      'The phone\'s graphics unit (GPU) computes this with hundreds of cores at once. Performance in GFLOPS = billions of operations per second.'),
    L('Steuerung: mit einem Finger drehen, mit zwei Fingern zoomen.', 'Controls: drag with one finger to rotate, pinch to zoom.'),
  ]],
  collatz: () => [L('Collatz-Vermutung', 'Collatz conjecture'), [
    L('Nimm eine Zahl. Gerade → halbieren. Ungerade → mal 3 plus 1. Wiederholen. Beispiel 6: 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1.',
      'Take a number. Even → halve it. Odd → times 3 plus 1. Repeat. Example 6: 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1.'),
    L('Man landet anscheinend immer bei 1 – bewiesen ist das seit 1937 nicht. Dein Handy prüft Millionen Startwerte und sucht die mit den längsten Wegen. Kontrolle: bekannte Rekordhalter (837.799 unter 1 Million usw.).',
      'You always seem to end at 1 – unproven since 1937. Your phone checks millions of start values and looks for the longest paths. Check: known record holders (837,799 below one million, etc.).'),
  ]],
  bh: () => [L('Singularität – Schwarzes Loch', 'Singularity – black hole'), [
    L('Ein Schwarzes Loch ist so schwer, dass nicht einmal Licht entkommt. Der schwarze Schatten ist der Ereignishorizont.',
      'A black hole is so heavy that not even light escapes. The black shadow is the event horizon.'),
    L('Es krümmt den Raum: Licht läuft um das Loch herum. Deshalb sieht man die Rückseite der leuchtenden Scheibe über und unter dem Schatten – wie bei Gargantua in „Interstellar“. Jeder Bildpunkt ist ein Lichtstrahl, der Schritt für Schritt durch die gekrümmte Raumzeit verfolgt wird.',
      'It bends space: light travels around the hole. That is why you see the back of the glowing disk above and below the shadow – like Gargantua in "Interstellar". Every pixel is a light ray traced step by step through curved spacetime.'),
    L('Die Seite der Scheibe, die auf uns zukommt, ist heller und bläulicher (Doppler-Effekt). Rotiert das Loch (Kerr), rückt die Scheibe näher an den Horizont und der Schatten wird schief.',
      'The side of the disk moving towards us is brighter and bluer (Doppler effect). If the hole spins (Kerr), the disk moves closer to the horizon and the shadow becomes lopsided.'),
    L('Test: 60 Sekunden Kameraflug in fester Auflösung (960×540). Punkte = Ø gerechnete Bilder pro Sekunde × 100 – unabhängig von der Bildwiederholrate des Displays.',
      'Test: 60-second camera flight at a fixed resolution (960×540). Points = average frames rendered per second × 100 – independent of the display refresh rate.'),
    L('Erkunden: mit einem Finger umschauen, mit zwei Fingern zoomen, doppelt tippen = zurück.', 'Explore: drag to look around, pinch to zoom, double-tap to reset.'),
  ]],
  ai: () => [L('KI-Leistung', 'AI performance'), [
    L('KI-Programme rechnen fast nur eine Sache: riesige Zahlentabellen miteinander multiplizieren (Matrixmultiplikation).',
      'AI programs mostly do one thing: multiply huge tables of numbers (matrix multiplication).'),
    L('FP16 (halbe Genauigkeit) ist der KI-Standard – Handy-GPUs rechnen damit oft doppelt so schnell wie mit FP32. Der FP16-Wert ergibt den KI-Score. Zum Vergleich rechnet die CPU dieselbe Aufgabe mit allen Kernen.',
      'FP16 (half precision) is the AI standard – phone GPUs often run it twice as fast as FP32. The FP16 result is the AI score. For comparison the CPU solves the same task on all cores.'),
    L('Bildgenerierung: Ein kleines neuronales Netz berechnet für jedes Pixel eine Farbe – das erzeugt fließende, abstrakte Kunst. Jedes Motiv hat eigene Zufallsgewichte.',
      'Image generation: a small neural network computes a colour for every pixel – creating flowing abstract art. Every motif has its own random weights.'),
  ]],
  ram: () => [L('Neutronenstern – Arbeitsspeicher', 'Neutron star – memory'), [
    L('Materiestrom: Wie viele Gigabyte pro Sekunde der Speicher lesen, schreiben und kopieren kann – mit allen Kernen gleichzeitig.',
      'Matter stream: how many gigabytes per second the memory can read, write and copy – with all cores at once.'),
    L('Lichtlaufzeit: Wie lange ein einzelner Zugriff an eine zufällige Stelle dauert (Latenz, in Nanosekunden). Jeder Schritt hängt vom vorigen ab – Vorausladen ist unmöglich.',
      'Light travel time: how long a single access to a random location takes (latency, in nanoseconds). Each step depends on the previous one – prefetching is impossible.'),
    L('Dichte: Ein großer Speicherbereich wird mit Mustern gefüllt und geprüft. Jeder Fehler wäre ein Hinweis auf defekten Speicher. Hinweis: Apps dürfen auf Handys nur einen Teil des Speichers belegen.',
      'Density: a large block of memory is filled with patterns and verified. Any error would hint at faulty memory. Note: on phones apps may only use part of the memory.'),
  ]],
  board: () => [L('Bestenliste', 'Leaderboard'), [
    L('Alle gültigen Ergebnisse werden nur auf diesem Gerät gespeichert. Über „Teilen“ kannst du sie als Text weitergeben.',
      'All valid results are stored only on this device. Use "Share" to pass them on as text.'),
  ]],
};

export function showHelp(topic: string) {
  const t = TOPICS[topic];
  if (!t) return;
  const [title, paras] = t();
  sheet(title, paras.map(p => h('p', null, p)));
}
export const hasHelp = (topic: string) => topic in TOPICS;
