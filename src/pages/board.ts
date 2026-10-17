// Seite „Bestenliste“: eigene Ergebnisse (lokal) und weltweit (Durchschnitt je Gerätemodell, anonym).
import { F, L, N, dateStr } from '../core/i18n';
import { GAME_KINDS, LbKind, ModelRow, fetchModel, fetchTop, flush, gameGroup, lbConfigured, myModel, todayKey } from '../core/leaderboard';
import { shareText } from '../core/native';
import { ScoreEntry, deleteScores, saveSettings, scores, settings } from '../core/store';
import { confirmSheet, h, seg } from '../ui/dom';
import { rankFor } from '../ui/fx';

const KINDS: [ScoreEntry['kind'], () => string][] = [
  ['device', () => L('Geräte-Check', 'Device check')], ['prime', () => L('Primzahlen', 'Primes')], ['bh', () => L('Singularität', 'Singularity')],
  ['ai', () => L('KI', 'AI')], ['game', () => L('Jagd · Klassisch', 'Hunt · classic')], ['blitz', () => 'Jagd · Blitz'], ['split', () => L('Planetenspalter', 'Planet Splitter')], ['daily', () => L('Jagd · Täglich', 'Hunt · daily')], ['profi', () => L('Mathe-Profi', 'Math pro')], ['pidigits', () => L('π-Stellen', 'π digits')], ['pi', () => 'π'], ['fib', () => 'Fibonacci'], ['fibprime', () => L('Fib.-Primzahlen', 'Fib. primes')],
  ['nbody', () => L('N-Körper', 'N-body')], ['collatz', () => 'Collatz'], ['ram', () => L('Speicher', 'Memory')],
];
const WORLD: [LbKind, () => string, () => string][] = [
  ['device', () => L('Geräte-Check', 'Device check'), () => L('Punkte', 'points')],
  ['prime', () => L('Primzahlen', 'Primes'), () => L('Punkte', 'points')],
  ['bh', () => L('Singularität', 'Singularity'), () => L('Punkte', 'points')],
  ['ai', () => L('KI (FP16)', 'AI (FP16)'), () => 'GFLOPS'],
  ['profi', () => L('🧠 Mathe-Profi', '🧠 Math pro'), () => L('Stufe', 'stage')],
  ['pidigits', () => L('π-Stellen', 'π digits'), () => L('Stellen', 'digits')],
  ['game', () => L('🎯 Jagd', '🎯 Hunt'), () => L('Punkte', 'points')],
  ['blitz', () => '⚡ Blitz', () => L('Punkte', 'points')],
  ['split', () => L('🪐 Planetenspalter', '🪐 Planet Splitter'), () => L('Punkte', 'points')],
  ['daily', () => L('📅 Heute', '📅 Today'), () => L('Punkte', 'points')],
];
let lastKind: ScoreEntry['kind'] = 'device';
let lastWorld: LbKind = 'device';
let lastTab: 'mine' | 'world' = 'mine';

/** Wert, nach dem sortiert wird (größer = besser; bei Fibonacci-Primzahlen Zeit → kleiner = besser). */
export const rankValue = (e: ScoreEntry) => (e.kind === 'fibprime' ? -e.score : e.points ?? e.score);
export function mainValue(e: ScoreEntry): [string, string] {
  if (e.kind === 'prime' || e.kind === 'device') return [N(e.points ?? 0), L('Punkte', 'points')];
  if (e.kind === 'bh') return [N(e.points ?? 0), L(`Punkte · ${F(e.score, 1)} FPS`, `points · ${F(e.score, 1)} FPS`)];
  if (e.kind === 'ai') return [N(e.score), 'GFLOPS FP16'];
  if (e.kind === 'game' || e.kind === 'blitz' || e.kind === 'split' || e.kind === 'daily') return [N(e.score), L('Punkte', 'points')];
  if (e.kind === 'profi') return [N(e.score), L('Stufe', 'stage')];
  if (e.kind === 'pidigits') return [N(e.score), L('Stellen', 'digits')];
  return [F(e.score, e.score < 10 ? 2 : 1), e.unit];
}

