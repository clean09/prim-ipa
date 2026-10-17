// Spiele-Hub: Spielerlevel + XP, Tages-Serie, Tages-Challenge mit Countdown, große Spielkarten mit Sternen, Erfolge.
import { L, N } from '../core/i18n';
import { go } from '../core/nav';
import { todayKey } from '../core/leaderboard';
import { h, sheet } from '../ui/dom';
import { sfx } from '../ui/fx';
import { ACH } from '../games/achievements';
import { TIPS } from '../games/numbers';
import { GameId, levelOf, levelTitle, stats } from '../games/progress';
import { launch } from './play';
import { SpaceKind, spaceStyle } from '../ui/cosmos';
import { meta, nextGoal } from '../rogue/meta';
import { loadRun } from '../rogue/run';

interface Card { id: GameId; art: string; title: () => string; sub: () => string; space: [SpaceKind, number]; unit: () => string; wide?: boolean }
const CARDS: Card[] = [
  { id: 'classic', art: '🎯', title: () => L('Klassisch', 'Classic'), sub: () => L('Primzahlen antippen · 3 Leben', 'Tap primes · 3 lives'), space: ['planet', 205], unit: () => L('Pkt.', 'pts') },
  { id: 'blitz', art: '⚡', title: () => 'Blitz', sub: () => L('60 Sekunden Punktejagd', '60-second score attack'), space: ['sun', 32], unit: () => L('Pkt.', 'pts') },
  { id: 'split', art: '🪐', title: () => L('Planetenspalter', 'Planet Splitter'), sub: () => L('Planeten in ihre Faktoren zerlegen', 'Break planets into their factors'), space: ['ringed', 330], unit: () => L('Pkt.', 'pts') },
  { id: 'profi', art: '🧠', title: () => L('Mathe-Profi', 'Math pro'), sub: () => L('Endlos · immer größere Primzahlen', 'Endless · ever larger primes'), space: ['galaxy', 265], unit: () => L('Stufe', 'stage') },
  { id: 'pi', art: 'π', title: () => L('π-Stellen', 'π digits'), sub: () => L('Wie viele Nachkommastellen kennst du?', 'How many decimals do you know?'), space: ['nebula', 170], unit: () => L('Stellen', 'digits'), wide: true },
];

