// Seite „Zahl prüfen“: Miller-Rabin für beliebige Ausdrücke, Lucas-Lehmer für Mersenne-Zahlen (M127).
import { F, L, N, tr } from '../core/i18n';
import { MathPool, isCancel } from '../core/pool';
import { h, progress } from '../ui/dom';

const EXAMPLES = ['2^127-1', '10^18+3', 'M521', '2^89-1', '(2^61-1)*(2^31-1)', '1000000007', 'M4423'];

export function mountCheck(root: HTMLElement) {
  let pool: MathPool | null = null;
  const input = h('textarea', { placeholder: L('Zahl oder Ausdruck, z. B. 2^127-1 oder M127', 'Number or expression, e.g. 2^127-1 or M127'), spellcheck: false, autocapitalize: 'off', autocomplete: 'off' });
  const result = h('div', { class: 'hero', style: { display: 'none' } });
  const prog = progress();
  prog.el.style.display = 'none';
  const btn = h('button', { class: 'btn primary', onclick: () => void check() }, L('Prüfen', 'Check'));
  const cancelBtn = h('button', { class: 'btn stop', style: { display: 'none' }, onclick: () => pool?.cancel() }, L('Abbrechen', 'Cancel'));
  const chips = h('div', { class: 'chips' }, EXAMPLES.map(e => h('button', { class: 'chip', onclick: () => { input.value = e; void check(); } }, e)));

  root.append(h('div', { class: 'stack' },
    h('div', { class: 'card stack', style: { gap: '10px' } }, input, chips, h('div', { class: 'row' }, btn, cancelBtn), prog.el),
    result,
    h('div', { class: 'card' }, h('h3', null, L('So geht’s', 'How it works')),
      h('p', { class: 'sub small' }, L('Erlaubt sind + − * ^ und Klammern. Tausenderpunkte und Leerzeichen werden ignoriert. „M“ + Exponent prüft die Mersenne-Zahl 2^p − 1 mit dem Lucas-Lehmer-Test (bis p = 200.000).',
        'Allowed: + − * ^ and parentheses. Thousands separators and spaces are ignored. "M" + exponent checks the Mersenne number 2^p − 1 with the Lucas-Lehmer test (up to p = 200,000).')))));

  async function check() {
    const text = input.value.trim();
    if (!text) return;
    pool ??= new MathPool(1);
    btn.disabled = true; cancelBtn.style.display = ''; prog.el.style.display = ''; prog.set(0);
    result.style.display = 'none';
    try {
      const r: any = await pool.run({ type: 'check', text }, f => prog.set(f));
      result.style.display = '';
      result.innerHTML = '';
      if (r.kind === 'error') { result.append(h('div', { class: 'label bad' }, tr(r.message))); return; }
      if (r.kind === 'empty') { result.style.display = 'none'; return; }
      const prime = r.prime;
      const head = r.kind === 'mersenne'
        ? `M${N(r.p)} = 2^${N(r.p)} − 1`
        : (r.digits <= 40 ? r.head : `${r.head}…${r.tail}`);
      result.append(
        h('div', { class: 'label selectable', style: { wordBreak: 'break-all' } }, head),
        h('div', { class: 'big ' + (prime ? 'good' : 'bad') }, prime ? L('PRIM', 'PRIME') : L('nicht prim', 'not prime')),
        h('div', { class: 'label' }, r.kind === 'mersenne'
          ? L(`Lucas-Lehmer-Test · ${F(r.seconds, 3)} s`, `Lucas-Lehmer test · ${F(r.seconds, 3)} s`)
          : L(`${N(r.digits)} Ziffern · Miller-Rabin, ${r.det ? 'sicher' : 'probabilistisch (Fehler < 4⁻¹⁶)'} · ${F(r.seconds, 3)} s`,
              `${N(r.digits)} digits · Miller-Rabin, ${r.det ? 'certain' : 'probabilistic (error < 4⁻¹⁶)'} · ${F(r.seconds, 3)} s`)));
    } catch (e: any) {
      result.style.display = '';
      result.innerHTML = '';
      result.append(h('div', { class: 'label' }, isCancel(e) ? L('Abgebrochen', 'Cancelled') : String(e?.message ?? e)));
    } finally {
      btn.disabled = false; cancelBtn.style.display = 'none'; prog.el.style.display = 'none';
    }
  }

  return () => pool?.dispose();
}
