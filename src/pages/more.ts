// Seite „Alles“: jedes Werkzeug als große Registerzeile, gruppiert wie die Desktop-Navigation.
import { L } from '../core/i18n';
import { go } from '../core/nav';
import { VERSION } from '../core/store';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { SpaceKind, spaceStyle } from '../ui/cosmos';

export function mountMore(root: HTMLElement) {
  let n = 0;
  const row = (art: [SpaceKind, number], title: string, sub: string, target: string) => {
    const el = h('div', { class: 'ed', style: spaceStyle(art[0], art[1]) as any, onclick: () => go(target) },
      h('div', { class: 'art' }), h('span', { class: 'n' }, String(++n).padStart(2, '0')),
      h('div', { class: 't' }, h('b', null, title), h('small', null, sub)), h('span', { class: 'go' }, icon('arrow')));
    el.addEventListener('pointerdown', () => el.classList.add('hot'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => setTimeout(() => el.classList.remove('hot'), 220)));
    return el;
  };
  const sec = (no: string, title: string) => h('div', { class: 'sec-h' }, h('span', { class: 'n' }, `(${no})`), h('h2', null, title));
  root.append(h('div', { class: 'stack' },
    sec('A', 'Benchmarks'),
    h('div', { class: 'ed-list' },
      row(['cluster', 220], L('Primzahlen', 'Primes'), L('Sieb auf allen Kernen · 3 min', 'Sieve on all cores · 3 min'), 'prime'),
      row(['galaxy', 270], L('KI-Leistung', 'AI performance'), L('Matrix und Bildgenerierung', 'Matrix and image generation'), 'ai'),
      row(['pulsar', 175], L('Neutronenstern', 'Neutron star'), L('Speicher: Bandbreite, Latenz', 'Memory: bandwidth, latency'), 'ram')),
    sec('B', L('Simulationen', 'Simulations')),
    h('div', { class: 'ed-list' },
      row(['sun', 30], L('Sternenleben', 'Star life'), L('Sternentwicklung in 3D', 'Stellar evolution in 3D'), 'star'),
      row(['blackhole', 28], L('Singularität', 'Singularity'), L('Schwarzes Loch · 60-s-Testflug', 'Black hole · 60 s flight test'), 'bh'),
      row(['nebula', 130], L('Mathe-Labor', 'Math lab'), L('π · Fibonacci · N-Körper · Collatz', 'π · Fibonacci · N-body · Collatz'), 'lab')),
    sec('C', L('System', 'System')),
    h('div', { class: 'ed-list' },
      row(['nebula', 195], L('Geräte-Check', 'Device check'), L('Alle Bauteile', 'Every component'), 'device'),
      row(['constellation', 225], L('Bestenliste', 'Leaderboard'), L('Meine und weltweite', 'Mine and worldwide'), 'board'),
      row(['comet', 40], L('Zahl prüfen', 'Check a number'), 'Miller-Rabin · Lucas-Lehmer', 'check'),
      row(['moon', 220], L('Einstellungen', 'Settings'), L('Design, Bewegung, Sprache, Datenschutz', 'Design, motion, language, privacy'), 'info')),
    h('p', { class: 'muted small mono', style: { textAlign: 'center', marginTop: '16px' } }, `PrimSieb ${VERSION} · ${L('Tipp: Lupe oben = Register', 'Tip: magnifier at the top = index')}`)));
}
