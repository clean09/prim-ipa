import './style.css';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { L, setLanguage } from './core/i18n';
import { isNative } from './core/native';
import { busy, initImmersive, initNav, setBusy } from './core/nav';
import { loadStore, saveSettings, settings } from './core/store';
import { DESIGNS, applyTheme, motionLevel, switchDesign } from './core/theme';
import { startBackground } from './ui/background';
import { sfx } from './ui/fx';
import { flush, setConsentDialog } from './core/leaderboard';
import { confirmSheet, h, sheet } from './ui/dom';
import { showHelp } from './ui/help';
import { ICONS, IconName } from './ui/icons';
import { curtain, intro, maskTitle, reveal, scramble, tilt } from './ui/motion';
import { PAGES, Page } from './pages';

type Cleanup = void | (() => void);

const pageEl = document.getElementById('page')!;
const tabsEl = document.getElementById('tabs')!;
const markEl = document.getElementById('tabmark')!;
const titleEl = document.getElementById('title')!;
const idxEl = document.getElementById('idx')!;
const backBtn = document.getElementById('back') as HTMLButtonElement;
const helpBtn = document.getElementById('help') as HTMLButtonElement;
const searchBtn = document.getElementById('search') as HTMLButtonElement;
const app = document.getElementById('app')!;

let current: Page | null = null;
let cleanup: Cleanup;

const TABS: [string, IconName, () => string][] = [
  ['home', 'home', () => L('Start', 'Home')],
  ['star', 'star', () => L('Sterne', 'Stars')],
  ['games', 'game', () => L('Spiele', 'Games')],
  ['device', 'chip', () => L('Gerät', 'Device')],
  ['more', 'more', () => L('Alles', 'All')],
];
/** Reihenfolge aller Seiten (für Seitennummer und Fahrtrichtung). */
const ORDER = ['home', 'star', 'solar', 'games', 'rogue', 'play', 'device', 'more', 'prime', 'ai', 'ram', 'bh', 'lab', 'board', 'check', 'info'];

function renderTabs() {
  tabsEl.querySelectorAll('button').forEach(b => b.remove());
  for (const [id, ic, label] of TABS) {
    const b = h('button', { 'data-tab': id, onclick: () => { sfx.tap(); void go(id); } });
    b.innerHTML = ICONS[ic];
    b.append(h('span', null, label()));
    tabsEl.append(b);
  }
}

/** Gleitende Marke unter dem aktiven Tab. */
function moveMark() {
  const on = tabsEl.querySelector('button.on') as HTMLElement | null;
  if (!on) { markEl.style.opacity = '0'; return; }
  markEl.style.opacity = '1';
  markEl.style.width = `${on.offsetWidth}px`;
  markEl.style.transform = `translateX(${on.offsetLeft}px)`;
}

