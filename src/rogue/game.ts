// PRIMFALL – Ablauf und Bildschirme: Hub (Meta), Karte, Belohnung, Händler, Casino, Ereignis, Rast, Truhe, Ergebnis.
// Der Kampf liegt in ui/combatView.ts, die Regeln in combat.ts/run.ts, alle Inhalte in data/*.ts.
import { L, N } from '../core/i18n';
import { todayKey } from '../core/leaderboard';
import { confirmSheet, h, sheet, toast } from '../ui/dom';
import { CARD, PACKS } from './data/cards';
import { RELIC } from './data/relics';
import { ENCOUNTERS } from './data/enemies';
import { EVENTS } from './data/events';
import { goldFor } from './combat';
import { Particles, countUp, flash, haptic, music, shake, snd } from './juice';
import {
  ACHIEVEMENTS, CLASS_COST, GOALS, TALENTS, buy, finishRun, meta, nextGoal, onAchievement, onGoal, saveMeta, talent, track, unlock,
} from './meta';
import { dailySeed, newSeed, pick, rngOf, weighted } from './rng';
import {
  COLS, ROWS, addRelic, applyOutcomes, cardOffer, cardPrice, enterAct, loadRun, newRun, payReroll, reachable, relicOffer, relicPrice,
  removeCost, rerollCost, runCtx, saveRun,
} from './run';
import { ClassId, EventDef, EventOption, MapNode, Run } from './types';
import { ACT_NAME, NODE_ICON, NODE_NAME, cardEl, cardPreview, deckView, longPress, pickFromDeck, relicEl, topBar, tx } from './ui/parts';
import { help, runCombat } from './ui/combatView';

const CLASSES: { id: ClassId; name: [string, string]; icon: string; text: [string, string] }[] = [
  { id: 'sieber', icon: '⚱️', name: ['Der Sieber', 'The Siever'], text: ['Ausgewogen. Lebt von langen Primzahl-Ketten.', 'Balanced. Thrives on long prime chains.'] },
  { id: 'modula', icon: '🧪', name: ['Modula', 'Modula'], text: ['Zerfall (Gift) und Summen-Tricks: Modulo, negative Zahlen.', 'Decay (poison) and sum tricks: modulo, negative numbers.'] },
  { id: 'wuerfel', icon: '🎲', name: ['Würfelkönig', 'Dice King'], text: ['Gewürfelte Kartenzahlen, Gold, hohes Risiko.', 'Rolled card numbers, gold, high risk.'] },
];

export class Game {
  run: Run | null = null;
  view: HTMLElement;
  particles: Particles;
  private offs: (() => void)[] = [];
  lastCls: ClassId = 'sieber';
  asc = 0;

  constructor(readonly host: HTMLElement, readonly exit: () => void) {
    host.classList.add('rg');
    const canvas = h('canvas', { class: 'rg-particles' });
    this.view = h('div', { class: 'rg-view' });
    host.append(this.view, canvas);
    this.particles = new Particles(canvas);
    this.offs.push(onAchievement(a => this.banner(`${a.icon} ${tx(a.name)}`, `+${a.staub} ✨ · ${tx(a.text)}`)));
    this.offs.push(onGoal(g => this.banner(`📅 ${L('Tagesziel geschafft!', 'Daily goal done!')}`, `${tx(g.text)} · +${g.staub} ✨`)));
    this.run = loadRun();
    this.hub();
    if (import.meta.env.DEV) (window as any).__pf = this;     // nur Entwicklungsserver: Bildschirme gezielt prüfen
  }
  dispose() { this.offs.forEach(f => f()); this.particles.stop(); music(false); }

  private clear(cls = '') { this.view.innerHTML = ''; this.view.className = 'rg-view ' + cls; this.view.scrollTop = 0; }
  private banner(title: string, sub: string) {
    const b = h('div', { class: 'rg-banner' }, h('b', null, title), h('small', null, sub));
    this.host.append(b); snd.win(); haptic('success');
    setTimeout(() => b.classList.add('out'), 2600); setTimeout(() => b.remove(), 3200);
  }
  private save() { if (this.run) saveRun(this.run); }

  // =========================================================================================== Hub
  hub(tab: 'play' | 'lab' | 'ach' | 'log' = 'play') {
    music(false);
    this.clear('hub');
    const m = meta();
    const goal = nextGoal();
    const head = h('div', { class: 'rg-hubhead' },
      h('button', { class: 'rg-ib', onclick: () => this.exit() }, '‹'),
      h('div', { class: 'rg-logo' }, h('span', null, 'PRIM'), h('b', null, 'FALL')),
      h('div', { class: 'rg-staub' }, `✨ ${N(m.staub)}`));
    const prog = goal ? h('div', { class: 'rg-unlock' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('small', null, L('Nächste Freischaltung', 'Next unlock')), h('small', null, goal.label)),
      h('div', { class: 'rg-bar' }, h('i', { style: { width: `${Math.min(100, (m.staub / goal.cost) * 100)}%` } })),
      h('small', { class: 'muted' }, m.staub >= goal.cost ? L('Jetzt im Labor kaufbar!', 'Buyable in the Lab now!') : L(`Nur noch ${N(goal.cost - m.staub)} ✨`, `Only ${N(goal.cost - m.staub)} ✨ to go`))) : '';
    const tabs = h('div', { class: 'rg-tabs' }, ([['play', L('Spielen', 'Play')], ['lab', L('Labor', 'Lab')], ['ach', L('Erfolge', 'Feats')], ['log', L('Verlauf', 'History')]] as const)
      .map(([id, label]) => h('button', { class: tab === id ? 'on' : '', onclick: () => this.hub(id) }, label)));
    const body = h('div', { class: 'rg-hubbody' });
    this.view.append(head, prog, tabs, body);
    if (tab === 'play') this.hubPlay(body);
    if (tab === 'lab') this.hubLab(body);
    if (tab === 'ach') this.hubAch(body);
    if (tab === 'log') this.hubLog(body);
    if (!m.tutorial) { m.tutorial = true; saveMeta(); help(); }
  }

