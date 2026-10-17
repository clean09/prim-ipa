// Seite „Info“: Einstellungen, Über die App, Datenschutz.
import { L, languageSetting } from '../core/i18n';
import { platform } from '../core/native';
import { rebuild } from '../core/nav';
import { VERSION, saveSettings, settings } from '../core/store';
import { applyTheme, ACCENTS, DESIGNS, switchDesign } from '../core/theme';
import { h, seg, toggle } from '../ui/dom';
import { sfx } from '../ui/fx';

export function mountInfo(root: HTMLElement) {
  const st = settings();
  root.append(h('div', { class: 'stack' },
    h('div', { class: 'card stack', style: { gap: '6px' } },
      h('span', { class: 'lbl' }, L('Design', 'Design')),
      designPicker(),
      h('span', { class: 'lbl', style: { marginTop: '12px' } }, L('Akzentfarbe', 'Accent colour')),
      accentPicker(),
      h('span', { class: 'lbl', style: { marginTop: '12px' } }, L('Bewegung', 'Motion')),
      seg<string>([['system', L('System', 'System')], ['full', L('Voll', 'Full')], ['calm', L('Ruhig', 'Calm')], ['off', L('Aus', 'Off')]], st.motion === 'reduced' ? 'off' : st.motion, v => { saveSettings({ motion: v as any }); applyTheme(); }).el,
      toggle(L('Intro beim Start (π(n)-Zähler)', 'Intro on start (π(n) counter)'), st.intro, v => saveSettings({ intro: v })),
      h('span', { class: 'lbl', style: { marginTop: '8px' } }, L('Sprache', 'Language')),
      seg<'auto' | 'de' | 'en'>([['auto', L('System', 'System')], ['de', 'Deutsch'], ['en', 'English']], languageSetting(), v => { saveSettings({ language: v }); rebuild(); }).el,
      toggle(L('Bildschirm während Tests anlassen', 'Keep screen on during tests'), st.keepAwake, v => saveSettings({ keepAwake: v })),
      toggle(L('Vibration bei Ergebnissen', 'Vibrate on results'), st.haptics, v => saveSettings({ haptics: v })),
      toggle(L('Töne', 'Sounds'), st.sound, v => { saveSettings({ sound: v }); if (v) sfx.check(); }),
      toggle(L('Weltweite Bestenliste (anonym)', 'Worldwide leaderboard (anonymous)'), st.lbConsent === 'yes', v => saveSettings({ lbConsent: v ? 'yes' : 'no', ...(v ? {} : { lbQueue: [] }) }),
        L('Modell, Chip und Punkte zum Durchschnitt deines Gerätemodells beitragen', 'Contribute model, chip and points to your device model’s average'))),
    h('div', { class: 'card' },
      h('h2', null, `PrimSieb ${VERSION}`),
      h('p', { class: 'sub' }, L('Primzahl- und KI-Benchmark für Handy und Tablet – die mobile Ausgabe von PrimSieb für Windows. Sieb des Eratosthenes auf allen Kernen, Schwarzes Loch mit echtem Raytracing durch die gekrümmte Raumzeit, Sternentwicklung von der Gaswolke bis zur Supernova, Mathe-Labor, KI- und Speichertests. Jedes Ergebnis wird mit unabhängigen Kontrollwerten geprüft.',
        'Prime and AI benchmark for phones and tablets – the mobile edition of PrimSieb for Windows. Sieve of Eratosthenes on all cores, a black hole with real ray tracing through curved spacetime, stellar evolution from gas cloud to supernova, math lab, AI and memory tests. Every result is verified against independent check values.')),
      h('p', { class: 'muted small' }, `${L('Plattform', 'Platform')}: ${platform} · ${navigator.hardwareConcurrency || '?'} ${L('Kerne', 'cores')}`)),
    h('div', { class: 'card' },
      h('h2', null, L('Datenschutz', 'Privacy')),
      h('p', { class: 'sub' }, L('PrimSieb braucht kein Konto, enthält keine Werbung und keine Analyse- oder Tracking-Dienste. Ergebnisse und Einstellungen liegen auf diesem Gerät. Nur wenn du der weltweiten Bestenliste zustimmst, werden pro Ergebnis anonym Gerätemodell, Chip, Test, Punkte, App-Version und eine zufällige Installations-Kennung gesendet – kein Name, kein Standort. Die Zustimmung lässt sich hier jederzeit zurücknehmen.',
        'PrimSieb needs no account and contains no ads and no analytics or tracking services. Results and settings stay on this device. Only if you agree to the worldwide leaderboard, each result is sent anonymously with device model, chip, test, points, app version and a random installation ID – no name, no location. You can withdraw consent here at any time.'))),
    h('div', { class: 'card' },
      h('h2', null, L('Hinweise', 'Notes')),
      h('p', { class: 'sub small' }, L('Benchmarks belasten Prozessor und Grafik voll – das Gerät wird warm und der Akku leert sich schneller. Handys drosseln bei Hitze; Ergebnisse schwanken daher stärker als am PC. Die Punkte der Singularität sind wegen der festen Auflösung (960×540) nicht direkt mit der Windows-Version vergleichbar, die Primzahl-Punkte schon.',
        'Benchmarks fully load the CPU and GPU – the device gets warm and the battery drains faster. Phones throttle when hot, so results vary more than on a PC. Singularity points are not directly comparable with the Windows version because of the fixed resolution (960×540); prime points are.'))),
  ));
}

