// Einstellungs-Blatt von STERNENFALL: Musik, Effekte, Grafikstufe, Tempo, Wackeln, Vibration.
import { L } from '../../core/i18n';
import { settings } from '../../core/store';
import { h, sheet } from '../../ui/dom';
import { snd } from '../juice';
import { SfSettings, setSfs, sfs } from '../settings';

export function showSettings(extra: { label: string; run: () => void }[] = []) {
  const s = sfs();
  const slider = (label: string, key: 'music' | 'sfx', icon: string) => {
    const val = h('b', null, `${Math.round(s[key] * 100)} %`);
    const inp = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(s[key] * 100)), 'aria-label': label }) as HTMLInputElement;
    inp.addEventListener('input', () => { setSfs({ [key]: +inp.value / 100 } as Partial<SfSettings>); val.textContent = `${inp.value} %`; inp.style.setProperty('--p', `${inp.value}%`); });
    inp.addEventListener('change', () => { if (key === 'sfx') snd.coin(); });
    inp.style.setProperty('--p', `${inp.value}%`);
    return h('div', { class: 'sfs-row' }, h('span', { class: 'ic' }, icon), h('div', { class: 'sfs-main' }, h('div', { class: 'sfs-top' }, h('span', null, label), val), inp));
  };
  const seg = <K extends 'gfx' | 'fast'>(key: K, opts: [SfSettings[K], string][], note: (v: SfSettings[K]) => string) => {
    const box = h('div', { class: 'sfs-seg' }), hint = h('small', { class: 'sfs-note' });
    const draw = () => {
      box.innerHTML = '';
      for (const [v, lab] of opts) box.append(h('button', { class: sfs()[key] === v ? 'on' : '', onclick: () => { setSfs({ [key]: v } as Partial<SfSettings>); snd.card(); draw(); } }, lab));
      hint.textContent = note(sfs()[key]);
    };
    draw();
    return h('div', null, box, hint);
  };
  const toggle = (label: string, key: 'shake' | 'haptics', icon: string) => {
    const b = h('button', { class: 'sfs-toggle' + (s[key] ? ' on' : ''), role: 'switch', 'aria-checked': String(s[key]) }, h('i'));
    b.addEventListener('click', () => { const v = !sfs()[key]; setSfs({ [key]: v } as Partial<SfSettings>); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); snd.card(); });
    return h('div', { class: 'sfs-row' }, h('span', { class: 'ic' }, icon), h('div', { class: 'sfs-main' }, h('span', null, label)), b);
  };
  const close = sheet(L('Einstellungen', 'Settings'),
    h('div', { class: 'sfs' },
      h('div', { class: 'sfs-h' }, L('Klang', 'Sound')),
      !settings().sound ? h('p', { class: 'sfs-warn' }, L('Der Ton ist in den App-Einstellungen ausgeschaltet.', 'Sound is turned off in the app settings.')) : '',
      slider(L('Musik', 'Music'), 'music', '♪'),
      slider(L('Effekte', 'Effects'), 'sfx', '✦'),
      h('div', { class: 'sfs-h' }, L('Grafik', 'Graphics')),
      seg('gfx', [['high', L('Hoch', 'High')], ['mid', L('Mittel', 'Medium')], ['low', L('Niedrig', 'Low')]], v =>
        v === 'high' ? L('Relief und Struktur auf Symbolen und Gegnern, bewegter Fotohimmel, volle Teilchen.', 'Relief and texture on symbols and enemies, moving photo sky, full particles.')
          : v === 'mid' ? L('Walzen ohne Relief (flüssigeres Drehen), sonst wie Hoch.', 'Reels without relief (smoother spins), otherwise like High.')
            : L('Für ältere Handys: keine Filter, ruhender Himmel, halbe Teilchen.', 'For older phones: no filters, still sky, half the particles.')),
      h('div', { class: 'sfs-h' }, L('Spielgefühl', 'Feel')),
      seg('fast', [[false, L('Normales Tempo', 'Normal pace')], [true, L('Schnell', 'Fast')]], v => v ? L('Walzen und Gegnerzüge laufen fast doppelt so schnell.', 'Reels and enemy turns run almost twice as fast.') : L('Zeit für Spannung: Walzen laufen aus, Gegner holen aus.', 'Time for suspense: reels wind down, enemies wind up.')),
      toggle(L('Bildschirm wackelt bei Treffern', 'Screen shake on hits'), 'shake', '≋'),
      toggle(L('Vibration', 'Vibration'), 'haptics', '◉'),
      extra.length ? h('div', { class: 'sfs-extra' }, extra.map(x => h('button', { class: 'btn block', onclick: () => { close(); x.run(); } }, x.label))) : ''));
}