  private hubPlay(body: HTMLElement) {
    const m = meta();
    if (this.run) {
      const r = this.run;
      body.append(h('button', { class: 'rg-continue', onclick: () => this.resume() },
        h('div', null, h('b', null, L('Lauf fortsetzen', 'Continue run')), h('small', null, `${tx(CLASSES.find(c => c.id === r.cls)!.name)} · ${L('Akt', 'Act')} ${r.act} · ${L('Etage', 'Floor')} ${r.floor} · ❤ ${r.hp}/${r.maxHp}`)),
        h('span', null, '▶')),
        h('button', { class: 'rg-link', onclick: async () => { if (await confirmSheet(L('Lauf aufgeben?', 'Abandon run?'), L('Der aktuelle Lauf wird beendet und gewertet.', 'The current run ends and is scored.'), L('Aufgeben', 'Abandon'), L('Weiterspielen', 'Keep playing'))) this.lose(L('aufgegeben', 'abandoned')); } }, L('Lauf aufgeben', 'Abandon run')));
    }
    body.append(h('div', { class: 'rg-sec' }, L('Klasse wählen', 'Choose class')));
    const cls = h('div', { class: 'rg-classes' });
    for (const c of CLASSES) {
      const owned = m.classes.includes(c.id);
      const el = h('button', { class: 'rg-class' + (this.lastCls === c.id ? ' on' : '') + (owned ? '' : ' locked') },
        h('div', { class: 'ic' }, c.icon), h('b', null, tx(c.name)), h('small', null, owned ? tx(c.text) : `🔒 ${N(CLASS_COST[c.id])} ✨`));
      el.addEventListener('click', () => {
        if (owned) { this.lastCls = c.id; this.hub('play'); return; }
        if (buy(CLASS_COST[c.id], mm => mm.classes.push(c.id))) { snd.win(); this.lastCls = c.id; this.hub('play'); } else { snd.miss(); toast(L('Nicht genug Sternenstaub.', 'Not enough stardust.')); }
      });
      cls.append(el);
    }
    body.append(cls);
    // Härtegrad
    if (m.ascMax > 0) {
      const sel = h('div', { class: 'rg-asc' }, h('small', null, L('Härte', 'Hardship')),
        ...Array.from({ length: m.ascMax + 1 }, (_, i) => h('button', { class: i === this.asc ? 'on' : '', onclick: () => { this.asc = i; this.hub('play'); } }, String(i))),
        h('small', { class: 'muted' }, this.asc ? L(`+${this.asc * 10} % Gegner-LP · +${this.asc * 25} % Punkte`, `+${this.asc * 10} % enemy HP · +${this.asc * 25} % score`) : ''));
      body.append(sel);
    }
    const seedIn = h('input', { type: 'text', placeholder: L('Seed (leer = zufällig)', 'Seed (empty = random)'), class: 'rg-seed' }) as HTMLInputElement;
    body.append(
      h('button', { class: 'rg-go', onclick: () => this.start(this.lastCls, seedIn.value.trim().toUpperCase() || newSeed(), this.asc) },
        h('b', null, this.run ? L('Neuer Lauf', 'New run') : L('Lauf starten', 'Start run')), h('small', null, tx(CLASSES.find(c => c.id === this.lastCls)!.name))),
      seedIn);
    const day = todayKey();
    body.append(h('button', { class: 'rg-daily' + (m.daily.runDone ? ' done' : ''), onclick: () => this.start(this.lastCls, dailySeed(day), 0, day) },
      h('b', null, `📅 ${L('Tageslauf', 'Daily run')}`), h('small', null, m.daily.runDone ? L('Heute schon gespielt – nochmal geht, zählt aber nicht doppelt.', 'Already played today – you can replay.') : L('Gleicher Seed für alle · ×1,5 Sternenstaub', 'Same seed for everyone · ×1.5 stardust'))));
    // Tagesziele
    body.append(h('div', { class: 'rg-sec' }, L('Tagesziele', 'Daily goals')),
      h('div', { class: 'rg-goals' }, m.daily.goals.map(g => {
        const d = GOALS.find(x => x.id === g.id)!;
        return h('div', { class: 'rg-goal' + (g.done ? ' done' : '') }, h('span', null, g.done ? '✅' : '◻️'), h('div', null, h('b', null, tx(d.text)),
          h('div', { class: 'rg-bar sm' }, h('i', { style: { width: `${Math.min(100, (g.p / d.n) * 100)}%` } }))), h('small', null, `+${d.staub} ✨`));
      })));
    body.append(h('div', { class: 'rg-stats' },
      h('div', null, h('b', null, N(m.runs)), h('small', null, L('Läufe', 'Runs'))),
      h('div', null, h('b', null, N(m.wins)), h('small', null, L('Siege', 'Wins'))),
      h('div', null, h('b', null, N(m.bestScore)), h('small', null, L('Rekord', 'Best'))),
      h('div', null, h('b', null, N(m.bestFloor)), h('small', null, L('Tiefste Etage', 'Deepest floor')))),
      h('button', { class: 'rg-link', onclick: () => help() }, L('Wie spielt man?', 'How to play?')));
  }

  private hubLab(body: HTMLElement) {
    const m = meta();
    body.append(h('p', { class: 'muted small' }, L('Sternenstaub bekommst du nach jedem Lauf – auch wenn du verlierst. Talente gelten dauerhaft.', 'You earn stardust after every run – even when you lose. Talents are permanent.')));
    body.append(h('div', { class: 'rg-sec' }, L('Talente', 'Talents')));
    for (const t of TALENTS) {
      const lv = m.talents[t.id] ?? 0, max = lv >= t.max, cost = t.cost(lv);
      body.append(h('div', { class: 'rg-talent' },
        h('div', { class: 'ic' }, t.icon),
        h('div', { class: 'tx' }, h('b', null, `${tx(t.name)} ${'●'.repeat(lv)}${'○'.repeat(t.max - lv)}`), h('small', null, tx(t.text(Math.max(1, max ? lv : lv + 1))))),
        h('button', { class: 'rg-buy', disabled: max || m.staub < cost, onclick: () => { if (buy(cost, mm => { mm.talents[t.id] = lv + 1; })) { snd.win(); this.hub('lab'); } } }, max ? 'MAX' : `${N(cost)} ✨`)));
    }
    body.append(h('div', { class: 'rg-sec' }, L('Kartenpakete', 'Card packs')));
    for (const p of PACKS) {
      const own = m.packs.includes(p.id);
      body.append(h('div', { class: 'rg-talent' },
        h('div', { class: 'ic' }, '🃏'),
        h('div', { class: 'tx' }, h('b', null, tx(p.name)), h('small', null, p.cards.map(id => tx(CARD[id].name)).join(' · '))),
        h('button', { class: 'rg-buy', disabled: own || m.staub < p.cost, onclick: () => { if (buy(p.cost, mm => mm.packs.push(p.id))) { snd.win(); this.hub('lab'); } } }, own ? '✓' : `${N(p.cost)} ✨`)));
    }
    body.append(h('p', { class: 'muted small' }, L('Härtegrade schaltest du frei, indem du einen Lauf gewinnst.', 'You unlock hardship levels by winning a run.')));
  }

  private hubAch(body: HTMLElement) {
    const m = meta();
    body.append(h('div', { class: 'rg-sec' }, `${m.achievements.length} / ${ACHIEVEMENTS.length}`),
      h('div', { class: 'rg-achs' }, ACHIEVEMENTS.map(a => h('div', { class: 'rg-ach' + (m.achievements.includes(a.id) ? ' on' : '') },
        h('div', { class: 'ic' }, a.icon), h('b', null, tx(a.name)), h('small', null, tx(a.text)), h('i', null, `+${a.staub} ✨`)))));
  }

