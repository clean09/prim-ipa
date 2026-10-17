// Bausteine der Oberfläche: Karte, Relikt, Kopfleiste, Deck-Ansicht, Kartenauswahl, Tooltip.
import { L } from '../../core/i18n';
import { h, sheet } from '../../ui/dom';
import { CARD } from '../data/cards';
import { RELIC } from '../data/relics';
import { isPrime } from '../rng';
import { rarityColor } from '../run';
import { CardInst, Run } from '../types';

export const tx = (t: [string, string]) => L(t[0], t[1]);
const TYPE_ICON: Record<string, string> = { atk: '⚔', skill: '⛨', power: '✦', curse: '☠' };
const RAR_NAME = () => ({ common: L('Gewöhnlich', 'Common'), rare: L('Selten', 'Rare'), epic: L('Episch', 'Epic'), legendary: L('Legendär', 'Legendary') } as Record<string, string>);

/** Kartenelement. inst optional (Wert gewürfelter Karten, aufgewertet). */
export function cardEl(id: string, up = false, inst?: CardInst, opts: { cost?: number; big?: boolean; hint?: 'prime' | 'miss' | '' } = {}) {
  const d = CARD[id];
  const val = inst ? inst.val : d.val === 'rand' ? '?' : d.val;
  const cost = opts.cost ?? d.cost(up);
  const prime = typeof val === 'number' && isPrime(val);
  const el = h('div', { class: `rc t-${d.type} r-${d.rarity}${up ? ' up' : ''}${opts.big ? ' big' : ''}${d.unplayable ? ' unp' : ''}`, style: { '--rc': d.type === 'curse' ? '#7a3b4a' : rarityColor(d.rarity) } as any },
    h('div', { class: 'rc-val' + (prime ? ' p' : '') }, String(val)),
    d.unplayable ? '' : h('div', { class: 'rc-cost' }, String(cost)),
    h('div', { class: 'rc-art' }, TYPE_ICON[d.type]),
    h('div', { class: 'rc-name' }, tx(d.name) + (up ? '+' : '')),
    h('div', { class: 'rc-text' }, tx(d.text(up))),
    h('div', { class: 'rc-rar' }, d.type === 'curse' ? L('Fluch', 'Curse') : RAR_NAME()[d.rarity]),
    opts.hint ? h('div', { class: 'rc-hint ' + opts.hint }, opts.hint === 'prime' ? 'PRIM' : '') : '');
  return el;
}

export function relicEl(id: string, onTap = true) {
  const r = RELIC[id];
  const el = h('button', { class: 'rr' + (r.cursed ? ' cursed' : ''), style: { '--rc': r.rarity === 'start' ? '#a3a8b3' : rarityColor(r.rarity) } as any, title: tx(r.name) }, r.icon);
  if (onTap) el.addEventListener('click', e => { e.stopPropagation(); relicInfo(id); });
  return el;
}
export function relicInfo(id: string) {
  const r = RELIC[id];
  sheet(`${r.icon} ${tx(r.name)}`, h('p', { class: 'small', style: { color: r.cursed ? '#ff8a8a' : undefined } }, tx(r.text)),
    h('p', { class: 'muted small' }, r.cursed ? L('Verfluchtes Relikt', 'Cursed relic') : (RAR_NAME()[r.rarity] ?? L('Startrelikt', 'Starter relic'))));
}

/** Kopfleiste: LP, Gold, Akt/Etage, Relikte, Deck-Knopf. */
export function topBar(run: Run, onDeck: () => void, onMenu: () => void) {
  const pct = Math.max(0, run.hp / run.maxHp);
  return h('div', { class: 'rg-top' },
    h('div', { class: 'rg-stat hp' }, h('i', { style: { width: `${pct * 100}%` } }), h('span', null, `❤ ${run.hp}/${run.maxHp}`)),
    h('div', { class: 'rg-stat' }, `🪙 ${run.gold}`),
    h('div', { class: 'rg-stat dim' }, `${L('Akt', 'Act')} ${run.act} · ${run.floor}`),
    h('button', { class: 'rg-ib', onclick: onDeck, 'aria-label': 'Deck' }, `🂠 ${run.deck.length}`),
    h('button', { class: 'rg-ib', onclick: onMenu, 'aria-label': 'Menü' }, '☰'),
    h('div', { class: 'rg-relics' }, run.relics.map(id => relicEl(id))));
}

export function deckView(cards: CardInst[], title = L('Dein Deck', 'Your deck')) {
  const sorted = [...cards].sort((a, b) => (CARD[a.id].type + a.id).localeCompare(CARD[b.id].type + b.id));
  sheet(`${title} · ${cards.length}`, h('div', { class: 'rg-grid' }, sorted.map(c => cardEl(c.id, c.up, CARD[c.id].val === 'rand' ? undefined : c))));
}

/** Karte aus dem Deck wählen (Aufwerten / Entfernen). */
export function pickFromDeck(run: Run, title: string, filter: (c: CardInst) => boolean, preview: 'up' | 'remove'): Promise<CardInst | null> {
  return new Promise(res => {
    let done = false;
    const grid = h('div', { class: 'rg-grid' });
    const close = sheet(title, h('p', { class: 'muted small' }, preview === 'up' ? L('Tippe eine Karte zum Aufwerten (+).', 'Tap a card to upgrade (+).') : L('Tippe eine Karte, um sie dauerhaft zu entfernen.', 'Tap a card to remove it permanently.')), grid);
    for (const c of run.deck.filter(filter)) {
      const el = cardEl(c.id, preview === 'up' ? true : c.up, CARD[c.id].val === 'rand' ? undefined : c);
      el.addEventListener('click', () => { done = true; close(); res(c); });
      grid.append(el);
    }
    document.querySelector('.sheet-bg')?.addEventListener('click', () => { if (!done) res(null); });
  });
}

/** Lange drücken = große Vorschau. */
export function longPress(el: HTMLElement, show: () => void) {
  let t = 0;
  el.addEventListener('pointerdown', () => { t = window.setTimeout(() => { t = 0; show(); el.dataset.lp = '1'; }, 420); });
  const clear = () => { if (t) clearTimeout(t); t = 0; };
  el.addEventListener('pointerup', clear); el.addEventListener('pointerleave', clear); el.addEventListener('pointercancel', clear);
}
export function cardPreview(id: string, up: boolean, inst?: CardInst) {
  const wrap = h('div', { class: 'rg-preview', onclick: () => wrap.remove() }, cardEl(id, up, inst, { big: true }), h('div', { class: 'muted small' }, L('Tippen zum Schließen', 'Tap to close')));
  document.body.append(wrap);
}

export const NODE_ICON: Record<string, string> = { fight: '⚔️', elite: '💀', event: '❓', shop: '🛒', casino: '🎰', rest: '🔥', chest: '🎁', boss: '👑' };
export const NODE_NAME = (k: string) => ({
  fight: L('Kampf', 'Fight'), elite: L('Elite', 'Elite'), event: L('Ereignis', 'Event'), shop: L('Händler', 'Merchant'),
  casino: L('Casino', 'Casino'), rest: L('Rast', 'Rest'), chest: L('Truhe', 'Chest'), boss: 'Boss',
} as Record<string, string>)[k];
export const ACT_NAME = (a: number) => [L('Die Bruchzone', 'The Fraction Zone'), L('Mersenne-Tiefen', 'Mersenne Depths'), L('Der Zeta-Abgrund', 'The Zeta Abyss')][a - 1] ?? '';
