// Kampfbildschirm: Gegner in Jugendstil-Bogenrahmen oben, darunter der Messing-Reaktor (3×3-Automat).
// Walzen laufen sichtbar aus (die letzte am längsten), Linien leuchten, Symbole feuern nacheinander.
import { L } from '../../core/i18n';
import { h, sheet } from '../../ui/dom';
import { SYM } from '../data/symbols';
import { ENEMY } from '../data/enemies';
import { SHIP } from '../data/ships';
import { BAL, LINES, Reactor, ReactorEvent } from '../reactor';
import { Particles, flash, floatText, haptic, shake, slowmo, snd } from '../juice';
import { enemySvg, shipSvg, symbolSvg } from '../art';
import { discover, track, unlock } from '../meta';
import { Foe, Intent, Run } from '../types';
import { moduleEl, roman, showConsts, showReels, tx } from './parts';
import { CONST } from '../data/constellations';
import { pace, sfs } from '../settings';
import { showSettings } from './settingsView';
import { TRAIT, traitsOf } from '../data/traits';
import { TAG_INFO } from '../data/symbols';
import { ornament } from '../art';

export interface FightResult { won: boolean; killedBy: string; boss: boolean; overheats: number }

export function runFight(host: HTMLElement, run: Run, ids: string[], kind: 'fight' | 'elite' | 'boss', particles: Particles, bg: [string, string], onPause: () => void): Promise<FightResult> {
  return new Promise(resolve => {
    host.innerHTML = '';
    const root = h('div', { class: `sf-fight${kind === 'boss' ? ' boss' : ''}`, style: { '--bg1': bg[0], '--bg2': bg[1] } as any });
    const topEl = h('div', { class: 'sf-ftop' });
    const foesEl = h('div', { class: 'sf-foes' });
    const logEl = h('div', { class: 'sf-log' });
    const heatEl = h('div', { class: 'sf-heat' });
    const reelsEl = h('div', { class: 'sf-machine-reels' });
    const linesSvg = h('div', { class: 'sf-lines' });
    const holdRow = h('div', { class: 'sf-holds' });
    const spinBtn = h('button', { class: 'sf-spin' });
    const endBtn = h('button', { class: 'sf-endturn' }, L('Andocken', 'Dock'), h('small', null, L('Zug beenden', 'end turn')));
    const pips = h('div', { class: 'sf-pips' });
    const statusEl = h('div', { class: 'sf-hero' });
    const fx = h('div', { class: 'sf-fx' });
    const crest = h('button', { class: 'sf-crest', onclick: () => showConsts(run) });
    // Jugendstil-Krone mit Sternenherz-Kristall, seitliche Hitzesäulen
    const crown = h('div', { class: 'sf-crown', html: crownSvg(run.ship) });
    const pillar = (side: string) => h('div', { class: 'sf-pillar ' + side }, h('i'));
    const machine = h('div', { class: 'sf-machine', 'data-ship': run.ship },
      crown, pillar('l'), pillar('r'),
      crest,
      h('div', { class: 'sf-window' }, reelsEl, linesSvg), holdRow,
      h('div', { class: 'sf-controls' }, heatEl, h('div', { class: 'sf-spinwrap' }, spinBtn, pips), endBtn));
    root.append(topEl, foesEl, logEl, statusEl, machine, fx);
    host.append(root);

    const foeNode = new Map<number, HTMLElement>();
    const diedAt = new Map<number, number>();
    const cellEl: HTMLElement[][] = [[], [], []];
    let busy = false;
    let reactorRef: Reactor | null = null;
    const reactor = () => reactorRef!;
    let lastFire: { reel: number; row: number; color: string } | null = null;   // Quelle für Geschosse
    const seen = new Set<number>();                                               // Gegner, die schon eingewarpt sind
    let overheatsHere = 0;

    const center = (el?: Element | null) => { const r = (el ?? root).getBoundingClientRect(), hr = host.getBoundingClientRect(); return [r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2] as const; };
    /** Lichtgeschoss von der feuernden Zelle zum Gegner (Farbe der Familie). */
    function bolt(toEl: Element | null | undefined, color: string, big: boolean) {
      if (!lastFire || !toEl) return;
      const from = cellEl[lastFire.reel]?.[lastFire.row]; if (!from) return;
      const [x1, y1] = center(from), [x2, y2] = center(toEl);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const b = h('i', { class: 'sf-bolt' + (big ? ' big' : ''), style: { left: `${x1}px`, top: `${y1}px`, width: `${len}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)`, '--bc': color } as any });
      fx.append(b); setTimeout(() => b.remove(), 420);
      particles.burst(x2, y2, big ? 14 : 6, parseInt(color.slice(1), 16), big ? 200 : 120);
    }
    const ui = {
      emit(e: ReactorEvent) {
        switch (e.t) {
          case 'hitFoe': {
            const el = foeNode.get(e.uid); const [x, y] = center(el);
            if (lastFire) bolt(el, lastFire.color, e.crit);
            if (e.n > 0) {
              floatText(fx, x, y - 10, `−${e.n}`, e.crit ? 'crit' : 'dmg');
              particles.burst(x, y, e.crit ? 36 : 12, e.crit ? 0xe8c070 : 0xe07a6a, e.crit ? 300 : 180);
              snd.hit(e.crit); if (e.crit) shake(root, 1.6);
              el?.classList.remove('hurt'); void el?.offsetWidth; el?.classList.add('hurt');
            } else floatText(fx, x, y - 10, e.blocked ? `⛨${e.blocked}` : '0', 'blk');
            break;
          }
          case 'hitHero': { const [x, y] = center(statusEl); if (e.n > 0) { floatText(fx, x, y - 20, `−${e.n}`, 'hurt'); snd.hurt(); shake(root, e.n >= 15 ? 2.4 : 1.1); flash(root, 'rgba(200,60,60,.32)'); haptic('error'); } else if (e.blocked) { floatText(fx, x, y - 20, `⛨ ${e.blocked}`, 'blk'); snd.block(); } break; }
          case 'block': { const [x, y] = center(statusEl); if (e.n > 0) floatText(fx, x - 40, y - 20, `+${e.n} ⛨`, 'blk'); break; }
          case 'heal': { const [x, y] = center(statusEl); floatText(fx, x + 40, y - 20, `+${e.n}`, 'heal'); break; }
          case 'fire': { const sym = reactor().grid[e.reel]?.[e.row]; lastFire = { reel: e.reel, row: e.row, color: sym ? TAG_INFO[SYM[sym.id].tag].color : '#e8c070' }; const cel = cellEl[e.reel]?.[e.row]; if (cel) { cel.classList.remove('fire', 'flare'); void cel.offsetWidth; cel.classList.add('fire', 'flare'); if (e.m >= 2) cel.classList.add('m' + Math.min(3, e.m)); } snd.card(); break; }
          case 'line': drawLine(e.cells.map(c => [c.reel, c.row] as [number, number]), e.kind);
            if (e.kind === 'jackpot') { snd.jackpot(); flash(root, 'rgba(232,192,112,.5)', 600); shake(root, 2); haptic('success'); const [x, y] = center(reelsEl); particles.burst(x, y, 90, 0xe8c070, 380, 4); }
            else { snd.prime(2); const [x, y] = center(reelsEl); particles.burst(x, y, 24, 0x9fd0c8, 220); }
            break;
          case 'kill': { const el = foeNode.get(e.uid); const [x, y] = center(el); particles.burst(x, y, e.boss ? 180 : 50, e.boss ? 0xf0d080 : 0xe0a070, e.boss ? 420 : 260, e.boss ? 5 : 3); snd.kill(); el?.classList.add('dead'); diedAt.set(e.uid, performance.now()); if (e.boss) { snd.bosskill(); slowmo(root, particles, 1800); flash(root, '#fff6dc', 700); shake(root, 3); haptic('success'); } break; }
          case 'rad': { const el = foeNode.get(e.uid); const [x, y] = center(el); floatText(fx, x, y + 14, e.n > 0 ? `☢ −${e.n}` : `☢ +${-e.n}`, 'psn'); break; }
          case 'log': logEl.textContent = e.text; logEl.classList.remove('in'); void logEl.offsetWidth; logEl.classList.add('in'); break;
          case 'foeNote': { const el = foeNode.get(e.uid); const [x, y] = center(el); floatText(fx, x, y - 30, e.text, e.good ? 'heal' : 'blk'); break; }
          case 'shake': shake(root, e.n); break;
          case 'gold': if (e.n) { const [x, y] = center(statusEl); floatText(fx, x, y - 44, `${e.n > 0 ? '+' : ''}${e.n} ✦`, 'gold'); snd.coin(); } break;
          case 'overheat': overheatsHere++; snd.overheat(); flash(root, 'rgba(255,90,40,.5)', 700); shake(root, 2.5); machine.classList.remove('overheat'); void machine.offsetWidth; machine.classList.add('overheat'); { const [x, y] = center(heatEl); particles.burst(x, y, 60, 0xd0d0d0, 200, 6); } break;
          case 'heat': renderHeat(); break;
          case 'enemyAct': foeNode.get(e.uid)?.classList.add('acting'); setTimeout(() => foeNode.get(e.uid)?.classList.remove('acting'), 500); break;
          case 'spawn': break;
        }
      },
      pause: (ms: number) => new Promise<void>(r => setTimeout(() => { renderFoes(); renderStatus(); r(); }, ms * pace())),
    };

    const c = new Reactor(run, ids, ui, kind);
    reactorRef = c;
    {
      const act = Object.entries(c.cl).filter(([, t]) => t > 0);
      if (act.length) crest.append(...act.map(([id, t]) => h('span', { class: 'sf-cchip', style: { '--cc': CONST[id].color } as any }, `${CONST[id].icon} ${roman(t)}`)));
      else crest.append(h('span', null, '✦'), h('b', null, L('Sternenreaktor', 'Star Reactor')), h('span', null, '✦'));
    }
    for (const id of ids) discover('foes', id);

    // ------------------------------------------------------------------------- Linien
    function drawLine(cells: [number, number][], kind: 'synergy' | 'jackpot') {
      const pts = cells.map(([r, k]) => `${16.67 + r * 33.33},${16.67 + k * 33.33}`).join(' ');
      const el = h('div', { class: 'sf-line ' + kind, html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" /></svg>` });
      linesSvg.append(el);
      setTimeout(() => el.remove(), 1400);
    }

    // ------------------------------------------------------------------------- Darstellung
    const intentOf = (it: Intent, f: Foe): [string, string, string] => {
      const dm = (n: number) => { let x = (n + f.str) * BAL.foeDmg(f.id) * BAL.tierDmg[c.tier - 1]; if (f.weak) x *= 0.75; if (c.vuln) x *= 1.5; x *= 1 + (run.mods.taken ?? 0) + run.ascension * 0.04; return Math.floor(x); };
      switch (it.k) {
        case 'atk': return ['⚔', `${dm(it.n)}${it.times && it.times > 1 ? `×${it.times}` : ''}`, 'atk'];
        case 'block': return ['⛨', String(Math.round(it.n * BAL.foeBlock)), 'def'];
        case 'buff': return ['▲', `+${it.str}`, 'buf'];
        case 'debuff': return ['☾', it.jam ? L('Klemmen', 'Jam') : '', 'deb'];
        case 'rad': return ['☢', String(it.n), 'deb'];
        case 'heat': return ['♨', `+${it.n}`, 'deb'];
        case 'junk': return ['☠', L('Schrott', 'Junk'), 'deb'];
        case 'summon': return ['✚', '', 'buf'];
        case 'heal': return ['✚', String(it.n), 'buf'];
        case 'special': return [it.icon, tx(it.name), 'spc'];
      }
    };
    const chips = (o: { block: number; rad: number; weak: number; vuln: number; str: number; stun?: number }) => h('div', { class: 'sf-chips' },
      o.block ? h('span', { class: 'blk' }, `⛨${o.block}`) : '', o.rad ? h('span', { class: 'rad' }, `☢${o.rad}`) : '', o.weak ? h('span', { class: 'deb' }, `↓${o.weak}`) : '',
      o.vuln ? h('span', { class: 'deb' }, `✕${o.vuln}`) : '', o.str ? h('span', { class: 'buf' }, `▲${o.str}`) : '', o.stun ? h('span', { class: 'stun' }, `❄${o.stun}`) : '');

    function renderTop() {
      const sh = SHIP[run.ship];
      topEl.innerHTML = '';
      topEl.append(h('div', { class: 'sf-ship', html: shipSvg(sh.hull, sh.hue) }),
        h('div', { class: 'sf-stat hp' }, h('i', { style: { width: `${Math.max(0, run.hp / run.maxHp) * 100}%` } }), h('span', null, `${Math.max(0, run.hp)}/${run.maxHp}`)),
        h('div', { class: 'sf-stat gold' }, h('i', { class: 'sfc' }), ` ${run.gold}`),
        h('button', { class: 'sf-ib', onclick: () => showReels(run) }, '⚙'),
        h('button', { class: 'sf-ib', onclick: menu }, '☰'),
        h('div', { class: 'sf-mods' }, run.modules.map(id => moduleEl(id))));
    }
    function renderFoes() {
      const now = performance.now();
      foesEl.innerHTML = '';
      foesEl.dataset.n = String(c.alive().length);
      for (const f of c.foes) {
        if (f.dead && now - (diedAt.get(f.uid) ?? 0) > 650) continue;
        const d = ENEMY[f.id];
        const [ic, num, cls] = intentOf(f.intent, f);
        const fresh = !seen.has(f.uid); seen.add(f.uid);
        const el = h('div', { class: `sf-foe ${d.tier}${f.dead ? ' dead' : ''}${c.target === f ? ' tgt' : ''}${fresh ? ' warpin' : ''}` },
          f.dead ? '' : h('div', { class: 'sf-intent ' + cls }, h('b', null, ic), num),
          h('div', { class: 'sf-foeart', html: enemySvg(d.look) }),
          h('div', { class: 'sf-fname' }, tx(d.name)),
          traitsOf(f.id).length ? h('div', { class: 'sf-traits' }, traitsOf(f.id).map(t => h('span', { class: TRAIT[t].good ? 'good' : 'bad', title: tx(TRAIT[t].name) }, TRAIT[t].icon))) : '',
          h('div', { class: 'sf-hpbar' }, h('i', { style: { width: `${Math.max(0, f.hp / f.max) * 100}%` } }), h('span', null, `${Math.max(0, f.hp)}/${f.max}`)),
          chips(f));
        el.addEventListener('click', () => { if (!f.dead) { c.target = f; snd.card(); renderFoes(); } });
        let lp = 0;
        el.addEventListener('pointerdown', () => { lp = window.setTimeout(() => sheet(tx(d.name), h('div', { class: 'sf-foebig', html: enemySvg(d.look) }), h('p', { class: 'small' }, d.passive ? tx(d.passive) : L('Keine Sonderregel.', 'No special rule.')), traitList(f.id)), 450); });
        el.addEventListener('pointerup', () => clearTimeout(lp)); el.addEventListener('pointerleave', () => clearTimeout(lp));
        foeNode.set(f.uid, el);
        foesEl.append(el);
      }
    }
    function renderHeat() {
      heatEl.innerHTML = '';
      const max = c.heatMax;
      const segs = h('div', { class: 'sf-heatsegs' });
      for (let i = 0; i < max; i++) segs.append(h('i', { class: i < c.heat ? (c.heat >= max - 1 ? 'hot' : 'on') : '' }));
      const next = c.spinHeat();
      heatEl.append(h('small', null, L('Hitze', 'Heat')), segs, h('b', { class: c.heat + next > max ? 'warn' : '' }, `${c.heat}/${max}`));
      heatEl.classList.toggle('danger', c.heat + next > max);
      machine.style.setProperty('--heat', String(Math.min(1, c.heat / max)));
      machine.classList.toggle('hot', c.heat >= max - 1);
    }
    function renderStatus() {
      statusEl.innerHTML = '';
      statusEl.append(chips({ block: c.block, rad: c.rad, weak: c.weak, vuln: c.vuln, str: c.str }),
        c.jam ? h('span', { class: 'sf-jam' }, `❄ ${L('Störung', 'Jam')} ${c.jam}`) : '');
      renderTop();
      renderHeat();
      pips.innerHTML = '';
      for (let i = 0; i < c.spinsLeft; i++) pips.append(h('i'));
      const willOver = c.heat + c.spinHeat() > c.heatMax;
      spinBtn.innerHTML = '';
      spinBtn.append(h('b', null, c.spin === 0 ? L('Drehen', 'Spin') : L('Nochmal', 'Again')), h('small', null, c.spinsLeft ? `+${c.spinHeat()} ♨${willOver ? ' ⚠' : ''}` : L('keine Drehs', 'no spins')));
      spinBtn.disabled = busy || !c.canSpin();
      spinBtn.classList.toggle('risky', willOver && c.canSpin());
      endBtn.disabled = busy || !!c.over || c.spin === 0 && c.spinsLeft > 0 && c.turn === 1 && false;
      endBtn.classList.toggle('glow', !busy && !c.canSpin());
      holdRow.innerHTML = '';
      [0, 1, 2].forEach(r => {
        const pk = c.peek(r), pd = SYM[pk.id];
        const mode = c.held[r] ? 'on' : c.nudge[r] ? 'nudge' : '';
        const b = h('button', { class: 'sf-hold ' + mode, disabled: busy || c.spin === 0 || !c.canSpin() },
          h('span', null, c.held[r] ? L('🔒 Halten', '🔒 Hold') : c.nudge[r] ? L('▲ Schubsen', '▲ Nudge') : L('Frei', 'Free')),
          c.spin > 0 ? h('i', { class: 'sf-peek', title: tx(pd.name), html: symbolSvg(pd.art, pd.c1, pd.c2) }) : '');
        b.addEventListener('click', () => { if (c.toggleHold(r)) { snd.hold(); renderReelsStatic(); renderStatus(); } });
        holdRow.append(b);
      });
    }
    function cell(s: { id: string; lv: number }, lite = false) {
      const d = SYM[s.id];
      return h('div', { class: `sf-cell t-${d.tag}${d.wild ? ' wild' : ''}` }, h('div', { class: 'sf-cellart', html: symbolSvg(d.art, d.c1, d.c2, lite) }), s.lv > 1 ? h('i', null, ['', '', 'II', 'III'][s.lv]) : '');
    }
    function renderReelsStatic() {
      reelsEl.innerHTML = '';
      for (let r = 0; r < 3; r++) {
        const col = h('div', { class: 'sf-reel' + (c.held[r] ? ' held' : c.nudge[r] ? ' nudged' : '') });
        const strip = h('div', { class: 'sf-strip' });
        cellEl[r] = c.grid[r].map(s => { const e = cell(s); strip.append(e); return e; });
        col.append(strip);
        col.addEventListener('click', () => { const s = c.grid[r][1]; if (s) sheet(tx(SYM[s.id].name), h('div', { class: 'sf-center', html: '' }), h('p', { class: 'small' }, tx(SYM[s.id].text(s.lv)))); });
        reelsEl.append(col);
      }
    }
    /** Walzen auslaufen lassen (nicht gehaltene); Dauer wächst je Walze, bei zwei gleichen davor noch länger (Spannung). */
    function animateSpin(heldBefore: boolean[], nudgeBefore: boolean[] = [false, false, false], oldGrid: { id: string; lv: number }[][] = []): Promise<void> {
      reelsEl.innerHTML = '';
      const cellH = reelsEl.clientHeight / 3 || 70;
      const tasks: Promise<void>[] = [];
      const near = c.grid[0][1].id === c.grid[1][1].id;
      for (let r = 0; r < 3; r++) {
        const col = h('div', { class: 'sf-reel' + (heldBefore[r] ? ' held' : '') });
        const strip = h('div', { class: 'sf-strip' });
        const reel = run.reels[r];
        const nudged = nudgeBefore[r] && oldGrid[r];
        const extra = heldBefore[r] ? 0 : nudged ? 1 : 16 + r * 7;
        const seq = nudged ? [oldGrid[r][0], ...c.grid[r]] : [...Array.from({ length: extra }, () => reel[Math.floor(Math.random() * reel.length)]), ...c.grid[r]];
        seq.forEach((s, i) => strip.append(cell(s, i < seq.length - 3 || sfs().gfx !== 'high')));   // Füller ohne Filter (flüssiges Drehen)
        cellEl[r] = [...strip.children].slice(-3) as HTMLElement[];
        col.append(strip);
        reelsEl.append(col);
        if (!extra) continue;
        const dur = (nudged ? 420 : 900 + r * 420 + (r === 2 && near ? 800 : 0)) * pace();
        // Web Animations statt CSS-Transition: läuft sicher an, auch wenn der Streifen erst in diesem Bild eingefügt wurde.
        const end = `translateY(${-extra * cellH}px)`;
        const anim = strip.animate([
          { transform: 'translateY(0)', filter: 'blur(0)' },
          { transform: `translateY(${-extra * cellH * 0.25}px)`, filter: 'blur(2.5px)', offset: 0.18 },
          { transform: `translateY(${-extra * cellH * 0.85}px)`, filter: 'blur(1.5px)', offset: 0.7 },
          { transform: end, filter: 'blur(0)' },
        ], { duration: dur, easing: 'cubic-bezier(.3,.1,.25,1.04)', fill: 'forwards' });
        strip.style.transform = end;
        tasks.push(new Promise(res => {
          let done = false;
          const fin = () => { if (done) return; done = true; snd.reel(); col.classList.add('stop'); res(); };
          anim.finished.then(fin, fin);
          setTimeout(fin, dur + 400); // Sicherheitsnetz, falls Animationen gedrosselt werden
        }));
      }
      const tick = setInterval(() => snd.reel(), 85);
      return Promise.all(tasks).then(() => { clearInterval(tick); });
    }

    // ------------------------------------------------------------------------- Eingaben
    spinBtn.addEventListener('click', async () => {
      if (busy || !c.canSpin()) return;
      busy = true; renderStatus();
      const heldBefore = [...c.held], nudgeBefore = [...c.nudge], oldGrid = c.grid.map(col => [...col]);
      c.spinOnce();
      snd.spin();
      machine.classList.add('spinning');
      await animateSpin(heldBefore, nudgeBefore, oldGrid);
      machine.classList.remove('spinning');
      renderStatus();
      await c.resolve();
      busy = false;
      renderReelsStatic(); renderFoes(); renderStatus();
      after();
    });
    endBtn.addEventListener('click', async () => {
      if (busy || c.over) return;
      busy = true; renderStatus();
      lastFire = null;
      turnBanner(L('Gegnerzug', 'Enemy turn'), 'foe');
      await new Promise(r => setTimeout(r, 450));
      await c.endTurn();
      if (!c.over) turnBanner(L(`Dein Zug · Runde ${c.turn}`, `Your turn · round ${c.turn}`), 'me');
      busy = false;
      renderReelsStatic(); renderFoes(); renderStatus();
      after();
    });

    function turnBanner(text: string, who: 'me' | 'foe') {
      root.querySelector('.sf-turn')?.remove();
      const b = h('div', { class: 'sf-turn ' + who }, h('span', null, text));
      root.append(b); setTimeout(() => b.remove(), 1300);
    }
    function after() {
      if (overheatsHere >= 3) unlock('overheat3');
      if (!c.over) return;
      busy = true; renderStatus();
      const won = c.over === 'win';
      if (won && kind === 'boss' && overheatsHere === 0) unlock('overheat0');
      track('overheats', overheatsHere);
      setTimeout(() => root.classList.add(won ? 'won' : 'lost'), kind === 'boss' && won ? 1400 : 300);
      setTimeout(() => resolve({ won, killedBy: c.killedBy, boss: kind === 'boss', overheats: overheatsHere }), kind === 'boss' && won ? 2500 : 1000);
    }
    function menu() {
      const close = sheet(L('Pause', 'Pause'), h('p', { class: 'muted small' }, `Seed ${run.seed}`),
        h('div', { class: 'stack', style: { gap: '10px' } },
          h('button', { class: 'btn block', onclick: () => { close(); showReels(run); } }, L('Walzen ansehen', 'View reels')),
          h('button', { class: 'btn block', onclick: () => { close(); rules(); } }, L('Spielregeln', 'Rules')),
          h('button', { class: 'btn block', onclick: () => { close(); showSettings(); } }, L('Einstellungen', 'Settings')),
          h('button', { class: 'btn block', onclick: () => { close(); onPause(); } }, L('Pause: zur Brücke (Lauf bleibt gespeichert)', 'Pause: to the bridge (run stays saved)'))));
    }

    c.start();
    renderReelsStatic(); renderFoes(); renderStatus();
    if (kind === 'boss') {
      const bd = ENEMY[ids[0]];
      busy = true; renderStatus();
      const card = h('div', { class: 'sf-bossintro' },
        h('small', null, bd.tier === 'final' ? L('Das Ende aller Sterne', 'The end of all stars') : L('Wächter des Sektors', 'Guardian of the sector')),
        h('div', { class: 'art', html: enemySvg(bd.look) }),
        h('b', null, tx(bd.name)), h('div', { html: ornament(220) }),
        bd.passive ? h('p', null, tx(bd.passive)) : '',
        h('div', { class: 'sf-traits big' }, traitsOf(bd.id).map(t => h('span', { class: TRAIT[t].good ? 'good' : 'bad' }, `${TRAIT[t].icon} ${tx(TRAIT[t].name)}`))));
      root.append(card);
      snd.jackpot(); shake(root, 2); flash(root, 'rgba(160,60,60,.45)', 800); haptic('error');
      const close = () => { if (!card.isConnected) return; card.classList.add('out'); setTimeout(() => card.remove(), 500); busy = false; renderStatus(); };
      card.addEventListener('click', close); setTimeout(close, 3200);
    } else turnBanner(L('Kampf!', 'Fight!'), 'me');
  });
}

/** Reaktor-Krone je Schiff (Jugendstil-Bogen + eigenes Herzstück). Farben kommen aus CSS-Variablen der Maschine. */
function crownSvg(ship: string) {
  const defs = `<defs><radialGradient id="sfgem" cx="50%" cy="40%" r="60%"><stop offset="0" style="stop-color:var(--gem0)"/><stop offset=".45" style="stop-color:var(--gem1)"/><stop offset="1" style="stop-color:var(--gem2)"/></radialGradient>
    <linearGradient id="sfgold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--trim0)"/><stop offset=".5" style="stop-color:var(--trim1)"/><stop offset="1" style="stop-color:var(--trim2)"/></linearGradient></defs>`;
  const arch = `<path d="M8 54 C8 26 70 12 180 10 C290 12 352 26 352 54" fill="none" stroke="url(#sfgold)" stroke-width="2.4"/>
    <path d="M22 54 C24 33 80 22 180 20 C280 22 336 33 338 54" fill="none" style="stroke:var(--trim1)" stroke-width="1" opacity=".7"/>`;
  const whips = `<path d="M150 30 C130 30 118 40 104 36 C92 33 92 22 102 22 C110 22 110 30 104 30" fill="none" stroke="url(#sfgold)" stroke-width="1.6"/>
    <path d="M210 30 C230 30 242 40 256 36 C268 33 268 22 258 22 C250 22 250 30 256 30" fill="none" stroke="url(#sfgold)" stroke-width="1.6"/>`;
  const dots = `<circle cx="60" cy="40" r="2.2" style="fill:var(--trim1)"/><circle cx="300" cy="40" r="2.2" style="fill:var(--trim1)"/>`;
  let heart: string, extra = '';
  switch (ship) {
    case 'astrolab': // Armillarsphäre: Ringe um eine runde Sonne
      extra = `<ellipse cx="180" cy="24" rx="34" ry="9" fill="none" stroke="url(#sfgold)" stroke-width="1.4" transform="rotate(-14 180 24)"/>
        <ellipse cx="180" cy="24" rx="30" ry="12" fill="none" stroke="url(#sfgold)" stroke-width="1" opacity=".8" transform="rotate(22 180 24)"/>
        <path d="M120 40 L150 30 M240 40 L210 30" stroke="url(#sfgold)" stroke-width="1.2"/>` + Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1.08 + i * 0.065); return `<path d="M${180 + Math.cos(a) * 158} ${54 + Math.sin(a) * 40} l${Math.cos(a) * 6} ${Math.sin(a) * 6}" style="stroke:var(--trim1)" stroke-width="1"/>`; }).join('');
      heart = `<circle class="gem" cx="180" cy="24" r="14" fill="url(#sfgem)" stroke="url(#sfgold)" stroke-width="2"/>`;
      break;
    case 'nachtfalter': // Mottenflügel + Sichelmond
      extra = `<path d="M180 26 C150 2 108 6 112 28 C116 44 150 40 180 30 Z" fill="none" stroke="url(#sfgold)" stroke-width="1.6"/>
        <path d="M180 26 C210 2 252 6 248 28 C244 44 210 40 180 30 Z" fill="none" stroke="url(#sfgold)" stroke-width="1.6"/>
        <circle cx="138" cy="22" r="4" fill="none" style="stroke:var(--trim1)"/><circle cx="222" cy="22" r="4" fill="none" style="stroke:var(--trim1)"/>
        <path d="M176 8 C170 2 166 0 162 1 M184 8 C190 2 194 0 198 1" fill="none" stroke="url(#sfgold)" stroke-width="1.2"/>`;
      heart = `<path class="gem" d="M188 8 A17 17 0 1 0 188 42 A21 21 0 0 1 188 8 Z" fill="url(#sfgem)" stroke="url(#sfgold)" stroke-width="1.6"/>`;
      break;
    case 'amboss': // Ambosskrone mit Hörnern und Flammenkern
      extra = `<path d="M118 40 L132 14 L150 30 L166 8 L180 26 L194 8 L210 30 L228 14 L242 40" fill="none" stroke="url(#sfgold)" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="150" y="40" width="60" height="7" rx="1.5" fill="url(#sfgold)"/>` + [70, 100, 260, 290].map(x => `<circle cx="${x}" cy="44" r="2.6" style="fill:var(--trim1)"/>`).join('');
      heart = `<path class="gem" d="M180 4 C190 16 196 22 192 32 C190 38 184 42 180 42 C176 42 170 38 168 32 C164 22 172 18 174 10 C176 18 180 20 182 16 C184 12 182 8 180 4 Z" fill="url(#sfgem)" stroke="url(#sfgold)" stroke-width="1.4"/>`;
      break;
    case 'spirale': // Wirbel um ein Wurmloch-Auge
      extra = `<path d="M180 25 m-26 0 a26 26 0 1 1 52 0 a22 22 0 1 1 -44 0 a18 18 0 1 1 36 0" fill="none" stroke="url(#sfgold)" stroke-width="1.4" opacity=".9"/>
        <path d="M110 44 C130 20 150 40 154 25 M250 44 C230 20 210 40 206 25" fill="none" stroke="url(#sfgold)" stroke-width="1.4"/>`;
      heart = `<circle class="gem" cx="180" cy="25" r="11" fill="url(#sfgem)" stroke="url(#sfgold)" stroke-width="1.8"/><circle cx="180" cy="25" r="4" fill="#05030a"/>`;
      break;
    default: // Lumen-Kreuzer: Kristallraute
      extra = whips;
      heart = `<path class="gem" d="M180 2 L196 22 L180 44 L164 22 Z" fill="url(#sfgem)" stroke="url(#sfgold)" stroke-width="2"/>
        <path d="M180 2 L188 22 L180 44 M164 22 L196 22" stroke="#fff" stroke-width=".6" opacity=".6" fill="none"/>`;
  }
  return `<svg viewBox="0 0 360 54" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${defs}${arch}${ship === 'kreuzer' ? '' : whips.replace(/stroke-width="1.6"/g, 'stroke-width="1.1" opacity=".55"')}${extra}${heart}${dots}</svg>`;
}

