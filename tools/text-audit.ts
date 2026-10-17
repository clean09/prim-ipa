// Prüfwerkzeug: sucht abgeschnittene/überlaufende Texte auf allen Seiten und in allen Designs.
// Im Dev-Server (Browser-Konsole, Handygröße einstellen): const a = await import('/tools/text-audit.ts'); await a.audit()
const PAGES = ['home', 'star', 'games', 'device', 'more', 'prime', 'ai', 'ram', 'lab', 'board', 'check', 'info'];
const DESIGNS = ['nebel', 'studio', 'observatorium', 'labor', 'papier'];

export async function audit(pages = PAGES, designs = DESIGNS) {
  const found: string[] = [];
  const key = 'primsieb.settings';
  const orig = localStorage.getItem(key);
  for (const d of designs) {
    const s = JSON.parse(localStorage.getItem(key) || '{}'); s.design = d; s.motion = 'off';
    localStorage.setItem(key, JSON.stringify(s));
    document.documentElement.dataset.design = d;
    document.documentElement.dataset.motion = 'reduced';
    for (const p of pages) {
      location.hash = '#/' + p;
      await new Promise(r => setTimeout(r, 450));
      const vw = document.documentElement.clientWidth;
      for (const el of document.querySelectorAll<HTMLElement>('#page *, #top *, #tabs *')) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        const cs = getComputedStyle(el);
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim().length > 1);
        if (!hasText) continue;
        const r = el.getBoundingClientRect();
        const clipped = (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1;
        const outside = r.right > vw + 1 || r.left < -1;
        // absichtlich waagerecht scrollende Leisten (Chips, Laufband) und Spiele-Erfolgsreihe auslassen
        if (el.closest('.chips, .marquee, .rg-relics') || (outside && el.parentElement?.style.overflow === 'hidden')) continue;
        if (clipped || outside) found.push(`${d}/${p}: <${el.tagName.toLowerCase()} class="${el.className}"> "${el.textContent!.trim().slice(0, 40)}" ${clipped ? 'abgeschnitten' : ''}${outside ? ` außerhalb (${Math.round(r.left)}…${Math.round(r.right)})` : ''}`);
      }
    }
  }
  if (orig) localStorage.setItem(key, orig);
  return [...new Set(found)];
}
