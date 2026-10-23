// STERNENFALL – Ablauf und Bildschirme: Brücke (Hub: Start, Forschung, Logbuch, Erfolge, Verlauf), Sternenkarte,
// Kampf (ui/reactorView.ts), Beute, Ozzos Basar, Casino „Ewiger Orbit“, Begegnungen, Brakks Station, Wracks, Ende.
import { L, N } from '../core/i18n';
import { todayKey } from '../core/leaderboard';
import { confirmSheet, h, sheet, toast } from '../ui/dom';
import { SYM, SYMBOLS } from './data/symbols';
import { MOD } from './data/modules';
import { ENEMIES, ENEMY, SECTOR } from './data/enemies';
import { EVENTS } from './data/events';
import { MUTATORS, RESEARCH, SHIP, SHIPS } from './data/ships';
import { CAST, CHAPTERS } from './data/story';
import { CONSTELLATIONS } from './data/constellations';
import { CREDITS } from './data/credits';
import { PORTS, PORT_VISITS } from './data/ports';
import { Mood, Sky } from './sky';
import { warp } from '../ui/warp';
import { attachFeel, attachIcons } from './ui/feel';
import { showSettings } from './ui/settingsView';
import { onSfs } from './settings';

/** Abheben mit Sternen-Warp. */
const warpGo = (f: () => void) => warp(f, { ms: 1000 });
import { goldFor } from './reactor';
import { Particles, bgm, bgmIntensity, countUp, flash, haptic, shake, snd, sting } from './juice';
import {
  ACHIEVEMENTS, GOALS, canResearch, discover, packUnlocked, finishRun, level, meta, nextGoal, onAchievement, onChapter, onGoal, research, researchProgress,
  saveMeta, shipUnlocked, story, track, unlock, weekKey,
} from './meta';
import { dailySeed, hashSeed, newSeed, pick, rngOf, step, weighted } from './rng';
import {
  COLS, PORT_AFTER, addModule, applyOutcomes, enterAct, lastAct, loadRun, moduleOffer, modulePrice, newRun, payReroll, reachable, removeCost, removeSymbol,
  rerollCost, runCtx, saveRun, sectorOf, symbolOffer, symbolPrice, upgradeCost,
} from './run';
import { EventDef, EventOption, MapNode, Run } from './types';
import { NODE_ICON, NODE_NAME, cardEl, cardPreview, chooseReel, longPress, pickSymbol, playChapter, portrait, showConsts, showReels, topBar, tx } from './ui/parts';
import { rules, runFight } from './ui/reactorView';
import { prewarmArt, coinIcon, cornerOrn, dustIcon, enemyHtml, frameImg, vineRule, ornament, sectorPattern, shipHtml, symbolHtml } from './art';

export class Game {
  run: Run | null = null;
  view: HTMLElement;
  particles: Particles;
  readonly sky = new Sky();
  private offs: (() => void)[] = [];
  private storyQueue: string[] = [];
  ship = 'kreuzer';
  asc = 0;
  deck = '';

  constructor(readonly host: HTMLElement, readonly exit: () => void) {
    host.classList.add('sf');
    document.documentElement.style.setProperty('--sf-coin', coinIcon());
    document.documentElement.style.setProperty('--sf-dust', dustIcon());
    // Jugendstil-Ranken für Ecken und Abschnittsköpfe (auch für Blätter außerhalb des Spielbereichs)
    const ds = document.documentElement.style;
    (['tl', 'tr', 'bl', 'br'] as const).forEach(c => ds.setProperty(`--orn-${c}`, cornerOrn(c)));
    ds.setProperty('--sf-frame', frameImg('gold', 'a')); ds.setProperty('--sf-frame-b', frameImg('gold', 'b')); ds.setProperty('--sf-frame-ink', frameImg('ink', 'a'));
    ds.setProperty('--vine-l', vineRule()); ds.setProperty('--vine-r', vineRule('#c9a45c', true));
    document.body.classList.add('sf-on');
    const canvas = h('canvas', { class: 'sf-particles' });
    this.view = h('div', { class: 'sf-view' });
    host.classList.add('sky-on');
    host.append(this.sky.el, this.view, canvas);
    this.particles = new Particles(canvas);
    this.offs.push(attachFeel(host, this.particles));
    this.offs.push(attachIcons(host));
    this.offs.push(onSfs(() => this.sky.start()));   // Grafikstufe gewechselt → Himmel neu anstoßen
    this.offs.push(onAchievement(a => this.banner(`${a.icon} ${tx(a.name)}`, `+${a.staub} ✧ · ${tx(a.text)}`)));
    this.offs.push(onGoal(g => this.banner(L('Tagesziel geschafft!', 'Daily goal done!'), `${tx(g.text)} · +${g.staub} ✧`)));
    this.offs.push(onChapter(id => this.storyQueue.push(id)));
    this.run = loadRun();
    story('start');
    void this.flushStory().then(() => this.hub());
    if (import.meta.env.DEV) (window as any).__sf = this;
  }
  dispose() { document.body.classList.remove('sf-on'); this.offs.forEach(f => f()); this.particles.stop(); this.sky.dispose(); bgm(null); }

  private clear(cls = '', bg?: [string, string], theme?: string) {
    this.view.innerHTML = ''; this.view.className = 'sf-view ' + cls; this.view.scrollTop = 0;
    const v = this.view, mark = v.className; setTimeout(() => { if (v.className === mark) v.classList.add('settled'); }, 800);   // Einblenden nur beim Ansichtswechsel
    // Lebender Himmel: Sektor-Thema + Stimmung der Station
    const sec = this.run ? SECTOR[sectorOf(this.run)] : null;
    const word = cls.split(' ')[0];
    const mood: Mood = (['hub', 'map', 'fight', 'reward', 'event', 'shop', 'casino', 'rest', 'chest'].includes(word) ? word : word === 'port' ? 'shop' : word === 'result' ? (cls.includes('won') ? 'won' : 'lost') : 'map') as Mood;
    // Musik je Lage (Kampf wählt selbst, Ergebnis spielt einen Jingle)
    const mapTrack = ({ guertel: 'map', frost: 'map_frost', werft: 'map', riff: 'map_orion', orion: 'map_orion', pulsar: 'map_pulsar', tiefsee: 'map_frost', sturm: 'map_pulsar', horizont: 'map_horizont', kern: 'map_pulsar', rand: 'event' } as const)[(sec?.id ?? 'guertel') as 'guertel'] ?? 'map';
    const track = ({ hub: 'hub', map: mapTrack, event: 'event', rest: 'event', chest: 'event', reward: mapTrack, shop: 'casino', casino: 'casino', port: 'hub' } as const)[word as 'hub'];
    if (track) { bgmIntensity(word === 'hub' ? 0.8 : 0.85); bgm(track); }
    if (word !== 'fight') this.sky.set(word === 'hub' ? 'rand' : theme && word === 'map' ? theme : sec?.theme ?? 'rand', mood, word === 'hub' ? undefined : bg ?? sec?.bg);
    if (bg) { this.view.style.setProperty('--bg1', bg[0]); this.view.style.setProperty('--bg2', bg[1]); this.view.style.setProperty('--pat', sectorPattern(theme ?? 'x', '#c9a45c')); }
  }
  private banner(title: string, sub: string) {
    const b = h('div', { class: 'sf-banner' }, h('b', null, title), h('small', null, sub));
    this.host.append(b); snd.win(); haptic('success');
    setTimeout(() => b.classList.add('out'), 2600); setTimeout(() => b.remove(), 3200);
  }
  private save() { if (this.run) saveRun(this.run); this.refreshTop(); }
  private top() { return topBar(this.run!, () => showReels(this.run!), () => this.runMenu()); }
  /** Kopfleiste nach Gold-/Hüllenänderungen neu zeichnen. */
  private refreshTop() { const old = this.view?.querySelector(':scope > .sf-top'); if (old && this.run) old.replaceWith(this.top()); }
  private async flushStory() { while (this.storyQueue.length) { const id = this.storyQueue.shift()!; const m = meta(); m.unread = m.unread.filter(x => x !== id); saveMeta(); await playChapter(id); } }
  private sectorBg(): [string, string] { const s = this.run ? SECTOR[sectorOf(this.run)] : null; return s ? s.bg : ['#14182a', '#07060f']; }

  // =========================================================================================== Brücke (Hub)
  hub(tab: 'play' | 'lab' | 'log' | 'arch' | 'ach' | 'hist' = 'play') {
    if (tab === 'ach' || tab === 'hist') tab = 'arch';
    this.clear('hub', ['#1a2236', '#07060f'], 'rand');
    const m = meta(), goal = nextGoal();
    const canBuy = !!goal && m.staub >= goal.cost;
    const tabs: [typeof tab, string, string, boolean][] = [
      ['play', '✦', L('Flug', 'Flight'), false], ['lab', '⚗', L('Labor', 'Lab'), canBuy],
      ['log', '☾', L('Logbuch', 'Logbook'), m.unread.length > 0], ['arch', '♛', L('Archiv', 'Archive'), false]];
    this.view.append(
      h('div', { class: 'sf-hubhead' },
        h('button', { class: 'sf-ib', onclick: () => this.exit(), 'aria-label': L('Zurück', 'Back') }, '‹'),
        h('div', { class: 'sf-logo' }, h('small', null, L('Eine Sternensaga', 'A star saga')), h('b', null, 'Sternenfall')),
        h('div', { class: 'sf-headr' }, h('button', { class: 'sf-staub', onclick: () => this.hub('lab') }, h('i', { class: 'sfd' }), ` ${N(m.staub)}`),
          h('button', { class: 'sf-ib gear', 'aria-label': L('Einstellungen', 'Settings'), onclick: () => showSettings([{ label: L('Spielregeln', 'Rules'), run: () => rules() }, { label: L('Quellen & Lizenzen', 'Credits & licenses'), run: () => this.credits() }]) }, '⚙'))),
      h('nav', { class: 'sf-tabs2' }, tabs.map(([id, ic, label, dot]) =>
        h('button', { class: tab === id ? 'on' : '', onclick: () => this.hub(id) }, h('span', { class: 'ic' }, ic), h('small', null, label), dot ? h('i', { class: 'dot' }) : ''))));
    const body = h('div', { class: 'sf-hubbody' });
    this.view.append(body);
    ({ play: () => this.hubPlay(body), lab: () => this.hubLab(body), log: () => this.hubLog(body), arch: () => this.hubArch(body) } as Record<string, () => void>)[tab]();
    if (!m.tutorial) { m.tutorial = true; saveMeta(); rules(); }
  }