function traitList(id: string) {
  const ts = traitsOf(id);
  if (!ts.length) return '';
  return h('div', { class: 'sf-traitlist' }, ts.map(t => { const d = TRAIT[t]; return h('div', { class: d.good ? 'good' : 'bad' }, h('b', null, `${d.icon} ${tx(d.name)}`), h('small', null, `${d.good ? L('Schwäche', 'Weakness') : L('Stärke', 'Strength')}: ${tx(d.text)}${d.counters ? ` (${tx(CONST[d.counters].name)})` : ''}`)); }));
}

export function rules() {
  sheet(L('Der Sternenreaktor', 'The Star Reactor'),
    h('p', { class: 'small' }, L('Dein Schiff kämpft mit einem Spielautomaten: drei Walzen aus deinen Symbolen. Jeder Dreh zeigt ein 3×3-Fenster – ALLE neun Symbole feuern.', 'Your ship fights with a slot machine: three reels made of your symbols. Each spin shows a 3×3 window – ALL nine symbols fire.')),
    h('p', { class: 'small' }, L('Linien (3 Reihen + 2 Diagonalen): drei gleiche Familien (⚔ Waffe, ⛨ Schild, ⚙ Technik, ✦ Kosmos) = SYNERGIE ×2. Drei gleiche Symbole = JACKPOT ×3. Das Wurmloch ✷ zählt als jede Familie.', 'Lines (3 rows + 2 diagonals): three of the same family (⚔ weapon, ⛨ shield, ⚙ tech, ✦ cosmos) = SYNERGY ×2. Three identical symbols = JACKPOT ×3. The wormhole ✷ counts as any family.')),
    h('p', { class: 'small' }, L('Pro Zug hast du 3 Drehs. Nach dem ersten kannst du Walzen HALTEN – sie feuern beim nächsten Dreh erneut, kosten aber Hitze. Jeder Dreh heizt den Reaktor auf. Wird er zu heiß: Überladung, Schaden, Zug vorbei. Mit „Andocken“ beendest du den Zug.', 'You have 3 spins per turn. After the first you can HOLD reels – they fire again on the next spin, but cost heat. Every spin heats the reactor. Too hot: overload, damage, turn over. “Dock” ends your turn.')),
    h('p', { class: 'small' }, L('Walzen-Knöpfe (ab dem 2. Dreh): FREI dreht zufällig · HALTEN bleibt stehen · SCHUBSEN rückt genau ein Feld weiter – das kleine Bild zeigt, welches Symbol unten einrückt. Halten und Schubsen kosten je +1 Hitze. So baust du Linien gezielt.', 'Reel buttons (from the 2nd spin): FREE spins randomly · HOLD stays · NUDGE moves exactly one step – the small icon shows which symbol enters at the bottom. Hold and nudge cost +1 heat each. That is how you build lines on purpose.')),
    h('p', { class: 'small' }, L('Konstellationen: 3 / 5 / 7 Symbole derselben Konstellation schalten starke Boni frei (Wappen oben am Reaktor antippen). Gegner haben Stärken (rot) und Schwächen (grün) – lange drücken. Wähle dein Deck passend!', 'Constellations: 3 / 5 / 7 symbols of one constellation unlock strong bonuses (tap the crest on the reactor). Enemies have strengths (red) and weaknesses (green) – long-press. Build your deck to match!')),
    h('p', { class: 'small' }, L('Tippe auf einen Gegner, um ihn anzuvisieren. Lange drücken zeigt Details.', 'Tap an enemy to target it. Long-press shows details.')));
}
