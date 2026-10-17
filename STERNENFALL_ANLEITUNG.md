# STERNENFALL – Anleitung

## Warum dieses Format?
STERNENFALL ist ein **Slot-Reaktor-Deckbuilder**, eine Mischung aus *Slots & Daggers*, *Luck be a Landlord* und *Slay the Spire*.
- Ein Spielautomat passt perfekt zum Handy: Man tippt mit dem Daumen, eine Runde dauert Sekunden, und man kann sie im Bus unterbrechen.
- Glück steckt in jedem Dreh. Ob er gelingt, entscheidest du aber selbst: Du baust die Walzen, hältst gute Walzen fest und riskierst Hitze.
- Das Deck sind die drei Walzen. Je weniger Symbole eine Walze hat, desto verlässlicher wird sie. Daraus entstehen echte Build-Entscheidungen.
- Familien-Synergien (Waffe, Schild, Technik, Kosmos), Jackpots und Module ergeben Kombos bis hin zu „kaputten“ Builds.
- Die Karte mit Stationen, das Casino, Doppelt-oder-nichts und die Wracks liefern das Zocker-Gefühl. Der Kampf bleibt dabei taktisch.
- Die Weltall-Story und der Jugendstil im *Atlantis*-Look machen aus der Meta-Progression eine Reise über viele Wochen.

## Starten
- In der App: **Spiele → Sternenfall** (oder die Karte auf der Startseite).
- **Abheben** startet einen Flug mit dem gewählten Schiff. Ein unterbrochener Flug wird automatisch gespeichert und lässt sich mit **Flug fortsetzen** wieder aufnehmen.
- Weitere Startarten:
  - **Seed:** ein Feld für einen eigenen Seed.
  - **Tagesflug:** gleicher Seed für alle, ×1,5 Sternenstaub.
  - **Wochen-Expedition:** mit Mutatoren.
  - **Gefahrenstufe 0–10:** wird ab dem ersten Sieg freigeschaltet.

## Steuerung
| Aktion | Geste |
|---|---|
| Drehen | großer Messingknopf **Drehen** (zeigt die Hitzekosten) |
| Walze halten | **Halten** unter der Walze (erst nach dem ersten Dreh; jede gehaltene Walze kostet +1 Hitze) |
| Zug beenden | **Andocken**; danach handeln die Gegner |
| Ziel wählen | Gegner antippen |
| Details | Gegner, Karte oder Modul lange drücken bzw. antippen |
| Walzen ansehen | ⚙-Knopf in der Kopfleiste |
| Menü / Aufgeben | ☰ |

**Regeln in Kürze**
- Pro Zug hast du 3 Drehs. Jeder Dreh füllt das 3×3-Fenster, und **jedes sichtbare Symbol feuert**.
- Es gibt 5 Gewinnlinien: 3 Reihen und 2 Diagonalen.
  - Drei Symbole derselben Familie ergeben eine **Synergie (×2)**.
  - Drei gleiche Symbole ergeben einen **Jackpot (×3)**.
  - Das **Wurmloch** ist ein Joker.
- **Hitze:**
  - Jeder Dreh kostet 1 Hitze plus 1 je gehaltener Walze.
  - Über dem Maximum überhitzt der Reaktor: Du nimmst Schaden, und der Zug endet.
  - Zu Beginn jedes Zuges kühlt der Reaktor um 3 ab.
- Schild verfällt am Zugende.
- Gegner können Schrott in deine Walzen werfen, Walzen blockieren, dich verstrahlen und schwächen.

## Aufbau eines Laufs
- Ein Lauf besteht aus 3 Sektoren, nach dem ersten Sieg aus 4 (dann mit dem Endsektor „Rand“ und dem Architekten).
- Jeder Sektor hat eine verzweigte Karte mit diesen Stationen:
  - ⚔ Gefecht
  - ☠ Elite
  - ? Begegnung
  - ⚖ Ozzos Basar
  - ♣ Casino
  - ⚙ Brakks Station
  - ◈ Wrack
  - ♛ Boss