export function mountBoard(root: HTMLElement) {
  const body = h('div', { class: 'stack' });
  const tabs = seg<'mine' | 'world'>([['mine', L('Meine Ergebnisse', 'My results')], ['world', L('Weltweit', 'Worldwide')]], lastTab, v => { lastTab = v; render(); });
  root.append(h('div', { class: 'stack' }, tabs.el, body));
  const render = () => { body.innerHTML = ''; if (lastTab === 'mine') renderMine(body); else void renderWorld(body); };
  render();
}

// ------------------------------------------------------------------------------------------- Meine
function renderMine(body: HTMLElement) {
  const chips = h('div', { class: 'chips' });
  const list = h('div', { class: 'card list' });
  const shareBtn = h('button', { class: 'btn', onclick: () => void share() }, L('Teilen', 'Share'));
  const delBtn = h('button', { class: 'btn stop', onclick: () => void del() }, L('Alle löschen', 'Delete all'));
  const podium = h('div', { class: 'podium' });
  body.append(chips, podium, list, h('div', { class: 'row' }, shareBtn, delBtn));

  function render() {
    const all = scores().filter(e => e.valid);
    chips.innerHTML = '';
    for (const [k, label] of KINDS) {
      const n = all.filter(e => e.kind === k).length;
      chips.append(h('button', { class: 'chip' + (k === lastKind ? ' on' : ''), onclick: () => { lastKind = k; render(); } }, `${label()}${n ? ` · ${n}` : ''}`));
    }
    const rows = all.filter(e => e.kind === lastKind).sort((a, b) => rankValue(b) - rankValue(a));
    list.innerHTML = '';
    podium.innerHTML = '';
    // Podium wie am Desktop: Platz 2 · 1 · 3
    if (rows.length) {
      for (const i of [1, 0, 2]) {
        const e = rows[i];
        podium.append(h('div', { class: 'p' }, e ? h('div', { class: 'who' }, e.model || e.detail || '') : '', e ? h('div', { class: 'v' }, mainValue(e)[0]) : '',
          h('div', { class: 'blk', style: e ? undefined : { opacity: '.25' } }, String(i + 1))));
      }
    }
    if (!rows.length) { list.append(h('div', { class: 'muted', style: { padding: '18px 4px', textAlign: 'center' } }, L('Noch keine Ergebnisse für diesen Test.', 'No results for this test yet.'))); return; }
    rows.forEach((e, i) => {
      const [v, unit] = mainValue(e);
      list.append(h('div', { class: 'score-row' },
        h('div', { class: 'rank' }, i === 0 ? '🏆' : String(i + 1)),
        h('div', { class: 'main' }, h('b', null, e.detail || e.model || ''), h('span', null, `${dateStr(e.time)}${e.model ? ' · ' + e.model : ''}`)),
        h('div', { class: 'val' }, v, h('small', null, unit))));
    });
  }
  async function share() {
    const rows = scores().filter(e => e.valid && e.kind === lastKind).sort((a, b) => rankValue(b) - rankValue(a)).slice(0, 10);
    if (!rows.length) return;
    const label = KINDS.find(k => k[0] === lastKind)![1]();
    const text = `PrimSieb – ${label}\n` + rows.map((e, i) => { const [v, u] = mainValue(e); return `${i + 1}. ${v} ${u} – ${e.detail ?? ''} (${dateStr(e.time)}${e.model ? ', ' + e.model : ''})`; }).join('\n');
    await shareText('PrimSieb', text);
  }
  async function del() {
    if (await confirmSheet(L('Alle Ergebnisse löschen?', 'Delete all results?'), L('Die Bestenliste wird auf diesem Gerät geleert. Das lässt sich nicht rückgängig machen.', 'The leaderboard on this device will be cleared. This cannot be undone.'), L('Löschen', 'Delete'), L('Behalten', 'Keep'))) {
      deleteScores(); render();
    }
  }
  render();
}