  private hubLog(body: HTMLElement) {
    const m = meta();
    if (!m.history.length) { body.append(h('p', { class: 'muted' }, L('Noch keine Läufe.', 'No runs yet.'))); return; }
    body.append(h('div', { class: 'rg-hist' }, m.history.map(r => h('div', { class: 'rg-hrow' + (r.won ? ' won' : '') },
      h('span', null, r.won ? '🏆' : '💀'),
      h('div', null, h('b', null, `${tx(CLASSES.find(c => c.id === r.cls)!.name)} · ${L('Akt', 'Act')} ${r.act}/${r.floor}`),
        h('small', null, `${new Date(r.date).toLocaleDateString()} · ${r.seed}${r.killedBy ? ` · ${r.killedBy}` : ''} · ${L('Kombo', 'Combo')} ${r.maxCombo} · ${L('Treffer', 'Hit')} ${r.maxHit}`)),
      h('div', { class: 'v' }, h('b', null, N(r.score)), h('small', null, `+${r.staub} ✨`))))));
  }

  // =========================================================================================== Laufstart
  start(cls: ClassId, seed: string, asc: number, daily?: string) {
    this.run = newRun(cls, seed, asc, daily);
    this.lastCls = cls;
    this.save();
    snd.open();
    this.map(true);
  }

