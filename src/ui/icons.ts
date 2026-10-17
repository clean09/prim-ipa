// Einfache Linien-Icons (24×24, currentColor).
const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  prime: svg('<circle cx="12" cy="12" r="2.2"/><circle cx="5" cy="6" r="1.4"/><circle cx="19" cy="7" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="18" cy="17" r="1.4"/><path d="M6.3 7l4 3.6M17.7 8l-4 3M7.2 17l3.4-3.6M16.6 16.2l-3-3"/>'),
  lab: svg('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21.5h11.6a2 2 0 001.7-3L14 9V3"/><path d="M7 15h10"/>'),
  bh: svg('<circle cx="12" cy="12" r="3.4" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="3.6"/><path d="M5 8.5a8 8 0 0114 0"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  ai: svg('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
  ram: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5"/><path d="M4.5 7.5c2-1.5 4.6-1 7.5 4.5s5.5 6 7.5 4.5" opacity=".7"/>'),
  check: svg('<path d="M4 12.5l5 5L20 6.5"/>'),
  board: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  chip: svg('<rect x="5" y="2" width="14" height="20" rx="3"/><rect x="8.5" y="7" width="7" height="6" rx="1"/><path d="M8.5 16.5h7M10 4.5h4"/>'),
  game: svg('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="13.8" r="1" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  star: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  cut: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5M12 12h8.5" /><path d="M12 3.5a8.5 8.5 0 018.5 8.5H12z" fill="currentColor" opacity=".35"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor"/>'),
  dice: svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>'),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>'),
};
export type IconName = keyof typeof ICONS;

export function icon(name: IconName): HTMLElement {
  const s = document.createElement('span');
  s.style.cssText = 'display:inline-grid;width:22px;height:22px;flex:none';
  s.innerHTML = ICONS[name];
  (s.firstElementChild as SVGElement).style.cssText = 'width:100%;height:100%';
  return s;
}