  // ------------------------------------------------------------------------------------------- Flug-Tab
  private hubPlay(body: HTMLElement) {
    const m = meta();
    // 1 · Laufender Flug
    if (this.run) {
      const r = this.run;
      body.append(h('div', { class: 'sf-sec' }, L('Laufender Flug', 'Current flight')),
        h('button', { class: 'sf-continue', onclick: () => this.resume() },
          h('div', { class: 'sf-shipmini', html: shipHtml(SHIP[r.ship].hull, SHIP[r.ship].hue) }),
          h('div', null, h('b', null, L('Weiterfliegen', 'Continue')), h('small', null, `${tx(SECTOR[sectorOf(r)].name)} · ${L('Akt', 'Act')} ${r.act}/${lastAct(r)}`), h('small', null, `${L('Hülle', 'Hull')} ${r.hp}/${r.maxHp} · ✦ ${r.gold}`)),
          h('span', null, '›')),
        h('button', { class: 'sf-link small', onclick: async () => { if (await confirmSheet(L('Flug abbrechen?', 'Abandon flight?'), L('Der Lauf endet und wird gewertet.', 'The run ends and is scored.'), L('Abbrechen', 'Abandon'), L('Weiterfliegen', 'Keep flying'))) void this.result(false, L('aufgegeben', 'abandoned')); } }, L('Flug abbrechen', 'Abandon flight')));
    }
    // 2 · Neuer Flug: Ausrüstung als drei Zeilen, jede öffnet ihre Auswahl
    const sh = SHIP[this.ship], cs = this.deck ? CONSTELLATIONS.find(c => c.id === this.deck) : null;
    const seedIn = h('input', { type: 'text', placeholder: L('Seed (leer = zufällig)', 'Seed (empty = random)'), class: 'sf-seed' }) as HTMLInputElement;
    const row = (ic: HTMLElement | string, k: string, v: string, sub: string, open: () => void) =>
      h('button', { class: 'sf-loadrow', onclick: open }, typeof ic === 'string' ? h('span', { class: 'ic' }, ic) : ic, h('div', null, h('small', null, k), h('b', null, v), sub ? h('em', null, sub) : ''), h('span', { class: 'chev' }, '›'));
    body.append(h('div', { class: 'sf-sec' }, this.run ? L('Neuer Flug', 'New flight') : L('Flug vorbereiten', 'Prepare flight')),
      h('div', { class: 'sf-loadout' },
        row(h('span', { class: 'ic ship', html: shipHtml(sh.hull, sh.hue) }), L('Schiff', 'Ship'), tx(sh.name), `⛨ ${sh.hp} · ♨ ${sh.heatMax} · ✦ ${sh.gold}`, () => this.pickShip()),
        row(h('span', { class: 'ic', style: { background: cs?.color ?? '#c9a45c' } }, cs?.icon ?? '✦'), L('Startdeck', 'Starter deck'), cs ? tx(cs.name) : L('Schiffs-Standard', 'Ship default'), cs ? tx(cs.idea) : L('Ausgewogene Grundausstattung', 'Balanced basics'), () => this.pickDeck()),
        m.ascMax > 0 ? row('☠', L('Gefahr', 'Danger'), this.asc ? `${L('Stufe', 'Level')} ${this.asc}` : L('Normal', 'Normal'), this.asc ? L(`+${this.asc * 8} % Gegner-Hülle · +${this.asc * 20} % Punkte`, `+${this.asc * 8} % enemy hull · +${this.asc * 20} % score`) : '', () => this.pickDanger()) : '',
        h('button', { class: 'sf-go', onclick: () => warpGo(() => this.start(this.ship, seedIn.value.trim().toUpperCase() || newSeed(), this.asc, { deck: this.deck })) },
          h('b', null, L('Abheben', 'Launch')), h('small', null, `${tx(sh.name)}${cs ? ` · ${tx(cs.name)}` : ''}`)),
        h('details', { class: 'sf-adv' }, h('summary', null, L('Erweitert: eigener Seed', 'Advanced: custom seed')), seedIn)));
    // 3 · Missionen
    const day = todayKey(), wk = weekKey();
    let ws = hashSeed(wk);
    const muts: string[] = [];
    while (muts.length < 2) { const [x, n] = step(ws); ws = n; const id = MUTATORS[Math.floor(x * MUTATORS.length)].id; if (!muts.includes(id)) muts.push(id); }
    body.append(h('div', { class: 'sf-sec' }, L('Missionen', 'Missions')),
      h('div', { class: 'sf-missions' },
        h('button', { class: 'sf-mission day' + (m.daily.runDone ? ' done' : ''), onclick: () => warpGo(() => this.start(this.ship, dailySeed(day), 0, { daily: day, deck: this.deck })) },
          h('span', { class: 'ic' }, '☀'), h('b', null, L('Tagesflug', 'Daily flight')), h('small', null, m.daily.runDone ? L('Heute geflogen ✓', 'Flown today ✓') : L('Gleicher Seed für alle · ×1,5 ✧', 'Same seed for all · ×1.5 ✧'))),
        h('button', { class: 'sf-mission week', onclick: () => warpGo(() => this.start(this.ship, `WEEK-${wk}`, 0, { weekly: wk, mutators: muts, deck: this.deck })) },
          h('span', { class: 'ic' }, '☾'), h('b', null, L('Wochen-Expedition', 'Weekly expedition')),
          h('small', null, muts.map(id => tx(MUTATORS.find(y => y.id === id)!.name)).join(' · ')),
          m.weekly.week === wk ? h('small', { class: 'gold' }, `${L('Bestwert', 'Best')} ${N(m.weekly.best)}`) : '')));
    // 4 · Heute
    body.append(h('div', { class: 'sf-sec' }, L('Heutige Ziele', "Today's goals")),
      h('div', { class: 'sf-goals' }, m.daily.goals.map(g => { const d = GOALS.find(x => x.id === g.id)!; return h('div', { class: 'sf-goal' + (g.done ? ' done' : '') }, h('span', null, g.done ? '✦' : '◇'), h('div', null, h('b', null, tx(d.text)), h('div', { class: 'sf-bar sm' }, h('i', { style: { width: `${Math.min(100, (g.p / d.n) * 100)}%` } }))), h('small', null, `+${d.staub} ✧`)); })),
      h('button', { class: 'sf-link', onclick: () => rules() }, L('Wie spielt man?', 'How to play?')));
  }

  /** Auswahl-Blätter für Schiff, Deck, Gefahr. */
  private pickShip() {
    const close = sheet(L('Schiff wählen', 'Choose ship'), h('div', { class: 'sf-pickl' }, SHIPS.map(s => {
      const ok = shipUnlocked(s.id);
      return h('button', { class: 'sf-pickrow' + (this.ship === s.id ? ' on' : '') + (ok ? '' : ' locked'), onclick: () => { if (!ok) { toast(L('Im Forschungslabor freischalten.', 'Unlock in the research lab.')); return; } this.ship = s.id; close(); this.hub('play'); } },
        h('span', { class: 'ic ship', html: shipHtml(s.hull, s.hue) }), h('div', null, h('b', null, tx(s.name)), h('small', null, ok ? tx(s.text) : L('▣ Im Labor erforschen', '▣ Research in the lab')), ok ? h('em', null, `⛨ ${s.hp} · ♨ ${s.heatMax} · ✦ ${s.gold}`) : ''));
    })));
  }
  private pickDeck() {
    const close = sheet(L('Startdeck wählen', 'Choose starter deck'),
      h('p', { class: 'muted small' }, L('Das Startdeck ersetzt je Walze ein Symbol durch den Kern einer Konstellation – damit startest du gleich auf Stufe I.', 'The starter deck swaps one symbol per reel for the core of a constellation – so you begin at tier I.')),
      h('div', { class: 'sf-pickl' },
        h('button', { class: 'sf-pickrow' + (this.deck === '' ? ' on' : ''), onclick: () => { this.deck = ''; close(); this.hub('play'); } }, h('span', { class: 'ic' }, '✦'), h('div', null, h('b', null, L('Schiffs-Standard', 'Ship default')), h('small', null, L('Ausgewogen, für den Anfang', 'Balanced, good to start')))),
        ...CONSTELLATIONS.map(c => { const ok = packUnlocked(c.unlock); return h('button', { class: 'sf-pickrow' + (this.deck === c.id ? ' on' : '') + (ok ? '' : ' locked'), style: { '--cc': c.color } as any,
          onclick: () => { if (!ok) { toast(L('Im Forschungslabor freischalten.', 'Unlock in the research lab.')); return; } this.deck = c.id; close(); this.hub('play'); } },
          h('span', { class: 'ic', style: { background: c.color } }, ok ? c.icon : '▣'), h('div', null, h('b', null, tx(c.name)), h('small', null, ok ? tx(c.idea) : L('Im Labor erforschen', 'Research in the lab')), ok ? h('em', null, `I: ${tx(c.tiers[0])}`) : '')); })),
      h('button', { class: 'btn block', onclick: () => { close(); showConsts(newRun(this.ship, 'X', 0, { deck: this.deck })); } }, L('Alle Konstellationen im Detail', 'All constellations in detail')));
  }
  private pickDanger() {
    const m = meta();
    const close = sheet(L('Gefahrenstufe', 'Danger level'), h('p', { class: 'muted small' }, L('Höhere Stufen: zähere Gegner, mehr Punkte und Sternenstaub. Jeder Sieg schaltet die nächste frei.', 'Higher levels: tougher enemies, more score and stardust. Every win unlocks the next.')),
      h('div', { class: 'sf-asc' }, ...Array.from({ length: m.ascMax + 1 }, (_, i) => h('button', { class: i === this.asc ? 'on' : '', onclick: () => { this.asc = i; close(); this.hub('play'); } }, String(i)))));
  }

