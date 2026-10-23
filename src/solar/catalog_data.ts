// ERZEUGT aus PrimSieb/Solar/SolarBodies.cs (scratchpad solar_port.py) – Daten nicht hier, sondern am Desktop pflegen.
import { Orbit, add, orbitKind, stream, Surf } from './catalog';

export function buildCatalog() {
// ============================================================================ Sonne
        add("Sonne", 'Star', null, 695_700, 1.989e30, 1, Surf.Sun, 0xFFFFFF, 0xFFE0B0, null, "Stern (Gelber Zwerg, G2 V)",
            "Die Sonne enthält 99,86 % der Masse des Sonnensystems. In ihrem Kern verschmilzt sie jede Sekunde rund 600 Millionen Tonnen Wasserstoff zu Helium – 4 Millionen Tonnen davon werden zu Licht. " +
            "Ein Photon braucht aus dem Kern bis zur Oberfläche je nach Rechnung 10 000 bis 170 000 Jahre, von dort bis zur Erde nur 8 Minuten 20 Sekunden.",
            "Durchmesser|1 391 400 km (109 Erden)", "Masse|1,989·10³⁰ kg (333 000 Erden)", "Oberfläche|5 772 K", "Kern|15,7 Mio. K", "Leuchtkraft|3,83·10²⁶ W",
            "Rotation|25,4 Tage (Äquator) bis 35 Tage (Pole)", "Alter|4,6 Mrd. Jahre", "Restlaufzeit|≈ 5 Mrd. Jahre bis zum Roten Riesen")
            .Pole(286.13, 63.87, 84.176, 14.1844);

        // ============================================================================ Planeten
        add("Merkur", 'Planet', "Sonne", 2439.7, 3.301e23, 0.142, Surf.Rock, 0x9A928A, 0x6E6862,
            Orbit.Jpl(0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081),
            "Gesteinsplanet", "Der kleinste und sonnennächste Planet. Merkur dreht sich in 3:2-Resonanz: drei Drehungen auf zwei Umläufe – ein Sonnentag dauert dort 176 Erdtage. " +
            "Ohne Atmosphäre schwankt die Temperatur zwischen 430 °C am Tag und −180 °C in der Nacht. Sein Eisenkern füllt etwa 85 % seines Radius.",
            "Durchmesser|4 879 km", "Masse|0,055 Erden", "Sonnenabstand|0,31–0,47 AE", "Umlauf|88 Tage", "Rotation|58,6 Tage", "Sonnentag|176 Tage", "Temperatur|−180 bis +430 °C", "Monde|keine")
            .Pole(281.0103, 61.4155, 329.5988, 6.1385108).V(2);
        add("Venus", 'Planet', "Sonne", 6051.8, 4.867e24, 0.689, Surf.Venus, 0xF2E2B8, 0xD9C08A,
            Orbit.Jpl(0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418),
            "Gesteinsplanet", "Fast so groß wie die Erde, aber eine Hölle: 92 bar Kohlendioxid erzeugen einen Treibhauseffekt mit 465 °C – heißer als auf Merkur. " +
            "Wolken aus Schwefelsäure verhüllen die Oberfläche vollständig und rasen in 4 Tagen um den Planeten (Superrotation), während Venus selbst sich in 243 Tagen rückwärts dreht.",
            "Durchmesser|12 104 km", "Masse|0,815 Erden", "Sonnenabstand|0,72 AE", "Umlauf|224,7 Tage", "Rotation|243 Tage, rückläufig", "Temperatur|465 °C", "Luftdruck|92 bar (CO₂)", "Monde|keine")
            .Pole(272.76, 67.16, 160.20, -1.4813688).Atmo(90, 0xF0D8A0, 1.4);
        add("Erde", 'Planet', "Sonne", 6371.0, 5.972e24, 0.434, Surf.Earth, 0x1E4D8C, 0x4A6B2F,
            Orbit.Jpl(1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0),
            "Gesteinsplanet", "Der einzige bekannte Ort mit Leben. Flüssiges Wasser bedeckt 71 % der Oberfläche; das Magnetfeld und die Atmosphäre schützen vor Sonnenwind und Strahlung. " +
            "Der große Mond stabilisiert die Achsneigung von 23,4° – deshalb gibt es verlässliche Jahreszeiten.",
            "Durchmesser|12 742 km", "Masse|5,972·10²⁴ kg", "Sonnenabstand|0,983–1,017 AE", "Umlauf|365,256 Tage", "Rotation|23 h 56 min 4 s", "Achsneigung|23,44°", "Temperatur|Ø 15 °C", "Monde|1")
            .Pole(0.0, 90.0, 190.147, 360.9856235).Oblate(0.003353).Atmo(60, 0x5A8CFF, 0.4);
        add("Mars", 'Planet', "Sonne", 3389.5, 6.417e23, 0.17, Surf.Mars, 0xC1693A, 0x6E3A22,
            Orbit.Jpl(1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343),
            "Gesteinsplanet", "Der Rote Planet verdankt seine Farbe Eisenoxid – Rost – im Staub. Hier steht Olympus Mons, mit 22 km der höchste Vulkan des Sonnensystems, und das Grabensystem Valles Marineris, so lang wie die USA breit. " +
            "Früher floss Wasser auf dem Mars; heute ist es in den Polkappen und im Boden gefroren.",
            "Durchmesser|6 779 km", "Masse|0,107 Erden", "Sonnenabstand|1,38–1,67 AE", "Umlauf|687 Tage", "Rotation|24 h 37 min", "Achsneigung|25,2°", "Temperatur|−153 bis +20 °C", "Monde|2 (Phobos, Deimos)")
            .Pole(317.68143, 52.88650, 176.630, 350.89198226).Oblate(0.00589).Atmo(40, 0xD8A890, 0.18);
        add("Jupiter", 'Planet', "Sonne", 71492, 1.898e27, 0.538, Surf.Gas, 0xE8DCC6, 0xA4846A,
            Orbit.Jpl(5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106),
            "Gasriese", "Jupiter ist schwerer als alle anderen Planeten zusammen. Sein Großer Roter Fleck ist ein Sturm, größer als die Erde, der seit mindestens 190 Jahren tobt. " +
            "Mit 10 Stunden dreht er sich am schnellsten von allen Planeten und ist dadurch sichtbar abgeplattet. Sein Magnetfeld ist das größte Gebilde im Sonnensystem.",
            "Durchmesser|142 984 km (Äquator)", "Masse|318 Erden", "Sonnenabstand|4,95–5,46 AE", "Umlauf|11,86 Jahre", "Rotation|9 h 56 min", "Temperatur|−110 °C (Wolken)", "Monde|95 bekannt")
            .Pole(268.056595, 64.495303, 284.95, 870.5360000).Oblate(0.06487).Rings(122_500, 129_000, 4).V(1).Atmo(400, 0xA8C0FF, 0.15);
        add("Saturn", 'Planet', "Sonne", 60268, 5.683e26, 0.499, Surf.Gas, 0xEAD6A6, 0xBFA272,
            Orbit.Jpl(9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794),
            "Gasriese", "Saturns Ringe sind 280 000 km breit, aber meist nur 10 bis 100 Meter dick – sie bestehen aus Milliarden Eisbrocken von Staubkorn- bis Hausgröße. " +
            "Der Planet hat die geringste Dichte von allen: Er würde in einer riesigen Badewanne schwimmen. Am Nordpol dreht sich ein sechseckiger Wirbelsturm.",
            "Durchmesser|120 536 km (Äquator)", "Masse|95 Erden", "Sonnenabstand|9,0–10,1 AE", "Umlauf|29,4 Jahre", "Rotation|10 h 33 min", "Achsneigung|26,7°", "Dichte|0,69 g/cm³", "Monde|146 bekannt")
            .Pole(40.589, 83.537, 38.90, 810.7939024).Oblate(0.09796).Rings(66_900, 140_220, 1).V(2).Atmo(400, 0xD8D0B0, 0.12);
        add("Uranus", 'Planet', "Sonne", 25559, 8.681e25, 0.488, Surf.IceGiant, 0xA6DCE6, 0x8CC8D8,
            Orbit.Jpl(19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589),
            "Eisriese", "Uranus liegt auf der Seite: Seine Achse ist um 98° geneigt, vermutlich nach einem gewaltigen Zusammenstoß. So hat jeder Pol 42 Jahre Tag und 42 Jahre Nacht. " +
            "Methan in der Atmosphäre schluckt rotes Licht und färbt ihn blassblau-grün. Er hat 13 dunkle, schmale Ringe.",
            "Durchmesser|51 118 km", "Masse|14,5 Erden", "Sonnenabstand|18,3–20,1 AE", "Umlauf|84 Jahre", "Rotation|17 h 14 min, rückläufig", "Achsneigung|97,8°", "Temperatur|−224 °C", "Monde|28 bekannt")
            .Pole(257.311, -15.175, 203.81, -501.1600928).Oblate(0.02293).Rings(41_840, 51_150, 2).V(1).Atmo(500, 0x9FE0F0, 0.25);
        add("Neptun", 'Planet', "Sonne", 24764, 1.024e26, 0.442, Surf.IceGiant, 0x4C7CE6, 0x3456B8,
            Orbit.Jpl(30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664),
            "Eisriese", "Neptun wurde 1846 nicht durch Beobachtung, sondern durch Rechnung entdeckt – aus Störungen der Uranusbahn. Hier wehen die schnellsten Winde des Sonnensystems mit über 2 000 km/h. " +
            "Er strahlt 2,6-mal mehr Energie ab, als er von der Sonne erhält. Ein Umlauf dauert 165 Jahre – erst 2011 hat er seit seiner Entdeckung einmal die Sonne umrundet.",
            "Durchmesser|49 528 km", "Masse|17,1 Erden", "Sonnenabstand|29,8–30,3 AE", "Umlauf|164,8 Jahre", "Rotation|16 h 6 min", "Achsneigung|28,3°", "Temperatur|−214 °C", "Monde|16 bekannt")
            .Pole(299.36, 43.46, 249.978, 541.1397757).Oblate(0.0171).Rings(41_900, 62_940, 3).V(2).Atmo(500, 0x6A90FF, 0.25);

        // ============================================================================ Zwergplaneten
        add("Pluto", 'Dwarf', "Sonne", 1188.3, 1.303e22, 0.52, Surf.Pluto, 0xD8C0A0, 0x5A3020,
            Orbit.Jpl(39.48211675, -0.00031596, 0.24882730, 0.00005170, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482),
            "Zwergplanet (Kuipergürtel)", "Bis 2006 der neunte Planet. 2015 flog New Horizons vorbei und zeigte eine überraschend lebendige Welt: eine herzförmige Ebene aus Stickstoffeis (Tombaugh Regio), " +
            "Berge aus Wassereis und eine dünne, blaue Dunsthülle. Pluto und Charon zeigen sich gegenseitig immer dieselbe Seite.",
            "Durchmesser|2 377 km", "Masse|0,0022 Erden", "Sonnenabstand|29,7–49,3 AE", "Umlauf|248 Jahre", "Rotation|6,39 Tage, rückläufig", "Temperatur|−230 °C", "Monde|5 (Charon, Nix, Hydra, Kerberos, Styx)")
            .Pole(132.993, -6.163, 302.695, -56.3625225).Atmo(120, 0x8FB8FF, 0.05);
        add("Ceres", 'Dwarf', "Sonne", 482, 9.38e20, 0.09, Surf.Rock, 0x6E6A66, 0x55524F,
            Orbit.HelioAt(2.7675, 0.0797, 10.59, 80.25, 73.30, 0, 2461599.841),
            "Zwergplanet (Asteroidengürtel)", "Das größte Objekt im Asteroidengürtel – ein Drittel seiner Gesamtmasse. Die Raumsonde Dawn fand im Krater Occator helle Flecken aus Salzen (Natriumcarbonat), " +
            "Reste von salzigem Wasser aus dem Inneren. Unter der Kruste könnte es noch heute Sole geben.",
            "Durchmesser|≈ 940 km", "Sonnenabstand|2,55–2,98 AE", "Umlauf|4,6 Jahre", "Rotation|9 h 4 min", "Temperatur|−105 °C", "Entdeckt|1801 (Piazzi)")
            .Pole(291.418, 66.764, 170.650, 952.1532).Shape(482, 482, 446).V(3);
        add("Eris", 'Dwarf', "Sonne", 1163, 1.66e22, 0.96, Surf.Icy, 0xEDEBE8, 0xD8D4D0,
            Orbit.HelioAt(67.9, 0.438, 43.9, 36.0, 151.0, 0, 2545407.717),
            "Zwergplanet (gestreute Scheibe)", "Fast genauso groß wie Pluto, aber 27 % schwerer – ihre Entdeckung 2005 führte zur neuen Planetendefinition. Eris ist eines der hellsten Objekte des Sonnensystems: " +
            "Ihr Methaneis reflektiert 96 % des Lichts. Zurzeit ist sie fast dreimal so weit entfernt wie Pluto.",
            "Durchmesser|2 326 km", "Sonnenabstand|38–98 AE", "Umlauf|559 Jahre", "Rotation|≈ 15,8 Tage", "Temperatur|−243 °C", "Monde|1 (Dysnomia)");
        add("Haumea", 'Dwarf', "Sonne", 1050, 4.0e21, 0.66, Surf.Icy, 0xE4E4E8, 0xB8B8C0,
            Orbit.Helio(43.18, 0.195, 28.21, 121.9, 239.0, 218.2, 2459000.5),
            "Zwergplanet (Kuipergürtel)", "Haumea dreht sich in nur 3,9 Stunden einmal um sich selbst – so schnell, dass sie zu einem Ellipsoid gestreckt ist, fast doppelt so lang wie dick. " +
            "2017 wurde bei einer Sternbedeckung ein Ring um sie entdeckt.",
            "Größe|≈ 2 100 × 1 680 × 1 074 km", "Sonnenabstand|34,6–51,6 AE", "Umlauf|284 Jahre", "Rotation|3,9 h", "Monde|2 (Hiʻiaka, Namaka)")
            .Shape(1050, 840, 537).Rings(2287, 2357, 5).Rough();
        add("Makemake", 'Dwarf', "Sonne", 715, 3.1e21, 0.82, Surf.Pluto, 0xD9B89C, 0xA87A5A,
            Orbit.HelioAt(45.6, 0.159, 29.0, 79.3, 297.0, 0, 2408158.694),
            "Zwergplanet (Kuipergürtel)", "Ein rötlicher, heller Eiszwerg, benannt nach dem Schöpfergott der Rapa Nui. Seine Oberfläche ist mit Methan- und Ethaneis bedeckt.",
            "Durchmesser|≈ 1 430 km", "Sonnenabstand|38,5–52,8 AE", "Umlauf|306 Jahre", "Rotation|22,8 h", "Monde|1 (MK2)").V(1);
        add("Sedna", 'Dwarf', "Sonne", 500, 1e21, 0.32, Surf.Pluto, 0xC0603A, 0x8A3A22,
            Orbit.HelioAt(544, 0.86, 11.93, 144.5, 311.3, 0, 2479264.751),
            "Transneptun (innere Oortsche Wolke?)", "Eines der rötesten Objekte im Sonnensystem auf einer extrem gestreckten Bahn: Im Perihel (um 2076) ist Sedna 76 AE entfernt, im Aphel fast 1 000 AE. " +
            "Ein Umlauf dauert über 11 000 Jahre. Wie Sedna auf diese Bahn kam, ist ungeklärt – vielleicht durch einen vorbeiziehenden Stern.",
            "Durchmesser|≈ 1 000 km", "Sonnenabstand|76–940 AE", "Umlauf|≈ 11 400 Jahre", "Perihel|2076").V(2);

        // ============================================================================ Monde
        // Erde
        add("Mond", 'Moon', "Erde", 1737.4, 7.342e22, 0.12, Surf.Rock, 0x99948C, 0x4A4744, orbitKind('Moon'), "Mond der Erde",
            "Der Mond entstand vermutlich, als vor 4,5 Mrd. Jahren ein marsgroßer Körper (Theia) mit der jungen Erde zusammenstieß. Die dunklen „Meere“ sind erstarrte Lava. " +
            "Er entfernt sich jedes Jahr um 3,8 cm von der Erde. Zwölf Menschen sind zwischen 1969 und 1972 auf ihm gelaufen.",
            "Durchmesser|3 474 km", "Masse|0,0123 Erden", "Erdabstand|356 500–406 700 km", "Umlauf|27,32 Tage", "Mondphasen|29,53 Tage", "Temperatur|−173 bis +127 °C")
            .Lock().V(1);
        // Mars
        add("Phobos", 'Moon', "Mars", 13.5, 1.06e16, 0.071, Surf.Irregular, 0x6A625A, 0x4E4842, Orbit.SatJ(9375, 0.015, 216.3, 189.7, 1.1, 169.2, 0.31891023, 317.7, 52.9), "Mond des Mars",
            "Phobos kreist so dicht über dem Mars, dass er schneller umläuft, als Mars sich dreht – er geht im Westen auf. Gezeitenkräfte ziehen ihn langsam herab: " +
            "In etwa 50 Millionen Jahren wird er zerbrechen oder einschlagen. Der Krater Stickney ist fast halb so groß wie der Mond selbst.",
            "Größe|27 × 22 × 18 km", "Marsabstand|9 376 km", "Umlauf|7 h 39 min").Shape(13.5, 11, 9).Lock();
        add("Deimos", 'Moon', "Mars", 7.5, 1.5e15, 0.068, Surf.Irregular, 0x766C62, 0x5A524A, Orbit.SatJ(23457, 0.0002, 0.0, 205.0, 1.8, 54.3, 1.26244, 316.6, 53.5), "Mond des Mars",
            "Der kleinere Marsmond ist mit Staub (Regolith) bedeckt, der seine Krater glättet. Vom Mars aus sähe er nur wie ein heller Stern aus.",
            "Größe|15 × 12 × 11 km", "Marsabstand|23 463 km", "Umlauf|30,3 h").Shape(7.5, 6.1, 5.5).Lock();
        // Jupiter – Galileische Monde mit mittleren Längen nach Meeus
        add("Io", 'Moon', "Jupiter", 1821.6, 8.93e22, 0.63, Surf.Io, 0xEED86A, 0xB0582A,
            Orbit.SatJ(421800, 0.004, 49.1, 330.9, 0.0, 0.0, 1.769138, 268.1, 64.5), "Mond des Jupiter (Galileisch)",
            "Der vulkanisch aktivste Körper des Sonnensystems: Über 400 aktive Vulkane schleudern Schwefel bis 500 km hoch. Die Energie stammt aus Gezeitenreibung – " +
            "Jupiter, Europa und Ganymed kneten Io ständig durch, die Oberfläche hebt und senkt sich um bis zu 100 m.",
            "Durchmesser|3 643 km", "Jupiterabstand|421 700 km", "Umlauf|1,77 Tage", "Vulkane|> 400 aktiv").Lock();
        add("Europa", 'Moon', "Jupiter", 1560.8, 4.80e22, 0.67, Surf.Europa, 0xE8DCC8, 0x8A5A3A,
            Orbit.SatJ(671100, 0.009, 45.0, 345.4, 0.5, 184.0, 3.551181, 268.1, 64.5), "Mond des Jupiter (Galileisch)",
            "Unter Europas 15–25 km dicker Eiskruste liegt ein globaler Ozean mit mehr Wasser als alle Meere der Erde. Die rotbraunen Risse (Lineae) entstehen, wenn Gezeiten das Eis brechen. " +
            "Europa gilt als einer der aussichtsreichsten Orte für außerirdisches Leben; die Sonde Europa Clipper ist unterwegs.",
            "Durchmesser|3 122 km", "Jupiterabstand|671 000 km", "Umlauf|3,55 Tage", "Ozean|≈ 100 km tief").Lock();
        add("Ganymed", 'Moon', "Jupiter", 2634.1, 1.48e23, 0.43, Surf.Rock, 0x9A9086, 0x5E554C,
            Orbit.SatJ(1070400, 0.001, 198.3, 324.8, 0.2, 58.5, 7.154553, 268.2, 64.6), "Mond des Jupiter (Galileisch)",
            "Der größte Mond des Sonnensystems – größer als der Planet Merkur. Als einziger Mond hat Ganymed ein eigenes Magnetfeld; es erzeugt Polarlichter. " +
            "Dunkle, alte Regionen wechseln mit hellem, gefurchtem Eis ab.",
            "Durchmesser|5 268 km", "Jupiterabstand|1,07 Mio. km", "Umlauf|7,15 Tage").Lock().V(5);
        add("Kallisto", 'Moon', "Jupiter", 2410.3, 1.076e23, 0.22, Surf.Rock, 0x6C6258, 0xA49A90,
            Orbit.SatJ(1882700, 0.007, 43.8, 87.4, 0.3, 309.1, 16.689018, 268.7, 64.8), "Mond des Jupiter (Galileisch)",
            "Die am dichtesten mit Kratern übersäte Oberfläche des Sonnensystems – seit 4 Mrd. Jahren fast unverändert. Der Einschlag Valhalla hinterließ Ringe von 3 800 km Durchmesser.",
            "Durchmesser|4 821 km", "Jupiterabstand|1,88 Mio. km", "Umlauf|16,7 Tage").Lock().V(4);
        add("Amalthea", 'Moon', "Jupiter", 125, 2.08e18, 0.09, Surf.Irregular, 0x9C4A32, 0x6E3424, Orbit.SatJ(181400, 0.003, 180.1, 310.6, 0.4, 282.9, 0.498179, 268.1, 64.5), "Mond des Jupiter",
            "Einer der rötesten Körper des Sonnensystems, ein länglicher Brocken innerhalb der Bahn von Io. Sein Staub speist Jupiters feinen Gossamer-Ring.",
            "Größe|250 × 146 × 128 km", "Umlauf|11,9 h").Shape(125, 73, 64).Lock();
        add("Himalia", 'Moon', "Jupiter", 85, 4.2e18, 0.04, Surf.Irregular, 0x5A5650, 0x403C38, Orbit.SatJ(11439000, 0.160, 321.1, 78.3, 28.4, 64.2, 250.56, NaN, 0), "Mond des Jupiter (irregulär)",
            "Der größte der äußeren, unregelmäßigen Jupitermonde – wahrscheinlich ein eingefangener Asteroid.", "Durchmesser|≈ 140 km", "Umlauf|250 Tage").Shape(85, 75, 70);
        // Saturn
        add("Mimas", 'Moon', "Saturn", 198.2, 3.75e19, 0.96, Surf.Icy, 0xD8D8D8, 0xA0A0A0, Orbit.SatJ(186000, 0.020, 160.4, 275.3, 1.6, 66.2, 0.942422, 40.6, 83.5), "Mond des Saturn",
            "Der „Todesstern“-Mond: Der Krater Herschel ist ein Drittel so groß wie Mimas selbst. Mimas räumt mit seiner Schwerkraft die Cassini-Teilung in Saturns Ringen frei.",
            "Durchmesser|396 km", "Umlauf|22,6 h").Lock().V(2);
        add("Enceladus", 'Moon', "Saturn", 252.1, 1.08e20, 1.375, Surf.Enceladus, 0xFAFCFF, 0xC8E0FF, Orbit.SatJ(238400, 0.005, 119.5, 57.0, 0.0, 0.0, 1.370218, 40.6, 83.5), "Mond des Saturn",
            "Der hellste Körper des Sonnensystems. Aus den „Tigerstreifen“ am Südpol schießen Fontänen aus Wasserdampf und Eis ins All – Nachschub für Saturns E-Ring. " +
            "Cassini flog durch die Fontänen und fand Salz, Silikate und organische Moleküle aus einem unterirdischen Ozean.",
            "Durchmesser|504 km", "Umlauf|1,37 Tage", "Albedo|1,38 (geometrisch)").Lock();
        add("Tethys", 'Moon', "Saturn", 531.1, 6.17e20, 0.80, Surf.Icy, 0xE0E0E0, 0xB4B4B4, Orbit.SatJ(295000, 0.001, 335.3, 0.0, 1.1, 273.0, 1.887802, 40.6, 83.5), "Mond des Saturn",
            "Fast reines Wassereis. Der Einschlagkrater Odysseus und der 2 000 km lange Graben Ithaca Chasma prägen ihn.", "Durchmesser|1 062 km", "Umlauf|1,89 Tage").Lock().V(5);
        add("Dione", 'Moon', "Saturn", 561.4, 1.095e21, 0.998, Surf.Icy, 0xD8D8D4, 0x9C9C98, Orbit.SatJ(377700, 0.002, 116.0, 212.0, 0.0, 0.0, 2.736915, 40.6, 83.5), "Mond des Saturn",
            "Auf der Rückseite ziehen sich helle Eisklippen hunderte Kilometer weit – Bruchkanten, keine Ablagerungen, wie Cassini zeigte.", "Durchmesser|1 123 km", "Umlauf|2,74 Tage").Lock().V(3);
        add("Rhea", 'Moon', "Saturn", 763.8, 2.31e21, 0.949, Surf.Icy, 0xCFCFCB, 0x8E8E8A, Orbit.SatJ(527200, 0.001, 44.3, 31.5, 0.3, 133.7, 4.518212, 40.6, 83.5), "Mond des Saturn",
            "Saturns zweitgrößter Mond, eine kalte, kraterübersäte Eiskugel mit hellen Bruchzonen.", "Durchmesser|1 527 km", "Umlauf|4,52 Tage").Lock().V(3);
        add("Titan", 'Moon', "Saturn", 2574.7, 1.345e23, 0.22, Surf.Titan, 0xD89A48, 0xA0702E, Orbit.SatJ(1221900, 0.029, 78.3, 11.7, 0.3, 78.6, 15.945421, 36.4, 84.0), "Mond des Saturn",
            "Der einzige Mond mit dichter Atmosphäre – 1,5-mal so viel Druck wie auf der Erde, vor allem Stickstoff. Orangefarbener Smog aus organischen Molekülen verbirgt die Oberfläche. " +
            "Dort regnet es Methan, es gibt Flüsse, Seen und Meere aus flüssigen Kohlenwasserstoffen. 2005 landete die Sonde Huygens; 2034 soll die Drohne Dragonfly ankommen.",
            "Durchmesser|5 150 km", "Umlauf|15,9 Tage", "Luftdruck|1,45 bar (N₂)", "Temperatur|−179 °C").Lock().Atmo(600, 0xE0A050, 2.2);
        add("Hyperion", 'Moon', "Saturn", 180, 5.6e18, 0.3, Surf.Irregular, 0xB4A48A, 0x6A5E4E, Orbit.SatJ(1481500, 0.105, 214.0, 122.9, 0.6, 87.1, 21.276658, 40.2, 83.6), "Mond des Saturn",
            "Ein schwammartiger Brocken mit sehr geringer Dichte, der chaotisch taumelt – seine Drehung ist nicht vorhersagbar.", "Größe|360 × 266 × 205 km", "Umlauf|21,3 Tage")
            .Shape(180, 133, 102);
        add("Iapetus", 'Moon', "Saturn", 734.5, 1.806e21, 0.6, Surf.Iapetus, 0xDCD8D0, 0x2A2016, Orbit.SatJ(3561700, 0.028, 254.5, 74.8, 7.6, 86.5, 79.331002, 288.7, 78.9), "Mond des Saturn",
            "Zweifarbig wie Yin und Yang: Die vorauslaufende Seite ist schwarz wie Kohle, die nachlaufende hell wie Schnee. Ein 13 km hoher Wall läuft genau am Äquator entlang.",
            "Durchmesser|1 469 km", "Umlauf|79,3 Tage").Lock();
        add("Phoebe", 'Moon', "Saturn", 106.5, 8.3e18, 0.06, Surf.Irregular, 0x3E3A36, 0x2A2826, Orbit.SatJ(12929400, 0.164, 240.3, 308.0, 175.2, 192.7, 550.30391, 276.0, 67.5), "Mond des Saturn (irregulär)",
            "Ein eingefangener Kleinkörper aus dem äußeren Sonnensystem auf rückläufiger Bahn. Sein Staub bildet einen riesigen, kaum sichtbaren Ring.", "Durchmesser|213 km", "Umlauf|550 Tage, rückläufig")
            .Shape(109, 108, 101);
        // Uranus (Bahnen in der Äquatorebene – mit Uranus „auf der Seite“)
        add("Miranda", 'Moon', "Uranus", 235.8, 6.4e19, 0.32, Surf.Icy, 0xB8B8B8, 0x6A6A6A, Orbit.SatJ(129846, 0.001, 154.8, 73.0, 4.4, 100.9, 1.413479, 77.311, 15.175), "Mond des Uranus",
            "Ein Flickenteppich aus völlig verschiedenen Landschaften mit der höchsten Klippe des Sonnensystems: Verona Rupes, rund 20 km tief.", "Durchmesser|472 km", "Umlauf|1,41 Tage").Lock().V(4);
        add("Ariel", 'Moon', "Uranus", 578.9, 1.25e21, 0.53, Surf.Icy, 0xC4C4C4, 0x7E7E7E, Orbit.SatJ(190929, 0.001, 9.6, 193.5, 0.0, 0.0, 2.520379, 77.311, 15.175), "Mond des Uranus",
            "Der hellste Uranusmond mit jungen Grabenbrüchen und glatten Ebenen.", "Durchmesser|1 158 km", "Umlauf|2,52 Tage").Lock();
        add("Umbriel", 'Moon', "Uranus", 584.7, 1.28e21, 0.26, Surf.Rock, 0x6A6A6A, 0x4A4A4A, Orbit.SatJ(265986, 0.004, 183.4, 253.0, 0.1, 174.8, 4.144177, 77.311, 15.175), "Mond des Uranus",
            "Der dunkelste der großen Uranusmonde, alt und kraterübersät; am Rand leuchtet ein heller Ring (Wunda).", "Durchmesser|1 169 km", "Umlauf|4,14 Tage").Lock();
        add("Titania", 'Moon', "Uranus", 788.4, 3.4e21, 0.35, Surf.Icy, 0xB8B0A8, 0x76706A, Orbit.SatJ(436298, 0.002, 184.0, 68.1, 0.1, 29.5, 8.705869, 77.311, 15.175), "Mond des Uranus",
            "Der größte Uranusmond mit riesigen Canyons, die vom Ausdehnen des gefrierenden Inneren zeugen.", "Durchmesser|1 577 km", "Umlauf|8,71 Tage").Lock();
        add("Oberon", 'Moon', "Uranus", 761.4, 3.08e21, 0.31, Surf.Icy, 0xACA49E, 0x6C6660, Orbit.SatJ(583511, 0.002, 132.2, 143.6, 0.1, 76.8, 13.463237, 77.311, 15.175), "Mond des Uranus",
            "Der äußerste große Uranusmond: alt, dunkel, mit Kratern, deren Böden von dunklem Material bedeckt sind.", "Durchmesser|1 523 km", "Umlauf|13,5 Tage").Lock();
        // Neptun
        add("Triton", 'Moon', "Neptun", 1353.4, 2.14e22, 0.76, Surf.Triton, 0xE0CCC4, 0xA88E86, Orbit.SatJ(354800, 0.0, 0.0, 63.0, 157.3, 177.7, 5.876854, 299.36, 43.46), "Mond des Neptun",
            "Triton umläuft Neptun rückwärts – ein eingefangenes Objekt aus dem Kuipergürtel. Geysire aus Stickstoff schießen 8 km hoch; die Oberfläche sieht aus wie eine Melonenschale. " +
            "Gezeiten ziehen ihn langsam nach innen: In 3,6 Mrd. Jahren wird er zerrissen und zu einem Ring.",
            "Durchmesser|2 707 km", "Umlauf|5,88 Tage, rückläufig", "Temperatur|−235 °C (kältester gemessener Ort)").Lock().Atmo(60, 0xA0C0FF, 0.04);
        add("Proteus", 'Moon', "Neptun", 210, 4.4e19, 0.096, Surf.Irregular, 0x5E5A56, 0x403E3C, Orbit.SatJ(117700, 0.001, 357.2, 297.4, 0.6, 355.5, 1.122315, 299.36, 43.46), "Mond des Neptun",
            "Einer der größten unregelmäßig geformten Monde – gerade noch zu klein, um sich zur Kugel zusammenzuziehen.", "Größe|≈ 420 km", "Umlauf|26,9 h").Shape(218, 208, 201).Lock();
        add("Nereid", 'Moon', "Neptun", 170, 3.1e19, 0.155, Surf.Rock, 0x8A8680, 0x605C58, Orbit.SatJ(5513900, 0.751, 296.8, 318.5, 5.1, 319.5, 360.133039, NaN, 0, 2458849.5), "Mond des Neptun",
            "Hat eine der exzentrischsten Mondbahnen: Der Abstand zu Neptun schwankt zwischen 1,4 und 9,7 Millionen km.", "Durchmesser|≈ 340 km", "Umlauf|360 Tage");
        // Pluto
        add("Charon", 'Moon', "Pluto", 606, 1.586e21, 0.38, Surf.Icy, 0x9C9894, 0x6A3424, Orbit.SatJ(19600, 0.0, 0.0, 304.1, 0.0, 0.0, 6.387222, 312.993, 6.163), "Mond des Pluto",
            "Halb so groß wie Pluto – das Paar umkreist einen Schwerpunkt außerhalb von Pluto und gilt manchen als Doppel-Zwergplanet. Der rötliche Nordpol (Mordor Macula) " +
            "färbt sich durch Methan, das von Pluto entweicht und auf Charon gefriert.", "Durchmesser|1 212 km", "Plutoabstand|19 591 km", "Umlauf|6,39 Tage").Lock().V(1);
        add("Dysnomia", 'Moon', "Eris", 350, 8e19, 0.04, Surf.Rock, 0x5A5754, 0x403E3C, Orbit.Sat(37_273, 0.0062, 0, 15.786), "Mond der Eris",
            "Eris' dunkler Begleiter; aus seiner Bahn wurde Eris' Masse bestimmt.", "Durchmesser|≈ 700 km", "Umlauf|15,8 Tage").Lock();

        // ============================================================================ Asteroiden
        add("Vesta", 'Asteroid', "Sonne", 286, 2.59e20, 0.42, Surf.Rock, 0x9C948A, 0x6E665E, Orbit.HelioAt(2.3615, 0.0902, 7.142, 103.8, 151.2, 0, 2460901.587),
            "Asteroid (Protoplanet)", "Der hellste Asteroid – manchmal mit bloßem Auge sichtbar. Am Südpol liegt der Einschlagkrater Rheasilvia, 505 km breit mit einem 22 km hohen Zentralberg. " +
            "Aus diesem Einschlag stammen die HED-Meteoriten, die auf der Erde gefunden werden.", "Größe|573 × 557 × 446 km", "Sonnenabstand|2,15–2,57 AE", "Umlauf|3,63 Jahre", "Rotation|5,34 h")
            .Pole(309.031, 42.235, 285.39, 1617.3329428).Shape(286, 279, 223).V(6);
        add("Pallas", 'Asteroid', "Sonne", 256, 2.04e20, 0.15, Surf.Rock, 0x7C7874, 0x5A5754, Orbit.HelioAt(2.7724, 0.2306, 34.93, 172.9, 310.9, 0, 2461695.031),
            "Asteroid", "Der drittgrößte Asteroid auf einer stark geneigten Bahn (35°) – schwer zu erreichen, darum noch nie besucht.", "Durchmesser|≈ 512 km", "Umlauf|4,6 Jahre").Shape(275, 258, 238);
        add("Hygiea", 'Asteroid', "Sonne", 217, 8.3e19, 0.07, Surf.Rock, 0x5C5956, 0x403E3C, Orbit.HelioAt(3.142, 0.107, 3.83, 283.2, 312.3, 0, 2461813.201),
            "Asteroid", "Fast rund – vielleicht ein Kandidat für den kleinsten Zwergplaneten.", "Durchmesser|≈ 434 km", "Umlauf|5,6 Jahre");
        add("Eros", 'Asteroid', "Sonne", 17.2, 6.7e15, 0.25, Surf.Irregular, 0xA08C70, 0x6C5E4C, Orbit.HelioAt(1.458, 0.2227, 10.83, 304.3, 178.9, 0, 2461088.813),
            "Erdnaher Asteroid", "2001 setzte die Sonde NEAR Shoemaker hier als erste Raumsonde überhaupt auf einem Asteroiden auf.", "Größe|34 × 11 × 11 km", "Umlauf|1,76 Jahre")
            .Shape(17.2, 5.6, 5.6);
        add("Bennu", 'Asteroid', "Sonne", 0.245, 7.3e10, 0.044, Surf.Irregular, 0x3A3836, 0x2A2826, Orbit.HelioAt(1.1264, 0.2037, 6.035, 2.06, 66.22, 0, 2455439.142),
            "Erdnaher Asteroid", "Ein lockerer Schutthaufen in Kreiselform. OSIRIS-REx holte 2020 Proben, die 2023 auf der Erde landeten – darin Aminosäuren und Phosphate.",
            "Durchmesser|490 m", "Umlauf|1,2 Jahre", "Rotation|4,3 h").Shape(0.25, 0.25, 0.23);
        add("Apophis", 'Asteroid', "Sonne", 0.17, 6.1e10, 0.23, Surf.Irregular, 0x8A8070, 0x605A50, Orbit.HelioAt(0.9224, 0.1914, 3.34, 203.96, 126.6, 0, 2461042.919),
            "Erdnaher Asteroid", "Am 13. April 2029 rast Apophis in nur 32 000 km Höhe an der Erde vorbei – tiefer als geostationäre Satelliten und mit bloßem Auge sichtbar. " +
            "Ein Einschlag ist für die nächsten 100 Jahre ausgeschlossen.", "Größe|≈ 340 m", "Umlauf|0,89 Jahre", "Vorbeiflug|13.04.2029").Shape(0.2, 0.15, 0.12, true);
        add("Arrokoth", 'Asteroid', "Sonne", 18, 7.5e17, 0.21, Surf.Irregular, 0xB06040, 0x7A4030, Orbit.HelioAt(44.1, 0.0356, 2.45, 159.0, 189.0, 0, 2475741.404),
            "Kuipergürtel-Objekt", "Das fernste je besuchte Objekt (New Horizons, 2019): zwei sanft verschmolzene Klumpen, unberührt seit der Entstehung des Sonnensystems.",
            "Größe|36 × 20 × 10 km", "Sonnenabstand|≈ 44 AE").Shape(18, 10, 5, true);

        // ============================================================================ Kometen
        add("Halley", 'Comet', "Sonne", 7.5, 2.2e14, 0.04, Surf.Nucleus, 0x2E2C2A, 0x1E1C1A, Orbit.Comet(0.575, 0.968, 162.26, 59.1, 112.0, 2446469.974),
            "Komet (kurzperiodisch)", "Der berühmteste Komet kehrt alle 75–76 Jahre zurück; schon 240 v. Chr. wurde er beobachtet. 1986 flog die Sonde Giotto bis auf 600 km an den Kern heran. " +
            "Sein Staub erzeugt zweimal im Jahr Sternschnuppen: die Eta-Aquariiden im Mai und die Orioniden im Oktober.",
            "Kern|15 × 8 × 8 km", "Periheldistanz|0,59 AE", "Aphel|35 AE", "Umlauf|≈ 76 Jahre", "Nächstes Perihel|28.07.2061").Shape(7.5, 4, 4).Act(1);
        add("Encke", 'Comet', "Sonne", 2.4, 1e13, 0.05, Surf.Nucleus, 0x302E2C, 0x201E1C, Orbit.Comet(0.34, 0.847, 11.3, 334.2, 187.0, 2460240.029),
            "Komet (kurzperiodisch)", "Der Komet mit der kürzesten bekannten Umlaufzeit eines größeren Kometen: 3,3 Jahre. Er ist die Quelle der Tauriden-Sternschnuppen.",
            "Kern|≈ 4,8 km", "Periheldistanz|0,34 AE", "Umlauf|3,3 Jahre").Act(0.2);
        add("Tschurjumow-Gerassimenko", 'Comet', "Sonne", 2.05, 1e13, 0.06, Surf.Nucleus, 0x2E2C2A, 0x1C1A18, Orbit.Comet(1.21, 0.649, 7.04, 50.14, 12.78, 2459520.5),
            "Komet (67P)", "Das „Quietscheentchen“: Die Sonde Rosetta begleitete den Kometen 2014–2016, der Lander Philae setzte als erster auf einem Kometenkern auf. " +
            "Die Sonde fand Aminosäuren und Sauerstoff.", "Kern|4,1 × 3,3 × 1,8 km", "Periheldistanz|1,21 AE", "Umlauf|6,4 Jahre").Shape(2.05, 1.65, 1.3, true).Act(0.25);
        add("Hale-Bopp", 'Comet', "Sonne", 30, 1e16, 0.04, Surf.Nucleus, 0x2E2C2A, 0x1E1C1A, Orbit.Comet(0.914, 0.99508, 89.43, 282.47, 130.59, 2450539.64),
            "Komet (langperiodisch)", "Der „Große Komet von 1997“ war 18 Monate lang mit bloßem Auge sichtbar – Rekord. Sein Kern ist mit rund 60 km ungewöhnlich groß. " +
            "Er kehrt erst in etwa 2 500 Jahren zurück.", "Kern|≈ 60 km", "Periheldistanz|0,91 AE", "Umlauf|≈ 2 500 Jahre").Shape(30, 26, 24).Act(12);
        add("Swift-Tuttle", 'Comet', "Sonne", 13, 1e15, 0.04, Surf.Nucleus, 0x2E2C2A, 0x1E1C1A, Orbit.Comet(0.9595, 0.9632, 113.45, 139.38, 152.98, 2448968.5),
            "Komet (Mutter der Perseiden)", "Der größte Körper, der regelmäßig nahe an der Erdbahn vorbeikommt. Jeden August kreuzt die Erde seine Staubspur – die Perseiden. Nächstes Perihel: 2126.",
            "Kern|≈ 26 km", "Periheldistanz|0,96 AE", "Umlauf|133 Jahre").Act(3);
        add("Tempel-Tuttle", 'Comet', "Sonne", 1.8, 1e13, 0.04, Surf.Nucleus, 0x2E2C2A, 0x1E1C1A, Orbit.Comet(0.9764, 0.9055, 162.49, 235.27, 172.50, 2450872.5),
            "Komet (Mutter der Leoniden)", "Seine Staubspur erzeugt im November die Leoniden – 1833 und 1966 fielen bis zu 100 000 Sternschnuppen pro Stunde.",
            "Kern|≈ 3,6 km", "Umlauf|33,2 Jahre").Act(0.3);
        add("Tsuchinshan-ATLAS", 'Comet', "Sonne", 2.5, 1e13, 0.04, Surf.Nucleus, 0x2E2C2A, 0x1E1C1A, Orbit.Comet(0.3914, 1.00012, 139.11, 21.56, 308.49, 2460581.2),
            "Komet (C/2023 A3)", "Der helle Komet vom Oktober 2024 mit Gegenschweif. Seine Bahn ist leicht hyperbolisch – er verlässt das Sonnensystem für immer.",
            "Periheldistanz|0,39 AE", "Perihel|27.09.2024").Act(4);
        add("Phaethon", 'Asteroid', "Sonne", 2.9, 1.4e14, 0.12, Surf.Irregular, 0x46423E, 0x302E2C, Orbit.HelioAt(1.271, 0.8898, 22.26, 265.2, 322.2, 0, 2461285.616),
            "Asteroid (Mutter der Geminiden)", "Ein „Felskomet“: Er kommt der Sonne bis auf 0,14 AE nahe, wird 750 °C heiß und zerbröselt. Sein Staub erzeugt im Dezember die Geminiden.",
            "Durchmesser|≈ 5,8 km", "Periheldistanz|0,14 AE", "Umlauf|1,43 Jahre").Shape(2.9, 2.8, 2.6);

        // ============================================================================ Raumsonden (nur Markierung)
        add("Voyager 1", 'Probe', "Sonne", 0.002, 722, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, Orbit.Radial(258.3, 12.0, 165.0, 3.58, 2460676.5),
            "Raumsonde (NASA, 1977)", "Das fernste von Menschen gebaute Objekt. Voyager 1 besuchte Jupiter und Saturn und überquerte 2012 die Heliopause – die Grenze zum interstellaren Raum. " +
            "Die Funksignale brauchen fast einen Tag zur Erde. An Bord: die Goldene Schallplatte mit Grüßen der Menschheit.", "Start|05.09.1977", "Geschwindigkeit|17 km/s", "Position|ungefähr (Flucht in Richtung Ophiuchus)");
        add("Voyager 2", 'Probe', "Sonne", 0.002, 722, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, Orbit.Radial(301.3, -59.3, 138.0, 3.24, 2460676.5),
            "Raumsonde (NASA, 1977)", "Die einzige Sonde, die Uranus (1986) und Neptun (1989) besucht hat. Seit 2018 im interstellaren Raum.", "Start|20.08.1977", "Geschwindigkeit|15 km/s");
        add("New Horizons", 'Probe', "Sonne", 0.002, 478, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, Orbit.Radial(292.6, -20.5, 60.5, 2.9, 2460676.5),
            "Raumsonde (NASA, 2006)", "Flog 2015 an Pluto und 2019 an Arrokoth vorbei und erforscht weiter den Kuipergürtel.", "Start|19.01.2006", "Geschwindigkeit|14 km/s");
        add("Parker Solar Probe", 'Probe', "Sonne", 0.002, 685, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, Orbit.Helio(0.388, 0.8817, 3.4, 76.7, NaN, 0, 2460668.95),
            "Raumsonde (NASA, 2018)", "Fliegt durch die Sonnenkorona: Im Perihel nur 6,2 Mio. km über der Sonnenoberfläche mit 192 km/s – das schnellste je gebaute Objekt. " +
            "Ein Hitzeschild aus Kohlenstoff hält 1 400 °C aus, dahinter bleibt es bei Raumtemperatur.", "Perihel|9,86 Sonnenradien", "Umlauf|88 Tage", "Rekord|192 km/s").Rough();
        add("James Webb", 'Probe', "Erde", 0.01, 6200, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, orbitKind('L2'),
            "Weltraumteleskop (2021)", "Das größte Weltraumteleskop kreist 1,5 Mio. km hinter der Erde um den Lagrange-Punkt L2, wo Sonne, Erde und Mond immer auf derselben Seite seines Sonnenschilds stehen. " +
            "Es beobachtet im Infraroten die ersten Galaxien nach dem Urknall.", "Spiegel|6,5 m", "Abstand|1,5 Mio. km von der Erde", "Temperatur|−233 °C (Spiegel)");
        add("ISS", 'Probe', "Erde", 0.05, 4.2e5, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, Orbit.Sat(6371 + 418, 0.0005, 51.64, 0.06454, true),
            "Raumstation (seit 1998)", "Die Internationale Raumstation umrundet die Erde in 92 Minuten – 16-mal am Tag. Seit November 2000 leben ständig Menschen an Bord.",
            "Höhe|≈ 420 km", "Geschwindigkeit|7,66 km/s", "Masse|420 t").Rough();

        // Raumfahrzeuge der Missionen (Bahn kommt aus MissionCatalog)
        for (const [n, typ, txt] of [
            ["Apollo 11", "Raumschiff (NASA, 1969)", "Kommandokapsel Columbia und Mondfähre Eagle: die erste bemannte Mondlandung. Die Mission findest du unter „Missionen“."],
            ["Apollo 13", "Raumschiff (NASA, 1970)", "Die Mondlandung, die zur Rettungsmission wurde. Die Mission findest du unter „Missionen“."],
            ["Artemis I", "Raumschiff Orion (NASA, 2022)", "Unbemannter Testflug von Orion um den Mond. Die Mission findest du unter „Missionen“."],
            ["Cassini", "Raumsonde (NASA/ESA, 1997)", "Saturn-Sonde mit dem Titan-Lander Huygens. Die Mission findest du unter „Missionen“."],
            ["Rosetta", "Raumsonde (ESA, 2004)", "Begleitete den Kometen 67P zwei Jahre lang. Die Mission findest du unter „Missionen“."],
            ["Perseverance", "Mars-Rover (NASA, 2020)", "Rover im Jezero-Krater mit dem Hubschrauber Ingenuity. Die Mission findest du unter „Missionen“."],
        ] as [string, string, string][])
            add(n, 'Probe', "Sonne", 0.003, 1000, 0.5, Surf.None, 0xFFFFFF, 0xFFFFFF, null, typ, txt);

        // ============================================================================ Meteorströme (Kreuzungspunkt mit der Erdbahn)
        stream("Perseiden", "Swift-Tuttle", "Meteorstrom", "Mitte August kreuzt die Erde die Staubspur von Swift-Tuttle. Die Körnchen treffen mit 59 km/s auf die Atmosphäre und verglühen in 100 km Höhe. " +
               "Bis zu 100 Sternschnuppen pro Stunde – der beliebteste Meteorstrom des Jahres.", "Höhepunkt|12./13. August", "Rate|≈ 100 pro Stunde", "Geschwindigkeit|59 km/s");
        stream("Leoniden", "Tempel-Tuttle", "Meteorstrom", "Mitte November. Schnellste Meteore überhaupt (71 km/s), weil die Erde dem Strom frontal begegnet. Alle 33 Jahre sind Meteorstürme möglich.",
               "Höhepunkt|17./18. November", "Rate|10–15 pro Stunde (Stürme: Tausende)", "Geschwindigkeit|71 km/s");
        stream("Geminiden", "Phaethon", "Meteorstrom", "Der reichste Strom des Jahres, Mitte Dezember – und der einzige, der von einem Asteroiden stammt.",
               "Höhepunkt|13./14. Dezember", "Rate|≈ 150 pro Stunde", "Geschwindigkeit|35 km/s");
        stream("Orioniden", "Halley", "Meteorstrom", "Staub des Halleyschen Kometen, im Oktober. Die Spur trifft die Erdbahn zweimal; im Mai entstehen dadurch die Eta-Aquariiden.",
               "Höhepunkt|21. Oktober", "Rate|≈ 20 pro Stunde", "Geschwindigkeit|66 km/s");
        stream("Tauriden", "Encke", "Meteorstrom", "Langsame, oft helle Feuerkugeln im Oktober und November aus dem breiten Staubstrom von Encke.",
               "Höhepunkt|Oktober–November", "Rate|≈ 5 pro Stunde", "Geschwindigkeit|27 km/s");
}
