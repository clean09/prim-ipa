// Erfolge über alle Spiele.
import { L } from '../core/i18n';
import { h } from '../ui/dom';
import { sfx } from '../ui/fx';
import { saveStats, stats } from './progress';

export const ACH: [string, string, () => string, () => string][] = [
  ['first', '🎯', () => L('Erster Treffer', 'First hit'), () => L('Die erste Primzahl erwischt', 'Caught your first prime')],
  ['p100', '💯', () => L('Sammler', 'Collector'), () => L('100 Primzahlen insgesamt', '100 primes in total')],
  ['p1000', '🏛', () => L('Primzahl-Profi', 'Prime pro'), () => L('1.000 Primzahlen insgesamt', '1,000 primes in total')],
  ['combo20', '🔥', () => L('Kettenreaktion', 'Chain reaction'), () => L('Combo von 20', 'Combo of 20')],
  ['lvl10', '🚀', () => L('Aufsteiger', 'Climber'), () => L('Level 10 im Klassik-Modus', 'Level 10 in classic mode')],
  ['big', '🦣', () => L('Großwild', 'Big game'), () => L('Eine Primzahl über 10.000 erkannt', 'Spotted a prime above 10,000')],
  ['twin', '👯', () => L('Zwillinge', 'Twins'), () => L('Zwei Primzahlzwillinge nacheinander (p, p+2)', 'Two twin primes in a row (p, p+2)')],
  ['mersenne', '✨', () => L('Mersenne', 'Mersenne'), () => L('Eine Mersenne-Primzahl (2^p − 1) erwischt', 'Caught a Mersenne prime (2^p − 1)')],
  ['flawless', '💎', () => L('Fehlerlos', 'Flawless'), () => L('Blitz-Runde ohne Fehler (mind. 15 Treffer)', 'Blitz round without a mistake (15+ hits)')],
  ['splitter', '🪐', () => L('Planetenspalter', 'Planet splitter'), () => L('100 Planeten in Faktoren zerlegt', 'Split 100 planets into factors')],
  ['ninja', '🥷', () => L('Zahlen-Ninja', 'Number ninja'), () => L('Drei Zahlen mit einem Wisch zerschnitten', 'Sliced three numbers in one swipe')],
  ['daily', '📅', () => L('Täglich dabei', 'Daily player'), () => L('Eine Tages-Challenge gespielt', 'Played a daily challenge')],
  ['streak7', '📆', () => L('Eine Woche dran', 'One week in'), () => L('7 Tage in Folge gespielt', 'Played 7 days in a row')],
  ['profi20', '🧠', () => L('Denker', 'Thinker'), () => L('Stufe 20 im Mathe-Profi', 'Stage 20 in Math pro')],
  ['pi50', 'π', () => L('π-Gedächtnis', 'π memory'), () => L('50 Nachkommastellen von π', '50 decimals of π')],
  ['all', '🌟', () => L('Allrounder', 'All-rounder'), () => L('Alle Spiele gespielt', 'Played every game')],
];

/** Erfolg freischalten (einmalig) und als Banner zeigen. Gibt true zurück, wenn neu. */
export function unlock(id: string, host?: HTMLElement): boolean {
  const s = stats();
  if (s.achievements.includes(id)) return false;
  s.achievements.push(id);
  saveStats(s);
  const a = ACH.find(x => x[0] === id);
  if (a && host) {
    const el = h('div', { class: 'g-ach' }, h('span', { class: 'g-ach-i' }, a[1]), h('div', null, h('small', null, L('Erfolg freigeschaltet', 'Achievement unlocked')), h('b', null, a[2]())));
    host.append(el);
    setTimeout(() => el.classList.add('out'), 2400);
    setTimeout(() => el.remove(), 2900);
  }
  sfx.success();
  return true;
}