  // =========================================================================================== Karte
  map(intro = false) {
    const run = this.run!;
    music(true, Math.min(4, run.act - 1 + Math.floor(run.floor / 4)));
    this.clear(`map act${run.act}`);
    const reach = new Set(reachable(run));
    const W = 360, rowH = 74, H = ROWS * rowH + 40;
    const x = (n: MapNode) => 40 + (n.col / (COLS - 1)) * (W - 80);
    const y = (n: MapNode) => H - 40 - n.row * rowH;
    const svg = `<svg viewBox="0 0 ${W} ${H}" class="rg-lines">${run.map.flatMap(n => n.next.map(k => {
      const m = run.map[k]; const on = n.done && (run.at === n.id ? reach.has(k) : m.done);
      return `<line x1="${x(n)}" y1="${y(n)}" x2="${x(m)}" y2="${y(m)}" class="${on ? 'on' : n.done && m.done ? 'walked' : ''}"/>`;
    })).join('')}</svg>`;
    const mapEl = h('div', { class: 'rg-map', style: { height: `${H}px` }, html: svg });
    for (const n of run.map) {
      const b = h('button', { class: `rg-node k-${n.kind}${n.done ? ' done' : ''}${reach.has(n.id) ? ' reach' : ''}${run.at === n.id ? ' here' : ''}`, style: { left: `${(x(n) / W) * 100}%`, top: `${y(n)}px` } },
        NODE_ICON[n.kind]);
      b.addEventListener('click', () => {
        if (!reach.has(n.id)) { toast(NODE_NAME(n.kind)); return; }
        snd.card(); this.enter(n);
      });
      mapEl.append(b);
    }
    const head = h('div', { class: 'rg-maphead' }, h('small', null, `${L('Akt', 'Act')} ${run.act} / 3`), h('h2', null, ACT_NAME(run.act)));
    const legend = h('div', { class: 'rg-legend' }, ['fight', 'elite', 'event', 'shop', 'casino', 'rest', 'chest', 'boss'].map(k => h('span', null, `${NODE_ICON[k]} ${NODE_NAME(k)}`)));
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()), head, h('div', { class: 'rg-mapwrap' }, mapEl), legend);
    // zur aktuellen Position scrollen
    requestAnimationFrame(() => {
      const target = this.view.querySelector('.rg-node.reach') as HTMLElement | null;
      target?.scrollIntoView({ block: 'center', behavior: intro ? 'auto' : 'smooth' });
    });
  }

  private runMenu() {
    const run = this.run!;
    const close = sheet(L('Lauf', 'Run'),
      h('p', { class: 'muted small' }, `Seed ${run.seed} · ${L('Härte', 'Hardship')} ${run.ascension}`),
      h('div', { class: 'stack', style: { gap: '10px' } },
        h('button', { class: 'btn block', onclick: () => { close(); help(); } }, L('Spielregeln', 'Rules')),
        h('button', { class: 'btn block', onclick: () => { close(); this.save(); this.hub(); } }, L('Pause: zum Hub (Lauf bleibt gespeichert)', 'Pause: to hub (run stays saved)')),
        h('button', { class: 'btn block stop', onclick: () => { close(); this.lose(L('aufgegeben', 'abandoned')); } }, L('Lauf aufgeben', 'Abandon run'))));
  }

  /** Fortsetzen: eine angefangene, noch nicht abgeschlossene Station wird neu betreten. */
  resume() {
    const run = this.run!;
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
    if (run.at >= 0) run.map[run.at].done = true;
    this.save();
    this.map();
  }

  // =========================================================================================== Kampf
  private async fight(kind: 'fight' | 'elite' | 'boss') {
    const run = this.run!;
    const enc = ENCOUNTERS[run.act];
    const r = rngOf(run);
    const ids = kind === 'boss' ? enc.boss : kind === 'elite' ? pick(r, enc.elite) : pick(r, run.floor <= 3 ? enc.easy : enc.hard);
    music(true, Math.min(4, run.act + (kind === 'boss' ? 2 : kind === 'elite' ? 1 : 0)));
    this.clear('fight');
    const res = await runCombat(this.view, run, ids, kind, this.particles, () => { this.save(); this.hub(); });
    if (!this.view.isConnected) return;
    if (!res.won) { this.lose(res.killedBy); return; }
    for (const id of run.relics) RELIC[id]?.onCombatEnd?.(runCtx(run), true);
    if (kind === 'elite') { run.stats.elites++; track('elites', 1); }
    if (kind === 'boss') {
      run.stats.bosses++; track('bosses', 1);
      unlock(`boss${run.act}` === 'boss3' ? 'win' : `boss${run.act}`);
      if (run.cls !== 'sieber') unlock(run.cls);
    }
    this.save();
    this.reward(kind);
  }

  // =========================================================================================== Belohnung
  private reward(kind: 'fight' | 'elite' | 'boss') {
    const run = this.run!;
    this.clear('reward');
    const r = rngOf(run);
    let gold = goldFor(kind, r);
    let goldTaken = false, cardTaken = false;
    let offer = cardOffer(run, 3, kind === 'boss' ? 60 : kind === 'elite' ? 15 : 0);
    const relics = kind === 'elite' ? relicOffer(run, 1) : kind === 'boss' && run.act < 3 ? relicOffer(run, 3, undefined, 25) : [];
    const box = h('div', { class: 'rg-panel' });
    const title = h('h2', { class: 'rg-title' }, kind === 'boss' ? L('BOSS BESIEGT', 'BOSS DEFEATED') : kind === 'elite' ? L('Elite besiegt', 'Elite defeated') : L('Sieg', 'Victory'));
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()), title, box);
    if (kind === 'boss') { flash(this.host, 'rgba(255,210,90,.5)', 600); snd.win(); }

    const render = () => {
      box.innerHTML = '';
      // Gold mit „Doppelt oder nichts“
      if (!goldTaken) {
        const goldEl = h('b', { class: 'rg-goldnum' }, '0');
        countUp(goldEl, gold, 600);
        box.append(h('div', { class: 'rg-goldrow' }, h('div', null, h('small', null, L('Beute', 'Loot')), h('div', null, goldEl, ' 🪙')),
          h('button', { class: 'rg-btn', onclick: () => { goldTaken = true; runCtx(run).gainGold(gold); snd.coin(); render(); } }, L('Nehmen', 'Take')),
          h('button', { class: 'rg-btn risk', onclick: () => this.doubleOrNothing(gold, won => { goldTaken = true; if (won) runCtx(run).gainGold(gold * 2); render(); }) }, L('Doppelt oder nichts', 'Double or nothing'))));
      }
      // Relikte
      if (relics.length) {
        box.append(h('div', { class: 'rg-sec' }, relics.length > 1 ? L('Wähle ein Boss-Relikt', 'Choose a boss relic') : L('Relikt', 'Relic')));
        const row = h('div', { class: 'rg-relicpick' });
        for (const id of relics) {
          const rr = RELIC[id];
          const el = h('button', { class: 'rg-relicopt' + (rr.cursed ? ' cursed' : '') }, h('span', { class: 'ic' }, rr.icon), h('b', null, tx(rr.name)), h('small', null, tx(rr.text)));
          el.addEventListener('click', () => { addRelic(run, id); relics.length = 0; snd.win(); this.save(); render(); });
          row.append(el);
        }
        box.append(row);
      }
      // Karten
      if (!cardTaken) {
        const cost = rerollCost(run);
        box.append(h('div', { class: 'rg-sec' }, L('Wähle eine Karte', 'Choose a card')));
        const row = h('div', { class: 'rg-cardpick' });
        offer.forEach((id, i) => {
          const el = cardEl(id, false);
          el.classList.add('reveal'); el.style.setProperty('--i', String(i));
          el.addEventListener('click', () => { if (el.dataset.lp) { delete el.dataset.lp; return; } runCtx(run).addCard(id); cardTaken = true; snd.card(); this.save(); render(); });
          longPress(el, () => cardPreview(id, false));
          row.append(el);
        });
        box.append(row, h('div', { class: 'row' },
          h('button', { class: 'rg-btn', disabled: run.gold < cost, onclick: () => { if (payReroll(run)) { offer = cardOffer(run, 3, kind === 'boss' ? 60 : kind === 'elite' ? 15 : 0); snd.reel(); render(); } } }, `🔁 ${cost ? `${cost} 🪙` : L('gratis', 'free')}`),
          h('button', { class: 'rg-btn ghost', onclick: () => { cardTaken = true; render(); } }, L('Überspringen', 'Skip'))));
      }
      if (goldTaken && cardTaken && !relics.length) {
        box.append(h('button', { class: 'rg-go', onclick: () => this.afterReward(kind) }, h('b', null, kind === 'boss' ? (run.act >= 3 ? L('Zum Sieg', 'To victory') : L(`Weiter in Akt ${run.act + 1}`, `On to act ${run.act + 1}`)) : L('Weiter', 'Continue'))));
      }
    };
    render();
  }

  private afterReward(kind: string) {
    const run = this.run!;
    if (kind === 'boss') {
      if (run.act >= 3) { this.win(); return; }
      enterAct(run, run.act + 1);
      if (run.act === 2 && run.deck.length <= 8) unlock('lean');
      this.save();
      this.map(true);
      return;
    }
    this.done();
  }

  /** Münzwurf mit Spannungsaufbau; Pity und Glück im Hintergrund. */
  private doubleOrNothing(stake: number, cb: (won: boolean) => void) {
    const run = this.run!;
    const r = rngOf(run);
    const p = Math.min(0.62, 0.5 + run.luck + (run.pityCasino >= 3 ? 0.08 : 0));
    const won = r() < p;
    const coin = h('div', { class: 'rg-coin' }, h('div', { class: 'f' }, '🪙'), h('div', { class: 'b' }, '☠'));
    const msg = h('div', { class: 'rg-coinmsg' }, L(`Einsatz ${stake} – Chance ${Math.round(p * 100)} %`, `Stake ${stake} – chance ${Math.round(p * 100)} %`));
    const wrap = h('div', { class: 'rg-overlay' }, coin, msg);
    this.host.append(wrap);
    coin.style.setProperty('--end', won ? '0deg' : '180deg');
    coin.classList.add('flip');
    let k = 0; const tick = setInterval(() => { snd.reel(); if (++k > 12) clearInterval(tick); }, 110);
    setTimeout(() => {
      msg.textContent = won ? L(`GEWONNEN! +${stake * 2} 🪙`, `WON! +${stake * 2} 🪙`) : L('Nichts …', 'Nothing …');
      wrap.classList.add(won ? 'won' : 'lost');
      if (won) { snd.win(); flash(this.host, 'rgba(255,210,90,.45)'); this.particles.burst(innerWidth / 2, innerHeight / 2, 60, 0xffd25a, 320); run.pityCasino = 0; track('casinoWon', stake); }
      else { snd.lose(); shake(this.host, 1.5); run.pityCasino++; }
      setTimeout(() => { wrap.remove(); cb(won); this.save(); }, 1300);
    }, 1700);
  }

  // =========================================================================================== Ereignis
  private event() {
    const run = this.run!;
    const r = rngOf(run);
    const pool = EVENTS.filter(e => e.act === 0 || e.act === run.act);
    const ev = pick(r, pool);
    this.renderEvent(ev);
  }

  private renderEvent(ev: EventDef) {
    const run = this.run!;
    this.clear('event');
    const box = h('div', { class: 'rg-panel' });
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()),
      h('div', { class: 'rg-evhead' }, h('div', { class: 'ic' }, ev.icon), h('h2', null, tx(ev.title))), h('p', { class: 'rg-evtext' }, tx(ev.text)), box);
    for (const o of ev.options) box.append(this.eventOption(o));
  }

  private eventOption(o: EventOption) {
    const run = this.run!;
    const can = (!o.need?.gold || run.gold >= o.need.gold) && (!o.need?.hp || run.hp > o.need.hp);
    if (!o.check) {
      const b = h('button', { class: 'rg-opt', disabled: !can, onclick: () => this.resolveEvent(o.win, o.winText) }, h('b', null, tx(o.label)), h('small', null, outcomeText(o.win)));
      return b;
    }
    const ck = o.check;
    let raised = 0;
    const base = ck.chance + 0.02 * talent('glueck') + Math.min(0.15, (run.mods.checkPity ?? 0) * 0.05);
    const chanceEl = h('b', { class: 'rg-chance' });
    const costEl = h('small');
    const upd = () => {
      const ch = Math.min(0.95, base + raised * (ck.raise?.add ?? 0));
      chanceEl.textContent = `${Math.round(ch * 100)} %`;
      chanceEl.style.setProperty('--p', String(ch));
      costEl.textContent = ck.raise && raised ? L(`Einsatz: ${raised * ck.raise.per} ${ck.raise.cost === 'gold' ? '🪙' : '❤'}`, `Stake: ${raised * ck.raise.per} ${ck.raise.cost === 'gold' ? '🪙' : '❤'}`) : '';
      return ch;
    };
    const raiseRow = ck.raise ? h('div', { class: 'rg-raise' },
      h('button', { onclick: (e: Event) => { e.stopPropagation(); if (raised > 0) { raised--; upd(); snd.card(); } } }, '−'),
      h('span', null, L('Einsatz erhöhen', 'Raise stake')),
      h('button', { onclick: (e: Event) => {
        e.stopPropagation();
        const next = (raised + 1) * ck.raise!.per;
        const ok = ck.raise!.cost === 'gold' ? run.gold >= next : run.hp > next;
        if (raised < ck.raise!.max && ok) { raised++; upd(); snd.coin(); } else snd.miss();
      } }, '+')) : '';
    const el = h('div', { class: 'rg-opt check' + (can ? '' : ' off') },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('b', null, tx(o.label)), chanceEl),
      h('small', null, `✓ ${outcomeText(o.win)}   ✗ ${outcomeText(o.lose ?? [])}`), raiseRow, costEl,
      h('button', { class: 'rg-btn risk', disabled: !can, onclick: () => {
        const ch = upd();
        if (ck.raise && raised) { const c = raised * ck.raise.per; if (ck.raise.cost === 'gold') run.gold -= c; else run.hp = Math.max(1, run.hp - c); }
        this.rollCheck(ch, won => {
          if (won) { run.mods.checkPity = 0; track('checks', 1); } else run.mods.checkPity = (run.mods.checkPity ?? 0) + 1;
          this.resolveEvent(won ? o.win : o.lose ?? [], won ? o.winText : o.loseText, won);
        });
      } }, L('Wagen!', 'Dare!')));
    upd();
    return el;
  }

  /** Probe mit Würfelscheibe (1–100), knappe Fehlwürfe werden spannend gezeigt. */
  private rollCheck(chance: number, cb: (won: boolean) => void) {
    const run = this.run!;
    const r = rngOf(run);
    const need = Math.round(chance * 100);
    const roll = 1 + Math.floor(r() * 100);
    const won = roll <= need;
    const dial = h('div', { class: 'rg-dial', style: { '--p': String(chance) } as any }, h('b', null, '··'), h('small', null, L(`benötigt ≤ ${need}`, `need ≤ ${need}`)));
    const wrap = h('div', { class: 'rg-overlay' }, dial);
    this.host.append(wrap);
    const num = dial.querySelector('b')!;
    let t = 0; const steps = 22;
    const spin = () => {
      t++;
      const shown = t < steps ? 1 + Math.floor(Math.random() * 100) : roll;
      num.textContent = String(shown);
      snd.reel();
      if (t < steps) setTimeout(spin, 40 + t * t * 0.6);
      else {
        wrap.classList.add(won ? 'won' : 'lost');
        if (won) { snd.win(); this.particles.burst(innerWidth / 2, innerHeight / 2, 50, 0x5aff9a, 300); }
        else { snd.lose(); shake(this.host, 1.5); if (roll - need <= 5) num.textContent = `${roll}  ${L('knapp!', 'so close!')}`; }
        setTimeout(() => { wrap.remove(); cb(won); }, 1300);
      }
    };
    spin();
  }

  private async resolveEvent(list: EventOption['win'], text?: [string, string], won = true) {
    const run = this.run!;
    const res = applyOutcomes(run, list);
    this.save();
    if (res.fight) { await this.fight(res.fight === 'elite' ? 'elite' : 'fight'); return; }
    if (res.remove) await this.removeCard(true);
    if (res.upgrade) await this.upgradeCard();
    this.clear('event');
    const box = h('div', { class: 'rg-panel' });
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()),
      h('h2', { class: 'rg-title ' + (won ? 'good' : 'bad') }, text ? tx(text) : L('Weiter geht’s.', 'Onwards.')),
      h('div', { class: 'rg-lines' + (won ? '' : ' bad') }, res.lines.map(l => h('span', null, l))), box);
    if (res.pickCard) {
      box.append(h('div', { class: 'rg-sec' }, L('Wähle eine Karte', 'Choose a card')));
      const row = h('div', { class: 'rg-cardpick' });
      for (const id of res.pickCard) {
        const el = cardEl(id); el.classList.add('reveal');
        el.addEventListener('click', () => { runCtx(run).addCard(id); this.save(); row.remove(); snd.card(); });
        row.append(el);
      }
      box.append(row);
    }
    box.append(h('button', { class: 'rg-go', onclick: () => this.done() }, h('b', null, L('Weiter', 'Continue'))));
  }

  private async upgradeCard() {
    const run = this.run!;
    const c = await pickFromDeck(run, L('Karte aufwerten', 'Upgrade a card'), x => !x.up && CARD[x.id].type !== 'curse', 'up');
    if (c) { c.up = true; snd.win(); this.save(); }
    return !!c;
  }
  private async removeCard(free = false) {
    const run = this.run!;
    const c = await pickFromDeck(run, L('Karte entfernen', 'Remove a card'), () => true, 'remove');
    if (c) { run.deck = run.deck.filter(x => x !== c); if (!free) { run.gold -= removeCost(run); run.removes++; } snd.open(); this.save(); }
    return !!c;
  }

  // =========================================================================================== Händler
  private shop() {
    const run = this.run!;
    const r = rngOf(run);
    let cards = cardOffer(run, 5, 10).map(id => ({ id, price: cardPrice(CARD[id].rarity, r), sold: false }));
    const relics = [...relicOffer(run, 2), ...relicOffer(run, 1, 'cursed')].map(id => ({ id, price: Math.round(relicPrice(RELIC[id].rarity, r) * (RELIC[id].cursed ? 0.6 : 1)), sold: false }));
    let removed = false;
    const render = () => {
      this.clear('shop');
      const box = h('div', { class: 'rg-panel' });
      this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()), h('div', { class: 'rg-evhead' }, h('div', { class: 'ic' }, '🛒'), h('h2', null, L('Der Möbius-Händler', 'The Möbius Merchant'))), box);
      const grid = h('div', { class: 'rg-shopgrid' });
      for (const c of cards) {
        const el = h('div', { class: 'rg-ware' + (c.sold ? ' sold' : '') }, cardEl(c.id), h('div', { class: 'price' + (run.gold < c.price ? ' no' : '') }, c.sold ? L('verkauft', 'sold') : `${c.price} 🪙`));
        el.addEventListener('click', () => { if (c.sold || run.gold < c.price) { snd.miss(); return; } run.gold -= c.price; runCtx(run).addCard(c.id); c.sold = true; snd.coin(); this.save(); render(); });
        grid.append(el);
      }
      box.append(h('div', { class: 'rg-sec' }, L('Karten', 'Cards')), grid,
        h('button', { class: 'rg-btn', disabled: run.gold < rerollCost(run), onclick: () => { if (payReroll(run)) { cards = cardOffer(run, 5, 10).map(id => ({ id, price: cardPrice(CARD[id].rarity, r), sold: false })); snd.reel(); render(); } } },
          `🔁 ${L('Neue Ware', 'Restock')} · ${rerollCost(run) || L('gratis', 'free')}${rerollCost(run) ? ' 🪙' : ''}`));
      box.append(h('div', { class: 'rg-sec' }, L('Relikte', 'Relics')));
      for (const x of relics) {
        const rr = RELIC[x.id];
        box.append(h('button', { class: 'rg-relicopt row' + (rr.cursed ? ' cursed' : '') + (x.sold ? ' sold' : ''), disabled: x.sold || run.gold < x.price, onclick: () => {
          run.gold -= x.price; addRelic(run, x.id); x.sold = true; snd.coin(); this.save(); render();
        } }, h('span', { class: 'ic' }, rr.icon), h('div', null, h('b', null, tx(rr.name)), h('small', null, tx(rr.text))), h('span', { class: 'price' }, x.sold ? '✓' : `${x.price} 🪙`)));
      }
      const rc = removeCost(run);
      box.append(h('div', { class: 'rg-sec' }, L('Dienste', 'Services')),
        h('button', { class: 'rg-opt', disabled: removed || run.gold < rc, onclick: async () => { if (await this.removeCard()) { removed = true; render(); } } },
          h('b', null, L('Karte entfernen', 'Remove a card')), h('small', null, `${rc} 🪙`)),
        h('button', { class: 'rg-go', onclick: () => this.done() }, h('b', null, L('Weiter', 'Leave'))));
    };
    render();
  }

  // =========================================================================================== Casino
  private casino() {
    const run = this.run!;
    let spins = 0;
    const render = () => {
      this.clear('casino');
      const box = h('div', { class: 'rg-panel' });
      this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()),
        h('div', { class: 'rg-evhead' }, h('div', { class: 'ic' }, '🎰'), h('h2', null, L('Casino Primo', 'Casino Primo'))),
        h('p', { class: 'rg-evtext' }, L('Nur Spielgold, kein echtes Geld. Das Haus gewinnt meistens – aber nicht immer.', 'In-game gold only, never real money. The house usually wins – but not always.')), box);
      // Automat
      const reels = [0, 1, 2].map(() => h('div', { class: 'rg-reel' }, h('div', { class: 'strip' })));
      const slot = h('div', { class: 'rg-slot' }, h('div', { class: 'rg-reels' }, reels), h('div', { class: 'rg-paytable' },
        h('span', null, '★★★ = JACKPOT ×30'), h('span', null, 'πππ ×20'), h('span', null, '777 ×12'), h('span', null, L('Primsumme ×2', 'Prime sum ×2')), h('span', null, L('Paar ×1,5', 'Pair ×1.5'))));
      const bets = [10, 25, 50];
      box.append(h('div', { class: 'rg-sec' }, L('Primzahl-Automat', 'Prime slot machine')), slot,
        h('div', { class: 'row' }, bets.map(b => h('button', { class: 'rg-btn', disabled: run.gold < b || spins >= 8, onclick: () => this.spin(reels, b, () => { spins++; render(); }) }, `${b} 🪙`))),
        spins >= 8 ? h('small', { class: 'muted' }, L('Der Automat ist heiß gelaufen.', 'The machine has overheated.')) : '');
      // Würfel
      box.append(h('div', { class: 'rg-sec' }, L('Über / Unter 7 (zwei Würfel)', 'Over / Under 7 (two dice)')),
        h('div', { class: 'row' },
          h('button', { class: 'rg-btn', disabled: run.gold < 20, onclick: () => this.dice('under', 20, render) }, L('Unter 7 · ×2', 'Under 7 · ×2')),
          h('button', { class: 'rg-btn risk', disabled: run.gold < 20, onclick: () => this.dice('seven', 20, render) }, L('Genau 7 · ×5', 'Exactly 7 · ×5')),
          h('button', { class: 'rg-btn', disabled: run.gold < 20, onclick: () => this.dice('over', 20, render) }, L('Über 7 · ×2', 'Over 7 · ×2'))),
        h('small', { class: 'muted' }, L('Einsatz 20 🪙 · Chancen: unter 7 = 42 %, genau 7 = 17 %, über 7 = 42 %', 'Stake 20 🪙 · odds: under 7 = 42 %, exactly 7 = 17 %, over 7 = 42 %')));
      // Blut für Gold
      box.append(h('div', { class: 'rg-sec' }, L('Blutwette', 'Blood bet')),
        h('button', { class: 'rg-opt', disabled: run.hp <= 10, onclick: () => {
          run.hp -= 8; const r = rngOf(run)();
          if (r < 0.55) { runCtx(run).gainGold(45); toast(L('+45 🪙 für 8 ❤', '+45 🪙 for 8 ❤')); snd.coin(); } else { const id = relicOffer(run, 1, 'cursed')[0]; if (id) { addRelic(run, id); toast(`${RELIC[id].icon} ${tx(RELIC[id].name)}`); } snd.lose(); }
          this.save(); render();
        } }, h('b', null, L('8 ❤ einsetzen', 'Bet 8 ❤')), h('small', null, L('55 %: +45 Gold · 45 %: ein verfluchtes Relikt', '55 %: +45 gold · 45 %: a cursed relic'))),
        h('button', { class: 'rg-go', onclick: () => this.done() }, h('b', null, L('Casino verlassen', 'Leave casino'))));
    };
    render();
  }

  /** Automat: Ergebnis wird vorher gezogen, dann laufen die Walzen aus (dritte langsamer – Beinahe-Treffer sichtbar). */
  private spin(reels: HTMLElement[], bet: number, after: () => void) {
    const run = this.run!;
    const r = rngOf(run);
    run.gold -= bet;
    const SYM = ['2', '3', '5', '7', 'π', '★', '☠'];
    const W: [string, number][] = [['2', 22], ['3', 20], ['5', 17], ['7', 12], ['π', 8], ['★', 4], ['☠', 9]];
    let res = [weighted(r, W), weighted(r, W), weighted(r, W)];
    // Jackpot bleibt selten und unabhängig von Pity
    if (r() < 1 / 160) res = ['★', '★', '★'];
    let pay = payout(res);
    // Pity: nach 4 Nieten gibt es mindestens ein Paar
    if (pay.mult === 0 && run.pityCasino >= 4) { res = [res[0], res[0], res[2] === res[0] ? '3' : res[2]]; pay = payout(res); }
    // Beinahe-Treffer: bei Nieten oft zwei gleiche hohe Symbole vorne
    if (pay.mult === 0 && r() < 0.4) { const hi = pick(r, ['7', 'π', '★']); res = [hi, hi, pick(r, SYM.filter(s => s !== hi && s !== '☠'))]; pay = payout(res); }
    reels.forEach((rl, i) => {
      const strip = rl.querySelector('.strip') as HTMLElement;
      const seq = Array.from({ length: 18 + i * 8 }, () => pick(Math.random, SYM)).concat(res[i]);
      strip.innerHTML = seq.map(s => `<div>${s}</div>`).join('');
      strip.style.transition = 'none'; strip.style.transform = 'translateY(0)';
      void strip.offsetHeight;
      strip.style.transition = `transform ${1.1 + i * 0.55 + (i === 2 && res[0] === res[1] ? 0.9 : 0)}s cubic-bezier(.12,.75,.2,1)`;
      strip.style.transform = `translateY(calc(-${seq.length - 1} * var(--sym)))`;
    });
    const tick = setInterval(() => snd.reel(), 90);
    const total = 1100 + 2 * 550 + (res[0] === res[1] ? 900 : 0) + 150;
    setTimeout(() => {
      clearInterval(tick);
      const win = Math.round(bet * pay.mult);
      if (pay.mult > 0) {
        runCtx(run).gainGold(win); run.stats.goldWon += win; track('casinoWon', win - bet); run.pityCasino = 0;
        if (pay.jackpot) {
          snd.jackpot(); flash(this.host, 'rgba(255,210,90,.7)', 900); shake(this.host, 3); haptic('success');
          for (let k = 0; k < 4; k++) setTimeout(() => this.particles.burst(Math.random() * innerWidth, innerHeight * 0.4, 70, 0xffd25a, 420), k * 200);
          const id = relicOffer(run, 1, 'legendary')[0]; if (id) addRelic(run, id);
          run.stats.jackpots++; unlock('jackpot');
          toast(L(`JACKPOT! +${win} 🪙 und ein legendäres Relikt!`, `JACKPOT! +${win} 🪙 and a legendary relic!`), 3500);
        } else { snd.win(); this.particles.burst(innerWidth / 2, innerHeight * 0.35, 30 + pay.mult * 4, 0xffd25a, 280); toast(`${pay.label} +${win} 🪙`); }
        if (pay.card) { runCtx(run).addCard(cardOffer(run, 1, 40)[0]); }
      } else {
        run.pityCasino++;
        if (res.every(s => s === '☠')) { runCtx(run).addCard('gier'); toast(L('☠☠☠ – Gier verflucht dich!', '☠☠☠ – Greed curses you!')); }
        snd.lose(); if (res[0] === res[1]) toast(L('So knapp!', 'So close!'));
      }
      this.save(); after();
    }, total);
  }

  private dice(kind: 'under' | 'seven' | 'over', bet: number, after: () => void) {
    const run = this.run!;
    const r = rngOf(run);
    run.gold -= bet;
    const a = 1 + Math.floor(r() * 6), b = 1 + Math.floor(r() * 6), s = a + b;
    const won = kind === 'under' ? s < 7 : kind === 'over' ? s > 7 : s === 7;
    const mult = kind === 'seven' ? 5 : 2;
    const box = h('div', { class: 'rg-dice' }, h('span', null, '⚀'), h('span', null, '⚀'));
    const wrap = h('div', { class: 'rg-overlay' }, box, h('div', { class: 'rg-coinmsg' }, '…'));
    this.host.append(wrap);
    const faces = '⚀⚁⚂⚃⚄⚅';
    let k = 0;
    const roll = setInterval(() => {
      (box.children[0] as HTMLElement).textContent = faces[Math.floor(Math.random() * 6)];
      (box.children[1] as HTMLElement).textContent = faces[Math.floor(Math.random() * 6)];
      snd.reel();
      if (++k > 14) {
        clearInterval(roll);
        (box.children[0] as HTMLElement).textContent = faces[a - 1]; (box.children[1] as HTMLElement).textContent = faces[b - 1];
        (wrap.lastChild as HTMLElement).textContent = `${s} – ${won ? L(`Gewonnen! +${bet * mult} 🪙`, `Won! +${bet * mult} 🪙`) : L('Verloren', 'Lost')}`;
        wrap.classList.add(won ? 'won' : 'lost');
        if (won) { runCtx(run).gainGold(bet * mult); track('casinoWon', bet * (mult - 1)); snd.win(); run.pityCasino = 0; } else { snd.lose(); run.pityCasino++; }
        setTimeout(() => { wrap.remove(); this.save(); after(); }, 1300);
      }
    }, 80);
  }

  // =========================================================================================== Rast
  private rest() {
    const run = this.run!;
    this.clear('rest');
    const heal = Math.round(run.maxHp * (0.3 + 0.1 * talent('heiler')));
    const box = h('div', { class: 'rg-panel' });
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()),
      h('div', { class: 'rg-evhead' }, h('div', { class: 'ic fire' }, '🔥'), h('h2', null, L('Rastplatz', 'Rest site'))), box);
    box.append(
      h('button', { class: 'rg-opt', onclick: () => { runCtx(run).heal(heal); snd.win(); this.done(); } }, h('b', null, L('Ausruhen', 'Rest')), h('small', null, `+${heal} ❤`)),
      h('button', { class: 'rg-opt', onclick: async () => { if (await this.upgradeCard()) this.done(); } }, h('b', null, L('Schmieden', 'Smith')), h('small', null, L('Eine Karte aufwerten (+)', 'Upgrade a card (+)'))),
      h('button', { class: 'rg-opt check', onclick: () => this.rollCheck(0.5 + run.luck, won => {
        if (won) { run.maxHp += 8; run.hp = run.maxHp; toast(L('Fiebertraum: +8 max. LP, voll geheilt!', 'Fever dream: +8 max HP, fully healed!')); }
        else { runCtx(run).addCard('zweifel'); toast(L('Albtraum: Zweifel im Deck.', 'Nightmare: Doubt joins your deck.')); }
        this.done();
      }) }, h('b', null, L('Fiebertraum (Risiko)', 'Fever dream (risk)')), h('small', null, L('50 %: +8 max. LP und volle Heilung · 50 %: Fluch', '50 %: +8 max HP and full heal · 50 %: curse'))));
  }

  // =========================================================================================== Truhe
  private chest() {
    const run = this.run!;
    this.clear('chest');
    const box = h('div', { class: 'rg-panel' });
    this.view.append(topBar(run, () => deckView(run.deck), () => this.runMenu()),
      h('div', { class: 'rg-evhead' }, h('div', { class: 'ic' }, '🎁'), h('h2', null, L('Zwei Truhen', 'Two chests'))),
      h('p', { class: 'rg-evtext' }, L('Eine schlichte Holztruhe – und eine, die leise flüstert.', 'A plain wooden chest – and one that whispers.')), box);
    const open = (cursed: boolean) => {
      const r = rngOf(run);
      const chestEl = h('div', { class: 'rg-chestanim' }, cursed ? '🗝️' : '📦');
      const wrap = h('div', { class: 'rg-overlay' }, chestEl);
      this.host.append(wrap);
      snd.open();
      setTimeout(() => {
        let lines: string[];
        if (!cursed) {
          const id = relicOffer(run, 1, r() < 0.7 ? 'common' : 'rare')[0];
          const g = 20 + Math.floor(r() * 25);
          if (id) addRelic(run, id); runCtx(run).gainGold(g);
          lines = [id ? `${RELIC[id].icon} ${tx(RELIC[id].name)}` : '', `+${g} 🪙`];
          wrap.classList.add('won'); snd.win();
        } else if (r() < 0.6 + run.luck) {
          const id = relicOffer(run, 1, r() < 0.25 ? 'legendary' : 'epic')[0];
          if (id) addRelic(run, id); runCtx(run).gainGold(60);
          lines = [`${L('JACKPOT', 'JACKPOT')}: ${id ? `${RELIC[id].icon} ${tx(RELIC[id].name)}` : ''}`, '+60 🪙'];
          wrap.classList.add('won'); snd.jackpot(); flash(this.host, 'rgba(255,210,90,.6)', 700); this.particles.burst(innerWidth / 2, innerHeight / 2, 120, 0xffd25a, 420);
        } else {
          const id = relicOffer(run, 1, 'cursed')[0];
          if (id) addRelic(run, id); runCtx(run).addCard(pick(r, ['bruch', 'gier']));
          lines = [L('FLUCH!', 'CURSED!'), id ? `${RELIC[id].icon} ${tx(RELIC[id].name)}` : ''];
          wrap.classList.add('lost'); snd.lose(); shake(this.host, 2);
        }
        wrap.append(h('div', { class: 'rg-coinmsg' }, lines.filter(Boolean).join(' · ')));
        this.save();
        setTimeout(() => { wrap.remove(); this.done(); }, 2000);
      }, 1100);
    };
    box.append(
      h('button', { class: 'rg-opt', onclick: () => open(false) }, h('b', null, `📦 ${L('Holztruhe', 'Wooden chest')}`), h('small', null, L('Sicher: Relikt (gewöhnlich/selten) + Gold', 'Safe: relic (common/rare) + gold'))),
      h('button', { class: 'rg-opt check', onclick: () => open(true) }, h('b', null, `🗝️ ${L('Flüsternde Truhe', 'Whispering chest')}`),
        h('small', null, L(`${Math.round((0.6 + run.luck) * 100)} %: episches/legendäres Relikt + 60 Gold · sonst Fluch + verfluchtes Relikt`, `${Math.round((0.6 + run.luck) * 100)} %: epic/legendary relic + 60 gold · else curse + cursed relic`))));
  }

  // =========================================================================================== Ende
  private lose(by: string) { this.result(false, by); }
  private win() { this.result(true); }

  private result(won: boolean, by?: string) {
    const run = this.run!;
    music(false);
    const res = finishRun(run, won, by);
    this.run = null;
    this.clear('result ' + (won ? 'won' : 'lost'));
    won ? snd.win() : snd.lose();
    const scoreEl = h('b', { class: 'rg-bignum' }, '0');
    const staubEl = h('b', null, '0');
    const goal = nextGoal(); const m = meta();
    this.view.append(
      h('div', { class: 'rg-resulthead' }, h('small', null, won ? L('DU HAST DEN ABGRUND BEZWUNGEN', 'YOU CONQUERED THE ABYSS') : L('DER LAUF IST VORBEI', 'THE RUN IS OVER')),
        h('h1', null, won ? L('Sieg!', 'Victory!') : L('Gefallen', 'Fallen')),
        by && !won ? h('p', { class: 'muted' }, L(`Besiegt von: ${by}`, `Defeated by: ${by}`)) : ''),
      h('div', { class: 'rg-scorebox' }, h('small', null, L('Punkte', 'Score')), scoreEl, res.newBest ? h('span', { class: 'rg-record' }, L('NEUER REKORD!', 'NEW RECORD!')) : ''),
      h('div', { class: 'rg-staubgain' }, '+', staubEl, ' ✨ ', L('Sternenstaub', 'stardust')),
      goal ? h('div', { class: 'rg-unlock' }, h('small', null, `${goal.label}: ${N(Math.min(m.staub, goal.cost))} / ${N(goal.cost)} ✨`), h('div', { class: 'rg-bar' }, h('i', { style: { width: `${Math.min(100, (m.staub / goal.cost) * 100)}%` } }))) : '',
      h('div', { class: 'rg-stats' },
        h('div', null, h('b', null, `${run.act}/${run.floor}`), h('small', null, L('Akt/Etage', 'Act/floor'))),
        h('div', null, h('b', null, N(run.stats.kills)), h('small', null, L('Siege', 'Kills'))),
        h('div', null, h('b', null, N(run.stats.maxCombo)), h('small', null, L('Max. Kombo', 'Max combo'))),
        h('div', null, h('b', null, N(run.stats.maxHit)), h('small', null, L('Max. Treffer', 'Max hit')))),
      h('div', { class: 'rg-endbtns' },
        h('button', { class: 'rg-go', onclick: () => this.start(run.cls, newSeed(), run.ascension) }, h('b', null, L('Sofort neuer Lauf', 'New run now')), h('small', null, '⚡')),
        h('button', { class: 'rg-btn ghost', onclick: () => this.hub() }, L('Zum Hub', 'To hub'))));
    countUp(scoreEl, res.score, 1200, v => N(v));
    setTimeout(() => countUp(staubEl, res.staub, 900, v => N(v)), 500);
    if (won) for (let k = 0; k < 6; k++) setTimeout(() => this.particles.burst(Math.random() * innerWidth, innerHeight * 0.3, 60, [0xffd25a, 0x8f7bff, 0x5aff9a][k % 3], 380), k * 250);
  }
}