- Nach jedem Kampf:
  - **Taler:** nehmen oder Doppelt-oder-nichts spielen.
  - **Symbol:** eines von 3 wählen; die Seltenheit steigt durch eine versteckte Glücksgarantie.
  - **Neu würfeln:** mit steigenden Kosten.
- Elite und Boss geben zusätzlich Module.
- Beim Tod gibt es Sternenstaub für die Forschung: neue Schiffe, Sektoren, Symbolpakete und Talente.
- Die Geschichte wird im Logbuch Kapitel für Kapitel freigeschaltet.

## Inhalte hinzufügen
Alles ist datengetrieben. Eine neue Datei ist nicht nötig, es reicht ein Eintrag in der passenden Liste.

| Inhalt | Datei | Eintrag |
|---|---|---|
| **Symbol** | `src/rogue/data/symbols.ts` | `W({...})` / `SH` / `TE` / `KO` mit `id, name, rarity, art, c1, c2, text(lv), fire(g, lv)`. `art` ist ein Motiv aus `art.ts → MOTIFS`, ein neues Motiv kann dort ergänzt werden. Mit `pack: 'p-…'` wird es erst durch die Forschung freigeschaltet. |
| **Modul** | `src/rogue/data/modules.ts` | `{ id, name, icon, rarity, text, onRunStart / onCombatStart / onTurnStart / onLine / onKill / onOverheat / modDamage / modGold … }`, optional `cursed: true` |
| **Gegner** | `src/rogue/data/enemies.ts` | `{ id, name, look: { kind, seed, hue }, hp: [min, max], tier, next: (e, t) => Absicht }`. `kind` ist `kreatur`, `qualle`, `auge`, `kristall`, `schwarm`, `mech`, `jaeger` oder `wurm`, der Look wird prozedural erzeugt. Mechaniken laufen über `passive`, `onSpawn`, `modTaken`, `onHurt`, `onTurnStart`, `special`. |
| **Boss** | wie Gegner | `tier: 'boss'`, `look.boss: '<motiv>'` (neues Motiv in `art.ts → bossSvg`) |
| **Sektor** | `enemies.ts → SECTORS` | `{ id, tier 1–4, name, text, bg, theme, easy, hard, elite, bosses, pack? }` |
| **Begegnung** | `src/rogue/data/events_a.ts` / `events_b.ts` | `{ id, act (0 = überall), icon, title, text, options: [{ label, check?: { chance, raise }, win: [Outcome], lose?, winText, loseText }] }` |
| **Story** | `src/rogue/data/story.ts` | `CHAPTERS` mit `unlock: 'start' \| 'visit:<sektor>' \| 'boss:<sektor>' \| 'win' \| 'final' \| 'runs:<n>'`; Figuren in `CAST` |
| **Forschung / Schiffe** | `src/rogue/data/ships.ts` | `SHIPS`, `RESEARCH`, `MUTATORS` |
| **Erfolge / Tagesziele** | `src/rogue/meta.ts` | `ACHIEVEMENTS`, `GOALS` |

**Balance:** Die Tabelle `BAL` in `src/rogue/reactor.ts` legt die Lebenspunkte und den Schaden je Gegnerstufe und Sektorstufe fest.
Nach Änderungen lässt man den Simulator laufen. Dazu im Dev-Browser (`npm run dev`) die Konsole öffnen:

```js
const S = await import('/tools/sternenfall-sim.ts'); const r = await S.sim(300, { rand: true }); console.table(r.acts); r
```

Der Simulator spielt Läufe ohne Shop, Rast und Begegnungen. Das sind Richtwerte für den Bot:
- Akt 1 schafft er zu etwa 90 %.
- Den ganzen Lauf mit 3 Sektoren gewinnt er zu etwa 35 %.
- Gegen den Endboss gewinnt er zu etwa 30 %.

Ein Mensch mit Shop und Rast schneidet deutlich besser ab.