export function mountGames(root: HTMLElement) {
  const s = stats();
  const lv = levelOf(s.xp);
  const today = todayKey();
  const dailyDone = s.daily?.date === today;

  // ---------------------------------------------------------------- Spieler
  const player = h('div', { class: 'hub-player' },
    h('div', { class: 'hub-avatar', style: { '--p': String(Math.round(lv.frac * 100)) } as any }, h('span', null, String(lv.level))),
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { style: { font: '900 19px system-ui' } }, levelTitle(lv.level)),
      h('div', { style: { fontSize: '13px', opacity: '.85', marginTop: '2px' } }, L(`Level ${lv.level} · ${N(lv.into)} / ${N(lv.need)} XP`, `Level ${lv.level} · ${N(lv.into)} / ${N(lv.need)} XP`)),
      h('div', { class: 'g-xpbar', style: { marginTop: '8px' } }, h('div', { class: 'g-xpfill', style: { width: `${lv.frac * 100}%` } }))),
    h('div', { style: { textAlign: 'center', flex: 'none' } }, h('div', { style: { fontSize: '26px' } }, s.streak ? '🔥' : '💤'),
      h('div', { style: { font: '900 15px system-ui' } }, String(s.streak || 0)), h('div', { style: { fontSize: '10.5px', opacity: '.75' } }, L('Tage', 'days'))));

  // ---------------------------------------------------------------- Tages-Challenge
  const cd = h('div', { style: { fontSize: '12.5px', fontWeight: '800', opacity: '.8' } });
  const tick = () => {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const ms = mid.getTime() - now.getTime(), hh = Math.floor(ms / 3.6e6), mm = Math.floor((ms % 3.6e6) / 6e4);
    cd.textContent = L(`Neue Zahlen in ${hh} h ${mm} min`, `New numbers in ${hh} h ${mm} min`);
  };
  tick();
  const timer = setInterval(tick, 30_000);
  const daily = h('div', { class: 'hub-daily space', style: spaceStyle('moon', 45, true, 5) as any, onclick: () => { sfx.tap(); launch('daily'); } },
    h('div', { class: 'sart' }),
    h('div', { style: { fontSize: '40px' } }, '📅'),
    h('div', { style: { flex: '1' } },
      h('div', { style: { font: '900 18px system-ui' } }, L('Tages-Challenge', 'Daily challenge')),
      h('div', { style: { fontSize: '13px', fontWeight: '700' } }, dailyDone ? L(`Heute: ${N(s.daily!.score)} Punkte – nochmal versuchen?`, `Today: ${N(s.daily!.score)} points – try again?`) : L('Für alle dieselben Zahlen · 60 s', 'Same numbers for everyone · 60 s')),
      cd),
    h('div', { style: { font: '900 26px system-ui' } }, '›'));

  // ---------------------------------------------------------------- Spielkarten
  const grid = h('div', { class: 'hub-grid' }, CARDS.map(c => {
    const best = s.best[c.id] ?? 0, stars = s.stars?.[c.id] ?? 0;
    return h('div', { class: 'hub-card space' + (c.wide ? ' wide' : ''), style: spaceStyle(c.space[0], c.space[1], c.wide, 3) as any, onclick: () => { sfx.tap(); launch(c.id); } },
      h('div', { class: 'sart' }),
      h('div', { class: 'st' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      h('div', { class: 'art', style: c.id === 'pi' ? { fontFamily: 'Georgia, serif', fontWeight: '700', textShadow: '0 0 18px hsl(170 100% 60%)' } : undefined }, c.art),
      h('b', null, c.title()),
      h('small', null, c.sub()),
      h('small', { style: { marginTop: '4px', fontWeight: '800' } }, best ? L(`Rekord ${N(best)} ${c.unit()}`, `Best ${N(best)} ${c.unit()}`) : L('Noch nicht gespielt', 'Not played yet')));
  }));

  // ---------------------------------------------------------------- Erfolge + Weltweit
  const got = s.achievements.length;
  const achRow = h('div', { class: 'card', style: { cursor: 'pointer' }, onclick: () => showAchievements() },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, L('🏅 Erfolge', '🏅 Achievements')), h('span', { class: 'sub' }, `${got} / ${ACH.length} ›`)),
    h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', overflow: 'hidden' } },
      ACH.map(([id, icon]) => h('div', { style: { width: '38px', height: '38px', flex: 'none', borderRadius: '12px', display: 'grid', placeItems: 'center', fontSize: '20px',
        background: s.achievements.includes(id) ? 'linear-gradient(180deg,#ffe066,#ffab1f)' : 'var(--card2)', opacity: s.achievements.includes(id) ? '1' : '.4', filter: s.achievements.includes(id) ? '' : 'grayscale(1)' } }, icon))));
  const world = h('button', { class: 'btn block', onclick: () => go('board') }, L('🌍 Weltweite Bestenliste', '🌍 Worldwide leaderboard'));
  const tips = TIPS();
  const tip = h('p', { class: 'muted small', style: { textAlign: 'center' } }, `💡 ${tips[Math.floor(Math.random() * tips.length)]}`);

  // ---------------------------------------------------------------- PRIMFALL (Roguelike) als Hauptspiel
  const m = meta(), saved = loadRun(), goal = nextGoal();
  const rogue = h('div', { class: 'pf-hero', onclick: () => { sfx.tap(); go('rogue'); } },
    h('div', { class: 'pf-bg' }, ...Array.from({ length: 14 }, (_, i) => h('span', { style: { '--i': String(i) } as any }, String([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43][i])))),
    h('div', { class: 'pf-k' }, L('NEU · Roguelike-Deckbuilder', 'NEW · roguelike deckbuilder')),
    h('div', { class: 'pf-logo' }, h('span', null, 'PRIM'), h('b', null, 'FALL')),
    h('p', null, L('Spiele Karten, triff Primzahlen, baue absurde Kombos. 3 Akte, 3 Bosse, Casino, Flüche – und nach jedem Lauf wirst du stärker.',
      'Play cards, hit primes, build absurd combos. 3 acts, 3 bosses, casino, curses – and you grow stronger after every run.')),
    h('div', { class: 'pf-row' },
      h('div', null, h('b', null, `✨ ${N(m.staub)}`), h('small', null, L('Sternenstaub', 'Stardust'))),
      h('div', null, h('b', null, N(m.bestScore)), h('small', null, L('Rekord', 'Best'))),
      h('div', null, h('b', null, `${m.daily.goals.filter(g => g.done).length}/3`), h('small', null, L('Tagesziele', 'Daily goals')))),
    goal ? h('div', { class: 'pf-goal' }, h('small', null, `${L('Nächste Freischaltung', 'Next unlock')}: ${goal.label}`), h('div', null, h('i', { style: { width: `${Math.min(100, (m.staub / goal.cost) * 100)}%` } }))) : '',
    h('div', { class: 'pf-cta' }, saved ? L(`▶ Lauf fortsetzen · Akt ${saved.act}`, `▶ Continue run · act ${saved.act}`) : L('▶ Spielen', '▶ Play')));
  const arcade = h('div', { class: 'sec-h' }, h('span', { class: 'n' }, '(B)'), h('h2', null, 'Arcade'), h('small', null, L('Kurze Runden', 'Quick rounds')));

  root.append(h('div', { class: 'stack' }, rogue, arcade, player, daily, grid, achRow, world, tip));
  return () => clearInterval(timer);
}

function showAchievements() {
  const s = stats();
  sheet(L('Erfolge', 'Achievements'),
    h('p', { class: 'sub' }, L(`${s.played} Spiele · ${N(s.primes)} Primzahlen · ${N(s.splits)} Schnitte`, `${s.played} games · ${N(s.primes)} primes · ${N(s.splits)} slices`)),
    h('div', { class: 'list' }, ACH.map(([id, icon, t, d]) => {
      const ok = s.achievements.includes(id);
      return h('div', { class: 'item', style: { opacity: ok ? '1' : '.5', cursor: 'default' } },
        h('div', { class: 'ic', style: { background: ok ? 'linear-gradient(180deg,#ffe066,#ffab1f)' : 'var(--card2)', fontSize: '20px', filter: ok ? '' : 'grayscale(1)' } }, icon),
        h('div', { class: 'tx' }, h('b', null, t()), h('span', null, d())));
    })));
}
