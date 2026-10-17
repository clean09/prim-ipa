// Kampfbildschirm: Gegner mit Absicht, große Zugsumme mit Kombo, Hand mit Primzahl-Hinweis, Ziel per Tippen.
import { L } from '../../core/i18n';
import { h, sheet } from '../../ui/dom';
import { CARD } from '../data/cards';
import { ENEMY } from '../data/enemies';
import { Combat, CombatEvent } from '../combat';
import { Particles, flash, floatText, haptic, shake, slowmo, snd } from '../juice';
import { isPrime } from '../rng';
import { Foe, Intent, Run } from '../types';
import { cardEl, cardPreview, deckView, longPress, relicEl, tx } from './parts';

export interface CombatResult { won: boolean; killedBy: string; boss: boolean }

export function runCombat(host: HTMLElement, run: Run, ids: string[], kind: 'fight' | 'elite' | 'boss', particles: Particles, onQuit: () => void): Promise<CombatResult> {
  return new Promise(resolve => {
    host.innerHTML = '';
    const root = h('div', { class: `rg-combat act${run.act}${kind === 'boss' ? ' boss' : ''}` });
    const foesEl = h('div', { class: 'rg-foes' });
    const sumEl = h('div', { class: 'rg-sum' });
    const comboEl = h('div', { class: 'rg-combo' });
    const logEl = h('div', { class: 'rg-log' });
    const heroEl = h('div', { class: 'rg-hero' });
    const handEl = h('div', { class: 'rg-hand' });
    const endBtn = h('button', { class: 'rg-end' }, L('Zug beenden', 'End turn'));
    const fxLayer = h('div', { class: 'rg-fx' });
    root.append(
      h('div', { class: 'rg-ctop' }),
      foesEl,
      h('div', { class: 'rg-mid' }, sumEl, comboEl, logEl),
      heroEl, handEl, h('div', { class: 'rg-cbot' }, endBtn), fxLayer);
    host.append(root);

    let selected = -1;
    let busy = false;
    const foeNode = new Map<number, HTMLElement>();
    const diedAt = new Map<number, number>();

    // ------------------------------------------------------------------------- Ereignisse der Engine → Effekte
    const center = (el: HTMLElement | undefined) => {
      const r = (el ?? root).getBoundingClientRect(), hr = host.getBoundingClientRect();
      return [r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2] as const;
    };
    const ui = {
      emit(e: CombatEvent) {
        switch (e.t) {
          case 'hitFoe': {
            const el = foeNode.get(e.uid); const [x, y] = center(el);
            if (e.n > 0) {
              floatText(fxLayer, x, y - 20, `−${e.n}`, e.crit ? 'crit' : 'dmg');
              particles.burst(x, y, e.crit ? 40 : 14, e.crit ? 0xffd25a : 0xff6a5a, e.crit ? 320 : 200);
              snd.hit(e.crit); if (e.crit) { shake(root, 2); haptic('light'); }
              el?.classList.remove('hurt'); void el?.offsetWidth; el?.classList.add('hurt');
            } else if (e.blocked > 0) floatText(fxLayer, x, y - 20, `⛨ ${e.blocked}`, 'blk');
            else floatText(fxLayer, x, y - 20, '0', 'blk');
            break;
          }
          case 'hitHero': {
            const [x, y] = center(heroEl);
            if (e.n > 0) { floatText(fxLayer, x, y - 30, `−${e.n}`, 'hurt'); snd.hurt(); shake(root, e.n >= 15 ? 2.5 : 1.2); flash(root, 'rgba(255,40,40,.35)'); haptic('error'); }
            else if (e.blocked) { floatText(fxLayer, x, y - 30, `⛨ ${e.blocked}`, 'blk'); snd.block(); }
            break;
          }
          case 'block': { const [x, y] = center(heroEl); if (e.n > 0) { floatText(fxLayer, x, y - 30, `+${e.n} ⛨`, 'blk'); snd.block(); } break; }
          case 'heal': { const [x, y] = center(heroEl); floatText(fxLayer, x, y - 30, `+${e.n} ❤`, 'heal'); break; }
          case 'prime': {
            snd.prime(e.combo);
            sumEl.classList.remove('pop'); void sumEl.offsetWidth; sumEl.classList.add('pop', 'prime');
            const [x, y] = center(sumEl);
            particles.burst(x, y, 10 + e.combo * 6, e.combo >= 4 ? 0xffd25a : 0x8f7bff, 160 + e.combo * 30, 3);
            if (e.combo >= 3) { flash(root, 'rgba(143,123,255,.25)', 200); haptic('light'); }
            if (e.combo >= 5) shake(root, 1);
            break;
          }
          case 'nonprime': sumEl.classList.remove('prime', 'pop'); snd.card(); break;
          case 'kill': {
            const el = foeNode.get(e.uid); const [x, y] = center(el);
            particles.burst(x, y, e.boss ? 160 : 50, e.boss ? 0xffd25a : 0xffa04a, e.boss ? 420 : 280, e.boss ? 5 : 3);
            snd.kill(); el?.classList.add('dead'); diedAt.set(e.uid, performance.now());
            if (e.boss) { slowmo(root, particles, 1600); flash(root, '#fff', 500); shake(root, 3); haptic('success'); }
            break;
          }
          case 'poison': { const el = foeNode.get(e.uid); const [x, y] = center(el); floatText(fxLayer, x, y + 10, e.n > 0 ? `☣ −${e.n}` : `☣ +${-e.n}`, 'psn'); break; }
          case 'log': logEl.textContent = e.text; logEl.classList.remove('in'); void logEl.offsetWidth; logEl.classList.add('in'); break;
          case 'shake': shake(root, e.n); break;
          case 'jackpot': flash(root, 'rgba(255,210,90,.6)', 600); snd.jackpot(); { const [x, y] = center(sumEl); particles.burst(x, y, 120, 0xffd25a, 400); } break;
          case 'gold': if (e.n) { const [x, y] = center(heroEl); floatText(fxLayer, x + 40, y - 40, `${e.n > 0 ? '+' : ''}${e.n} 🪙`, 'gold'); snd.coin(); } break;
          case 'enemyAct': foeNode.get(e.uid)?.classList.add('acting'); setTimeout(() => foeNode.get(e.uid)?.classList.remove('acting'), 500); break;
          case 'spawn': break;
          case 'played': break;
        }
      },
      pause: (ms: number) => new Promise<void>(r => { setTimeout(() => { render(); r(); }, ms); }),
    };

    const c = new Combat(run, ids, ui, kind);

    // ------------------------------------------------------------------------- Darstellung
    const intentLabel = (it: Intent, f: Foe) => {
      const dm = (n: number) => { let x = n + f.str; if (f.weak) x *= 0.75; if (c.vuln) x *= 1.5; x *= 1 + (run.mods.taken ?? 0) + run.ascension * 0.05; return Math.floor(x); };
      switch (it.k) {
        case 'atk': return [`🗡`, `${dm(it.n)}${it.times && it.times > 1 ? `×${it.times}` : ''}`, 'atk'];
        case 'block': return ['🛡', String(it.n), 'def'];
        case 'buff': return ['💪', `+${it.str}`, 'buf'];
        case 'debuff': return ['🌀', '', 'deb'];
        case 'poison': return ['☣', String(it.n), 'deb'];
        case 'curse': return ['☠', '', 'deb'];
        case 'summon': return ['➕', '', 'buf'];
        case 'heal': return ['✚', String(it.n), 'buf'];
        case 'special': return [it.icon, tx(it.name), 'spc'];
      }
    };
    const chips = (o: { block: number; poison: number; weak: number; vuln: number; str: number }) =>
      h('div', { class: 'rg-chips' },
        o.block ? h('span', { class: 'c blk' }, `⛨${o.block}`) : '', o.poison ? h('span', { class: 'c psn' }, `☣${o.poison}`) : '',
        o.weak ? h('span', { class: 'c deb' }, `↓${o.weak}`) : '', o.vuln ? h('span', { class: 'c deb' }, `✕${o.vuln}`) : '', o.str ? h('span', { class: 'c buf' }, `💪${o.str}`) : '');

    function render() {
      // Kopf
      const top = root.querySelector('.rg-ctop')!;
      top.innerHTML = '';
      top.append(
        h('div', { class: 'rg-stat hp' }, h('i', { style: { width: `${Math.max(0, run.hp / run.maxHp) * 100}%` } }), h('span', null, `❤ ${Math.max(0, run.hp)}/${run.maxHp}`)),
        h('div', { class: 'rg-stat' }, `🪙 ${run.gold}`),
        h('button', { class: 'rg-ib', onclick: () => deckView([...c.draw], L('Nachziehstapel', 'Draw pile')) }, `▤ ${c.draw.length}`),
        h('button', { class: 'rg-ib', onclick: () => deckView([...c.discard], L('Ablage', 'Discard')) }, `▥ ${c.discard.length}`),
        h('button', { class: 'rg-ib', onclick: () => menu() }, '☰'),
        h('div', { class: 'rg-relics' }, run.relics.map(id => relicEl(id))));
      // Gegner
      const now = performance.now();
      foesEl.innerHTML = '';
      foesEl.dataset.n = String(c.alive().length);
      for (const f of c.foes) {
        if (f.dead && now - (diedAt.get(f.uid) ?? 0) > 650) continue;
        const d = ENEMY[f.id];
        const [ic, num, cls] = intentLabel(f.intent, f) as [string, string, string];
        const el = h('div', { class: `rg-foe ${d.tier}${f.dead ? ' dead' : ''}${selected >= 0 && c.needsTarget(selected) && !f.dead ? ' target' : ''}`, style: { '--h': String(d.hue) } as any },
          f.dead ? '' : h('div', { class: 'rg-intent ' + cls }, h('b', null, ic), num),
          h('div', { class: 'rg-glyph' }, d.glyph),
          h('div', { class: 'rg-fname' }, tx(d.name)),
          h('div', { class: 'rg-hpbar' }, h('i', { style: { width: `${Math.max(0, f.hp / f.max) * 100}%` } }), h('span', null, `${Math.max(0, f.hp)}/${f.max}`)),
          chips(f));
        el.addEventListener('click', () => onFoe(f));
        longPress(el, () => sheet(`${d.glyph} ${tx(d.name)}`, h('p', { class: 'small' }, d.passive ? tx(d.passive) : L('Keine Sonderregel.', 'No special rule.')),
          h('p', { class: 'muted small' }, L(`Nächster Zug: ${intentText(f.intent)}`, `Next move: ${intentText(f.intent)}`))));
        foeNode.set(f.uid, el);
        foesEl.append(el);
      }
      // Summe
      sumEl.innerHTML = '';
      sumEl.append(h('small', null, 'Σ'), String(c.sum));
      const step = run.mods.comboStep ?? 0.25;
      comboEl.innerHTML = c.combo > 0
        ? `<b>${L('KOMBO', 'COMBO')} ×${c.combo}</b> <span>+${Math.round(step * c.combo * 100)} %</span>`
        : `<span>${L('Nächste Primzahl', 'Next prime')}: ${nextPrimeAfter(c.sum)}</span>`;
      comboEl.className = 'rg-combo' + (c.combo >= 3 ? ' hot' : c.combo > 0 ? ' on' : '');
      // Held
      heroEl.innerHTML = '';
      heroEl.append(
        h('div', { class: 'rg-energy' + (c.energy === 0 ? ' empty' : '') }, h('b', null, String(c.energy)), h('small', null, `/${3 + run.energyBonus}`)),
        chips({ block: c.block, poison: c.poisonSelf, weak: c.weak, vuln: c.vuln, str: c.str }),
        Object.keys(c.powers).filter(k => !k.startsWith('_') && ['mauer', 'primDraw', 'euklid', 'crown', 'viru', 'restk', 'luck'].includes(k)).length
          ? h('div', { class: 'rg-powers' }, Object.entries(c.powers).filter(([k, v]) => v && ['mauer', 'primDraw', 'euklid', 'crown', 'viru', 'restk', 'luck'].includes(k)).map(([k]) => h('span', null, POWER_ICON[k] ?? '✦'))) : '');
      // Hand
      handEl.innerHTML = '';
      const n = c.hand.length;
      handEl.style.setProperty('--n', String(n));
      c.hand.forEach((inst, i) => {
        const d = CARD[inst.id];
        const would = c.sum + inst.val;
        const hint = d.unplayable ? '' : c.isPrimeSum(would) ? 'prime' : 'miss';
        const el = cardEl(inst.id, inst.up, inst, { cost: c.costOf(inst), hint });
        el.classList.add('inhand');
        if (!c.canPlay(i)) el.classList.add('off');
        if (i === selected) el.classList.add('sel');
        el.style.setProperty('--i', String(i));
        el.style.setProperty('--ty', `${Math.abs(i - (n - 1) / 2) * 4}px`);
        el.style.setProperty('--rot', `${(i - (n - 1) / 2) * Math.min(2, 10 / Math.max(1, n))}deg`);
        el.addEventListener('click', () => { if (el.dataset.lp) { delete el.dataset.lp; return; } onCard(i); });
        longPress(el, () => cardPreview(inst.id, inst.up, inst));
        handEl.append(el);
      });
      // Überlappung: alle Karten passen in die Breite
      const first = handEl.firstElementChild as HTMLElement | null;
      if (first) {
        const cw = first.offsetWidth, avail = handEl.clientWidth - 56;
        const ov = n * cw > avail ? -(n * cw - avail) / (2 * n) : 2;
        handEl.style.setProperty('--ov', `${ov}px`);
      }
      endBtn.disabled = busy || !!c.over;
      endBtn.classList.toggle('glow', !busy && c.hand.every((_, i) => !c.canPlay(i)));
    }

    function intentText(it: Intent) { const r = intentLabel(it, c.foes[0]); return `${r?.[0]} ${r?.[1]}`; }

    // ------------------------------------------------------------------------- Eingaben
    function onCard(i: number) {
      if (busy || c.over) return;
      if (!c.canPlay(i)) { snd.miss(); const el = handEl.children[i] as HTMLElement; el?.classList.remove('nope'); void el?.offsetWidth; el?.classList.add('nope'); return; }
      if (c.needsTarget(i)) { selected = selected === i ? -1 : i; render(); return; }
      doPlay(i);
    }
    function onFoe(f: Foe) {
      if (busy || f.dead || selected < 0) return;
      doPlay(selected, f.uid);
    }
    function doPlay(i: number, target?: number) {
      const el = handEl.children[i] as HTMLElement | undefined;
      if (el) { const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect(); particles.burst(r.left - hr.left + r.width / 2, r.top - hr.top + 20, 8, 0xffffff, 120, 2); }
      selected = -1;
      c.play(i, target);
      render();
      after();
    }
    endBtn.addEventListener('click', async () => {
      if (busy || c.over) return;
      busy = true; selected = -1; render();
      await c.endTurn();
      busy = false;
      render();
      after();
    });

    function after() {
      if (!c.over) return;
      busy = true;
      const won = c.over === 'win';
      setTimeout(() => { root.classList.add(won ? 'won' : 'lost'); }, kind === 'boss' && won ? 1200 : 300);
      setTimeout(() => resolve({ won, killedBy: c.killedBy, boss: kind === 'boss' }), kind === 'boss' && won ? 2200 : 900);
    }

    function menu() {
      const close = sheet(L('Pause', 'Pause'),
        h('p', { class: 'muted small' }, L(`Seed ${run.seed} · Härte ${run.ascension}`, `Seed ${run.seed} · Hardship ${run.ascension}`)),
        h('div', { class: 'stack', style: { gap: '10px' } },
          h('button', { class: 'btn block', onclick: () => { close(); deckView(run.deck); } }, L('Ganzes Deck ansehen', 'View whole deck')),
          h('button', { class: 'btn block', onclick: () => { close(); help(); } }, L('Wie funktioniert die Kombo?', 'How does the combo work?')),
          h('button', { class: 'btn block', onclick: () => { close(); onQuit(); } }, L('Pause: zurück zum Hub (Lauf bleibt gespeichert)', 'Pause: back to hub (run stays saved)'))));
    }

    c.start();
    render();
    if (kind === 'boss') { flash(root, 'rgba(255,60,60,.4)', 700); shake(root, 2); }
  });
}