  // ------------------------------------------------------------------------------------------- Archiv
  private hubArch(body: HTMLElement) {
    const m = meta();
    body.append(h('div', { class: 'sf-stats' },
      h('div', null, h('b', null, N(m.runs)), h('small', null, L('Flüge', 'Flights'))), h('div', null, h('b', null, N(m.wins)), h('small', null, L('Siege', 'Wins'))),
      h('div', null, h('b', null, N(m.bestScore)), h('small', null, L('Rekord', 'Best'))), h('div', null, h('b', null, `${m.chapters.length}/${CHAPTERS.length}`), h('small', null, L('Kapitel', 'Chapters')))));
    const sub = h('div');
    const seg = h('div', { class: 'sf-subseg' });
    const show = (k: 'ach' | 'hist') => { seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); sub.innerHTML = ''; k === 'ach' ? this.hubAch(sub) : this.hubHist(sub); };
    seg.append(h('button', { 'data-k': 'ach', onclick: () => show('ach') }, `${L('Erfolge', 'Feats')} ${m.achievements.length}/${ACHIEVEMENTS.length}`), h('button', { 'data-k': 'hist', onclick: () => show('hist') }, L('Verlauf', 'History')));
    body.append(seg, sub);
    show('ach');
    body.append(h('button', { class: 'sf-link', onclick: () => this.credits() }, L('Quellen & Lizenzen (Musik, Bilder)', 'Credits & licenses (music, images)')));
  }
  private credits() {
    sheet(L('Quellen & Lizenzen', 'Credits & licenses'),
      h('p', { class: 'muted small' }, L('Alle Stücke und Bilder sind frei nutzbar (CC0 oder gemeinfrei, zwei NASA/ESA-Bilder CC BY 4.0). Für Sternenfall wurden die Bilder im Jugendstil-Farbton getönt und die Musik in Lautstärke und Klang angeglichen. Grafiken, Symbole, Gegner und Bosse sind eigene, im Code erzeugte Zeichnungen.',
        'All tracks and images are free to use (CC0 or public domain, two NASA/ESA images CC BY 4.0). For Sternenfall the images were tinted in Art Nouveau tones and the music matched in loudness and tone. Graphics, symbols, enemies and bosses are original drawings generated in code.')),
      ...CREDITS.map(g => h('div', { class: 'sf-credits' }, h('b', null, tx(g.group)),
        h('ul', null, g.items.map(c => h('li', null, h('small', null, tx(c.what)), h('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.title), h('span', null, ` · ${c.by} · ${c.license === 'gemeinfrei' ? L('gemeinfrei', 'public domain') : c.license}`)))))));
  }

  private hubLab(body: HTMLElement) {
    const m = meta();
    const goal = nextGoal(), rp = researchProgress();
    if (goal) body.append(h('div', { class: 'sf-unlock' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('small', null, L('Nächstes Ziel', 'Next goal')), h('small', null, goal.label)),
      h('div', { class: 'sf-bar' }, h('i', { style: { width: `${Math.min(100, (m.staub / goal.cost) * 100)}%` } })),
      h('small', { class: 'muted' }, m.staub >= goal.cost ? L('Jetzt verfügbar!', 'Available now!') : L(`Noch ${N(goal.cost - m.staub)} ✧ · Sternenkarte ${rp.done}/${rp.total}`, `${N(goal.cost - m.staub)} ✧ to go · star chart ${rp.done}/${rp.total}`))));
    body.append(h('p', { class: 'sf-note' }, L('Sternenstaub bekommst du nach jedem Flug – auch nach einer Niederlage. Was du hier erforschst, bleibt für immer.', 'You earn stardust after every flight – even a lost one. What you research here stays forever.')));
    const groups: [string, string][] = [['ship', L('Schiffe', 'Ships')], ['sector', L('Sektoren', 'Sectors')], ['pack', L('Symbolpakete', 'Symbol packs')], ['deck', L('Startdecks', 'Starter decks')], ['talent', L('Talente', 'Talents')]];
    for (const [type, title] of groups) {
      body.append(h('div', { class: 'sf-sec' }, title));
      for (const n of RESEARCH.filter(x => x.type === type)) {
        const lv = level(n.id), max = lv >= n.max, cost = n.cost(lv), open = canResearch(n.id) || max;
        body.append(h('div', { class: 'sf-research' + (max ? ' done' : '') + (open ? '' : ' locked') },
          h('div', { class: 'ic' }, n.icon),
          h('div', { class: 'tx' }, h('b', null, `${tx(n.name)}${n.max > 1 ? ` ${'◆'.repeat(lv)}${'◇'.repeat(n.max - lv)}` : ''}`), h('small', null, open ? tx(n.text) : L('Benötigt vorherige Forschung', 'Requires previous research'))),
          h('button', { class: 'sf-buy', disabled: max || !open || m.staub < cost, onclick: () => { if (research(n.id)) { snd.win(); this.banner(`${n.icon} ${tx(n.name)}`, L('erforscht!', 'researched!')); this.hub('lab'); } } }, max ? '✓' : `${N(cost)} ✧`)));
      }
    }
  }

  private hubLog(body: HTMLElement) {
    const m = meta();
    body.append(h('div', { class: 'sf-sec' }, L('Geschichte', 'Story')));
    const journal = h('div', { class: 'sf-journal' });
    for (const c of CHAPTERS) {
      const ok = m.chapters.includes(c.id);
      journal.append(h('button', { class: 'sf-chapter' + (ok ? '' : ' locked') + (m.unread.includes(c.id) ? ' new' : ''), disabled: !ok, onclick: async () => { m.unread = m.unread.filter(x => x !== c.id); saveMeta(); await playChapter(c.id); this.hub('log'); } },
        ok ? portrait(c.lines[0].who) : h('div', { class: 'sf-portrait q' }, '?'), h('div', null, h('b', null, ok ? tx(c.title) : '· · ·'), h('small', null, ok ? `${tx(CAST[c.lines[0].who].name)} …` : L('Noch nicht erlebt', 'Not yet experienced')))));
    }
    body.append(journal);
    const foes = ENEMIES.filter(e => e.tier !== 'minion');
    const syms = SYMBOLS.filter(s => !s.noOffer);
    const pct = Math.round(((m.codex.foes.length + m.codex.syms.length) / (foes.length + syms.length)) * 100);
    if (pct >= 50) unlock('codex50');
    body.append(h('div', { class: 'sf-sec' }, `${L('Kodex', 'Codex')} · ${pct} %`), h('div', { class: 'sf-codex' }, foes.map(e => {
      const ok = m.codex.foes.includes(e.id);
      const el = h('div', { class: 'sf-cx' + (ok ? '' : ' unk') + (e.tier === 'boss' || e.tier === 'final' ? ' boss' : '') }, h('div', { html: ok ? enemyHtml(e.look) : '' }), h('small', null, ok ? tx(e.name) : '???'));
      if (ok) el.addEventListener('click', () => sheet(tx(e.name), h('div', { class: 'sf-foebig', html: enemyHtml(e.look) }), h('p', { class: 'small' }, e.passive ? tx(e.passive) : ''), h('p', { class: 'muted small' }, `${L('Hülle', 'Hull')} ${e.hp[0]}–${e.hp[1]}`)));
      return el;
    })), h('div', { class: 'sf-codex syms' }, syms.map(s => {
      const ok = m.codex.syms.includes(s.id);
      const el = h('div', { class: 'sf-cx' + (ok ? '' : ' unk') }, h('div', { html: ok ? symbolHtml(s.art, s.c1, s.c2) : '' }), h('small', null, ok ? tx(s.name) : '???'));
      if (ok) el.addEventListener('click', () => cardPreview(s.id));
      return el;
    })));
  }

  private hubAch(body: HTMLElement) {
    const m = meta();
    body.append(h('div', { class: 'sf-sec' }, `${m.achievements.length} / ${ACHIEVEMENTS.length}`), h('div', { class: 'sf-achs' }, ACHIEVEMENTS.map(a =>
      h('div', { class: 'sf-ach' + (m.achievements.includes(a.id) ? ' on' : '') }, h('div', { class: 'ic' }, a.icon), h('b', null, tx(a.name)), h('small', null, tx(a.text)), h('i', null, `+${a.staub} ✧`)))));
  }

  private hubHist(body: HTMLElement) {
    const m = meta();
    if (!m.history.length) { body.append(h('p', { class: 'sf-note' }, L('Noch keine Flüge.', 'No flights yet.'))); return; }
    body.append(h('div', { class: 'sf-hist' }, m.history.map(r => h('div', { class: 'sf-hrow' + (r.won ? ' won' : '') },
      h('span', null, r.won ? '✦' : '✝'),
      h('div', null, h('b', null, `${tx(SHIP[r.ship]?.name ?? ['?', '?'])} · ${L('Akt', 'Act')} ${r.act}/${r.floor}${r.weekly ? ' ☾' : ''}`),
        h('small', null, `${new Date(r.date).toLocaleDateString()} · ${r.seed}${r.killedBy ? ` · ${r.killedBy}` : ''} · Jackpots ${r.jackpots}`)),
      h('div', { class: 'v' }, h('b', null, N(r.score)), h('small', null, `+${r.staub} ✧`))))));
  }

  // =========================================================================================== Start, Karte
  start(ship: string, seed: string, asc: number, o: { daily?: string; weekly?: string; mutators?: string[]; deck?: string } = {}) {
    this.run = newRun(ship, seed, asc, o);
    this.ship = ship;
    for (const r of this.run.reels) for (const s of r) discover('syms', s.id);
    this.save();
    snd.open();
    void this.actIntro();
  }

  /** Sektor-Titelkarte, dann Story-Kapitel (erster Besuch), dann Karte. */
  private async actIntro() {
    const run = this.run!;
    const sec = SECTOR[sectorOf(run)];
    const card = h('div', { class: 'sf-actcard', style: { '--bg1': sec.bg[0], '--bg2': sec.bg[1] } as any },
      h('small', null, `${L('Akt', 'Act')} ${run.act} / ${lastAct(run)}`), h('b', null, tx(sec.name)), h('div', { html: ornament(220) }), h('p', null, tx(sec.text)));
    this.host.append(card);
    snd.open();
    await new Promise(r => setTimeout(r, 2300));
    card.classList.add('out'); setTimeout(() => card.remove(), 600);
    const m = meta();
    if (!m.visited.includes(sec.id)) { m.visited.push(sec.id); saveMeta(); }
    story(`visit:${sec.id}`); story(`act:${run.act}`);
    await this.flushStory();
    this.map(true);
  }

  map(intro = false) {
    const run = this.run!;
    const sec = SECTOR[sectorOf(run)];
    // Motive des Decks und der Sektor-Gegner im Hintergrund in Pixelbilder umrechnen (flüssige Kämpfe)
    const foeIds = [...new Set([...sec.easy, ...sec.hard, ...sec.elite].flat().concat(sec.bosses))];
    prewarmArt([...new Set(run.reels.flat().map(x => x.id))].map(id => SYM[id]), foeIds.map(id => ENEMY[id]?.look).filter(Boolean));
    this.clear('map', sec.bg, sec.theme);
    const reach = new Set(reachable(run));
    const rows = Math.max(...run.map.map(n => n.row)) + 1;
    const W = 360, rowH = 76, H = rows * rowH + 40;
    const x = (n: MapNode) => 40 + (n.col / (COLS - 1)) * (W - 80);
    const y = (n: MapNode) => H - 40 - n.row * rowH;
    const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="sf-lines-map">${run.map.flatMap(n => n.next.map(k => {
      const m = run.map[k]; const on = n.done && run.at === n.id && reach.has(k);
      const mx = (x(n) + x(m)) / 2 + (n.col - m.col) * 8;
      return `<path d="M${x(n)} ${y(n)} Q${mx} ${(y(n) + y(m)) / 2} ${x(m)} ${y(m)}" class="${on ? 'on' : n.done && m.done ? 'walked' : ''}"/>`;
    })).join('')}</svg>`;
    const mapEl = h('div', { class: 'sf-map', style: { height: `${H}px` }, html: svg });
    // Schiff auf der Karte: sitzt am aktuellen Knoten (oder unten) und fliegt zum gewählten Ziel
    const here = run.at >= 0 ? run.map[run.at] : null;
    const pos = (n: MapNode | null) => n ? [(x(n) / W) * 100, y(n)] as const : [50, H - 4] as const;
    const sh = SHIP[run.ship];
    const ship = h('div', { class: 'sf-mapship', html: shipHtml(sh.hull, sh.hue) });
    { const [px, py] = pos(here); ship.style.left = `${px}%`; ship.style.top = `${py}px`; }
    const fly = (n: MapNode) => {
      mapEl.dataset.flying = '1';
      const [px, py] = pos(n), [ox, oy] = pos(here);
      ship.style.setProperty('--rot', `${Math.atan2(py - oy, ((px - ox) / 100) * mapEl.clientWidth) * 180 / Math.PI}deg`);
      ship.classList.add('flying');
      requestAnimationFrame(() => { ship.style.left = `${px}%`; ship.style.top = `${py}px`; });
      const trail = setInterval(() => { const r = ship.getBoundingClientRect(), hr = this.host.getBoundingClientRect(); this.particles.burst(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, 3, 0x6fe3e0, 40); }, 45);
      setTimeout(() => { clearInterval(trail); this.enter(n); }, document.documentElement.dataset.motion === 'reduced' ? 0 : 780);
    };
    for (const n of run.map) {
      const b = h('button', { class: `sf-node k-${n.kind}${n.done ? ' done' : ''}${reach.has(n.id) ? ' reach' : ''}${run.at === n.id ? ' here' : ''}`, style: { left: `${(x(n) / W) * 100}%`, top: `${y(n)}px` } }, NODE_ICON[n.kind]);
      b.addEventListener('click', () => { if (!reach.has(n.id)) { toast(NODE_NAME(n.kind)); return; } if (mapEl.dataset.flying) return; snd.card(); fly(n); });
      mapEl.append(b);
    }
    mapEl.append(ship);
    const legend = h('div', { class: 'sf-legend' }, ['fight', 'elite', 'event', 'shop', 'casino', 'rest', 'chest', 'boss'].map(k => h('span', null, h('b', null, NODE_ICON[k]), NODE_NAME(k))));
    this.view.append(this.top(),
      h('div', { class: 'sf-maphead' }, h('small', null, `${L('Akt', 'Act')} ${run.act} / ${lastAct(run)}`), h('h2', null, tx(sec.name)), h('div', { html: ornament(200) })),
      h('div', { class: 'sf-mapwrap' }, mapEl), legend);
    requestAnimationFrame(() => (this.view.querySelector('.sf-node.reach') as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: intro ? 'auto' : 'smooth' }));
  }

  private runMenu() {
    const run = this.run!;
    const close = sheet(L('Logbuch des Flugs', 'Flight log'),
      h('p', { class: 'muted small' }, `Seed ${run.seed} · ${L('Gefahr', 'Danger')} ${run.ascension}${run.mutators.length ? ' · ' + run.mutators.map(id => tx(MUTATORS.find(x => x.id === id)!.name)).join(', ') : ''}`),
      h('div', { class: 'stack', style: { gap: '10px' } },
        h('button', { class: 'btn block', onclick: () => { close(); rules(); } }, L('Spielregeln', 'Rules')),
        h('button', { class: 'btn block', onclick: () => { close(); showSettings(); } }, L('Einstellungen', 'Settings')),
        h('button', { class: 'btn block', onclick: () => { close(); this.save(); this.hub(); } }, L('Pause: zur Brücke (gespeichert)', 'Pause: to the bridge (saved)')),
        h('button', { class: 'btn block stop', onclick: () => { close(); void this.result(false, L('aufgegeben', 'abandoned')); } }, L('Flug abbrechen', 'Abandon flight'))));
  }

  resume() {
    const run = this.run!;
    if (run.port) { this.port(); return; }
    const cur = run.at >= 0 ? run.map[run.at] : null;
    if (cur && !cur.done) this.enter(cur, false); else this.map();
  }

  private enter(n: MapNode, advance = true) {
    const run = this.run!;
    run.at = n.id;
    if (advance) { run.floor++; run.stats.floors++; }
    this.save();
    switch (n.kind) {
      case 'fight': case 'elite': case 'boss': void this.fight(n.kind); break;
      case 'event': this.event(); break;
      case 'shop': this.shop(); break;
      case 'casino': this.casino(); break;
      case 'rest': this.rest(); break;
      case 'chest': this.chest(); break;
    }
  }
  private done() {
    const run = this.run!;
    if (run.port) { if (run.port.cur) { run.port.used.push(run.port.cur); run.port.cur = undefined; } this.save(); this.port(); return; }
    if (run.at >= 0) run.map[run.at].done = true; this.save(); this.map();
  }

  // =========================================================================================== Kampf
  private async fight(kind: 'fight' | 'elite' | 'boss') {
    const run = this.run!;
    const sec = SECTOR[sectorOf(run)];
    const r = rngOf(run);
    const row = !run.port && run.at >= 0 ? run.map[run.at].row : 9;
    const easy = run.act === 1 ? row <= 3 : row <= 1;
    const ids = kind === 'boss' ? [pick(r, sec.bosses)] : kind === 'elite' ? pick(r, sec.elite) : pick(r, easy ? sec.easy : sec.hard);
    // Musik nach Bedrohung: kleine Gegner leise-spannend, je stärker desto wuchtiger
    const threat = kind === 'boss' ? (ids[0] === 'architekt' ? 5 : 4) : kind === 'elite' ? 3 : Math.min(2, Math.floor((sec.tier - 1) / 2) + (easy ? 0 : 1) + (ids.length >= 3 ? 1 : 0));
    bgm((['fight3', 'fight', 'fight2', 'elite', 'boss', 'final'] as const)[threat]);
    bgmIntensity([0.35, 0.55, 0.75, 0.9, 1, 1][threat]);
    this.clear('fight');
    this.sky.set(sec.theme, kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'fight', sec.bg);
    const res = await runFight(this.view, run, ids, kind, this.particles, sec.bg, () => { this.save(); this.hub(); });
    if (!this.view.isConnected) return;
    if (!res.won) { void this.result(false, res.killedBy); return; }
    for (const id of run.modules) MOD[id]?.onCombatEnd?.(runCtx(run), true);
    if (kind === 'elite') { run.stats.elites++; track('elites', 1); }
    if (kind === 'boss') {
      run.stats.bosses++; track('bosses', 1);
      const m = meta(); if (!m.bossKills.includes(ids[0])) { m.bossKills.push(ids[0]); saveMeta(); }
      unlock(`boss${Math.min(3, Math.ceil(sec.tier / 2))}`);
      if (sec.tier === 6) unlock('final');
      if (run.ship !== 'kreuzer') unlock(`ship-${run.ship}`);
      story(`boss:${sec.id}`); if (sec.tier === 6) story('final');
    }
    this.save();
    this.reward(kind);
  }

  // =========================================================================================== Beute
  private reward(kind: 'fight' | 'elite' | 'boss') {
    const run = this.run!;
    this.clear('reward', this.sectorBg());
    const r = rngOf(run);
    const gold = goldFor(kind, r) + (run.mods.bounty ? 50 : 0);
    if (run.mods.bounty) run.mods.bounty = 0;
    let goldTaken = false, symTaken = false;
    let offer = symbolOffer(run, 3, kind === 'boss' ? 60 : kind === 'elite' ? 15 : 0);
    const mods = kind === 'elite' ? moduleOffer(run, 1) : kind === 'boss' && run.act < lastAct(run) ? moduleOffer(run, 3, undefined, 25) : [];
    const box = h('div', { class: 'sf-panel' });
    this.view.append(this.top(),
      h('h2', { class: 'sf-title' }, kind === 'boss' ? L('Der Boss ist gefallen', 'The boss has fallen') : kind === 'elite' ? L('Elite besiegt', 'Elite defeated') : L('Sieg', 'Victory')), h('div', { class: 'sf-orn', html: ornament(220) }), box);
    const render = () => {
      this.refreshTop();
      box.innerHTML = '';
      if (!goldTaken) {
        const ge = h('b', { class: 'sf-goldnum' }, '0'); countUp(ge, gold, 600);
        box.append(h('div', { class: 'sf-goldrow' }, h('div', null, h('small', null, L('Sternentaler', 'Star coins')), h('div', null, ge, ' ', h('i', { class: 'sfc' }))),
          h('button', { class: 'sf-btn', onclick: () => { goldTaken = true; runCtx(run).gainGold(gold); snd.coin(); render(); } }, L('Nehmen', 'Take')),
          h('button', { class: 'sf-btn risk', onclick: () => this.doubleOrNothing(gold, won => { goldTaken = true; if (won) runCtx(run).gainGold(gold * 2); render(); }) }, L('Doppelt oder nichts', 'Double or nothing'))));
      }
      if (mods.length) {
        box.append(h('div', { class: 'sf-sec' }, mods.length > 1 ? L('Wähle ein Modul', 'Choose a module') : L('Modul geborgen', 'Module salvaged')));
        for (const id of mods) {
          const md = MOD[id];
          const el = h('button', { class: 'sf-modopt' + (md.cursed ? ' cursed' : '') }, h('span', { class: 'ic' }, md.icon), h('div', null, h('b', null, tx(md.name)), h('small', null, tx(md.text))));
          el.addEventListener('click', () => { addModule(run, id); discover('mods', id); mods.length = 0; snd.win(); this.save(); render(); });
          box.append(el);
        }
      }
      if (!symTaken) {
        const cost = rerollCost(run);
        box.append(h('div', { class: 'sf-sec' }, L('Neues Symbol', 'New symbol')));
        const row = h('div', { class: 'sf-pick' });
        offer.forEach((id, i) => {
          const el = cardEl(id, 1, { run }); el.classList.add('reveal'); el.style.setProperty('--i', String(i));
          el.addEventListener('click', async () => {
            if (el.dataset.lp) { delete el.dataset.lp; return; }
            const reel = await chooseReel(run, id);
            if (reel == null) return;
            runCtx(run).addSymbol(id, reel); discover('syms', id); symTaken = true; snd.card(); this.save(); render();
          });
          longPress(el, () => cardPreview(id));
          row.append(el);
        });
        box.append(row, h('div', { class: 'row' },
          h('button', { class: 'sf-btn', disabled: run.gold < cost, onclick: () => { if (payReroll(run)) { offer = symbolOffer(run, 3, kind === 'boss' ? 60 : kind === 'elite' ? 15 : 0); snd.reel(); render(); } } }, `↻ ${cost ? `${cost} ✦` : L('gratis', 'free')}`),
          h('button', { class: 'sf-btn ghost', onclick: () => { symTaken = true; render(); } }, L('Überspringen', 'Skip'))));
      }
      if (goldTaken && symTaken && !mods.length) box.append(h('button', { class: 'sf-go', onclick: () => void this.afterReward(kind) },
        h('b', null, kind === 'boss' ? (run.act >= lastAct(run) ? L('Zum Ende der Reise', 'To the journey’s end') : PORT_AFTER.includes(run.act) ? L('Kurs auf den Hafen', 'Set course for port') : L('Sprung in den nächsten Sektor', 'Jump to the next sector')) : run.port ? L('Zurück in den Hafen', 'Back to port') : L('Weiterfliegen', 'Fly on'))));
    };
    render();
  }
  private async afterReward(kind: string) {
    const run = this.run!;
    if (kind === 'boss') {
      if (run.act >= lastAct(run)) { void this.result(true); return; }
      if (PORT_AFTER.includes(run.act) && !run.port) {
        run.port = { n: PORT_AFTER.indexOf(run.act) + 1, used: [] };
        story(`port:${run.port.n}`); this.save();
        await this.flushStory();
        this.port(true);
        return;
      }
      enterAct(run, run.act + 1);
      if (run.act === 2 && run.reels.flat().length <= 13) unlock('lean');
      this.save();
      await this.flushStory();
      void this.actIntro();
      return;
    }
    await this.flushStory();
    this.done();
  }

  private doubleOrNothing(stake: number, cb: (won: boolean) => void) {
    const run = this.run!;
    const p = Math.min(0.62, 0.5 + run.luck + (run.pityCasino >= 3 ? 0.08 : 0));
    const won = rngOf(run)() < p;
    const coin = h('div', { class: 'sf-coin' }, h('div', { class: 'f' }, '✦'), h('div', { class: 'b' }, '☾'));
    const msg = h('div', { class: 'sf-omsg' }, L(`Einsatz ${stake} – Chance ${Math.round(p * 100)} %`, `Stake ${stake} – chance ${Math.round(p * 100)} %`));
    const wrap = h('div', { class: 'sf-overlay' }, coin, msg);
    this.host.append(wrap);
    coin.style.setProperty('--end', won ? '0deg' : '180deg'); coin.classList.add('flip');
    let k = 0; const tick = setInterval(() => { snd.reel(); if (++k > 12) clearInterval(tick); }, 110);
    setTimeout(() => {
      msg.textContent = won ? L(`GEWONNEN! +${stake * 2} ✦`, `WON! +${stake * 2} ✦`) : L('Nichts …', 'Nothing …');
      wrap.classList.add(won ? 'won' : 'lost');
      if (won) { snd.win(); flash(this.host, 'rgba(232,192,112,.45)'); this.particles.burst(innerWidth / 2, innerHeight / 2, 60, 0xe8c070, 320); run.pityCasino = 0; track('casinoWon', stake); } else { snd.lose(); shake(this.host, 1.5); run.pityCasino++; }
      setTimeout(() => { wrap.remove(); cb(won); this.save(); }, 1300);
    }, 1700);
  }

  // =========================================================================================== Begegnungen
  private event() {
    const run = this.run!;
    const sec = SECTOR[sectorOf(run)];
    const act = [0, 1, 1, 2, 2, 3, 3][sec.tier];
    const pool = run.port ? EVENTS.filter(e => e.port) : EVENTS.filter(e => !e.port && (e.sector ? e.sector === sec.id : e.act === 0 || e.act === act));
    // Sektor-eigene Begegnungen doppelt gewichtet
    this.renderEvent(weighted(rngOf(run), pool.map(e => [e, e.sector ? 3 : 1] as [EventDef, number])));
  }
  private castIn(ev: EventDef) {
    const t = (ev.title[0] + ' ' + ev.text[0]).toLowerCase();
    return Object.keys(CAST).find(k => k !== 'ilya' && k !== 'herz' && t.includes(CAST[k].name[0].split(/[ -]/)[0].toLowerCase()));
  }
  private renderEvent(ev: EventDef) {
    const run = this.run!;
    this.clear('event', this.sectorBg());
    const box = h('div', { class: 'sf-panel' });
    const who = this.castIn(ev);
    this.view.append(this.top(),
      h('div', { class: 'sf-evhead' }, who ? portrait(who) : h('div', { class: 'ic' }, ev.icon), h('h2', null, tx(ev.title)), h('div', { html: ornament(200) })), h('p', { class: 'sf-evtext' }, tx(ev.text)), box);
    for (const o of ev.options) box.append(this.eventOption(o));
  }
  private eventOption(o: EventOption) {
    const run = this.run!;
    const can = (!o.need?.gold || run.gold >= o.need.gold) && (!o.need?.hp || run.hp > o.need.hp);
    if (!o.check) return h('button', { class: 'sf-opt', disabled: !can, onclick: () => void this.resolveEvent(o.win, o.winText) }, h('b', null, tx(o.label)), h('small', null, outcomeText(o.win)));
    const ck = o.check;
    let raised = 0;
    const base = ck.chance + 0.02 * level('t-glueck') + Math.min(0.15, (run.mods.checkPity ?? 0) * 0.05);
    const chanceEl = h('b', { class: 'sf-chance' }), costEl = h('small');
    const upd = () => { const ch = Math.min(0.95, base + raised * (ck.raise?.add ?? 0)); chanceEl.textContent = `${Math.round(ch * 100)} %`; chanceEl.style.setProperty('--p', String(ch)); costEl.textContent = ck.raise && raised ? L(`Einsatz: ${raised * ck.raise.per} ${ck.raise.cost === 'gold' ? '✦' : '⛨'}`, `Stake: ${raised * ck.raise.per} ${ck.raise.cost === 'gold' ? '✦' : '⛨'}`) : ''; return ch; };
    const raiseRow = ck.raise ? h('div', { class: 'sf-raise' },
      h('button', { onclick: (e: Event) => { e.stopPropagation(); if (raised > 0) { raised--; upd(); snd.card(); } } }, '−'), h('span', null, L('Einsatz erhöhen', 'Raise stake')),
      h('button', { onclick: (e: Event) => { e.stopPropagation(); const next = (raised + 1) * ck.raise!.per; const ok = ck.raise!.cost === 'gold' ? run.gold >= next : run.hp > next; if (raised < ck.raise!.max && ok) { raised++; upd(); snd.coin(); } else snd.miss(); } }, '+')) : '';
    const el = h('div', { class: 'sf-opt check' + (can ? '' : ' off') },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('b', null, tx(o.label)), chanceEl),
      h('small', null, `✓ ${outcomeText(o.win)}   ✗ ${outcomeText(o.lose ?? [])}`), raiseRow, costEl,
      h('button', { class: 'sf-btn risk', disabled: !can, onclick: () => {
        const ch = upd();
        if (ck.raise && raised) { const cst = raised * ck.raise.per; if (ck.raise.cost === 'gold') run.gold -= cst; else run.hp = Math.max(1, run.hp - cst); }
        this.rollCheck(ch, won => { if (won) { run.mods.checkPity = 0; track('checks', 1); } else run.mods.checkPity = (run.mods.checkPity ?? 0) + 1; void this.resolveEvent(won ? o.win : o.lose ?? [], won ? o.winText : o.loseText, won); });
      } }, L('Wagen!', 'Dare!')));
    upd();
    return el;
  }
  private rollCheck(chance: number, cb: (won: boolean) => void) {
    const run = this.run!;
    const need = Math.round(chance * 100), roll = 1 + Math.floor(rngOf(run)() * 100), won = roll <= need;
    const dial = h('div', { class: 'sf-dial', style: { '--p': String(chance) } as any }, h('b', null, '··'), h('small', null, L(`benötigt ≤ ${need}`, `need ≤ ${need}`)));
    const wrap = h('div', { class: 'sf-overlay' }, dial);
    this.host.append(wrap);
    const num = dial.querySelector('b')!;
    let t = 0;
    const spin = () => {
      t++; num.textContent = String(t < 22 ? 1 + Math.floor(Math.random() * 100) : roll); snd.reel();
      if (t < 22) setTimeout(spin, 40 + t * t * 0.6);
      else { wrap.classList.add(won ? 'won' : 'lost'); if (won) { snd.win(); this.particles.burst(innerWidth / 2, innerHeight / 2, 50, 0x9fd0a0, 300); } else { snd.lose(); shake(this.host, 1.5); if (roll - need <= 5) num.textContent = `${roll} · ${L('knapp!', 'close!')}`; } setTimeout(() => { wrap.remove(); cb(won); }, 1300); }
    };
    spin();
  }
  private async resolveEvent(list: EventOption['win'], text?: [string, string], won = true) {
    const run = this.run!;
    const res = applyOutcomes(run, list);
    this.save();
    if (res.fight) { await this.fight(res.fight === 'elite' ? 'elite' : 'fight'); return; }
    if (res.remove) await this.removeSym(true);
    if (res.upgrade) await this.upgradeSym(true);
    this.clear('event', this.sectorBg());
    const box = h('div', { class: 'sf-panel' });
    this.view.append(this.top(),
      h('h2', { class: 'sf-title ' + (won ? 'good' : 'bad') }, text ? tx(text) : L('Weiter geht die Reise.', 'The journey goes on.')),
      h('div', { class: 'sf-result-lines' + (won ? '' : ' bad') }, res.lines.map(l => h('span', null, l))), box);
    if (res.pickSymbol) {
      box.append(h('div', { class: 'sf-sec' }, L('Wähle ein Symbol', 'Choose a symbol')));
      const row = h('div', { class: 'sf-pick' });
      for (const id of res.pickSymbol) {
        const el = cardEl(id, 1, { run }); el.classList.add('reveal');
        el.addEventListener('click', async () => { const reel = await chooseReel(run, id); if (reel == null) return; runCtx(run).addSymbol(id, reel); discover('syms', id); this.save(); row.remove(); snd.card(); });
        row.append(el);
      }
      box.append(row);
    }
    box.append(h('button', { class: 'sf-go', onclick: () => { void this.flushStory().then(() => this.done()); } }, h('b', null, L('Weiterfliegen', 'Fly on'))));
  }
  private async upgradeSym(free = false) {
    const run = this.run!;
    const s = await pickSymbol(run, L('Symbol aufwerten', 'Upgrade a symbol'), free ? L('Kostenlos: wähle ein Symbol (max. Stufe III).', 'Free: choose a symbol (max level III).') : L('Brakk wertet ein Symbol um eine Stufe auf (max. III).', 'Brakk upgrades a symbol by one level (max III).'), x => x.lv < 3 && SYM[x.id].tag !== 'fluch' && (free || run.gold >= upgradeCost(run, x.lv)));
    if (!s) return false;
    if (!free) run.gold -= upgradeCost(run, s.lv);
    s.lv++; snd.win(); this.save();
    return true;
  }
  private async removeSym(free = false) {
    const run = this.run!;
    const s = await pickSymbol(run, L('Symbol entfernen', 'Remove a symbol'), L('Das Symbol verlässt deinen Reaktor für immer (jede Walze behält mindestens 3).', 'The symbol leaves your reactor for good (each reel keeps at least 3).'), () => true);
    if (!s) return false;
    if (!removeSymbol(run, s.uid)) { toast(L('Diese Walze ist schon minimal.', 'This reel is already minimal.')); return false; }
    if (!free) { run.gold -= removeCost(run); run.removes++; }
    snd.open(); this.save();
    return true;
  }

  // =========================================================================================== Ozzos Basar
  private shop(big = false) {
    const run = this.run!;
    const r = rngOf(run);
    const disc = big ? 0.85 : 1, nW = big ? 9 : 6;
    let wares = symbolOffer(run, nW, big ? 25 : 10).map(id => ({ id, price: Math.round(symbolPrice(run, SYM[id].rarity, r) * disc), sold: false }));
    const mods = [...moduleOffer(run, big ? 3 : 2), ...moduleOffer(run, 1, 'cursed')].map(id => ({ id, price: Math.round(modulePrice(run, MOD[id].rarity, r) * (MOD[id].cursed ? 0.6 : 1) * disc), sold: false }));
    let removed = false;
    const greet = pick(r, [L('Hrrm. Alles echt, alles fair. Fast alles.', 'Hrrm. All genuine, all fair. Almost all.'), L('Für dich, Kurierin, ein Sonderpreis. Ein sehr besonderer.', 'For you, courier, a special price. A very special one.'), L('Kauf zwei, bezahl drei. Hrrm? Nein, so war das nicht …', 'Buy two, pay for three. Hrrm? No, that’s not right …')]);
    const render = () => {
      this.refreshTop();
      this.clear('shop', this.sectorBg());
      const box = h('div', { class: 'sf-panel' });
      this.view.append(this.top(),
        h('div', { class: 'sf-npc' }, portrait('ozzo'), h('div', null, h('b', null, tx(CAST.ozzo.name)), h('p', null, `„${greet}“`))), box);
      const grid = h('div', { class: 'sf-shopgrid' });
      for (const w of wares) {
        const el = h('div', { class: 'sf-ware' + (w.sold ? ' sold' : '') }, cardEl(w.id, 1, { run }), h('div', { class: 'price' + (run.gold < w.price ? ' no' : '') }, w.sold ? L('verkauft', 'sold') : [`${w.price} `, h('i', { class: 'sfc' })]));
        el.addEventListener('click', async () => { if (el.dataset.lp) { delete el.dataset.lp; return; } if (w.sold || run.gold < w.price) { snd.miss(); return; } const reel = await chooseReel(run, w.id); if (reel == null) return; run.gold -= w.price; runCtx(run).addSymbol(w.id, reel); discover('syms', w.id); w.sold = true; snd.coin(); this.save(); render(); });
        longPress(el, () => cardPreview(w.id));
        grid.append(el);
      }
      box.append(h('div', { class: 'sf-sec' }, L('Symbole', 'Symbols')), grid,
        h('button', { class: 'sf-btn', disabled: run.gold < rerollCost(run), onclick: () => { if (payReroll(run)) { wares = symbolOffer(run, nW, big ? 25 : 10).map(id => ({ id, price: Math.round(symbolPrice(run, SYM[id].rarity, r) * disc), sold: false })); snd.reel(); render(); } } }, `↻ ${L('Neue Ware', 'Restock')} · ${rerollCost(run) || L('gratis', 'free')}${rerollCost(run) ? ' ✦' : ''}`),
        h('div', { class: 'sf-sec' }, L('Module', 'Modules')));
      for (const x of mods) {
        const md = MOD[x.id];
        box.append(h('button', { class: 'sf-modopt row' + (md.cursed ? ' cursed' : '') + (x.sold ? ' sold' : ''), disabled: x.sold || run.gold < x.price, onclick: () => { run.gold -= x.price; addModule(run, x.id); discover('mods', x.id); x.sold = true; snd.coin(); this.save(); render(); } },
          h('span', { class: 'ic' }, md.icon), h('div', null, h('b', null, tx(md.name)), h('small', null, tx(md.text))), h('span', { class: 'price' }, x.sold ? '✓' : `${x.price} ✦`)));
      }
      const rc = removeCost(run);
      box.append(h('div', { class: 'sf-sec' }, L('Dienste', 'Services')),
        h('button', { class: 'sf-opt', disabled: removed || run.gold < rc, onclick: async () => { if (await this.removeSym()) { removed = true; render(); } } }, h('b', null, L('Symbol ausbauen', 'Remove a symbol')), h('small', null, `${rc} ✦`)),
        h('button', { class: 'sf-go', onclick: () => this.done() }, h('b', null, L('Weiterfliegen', 'Fly on'))));
    };
    render();
  }

  // =========================================================================================== Casino „Ewiger Orbit“
  private casino() {
    const run = this.run!;
    let spins = 0;
    let last = ['✦', '☾', '♛'];
    const render = () => {
      this.refreshTop();
      this.clear('casino', ['#2a0e2a', '#0a040c'], 'nebel');
      const box = h('div', { class: 'sf-panel' });
      this.view.append(this.top(),
        h('div', { class: 'sf-npc' }, portrait('sola'), h('div', null, h('b', null, tx(CAST.sola.name)), h('p', null, L('„Nur Sternentaler, Schätzchen – kein echtes Geld. Das Haus gewinnt meistens … aber nicht immer.“', '“Star coins only, darling – never real money. The house usually wins … but not always.”')))), box);
      const reels = [0, 1, 2].map(i => h('div', { class: 'sf-creel' }, h('div', { class: 'strip' }, h('div', null, last[i]))));
      box.append(h('div', { class: 'sf-sec' }, L('Der Orbit-Automat', 'The Orbit Machine')),
        h('div', { class: 'sf-slot' }, h('div', { class: 'sf-creels' }, reels), h('div', { class: 'sf-paytable' },
          h('span', null, '✦✦✦ JACKPOT ×30'), h('span', null, '☾☾☾ ×15'), h('span', null, '♛♛♛ ×10'), h('span', null, L('Drei gleiche ×5', 'Three alike ×5')), h('span', null, L('Paar ×1,5', 'Pair ×1.5')))),
        h('div', { class: 'row' }, [10, 25, 50].map(b => h('button', { class: 'sf-btn', disabled: run.gold < b || spins >= 8, onclick: () => this.spin(reels, b, () => { spins++; last = reels.map(rl => rl.querySelector('.strip')!.lastElementChild?.textContent ?? '✦'); render(); }) }, `${b} ✦`))),
        spins >= 8 ? h('small', { class: 'muted' }, L('Sola-Nn: „Genug für heute, Schätzchen.“', 'Sola-Nn: “Enough for today, darling.”')) : '',
        h('div', { class: 'sf-sec' }, L('Kometenwürfel', 'Comet dice')),
        h('div', { class: 'row' },
          h('button', { class: 'sf-btn', disabled: run.gold < 20, onclick: () => this.dice('under', 20, render) }, L('Unter 7 · ×2', 'Under 7 · ×2')),
          h('button', { class: 'sf-btn risk', disabled: run.gold < 20, onclick: () => this.dice('seven', 20, render) }, L('Genau 7 · ×5', 'Exactly 7 · ×5')),
          h('button', { class: 'sf-btn', disabled: run.gold < 20, onclick: () => this.dice('over', 20, render) }, L('Über 7 · ×2', 'Over 7 · ×2'))),
        h('small', { class: 'muted' }, L('Einsatz 20 ✦ · Chancen: unter 7 = 42 %, genau 7 = 17 %, über 7 = 42 %', 'Stake 20 ✦ · odds: under 7 = 42 %, exactly 7 = 17 %, over 7 = 42 %')),
        h('div', { class: 'sf-sec' }, L('Hüllenwette', 'Hull bet')),
        h('button', { class: 'sf-opt', disabled: run.hp <= 10, onclick: () => {
          run.hp -= 8;
          if (rngOf(run)() < 0.55) { runCtx(run).gainGold(45); toast(L('+45 ✦ für 8 Hülle', '+45 ✦ for 8 hull')); snd.coin(); }
          else { const id = moduleOffer(run, 1, 'cursed')[0]; if (id) { addModule(run, id); toast(`${MOD[id].icon} ${tx(MOD[id].name)}`); } snd.lose(); }
          this.save(); render();
        } }, h('b', null, L('8 Hülle einsetzen', 'Bet 8 hull')), h('small', null, L('55 %: +45 ✦ · 45 %: ein verfluchtes Modul', '55 %: +45 ✦ · 45 %: a cursed module'))),
        h('button', { class: 'sf-go', onclick: () => this.done() }, h('b', null, L('Casino verlassen', 'Leave casino'))));
    };
    render();
  }
  private spin(reels: HTMLElement[], bet: number, after: () => void) {
    const run = this.run!;
    const r = rngOf(run);
    run.gold -= bet;
    const SYMS = ['✦', '☾', '♛', '❀', '⚜', '☄', '☠'];
    const W: [string, number][] = [['✦', 4], ['☾', 8], ['♛', 11], ['❀', 20], ['⚜', 22], ['☄', 22], ['☠', 9]];
    let res = [weighted(r, W), weighted(r, W), weighted(r, W)];
    if (r() < (run.mutators.includes('casino') ? 2 : 1) / 160) res = ['✦', '✦', '✦'];
    let pay = payout(res);
    if (pay.mult === 0 && run.pityCasino >= 4) { res = [res[0], res[0], res[2] === res[0] ? '❀' : res[2]]; pay = payout(res); }
    if (pay.mult === 0 && r() < 0.4) { const hi = pick(r, ['✦', '☾', '♛']); res = [hi, hi, pick(r, SYMS.filter(s => s !== hi && s !== '☠'))]; pay = payout(res); }
    reels.forEach((rl, i) => {
      const strip = rl.querySelector('.strip') as HTMLElement;
      const seq = Array.from({ length: 18 + i * 8 }, () => pick(Math.random, SYMS)).concat(res[i]);
      strip.innerHTML = seq.map(s => `<div>${s}</div>`).join('');
      strip.style.transition = 'none'; strip.style.transform = 'translateY(0)'; void strip.offsetHeight;
      strip.style.transition = `transform ${1.1 + i * 0.55 + (i === 2 && res[0] === res[1] ? 0.9 : 0)}s cubic-bezier(.12,.75,.2,1)`;
      strip.style.transform = `translateY(calc(-${seq.length - 1} * var(--sym)))`;
    });
    const tick = setInterval(() => snd.reel(), 90);
    setTimeout(() => {
      clearInterval(tick);
      const win = Math.round(bet * pay.mult);
      if (pay.mult > 0) {
        runCtx(run).gainGold(win); run.stats.goldWon += win; track('casinoWon', win - bet); run.pityCasino = 0;
        if (pay.jackpot) {
          snd.jackpot(); flash(this.host, 'rgba(232,192,112,.7)', 900); shake(this.host, 3); haptic('success');
          for (let k = 0; k < 4; k++) setTimeout(() => this.particles.burst(Math.random() * innerWidth, innerHeight * 0.4, 70, 0xe8c070, 420), k * 200);
          const id = moduleOffer(run, 1, 'legendary')[0]; if (id) addModule(run, id);
          run.stats.slotJackpots++; unlock('slotjackpot');
          toast(L(`JACKPOT! +${win} ✦ und ein legendäres Modul!`, `JACKPOT! +${win} ✦ and a legendary module!`), 3500);
        } else { snd.win(); this.particles.burst(innerWidth / 2, innerHeight * 0.35, 30 + pay.mult * 3, 0xe8c070, 280); toast(`${pay.label} +${win} ✦`); }
      } else {
        run.pityCasino++;
        if (res.every(s => s === '☠')) { runCtx(run).addSymbol('falschgeld'); toast(L('☠☠☠ – Falschgeld in deinem Reaktor!', '☠☠☠ – counterfeit in your reactor!')); }
        snd.lose(); if (res[0] === res[1]) toast(L('So knapp!', 'So close!'));
      }
      this.save(); after();
    }, 1100 + 1100 + (res[0] === res[1] ? 900 : 0) + 150);
  }
  private dice(kind: 'under' | 'seven' | 'over', bet: number, after: () => void) {
    const run = this.run!;
    const r = rngOf(run);
    run.gold -= bet;
    const a = 1 + Math.floor(r() * 6), b = 1 + Math.floor(r() * 6), s = a + b;
    const won = kind === 'under' ? s < 7 : kind === 'over' ? s > 7 : s === 7, mult = kind === 'seven' ? 5 : 2;
    const box = h('div', { class: 'sf-dice' }, h('span', null, '⚀'), h('span', null, '⚀'));
    const msg = h('div', { class: 'sf-omsg' }, '…');
    const wrap = h('div', { class: 'sf-overlay' }, box, msg);
    this.host.append(wrap);
    const faces = '⚀⚁⚂⚃⚄⚅';
    let k = 0;
    const roll = setInterval(() => {
      (box.children[0] as HTMLElement).textContent = faces[Math.floor(Math.random() * 6)]; (box.children[1] as HTMLElement).textContent = faces[Math.floor(Math.random() * 6)]; snd.reel();
      if (++k > 14) {
        clearInterval(roll);
        (box.children[0] as HTMLElement).textContent = faces[a - 1]; (box.children[1] as HTMLElement).textContent = faces[b - 1];
        msg.textContent = `${s} – ${won ? L(`Gewonnen! +${bet * mult} ✦`, `Won! +${bet * mult} ✦`) : L('Verloren', 'Lost')}`;
        wrap.classList.add(won ? 'won' : 'lost');
        if (won) { runCtx(run).gainGold(bet * mult); track('casinoWon', bet * (mult - 1)); snd.win(); run.pityCasino = 0; } else { snd.lose(); run.pityCasino++; }
        setTimeout(() => { wrap.remove(); this.save(); after(); }, 1300);
      }
    }, 80);
  }

  // =========================================================================================== Brakks Station
  private rest() {
    const run = this.run!;
    this.clear('rest', this.sectorBg());
    const heal = Math.round(run.maxHp * (0.3 + (run.mods.restBonus ?? 0)));
    const box = h('div', { class: 'sf-panel' });
    this.view.append(this.top(),
      h('div', { class: 'sf-npc' }, portrait('brakk'), h('div', null, h('b', null, tx(CAST.brakk.name)), h('p', null, L('„Eine Sache. Ich hab vier Hände, aber nur Zeit für eine Sache.“', '“One thing. I have four hands, but only time for one thing.”')))), box);
    box.append(
      h('div', { class: 'sf-evhead' }, h('div', { class: 'ic' }, '⚙'), h('h2', null, L('Brakks Station', 'Brakk’s Station')), h('div', { html: ornament(220) })),
      h('button', { class: 'sf-opt', onclick: () => { runCtx(run).heal(heal); snd.win(); this.done(); } }, h('b', null, `⛨ ${L('Hülle reparieren', 'Repair hull')}`), h('small', null, `+${heal} ${L('Hülle', 'hull')} (${run.hp} → ${Math.min(run.maxHp, run.hp + heal)})`)),
      h('button', { class: 'sf-opt', onclick: async () => { if (await this.upgradeSym(true)) this.done(); } }, h('b', null, `▲ ${L('Symbol aufwerten', 'Upgrade a symbol')}`), h('small', null, L('Eine Stufe höher (I → II → III), gratis', 'One level up (I → II → III), free'))),
      h('button', { class: 'sf-opt check', onclick: () => this.rollCheck(0.5 + run.luck, won => {
        if (won) { run.maxHp += 8; run.hp = run.maxHp; toast(L('Brakks Experiment glückt: +8 max. Hülle, voll repariert!', 'Brakk’s experiment works: +8 max hull, fully repaired!')); }
        else { runCtx(run).addSymbol('parasit'); toast(L('Ein Reaktorparasit nistet sich ein …', 'A reactor parasite moves in …')); }
        this.done();
      }) }, h('b', null, `⚗ ${L('Brakks Experiment (Risiko)', 'Brakk’s experiment (risk)')}`), h('small', null, L('50 %: +8 max. Hülle und volle Reparatur · 50 %: Reaktorparasit', '50 %: +8 max hull and full repair · 50 %: reactor parasite'))));
  }

  // =========================================================================================== Wrack
  private chest() {
    const run = this.run!;
    this.clear('chest', this.sectorBg());
    const box = h('div', { class: 'sf-panel' });
    this.view.append(this.top(),
      h('div', { class: 'sf-evhead' }, h('div', { class: 'ic' }, '◈'), h('h2', null, L('Zwei Wracks', 'Two wrecks')), h('div', { html: ornament(200) })),
      h('p', { class: 'sf-evtext' }, L('Ein ausgebranntes Frachtschiff – und daneben ein schwarzes Schiff, aus dem leise Musik dringt.', 'A burnt-out freighter – and beside it a black ship from which soft music drifts.')), box);
    const open = (cursed: boolean) => {
      const r = rngOf(run);
      const el = h('div', { class: 'sf-chestanim' }, cursed ? '♜' : '◈');
      const wrap = h('div', { class: 'sf-overlay' }, el);
      this.host.append(wrap); snd.open();
      setTimeout(() => {
        let lines: string[];
        if (!cursed) { const id = moduleOffer(run, 1, r() < 0.7 ? 'common' : 'rare')[0]; const g = 20 + Math.floor(r() * 25); if (id) { addModule(run, id); discover('mods', id); } runCtx(run).gainGold(g); lines = [id ? `${MOD[id].icon} ${tx(MOD[id].name)}` : '', `+${g} ✦`]; wrap.classList.add('won'); snd.win(); }
        else if (r() < 0.6 + run.luck) { const id = moduleOffer(run, 1, r() < 0.25 ? 'legendary' : 'epic')[0]; if (id) { addModule(run, id); discover('mods', id); } runCtx(run).gainGold(60); lines = [`JACKPOT: ${id ? `${MOD[id].icon} ${tx(MOD[id].name)}` : ''}`, '+60 ✦']; wrap.classList.add('won'); snd.jackpot(); flash(this.host, 'rgba(232,192,112,.6)', 700); this.particles.burst(innerWidth / 2, innerHeight / 2, 120, 0xe8c070, 420); }
        else { const id = moduleOffer(run, 1, 'cursed')[0]; if (id) addModule(run, id); runCtx(run).addSymbol(pick(r, ['leck', 'dunkelnebel'])); lines = [L('FLUCH!', 'CURSED!'), id ? `${MOD[id].icon} ${tx(MOD[id].name)}` : '']; wrap.classList.add('lost'); snd.lose(); shake(this.host, 2); }
        wrap.append(h('div', { class: 'sf-omsg' }, lines.filter(Boolean).join(' · ')));
        this.save();
        setTimeout(() => { wrap.remove(); this.done(); }, 2000);
      }, 1100);
    };
    box.append(
      h('button', { class: 'sf-opt', onclick: () => open(false) }, h('b', null, `◈ ${L('Frachtwrack', 'Freighter wreck')}`), h('small', null, L('Sicher: Modul (gewöhnlich/selten) + Taler', 'Safe: module (common/rare) + coins'))),
      h('button', { class: 'sf-opt check', onclick: () => open(true) }, h('b', null, `♜ ${L('Das schwarze Schiff', 'The black ship')}`), h('small', null, L(`${Math.round((0.6 + run.luck) * 100)} %: episches/legendäres Modul + 60 ✦ · sonst Fluch`, `${Math.round((0.6 + run.luck) * 100)} %: epic/legendary module + 60 ✦ · else curse`))));
  }

  // =========================================================================================== Hafen zwischen den Akten
  /** Zwischenhalt nach Akt 2 und 4: drei von fünf Stationen besuchen, dann ablegen. */
  private port(arrive = false) {
    const run = this.run!;
    const p = run.port!;
    const P = PORTS[p.n - 1] ?? PORTS[0];
    this.clear('port', P.bg, P.theme);
    const left = PORT_VISITS - p.used.length;
    const box = h('div', { class: 'sf-panel' });
    this.view.append(this.top(),
      h('div', { class: 'sf-evhead' }, h('div', { class: 'ic' }, P.icon), h('h2', null, tx(P.name)), h('div', { html: ornament(220) })),
      h('p', { class: 'sf-evtext' }, tx(P.text)),
      h('div', { class: 'sf-portleft' + (left ? '' : ' none') }, left ? L(`Zeit für noch ${left} ${left === 1 ? 'Station' : 'Stationen'}, bevor der Sprungkorridor schließt.`, `Time for ${left} more ${left === 1 ? 'stop' : 'stops'} before the jump corridor closes.`) : L('Der Korridor öffnet sich – Zeit abzulegen.', 'The corridor opens – time to cast off.')),
      box);
    for (const st of P.stops) {
      const used = p.used.includes(st.id);
      const b = h('button', { class: 'sf-opt sf-portstop' + (used ? ' used' : ''), disabled: used || !left },
        h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, st.who ? portrait(st.who) : h('span', { class: 'ic' }, st.icon),
          h('div', null, h('b', null, `${st.icon} ${tx(st.name)}`), h('small', null, used ? L('besucht', 'visited') : tx(st.text)))));
      b.addEventListener('click', () => { p.cur = st.id; this.save(); snd.open(); this.portStop(st.id); });
      box.append(b);
    }
    box.append(h('button', { class: 'sf-go', onclick: () => {
      run.port = undefined;
      enterAct(run, run.act + 1);
      this.save();
      void this.actIntro();
    } }, h('b', null, L('Ablegen', 'Cast off')), h('small', null, L('Weiter in den nächsten Sektor', 'On to the next sector'))));
    if (arrive) { snd.event(); this.banner(tx(P.name), L('Hafen zwischen den Sektoren', 'Port between sectors')); }
  }
  private portStop(id: string) {
    const run = this.run!;
    switch (id) {
      case 'shop': this.shop(true); break;
      case 'rest': this.rest(); break;
      case 'casino': this.casino(); break;
      case 'cantina': this.event(); break;
      case 'bounty': run.mods.bounty = 1; void this.fight('elite'); break;
      case 'archive': void (async () => { const ok = await this.removeSym(true); if (ok) toast(L('Die Motten tragen das Symbol davon.', 'The moths carry the symbol away.')); this.done(); })(); break;
      case 'forge': void (async () => { await this.upgradeSym(true); await this.upgradeSym(true); this.done(); })(); break;
      default: this.done();
    }
  }

  // =========================================================================================== Ende
  private async result(won: boolean, by?: string) {
    const run = this.run!;
    bgm(null); sting(won ? 'win' : 'lose');
    const res = finishRun(run, won, by);
    const m0 = meta(); if (run.mods.bonusStaub) { m0.staub += run.mods.bonusStaub; m0.totalStaub += run.mods.bonusStaub; saveMeta(); }
    this.run = null;
    this.clear('result ' + (won ? 'won' : 'lost'), won ? ['#3a2c10', '#07060f'] : ['#1a1020', '#050308']);
    won ? snd.win() : snd.lose();
    const scoreEl = h('b', { class: 'sf-bignum' }, '0'), staubEl = h('b', null, '0');
    const goal = nextGoal(), m = meta();
    this.view.append(
      h('div', { class: 'sf-resulthead' }, h('small', null, won ? L('DAS LICHT KEHRT ZURÜCK', 'THE LIGHT RETURNS') : L('DEIN STERN ERLISCHT … VORERST', 'YOUR STAR FADES … FOR NOW')),
        h('h1', null, won ? L('Sieg', 'Victory') : L('Gefallen', 'Fallen')), h('div', { html: ornament(220) }), by && !won ? h('p', { class: 'muted' }, L(`Bezwungen von: ${by}`, `Defeated by: ${by}`)) : ''),
      h('div', { class: 'sf-scorebox' }, h('small', null, L('Punkte', 'Score')), scoreEl, res.newBest ? h('span', { class: 'sf-record' }, L('NEUER REKORD', 'NEW RECORD')) : ''),
      h('div', { class: 'sf-staubgain' }, '+', staubEl, ' ✧ ', L('Sternenstaub', 'stardust')),
      goal ? h('div', { class: 'sf-unlock' }, h('small', null, `${goal.label}: ${N(Math.min(m.staub, goal.cost))} / ${N(goal.cost)} ✧`), h('div', { class: 'sf-bar' }, h('i', { style: { width: `${Math.min(100, (m.staub / goal.cost) * 100)}%` } }))) : '',
      h('div', { class: 'sf-stats' },
        h('div', null, h('b', null, `${run.act}/${run.floor}`), h('small', null, L('Akt/Etappe', 'Act/stage'))), h('div', null, h('b', null, N(run.stats.kills)), h('small', null, L('Siege', 'Kills'))),
        h('div', null, h('b', null, N(run.stats.jackpots)), h('small', null, 'Jackpots')), h('div', null, h('b', null, N(run.stats.maxHit)), h('small', null, L('Max. Treffer', 'Max hit')))),
      h('div', { class: 'sf-endbtns' },
        h('button', { class: 'sf-go', onclick: () => this.start(run.ship, newSeed(), run.ascension) }, h('b', null, L('Sofort neuer Flug', 'New flight now'))),
        h('button', { class: 'sf-btn ghost', onclick: () => { void this.flushStory().then(() => this.hub()); } }, L('Zur Brücke', 'To the bridge'))));
    countUp(scoreEl, res.score, 1200, v => N(v));
    setTimeout(() => countUp(staubEl, res.staub, 900, v => N(v)), 500);
    if (won) for (let k = 0; k < 6; k++) setTimeout(() => this.particles.burst(Math.random() * innerWidth, innerHeight * 0.3, 60, [0xe8c070, 0xb48fd0, 0x9fd0c8][k % 3], 380), k * 250);
  }
}

function payout(res: string[]): { mult: number; label: string; jackpot?: boolean } {
  const [a, b, c] = res;
  if (a === b && b === c) {
    if (a === '✦') return { mult: 30, label: 'JACKPOT', jackpot: true };
    if (a === '☾') return { mult: 15, label: '☾☾☾' };
    if (a === '♛') return { mult: 10, label: '♛♛♛' };
    if (a === '☠') return { mult: 0, label: '☠☠☠' };
    return { mult: 5, label: `${a}${a}${a}` };
  }
  if ((a === b || b === c || a === c) && !res.includes('☠')) return { mult: 1.5, label: L('Paar', 'Pair') };
  return { mult: 0, label: '' };
}

function outcomeText(list: EventOption['win']) {
  const p: string[] = [];
  for (const o of list) {
    if (o.gold) p.push(`${o.gold > 0 ? '+' : ''}${o.gold}✦`);
    if (o.hp) p.push(`${o.hp > 0 ? '+' : ''}${o.hp}⛨`);
    if (o.maxHp) p.push(`${o.maxHp > 0 ? '+' : ''}${o.maxHp} max⛨`);
    if (o.staub) p.push(`+${o.staub}✧`);
    if (o.card) p.push(L('Symbol', 'symbol'));
    if (o.relic) p.push(o.relic === 'cursed' ? L('verfl. Modul', 'cursed module') : `${L('Modul', 'module')} (${o.relic})`);
    if (o.curse) p.push(L('Schrott', 'junk'));
    if (o.removeCard) p.push(L('Symbol entfernen', 'remove symbol'));
    if (o.upgradeCard) p.push(L('Aufwerten', 'upgrade'));
    if (o.fight) p.push(o.fight === 'elite' ? L('Elite-Kampf', 'elite fight') : L('Kampf', 'fight'));
  }
  return p.join(' ') || '—';
}