async function go(id: string, replace = false) {
  if (current?.id === id) { pageEl.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (busy.running) {
    const ok = await confirmSheet(L('Messung läuft', 'Test running'),
      L(`„${busy.label}“ läuft noch. Abbrechen und die Seite wechseln?`, `"${busy.label}" is still running. Cancel it and switch pages?`),
      L('Abbrechen und wechseln', 'Cancel and switch'), L('Weiter messen', 'Keep running'));
    if (!ok) return;
  }
  if (replace) history.replaceState(null, '', '#/' + id); else history.pushState(null, '', '#/' + id);
  // Vorhang nur beim Wechsel zwischen Hauptbereichen (Tabs), nicht in Unterseiten
  const target = PAGES[id];
  if (current && target && !target.parent && !current.parent && TABS.some(t => t[0] === id)) {
    await curtain(target.title(), `(${String(ORDER.indexOf(id) + 1).padStart(2, '0')})`);
  }
  show(id);
}

function show(id: string) {
  const page = PAGES[id] ?? PAGES.home;
  try { if (typeof cleanup === 'function') cleanup(); } catch (e) { console.error(e); }
  setBusy(false);
  document.querySelectorAll('#sheet-root > *').forEach(e => e.remove());
  const dir = current ? Math.sign(ORDER.indexOf(page.id) - ORDER.indexOf(current.id)) || 1 : 0;
  current = page;
  pageEl.innerHTML = '';
  pageEl.className = (page.full ? 'full' : '') + (dir > 0 ? ' in-r' : dir < 0 ? ' in-l' : '');
  void pageEl.offsetWidth;
  pageEl.scrollTop = 0;
  app.classList.remove('immersive');
  app.dataset.page = page.id;
  titleEl.textContent = page.title();
  const no = ORDER.indexOf(page.id) + 1;
  idxEl.textContent = page.id === 'home' ? '' : `${String(no).padStart(2, '0')} / ${String(ORDER.length).padStart(2, '0')}`;
  backBtn.hidden = !page.parent;
  helpBtn.hidden = !page.help;
  const tab = page.parent ?? page.id;
  tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
  moveMark();
  // großer Seitenkopf (Rubrik + Titel aus der Maske)
  if (!page.full && !page.noHead) {
    const k = h('div', { class: 'phead-k' }, `(${String(no).padStart(2, '0')}) — ${page.kicker?.() ?? ''}`);
    const head = h('header', { class: 'phead', 'data-no': String(no).padStart(2, '0') }, k, maskTitle(page.title()));
    pageEl.append(head);
    scramble(k);
  }
  cleanup = page.mount(pageEl);
  // Karten/Abschnitte gestaffelt einblenden
  if (!page.full) {
    const st = pageEl.querySelector(':scope > .stack');
    st?.querySelectorAll(':scope > *').forEach(el => el.classList.add('rv'));
    reveal(pageEl);
    pageEl.querySelectorAll<HTMLElement>('.hero, .feat, .pf-hero, .dcard').forEach(el => tilt(el));
  }
}

/** Nach Sprachwechsel alles neu aufbauen. */
function rebuild() {
  setLanguage(settings().language);
  applyTheme();
  renderTabs();
  const id = current?.id ?? 'home';
  current = null;
  show(id);
}

// ------------------------------------------------------------------------------------------- Register (Strg+K am Desktop)
function openRegister() {
  const input = h('input', { type: 'text', placeholder: L('Seite, Test oder Design suchen …', 'Search page, test or design …'), autocomplete: 'off' });
  const list = h('div', { class: 'reg-list' });
  const items: { label: string; sub: string; keys: string; run: (e: MouseEvent) => void }[] = [];
  ORDER.forEach((id, i) => {
    const p = PAGES[id];
    if (!p || id === 'play') return;
    items.push({ label: p.title(), sub: `${String(i + 1).padStart(2, '0')} · ${p.kicker?.() ?? L('Start', 'Home')}`, keys: `${p.title()} ${p.keys ?? ''}`.toLowerCase(), run: () => { close(); void go(id); } });
  });
  DESIGNS.forEach(d => items.push({
    label: `${L('Design', 'Design')}: ${L(d.de, d.en)}`, sub: L(d.tagDe, d.tagEn), keys: `design theme ${d.de} ${d.en}`.toLowerCase(),
    run: e => { close(); switchDesign(() => { saveSettings({ design: d.id }); applyTheme(); }, e.clientX, e.clientY); },
  }));
  const render = () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    items.filter(it => !q || it.keys.includes(q) || it.label.toLowerCase().includes(q)).forEach((it, i) =>
      list.append(h('button', { class: 'reg-item', onclick: it.run },
        h('span', { class: 'reg-n' }, String(i).padStart(2, '0')), h('span', { class: 'reg-t' }, h('b', null, it.label), h('small', null, it.sub)), h('span', { class: 'reg-a' }, '→'))));
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') (list.querySelector('.reg-item') as HTMLElement | null)?.click(); });
  const close = sheet(L('Register', 'Index'), input, list);
  render();
  setTimeout(() => input.focus(), 60);
}

backBtn.onclick = () => { if (current?.parent) history.length > 1 ? history.back() : go(current.parent, true); };
helpBtn.onclick = () => { if (current?.help) showHelp(current.help); };
searchBtn.onclick = () => { sfx.tap(); openRegister(); };
window.addEventListener('popstate', () => {
  const id = location.hash.replace(/^#\/?/, '') || 'home';
  if (busy.running) { setBusy(false); }
  show(id);
});
window.addEventListener('resize', moveMark);
// Kopf verdichtet sich beim Scrollen (Titel erscheint klein, wenn der große Titel weg ist)
const progressEl = document.createElement('i');
progressEl.id = 'scrollbar';
document.getElementById('top')!.append(progressEl);
pageEl.addEventListener('scroll', () => {
  const y = pageEl.scrollTop;
  app.classList.toggle('scrolled', y > 70);
  // Lesefortschritt + Parallaxe des großen Seitenkopfs
  const max = pageEl.scrollHeight - pageEl.clientHeight;
  progressEl.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  const head = pageEl.querySelector<HTMLElement>('.phead, .h-hero');
  if (head && y < 600) { head.style.setProperty('--py', `${y * 0.35}px`); head.style.setProperty('--po', String(Math.max(0, 1 - y / 320))); }
}, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.dispatchEvent(new Event('app-hidden'));
});

initNav(id => void go(id), rebuild);
initImmersive(on => app.classList.toggle('immersive', on));

async function start() {
  await loadStore();
  setLanguage(settings().language);
  applyTheme();
  startBackground();
  setConsentDialog(async answer => {
    while (document.querySelector('.rs-wrap')) await new Promise(r => setTimeout(r, 400));
    let done = false;
    const close = sheet(L('Bei der weltweiten Bestenliste mitmachen?', 'Join the worldwide leaderboard?'),
      h('p', null, L('Dein Ergebnis wird anonym mit dem Durchschnitt aller Geräte deines Modells verglichen und fließt selbst in diesen Durchschnitt ein.',
        'Your result is compared anonymously with the average of all devices of your model and itself counts towards that average.')),
      h('p', { class: 'small' }, L('Gesendet werden nur: Gerätemodell, Chip, Test, Punkte, App-Version und eine zufällige Installations-Kennung (gegen Mehrfachzählung). Kein Name, kein Konto, kein Standort. Jederzeit abschaltbar unter Einstellungen.',
        'Only sent: device model, chip, test, points, app version and a random installation ID (against double counting). No name, no account, no location. Can be turned off any time in Settings.')),
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn', onclick: () => { done = true; close(); answer(false); } }, L('Nein danke', 'No thanks')),
        h('button', { class: 'btn primary', onclick: () => { done = true; close(); answer(true); } }, L('Mitmachen', 'Join'))));
    document.querySelector('.sheet-bg')?.addEventListener('click', () => { if (!done) answer(false); });
  });
  void flush();
  renderTabs();
  const id = location.hash.replace(/^#\/?/, '') || 'home';
  history.replaceState(null, '', '#/' + id);
  if (isNative) {
    CapApp.addListener('backButton', () => {
      const fs = document.querySelector('[data-fs]') as any;
      if (fs) { fs.close?.(); return; }
      if (document.querySelector('.sheet')) { (document.querySelector('.sheet-bg') as HTMLElement)?.click(); return; }
      if (current?.parent) history.back();
      else if (current?.id !== 'home') go('home');
      else CapApp.exitApp();
    });
    await SplashScreen.hide();
  }
  const showIntro = settings().intro && motionLevel() !== 'off' && !sessionStorage.getItem('primsieb.intro');
  if (showIntro) {
    try { sessionStorage.setItem('primsieb.intro', '1'); } catch { /* egal */ }
    app.classList.add('pre');
    await intro();
    app.classList.remove('pre');
  }
  show(id);
}

start();