export function help() {
  sheet(L('Die Primzahl-Kombo', 'The prime combo'),
    h('p', { class: 'small' }, L('Jede Karte trägt eine Zahl (oben links). Wenn du sie spielst, wird die Zahl zur Zugsumme Σ addiert.', 'Every card carries a number (top left). Playing it adds the number to the turn sum Σ.')),
    h('p', { class: 'small' }, L('Ist die neue Summe eine PRIMZAHL, steigt deine Kombo – und die Karte wirkt um +25 % je Kombo-Stufe stärker. Ist sie keine Primzahl, bricht die Kombo ab.', 'If the new sum is a PRIME, your combo rises – and the card is +25 % stronger per combo level. If not, the combo breaks.')),
    h('p', { class: 'small' }, L('Karten mit grünem „PRIM“ würden jetzt eine Primzahl treffen. Die Reihenfolge entscheidet: 2 → 3 → 2 ergibt 2, 5, 7 – drei Treffer!', 'Cards marked green “PRIME” would hit a prime right now. Order matters: 2 → 3 → 2 gives 2, 5, 7 – three hits!')),
    h('p', { class: 'small' }, L('Die Summe startet jeden Zug bei 0. Lange auf Karten oder Gegner drücken zeigt Details.', 'The sum starts at 0 every turn. Long-press cards or enemies for details.')));
}

const POWER_ICON: Record<string, string> = { mauer: '🧱', primDraw: '🔢', euklid: '📜', crown: '👑', viru: '🦠', restk: '♻️', luck: '🍀' };
function nextPrimeAfter(n: number) { let k = Math.max(2, n + 1); while (!isPrime(k)) k++; return `${k} (+${k - n})`; }