// ------------------------------------------------------------------------------------------- Weltweit
async function renderWorld(body: HTMLElement) {
  if (!lbConfigured()) {
    body.append(h('div', { class: 'card' }, h('h2', null, L('Noch nicht verbunden', 'Not connected yet')),
      h('p', { class: 'sub' }, L('Die weltweite Bestenliste ist in dieser Version noch nicht mit einem Server verbunden.', 'The worldwide leaderboard is not connected to a server in this version yet.'))));
    return;
  }
  const consent = settings().lbConsent;
  if (consent !== 'yes')
    body.append(h('div', { class: 'card' },
      h('p', { class: 'sub' }, L('Du machst noch nicht mit. Deine Ergebnisse werden anonym zum Durchschnitt deines Gerätemodells gezählt – nur Modell, Chip, Test und Punkte.',
        'You are not taking part yet. Your results count anonymously towards your device model\'s average – only model, chip, test and points.')),
      h('button', { class: 'btn primary block', onclick: () => { saveSettings({ lbConsent: 'yes' }); void flush(); body.innerHTML = ''; void renderWorld(body); } }, L('Mitmachen', 'Join'))));

  const chips = h('div', { class: 'chips' }, WORLD.map(([k, label]) =>
    h('button', { class: 'chip' + (k === lastWorld ? ' on' : ''), onclick: () => { lastWorld = k; body.innerHTML = ''; void renderWorld(body); } }, label())));
  const mine = h('div', { class: 'hero' }, h('div', { class: 'label' }, L('Lade …', 'Loading …')));
  const list = h('div', { class: 'card list' }, h('div', { class: 'muted', style: { padding: '14px 4px' } }, L('Lade Rangliste …', 'Loading ranking …')));
  const foot = h('p', { class: 'muted small', style: { textAlign: 'center' } });
  body.append(chips, mine, list, foot);

  const kind = lastWorld;
  const unit = WORLD.find(w => w[0] === kind)![2]();
  if (GAME_KINDS.has(kind)) { await renderGameWorld(kind, unit, mine, list, foot); return; }
  try {
    const { model } = await myModel();
    const myBest = Math.max(0, ...scores().filter(e => e.valid && e.kind === kind).map(e => (kind === 'ai' ? e.score : e.points ?? 0)));
    const [top, me] = await Promise.all([fetchTop(kind), fetchModel(kind, model, myBest || undefined)]);
    // eigenes Modell
    mine.innerHTML = '';
    mine.append(h('div', { class: 'label' }, L('Dein Gerät', 'Your device')), h('div', { class: 'big', style: { fontSize: '22px' } }, model));
    if (me.stats) {
      mine.append(
        h('div', { class: 'label', style: { marginTop: '6px' } },
          L(`Platz ${me.rank} von ${top.devices.length} Modellen · Ø ${N(me.stats.avg)} ${unit} aus ${me.stats.n} Geräten`,
            `Rank ${me.rank} of ${top.devices.length} models · avg ${N(me.stats.avg)} ${unit} from ${me.stats.n} devices`)),
        myBest ? h('div', { class: 'label' }, me.below != null && me.stats.n > 1
          ? L(`Dein Bestwert ${N(myBest)} ist besser als ${Math.round(me.below * 100)} % der Geräte deines Modells.`, `Your best ${N(myBest)} beats ${Math.round(me.below * 100)} % of devices of your model.`)
          : L(`Dein Bestwert: ${N(myBest)} – du bist der Erste mit diesem Modell!`, `Your best: ${N(myBest)} – you are the first with this model!`)) : '');
    } else mine.append(h('div', { class: 'label', style: { marginTop: '6px' } }, L('Für dein Modell gibt es noch keine Ergebnisse – sei das erste!', 'No results for your model yet – be the first!')));
    // Liste
    list.innerHTML = '';
    if (!top.devices.length) list.append(h('div', { class: 'muted', style: { padding: '14px 4px' } }, L('Noch keine Einträge.', 'No entries yet.')));
    top.devices.forEach((d: ModelRow, i: number) => {
      const own = d.model === model;
      const rk = kind === 'device' || kind === 'prime' || kind === 'bh' || kind === 'ai' ? rankFor(kind, d.avg) : null;
      list.append(h('div', { class: 'score-row', style: own ? { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', borderRadius: '12px', padding: '11px 8px' } : undefined },
        h('div', { class: 'rank' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)),
        h('div', { class: 'main' }, h('b', null, d.model), h('span', null, `${d.soc} · ${d.n} ${d.n === 1 ? L('Gerät', 'device') : L('Geräte', 'devices')}`)),
        h('div', { class: 'val', style: rk ? { color: rk.color } : undefined }, N(d.avg), h('small', null, `Ø ${unit}`))));
    });
    foot.textContent = L(`${N(top.participants)} Teilnehmer · je Gerät zählt dessen bestes Ergebnis`, `${N(top.participants)} participants · each device counts with its best result`);
  } catch (e: any) {
    mine.innerHTML = '';
    mine.append(h('div', { class: 'label' }, L('Keine Verbindung zum Server. Prüfe die Internetverbindung.', 'No connection to the server. Check your internet connection.')));
    list.remove();
  }
}

/** Spielmodi: weltweite Werte aller Spieler (Teilnehmer, Durchschnitt, Bestwert) und eigene Einordnung. */
async function renderGameWorld(kind: LbKind, unit: string, mine: HTMLElement, list: HTMLElement, foot: HTMLElement) {
  const group = kind === 'daily' ? todayKey() : gameGroup(kind);
  const myBest = Math.max(0, ...scores().filter(e => e.valid && e.kind === kind && (kind !== 'daily' || e.detail === group)).map(e => e.points ?? e.score));
  const title = WORLD.find(w => w[0] === kind)![1]();
  try {
    const r = await fetchModel(kind, group, myBest || undefined);
    mine.innerHTML = '';
    mine.append(h('div', { class: 'label' }, kind === 'daily' ? L(`Tages-Challenge ${group}`, `Daily challenge ${group}`) : L('Alle Spieler weltweit', 'All players worldwide')),
      h('div', { class: 'big', style: { fontSize: '22px' } }, title),
      h('div', { class: 'label', style: { marginTop: '6px' } }, myBest
        ? (r.stats && r.stats.n > 1 && r.below != null
          ? L(`Dein Rekord ${N(myBest)} ${unit} ist besser als ${Math.round(r.below * 100)} % aller Spieler.`, `Your best ${N(myBest)} ${unit} beats ${Math.round(r.below * 100)} % of all players.`)
          : L(`Dein Rekord: ${N(myBest)} ${unit}`, `Your best: ${N(myBest)} ${unit}`))
        : L('Spiel eine Runde, um dich einzuordnen!', 'Play a round to see where you stand!')));
    list.innerHTML = '';
    const row = (k: string, v: string) => h('div', { class: 'score-row' }, h('div', { class: 'main' }, h('b', null, k)), h('div', { class: 'val' }, v));
    if (!r.stats) list.append(h('div', { class: 'muted', style: { padding: '14px 4px' } }, L('Noch keine Ergebnisse – sei der Erste!', 'No results yet – be the first!')));
    else list.append(
      row(L('🏆 Bester Spieler', '🏆 Best player'), `${N(r.stats.best)} ${unit}`),
      row(L('Durchschnitt', 'Average'), `${N(r.stats.avg)} ${unit}`),
      row(L('Teilnehmer', 'Players'), N(r.stats.n)),
      myBest ? row(L('Du', 'You'), `${N(myBest)} ${unit}`) : '');
    foot.textContent = L('Anonym: Gewertet wird je Installation das beste Ergebnis.', 'Anonymous: each installation counts with its best result.');
  } catch {
    mine.innerHTML = '';
    mine.append(h('div', { class: 'label' }, L('Keine Verbindung zum Server. Prüfe die Internetverbindung.', 'No connection to the server. Check your internet connection.')));
    list.remove();
  }
}