function designPicker() {
  const cur = settings().design;
  const grid = h('div', { class: 'dgrid' });
  const fonts: Record<string, [string, string, string, string]> = {
    nebel: ['system-ui, sans-serif', '800', 'normal', 'none'], studio: ['system-ui, sans-serif', '900', 'normal', 'uppercase'],
    observatorium: ['Georgia, serif', '500', 'italic', 'none'], labor: ['ui-monospace, monospace', '700', 'normal', 'uppercase'], papier: ['Georgia, serif', '700', 'normal', 'none'],
  };
  for (const d of DESIGNS) {
    const [ff, fw, fs, cs] = fonts[d.id];
    const c = h('div', { class: 'dcard' + (d.id === cur ? ' on' : ''), style: { '--dbg': d.bg, '--dink': d.ink, '--dff': ff, '--dfw': fw, '--dfs': fs, '--dcase': cs } as any,
      onclick: (e: MouseEvent) => {
        grid.querySelectorAll('.dcard').forEach(x => x.classList.remove('on')); c.classList.add('on');
        switchDesign(() => { saveSettings({ design: d.id }); applyTheme(); }, e.clientX, e.clientY);
      } },
      h('div', { class: 'sw' }, h('i', { style: { background: d.accent } }), h('i', { style: { background: d.accent2 } }), h('i', { style: { background: d.ink } })),
      h('div', null, h('b', null, L(d.de, d.en)), h('br'), h('small', null, L(d.tagDe, d.tagEn))));
    grid.append(c);
  }
  return grid;
}

function accentPicker() {
  const cur = settings().accent;
  const opts = ['system', ...Object.keys(ACCENTS)] as ('system' | keyof typeof ACCENTS)[];
  const row = h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } });
  for (const a of opts) {
    // „system“ = Akzent des Designs
    const col = a === 'system' ? 'conic-gradient(var(--text) 0 50%, var(--bg) 0)' : ACCENTS[a][0];
    const b = h('button', {
      'aria-label': a, style: { width: '38px', height: '38px', borderRadius: '50%', border: '0', background: col, cursor: 'pointer',
        boxShadow: a === cur ? '0 0 0 3px var(--bg), 0 0 0 5px var(--text)' : 'none' },
      onclick: () => { saveSettings({ accent: a }); applyTheme(); row.querySelectorAll('button').forEach(x => (x.style.boxShadow = 'none')); b.style.boxShadow = '0 0 0 3px var(--bg), 0 0 0 5px var(--text)'; },
    });
    row.append(b);
  }
  return row;
}
