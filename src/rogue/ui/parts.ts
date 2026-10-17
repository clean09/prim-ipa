// Bausteine der Oberfläche von STERNENFALL: Symbolkarten im Jugendstil-Rahmen, Module, Kopfleiste, Walzen-Ansicht,
// Walzen-/Symbolauswahl, Porträt-Dialoge der Geschichte.
import { L } from '../../core/i18n';
import { h, sheet } from '../../ui/dom';
import { SYM, TAG_INFO } from '../data/symbols';
import { MOD } from '../data/modules';
import { CAST, CHAPTERS } from '../data/story';
import { SHIP } from '../data/ships';
import { ornament, portraitSvg, shipSvg, symbolSvg } from '../art';
import { REEL_MAX, rarityColor } from '../run';
import { Run, SymInst } from '../types';

export const tx = (t: [string, string]) => L(t[0], t[1]);
const RAR = () => ({ common: L('Gewöhnlich', 'Common'), rare: L('Selten', 'Rare'), epic: L('Episch', 'Epic'), legendary: L('Legendär', 'Legendary') } as Record<string, string>);
const roman = (n: number) => ['', 'I', 'II', 'III'][n] ?? String(n);

/** Symbolkarte (Jugendstil: Bogenrahmen, Halo-Motiv, Namensband). */
export function cardEl(id: string, lv = 1, opts: { big?: boolean; small?: boolean; price?: number } = {}) {
  const d = SYM[id];
  const tag = TAG_INFO[d.tag];
  const el = h('div', { class: `sc r-${d.rarity}${opts.big ? ' big' : ''}${opts.small ? ' small' : ''}${d.tag === 'fluch' ? ' junk' : ''}`, style: { '--rc': rarityColor(d.rarity), '--tc': tag.color } as any },
    h('div', { class: 'sc-arch' }),
    h('div', { class: 'sc-art', html: symbolSvg(d.art, d.c1, d.c2) }),
    h('div', { class: 'sc-tag', title: L(tag.de, tag.en) }, d.wild ? '✷' : tag.icon),
    lv > 1 ? h('div', { class: 'sc-lv' }, roman(lv)) : '',
    h('div', { class: 'sc-name' }, tx(d.name)),
    opts.small ? '' : h('div', { class: 'sc-text' }, tx(d.text(lv))),
    opts.small ? '' : h('div', { class: 'sc-rar' }, d.tag === 'fluch' ? L('Schrott', 'Junk') : `${RAR()[d.rarity]} · ${L(tag.de, tag.en)}`),
    opts.price != null ? h('div', { class: 'sc-price' }, `${opts.price} ✦`) : '');
  return el;
}
export function cardPreview(id: string, lv = 1) {
  const wrap = h('div', { class: 'sf-preview', onclick: () => wrap.remove() }, cardEl(id, lv, { big: true }), h('div', { class: 'sf-hint' }, L('Tippen zum Schließen', 'Tap to close')));
  document.body.append(wrap);
}
export function longPress(el: HTMLElement, show: () => void) {
  let t = 0;
  el.addEventListener('pointerdown', () => { t = window.setTimeout(() => { t = 0; el.dataset.lp = '1'; show(); }, 420); });
  const clear = () => { if (t) clearTimeout(t); t = 0; };
  el.addEventListener('pointerup', clear); el.addEventListener('pointerleave', clear); el.addEventListener('pointercancel', clear);
}

export function moduleEl(id: string, tap = true) {
  const m = MOD[id];
  const el = h('button', { class: 'sf-mod' + (m.cursed ? ' cursed' : ''), style: { '--rc': rarityColor(m.rarity) } as any, title: tx(m.name) }, m.icon);
  if (tap) el.addEventListener('click', e => { e.stopPropagation(); sheet(`${m.icon} ${tx(m.name)}`, h('p', { class: 'small', style: { color: m.cursed ? '#e89a8a' : undefined } }, tx(m.text)), h('p', { class: 'muted small' }, m.cursed ? L('Verfluchtes Modul', 'Cursed module') : (RAR()[m.rarity] ?? L('Startmodul', 'Starter module')))); });
  return el;
}

/** Kopfleiste über Karte und Stationen. */
export function topBar(run: Run, onReels: () => void, onMenu: () => void) {
  const sh = SHIP[run.ship];
  return h('div', { class: 'sf-top' },
    h('div', { class: 'sf-ship', html: shipSvg(sh.hull, sh.hue) }),
    h('div', { class: 'sf-stat hp' }, h('i', { style: { width: `${Math.max(0, run.hp / run.maxHp) * 100}%` } }), h('span', null, `${run.hp}/${run.maxHp}`)),
    h('div', { class: 'sf-stat gold' }, `✦ ${run.gold}`),
    h('button', { class: 'sf-ib', onclick: onReels, 'aria-label': L('Walzen', 'Reels') }, `⚙ ${run.reels.reduce((s, r) => s + r.length, 0)}`),
    h('button', { class: 'sf-ib', onclick: onMenu, 'aria-label': 'Menü' }, '☰'),
    h('div', { class: 'sf-mods' }, run.modules.map(id => moduleEl(id))));
}