function payout(res: string[]): { mult: number; label: string; jackpot?: boolean; card?: boolean } {
  const [a, b, c] = res;
  if (a === b && b === c) {
    if (a === '★') return { mult: 30, label: 'JACKPOT', jackpot: true };
    if (a === 'π') return { mult: 20, label: 'πππ', card: true };
    if (a === '☠') return { mult: 0, label: '☠☠☠' };
    return { mult: ({ '2': 5, '3': 6, '5': 8, '7': 12 } as Record<string, number>)[a] ?? 5, label: `${a}${a}${a}` };
  }
  const nums = res.filter(s => /\d/.test(s)).map(Number);
  if (nums.length === 3) { const s = nums[0] + nums[1] + nums[2]; const p = [2, 3, 5, 7, 11, 13, 17, 19].includes(s); if (p) return { mult: 2, label: L(`Primsumme ${s}`, `Prime sum ${s}`) }; }
  if ((a === b || b === c || a === c) && !res.includes('☠')) return { mult: 1.5, label: L('Paar', 'Pair') };
  return { mult: 0, label: '' };
}

function outcomeText(list: EventOption['win']) {
  const p: string[] = [];
  for (const o of list) {
    if (o.gold) p.push(`${o.gold > 0 ? '+' : ''}${o.gold}🪙`);
    if (o.hp) p.push(`${o.hp > 0 ? '+' : ''}${o.hp}❤`);
    if (o.maxHp) p.push(`${o.maxHp > 0 ? '+' : ''}${o.maxHp} max❤`);
    if (o.staub) p.push(`+${o.staub}✨`);
    if (o.card) p.push(L('Karte', 'card'));
    if (o.relic) p.push(o.relic === 'cursed' ? L('verfl. Relikt', 'cursed relic') : `${L('Relikt', 'relic')} (${o.relic})`);
    if (o.curse) p.push(L('Fluch', 'curse'));
    if (o.removeCard) p.push(L('Karte entfernen', 'remove card'));
    if (o.upgradeCard) p.push(L('Aufwerten', 'upgrade'));
    if (o.fight) p.push(o.fight === 'elite' ? L('Elite-Kampf', 'elite fight') : L('Kampf', 'fight'));
  }
  return p.join(' ') || '—';
}