/** Die drei Walzen als Spalten (Übersicht / Auswahl). */
export function reelsView(run: Run, onPick?: (s: SymInst, reel: number) => void, filter?: (s: SymInst) => boolean) {
  return h('div', { class: 'sf-reels' }, run.reels.map((reel, r) =>
    h('div', { class: 'sf-reelcol' }, h('div', { class: 'sf-reelhead' }, `${L('Walze', 'Reel')} ${roman(r + 1) || r + 1} · ${reel.length}/${REEL_MAX}`),
      reel.map(s => {
        const el = cardEl(s.id, s.lv, { small: true });
        if (filter && !filter(s)) el.classList.add('off');
        el.addEventListener('click', () => { if (el.dataset.lp) { delete el.dataset.lp; return; } if (onPick && (!filter || filter(s))) onPick(s, r); else cardPreview(s.id, s.lv); });
        longPress(el, () => cardPreview(s.id, s.lv));
        return el;
      }))));
}
export function showReels(run: Run) { sheet(L('Deine Walzen', 'Your reels'), h('p', { class: 'muted small' }, L('Je weniger Symbole auf einer Walze, desto öfter erscheint jedes davon. Lange drücken = Details.', 'The fewer symbols on a reel, the more often each appears. Long-press = details.')), reelsView(run)); }

/** Walze wählen, auf die ein neues Symbol kommt. */
export function chooseReel(run: Run, id: string): Promise<number | null> {
  return new Promise(res => {
    let done = false;
    const close = sheet(L('Auf welche Walze?', 'Which reel?'),
      h('div', { class: 'sf-choose' }, cardEl(id, 1),
        h('div', { class: 'sf-choosebtns' }, [0, 1, 2].map(r => h('button', { class: 'sf-btn', disabled: run.reels[r].length >= REEL_MAX, onclick: () => { done = true; close(); res(r); } },
          `${L('Walze', 'Reel')} ${roman(r + 1)}`, h('small', null, `${run.reels[r].length}/${REEL_MAX}`))))),
      h('p', { class: 'muted small' }, L('Tipp: Gleiche Familien in derselben Reihe aller drei Walzen ergeben Synergien.', 'Tip: matching families in the same row of all three reels give synergies.')),
      reelsView(run));
    document.querySelector('.sheet-bg')?.addEventListener('click', () => { if (!done) res(null); });
  });
}
/** Symbol aus den Walzen wählen (Aufwerten / Entfernen). */
export function pickSymbol(run: Run, title: string, hint: string, filter: (s: SymInst) => boolean): Promise<SymInst | null> {
  return new Promise(res => {
    let done = false;
    const close = sheet(title, h('p', { class: 'muted small' }, hint), reelsView(run, s => { done = true; close(); res(s); }, filter));
    document.querySelector('.sheet-bg')?.addEventListener('click', () => { if (!done) res(null); });
  });
}

export function portrait(id: string) { return h('div', { class: 'sf-portrait', html: portraitSvg(CAST[id]?.portrait ?? id) }); }

/** Geschichte: Kapitel mit Porträts und Schreibmaschinen-Text abspielen. */
export function playChapter(chId: string): Promise<void> {
  const ch = CHAPTERS.find(c => c.id === chId);
  if (!ch) return Promise.resolve();
  return new Promise(res => {
    const wrap = h('div', { class: 'sf-story' });
    const title = h('div', { class: 'sf-stitle' }, h('small', null, L('Logbuch', 'Logbook')), h('b', null, tx(ch.title)), h('div', { html: ornament(220) }));
    const box = h('div', { class: 'sf-sbox' });
    const btn = h('button', { class: 'sf-btn gold' }, L('Weiter', 'Next'));
    wrap.append(title, box, btn);
    document.body.append(wrap);
    let i = 0, typing = 0, full = '';
    const textEl = () => box.querySelector('.sf-line p') as HTMLElement | null;
    const show = () => {
      const line = ch.lines[i]; const c = CAST[line.who];
      box.innerHTML = '';
      box.append(h('div', { class: 'sf-line' }, portrait(line.who), h('div', null, h('b', { style: { color: `hsl(${c?.hue ?? 40} 60% 72%)` } }, c ? tx(c.name) : ''), h('small', null, c ? tx(c.role) : ''), h('p'))));
      full = tx(line.text); let k = 0;
      clearInterval(typing);
      typing = window.setInterval(() => { const p = textEl(); if (!p) return; k += 2; p.textContent = full.slice(0, k); if (k >= full.length) clearInterval(typing); }, 18);
      btn.textContent = i < ch.lines.length - 1 ? L('Weiter', 'Next') : L('Schließen', 'Close');
    };
    btn.addEventListener('click', () => {
      const p = textEl();
      if (p && p.textContent!.length < full.length) { clearInterval(typing); p.textContent = full; return; }
      i++;
      if (i >= ch.lines.length) { clearInterval(typing); wrap.classList.add('out'); setTimeout(() => { wrap.remove(); res(); }, 400); return; }
      show();
    });
    show();
  });
}

export const NODE_ICON: Record<string, string> = { fight: '⚔', elite: '☠', event: '?', shop: '⚖', casino: '♣', rest: '⚙', chest: '◈', boss: '♛' };
export const NODE_NAME = (k: string) => ({
  fight: L('Gefecht', 'Fight'), elite: L('Elite', 'Elite'), event: L('Begegnung', 'Encounter'), shop: L('Ozzos Basar', 'Ozzo’s Bazaar'),
  casino: L('Casino „Ewiger Orbit“', 'Casino “Eternal Orbit”'), rest: L('Brakks Station', 'Brakk’s Station'), chest: L('Wrack', 'Wreck'), boss: 'Boss',
} as Record<string, string>)[k];
